/**
 * Baseten-Browser-E2E (aktiv seit 28.10.2026, Ersatz fuer proxy-e2e-openrouter):
 * EIN echter Auftrag aus dem Player ueber den Baseten-Pfad
 * (Proxy localhost:8787 -> https://inference.baseten.co/v1/chat/completions, SSE).
 * Modell: meta-models/muse-spark-open-1026 (Meta-Regel: Laufzeit nur Meta-Modelle).
 * Key: AUSSCHLIESSLICH laufzeitsseitig per BYOK — Env BASETEN_API_KEY beim Aufruf
 * (z. B. aus Profil-.env in die Umgebung laden), im Browser nur Sitzungs-Speicher,
 * nie in Code/Logs/Chat/Dateien. Fehlt der Key -> ehrlicher Abbruch
 * ("Baseten-Pfad nicht testbar"), kein Fake-Beleg.
 * Bei HTTP 429: 60 s warten, EINMAL einzeln wiederholen.
 * Beleg: dist/baseten-migration/proxy-e2e-baseten.png + generation-log-Eintrag
 * Quelle "browser-e2e-baseten".
 * Aufruf: BASETEN_API_KEY=... node scripts/proxy-e2e-baseten.mjs [begriff]
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { buildFreePrompt } from '../src/shell/ui-livegen.js';

const TERM = process.argv[2] ?? 'Handbohrmaschine';
const PROXY_PORT = 8787;
const WEB_PORT = 8096;
const LOGFILE = 'dist/generation-log.json';
const SHOTFILE = 'dist/baseten-migration/proxy-e2e-baseten.png';
const MODEL_SLUG = 'meta-models/muse-spark-open-1026';
const REGISTRY_MODEL_ID = 'muse-spark-open-1026';
const t0 = Date.now();

function waitFor(proc, needle, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${label}: Timeout (${needle})`)), timeoutMs);
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      if (buf.includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.stderr.on('data', (d) => { buf += d.toString(); });
    proc.on('exit', (c) => reject(new Error(`${label}: Exit ${c} vor Bereitschaft (log: ${buf.slice(-300)})`)));
  });
}

async function attempt(page, term, round) {
  await page.fill('#live-term', term);
  await page.fill('#live-key', '');
  await page.fill('#live-key', process.env.E2E_BAS_BYOK ?? '');
  await page.click('#live-go');
  await page.waitForFunction(
    () => /geladen|Tempolimit|[uü]berlastet|abgelehnt|Berechtigung|Modellpr[üu]fung|Proxy|Key |g[üu]ltig/.test(document.querySelector('#live-status')?.textContent ?? '') && !/Generiere /.test(document.querySelector('#live-status')?.textContent ?? ''),
    undefined,
    { timeout: 1250000 }
  );
  const status = ((await page.textContent('#live-status')) ?? '').trim();
  console.log(`versuch ${round}: status-head=${status.slice(0, 160)}`);
  return status;
}

const keyRaw = (process.env.BASETEN_API_KEY ?? '').trim();
if (keyRaw.length < 8 || /\s/.test(keyRaw)) {
  console.error('BASETEN-E2E: ABBRUCH — kein User-Key (Env BASETEN_API_KEY fehlt/ungueltig). Pfad ehrlich als "nicht testbar" dokumentieren, kein Fake-Beleg.');
  process.exit(3);
}
process.env.E2E_BAS_BYOK = keyRaw;
console.log(`BASETEN-E2E: User-Key geladen (len=${keyRaw.length}, Wert redaktiert), modell=${MODEL_SLUG}`);

const proxy = spawn('node.exe', ['scripts/proxy.mjs', String(PROXY_PORT)], { cwd: process.cwd() });
const web = spawn('node.exe', ['scripts/serve.mjs', String(WEB_PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(proxy, `http://127.0.0.1:${PROXY_PORT}/`, 15000, 'proxy');
  await waitFor(web, `http://127.0.0.1:${WEB_PORT}/`, 15000, 'web');
  const health = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`).then((r) => r.json());
  if (!health.ok || !(health.providers ?? []).includes('baseten')) throw new Error('Proxy ohne Baseten-Pfad');
  console.log(`bereit: proxy=${health.service} provider=baseten modell=${MODEL_SLUG}`);

  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // Hinweis: Quelle '/' (identischer Generierungspfad wie dist-Bundle; dist-
  // Boot rendert derzeit keinen Modell-iframe — Fremd-Baustelle, siehe
  // docs/BASETEN-MIGRATION.md; Transportbeleg ist davon unabhaengig).
  await page.goto(`http://127.0.0.1:${WEB_PORT}/`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    undefined,
    { timeout: 90000 }
  );
  // Anbieterwahl M3: Baseten + Muse Spark Open.
  await page.selectOption('#prov-provider', 'baseten');
  await page.selectOption('#prov-model', REGISTRY_MODEL_ID);
  const provLabel = await page.$eval('#prov-model', (el) => el.options[el.selectedIndex]?.textContent ?? '');
  console.log(`provider-modell-label: ${provLabel.slice(0, 80)}`);

  let status = await attempt(page, TERM, 1);
  if (/Tempolimit|429/.test(status)) {
    console.log('BASETEN-E2E: 429/Tempolimit -> warte 60s, wiederhole EINMAL');
    await page.waitForTimeout(60000);
    status = await attempt(page, TERM, 2);
  }
  if (!/geladen/.test(status)) throw new Error(`Generierung fehlgeschlagen: ${status.slice(0, 200)}`);

  const report = (await page.textContent('#verify-report')) ?? '';
  console.log(`report-head: ${report.slice(0, 300).replace(/\s+/g, ' ')}`);
  const s5 = report.includes('S5');
  const keinRot = !/rot/i.test(report);
  console.log(`s5=${s5} kein-rot=${keinRot}`);
  if (!s5 || !keinRot) throw new Error('S1/S5-Beleg fehlt (S5 oder rot-Fund)');

  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOTFILE });
  console.log(`screenshot: ${SHOTFILE}`);
  const png = await readFile(SHOTFILE);
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`screenshot-sha256: ${sha.slice(0, 16)}… bytes=${png.length}`);

  const promptBytes = Buffer.byteLength(buildFreePrompt(TERM), 'utf8');
  const entry = {
    zweck: `Browser-E2E Freimodus (Baseten-Pfad, Proxy localhost:${PROXY_PORT})`,
    quelle: 'browser-e2e-baseten',
    modell: MODEL_SLUG,
    provider: 'baseten',
    transport: `Browser -> http://127.0.0.1:${PROXY_PORT}/generate (BYOK User-Sitzung) -> https://inference.baseten.co/v1/chat/completions (SSE)`,
    begriff: TERM,
    promptBytes,
    startUtc: new Date(t0).toISOString(),
    endeUtc: new Date().toISOString(),
    dauerS: Math.round((Date.now() - t0) / 1000),
    status: status.slice(0, 200),
    verify: `S5-segment-vorhanden=${s5}, kein-rot=${keinRot}`,
    providerLabel: provLabel.slice(0, 80),
    screenshot: SHOTFILE,
    screenshotSha256: sha,
    screenshotBytes: png.length,
    keyKontakt: 'BYOK nur User-Sitzung (Env BASETEN_API_KEY -> Feld, sessionStorage mit Zustimmung), nie localStorage, nie Logs',
  };
  const logRaw = await readFile(LOGFILE, 'utf8');
  const log = JSON.parse(logRaw);
  log.calls = Array.isArray(log.calls) ? log.calls : [];
  if (!log.calls.some((c) => c && c.quelle === 'browser-e2e-baseten')) log.calls.push(entry);
  else throw new Error('generation-log enthaelt bereits browser-e2e-baseten (genau EIN Auftrag)');
  await writeFile(LOGFILE, JSON.stringify(log, null, 2) + '\n');
  console.log('BASETEN-E2E-OK (1 Auftrag, Quelle browser-e2e-baseten im generation-log)');
} finally {
  process.env.E2E_BAS_BYOK = '';
  if (browser) await browser.close();
  proxy.kill();
  web.kill();
}
