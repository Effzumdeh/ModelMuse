/**
 * ETL-Pipeline (DuP-3) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * 2D-Pfad gemaess docs/MODELLPORTFOLIO-VORSCHLAG.md (Datenfluss statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'ETL-Pipeline (DuP-3)', category: 'sonstiges', detailLevel: 2, parts: ['Quelle','ETL-Stufe','Speicher','Zielsystem'], units: 'm' };
export const meta_i18n = { en: { title: 'ETL pipeline (DuP-3)', parts: ['Source', 'ETL stage', 'Storage', 'Target system'] }, es: { title: 'Pipeline ETL (DuP-3)', parts: ['Fuente', 'Etapa ETL', 'Almacenamiento', 'Sistema destino'] } };
export const meta_2d = { kind: 'etl', version: 1 };
export const diagram = { kind: 'etl', title: 'ETL-Pipeline (DuP-3)', labels: ['Quelle','ETL-Stufe','Speicher','Zielsystem'], measurement: 'Stufenabstand: 50 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
