/**
 * Technik-Skizze V2 (SVG nativ, kind: chain) — Fahrrad-Antriebsstrang.
 * Sichtbar neue Variante zu demo-2d-svg (dort: Wasserkocher, kind generic,
 * 2x2-Raster): anderes Objekt, Ketten-Layout, 4 Bauteile in Reihe.
 * 2D-Datenmodul: Lib im Vendor (2d-svg), Modul liefert nur Daten.
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'Fahrrad Antriebsstrang', category: 'sonstiges', detailLevel: 2, parts: ['Pedal', 'Kettenblatt', 'Kette', 'Hinterrad'], units: 'm' };
export const meta_i18n = { en: { title: 'Bicycle drivetrain', parts: ['Pedal', 'Chainring', 'Chain', 'Rear wheel'] }, es: { title: 'Transmision de bicicleta', parts: ['Pedal', 'Plato', 'Cadena', 'Rueda trasera'] } };
export const meta_2d = { kind: 'chain', version: 1 };
export const diagram = { kind: 'chain', title: 'Fahrrad Antriebsstrang', labels: ['Pedal', 'Kettenblatt', 'Kette', 'Hinterrad'], measurement: 'Kettenlaenge: 110 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
