# LIVE-SHOTS — Standalone-v14 im geöffneten Live-Viewer (2026-10-29)

6 Screenshots der **Live-Anwendung** `dist-standalone/modelmuse-standalone.html`
(Standalone v14: 10 Modelle = 5× 3D-Showcase + 5× 2D-Demos, Baseten-Direkt BYOK),
jeweils **im geöffneten Live-Viewer fotografiert**: Full-Page-Screenshot mit
**App-Chrome sichtbar** (Header + Sidebar „Modelle (10)" + Viewer), Viewport
**1280×720**, **Labels + Maße eingeschaltet**, **0 pageerrors, 0 console-errors**.

Erzeugt mit: `node scripts/shots-live-standalone.mjs 8131` (eigener lokaler
Server über Repo-Root, kein `file://`; Playwright-Chromium mit SwiftShader-WebGL;
pro Modell Klick in der Sidebar, Warten auf Viewport-Render, dann
`page.screenshot()`). Gates im Skript (ROT bei Verstoß): 10 Sidebar-Labs,
Checkboxen Labels/Maße an (je Shot erneut geprüft), PNG 1280×720 (IHDR),
Dateigröße > 20 KB, 0 pageerrors. Rohdaten: `dist-standalone/shots-live/report.json`.

| Beispiel | Modell | Pfad |
|---|---|---|
| SVG | Wasserkocher Seitenansicht (`demo-2d-svg`) | `dist-standalone/shots-live/demo-2d-svg.png` |
| Mermaid | Photosynthese Ablauf (`demo-2d-mermaid`) | `dist-standalone/shots-live/demo-2d-mermaid.png` |
| Chart | Wirkungsgradvergleich (`demo-2d-chart`) | `dist-standalone/shots-live/demo-2d-chart.png` |
| D3 | Rechnernetz Sterntopologie (`demo-2d-d3`) | `dist-standalone/shots-live/demo-2d-d3.png` |
| KaTeX | pq-Formel Lösungen (`demo-2d-katex`) | `dist-standalone/shots-live/demo-2d-katex.png` |
| 3D | Koffein-Molekül (`chemie-koffein`) | `dist-standalone/shots-live/chemie-koffein.png` |

Lauf 2026-10-29: 6/6 Shots (108–213 KB, alle 1280×720), 0 pageerrors, 0 console-errors.

## Hinweise / kein Rot, aber dokumentiert

- **3D-Shot (`chemie-koffein`)**: Ball-and-Stick-Modell mit Grid rendert (WebGL aktiv);
  `Labels`- + `Maße`-Checkboxen sowie alle 6 `Bauteile`-Schalter sind an. Bei 1280×720
  überlagern sich die großen 3D-Textlabels teils gegenseitig und verdecken das Modell
  teilweise — Darstellung wie von der App geliefert, kein Screenshot-Artefakt.
- **2D-Shot (`demo-2d-d3`)**: Diagramm „Rechnernetz Sterntopologie" rendert als SVG,
  Knoten-/Kantenlabels (`Router`, `1 G`, `Linklänge: 10 m`) plus Ebenen-Panel
  (`Labels`/`Maße` an, 5/5 Bauteile an) sichtbar. Die App zeigt zusätzlich ihren
  eigenen Hinweis „WebGL nicht verfügbar – 2D-Fallback aktiv … 2D-Diagramm aktiv"
  (Produktstand-Meldung der Standalone, kein Fehler des Shots).
- Ältere Belege (`dist-standalone/shots/*.png`, `proof-*.png`) bleiben unverändert;
  diese `shots-live/*.png` sind die Live-Viewer-Belege mit App-Chrome.
