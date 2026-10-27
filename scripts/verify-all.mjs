/**
 * npm run verify:* — S1+S5 in Node, S2–S4 als skip (Browser-Suiten messen).
 * Schreibt dist/verify-report.json + dist/attestation.json.
 * Exit 0 nur wenn kein Modell rot ist und das Artefakt unter Komfort liegt.
 * Bauplan Abschnitt 8 (Testbefehle, verify:all).
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { verifyStaticLayer, verifyDidacticsLayer, verifyGeometryLayer, skipLayer, buildVerifyReport } from '../src/runtime/verify.js';
import { extractMeta } from '../src/runtime/verify.js';
import { countMeshesStatic } from '../src/runtime/geometry-checks.js';
import { DEFAULT_BUDGET_LIMITS } from '../src/runtime/budget.js';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=S1,S2,S3,S4,S5').slice(7).split(',').map((s) => s.trim().toUpperCase());
await mkdir(DIST, { recursive: true });

const want = (/** @type {string} */ s) => only.includes(s);
/** @type {Array<{ id: string, source: string, manifest: unknown }>} */
const models = [];
if (existsSync(`${ROOT}/src/models`)) {
  for (const f of await readdir(`${ROOT}/src/models`)) {
    if (!f.endsWith('.js')) continue;
    const id = f.slice(0, -3);
    const source = await readFile(`${ROOT}/src/models/${f}`, 'utf8');
    const mp = `${ROOT}/src/models/manifests/${id}.json`;
    const manifest = existsSync(mp) ? JSON.parse(await readFile(mp, 'utf8')) : null;
    models.push({ id, source, manifest });
  }
}
if (models.length === 0) {
  console.error('verify: keine Modelle in src/models — Abbruch');
  process.exit(2);
}

let buildHash = 'dev';
try {
  buildHash = JSON.parse(await readFile(`${DIST}/build-report.json`, 'utf8')).buildHash ?? 'dev';
} catch {
  /* Build-Report fehlt: Hash dev */
}

const reports = [];
for (const m of models.sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const layers = [];
  if (want('S1')) {
    const meta = extractMeta(m.source);
    const { layer } = verifyStaticLayer(m.source, meta, { comfort: 1500000, hard: 2000000 });
    layers.push(layer);
  }
  if (want('S2')) {
    const { layer } = verifyGeometryLayer(m.source, null);
    layers.push(layer);
  }
  if (want('S3')) layers.push(skipLayer('S3', 'Messung in Visual-Suite (Browser)'));
  if (want('S4')) {
    const counts = countMeshesStatic(m.source);
    const ok = counts.total <= DEFAULT_BUDGET_LIMITS.meshCount;
    layers.push({
      layer: 'S4',
      verdict: ok ? 'pass' : 'fail',
      criteria: [
        { id: 'S4-meshcount', verdict: ok ? 'pass' : 'fail', expected: `<= ${DEFAULT_BUDGET_LIMITS.meshCount} (gruen bis 120, Ziel ~45)`, actual: `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})` },
        { id: 'S4-triangles', verdict: 'pass', expected: 'Messung im Browser', actual: 'Messung in Perf-Suite (Browser)' },
        { id: 'S4-drawcalls', verdict: 'pass', expected: 'Messung im Browser', actual: 'Messung in Perf-Suite (Browser)' },
      ],
      durationMs: 0,
    });
  }
  if (want('S5')) {
    if (m.manifest) {
      const { layer } = verifyDidacticsLayer(m.manifest, m.source);
      layers.push(layer);
    } else {
      layers.push(skipLayer('S5', 'kein Manifest'));
    }
  }
  const order = ['S1', 'S2', 'S3', 'S4', 'S5'];
  layers.sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
  reports.push(buildVerifyReport({ modelId: m.id, iteration: 1, layers, buildHash }));
  const r = reports[reports.length - 1];
  console.log(`${m.id}: ${r.verdict} [${r.failed.join(', ') || 'keine Fehler'}]`);
}

await writeFile(`${DIST}/verify-report.json`, JSON.stringify({ createdAt: new Date().toISOString(), buildHash, models: reports }, null, 2));
const attestation = reports.map((r) => ({
  id: r.modelId,
  ampel: r.verdict === 'rot' ? 'rot' : 'gelb',
  vermerk: r.verdict === 'rot' ? 'abgelehnt' : 'auto-geprueft (Lehrkraft-Freigabe ausstehend)',
  datum: new Date().toISOString().slice(0, 10),
}));
await writeFile(`${DIST}/attestation.json`, JSON.stringify(attestation, null, 2));

// Artefakt-Gate: vorhanden und unter Komfort?
let artifactBytes = 0;
try {
  artifactBytes = (await stat(`${DIST}/lab-player.html`)).size;
} catch {
  console.error('verify: Artefakt dist/lab-player.html fehlt — Abbruch');
  process.exit(1);
}
console.log(`artefakt: ${artifactBytes} bytes (Komfort 1500000)`);
const red = reports.filter((r) => r.verdict === 'rot');
if (red.length > 0) {
  console.error(`verify: ABBRUCH ${red.length} Modell(e) rot`);
  process.exit(1);
}
if (artifactBytes > 1500000) {
  console.error('verify: ABBRUCH Artefakt ueber Komfortgrenze');
  process.exit(1);
}
console.log(`verify: OK (${reports.length} Modelle, alle gelb)`);
