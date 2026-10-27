/**
 * O-06 Demo-Fahrplan (180-s-Fenster, OHNE Generierung).
 * Bauplan Abschnitt 10 (Aufgaben-Zitat 27.10.2026 abends): 0-60 s freies Modell
 * live generieren (Fallback gpu-example), 60-120 s FI-Lab + Verify-Bericht
 * (Fallback gespeicherter Bericht), 120-180 s Niveauwechsel + Labels/Messung/
 * Aufgabe (Fallback 2D-Ansicht). HARTER BEFUND: Freimodus dauert 92-401 s
 * (dist/generation-log.json; H2O 130 s, NaCl 171 s) — Segment 1 ist mit
 * Live-Generierung NICHT haltbar. Diese Demo nimmt ehrlich den F2-Pfad
 * (vorbereitetes Modell), Live-Generierung bleibt ausserhalb des Fensters.
 * Ablauf-Vorbild (serve+goto+Status-Wait): scripts/chemie-e2e.mjs —
 * KEINE Generierung, KEIN Key, KEIN Proxy hier uebernommen.
 * Selektoren belegt via tests/fallback.spec.mjs + src/shell/index.html;
 * Niveauwechsel via player.setLevel (src/runtime/player.js), UI: #level-select.
 * Aufruf: node scripts/demo-timed.mjs [port]  (Default 8099)
 * Ergebnis: dist/demo-timed.json {segmente:{s1:{ms,pfad},s2,s3}, gesamtS,
 * alleFehlerfrei, bemerkung}. Exit 0 nur wenn GESAMT < 180 s UND fehlerfrei.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.argv[2] ?? 8099);
const BUDGET_S = 180;
const F3_BELEG = 'dist/chemie-h2o-meta.json';
const t0 = Date.now();
const seg = {};
let alleFehlerfrei = true;
const notizen = [];

function waitFor(proc, needle, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${label}: Timeout (${needle})`)), timeoutMs);
    proc.stdout.on('data', (d) => { buf += d.toString(); if (buf.includes(needle)) { clearTimeout(timer); resolve(); } });
    proc.stderr.on('data', (d) => { buf += d.toString(); });
    proc.on('exit', (c) => reject(new Error(`${label}: Exit ${c} (log: ${buf.slice(-300)})`)));
  });
}

const web = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(web, `http://127.0.0.1:${PORT}/`, 15000, 'serve');
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // S1: F2-Ersatz — Lab laden (gpu-example, vorbereitet), Verify-Bericht S1-S5 + Ampel.
  let t = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/dist/lab-player.html`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 45000 });
  const optionen = await page.$eval('#model-select', (el) => [...el.options].map((o) => o.value)).catch(() => []);
  if (optionen.includes('gpu-example') && (await page.inputValue('#model-select').catch(() => '')) !== 'gpu-example') {
    await page.selectOption('#model-select', 'gpu-example');
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => document.querySelector('#verify-report')?.textContent?.includes('S4'), undefined, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const report = ((await page.textContent('#verify-report')) ?? '').trim();
  const modellId = await page.inputValue('#model-select').catch(() => 'unbekannt');
  const sMarken = ['S1', 'S2', 'S3', 'S4', 'S5'].map((m) => report.includes(m));
  const ampel = ((await page.textContent('.lab-ampel')) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`S1: modell=${modellId} S1-S5=[${sMarken}] ampel="${ampel}"`);
  if (modellId !== 'gpu-example' || !sMarken.every(Boolean)) {
    alleFehlerfrei = false;
    notizen.push(`S1 unvollstaendig: modell=${modellId} S1-S5=[${sMarken}]`);
  }
  seg.s1 = { ms: Date.now() - t, pfad: 'F2-Ersatz (Live-Generierung 92-401 s ausserhalb Budget)', modellId, s1bisS5: sMarken, ampel };

  // S2: F3-Pfad — gespeicherter Bericht eines FI-Labs (Datei-Beleg, kein Fake).
  t = Date.now();
  if (!existsSync(F3_BELEG)) {
    alleFehlerfrei = false;
    notizen.push(`S2: F3-Beleg fehlt (${F3_BELEG})`);
    seg.s2 = { ms: Date.now() - t, pfad: `F3-gespeicherter-Bericht (${F3_BELEG} FEHLT)`, ok: false };
  } else {
    const j = JSON.parse(await readFile(F3_BELEG, 'utf8'));
    const ok = typeof j.zweck === 'string' && typeof j.verify === 'string' && typeof j.status === 'string'
      && typeof j.screenshot === 'string' && existsSync(j.screenshot);
    console.log(`S2: ${j.zweck} | ${j.verify} | status="${String(j.status).slice(0, 80)}" | shot=${j.screenshot} ok=${ok}`);
    if (!ok) { alleFehlerfrei = false; notizen.push('S2: F3-Beleg unvollstaendig (Pflichtfelder/Screenshot)'); }
    seg.s2 = { ms: Date.now() - t, pfad: `F3-gespeicherter-Bericht (${F3_BELEG})`, ok, verify: j.verify, belegDauerS: j.dauerS };
  }

  // S3: Niveauwechsel + Labels/Messung/Aufgabe, dann F4-Pfad (2D-Fallback, Anwesenheit).
  t = Date.now();
  const stufen = {};
  for (const level of ['basis', 'aufbau', 'profi']) {
    await page.selectOption('#level-select', level);
    await page.waitForTimeout(900);
    const n = await page.evaluate(() => ({
      labels: document.querySelectorAll('#annotation-list li').length,
      tasks: document.querySelectorAll('#task-list li').length,
    }));
    stufen[level] = n;
    console.log(`S3: niveau=${level} labels=${n.labels} aufgaben=${n.tasks}`);
  }
  if (!(stufen.aufbau.labels > 0 && stufen.aufbau.tasks > 0 && stufen.profi.tasks > 0)) {
    alleFehlerfrei = false;
    notizen.push(`S3: Labels/Aufgaben lueckenhaft (${JSON.stringify(stufen)})`);
  }
  await page.click('text=2D-Modus');
  await page.waitForSelector('#fallback-panel:not([hidden])', { timeout: 15000 });
  const fbText = ((await page.textContent('#fallback-text')) ?? '').trim();
  const fbSichtbar = await page.locator('#fallback-panel').isVisible();
  console.log(`S3: F4 sichtbar=${fbSichtbar} text="${fbText.slice(0, 80)}"`);
  if (!fbSichtbar || !fbText.includes('F3')) {
    alleFehlerfrei = false;
    notizen.push(`S3: F4-Anwesenheit fehlt (sichtbar=${fbSichtbar}, F3-Erwahnung=${fbText.includes('F3')})`);
  }
  seg.s3 = { ms: Date.now() - t, pfad: 'Niveauwechsel (setLevel) + F4-2D-Anwesenheit', stufen, fallbackSichtbar: fbSichtbar, fallbackErwaehntF3: fbText.includes('F3') };

  const gesamtS = Math.round((Date.now() - t0) / 1000);
  const budgetGehalten = gesamtS < BUDGET_S;
  const out = {
    startUtc: new Date(t0).toISOString(), endeUtc: new Date().toISOString(),
    segmente: seg, gesamtS, budgetS: BUDGET_S, budgetGehalten, alleFehlerfrei,
    bemerkung: 'Demo ohne Generierung: S1 F2-Ersatz (Live 92-401 s ausserhalb Budget), S2 F3-Datei-Beleg, S3 setLevel + F4-Anwesenheit. Keine erfundenen Zeiten/Pfade.'
      + (notizen.length > 0 ? ` NOTIZEN: ${notizen.join(' | ')}` : ''),
  };
  await writeFile('dist/demo-timed.json', JSON.stringify(out, null, 2));
  console.log(`DEMO-TIMED gesamt=${gesamtS}s budgetGehalten=${budgetGehalten} alleFehlerfrei=${alleFehlerfrei}`);
  process.exitCode = budgetGehalten && alleFehlerfrei ? 0 : 1;
} finally {
  if (browser) await browser.close();
  web.kill();
}
