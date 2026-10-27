/**
 * Vergleichs-Probe: eigener HTTP-Server (Port 8099), Probe-Seite importiert
 * dist/compare-<m>.js direkt (lab-player.html wird NICHT angefasst).
 * Aufruf: MODEL=compare-spark node scripts/_shot-compare.mjs
 * Schreibt: dist/compare-<m>.png (1280x720, Chromium + SwiftShader-Flags)
 * Stdout: JSON-Zeile mit Budgets (echte triangles/drawCalls) + Screenshot-Stats.
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const PORT = Number(process.env.PORT ?? 8099);
const MODEL = process.env.MODEL ?? 'compare-spark';
const OUT = resolve(`dist/${MODEL}.png`);

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

const PROBE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
#c{width:1280px;height:720px;}canvas{display:block;width:1280px;height:720px;}
</style><script type="importmap">{"imports":{
"three":"/__probe-three.js",
"three/addons/":"/node_modules/three/examples/jsm/",
"wrapper-helpers":"/src/runtime/annotate.js"}}</script></head>
<body><div id="c"></div><div id="out">pending</div>
<script type="module">
import { init } from '/dist/${MODEL}.js';
const c = document.getElementById('c');
const handle = init(c, { level: 'aufbau', labels: { enabled: true, max: 64 }, measurements: { enabled: true }, dpr: 1, reducedMotion: true, seed: 1, units: 'm', locale: 'de-DE' });
await new Promise((r) => setTimeout(r, 2500));
try {
  const r = window.__renderer;
  const i = r.info;
  document.getElementById('out').textContent = JSON.stringify({ calls: i.render.calls, triangles: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length });
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
  return { nonBgRatio: nonBg / n, mean, sd, width, height };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__probe-three.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(PROBE_THREE);
      return;
    }
    if (url.pathname === '/__probe') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PROBE_HTML);
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

let browser = null;
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`console.${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${String(e?.message ?? e).slice(0, 200)}`));
  await page.goto(`http://127.0.0.1:${PORT}/__probe`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4500);
  const budget = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('#c canvas')),
    out: document.getElementById('out')?.textContent?.slice(0, 300) ?? '',
  }));
  const webgl2 = await page.evaluate(() => { try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; } });
  const buf = await page.screenshot({ animations: 'disabled' });
  await writeFile(OUT, buf);
  const s = stats(buf);
  console.log(JSON.stringify({
    model: MODEL, webgl2, canvas: budget.canvas, probe: budget.out,
    png: OUT, pngBytes: buf.length,
    nonBgPct: Number((s.nonBgRatio * 100).toFixed(2)), mean: Number(s.mean.toFixed(1)), sd: Number(s.sd.toFixed(1)),
    size: `${s.width}x${s.height}`,
    shotVerdict: s.nonBgRatio >= 0.03 && s.mean > 10 && s.mean < 245 && s.sd >= 8 && budget.canvas ? 'NICHT-LEER-PASS' : 'FAIL',
    logs: logs.slice(0, 8),
  }));
} finally {
  try { await browser?.close(); } catch {}
  server.close();
}
