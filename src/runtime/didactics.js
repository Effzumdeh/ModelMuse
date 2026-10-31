/**
 * S5-Didaktik: Manifest-Validierung, Niveau-Regeln, LevelPatch-Bau.
 * Rein deklarativ: keine generierte Paedagogik-Logik im Modellcode.
 * Bauplan Abschnitt 4 (Didaktik-API) und Abschnitt 6 (S5).
 */

/** @typedef {{ ok: boolean, missing: string[], invalid: string[], counts: { labels: number, measurements: number, tasks: Record<string, number> } }} ManifestReport */
/** @typedef {{ id: string, verdict: 'pass' | 'fail', expected: string, actual: string }} CriterionResult */

const LEVELS = Object.freeze(['basis', 'aufbau', 'profi']);
const UNIT_RE = /\d+(?:[.,]\d+)?\s*(mm|cm|m|HE|kB|MB)/;
const TASK_TYPES = Object.freeze(['zuordnung', 'messwert', 'transfer', 'fehlersuche']);

/** @param {unknown} v */
function isVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
  );
}

/**
 * @param {unknown} manifest
 * @returns {ManifestReport} E-S5-MANIFEST bei ok === false
 */
export function validateManifest(manifest) {
  const missing = [];
  const invalid = [];
  const counts = { labels: 0, measurements: 0, tasks: { basis: 0, aufbau: 0, profi: 0 } };
  if (typeof manifest !== 'object' || manifest === null) {
    return { ok: false, missing: ['title', 'track', 'objectives', 'labels', 'measurements', 'tasks'], invalid: ['manifest-not-object'], counts };
  }
  const m = /** @type {Record<string, unknown>} */ (manifest);
  for (const key of ['schemaVersion', 'title', 'track', 'objectives', 'labels', 'measurements', 'tasks']) {
    if (!(key in m)) missing.push(key);
  }
  if (m.schemaVersion !== 1.0) invalid.push('schemaVersion');
  if ('title' in m && (typeof m.title !== 'string' || m.title.length < 3 || m.title.length > 80)) invalid.push('title');
  if ('track' in m && !['SI', 'DuP', 'AE', 'free'].includes(/** @type {string} */ (m.track))) invalid.push('track');
  if ('objectives' in m) {
    const o = /** @type {unknown} */ (m.objectives);
    if (!Array.isArray(o) || o.length < 2 || o.some((s) => typeof s !== 'string' || s.length < 8)) invalid.push('objectives');
  }
  if ('labels' in m) {
    const l = /** @type {unknown} */ (m.labels);
    if (!Array.isArray(l) || l.length < 3) invalid.push('labels');
    else counts.labels = l.length;
  }
  // Bestandteil-Erklaerungen (optional im Schema, Pflicht im Release):
  // wenn vorhanden, je EIN Text pro Label (gleiche Anzahl/Reihenfolge),
  // je 8-500 Zeichen, ohne Markup. Laengen-Deckung zu labels.
  if ('explanations' in m && m.explanations !== undefined && m.explanations !== null) {
    const e = /** @type {unknown} */ (m.explanations);
    const n = Array.isArray(m.labels) ? m.labels.length : -1;
    const okEach =
      Array.isArray(e) &&
      e.length === n &&
      e.every((x) => typeof x === 'string' && x.length >= 8 && x.length <= 500 && !/<\/script/i.test(x));
    if (!okEach) invalid.push('explanations');
  }
  if ('measurements' in m) {
    const ms = /** @type {unknown} */ (m.measurements);
    const okEach =
      Array.isArray(ms) &&
      ms.length >= 1 &&
      ms.every(
        (x) =>
          typeof x === 'object' &&
          x !== null &&
          typeof /** @type {Record<string, unknown>} */ (x).id === 'string' &&
          isVec3(/** @type {Record<string, unknown>} */ (x).from) &&
          isVec3(/** @type {Record<string, unknown>} */ (x).to) &&
          typeof /** @type {Record<string, unknown>} */ (x).text === 'string' &&
          UNIT_RE.test(/** @type {string} */ (/** @type {Record<string, unknown>} */ (x).text))
      );
    if (!okEach) invalid.push('measurements');
    else counts.measurements = /** @type {unknown[]} */ (ms).length;
  }
  if ('tasks' in m) {
    const t = /** @type {unknown} */ (m.tasks);
    const okEach =
      Array.isArray(t) &&
      t.length >= 1 &&
      t.every(
        (x) =>
          typeof x === 'object' &&
          x !== null &&
          LEVELS.includes(/** @type {string} */ (/** @type {Record<string, unknown>} */ (x).level)) &&
          TASK_TYPES.includes(/** @type {string} */ (/** @type {Record<string, unknown>} */ (x).type)) &&
          typeof /** @type {Record<string, unknown>} */ (x).prompt === 'string' &&
          /** @type {string} */ (/** @type {Record<string, unknown>} */ (x).prompt).length >= 8
      );
    if (!okEach) invalid.push('tasks');
    else {
      for (const x of /** @type {Array<Record<string, string>>} */ (t)) {
        counts.tasks[x.level] = (counts.tasks[x.level] ?? 0) + 1;
      }
    }
  }
  // Optionales i18n-Segment (Teil 5, FR 31.10.2026: en/es Pflicht, fr optional
  // aber streng-wenn-vorhanden — kuratierte Sechs + Neugenerierungen liefern fr).
  // EN/ES/FR-Uebersetzungen, NICHT neu generiert, Id-Deckung mit kanonischen Messungen/Aufgaben.
  // Erklaerungen (wenn vorhanden): Laengen-Deckung zu labels, je 8-500 Zeichen.
  if ('i18n' in m && m.i18n !== undefined && m.i18n !== null) {
    const seg = /** @type {Record<string, unknown>} */ (m.i18n);
    const mIds = new Set((Array.isArray(m.measurements) ? m.measurements : []).map((x) => x?.id));
    const tIds = new Set((Array.isArray(m.tasks) ? m.tasks : []).map((x) => x?.id));
    const nLabels = Array.isArray(m.labels) ? m.labels.length : -1;
    const checkSeg = (s) => !!s && typeof s === 'object'
      && typeof s.title === 'string' && s.title.length >= 3
      && Array.isArray(s.objectives) && s.objectives.length === (Array.isArray(m.objectives) ? m.objectives.length : -1)
      && Array.isArray(s.labels) && s.labels.length === nLabels
      && Array.isArray(s.measurements) && s.measurements.every((x) => mIds.has(x?.id) && typeof x?.text === 'string' && x.text.length >= 2)
      && Array.isArray(s.tasks) && s.tasks.every((x) => tIds.has(x?.id) && typeof x?.prompt === 'string' && x.prompt.length >= 8 && typeof x?.expected === 'string' && x.expected.length >= 1)
      && (s.explanations === undefined || (Array.isArray(s.explanations) && s.explanations.length === nLabels && s.explanations.every((x) => typeof x === 'string' && x.length >= 8 && x.length <= 500 && !/<\/script/i.test(x))));
    let i18nOk = typeof seg === 'object';
    for (const loc of ['en', 'es']) {
      i18nOk &&= checkSeg(seg[loc]);
    }
    if (seg.fr !== undefined) i18nOk &&= checkSeg(seg.fr);
    if (!i18nOk) invalid.push('i18n');
  }
  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid, counts };
}

/**
 * Bestandteil-Erklaerungen: Vorhandensein je Lokale (de/en/es/fr, FR seit
 * 31.10.2026: kuratierte Sechs + Neugenerierungen) mit Laengen-Deckung zu
 * labels. Release-Pflicht de/en/es fuer alle Manifeste, fr-Pflicht fuer die
 * kuratierte Sechs (Verify/Tests pruefen Vorhandensein); validateManifest
 * bleibt format-tolerant (optional).
 * @param {unknown} manifest
 * @returns {{ de: boolean, en: boolean, es: boolean, fr: boolean, ok: boolean, detail: string }}
 */
export function checkExplanationsPresence(manifest) {
  const valid = (arr, n) =>
    Array.isArray(arr) &&
    arr.length === n &&
    arr.every((x) => typeof x === 'string' && x.length >= 8 && x.length <= 500 && !/<\/script/i.test(x));
  const m = manifest && typeof manifest === 'object' ? /** @type {Record<string, unknown>} */ (manifest) : {};
  const n = Array.isArray(m.labels) ? m.labels.length : -1;
  const de = valid(m.explanations, n);
  const seg = m.i18n && typeof m.i18n === 'object' ? /** @type {Record<string, unknown>} */ (m.i18n) : {};
  const enSeg = seg.en && typeof seg.en === 'object' ? /** @type {Record<string, unknown>} */ (seg.en) : {};
  const esSeg = seg.es && typeof seg.es === 'object' ? /** @type {Record<string, unknown>} */ (seg.es) : {};
  const frSeg = seg.fr && typeof seg.fr === 'object' ? /** @type {Record<string, unknown>} */ (seg.fr) : {};
  const en = valid(enSeg.explanations, n);
  const es = valid(esSeg.explanations, n);
  const fr = valid(frSeg.explanations, n);
  const ok = n >= 3 && de && en && es;
  return { de, en, es, fr, ok, detail: ok ? `${n} Erklaerungen je Lokale` : `de=${de} en=${en} es=${es} fr=${fr} (labels=${n})` };
}

/**
 * @param {string} level
 * @param {unknown} manifest
 * @returns {CriterionResult[]} E-S5-LEVEL bei verdict fail
 */
export function checkLevelRules(level, manifest) {
  /** @type {CriterionResult[]} */
  const out = [];
  const rep = validateManifest(manifest);
  if (!rep.ok) {
    out.push({ id: 'manifest-gueltig', verdict: 'fail', expected: 'Manifest ok', actual: `missing=${rep.missing.join(',')} invalid=${rep.invalid.join(',')}` });
    return out;
  }
  const m = /** @type {{ labels: string[], measurements: unknown[], tasks: Array<{ level: string, type: string }> }} */ (manifest);
  if (level === 'basis') {
    // Basis-Mechanismus: Patch begrenzt Anzeige auf <=5 Labels, 0 Messungen.
    let patch = null;
    try {
      patch = buildLevelPatch('basis');
    } catch {
      patch = null;
    }
    const okPatch = patch !== null && patch.labels?.max <= 5 && patch.measurements?.enabled === false;
    out.push({
      id: 'basis-labels-max5',
      verdict: okPatch ? 'pass' : 'fail',
      expected: 'Basis-Patch: hoechstens 5 Labels, 0 Messungen',
      actual: patch ? `max=${patch.labels?.max} mess=${patch.measurements?.enabled}` : 'kein Patch',
    });
  }
  if (level === 'aufbau') {
    const n = m.tasks.filter((t) => t.level === 'aufbau').length;
    out.push({
      id: 'aufbau-aufgaben-min2',
      verdict: n >= 2 ? 'pass' : 'fail',
      expected: 'Aufbau enthaelt mindestens 2 Aufgaben',
      actual: `${n} Aufgaben`,
    });
  }
  if (level === 'profi') {
    const transfer = m.tasks.filter((t) => t.level === 'profi' && (t.type === 'transfer' || t.type === 'fehlersuche')).length;
    out.push({
      id: 'profi-transfer-min1',
      verdict: transfer >= 1 ? 'pass' : 'fail',
      expected: 'Profi enthaelt mindestens 1 Transfer-/Fehlersuche-Aufgabe',
      actual: `${transfer} Aufgaben`,
    });
  }
  return out;
}

/**
 * Baut den Patch fuer einen Niveauwechsel: nur Sichtbarkeit/Kamera, nie neues Modell.
 * @param {string} level
 * @returns {{ level: string, labels: { enabled: boolean, max: number }, measurements: { enabled: boolean }, view: null }} E-S5-LEVEL bei unbekanntem Niveau
 */
export function buildLevelPatch(level) {
  if (level === 'basis') {
    return { level, labels: { enabled: true, max: 5 }, measurements: { enabled: false }, view: null };
  }
  if (level === 'aufbau' || level === 'profi') {
    return { level, labels: { enabled: true, max: 64 }, measurements: { enabled: true }, view: null };
  }
  throw Object.assign(new Error(`E-S5-LEVEL: unbekanntes Niveau ${level}`), { code: 'E-S5-LEVEL' });
}

/**
 * Deklarativitaets-Gate: Aufgaben-/Lernzieltexte duerfen nicht im Modulcode stehen.
 * @param {string} source kommentargestrippt wird ausserhalb geprueft
 * @param {string[]} phrases
 * @returns {string[]} gefundene Phrasen (leer = pass)
 */
export function findPedagogyLeak(source, phrases) {
  const code = String(source);
  return phrases.filter((p) => typeof p === 'string' && p.length >= 8 && code.includes(p));
}
