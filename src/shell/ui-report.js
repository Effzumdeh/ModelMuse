/**
 * Verifier-Bericht S1–S5, Ampel, Fallback-Hinweis.
 * Bauplan Abschnitt 3 (ui-report.js). UI-Strings aus der Sprachdatei.
 */
import { tt } from './i18n.js';

/**
 * @param {HTMLElement} el
 * @param {{ modelId: string, iteration: number, layers: Array<{ layer: string, verdict: string, criteria: Array<{ id: string, verdict: string, expected: string, actual: string }> }>, verdict: string, failed: string[] } | null} report
 */
export function renderReport(el, report) {
  el.innerHTML = '';
  if (!report) {
    el.textContent = tt('bericht.leer');
    return;
  }
  const head = document.createElement('div');
  const strongId = document.createElement('strong');
  strongId.textContent = report.modelId;
  const strongVerdict = document.createElement('strong');
  strongVerdict.textContent = report.verdict;
  head.append(`${tt('bericht.modell')} `, strongId, ` · ${tt('bericht.iteration')} ${report.iteration} · ${tt('bericht.ampel')} `, strongVerdict);
  el.appendChild(head);
  const table = document.createElement('table');
  const tb = document.createElement('tbody');
  for (const layer of report.layers) {
    for (const c of layer.criteria) {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td');
      tdId.textContent = `${layer.layer}:${c.id}`;
      const tdV = document.createElement('td');
      tdV.textContent = c.verdict;
      tdV.className = c.verdict === 'pass' ? 'crit-pass' : 'crit-fail';
      const tdA = document.createElement('td');
      tdA.textContent = c.actual;
      tr.append(tdId, tdV, tdA);
      tb.appendChild(tr);
    }
  }
  table.appendChild(tb);
  el.appendChild(table);
  if (report.failed.length > 0) {
    const p = document.createElement('p');
    const code = document.createElement('code');
    code.textContent = report.failed.join(', ');
    p.append(`${tt('bericht.fehler')} `, code);
    el.appendChild(p);
  }
}
