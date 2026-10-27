/** Objektiver v2-vs-v3-Vergleich: Luminanz-Statistik im Viewport-Crop. */
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

function decode(buf) {
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

function lumAt(d, w, ch, x, y) {
  const i = (y * w + x) * ch;
  return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
}

async function stats(path, x0, y0, x1, y1) {
  const { data, width, height, channels } = decode(await readFile(path));
  const X0 = Math.max(0, x0); const Y0 = Math.max(0, y0);
  const X1 = Math.min(width - 1, x1); const Y1 = Math.min(height - 1, y1);
  let n = 0; let sum = 0; let sum2 = 0; let hi = 0; let lo = 0;
  const hist = new Array(16).fill(0);
  for (let y = Y0; y <= Y1; y += 1) {
    for (let x = X0; x <= X1; x += 1) {
      const l = lumAt(data, width, channels, x, y);
      n += 1; sum += l; sum2 += l * l;
      if (l > 150) hi += 1;
      if (l < 12) lo += 1;
      hist[Math.min(15, Math.floor(l / 16))] += 1;
    }
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { path, box: [X0, Y0, X1, Y1], n, mean: +mean.toFixed(1), sd: +sd.toFixed(1), hiPct: +(100 * hi / n).toFixed(2), loPct: +(100 * lo / n).toFixed(2), hist };
}

// Viewport liegt links; Karte etwa mittig-links. Zwei Boxen: eng (Karte) + weit (Viewport).
for (const p of ['dist/preview-v2.png', 'dist/preview-v3.png']) {
  console.log(JSON.stringify(await stats(p, 150, 90, 700, 470)));
  console.log(JSON.stringify(await stats(p, 20, 50, 860, 560)));
}
