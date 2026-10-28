/** 3D-Kernsanierung: Playwright-Beleg je Modell (overview + detail).
 * Laedt die DEV-Shell (src/shell/index.html via scripts/serve.mjs), waehlt je
 * Modell und Ansicht, wartet auf das Lade-Signal (verify-report zeigt Modell-ID)
 * und schreibt Screenshots nach dist-standalone/proof-<id>-<view>.png.
 * Aufruf: node scripts/_tmp/proof-6modelle.mjs [port]
 * Exit 0 nur wenn: 12 PNGs geschrieben, 0 pageerrors, 0 console-errors,
 * jede Ansicht nicht-leer (Canvas-Nachweis via toDataURL-Laenge).
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const PORT = Number(process.argv[2] ?? 8131);
const URL = `http://127.0.0.1:${PORT}/`;
const MODELS = ['gpu-example', 'si-1', 'si-2', 'si-3', 'free-handbohrmaschine', 'chemie-koffein'];
const VIEWS = ['overview', 'detail'];

function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
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
    const filter = raw[p];
    p += 1;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const v = raw[p];
      p += 1;
      let r = v;
      if (filter === 1) r = (v + a) & 255;
      else if (filter === 2) r = (v + b) & 255;
      else if (filter === 3) r = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - b);
        const pc = Math.abs(q - c);
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
  let sum = 0;
  let sum2 = 0;
  let nonBg = 0;
  for (let i = 0; i < n; i += 1) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += lum;
    sum2 += lum * lum;
    if (Math.abs(r - g) > 4 || Math.abs(g - b) > 4 || lum > 24) nonBg += 1;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { nonBgRatio: nonBg / n, mean, sd };
}

const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('serve-timeout')), 15000);
  server.stdout.on('data', (d) => { if (String(d).includes('serve:')) { clearTimeout(t); res(); } });
  server.stderr.on('data', () => {});
  server.on('error', (e) => { clearTimeout(t); rej(e); });
});

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const pageerrors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 220)); });
page.on('pageerror', (e) => pageerrors.push(String((e && e.message) || e).slice(0, 300)));

const fail = async (msg) => {
  await writeFile('dist-standalone/proof-6modelle.json', JSON.stringify({ ok: false, fail: msg, errors, pageerrors }, null, 2));
  console.error('PROOF-FAIL: ' + msg);
  try { await browser.close(); } catch {}
  try { server.kill(); } catch {}
  process.exit(1);
};

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('#model-select', { timeout: 60000 });
try {
  await page.waitForFunction(
    () => document.querySelectorAll('#model-select option').length > 0,
    null,
    { timeout: 60000 },
  );
} catch { await fail('Modelloptionen wurden nicht befuellt (Registry leer)'); }
const optCount = await page.locator('#model-select option').count();
console.log('model-options:', optCount);
if (optCount < MODELS.length) await fail(`nur ${optCount} Modelloptionen, erwartet >= ${MODELS.length}`);

await mkdir('dist-standalone', { recursive: true });
const shots = [];
for (const id of MODELS) {
  await page.selectOption('#model-select', id);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  try {
    await page.waitForFunction(
      (mid) => document.querySelector('#verify-report strong')?.textContent === mid,
      id,
      { timeout: 90000 },
    );
  } catch { await fail(`Lade-Signal fehlt fuer ${id}`); }
  await page.waitForTimeout(2500);
  for (const view of VIEWS) {
    await page.selectOption('#view-select', view);
    await page.waitForTimeout(2500);
    const buf = await page.screenshot({ animations: 'disabled' });
    const s = stats(buf);
    const okShot = s.nonBgRatio >= 0.03 && s.mean > 10 && s.mean < 245 && s.sd >= 8;
    const shot = `dist-standalone/proof-${id}-${view}.png`;
    await writeFile(shot, buf);
    shots.push({ id, view, nonBgRatio: +s.nonBgRatio.toFixed(4), mean: +s.mean.toFixed(1), sd: +s.sd.toFixed(1), bytes: buf.length, shot });
    console.log(id, view, JSON.stringify(shots[shots.length - 1]));
    if (!okShot) await fail(`${id}/${view}: leerer Screenshot`);
  }
}

if (errors.length > 0) await fail(`console-errors: ${errors[0]}`);
if (pageerrors.length > 0) await fail(`pageerrors: ${pageerrors[0]}`);

await writeFile('dist-standalone/proof-6modelle.json', JSON.stringify({
  ok: true, url: URL, shots, errors: 0, pageerrors: 0, createdAt: new Date().toISOString(),
}, null, 2));
console.log(`PROOF-OK: ${shots.length} Screenshots ohne Fehler/Warnungen`);
await browser.close();
server.kill();
