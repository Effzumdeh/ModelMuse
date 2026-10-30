# AKTUELL-Screenshots (Tag nachts-final, 2026-10-29)

Frische Screenshots aller aktuellen Modelle im **geöffneten Viewer**, je Modell mit
**Labels + Maße eingeschaltet**, Viewport **1280×720**, Niveau Aufbau, Ansicht Übersicht.
Kein v10-Fußball mehr — ausschließlich der aktuelle Modellstand.

Erzeugt mit: `npm run build` + `node scripts/render-single-file.mjs` +
`node scripts/_tmp/shot-aktuell.mjs 8191` (Playwright, SwiftShader-WebGL,
`scripts/serve.mjs` als localhost-Server). Rohdaten: `dist/screenshots/aktuell-report.json`.
Alle 14 Shots: Nicht-Leer-Statistik OK (nonBg ≥ 3 %, Helligkeit 10–245, SD ≥ 8),
**0 pageerrors, 0 console-errors**, Canvas/SVG per Bounding-Box im Frame verifiziert
und je 5 stichprobenhaft visuell geprüft.

Build-Belege: `dist/build-report.json` (hash `69155f1d…`, 12 Modelle),
`dist/lab-player.html.sha256` (`097d0474…`), Standalone v12-guide
(`dist-standalone/modelmuse-standalone.html`, 280 318 Bytes).

## Slim-Generator — `dist/lab-player.html`

| Modell | Pfad |
|---|---|
| gpu-example (Graphics Card, 3D) | `dist/screenshots/aktuell-gpu-example.png` |
| si-1 (PC-Arbeitsplatz, 3D) | `dist/screenshots/aktuell-si-1.png` |
| si-2 (Netzwerk-Verkabelung, 3D) | `dist/screenshots/aktuell-si-2.png` |
| si-3 (Server-Rack, 3D) | `dist/screenshots/aktuell-si-3.png` |
| free-handbohrmaschine (3D) | `dist/screenshots/aktuell-free-handbohrmaschine.png` |
| chemie-koffein (Koffein-Molekül, 3D) | `dist/screenshots/aktuell-chemie-koffein.png` |
| dup-1 (ER-Modell, 2D-SVG) | `dist/screenshots/aktuell-dup-1.png` |
| ae-2 (Bubblesort-Vergleich, 2D-SVG) | `dist/screenshots/aktuell-ae-2.png` |

## Standalone v12-guide — `dist-standalone/modelmuse-standalone.html`

| Modell | Pfad |
|---|---|
| si-1 (3D) | `dist-standalone/proof-aktuell-si-1.png` |
| si-2 (3D) | `dist-standalone/proof-aktuell-si-2.png` |
| si-3 (3D) | `dist-standalone/proof-aktuell-si-3.png` |
| free-handbohrmaschine (3D) | `dist-standalone/proof-aktuell-free-handbohrmaschine.png` |
| dup-1 (ER-Modell, 2D-SVG) | `dist-standalone/proof-aktuell-dup-1.png` |
| ae-2 (Bubblesort, hier 3D-Canvas) | `dist-standalone/proof-aktuell-ae-2.png` |

## Hinweise / kein Rot, aber dokumentiert

- **Standalone kennt nur 10 Labs** (`Labs (10)`): `gpu-example` und `chemie-koffein`
  existieren in `modelmuse-standalone.html` (v12) nicht — dafür gibt es dort keine
  `proof-aktuell-*.png`. Diese beiden Modelle sind nur in der Slim-Tabelle oben belegt.
- **ae-2 rendert je Viewer anders**: Slim zeigt das 2D-SVG-Balkendiagramm
  (`2d-svg`, Verify S1/S2 pass), Standalone zeigt ae-2 als **3D-Canvas**
  (`META['ae-2'].is3d === true`, `window.__viewer._mode === '3d'`). Kein Fehler,
  sondern Standalone-Produktstand (ältere Modell-Metadaten); bewusst so fotografiert.
- **Nacharbeit war nötig**: Der Erstlauf der Standalone-Shots lag im Scroll daneben
  (nur Panels, kein Viewport im Frame). Gefixt per `viewport.scrollIntoView()` +
  Frame-Lage per Bounding-Box als ROT-Kriterium im Skript; Zweitlauf 6/6 im Frame,
  visuell bestätigt (si-1 3D mit Labels/`Mainboard Breite 24 cm`; dup-1 2D-ER mit
  `Tafelbreite: 40 cm`). Slim-Erstlauf war direkt grün.
- Ältere Belege (`proof-*-overview/detail.png`, `final-*.png`, `proof-*-v12.png`)
  bleiben unverändert bestehen; diese `aktuell-*`-Dateien sind der neue Stand.
