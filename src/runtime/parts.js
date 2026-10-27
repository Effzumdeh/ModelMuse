/**
 * Bauteil-Toggles (rein, DOM-frei): Teileliste aus Manifest, Hidden-State,
 * Harness-Check pro Teil (Meta-Eintrag, addLabel-Quelle, Manifest-Label).
 * Bauplan-Erw.: Teil 3 Bauteil-Checkboxen + Harness-Test pro Teil.
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
