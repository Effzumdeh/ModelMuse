/**
 * Client-Server-API (AE-3) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * 2D-Pfad gemaess docs/MODELLPORTFOLIO-VORSCHLAG.md (Ablaufkette statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'Client-Server-API (AE-3)', category: 'sonstiges', detailLevel: 2, parts: ['Client','API-Gateway','Server','Datenbank'], units: 'm' };
export const meta_i18n = { en: { title: 'Client-server API (AE-3)', parts: ['Client', 'API gateway', 'Server', 'Database'] }, es: { title: 'API cliente-servidor (AE-3)', parts: ['Cliente', 'Puerta de enlace API', 'Servidor', 'Base de datos'] } };
export const meta_2d = { kind: 'chain', version: 1 };
export const diagram = { kind: 'chain', title: 'Client-Server-API (AE-3)', labels: ['Client','API-Gateway','Server','Datenbank'], measurement: 'Distanz: 1 m' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
