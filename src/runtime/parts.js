/**
 * Bauteil-Toggles (rein, DOM-frei): Teileliste aus Manifest, Hidden-State,
 * Harness-Check pro Teil (Meta-Eintrag, addLabel-Quelle, Manifest-Label).
 * Bauplan-Erw.: Teil 3 Bauteil-Checkboxen + Harness-Test pro Teil.
 * Vertrags-Absatz (A-06, Option b): player.setParts sendet
 * {labels:{hidden}, parts:{hidden}} an den Gast. Ausgewertet wird nur
 * labels.hidden. parts.hidden ist optional — kuratierte Gaeste ignorieren
 * es graceful (kein Geometrie-Umbau, Provenienz bleibt); Gaeste DUERFEN
 * es kuenftig auswerten.
 */

/**
 * @param {{ labels?: unknown[], parts?: unknown[] }} manifest
 * @returns {Array<{ index: number, name: string }>}
 */
export function partEntries(manifest) {
  const labels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  const parts = Array.isArray(manifest?.parts) ? manifest.parts : labels;
  const names = labels.length > 0 ? labels : parts;
  return names.map((n, i) => ({ index: i, name: String(n) }));
}

/**
 * @param {number[]} hidden
 * @param {number} index
 * @returns {number[]} neuer Hidden-State (sortiert, ohne Duplikate)
 */
export function toggleHidden(hidden, index) {
  const set = new Set(Array.isArray(hidden) ? hidden : []);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  return [...set].sort((a, b) => a - b);
}

/**
 * Bestandteil-Erklaerungen zur Ansicht (lokalisiert, mit Fallback de->en):
 * je Eintrag ein Text in Reihenfolge der partEntries; fehlt die Lokale,
 * faellt die Ansicht auf Deutsch (dann Englisch) zurueck, fehlende
 * Einzeltexte auf '' (Button blendet sich dann aus).
 * @param {{ labels?: unknown[], parts?: unknown[], explanations?: unknown, i18n?: unknown }} [manifest]
 * @param {string} [locale]
 * @returns {string[]}
 */
export function partExplanations(manifest, locale = 'de') {
  const entries = partEntries(manifest);
  if (entries.length === 0) return [];
  const loc = locale === 'en' || locale === 'es' ? locale : 'de';
  const base = Array.isArray(manifest?.explanations) ? manifest.explanations.map(String) : [];
  const seg = manifest?.i18n && typeof manifest.i18n === 'object' ? manifest.i18n[loc] : null;
  const locArr = seg && typeof seg === 'object' && Array.isArray(seg.explanations) ? seg.explanations.map(String) : [];
  // de-Ansicht: kanonisch; en/es: Lokale, sonst kanonisch.
  if (loc === 'de') return entries.map((e) => (typeof base[e.index] === 'string' ? base[e.index] : ''));
  return entries.map((e) => locArr[e.index] ?? base[e.index] ?? '');
}

/**
 * addLabel-Aufruf mit EXAKTEM Text in der Quelle (positional oder Objektform).
 * @param {string} source
 * @param {string} name
 */
export function hasLabelCall(source, name) {
  const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`addLabel\\s*\\([^)]*['"\`]${esc}['"\`]`, 's');
  return re.test(String(source));
}

/**
 * Harness-Test fuer EIN Bauteil (ohne Browser/Netz/Key).
 * @param {string} source Modulquelle
 * @param {{ labels?: string[] }} manifest
 * @param {number} index
 */
export function checkPart(source, manifest, index) {
  const entries = partEntries(manifest);
  const entry = entries[index];
  const name = entry ? entry.name : `Teil ${index}`;
  const criteria = [];
  if (!entry) {
    criteria.push({ id: 'part-index', verdict: 'fail', expected: `Index < ${entries.length}`, actual: `${index}` });
    return { index, name, verdict: 'fail', criteria };
  }
  criteria.push({
    id: 'part-meta',
    verdict: entry.name.length >= 2 ? 'pass' : 'fail',
    expected: 'Bauteilname >= 2 Zeichen',
    actual: entry.name,
  });
  criteria.push({
    id: 'part-label-quelle',
    verdict: hasLabelCall(source, entry.name) ? 'pass' : 'fail',
    expected: `addLabel mit Text „${entry.name}“`,
    actual: hasLabelCall(source, entry.name) ? 'gefunden' : 'fehlt',
  });
  const inManifest = Array.isArray(manifest?.labels) && manifest.labels.includes(entry.name);
  criteria.push({
    id: 'part-manifest',
    verdict: inManifest ? 'pass' : 'fail',
    expected: 'Label im Manifest',
    actual: inManifest ? 'enthalten' : 'fehlt',
  });
  return {
    index,
    name,
    verdict: criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail',
    criteria,
  };
}

/**
 * Harness-Test fuer ALLE Bauteile eines Modells.
 * @param {string} source
 * @param {{ labels?: string[] }} manifest
 */
export function checkAllParts(source, manifest) {
  const entries = partEntries(manifest);
  const parts = entries.map((e) => checkPart(source, manifest, e.index));
  return {
    count: parts.length,
    passed: parts.filter((p) => p.verdict === 'pass').length,
    verdict: parts.length > 0 && parts.every((p) => p.verdict === 'pass') ? 'pass' : 'fail',
    parts,
  };
}
