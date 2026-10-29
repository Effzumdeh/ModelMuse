/**
 * Harness-Loop: P1-Gen -> Verify (S1+S2+S4, optional S5) -> P2-Repair (Guide-3D Abschnitt 3, M2).
 * P2 bekommt S2/S4-Messwerte statt nur S1+S5. Iterations-Budget: max. 2 Auto-
 * Runden + 1 manuelle Reserve (--manual). Abbrueche: GRUEN (alle pass),
 * STAGNATION (identische Fehlerklasse + identischer Ist-Wert), REGRESSION
 * (frueher gruene Klasse wird rot -> Rollback auf Voriteration).
 * Bilder (M5): max. 3 Views, nur bei S2/S3-Fehlern; reine S1/S4-Verstoesse
 * ohne Bild. Protokoll: JSONL mit Latenz/Bytes je Iteration (Token zaehlt
 * muse.exe nicht — outputBytes ist der belegte Proxy).
 * Probe (Browser-Messung): --probe=<json> mit { boxes, faces, polys, parts,
 * groups, snapshot, images }. 2-Frame-Pixel-Diff: --pixel-diff=<0..1> oder
 * --png-diff=<a.png,b.png> (wird per _png-diff.mjs vermessen).
 * Aufruf: node scripts/_harness-loop.mjs --prompt=<p1.txt> --out=<modell.js>
 *   --workdir=<dir> [--probe=<json>] [--png=<a.png,...>] [--pixel-diff=N]
 *   [--png-diff=a,b] [--manifest=<json>] [--max-auto=2] [--manual]
 * Exit: 0 gruen, 1 gestoppt (Stagnation/Regression/Budget/Gen-Fehler), 2 Aufruf.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { verifyStaticLayer, verifyGeometryLayer, verifyDidacticsLayer, extractMeta, formatP2Protocol } from '../src/runtime/verify.js';
import { countMeshesStatic } from '../src/runtime/geometry-checks.js';
import { extractModuleSource } from '../src/runtime/livegen.js';
import { repairThreeImports } from '../src/runtime/guard-static.js';
import { loadBausteine, selectBausteine, renderBausteine } from './_bausteine.mjs';
import { decodePngRgba, pixelDiff } from './_png-diff.mjs';

export const MODULE_BYTES_HARD = 34000;

/** Fail-Kriterien als Map key -> Ist-Wert (key: 'Schicht:Kriterium'). */
export function failsOf(layers) {
  const fails = new Map();
  for (const l of layers ?? []) {
    for (const c of l?.criteria ?? []) {
      if (c.verdict === 'fail') fails.set(`${l.layer}:${c.id}`, String(c.actual ?? ''));
    }
  }
  return fails;
}

/**
 * Iterations-Entscheidung (rein, testbar).
 * @param {{ prevFails: Map<string,string> | null, curFails: Map<string,string>, autoRepairs: number, maxAuto: number, manualAllowed: boolean }} args
 * @returns {{ action: 'green' | 'repair-auto' | 'repair-manual' | 'stagnation' | 'regression' | 'budget', keys?: string[] }}
 */
export function decideIteration({ prevFails, curFails, autoRepairs, maxAuto, manualAllowed }) {
  const cur = curFails ?? new Map();
  if (cur.size === 0) return { action: 'green' };
  if (prevFails) {
    const fresh = [...cur.keys()].filter((k) => !prevFails.has(k));
    if (fresh.length > 0) return { action: 'regression', keys: fresh };
    const sameKeys = cur.size === prevFails.size && [...cur.keys()].every((k) => prevFails.has(k));
    const sameIst = sameKeys && [...cur.entries()].every(([k, v]) => prevFails.get(k) === v);
    if (sameIst) return { action: 'stagnation', keys: [...cur.keys()] };
  }
  if (autoRepairs < maxAuto) return { action: 'repair-auto' };
  if (manualAllowed && autoRepairs === maxAuto) return { action: 'repair-manual' };
  return { action: 'budget' };
}

/**
 * Bild-Policy M5: max. 3 PNGs, nur bei S2/S3-Fehlern.
 * @param {Map<string,string> | string[]} fails
 * @param {string[]} pngs Pfade, optional als 'view=pfad'
 */
export function selectImages(fails, pngs) {
  const keys = Array.isArray(fails) ? fails : [...(fails?.keys?.() ?? [])];
  const visual = keys.some((k) => k.startsWith('S2:') || k.startsWith('S3:'));
  if (!visual) return [];
  return (pngs ?? []).slice(0, 3).map((p) => {
    const m = /^([A-Za-z0-9_-]+)=(.+)$/.exec(p);
    if (m) return { view: m[1], path: m[2] };
    const stem = String(p).split(/[/\\]/).pop().replace(/\.[^.]+$/, '');
    return { view: stem || 'overview', path: p };
  });
}

/** @param {{ head: string, module: string, protocol: string, bausteine: string }} args */
export function buildP2Prompt({ head, module, protocol, bausteine }) {
  return [head.trim(), 'VORHERIGES MODUL:', module.trim(), protocol.trim(), (bausteine ?? '').trim()]
    .filter((s) => s.length > 0)
    .join('\n\n');
}

function arg(name, def = null) {
  const hit = process.argv.find((a) => a === name || a.startsWith(`${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf('=');
  return eq < 0 ? '1' : hit.slice(eq + 1);
}

/** @param {string} promptFile @param {string} rawOut @param {string} errOut */
function genOne(promptFile, rawOut, errOut) {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/_gen-one.mjs', promptFile, rawOut, errOut], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => resolve({ ok: false, meta: null, error: e.message }));
    child.on('close', (code) => {
      let meta = null;
      try {
        meta = JSON.parse(out.trim().split('\n').pop());
      } catch { /* _gen-one meldet selbst */ }
      resolve({ ok: code === 0, meta, error: err.slice(0, 300) });
    });
  });
}

/**
 * S1+S2+S4 (+optional S5) ueber ein Loop-Modul. S3/S5 ohne Beleg: skip.
 * @param {string} source
 * @param {{ probe?: object | null, manifest?: object | null, pixelDiff?: number | null }} [opts]
 */
export function verifyLoopModule(source, opts = {}) {
  const layers = [];
  const meta = extractMeta(source);
  layers.push(verifyStaticLayer(source, meta, { comfort: 1500000, hard: 2000000 }).layer);
  const hasProbe = opts.probe && typeof opts.probe === 'object';
  const hasDiff = typeof opts.pixelDiff === 'number';
  const stats = hasProbe ? { ...opts.probe } : hasDiff ? {} : null;
  if (stats && hasDiff) stats.pixelDiff = opts.pixelDiff;
  layers.push(verifyGeometryLayer(source, stats).layer);
  const counts = countMeshesStatic(source);
  const bytes = Buffer.byteLength(source, 'utf8');
  const snap = stats?.snapshot && typeof stats.snapshot === 'object' ? stats.snapshot : null;
  const tri = snap && typeof snap.triangles === 'number' ? snap.triangles : null;
  const dcs = snap && typeof snap.calls === 'number' ? snap.calls : null;
  const crit4 = [
    { id: 'S4-meshcount', verdict: counts.total <= 250 ? 'pass' : 'fail', expected: '<= 250 (gruen bis 120, Ziel ~45)', actual: `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})` },
    { id: 'S4-modulesize', verdict: bytes <= MODULE_BYTES_HARD ? 'pass' : 'fail', expected: `<= ${MODULE_BYTES_HARD} Bytes`, actual: `${bytes} Bytes` },
    tri === null
      ? { id: 'S4-triangles', verdict: 'skip', expected: '<= 150000 (renderer.info)', actual: 'kein Browser-Beleg (Probe ausstehend)' }
      : { id: 'S4-triangles', verdict: tri <= 150000 ? 'pass' : 'fail', expected: '<= 150000 (renderer.info)', actual: `${tri} Dreiecke (Browser-Probe)` },
    dcs === null
      ? { id: 'S4-drawcalls', verdict: 'skip', expected: '<= 400 (renderer.info)', actual: 'kein Browser-Beleg (Probe ausstehend)' }
      : { id: 'S4-drawcalls', verdict: dcs <= 400 ? 'pass' : 'fail', expected: '<= 400 (renderer.info)', actual: `${dcs} Draw-Calls (Browser-Probe)` },
  ];
  layers.push({ layer: 'S4', verdict: crit4.some((c) => c.verdict === 'fail') ? 'fail' : 'pass', criteria: crit4, durationMs: 0 });
  if (opts.manifest) {
    layers.push(verifyDidacticsLayer(opts.manifest, source).layer);
  }
  return { layers, counts, bytes };
}

const cli = process.argv[1] !== undefined && /_harness-loop\.mjs$/.test(process.argv[1] ?? '');
if (cli) {
  const promptFile = arg('--prompt');
  const outFile = arg('--out');
  const workdir = arg('--workdir');
  const maxAuto = Number(arg('--max-auto', '2'));
  if (!promptFile || !outFile || !workdir || !(maxAuto >= 0 && maxAuto <= 2)) {
    console.error('Aufruf: node scripts/_harness-loop.mjs --prompt=<p1.txt> --out=<modell.js> --workdir=<dir> [Optionen]');
    process.exit(2);
  }
  await mkdir(workdir, { recursive: true });
  const logPath = `${workdir}/harness-loop.jsonl`;
  const log = [];
  const appendLog = async (entry) => {
    log.push(entry);
    await writeFile(logPath, `${log.map((e) => JSON.stringify(e)).join('\n')}\n`);
  };
  const p2head = await readFile(arg('--p2head', 'prompts/p2-repair.v6-harness.txt'), 'utf8');
  const probe = arg('--probe') ? JSON.parse(await readFile(arg('--probe'), 'utf8')) : null;
  const manifest = arg('--manifest') ? JSON.parse(await readFile(arg('--manifest'), 'utf8')) : null;
  const pngs = arg('--png') ? arg('--png').split(',').map((s) => s.trim()).filter(Boolean) : [];
  let pdiff = arg('--pixel-diff') !== null ? Number(arg('--pixel-diff')) : null;
  if (arg('--png-diff') && pdiff === null) {
    const [fa, fb] = arg('--png-diff').split(',').map((s) => s.trim());
    const [a, b] = await Promise.all([readFile(fa), readFile(fb)]);
    pdiff = pixelDiff(decodePngRgba(a), decodePngRgba(b)).diff;
  }
  if (pdiff !== null && !(pdiff >= 0 && pdiff <= 1)) {
    console.error('harness-loop: --pixel-diff muss 0..1 sein');
    process.exit(2);
  }
  const manualAllowed = arg('--manual') !== null;
  const muster = await loadBausteine().catch(() => []);
  let prevFails = null;
  let prevModule = null;
  let autoRepairs = 0;
  let bestModule = null;
  let iter = 0;
  let currentPrompt = promptFile;
  let kind = 'gen';
  for (;;) {
    const t0 = Date.now();
    const startedAt = new Date().toISOString();
    const rawOut = `${workdir}/iter-${iter}.raw.txt`;
    const errOut = `${workdir}/iter-${iter}.err.txt`;
    const gen = await genOne(currentPrompt, rawOut, errOut);
    const raw = await readFile(rawOut, 'utf8').catch(() => '');
    const module = repairThreeImports(extractModuleSource(raw));
    const entry = {
      iter, kind, startedAt, endedAt: new Date().toISOString(), durationMs: Date.now() - t0,
      outputBytes: gen.meta?.outputBytes ?? Buffer.byteLength(raw, 'utf8'), exit: gen.meta?.exit ?? -1,
      fails: [], imagesAttached: 0, pixelDiff: pdiff, decision: '',
    };
    if (!gen.ok || !module.includes('export const meta') || !module.includes('export function init')) {
      entry.decision = 'gen-fehler';
      await appendLog(entry);
      console.error(`harness-loop: Iter ${iter} kein Modul extrahierbar (${(gen.error || '').slice(0, 120)})`);
      process.exit(1);
    }
    await writeFile(`${workdir}/iter-${iter}.js`, module);
    const { layers } = verifyLoopModule(module, { probe, manifest, pixelDiff: pdiff });
    const curFails = failsOf(layers);
    entry.fails = [...curFails.keys()];
    const decision = decideIteration({ prevFails, curFails, autoRepairs, maxAuto, manualAllowed });
    entry.decision = decision.action;
    if (decision.action === 'green') {
      bestModule = module;
      await appendLog(entry);
      await writeFile(outFile, bestModule);
      console.log(`harness-loop: GRUEN nach Iter ${iter} (${entry.fails.length} Fehler, ${entry.durationMs} ms)`);
      process.exit(0);
    }
    if (decision.action === 'regression') {
      entry.keys = decision.keys;
      await appendLog(entry);
      if (prevModule) await writeFile(outFile, prevModule);
      console.error(`harness-loop: REGRESSION in Iter ${iter} (${decision.keys.join(', ')}) — Rollback, Stopp`);
      process.exit(1);
    }
    if (decision.action === 'stagnation' || decision.action === 'budget') {
      await appendLog(entry);
      await writeFile(outFile, module);
      console.error(`harness-loop: ${decision.action === 'stagnation' ? 'STAGNATION' : 'BUDGET erschoepft'} in Iter ${iter} — Stopp`);
      process.exit(1);
    }
    // Repair: P2-Prompt aus Kopf + Modul + Protokoll (+ Bilder nur bei S2/S3) + Bausteinen.
    const imgs = selectImages(curFails, pngs);
    entry.imagesAttached = imgs.length;
    await appendLog(entry);
    const sceneState = probe?.snapshot && typeof probe.snapshot === 'object'
      ? { ...probe.snapshot, boxes: probe.boxes ?? probe.snapshot.boxes, pixelDiff: pdiff }
      : (pdiff !== null ? { pixelDiff: pdiff } : null);
    const protocol = formatP2Protocol(layers, {
      iteration: autoRepairs + 1,
      ...(sceneState ? { sceneState } : {}),
      ...(imgs.length > 0 ? { images: imgs.map((im) => ({ view: im.view, note: `Beleg: ${im.path}` })) } : {}),
    });
    const injection = renderBausteine(selectBausteine([...curFails.keys()], muster));
    currentPrompt = `${workdir}/iter-${iter + 1}.prompt.txt`;
    await writeFile(currentPrompt, buildP2Prompt({ head: p2head, module, protocol, bausteine: injection }));
    prevFails = curFails;
    prevModule = module;
    if (decision.action === 'repair-auto') autoRepairs += 1;
    else autoRepairs = maxAuto + 1; // manuelle Reserve verbraucht
    kind = decision.action === 'repair-auto' ? 'repair-auto' : 'repair-manual';
    iter += 1;
  }
}
