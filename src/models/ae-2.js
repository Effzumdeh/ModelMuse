/**
 * Bubblesort-Vergleich (AE-2) — 2D-Datenmodul (SVG nativ, leichtgewichtig).
 * Rendert ueber den Vendor-Renderer (src/vendor/diagram-2d.js, Spec '2d-svg'):
 * dieses Modul liefert NUR Daten (diagram), keinen three.js-Code, kein WebGL.
 * Balkenhoehen als echte 2D-Balken (keine Perspektiv-Verzerrung) gemaess
 * docs/MODELLPORTFOLIO-VORSCHLAG.md (Algorithmus-Trace statt Raum).
 */
import { renderDiagram2D } from '2d-svg';
export const meta = { title: 'Bubblesort-Vergleich (AE-2)', category: 'sonstiges', detailLevel: 2, parts: ['Balkenfeld','Vergleichsmarker','Tauschpfeil'], units: 'm' };
export const meta_i18n = { en: { title: 'Bubble sort comparison (AE-2)', parts: ['Bar field', 'Comparison marker', 'Swap arrow'] }, es: { title: 'Comparación de burbuja (AE-2)', parts: ['Campo de barras', 'Marcador de comparación', 'Flecha de intercambio'] } };
export const meta_2d = { kind: 'bars', version: 1 };
export const diagram = { kind: 'bars', title: 'Bubblesort-Vergleich (AE-2)', labels: ['Balkenfeld','Vergleichsmarker','Tauschpfeil'], measurement: 'Balkenhoehe: 30 cm', values: [3, 1, 2] };
export function init(container, params) {
  void params;
  renderDiagram2D(container, diagram);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
