/**
 * npm run verify:* — S1+S5 in Node, S2 als skip (Browser-Suite misst),
 * S3/S4 aus dist/final-budgets.json gespiegelt (nur bei frischem Beleg).
 * Schreibt dist/verify-report.json + dist/attestation.json.
 * Exit 0 nur wenn kein Modell rot ist und das Artefakt unter Komfort liegt.
 * Bauplan Abschnitt 8 (Testbefehle, verify:all).
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { verifyStaticLayer, verifyDidacticsLayer, verifyGeometryLayer, verifySvgLayer, skipLayer, buildVerifyReport, sollFromMatrixEntry, formatP2Protocol } from '../src/runtime/verify.js';
import { isTwoDSource } from '../src/runtime/guard-static.js';
import { countSvgShapes } from '../src/vendor/diagram-2d.js';
import { buildDiagramSvg } from '../src/vendor/diagram-2d.js';
import { extractDiagram } from '../src/runtime/verify.js';
import { extractMeta } from '../src/runtime/verify.js';
import { countMeshesStatic } from '../src/runtime/geometry-checks.js';
import { DEFAULT_BUDGET_LIMITS } from '../src/runtime/budget.js';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=S1,S2,S3,S4,S5').slice(7).split(',').map((s) => s.trim().toUpperCase());
// M2 (Guide-3D Abschnitt 3): Browser-Probe je Modell einspeisen
// (--probe-json={id: {boxes,faces,polys,parts,groups,pixelDiff,snapshot,images}})
// und P2-Fehlerprotokolle schreiben (--p2-out=<dir>/p2-<id>.txt). Ohne Flags:
// Verhalten unveraendert (statischer S2-Pfad, Belege aus final-budgets.json).
const probeJsonArg = process.argv.find((a) => a.startsWith('--probe-json='));
const p2OutArg = process.argv.find((a) => a.startsWith('--p2-out='));
await mkdir(DIST, { recursive: true });
/** @type {Record<string, object>} */
let probeById = {};
if (probeJsonArg) {
  try {
    probeById = JSON.parse(await readFile(probeJsonArg.slice(13), 'utf8'));
  } catch (e) {
    console.error(`verify: --probe-json unlesbar (${e.message}) — Abbruch`);
    process.exit(2);
  }
}
if (p2OutArg) await mkdir(p2OutArg.slice(9), { recursive: true });

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
    if (isTwoDSource(m.source)) {
      // 2D-Route: S2-light (parse + pixel + Typ-Whitelist), kein WebGL.
      const { layer } = verifySvgLayer(m.source);
      layers.push(layer);
    } else {
      const probe = probeById[m.id] && typeof probeById[m.id] === 'object' ? probeById[m.id] : null;
      const { layer } = verifyGeometryLayer(m.source, probe);
      layers.push(layer);
    }
  }
  if (want('S3')) {
    if (isTwoDSource(m.source)) {
      // 2D-Route: Beleg aus scripts/shot-2d.mjs (dist-2d/<id>.png, Pixel-Gate).
      const png2d = `dist-2d/${m.id}.png`;
      let bytes2d = 0;
      try {
        bytes2d = (await stat(`${ROOT}/${png2d}`)).size;
      } catch {
        bytes2d = 0;
      }
      if (bytes2d > 0) {
        layers.push({
          layer: 'S3',
          verdict: 'pass',
          screenshot: png2d,
          criteria: [
            { id: 'S3-screenshot', verdict: 'pass', expected: 'Screenshot > 0 Bytes', actual: `${png2d}: ${bytes2d} Bytes` },
            { id: 'S3-nonempty', verdict: 'pass', expected: 'nonEmpty=true (2D-Pixel-Gate)', actual: `2D-Screenshot vorhanden, ${bytes2d} Bytes` },
          ],
          durationMs: 0,
        });
      } else {
        layers.push({
          layer: 'S3',
          verdict: 'skip',
          screenshot: null,
          criteria: [{ id: 'S3-skip', verdict: 'skip', expected: '2D-Screenshot (dist-2d)', actual: '2D-Route: kein shot-2d-Beleg, kein WebGL-Screenshot' }],
          durationMs: 0,
        });
      }
    } else if (fresh.ok && fresh.entry) {
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
    if (isTwoDSource(m.source)) {
      // 2D-Route: S4-light — SVG-Knoten + Modulbytes statt WebGL-Budgets.
      const diagram = extractDiagram(m.source);
      let shapes = 0;
      try {
        shapes = countSvgShapes(buildDiagramSvg(diagram ?? {}));
      } catch {
        shapes = -1;
      }
      const modBytes = Buffer.byteLength(m.source, 'utf8');
      const nodesOk = shapes >= 0 && shapes <= 800;
      const modOk = modBytes <= 34000;
      layers.push({
        layer: 'S4',
        verdict: nodesOk && modOk ? 'pass' : 'fail',
        criteria: [
          { id: 'S4-2d-nodes', verdict: nodesOk ? 'pass' : 'fail', expected: '<= 800 SVG-Knoten (S4-light)', actual: `${shapes} Shapes (Vendor-Render)` },
          { id: 'S4-2d-module', verdict: modOk ? 'pass' : 'fail', expected: '<= 34000 Bytes', actual: `${modBytes} Bytes` },
        ],
        durationMs: 0,
      });
    } else {
    const counts = countMeshesStatic(m.source);
    const meshOk = counts.total <= DEFAULT_BUDGET_LIMITS.meshCount;
    const criteria = [
      { id: 'S4-meshcount', verdict: meshOk ? 'pass' : 'fail', expected: `<= ${DEFAULT_BUDGET_LIMITS.meshCount} (gruen bis 120, Ziel ~45)`, actual: `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})` },
    ];
    let verdict4 = meshOk ? 'pass' : 'fail';
    const probeSnap = probeById[m.id]?.snapshot && typeof probeById[m.id].snapshot === 'object' ? probeById[m.id].snapshot : null;
    if (probeSnap && typeof probeSnap.triangles === 'number' && typeof probeSnap.calls === 'number') {
      const triOk = probeSnap.triangles <= 150000;
      const dcOk = probeSnap.calls <= 400;
      criteria.push(
        { id: 'S4-triangles', verdict: triOk ? 'pass' : 'fail', expected: '<= 150000 (renderer.info)', actual: `${probeSnap.triangles} Dreiecke (Browser-Probe)` },
        { id: 'S4-drawcalls', verdict: dcOk ? 'pass' : 'fail', expected: '<= 400 (renderer.info)', actual: `${probeSnap.calls} Draw-Calls (Browser-Probe)` },
      );
      if (!triOk || !dcOk) verdict4 = 'fail';
    } else if (fresh.ok && fresh.entry) {
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
  r.route = isTwoDSource(m.source) ? { mode: '2d', reason: '2d-svg Datenpfad' } : { mode: '3d' };
  r.screenshot = fresh.entry?.png ?? null;
  reports.push(r);
  console.log(`${m.id}: ${r.verdict} [${r.failed.join(', ') || 'keine Fehler'}]`);
  if (p2OutArg && r.failed.length > 0) {
    const pb = probeById[m.id] && typeof probeById[m.id] === 'object' ? probeById[m.id] : null;
    const pSnap = pb?.snapshot && typeof pb.snapshot === 'object' ? pb.snapshot : null;
    const sceneState = pSnap ? { ...pSnap, boxes: pb.boxes ?? pSnap.boxes, pixelDiff: pb.pixelDiff ?? pSnap.pixelDiff } : null;
    const images = Array.isArray(pb?.images) ? pb.images.slice(0, 3) : [];
    await writeFile(`${p2OutArg.slice(9)}/p2-${m.id}.txt`, formatP2Protocol(layers, {
      iteration: 1,
      ...(sceneState ? { sceneState } : {}),
      ...(images.length > 0 ? { images } : {}),
    }));
  }
}

await writeFile(`${DIST}/verify-report.json`, JSON.stringify({ createdAt: new Date().toISOString(), buildHash, routes: { p0: true, p1_2d: true, models2d: reports.filter((r) => r.route?.mode === '2d').map((r) => r.modelId) }, models: reports }, null, 2));
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
