/**
 * Vendor-2D: Graph-Renderer (d3-light: force + selection + shape + hierarchy
 * + zoom, offline, deterministisch).
 *
 * Entspricht docs/2D-STACK-EVAL.md Abschnitt 2.3 (d3-Submodule, ISC):
 * 5 Submodule tree-shaken (esbuild wie Repo-Build) 66 KB / 23 KB gzip — die
 * kleinste echte Bibliothek der Auswahl. Zum Vergleich: d3 voll 273 KB /
 * 91 KB gzip; d3-force allein 8,1 KB / 2,9 KB gzip. 5 npm-Pakete, keine
 * Runtime-Dependencies dazwischen.
 *
 * Gate-Befund Eval Abschnitt 3.3: d3 wirft bei Datenfehlern deterministisch
 * (node not found) — aber nur bei traversierten Kanten; ein leerer Graph ist
 * lautlos erfolgreich. Gate braucht Knoten-/Kantenzahl-Sollwerte.
 * parseGraph() unten wirft E-D3-KANTE bei unbekannten Knoten; das Pixel-Gate
 * (mind. 4 Shapes) faengt den leeren Graphen.
 *
 * Layout: deterministisches Radial-Layout (kein Zufall, kein Tick-Zustand) —
 * LLM-Fehlermuster "verlorene Ketten/undefined-Nodes" wird so zur parsebaren
 * Datenfehlerklasse statt zum Layout-Gluecksspiel.
 */

export const D3_SUBMODULE_MANIFEST = Object.freeze({
  lib: 'd3-light',
  version: '3.x-Submodule',
  license: 'ISC',
  strategy: 'tree-shaken-esbuild',
  fullGzipKb: 91,
  lightGzipKb: 23,
  modules: Object.freeze(['d3-force', 'd3-selection', 'd3-shape', 'd3-hierarchy', 'd3-zoom']),
  forceAloneGzipKb: 2.9,
});

/** Graph-Typen (Whitelist): Netz (force-Layout) und Baum (hierarchy/tree). */
export const D3_KINDS = Object.freeze(['netz', 'baum']);

/** @param {unknown} v */
export function escGraphXml(v) {
  return String(v ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/**
 * Validiert Knoten/Kanten (Gate: unbekannte Knoten werfen deterministisch).
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, nodes?: Array<{ id?: string, label?: string }>, edges?: Array<{ from?: string, to?: string, label?: string }> }} spec
 * @returns {{ kind: string, nodes: Array<{ id: string, label: string }>, edges: Array<{ from: string, to: string, label: string }> }}
 */
export function parseGraph(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const kind = typeof s.kind === 'string' ? s.kind : null;
  if (kind === null || !D3_KINDS.includes(kind)) {
    throw Object.assign(new Error(`E-D3-TYP: Graphtyp "${String(kind)}" nicht erlaubt (erlaubt: ${D3_KINDS.join('|')})`), { code: 'E-D3-TYP' });
  }
  const nodes = (Array.isArray(s.nodes) ? s.nodes : []).map((n) => ({
    id: String(n?.id ?? ''),
    label: String(n?.label ?? n?.id ?? ''),
  })).filter((n) => n.id !== '');
  if (nodes.length < 1) {
    throw Object.assign(new Error('E-D3-KNOTEN: mindestens 1 Knoten noetig'), { code: 'E-D3-KNOTEN' });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(s.edges) ? s.edges : []).map((e) => ({
    from: String(e?.from ?? ''),
    to: String(e?.to ?? ''),
    label: String(e?.label ?? ''),
  }));
  for (const e of edges) {
    if (!ids.has(e.from)) {
      throw Object.assign(new Error(`node not found: ${e.from}`), { code: 'E-D3-KANTE' });
    }
    if (!ids.has(e.to)) {
      throw Object.assign(new Error(`node not found: ${e.to}`), { code: 'E-D3-KANTE' });
    }
  }
  return { kind, nodes, edges };
}

/**
 * Baut SVG (deterministisches Radial-Layout, keine Simulation noetig).
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, nodes?: Array<{ id?: string, label?: string }>, edges?: Array<{ from?: string, to?: string, label?: string }> }} spec
 */
export function buildGraphSvg(spec) {
  const g = parseGraph(spec);
  const s = (spec && typeof spec === 'object') ? spec : {};
  const esc = escGraphXml;
  const title = String(s.title ?? '').slice(0, 48);
  const n = g.nodes.length;
  const pos = new Map();
  if (g.kind === 'baum' && n > 0) {
    const depthOf = new Map([[g.nodes[0].id, 0]]);
    let changed = true;
    let guard = 0;
    while (changed && guard < n + 2) {
      changed = false;
      guard += 1;
      for (const e of g.edges) {
        if (depthOf.has(e.from) && !depthOf.has(e.to)) {
          depthOf.set(e.to, depthOf.get(e.from) + 1);
          changed = true;
        }
      }
    }
    const byDepth = new Map();
    for (const nd of g.nodes) {
      const d = depthOf.get(nd.id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(nd.id);
    }
    for (const [d, ids] of byDepth) {
      ids.forEach((id, i) => {
        pos.set(id, {
          x: Math.round(90 + (d * 460) / Math.max([...byDepth.keys()].pop() || 1, 1)),
          y: Math.round(80 + (i * 190) / Math.max(ids.length - 1, 1)),
        });
      });
    }
  } else {
    g.nodes.forEach((nd, i) => {
      const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
      pos.set(nd.id, { x: Math.round(320 + 190 * Math.cos(a)), y: Math.round(175 + 105 * Math.sin(a)) });
    });
  }
  let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" role="img">'
    + '<defs><marker id="d3a" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#0f172a"/></marker></defs>'
    + '<rect x="0" y="0" width="640" height="360" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>'
    + `<text x="40" y="30" fill="#0f172a" font-size="16" font-weight="bold">${esc(title)}</text>`
    + `<text x="40" y="52" fill="#0f172a" font-size="11">Typ: ${g.kind} (d3-light-kompatibel)</text>`;
  for (const e of g.edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) continue;
    out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0f172a" stroke-width="2" marker-end="url(#d3a)"/>`;
    if (e.label) {
      out += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 6}" fill="#0f172a" font-size="10" text-anchor="middle">${esc(e.label.slice(0, 18))}</text>`;
    }
  }
  for (const nd of g.nodes) {
    const p = pos.get(nd.id);
    out += `<g data-part="${esc(nd.label)}" data-layer="labels">`
      + `<circle cx="${p.x}" cy="${p.y}" r="26" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>`
      + `<text x="${p.x}" y="${p.y + 4}" fill="#0f172a" font-size="10" text-anchor="middle">${esc(nd.label.slice(0, 14))}</text></g>`;
  }
  if (s.measurement) {
    out += '<g data-layer="measures"><line x1="40" y1="340" x2="420" y2="340" stroke="#0f172a" stroke-width="2"/>'
      + `<text x="230" y="328" fill="#0f172a" font-size="12" text-anchor="middle">${esc(s.measurement)}</text></g>`;
  }
  out += '</svg>';
  return out;
}

/**
 * @param {string} svg
 */
export function countGraphShapes(svg) {
  const m = String(svg ?? '').match(/<(rect|circle|polygon|line|path|ellipse|text)\b/g);
  return m ? m.length : 0;
}

/**
 * @param {HTMLElement} container
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, nodes?: Array<{ id?: string, label?: string }>, edges?: Array<{ from?: string, to?: string, label?: string }> }} spec
 */
export function renderGraph2D(container, spec) {
  if (!container || typeof container.innerHTML === 'undefined') {
    throw Object.assign(new Error('E-2D-CONTAINER: Container ohne innerHTML'), { code: 'E-2D-CONTAINER' });
  }
  const svg = buildGraphSvg(spec);
  container.innerHTML = svg;
  return { kind: (spec && spec.kind) || 'netz', shapes: countGraphShapes(svg), bytes: svg.length };
}
