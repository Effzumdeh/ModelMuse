/**
 * FINALS: je Lab ein PNG (dist/final-<id>.png) plus echte Budgets
 * (triangles/drawCalls via Direkt-Render-Probe) nach dist/final-budgets.json.
 * Kopie eines Repraesentanten nach scratch/modelmuse-final.png.
 * Kein Key-Kontakt, keine Modellveraenderung.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const PORT = Number(process.argv[2] ?? 8097);
const MODELS = ['ae-1', 'ae-2', 'ae-3', 'dup-1', 'dup-2', 'dup-3', 'gpu-example', 'si-1', 'si-2', 'si-3', 'free-handbohrmaschine', 'chemie-koffein'];
const SCRATCH = 'C:/Users/flori/AppData/Local/hermes/cache/scratch';

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

function decodePng(buf) {
  let pos = 8; let width = 0; let height = 0; let colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * channels);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p]; p += 1;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const v = raw[p]; p += 1;
      let r = v;
      if (filter === 1) r = (v + a) & 255;
      else if (filter === 2) r = (v + b) & 255;
      else if (filter === 3) r = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a); const pb = Math.abs(q - b); const pc = Math.abs(q - c);
        r = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      out[y * stride + x] = r;
    }
  }
  return { data: out, width, height, channels };
}

function stats(buf) {
  const { data, width, height, channels } = decodePng(buf);
  const n = width * height;
  let sum = 0; let sum2 = 0; let nonBg = 0;
  for (let i = 0; i < n; i += 1) {
    const r = data[i * channels]; const g = data[i * channels + 1]; const b = data[i * channels + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += lum; sum2 += lum * lum;
    if (Math.abs(r - g) > 4 || Math.abs(g - b) > 4 || lum > 24) nonBg += 1;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { nonBgRatio: nonBg / n, mean, sd };
}

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
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message ?? e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${PORT}/dist/lab-player.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForTimeout(8000);
  for (const id of MODELS) {
    await page.selectOption('#model-select', id);
    await page.waitForTimeout(6000);
    const buf = await page.screenshot({ animations: 'disabled' });
    const out = resolve(`dist/final-${id}.png`);
    await writeFile(out, buf);
    const s = stats(buf);
    const rep = (await page.textContent('#verify-report'))?.slice(0, 200) ?? '';
    // Budget-Probe direkt.
    const p2 = await ctx.newPage();
    await p2.goto(`http://127.0.0.1:${PORT}/__probe-${id}`, { waitUntil: 'load', timeout: 60000 });
    await p2.waitForTimeout(4000);
    const probe = await p2.evaluate(() => document.getElementById('out')?.textContent ?? '');
    await p2.close();
    let tri = null; let calls = null;
    try {
      const j = JSON.parse(probe);
      tri = j.triangles ?? null; calls = j.calls ?? null;
    } catch { /* Fehlertext */ }
    const nonEmpty = s.nonBgRatio >= 0.03 && s.mean > 10 && s.mean < 245 && s.sd >= 8;
    budgets.push({
      id, png: `dist/final-${id}.png`, bytes: buf.length, nonEmpty,
      triangles: tri, drawCalls: calls, probe,
      budgetOk: typeof tri === 'number' && tri <= 150000 && typeof calls === 'number' && calls <= 400,
      reportHead: rep.replace(/\s+/g, ' ').slice(0, 160),
    });
    console.log(`${id}: tri=${tri} calls=${calls} nonEmpty=${nonEmpty} png=${buf.length}`);
  }
  console.log(`pageerrors: ${errors.length}${errors.length > 0 ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
} finally {
  try { await browser?.close(); } catch {}
  server.close();
}
await mkdir(SCRATCH, { recursive: true });
await writeFile('dist/final-budgets.json', JSON.stringify({ at: new Date().toISOString(), budgets }, null, 2));
await copyFile(resolve('dist/final-gpu-example.png'), `${SCRATCH}/modelmuse-final.png`);
console.log('final-budgets.json geschrieben, scratch-Kopie angelegt');
const bad = budgets.filter((b) => !b.nonEmpty || !b.budgetOk);
if (bad.length > 0) {
  console.error(`FINALS: ${bad.length} Auffaellig: ${bad.map((b) => b.id).join(',')}`);
  process.exit(1);
}
console.log(`FINALS: alle ${budgets.length} Modelle im Budget und nicht-leer`);
