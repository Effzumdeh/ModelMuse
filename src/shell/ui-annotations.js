/**
 * Label- und Messungsliste, Bauteil-Checkboxen (ein-/ausblenden)
 * + Harness-Test pro Teil. Callbacks aus main.js, Logik in runtime/parts.js.
 */
import { labelsForLevel, measurementsForLevel } from './store.js';
import { partEntries } from '../runtime/parts.js';
import { tt, getLocale, localizeManifest } from './i18n.js';

/**
 * @param {HTMLElement} el
 * @param {{ labels?: string[], measurements?: Array<{ text?: string }> }} manifest
 * @param {string} level
 * @param {{ labels: boolean, measurements: boolean }} cfg
 * @param {{ hidden?: number[], results?: Record<string, string>, onToggle?: (i: number) => void, onTest?: (i: number) => void, onTestAll?: () => void }} [parts]
 */
export function renderAnnotations(el, manifest, level, cfg, parts = {}) {
  const view = localizeManifest(manifest, getLocale());
  el.innerHTML = '';
  const entries = partEntries(view);
  if (entries.length > 0) {
    const head = document.createElement('li');
    head.className = 'part-head';
    const title = document.createElement('strong');
    title.textContent = tt('bauteile.kopf', { n: entries.length });
    head.appendChild(title);
    if (typeof parts.onTestAll === 'function') {
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'lab-btn lib-btn part-btn';
      all.textContent = tt('bauteile.allePruefen');
      all.addEventListener('click', parts.onTestAll);
      head.appendChild(all);
    }
    el.appendChild(head);
    const hidden = Array.isArray(parts.hidden) ? parts.hidden : [];
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'part-row';
      li.dataset.part = String(e.index);
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !hidden.includes(e.index);
      box.setAttribute('aria-label', tt('bauteile.bauteilAnzeigen', { name: e.name }));
      box.addEventListener('change', () => parts.onToggle?.(e.index));
      li.appendChild(box);
      const name = document.createElement('span');
      name.textContent = e.name;
      li.appendChild(name);
      if (typeof parts.onTest === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lab-btn lib-btn part-btn';
        btn.textContent = tt('bauteile.pruefen');
        btn.addEventListener('click', () => parts.onTest?.(e.index));
        li.appendChild(btn);
      }
      const res = parts.results?.[String(e.index)];
      if (res) {
        const badge = document.createElement('span');
        badge.className = res === 'pass' ? 'crit-pass' : 'crit-fail';
        badge.textContent = res === 'pass' ? '✓' : '✗';
        li.appendChild(badge);
      }
      el.appendChild(li);
    }
  }
  const labels = cfg.labels ? labelsForLevel(view, level) : [];
  const ms = cfg.measurements && level !== 'basis' ? measurementsForLevel(view, level) : [];
  if (labels.length === 0 && ms.length === 0) {
    el.innerHTML = '<li></li>';
    el.querySelector('li').textContent = tt('bauteile.keineAnnotationen');
    return;
  }
  for (const label of labels) {
    const li = document.createElement('li');
    li.textContent = tt('bauteile.etikett', { label });
    el.appendChild(li);
  }
  for (const m of ms) {
    const li = document.createElement('li');
    li.textContent = tt('bauteile.mass', { text: m?.text ?? '' });
    el.appendChild(li);
  }
}
