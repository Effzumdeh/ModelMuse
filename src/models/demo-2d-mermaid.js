/**
 * Ablaufdiagramm (Mermaid flow-Chunk) — Photosynthese-Prozess.
 * 2D-Datenmodul: Lib im Vendor (2d-mermaid, Chunk-Selektion), Modul liefert
 * nur Daten (Mermaid-DSL als Text, kein DOM im Modul).
 */
import { renderMermaid2D } from '2d-mermaid';
export const meta = { title: 'Photosynthese Ablauf', category: 'pflanze', detailLevel: 2, parts: ['Lichtreaktion', 'Wassermangel', 'Calvin-Zyklus', 'Glukose', 'Spaltoeffnung'], units: 'm' };
export const meta_i18n = { en: { title: 'Photosynthesis flow', parts: ['Light reaction', 'Water shortage', 'Calvin cycle', 'Glucose', 'Stomata'] }, es: { title: 'Fotosintesis flujo', parts: ['Fase luminica', 'Falta de agua', 'Ciclo de Calvin', 'Glucosa', 'Estomas'] } };
export const meta_2d = { kind: 'fluss', version: 1 };
export const mermaid = { diagram: 'fluss', title: 'Photosynthese Ablauf', labels: ['Lichtreaktion', 'Wassermangel', 'Calvin-Zyklus', 'Glukose', 'Spaltoeffnung'], measurement: 'Dauer: 6 h, Band: 60 cm', source: 'graph TD\n  A[Lichtreaktion] --> B{Wassermangel?}\n  B -->|nein| C[Calvin-Zyklus]\n  C --> D[Glukose]\n  B -->|ja| E[Spaltoeffnung zu]' };
export function init(container, params) {
  void params;
  renderMermaid2D(container, mermaid);
  return {
    update(_patch) {},
    dispose() { if (container) container.innerHTML = ''; },
  };
}
