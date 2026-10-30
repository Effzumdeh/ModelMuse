/**
 * Technik-Skizze (SVG nativ) — Seitenansicht Wasserkocher, 1 Ansicht.
 * 2D-Datenmodul: Lib im Vendor (2d-svg), Modul liefert nur Daten.
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'Wasserkocher Seitenansicht', category: 'sonstiges', detailLevel: 2, parts: ['Gehaeuse', 'Heizplatte', 'Schalter', 'Fuellstand'], units: 'm' };
export const meta_i18n = { en: { title: 'Kettle side view', parts: ['Housing', 'Hotplate', 'Switch', 'Fill level'] }, es: { title: 'Hervidor vista lateral', parts: ['Carcasa', 'Placa', 'Interruptor', 'Nivel'] } };
export const meta_2d = { kind: 'generic', version: 1 };
export const diagram = { kind: 'generic', title: 'Wasserkocher Seitenansicht', labels: ['Gehaeuse', 'Heizplatte', 'Schalter', 'Fuellstand'], measurement: 'Hoehe: 22 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
