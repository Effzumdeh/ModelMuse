/**
 * Schulformel (KaTeX Font-Subsetting) — pq-Formel mit Diskriminante.
 * 2D-Datenmodul: Lib im Vendor (2d-katex, 5 Fonts ~60 KB), Modul liefert
 * nur den LaTeX-String als Daten (throwOnError:true im Renderer).
 */
import { renderMath2D } from '2d-katex';
export const meta = { title: 'pq-Formel Loesungen', category: 'sonstiges', detailLevel: 2, parts: ['Normalform', 'Diskriminante', 'pq-Formel', 'Loesungen'], units: 'm' };
export const meta_i18n = { en: { title: 'Quadratic formula roots', parts: ['Standard form', 'Discriminant', 'Quadratic formula', 'Roots'] }, es: { title: 'Formula cuadratica', parts: ['Forma normal', 'Discriminante', 'Formula', 'Soluciones'] } };
export const meta_2d = { kind: 'formel', version: 1 };
export const formula = { kind: 'formel', title: 'pq-Formel Loesungen', labels: ['Normalform', 'Diskriminante', 'pq-Formel', 'Loesungen'], measurement: 'Formelbreite: 12 cm', tex: 'x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}' };
export function init(container, params) {
  void params;
  renderMath2D(container, formula);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
