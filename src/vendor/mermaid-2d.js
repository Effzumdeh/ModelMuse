/**
 * Vendor-2D: Mermaid-Flussdiagramm-Renderer (Diagramm-Chunks, lazy, offline).
 *
 * Entspricht docs/2D-STACK-EVAL.md Abschnitt 2.1 (Mermaid 12.2.0, MIT):
 * Voll-Bundle 5 366 KB min / 1 542 KB gzip. Loesung: Diagramm-Chunk-Selektion
 * ueber den ESM-Build dist/chunks/mermaid.esm.min/ (104 Chunks, 1 537 KB gzip
 * gesamt). Nur Kern (47 Kern-Chunks, 508 KB gzip) + die vier benoetigten
 * Diagrammtypen werden geladen:
 *
 * MERMAID_CHUNK_MANIFEST unten: Kern 508 KB + flow 0,3 KB + sequence 31,2 KB
 * + er 10,4 KB + gantt 17,0 KB = 567 KB gzip statt 1 542 KB (Faktor 2,7).
 *
 * Laufzeit-Renderer hier: dependency-frei, 0 externe Bytes, kein Netz, kein
 * WASM. Er parst die vier Chunk-Typen (flow/sequenz/er/gantt) als Text-DSL
 * (LLM-Eignung hoch, MermaidSeqBench Qwen 2.5-7B 82,45) und rendert SVG.
 * Gate: parseMermaid() wirft deterministisch mit Zeile/Spalte (billig
 * validierbar, Parse 8-11 ms vs. Render 179 ms); Fehlerklassen getrennt:
 * UnknownDiagramError / Lexical error / Invalid date (vgl. Eval Abschnitt 3.3).
 *
 * Swap-in: Fuer das echte Mermaid-ESM die Importmap um
 * "mermaid": "./vendor-real/mermaid.esm.min.mjs" ergaenzen und die Chunks
 * aus MERMAID_CHUNK_MANIFEST daneben ablegen; das Datenformat
 * ({ diagram, title, labels, measurement, source }) bleibt unveraendert.
 */

export const MERMAID_CHUNK_MANIFEST = Object.freeze({
  lib: 'mermaid',
  version: '12.2.0',
  license: 'MIT',
  strategy: 'esm-chunk-selection',
  fullUmdGzipKb: 1542,
  coreChunks: 47,
  coreGzipKb: 508,
  diagramChunks: Object.freeze([
    { diagram: 'fluss', chunk: 'flowDiagram', extraGzipKb: 0.3 },
    { diagram: 'sequenz', chunk: 'sequenceDiagram', extraGzipKb: 31.2 },
    { diagram: 'er', chunk: 'erDiagram', extraGzipKb: 10.4 },
    { diagram: 'gantt', chunk: 'gantt', extraGzipKb: 17.0 },
  ]),
  selectedGzipKb: 567,
  lazy: 'nur bei Diagramm-Typ laden, nie in jedes 2D-Modul',
});

/** Die vier per Chunk-Selektion abgedeckten Diagrammtypen. */
export const MERMAID_DIAGRAMS = Object.freeze(['fluss', 'sequenz', 'er', 'gantt']);

/** @param {unknown} v */
export function escMermaidXml(v) {
  return String(v ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/**
 * Parst Mermaid-Quelltext deterministisch (Gate: wirft mit Zeile/Position).
 * @param {string} text Mermaid-DSL (flow/sequence/er/gantt)
 * @returns {{ diagram: string, nodes: Array<{ id: string, label: string, shape: string }>, edges: Array<{ from: string, to: string, label: string }>, direction: string }}
 */
export function parseMermaid(text) {
  const src = String(text ?? '');
  const rawLines = src.split('\n');
  const lines = [];
  rawLines.forEach((ln, i) => {
    const t = ln.trim();
    if (t === '' || t.startsWith('%%')) return;
    lines.push({ t, line: i + 1 });
  });
  if (lines.length === 0) {
    throw Object.assign(new Error('UnknownDiagramError: leeres Diagramm (Zeile 1)'), { code: 'E-MERMAID-TYP' });
  }
  const head = lines[0].t;
  let m = /^(graph|flowchart)\s+(TD|TB|LR|RL|BT)$/.exec(head);
  if (m) return parseFlow(lines.slice(1), m[2]);
  if (/^graph\s+\S/.test(head)) {
    throw Object.assign(new Error(`Lexical error: ungueltige Richtung in Zeile 1 ("${head.slice(0, 32)}")`), { code: 'E-MERMAID-LEX' });
  }
  if (head === 'sequenceDiagram') return parseSequence(lines.slice(1));
  if (head === 'erDiagram') return parseEr(lines.slice(1));
  if (head === 'gantt') return parseGantt(lines.slice(1));
  throw Object.assign(new Error(`UnknownDiagramError: Diagrammtyp unbekannt in Zeile 1 ("${head.slice(0, 32)}")`), { code: 'E-MERMAID-TYP' });
}

function pushNode(nodes, byId, id, label, shape) {
  if (!byId.has(id)) {
    byId.set(id, nodes.length);
    nodes.push({ id, label: label ?? id, shape: shape ?? 'rect' });
  } else if (label !== undefined && label !== '' && (nodes[byId.get(id)].label === '' || nodes[byId.get(id)].label === id)) {
    // Label nur verfeinern, nie zurueck auf die nackte Id stutzen: Eine
    // Sequenz-Nachricht (K->>T) darf einen per "participant K as Kunde"
    // gesetzten Anzeigenamen nicht mit "K" ueberschreiben (V2-Legende).
    nodes[byId.get(id)].label = label;
  }
}

function parseFlow(lines, direction) {
  const nodes = [];
  const byId = new Map();
  const edges = [];
  const nodeRe = /([A-Za-z0-9_]+)(\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})/g;
  for (const { t, line } of lines) {
    nodeRe.lastIndex = 0;
    let nm;
    let foundDef = false;
    while ((nm = nodeRe.exec(t)) !== null) {
      foundDef = true;
      const label = (nm[3] ?? nm[4] ?? nm[5] ?? '').trim();
      pushNode(nodes, byId, nm[1], label, nm[2].startsWith('{') ? 'diamond' : 'rect');
    }
    const stripped = t.replace(/(\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})/g, '');
    const edge = /([A-Za-z0-9_]+)\s*-->\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)/.exec(stripped);
    if (edge) {
      pushNode(nodes, byId, edge[1]);
      pushNode(nodes, byId, edge[3]);
      edges.push({ from: edge[1], to: edge[3], label: (edge[2] ?? '').trim() });
      continue;
    }
    const bare = /^\s*([A-Za-z0-9_]+)\s*$/.exec(stripped);
    if (bare) {
      pushNode(nodes, byId, bare[1]);
      continue;
    }
    if (!foundDef) {
      throw Object.assign(new Error(`Lexical error: Zeile ${line} nicht parsbar ("${t.slice(0, 40)}")`), { code: 'E-MERMAID-LEX' });
    }
  }
  if (nodes.length === 0) {
    throw Object.assign(new Error('Lexical error: Flussdiagramm ohne Knoten'), { code: 'E-MERMAID-LEX' });
  }
  return { diagram: 'fluss', nodes, edges, direction };
}

function parseSequence(lines) {
  const nodes = [];
  const byId = new Map();
  const edges = [];
  for (const { t, line } of lines) {
    let p = /^(?:participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/.exec(t);
    if (p) {
      pushNode(nodes, byId, p[1], (p[2] ?? p[1]).trim(), 'actor');
      continue;
    }
    p = /^([A-Za-z0-9_]+)\s*(->>|-->>|->|-->)\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/.exec(t);
    if (p) {
      pushNode(nodes, byId, p[1], p[1], 'actor');
      pushNode(nodes, byId, p[3], p[3], 'actor');
      edges.push({ from: p[1], to: p[3], label: p[4].trim() });
      continue;
    }
    if (/^(Note|rect|loop|alt|else|end|activate|deactivate|autonumber)\b/.test(t)) continue;
    throw Object.assign(new Error(`Lexical error: Zeile ${line} nicht parsbar ("${t.slice(0, 40)}")`), { code: 'E-MERMAID-LEX' });
  }
  if (nodes.length === 0) {
    throw Object.assign(new Error('Lexical error: Sequenzdiagramm ohne Teilnehmer'), { code: 'E-MERMAID-LEX' });
  }
  return { diagram: 'sequenz', nodes, edges, direction: 'TB' };
}

function parseEr(lines) {
  const nodes = [];
  const byId = new Map();
  const edges = [];
  for (const { t, line } of lines) {
    const rel = /^([A-Za-z0-9_]+)\s+([|o}][|o\-][\-oc][{|o|])\s+([A-Za-z0-9_]+)\s*:\s*"?([^"]*)"?$/.exec(t);
    if (rel) {
      pushNode(nodes, byId, rel[1], rel[1], 'rect');
      pushNode(nodes, byId, rel[3], rel[3], 'rect');
      edges.push({ from: rel[1], to: rel[3], label: rel[4].trim() });
      continue;
    }
    const ent = /^([A-Za-z0-9_]+)\s*\{$/.exec(t);
    if (ent) {
      pushNode(nodes, byId, ent[1], ent[1], 'rect');
      continue;
    }
    if (/^[\w\s"]+$/.test(t) || /^[}]$/.test(t)) continue;
    throw Object.assign(new Error(`Lexical error: Zeile ${line} nicht parsbar ("${t.slice(0, 40)}")`), { code: 'E-MERMAID-LEX' });
  }
  if (nodes.length === 0) {
    throw Object.assign(new Error('Lexical error: ER-Diagramm ohne Entitaeten'), { code: 'E-MERMAID-LEX' });
  }
  return { diagram: 'er', nodes, edges, direction: 'LR' };
}

function parseGantt(lines) {
  const nodes = [];
  const byId = new Map();
  const edges = [];
  let title = '';
  let prev = null;
  for (const { t, line } of lines) {
    if (/^(title|dateFormat|axisFormat|section)\b/.test(t)) {
      const tm = /^title\s+(.+)$/.exec(t);
      if (tm) title = tm[1].trim();
      continue;
    }
    const task = /^([^:]+):\s*(?:([^,]+),)?\s*(\d{4}-\d{2}-\d{2}|\d+d|\d+h)?\s*,?\s*(\d{4}-\d{2}-\d{2}|\d+d|\d+h)?\s*$/.exec(t);
    if (task) {
      const name = task[1].trim();
      const dates = [task[3], task[4]].filter(Boolean).join(', ');
      if (/\d{4}-\d{2}-(3[2-9]|[4-9]\d)/.test(dates) || /-\d{2}-00/.test(dates) || /-13-/.test(dates) || /-00-/.test(dates)) {
        throw Object.assign(new Error(`Invalid date: Zeile ${line} ("${t.slice(0, 40)}")`), { code: 'E-MERMAID-DATE' });
      }
      const id = `t${nodes.length + 1}`;
      pushNode(nodes, byId, id, name, 'task');
      if (prev) edges.push({ from: prev, to: id, label: '' });
      prev = id;
      continue;
    }
    throw Object.assign(new Error(`Lexical error: Zeile ${line} nicht parsbar ("${t.slice(0, 40)}")`), { code: 'E-MERMAID-LEX' });
  }
  if (nodes.length === 0) {
    throw Object.assign(new Error('Lexical error: Gantt ohne Aufgaben'), { code: 'E-MERMAID-LEX' });
  }
  void title;
  return { diagram: 'gantt', nodes, edges, direction: 'LR' };
}

/**
 * Baut SVG aus geparstem Mermaid-Modell (deterministisches Layout).
 * @param {{ diagram?: string, title?: string, labels?: string[], measurement?: string, source?: string }} spec
 */
export function buildMermaidSvg(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const parsed = parseMermaid(s.source ?? '');
  const esc = escMermaidXml;
  const title = String(s.title ?? '').slice(0, 48);
  let out = '<svg viewBox="0 0 640 360" width="100%" height="100%" role="img">'
    + '<rect x="0" y="0" width="640" height="360" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>'
    + `<text x="40" y="30" fill="#0f172a" font-size="16" font-weight="bold">${esc(title)}</text>`;
  const n = parsed.nodes.length;
  const pos = new Map();
  if (parsed.diagram === 'sequenz') {
    const xs = (i) => 70 + i * Math.max(60, Math.min(150, 500 / Math.max(n - 1, 1)));
    parsed.nodes.forEach((nd, i) => {
      const x = Math.round(xs(i));
      pos.set(nd.id, { x, y: 80 });
      out += `<g data-part="${esc(nd.label)}" data-layer="labels">`
        + `<rect x="${x - 45}" y="60" width="90" height="36" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>`
        + `<text x="${x}" y="83" fill="#0f172a" font-size="11" text-anchor="middle">${esc(nd.label.slice(0, 16))}</text>`
        + `<line x1="${x}" y1="96" x2="${x}" y2="300" stroke="#0f172a" stroke-width="1" stroke-dasharray="5 3"/></g>`;
    });
    parsed.edges.forEach((e, i) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return;
      const y = 120 + (i % 8) * 20;
      out += `<line x1="${a.x}" y1="${y}" x2="${b.x}" y2="${y}" stroke="#0f172a" stroke-width="2" marker-end="url(#mseq)"/>`
        + `<text x="${(a.x + b.x) / 2}" y="${y - 5}" fill="#0f172a" font-size="10" text-anchor="middle">${esc(e.label.slice(0, 24))}</text>`;
    });
    out = out.replace('role="img">', 'role="img"><defs><marker id="mseq" markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,4 L0,8 Z" fill="#0f172a"/></marker></defs>');
  } else if (parsed.diagram === 'gantt') {
    parsed.nodes.forEach((nd, i) => {
      const y = 70 + i * 34;
      const x = 150;
      const w = Math.max(60, 420 - i * 24);
      pos.set(nd.id, { x, y });
      out += `<g data-part="${esc(nd.label)}" data-layer="labels">`
        + `<text x="140" y="${y + 15}" fill="#0f172a" font-size="11" text-anchor="end">${esc(nd.label.slice(0, 20))}</text>`
        + `<rect x="${x}" y="${y}" width="${w}" height="20" fill="#dbeafe" stroke="#0f172a" stroke-width="2"/></g>`;
    });
  } else {
    const cols = Math.ceil(Math.sqrt(n * 1.6));
    parsed.nodes.forEach((nd, i) => {
      const cx = 80 + (i % cols) * ((640 - 160) / Math.max(cols - 1, 1));
      const cy = 100 + Math.floor(i / cols) * 100;
      pos.set(nd.id, { x: Math.round(cx), y: cy });
    });
    parsed.edges.forEach((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return;
      out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0f172a" stroke-width="2" marker-end="url(#mfl)"/>`;
      if (e.label) {
        out += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}" fill="#0f172a" font-size="11" text-anchor="middle">${esc(e.label.slice(0, 18))}</text>`;
      }
    });
    out = out.replace('role="img">', 'role="img"><defs><marker id="mfl" markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,4 L0,8 Z" fill="#0f172a"/></marker></defs>');
    parsed.nodes.forEach((nd) => {
      const p = pos.get(nd.id);
      if (nd.shape === 'diamond') {
        out += `<g data-part="${esc(nd.label)}" data-layer="labels">`
          + `<polygon points="${p.x},${p.y - 26} ${p.x + 60},${p.y} ${p.x},${p.y + 26} ${p.x - 60},${p.y}" fill="#fef9c3" stroke="#0f172a" stroke-width="2"/>`
          + `<text x="${p.x}" y="${p.y + 4}" fill="#0f172a" font-size="10" text-anchor="middle">${esc(nd.label.slice(0, 16))}</text></g>`;
      } else {
        out += `<g data-part="${esc(nd.label)}" data-layer="labels">`
          + `<rect x="${p.x - 55}" y="${p.y - 22}" width="110" height="44" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>`
          + `<text x="${p.x}" y="${p.y + 4}" fill="#0f172a" font-size="11" text-anchor="middle">${esc(nd.label.slice(0, 16))}</text></g>`;
      }
    });
  }
  if (s.measurement) {
    out += '<g data-layer="measures"><line x1="40" y1="330" x2="420" y2="330" stroke="#0f172a" stroke-width="2"/>'
      + `<text x="230" y="318" fill="#0f172a" font-size="12" text-anchor="middle">${esc(s.measurement)}</text></g>`;
  }
  out += '</svg>';
  return out;
}

/**
 * @param {string} svg
 */
export function countMermaidShapes(svg) {
  const m = String(svg ?? '').match(/<(rect|circle|polygon|line|path|ellipse|text)\b/g);
  return m ? m.length : 0;
}

/**
 * @param {HTMLElement} container
 * @param {{ diagram?: string, title?: string, labels?: string[], measurement?: string, source?: string }} spec
 */
export function renderMermaid2D(container, spec) {
  if (!container || typeof container.innerHTML === 'undefined') {
    throw Object.assign(new Error('E-2D-CONTAINER: Container ohne innerHTML'), { code: 'E-2D-CONTAINER' });
  }
  const svg = buildMermaidSvg(spec);
  container.innerHTML = svg;
  return { diagram: (spec && spec.diagram) || 'fluss', shapes: countMermaidShapes(svg), bytes: svg.length };
}
