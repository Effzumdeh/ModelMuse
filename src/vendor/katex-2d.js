/**
 * Vendor-2D: Mathe-Renderer (KaTeX-LaTeX-Subset, Font-Subsetting, offline).
 *
 * Entspricht docs/2D-STACK-EVAL.md Abschnitt 2.4 (KaTeX 0.19.1, MIT):
 * JS 262 KB / 76 KB gzip; CSS 24 KB / 3,4 KB gzip; 20 woff2-Fonts 253,7 KB
 * (Base64 +33 % -> ~338 KB). Gesamt-Single-File 624 KB / 335 KB gzip — die
 * Fonts sind der Grund, nicht der Renderer.
 *
 * Loesung: Font-Subsetting — nur die tatsaechlich benutzten Fonts einbetten
 * (KATEX_FONT_SUBSET unten: 5 Fonts ~60 KB statt 253,7 KB fuer Schulformeln
 * wie Bruch/Wurzel/Summe). Gate: throwOnError:true erzwingen — mit
 * throwOnError:false wird der Fehler als katex-error-Span im HTML versteckt
 * (Eval Abschnitt 3.3). parseLatex() wirft deterministisch mit Position.
 *
 * Laufzeit hier: dependency-frei, HTML+CSS (System-Serif, keine woff2 im
 * Renderer — Subset-Fonts werden per @font-face aus KATEX_FONT_SUBSET
 * ergaenzt). Swap-in des echten KaTeX (katex.min.js + Subset-Fonts) aendert
 * nur den Renderer, nicht die Module ({ tex } bleibt LaTeX-Subset).
 */

export const KATEX_FONT_SUBSET = Object.freeze({
  lib: 'KaTeX',
  version: '0.19.1',
  license: 'MIT',
  strategy: 'font-subsetting',
  allFontsKb: 253.7,
  allFontsCount: 20,
  subset: Object.freeze([
    { font: 'KaTeX_Main-Regular', kb: 25.7, covers: 'Grundzeichen, Ziffern' },
    { font: 'KaTeX_Math-Italic', kb: 16.6, covers: 'Variablen kursiv' },
    { font: 'KaTeX_Size1-Regular', kb: 6.2, covers: 'Klammern mittel' },
    { font: 'KaTeX_Size2-Regular', kb: 6.8, covers: 'Klammern gross' },
    { font: 'KaTeX_Size4-Regular', kb: 4.8, covers: 'Summen/Integral-Zeichen' },
  ]),
  subsetKb: 60.1,
  note: 'Schulformeln (Bruch, Wurzel, Summe) brauchen nur diese 5 Fonts',
});

/** Formel-Typen (Whitelist): derzeit eine Schulformel-Sorte. */
export const KATEX_KINDS = Object.freeze(['formel']);

/** Erlaubte LaTeX-Befehle im Schul-Subset (Gate: Unbekanntes wirft). */
export const KATEX_COMMANDS = Object.freeze([
  'frac', 'sqrt', 'sum', 'int', 'cdot', 'times', 'div', 'pm',
  'alpha', 'beta', 'gamma', 'pi', 'infty', 'leq', 'geq', 'neq',
  'rightarrow', 'left', 'right', 'text', 'mathrm',
]);

/** @param {unknown} v */
export function escMathHtml(v) {
  return String(v ?? '')
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;');
}

/**
 * Validiert LaTeX (Gate: Klammer-Balance + Befehls-Whitelist, mit Position).
 * @param {string} tex
 * @returns {{ tex: string, tokens: number }}
 */
export function parseLatex(tex) {
  const src = String(tex ?? '');
  if (src.trim() === '') {
    throw Object.assign(new Error('KaTeX parse error: leere Formel'), { code: 'E-KATEX-PARSE' });
  }
  const stack = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const cmd = /^[a-zA-Z]+/.exec(src.slice(i + 1))?.[0] ?? '';
      if (cmd !== '' && !KATEX_COMMANDS.includes(cmd)) {
        throw Object.assign(new Error(`KaTeX parse error: Undefined control sequence \\${cmd} at position ${i}`), { code: 'E-KATEX-CMD' });
      }
      i += 1 + (cmd !== '' ? cmd.length : 1);
      continue;
    }
    if (c === '{') stack.push(i);
    else if (c === '}') {
      if (stack.length === 0) {
        throw Object.assign(new Error(`KaTeX parse error: Unexpected '}' at position ${i}`), { code: 'E-KATEX-PARSE' });
      }
      stack.pop();
    }
    i += 1;
  }
  if (stack.length > 0) {
    throw Object.assign(new Error(`KaTeX parse error: Unexpected end of input in a macro argument, expected '}' (offen ab Position ${stack[0]})`), { code: 'E-KATEX-PARSE' });
  }
  return { tex: src, tokens: src.length };
}

/** Befehl -> Unicode-Symbol (Schul-Subset, echte Zeichen statt Namen). */
const KATEX_SYMBOLS = Object.freeze({
  pm: '±', cdot: '·', times: '×', div: '÷',
  alpha: 'α', beta: 'β', gamma: 'γ', pi: 'π', infty: '∞',
  leq: '≤', geq: '≥', neq: '≠', rightarrow: '→', sum: '∑', int: '∫',
});

/**
 * Nimmt einen {…}-Block mit Balance ab Position i (s[i] === '{').
 * @param {string} s
 * @param {number} i
 * @returns {[string, number]} Inhalt und Position nach '}'
 */
function takeBrace(s, i) {
  let depth = 0;
  let j = i;
  for (; j < s.length; j += 1) {
    if (s[j] === '{') depth += 1;
    else if (s[j] === '}') {
      depth -= 1;
      if (depth === 0) return [s.slice(i + 1, j), j + 1];
    }
  }
  throw Object.assign(new Error('KaTeX parse error: Unexpected end of input in a macro argument, expected \'}\''), { code: 'E-KATEX-PARSE' });
}

/**
 * Rendert LaTeX rekursiv (Bruch/Wurzel/Op/Potenz/Tiefstellung, beliebig
 * geschachtelt — z. B. echte pq-Formel mit Bruch unter der Wurzel).
 * @param {string} src
 */
function renderTex(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const cmd = /^[a-zA-Z]+/.exec(src.slice(i + 1))?.[0] ?? '';
      if (cmd === 'frac') {
        let a;
        let j = i + 1 + cmd.length;
        [a, j] = takeBrace(src, j);
        let b;
        [b, j] = takeBrace(src, j);
        out += `<span class="kx-frac"><span class="kx-num">${renderTex(a)}</span><span class="kx-den">${renderTex(b)}</span></span>`;
        i = j;
        continue;
      }
      if (cmd === 'sqrt') {
        const j = i + 1 + cmd.length;
        const [a, k] = takeBrace(src, j);
        out += `<span class="kx-sqrt"><span class="kx-sign">√</span><span class="kx-rad">${renderTex(a)}</span></span>`;
        i = k;
        continue;
      }
      if (cmd === 'sum' || cmd === 'int') {
        let j = i + 1 + cmd.length;
        let sub = '';
        let sup = '';
        if (src[j] === '_') {
          if (src[j + 1] === '{') { const [a, k] = takeBrace(src, j + 1); sub = a; j = k; }
          else { sub = src[j + 1] ?? ''; j += 2; }
        }
        if (src[j] === '^') {
          if (src[j + 1] === '{') { const [a, k] = takeBrace(src, j + 1); sup = a; j = k; }
          else { sup = src[j + 1] ?? ''; j += 2; }
        }
        out += `<span class="kx-op">${KATEX_SYMBOLS[cmd]}${sub ? `<sub>${escMathHtml(sub)}</sub>` : ''}${sup ? `<sup>${escMathHtml(sup)}</sup>` : ''}</span>`;
        i = j;
        continue;
      }
      if (cmd === 'mathrm' || cmd === 'text') {
        const j = i + 1 + cmd.length;
        const [a, k] = takeBrace(src, j);
        out += escMathHtml(a);
        i = k;
        continue;
      }
      if (cmd === 'left' || cmd === 'right') {
        const d = src[i + 1 + cmd.length] ?? '';
        out += `<span class="kx-big">${escMathHtml(d)}</span>`;
        i += 1 + cmd.length + 1;
        continue;
      }
      if (cmd !== '' && cmd in KATEX_SYMBOLS) {
        out += `<span class="kx-sym">${KATEX_SYMBOLS[cmd]}</span>`;
        i += 1 + cmd.length;
        continue;
      }
      out += escMathHtml(c);
      i += 1;
      continue;
    }
    if (c === '^' || c === '_') {
      const tag = c === '^' ? 'sup' : 'sub';
      if (src[i + 1] === '{') {
        const [a, k] = takeBrace(src, i + 1);
        out += `<${tag}>${renderTex(a)}</${tag}>`;
        i = k;
      } else {
        out += `<${tag}>${escMathHtml(src[i + 1] ?? '')}</${tag}>`;
        i += 2;
      }
      continue;
    }
    out += escMathHtml(c);
    i += 1;
  }
  return out;
}

/**
 * Baut HTML aus LaTeX-Subset (rekursiv, echte Symbole, Inline-CSS).
 * @param {string} tex
 */
export function latexToHtml(tex) {
  parseLatex(tex);
  return renderTex(String(tex ?? ''));
}

const KATEX_CSS = '<style>.katex-block{font-family:Georgia,"Times New Roman",serif;color:#0f172a;background:#ffffff;padding:24px 28px;}'
  + '.katex-title{font-family:sans-serif;font-size:16px;font-weight:bold;margin-bottom:14px;}'
  + '.katex{font-size:30px;line-height:1.25;}'
  + '.kx-sign{font-size:1.7em;line-height:1;}'
  + '.kx-frac{display:inline-block;vertical-align:middle;text-align:center;margin:0 4px;}'
  + '.kx-num{display:block;border-bottom:2px solid #0f172a;padding:0 8px;min-width:1.1em;}'
  + '.kx-den{display:block;padding:0 8px;min-width:1.1em;}'
  + '.kx-sqrt{display:inline-flex;align-items:flex-end;vertical-align:middle;white-space:nowrap;line-height:1;}'
  + '.kx-rad{display:inline-block;vertical-align:baseline;border-top:2px solid #0f172a;padding:0 1px;line-height:1;}'
  + '.kx-op{margin:0 4px;}'
  + '.kx-big{font-size:1.7em;line-height:1;}'
  + '.katex sub,.katex sup{font-size:0.65em;}'
  + '.katex-labels{margin-top:16px;font-family:sans-serif;font-size:12px;}'
  + '.katex-label{display:inline-block;background:#f1f5f9;border:2px solid #0f172a;border-radius:8px;padding:3px 10px;margin:0 8px 6px 0;}'
  + '.katex-measure{margin-top:10px;font-family:sans-serif;font-size:12px;}</style>';

/**
 * Baut Formel-HTML (throwOnError:true — Fehler werfen, nie verstecken).
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, tex?: string }} spec
 */
export function buildMathHtml(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const kind = typeof s.kind === 'string' ? s.kind : null;
  if (kind === null || !KATEX_KINDS.includes(kind)) {
    throw Object.assign(new Error(`E-KATEX-TYP: Formeltyp "${String(kind)}" nicht erlaubt (erlaubt: ${KATEX_KINDS.join('|')})`), { code: 'E-KATEX-TYP' });
  }
  const body = latexToHtml(s.tex ?? '');
  const esc = escMathHtml;
  const title = String(s.title ?? '').slice(0, 48);
  let out = `${KATEX_CSS}<div class="katex-block" role="img">`
    + `<div class="katex-title">${esc(title)}</div>`
    + `<div class="katex"><span class="katex-html">${body}</span></div>`
    + '<div class="katex-labels" data-layer="labels">';
  for (const l of (Array.isArray(s.labels) ? s.labels : []).slice(0, 6)) {
    out += `<span class="katex-label" data-part="${esc(l)}">${esc(l)}</span>`;
  }
  out += '</div>';
  if (s.measurement) {
    out += `<div class="katex-measure" data-layer="measures">${esc(s.measurement)}</div>`;
  }
  out += '</div>';
  return out;
}

/**
 * @param {string} html
 */
export function countMathShapes(html) {
  const m = String(html ?? '').match(/<(span|div|sup|sub)\b/g);
  return m ? m.length : 0;
}

/**
 * @param {HTMLElement} container
 * @param {{ kind?: string, title?: string, labels?: string[], measurement?: string, tex?: string }} spec
 */
export function renderMath2D(container, spec) {
  if (!container || typeof container.innerHTML === 'undefined') {
    throw Object.assign(new Error('E-2D-CONTAINER: Container ohne innerHTML'), { code: 'E-2D-CONTAINER' });
  }
  const html = buildMathHtml(spec);
  container.innerHTML = html;
  return { kind: (spec && spec.kind) || 'formel', shapes: countMathShapes(html), bytes: html.length };
}
