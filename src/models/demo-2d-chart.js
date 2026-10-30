/**
 * Kennlinienvergleich (Chart.js tree-shaken) — Wirkungsgrad ueber Drehzahl.
 * 2D-Datenmodul: Lib im Vendor (2d-chart, 62 KB gzip), Modul liefert nur
 * die Chart.js-kompatible Config als Daten (kein Canvas-Code im Modul).
 */
import { renderChart2D } from '2d-chart';
export const meta = { title: 'Wirkungsgradvergleich', category: 'sonstiges', detailLevel: 2, parts: ['Variante A', 'Variante B', 'Variante C', 'Variante D'], units: 'm' };
export const meta_i18n = { en: { title: 'Efficiency comparison', parts: ['Variant A', 'Variant B', 'Variant C', 'Variant D'] }, es: { title: 'Comparacion de rendimiento', parts: ['Variante A', 'Variante B', 'Variante C', 'Variante D'] } };
export const meta_2d = { kind: 'balken', version: 1 };
export const chart = { kind: 'balken', title: 'Wirkungsgradvergleich', labels: ['Variante A', 'Variante B', 'Variante C', 'Variante D'], measurement: 'Drehzahl: 3000 1/min, Balken: 8 cm (Werte in %)', values: [82, 91, 76, 88], unit: '%' };
export function init(container, params) {
  void params;
  renderChart2D(container, chart);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
