/**
 * 2-Frame-Pixel-Diff ohne Abhaengigkeiten (Guide-3D Abschnitt 3/4, M2/M5).
 * Dekodiert zwei PNGs (8 Bit, RGB/RGBA, nicht-interlaced — genau das Format
 * von lab-capture/dataUrl) und meldet den Anteil unterschiedlicher Pixel.
 * Schwelle: GEO_LIMITS.flickerMaxDiff (0,002) — der Vergleich gegen die
 * Schwelle bleibt beim Aufrufer (geometry-checks checkFlicker / Harness).
 * Aufruf: node scripts/_png-diff.mjs <a.png> <b.png> [--threshold=N]
 * Stdout: eine JSON-Zeile { width, height, pixels, different, diff }.
 */
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

/** @param {Buffer} buf */
export function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * PNG (8 Bit, Farbtyp 2/6) zu RGBA-Pixeln dekodieren.
 * @param {Buffer} buf
 * @returns {{ width: number, height: number, rgba: Buffer }}
 */
export function decodePngRgba(buf) {
  const png = Buffer.from(buf);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (png.length < 33 || !png.subarray(0, 8).equals(sig)) {
    throw Object.assign(new Error('E-PNG: keine PNG-Signatur'), { code: 'E-PNG' });
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  /** @type {Buffer[]} */
  const idat = [];
  let seenIhdr = false;
  while (pos + 8 <= png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.subarray(pos + 4, pos + 8).toString('ascii');
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (data.length !== len || pos + 12 + len > png.length) {
      throw Object.assign(new Error('E-PNG: Chunk abgeschnitten'), { code: 'E-PNG' });
    }
    const want = png.readUInt32BE(pos + 8 + len);
    if (crc32(png.subarray(pos + 4, pos + 8 + len)) !== want) {
      throw Object.assign(new Error(`E-PNG: CRC-Fehler in ${type}`), { code: 'E-PNG' });
    }
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      seenIhdr = true;
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw Object.assign(new Error(`E-PNG: nur 8 Bit RGB/RGBA, habe depth=${bitDepth} typ=${colorType}`), { code: 'E-PNG' });
      }
      if (data[12] !== 0) throw Object.assign(new Error('E-PNG: interlaced nicht unterstuetzt'), { code: 'E-PNG' });
      if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
        throw Object.assign(new Error('E-PNG: Masse ungueltig'), { code: 'E-PNG' });
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (!seenIhdr || idat.length === 0) {
    throw Object.assign(new Error('E-PNG: IHDR/IDAT fehlt'), { code: 'E-PNG' });
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * height) {
    throw Object.assign(new Error('E-PNG: IDAT-Groesse passt nicht zu IHDR'), { code: 'E-PNG' });
  }
  const out = Buffer.alloc(stride * height);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const f = raw[p];
    p += 1;
    if (f > 4) throw Object.assign(new Error('E-PNG: Filtertyp ungueltig'), { code: 'E-PNG' });
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const v = f === 0 ? raw[p] : f === 1 ? raw[p] + a : f === 2 ? raw[p] + b : f === 3 ? raw[p] + ((a + b) >> 1) : raw[p] + paeth(a, b, c);
      out[y * stride + x] = v & 0xff;
      p += 1;
    }
  }
  if (bpp === 4) return { width, height, rgba: out };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = out[i + 1];
    rgba[j + 2] = out[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

/**
 * Anteil unterschiedlicher Pixel (0..1). Unterschied = ein Kanal weicht um
 * mehr als threshold ab (Default 4 — robust gegen SwiftShader-Rauschen, streng
 * genug fuer echte Koplanar-Flacker bei Schwelle 0,002).
 * @param {{ width: number, height: number, rgba: Buffer }} a
 * @param {{ width: number, height: number, rgba: Buffer }} b
 * @param {number} [threshold]
 */
export function pixelDiff(a, b, threshold = 4) {
  if (!a || !b || a.width !== b.width || a.height !== b.height || a.rgba.length !== b.rgba.length) {
    throw Object.assign(new Error('E-PNG: Masse ungleich'), { code: 'E-PNG' });
  }
  const pixels = a.width * a.height;
  let different = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (
      Math.abs(a.rgba[i] - b.rgba[i]) > threshold ||
      Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) > threshold ||
      Math.abs(a.rgba[i + 2] - b.rgba[i + 2]) > threshold
    ) {
      different += 1;
    }
  }
  return { width: a.width, height: a.height, pixels, different, diff: pixels === 0 ? 0 : different / pixels };
}

const cli = process.argv[1] !== undefined && /_png-diff\.mjs$/.test(process.argv[1] ?? '');
if (cli) {
  const [fa, fb, ...rest] = process.argv.slice(2);
  const tArg = rest.find((s) => s.startsWith('--threshold='));
  const threshold = tArg ? Number(tArg.slice(12)) : 4;
  if (!fa || !fb || !(threshold >= 0)) {
    console.error('Aufruf: node scripts/_png-diff.mjs <a.png> <b.png> [--threshold=N]');
    process.exit(2);
  }
  try {
    const [a, b] = await Promise.all([readFile(fa), readFile(fb)]);
    console.log(JSON.stringify(pixelDiff(decodePngRgba(a), decodePngRgba(b), threshold)));
  } catch (e) {
    console.error(`png-diff: FEHLER ${e.message}`);
    process.exit(1);
  }
}
