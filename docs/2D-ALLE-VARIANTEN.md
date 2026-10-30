# 2D-Alle-Varianten — Umsetzung (29.10.2026)

Stand: 29.10.2026. Alle fuenf 2D-Varianten aus `docs/2D-STACK-EVAL.md` sind
eingebaut: **Mermaid** (Chunk-Selektion), **Chart.js** (tree-shaken),
**d3-light** (5 Submodule), **KaTeX** (Font-Subsetting), **SVG nativ** (0 KB).
Je Variante genau ein exemplarisches Beispiel-Modell, Standalone-Builder v14,
Verify-2D-Gates, Allowlist, Playwright-Screenshots, Smoke-Tests. Tests gruen.

## 1. Entscheidungstabelle (Top-1 je Typ, aus der Eval uebernommen)

| 2D-Typ | Top-1-Lib | Version | Bundle (gzip) | Single-File-Strategie |
|---|---|---|---|---|
| Diagramm | Mermaid | 12.2.0 | 567 KB (ESM + 4 Chunks statt 1 542 KB UMD) | Diagramm-Chunk-Selektion, lazy |
| Chart | Chart.js | 4.6.1 | 62 KB (tree-shaken) | direkt, 4,0 % von Mermaid |
| Graph/Netz | d3-light | 3.x | 19–23 KB (5 Submodule) | direkt, kleinste echte Lib |
| Mathe | KaTeX | 0.19.1 | 76 KB JS + 57 KB Subset-Fonts | Font-Subsetting (5 statt 20 Fonts) |
| Technik-Skizze | SVG nativ | — | 0 KB | kein Import, kein Asset |

Nachmessung 29.10.2026 (eigene Skripte, Scratch — nicht im Repo):
Chart.js-UMD 210 082 B / 71 106 B gzip; KaTeX-min 273 081 B / 76 126 B gzip;
Subset-Fonts (Main-Regular 26 272 + Math-Italic 16 440 + Size1 5 468 +
Size2 5 208 + Size4 4 928) = 58 316 B ≈ 57 KB; d3-light-Bundle (esbuild,
5 Submodule) 55 929 B / 19 144 B gzip. Mermaid-ESM: 104 `.mjs`-Chunks,
Diagramm-Chunks `flowDiagram-KMDKLPNL`, `sequenceDiagram-OV7DSCPC`,
`erDiagram-Y4LBXKHG`, `ganttDiagram-76A4JV4W` (jsdelivr-Datei-API).

Kernentscheidung (Eval §3.1, unveraendert): Mermaid und KaTeX loesen das
Leichtgewicht-Ziel ueber Chunk-Selektion bzw. Font-Subsetting; Chart.js,
d3-light und SVG-nativ liegen weit unter der Schul-Schwelle. Mermaid wird
nie in jedes 2D-Modul geladen, sondern nur bei Diagramm-Typ (lazy).

## 2. Vendor-Prinzip (Lib in Vendor, Modul liefert Daten)

`src/vendor/` enthaelt je Variante genau eine dependency-freie Datei
(kein Netz, kein WASM, keine Fonts, offline):

| Datei | Groesse | Inhalt |
|---|---|---|
| `mermaid-2d.js` | ~14 KB | flow/sequenz/er/gantt-DSL, `parseMermaid` (wirft mit Zeile), SVG-Layout, `MERMAID_CHUNK_MANIFEST` (Kern 508 KB + 0,3/31,2/10,4/17,0 KB = 567 KB) |
| `chart-2d.js` | ~10 KB | bar/line/pie-Config (Chart.js-kompatibel), Canvas-2D + SVG-Vorschau, `niceCeil`-Skala, Peak-Highlight, Einheit, `CHART_BUDGET` (62 KB) |
| `d3-2d.js` | ~7 KB | netz/baum, deterministisches Radial-Layout (kein Zufall), `node not found`-Fehler, `D3_SUBMODULE_MANIFEST` (5 Module, ~19 KB) |
| `katex-2d.js` | ~10 KB | LaTeX-Subset (rekursiv, `\left/\right`-Klammern, echte Symbole ±·×√∑∫), Inline-CSS, `throwOnError:true`, `KATEX_FONT_SUBSET` (5 Fonts, 57 KB) |
| `diagram-2d.js` | ~12 KB | SVG nativ (unveraendert, 0 externe Bytes) |

`src/runtime/render-2d.js` (ein Dispatcher) und `src/runtime/verify-2d.js`
(Gates je Variante) sind der einzige Einstieg fuer Player, Standalone,
Shot- und Smoke-Skripte. Swap-in-Pfad je Datei im Kopfkommentar: echte
Lib per Importmap/UMD ergänzen, Datenformat (`diagram|mermaid|chart|
graph|formula`) bleibt unveraendert.

## 3. Beispiel-Modelle (je 1, kuratiert, Harness-gruen)

| Modell | Variante | Spec | P0-Typ (Smoke) | Inhalt |
|---|---|---|---|---|
| `demo-2d-svg` | SVG nativ | `2d-svg` | 2d/schnitt-ansicht | Wasserkocher-Seitenansicht, kind generic |
| `demo-2d-mermaid` | Mermaid flow | `2d-mermaid` | 2d/flussdiagramm | Photosynthese-Ablauf als `graph TD` |
| `demo-2d-chart` | Chart.js balken | `2d-chart` | 2d/diagramm | Wirkungsgradvergleich [82,91,76,88] % |
| `demo-2d-d3` | d3-light netz | `2d-d3` | 2d/schaltplan | Rechnernetz-Sterntopologie (Topologie-Spezialfall) |
| `demo-2d-katex` | KaTeX formel | `2d-katex` | 2d/tabelle | pq-Formel mit `\left(\frac{p}{2}\right)` |

Jedes Modell: genau ein `2d-*`-Import, `meta`/`meta_i18n`/`meta_2d`,
Datenliteral, `init` ruft nur den Vendor-Renderer. Manifeste
(`src/models/manifests/demo-2d-*.json`, track free, S5-vollstaendig) und
Matrix-Eintraege (`src/data/modellmatrix.json`) vorhanden.

P0→Variante (`ROUTER_TYP_TO_VARIANT` in `livegen.js`): der P0-Router
entscheidet nur Modus/Typ; die Lib waehlt P1 (`prompts/
p1-generate-2d-varianten.txt`). schaltplan→svg, flussdiagramm→mermaid,
schnitt-ansicht→svg, diagramm→chart, tabelle→katex; Netz-Topologie
(Spezialfall von schaltplan) rendert d3-light (`ROUTER_TOPOLOGY_VARIANT`).

## 4. Verify-2D-Gates (parse + pixel + Typ-Whitelist, je Variante)

`verifyTwoDLayer()` (`src/runtime/verify-2d.js`, S2-light, Node-seitig,
deterministisch). Kriterium-Ids variantenuebergreifend identisch:

`S2-2d-parse` (2d-Import) · `S2-2d-typ` (Kind-Whitelist) ·
`S2-2d-parse-svg` (Vendor-Render wohlgeformt) · `S2-2d-pixel`
(≥ 4 Formen im GERENDERTEN Output; Browser zaehlt zusaetzlich
nicht-leere Alphapixel) · `S2-2d-wellformed` (kein `<script>`,
keine Fremd-URL im Modul).

Gate-Signale (Eval §3.3, implementiert): mermaid `parseMermaid` wirft mit
Zeile/Spalte (`UnknownDiagramError`/`Lexical error`/`Invalid date`);
KaTeX wirft mit Position (`throwOnError:true` erzwungen, `katex-error`-
Span wuerde failen); Chart.js-Typ-Whitelist (`E-CHART-TYP` — die echte
Lib wuerfe nicht); d3 `node not found` + Pixel-Gate gegen leeren Graphen.
`verifySvgLayer()` delegiert an den Dispatcher (Abwaertskompatibilitaet:
dup-1..ae-3, si-1-Negativ, Typ-Whitelist-Negativ unveraendert gruen).

S4-light: Formenzahl ≤ 800 + Modul ≤ 34 000 Bytes je Variante.
S3: `dist-2d/<id>.png` (Pixel-Beleg, §6).

## 5. Guard-Allowlist

`src/runtime/guard-static.js`: `ALLOW_SPECIFIERS`/`ALLOW_2D_SPECIFIERS`
enthalten alle fuenf Specs (`2d-svg|2d-mermaid|2d-chart|2d-d3|2d-katex`;
Importmap-Prinzip, keine relativen Pfade/URLs/`import()`).
Neu: `TWOD_KNOWN_EXPORTS` (Union aller Vendor-Exporte),
`MERMAID_DIAGRAMS`, `CHART_KINDS`, `D3_KINDS`, `KATEX_KINDS` sowie
`MERMAID/CHART/D3/KATEX_KNOWN_EXPORTS`. S1-Verbote (document/window/
fetch/…) bleiben fuer alle 2D-Module gruen.

## 6. Screenshot-Belege (Playwright, file://, offline, kein Netz)

`node scripts/shot-2d-variants.mjs` rendert die ECHTEN Vendor-Renderer
(inline, gleiche Dateien wie Produktion; Chart.js-Pfad nutzt Canvas-2D):
`dist-2d/<id>.png` + `<id>.html` + `shot-2d-variants-report.json`.

| Datei | Variante | Shapes | Nicht-weiss | png |
|---|---|---|---|---|
| `dist-2d/demo-2d-svg.png` | svg | 14 | 77 122 | 9,4 KB |
| `dist-2d/demo-2d-mermaid.png` | mermaid | 21 | 30 280 | 17,7 KB |
| `dist-2d/demo-2d-chart.png` | chart (Canvas) | 28 | 51 258 | 11,3 KB |
| `dist-2d/demo-2d-d3.png` | d3 | 22 | 19 427 | 28,4 KB |
| `dist-2d/demo-2d-katex.png` | katex | 24 | 12 693 | 15,5 KB |

Pixel-Gate: > 100 nicht-weisse Pixel je Beispiel (eigener PNG-Decoder,
keine Extra-Dep). Sichtpruefung 29.10: Balken-Skala rund (0–100, Einheit
%, Peak-Highlight), Wurzel-Vinculum mit Anschluss, mitwachsende
`\left/\right`-Klammern, Mermaid-Pfeilspitzen + Rahmen-Clipping behoben.
Rest-Limits (ehrlich): naives Mermaid-Layout (kein dagre), KaTeX ohne
echte Font-Metriken (System-Serif, Anhaltswerte) — Mechanismus und Gates
sind produktiv, Typografie ist Schul-, nicht Druckniveau.

## 7. Smoke-Tests (je Testsachverhalt P0 + Rendering)

`node scripts/smoke-2d-varianten.mjs` (Stub-Proxy, deterministisch, kein
LLM): 6 Faelle (1× 3d/baugruppe + 5× 2D je Variante) ueber den ECHTEN
Pfad (`routeGeneration` + `prompts/p0-router.txt` + HTTP + Parse +
Fail-closed), dazu S1/S2-light je Demo-Modell und Pixel-Beleg aus §6.
Beleg: `dist-2d/smoke-2d-varianten.json`. Ergebnis 29.10:
6/6 `pass` (routing+s1+s2+render) plus Fail-closed-500 → 3D-Fallback.

zusaetzlich `tests-unit/2d-alle-varianten.test.mjs` (node-Testrunner,
in `npm run test:unit`): Allowlist je Spec, Gates je Demo (5 Kriterien),
Negativfaelle je Variante, P0-Parse je Testsachverhalt, P1-Variantenwahl.

## 8. Standalone-Builder v14 + Verify

`node scripts/build-standalone-v14.mjs` (idempotent, nur auf v13-Basis):
5 Vendor-IIFE + `__renderVariant2D`-Dispatcher, META (is3d:false +
diagram2d-Payload), LABS-Katalog (de/en/es, Tasks, Quiz, diagram2d),
ES/MEAS, `__SOURCES` +5 (Modify-Pfad), loadLab/force2D-Dispatch,
registerFree-2D (Allowlist + Vendor-Prolog + is3d:false + diagram2d-
Persistenz — Ueberarbeiten funktioniert auch fuer 2D).
Artefakt: 362 894 Bytes (< 600 KB, GitHub-Pages).
`scripts/verify-standalone.mjs` prueft v14 (Stempel, 5 LABS/META,
Vendor-Marker, diagram2d-Payloads, RegisterFree-Allowlist).
`tests/standalone.spec.mjs`: 10 Modelle (5× 3D-Canvas + svg/mermaid/
chart-Canvas/d3-svg/katex-Block), 10 Screenshots `dist-standalone/
shots/`, 10 Stift-Buttons — 7/7 gruen.

## 9. Tests gruen (29.10.2026)

- `npm run test:unit`: 153/153 (inkl. neu `2d-alle-varianten`, angepasstem
  `matrix.test` fuer alle 2d-*-Specifier).
- `npm run build`: OK (Budgets inkl. neuer Vendor-Dateien).
- `scripts/verify-all.mjs`: alle 18 Modelle gelb (5 Demos S2-light + S4-light pass).
- `scripts/shot-2d.mjs`: 6/6 unveraendert; `shot-2d-variants.mjs`: 5/5.
- `scripts/smoke-2d-varianten.mjs`: 6/6 + Fail-closed.
- `scripts/verify-standalone.mjs`: OK (v14).
- `npx playwright test tests/standalone.spec.mjs`: 7/7.
- `npx playwright test tests/geometry.spec.mjs -g "S2 statisch"`: alle Modelle pass (2D via Dispatcher).

## 10. Offen / bewusst nicht

- Echte Mermaid-ESM-Chunks (2 MB roh) und KaTeX-woff2 liegen NICHT im
  Repo/Artefakt (GitHub-Pages-Limit); Vendor-Renderer sind dependency-frei
  und datenkompatibel (Swap-in dokumentiert, §2). Chunk-Namen und
  Font-Groessen sind echt nachgemessen (§1).
- P0 unterscheidet keine Libs (nur Modus/Typ) — Variantenwahl ist P1
  (Checklist, keine zweite LLM-Runde).
- Layout-Qualitaet (Mermaid ohne dagre, d3 radial statt force) und
  Schul-iGPU-Feldmessung: unveraendert offen (vgl. Eval §4).
- Kein A/B-Lauf mit dem Generator-Modell (Benchmark-Zahlen aus Eval §2).
