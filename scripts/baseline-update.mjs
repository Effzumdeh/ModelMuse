/**
 * Baselines uebernehmen — nur mit ausdruecklichem --accept.
 * Aufruf: node scripts/baseline-update.mjs --accept
 * Bauplan Abschnitt 8: Laeuft nur mit Flag; sonst Abbruch (Exit 2).
 * O-03: echter Schreiber — kopiert die im Visual-Lauf erzeugten Referenzen
 * (exakter Dateiname, PNG-Signatur geprueft) nach dist/baselines/.
 * Erfindet/kopiert keine PNGs als Vorlage fuer andere Modelle: nur exakte
 * `<id>-overview.png` / `<id>-detail.png`-Treffer werden uebernommen.
 * Ohne --accept: Verweigerung (Exit 2). Ohne Fund: Hinweis + Exit 1.
 */
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const accept = process.argv.includes('--accept');
if (!accept) {
  console.error('baseline-update: verweigert ohne --accept (Bauplan: nur mit ausdruecklichem Flag).');
  process.exit(2);
}

/** Belegte Modell-IDs (einzige Quelle: Modellmatrix, keine erfundenen IDs). */
const MODELS = ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'gpu-example', 'free-handbohrmaschine', 'chemie-koffein'];
const WANTED = MODELS.flatMap((id) => [`${id}-overview.png`, `${id}-detail.png`]);
const BASELINES_DIR = 'dist/baselines';
const FAILURES_DIR = 'dist/failures';
/** Suchorte fuer im Visual-Lauf erzeugte Referenzen (Playwright-outputDir + Diff-Ablage). */
const SOURCE_DIRS = ['test-results', FAILURES_DIR];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function walk(dir, out) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const ok = await (async () => {
  await mkdir(BASELINES_DIR, { recursive: true });
  await mkdir(FAILURES_DIR, { recursive: true });
  const found = new Map();
  for (const dir of SOURCE_DIRS) {
    for (const p of await walk(dir, [])) {
      const base = p.split(/[/\\]/).pop();
      if (!WANTED.includes(base)) continue;
      const prev = found.get(base);
      const mtime = (await stat(p)).mtimeMs;
      if (!prev || mtime > prev.mtime) found.set(base, { path: p, mtime });
    }
  }
  let copied = 0;
  const missing = [];
  for (const name of WANTED) {
    const hit = found.get(name);
    if (!hit) {
      missing.push(name);
      continue;
    }
    const head = (await readFile(hit.path)).subarray(0, 4);
    if (!head.equals(PNG_MAGIC)) {
      console.error(`baseline-update: KEIN PNG (Signatur falsch): ${hit.path} — uebersprungen.`);
      missing.push(name);
      continue;
    }
    await copyFile(hit.path, join(BASELINES_DIR, name));
    copied += 1;
  }
  console.log(`baseline-update: --accept gesetzt (${copied}/${WANTED.length} Referenzen nach ${BASELINES_DIR}/ uebernommen).`);
  if (missing.length > 0) {
    console.error(`baseline-update: FEHLT (${missing.length}): ${missing.join(', ')}`);
    console.error('Hinweis: Referenzen entstehen im echten Lauf: npx playwright test tests/visual-matrix.spec.mjs --update-snapshots');
    return false;
  }
  return true;
})().catch((e) => {
  console.error(`baseline-update: FEHLER: ${e.message}`);
  return false;
});

process.exit(ok ? 0 : 1);
