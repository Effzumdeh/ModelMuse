/**
 * S3-Suite: Screenshot-Baselines (overview/detail), Nicht-Leere-Statistik.
 * Erstlauf erzeugt die Referenz und besteht nur mit zusaetzlicher
 * Nicht-Leere-Pruefung (Bauplan toHaveScreenshot-Korrektur).
 * Bauplan Abschnitt 6 (S3) und Abschnitt 8 (verify:visual).
 */
import { test, expect } from '@playwright/test';
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

/** Anteil Nicht-Hintergrund, Mittelhelligkeit, Stdabw. */
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

async function nonEmptyShot(page) {
  const buf = await page.screenshot({ animations: 'disabled' });
  const s = stats(buf);
  expect(s.nonBgRatio, `nicht-leer (>=3%): ${s.nonBgRatio}`).toBeGreaterThanOrEqual(0.03);
  expect(s.mean, `Helligkeit 10..245: ${s.mean}`).toBeGreaterThan(10);
  expect(s.mean, `Helligkeit 10..245: ${s.mean}`).toBeLessThan(245);
  expect(s.sd, `Stdabw >= 8: ${s.sd}`).toBeGreaterThanOrEqual(8);
  return buf;
}

test('S3: Uebersicht nicht-leer + Baseline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForTimeout(9000);
  await nonEmptyShot(page);
  await expect(page).toHaveScreenshot('overview.png', {
    threshold: 0.2,
    maxDiffPixelRatio: 0.002,
    animations: 'disabled',
    timeout: 30000,
  });
});

test('S3: Detailansicht nicht-leer + Baseline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.selectOption('#view-select', 'detail');
  await page.waitForTimeout(3000);
  await nonEmptyShot(page);
  await expect(page).toHaveScreenshot('detail.png', {
    threshold: 0.2,
    maxDiffPixelRatio: 0.002,
    animations: 'disabled',
    timeout: 30000,
  });
});
