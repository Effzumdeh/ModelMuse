/**
 * Teil 2 — Sitzungs-Modellbibliothek (reine Funktionen, kein DOM).
 * KEINE stille Persistenz: Eintraege leben im Speicher; Session-Storage nur
 * mit ausdruecklicher Zustimmung (Consent-Flag), nie localStorage, nie Keys.
 * Kuratierte 10er-Bibliothek (src/models) bleibt unberuehrt — Referenzen
 * darauf tragen kind 'kuratiert' und sind schreibgeschuetzt.
 */

const ID_RE = /^[a-z0-9-]{2,32}$/;

/** @returns {{ entries: Array<Record<string, unknown>>, consent: boolean }} */
export function createLibrary() {
  return { entries: [], consent: false };
}

/** @param {{ consent?: boolean }} lib @param {boolean} consent */
export function setConsent(lib, consent) {
  lib.consent = consent === true;
  return lib.consent;
}

/**
 * @param {{ entries: Array<Record<string, unknown>> }} lib
 * @param {{ id: string, title: string, providerId?: string, modelId?: string, source: string, manifest?: unknown, parentId?: string | null, kind?: string }} args
 */
export function addEntry(lib, args) {
  const id = String(args?.id ?? '').trim();
  if (!ID_RE.test(id)) throw Object.assign(new Error('E-LIB-ID: id ungueltig (a-z0-9-, 2-32)'), { code: 'E-LIB-ID' });
  if (lib.entries.some((e) => e.id === id)) throw Object.assign(new Error('E-LIB-DUP: id existiert'), { code: 'E-LIB-DUP' });
  const source = String(args?.source ?? '');
  const hasInit = /export\s+(async\s+function\s+init|function\s+init|const\s+init)\b/.test(source);
  if (!source.includes('export const meta') || !hasInit) {
    throw Object.assign(new Error('E-LIB-SOURCE: kein gueltiges Modul'), { code: 'E-LIB-SOURCE' });
  }
  const siblings = lib.entries.filter((e) => e.id === id || e.parentId === id).length;
  const entry = {
    id,
    rev: siblings + 1,
    title: String(args?.title ?? id).slice(0, 80),
    kind: args?.kind === 'kuratiert' ? 'kuratiert' : 'sitzung',
    providerId: String(args?.providerId ?? 'meta-muse'),
    modelId: String(args?.modelId ?? 'muse-spark-1.3-contributor'),
    parentId: args?.parentId ?? null,
    source,
    manifest: args?.manifest ?? null,
    ampel: 'offen',
    scores: null,
    createdAt: new Date().toISOString(),
  };
  lib.entries.push(entry);
  return entry;
}

/** @param {{ entries: Array<Record<string, unknown>> }} lib @param {string} id */
export function getEntry(lib, id) {
  return lib.entries.find((e) => e.id === id) ?? null;
}

/** @param {{ entries: Array<Record<string, unknown>> }} lib */
export function listEntries(lib) {
  return [...lib.entries].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * @param {{ entries: Array<Record<string, unknown>> }} lib
 * @param {string} id
 */
export function removeEntry(lib, id) {
  const e = getEntry(lib, id);
  if (!e) throw Object.assign(new Error('E-LIB-NOTFOUND: Eintrag fehlt'), { code: 'E-LIB-NOTFOUND' });
  if (e.kind === 'kuratiert') throw Object.assign(new Error('E-LIB-READONLY: kuratiert ist Referenz'), { code: 'E-LIB-READONLY' });
  lib.entries = lib.entries.filter((x) => x.id !== id);
  return true;
}

/**
 * @param {{ entries: Array<Record<string, unknown>> }} lib
 * @param {string} id
 * @param {{ ampel?: string, scores?: unknown }} status
 */
export function touchEntryStatus(lib, id, status = {}) {
  const e = getEntry(lib, id);
  if (!e) throw Object.assign(new Error('E-LIB-NOTFOUND: Eintrag fehlt'), { code: 'E-LIB-NOTFOUND' });
  if (typeof status.ampel === 'string') e.ampel = status.ampel;
  if (status.scores !== undefined) e.scores = status.scores;
  return e;
}

/**
 * Export als .js-Datei (Provenienz im Kopfkommentar, ohne Key).
 * @param {{ entries: Array<Record<string, unknown>> }} lib
 * @param {string} id
 */
export function exportEntry(lib, id) {
  const e = getEntry(lib, id);
  if (!e) throw Object.assign(new Error('E-LIB-NOTFOUND: Eintrag fehlt'), { code: 'E-LIB-NOTFOUND' });
  const head = [
    `// SkillSpark-Modellbibliothek: ${e.id} (Rev ${e.rev}, ${e.kind})`,
    `// Titel: ${e.title} | Anbieter: ${e.providerId} | Modell: ${e.modelId}`,
    `// Export: ${new Date().toISOString()} — kein Key enthalten.`,
    '',
  ].join('\n');
  return { filename: `${e.id}-r${e.rev}.js`, text: head + String(e.source) };
}

/**
 * Import-Parser: reine Modulquelle (ggf. mit Bibliotheks-Kopf) pruefen.
 * @param {string} text
 */
export function parseImportedSource(text) {
  const src = String(text ?? '');
  const start = src.indexOf('export const meta');
  const source = (start >= 0 ? src.slice(start) : src).trim();
  const hasInit = /export\s+(async\s+function\s+init|function\s+init|const\s+init)\b/.test(source);
  if (!source.includes('export const meta') || !hasInit) {
    throw Object.assign(new Error('E-LIB-SOURCE: kein gueltiges Modul'), { code: 'E-LIB-SOURCE' });
  }
  if (/<\/script/i.test(source)) throw Object.assign(new Error('E-LIB-SOURCE: script-Tag verboten'), { code: 'E-LIB-SOURCE' });
  return { source };
}

/**
 * Serialisierung nur mit Zustimmung (Session-Storage durch UI-Schicht).
 * @param {{ entries: Array<Record<string, unknown>>, consent?: boolean }} lib
 */
export function serializeForSession(lib) {
  if (!lib.consent) throw Object.assign(new Error('E-LIB-CONSENT: keine Zustimmung'), { code: 'E-LIB-CONSENT' });
  return JSON.stringify({ v: 1, entries: lib.entries });
}

/**
 * @param {string} json
 * @returns {{ entries: Array<Record<string, unknown>>, consent: boolean }}
 */
export function restoreFromSession(json) {
  const data = JSON.parse(String(json));
  if (!data || data.v !== 1 || !Array.isArray(data.entries)) {
    throw Object.assign(new Error('E-LIB-RESTORE: Daten ungueltig'), { code: 'E-LIB-RESTORE' });
  }
  const lib = createLibrary();
  for (const e of data.entries) {
    if (e && typeof e.id === 'string' && typeof e.source === 'string') lib.entries.push(e);
  }
  return lib;
}
