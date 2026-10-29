/**
 * Lab-Auswahl (Labs-Nav + Registry), Ladezustand.
 * Bauplan Abschnitt 3 (ui-model-picker.js).
 */

/**
 * @param {{ models: Array<{ id: string, title: string }>, modelId: string }} store
 * @param {Array<{ id: string, title: string }>} models
 */
export function setModels(store, models) {
  store.models = models.map((m) => ({ id: m.id, title: m.title }));
  if (!store.modelId && store.models.length > 0) {
    // Deterministischer Start: gpu-example (3D) wenn vorhanden, sonst erstes
    // Modell. Dev-Registry (MODEL_IDS-Reihenfolge) und Build-Artefakt
    // (sortiert) starten sonst unterschiedlich (2D-Route ohne iframe).
    store.modelId = store.models.some((m) => m.id === 'gpu-example') ? 'gpu-example' : store.models[0].id;
  }
}
