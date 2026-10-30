/**
 * Projektbaum V2 (d3-light, kind: baum) — Dateibaum eines Schulprojekts.
 * Sichtbar neue Variante zu demo-2d-d3 (dort: Rechnernetz, kind netz,
 * Sterntopologie): Baum-Layout mit Tiefenstufen statt Radialnetz,
 * neues Fachthema.
 * 2D-Datenmodul: Lib im Vendor (2d-d3), Modul liefert nur Knoten/Kanten.
 */
import { renderGraph2D } from '2d-d3';
export const meta = { title: 'Projekt Dateibaum', category: 'sonstiges', detailLevel: 2, parts: ['Projekt', 'Doku', 'Code', 'Tests'], units: 'm' };
export const meta_i18n = { en: { title: 'Project file tree', parts: ['Project', 'Docs', 'Code', 'Tests'] }, es: { title: 'Arbol de proyecto', parts: ['Proyecto', 'Docs', 'Codigo', 'Pruebas'] } };
export const meta_2d = { kind: 'baum', version: 1 };
export const graph = { kind: 'baum', title: 'Projekt Dateibaum', labels: ['Projekt', 'Doku', 'Code', 'Tests'], measurement: 'Kantenlaenge: 12 cm', nodes: [{ id: 'p', label: 'Projekt' }, { id: 'd', label: 'Doku' }, { id: 'c', label: 'Code' }, { id: 't', label: 'Tests' }], edges: [{ from: 'p', to: 'd', label: '' }, { from: 'p', to: 'c', label: '' }, { from: 'p', to: 't', label: '' }] };
export function init(container, params) {
  void params;
  renderGraph2D(container, graph);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
