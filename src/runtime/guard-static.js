/**
 * S1-Statik: Verbotsliste, Groesse, Meta-Form, Import-Allowlist, Static-Gate.
 * Rein, synchron, wirft nie (ausser bei fehlenden Pflichtargumenten der Fabrik).
 * Bauplan Abschnitt 4 (Sandbox-Vertrag) und Abschnitt 6 (S1).
 */

/** @typedef {{ rule: string, token: string, offset: number, context: string }} ForbiddenHit */
/** @typedef {{ ok: boolean, tier: 'green' | 'yellow' | 'reject', bytes: number }} SizeVerdict */
/** @typedef {{ ok: boolean, specifiers: string[], offending: string[] }} ImportVerdict */
/** @typedef {{ ok: boolean, missing: string[], invalid: string[] }} MetaVerdict */
/** @typedef {{ ok: boolean, errors: string[], hits: ForbiddenHit[], size: SizeVerdict, imports: ImportVerdict, meta: MetaVerdict }} StaticReport */

export const ALLOW_SPECIFIERS = Object.freeze(['three', 'wrapper-helpers', '2d-svg', '2d-mermaid', '2d-chart', '2d-d3', '2d-katex']);
// 2D-Pfad (docs/2D-STACK-EVAL.md): Lib liegt im Vendor, Module liefern nur
// Daten. Exakt diese Specifier sind zusaetzlich erlaubt (Importmap-Prinzip);
// KEINE relativen Pfade, KEINE URLs, KEIN dynamischer import().
export const ALLOW_2D_SPECIFIERS = Object.freeze(['2d-svg', '2d-mermaid', '2d-chart', '2d-d3', '2d-katex']);
// Ausnahme: OrbitControls (Bauplan Abschnitt 3, einziger Addon-Import).
export const ALLOW_ADDON = 'three/addons/controls/OrbitControls.js';

/** Benannte Exporte des Vendor-Bundles = reparierbare Import-Namen.
 * Spiegel von src/vendor/three.entry.js: NUR diese Namen darf der Repair
 * ergaenzen — ein unbekannter Name wuerde den Modul-Link zerstoeren statt
 * ihn zu retten (E-S2-BOOT statt ReferenceError). */
export const THREE_KNOWN_EXPORTS = Object.freeze([
  'ACESFilmicToneMapping', 'AmbientLight', 'BoxGeometry', 'BufferGeometry',
  'CanvasTexture', 'CircleGeometry', 'Color', 'CylinderGeometry', 'DataTexture',
  'DirectionalLight', 'DoubleSide', 'EdgesGeometry', 'ExtrudeGeometry', 'Group',
  'HemisphereLight', 'InstancedMesh', 'Line', 'LineBasicMaterial',
  'LinearFilter', 'Matrix4', 'Mesh', 'MeshBasicMaterial',
  'MeshPhysicalMaterial', 'MeshStandardMaterial', 'OrthographicCamera', 'PCFShadowMap', 'PCFSoftShadowMap',
  'PerspectiveCamera', 'PlaneGeometry', 'PMREMGenerator', 'PointLight',
  'Quaternion', 'RepeatWrapping', 'Scene', 'ShadowMaterial', 'Shape',
  'SphereGeometry', 'Sprite', 'SpriteMaterial', 'SRGBColorSpace',
  'TorusGeometry', 'VSMShadowMap', 'Vector3', 'WebGLRenderer',
]);
export const ADDON_KNOWN_EXPORTS = Object.freeze(['OrbitControls']);
export const HELPER_KNOWN_EXPORTS = Object.freeze(['addLabel', 'addMeasurement', 'registerPartGroups', 'applyPartVisibility']);
/** Benannte Exporte des 2D-Vendor-Bundles (src/vendor/diagram-2d.js). */
export const TWOD_KNOWN_EXPORTS = Object.freeze(['renderDiagram2D', 'buildDiagramSvg', 'DIAGRAM_KINDS', 'escXml', 'countSvgShapes', 'isWellformedSvg', 'SVG_NODE_BUDGET', 'renderMermaid2D', 'parseMermaid', 'buildMermaidSvg', 'MERMAID_CHUNK_MANIFEST', 'renderChart2D', 'parseChartConfig', 'buildChartSvg', 'CHART_TYPES', 'renderGraph2D', 'parseGraph', 'buildGraphSvg', 'D3_SUBMODULE_MANIFEST', 'renderMath2D', 'parseLatex', 'buildMathHtml', 'KATEX_FONT_SUBSET']);
/** 2D-Diagramm-Typen (Whitelist): SVG-nativ-Kinds je Lab (siehe vendor/diagram-2d.js). */
export const TWOD_KINDS = Object.freeze(['er', 'bpmn', 'etl', 'uml', 'bars', 'chain', 'svg', 'generic']);
/** Mermaid Chunk-Selektion (Eval 2.1): vier Diagrammtypen je ESM-Chunk. */
export const MERMAID_DIAGRAMS = Object.freeze(['fluss', 'sequenz', 'er', 'gantt']);
/** Chart.js tree-shaken (Eval 2.2): drei Schul-Charttypen. */
export const CHART_KINDS = Object.freeze(['balken', 'linie', 'kreis']);
/** d3-light (Eval 2.3): Netz (force) und Baum (hierarchy/tree). */
export const D3_KINDS = Object.freeze(['netz', 'baum']);
/** KaTeX Font-Subsetting (Eval 2.4): Schulformel-Sorte. */
export const KATEX_KINDS = Object.freeze(['formel']);
/** Benannte Exporte je 2D-Vendor-Datei (Repair-Lauf-Gegenstuecke). */
export const MERMAID_KNOWN_EXPORTS = Object.freeze(['renderMermaid2D', 'parseMermaid', 'buildMermaidSvg', 'MERMAID_CHUNK_MANIFEST']);
export const CHART_KNOWN_EXPORTS = Object.freeze(['renderChart2D', 'parseChartConfig', 'buildChartSvg', 'CHART_TYPES']);
export const D3_KNOWN_EXPORTS = Object.freeze(['renderGraph2D', 'parseGraph', 'buildGraphSvg', 'D3_SUBMODULE_MANIFEST']);
export const KATEX_KNOWN_EXPORTS = Object.freeze(['renderMath2D', 'parseLatex', 'buildMathHtml', 'KATEX_FONT_SUBSET']);

/**
 * @param {string} source
 * @returns {boolean} true, wenn das Modul den 2D-Datenpfad nutzt
 * (Import aus 2d-* statt three).
 */
export function isTwoDSource(source) {
  const code = stripComments(String(source));
  const re = /(?:import\s+(?:[^'"]*?\sfrom\s+)?|export\s+[^'"]*?\sfrom\s+)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (ALLOW_2D_SPECIFIERS.includes(m[1])) return true;
  }
  return false;
}

const FORBIDDEN_TOKENS = Object.freeze([
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'document',
  'window',
  'parent',
  'top',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'sendBeacon',
  'navigator',
]);

const CATEGORIES = Object.freeze(['hardware', 'architektur', 'auto', 'pflanze', 'sonstiges']);

/** Kommentare entfernen (Zeilen- und Blockkommentare), Strings bleiben erhalten. */
export function stripComments(source) {
  const src = String(source);
  let out = '';
  let i = 0;
  const n = src.length;
  let quote = null;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** String-Literale maskieren (Offsets bleiben gueltig); ${} bleibt sichtbar. */
export function maskStrings(code) {
  const src = String(code);
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c !== '"' && c !== "'" && c !== '`') {
      out += c;
      i += 1;
      continue;
    }
    if (c !== '`') {
      out += ' ';
      i += 1;
      while (i < n) {
        if (src[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        if (src[i] === c) {
          out += ' ';
          i += 1;
          break;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }
    // Template-String: nur ${}-Bloecke behalten.
    out += ' ';
    i += 1;
    let depth = 0;
    while (i < n) {
      if (src[i] === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (depth === 0 && src[i] === '`') {
        out += ' ';
        i += 1;
        break;
      }
      if (src[i] === '$' && src[i + 1] === '{') {
        depth += 1;
        out += '${';
        i += 2;
        continue;
      }
      if (depth > 0) {
        if (src[i] === '{') depth += 1;
        if (src[i] === '}') depth -= 1;
        out += src[i];
        i += 1;
        continue;
      }
      out += src[i] === '\n' ? '\n' : ' ';
      i += 1;
    }
  }
  return out;
}

/**
 * Sucht verbotene Token im kommentar- und stringbereinigten Quelltext.
 * Erfasst zusaetzlich: indirektes eval, .constructor-Traversal,
 * String-Argument-Scheduling (setTimeout/setInterval mit String).
 * @param {string} source
 * @returns {ForbiddenHit[]} wirft nie
 */
export function scanForbidden(source) {
  try {
    const code = maskStrings(stripComments(String(source)));
    /** @type {ForbiddenHit[]} */
    const hits = [];
    const push = (rule, token, offset) => {
      const from = Math.max(0, offset - 24);
      const to = Math.min(code.length, offset + token.length + 24);
      hits.push({
        rule,
        token,
        offset,
        context: code.slice(from, to).replace(/\s+/g, ' ').slice(0, 96),
      });
    };
    for (const token of FORBIDDEN_TOKENS) {
      const re = new RegExp(`\\b${token}\\b`, 'g');
      let m;
      while ((m = re.exec(code)) !== null) push('E-S1-FORBIDDEN', token, m.index);
    }
    // Dynamischer Import: import(
    {
      const re = /import\s*\(/g;
      let m;
      while ((m = re.exec(code)) !== null) push('E-S1-FORBIDDEN', 'import(', m.index);
    }
    // Constructor-Traversal: .constructor / prototype.constructor
    {
      const re = /\.constructor\b|prototype\s*\.\s*constructor/g;
      let m;
      while ((m = re.exec(code)) !== null) push('E-S1-FORBIDDEN', '.constructor', m.index);
    }
    // String-Scheduling: setTimeout('...') / setInterval('...')
    {
      const re = /\bsetTimeout\s*\(\s*['"`]|\\bsetInterval\s*\(\s*['"`]/g;
      let m;
      while ((m = re.exec(code)) !== null) push('E-S1-FORBIDDEN', 'string-schedule', m.index);
    }
    return hits;
  } catch {
    return [{ rule: 'E-S1-FORBIDDEN', token: 'scan-error', offset: 0, context: '' }];
  }
}

/**
 * @param {number} bytes
 * @param {{ comfort?: number, hard?: number }} [limits]
 * @returns {SizeVerdict} E-S1-SIZE bei reject
 */
export function checkSize(bytes, limits = {}) {
  const comfort = limits.comfort ?? 1500000;
  const hard = limits.hard ?? 2000000;
  if (!Number.isFinite(bytes) || bytes < 0) return { ok: false, tier: 'reject', bytes: -1 };
  if (bytes > hard) return { ok: false, tier: 'reject', bytes };
  if (bytes > comfort) return { ok: true, tier: 'yellow', bytes };
  return { ok: true, tier: 'green', bytes };
}

/**
 * @param {string} source
 * @returns {ImportVerdict} E-S1-IMPORT bei offending.length > 0
 */
export function checkImports(source) {
  const code = stripComments(String(source));
  const specifiers = new Set();
  const offending = new Set();
  const staticRe = /(?:import\s+(?:[^'"]*?\sfrom\s+)?|export\s+[^'"]*?\sfrom\s+)['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(code)) !== null) {
    const spec = m[1];
    if (ALLOW_SPECIFIERS.includes(spec) || spec === ALLOW_ADDON) specifiers.add(spec);
    else offending.add(spec);
  }
  const dynRe = /import\s*\(/g;
  while (dynRe.exec(code) !== null) offending.add('dynamic-import()');
  const relRe = /(?:import|export)[^'"]*['"](\.[^'"]*|[^'":]*:[^'"]*|[^'"/][^'"]*\/[^'"]*)['"]/g;
  while ((m = relRe.exec(code)) !== null) {
    if (!ALLOW_SPECIFIERS.includes(m[1]) && m[1] !== ALLOW_ADDON) offending.add(m[1]);
  }
  return { ok: offending.size === 0, specifiers: [...specifiers], offending: [...offending] };
}

/**
 * @param {unknown} meta
 * @returns {MetaVerdict} E-S1-SHAPE bei missing/invalid
 */
export function checkMeta(meta) {
  const missing = [];
  const invalid = [];
  if (typeof meta !== 'object' || meta === null) {
    return { ok: false, missing: ['title', 'category', 'detailLevel', 'parts', 'units'], invalid: ['meta-not-object'] };
  }
  const m = /** @type {Record<string, unknown>} */ (meta);
  for (const key of ['title', 'category', 'detailLevel', 'parts', 'units']) {
    if (!(key in m)) missing.push(key);
  }
  if ('title' in m && (typeof m.title !== 'string' || m.title.length < 3 || m.title.length > 80)) {
    invalid.push('title');
  }
  if ('category' in m && !CATEGORIES.includes(/** @type {string} */ (m.category))) invalid.push('category');
  if ('detailLevel' in m && ![1, 2, 3].includes(/** @type {number} */ (m.detailLevel))) invalid.push('detailLevel');
  if ('parts' in m) {
    const parts = /** @type {unknown} */ (m.parts);
    if (!Array.isArray(parts) || parts.length < 3 || parts.some((p) => typeof p !== 'string')) {
      invalid.push('parts');
    }
  }
  if ('units' in m && m.units !== 'm') invalid.push('units');
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

/**
 * E-S2-BOOT-Repair ("X is not defined"): ergaenzt fehlende benannte Imports.
 * Das Modell nutzt Namen direkt (new Scene()), kuerzt aber teils die
 * Importliste — S1 prueft nur Specifier, der Boot bricht dann mit
 * ReferenceError ab. Scannt den Rumpf (ohne Import-Zeilen, Kommentare,
 * Strings) auf bekannte Export-Namen und haengt fehlende an die passende
 * Import-Anweisung an (oder stellt sie voran). Rein, wirft nie,
 * byte-identisch wenn nichts fehlt.
 * @param {string} source
 * @returns {string}
 */
export function repairThreeImports(source) {
  try {
    const src = String(source);
    const masked = maskStrings(stripComments(src));
    const body = masked.replace(/import\s*[^;]*?\sfrom\s*['"][^'"]+['"]/g, (m) => ' '.repeat(m.length));
    const imported = new Set();
    const importRe = /import\s*(?:\*\s*as\s*[A-Za-z_$][\w$]*|\{([^}]*)\})\s*from\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRe.exec(src)) !== null) {
      if (m[1] === undefined) continue; // Namespace-Import: Bare-Nutzung unten trotzdem reparierbar
      for (const item of m[1].split(',')) {
        const parts = item.trim().split(/\s+as\s+/);
        const local = (parts[1] ?? parts[0] ?? '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(local)) imported.add(local);
      }
    }
    const declRe = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
    while ((m = declRe.exec(body)) !== null) imported.add(m[1]);
    const used = (/** @type {string} */ name) => {
      const re = new RegExp(`\\b${name}\\b`, 'g');
      let hit;
      while ((hit = re.exec(body)) !== null) {
        if (body[hit.index - 1] !== '.') return true;
      }
      return false;
    };
    /** @param {readonly string[]} names */
    const missingFor = (names) => names.filter((n) => !imported.has(n) && used(n));
    const missThree = missingFor(THREE_KNOWN_EXPORTS);
    const missAddon = missingFor(ADDON_KNOWN_EXPORTS);
    const missHelper = missingFor(HELPER_KNOWN_EXPORTS);
    if (missThree.length + missAddon.length + missHelper.length === 0) return src;
    let out = src;
    /** @param {string} spec @param {string[]} names */
    const splice = (spec, names) => {
      if (names.length === 0) return;
      const esc = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${esc}['"]`);
      const found = re.exec(out);
      if (found) {
        const inner = found[1].trim();
        out = out.slice(0, found.index) + `import { ${inner ? `${inner}, ` : ''}${names.join(', ')} } from '${spec}'` + out.slice(found.index + found[0].length);
      } else {
        out = `import { ${names.join(', ')} } from '${spec}';\n${out}`;
      }
    };
    splice('three', missThree);
    splice(ALLOW_ADDON, missAddon);
    splice('wrapper-helpers', missHelper);
    return out;
  } catch {
    return String(source);
  }
}

/**
 * Aggregiert S1: Verbote, Groesse, Imports, Meta-Form.
 * @param {string} source
 * @param {{ comfort?: number, hard?: number }} [limits]
 * @returns {StaticReport} errors enthaelt E-S1-*-Codes
 */
export function staticGate(source, limits = {}) {
  const hits = scanForbidden(String(source));
  const bytes = new TextEncoder().encode(String(source)).length;
  const size = checkSize(bytes, limits);
  const imports = checkImports(String(source));
  const errors = [];
  if (hits.length > 0) errors.push('E-S1-FORBIDDEN');
  if (!size.ok) errors.push('E-S1-SIZE');
  if (!imports.ok) errors.push('E-S1-IMPORT');
  return { ok: errors.length === 0, errors, hits, size, imports, meta: { ok: true, missing: [], invalid: [] } };
}
