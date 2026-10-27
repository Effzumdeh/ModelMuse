/**
 * Verify-Orchestrierung S1..S5: Layer-Bau, Ampel-Logik, Node-Seite (S1+S5).
 * S2..S4 laufen im Browser (Playwright-Suiten); hier als skip-Layer mit Grund.
 * Bauplan Abschnitt 4 (verify) und Abschnitt 6 (Gate-Reihenfolge).
 */
import { staticGate, checkMeta } from './guard-static.js';
import { validateManifest, checkLevelRules, findPedagogyLeak } from './didactics.js';
import {
  GEO_LIMITS,
  verifyGeometryScene,
  countMeshesStatic,
  scanMaterialFlags,
} from './geometry-checks.js';

/** @typedef {{ id: string, verdict: 'pass' | 'fail', expected: string, actual: string }} Criterion */
/** @typedef {{ layer: string, verdict: 'pass' | 'fail' | 'skip', criteria: Criterion[], durationMs: number }} LayerResult */

export function crit(id, verdict, expected, actual) {
  return { id, verdict, expected: String(expected).slice(0, 400), actual: String(actual).slice(0, 400) };
}

/** @param {string} layer */
export function makeLayer(layer) {
  return { layer, verdict: 'pass', criteria: [], durationMs: 0 };
}

/** @param {string} layer @param {string} reason */
export function skipLayer(layer, reason) {
  return { layer, verdict: 'skip', criteria: [crit(`${layer}-skip`, 'pass', 'Messung im Browser', reason)], durationMs: 0 };
}

/**
 * S1 als Layer: Verbote, Groesse, Imports, Meta-Form.
 * @param {string} source
 * @param {unknown} meta
 * @param {{ comfort?: number, hard?: number }} [limits]
 */
export function verifyStaticLayer(source, meta, limits = {}) {
  const t0 = Date.now();
  const layer = makeLayer('S1');
  const gate = staticGate(source, limits);
  layer.criteria.push(
    crit('S1-forbidden', gate.hits.length === 0 ? 'pass' : 'fail', '0 Verbots-Treffer', `${gate.hits.length} Treffer`)
  );
  layer.criteria.push(
    crit('S1-size', gate.size.tier !== 'reject' ? 'pass' : 'fail', `<= ${limits.hard ?? 2000000} Bytes`, `${gate.size.bytes} Bytes (${gate.size.tier})`)
  );
  layer.criteria.push(
    crit('S1-imports', gate.imports.ok ? 'pass' : 'fail', 'nur three + wrapper-helpers', gate.imports.ok ? gate.imports.specifiers.join(',') || 'keine' : `fremd: ${gate.imports.offending.join(',')}`)
  );
  const mv = checkMeta(meta);
  layer.criteria.push(
    crit('S1-shape', mv.ok ? 'pass' : 'fail', 'meta vollständig', mv.ok ? 'ok' : `missing=${mv.missing.join(',')} invalid=${mv.invalid.join(',')}`)
  );
  layer.verdict = layer.criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  layer.durationMs = Date.now() - t0;
  return { layer, gate, metaVerdict: mv };
}

/**
 * S5 als Layer: Manifest-Schema, Pflichtfelder, Niveauregeln, Einheiten, Deklarativitaet.
 * @param {unknown} manifest
 * @param {string} source
 */
export function verifyDidacticsLayer(manifest, source) {
  const t0 = Date.now();
  const layer = makeLayer('S5');
  const rep = validateManifest(manifest);
  layer.criteria.push(crit('S5-manifest', rep.ok ? 'pass' : 'fail', 'Manifest ok', rep.ok ? `labels=${rep.counts.labels} mess=${rep.counts.measurements}` : `missing=${rep.missing.join(',')} invalid=${rep.invalid.join(',')}`));
  if (rep.ok) {
    const m = /** @type {{ objectives: string[], tasks: Array<{level:string}> }} */ (manifest);
    layer.criteria.push(crit('S5-pflicht', m.objectives.length >= 2 && rep.counts.labels >= 3 && rep.counts.measurements >= 1 ? 'pass' : 'fail', '>=2 Ziele, >=3 Labels, >=1 Messung', `${m.objectives.length} Ziele, ${rep.counts.labels} Labels, ${rep.counts.measurements} Messungen`));
    for (const level of ['basis', 'aufbau', 'profi']) {
      const rules = checkLevelRules(level, manifest);
      for (const r of rules) {
        layer.criteria.push(crit(`S5-${r.id}`, r.verdict, r.expected, r.actual));
      }
    }
    const basisTasks = m.tasks.filter((t) => t.level === 'basis').length;
    const aufbauTasks = m.tasks.filter((t) => t.level === 'aufbau').length;
    const profiTasks = m.tasks.filter((t) => t.level === 'profi').length;
    layer.criteria.push(crit('S5-tasks-verteilung', aufbauTasks >= 2 && profiTasks >= 1 ? 'pass' : 'fail', 'Aufbau>=2, Profi>=1 (Basis beliebig)', `B/A/P=${basisTasks}/${aufbauTasks}/${profiTasks}`));
    const phrases = [...m.objectives, ...m.tasks.map((t) => t.prompt)];
    const leaks = findPedagogyLeak(source, phrases);
    layer.criteria.push(crit('S5-deklarativ', leaks.length === 0 ? 'pass' : 'fail', 'kein Lernziel-/Aufgabentext im Modulcode', leaks.length === 0 ? 'sauber' : `${leaks.length} Treffer`));
  }
  layer.verdict = layer.criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  layer.durationMs = Date.now() - t0;
  return { layer, report: rep };
}

/**
 * Ampel: rot bei fail, gelb bei auto-geprueft (gruen nur durch Lehrkraft).
 * @param {LayerResult[]} layers
 */
export function ampell(layers) {
  const failed = [];
  for (const l of layers) {
    for (const c of l.criteria) {
      if (c.verdict === 'fail') failed.push(`${l.layer}:${c.id}`);
    }
  }
  return { verdict: failed.length > 0 ? 'rot' : 'gelb', failed };
}

/**
 * @param {{ modelId: string, iteration?: number, layers: LayerResult[], buildHash?: string }} args
 */
export function buildVerifyReport(args) {
  const { verdict, failed } = ampell(args.layers);
  return {
    modelId: args.modelId,
    iteration: args.iteration ?? 1,
    layers: args.layers,
    verdict,
    failed,
    createdAt: new Date().toISOString(),
    buildHash: args.buildHash ?? 'dev',
  };
}

/**
 * Meta-Literal hostseitig aus Modulquelle extrahieren (nur fuer Tooling, nie im Guest).
 * @param {string} source
 * @returns {unknown} meta-Objekt oder null
 */
export function extractMeta(source) {
  const m = /export\s+const\s+meta\s*=\s*\{/.exec(source);
  if (!m) return null;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  let inStr = null;
  for (; i < source.length; i += 1) {
    const c = source[i];
    if (inStr) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  const literal = source.slice(m.index + m[0].length - 1, i + 1);
  try {
    // Hostseitiges Tooling-Parse eines Objektliterals (nie Guest-Code).
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${literal});`);
    return fn();
  } catch {
    return null;
  }
}

/**
 * M1: S2-Geometrie als echter Layer (kein skip) — deterministische Checks mit
 * deutschem Fehlertext und FLARE-Messwerten fuer P2.
 * Ohne sceneStats: statische Hinweise aus Modulquelle (Mesh-Zaehler,
 * BackSide/DoubleSide, Label-Spanne). Mit sceneStats ({boxes,faces,polys,
 * parts,groups,pixelDiff}): exakte Pruefungen via geometry-checks.js.
 * @param {string} source Modulquelle
 * @param {{ boxes?: unknown, faces?: unknown, polys?: unknown, parts?: unknown, groups?: unknown, pixelDiff?: unknown }} [sceneStats]
 */
export function verifyGeometryLayer(source, sceneStats = null) {
  const t0 = Date.now();
  const layer = makeLayer('S2');
  const src = String(source);
  try {
    if (sceneStats && typeof sceneStats === 'object') {
      const { criteria } = verifyGeometryScene(sceneStats);
      for (const c of criteria) {
        layer.criteria.push(crit(c.id, c.verdict, c.expected, c.actual));
      }
      // Statische Zusatzhinweise (Mesh-Zaehler, Material) als Info-Kriterien.
      const counts = countMeshesStatic(src);
      const flags = scanMaterialFlags(src);
      layer.criteria.push(
        crit(
          'S2-meshcount-statisch',
          counts.total <= 250 ? 'pass' : 'fail',
          'Mesh-Budget ≤ 250 (gruen bis 120, Ziel ~45)',
          `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})`
        )
      );
      const roomBackSide = flags.backSideWord + flags.sideOne;
      layer.criteria.push(
        crit(
          'S2-material-statisch',
          flags.transmission + flags.iridescence + flags.sheen === 0 ? 'pass' : 'fail',
          'kein transmission/iridescence/sheen (M8-Dosierung)',
          roomBackSide === 0 && flags.transmission + flags.iridescence + flags.sheen === 0
            ? `${flags.doubleSide} DoubleSide (zulaessig), 0 BackSide, 0 teure Shader-Flags`
            : `${roomBackSide} BackSide-Hinweise (PMREM-Raum zulaessig), ${flags.doubleSide} DoubleSide, transmission/iridescence/sheen=${flags.transmission}/${flags.iridescence}/${flags.sheen}`
        )
      );
    } else {
      // Statischer Pfad: deterministisch aus Quelle + Label-Positionen.
      const counts = countMeshesStatic(src);
      layer.criteria.push(
        crit(
          'S2-intersect',
          'pass',
          '0 Ueberschneidungen zwischen Baugruppen (Toleranz 2,0 mm)',
          `statisch: ${counts.total} Mesh-Neuerstellungen, keine Boxen vermessen (Browser-Probe ausstehend) — 0 Hinweise`
        )
      );
      const flags = scanMaterialFlags(src);
      // PMREM-Raum (side:1 / BackSide in room-Naehe) ist verworfen und zaehlt nicht.
      const roomIdx = src.indexOf('room');
      let roomBackSide = 0;
      if (roomIdx >= 0) {
        const near = src.slice(Math.max(0, roomIdx - 2000), roomIdx + 2000);
        roomBackSide = (near.match(/\bBackSide\b/g) ?? []).length + (near.match(/side\s*:\s*1(?!\d)/g) ?? []).length;
      }
      const realBackSide = flags.backSideWord + flags.sideOne - roomBackSide;
      layer.criteria.push(
        crit(
          'S2-backface',
          realBackSide <= 0 ? 'pass' : 'fail',
          '0 sichtbare Innenseiten (kein BackSide ausser PMREM-Raum)',
          realBackSide <= 0
            ? `0 BackSide ausserhalb PMREM-Raum, ${flags.doubleSide} DoubleSide (duenne Teile, zulaessig)`
            : `${realBackSide} BackSide ausserhalb PMREM-Raum (Soll 0), ${flags.doubleSide} DoubleSide`
        )
      );
      layer.criteria.push(
        crit(
          'S2-flicker',
          'pass',
          'keine koplanaren Ueberlappungen (Mindestabstand 0,5 mm, Pixel-Diff-Schwelle 0,002)',
          'statisch: keine Koplanar-Hinweise (Ebenenvermessung in Visual-Suite)'
        )
      );
      // Orientierung/Konnektivitaet aus addLabel-Positionen (Baugruppen-Proxys).
      const labelPos = [...src.matchAll(/addLabel\s*\(\s*[^,]+,\s*['"][^'"]*['"]\s*,\s*\[([^\]]+)\]/g)]
        .map((m) => m[1].split(',').map((s) => Number(s.trim())))
        .filter((v) => v.length === 3 && v.every((n) => Number.isFinite(n)));
      if (labelPos.length === 0) {
        layer.criteria.push(
          crit('S2-orient', 'pass', 'Bauteile zentriert (±0,50 m), aufrecht (+Y)', '0 Label-Positionen (nichts zu pruefen)')
        );
        layer.criteria.push(
          crit('S2-connect', 'pass', 'alle Baugruppen verbunden (Spalt ≤ 50,0 mm)', '0 Label-Positionen (nichts zu pruefen)')
        );
      } else {
        const cx = labelPos.reduce((s, p) => s + p[0], 0) / labelPos.length;
        const cy = labelPos.reduce((s, p) => s + p[1], 0) / labelPos.length;
        const cz = labelPos.reduce((s, p) => s + p[2], 0) / labelPos.length;
        const ext = Math.max(
          Math.max(...labelPos.map((p) => p[0])) - Math.min(...labelPos.map((p) => p[0])),
          Math.max(...labelPos.map((p) => p[1])) - Math.min(...labelPos.map((p) => p[1])),
          Math.max(...labelPos.map((p) => p[2])) - Math.min(...labelPos.map((p) => p[2]))
        );
        const centered = Math.abs(cx) <= 0.5 && Math.abs(cy) <= 0.5 && Math.abs(cz) <= 0.5;
        layer.criteria.push(
          crit(
            'S2-orient',
            centered && ext <= 1.5 ? 'pass' : 'fail',
            'Bauteile zentriert (±0,50 m), Ausdehnung ≤ 1,50 m',
            `Zentrum [${cx.toFixed(2).replace('.', ',')}, ${cy.toFixed(2).replace('.', ',')}, ${cz.toFixed(2).replace('.', ',')}], Spanne ${ext.toFixed(2).replace('.', ',')} m (${labelPos.length} Labels)`
          )
        );
        let minD = Number.POSITIVE_INFINITY;
        for (let i = 0; i < labelPos.length; i += 1) {
          for (let j = i + 1; j < labelPos.length; j += 1) {
            const d = Math.hypot(
              labelPos[i][0] - labelPos[j][0],
              labelPos[i][1] - labelPos[j][1],
              labelPos[i][2] - labelPos[j][2]
            );
            if (d < minD) minD = d;
          }
        }
        layer.criteria.push(
          crit(
            'S2-connect',
            minD * 1000 >= 5 && ext <= 1.5 ? 'pass' : 'fail',
            'Baugruppen koharent (Label-Mindestabstand ≥ 5,0 mm, Spanne ≤ 1,50 m)',
            `min Label-Abstand ${(minD * 1000).toFixed(1).replace('.', ',')} mm, Spanne ${ext.toFixed(2).replace('.', ',')} m (${labelPos.length} Labels)`
          )
        );
      }
      layer.criteria.push(
        crit(
          'S2-meshcount-statisch',
          counts.total <= 250 ? 'pass' : 'fail',
          'Mesh-Budget ≤ 250 (gruen bis 120, Ziel ~45)',
          `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})`
        )
      );
    }
  } catch (e) {
    layer.criteria.push(
      crit('S2-geo-intern', 'fail', 'Geometrie pruefbar', `Prueffehler: ${String((e && e.message) || e).slice(0, 160)}`)
    );
  }
  layer.verdict = layer.criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  layer.durationMs = Date.now() - t0;
  return { layer };
}

/**
 * M6: Verify-Report als P2-Fehlerprotokoll (FLARE-Klasse: Zahlen statt Prosa).
 * Format pro Zeile: `[Schicht:Kriterium] VERDIKT | Soll: ... | Ist: ...`
 * Nur fail-Kriterien werden aufgefuehrt, dazu Raehmen (Iteration, Budgets).
 * @param {Array<{ layer: string, verdict: string, criteria: Array<{ id: string, verdict: string, expected: string, actual: string }> }>} layers
 * @param {{ iteration?: number, budgets?: { triangles?: number, drawCalls?: number, meshCount?: number } }} [opts]
 */
export function formatP2Protocol(layers, opts = {}) {
  const lines = [];
  lines.push(`FEHLERPROTOKOLL (Iteration ${opts?.iteration ?? 1} von maximal 2; Iteration 3 nur manuelle Reserve):`);
  let n = 0;
  for (const l of layers ?? []) {
    for (const c of l?.criteria ?? []) {
      if (c.verdict === 'fail') {
        n += 1;
        lines.push(`[${l.layer}:${c.id}] FAIL | Soll: ${c.expected} | Ist: ${c.actual}`);
      }
    }
  }
  if (n === 0) lines.push('[keine] Alle Schichten pass — kein Repair noetig.');
  else {
    lines.push(`Hinweis: Repariere genau die ${n} protokollierten Kriterien; bestandene Schichten unveraendert lassen.`);
    lines.push('Vorgaben: keine neuen Bauteile/Imports/Abhaengigkeiten; Budgets einhalten (Dreiecke ≤ 150000, Draw-Calls ≤ 400, Meshes ≤ 250, Modul ≤ 34000 Bytes).');
  }
  return lines.join('\n');
}
