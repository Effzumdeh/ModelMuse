/**
 * npm run verify:* — S1+S5 in Node, S2 als skip (Browser-Suite misst),
 * S3/S4 aus dist/final-budgets.json gespiegelt (nur bei frischem Beleg).
 * Schreibt dist/verify-report.json + dist/attestation.json.
 * Exit 0 nur wenn kein Modell rot ist und das Artefakt unter Komfort liegt.
 * Bauplan Abschnitt 8 (Testbefehle, verify:all).
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { verifyStaticLayer, verifyDidacticsLayer, verifyGeometryLayer, skipLayer, buildVerifyReport, sollFromMatrixEntry } from '../src/runtime/verify.js';
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

/** Messwerte aus dist/final-budgets.json (O-08) — nur frische Belege zaehlen. */
let budgets = null;
try {
  budgets = JSON.parse(await readFile(`${DIST}/final-budgets.json`, 'utf8'));
} catch {
  /* keine Messwerte: S3/S4 ehrlich skip */
}
const budgetById = new Map((budgets?.budgets ?? []).map((b) => [b.id, b]));

/** O-10: Modellmatrix als einzige Quelle (src/data/modellmatrix.json). */
let modellmatrix = {};
try {
  modellmatrix = JSON.parse(await readFile(`${ROOT}/src/data/modellmatrix.json`, 'utf8'));
} catch {
  /* ohne Matrix: S5-soll graceful (free-Pfad) */
}

/**
 * Passt der Budget-Beleg noch zur aktuellen Modellquelle?
 * Vergleich: Quell-Bytes vs. S1-size im reportHead + Screenshot-Groesse.
 * @param {string} id
 * @param {string} source
 */
async function budgetFreshness(id, source) {
  const entry = budgetById.get(id) ?? null;
  if (!entry) return { ok: false, entry, reason: 'kein Messwert in dist/final-budgets.json' };
  const m = /S1-sizepass(\d+)\s*Bytes/.exec(entry.reportHead ?? '');
  const srcBytes = Buffer.byteLength(source, 'utf8');
  if (!m || Number(m[1]) !== srcBytes) {
    return { ok: false, entry, reason: `Beleg aelter als Modellquelle (Quelle ${srcBytes} Bytes vs Beleg ${m?.[1] ?? 'unbekannt'} Bytes)` };
  }
  const pngPath = `${ROOT}/${entry.png}`;
  if (!existsSync(pngPath)) return { ok: false, entry, reason: `Beleg aelter als Modellquelle (Screenshot fehlt: ${entry.png})` };
  let pngBytes = -1;
  try {
    pngBytes = (await stat(pngPath)).size;
  } catch {
    return { ok: false, entry, reason: `Beleg aelter als Modellquelle (Screenshot fehlt: ${entry.png})` };
  }
  if (pngBytes !== entry.bytes) {
    return { ok: false, entry, reason: `Beleg aelter als Modellquelle (Screenshot ${pngBytes} Bytes vs Beleg ${entry.bytes} Bytes)` };
  }
  return { ok: true, entry, reason: '' };
}

const reports = [];
const belegById = new Map();
for (const m of models.sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const layers = [];
  const fresh = await budgetFreshness(m.id, m.source);
  belegById.set(m.id, fresh.ok ? 'S3-Screenshot+nonEmpty, S4-renderer.info' : `Teilbasis (${fresh.reason})`);
  if (want('S1')) {
    const meta = extractMeta(m.source);
    const { layer } = verifyStaticLayer(m.source, meta, { comfort: 1500000, hard: 2000000 });
    layers.push(layer);
  }
  if (want('S2')) {
    const { layer } = verifyGeometryLayer(m.source, null);
    layers.push(layer);
  }
  if (want('S3')) {
    if (fresh.ok && fresh.entry) {
      const shotOk = fresh.entry.bytes > 0 && fresh.entry.nonEmpty === true;
      layers.push({
        layer: 'S3',
        verdict: shotOk ? 'pass' : 'fail',
        screenshot: fresh.entry.png,
        criteria: [
          { id: 'S3-screenshot', verdict: fresh.entry.bytes > 0 ? 'pass' : 'fail', expected: 'Screenshot > 0 Bytes', actual: `${fresh.entry.png}: ${fresh.entry.bytes} Bytes` },
          { id: 'S3-nonempty', verdict: fresh.entry.nonEmpty === true ? 'pass' : 'fail', expected: 'nonEmpty=true', actual: `nonEmpty=${fresh.entry.nonEmpty}` },
        ],
        durationMs: 0,
      });
    } else {
      layers.push({
        layer: 'S3',
        verdict: 'skip',
        screenshot: fresh.entry?.png ?? null,
        criteria: [{ id: 'S3-skip', verdict: 'skip', expected: 'Messung mit passendem Beleg', actual: fresh.reason }],
        durationMs: 0,
      });
    }
  }
  if (want('S4')) {
    const counts = countMeshesStatic(m.source);
    const meshOk = counts.total <= DEFAULT_BUDGET_LIMITS.meshCount;
    const criteria = [
      { id: 'S4-meshcount', verdict: meshOk ? 'pass' : 'fail', expected: `<= ${DEFAULT_BUDGET_LIMITS.meshCount} (gruen bis 120, Ziel ~45)`, actual: `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})` },
    ];
    let verdict4 = meshOk ? 'pass' : 'fail';
    if (fresh.ok && fresh.entry) {
      const triOk = fresh.entry.triangles <= 150000;
      const dcOk = fresh.entry.drawCalls <= 400;
      criteria.push(
        { id: 'S4-triangles', verdict: triOk ? 'pass' : 'fail', expected: '<= 150000 (renderer.info)', actual: `${fresh.entry.triangles} Dreiecke (renderer.info ${fresh.entry.probe})` },
        { id: 'S4-drawcalls', verdict: dcOk ? 'pass' : 'fail', expected: '<= 400 (renderer.info)', actual: `${fresh.entry.drawCalls} Draw-Calls (renderer.info ${fresh.entry.probe})` },
      );
      if (!triOk || !dcOk) verdict4 = 'fail';
    } else {
      criteria.push(
        { id: 'S4-triangles', verdict: 'skip', expected: '<= 150000 (renderer.info)', actual: `kein gueltiger Beleg, nicht uebernommen: ${fresh.reason}` },
        { id: 'S4-drawcalls', verdict: 'skip', expected: '<= 400 (renderer.info)', actual: `kein gueltiger Beleg, nicht uebernommen: ${fresh.reason}` },
      );
      if (meshOk) verdict4 = 'skip';
    }
    layers.push({ layer: 'S4', verdict: verdict4, criteria, durationMs: 0 });
  }
  if (want('S5')) {
    if (m.manifest) {
      const { layer } = verifyDidacticsLayer(m.manifest, m.source, sollFromMatrixEntry(modellmatrix[m.id]));
      layers.push(layer);
    } else {
      layers.push(skipLayer('S5', 'kein Manifest'));
    }
  }
  const order = ['S1', 'S2', 'S3', 'S4', 'S5'];
  layers.sort((a, b) => order.indexOf(a.layer) - order.indexOf(b.layer));
  const r = buildVerifyReport({ modelId: m.id, iteration: 1, layers, buildHash });
  r.screenshot = fresh.entry?.png ?? null;
  reports.push(r);
  console.log(`${m.id}: ${r.verdict} [${r.failed.join(', ') || 'keine Fehler'}]`);
}

await writeFile(`${DIST}/verify-report.json`, JSON.stringify({ createdAt: new Date().toISOString(), buildHash, models: reports }, null, 2));
const attestation = reports.map((r) => ({
  id: r.modelId,
  ampel: r.verdict === 'rot' ? 'rot' : 'gelb',
  beleg: belegById.get(r.modelId) ?? 'Teilbasis (kein Beleg)',
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
