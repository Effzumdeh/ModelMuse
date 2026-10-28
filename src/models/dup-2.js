/**
 * BPMN-Prozess (DuP-2) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * 2D-Pfad gemaess docs/MODELLPORTFOLIO-VORSCHLAG.md (Prozessnotation statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'BPMN-Prozess (DuP-2)', category: 'sonstiges', detailLevel: 2, parts: ['Startereignis','Aufgabe','Entscheidung','Endereignis'], units: 'm' };
export const meta_i18n = { en: { title: 'BPMN process (DuP-2)', parts: ['Start event', 'Task', 'Gateway', 'End event'] }, es: { title: 'Proceso BPMN (DuP-2)', parts: ['Evento de inicio', 'Tarea', 'Compuerta', 'Evento de fin'] } };
export const meta_2d = { kind: 'bpmn', version: 1 };
export const diagram = { kind: 'bpmn', title: 'BPMN-Prozess (DuP-2)', labels: ['Startereignis','Aufgabe','Entscheidung','Endereignis'], measurement: 'Pfadlaenge: 60 cm' };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
