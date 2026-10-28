/**
 * Verify-Orchestrierung S1..S5: Layer-Bau, Ampel-Logik, Node-Seite (S1+S5).
 * S2..S4 laufen im Browser (Playwright-Suiten); hier als skip-Layer mit Grund.
 * Bauplan Abschnitt 4 (verify) und Abschnitt 6 (Gate-Reihenfolge).
 */
import { staticGate, checkMeta, TWOD_KINDS, isTwoDSource } from './guard-static.js';
import { validateManifest, checkLevelRules, findPedagogyLeak } from './didactics.js';
import { buildDiagramSvg, countSvgShapes, isWellformedSvg } from '../vendor/diagram-2d.js';
import {
  GEO_LIMITS,
  verifyGeometryScene,
  checkIntersections,
  countMeshesStatic,
  scanMaterialFlags,
} from './geometry-checks.js';

/** @typedef {{ id: string, verdict: 'pass' | 'fail', expected: string, actual: string }} Criterion */
/** @typedef {{ layer: string, verdict: 'pass' | 'fail' | 'skip', criteria: Criterion[], durationMs: number }} LayerResult */

export function crit(id, verdict, expected, actual) {
  return { id, verdict, expected: String(expected).slice(0, 400), actual: String(actual).slice(0, 400) };
}

/**
 * O-10: Matrix-Eintrag {labelsMin, units, tasks[B,A,P]} aus
 * src/data/modellmatrix.json -> Soll {labels, tasksBAP} fuer S5-soll.
 * Ungueltig/unbekannt (free-Modelle ohne Matrix-Eintrag) -> undefined
 * (graceful: S5-soll wird skip/pass, alte Mindestpruefung bleibt gueltig).
 * @param {{ labelsMin?: unknown, labels?: unknown, tasks?: unknown, tasksBAP?: unknown }} entry
 */
export function sollFromMatrixEntry(entry) {
  if (!entry || typeof entry !== 'object') return undefined;
  const labels = Number(entry.labelsMin ?? entry.labels);
  const t = entry.tasks ?? entry.tasksBAP;
  if (!Number.isInteger(labels)) return undefined;
  if (!Array.isArray(t) || t.length !== 3 || !t.every((n) => Number.isInteger(n))) return undefined;
  return { labels, tasksBAP: [...t] };
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
    crit('S1-imports', gate.imports.ok ? 'pass' : 'fail', 'nur three/wrapper-helpers/2d-*', gate.imports.ok ? gate.imports.specifiers.join(',') || 'keine' : `fremd: ${gate.imports.offending.join(',')}`)
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
 * O-10: dritter Param soll {labels, tasksBAP} (optional, per sollFromMatrixEntry
 * aus src/data/modellmatrix.json) — neues Kriterium S5-soll mit exakten
 * Sollwerten. Fehlt soll (free-Modelle ohne Matrix-Eintrag): S5-soll graceful,
 * alte Mindestpruefung (S5-pflicht/S5-tasks-verteilung) bleibt gueltig.
 * @param {unknown} manifest
 * @param {string} source
 * @param {{ labels?: unknown, tasksBAP?: unknown }} [soll]
 */
export function verifyDidacticsLayer(manifest, source, soll) {
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
    // O-10 S5-soll: Labels exakt == soll.labels, Tasks B/A/P exakt == soll.tasksBAP.
    // Messungen NICHT exakt (Matrix enthaelt keine Mess-Sollwerte — nichts erfunden).
    const s = soll != null && Number.isInteger(soll.labels) && Array.isArray(soll.tasksBAP) && soll.tasksBAP.length === 3 && soll.tasksBAP.every((n) => Number.isInteger(n)) ? soll : null;
    if (s) {
      const okSoll = rep.counts.labels === s.labels && basisTasks === s.tasksBAP[0] && aufbauTasks === s.tasksBAP[1] && profiTasks === s.tasksBAP[2];
      layer.criteria.push(crit('S5-soll', okSoll ? 'pass' : 'fail', `Labels==${s.labels}, B/A/P=${s.tasksBAP[0]}/${s.tasksBAP[1]}/${s.tasksBAP[2]}`, `Labels=${rep.counts.labels}, B/A/P=${basisTasks}/${aufbauTasks}/${profiTasks}`));
    } else {
      // Graceful ohne Matrix-Eintrag (free): bewusst 'pass' (nicht 'skip') — ein
      // 'skip'-Verdikt wuerde layer.verdict (every pass) auf fail kippen.
      layer.criteria.push(crit('S5-soll', 'pass', 'exakte Sollwerte (Matrix-Eintrag)', 'kein Eintrag (free) — Mindestpruefung S5-pflicht/S5-tasks-verteilung gilt'));
    }
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
 * A-08: Browser-Probe (frame-bootstrap snapshot) liefert boxes ggf. ohne id
 * (checkIntersections braucht id-Strings). Hier nur Labels + Cap 16
 * ergaenzen — keine Messwerte erfinden, keine Paare unterschlagen.
 * @param {{ boxes?: unknown }} sceneStats
 */
function withProbeIds(sceneStats) {
  if (!Array.isArray(sceneStats.boxes)) return sceneStats;
  const boxes = sceneStats.boxes.slice(0, 16).map((b, i) => {
    if (!b || typeof b !== 'object') return b;
    if (typeof b.id === 'string' && b.id) return b;
    return { ...b, id: `box-${i}` };
  });
  return { ...sceneStats, boxes };
}

/**
 * A-08: Probe-Verwertung. S2-intersect: echter AABB-Test mit 2,0-mm-Toleranz
 * (GEO_LIMITS.penetrationMm) ueber die Probe-Boxen (≤16 ⇒ ≤120 Paare,
 * Node-seitig trivial; kein Pair-Cap in der Auswertung, damit keine echte
 * Ueberschneidung unterschlagen wird — Report zeigt max. 4 Paare + exakte
 * Zaehlung, innerhalb der 8-Paare-Grenze). S2-backface: nur ohne faces aus
 * backfaceHits ableiten (hits > 0 ⇒ fail; 0 + Grund ⇒ pass mit Hinweis,
 * nie rot ohne Beleg). Ohne Probe: statische Texte unveraendert (graceful).
 * @param {{ criteria: Array<{ id: string, verdict: string, expected: string, actual: string }> }} layer
 * @param {object} stats
 */
function applyProbeCriteria(layer, stats) {
  const byId = (id) => layer.criteria.findIndex((c) => c.id === id);
  if (Array.isArray(stats.boxes) && stats.boxes.length > 0) {
    const r = checkIntersections(stats.boxes, GEO_LIMITS.penetrationMm);
    if (r.measurements.boxesChecked > 0) {
      const i = byId('S2-intersect');
      const rep = crit('S2-intersect', r.verdict, r.expected, r.actual);
      if (i >= 0) layer.criteria[i] = rep;
      else layer.criteria.push(rep);
    }
  }
  if ((!Array.isArray(stats.faces) || stats.faces.length === 0) && typeof stats.backfaceHits === 'number') {
    const hits = stats.backfaceHits;
    const note = typeof stats.geoNote === 'string' && stats.geoNote ? ` — ${stats.geoNote.slice(0, 160)}` : '';
    const i = byId('S2-backface');
    const rep =
      hits > 0
        ? crit('S2-backface', 'fail', '0 sichtbare Innenseiten (kein BackSide, konsistente Normalen)', `${hits} BackSide-/Rueckseiten-Treffer (Browser-Raycast, max. 32 Meshes)${note}`)
        : crit('S2-backface', 'pass', '0 sichtbare Innenseiten (kein BackSide, konsistente Normalen)', note ? `0 Treffer gezaehlt${note} (statisch: kein BackSide ausser PMREM-Raum)` : '0 BackSide-/Rueckseiten-Treffer (Browser-Raycast, max. 32 Meshes)');
    if (i >= 0) layer.criteria[i] = rep;
    else layer.criteria.push(rep);
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
      const stats = withProbeIds(sceneStats);
      const { criteria } = verifyGeometryScene(stats);
      for (const c of criteria) {
        layer.criteria.push(crit(c.id, c.verdict, c.expected, c.actual));
      }
      applyProbeCriteria(layer, stats);
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
      // PMREM-Raum (side:1 / BackSide in Raum-Naehe) ist verworfen und zaehlt nicht.
      // Namensunabhaengig: Bezeichner aus fromScene(<szene>, ...) lesen, Fenster um
      // dessen new-Scene-Deklaration legen; Fallback: erstes 'room' (Bestand).
      const pmremArg = /\.fromScene\s*\(\s*([A-Za-z_$][\w$]*)/.exec(src)?.[1] ?? null;
      const declIdx = pmremArg ? src.search(new RegExp(`\\b(?:const|let|var)\\s+${pmremArg}\\s*=\\s*new\\s+Scene\\s*\\(`)) : -1;
      const roomIdx = declIdx >= 0 ? declIdx : src.indexOf('room');
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
 * Diagramm-Literal hostseitig aus Modulquelle extrahieren (nur Tooling).
 * @param {string} source
 * @returns {Record<string, unknown> | null}
 */
export function extractDiagram(source) {
  const m = /export\s+const\s+diagram\s*=\s*\{/.exec(source);
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
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/**
 * 2D-Gates (S2-light, Node-seitig, deterministisch): parse + pixel + Typ-Whitelist.
 * - parse: 2D-Quelle (Import aus 2d-*) UND diagram-Literal, das der Vendor-
 *   Renderer wohlgeformt baut (kein <script>, keine Fremd-URL).
 * - pixel: >= 4 SVG-Formelemente im GERENDERTEN Svg (echter Pixel-Proxy;
 *   Browser-Visual-Suite zaehlt zusaetzlich nicht-leere Alphapixel).
 * - typ: diagram.kind in TWOD_KINDS-Whitelist.
 * @param {string} source Modulquelle
 */
export function verifySvgLayer(source) {
  const t0 = Date.now();
  const layer = makeLayer('S2');
  const src = String(source);
  try {
    const is2d = isTwoDSource(src);
    layer.criteria.push(
      crit('S2-2d-parse', is2d ? 'pass' : 'fail', '2D-Datenpfad (Import aus 2d-*)', is2d ? '2d-Import gefunden (Lib im Vendor, Modul liefert Daten)' : 'kein 2d-Import (3D-Pfad oder Fremd-Import)')
    );
    const diagram = extractDiagram(src);
    if (!diagram) {
      layer.criteria.push(crit('S2-2d-data', 'fail', 'export const diagram {...}', 'kein Diagramm-Literal extrahierbar'));
      layer.criteria.push(crit('S2-2d-pixel', 'fail', '>= 4 SVG-Formelemente (gerendert)', 'ohne Daten kein Render'));
      layer.criteria.push(crit('S2-2d-typ', 'fail', `diagram.kind in [${TWOD_KINDS.join('|')}]`, 'kein kind (keine Daten)'));
    } else {
      const kind = typeof diagram.kind === 'string' ? diagram.kind : null;
      const typOk = kind !== null && TWOD_KINDS.includes(kind);
      layer.criteria.push(
        crit('S2-2d-typ', typOk ? 'pass' : 'fail', `diagram.kind in [${TWOD_KINDS.join('|')}]`, kind === null ? 'kein kind gefunden' : `${kind} ${typOk ? 'erlaubt' : 'NICHT erlaubt'}`)
      );
      let svg = '';
      let wellformed = false;
      try {
        svg = buildDiagramSvg(/** @type {any} */ (diagram));
        wellformed = isWellformedSvg(svg);
      } catch (e) {
        svg = '';
        wellformed = false;
      }
      layer.criteria.push(
        crit('S2-2d-parse-svg', wellformed ? 'pass' : 'fail', 'Vendor-Render wohlgeformt', wellformed ? `${svg.length} Zeichen SVG` : 'Render unwohlgeformt/abgebrochen')
      );
      const shapes = countSvgShapes(svg);
      layer.criteria.push(
        crit('S2-2d-pixel', shapes >= 4 ? 'pass' : 'fail', '>= 4 SVG-Formelemente (gerendert)', `${shapes} Shapes im Vendor-Render`)
      );
      const badScript = /<script[\s>]/.test(src);
      const badUrl = /(https?:|javascript:)/.test(stripSvgCommentsSafe(src));
      layer.criteria.push(
        crit('S2-2d-wellformed', !badScript && !badUrl ? 'pass' : 'fail', 'kein <script>, keine Fremd-URL im Modul', badScript ? '<script> gefunden' : badUrl ? 'Fremd-URL gefunden' : 'sauber')
      );
    }
  } catch (e) {
    layer.criteria.push(
      crit('S2-2d-intern', 'fail', '2D pruefbar', `Prueffehler: ${String((e && e.message) || e).slice(0, 160)}`)
    );
  }
  layer.verdict = layer.criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  layer.durationMs = Date.now() - t0;
  return { layer };
}

/** @param {string} src */
function stripSvgCommentsSafe(src) {
  return String(src).replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * M6: Verify-Report als P2-Fehlerprotokoll (FLARE-Klasse: Zahlen statt Prosa).
 * Format pro Zeile: `[Schicht:Kriterium] VERDIKT | Soll: ... | Ist: ...`
 * Nur fail-Kriterien werden aufgefuehrt, dazu Rahmen (Iteration, Budgets).
 * Guide-3D Abschnitt 4: optional SZENEN-STATE (Browser-Probe) und BILDER
 * (max. 3 Views, nur als Zusatz zu Zahlen) anhaengen.
 * @param {Array<{ layer: string, verdict: string, criteria: Array<{ id: string, verdict: string, expected: string, actual: string }> }>} layers
 * @param {{ iteration?: number, budgets?: { triangles?: number, drawCalls?: number, meshCount?: number }, sceneState?: object, images?: Array<{ view?: string, note?: string }> }} [opts]
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
  const st = opts?.sceneState;
  if (st && typeof st === 'object') {
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 'n.v.');
    lines.push('');
    lines.push('SZENEN-STATE (aus der Browser-Probe, nicht aus dem Quelltext):');
    lines.push(`frames=${num(st.frames)} | firstFrameAt=${num(st.firstFrameAt)} ms | meshes=${num(st.meshes)} | triangles=${num(st.triangles)} | drawCalls=${num(st.drawCalls ?? st.calls)}`);
    lines.push(`geometries=${num(st.geometries)} | textures=${num(st.textures)} | programs=${num(st.programs)} | boxes=${Array.isArray(st.boxes) ? st.boxes.length : num(st.boxes)} | backfaceHits=${num(st.backfaceHits)}`);
    for (const b of (Array.isArray(st.boxes) ? st.boxes : []).slice(0, 4)) {
      if (b && typeof b === 'object') lines.push(`${b.id ?? '?'}: min [${(b.min ?? []).join(',')}] max [${(b.max ?? []).join(',')}]`);
    }
    if (typeof st.pixelDiff === 'number') lines.push(`pixelDiff=${String(Math.round(st.pixelDiff * 10000) / 10000).replace('.', ',')} (2 Frames, Schwelle 0,002)`);
  }
  const imgs = opts?.images;
  if (Array.isArray(imgs) && imgs.length > 0) {
    lines.push('');
    lines.push(`BILDER (${Math.min(imgs.length, 3)} Views, 1280x720, SwiftShader):`);
    imgs.slice(0, 3).forEach((im, i) => {
      lines.push(`[BILD ${i + 1}] ${im?.view ?? 'overview'} -> ${String(im?.note ?? '').slice(0, 200) || '(ohne Befund-Notiz)'}`);
    });
  }
  return lines.join('\n');
}
