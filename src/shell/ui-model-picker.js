/**
 * Lab-Liste, Freimodus-Eingabe, Ladezustand.
 * Bauplan Abschnitt 3 (ui-model-picker.js).
 */

/**
 * @param {{ models: Array<{ id: string, title: string }>, modelId: string }} store
 * @param {Array<{ id: string, title: string }>} models
 */
export function setModels(store, models) {
  store.models = models.map((m) => ({ id: m.id, title: m.title }));
  if (!store.modelId && store.models.length > 0) {
    store.modelId = store.models[0].id;
  }
}

/**
 * @param {{ models: Array<{ id: string, title: string }>, modelId: string }} store
 */
export function getSelected(store) {
  return store.models.find((m) => m.id === store.modelId) ?? null;
}

/**
 * @param {HTMLButtonElement | null} btn
 * @param {boolean} busy
 */
export function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'Lädt …' : 'Laden';
}
