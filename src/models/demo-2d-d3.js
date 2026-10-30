/**
 * Rechnernetz-Topologie (d3-light: force-Submodule) — Sternnetz mit Router.
 * 2D-Datenmodul: Lib im Vendor (2d-d3, 23 KB gzip), Modul liefert nur
 * Knoten und Kanten als Daten (kein Layout-Code im Modul).
 */
import { renderGraph2D } from '2d-d3';
export const meta = { title: 'Rechnernetz Sterntopologie', category: 'sonstiges', detailLevel: 2, parts: ['Router', 'Switch Nord', 'Switch Sued', 'Client A', 'Client B'], units: 'm' };
export const meta_i18n = { en: { title: 'Star network topology', parts: ['Router', 'Switch north', 'Switch south', 'Client A', 'Client B'] }, es: { title: 'Topologia de red en estrella', parts: ['Router', 'Switch norte', 'Switch sur', 'Cliente A', 'Cliente B'] } };
export const meta_2d = { kind: 'netz', version: 1 };
export const graph = { kind: 'netz', title: 'Rechnernetz Sterntopologie', labels: ['Router', 'Switch Nord', 'Switch Sued', 'Client A', 'Client B'], measurement: 'Linklaenge: 10 m', nodes: [{ id: 'r', label: 'Router' }, { id: 'n', label: 'Switch Nord' }, { id: 's', label: 'Switch Sued' }, { id: 'a', label: 'Client A' }, { id: 'b', label: 'Client B' }], edges: [{ from: 'r', to: 'n', label: '1 G' }, { from: 'r', to: 's', label: '1 G' }, { from: 'n', to: 'a', label: '' }, { from: 's', to: 'b', label: '' }] };
export function init(container, params) {
  void params;
  renderGraph2D(container, graph);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
