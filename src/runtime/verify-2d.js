/**
 * Verify-2D-Gates fuer alle fuenf 2D-Varianten (S2-light, Node-seitig,
 * deterministisch): parse + Typ-Whitelist + Semantik + Pixel + Layout + Form.
 *
 * Gate-Signale (gemessen, docs/2D-STACK-EVAL.md Abschnitt 3.3):
 * - svg: Vendor-Render wohlgeformt, >= 4 Shapes (starkes Pixel-Gate).
 * - mermaid: parseMermaid() wirft mit Zeile/Spalte (bestes Gate-Signal).
 * - chart: Typ-Whitelist + Pixel-Gate (Chart.js wirft NICHT — E-CHART-TYP).
 * - d3: node-not-found deterministisch; leerer Graph via Pixel-Gate.
 * - katex: throwOnError:true (Fehler werfen, nie als Span verstecken).
 *
 * Haertung (docs/2D-HAERTUNG.md): je Typ zusaetzliche Pruefschritte —
 * Semantik (S2-2d-semantik: Achsen/Labels/Einheiten/Legenden-Vollstaendigkeit,
 * meta/meta_i18n/meta_2d-Konsistenz) und Layout (S2-2d-layout:
 * Ueberlappungsfreiheit mit Mindestabstand, Kanten-Knoten-Regeln,
 * Norm-Mindestschrift). Kriterium-Ids sind variantenuebergreifend identisch,
 * damit Router, Player, verify-all und Tests eine Zeile pruefen.
 */
import { isTwoDSource } from './guard-static.js';
import {
  TWOD_KINDS,
  MERMAID_DIAGRAMS,
  CHART_KINDS,
  D3_KINDS,
  KATEX_KINDS,
} from './guard-static.js';
import { buildDiagramSvg, countSvgShapes, isWellformedSvg } from '../vendor/diagram-2d.js';
import { parseMermaid, buildMermaidSvg, countMermaidShapes } from '../vendor/mermaid-2d.js';
import { parseChartConfig, buildChartSvg, countChartShapes } from '../vendor/chart-2d.js';
import { parseGraph, buildGraphSvg, countGraphShapes } from '../vendor/d3-2d.js';
import { parseLatex, buildMathHtml, countMathShapes } from '../vendor/katex-2d.js';

/** Specifier je Variante (Importmap-Prinzip, vgl. guard-static.js). */
export const TWOD_VARIANT_SPEC = Object.freeze({
  svg: '2d-svg',
  mermaid: '2d-mermaid',
  chart: '2d-chart',
  d3: '2d-d3',
  katex: '2d-katex',
});

/** Daten-Literal je Variante (Modul liefert NUR Daten). */
export const TWOD_VARIANT_LITERAL = Object.freeze({
  svg: 'diagram',
  mermaid: 'mermaid',
  chart: 'chart',
  d3: 'graph',
  katex: 'formula',
});

/**
 * Erkennt die 2D-Variante aus dem Modul-Import.
 * @param {string} source
 * @returns {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex' | null}
 */
export function twoDVariantOf(source) {
  const code = String(source ?? '');
  const re = /(?:import\s+(?:[^'"]*?\sfrom\s+)?|export\s+[^'"]*?\sfrom\s+)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    for (const [variant, spec] of Object.entries(TWOD_VARIANT_SPEC)) {
      if (m[1] === spec) return /** @type {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex'} */ (variant);
    }
  }
  return null;
}

/**
 * Objektliteral hostseitig aus Modulquelle extrahieren (nur Tooling).
 * @param {string} source
 * @param {string} name
 * @returns {Record<string, unknown> | null}
 */
export function extractTwoDLiteral(source, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\{`);
  const m = re.exec(source);
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
 * @param {string} layer
 * @param {string} id
 * @param {'pass' | 'fail'} verdict
 * @param {string} expected
 * @param {string} actual
 */
function crit2d(layer, id, verdict, expected, actual) {
  return { id, verdict, expected: String(expected).slice(0, 400), actual: String(actual).slice(0, 400) };
}

function stripSvgCommentsSafe(src) {
  return String(src ?? '').replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * 2D-Gate-Dispatcher: parse + pixel + Typ-Whitelist je Variante.
 * @param {string} source Modulquelle
 */
export function verifyTwoDLayer(source) {
  const t0 = Date.now();
  const layer = { layer: 'S2', verdict: 'pass', criteria: [], durationMs: 0 };
  const src = String(source);
  try {
    const variant = twoDVariantOf(src);
    const is2d = isTwoDSource(src);
    layer.criteria.push(
      crit2d('S2', 'S2-2d-parse', is2d ? 'pass' : 'fail', '2D-Datenpfad (Import aus 2d-*)', is2d ? `2d-Import gefunden (${variant ?? '?'}, Lib im Vendor, Modul liefert Daten)` : 'kein 2d-Import (3D-Pfad oder Fremd-Import)')
    );
    if (!is2d || !variant) {
      layer.criteria.push(crit2d('S2', 'S2-2d-typ', 'fail', '2d-Variante erkannt', 'keine 2d-Variante'));
      layer.criteria.push(crit2d('S2', 'S2-2d-semantik', 'fail', 'Achsen/Labels/Einheiten/Legende vollstaendig', 'ohne Variante keine Pruefung'));
      layer.criteria.push(crit2d('S2', 'S2-2d-parse-svg', 'fail', 'Vendor-Render wohlgeformt', 'ohne Variante kein Render'));
      layer.criteria.push(crit2d('S2', 'S2-2d-pixel', 'fail', '>= 4 Formen (gerendert)', 'ohne Daten kein Render'));
      layer.criteria.push(crit2d('S2', 'S2-2d-layout', 'fail', 'ueberlappungsfrei, Mindestschrift, Kanten an Knoten', 'ohne Daten keine Pruefung'));
      layer.criteria.push(crit2d('S2', 'S2-2d-wellformed', 'fail', 'kein <script>, keine Fremd-URL im Modul', 'ohne Daten keine Pruefung'));
      layer.verdict = 'fail';
      layer.durationMs = Date.now() - t0;
      return { layer };
    }
    const literalName = TWOD_VARIANT_LITERAL[variant];
    const data = extractTwoDLiteral(src, literalName);
    if (!data) {
      layer.criteria.push(crit2d('S2', 'S2-2d-typ', 'fail', `export const ${literalName} {...}`, 'kein Daten-Literal extrahierbar'));
      layer.criteria.push(crit2d('S2', 'S2-2d-semantik', 'fail', 'Achsen/Labels/Einheiten/Legende vollstaendig', 'ohne Daten keine Pruefung'));
      layer.criteria.push(crit2d('S2', 'S2-2d-parse-svg', 'fail', 'Vendor-Render wohlgeformt', 'ohne Daten kein Render'));
      layer.criteria.push(crit2d('S2', 'S2-2d-pixel', 'fail', '>= 4 Formen (gerendert)', 'ohne Daten kein Render'));
      layer.criteria.push(crit2d('S2', 'S2-2d-layout', 'fail', 'ueberlappungsfrei, Mindestschrift, Kanten an Knoten', 'ohne Daten keine Pruefung'));
      layer.criteria.push(crit2d('S2', 'S2-2d-wellformed', 'fail', 'kein <script>, keine Fremd-URL im Modul', 'ohne Daten keine Pruefung'));
      layer.verdict = 'fail';
      layer.durationMs = Date.now() - t0;
      return { layer };
    }
    const gate = variantGate(variant, /** @type {any} */ (data));
    const clean = twoDSourceClean(src);
    const sem = verifyTwoDSemantics(variant, /** @type {any} */ (data), src);
    const lay = verifyTwoDLayout(variant, /** @type {any} */ (data));
    layer.criteria.push(
      crit2d('S2', 'S2-2d-typ', gate.typOk ? 'pass' : 'fail', gate.typExpected, gate.typActual),
      crit2d('S2', 'S2-2d-semantik', sem.ok ? 'pass' : 'fail', sem.expected, sem.actual),
      crit2d('S2', 'S2-2d-parse-svg', gate.renderOk ? 'pass' : 'fail', 'Vendor-Render wohlgeformt', gate.renderActual),
      crit2d('S2', 'S2-2d-pixel', gate.shapes >= 4 ? 'pass' : 'fail', '>= 4 Formen (gerendert)', `${gate.shapes} Formen im Vendor-Render`),
      crit2d('S2', 'S2-2d-layout', lay.ok ? 'pass' : 'fail', lay.expected, lay.actual),
      crit2d('S2', 'S2-2d-wellformed', clean.ok && gate.cleanOk ? 'pass' : 'fail', 'kein <script>, keine Fremd-URL im Modul', clean.ok ? gate.cleanActual : clean.actual),
    );
  } catch (e) {
    layer.criteria.push(
      crit2d('S2', 'S2-2d-intern', 'fail', '2D pruefbar', `Prueffehler: ${String((e && e.message) || e).slice(0, 160)}`)
    );
  }
  layer.verdict = layer.criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail';
  layer.durationMs = Date.now() - t0;
  return { layer };
}

/**
 * Varianten-Gate: rendert strikt (Fehler = fail, nie werfen).
 * @param {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex'} variant
 * @param {any} data
 */
function variantGate(variant, data) {
  const bad = (typExpected, typActual, renderActual, shapes, cleanActual) => ({
    typOk: false, typExpected, typActual, renderOk: false, renderActual, shapes, cleanOk: false, cleanActual,
  });
  try {
    if (variant === 'svg') {
      const kind = typeof data.kind === 'string' ? data.kind : null;
      if (kind === null || !TWOD_KINDS.includes(kind)) {
        return bad(`diagram.kind in [${TWOD_KINDS.join('|')}]`, kind === null ? 'kein kind gefunden' : `${kind} NICHT erlaubt`, 'kein Render (Typ falsch)', 0, 'nicht geprueft');
      }
      const svg = buildDiagramSvg(data);
      const well = isWellformedSvg(svg);
      return {
        typOk: true, typExpected: `diagram.kind in [${TWOD_KINDS.join('|')}]`, typActual: `${kind} erlaubt`,
        renderOk: well, renderActual: well ? `${svg.length} Zeichen SVG` : 'Render unwohlgeformt/abgebrochen',
        shapes: countSvgShapes(svg), cleanOk: true, cleanActual: 'sauber',
      };
    }
    if (variant === 'mermaid') {
      const kind = typeof data.diagram === 'string' ? data.diagram : null;
      if (kind === null || !MERMAID_DIAGRAMS.includes(kind)) {
        return bad(`mermaid.diagram in [${MERMAID_DIAGRAMS.join('|')}]`, kind === null ? 'kein diagram gefunden' : `${kind} NICHT erlaubt`, 'kein Render (Typ falsch)', 0, 'nicht geprueft');
      }
      const parsed = parseMermaid(data.source ?? '');
      if (parsed.diagram !== kind) {
        return bad(`Quelle passt zu diagram "${kind}"`, `Quelle ist "${parsed.diagram}"`, 'kein Render (Typ/Quelle mismatch)', 0, 'nicht geprueft');
      }
      const svg = buildMermaidSvg(data);
      return {
        typOk: true, typExpected: `mermaid.diagram in [${MERMAID_DIAGRAMS.join('|')}]`, typActual: `${kind} erlaubt (${parsed.nodes.length} Knoten, ${parsed.edges.length} Kanten)`,
        renderOk: true, renderActual: `${svg.length} Zeichen SVG`,
        shapes: countMermaidShapes(svg), cleanOk: true, cleanActual: 'sauber',
      };
    }
    if (variant === 'chart') {
      const kind = typeof data.kind === 'string' ? data.kind : null;
      if (kind === null || !CHART_KINDS.includes(kind)) {
        return bad(`chart.kind in [${CHART_KINDS.join('|')}]`, kind === null ? 'kein kind gefunden' : `${kind} NICHT erlaubt`, 'kein Render (Typ falsch)', 0, 'nicht geprueft');
      }
      const cfg = parseChartConfig(data);
      const svg = buildChartSvg(data);
      return {
        typOk: true, typExpected: `chart.kind in [${CHART_KINDS.join('|')}]`, typActual: `${kind} erlaubt (Canvas-Typ ${cfg.type}, ${cfg.values.length} Werte)`,
        renderOk: true, renderActual: `${svg.length} Zeichen SVG-Vorschau`,
        shapes: countChartShapes(svg), cleanOk: true, cleanActual: 'sauber',
      };
    }
    if (variant === 'd3') {
      const kind = typeof data.kind === 'string' ? data.kind : null;
      if (kind === null || !D3_KINDS.includes(kind)) {
        return bad(`graph.kind in [${D3_KINDS.join('|')}]`, kind === null ? 'kein kind gefunden' : `${kind} NICHT erlaubt`, 'kein Render (Typ falsch)', 0, 'nicht geprueft');
      }
      const g = parseGraph(data);
      const svg = buildGraphSvg(data);
      return {
        typOk: true, typExpected: `graph.kind in [${D3_KINDS.join('|')}]`, typActual: `${kind} erlaubt (${g.nodes.length} Knoten, ${g.edges.length} Kanten)`,
        renderOk: true, renderActual: `${svg.length} Zeichen SVG`,
        shapes: countGraphShapes(svg), cleanOk: true, cleanActual: 'sauber',
      };
    }
    // katex
    const kind = typeof data.kind === 'string' ? data.kind : null;
    if (kind === null || !KATEX_KINDS.includes(kind)) {
      return bad(`formula.kind in [${KATEX_KINDS.join('|')}]`, kind === null ? 'kein kind gefunden' : `${kind} NICHT erlaubt`, 'kein Render (Typ falsch)', 0, 'nicht geprueft');
    }
    parseLatex(data.tex ?? '');
    const html = buildMathHtml(data);
    if (/<span class="katex-error"/.test(html)) {
      return bad(`formula.kind in [${KATEX_KINDS.join('|')}]`, `${kind} erlaubt`, 'katex-error-Span (throwOnError:false verboten)', 0, 'nicht geprueft');
    }
    return {
      typOk: true, typExpected: `formula.kind in [${KATEX_KINDS.join('|')}]`, typActual: `${kind} erlaubt (throwOnError:true)`,
      renderOk: true, renderActual: `${html.length} Zeichen HTML`,
      shapes: countMathShapes(html), cleanOk: true, cleanActual: 'sauber',
    };
  } catch (e) {
    return {
      typOk: true, typExpected: 'Variante erkannt', typActual: 'Variante erkannt',
      renderOk: false, renderActual: `Render abgebrochen: ${String((e && e.message) || e).slice(0, 160)}`,
      shapes: 0, cleanOk: true, cleanActual: 'sauber',
    };
  }
}

/**
 * S4-light: Formenzahl je Variante (Budget: <= 800 SVG-Knoten).
 * @param {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex'} variant
 * @param {any} data
 */
export function countTwoDShapes(variant, data) {
  try {
    if (variant === 'svg') return countSvgShapes(buildDiagramSvg(data ?? {}));
    if (variant === 'mermaid') return countMermaidShapes(buildMermaidSvg(data ?? {}));
    if (variant === 'chart') return countChartShapes(buildChartSvg(data ?? {}));
    if (variant === 'd3') return countGraphShapes(buildGraphSvg(data ?? {}));
    return countMathShapes(buildMathHtml(data ?? {}));
  } catch {
    return -1;
  }
}

/**
 * Modulquellen-Sauberkeit (kein <script>, keine Fremd-URL ausserhalb von
 * Kommentaren/Strings ist bereits S1 — hier zusaetzlich Literal-Scan).
 * @param {string} source
 */
export function twoDSourceClean(source) {
  const src = String(source ?? '');
  const badScript = /<script[\s>]/.test(src);
  const badUrl = /(https?:|javascript:)/.test(stripSvgCommentsSafe(src));
  if (badScript) return { ok: false, actual: '<script> gefunden' };
  if (badUrl) return { ok: false, actual: 'Fremd-URL gefunden' };
  return { ok: true, actual: 'sauber' };
}

/* ------------------------------------------------------------------ *
 * Haertung: Semantik + Layout je 2D-Typ (docs/2D-HAERTUNG.md).        *
 * ------------------------------------------------------------------ */

/** Normwerte der 2D-Haertung (fuer P1-Prompts und Gates verbindlich). */
export const TWOD_NORM = Object.freeze({
  /** Norm-Mindestschrift: kein Text unter 10 px (Schul-Lesbarkeit). */
  minFontPx: 10,
  /** Mindestabstand zwischen Knoten-Boxen (Ueberlappungsfreiheit). */
  minGapPx: 8,
  /** Kantentoleranz: Pfeilende muss so nah am Knoten liegen. */
  edgeSnapPx: 18,
  /** Knoten-Obergrenze je Diagramm (Lesbarkeit, Schulfall). */
  maxNodes: 12,
  /** Formel-Obergrenze (Schulformel, kein Aufsatz). */
  maxTexLen: 400,
});

/** Erlaubte Einheiten-Tokens in measurement (Zahl + Einheit Pflicht). */
const MEASURE_UNIT_RE = /(mm|cm|1\/min|°C|kB|MB|HE|GHz|MHz|min\b|ms\b|bar|mol|px|km|ml|Hz|\bm\b|\bh\b|\bs\b|\bg\b|kg\b|V\b|A\b|W\b|N\b|J\b|\bl\b|K\b|%)/;

/**
 * @param {unknown} v
 * @returns {boolean} true, wenn measurement Zahl + Einheit traegt
 */
export function hasMeasureUnit(v) {
  const s = String(v ?? '');
  return /\d/.test(s) && MEASURE_UNIT_RE.test(s);
}

/** Umlaute falten fuer Legenden-Abgleich (oe-Variante == ö-Variante). */
function foldLabel(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Semantik-Gate je Typ: Achsen/Labels/Einheiten/Legenden-Vollstaendigkeit
 * plus meta/meta_i18n/meta_2d-Konsistenz (Legende == parts).
 * Wirft nie — Fehler werden als { ok:false, ... } zurueckgegeben.
 * @param {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex'} variant
 * @param {any} data Datenliteral der Variante
 * @param {string} source Modulquelle (fuer meta/meta_i18n/meta_2d)
 */
export function verifyTwoDSemantics(variant, data, source) {
  const expected = 'Achsen/Labels/Einheiten/Legende vollstaendig, meta konsistent';
  const fail = (actual) => ({ ok: false, expected, actual: String(actual).slice(0, 200) });
  try {
    const d = (data && typeof data === 'object') ? data : {};
    const meta = extractTwoDLiteral(String(source ?? ''), 'meta');
    const m18 = extractTwoDLiteral(String(source ?? ''), 'meta_i18n');
    const m2d = extractTwoDLiteral(String(source ?? ''), 'meta_2d');
    if (!meta || typeof meta !== 'object') return fail('kein export const meta {...}');
    const parts = Array.isArray(meta.parts) ? meta.parts.map((x) => String(x)) : [];
    if (typeof meta.title !== 'string' || meta.title.trim().length < 3) return fail('meta.title fehlt/zu kurz');
    if (meta.detailLevel !== 2) return fail(`meta.detailLevel ${String(meta.detailLevel)} (Soll 2)`);
    if (parts.length < 3 || parts.length > 8) return fail(`${parts.length} meta.parts (Soll 3..8)`);
    if (meta.units !== 'm') return fail(`meta.units ${String(meta.units)} (Soll "m")`);
    if (!m18 || typeof m18 !== 'object' || !m18.en || !m18.es) return fail('meta_i18n en/es fehlt');
    // FR (31.10.2026): optional, aber streng-wenn-vorhanden (Laengen-Deckung).
    for (const lang of ['en', 'es']) {
      const lp = Array.isArray(m18[lang]?.parts) ? m18[lang].parts : [];
      if (lp.length !== parts.length) return fail(`meta_i18n.${lang}.parts ${lp.length} != ${parts.length}`);
    }
    if (m18.fr !== undefined) {
      const lp = Array.isArray(m18.fr?.parts) ? m18.fr.parts : [];
      if (lp.length !== parts.length) return fail(`meta_i18n.fr.parts ${lp.length} != ${parts.length}`);
    }
    const labels = Array.isArray(d.labels) ? d.labels.map((x) => String(x)) : [];
    if (labels.length < 3 || labels.length > 8) return fail(`${labels.length} labels (Soll 3..8)`);
    if (labels.some((l) => l.trim().length < 2)) return fail('leeres/kurzes Label (< 2 Zeichen)');
    if (new Set(labels.map((l) => foldLabel(l))).size !== labels.length) return fail('doppelte Labels');
    if (JSON.stringify(labels) !== JSON.stringify(parts)) return fail('labels != meta.parts (Legende)');
    if (typeof d.title !== 'string' || d.title.trim().length < 3) return fail('title fehlt/zu kurz');
    if (!hasMeasureUnit(d.measurement)) return fail('measurement ohne Zahl+Einheit');
    if (!m2d || typeof m2d !== 'object' || m2d.version !== 1) return fail('meta_2d { kind, version: 1 } fehlt');

    if (variant === 'svg') {
      if (m2d.kind !== d.kind) return fail(`meta_2d.kind ${String(m2d.kind)} != diagram.kind`);
      if (d.kind === 'bars') {
        const vals = Array.isArray(d.values) ? d.values : [];
        if (vals.length < 1 || vals.length > 6 || vals.some((v) => !Number.isFinite(Number(v)))) {
          return fail('bars: values 1..6 Zahlen noetig');
        }
      }
      return { ok: true, expected, actual: `${labels.length} Labels == parts, Einheit ok` };
    }
    if (variant === 'mermaid') {
      if (m2d.kind !== d.diagram) return fail(`meta_2d.kind ${String(m2d.kind)} != mermaid.diagram`);
      let parsed;
      try {
        parsed = parseMermaid(d.source ?? '');
      } catch (e) {
        return fail(`Quelle unparsbar: ${String((e && e.message) || e).slice(0, 100)}`);
      }
      if (parsed.nodes.length < 2 || parsed.nodes.length > TWOD_NORM.maxNodes) {
        return fail(`${parsed.nodes.length} Knoten (Soll 2..${TWOD_NORM.maxNodes})`);
      }
      if (parsed.diagram !== 'gantt' && parsed.edges.length < 1) return fail('keine Kante (Zusammenhang fehlt)');
      const nodeNames = parsed.nodes.map((n) => foldLabel(n.label));
      for (const lab of labels) {
        const f = foldLabel(lab);
        const covered = nodeNames.some((n) => n.includes(f) || (f !== '' && n !== '' && f.includes(n)));
        if (!covered) return fail(`Label "${lab}" in keinem Knoten`);
      }
      return { ok: true, expected, actual: `${parsed.nodes.length} Knoten, ${parsed.edges.length} Kanten, ${labels.length} Labels abgedeckt` };
    }
    if (variant === 'chart') {
      if (m2d.kind !== d.kind) return fail(`meta_2d.kind ${String(m2d.kind)} != chart.kind`);
      let cfg;
      try {
        cfg = parseChartConfig(d);
      } catch (e) {
        return fail(`Chart-Config: ${String((e && e.message) || e).slice(0, 100)}`);
      }
      const minVals = cfg.type === 'pie' ? 2 : 3;
      if (cfg.labels.length !== cfg.values.length) return fail('labels.length != values.length (Achsen)');
      if (cfg.values.length < minVals || cfg.values.length > 6) return fail(`${cfg.values.length} Werte (Soll ${minVals}..6)`);
      if (cfg.values.some((v) => !(v >= 0))) return fail('negative Werte (Schulvergleich >= 0)');
      if (cfg.type !== 'pie' && new Set(cfg.values).size < 2) return fail('alle Werte gleich (kein Vergleich)');
      if (typeof d.unit !== 'string' || d.unit.trim() === '' || d.unit.length > 8) {
        return fail('unit fehlt/leer/zu lang (Achsen-Einheit, max. 8 Zeichen)');
      }
      return { ok: true, expected, actual: `${cfg.labels.length} Kategorien, ${cfg.values.length} Werte, Einheit "${cfg.unit}"` };
    }
    if (variant === 'd3') {
      if (m2d.kind !== d.kind) return fail(`meta_2d.kind ${String(m2d.kind)} != graph.kind`);
      let g;
      try {
        g = parseGraph(d);
      } catch (e) {
        return fail(`Graph: ${String((e && e.message) || e).slice(0, 100)}`);
      }
      if (g.nodes.length < 3 || g.nodes.length > TWOD_NORM.maxNodes) {
        return fail(`${g.nodes.length} Knoten (Soll 3..${TWOD_NORM.maxNodes})`);
      }
      for (const e of g.edges) {
        if (e.from === e.to) return fail(`Selbstkante ${e.from}`);
      }
      const seenE = new Set();
      for (const e of g.edges) {
        const k = `${e.from}→${e.to}`;
        if (seenE.has(k)) return fail(`Doppelkante ${k}`);
        seenE.add(k);
      }
      const adj = new Map(g.nodes.map((n) => [n.id, []]));
      for (const e of g.edges) {
        adj.get(e.from).push(e.to);
        adj.get(e.to).push(e.from);
      }
      const got = new Set([g.nodes[0].id]);
      const queue = [g.nodes[0].id];
      while (queue.length > 0) {
        const cur = queue.pop();
        for (const nb of adj.get(cur) ?? []) {
          if (!got.has(nb)) {
            got.add(nb);
            queue.push(nb);
          }
        }
      }
      if (got.size !== g.nodes.length) return fail('Graph unzusammenhaengend (isolierte Knoten)');
      const nodeSet = [...new Set(g.nodes.map((n) => foldLabel(n.label)))].sort().join('|');
      const labSet = [...new Set(labels.map(foldLabel))].sort().join('|');
      if (nodeSet !== labSet) return fail('Knoten-Labels != Legende');
      return { ok: true, expected, actual: `${g.nodes.length} Knoten, ${g.edges.length} Kanten, zusammenhaengend` };
    }
    // katex
    if (m2d.kind !== d.kind) return fail(`meta_2d.kind ${String(m2d.kind)} != formula.kind`);
    const tex = String(d.tex ?? '');
    if (tex.trim().length < 3 || tex.length > TWOD_NORM.maxTexLen) {
      return fail(`tex-Laenge ${tex.length} (Soll 3..${TWOD_NORM.maxTexLen})`);
    }
    if (!tex.includes('=') && !tex.includes('\\')) return fail('tex ohne Formelzeichen (= oder Befehl)');
    try {
      parseLatex(tex);
    } catch (e) {
      return fail(`LaTeX: ${String((e && e.message) || e).slice(0, 100)}`);
    }
    return { ok: true, expected, actual: `Formel ${tex.length} Zeichen, ${labels.length} Labels, Einheit ok` };
  } catch (e) {
    return fail(`Prueffehler: ${String((e && e.message) || e).slice(0, 100)}`);
  }
}

/** @param {{ x0: number, y0: number, x1: number, y1: number }} a @param {{ x0: number, y0: number, x1: number, y1: number }} b @param {number} pad */
function boxesOverlap(a, b, pad) {
  return a.x0 - pad < b.x1 + pad && b.x0 - pad < a.x1 + pad && a.y0 - pad < b.y1 + pad && b.y0 - pad < a.y1 + pad;
}

/** Attribut aus SVG-Tag lesen (exakter Name, kein stroke-width-Fehlgriff). */
function svgAttr(tag, name) {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/** Knoten-Boxen aus SVG: Rechtecke/Kreise/Rauten (Hintergrund/Deko raus). */
function svgNodeBoxes(svg) {
  const boxes = [];
  for (const m of String(svg ?? '').matchAll(/<rect\b[^>]*>/g)) {
    const t = m[0];
    const bx = Number(svgAttr(t, 'x') ?? '0');
    const by = Number(svgAttr(t, 'y') ?? '0');
    const w = Number(svgAttr(t, 'width') ?? '0');
    const h = Number(svgAttr(t, 'height') ?? '0');
    const fill = (svgAttr(t, 'fill') ?? '').toLowerCase();
    if (!(w > 0 && h > 0)) continue;
    if (fill === '#ffffff' || (w >= 600 && h >= 300)) continue; // Hintergrund
    boxes.push({ x0: bx, y0: by, x1: bx + w, y1: by + h, what: `rect@${bx},${by}` });
  }
  for (const m of String(svg ?? '').matchAll(/<circle\b[^>]*>/g)) {
    const t = m[0];
    const r = Number(svgAttr(t, 'r') ?? '0');
    if (!(r >= 15)) continue; // Deko-Punkte raus
    const cx = Number(svgAttr(t, 'cx') ?? '0');
    const cy = Number(svgAttr(t, 'cy') ?? '0');
    boxes.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, what: `kreis@${cx},${cy}` });
  }
  for (const m of String(svg ?? '').matchAll(/<polygon\b[^>]*>/g)) {
    const pts = (svgAttr(m[0], 'points') ?? '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    if (pts.length < 6) continue;
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    if ((x1 - x0) < 40 || (y1 - y0) < 24) continue; // Pfeilspitzen/Deko raus
    boxes.push({ x0, y0, x1, y1, what: `raute@${x0},${y0}` });
  }
  return boxes;
}

/** Texte aus SVG mit Schaetz-Box (fuer Ueberlappungs- und Schrift-Check). */
function svgTextInfos(svg) {
  const out = [];
  for (const m of String(svg ?? '').matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const tag = m[1];
    const content = m[2];
    const fs = Number((/font-size="([\d.]+)"/.exec(tag)?.[1]) ?? '12');
    const x = Number(svgAttr(tag, 'x') ?? '0');
    const y = Number(svgAttr(tag, 'y') ?? '0');
    const anchor = svgAttr(tag, 'text-anchor') ?? 'start';
    const w = content.length * 0.62 * fs;
    const h = fs * 1.25;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    out.push({ x0, y0: y - fs, x1: x0 + w, y1: y + fs * 0.25, fs, text: content.slice(0, 40), cx: x, cy: y });
  }
  return out;
}

/** Kanten (Pfeillinien) aus SVG mit Endpunkten. */
function svgEdgeLines(svg) {
  const out = [];
  for (const m of String(svg ?? '').matchAll(/<line\b[^>]*>/g)) {
    const t = m[0];
    if (!/marker-end/.test(t)) continue;
    out.push({
      x1: Number(svgAttr(t, 'x1') ?? '0'),
      y1: Number(svgAttr(t, 'y1') ?? '0'),
      x2: Number(svgAttr(t, 'x2') ?? '0'),
      y2: Number(svgAttr(t, 'y2') ?? '0'),
    });
  }
  return out;
}

/**
 * Layout-Gate je Typ: Norm-Mindestschrift, Ueberlappungsfreiheit
 * (Knoten-Mindestabstand), Kanten-Knoten-Regeln, Achsen-Regeln (chart).
 * Baut das Vendor-SVG/HTML selbst (deterministisch, Node-seitig).
 * Wirft nie — Fehler werden als { ok:false, ... } zurueckgegeben.
 * @param {'svg' | 'mermaid' | 'chart' | 'd3' | 'katex'} variant
 * @param {any} data Datenliteral der Variante
 */
export function verifyTwoDLayout(variant, data) {
  const expected = `schrift>=${TWOD_NORM.minFontPx}px, knotenabstand>=${TWOD_NORM.minGapPx}px, kanten an knoten`;
  const fail = (actual) => ({ ok: false, expected, actual: String(actual).slice(0, 200) });
  try {
    const d = (data && typeof data === 'object') ? data : {};
    if (variant === 'katex') {
      const html = buildMathHtml(d);
      if (/<span class="katex-error"/.test(html)) return fail('katex-error-Span (throwOnError:false verboten)');
      const sizes = [...html.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
      const small = sizes.filter((s) => Number.isFinite(s) && s < TWOD_NORM.minFontPx);
      if (small.length > 0) return fail(`Mindestschrift: ${Math.min(...small)}px < ${TWOD_NORM.minFontPx}px`);
      const chips = (html.match(/class="katex-label"/g) ?? []).length;
      const labels = Array.isArray(d.labels) ? d.labels.length : 0;
      if (chips !== Math.min(labels, 6)) return fail(`Legenden-Chips ${chips} != ${labels} Labels`);
      return { ok: true, expected, actual: `schrift ok, ${chips} Legenden-Chips, kein katex-error` };
    }
    const svg = variant === 'svg' ? buildDiagramSvg(d)
      : variant === 'mermaid' ? buildMermaidSvg(d)
      : variant === 'chart' ? buildChartSvg(d)
      : buildGraphSvg(d);
    const texts = svgTextInfos(svg);
    for (const t of texts) {
      if (!(t.fs >= TWOD_NORM.minFontPx)) return fail(`Mindestschrift: "${t.text}" ${t.fs}px < ${TWOD_NORM.minFontPx}px`);
    }
    const nodes = svgNodeBoxes(svg);
    const half = TWOD_NORM.minGapPx / 2;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (boxesOverlap(nodes[i], nodes[j], half)) {
          return fail(`Knoten-Ueberlappung: ${nodes[i].what} vs ${nodes[j].what} (min. ${TWOD_NORM.minGapPx}px)`);
        }
      }
    }
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        if (boxesOverlap(texts[i], texts[j], 1)) {
          return fail(`Text-Ueberlappung: "${texts[i].text}" vs "${texts[j].text}"`);
        }
      }
    }
    if (variant === 'chart') {
      const cfg = parseChartConfig(d);
      if (cfg.type !== 'pie') {
        const axes = [...svg.matchAll(/<line\b[^>]*>/g)].map((m) => m[0]);
        const long = axes.filter((t) => {
          const x1 = Number(svgAttr(t, 'x1') ?? '0');
          const x2 = Number(svgAttr(t, 'x2') ?? '0');
          const y1 = Number(svgAttr(t, 'y1') ?? '0');
          const y2 = Number(svgAttr(t, 'y2') ?? '0');
          return y1 === y2 && (x2 - x1) >= 300;
        });
        if (long.length < 1) return fail('keine horizontalen Achse (>= 300px)');
        const ticks = texts.filter((t) => /^-?\d+$/.test(t.text.trim())).length;
        if (ticks < 3) return fail(`nur ${ticks} Achsen-Ticks (Soll >= 3)`);
        for (const v of cfg.values) {
          if (!svg.includes(String(v))) return fail(`Wert ${v} nicht beschriftet`);
        }
      } else {
        for (const lab of cfg.labels) {
          if (!svg.includes(String(lab).slice(0, 16))) return fail(`Segment "${lab}" nicht beschriftet`);
        }
      }
      return { ok: true, expected, actual: `schrift ok, ${nodes.length} knotenabstand ok, achsen ok` };
    }
    const skipEdges = variant === 'mermaid' && (() => {
      try {
        return parseMermaid(d.source ?? '').diagram === 'sequenz';
      } catch {
        return true;
      }
    })();
    if (!skipEdges) {
      const edges = svgEdgeLines(svg);
      for (const e of edges) {
        for (const [px, py, end] of [[e.x1, e.y1, 'start'], [e.x2, e.y2, 'ende']]) {
          const near = nodes.some((b) => (
            px >= b.x0 - TWOD_NORM.edgeSnapPx && px <= b.x1 + TWOD_NORM.edgeSnapPx
            && py >= b.y0 - TWOD_NORM.edgeSnapPx && py <= b.y1 + TWOD_NORM.edgeSnapPx
          ));
          if (!near && nodes.length > 0) return fail(`Kante ${end} (${px},${py}) trifft keinen Knoten`);
        }
      }
    }
    return { ok: true, expected, actual: `schrift ok, ${nodes.length} knotenabstand ok, kanten ok` };
  } catch (e) {
    return fail(`Prueffehler: ${String((e && e.message) || e).slice(0, 100)}`);
  }
}
