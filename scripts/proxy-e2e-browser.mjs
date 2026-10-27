/**
 * Proxy-E2E-Abnahmetest: EIN echter Browser-Auftrag aus dem Player.
 * Startet Proxy (8787) + statischen Server, steuert Chromium (SwiftShader),
 * gibt einen freien Begriff EIN, traegt den Key aus der Sitzung ein
 * (BYOK, Key aus Key_muse.md NUR in den Speicher des Browsers, nie in Logs),
 * klickt Generieren. Bei HTTP 429: 60 s warten, EINMAL einzeln wiederholen.
 * Beleg: dist/proxy-e2e.png (1280x720, Modell sichtbar) + Call in
 * dist/generation-log.json mit Quelle "browser-e2e".
 * Aufruf: node scripts/proxy-e2e-browser.mjs [begriff]
 * Kein Key-Kontakt (nur Laenge/Status werden geloggt).
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { buildFreePrompt } from '../src/shell/ui-livegen.js';

const TERM = process.argv[2] ?? 'Handbohrmaschine';
const PROXY_PORT = 8787;
const WEB_PORT = 8095;
const KEYFILE = 'C:/Users/flori/OneDrive/Key_muse.md';
const LOGFILE = 'dist/generation-log.json';
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

/** Genau ein Generierungsversuch: ausfuellen + klicken + auf Abschluss warten. */
async function attempt(page, term, round) {
  await page.fill('#live-term', term);
  // Key aus Sitzung: Feld neu belegen (Consent bleibt aus -> nur Speicher).
  await page.fill('#live-key', '');
  await page.fill('#live-key', process.env.E2E_BYOK ?? '');
  await page.click('#live-go');
  await page.waitForFunction(
    () => /geladen|Tempolimit|[uü]berlastet|abgelehnt|Berechtigung|Modellpr[üu]fung|g[üu]ltig/.test(document.querySelector('#live-status')?.textContent ?? ''),
    undefined,
    { timeout: 1250000 }
  );
  const status = ((await page.textContent('#live-status')) ?? '').trim();
  console.log(`versuch ${round}: status-head=${status.slice(0, 160)}`);
  return status;
}

const keyRaw = (await readFile(KEYFILE, 'utf8')).trim().replace(/^[\"'`]|[\"'`]$/g, '');
if (keyRaw.length < 8 || /\s/.test(keyRaw)) {
  console.error('E2E: Key-Format ungueltig (Laenge/Whitespace)');
  process.exit(2);
}
process.env.E2E_BYOK = keyRaw; // nur Prozess-Speicher, nie geloggt
console.log(`E2E: Sitzung-Key geladen (len=${keyRaw.length}, Wert redaktiert)`);

const proxy = spawn('node', ['scripts/proxy.mjs', String(PROXY_PORT)], { cwd: process.cwd() });
const web = spawn('node', ['scripts/serve.mjs', String(WEB_PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(proxy, `http://127.0.0.1:${PROXY_PORT}/`, 15000, 'proxy');
  await waitFor(web, `http://127.0.0.1:${WEB_PORT}/`, 15000, 'web');
  const health = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`).then((r) => r.json());
  if (!health.ok) throw new Error('Proxy-Health nicht ok');
  console.log(`bereit: proxy=${health.service} provider=${(health.providers ?? []).join(',')} defaultModel=${health.defaultModel}`);
  if (health.defaultModel !== 'muse-spark-1.3-contributor') throw new Error('Proxy-Default ist nicht muse-spark-1.3-contributor');

  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${WEB_PORT}/dist/lab-player.html`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    undefined,
    { timeout: 90000 }
  );
  const proxyVal = await page.inputValue('#live-proxy');
  console.log(`proxy-prefill: ${proxyVal}`);
  if (proxyVal !== `http://127.0.0.1:${PROXY_PORT}/generate`) throw new Error('Proxy-URL nicht vorbelegt');

  let status = await attempt(page, TERM, 1);
  // HTTP 429 -> 60 s warten, EINMAL einzeln wiederholen (User-Vorgabe).
  if (/Tempolimit|429/.test(status)) {
    console.log('E2E: 429/Tempolimit -> warte 60s, wiederhole EINMAL');
    await page.waitForTimeout(60000);
    status = await attempt(page, TERM, 2);
  }
  if (!/geladen/.test(status)) throw new Error(`Generierung fehlgeschlagen: ${status.slice(0, 200)}`);

  const report = (await page.textContent('#verify-report')) ?? '';
  console.log(`report-head: ${report.slice(0, 300).replace(/\s+/g, ' ')}`);
  const s1 = /S1/.test(report) && !/S1[^]*fail/i.test(report.split('S2')[0] ?? '');
  const s5 = report.includes('S5');
  const keinRot = !/rot/i.test(report);
  console.log(`s1-segment-ohne-fail=${s1} s5=${s5} kein-rot=${keinRot}`);
  if (!s5 || !keinRot) throw new Error('S1/S5-Beleg fehlt (S5 oder rot-Fund)');
  const provLabel = await page.$eval('#prov-model', (el) => el.options[el.selectedIndex]?.textContent ?? '').catch(() => '');
  console.log(`provider-modell-label: ${provLabel.slice(0, 80)}`);

  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'dist/proxy-e2e.png' });
  console.log('screenshot: dist/proxy-e2e.png');
  const png = await readFile('dist/proxy-e2e.png');
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`screenshot-sha256: ${sha.slice(0, 16)}… bytes=${png.length}`);

  const promptBytes = Buffer.byteLength(buildFreePrompt(TERM), 'utf8');
  const entry = {
    zweck: `Browser-E2E Freimodus (Meta-Pfad, Proxy localhost:${PROXY_PORT})`,
    quelle: 'browser-e2e',
    modell: 'muse-spark-1.3-contributor',
    provider: 'meta-muse',
    transport: `Browser -> http://127.0.0.1:${PROXY_PORT}/generate (BYOK Sitzung) -> https://api.meta.ai/v1/chat/completions (SSE)`,
    begriff: TERM,
    promptBytes,
    startUtc: new Date(t0).toISOString(),
    endeUtc: new Date().toISOString(),
    dauerS: Math.round((Date.now() - t0) / 1000),
    status: status.slice(0, 200),
    verify: `S1-segment-ohne-fail=${s1}, S5-segment-vorhanden=${s5}, kein-rot=${keinRot}`,
    providerLabel: provLabel.slice(0, 80),
    screenshot: 'dist/proxy-e2e.png',
    screenshotSha256: sha,
    screenshotBytes: png.length,
    keyKontakt: 'BYOK nur Sitzungsspeicher (Feld), nie localStorage, nie Logs',
  };
  await writeFile('dist/proxy-e2e.json', JSON.stringify({ term: TERM, ...entry }, null, 2));
  // Generation-Log ergaenzen (genau EIN Call mit Quelle browser-e2e).
  const logRaw = await readFile(LOGFILE, 'utf8');
  const log = JSON.parse(logRaw);
  log.calls = Array.isArray(log.calls) ? log.calls : [];
  if (!log.calls.some((c) => c && c.quelle === 'browser-e2e')) log.calls.push(entry);
  else throw new Error('generation-log enthaelt bereits browser-e2e (genau EIN Auftrag)');
  await writeFile(LOGFILE, JSON.stringify(log, null, 2) + '\n');
  console.log('E2E-OK (1 Auftrag, Quelle browser-e2e im generation-log)');
} finally {
  process.env.E2E_BYOK = '';
  if (browser) await browser.close();
  proxy.kill();
  web.kill();
}
