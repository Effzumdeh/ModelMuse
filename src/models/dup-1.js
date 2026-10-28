/**
 * ER-Modell (DuP-1) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * 2D-Pfad gemaess docs/MODELLPORTFOLIO-VORSCHLAG.md (Notation statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'ER-Modell (DuP-1)', category: 'sonstiges', detailLevel: 2, parts: ['Entitaetstafel','Primaerschluesselfeld','Beziehungslinie','Kardinalitaetsmarke'], units: 'm' };
export const meta_i18n = { en: { title: 'ER model (DuP-1)', parts: ['Customer entity box', 'Primary key field', 'Relationship line', 'Cardinality'] }, es: { title: 'Modelo ER (DuP-1)', parts: ['Tabla de entidad cliente', 'Campo de clave primaria', 'Línea de relación', 'Cardinalidad'] } };
export const meta_2d = { kind: 'er', version: 1 };
export const diagram = { kind: 'er', title: 'ER-Modell (DuP-1)', labels: ['Entitaetstafel','Primaerschluesselfeld','Beziehungslinie','Kardinalitaetsmarke'], measurement: 'Tafelbreite: 40 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
