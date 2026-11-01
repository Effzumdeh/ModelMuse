/**
 * Lokale Modell-Versionshistorie (rein, DOM-frei, unit-getestet).
 * Bei jedem Modify wird der Vorgaenger-Snapshot (Modulcode + Zeitstempel) je
 * Lab-ID in localStorage abgelegt (Deckel: HISTORY_LIMIT Versionen).
 * Nummerierung V1..VX: Erstgenerierung = V1, jede Ueberarbeitung +1.
 * Anzeige/Wiederherstellung uebernimmt das Bearbeiten-Overlay (ui-modify.js).
 *
 * Storage-Schnittstelle (injizierbar, daher node-testbar):
 * { getItem(k): string|null, setItem(k, v): void, removeItem(k): void }
 * (localStorage erfuellt das direkt).
 */

/** Max. Versionen je Lab-ID (aelteste fallen raus, Nummern bleiben monoton). */
export const HISTORY_LIMIT = 10;

/** Storage-Namespace (v1-Schema: { v: 1, versions: [...] }). */
export const HISTORY_KEY_PREFIX = 'modelmuse-history-v1:';

/**
 * Familien-ID: ein evtl. vorhandenes -modN-Suffix wird gestrippt, damit
 * si-1, si-1-mod1, si-1-mod2 eine gemeinsame Historie (V1..VX) teilen.
 * @param {unknown} id
 */
export function baseLabId(id) {
  return String(id ?? '').replace(/-mod\d+$/, '').slice(0, 32) || 'modell';
}

/**
 * @param {unknown} labId
 */
export function historyKey(labId) {
  const base = baseLabId(labId).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'modell';
  return `${HISTORY_KEY_PREFIX}${base}`;
}

/**
 * @param {{ getItem: (k: string) => string | null } | null | undefined} storage
 * @param {unknown} labId
 * @returns {Array<{ v: number, ts: string, title: string, source: string }>} aufsteigend nach v
 */
export function loadHistory(storage, labId) {
  let raw = null;
  try {
    raw = storage?.getItem(historyKey(labId)) ?? null;
  } catch {
    return [];
  }
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : data?.versions;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const v = Number(e.v);
    const source = String(e.source ?? '');
    if (!Number.isInteger(v) || v < 1) continue;
    if (!source.includes('export const meta')) continue;
    const ts = typeof e.ts === 'string' && !Number.isNaN(Date.parse(e.ts)) ? e.ts : new Date(0).toISOString();
    out.push({ v, ts, title: String(e.title ?? '').slice(0, 80), source });
  }
  out.sort((a, b) => a.v - b.v);
  return out;
}

/**
 * Speichern mit Quota-Eviction: bei vollem localStorage aelteste Versionen
 * rauswerfen und erneut versuchen (mind. die neueste bleibt erhalten).
 * @param {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void } | null | undefined} storage
 * @param {unknown} labId
 * @param {Array<{ v: number, ts: string, title: string, source: string }>} versions
 */
export function saveHistory(storage, labId, versions) {
  if (!storage || typeof storage.setItem !== 'function') {
    throw Object.assign(new Error('E-HIST-SPEICHER: kein Storage'), { code: 'E-HIST-SPEICHER' });
  }
  const key = historyKey(labId);
  const queue = [...versions].sort((a, b) => a.v - b.v);
  let lastErr = null;
  while (queue.length > 0) {
    try {
      storage.setItem(key, JSON.stringify({ v: 1, versions: queue }));
      return [...queue];
    } catch (e) {
      lastErr = e;
      queue.shift(); // aelteste raus, erneut versuchen
    }
  }
  throw Object.assign(new Error(`E-HIST-SPEICHER: ${String((lastErr && lastErr.message) || lastErr || 'blockiert').slice(0, 80)}`), { code: 'E-HIST-SPEICHER' });
}

/**
 * Naechste freie Versionsnummer (monoton, auch nach Deckel-Eviction).
 * @param {Array<{ v: number }>} versions
 */
export function nextVersionNumber(versions) {
  let max = 0;
  for (const e of versions ?? []) {
    const v = Number(e?.v);
    if (Number.isInteger(v) && v > max) max = v;
  }
  return max + 1;
}

/**
 * Prueft Modulquelle (gleiche Tore wie Modify/Import: meta + init).
 * @param {unknown} source
 */
export function assertModuleSource(source) {
  const src = String(source ?? '');
  const hasInit = /export\s+(async\s+function\s+init|function\s+init|const\s+init)\b/.test(src);
  if (!src.includes('export const meta') || !hasInit) {
    throw Object.assign(new Error('E-HIST-SOURCE: kein gueltiges Modul'), { code: 'E-HIST-SOURCE' });
  }
  return src;
}

/**
 * Haengt eine Version an (V = max+1), deckelt auf HISTORY_LIMIT (neueste bleiben).
 * @param {unknown} storage
 * @param {unknown} labId
 * @param {{ source: string, title?: unknown }} snap
 */
export function appendVersion(storage, labId, snap) {
  const source = assertModuleSource(snap?.source);
  const versions = loadHistory(storage, labId);
  const entry = {
    v: nextVersionNumber(versions),
    ts: new Date().toISOString(),
    title: String(snap?.title ?? '').slice(0, 80),
    source,
  };
  versions.push(entry);
  const capped = versions.sort((a, b) => a.v - b.v).slice(-HISTORY_LIMIT);
  saveHistory(storage, labId, capped);
  return { entry, versions: capped };
}

/**
 * Modify-Protokoll: Vorgaenger sichern + Ergebnis als neue Version.
 * Leere Historie -> V1 = Vorgaenger (Erstgenerierung), V2 = Ergebnis.
 * Bestehende Historie -> Vorgaenger ist bereits V(n), Ergebnis wird V(n+1).
 * Best-effort: Storage-Fehler werden als E-HIST-SPEICHER geworfen (UI faengt).
 * @param {unknown} storage
 * @param {{ labId: unknown, prevSource?: unknown, prevTitle?: unknown, nextSource: unknown, nextTitle?: unknown }} args
 */
export function recordModify(storage, args) {
  const labId = baseLabId(args?.labId);
  const out = loadHistory(storage, labId);
  if (out.length === 0) {
    try {
      const { versions } = appendVersion(storage, labId, { source: args?.prevSource, title: args?.prevTitle });
      out.length = 0;
      out.push(...versions);
    } catch {
      /* Vorgaenger ungültig/blockiert: nur Ergebnis sichern */
    }
  }
  const { entry, versions } = appendVersion(storage, labId, { source: args?.nextSource, title: args?.nextTitle });
  return { entry, versions };
}

/**
 * @param {Array<{ v: number }>} versions
 * @param {unknown} v
 */
export function getVersion(versions, v) {
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  return (versions ?? []).find((e) => e?.v === n) ?? null;
}
