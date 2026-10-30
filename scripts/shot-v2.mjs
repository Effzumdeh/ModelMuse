/**
 * Screenshot-Kontrolle v2: dist/lab-player.html ueber lokalen HTTP-Server,
 * Chromium 1280x720 mit SwiftShader-Flags aus dem Bauplan.
 * Schreibt PNG nach scratch/modelmuse-v2.png + dist/preview-v2.png
 * und druckt S3-Nicht-Leere-Statistik + Konsolen-/Report-Befund.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const PORT = Number(process.argv[2] ?? 8091);
const OUT1 = 'C:/Users/flori/AppData/Local/hermes/cache/scratch/modelmuse-v2.png';
const OUT2 = resolve('dist/preview-v2.png');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

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
    let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`serve: http://127.0.0.1:${PORT}/ (root ${ROOT})`);

const logs = [];
let browser = null;
try {
  browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--no-sandbox',
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push(`console.${m.type()}: ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${String(e?.message ?? e).slice(0, 300)}`));
  const url = `http://127.0.0.1:${PORT}/dist/lab-player.html`;
  console.log(`goto: ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  const webgl2 = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      return Boolean(c.getContext('webgl2'));
    } catch { return false; }
  });
  console.log(`webgl2: ${webgl2}`);
  try {
    await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
    console.log('iframe: GEFUNDEN');
  } catch {
    console.log('iframe: FEHLT (Timeout 30s)');
  }
  await page.waitForTimeout(9000);
  const info = await page.evaluate(() => ({
    models: document.querySelector('#model-select')?.innerHTML?.slice(0, 400) ?? 'kein select',
    modelCount: document.querySelectorAll('#model-select option').length,
    selected: document.querySelector('#model-select')?.value ?? '',
    report: document.querySelector('#verify-report')?.textContent?.slice(0, 1200) ?? '',
    fallbackHidden: document.querySelector('#fallback-panel')?.hidden ?? 'unbekannt',
    fallbackText: document.querySelector('#fallback-text')?.textContent?.slice(0, 500) ?? '',
    mountHtml: document.querySelector('#lab-mount')?.innerHTML?.length ?? 0,
    iframeCount: document.querySelectorAll('#lab-mount iframe').length,
  }));
  console.log(`modelle-im-select: ${info.modelCount} selected=${info.selected}`);
  console.log(`report: ${info.report.slice(0, 600)}`);
  console.log(`fallback hidden=${info.fallbackHidden} text=${info.fallbackText.slice(0, 200)}`);
  console.log(`mount innerHTML bytes=${info.mountHtml} iframes=${info.iframeCount}`);
  const buf = await page.screenshot({ animations: 'disabled' });
  await mkdir('C:/Users/flori/AppData/Local/hermes/cache/scratch', { recursive: true });
  await writeFile(OUT1, buf);
  await copyFile(OUT1, OUT2);
  console.log(`png: ${OUT1} (${buf.length} bytes)`);
  console.log(`kopie: ${OUT2}`);
  const s = stats(buf);
  console.log(`s3stats: nonBg=${(s.nonBgRatio * 100).toFixed(2)}% mean=${s.mean.toFixed(1)} sd=${s.sd.toFixed(1)} ${s.width}x${s.height}`);
  const pass = s.nonBgRatio >= 0.03 && s.mean > 10 && s.mean < 245 && s.sd >= 8;
  console.log(`S3-nicht-leer: ${pass ? 'PASS' : 'FAIL'}`);
  // Erfuellt im Auftragssinn: 3D oder 2D-Fallback sichtbar, kein leerer Viewer, keine Fehlermeldung
  const hasError = /Fehler|error|E-S|abgelehnt|rot/i.test(info.report) && !/gelb|Iteration|Modell/i.test(info.report);
  console.log(`reportFehlerIndiz: ${hasError}`);
  console.log(`ERGEBNIS: ${pass && info.iframeCount > 0 ? 'ERFUELLT (3D-Kandidat, Report pruefen)' : 'NICHT ERFUELLT'}`);
  console.log('--- logs (max 20) ---');
  for (const l of logs.slice(0, 20)) console.log(l);
  if (logs.length === 0) console.log('(keine Konsolenmeldungen)');
} finally {
  try { await browser?.close(); } catch {}
  server.close();
}
