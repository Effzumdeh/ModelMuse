# 2D-V2-Varianten — sichtbar neue Demos (29.10.2026)

Stand: 29.10.2026. Je 2D-Typ genau eine **sichtbar neue** Demo-Variante:
neuer Fachinhalt, neues Layout (anderer Kind/Diagrammtyp), grosszuegige
Abstaende (Vendor-Layouts, Mindestschrift 10 px, Gate-geprueft). Die alten
Demos bleiben unveraendert (Nachweis: Byte-Identitaet zu `dist-2d/vorher/`,
4/5 exakt; d3-Abweichung s. §4). Neue Dateien: `demo-2d-*-v2`
(Modelle, Manifeste, Matrix, Screenshots, Report).

## 1. Vorher / Nachher (je Typ)

| Typ | Vorher (alt, unveraendert) | Nachher V2 (neu) | Neu: Inhalt | Neu: Layout |
|---|---|---|---|---|
| SVG nativ | `demo-2d-svg`: Wasserkocher-Seitenansicht, kind `generic` (2x2-Raster) | `demo-2d-svg-v2`: **Fahrrad-Antriebsstrang** (Pedal, Kettenblatt, Kette, Hinterrad), kind **`chain`** (Reihen-Kette + Antrieb gestrichelt) | Antrieb statt Wasserkocher | Ketten-Layout statt Raster |
| Mermaid | `demo-2d-mermaid`: Photosynthese, diagramm `fluss` (Entscheidungsraute) | `demo-2d-mermaid-v2`: **Bibliothek-Ausleihe**, diagramm **`sequenz`** (4 Akteure, Zeitachse vertikal) | Ausleih-Prozess statt Photosynthese | Sequenz statt Fluss |
| Chart.js | `demo-2d-chart`: Wirkungsgradvergleich, kind `balken` | `demo-2d-chart-v2`: **Temperaturverlauf Woche** (Mo–Do, 17/21/19/24 °C), kind **`linie`** (Kurve mit Messpunkten) | Temperatur statt Wirkungsgrad | Linie statt Balken |
| d3-light | `demo-2d-d3`: Rechnernetz-Sterntopologie, kind `netz` (radial) | `demo-2d-d3-v2`: **Projekt-Dateibaum** (Projekt→Doku/Code/Tests), kind **`baum`** (Tiefenstufen links→rechts) | Dateibaum statt Rechnernetz | Baum statt Netz |
| KaTeX | `demo-2d-katex`: pq-Formel mit Wurzel | `demo-2d-katex-v2`: **Dreiecksflaeche** `A = ½·g·h` (Bruch + Malpunkt) | Flaechenformel statt pq-Formel | Bruch-Layout statt Wurzel-Layout |

Jede V2 nutzt keine einzige V1-Labelzeichenkette wieder
(`tests-unit/2d-v2-varianten.test.mjs`: Frische-Test) und einen anderen
Kind als die V1 (Layout-Test). Schrift-Norm (≥ 10 px), Knoten-Mindestabstand
(≥ 8 px) und Kanten-Regeln gelten ueber `S2-2d-layout` je Variante.

## 2. Belege: Screenshots (Chromium, offline, echte Vendor-Renderer)

- Neu: `dist-2d/demo-2d-{svg,mermaid,chart,d3,katex}-v2.{html,png}`
  + Report `dist-2d/shot-2d-v2-report.json` (Skript `scripts/shot-2d-v2.mjs`).
- Sichtpruefung 29.10.2026 (alle 5 V2-PNGs): Titel + Legende + Massangabe
  lesbar, keine Ueberlappungen, keine unleserlichen Texte.

| V2-Modell | PNG-Bytes | nicht-weisse Pixel | Shapes (Vendor-Render) | S2 | SHA-256 (PNG) |
|---|---|---|---|---|---|
| `demo-2d-svg-v2` | 9 509 | 50 874 | 19 | pass | `cf86ad53…27f8114ca` |
| `demo-2d-mermaid-v2` | 12 142 | 22 025 | 25 | pass | `c72ca5d8…328dd4d2` |
| `demo-2d-chart-v2` | 15 607 | 14 524 | 29 | pass | `4fc3e3b6…45c1409f05a` |
| `demo-2d-d3-v2` | 24 840 | 17 659 | 17 | pass | `cdd9d5a3…18da3bb958` |
| `demo-2d-katex-v2` | 12 159 | 10 150 | 15 | pass | `e54f984a…0432ad99345e` |

## 3. Belege: Tests + Gates (gruen)

- `npm run test:unit`: **159/159 pass** (inkl. neu
  `tests-unit/2d-v2-varianten.test.mjs`: 4 Tests — Layout-Frische,
  Label-Frische, S1+S2-light+Render je V2, Allowlist).
- `node scripts/smoke-2d-varianten.mjs`: **OK (6/6)** — P0-Routing + Gates +
  Rendering der alten Demos unveraendert gruen.
- `node scripts/verify-standalone.mjs`: **OK** — v14-Stempel, 5 LABS + 5 META,
  5 Vendor-IIFE, 362 894 B < 600 KB (V2 aendert Standalone nicht).
- Matrix (`modellmatrix.json` + Manifeste `demo-2d-*-v2.json`): je V2
  `labelsMin: 4`, Einheiten (`cm`/`min`/`°C`), 2 Aufbau- + 1 Profi-Task;
  `matrix.test.mjs` + `didactics.test.mjs` (alle Manifeste) gruen.

## 4. Vorher-Nachweis (alte Demos unveraendert)

`dist-2d/demo-2d-*.png` vs. `dist-2d/vorher/vorher-demo-2d-*.png` (SHA-256):

- svg, mermaid, chart, katex: **byte-identisch** (z. B. svg
  `4323aa25…a23474c4`, mermaid `7d882852…9797c011`).
- **d3: Abweichung vorbestehend** (`0afc6400…` vs. vorher `46f9487e…`):
  Datei-Stempel 15:09 Uhr, also vor dieser Aufgabe (V2-Arbeit ab 15:37 Uhr);
  weder Modell (`src/models/demo-2d-d3.js`, untracked, ungefasst) noch
  Screenshot wurden hier angefasst. V2-d3 (`demo-2d-d3-v2`) ist davon
  unabhaengig neu und Gate-gruen.

## 5. Vendor-Fix nebenbei (sichtbar im V2-Shot)

`src/vendor/mermaid-2d.js`, `pushNode()`: Eine Sequenz-Nachricht (`K->>T`)
hat einen per `participant K as Kunde` gesetzten Anzeigenamen mit der nackten
Id (`K`) ueberschrieben — Akteur-Koepfe zeigten nur Buchstaben. Jetzt wird ein
Label nur noch verfeinert (wenn bisher leer oder nackte Id), nie zurueck
gestutzt. Fluss-Verfeinerung (Kante zuerst, Label-Definition spaeter) bleibt
erhalten. Betroffene Suites (`2d-alle-varianten`, `2d-v2`, volles
`test:unit`) gruen; alte Fluss-/V1-Shots unberuehrt.
