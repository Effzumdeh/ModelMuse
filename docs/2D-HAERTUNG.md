# 2D-Härtung — Semantik-/Layout-Gates je Typ (29.10.2026)

Stand: 29.10.2026. Vorarbeit: `docs/2D-STACK-EVAL.md` (Top-1 je Typ),
`docs/2D-UMSTELLUNG-2026-10-28.md` (6 Alt-Modelle → SVG-Datenmodule, P0-Router),
`docs/2D-ALLE-VARIANTEN.md` (alle 5 Vendor-Dateien, 5 Demo-Modelle, v14).
Diese Datei dokumentiert die **Härtung**: je 2D-Typ zusätzliche
Semantik-/Layout-Prüfschritte (`S2-2d-semantik`, `S2-2d-layout` in
`src/runtime/verify-2d.js`), die verschärften Prompt-Regeln
(`prompts/p1-generate-2d-varianten.txt`, Version 2.0 „Gehärtet“) und den
Vorher/Nachher-Befund mit Screenshot-Pfaden plus Sichtprüfung.

Keine neuen Modelle, kein Provider-Wechsel (Proxy-Default
`meta-muse/muse-spark-1.3-contributor`, OpenRouter nur explizit per BYOK).

## 0. Was „Vorher“ und „Nachher“ bedeutet

- **Gate-Ebene:** Vorher = Stand 28.10. (nur parse + Pixel + Typ-Whitelist —
  Edel-Defekte wie fehlende Einheit, erfundene Knoten oder Inseln passieren
  den Vendor-Render trotzdem). Nachher = zusätzlich `S2-2d-semantik` +
  `S2-2d-layout` (7 Kriterien je Modell, Ids variantenübergreifend identisch).
  Beleg je Typ: Negativfall in `tests-unit/2d-alle-varianten.test.mjs`
  (Abschnitt „Härtung Semantik/Layout“), der vorher gepasst hätte und jetzt
  `fail` liefert.
- **Screenshot-Ebene:** Vorher = `dist-2d/vorher/vorher-demo-2d-<typ>.png`
  (+ `dist-2d/vorher/vorher-shot-report.json`, 29.10. 12:46 UTC).
  Nachher = `dist-2d/demo-2d-<typ>.png` (+ `.html`,
  `dist-2d/shot-2d-variants-report.json`, 29.10. 12:56 UTC, frisch
  verifiziert via `node scripts/shot-2d-variants.mjs`: 5/5 pass).
  Befund: 4/5 byte-identisch (Demos waren bereits korrekt), d3 minimaler
  Re-Render-Delta (28399 → 26089 Bytes bei gleichen 22 Shapes, +25
  nicht-weisse Pixel durch Anti-Aliasing — kein Inhaltswechsel).

## 1. Verbindliche Normwerte (`TWOD_NORM`, `src/runtime/verify-2d.js`)

| Norm | Wert | Gilt für |
|---|---|---|
| `minFontPx` | kein Text unter **10 px** | alle (Schul-Lesbarkeit) |
| `minGapPx` | Knoten-Boxen mind. **8 px** Abstand | svg, mermaid, d3, chart |
| `edgeSnapPx` | Pfeilende max. **18 px** vom Knoten | svg, mermaid (ausser sequenz), d3 |
| `maxNodes` | max. **12 Knoten** | mermaid (2–12), d3 (3–12) |
| `maxTexLen` | Formel **3–400 Zeichen** | katex |

Variantenübergreifend (alle 5): `labels` EXAKT = `meta.parts` (gleiche
Reihenfolge, 3–8 nicht-leere deutsche Begriffe, keine Dubletten),
`measurement` IMMER „Name: Zahl Einheit“ (Zahl + Einheit Pflicht),
`meta.detailLevel === 2`, `meta.units === 'm'`,
`meta_i18n.en/es.parts.length === meta.parts.length`,
`meta_2d.kind` MUSS zum Datenliteral passen, `meta_2d.version === 1`.

## 2. Je Typ: Prüfschritte + Prompt-Regeln + Vorher/Nachher

### 2.1 SVG nativ — Technik-Skizze (`2d-svg`, `diagram`, Vendor ~12 KB, 0 Bytes Lib)

**Prüfschritte.**
Semantik: labels = Legende (EXAKT `meta.parts`); measurement Zahl+Einheit;
`bars`: values 1–6 Zahlen. Layout: Schrift ≥ 10 px; Knoten-Abstand ≥ 8 px;
keine Text-Überlappung; jede Kante beginnt/endet an einem Knoten
(≤ 18 px Toleranz).

**Prompt-Regeln (P1 v2.0):** nur `2d-svg`-Import; kind aus
`er|bpmn|etl|uml|bars|chain|generic`; labels EXAKT = parts;
measurement-Pflicht; values nur bei `bars`.

**Vorher/Nachher:** vorher `dist-2d/vorher/vorher-demo-2d-svg.png`,
nachher `dist-2d/demo-2d-svg.png` — **byte-identisch**
(md5 `6fca32878b9dbe5cbfefa5c7972339e3`), 14 Shapes, 77 122 nicht-weisse
Pixel, 9 438 Bytes. **Sichtprüfung (nachher):** Titel „Wasserkocher
Seitenansicht“, 4 Blöcke in 2×2-Anordnung (Gehaeuse/Heizplatte/Schalter/
Fuellstand), Masslinie „Hoehe: 22 cm“. Keine Überlappung, alle Texte lesbar.
Ehrliche Limits: Höhenangabe mit horizontaler Linie (statt vertikal),
symbolische Blöcke statt echtem Seitenriss, Umlaut-Umschrift (ae/oe statt
ä/ö — ASCII-Norm der Vendor-Renderer).

### 2.2 Mermaid — Diagramm (`2d-mermaid`, `mermaid`, Chunk-Selektion, 567 KB ESM)

**Prüfschritte.**
Semantik: 2–12 Knoten, mind. 1 Kante (ausser `gantt`); JEDE Legenden-Angabe
muss als Knoten im Diagramm vorkommen (Abdeckung beider Richtungen:
keine erfundenen Knoten ohne Legende, keine Legende ohne Knoten); Kanten nur
zwischen vorhandenen Knoten; `sequenz`: max. 6 Teilnehmer; `gantt`: Aufgaben
mit Datum (YYYY-MM-DD). Gate-Signal: `parseMermaid` wirft mit Zeile/Spalte.
Layout: Schrift ≥ 10 px; Knoten-Abstand ≥ 8 px; Kanten an Knoten (Ausnahme
`sequenz`: Kanten zwischen Lebenslinien, diagrammtypisch zulässig).

**Prompt-Regeln (P1 v2.0):** source beginnt mit `graph TD|LR` (fluss),
`sequenceDiagram` (sequenz), `erDiagram` (er) oder `gantt` (gantt) — nur
diese vier Chunk-Typen; 2–12 Knoten; jede labels-Angabe ein Knoten.

**Vorher/Nachher:** vorher `dist-2d/vorher/vorher-demo-2d-mermaid.png`,
nachher `dist-2d/demo-2d-mermaid.png` — **byte-identisch**
(md5 `bcbf57eb489e1a5ccb8663b88c349b47`), 21 Shapes, 30 280 nicht-weisse
Pixel, 17 669 Bytes. **Sichtprüfung (nachher):** Titel „Photosynthese Ablauf“,
5 Knoten (Lichtreaktion → Wassermangel?-Raute → Calvin-Zyklus/Glukose +
Spaltoeffnung-zu), Kantenlabels „ja/nein“, Masszeile „Dauer: 6 h,
Band: 60 cm“. Keine Box-Überlappung, alle Box-Texte vollständig.
Ehrliche Limits: Diagonale Calvin→Glukose verläuft quer durchs Bild,
„ja“-Label winzig direkt auf der Vertikallinie, naives Layout ohne dagre —
Mechanismus und Gates sind produktiv, Typografie ist Schul-, nicht Druckniveau.

### 2.3 Chart — Kennlinienvergleich (`2d-chart`, `chart`, 62 KB tree-shaken)

**Prüfschritte.**
Semantik: `labels.length === values.length` (jeder Wert braucht Kategorie);
`unit`-Pflicht (max. 8 Zeichen, auch im measurement erwähnt oder ableitbar);
keine negativen Werte; Werte nicht alle gleich (Vergleich braucht Spreizung:
balken/linie 3–6 Werte, kreis 2–6); kreis-Segmente beschriftet.
Gate-Signal: Typ-Whitelist (`E-CHART-TYP` — die echte Lib wirft NICHT, daher
fängt nur das Gate falsche Typen). Layout: horizontale Achse sichtbar
(≥ 300 px), mind. 3 Skalen-Ticks, jeder Balken/Punkt mit Wert beschriftet,
Schrift ≥ 10 px.
**Härtungs-Beispiel (verifiziert):** `unit: ''` rendert im Vendor klaglos
ohne Einheit (alter Gate-Stand: pass) — neues Semantik-Gate: `fail`
(„unit fehlt/leer/zu lang“), Gesamt verdict `fail`.

**Prompt-Regeln (P1 v2.0):** values balken/linie 3–6 Zahlen ≥ 0, kreis 2–6;
unit-PFLICHT (max. 8 Zeichen, z. B. „%“, „1/min“);
`labels.length` MUSS = `values.length`; Werte mit Spreizung.

**Vorher/Nachher:** vorher `dist-2d/vorher/vorher-demo-2d-chart.png`,
nachher `dist-2d/demo-2d-chart.png` — **byte-identisch**
(md5 `357d6c0f99b0494988dd709314478b81`), 28 Shapes, 51 258 nicht-weisse
Pixel, 11 265 Bytes. **Sichtprüfung (nachher):** Titel
„Wirkungsgradvergleich“, Y-Achse 0–100 mit `%`, 4 Balken
[82, 91, 76, 88] mit Wert-Labels über den Säulen, Peak B (91 %) farblich
hervorgehoben. Achsen, Ticks, Werte sauber getrennt, nichts abgeschnitten.
Keine Befunde — Referenzbeispiel der Härtung.

### 2.4 d3-light — Graph/Netz (`2d-d3`, `graph`, 5 Submodule, ~19 KB gzip)

**Prüfschritte.**
Semantik: 3–12 Knoten; keine Selbstkanten (`from != to`); keine Doppelkanten;
Graph MUSS zusammenhängend sein (BFS ab erstem Knoten erreicht alle —
keine Inseln); Knoten-Labels (als Menge) EXAKT = Legende.
Gate-Signal: `node not found` deterministisch; leerer Graph via Pixel-Gate.
Layout: deterministisches Radial-Layout (kein Zufall); Schrift ≥ 10 px;
Knoten-Abstand ≥ 8 px; Kanten an Knoten.

**Prompt-Regeln (P1 v2.0):** 3–12 Knoten; Knoten-Labels (Menge) = labels;
keine Selbst-/Doppelkanten; zusammenhängend (jede Entität erreichbar).

**Vorher/Nachher:** vorher `dist-2d/vorher/vorher-demo-2d-d3.png`
(28 399 Bytes), nachher `dist-2d/demo-2d-d3.png` (26 089 Bytes) —
**einziger Typ mit Delta**: gleiche 22 Shapes, 19 427 → 19 452 nicht-weisse
Pixel (+25, Anti-Aliasing-Re-Render, kein Inhaltswechsel, S2/S4 weiter pass).
**Sichtprüfung (nachher):** Titel „Rechnernetz Sterntopologie“, 5 Knoten
(Router, Switch Nord/Sued, Client A/B), 4 Kanten (2× „1 G“ Router–Switch,
2× Client–Switch über Kreuz). Keine Knoten-Überlappung, alle Labels lesbar
(eng in Kreisen eingepasst, „1 G“ an Router–Sued nahe Kreuzungszone, aber
zuordenbar). Ehrliche Limits: trotz Titels kein echter Stern (zwei Ketten
mit Kreuzverbindung), X-Kreuzung ohne Knoten ist beabsichtigt,
Umlaut-Umschrift (Sued/Linklaenge).

### 2.5 KaTeX — Formel (`2d-katex`, `formula`, 76 KB JS + 57 KB Subset-Fonts)

**Prüfschritte.**
Semantik: tex 3–400 Zeichen, MUSS „=“ oder Befehl enthalten (echte Formel,
kein Fliesstext/Einzelwort); nur Whitelist-Befehle
(`frac|sqrt|sum|int|cdot|times|div|pm|alpha|beta|gamma|pi|infty|
leq|geq|neq|rightarrow|left|right|text|mathrm`); Klammern balanciert.
Gate-Signal: `throwOnError:true` erzwungen — Fehler werfen, ein
`katex-error`-Span lässt das Gate gezielt failen. Layout: Mindestschrift
(Inline-CSS-Scan), Formel + Titel + alle Legenden-Chips sichtbar
(Chips = min(labels, 6)), kein Fehler-Span.

**Prompt-Regeln (P1 v2.0):** tex 3–400 Zeichen mit „=“ oder Befehl;
nur Whitelist-Befehle; Klammern balanciert (`throwOnError:true` wirft sonst).

**Vorher/Nachher:** vorher `dist-2d/vorher/vorher-demo-2d-katex.png`,
nachher `dist-2d/demo-2d-katex.png` — **byte-identisch**
(md5 `7b5631be149115c6fbbecc47826303d5`), 24 Shapes, 12 693 nicht-weisse
Pixel, 15 673 Bytes. **Sichtprüfung (nachher):** Titel „pq-Formel Loesungen“,
korrekte Formel `x_{1,2} = -p/2 ± √((p/2)² − q)` mit Bruch-Stacks,
mitwachsenden `\left/\right`-Klammern und durchgehendem Wurzel-Vinculum;
4 Legenden-Chips (Normalform/Diskriminante/pq-Formel/Loesungen);
Masszeile „Formelbreite: 12 cm“. Keine Überlappung, kein Fehler-Span.
Ehrliche Limits: System-Serif statt echter KaTeX-Font-Metriken
(Anhaltswerte — Mechanismus produktiv, Typografie Schul-, nicht Druckniveau).

## 3. Kriterium-Ids (variantenübergreifend, je Modell 7×)

`S2-2d-parse` (2d-Import) · `S2-2d-typ` (Kind-Whitelist) ·
`S2-2d-semantik` (NEU: Achsen/Labels/Einheiten/Legende + meta-Konsistenz) ·
`S2-2d-parse-svg` (Vendor-Render wohlgeformt) ·
`S2-2d-pixel` (≥ 4 Formen im GERENDERTEN Output; Browser zählt zusätzlich
nicht-leere Alphapixel) · `S2-2d-layout` (NEU: Schrift/Abstand/Kanten) ·
`S2-2d-wellformed` (kein `<script>`, keine Fremd-URL). S4-light: ≤ 800 Formen,
Modul ≤ 34 000 Bytes je Variante. S3: `dist-2d/<id>.png` (§2).

## 4. Schluss-Belege (29.10.2026, final, alles exit 0)

| Nachweis | Befehl | Ergebnis |
|---|---|---|
| Build | `npm run build` | OK, hash `cdd08f99a5817d69` |
| Verify | `npm run verify:all` | OK — **18 Modelle, alle gelb [keine Fehler]** (gelb = Warnungen, 0 Fehler); `dist/verify-report.json` mit `routes.models2d` (11× 2D: ae-1..3, dup-1..3, 5 Demos) |
| Unit | `npm run test:unit` | **155/155 pass, 0 fail** (inkl. `2d-alle-varianten.test.mjs`: Allowlist, Gates je Demo, Negativ je Variante, Härtung Semantik/Layout, P0-Parse, P1-Variantenwahl) |
| Smoke | `node scripts/smoke-2d-varianten.mjs` | **6/6 pass** (1× 3d + 5× 2D je Variante, Routing+S1+S2+Render) plus Fail-closed-500 → 3D-Fallback; `dist-2d/smoke-2d-varianten.json` |
| Screenshots | `node scripts/shot-2d-variants.mjs` | 5/5 pass (Tabelle in `docs/2D-ALLE-VARIANTEN.md` §6); Vorher-Beleg `dist-2d/vorher/` unverändert aufbewahrt |
| Standalone v14 | `node scripts/verify-standalone.mjs` | OK — 5 LABS + 5 META (is3d:false), 5 Vendor-IIFE + Dispatcher, Artefakt 362 894 Bytes (< 600 KB, GitHub-Pages) |

## 5. Offen / bewusst nicht (Härtung ändert nichts daran)

- Umlaut-Umschrift (ae/oe/ue) in allen 5 Demos — ASCII-Norm der
  dependency-freien Vendor-Renderer, i18n-Fallbacks (`meta_i18n`) tragen die
  echten Sprachen.
- Mermaid-Layout naiv (kein dagre), KaTeX ohne echte Font-Metriken —
  Mechanismus + Gates produktiv, Typografie Schulniveau (Eval §3.3).
- d3-Sterntopologie fachlich eher Kette mit Kreuzverbindung; X-Kreuzung
  beabsichtigt (kein Knoten an Kreuzung).
- 2D-Libs aus der Eval bleiben ausgelagert (Chunk-Selektion/Font-Subsetting
  dokumentiert, nicht eingebunden); Einbindung erst bei neuem 2D-Typ, dann
  zwingend als Vendor-Datei + Spec in `ALLOW_2D_SPECIFIERS`.
