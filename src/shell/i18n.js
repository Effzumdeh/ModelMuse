/**
 * Teil 5 — Internationalisierung (reine Funktionen + duenne DOM-Bindung).
 * Locales: de (Standard/Fallback), en, es. Standard = Systemsprache des Users
 * (navigator.language: de* -> de, es* -> es, en* -> en, sonst de).
 * Strings als Daten aus src/shell/i18n/*.json (Build bettet ein, kein Fetch).
 * Manifest-Aufloesung: kanonisches Deutsch + optionales i18n-Segment
 * ({en:{...}, es:{...}}); ohne Segment faellt die Ansicht auf Deutsch zurueck.
 */
import DE from './i18n/de.json' with { type: 'json' };
import EN from './i18n/en.json' with { type: 'json' };
import ES from './i18n/es.json' with { type: 'json' };

export const LOCALES = Object.freeze(['de', 'en', 'es']);
export const STRINGS = Object.freeze({ de: DE, en: EN, es: ES });

/** Aktuelle UI-Lokale (Start: Systemsprache, umschaltbar im UI). */
let currentLocale = 'de';

/** @param {string} locale */
export function setLocale(locale) {
  currentLocale = normalizeLocale(locale);
  return currentLocale;
}

/** @returns {string} */
export function getLocale() {
  return currentLocale;
}

/**
 * String in aktueller Lokale (Kurzform fuer Render-Module).
 * @param {string} path @param {Record<string, string|number>} [vars]
 */
export function tt(path, vars) {
  return t(currentLocale, path, vars);
}

/**
 * Systemsprache des Users auf unterstütztes Locale abbilden.
 * @param {{ language?: string, languages?: readonly string[] }} [nav]
 */
export function detectLocale(nav) {
  const tags = [];
  if (nav && Array.isArray(nav.languages)) tags.push(...nav.languages);
  if (nav && typeof nav.language === 'string') tags.push(nav.language);
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
    if (typeof navigator.language === 'string') tags.push(navigator.language);
  }
  for (const t of tags) {
    const s = String(t).toLowerCase();
    if (s.startsWith('es')) return 'es';
    if (s.startsWith('en')) return 'en';
    if (s.startsWith('de')) return 'de';
  }
  return 'de';
}

/** @param {string} locale */
export function normalizeLocale(locale) {
  return LOCALES.includes(locale) ? locale : 'de';
}

/**
 * String per Pfad holen (z. B. "toolbar.modell"), {platzhalter} ersetzen.
 * Fallback: Deutsch, dann Pfad selbst.
 * @param {string} locale @param {string} path @param {Record<string, string|number>} [vars]
 */
export function t(locale, path, vars) {
  const dict = STRINGS[normalizeLocale(locale)] ?? DE;
  const get = (d) => String(path).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), d);
  let s = get(dict);
  if (typeof s !== 'string') s = get(DE);
  if (typeof s !== 'string') return path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/**
 * Sprachneutrale Manifest-Ansicht: kanonische DE-Felder, bei i18n-Segment
 * in der Ziellokale ueberschrieben (Titel, Objectives, Labels, Messungs- und
 * Aufgabentexte). Vektoren/Ids/Toleranzen bleiben kanonisch.
 * @param {Record<string, unknown>} [manifest] @param {string} locale
 */
export function localizeManifest(manifest, locale) {
  const loc = normalizeLocale(locale);
  const base = manifest && typeof manifest === 'object' ? { ...manifest } : {};
  if (loc === 'de') return base;
  const seg = base.i18n && typeof base.i18n === 'object' ? base.i18n[loc] : null;
  if (!seg || typeof seg !== 'object') return base;
  const out = { ...base };
  if (typeof seg.title === 'string') out.title = seg.title;
  if (Array.isArray(seg.objectives)) out.objectives = seg.objectives;
  if (Array.isArray(seg.labels)) out.labels = seg.labels;
  if (Array.isArray(seg.measurements)) {
    const byId = new Map(seg.measurements.map((m) => [m?.id, m]));
    if (Array.isArray(out.measurements)) {
      out.measurements = out.measurements.map((m) =>
        m && typeof m.id === 'string' && typeof byId.get(m.id)?.text === 'string'
          ? { ...m, text: byId.get(m.id).text }
          : m
      );
    }
  }
  if (Array.isArray(seg.tasks)) {
    const byId = new Map(seg.tasks.map((x) => [x?.id, x]));
    if (Array.isArray(out.tasks)) {
      out.tasks = out.tasks.map((x) => {
        if (!x || typeof x.id !== 'string') return x;
        const tr = byId.get(x.id);
        if (!tr || typeof tr !== 'object') return x;
        const c = { ...x };
        if (typeof tr.prompt === 'string') c.prompt = tr.prompt;
        if (typeof tr.expected === 'string') c.expected = tr.expected;
        return c;
      });
    }
  }
  return out;
}

/**
 * Alle [data-i18n]-Knoten + [data-i18n-ph] (Platzhalter) + [data-i18n-aria]
 * in einem Wurzelknoten auf die Lokale umschalten. Gibt die Lokale zurueck.
 * @param {string} locale @param {ParentNode} [root]
 */
export function applyLocale(locale, root) {
  const loc = normalizeLocale(locale);
  const scope = root ?? (typeof document !== 'undefined' ? document : null);
  if (!scope) return loc;
  for (const el of scope.querySelectorAll('[data-i18n]')) {
    el.textContent = t(loc, el.getAttribute('data-i18n') ?? '');
  }
  for (const el of scope.querySelectorAll('[data-i18n-ph]')) {
    el.setAttribute('placeholder', t(loc, el.getAttribute('data-i18n-ph') ?? ''));
  }
  for (const el of scope.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(loc, el.getAttribute('data-i18n-aria') ?? ''));
  }
  if (typeof document !== 'undefined') document.documentElement.lang = loc;
  return loc;
}
