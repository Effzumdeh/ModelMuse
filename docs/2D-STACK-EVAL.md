# 2D-Stack-Evaluierung (modelMuse)

Stand: 28.10.2026. Auswertungsbasis: `docs/implementation-guide-3d-qualitaet.md` Abschnitte 1–5,
M1–M6. Zweck: Top-1-Bibliothek je 2D-Typ festlegen, ohne den 3D-Stack (three.js r186) anzutasten.

**Rahmenbedingung aus dem Auftrag:** 2D-Modelle bleiben leichtgewichtig — Single-File, kein
CDN-Pflicht, Schul-iGPU-tauglich. Jede Empfehlung unten ist gegen diese drei Bedingungen
geprueft, nicht gegen reine Feature-Richheit.

**Messmethode:** Alle Groessen sind lokal gemessen, nicht aus Prospekten uebernommen.
- Bibliotheks-Groessen: `dist/*.js` von jsDelivr (npm-Tarball-Inhalt), gzip = `zlib.gzipSync(level 9)`.
- Tree-Shaken-Varianten: esbuild 0.28.2 (identische Toolchain wie `scripts/build.mjs`),
  `--bundle --minify --format=esm`.
- Single-File-Auswirkung: HTML-Groesse mit inline eingebettetem `<script>` gemessen.
- Offline-Faehigkeit: Playwright (repo-eigenes `playwright-core`), Navigation ueber `file://`,
  alle Nicht-`file://`-Requests per `route.abort()` blockiert. Ergebnis: **8 von 8 Kandidaten rendern offline**.
- Lizenzen: LICENSE-Datei je Paket ausgelesen, nicht nur Registry-Metadaten.
- Abrufdatum aller Web-Quellen und Registry-/CDN-Aufrufe: 28.10.2026.

---

## 1. Entscheidungstabelle (Top-1 je Typ)

| 2D-Typ | Top-1-Lib | Version | Bundle (min, gzip) | Single-File-HTML (gzip) | Syntax | LLM-Eignung | Lizenz | Offline |
|---|---|---|---|---|---|---|---|---|
| **Diagramm** (Fluss/Sequenz/ER/Gantt) | **Mermaid** | 12.2.0 | 5 366 KB / **1 542 KB** | 1 542 KB | Text (eigenes DSL) | **Hoch** (Benchmark belegt) | MIT | ja |
| **Chart** (Balken/Linie/Pie) | **Chart.js** | 4.6.1 | 176 KB / **62 KB** (tree-shaken) | 62 KB | JS-Objekt (JSON-artig) | Mittel-Hoch | MIT | ja |
| **Graph/Netz** (Knoten-Kanten) | **d3-light** (d3-force + selection + shape + hierarchy + zoom) | 3.x-Submodule | 66 KB / **23 KB** | 23 KB | JS-Objekt | Mittel | ISC | ja |
| **Mathe** (Formeln) | **KaTeX** | 0.19.1 | 262 KB JS / **76 KB** (ohne Fonts) | 335 KB (mit Fonts) | LaTeX | **Hoch** | MIT | ja |
| **Technik-Skizze** (Schaltplan/Skizze) | **SVG nativ** (+ optional rough.js) | — | **0 KB** / 0 KB | 0,1 KB | SVG-Markup | Mittel (XML-Fehler) | — | ja |

**Kernentscheidung:** Nur Mermaid und KaTeX sind schwer genug, um das Leichtgewicht-Ziel zu
verletzen. Beide loesen das sauber: Mermaid ueber Diagramm-Chunk-Selektion, KaTeX ueber
Font-Subsetting. Chart.js, d3-light und SVG-nativ liegen mit 23–62 KB gzip weit unter der
Schul-iGPU-Schwelle und sind unkritisch.

### Ausgeschlossene Kandidaten (mitgemessen, nicht geraten)

Groessen = **ausgelieferte dist-Datei** (gzip), sofern nicht anders vermerkt. Wo ein Kandidat
tree-shaken gemessen wurde (Cytoscape, dagre), ist das explizit genannt — das ist die faire
Vergleichsmasse gegen das ebenfalls tree-shaken gemessene d3-light.

| Kandidat | Gemessene Groesse | Ausschlussgrund |
|---|---|---|
| ECharts 6.1.0 voll | 1 096 KB / 360 KB gzip | 5,8x Chart.js; tree-shaken 186 KB gzip — Chart.js gewinnt trotzdem |
| ECharts 6.1.0 tree-shaken | 186 KB gzip | 3x Chart.js bei gleicher Typabdeckung (Linie/Balken/Tooltip/Legend) |
| Plotly.js 4.1.2 | 4 721 KB / **1 453 KB** | Fast Mermaid-Groesse, 42 Abhaengigkeiten |
| Cytoscape 3.34.4 | 434 KB / 139 KB gzip (tree-shaken) | 6x d3-light; noetige Layout-/Interaktionsfeatures nicht im Schul-Fall |
| vis-network 10.1.4 | 638 KB / 152 KB gzip | schwerer als Cytoscape bei gleicher Aufgabe |
| MathJax 4.1.3 (tex-svg) | 1 806 KB / **599 KB** gzip | 7,9x KaTeX; MathJax-nofont-Variante 250 KB — immer noch 3x KaTeX |
| Mermaid 11.17.2 | 3 489 KB / 961 KB gzip | kleiner als v12, aber weiterhin ~1 MB — Vorschaubau (siehe 2.1) |
| D2 (`@terrastruct/d2`) | 20 799 KB gzip (davon WASM 6 932 KB) | als WASM-Compiler unbrauchbar fuer Single-File |
| Graphviz-WASM (`@hpcc-js/wasm`) | 622 KB gzip (nur graphviz.js) + WASM | WASM-Abhaengigkeit, schwer |
| elkjs 0.10.0 | 452 KB gzip (bundled) | Layout-Engine, fuer 2D-Fall Overkill |
| dagre 0.8.5 | 85 KB / 31 KB gzip (tree-shaken) | nur Layout, keine Darstellung — nur als Zusatz zu d3 |
| svg.js 3.2.8 | 91 KB / 29 KB gzip | DOM-Wrapper, den natives SVG bereits liefert |
| `@viz-js/viz` | 587 KB gzip | Graphviz im Browser, schwer + WASM |
| plantuml-encoder | 8,9 KB gzip | nur der Kodierer — PlantUML braucht externen Server (nicht standalone) |

---

## 2. Je Typ: genau fuenf Zeilen

### 2.1 Diagramm — Mermaid 12.2.0 (MIT)

1. **Bundle:** 5 366 KB min / **1 542 KB gzip** (UMD `dist/mermaid.min.js`); v11.17.2 = 961 KB gzip;
   v11.4.1 = 732 KB gzip. Das ist der schwerste Block der gesamten 2D-Auswahl.
2. **Single-File:** ueber **Diagramm-Chunk-Selektion** loesbar — der ESM-Build `dist/chunks/mermaid.esm.min/`
   enthaelt 104 Chunks (1 537 KB gzip gesamt), davon 47 Kern-Chunks (508 KB gzip). Die vier benoetigten
   Diagrammtypen kosten **58,9 KB gzip** extra (sequence 31,2 / gantt 17,0 / er 10,4 / flow 0,3) —
   mit Kern also **567 KB gzip statt 1 542 KB**. Voraussetzung: ESM statt UMD.
3. **Syntax-Beispiel:** `graph TD` / `A[Start] --> B{Sensor}` / `B -->|ok| C[Ende]` (Fluss);
   `sequenceDiagram` / `Alice->>Bob: Hallo`; `erDiagram` / `KUNDEN ||--o{ BESTELLUNG : "gibt"`;
   `gantt` / `Aufgabe :a1, 2026-01-01, 10d`. Reines Textformat — vom LLM direkt auszugeben.
4. **LLM-Eignung:** **am besten belegt.** MermaidSeqBench (arXiv 2511.14967, IBM, 132 Samples,
   LLM-as-Judge ueber Syntax/Logik/Vollstaendigkeit/Activation/Error-Tracking): bestes Modell
   Qwen 2.5-7B = **82,45** Overall, Llama 3.1-8B = 80,58; In-Context-Beispiele heben Llama 3.1-8B
   von 64,63 auf 80,58 und Granite 3.3-8B von 46,96 auf 73,90. Systematische Syntaxfehler bleiben
   aber eine Fehlerklasse (OmniDiagram: Mermaid-Syntaxfehler 52 bei 3B und 52 bei 7B — **nicht** mit
   Modellgroesse besser).
5. **Lizenz/Offline/Gate:** MIT (LICENSE-Datei verifiziert). Offline gerendert (SVG 31 398 Zeichen,
   `hasSvg: true`). Gate-tauglich: `mermaid.parse()` liefert **deterministische** Fehler mit
   Zeilen-/Spaltenposition und Caret (`Parse error on line 2: ... ^ Expecting 'AMP', ... got 'EOF'`);
   Parse 8–11 ms vs. Render 179 ms — also billig validierbar. Fehlerklassen getrennt erkennbar:
   `UnknownDiagramError` (Typ unbekannt), `Lexical error` (Richtung ungueltig), `Invalid date` (Gantt-Datum).

### 2.2 Chart — Chart.js 4.6.1 (MIT)

1. **Bundle:** UMD voll 205 KB / **69 KB gzip**; tree-shaken (Line+Bar+Tooltip+Legend+2 Scales,
   esbuild wie im Repo-Build) 176 KB / **62 KB gzip** — 3 KB Unterschied, weil Chart.js v4 wenig
   toter Code mitbringt. Tree-Shaking bringt hier wenig, dafuer ist der UMD-Einzeldatei-Einsatz
   ohne Build-Schritt ueber nuetzlich.
2. **Single-File:** 62 KB gzip in eine HTML-Datei — **4,0 % der Mermaid-Groesse**. Kein CDN, keine
   externen Assets, keine Fonts. Auf Schul-iGPU unkritisch (Canvas-Renderer, 6 685 nicht-leere
   Pixel im 200x120-Testcanvas).
3. **Syntax-Beispiel:**
   `new Chart(ctx, { type: 'bar', data: { labels: ['a','b'], datasets: [{ label: 'v', data: [3,1,2] }] }, options: { responsive: false } })`
   — reines JS-Objekt, JSON-artig, vom LLM strukturiert auszugeben.
4. **LLM-Eignung:** **mittel-hoch, aber mit einer echten Luecke.** Die Config-Form ist flach und
   vorhersehbar (kein DSL-Lernen noetig), das Risiko liegt im Detail: es gibt ~30 Chart-Typen,
   _scale-Keys und Optionsnamen, die ein Modell verwechseln kann. Messbar besser als
   imperative Zeichen-API, aber schlechter als eine Text-DSL mit Grammatik.
5. **Lizenz/Offline/Gate:** MIT (LICENSE-Datei verifiziert). Offline gerendert. **Wichtige
   Gate-Luecke: Chart.js wirft bei ungueltigem Diagrammtyp `type:'quatsch'` weder eine Exception
   noch eine Warnung** (`threw: null, warns: [], instExists: true`) — ein fehlerhafter Chart
   passiert ein Objekt-Existenz-Gate still. Gate muss daher **pixelbasiert** pruefen
   (gemessen: 6 685 nicht-leere Alphapixel) und Diagrammtyp gegen eine Whitelist validieren,
   nicht nur auf Instanziierung achten.

### 2.3 Graph/Netz — d3-light (ISC), d3-force + d3-selection + d3-shape + d3-hierarchy + d3-zoom

1. **Bundle:** 5 Submodule tree-shaken 66 KB / **23 KB gzip** — die **kleinste** echte Bibliothek
   der Auswahl. Zum Vergleich: `d3` voll 273 KB / 91 KB gzip; `d3-force` allein 8,1 KB / 2,9 KB gzip.
2. **Single-File:** 23 KB gzip — kein CDN, keine Assets. Perfekt fuer die Schulkonstante.
   Achtung: 5 npm-Pakete, aber **keine** Runtime-Dependencies dazwischen (d3-Submodule teilen
   sich `d3-dispatch`/`d3-timer` intern) — 14 installierte Pakete, 0 Fremd-Runtime-Libs.
3. **Syntax-Beispiel:**
   `forceSimulation(nodes).force('link', forceLink(edges).id(d => d.id)).force('charge', forceManyBody()).force('center', forceCenter(200,120))`
   + `select('#svg').append('circle')` — Daten als JS-Objekte `{id, label}`, Layout als Funktionskette.
4. **LLM-Eignung:** **mittel.** Das API-Muster (Daten rein, Simulation laeuft, man malt) ist
   standardisiert und gut dokumentiert, aber die d3-Kette ist **funktional und zustandsbehaftet**
   (`force('link', ...)` mutiert) — LLM-Code driftet hier typischerweise in Richtung
   Vergessene-Ketten und `undefined`-Nodes. Kein Textformat, also keine Syntax-Absicherung.
5. **Lizenz/Offline/Gate:** ISC (LICENSE-Datei verifiziert, „Permission to use, copy, modify,
   and/or distribute ... without a fee"). Offline gerendert (SVG-Nodes + `hierarchy`/`tree` OK).
   Gate: **d3 wirft bei Datenfehlern deterministisch** (`node not found: FEHLT`) — aber nur bei
   traversierten Kanten; ein leerer Graph ist lautlos erfolgreich. Gate braucht Knotenzahl-/
   Kantenzahl-Sollwerte (im Stil der bestehenden S2-Geometrie-Kriterien).

### 2.4 Mathe — KaTeX 0.19.1 (MIT)

1. **Bundle:** JS 262 KB / **76 KB gzip**; CSS 24 KB / 3,4 KB gzip; 20 woff2-Fonts zusammen
   **253,7 KB** (Base64-Einbettung +33 % -> ~338 KB). **Gesamt-Single-File: 624 KB / 335 KB gzip.**
   KaTeX ist damit die mit Abstand groesste echte 2D-Bibliothek — und die Fonts sind der Grund,
   nicht der Renderer.
2. **Single-File:** Fonts **muss** eingebettet werden, sonst bricht die Darstellung ohne Netz
   (woff2-Dateien separat). Mitigation: nur die tatsaechlich benutzten Fonts einbetten
   (`KaTeX_Main-Regular` 25,7 KB, `KaTeX_Math-Italic` 16,6 KB, `KaTeX_Size4-Regular` 4,8 KB usw.)
   — fuer Schulformeln (Bruch, Wurzel, Summe) reichen ~5 Fonts, also **~60 KB statt 253,7 KB**.
3. **Syntax-Beispiel:** `katex.renderToString('E = mc^2', { throwOnError: true })` bzw.
   `katex.renderToString('\\frac{1}{2}')` — LaTeX-Subset, vom LLM sehr gut beherrscht.
4. **LLM-Eignung:** **hoch.** LaTeX ist die besttrainierte mathematische Textsyntax ueberhaupt
   (auch als LLM-Fehlercode weit verbreitet). KaTeX deckt ca. 300 Standardfunktionen ab;
   MathJax ca. 800+ inkl. AMS-Pakete — der Unterschied faellt nur bei exotischen Paketen
   (`mhchem`, `tikz`), die im Schul-Fall nicht vorkommen.
5. **Lizenz/Offline/Gate:** MIT (LICENSE-Datei verifiziert). Offline gerendert mit eingebetteten
   Fonts (`katex`-Klasse im Output, Laenge 1 162 Zeichen). **Gate ideal:** `throwOnError: true`
   liefert deterministische Meldung inkl. Position
   (`KaTeX parse error: Unexpected end of input in a macro argument, expected '}'`);
   mit `throwOnError: false` wird der Fehler **stattdessen als `katex-error`-Span im HTML
   versteckt** — im Verify-Gate muss `throwOnError: true` erzwungen werden, sonst gilt „offen ist
   nicht gruen" nicht (das `katex-error`-Span ist im gerenderten HTML vorhanden, aber nicht geworfen).

### 2.5 Technik-Skizze — SVG nativ, optional rough.js 4.6.6 (MIT)

1. **Bundle:** **SVG nativ = 0 KB** (kein Import, kein Asset — der Browser rendert direkt).
   Optional rough.js fuer den „Handgezeichnet"-Look: 27 KB / **9 KB gzip** (kleinste echte Lib
   der Auswahl, 19,2 Mio. Downloads/Woche).
2. **Single-File:** 0,1 KB bzw. 9,1 KB gzip — technisch der guenstigste Fall, **kein CDN-Pflicht
   trivial erfuellt**. Das ist der Grund, warum hier keine Lib gewaehlt wird: die
   „Bibliothek" waere 0 Byte.
3. **Syntax-Beispiel:**
   `<svg viewBox="0 0 320 200"><path d="M20 60 q10 -14 20 0" stroke="#4dd2ff"/><rect x="120" y="48" width="50" height="24"/><text x="132" y="92">R1</text></svg>`
   — bei 14 Kindelementen gemessen `bbox 281x59`; Bauteile als Linien/Rechtecke/Pfade + Text-Label.
4. **LLM-Eignung:** **mittel.** SVG ist XML, nicht ein DSL: das LLM muss Koordinaten rechnen
   (das ist der eigentliche Fehlerpfad — Layout-Fehler, nicht Syntax-Fehler) und XML-Attribute
   korrekt quoten. Dafuer gibt es **keine** Grammatik, gegen die man pruefen kann — die
   Pruefbarkeit liegt beim Renderer, nicht beim Parser.
5. **Lizenz/Offline/Gate:** SVG = Browserstandard, keine Lizenzfrage. rough.js MIT (LICENSE-Datei
   verifiziert), offline gerendert. **rough.js-v4-Stolperfalle (gemessen):** `rough.svg(el)`
   verlangt ein echtes `SVGSVGElement` (ein String wirft), und die gezeichneten Elemente werden
   **nicht automatisch angehaengt** — `el.appendChild(rc.rectangle(...))` ist Pflicht
   (gemessen: `svgChildren: 0` vor, `1` nach `appendChild`; deckt sich mit der offiziellen
   README-Zeile `svg.appendChild(node)`).

---

## 3. Querschnitts-Befunde fuer die Umsetzung

### 3.1 Mermaid-Groesse ist der einzige echte Konflikt

| Mermaid-Variante | min | gzip | Anmerkung |
|---|---|---|---|
| 12.2.0 UMD | 5 366 KB | 1 542 KB | Voll-Bundle, 1 Datei, kein Build noetig |
| 11.17.2 UMD | 3 489 KB | 961 KB | kleinere UMD-Alternative |
| 11.4.1 UMD | 2 512 KB | 732 KB | aelteste gemessene guenstige UMD |
| 12.2.0 ESM + 4 Diagram-Chunks + Kern | 2 132 KB | **567 KB** | Chunk-Selektion, braucht Build/Importmap |

Empfehlung: **Mermaid 12.2.0 ESM mit Chunk-Selektion** fuer die vier Zieltypen
(Fluss/Sequenz/ER/Gantt) — 567 KB gzip statt 1 542 KB, Faktor 2,7. Ist der Build-Aufwand
(Importmap statt Inline-Script) nicht akzeptabel, ist **Mermaid 11.17.2 UMD (961 KB gzip)** die
single-file-taugliche Alternative. Beide Varianten sind deutlich ueber der Schul-iGPU-Schwelle —
die Konsequenz ist, **Mermaid nicht in jedes 2D-Modul zu laden, sondern lazy und nur bei
Diagramm-Typ**.

### 3.2 Der S1-Guard blockiert 2D-Libs von heute auf

`src/runtime/guard-static.js` erlaubt als Import-Specifier ausschliesslich `three` und
`wrapper-helpers` (`ALLOW_SPECIFIERS`) plus genau ein Addon (`ALLOW_ADDON`). Die Verbotstabelle
`FORBIDDEN_TOKENS` enthaelt unter anderem `document`, `window`, `fetch`, `navigator`, `localStorage`
— und verbietet zusaetzlich dynamischen `import(`.

Konsequenzen fuer die 2D-Erweiterung:
- **Chart.js, ECharts, d3, Cytoscape, KaTeX, Mermaid und rough.js brauchen zwingend DOM-Zugriff**
  (`document.createElement`, `canvas.getContext`, `innerHTML`) — sie fallen unter
  `E-S1-FORBIDDEN`, wenn sie als generiertes Modul im 3D-Kanal laufen.
- **Das heisst: 2D-Libs duerfen nicht als generierter Code im 3D-Modul-Pfad laufen.** Sie gehoeren
  in den **Vendor-/Wrapper-Bereich** (analog `src/vendor/three.entry.js` + `src/vendor/alpine.module.esm.min.js`),
  waehrend das generierte Modul nur noch **Daten** liefert (Mermaid-Text, Chart-Config, Knotenliste,
  LaTeX-String, SVG-Markup) — dann bleibt der generierte Code klein und der Guard schaetzt die
  Modulbytes (Ziel: < 34 000 Bytes je Lab laut P1-Prompt).
- `guard-static.js` braucht eine **2D-Allowlist** (z. B. `2d-mermaid`, `2d-chartjs`, …) und
  `THREE_KNOWN_EXPORTS` ein Gegenstueck (`KNOWN_EXPORTS` je 2D-Lib) fuer den
  `repairThreeImports`-Reparaturlauf. **Kein Code wurde in diesem Task geaendert.**
- `checkImports` verbietet auch relative Pfade — ein 2D-Modul darf also **keine** relativen
  Imports auf die Vendor-Dateien setzen, sondern braucht Named-Exports ueber die Importmap.

### 3.3 Gate-Tauglichkeit je Lib (gemessen, nicht behauptet)

| Lib | Fehlersignal | Positiv | Bewertung |
|---|---|---|---|
| Mermaid | `mermaid.parse()` wirft mit Zeile/Spalte + Caret; Parse 8–11 ms | 7/7 gueltige Diagramme gerendert | **bestes Gate-Signal** |
| KaTeX | `throwOnError: true` wirft mit Position | gerendert mit eingebetteten Fonts | **sehr gut** (Achtung `throwOnError:false` versteckt Fehler im HTML) |
| d3 | wirft bei traversierten Kanten (`node not found`) | gerendert | mittel (leerer Graph lautlos) |
| rough.js | keine Fehler (Zeichnen kann still scheitern) | gerendert | mittel |
| SVG nativ | Browser-Parser meldet bei **XML-Fehler**; Layout-Fehler ohne Signal | gerendert | **schwaches Gate** — braucht eigene Kriterien (Bauteilzahl, Label vorhanden) |
| **Chart.js** | **wirft nicht, warnt nicht** bei ungueltigem Typ | gerendert | **schwächstes Gate** — pixelbasiert + Typ-Whitelist noetig |

### 3.4 Lizenzlage (alle LICENSE-Dateien verifiziert)

| Paket | Registry | Datei | Urheberzeile |
|---|---|---|---|
| mermaid 12.2.0 | MIT | MIT | — |
| chart.js 4.6.1 | MIT | MIT | Copyright (c) 2014-2024 Chart.js Contributors |
| echarts 6.1.0 | Apache-2.0 | Apache-2.0 | Apache License, Version 2.0 |
| d3-force 3.0.0 | ISC | ISC | Copyright 2010-2021 Mike Bostock |
| cytoscape 3.34.4 | MIT | MIT | Copyright (c) 2016-2026, The Cytoscape Consortium |
| katex 0.19.1 | MIT | MIT | Copyright (c) 2013-2020 Khan Academy and other contributors |
| roughjs 4.6.6 | MIT | MIT | Copyright (c) 2019 Preet Shihn |
| dagre 0.8.5 | MIT | MIT | Copyright (c) 2012-2014 Chris Pettitt |
| @svgdotjs/svg.js 3.2.8 | MIT | MIT | Copyright (c) 2012-2018 Wout Fierens |

Alle neun Kandidaten sind fuer den Schul-/Lehr-Einsatz unproblematisch (MIT/ISC/Apache-2.0).
**Keine Copyleft-Pflicht, keine Namensnennungspflicht ueber MIT/ISC/Apache-2.0 hinaus.**
Ausgeschlossene Kandidaten mit Risiko: `@skillpet/circuit` (kommerziell fuer Nicht-Erziehungs-
nutzung), `@jsplumb/browser-ui` (MIT ODER GPL-2.0), Highcharts (kommerziell), ApexCharts
(Freigabe unter USD-2-Mio.-Schwelle).

### 3.5 Oekosystem-Zahlen (gemessen: npm-Downloads letzte Woche / GitHub-Sterne)

| Paket | Downloads/Woche | Sterne |
|---|---|---|
| katex | 32 883 585 | 20 477 |
| d3 | 25 016 419 | 113 818 |
| mermaid | 19 625 555 | 90 912 |
| cytoscape | 19 929 745 | 11 255 |
| roughjs | 19 223 301 | 21 328 |
| chart.js | 13 904 303 | 67 767 |
| echarts | 7 305 478 | 67 622 |
| dagre | 3 187 367 | 5 842 |
| mathjax | 214 750 | 10 943 |
| plotly.js | 754 703 | 18 369 |
| vis-network | 867 709 | 3 635 |
| @viz-js/viz | 354 728 | — |
| @terrastruct/d2 | 70 814 | 25 751 |

Nach MermaidSeqBench-Niveau ist **Mermaid** die mit Abstand besttrainierte Diagrammsyntax; die
Downloads bestaetigen das (19,6 Mio./Woche, 90 912 Sterne). PlantUML ist in **keiner** npm-Paket-
Statistik vergleichbar vertreten (nur der Encoder, 8,9 KB) — die uebliche PlantUML-Nutzung
laeuft ueber einen **externen Server** und damit am Single-File-Ziel vorbei.

---

## 4. Offene Punkte / nicht gemessen

- **Kein A/B-Lauf mit dem echten Generator-Modell.** Die LLM-Eignungsangaben stammen aus
  veroeffentlichten Benchmarks (MermaidSeqBench, OmniDiagram, DAGstuhl-ESEM-2026) und aus
  Strukturargumenten, **nicht** aus einem Lauf mit `muse-spark-1.3` in diesem Repo.
  Empfehlung: ein 2D-A/B-Lauf mit 100 Prompten je Typ analog zum 3JSBench-Lauf
  (100 Briefings, 696 Checks) — Passrate, Syntaxfehlerklasse, Gate-Signal.
- **KaTeX-Font-Subsetting** ist hier nur als Rechnung gefuehrt (5 statt 20 Fonts ~ 60 statt
  253,7 KB). Ein echter Subset-Build (z. B. `fonttools` auf die genutzten Glyphen) ist **nicht**
  durchgefuehrt.
- **Rendering auf echter Schul-iGPU-Hardware** ist nicht getestet; die Offline-Tests liefen in
  Chromium (Playwright, headless). Die iGPU-Aussage stuetzt sich auf die Bundle-/Asset-Grössen
  und den Canvas-Renderer, nicht auf eine Feldmessung.
- **Layout-Qualitaet** der Diagramme (Mermaid-Dagre-Layout) und der Graph-Layouts (d3-force)
  wurde nicht bewertet — nur Rendering-Fehlerfreiheit und Gate-Signale.
- **`@skillpet/circuit`** (200+ elektrische Bauteile, JSON-basiert) ist als Alternative fuer
  den Typ „Schaltplan" interessant, aber **nicht** MIT (kommerziell fuer Nicht-Erziehungsnutzung)
  und daher **nicht** in die Top-1-Wahl gelangt. Ein Ausblick steht in Abschnitt 1 (Ausschlussliste).
- **Kein Code geaendert.** Diese Datei ist eine reine Auswertung; Vorschlaege fuer
  `guard-static.js`, `build.mjs` und die P1-Prompts sind Empfehlungen, keine Umsetzung.

---

## 5. Quellen-Anhang

Abrufdatum alle Web-Quellen: 28.10.2026. Registry-/CDN-Messungen: 28.10.2026 (lokale Skripte,
Ergebnisse unter `dist/logs/`-Äquivalent im Scratch, nicht im Repo).

| # | Quelle | Kernaussage |
|---|---|---|
| D1 | `https://registry.npmjs.org/{mermaid,chart.js,echarts,cytoscape,d3,katex,mathjax,roughjs,dagre,...}` | Versionen, Lizenzfelder, Abhaengigkeitszahlen, `dist.tarball` |
| D2 | `https://cdn.jsdelivr.net/npm/{pkg}@{ver}/{datei}` | dist-Dateien, gemessen min/gzip/brotli |
| D3 | `https://data.jsdelivr.com/v1/packages/npm/{pkg}@{ver}?structure=flat` | Dateiliste je Paket (Mermaid-Chunks, KaTeX-Fonts, MathJax-Bundles) |
| D4 | `https://api.npmjs.org/downloads/point/last-week/{pkg}` | Downloads letzte Woche (Abschnitt 3.5) |
| D5 | `https://api.github.com/repos/{owner}/{repo}` | Sterne (Abschnitt 3.5) |
| D6 | npm-Tarball `LICENSE` je Paket (lokal ausgelesen) | Lizenztexte (Abschnitt 3.4) |
| D7 | esbuild 0.28.2 (repo-lokal `node_modules/@esbuild/win32-x64/esbuild.exe`) | Tree-Shaken-Bundles: chartjs 62 KB / echarts 186 KB / d3-light 23 KB / cytoscape 139 KB / katex 76 KB gzip |
| D8 | Playwright (repo-lokal `playwright-core`), `file://` + `route.abort()` | 8/8 Kandidaten rendern offline; Fehlersignale (Abschnitt 3.3) |
| D9 | https://arxiv.org/abs/2511.14967 (MermaidSeqBench, IBM) | 132 Samples, LLM-as-Judge; Qwen 2.5-7B 82,45 / Llama 3.1-8B 80,58; In-Context +16,0 pp / +26,9 pp |
| D10 | https://arxiv.org/html/2604.23027 (NL2Mermaid-Debugging) | Fehlerklassen: malformed syntax, fehlende activation, unklare Interaktionen |
| D11 | https://ar5iv.labs.arxiv.org/html/2604.05514 (OmniDiagram) | Mermaid-Syntaxfehler 52 (3B) vs. 52 (7B) — nicht modellgroessenabhaengig |
| D12 | https://drops.dagstuhl.de/storage/00lipics/lipics-vol394-esem2026/LIPIcs.ESEM.2026.19/LIPIcs.ESEM.2026.19.pdf | UML-State: Few-shot 28,7 % -> 93,5 % syntaktische Validitaet; strukturelle Validitaet bleibt 30 % |
| D13 | https://apexcharts.com/blog/state-of-javascript-charting-2026/ | unabhaengige Bestaetigung der Groessen: Chart.js 67 KB / ECharts 359 KB / D3 90 KB gzip |
| D14 | https://katex.org/ (Doku) + https://math.kilowatto.com/en/research/mc-23-ui-adult-expert/ | KaTeX synchron, selbstenthaltend, ~250 KB mit Fonts; MathJax 1,6 MB voll / 560 KB lazy |
| D15 | https://echartsforreact.com/docs/guides/tree-shaking/ + https://apache.github.io/echarts-handbook/en/basics/import/ | ECharts Tree-Shaking: voll ~1 MB, Line+Bar+Tooltip ~300 KB, einzelner Linienchart ~150 KB |
| D16 | https://www.roughjs.com/ / roughjs README (npm-Paket) | v4: `rough.svg(svg)` verlangt `SVGSVGElement`; `svg.appendChild(node)` Pflicht |
| D17 | repo-intern: `src/runtime/guard-static.js` | `ALLOW_SPECIFIERS`, `FORBIDDEN_TOKENS` (document/window/fetch), `import(`-Verbot |
| D18 | repo-intern: `src/runtime/budget.js`, `prompts/p1-generate.v6-standard.txt` | Modul-Budget < 34 000 Bytes hart je Lab; Komfort 1,5 MB / hart 2,0 MB |
| D19 | repo-intern: `docs/implementation-guide-3d-qualitaet.md` Abschnitte 1–5, M1–M6 | Rahmen, three.js r186 bleibt, Loop verdrahten, Negativmuster |
| D20 | repo-intern: `dist-standalone/modelmuse-standalone.html` | Importmap-Muster (`unpkg.com/three@0.186.1`) — Beleg fuer das CDN-Argument |
