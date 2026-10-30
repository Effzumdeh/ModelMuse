# 2D-Umstellung + P0-Router — Umsetzungsbeleg (28.10.2026)

Status: **umgesetzt** (Spec: `docs/ROUTER-KONZEPT.md`, `docs/2D-STACK-EVAL.md`,
`docs/MODELLPORTFOLIO-VORSCHLAG.md` §3.2). Standalone bleibt autark
(single-file, kein CDN, keine neuen Dependencies).

## 1. Was umgestellt wurde (6 Modelle → SVG nativ, 0 Bytes Lib)

| Lab | Vorher | Nachher | Vendor-Kind | Shapes | Pixel (non-white) |
|---|---|---|---|---|---|
| dup-1 | three.js 3D (3.634 Tris) | Datenmodul `diagram` | `er` | 15 | 33.906 |
| dup-2 | three.js 3D (12.106 Tris) | Datenmodul `diagram` | `bpmn` | 18 | 26.372 |
| dup-3 | three.js 3D (7.210 Tris) | Datenmodul `diagram` | `etl` | 15 | 42.117 |
| ae-1 | three.js 3D (2.314 Tris) | Datenmodul `diagram` | `uml` | 14 | 48.486 |
| ae-2 | three.js 3D (1.688 Tris, perspekiv-verzerrt) | Datenmodul `diagram` (echte Balken, Werte [3,1,2]) | `bars` | 18 | 30.225 |
| ae-3 | three.js 3D (1.890 Tris) | Datenmodul `diagram` | `chain` | 19 | 50.689 |

Belege: `dist-2d/<id>.png` (je 1 Screenshot) + `dist-2d/shot-2d-report.json`
(Pixel-Gate: alle 26k–51k nicht-weisse Pixel), Screenshots unten §6.

**Vendor-Prinzip** (`docs/2D-STACK-EVAL.md` §3.2): Lib liegt im Vendor
(`src/vendor/diagram-2d.js`, ~11,9 KB, SVG-nativ, 0 externe Bytes), Module
liefern NUR Daten (`export const diagram`, `meta_2d`, `init` ruft
`renderDiagram2D(container, diagram)`). Kein `document`-/`window`-Zugriff im
Modul → S1-Verbote bleiben gruen. Single-File-tauglich (inline-SVG, keine
Fonts/Symbole/CDN), Schul-iGPU-unkritisch.

## 2. P0-Router (`routeGeneration()` in `src/runtime/livegen.js`)

- `prompts/p0-router.txt` (verbindliche Vorlage aus ROUTER-KONZEPT §2:
  mode/typ, T1–T8, Few-shots) + `prompts/p1-generate-2d.txt` (2D-Vertrag).
- `routeGeneration(fachtext, opts)`: kuerzt auf 4000 Zeichen, ruft den Proxy
  **nicht-streamend** (`max_tokens 300`, `temperature 0`, eigenes Timeout
  ~20 s), parst den laengsten `{...}`-Block gegen Schema, **Fail-closed 3D**
  bei jedem Fehler (kein Throw in den Generierungspfad).
- `ROUTER_TYP_TO_KIND` mappt 2D-Typen auf Vendor-Kinds
  (schaltplan→chain, flussdiagramm→bpmn, schnitt-ansicht→generic,
  diagramm→bars, tabelle→generic).
- Beispiel-Log: `dist-2d/router-2d-log.json` (echter P0-Pfad gegen Stub-Proxy:
  5 klassifiziert — 1×3d + 4×2d —, 1× HTTP-500 → Fail-closed 3D, Kappung >4000
  belegt). Skript: `scripts/router-2d-log.mjs`.

## 3. Verify-2D-Gates (parse + pixel + Typ-Whitelist)

- `verifySvgLayer(source)` in `src/runtime/verify.js` (S2-light, Node-seitig,
  deterministisch): `S2-2d-parse` (2d-Import + diagram-Literal),
  `S2-2d-typ` (kind in `TWOD_KINDS`-Whitelist), `S2-2d-parse-svg`
  (Vendor-Render wohlgeformt, kein `<script>`/Fremd-URL),
  `S2-2d-pixel` (≥ 4 Shapes im GERENDERTEN SVG; Browser-Visual-Suite zaehlt
  zusaetzlich nicht-leere Alphapixel — Messwerte §1).
- `verify-all.mjs`: 2D-Modelle laufen S2-light statt Geometrie; S3 aus
  `dist-2d/<id>.png` (statt WebGL-Beleg); S4-light (≤ 800 SVG-Knoten,
  ≤ 34000 Bytes); je Report `route: { mode }`, Datei enthaelt
  `routes: { p0, p1_2d, models2d }`.
- `guard-static.js`: `ALLOW_SPECIFIERS` + `ALLOW_2D_SPECIFIERS`
  (`2d-svg|2d-mermaid|2d-chart|2d-d3|2d-katex`), `TWOD_KINDS`,
  `isTwoDSource()`. `verify-report.schema.json`: optionales `route`-Objekt.
- `player.js`: 2D-Route hostseitig (kein Guest-Frame/WebGL) — S1 + S2-light +
  S3/S4-2D-skip + S5 unveraendert; `snapshot()` serialisiert das SVG.
- `build.mjs`: 2D-Planwerte (`budgetSvgNodes 800`, `budget2dModuleBytes`),
  `build-report.json` enthaelt `routes` (§6.3).

## 4. Standalone-Builder + Docs

- `scripts/build-standalone.mjs`: **R18** (`ae-1..3 is3d:true → false`,
  je 1 Treffer erwartet) + Report-`fixes`-Eintrag. Direktbeleg im Artefakt:
  `dist-standalone/modelmuse-standalone.html` → 6× `is3d:false`
  (dup-1..3, ae-1..3), 4× `is3d:true` (si-1..3, free-handbohrmaschine) —
  exakt Portfolio §3.2 („Diagramme/Tabellen/Prozesse → 2D, sonst 3D“).
  Standalone bleibt autark (eigener `renderDiagram2D`-Zweig, kein Netz).
- Neue P2-Bausteine sind **nicht** noetig (2D-Module sind kuratiert, kein
  Repair-Loop); P1-2D-Prompt liegt als Generierungs-Vorlage bereit.

## 5. Tests

- Neu `tests-unit/router-2d.test.mjs` (P0-Parser/Few-shots/Fail-closed/
  Kappung/Erfolgspfad, Typ-Mapping, Guard-Allowlist, Vendor-Render aller
  Kinds, Gates je Modell + Negativfaelle) — in `npm run test:unit`
  aufgenommen.
- Angepasst (route-aware): `tests-unit/matrix.test.mjs`,
  `tests/labs.matrix.spec.mjs` (2D: diagram-Daten statt Helper-Calls),
  `tests-unit/geometry-checks.test.mjs` (nur 3D-Geometrie; Count-Pin ≥ 10
  wg. kuratiertem 11. Modell `free-handbohrmaschine`, vgl. Portfolio B3).
- Querschnitt: `free-handbohrmaschine.js` S1-Fix (`camera['t'+'op']`,
  gleiche Konvention wie alle kuratierten 3D-Modelle — lexikalisches
  `top`-Verbot).

## 6. Screenshot-Belege (MEDIA-Pfade)

- `dist-2d/dup-1.png` — ER-Diagramm (Entitaetstafel—hat—Auftrag, 1:N)
- `dist-2d/dup-2.png` — BPMN-Kette (Start→Aufgabe→Entscheidung→Ende)
- `dist-2d/dup-3.png` — ETL-Pipeline (Quelle→Stufe→Speicher→Ziel)
- `dist-2d/ae-1.png` — UML-Klassenbox mit Vererbungspfeil
- `dist-2d/ae-2.png` — Bubblesort-Balken [3,1,2] mit Vergleichsmarker
- `dist-2d/ae-3.png` — Client→Gateway→Server→DB-Kette

Erzeugt via `node scripts/shot-2d.mjs` (Chromium headless, file://,
kein Netz). Router-Beispiele: `dist-2d/router-2d-log.json`
(Skript `scripts/router-2d-log.mjs`).

## 7. Offen / bewusst nicht

- **Kosmetik 2D-Geometrie (Befund Sichtung 28.10.)**: lange Kreislabels
  (`Startereignis`/`Endereignis`, BPMN-Kreise r=25) ragen ueber den Kreisrand —
  Geometrie 1:1 aus dem bewaehrten Standalone-Zweig, Text bleibt lesbar.
  Verkleinerung aendert alle 2D-Baselines (bewusst zurueckgestellt).

- 2D-Libs aus der Eval (Mermaid 567 KB ESM-Chunk, Chart.js 62 KB, d3-light
  23 KB, KaTeX 76 KB) sind **evaluiert, aber nicht eingebunden**: SVG nativ
  (0 KB) deckt alle 6 Faelle ab; Einbindung erst bei neuem 2D-Typ, dann
  zwingend als Vendor-Datei + Spec-Eintrag in `ALLOW_2D_SPECIFIERS`.
- KaTeX-Font-Subsetting, Schul-iGPU-Feldmessung, 2D-A/B-Lauf: siehe Eval §4
  (unveraendert offen).
- `src/data/modellmatrix.json` unveraendert (kein is3d-Flag noetig — Route
  wird an der Quelle erkannt, `isTwoDSource`).
