/**
 * F2/F3/F4-Pfade: Hinweis-Panel mit Ersatzmodell- oder 2D-Vermerk.
 * Bauplan Abschnitt 3 (ui-fallback2d.js) und Abschnitt 9 (F2–F4).
 */
import { tt } from './i18n.js';

/**
 * @param {HTMLElement} panel
 * @param {HTMLElement} text
 * @param {string} message
 */
export function showFallback(panel, text, message) {
  text.textContent = message;
  panel.hidden = false;
}

/** @param {HTMLElement} panel */
export function hideFallback(panel) {
  panel.hidden = true;
}

/** @param {string} level */
export function fallbackMessage(level, reason) {
  if (reason === 'no-webgl2') {
    return tt('fallback.keinWebgl2');
  }
  return tt('fallback.darstellung', { level });
}
