/**
 * Teil 3 — Qualitäts-Scoreboard (reine Funktionen, kein DOM).
 * Sechs Fehlerklassen (M1/M2, aus 3JSBench [20] abgeleitet):
 *  Intersektion, Backface/Normalen, Z-Fighting, Orientierung, Konnektivitaet,
 *  Mesh-Count. Quellen: S2-Geometrie-Layer (statisch oder vermessen) plus
 *  S1/S4/S5 aus dem Verify-Report. Offene (nicht gemessene) Klassen werden
 *  als 'offen' markiert, nicht als 'pass' schoengerechnet.
 */

export const SIX_CLASSES = Object.freeze([
  { key: 'intersect', label: 'Ueberschneidung (S2-intersect)', ids: ['S2-intersect'] },
  { key: 'backface', label: 'Innenseiten/Normalen (S2-backface)', ids: ['S2-backface'] },
  { key: 'flicker', label: 'Z-Fighting/Flacker (S2-flicker)', ids: ['S2-flicker', 'S2-flicker-render'] },
  { key: 'orient', label: 'Orientierung (S2-orient)', ids: ['S2-orient'] },
  { key: 'connect', label: 'Konnektivitaet (S2-connect)', ids: ['S2-connect'] },
  { key: 'meshcount', label: 'Mesh-Budget (S4-meshcount)', ids: ['S4-meshcount', 'S2-meshcount-statisch'] },
]);

/**
 * @param {Array<{ layer: string, criteria: Array<{ id: string, verdict: string }> }>} layers
 * @param {string[]} ids
 */
function findVerdict(layers, ids) {
  for (const l of layers ?? []) {
    for (const c of l?.criteria ?? []) {
      if (ids.includes(c.id)) return c.verdict === 'pass' ? 'pass' : 'fail';
    }
  }
  return 'offen';
}

/**
 * @param {{ modelId?: string, verdict?: string, layers?: Array<{ layer: string, verdict: string, criteria: Array<{ id: string, verdict: string, expected?: string, actual?: string }> }> }} report
 */
export function scoreReport(report) {
  const layers = report?.layers ?? [];
  const classes = {};
  for (const cls of SIX_CLASSES) classes[cls.key] = findVerdict(layers, cls.ids);
  const fails = Object.values(classes).filter((v) => v === 'fail').length;
  const measured = Object.values(classes).filter((v) => v !== 'offen').length;
  const s1 = (layers.find((l) => l.layer === 'S1')?.verdict) ?? 'offen';
  const s5 = (layers.find((l) => l.layer === 'S5')?.verdict) ?? 'offen';
  return {
    modelId: report?.modelId ?? '?',
    ampel: report?.verdict ?? 'offen',
    classes,
    geometryFails: fails,
    geometryMeasured: measured,
    s1,
    s5,
    punkte: measured === 0 ? 0 : Math.round(((measured - fails) / 6) * 100),
  };
}

/**
 * Anbieter-Vergleich: bestes Modell je Domaene (Geometrie = wenigste
 * Klassen-Fails; Didaktik = S5-pass + hoechste Punktzahl).
 * @param {Array<ReturnType<scoreReport> & { providerId?: string, modelId?: string }>} scores
 */
export function compareProviders(scores) {
  const geo = [...scores].sort((a, b) => a.geometryFails - b.geometryFails || b.punkte - a.punkte)[0] ?? null;
  const did = [...scores]
    .filter((s) => s.s5 === 'pass')
    .sort((a, b) => b.punkte - a.punkte)[0] ?? null;
  return {
    geometrie: geo ? { id: geo.modelId, fails: geo.geometryFails, punkte: geo.punkte } : null,
    didaktik: did ? { id: did.modelId, punkte: did.punkte } : null,
    anzahl: scores.length,
  };
}

/**
 * S5-Soll-Werte (M5/M7): jede Checklisten-Zeile gegen S5-Kriterien.
 * @param {unknown} manifest
 */
export function sollWerte(manifest) {
  const m = /** @type {{ labels?: unknown[], measurements?: unknown[], tasks?: Array<{ level: string }>, objectives?: unknown[] }} */ (manifest ?? {});
  const labels = Array.isArray(m.labels) ? m.labels.length : 0;
  const mess = Array.isArray(m.measurements) ? m.measurements.length : 0;
  const tasks = Array.isArray(m.tasks) ? m.tasks : [];
  const rows = [
    { soll: 'Labels ≥ 3', ist: labels, ok: labels >= 3 },
    { soll: 'Messungen ≥ 1', ist: mess, ok: mess >= 1 },
    { soll: 'Ziele ≥ 2', ist: Array.isArray(m.objectives) ? m.objectives.length : 0, ok: Array.isArray(m.objectives) && m.objectives.length >= 2 },
    { soll: 'Aufbau ≥ 2', ist: tasks.filter((t) => t.level === 'aufbau').length, ok: tasks.filter((t) => t.level === 'aufbau').length >= 2 },
    { soll: 'Profi ≥ 1', ist: tasks.filter((t) => t.level === 'profi').length, ok: tasks.filter((t) => t.level === 'profi').length >= 1 },
  ];
  return { rows, ok: rows.every((r) => r.ok) };
}
