/**
 * Live-App-Screenshots der Standalone-v14 (dist-standalone/modelmuse-standalone.html):
 * je 2D-Beispiel (svg/mermaid/chart/d3/katex) + 1 3D-Showcase (chemie-koffein)
 * im geoeffneten Live-Viewer fotografieren: Viewport 1280x720, Labels + Maße an,
 * App-Chrome sichtbar (Full-Page-Screenshot, kein Element-Crop).
 * Ablage: dist-standalone/shots-live/<id>.png + report.json, Liste in docs/LIVE-SHOTS.md.
 *
 * Eigener lokaler Server (kein file://), Playwright-Chromium mit SwiftShader-WebGL,
 * 0 pageerrors sind ROT-Kriterium (exit 1).
 *
 * Aufruf: node scripts/shots-live-standalone.mjs [port]  (Default 8131)
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const PORT = Number(process.argv[2] ?? 8131);
const OUT = join(ROOT, 'dist-standalone', 'shots-live');
const PAGE_URL = `http://127.0.0.1:${PORT}/dist-standalone/modelmuse-standalone.html`;

const TARGETS = [
  { id: 'demo-2d-svg', kind: '2d', hint: 'Wasserkocher' },
  { id: 'demo-2d-mermaid', kind: '2d', hint: 'Photosynthese' },
  { id: 'demo-2d-chart', kind: '2d', hint: 'Wirkungsgrad' },
  { id: 'demo-2d-d3', kind: '2d', hint: 'Rechnernetz' },
  { id: 'demo-2d-katex', kind: '2d', hint: 'pq-Formel' },
  { id: 'chemie-koffein', kind: '3d', hint: 'Koffein' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
      if (!path.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (existsSync(path) && statSync(path).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolveP) => {
    server.listen(PORT, '127.0.0.1', () => resolveP(server));
  });
}

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function must(cond, msg) {
  if (!cond) {
    console.error(`shots-live: FEHLER ${msg}`);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

const server = await startServer();
console.log(`shots-live: server ${PAGE_URL}`);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
});
const pageerrors = [];
const consoleErrors = [];
let results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  page.on('pageerror', (err) => pageerrors.push(String(err).slice(0, 500)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });

  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => (document.querySelector('aside h2')?.textContent ?? '').includes('Modelle'),
    null,
    { timeout: 90000 },
  );
  await page.waitForSelector('aside li', { timeout: 60000 });
  const labCount = await page.locator('aside li').count();
  must(labCount === 10, `erwartet 10 Labs in Sidebar, gefunden ${labCount}`);

  // Labels + Maße einschalten (alle Checkboxen an; Default ist bereits an).
  const boxes = page.locator('input[type="checkbox"]');
  const nBoxes = await boxes.count();
  must(nBoxes >= 2, `erwartet >=2 Checkboxen (Labels/Maße), gefunden ${nBoxes}`);
  for (let i = 0; i < nBoxes; i += 1) {
    if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
  }
  // Ersten Viewport-Render abwarten (Boot-Modell).
  await page.waitForSelector('#viewport canvas, #viewport svg', { timeout: 60000 });
  await page.waitForTimeout(3000);

  for (const t of TARGETS) {
    const item = page.locator('aside li', { hasText: t.hint }).first();
    must((await item.count()) >= 1, `Sidebar-Eintrag fehlt: ${t.hint}`);
    await item.locator('button').first().click();
    if (t.kind === '3d') {
      await page.waitForSelector('#viewport canvas', { timeout: 60000 });
      await page.waitForTimeout(3500);
    } else {
      await page.waitForSelector('#viewport svg, #viewport canvas, #viewport .katex-block', { timeout: 60000 });
      await page.waitForTimeout(2500);
    }
    // Labels/Maße muessen je Shot noch an sein.
    const states = await page.evaluate(() =>
      [...document.querySelectorAll('input[type="checkbox"]')].map((c) => c.checked),
    );
    must(states.length >= 2 && states.every(Boolean), `${t.id}: Labels/Maße nicht an (${JSON.stringify(states)})`);
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    const file = join(OUT, `${t.id}.png`);
    await page.screenshot({ path: file }); // Full-Page mit App-Chrome, 1280x720
    const buf = await readFile(file);
    const { width, height } = pngSize(buf);
    must(width === 1280 && height === 720, `${t.id}: PNG ${width}x${height}, erwartet 1280x720`);
    must(buf.length > 20000, `${t.id}: PNG verdaechtig klein (${buf.length} B)`);
    const st = await stat(file);
    results.push({ id: t.id, kind: t.kind, hint: t.hint, file: `dist-standalone/shots-live/${t.id}.png`, bytes: st.size, width, height });
    console.log(`shots-live: ${t.id} ${width}x${height} ${st.size}B labels+maße=an`);
  }
} finally {
  await browser.close();
  server.close();
}

must(pageerrors.length === 0, `${pageerrors.length} pageerrors: ${pageerrors.join(' | ').slice(0, 400)}`);
if (consoleErrors.length > 0) {
  console.log(`shots-live: Hinweis ${consoleErrors.length} console-errors (nicht-rot):`);
  for (const c of consoleErrors.slice(0, 5)) console.log(`  - ${c}`);
}

const report = {
  createdAt: new Date().toISOString(),
  url: '/dist-standalone/modelmuse-standalone.html',
  viewport: { width: 1280, height: 720 },
  labels: true,
  measurements: true,
  appChrome: 'full-page-screenshot',
  pageerrors,
  consoleErrors,
  shots: results,
};
await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`shots-live: OK (${results.length}/${TARGETS.length} Shots, 0 pageerrors)`);
