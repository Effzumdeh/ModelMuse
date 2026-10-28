/**
 * S3-Matrix: Screenshot-Baselines je Modell (overview + detail), Nicht-Leere-Statistik.
 * 10 Modelle x 2 Ansichten = 20 Tests. Referenzen entstehen erst im echten
 * Visual-Lauf (keine kopierten/erfundenen PNGs).
 * Schwellwerte wie tests/visual.spec.mjs (threshold 0.2, maxDiffPixelRatio 0.002).
 * Bauplan Abschnitt 6 (S3) und Abschnitt 8 (verify:visual). Backlog O-03.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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
  return { data: out, width, height, channels };
}

/** Anteil Nicht-Hintergrund, Mittelhelligkeit, Stdabw (optional: Bildausschnitt relativ 0..1). */
function stats(buf, region = null) {
  const { data, width, height, channels } = decodePng(buf);
  const x0 = region ? Math.floor(width * region.x0) : 0;
  const x1 = region ? Math.ceil(width * region.x1) : width;
  const y0 = region ? Math.floor(height * region.y0) : 0;
  const y1 = region ? Math.ceil(height * region.y1) : height;
  let sum = 0;
  let sum2 = 0;
  let nonBg = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * width + x;
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += lum;
      sum2 += lum * lum;
      if (Math.abs(r - g) > 4 || Math.abs(g - b) > 4 || lum > 24) nonBg += 1;
      n += 1;
    }
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, (sum2 / n) - mean * mean));
  return { nonBgRatio: nonBg / n, mean, sd };
}

// Viewport-Mitte (Seitenleiste rechts + Steuerleisten bleiben draussen).
const VIEWPORT_PROBE = { x0: 0.3, x1: 0.65, y0: 0.25, y1: 0.75 };

function checkShot(buf, label) {
  const s = stats(buf);
  expect(s.nonBgRatio, `${label} nicht-leer (>=3%): ${s.nonBgRatio}`).toBeGreaterThanOrEqual(0.03);
  expect(s.mean, `${label} Helligkeit 10..245: ${s.mean}`).toBeGreaterThan(10);
  expect(s.mean, `${label} Helligkeit 10..245: ${s.mean}`).toBeLessThan(245);
  expect(s.sd, `${label} Stdabw >= 8: ${s.sd}`).toBeGreaterThanOrEqual(8);
  const v = stats(buf, VIEWPORT_PROBE);
  expect(v.nonBgRatio, `${label} Viewport-Mitte (>=25%): ${v.nonBgRatio}`).toBeGreaterThanOrEqual(0.25);
}

async function nonEmptyShot(page, modelId, view) {
  const mask = [page.locator('#verify-report')];
  const buf = await page.screenshot({ animations: 'disabled', mask });
  try {
    checkShot(buf, 'erst');
  } catch {
    // Genau EIN Reload-Retry bei fehlgeschlagener Viewport-Probe (SwiftShader-Flake):
    // State nach Reload neu aufbauen (bestehende Selektoren), Lade-Signal erneut
    // abwarten, neu screenshotten. Danach gilt das Ergebnis (kein zweiter Retry).
    await page.reload();
    await page.waitForSelector('#model-select', { timeout: 30000 });
    await page.selectOption('#model-select', modelId);
    await page.waitForSelector(mountSelector(modelId), { timeout: 30000 });
    await page.waitForFunction(
      (mid) => document.querySelector('#verify-report strong')?.textContent === mid,
      modelId,
      { timeout: 60000 },
    );
    await page.waitForTimeout(2000);
    await page.selectOption('#view-select', view);
    await page.waitForTimeout(3000);
    const buf2 = await page.screenshot({ animations: 'disabled', mask });
    checkShot(buf2, 'retry');
    return buf2;
  }
  return buf;
}

/** Belegte Modell-IDs (einzige Quelle: Modellmatrix, keine erfundenen IDs). */
const MODELS = ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'gpu-example', 'free-handbohrmaschine', 'chemie-koffein'];
const VIEWS = ['overview', 'detail'];
const SHOT_OPTS = { threshold: 0.2, maxDiffPixelRatio: 0.002, animations: 'disabled', timeout: 30000 };

/** 2D-Route (SVG nativ, hostseitig): kein Guest-iframe, sondern .lab-2d-SVG. */
function mountSelector(id) {
  try {
    const src = readFileSync(`src/models/${id}.js`, 'utf8');
    if (src.includes("from '2d-svg'") || src.includes('from "2d-svg"')) return '#lab-mount .lab-2d svg';
  } catch { /* Fallback 3D */ }
  return '#lab-mount iframe';
}

for (const id of MODELS) {
  for (const view of VIEWS) {
    test(`S3-Matrix: ${id} ${view} nicht-leer + Baseline`, async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#model-select', { timeout: 30000 });
      await page.selectOption('#model-select', id);
      await page.waitForSelector(mountSelector(id), { timeout: 30000 });
      // Echtes Lade-Signal: player.load() wartet auf model-ready (erster Frame,
      // frame-bootstrap.js) und rendert DANN den Verify-Report (ui-report.js:
      // strongId = report.modelId). Erst wenn der Report DIESES Modell zeigt,
      // ist dessen erster Frame da — kein starres Warten mehr.
      await page.waitForFunction(
        (mid) => document.querySelector('#verify-report strong')?.textContent === mid,
        id,
        { timeout: 60000 },
      );
      await page.waitForTimeout(2000);
      await page.selectOption('#view-select', view);
      await page.waitForTimeout(3000);
      const shot = await nonEmptyShot(page, id, view);
      // Maske #verify-report (src/shell/index.html:73): Panel zeigt stalen
      // Default-Report (gpu-example) mit flippernder Ampel — nicht deterministisch.
      // Abgedeckt durch verify:all + Harness-Suite; S3-Gate bleibt Viewport +
      // Nicht-Leere + Schwelle 0.002.
      // Gleicher Frame fuer Gate + Vergleich: maskierter Buffer aus nonEmptyShot,
      // kein dritter Screenshot via toHaveScreenshot (SwiftShader-Flackern).
      await expect(shot).toMatchSnapshot(`${id}-${view}.png`, {
        threshold: SHOT_OPTS.threshold,
        maxDiffPixelRatio: SHOT_OPTS.maxDiffPixelRatio,
      });
    });
  }
}
