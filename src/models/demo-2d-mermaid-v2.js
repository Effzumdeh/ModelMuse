/**
 * Ablaufdiagramm V2 (Mermaid sequenz-Chunk) — Bibliothek-Ausleihe.
 * Sichtbar neue Variante zu demo-2d-mermaid (dort: Photosynthese, fluss/
 * Entscheidungsraute): anderer Diagrammtyp (Sequenz, 4 Akteure, Zeitachse
 * von oben nach unten), neues Fachthema.
 * 2D-Datenmodul: Lib im Vendor (2d-mermaid), Modul liefert nur Daten.
 */
import { renderMermaid2D } from '2d-mermaid';
export const meta = { title: 'Bibliothek Ausleihe', category: 'sonstiges', detailLevel: 2, parts: ['Kunde', 'Katalog', 'Ausleihe', 'Rueckgabe'], units: 'm' };
export const meta_i18n = { en: { title: 'Library lending flow', parts: ['Customer', 'Catalog', 'Lending desk', 'Return'] }, es: { title: 'Prestamo en biblioteca', parts: ['Cliente', 'Catalogo', 'Prestamo', 'Devolucion'] } };
export const meta_2d = { kind: 'sequenz', version: 1 };
export const mermaid = { diagram: 'sequenz', title: 'Bibliothek Ausleihe', labels: ['Kunde', 'Katalog', 'Ausleihe', 'Rueckgabe'], measurement: 'Dauer: 10 min', source: 'sequenceDiagram\n  participant K as Kunde\n  participant T as Katalog\n  participant A as Ausleihe\n  participant R as Rueckgabe\n  K->>T: sucht Titel\n  T->>K: zeigt Treffer\n  K->>A: leiht aus\n  A->>R: bucht Rueckgabe' };
export function init(container, params) {
  void params;
  renderMermaid2D(container, mermaid);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
