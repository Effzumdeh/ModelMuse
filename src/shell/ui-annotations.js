/**
 * Label- und Messungsliste, Beschriftungs-Checkboxen (ein-/ausblenden).
 * Phase 2 (H3): keine Etikett:/Maß:-Bullet-Dopplung mehr — Checkbox-Liste plus
 * kompakte Maß-Badge-Chips; Panel-Titel trägt die Anzahl (main.js).
 * Callbacks aus main.js.
 */
import { labelsForLevel, measurementsForLevel } from './store.js';
import { partEntries } from '../runtime/parts.js';
import { tt, getLocale, localizeManifest } from './i18n.js';

/**
 * @param {HTMLElement} el
 * @param {{ labels?: string[], measurements?: Array<{ text?: string }> }} manifest
 * @param {string} level
 * @param {{ labels: boolean, measurements: boolean }} cfg
 * @param {{ hidden?: number[], onToggle?: (i: number) => void }} [parts]
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
  // H3-Dopplung gestrichen: keine Etikett:/Maß:-Bullets — Maße als Badge-Chips.
  if (ms.length > 0) {
    const wrap = document.createElement('li');
    wrap.className = 'measure-badges';
    for (const m of ms) {
      const b = document.createElement('span');
      b.className = 'measure-badge';
      b.textContent = m?.text ?? '';
      b.title = m?.text ?? '';
      wrap.appendChild(b);
    }
    el.appendChild(wrap);
  }
}
