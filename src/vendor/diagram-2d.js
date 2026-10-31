/**
 * Vendor-2D: SVG-nativ-Renderer (0 externe Bytes, keine CDN-, Font- oder
 * WASM-Abhaengigkeit). Gehoert in den Vendor-Bereich (analog
 * src/vendor/three.entry.js); generierte 2D-Module liefern NUR Daten
 * ({ kind, title, labels, measurement, values }) und rufen
 * renderDiagram2D(container, spec) auf — kein three-Import, kein
 * document-Zugriff im Modul (S1-Verbote bleiben gruen).
 * Abgeleitet aus dem bewaehrten Standalone-Zweig renderDiagram2D
 * (dist-standalone, V9-2D-Overlay: data-part/data-layer-Gruppen).
 */

export const DIAGRAM_KINDS = Object.freeze(['er', 'bpmn', 'etl', 'uml', 'bars', 'chain', 'generic']);

/** S4-light: SVG-Knoten-Budget je 2D-Modul (vgl. docs/2D-STACK-EVAL.md). */
export const SVG_NODE_BUDGET = 800;

/** @param {unknown} v */
export function escXml(v) {
  return String(v ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function head(title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" role="img">`
    + `<rect x="0" y="0" width="640" height="360" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>`
    + `<text x="40" y="30" fill="#0f172a" font-size="16" font-weight="bold">${escXml(String(title ?? '').slice(0, 48))}</text>`;
}

function measures(text) {
  if (!text) return '';
  return '<g data-layer="measures">'
    + '<line x1="40" y1="330" x2="420" y2="330" stroke="#0f172a" stroke-width="2"/>'
    + '<line x1="40" y1="322" x2="40" y2="338" stroke="#0f172a" stroke-width="2"/>'
    + '<line x1="420" y1="322" x2="420" y2="338" stroke="#0f172a" stroke-width="2"/>'
    + `<text x="230" y="318" fill="#0f172a" font-size="12" text-anchor="middle">${escXml(text)}</text>`
    + '</g>';
}

function group(part, inner) {
  return `<g data-part="${escXml(part)}" data-layer="labels">${inner}</g>`;
}

/** @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, values?: number[] }} spec */
export function buildDiagramSvg(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const kind = DIAGRAM_KINDS.includes(s.kind) ? s.kind : 'generic';
  const labels = Array.isArray(s.labels) ? s.labels.map((x) => String(x)) : [];
  const l = (i) => escXml(labels[i] ?? '');
  const L = (i) => labels[i] ?? '';
  let out = head(s.title);
  if (kind === 'er') {
    out += '<g data-layer="labels">';
    out += group(L(0) || 'Tafel', `<rect x="40" y="140" width="150" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="115" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(0)}</text>`);
    out += group('hat', '<polygon points="320,140 370,180 320,220 270,180" fill="#fef9c3" stroke="#0f172a" stroke-width="2"/><text x="320" y="186" fill="#0f172a" font-size="12" text-anchor="middle">hat</text>');
    out += group('Auftrag', '<rect x="450" y="140" width="150" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="525" y="185" fill="#0f172a" font-size="12" text-anchor="middle">Auftrag</text>');
    out += '</g><line x1="190" y1="180" x2="270" y2="180" stroke="#0f172a" stroke-width="2"/>'
      + '<line x1="370" y1="180" x2="450" y2="180" stroke="#0f172a" stroke-width="2"/>'
      + '<text x="410" y="170" fill="#0f172a" font-size="12">1:N</text>';
  } else if (kind === 'bpmn') {
    out += '<defs><marker id="m1" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#0f172a"/></marker></defs><g data-layer="labels">';
    out += group(L(0), `<circle cx="80" cy="180" r="25" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="80" y="184" fill="#0f172a" font-size="10" text-anchor="middle">${l(0)}</text>`);
    out += group(L(1), `<rect x="150" y="140" width="140" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="220" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(1)}</text>`);
    out += group(L(2), `<polygon points="380,130 430,180 380,230 330,180" fill="#fef9c3" stroke="#0f172a" stroke-width="2"/><text x="380" y="184" fill="#0f172a" font-size="10" text-anchor="middle">${l(2)}</text>`);
    out += group(L(3), `<circle cx="520" cy="180" r="25" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="520" y="184" fill="#0f172a" font-size="10" text-anchor="middle">${l(3)}</text>`);
    out += '</g><line x1="105" y1="180" x2="150" y2="180" stroke="#0f172a" stroke-width="2" marker-end="url(#m1)"/>'
      + '<line x1="290" y1="180" x2="330" y2="180" stroke="#0f172a" stroke-width="2" marker-end="url(#m1)"/>'
      + '<line x1="430" y1="180" x2="495" y2="180" stroke="#0f172a" stroke-width="2" marker-end="url(#m1)"/>';
  } else if (kind === 'etl') {
    out += '<defs><marker id="m1" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#0f172a"/></marker></defs><g data-layer="labels">';
    const xs = [40, 245, 450];
    for (let i = 0; i < 3; i += 1) {
      out += group(L(i), `<rect x="${xs[i]}" y="140" width="150" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="${xs[i] + 75}" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(i)}</text>`);
    }
    out += '</g><line x1="190" y1="180" x2="245" y2="180" stroke="#0f172a" stroke-width="2" marker-end="url(#m1)"/>'
      + '<line x1="395" y1="180" x2="450" y2="180" stroke="#0f172a" stroke-width="2" marker-end="url(#m1)"/>';
  } else if (kind === 'uml') {
    out += '<rect x="200" y="80" width="240" height="180" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>'
      + '<line x1="200" y1="140" x2="440" y2="140" stroke="#0f172a" stroke-width="2"/>'
      + '<line x1="200" y1="200" x2="440" y2="200" stroke="#0f172a" stroke-width="2"/><g data-layer="labels">';
    const ys = [115, 175, 235];
    for (let i = 0; i < 3; i += 1) {
      out += group(L(i), `<text x="320" y="${ys[i]}" fill="#0f172a" font-size="12" text-anchor="middle">${l(i)}</text>`);
    }
    out += '</g><line x1="320" y1="80" x2="320" y2="45" stroke="#0f172a" stroke-width="2"/>'
      + '<polygon points="320,20 308,45 332,45" fill="none" stroke="#0f172a" stroke-width="2"/>';
  } else if (kind === 'bars') {
    const vals = (Array.isArray(s.values) ? s.values : [3, 1, 2, 4]).map(Number).filter(Number.isFinite).slice(0, 6);
    const data = vals.length > 0 ? vals : [3, 1, 2, 4];
    const max = Math.max(...data, 1);
    const bw = 64;
    const x0 = 60;
    out += '<line x1="40" y1="300" x2="600" y2="300" stroke="#0f172a" stroke-width="2"/><g data-layer="labels">';
    for (let i = 0; i < data.length; i += 1) {
      const h = Math.round((data[i] / max) * 180);
      const x = x0 + i * (bw + 16);
      const y = 300 - h;
      const hot = i === 1 || i === 2;
      const barLabel = L(i) || `Balken ${i + 1}`;
      out += group(barLabel,
        `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${hot ? '#fef9c3' : '#dbeafe'}" stroke="#0f172a" stroke-width="2"/>`
        + `<text x="${x + bw / 2}" y="${y - 8}" fill="#0f172a" font-size="12" text-anchor="middle">${escXml(String(data[i]))}</text>`
        + `<text x="${x + bw / 2}" y="${i % 2 ? 354 : 338}" fill="#0f172a" font-size="11" text-anchor="middle">${escXml(barLabel.slice(0, 18))}</text>`);
    }
    out += '</g>';
    const ax = x0 + bw / 2;
    const bx = x0 + (bw + 16) + bw / 2;
    out += group(L(1) || 'Marker', `<circle cx="${ax}" cy="308" r="5" fill="#0f172a"/><circle cx="${bx}" cy="308" r="5" fill="#0f172a"/>`);
    out += group(L(2) || 'Tausch', `<line x1="${ax}" y1="322" x2="${bx}" y2="322" stroke="#4dd2ff" stroke-width="3"/>`
      + `<polygon points="${bx},316 ${bx},328 ${bx + 12},322" fill="#4dd2ff"/>`
      + `<polygon points="${ax},316 ${ax},328 ${ax - 12},322" fill="#4dd2ff"/>`);
  } else if (kind === 'chain') {
    out += '<g data-layer="labels">';
    out += group(L(0), `<rect x="40" y="140" width="150" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="115" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(0)}</text>`);
    out += group(L(1), `<rect x="245" y="140" width="150" height="80" fill="#fef9c3" stroke="#0f172a" stroke-width="2"/><text x="320" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(1)}</text>`);
    out += group(L(2), `<rect x="450" y="140" width="150" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="525" y="185" fill="#0f172a" font-size="12" text-anchor="middle">${l(2)}</text>`);
    if (L(3)) out += group(L(3), `<rect x="245" y="240" width="150" height="56" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="320" y="274" fill="#0f172a" font-size="12" text-anchor="middle">${l(3)}</text>`);
    out += '</g><line x1="190" y1="180" x2="245" y2="180" stroke="#0f172a" stroke-width="2"/>'
      + '<line x1="395" y1="180" x2="450" y2="180" stroke="#0f172a" stroke-width="2"/>'
      + '<circle cx="217" cy="180" r="4" fill="#0f172a"/><circle cx="422" cy="180" r="4" fill="#0f172a"/>';
    if (L(3)) out += '<line x1="320" y1="220" x2="320" y2="240" stroke="#0f172a" stroke-width="2" stroke-dasharray="5 3"/>';
  } else {
    const n = Math.min(labels.length, 4);
    out += '<g data-layer="labels">';
    for (let i = 0; i < n; i += 1) {
      const bx = 40 + (i % 2) * 260;
      const by = 80 + Math.floor(i / 2) * 100;
      out += group(L(i), `<rect x="${bx}" y="${by}" width="220" height="80" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/><text x="${bx + 110}" y="${by + 45}" fill="#0f172a" font-size="12" text-anchor="middle">${l(i)}</text>`);
    }
    out += '</g>';
  }
  out += measures(s.measurement);
  out += '</svg>';
  return out;
}

/**
 * Zaehlt SVG-Formelemente (Pixel-Gate-Proxy, statisch): Jedes sichtbare
 * Shape malt echte Pixel — unter 4 Shapes gilt das Diagramm als leer.
 * @param {string} svg
 */
export function countSvgShapes(svg) {
  const src = String(svg ?? '');
  const m = src.match(/<(rect|circle|polygon|line|path|ellipse|text)\b/g);
  return m ? m.length : 0;
}

/**
 * Wohlgeformtheits-Parse (Gate "parse"): tag-Balance + Verbote
 * (kein script, keine Fremd-URL). Rein, wirft nie.
 * @param {string} svg
 */
export function isWellformedSvg(svg) {
  try {
    const src = String(svg ?? '');
    if (!/<svg[\s>]/.test(src) || !/<\/svg\s*>/.test(src)) return false;
    if (/<script[\s>]/i.test(src)) return false;
    if (/(https?:(?!\/\/www\.w3\.org\/2000\/svg)|data:text\/html|javascript:)/i.test(src)) return false;
    const opens = src.match(/<(rect|circle|polygon|line|path|ellipse|text|g|defs|marker|svg)\b[^/]*>/g) ?? [];
    const selfClosed = opens.filter((t) => /\/>$/.test(t)).length;
    const closes = (src.match(/<\/(rect|circle|polygon|line|path|ellipse|text|g|defs|marker|svg)>/g) ?? []).length;
    void selfClosed;
    void closes;
    const stack = [];
    const re = /<(\/?)(rect|circle|polygon|line|path|ellipse|text|g|defs|marker|svg)\b([^>]*)>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const closing = m[1] === '/';
      const selfClose = /\/\s*$/.test(m[3]);
      if (closing) {
        if (stack.length === 0 || stack[stack.length - 1] !== m[2]) return false;
        stack.pop();
      } else if (!selfClose) {
        stack.push(m[2]);
      }
    }
    return stack.length === 0;
  } catch {
    return false;
  }
}

/**
 * Rendert ein 2D-Diagramm in einen Container (hostseitig, kein iframe).
 * @param {HTMLElement} container
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, values?: number[] }} spec
 */
export function renderDiagram2D(container, spec) {
  if (!container || typeof container.innerHTML === 'undefined') {
    throw Object.assign(new Error('E-2D-CONTAINER: Container ohne innerHTML'), { code: 'E-2D-CONTAINER' });
  }
  const svg = buildDiagramSvg(spec);
  if (!isWellformedSvg(svg)) {
    throw Object.assign(new Error('E-2D-SVG: intern wohlgeformt-Erwartung verletzt'), { code: 'E-2D-SVG' });
  }
  container.innerHTML = svg;
  return { kind: (spec && spec.kind) || 'generic', shapes: countSvgShapes(svg), bytes: svg.length };
}
