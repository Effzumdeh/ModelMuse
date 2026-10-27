/** Vergleichs-Verifikation (S1/S2-statisch/S4-statisch/S5). Kein Key-Kontakt.
 * Aufruf: node scripts/_verify-compare.mjs <tag>   (tag z.B. compare-spark)
 * Schreibt: dist/<tag>.manifest.json, dist/<tag>.verify.json
 * Stdout: EINE JSON-Zeile mit Verdikten + Budgets (fuer MODELLVERGLEICH.md).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { verifyStaticLayer, verifyGeometryLayer, verifyDidacticsLayer, buildVerifyReport, extractMeta } from '../src/runtime/verify.js';
import { validateManifest } from '../src/runtime/didactics.js';
import { countMeshesStatic } from '../src/runtime/geometry-checks.js';
import { DEFAULT_BUDGET_LIMITS, TRAFFIC } from '../src/runtime/budget.js';

const [tag] = process.argv.slice(2);
if (!tag) { console.error('Aufruf: node scripts/_verify-compare.mjs <tag>'); process.exit(2); }

const source = await readFile(`dist/${tag}.js`, 'utf8');
const bytes = Buffer.byteLength(source, 'utf8');
const meta = extractMeta(source);

// S1
const { layer: s1 } = verifyStaticLayer(source, meta, { comfort: 1500000, hard: 2000000 });
// S2 statisch
const { layer: s2 } = verifyGeometryLayer(source);
// S4 statisch
const counts = countMeshesStatic(source);
const band = (v, [g, y]) => (v <= g ? 'green' : v <= y ? 'yellow' : 'red');
const s4static = {
  meshCount: counts.total,
  meshBand: band(counts.total, TRAFFIC.meshCount),
  moduleBytes: bytes,
  moduleBand: bytes <= 34000 ? 'green(hyper-max)' : bytes <= 1500000 ? 'green' : bytes <= 2000000 ? 'yellow' : 'red',
  limits: { triangles: DEFAULT_BUDGET_LIMITS.triangles, drawCalls: DEFAULT_BUDGET_LIMITS.drawCalls, meshCount: DEFAULT_BUDGET_LIMITS.meshCount },
};

// S5: Vergleichs-Manifest aus meta.parts + vorgeschriebener Messung
const parts = Array.isArray(meta?.parts) && meta.parts.length >= 3
  ? meta.parts
  : ['Mainboard', 'CPU', 'Arbeitsspeicher', 'Grafikkarte', 'Netzteil'];
const title = typeof meta?.title === 'string' ? meta.title : 'PC-Arbeitsplatz (SI-1)';
const manifest = {
  schemaVersion: 1,
  title,
  track: 'SI',
  objectives: [
    `Die Auszubildenden benennen die ${parts.length} Hauptbauteile des ${title} (${parts.join(', ')}) korrekt.`,
    'Die Auszubildenden lesen die Bemaßung „Mainboard-Breite: 24 cm“ ab und ordnen sie dem Mainboard zu.',
  ],
  labels: [...parts],
  measurements: [
    { id: 'm1', from: [-0.12, 0.145, 0.002], to: [0.12, 0.145, 0.002], text: 'Mainboard-Breite: 24 cm' },
  ],
  tasks: [
    { id: 'vgl-aufbau-1', level: 'aufbau', type: 'zuordnung', prompt: `Ordne zu: Welches Bauteil traegt die Hauptplatine des ${title}?`, expected: parts[0], tolerance: 0 },
    { id: 'vgl-aufbau-2', level: 'aufbau', type: 'messwert', prompt: 'Lies die Bemaßung aus („Mainboard-Breite: 24 cm“) und nenne den Zahlenwert in cm.', expected: '24', tolerance: 0 },
    { id: 'vgl-profi-1', level: 'profi', type: 'transfer', prompt: `${title} zeigt einen Fehler (ein Bauteil faellt aus): Nenne zwei pruefbare Ursachen und je eine Abhilfemassnahme.`, expected: `${parts[0]} pruefen und Bauteilverbindung sicherstellen`, tolerance: 0 },
  ],
};
const rep5 = validateManifest(manifest);
const { layer: s5 } = verifyDidacticsLayer(manifest, source);

await writeFile(`dist/${tag}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
const rep = buildVerifyReport({ modelId: tag, iteration: 1, layers: [s1, s2, s5], buildHash: 'vergleich-si1-hyper' });
await writeFile(`dist/${tag}.verify.json`, JSON.stringify(rep, null, 2) + '\n');

console.log(JSON.stringify({
  tag, bytes,
  metaOk: meta !== null && JSON.stringify(meta?.parts) !== undefined,
  parts,
  s1: s1.verdict, s1c: s1.criteria.map((c) => `${c.id}=${c.verdict}`),
  s2: s2.verdict, s2c: s2.criteria.map((c) => `${c.id}=${c.verdict}`),
  s4static,
  manifestOk: rep5.ok, manifestMissing: rep5.missing, manifestInvalid: rep5.invalid, manifestCounts: rep5.counts,
  s5: s5.verdict, s5c: s5.criteria.map((c) => `${c.id}=${c.verdict}`),
  gesamt: rep.verdict, failed: rep.failed,
}));
if (rep.verdict === 'rot') process.exit(1);
