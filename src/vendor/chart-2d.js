/**
 * Vendor-2D: Chart-Renderer (Chart.js-Konfiguration, tree-shaken, offline).
 *
 * Entspricht docs/2D-STACK-EVAL.md Abschnitt 2.2 (Chart.js 4.6.1, MIT):
 * UMD voll 205 KB / 69 KB gzip; tree-shaken (Line+Bar+Tooltip+Legend+2 Scales,
 * esbuild wie Repo-Build) 176 KB / 62 KB gzip — 4,0 % der Mermaid-Groesse.
 * Kein CDN, keine externen Assets, keine Fonts (Canvas-Renderer).
 *
 * Gate-Befund Eval Abschnitt 3.3: Chart.js wirft bei ungueltigem Diagrammtyp
 * NICHT (type 'quatsch': threw null, warns [], Instanz existiert) — Gate muss
 * daher pixelbasiert pruefen + Diagrammtyp gegen Whitelist validieren.
 * parseChartConfig() unten tut genau das (deterministisch, wirft E-CHART-TYP).
 *
 * Laufzeit hier: dependency-frei, Canvas-2D (Browser) + deterministisches
 * SVG-Vorschaubild (Node-Gates, Screenshots ohne Lib). Das Datenformat folgt
 * der Chart.js-Config (type/labels/datasets/data) — Swap-in des echten
 * Chart.js-UMD (205 KB) aendert nur den Renderer, nicht die Module.
 */

export const CHART_BUDGET = Object.freeze({
  lib: 'chart.js',
  version: '4.6.1',
  license: 'MIT',
  strategy: 'tree-shaken-esbuild',
  umdGzipKb: 69,
  shakenGzipKb: 62,
  modules: Object.freeze(['Line', 'Bar', 'Tooltip', 'Legend', '2 Scales']),
});

/** Whitelist der Chart-Typen (Gate: Unbekanntes wird abgewiesen). */
export const CHART_TYPES = Object.freeze(['balken', 'linie', 'kreis']);
const TO_CANVAS = Object.freeze({ balken: 'bar', linie: 'line', kreis: 'pie' });

/** @param {unknown} v */
export function escChartXml(v) {
  return String(v ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

/** Schoene Skalenobergrenze (1/2/2.5/5/10 x 10^k) statt Maximalwert. */
export function niceCeil(v) {
  const x = Math.max(Number(v) || 0, 1);
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * p;
}

/**
 * Validiert eine Chart.js-artige Config (Gate: Typ-Whitelist + Datenform).
 * @param {{ kind?: string, title?: string, labels?: string[], values?: number[], measurement?: string, unit?: string }} spec
 * @returns {{ type: string, labels: string[], values: number[], unit: string }}
 */
export function parseChartConfig(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const kind = typeof s.kind === 'string' ? s.kind : null;
  if (kind === null || !CHART_TYPES.includes(kind)) {
    throw Object.assign(new Error(`E-CHART-TYP: Diagrammtyp "${String(kind)}" nicht erlaubt (erlaubt: ${CHART_TYPES.join('|')})`), { code: 'E-CHART-TYP' });
  }
  const labels = Array.isArray(s.labels) ? s.labels.map((x) => String(x)) : [];
  const values = (Array.isArray(s.values) ? s.values : []).map(Number).filter(Number.isFinite);
  if (labels.length < 1) {
    throw Object.assign(new Error('E-CHART-DATEN: mindestens 1 Label noetig'), { code: 'E-CHART-DATEN' });
  }
  if (values.length < 1) {
    throw Object.assign(new Error('E-CHART-DATEN: mindestens 1 Wert noetig'), { code: 'E-CHART-DATEN' });
  }
  if (values.length > 6) {
    throw Object.assign(new Error('E-CHART-DATEN: maximal 6 Werte (Schulfall)'), { code: 'E-CHART-DATEN' });
  }
  const unit = typeof s.unit === 'string' ? s.unit.slice(0, 8) : '';
  return { type: TO_CANVAS[kind], labels, values, unit };
}

/**
 * Deterministisches SVG-Vorschaubild (Node-Gates, Offline-Shots ohne Lib).
 * @param {{ kind?: string, title?: string, labels?: string[], values?: number[], measurement?: string }} spec
 */
export function buildChartSvg(spec) {
  const cfg = parseChartConfig(spec);
  const s = (spec && typeof spec === 'object') ? spec : {};
  const esc = escChartXml;
  const title = String(s.title ?? '').slice(0, 48);
  let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" role="img">'
    + '<rect x="0" y="0" width="640" height="360" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>'
    + `<text x="40" y="30" fill="#0f172a" font-size="16" font-weight="bold">${esc(title)}</text>`;
  if (cfg.type === 'pie') {
    let a0 = -Math.PI / 2;
    const total = cfg.values.reduce((a, b) => a + b, 0) || 1;
    const cols = ['#dbeafe', '#fef9c3', '#dcfce7', '#fae8ff', '#ffedd5', '#e0e7ff'];
    cfg.values.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = v / total > 0.5 ? 1 : 0;
      const x0 = 320 + 100 * Math.cos(a0);
      const y0 = 200 + 100 * Math.sin(a0);
      const x1 = 320 + 100 * Math.cos(a1);
      const y1 = 200 + 100 * Math.sin(a1);
      out += `<g data-part="${esc(cfg.labels[i] ?? '')}" data-layer="labels">`
        + `<path d="M320,200 L${x0.toFixed(1)},${y0.toFixed(1)} A100,100 0 ${large},1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${cols[i % cols.length]}" stroke="#0f172a" stroke-width="2"/>`
        + `<text x="${(320 + 130 * Math.cos((a0 + a1) / 2)).toFixed(1)}" y="${(200 + 130 * Math.sin((a0 + a1) / 2)).toFixed(1)}" fill="#0f172a" font-size="11" text-anchor="middle">${esc(cfg.labels[i] ?? '')}: ${v}</text></g>`;
      a0 = a1;
    });
  } else {
    const nice = niceCeil(Math.max(...cfg.values, 1));
    const step = 520 / cfg.values.length;
    const bw = Math.min(64, step - 20);
    const x0 = 60;
    const xEnd = Math.round(x0 + (cfg.values.length - 1) * step + bw + 30);
    const unit = cfg.unit ? ` ${cfg.unit}` : '';
    out += `<line x1="40" y1="300" x2="${xEnd}" y2="300" stroke="#0f172a" stroke-width="2"/>`
      + '<line x1="44" y1="300" x2="44" y2="110" stroke="#0f172a" stroke-width="2"/><g data-layer="labels">';
    for (let t = 0; t <= 4; t += 1) {
      const v = Math.round((nice * t) / 4);
      const y = 300 - Math.round((v / nice) * 180);
      out += `<text x="36" y="${y + 4}" fill="#0f172a" font-size="10" text-anchor="end">${v}</text>`
        + `<line x1="44" y1="${y}" x2="${xEnd}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>`;
    }
    out += `<text x="36" y="100" fill="#0f172a" font-size="10" text-anchor="end">${esc(cfg.unit)}</text>`;
    const pts = [];
    const peak = Math.max(...cfg.values);
    cfg.values.forEach((v, i) => {
      const h = Math.round((v / nice) * 180);
      const x = x0 + i * step;
      const y = 300 - h;
      const cx = x + (cfg.type === 'bar' ? bw / 2 : 0);
      if (cfg.type === 'bar') {
        out += `<g data-part="${esc(cfg.labels[i] ?? '')}" data-layer="labels">`
          + `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${v === peak ? '#fef9c3' : '#dbeafe'}" stroke="#0f172a" stroke-width="2"/>`
          + `<text x="${x + bw / 2}" y="${y - 8}" fill="#0f172a" font-size="12" text-anchor="middle">${v}${esc(unit)}</text>`
          + `<text x="${x + bw / 2}" y="322" fill="#0f172a" font-size="11" text-anchor="middle">${esc((cfg.labels[i] ?? '').slice(0, 12))}</text></g>`;
      } else {
        pts.push(`${cx},${y}`);
        out += `<g data-part="${esc(cfg.labels[i] ?? '')}" data-layer="labels">`
          + `<circle cx="${cx}" cy="${y}" r="6" fill="#dbeafe" stroke="#0f172a" stroke-width="2"/>`
          + `<text x="${cx}" y="${y - 12}" fill="#0f172a" font-size="12" text-anchor="middle">${v}</text>`
          + `<text x="${cx}" y="322" fill="#0f172a" font-size="11" text-anchor="middle">${esc((cfg.labels[i] ?? '').slice(0, 12))}</text></g>`;
      }
    });
    if (cfg.type === 'line' && pts.length > 1) {
      out += `<polyline points="${pts.join(' ')}" fill="none" stroke="#4dd2ff" stroke-width="3"/>`;
    }
    out += '</g>';
  }
  if (s.measurement) {
    out += `<g data-layer="measures"><text x="40" y="350" fill="#0f172a" font-size="12">${esc(s.measurement)}</text></g>`;
  }
  out += '</svg>';
  return out;
}

/**
 * @param {string} svg
 */
export function countChartShapes(svg) {
  const m = String(svg ?? '').match(/<(rect|circle|polygon|line|path|ellipse|text|polyline)\b/g);
  return m ? m.length : 0;
}

/**
 * Rendert in einen Container (Browser: Canvas-2D; ohne Canvas: SVG-Fallback).
 * @param {HTMLElement} container
 * @param {{ kind?: string, title?: string, labels?: string[], values?: number[], measurement?: string }} spec
 */
export function renderChart2D(container, spec) {
  if (!container || typeof container.innerHTML === 'undefined') {
    throw Object.assign(new Error('E-2D-CONTAINER: Container ohne innerHTML'), { code: 'E-2D-CONTAINER' });
  }
  const cfg = parseChartConfig(spec);
  const s = (spec && typeof spec === 'object') ? spec : {};
  const doc = container.ownerDocument;
  const canCanvas = doc && typeof doc.createElement === 'function';
  if (canCanvas) {
    try {
      const cv = doc.createElement('canvas');
      cv.setAttribute('width', '640');
      cv.setAttribute('height', '360');
      cv.setAttribute('role', 'img');
      const ctx = cv.getContext('2d');
      if (ctx) {
        drawChartCanvas(ctx, cfg, s.title);
        container.innerHTML = '';
        container.appendChild(cv);
        return { type: cfg.type, shapes: cfg.values.length, bytes: cfg.values.length * 8, canvas: true };
      }
    } catch {
      /* Fallback unten */
    }
  }
  const svg = buildChartSvg(spec);
  container.innerHTML = svg;
  return { type: cfg.type, shapes: countChartShapes(svg), bytes: svg.length, canvas: false };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ type: string, labels: string[], values: number[] }} cfg
 * @param {string} [title]
 */
export function drawChartCanvas(ctx, cfg, title) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 640, 360);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 638, 358);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(String(title ?? '').slice(0, 48), 40, 30);
  const nice = niceCeil(Math.max(...cfg.values, 1));
  const unit = cfg.unit ? ` ${cfg.unit}` : '';
  const step = 520 / cfg.values.length;
  const bw = Math.min(64, step - 20);
  const xEnd = Math.round(60 + (cfg.values.length - 1) * step + bw + 30);
  const peak = Math.max(...cfg.values);
  if (cfg.type === 'pie') {
    let a0 = -Math.PI / 2;
    const total = cfg.values.reduce((a, b) => a + b, 0) || 1;
    const cols = ['#dbeafe', '#fef9c3', '#dcfce7', '#fae8ff', '#ffedd5', '#e0e7ff'];
    cfg.values.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(320, 200);
      ctx.arc(320, 200, 100, a0, a1);
      ctx.closePath();
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill();
      ctx.stroke();
      a0 = a1;
    });
    return;
  }
  ctx.beginPath();
  ctx.moveTo(44, 300);
  ctx.lineTo(xEnd, 300);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(44, 300);
  ctx.lineTo(44, 110);
  ctx.stroke();
  ctx.font = '10px sans-serif';
  ctx.fillText(String(cfg.unit ?? ''), 36, 100);
  for (let t = 0; t <= 4; t += 1) {
    const v = Math.round((nice * t) / 4);
    const y = 300 - Math.round((v / nice) * 180);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(String(v), 16, y + 3);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(xEnd, y);
    ctx.stroke();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
  }
  cfg.values.forEach((v, i) => {
    const h = Math.round((v / nice) * 180);
    const x = 60 + i * step;
    const y = 300 - h;
    if (cfg.type === 'bar') {
      ctx.fillStyle = v === peak ? '#fef9c3' : '#dbeafe';
      ctx.fillRect(x, y, bw, h);
      ctx.strokeRect(x, y, bw, h);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#dbeafe';
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px sans-serif';
    ctx.fillText(String(v) + unit, x, y - 8);
    ctx.font = '11px sans-serif';
    ctx.fillText(String(cfg.labels[i] ?? '').slice(0, 16), x, 330);
  });
  if (cfg.type === 'line' && cfg.values.length > 1) {
    ctx.beginPath();
    cfg.values.forEach((v, i) => {
      const x = 60 + i * step;
      const y = 300 - Math.round((v / nice) * 180);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#4dd2ff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
