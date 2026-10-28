/**
 * 2D-Shots: je 2D-Modell (dup-1..3, ae-1..3) ein PNG (dist-2d/<id>.png) plus
 * Pixel-Gate (nicht-weisse Pixel im SVG-Render) nach dist-2d/shot-2d-report.json.
 * Offline (file://, keine Netz-Requests), Chromium headless.
 * Aufruf: node scripts/shot-2d.mjs
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { chromium } from 'playwright';
import { buildDiagramSvg, countSvgShapes, isWellformedSvg } from '../src/vendor/diagram-2d.js';
import { extractDiagram } from '../src/runtime/verify.js';

const ROOT = process.cwd();
const OUT = `${ROOT}/dist-2d`;
const IDS = ['dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3'];

await mkdir(OUT, { recursive: true });

const pageHtml = (svg) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;">`
  + `<div id="stage" style="width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#ffffff;">`
  + `<div id="frame" style="width:640px;height:360px;">${svg}</div></div></body></html>`;

const report = { createdAt: new Date().toISOString(), offline: true, models: [] };

const browser = await chromium.launch();
try {
  for (const id of IDS) {
    const src = await readFile(`${ROOT}/src/models/${id}.js`, 'utf8');
    const diagram = extractDiagram(src);
    if (!diagram) throw new Error(`${id}: kein diagram`);
    const svg = buildDiagramSvg(diagram);
    const shapes = countSvgShapes(svg);
    const wellformed = isWellformedSvg(svg);
    await writeFile(`${OUT}/${id}.svg`, svg);
    await writeFile(`${OUT}/${id}.html`, pageHtml(svg));
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`file:///${OUT}/${id}.html`.replace(/\\/g, '/'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${id}.png` });
    const nonWhite = await page.evaluate(() => {
      const svgEl = document.querySelector('#frame svg');
      if (!svgEl) return -1;
      const xml = new XMLSerializer().serializeToString(svgEl);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const cv = document.createElement('canvas');
            cv.width = 640;
            cv.height = 360;
            const ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 640, 360);
            ctx.drawImage(img, 0, 0, 640, 360);
            const d = ctx.getImageData(0, 0, 640, 360).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n += 1;
            }
            resolve(n);
          } catch (e) { resolve(-2); }
        };
        img.onerror = () => resolve(-3);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      });
    });
    await page.close();
    const pngBytes = (await stat(`${OUT}/${id}.png`)).size;
    const pass = wellformed && shapes >= 4 && pngBytes > 0 && nonWhite > 100;
    report.models.push({
      id, kind: diagram.kind, svgBytes: Buffer.byteLength(svg, 'utf8'),
      shapes, wellformed, png: `dist-2d/${id}.png`, pngBytes, nonWhitePixels: nonWhite,
      verdict: pass ? 'pass' : 'fail',
    });
    console.log(`${id}: kind=${diagram.kind} shapes=${shapes} nonWhite=${nonWhite} png=${pngBytes}B ${pass ? 'pass' : 'FAIL'}`);
  }
} finally {
  await browser.close();
}
await writeFile(`${OUT}/shot-2d-report.json`, JSON.stringify(report, null, 2));
const fails = report.models.filter((m) => m.verdict !== 'pass');
if (fails.length > 0) {
  console.error(`shot-2d: ABBRUCH ${fails.length} Modell(e) fail`);
  process.exit(1);
}
console.log('shot-2d: OK (6/6 2D-Screenshots, Pixel-Gate pass)');
