import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
const ROOT = resolve('.');
const PORT = 8106;
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
await page.waitForTimeout(5000);
await page.fill('#live-proxy', '');
await page.fill('#live-key', 'LLM_00000000_xxxxxxxxxxxxxxxx');
await page.fill('#live-term', 'Windkraftanlage');
await page.evaluate(() => document.querySelector('.lab-livegen')?.scrollIntoView());
await page.click('#live-go');
await page.waitForTimeout(2000);
console.log('offline-status=' + (await page.textContent('#live-status'))?.slice(0, 200));
await page.screenshot({ path: 'dist/byok-04-offline-de.png', animations: 'disabled' });
console.log('byok-04-offline-de.png');
await browser.close();
server.close();
