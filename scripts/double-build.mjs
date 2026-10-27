/**
 * scripts/double-build.mjs — Doppel-Build-Nachweis (Backlog O-04).
 *
 * Aufruf: npm run build:double  (node scripts/double-build.mjs)
 * Ablauf: Artefakte raeumen -> build.mjs + render-single-file.mjs (Lauf 1) ->
 *   .sha256 sichern -> Artefakte raeumen -> Lauf 2 -> vergleichen.
 * Geraeumt werden NUR Build-Artefakte (kein .gitkeep, keine Reports/Baselines).
 * Schreibt dist/double-build.json {lauf1, lauf2, identisch} + Konsolen-Log.
 * Exit 0: beide .sha256 identisch. Exit 1: Drift (ehrlicher Befund, kein Angleichen).
 *
 * Determinismus-Einschaetzung (Code-Lesung, kein Lauf):
 * - buildHash (build.mjs Z.143-156): Hash ueber DateiINHALTE (keine Zeitstempel), ABER
 *   readdir ohne Sortierung -> Reihenfolge laufabhaengig moeglich -> buildHash fragil.
 * - lab-player.html (render-single-file.mjs): Modelle sortiert (Z.68), keine Zeitstempel
 *   im HTML, esbuild deterministisch -> Artefakt voraussichtlich stabil.
 * - build-report.json enthaelt createdAt -> nie byte-identisch; verglichen wird daher
 *   NUR das Artefakt-sha256, buildHashes werden nur protokolliert.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm, stat } from 'node:fs/promises';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
// NUR Build-Artefakte; alles andere in dist/ (Reports, Baselines, .gitkeep) bleibt.
const ARTEFAKTE = ['lab-player.html', 'lab-player.html.sha256', 'vendor-three.bundle.js', 'build-report.json', 'double-build.json'];

async function raeumen() {
  for (const f of ARTEFAKTE) {
    try {
      await rm(`${DIST}/${f}`, { force: true });
    } catch { /* fehlt: ok */ }
  }
}

async function bauen(nr) {
  console.log(`double-build: Lauf ${nr} startet`);
  execFileSync('node', ['scripts/build.mjs'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', ['scripts/render-single-file.mjs'], { cwd: ROOT, stdio: 'inherit' });
  const sha256 = (await readFile(`${DIST}/lab-player.html.sha256`, 'utf8')).trim().split(/\s+/)[0] ?? '';
  const report = JSON.parse(await readFile(`${DIST}/build-report.json`, 'utf8'));
  const bytes = (await stat(`${DIST}/lab-player.html`)).size;
  console.log(`double-build: Lauf ${nr} sha256=${sha256.slice(0, 16)}… bytes=${bytes} buildHash=${String(report.buildHash ?? '?').slice(0, 16)}…`);
  return { sha256, bytes, buildHash: report.buildHash ?? null };
}

await raeumen();
const lauf1 = await bauen(1);
await raeumen();
const lauf2 = await bauen(2);
const identisch = lauf1.sha256 !== '' && lauf1.sha256 === lauf2.sha256;
await writeFile(`${DIST}/double-build.json`, `${JSON.stringify({ erzeugtAm: new Date().toISOString(), lauf1, lauf2, identisch }, null, 2)}\n`);
console.log(`double-build: identisch=${identisch}`);
if (!identisch) {
  console.error('double-build: FAIL Drift zwischen Lauf 1 und 2 (Hashes protokolliert, kein Trick)');
  process.exit(1);
}
console.log('double-build: OK beide Laeufe identisch');
