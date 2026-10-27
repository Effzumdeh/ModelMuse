/**
 * M7: Eigene Eval-Harness (didaktischer Minimalsatz, kein 3JSBench-Grader noetig).
 * Prueft eval/didaktik-minimalsatz.json mit S5 (Manifest, Niveauregeln) und
 * schreibt dist/eval-harness.json. Exit 0 nur wenn alle Aufgaben S5-pass.
 * Aufruf: node scripts/eval-harness.mjs [eval-Datei]
 * Default: eval/didaktik-minimalsatz.json (rueckwaertskompatibel).
 * Bauplan-Erw.: A/B-Vergleiche (Prompt-Versionen, contributor vs. Standard)
 * laufen ueber denselben Harness (Ergebnis + buildHash im Report).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { validateManifest, checkLevelRules } from '../src/runtime/didactics.js';

const ROOT = process.cwd();
const results = [];
let buildHash = 'dev';
try {
  buildHash = JSON.parse(await readFile(`${ROOT}/dist/build-report.json`, 'utf8')).buildHash ?? 'dev';
} catch { /* Build-Report fehlt: Hash dev */ }

const DATEI = process.argv[2] ?? 'eval/didaktik-minimalsatz.json';
const set = JSON.parse(await readFile(`${ROOT}/${DATEI}`, 'utf8'));
for (const aufgabe of set.aufgaben ?? []) {
  const rep = validateManifest(aufgabe);
  const criteria = [];
  criteria.push({
    id: 'S5-manifest',
    verdict: rep.ok ? 'pass' : 'fail',
    expected: 'Manifest ok',
    actual: rep.ok ? `labels=${rep.counts.labels} mess=${rep.counts.measurements}` : `missing=${rep.missing.join(',')} invalid=${rep.invalid.join(',')}`,
  });
  if (rep.ok) {
    criteria.push({
      id: 'S5-pflicht',
      verdict: aufgabe.objectives.length >= 2 && rep.counts.labels >= 3 && rep.counts.measurements >= 1 ? 'pass' : 'fail',
      expected: '>=2 Ziele, >=3 Labels, >=1 Messung',
      actual: `${aufgabe.objectives.length} Ziele, ${rep.counts.labels} Labels, ${rep.counts.measurements} Messungen`,
    });
    for (const level of ['basis', 'aufbau', 'profi']) {
      for (const r of checkLevelRules(level, aufgabe)) criteria.push(r);
    }
  }
  const verdict = criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  results.push({ id: aufgabe.title ?? '?', verdict, failed: criteria.filter((c) => c.verdict === 'fail').map((c) => c.id), criteria });
  console.log(`${aufgabe.title}: ${verdict} [${criteria.filter((c) => c.verdict === 'fail').map((c) => c.id).join(', ') || 'keine Fehler'}]`);
}

await mkdir(`${ROOT}/dist`, { recursive: true });
const passCount = results.filter((r) => r.verdict === 'pass').length;
await writeFile(
  `${ROOT}/dist/eval-harness.json`,
  JSON.stringify({ createdAt: new Date().toISOString(), buildHash, datei: DATEI, version: set.version ?? null, anzahl: set.anzahl ?? results.length, standard: set.standard, count: results.length, passRate: results.length === 0 ? 0 : passCount / results.length, results }, null, 2)
);
const bad = results.filter((r) => r.verdict !== 'pass');
if (bad.length > 0) {
  console.error(`eval-harness: ABBRUCH ${bad.length} Aufgabe(n) rot`);
  process.exit(1);
}
console.log(`eval-harness: OK (${results.length} Aufgaben, alle S5-pass)`);
