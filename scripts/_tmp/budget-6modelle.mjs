/** Budget-Probe: renderer.info (triangles/drawCalls) je Modell via Direkt-Render.
 * Umgeht den gebauten Player (lädt /src/models direkt wie _final-shots __probe).
 * Schreibt dist/final-budgets-6modelle.json. Budgets: Tris <= 150000, Calls <= 400.
 * Aufruf: node scripts/_tmp/budget-6modelle.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve('.');
const PORT = Number(process.argv[2] ?? 8098);
const MODELS = ['gpu-example', 'si-1', 'si-2', 'si-3', 'free-handbohrmaschine', 'chemie-koffein'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};
const PROBE_THREE = `export * from '/node_modules/three/build/three.module.js';
import { WebGLRenderer as RealRenderer } from '/node_modules/three/build/three.module.js';
export class WebGLRenderer extends RealRenderer {
  constructor(opts) { super(opts); window.__renderer = this; }
}`;
const probeHtml = (model) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
#c{width:1280px;height:720px;}canvas{display:block;width:1280px;height:720px;}
</style><script type="importmap">{"imports":{
"three":"/__probe-three.js",
"three/addons/":"/node_modules/three/examples/jsm/",
"wrapper-helpers":"/src/runtime/annotate.js"}}</script></head>
<body><div id="c"></div><div id="out">pending</div>
<script type="module">
import { init } from '/src/models/${model}.js';
const c = document.getElementById('c');
const handle = init(c, { level: 'aufbau', labels: { enabled: true, max: 64 }, measurements: { enabled: true }, dpr: 1, reducedMotion: true, seed: 1, units: 'm', locale: 'de-DE' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const r = window.__renderer;
  const i = r.info;
  document.getElementById('out').textContent = JSON.stringify({ calls: i.render.calls, triangles: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures });
} catch (e) { document.getElementById('out').textContent = JSON.stringify({ error: String(e).slice(0, 200) }); }
</script></body></html>`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__probe-three.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(PROBE_THREE);
      return;
    }
    if (url.pathname.startsWith('/__probe-')) {
      const model = url.pathname.slice('/__probe-'.length);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(probeHtml(model));
      return;
    }
    const p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const budgets = [];
let browser = null;
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  for (const id of MODELS) {
    const p2 = await ctx.newPage();
    const errs = [];
    p2.on('pageerror', (e) => errs.push(String(e?.message ?? e).slice(0, 160)));
    await p2.goto(`http://127.0.0.1:${PORT}/__probe-${id}`, { waitUntil: 'load', timeout: 60000 });
    await p2.waitForTimeout(4000);
    const probe = await p2.evaluate(() => document.getElementById('out')?.textContent ?? '');
    await p2.close();
    let tri = null;
    let calls = null;
    try {
      const j = JSON.parse(probe);
      tri = j.triangles ?? null;
      calls = j.calls ?? null;
      if (j.error) console.log(`${id}: PROBE-FEHLER ${j.error}`);
    } catch { console.log(`${id}: kein JSON (${probe.slice(0, 80)})`); }
    const ok = typeof tri === 'number' && tri <= 150000 && typeof calls === 'number' && calls <= 400;
    budgets.push({ id, triangles: tri, drawCalls: calls, probe, budgetOk: ok, pageerrors: errs });
    console.log(`${id}: tri=${tri} calls=${calls} budgetOk=${ok}`);
  }
} finally {
  try { await browser?.close(); } catch {}
  server.close();
}
await mkdir('dist', { recursive: true });
await writeFile('dist/final-budgets-6modelle.json', JSON.stringify({ at: new Date().toISOString(), budgets }, null, 2));
console.log('final-budgets-6modelle.json geschrieben');
const bad = budgets.filter((b) => !b.budgetOk);
if (bad.length > 0) { console.error(`BUDGET-FAIL: ${bad.map((b) => b.id).join(',')}`); process.exit(1); }
console.log(`BUDGET-OK: alle ${budgets.length} Modelle im Budget`);
