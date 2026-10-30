/**
 * Schulformel V2 (KaTeX Font-Subsetting) — Dreiecksflaeche mit Bruch.
 * Sichtbar neue Variante zu demo-2d-katex (dort: pq-Formel mit Wurzel):
 * neue Formel (Bruch mit Malpunkt), neues Fachthema, neue Legende.
 * 2D-Datenmodul: Lib im Vendor (2d-katex), Modul liefert nur LaTeX.
 */
import { renderMath2D } from '2d-katex';
export const meta = { title: 'Dreiecksflaeche Formel', category: 'sonstiges', detailLevel: 2, parts: ['Grundseite', 'Hoehe', 'Flaecheninhalt', 'Dreieck'], units: 'm' };
export const meta_i18n = { en: { title: 'Triangle area formula', parts: ['Base', 'Height', 'Area', 'Triangle'] }, es: { title: 'Formula del area', parts: ['Base', 'Altura', 'Area', 'Triangulo'] } };
export const meta_2d = { kind: 'formel', version: 1 };
export const formula = { kind: 'formel', title: 'Dreiecksflaeche Formel', labels: ['Grundseite', 'Hoehe', 'Flaecheninhalt', 'Dreieck'], measurement: 'Seitenlaenge: 12 cm', tex: 'A = \\frac{1}{2} \\cdot g \\cdot h' };
export function init(container, params) {
  void params;
  renderMath2D(container, formula);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
