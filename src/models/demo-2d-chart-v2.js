/**
 * Kennlinienvergleich V2 (Chart.js tree-shaken, kind: linie) — Wochen-Temperatur.
 * Sichtbar neue Variante zu demo-2d-chart (dort: Wirkungsgrad, balken):
 * Linienverlauf mit Messpunkten statt Balken, neues Fachthema.
 * 2D-Datenmodul: Lib im Vendor (2d-chart), Modul liefert nur die
 * Chart.js-kompatible Config als Daten.
 */
import { renderChart2D } from '2d-chart';
export const meta = { title: 'Temperaturverlauf Woche', category: 'sonstiges', detailLevel: 2, parts: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag'], units: 'm' };
export const meta_i18n = { en: { title: 'Weekly temperature curve', parts: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] }, es: { title: 'Curva semanal de temperatura', parts: ['Lunes', 'Martes', 'Miercoles', 'Jueves'] } };
export const meta_2d = { kind: 'linie', version: 1 };
export const chart = { kind: 'linie', title: 'Temperaturverlauf Woche', labels: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag'], measurement: 'Messhoehe: 2 m, Skala: 30 °C', values: [17, 21, 19, 24], unit: '°C' };
export function init(container, params) {
  void params;
  renderChart2D(container, chart);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
