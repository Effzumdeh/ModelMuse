/**
 * UML-Klasse (AE-1) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * 2D-Pfad gemaess docs/MODELLPORTFOLIO-VORSCHLAG.md (flache Notation statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'UML-Klasse (AE-1)', category: 'sonstiges', detailLevel: 2, parts: ['Klassenquader','Attributzeile','Methodenzeile','Vererbungspfeil'], units: 'm' };
export const meta_i18n = { en: { title: 'UML class (AE-1)', parts: ['Class box', 'Attribute row', 'Method row', 'Inheritance arrow'] }, es: { title: 'Clase UML (AE-1)', parts: ['Cuadro de clase', 'Fila de atributos', 'Fila de métodos', 'Flecha de herencia'] } };
export const meta_2d = { kind: 'uml', version: 1 };
export const diagram = { kind: 'uml', title: 'UML-Klasse (AE-1)', labels: ['Klassenquader','Attributzeile','Methodenzeile','Vererbungspfeil'], measurement: 'Quaderbreite: 30 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
