/**
 * Teil 3 — Harness-Scoreboard-UI (DOM-Bindung, Logik in runtime/scoreboard.js).
 * Zeigt die sechs Fehlerklassen je Modell plus Anbieter-Vergleich
 * (bestes Modell je Domaene Geometrie/Didaktik).
 */
import { SIX_CLASSES, scoreReport, compareProviders, sollWerte } from '../runtime/scoreboard.js';
import { sollFromMatrixEntry } from '../runtime/verify.js';
import { tt } from './i18n.js';

/**
 * @param {HTMLElement} el
 * @param {Array<{ modelId?: string, verdict?: string, layers?: Array<{ layer: string, verdict: string, criteria: Array<{ id: string, verdict: string, expected?: string, actual?: string }> }> }>} reports
 * @param {{ providerOf?: (id: string) => string }} [opts]
 */
export function renderScoreboard(el, reports, opts = {}) {
  el.innerHTML = '';
  if (!reports || reports.length === 0) {
    el.textContent = tt('harness.leer');
    return { scores: [], compare: compareProviders([]) };
  }
  const scores = reports.map((r) => ({ ...scoreReport(r), providerId: opts.providerOf ? opts.providerOf(r.modelId) : 'meta-muse' }));
  const table = document.createElement('table');
  table.className = 'harness-table';
  const head = document.createElement('tr');
  for (const h of [tt('harness.spalteModell'), tt('harness.spalteAmpel'), ...SIX_CLASSES.map((c) => c.key), tt('harness.spaltePunkte'), 'S1', 'S5']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  table.appendChild(head);
  for (const s of scores) {
    const tr = document.createElement('tr');
    const cells = [s.modelId, s.ampel, ...SIX_CLASSES.map((c) => s.classes[c.key]), `${s.punkte}`, s.s1, s.s5];
    cells.forEach((v, i) => {
      const td = document.createElement('td');
      td.textContent = String(v);
      if (i >= 2 && i < 8) td.className = v === 'pass' ? 'crit-pass' : v === 'fail' ? 'crit-fail' : 'crit-offen';
      tr.appendChild(td);
    });
    table.appendChild(tr);
  }
  el.appendChild(table);
  const cmp = compareProviders(scores);
  const p = document.createElement('p');
  p.className = 'harness-compare';
  const geo = cmp.geometrie ? `${cmp.geometrie.id} (${cmp.geometrie.fails} Fails, ${cmp.geometrie.punkte} P)` : tt('harness.vergleichLeer');
  const did = cmp.didaktik ? `${cmp.didaktik.id} (${cmp.didaktik.punkte} P)` : tt('harness.vergleichLeer');
  p.textContent = tt('harness.vergleich', { n: cmp.anzahl, geo, did });
  el.appendChild(p);
  return { scores, compare: cmp };
}

/**
 * S5-Soll-Werte-Tabelle (M5/M7) zum aktuellen Manifest.
 * O-10: MATRIX aus derselben JSON (src/data/modellmatrix.json, eingebettet als
 * window.__MODELLMATRIX__) — exakte Zeilen bei bekannter Modell-ID, sonst
 * alte Mindesttabelle (graceful). Eigene Zahlen standen nicht hier, sondern in
 * sollWerte (scoreboard.js); angeglichen per optionalem soll-Param.
 * @param {HTMLElement} el
 * @param {unknown} manifest
 * @param {string} [modelId]
 */
export function renderSoll(el, manifest, modelId) {
  const reg = (typeof window !== 'undefined' && window.__MODELLMATRIX__) || null;
  const { rows, ok } = sollWerte(manifest, sollFromMatrixEntry(reg?.[modelId]));
  el.innerHTML = '';
  const table = document.createElement('table');
  for (const r of rows) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = r.soll;
    const b = document.createElement('td');
    b.textContent = String(r.ist);
    b.className = r.ok ? 'crit-pass' : 'crit-fail';
    tr.append(a, b);
    table.appendChild(tr);
  }
  el.appendChild(table);
  const p = document.createElement('p');
  p.textContent = ok ? tt('harness.sollOk') : tt('harness.sollFail');
  el.appendChild(p);
  return ok;
}
