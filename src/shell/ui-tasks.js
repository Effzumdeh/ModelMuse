/**
 * Aufgabenansicht je Niveau, Antwortpruefung (Toleranz in Prozent).
 * Bauplan Abschnitt 3 (ui-tasks.js) und Abschnitt 7 (Niveaustufen).
 */
import { tasksForLevel } from './store.js';
import { tt, getLocale, localizeManifest } from './i18n.js';

/**
 * @param {HTMLElement} el
 * @param {{ tasks?: Array<{ id: string, level: string, type: string, prompt: string, expected: string, tolerance: number }> }} manifest
 * @param {string} level
 * @param {Record<string, boolean>} done
 * @param {(id: string, ok: boolean) => void} onAnswer
 */
export function renderTasks(el, manifest, level, done, onAnswer) {
  const view = localizeManifest(manifest, getLocale());
  el.innerHTML = '';
  const tasks = tasksForLevel(view, level);
  if (tasks.length === 0) {
    el.innerHTML = '<li></li>';
    el.querySelector('li').textContent = level === 'basis'
      ? tt('aufgabenFramework.basisLeer')
      : tt('aufgabenFramework.keineAufgaben');
    return;
  }
  for (const task of tasks) {
    const li = document.createElement('li');
    const label = document.createElement('div');
    label.textContent = task.prompt;
    li.appendChild(label);
    if (task.type === 'messwert') {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.setAttribute('aria-label', tt('aufgabenFramework.antwortLabel', { id: task.id }));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = tt('aufgabenFramework.pruefen');
      const out = document.createElement('span');
      out.setAttribute('role', 'status');
      btn.addEventListener('click', () => {
        const ok = checkNumeric(input.value, task.expected, task.tolerance);
        out.textContent = ok ? tt('aufgabenFramework.richtig') : tt('aufgabenFramework.nochNicht', { erwartet: task.expected });
        onAnswer(task.id, ok);
      });
      li.append(' ', input, ' ', btn, ' ', out);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = done[task.id] ? tt('aufgabenFramework.erledigt') : tt('aufgabenFramework.alsErledigt');
      btn.addEventListener('click', () => {
        onAnswer(task.id, true);
        btn.textContent = tt('aufgabenFramework.erledigt');
      });
      li.append(' ', btn);
    }
    el.appendChild(li);
  }
}

/**
 * Numerische Antwortpruefung mit Toleranz (Prozent).
 * @param {string} given
 * @param {string} expected Zahl als Text, Einheit optional
 * @param {number} tolerance
 */
export function checkNumeric(given, expected, tolerance) {
  const num = (/** @type {string} */ s) => {
    const m = /-?\d+(?:[.,]\d+)?/.exec(s);
    return m ? Number(m[0].replace(',', '.')) : Number.NaN;
  };
  const g = num(String(given));
  const e = num(String(expected));
  if (!Number.isFinite(g) || !Number.isFinite(e)) return false;
  if (e === 0) return g === 0;
  const tol = Number.isFinite(tolerance) ? tolerance : 0;
  return Math.abs((g - e) / e) * 100 <= tol;
}
