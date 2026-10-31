/**
 * Diagnose-Export per Copy-Button (Freimodus + Modify, v22):
 * kopiert die redigierte Diagnose (Provider/Modell/HTTP/finish/Usage-Zahlen/
 * Retry/Build + Rohantwort ~2KB, Authorization/Key IMMER redigiert, nie Key
 * im Clipboard). Reine Clipboard-/DOM-Huelle; Textbau + Redaktion liegen in
 * src/runtime/livegen.js (buildDiagnoseText, unit-getestet).
 */
import { buildDiagnoseText } from '../runtime/livegen.js';
import { tt, getLocale } from './i18n.js';

/**
 * Text ins Clipboard kopieren (Clipboard-API, sonst Textarea-Fallback).
 * @param {unknown} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  const s = String(text ?? '');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(s);
      return true;
    }
  } catch { /* Fallback unten */ }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

/** @param {{ hidden?: boolean } | null} btn */
export function showDiagnoseButton(btn) {
  try {
    if (btn) btn.hidden = false;
  } catch { /* Anzeige bleibt */ }
}

/** @param {{ hidden?: boolean } | null} btn */
export function hideDiagnoseButton(btn) {
  try {
    if (btn) btn.hidden = true;
  } catch { /* Anzeige bleibt */ }
}

/**
 * Klick-Verdrahtung fuer einen Diagnose-Copy-Button: kopiert die redigierte
 * Diagnose in der aktuellen Lokale, zeigt kurz Bestaetigung/Fehler.
 * @param {HTMLButtonElement | null} btn
 * @param {() => unknown} getDiagnose Diagnose-Objekt (errorDiagnose-Format)
 */
export function wireDiagnoseCopy(btn, getDiagnose) {
  if (!btn || typeof btn.addEventListener !== 'function') return;
  if (btn.dataset && btn.dataset.diagnoseArmed === 'ja') return;
  try {
    if (btn.dataset) btn.dataset.diagnoseArmed = 'ja';
  } catch { /* weiter ohne Guard */ }
  btn.addEventListener('click', async () => {
    let diag = null;
    try {
      diag = getDiagnose();
    } catch {
      diag = null;
    }
    const text = buildDiagnoseText(diag ?? undefined, getLocale());
    const ok = await copyTextToClipboard(text);
    const orig = btn.textContent;
    try {
      btn.textContent = tt(ok ? 'diagnose.kopiert' : 'diagnose.fehler');
      setTimeout(() => {
        try {
          btn.textContent = orig ?? tt('diagnose.kopieren');
        } catch { /* Label bleibt */ }
      }, 4000);
    } catch { /* Label bleibt unveraendert */ }
  });
}
