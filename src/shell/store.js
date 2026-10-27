/**
 * Alpine.store lab: Auswahl, Niveau, Ampel, Aufgabenstand.
 * Bauplan Abschnitt 3 (store.js) und Abschnitt 7 (Niveaustufen).
 * Ampel-Labels aus der Sprachdatei (Teil 5).
 */
import { tt } from './i18n.js';

/**
 * @param {{ store: (name: string, value: unknown) => void }} Alpine
 */
export function createLabStore(Alpine) {
  Alpine.store('lab', {
    models: [],
    modelId: '',
    level: 'aufbau',
    labels: true,
    measurements: true,
    maxLabels: 64,
    ampel: 'gelb',
    tasksDone: {},
    partsHidden: [],
    partResults: {},
  });
}

/** @param {string} ampel */
export function ampelLabel(ampel) {
  if (ampel === 'gruen') return tt('app.ampelGruen');
  if (ampel === 'rot') return tt('app.ampelRot');
  return tt('app.ampelGelb');
}

/**
 * Sichtbare Aufgaben je Niveau (rein deklarativ aus dem Manifest).
 * @param {{ tasks?: Array<{ id: string, level: string }> }} manifest
 * @param {string} level
 */
export function tasksForLevel(manifest, level) {
  const tasks = Array.isArray(manifest?.tasks) ? manifest.tasks : [];
  if (level === 'basis') return [];
  if (level === 'aufbau') return tasks.filter((t) => t.level === 'aufbau');
  return tasks;
}

/**
 * Sichtbare Labels je Niveau: Basis hoechstens 5, sonst alle.
 * @param {{ labels?: string[] }} manifest
 * @param {string} level
 */
export function labelsForLevel(manifest, level) {
  const labels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  if (level === 'basis') return labels.slice(0, 5);
  return labels;
}

/**
 * Sichtbare Messungen je Niveau: Basis keine, sonst alle.
 * @param {{ measurements?: unknown[] }} manifest
 * @param {string} level
 */
export function measurementsForLevel(manifest, level) {
  const ms = Array.isArray(manifest?.measurements) ? manifest.measurements : [];
  if (level === 'basis') return [];
  return ms;
}
