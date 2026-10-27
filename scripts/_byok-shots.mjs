/** BYOK-Manuelle Screenshots: Freimodus-Panel mit Dummy-Key (nie Echt-Key).
 * 1280x720, Session-Storage-Verhalten, deutsche Fehlermeldungen.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
const ROOT = resolve('.');
const PORT = 8105;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    const { statSync, existsSync } = await import('node:fs');
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'src/shell/index.html');
    if (url.pathname === '/') p = join(ROOT, 'src/shell/index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/dist/lab-player.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
await page.waitForTimeout(6000);
// 1. Panel-Übersicht (Freimodus sichtbar)
await page.evaluate(() => document.querySelector('.lab-livegen')?.scrollIntoView());
await page.waitForTimeout(1000);
await page.screenshot({ path: 'dist/byok-01-panel.png', animations: 'disabled' });
console.log('byok-01-panel.png');
// 2. Dummy-Key + Proxy + Begriff eintragen (nie Echt-Key), Consent an
await page.fill('#live-proxy', 'http://127.0.0.1:9/nicht-erreichbar');
await page.fill('#live-key', 'LLM_00000000_xxxxxxxxxxxxxxxx');
await page.check('#live-consent');
await page.fill('#live-term', 'Windkraftanlage Test');
await page.screenshot({ path: 'dist/byok-02-eingabe.png', animations: 'disabled' });
console.log('byok-02-eingabe.png');
// 3. Generieren klicken -> deutsche Fehlermeldung (Proxy nicht erreichbar -> E-GEN-5XX oder OFFLINE-Pfad)
await page.click('#live-go');
await page.waitForTimeout(4000);
const status = await page.textContent('#live-status');
console.log('status=' + (status ?? '').slice(0, 160));
await page.screenshot({ path: 'dist/byok-03-status.png', animations: 'disabled' });
console.log('byok-03-status.png');
// 4. Session-Storage prüfen (Consent ja -> Key + Consent in sessionStorage, nie localStorage)
const stores = await page.evaluate(() => ({ sessionKeys: Object.keys(sessionStorage), hasLive: !!sessionStorage.getItem('skillspark-livekey'), hasConsent: sessionStorage.getItem('skillspark-livekey-consent'), localKeys: Object.keys(localStorage) }));
console.log('stores=' + JSON.stringify(stores));
await browser.close();
server.close();
console.log('BYOK-Screenshots fertig');
