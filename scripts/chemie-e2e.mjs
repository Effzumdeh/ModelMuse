/**
 * Teil 3 — Chemie-Testfaelle (fachfremd): EIN Call pro Pfad und Begriff.
 * Begriffe (messbare Specs statt Freitext):
 *   h2o  "Wassermolekuel H2O ..."  (Bindungswinkel 104,5 Grad, O-H 96 pm)
 *   nacl "Natriumchlorid-Kristallgitter NaCl ..." (Gitterkonstante 564 pm)
 * Ablauf = Player-Freimodus ueber Proxy (Meta- oder OpenRouter-Pfad).
 * Belege: dist/chemie-{id}-{pfad}.png + dist/chemie-{id}-{pfad}.json
 * (Labels/Atome, Messwerte, Spec-Abgleich). NICHT in kuratierte Bibliothek.
 * Ehrlichkeit: Spec-Abgleich prueft ModellANGABEN (Texte); ob Winkel/Masse
 * physikalisch stimmen oder geraten sind, steht im Report-Absatz.
 * Aufruf: node.exe scripts/chemie-e2e.mjs h2o|nacl meta|openrouter
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { buildFreePrompt, buildFreeManifest, extractMetaI18n } from '../src/shell/ui-livegen.js';
import { extractMeta } from '../src/runtime/verify.js';

const ID = process.argv[2] ?? 'h2o';
const PFAD = process.argv[3] ?? 'meta';
const SPECS = {
  h2o: {
    begriff: 'Wassermolekuel H2O: ein Sauerstoffatom plus zwei Wasserstoffatome, gewinkelter Bau mit Bindungswinkel 104,5 Grad, O-H-Bindungslaenge 96 pm. Atome als Kugeln (O rot, H weiss), Bindungen als Stäbe, Bindungswinkel und Bindungslaenge als Messungen beschriften.',
    zahlen: ['104,5', '96'],
    labelsMin: ['O', 'H'],
    check: 'Bindungswinkel 104,5 Grad + O-H 96 pm',
  },
  nacl: {
    begriff: 'Natriumchlorid-Kristallgitter NaCl: kubisch flaechenzentriertes Gitter aus Natrium- und Chlorid-Ionen im Wechsel (Na violett, Cl gruen), mindestens 8 Ionen, Gitterkonstante 564 pm als Kantenlaenge der Elementarzelle messen und beschriften.',
    zahlen: ['564'],
    labelsMin: ['Na', 'Cl'],
    check: 'Gitterkonstante 564 pm',
  },
};
const spec = SPECS[ID];
if (!spec) { console.error(`unbekannte Chemie-ID: ${ID} (h2o|nacl)`); process.exit(2); }
const META = PFAD === 'meta'
  ? { provider: 'meta-muse', model: 'muse-spark-1.3-contributor', provId: 'meta-muse', regModel: 'muse-spark-1.3-contributor', keyFile: 'C:/Users/flori/OneDrive/Key_muse.md', webPort: 8097, quelle: 'chemie-meta' }
  : { provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it:free', provId: 'openrouter', regModel: 'gemma-4-26b-it-free', keyFile: 'C:/Users/flori/OneDrive/Key_openrouter.md', webPort: 8098, quelle: 'chemie-openrouter' };
const PROXY_PORT = 8787;
const t0 = Date.now();

function waitFor(proc, needle, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${label}: Timeout (${needle})`)), timeoutMs);
    proc.stdout.on('data', (d) => { buf += d.toString(); if (buf.includes(needle)) { clearTimeout(timer); resolve(); } });
    proc.stderr.on('data', (d) => { buf += d.toString(); });
    proc.on('exit', (c) => reject(new Error(`${label}: Exit ${c} (log: ${buf.slice(-300)})`)));
  });
}

if (!existsSync(META.keyFile)) {
  console.error(`CHEMIE: ABBRUCH — Key-Datei fehlt (${META.keyFile}). Pfad ehrlich als "nicht testbar" dokumentieren.`);
  process.exit(3);
}
const keyRaw = (await readFile(META.keyFile, 'utf8')).trim().replace(/^["'`]|["'`]$/g, '');
if (keyRaw.length < 8 || /\s/.test(keyRaw)) { console.error('CHEMIE: Key-Format ungueltig'); process.exit(2); }
process.env.CHEMIE_BYOK = keyRaw;
console.log(`CHEMIE ${ID}/${PFAD}: key-len=${keyRaw.length}, modell=${META.model}`);

const proxy = spawn('node.exe', ['scripts/proxy.mjs', String(PROXY_PORT)], { cwd: process.cwd() });
const web = spawn('node.exe', ['scripts/serve.mjs', String(META.webPort)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(proxy, `http://127.0.0.1:${PROXY_PORT}/`, 15000, 'proxy');
  await waitFor(web, `http://127.0.0.1:${META.webPort}/`, 15000, 'web');
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${META.webPort}/dist/lab-player.html`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#verify-report')?.textContent?.includes('S4'), undefined, { timeout: 90000 });
  await page.selectOption('#prov-provider', META.provId);
  await page.selectOption('#prov-model', META.regModel);
  await page.fill('#live-term', spec.begriff);
  await page.fill('#live-key', '');
  await page.fill('#live-key', process.env.CHEMIE_BYOK ?? '');
  await page.click('#live-go');
  await page.waitForFunction(
    () => /geladen|Tempolimit|[uü]berlastet|abgelehnt|Berechtigung|Modellpr[üu]fung|g[üu]ltig/.test(document.querySelector('#live-status')?.textContent ?? ''),
    undefined,
    { timeout: 1250000 }
  );
  const status = ((await page.textContent('#live-status')) ?? '').trim();
  console.log(`status-head: ${status.slice(0, 160)}`);
  const report = (await page.textContent('#verify-report')) ?? '';
  const s1 = /S1/.test(report) && !/S1[^]*fail/i.test(report.split('S2')[0] ?? '');
  const s5 = report.includes('S5');
  const keinRot = !/rot/i.test(report);
  console.log(`s1-segment-ohne-fail=${s1} s5=${s5} kein-rot=${keinRot}`);

  // Spec-Abgleich aus der Registry: generierte Quelle + Manifest lesen.
  const gen = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#annotation-list li')].map((li) => li.textContent ?? '');
    return { annotations: items, status: document.querySelector('#live-status')?.textContent ?? '' };
  });
  const texte = gen.annotations.join(' | ');
  const zahlenGefunden = spec.zahlen.filter((z) => texte.replace(',', '.').includes(z.replace(',', '.')) || texte.includes(z));
  const labelsGefunden = spec.labelsMin.filter((l) => new RegExp(`\\b${l}\\b`).test(texte));
  console.log(`spec-check (${spec.check}): zahlen=[${zahlenGefunden}] labels=[${labelsGefunden}]`);

  await page.waitForTimeout(1500);
  const shot = `dist/chemie-${ID}-${PFAD}.png`;
  await page.screenshot({ path: shot });
  const png = await readFile(shot);
  const sha = createHash('sha256').update(png).digest('hex');
  const entry = {
    zweck: `Chemie-Testfall ${ID} (${spec.check}) ueber ${PFAD}-Pfad`,
    quelle: META.quelle, modell: META.model, provider: META.provider, begriff: spec.begriff,
    promptBytes: Buffer.byteLength(buildFreePrompt(spec.begriff), 'utf8'),
    startUtc: new Date(t0).toISOString(), endeUtc: new Date().toISOString(),
    dauerS: Math.round((Date.now() - t0) / 1000), status: status.slice(0, 200),
    verify: `S1-segment-ohne-fail=${s1}, S5=${s5}, kein-rot=${keinRot}`,
    specCheck: spec.check, zahlenGefunden, labelsGefunden,
    ehrlichkeit: 'ModellANGABEN geprueft (Label-/Messungstexte). Ob Koordinaten-Geometrie physikalisch exakt ist, bleibt Modellverhalten — siehe Report-Absatz.',
    screenshot: shot, screenshotSha256: sha, screenshotBytes: png.length,
    keyKontakt: 'BYOK nur Sitzungsspeicher, nie localStorage, nie Logs',
  };
  await writeFile(`dist/chemie-${ID}-${PFAD}.json`, JSON.stringify(entry, null, 2));
  console.log(`CHEMIE-OK ${ID}/${PFAD} (Artefakte dist/chemie-${ID}-${PFAD}.*, NICHT kuratiert)`);
} finally {
  process.env.CHEMIE_BYOK = '';
  if (browser) await browser.close();
  proxy.kill();
  web.kill();
}
