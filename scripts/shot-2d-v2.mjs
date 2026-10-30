/**
 * 2D-V2-Shots: je neuer Demo-Variante (demo-2d-*-v2) ein PNG
 * (dist-2d/<id>.png) + Pixel-Gate (nicht-weisse Pixel) nach
 * dist-2d/shot-2d-v2-report.json. Offline (file://, keine Netz-Requests,
 * jede http(s)-Anfrage bricht den Lauf ab). Chromium headless.
 * Rendert die ECHTEN Vendor-Renderer (inline, gleiche Dateien wie Produktion).
 * Aufruf: node scripts/shot-2d-v2.mjs
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { twoDVariantOf, extractTwoDLiteral, countTwoDShapes, TWOD_VARIANT_LITERAL } from '../src/runtime/verify-2d.js';
import { verifyTwoDLayer } from '../src/runtime/verify-2d.js';

const ROOT = process.cwd();
const OUT = `${ROOT}/dist-2d`;
const IDS = ['demo-2d-svg-v2', 'demo-2d-mermaid-v2', 'demo-2d-chart-v2', 'demo-2d-d3-v2', 'demo-2d-katex-v2'];
const VENDOR_FILE = { svg: 'diagram-2d.js', mermaid: 'mermaid-2d.js', chart: 'chart-2d.js', d3: 'd3-2d.js', katex: 'katex-2d.js' };
const RENDER_CALL = {
  svg: 'renderDiagram2D(__box, __data);',
  mermaid: 'renderMermaid2D(__box, __data);',
  chart: 'renderChart2D(__box, __data);',
  d3: 'renderGraph2D(__box, __data);',
  katex: 'renderMath2D(__box, __data);',
};

/** Minimaler PNG-Decoder (8 Bit, RGB/RGBA, non-interlaced) — keine Extra-Dep. */
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
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
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
  return { width, height, channels, pixels: out };
}

function countNonWhite({ width, height, channels, pixels }) {
  let n = 0;
  for (let i = 0; i < width * height; i += 1) {
    const r = pixels[i * channels];
    const g = pixels[i * channels + 1];
    const b = pixels[i * channels + 2];
    if (r < 250 || g < 250 || b < 250) n += 1;
  }
  return n;
}

await mkdir(OUT, { recursive: true });
const report = { createdAt: new Date().toISOString(), offline: true, models: [] };

const browser = await chromium.launch();
try {
  for (const id of IDS) {
    const src = await readFile(`${ROOT}/src/models/${id}.js`, 'utf8');
    const variant = twoDVariantOf(src);
    if (!variant) throw new Error(`${id}: keine Variante`);
    const data = extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]) ?? {};
    const shapes = countTwoDShapes(variant, data);
    const { layer } = verifyTwoDLayer(src);
    if (layer.verdict !== 'pass') throw new Error(`${id}: S2-light fail`);
    let vendor = await readFile(`${ROOT}/src/vendor/${VENDOR_FILE[variant]}`, 'utf8');
    vendor = vendor.split('\n').filter((ln) => !ln.startsWith('import ')).join('\n');
    vendor = vendor.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
    if (/from '[^']+'/.test(vendor)) throw new Error(`${id}: Vendor-Importrest`);
    const pageHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#ffffff;}</style></head>`
      + `<body><div id="stage" style="width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#ffffff;">`
      + `<div id="frame" style="width:640px;height:360px;"></div></div>`
      + `<script type="module">\n${vendor}\nconst __data = ${JSON.stringify(data)};\nconst __box = document.getElementById('frame');\n${RENDER_CALL[variant]}\n</scr` + `ipt></body></html>`;
    if (/<\/script/i.test(vendor) || /<\/script/i.test(JSON.stringify(data))) {
      throw new Error(`${id}: unerwartetes script-Ende im Vendor-Code/Daten`);
    }
    await writeFile(`${OUT}/${id}.html`, pageHtml);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let netRequest = null;
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) netRequest = url;
    });
    await page.goto(`file:///${OUT}/${id}.html`.replace(/\\/g, '/'));
    await page.waitForTimeout(600);
    const frameCount = await page.evaluate(() => document.getElementById('frame')?.childElementCount ?? -1);
    await page.screenshot({ path: `${OUT}/${id}.png` });
    await page.close();
    if (netRequest) throw new Error(`${id}: Netz-Request trotz offline: ${netRequest}`);
    const png = await readFile(`${OUT}/${id}.png`);
    const nonWhite = countNonWhite(decodePng(png));
    const pngBytes = (await stat(`${OUT}/${id}.png`)).size;
    const pass = frameCount > 0 && pngBytes > 0 && nonWhite > 100 && shapes >= 4;
    report.models.push({
      id, variant, png: `dist-2d/${id}.png`, pngBytes, nonWhitePixels: nonWhite,
      shapes, frameChildren: frameCount, s2: layer.verdict, verdict: pass ? 'pass' : 'fail',
    });
    console.log(`${id}: variante=${variant} shapes=${shapes} kinder=${frameCount} nonWhite=${nonWhite} png=${pngBytes}B ${pass ? 'pass' : 'FAIL'}`);
  }
} finally {
  await browser.close();
}
await writeFile(`${OUT}/shot-2d-v2-report.json`, JSON.stringify(report, null, 2));
const fails = report.models.filter((m) => m.verdict !== 'pass');
if (fails.length > 0) {
  console.error(`shot-2d-v2: ABBRUCH ${fails.length} Modell(e) fail`);
  process.exit(1);
}
console.log('shot-2d-v2: OK (5/5 V2-Varianten-Screenshots, Pixel-Gate pass)');
