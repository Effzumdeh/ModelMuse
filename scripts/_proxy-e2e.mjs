/**
 * Proxy-E2E-Abnahmetest (EIN echter Browser-Auftrag aus dem Player):
 * startet Proxy (8787) + statischen Server, steuert Chromium (SwiftShader),
 * gibt einen freien Begriff ein (Server-Key-Fallback, kein BYOK-Key),
 * wartet auf Generierung, prueft S1+S5 pass, Screenshot dist/proxy-e2e.png.
 * Aufruf: node scripts/_proxy-e2e.mjs [begriff]
 * Kein Key-Kontakt (nur Längen/Status werden geloggt).
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TERM = process.argv[2] ?? 'Handbohrmaschine';
const PROXY_PORT = 8787;
const WEB_PORT = 8095;
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

const proxy = spawn('node', ['scripts/proxy.mjs', String(PROXY_PORT)], { cwd: process.cwd() });
const web = spawn('node', ['scripts/serve.mjs', String(WEB_PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(proxy, `http://127.0.0.1:${PROXY_PORT}/`, 15000, 'proxy');
  await waitFor(web, `http://127.0.0.1:${WEB_PORT}/`, 15000, 'web');
  const health = await fetch(`http://127.0.0.1:${PROXY_PORT}/health`).then((r) => r.json());
  if (!health.ok) throw new Error('Proxy-Health nicht ok');
  console.log(`bereit: proxy=${health.service} web=serve (term=${TERM})`);

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

  await page.fill('#live-term', TERM);
  const keyVal = await page.inputValue('#live-key');
  console.log(`key-feld-leer: ${keyVal === ''}`);
  await page.click('#live-go');
  await page.waitForFunction(
    () => document.querySelector('#live-status')?.textContent?.includes('geladen'),
    undefined,
    { timeout: 540000 }
  );
  const status = (await page.textContent('#live-status')).trim().slice(0, 200);
  const report = (await page.textContent('#verify-report')).slice(0, 2000);
  console.log(`status: ${status}`);
  const s1 = /S1/.test(report) && !/S1[^]*fail/i.test(report.split('S2')[0] ?? '');
  const s5 = report.includes('S5');
  const keinRot = !/rot/i.test(report);
  console.log(`report-head: ${report.slice(0, 300).replace(/\s+/g, ' ')}`);
  if (!s5 || !keinRot) throw new Error('S1/S5-Beleg fehlt (S5 oder rot-Fund)');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'dist/proxy-e2e.png' });
  console.log('screenshot: dist/proxy-e2e.png');
  await writeFile('dist/proxy-e2e.json', JSON.stringify({
    term: TERM,
    proxyPrefill: proxyVal,
    byok: false,
    serverKeyFallback: true,
    dauerS: Math.round((Date.now() - t0) / 1000),
    status,
    s1Hinweis: s1 ? 'S1-Segment ohne fail' : 'S1-Segment unklar',
    s5: s5 ? 'pass-segment vorhanden' : 'fehlt',
    rot: !keinRot,
    screenshot: 'dist/proxy-e2e.png',
  }, null, 2));
  console.log('E2E-OK');
} finally {
  if (browser) await browser.close();
  proxy.kill();
  web.kill();
}
