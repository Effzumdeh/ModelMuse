# Modellportfolio-Vorschlag (3D-/2D-Trennung)

- Stand: 28.10.2026. Repo: `C:/Users/flori/OneDrive/skillSpark`, Branch `main` (e06adfe).
- Auftrag: Inventur des Standarddatensatzes, fachliche Bewertung „3D sinnvoll?“, Vorschlag
  Behalten-als-3D / Umstellen-auf-2D, konkretes Ersatzmolekül mit three.js-Budget-Nachweis.
- **Kein Code geändert.** Dieses Dokument ist ein Vorschlag; Umsetzung wäre Folgeauftraege.
- Belege: `src/models/`, `src/models/manifests/`, `src/data/modellmatrix.json`,
  `dist/baselines/`, `dist/final-budgets.json`, `dist/verify-report.json`,
  `dist-standalone/skillspark-standalone.html`, `dist-standalone/proof-report.json`,
  `scripts/build-standalone.mjs`, `scripts/chemie-e2e.mjs`, `src/runtime/didactics.js`,
  `src/schema/manifest.schema.json`, `src/shell/ui-livegen.js`, `docs/implementation-guide-3d-qualitaet.md`.

---

## 0. Kurzfassung der Empfehlung

| Portfolio-Ziel | Labs | Ergebnis |
|---|---|---|
| **Behalten als 3D (6)** | `gpu-example`, `si-1`, `si-2`, `si-3`, `free-handbohrmaschine`, `chemie-koffein` (neu) | Hardware, gestapelte/gesteckte Baugruppen und echte Raum- bzw. Werkmaße |
| **Umstellen auf 2D (6)** | `dup-1`, `dup-2`, `dup-3`, `ae-1`, `ae-2`, `ae-3` | reine Notations-/Diagramm-Lernziele; 3D erzeugt falsches mentales Modell |
| **Ersatz für H2O** | `chemie-koffein` (C8H10N4O2) statt `chemie-h2o` | 24 Atome, 2 Ringsysteme, 6–8 benennbare Teile; **9.648 Tris = 6,4 %** des 150-k-Budgets |

Drei Befunde, die den Vorschlag tragen:

1. **Die 2D-Schaltfläche existiert nur im Standalone-Artefakt.** `dist-standalone/skillspark-standalone.html`
   hat `renderDiagram2D` mit fertigen SVG-Zweigen für **alle 9 kuratierten Labs** und ein
   `META[id].is3d`-Flag pro Lab. `src/` (Haupt-Build) hat **kein** `is3d`, **kein**
   `renderDiagram2D` — dort ist „2D“ nur der Notfallpfad F3 (`src/runtime/fallback2d.js`:
   flache Bauteilliste + Platzhalter-Kästchen, Text „Schematische Ansicht (3D nicht verfuegbar)“).
   → „Auf 2D umstellen“ ist im Standalone ein Flag-Dreher pro Lab, im Haupt-Build ein Feature-Bau.
2. **Die beiden Artefakte haben verschiedene Lab-Sätze.** GPU ist nur im Haupt-Build kuratiert,
   die Bohrmaschine nur im Standalone (ohne Manifest/Matrix/Baseline). Ein Portfolio gibt es
   derzeit nicht, sondern zwei divergierende.
3. **Das H2O-Problem ist kein Modellfehler, sondern eine Einheiten-/Extraktions-Sache.**
   `src/runtime/didactics.js` (`UNIT_RE`) und `src/schema/manifest.schema.json`
   (`unit`-Enum) erlauben nur `mm|cm|m|HE|kB|MB` — **kein `pm`**. `extractMeasureHints` in
   `src/shell/ui-livegen.js` filtert mit derselben Regex, findet bei „96 pm“ keine Einheit und
   verwirft den Messhinweis komplett (Fallback „Breite: 40 cm“). Beleg: `dist/chemie-h2o-meta.json`
   → `zahlenGefunden: []`, `labelsGefunden: ["O","H"]`, d. h. die Spec-Zahlen 104,5/96 standen
   **nie** in der Annotation-Liste. NaCl (`dist/chemie-nacl-meta.json`): `zahlenGefunden: []`,
   `labelsGefunden: []`, `kein-rot=false` → Verify **rot**.

---

## 1. Inventur Standarddatensatz

Kanonische Quelle des Standarddatensatzes ist `src/models/` + `src/models/manifests/` +
`src/data/modellmatrix.json`; die Baseline-Snapshots liegen in `dist/baselines/`.
Der Standarddatensatz umfasst **10 kuratierte Labs**. Die Chemie-Artefakte H2O/NaCl sind
**keine** kuratierten Labs, sondern Testfall-Belege aus dem Freimodus-Pfad
(`scripts/chemie-e2e.mjs`, dort ausdrücklich: „NICHT in kuratierte Bibliothek“).

### 1.1 Tabelle A — Alle Labs/Modelle

| ID | Titel (de) | Track | Aktuell 3D/2D<br>Haupt-Build | Aktuell 3D/2D<br>Standalone | Modell-Datei | Manifest | Matrix-Eintrag | Baseline | Modul-Bytes | Tris (gemessen) | Draw-Calls |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gpu-example` | Graphics Card | free | **3D** | **fehlt** (kein Lab im Standalone) | `src/models/gpu-example.js` | `src/models/manifests/gpu-example.json` | ja (`labelsMin: 10`, `units: ["mm"]`) | `gpu-example-overview.png`, `gpu-example-detail.png` | 21.604 | 10.144 | 117 |
| `si-1` | PC-Arbeitsplatz (SI-1) | SI | 3D | 3D (`is3d:true`) | `src/models/si-1.js` | `…/si-1.json` | ja (`labelsMin: 5`, `units: ["cm"]`) | `si-1-overview.png`, `si-1-detail.png` | 15.837 | 2.688 | 60 |
| `si-2` | Netzwerk-Verkabelung (SI-2) | SI | 3D | 3D (`is3d:true`) | `src/models/si-2.js` | `…/si-2.json` | ja (`labelsMin: 4`, `units: ["m"]`) | `si-2-overview.png`, `si-2-detail.png` | 13.224 | 9.594 | 34 |
| `si-3` | Server-Rack (SI-3) | SI | 3D | 3D (`is3d:true`) | `src/models/si-3.js` | `…/si-3.json` | ja (`labelsMin: 4`, `units: ["HE"]`) | `si-3-overview.png`, `si-3-detail.png` | 10.604 | 7.250 | 30 |
| `dup-1` | ER-Modell (DuP-1) | DuP | 3D | **2D** (`is3d:false` → `renderDiagram2D`) | `src/models/dup-1.js` | `…/dup-1.json` | ja (`labelsMin: 4`, `units: ["cm"]`) | `dup-1-overview.png`, `dup-1-detail.png` | 10.994 | 3.634 | 34 |
| `dup-2` | BPMN-Prozess (DuP-2) | DuP | 3D | **2D** (`is3d:false`) | `src/models/dup-2.js` | `…/dup-2.json` | ja (`labelsMin: 4`, `units: ["cm"]`) | `dup-2-overview.png`, `dup-2-detail.png` | 13.076 | 12.106 | 51 |
| `dup-3` | ETL-Pipeline (DuP-3) | DuP | 3D | **2D** (`is3d:false`) | `src/models/dup-3.js` | `…/dup-3.json` | ja (`labelsMin: 4`, `units: ["cm"]`) | `dup-3-overview.png`, `dup-3-detail.png` | 14.963 | 7.210 | 38 |
| `ae-1` | UML-Klasse (AE-1) | AE | 3D | 3D (`is3d:true`) | `src/models/ae-1.js` | `…/ae-1.json` | ja (`labelsMin: 4`, `units: ["cm"]`) | `ae-1-overview.png`, `ae-1-detail.png` | 12.305 | 2.314 | 42 |
| `ae-2` | Bubblesort-Vergleich (AE-2) | AE | 3D | 3D (`is3d:true`) | `src/models/ae-2.js` | `…/ae-2.json` | ja (`labelsMin: 3`, `units: ["cm"]`) | `ae-2-overview.png`, `ae-2-detail.png` | 12.369 | 1.688 | 30 |
| `ae-3` | Client-Server-API (AE-3) | AE | 3D | 3D (`is3d:true`) | `src/models/ae-3.js` | `…/ae-3.json` | ja (`labelsMin: 4`, `units: ["m"]`) | `ae-3-overview.png`, `ae-3-detail.png` | 14.803 | 1.890 | 36 |
| `free-handbohrmaschine` | Handbohrmaschine | Free | **fehlt** | 3D (`is3d:true`) | nur im Standalone eingebettet (`INIT['free-handbohrmaschine']`) | **fehlt** | **fehlt** | **fehlt** | 8.048 (Modulquelle laut `dist-standalone/ledger-muse-calls.md`) | – | – |
| `chemie-h2o` | Wassermolekül H2O | – (Testfall) | **fehlt** (Freimodus-Beleg) | **fehlt** | keines | keines | keines | keines | – | – | – |
| `chemie-nacl` | Natriumchlorid-Gitter | – (Testfall) | **fehlt** (Freimodus-Beleg) | **fehlt** | keines | keines | keines | keines | – | – | – |
| `chemie-koffein` (Vorschlag) | Koffein-Molekül | free (neu) | **fehlt** (neu anzulegen) | **fehlt** (neu anzulegen) | neu `src/models/chemie-koffein.js` | neu | neu | neu | Ziel < 20.000 | **9.648** (s. §4) | **49** (bzw. 5 instanziert) |

Belegte Zusatzbefunde zur Inventur:

- **Budget-Ist** (`dist/final-budgets.json`, Browser-Probe, 27.10.): Maximum derzeit 12.106 Tris
  (`dup-2`) und 117 Draw-Calls (`gpu-example`) gegen Limits 150.000 / 400 (`src/runtime/budget.js`,
  `DEFAULT_BUDGET_LIMITS`). Alle 10 Labs sind **weit** unter Budget — das Budget ist derzeit
  **nicht** der Engpass, die didaktische Eignung ist es.
- **`dist/baselines/`**: 22 PNG = 20 echte Snapshots (10 Labs × overview/detail) + 2 Byte-Duplikate
  (`detail.png` ≡ `gpu-example-detail.png`, `overview.png` ≡ `gpu-example-overview.png`;
  per sha256 bestätigt). Also 2 Dateien ohne eigenen Lab-Bezug.
- **Messwert-Konsistenz** (Manifest-Endpunkte gegen Textwert, alle 11 Messungen der 10 Labs geprüft):
  10 von 11 stimmen geometrisch (`|Δ| < 2 mm`), **eine nicht**: `si-2` zeichnet 0,400 m,
  der Text nennt „Kabellaenge: 2 m“ (erwartet 2,000 m). Das ist ein fachlicher Fehler im
  Messwert, unabhängig von der 2D/3D-Frage, und sollte mit korrigiert werden.
- **`dist/verify-report.json`**: alle 10 Labs „gelb“ (auto-geprüft), S3/S4 durchgängig `skip`
  („Beleg aelter als Modellquelle“) — die Screenshot-Belege sind älter als die Modellquellen.
  Für ein Portfolio, das auf Screenshots geprüft wird, ist das ein offener Punkt.

---

## 2. Tabelle B — Fachliche Bewertung: macht 3D Sinn?

Bewertungsmaßstab (aus der Produktlogik der Standalone-i18n
`is3dReason: „Diagramme/Tabellen/Prozesse → 2D, sonst 3D.“` und dem Freimodus-Prompt
`buildFreePrompt`: „KI entscheidet meta.is3d (true/false): Diagramme/Tabellen/Prozesse → false,
sonst true“): **3D ist dann sinnvoll, wenn das Lernziel räumlich ist** — Einbaulage, Stöckung,
Steckpfade, reale Werk- bzw. Baumaße. **3D ist kontraindiziert**, wenn das Lernziel eine
flache Notation, ein Flussdiagramm oder ein Algorithmus-Trace ist: dort erzeugt der 3D-Körper
eine Bauform-Suggestion, die es in der Fachnotation nicht gibt, und verkürzt die Perspektive
den für die Aufgabe nötigen Vergleich.

| ID | 3D sinnvoll? | Begründung (1 Satz) | Beleg / Bildbefund |
|---|---|---|---|
| `gpu-example` | **ja** | Gestapelte Hardware-Bauteile (PCB, Kühler/2 Lüfter, Backplate, PCIe-Stecker, Slotblende) und echte Werkmaße 267 mm / 40 mm sind räumlich; ein 2D-Aufsichtsplan verlöre die Einbaulage. | `dist/baselines/gpu-example-overview.png` |
| `si-1` | **ja** | Steck- und Sockel-Geometrie (CPU-Socket, DIMM-Slots, PCIe-Slot, abgesetztes Netzteil) *ist* der Lerninhalt und nur räumlich korrekt darstellbar. | `dist/baselines/si-1-overview.png` |
| `si-2` | **ja** (mit Reparatur) | Portlagen und Kabelführung Patchfeld→Switch→Router→Client sind räumlich; das aktuelle 3D-Modul ist allerdings zu dunkel, alle Geräte sind gleich schwarz und der Client ist verdeckt — das ist ein Render-Mangel, kein 3D-vs-2D-Argument. | `dist/baselines/si-2-overview.png` (Sichtung) |
| `si-3` | **ja** | 19″-Rack mit 18-HE-Höhenraster, Frontansicht der Wechseldatenträger und redundantes Netzteil sind räumliche Eigenschaften, die 2D nicht transportiert. | `dist/baselines/si-3-overview.png` |
| `dup-1` | **nein** | Die ER-Notation (Entitätstafel, Primärschlüssel-Feld, Beziehungslinie, Kardinalität) ist eine flache Symbolsprache; 3D-Körper suggerieren Materialität, die es in ER nicht gibt. | Standalone ist bereits `is3d:false` |
| `dup-2` | **nein** | BPMN ist eine flache Prozessnotation; die 3D-Klotz-Metapher verwechselt die Symbolform mit der Notation und erfindet eine physikalische „Pfadlänge: 60 cm“. | `dist/baselines/dup-2-overview.png` (Sichtung: „Pfadlänge“ suggeriert räumliche Länge) |
| `dup-3` | **nein** | Die ETL-Pipeline ist eine lineare Datenflusskette ohne jeden Raumbezug; 3D fügt Perspektive hinzu, aber keine Information. | Standalone ist bereits `is3d:false` |
| `ae-1` | **nein** | Die UML-Klassenbox ist per Definition flach (Rechteck mit Trennlinien); als 3D-Platte mit Schrauben und freistehendem Pyramidenspitzen-„Pfeil“ erzeugt das Modell eine Bauform, die es in UML nicht gibt. | `dist/baselines/ae-1-overview.png` (Sichtung) |
| `ae-2` | **nein** | Der Lerninhalt ist ein Algorithmus-Trace (Vergleich zweier Nachbarn + Tausch); die dafür nötige Höhenpräzision liefert ein 2D-Balkendiagramm, während 3D-Perspektive genau die Balkenhöhe verzerrt. | `dist/baselines/ae-2-overview.png` (3D lesbar, aber höhenverzerrt) |
| `ae-3` | **nein** | Request→Gateway→Server→DB ist ein logischer Ablauf ohne räumliche Maße; die 3D-Kette verdeckt Client und Datenbank am Bildrand und lässt den Server dominieren. | `dist/baselines/ae-3-overview.png` (Sichtung: Client/DB angeschnitten, „Distanz: 1 m“ frei erfunden) |
| `free-handbohrmaschine` | **ja** | Gehäuse, Griff, Bohrfutter, Bohrer, Schalter und Lüftungsschlitze sind räumlich zugeordnet, die 448 mm Länge ist ein reales Werkmaß. | `dist-standalone/proof-free-handbohrmaschine-v12.png` |
| `chemie-h2o` (Testfall) | **nein** | Drei Atome und ein Winkel liefern keinen räumlichen Mehrwert; zusätzlich sind die Labels in der Distanz unlesbar (Befund `docs/NEXT-STEPS.md` §2.3) — Ursache ist die feste Sprite-Höhe `sizePx * 0.0009 m` bei winzigen Atomradien. | `dist/chemie-h2o-meta.png` (Sichtung: Atome riesig, Labels unlesbar) |
| `chemie-nacl` (Testfall) | **nein** | Ein kubisch flächenzentriertes Gitter hat zwar Raumbezug, aber keine benennbaren Einzelteile jenseits „Ion“; als Lerninhalt bleibt nur eine Abstandszahl ohne Teilbezug — und der Verify-Lauf war rot. | `dist/chemie-nacl-meta.json` (`kein-rot=false`) |
| `chemie-koffein` (Vorschlag) | **ja** | 24 Atome in zwei Ringsystemen mit drei Methyl- und zwei Carbonylgruppen ergeben 6–8 benennbare Teile und mehrere messbare Bindungslängen; die Ringebene vs. die herausstehenden Methylgruppen ist genau die räumliche Aussage, die 2D nicht liefern kann. | s. §4 |

**Querschnitts-Befund zur Label-Lesbarkeit** (unabhängig von 2D/3D): Die Label-Sprites skalieren
mit `sizePx * 0.0009 m` fest in Weltmetern (`src/runtime/annotate.js`), nicht mit der Kamera.
Folge: bei `gpu-example` (10 Labels auf 0,22 m Spannweite) überlagern sich die Labels im
Overview zu einem unlesbaren Klumpen, bei `chemie-h2o` sind sie winzig. Ein Portfolio-Umbau
löst das nicht; es braucht eine LOD-Regel (Basis ≤ 5 Labels ist bereits im Patch vorhanden,
`buildLevelPatch('basis')`).

---

## 3. Tabelle C — Vorschlag: Behalten-als-3D und Umstellen-auf-2D

### 3.1 Behalten als 3D (6 Labs)

| ID | Zielzustand | Wo | Konkrete Umsetzung | Aufwand |
|---|---|---|---|---|
| `gpu-example` | 3D, **im Standalone ergänzen** | Haupt-Build ja / Standalone nein | Lab in `dist-standalone/skillspark-standalone.html` nachtragen (`INIT['gpu-example']`, `META['gpu-example'].is3d = true`, LABS-Eintrag mit `curriculum_ref`/Quiz) + Builder-Guards nachziehen (s. §5) | M |
| `si-1` | 3D unverändert | beide | keine Änderung; Baseline nach F3-Umzug neu abnehmen | S |
| `si-2` | 3D + Render-Fix | beide | Licht/Port-LED-Detail, **alle vier** Verbindungen Switch↔Patchfeld↔Router↔Client zeichnen, Client sichtbar platzieren; zusätzlich Messwert-Fix 0,400 m → 2,000 m (Text „Kabellänge: 2 m“) | M |
| `si-3` | 3D unverändert | beide | keine Änderung | S |
| `free-handbohrmaschine` | 3D, **kuratisieren** | nur Standalone, ohne Manifest/Matrix/Baseline | Modul nach `src/models/` übernehmen, `src/models/manifests/free-handbohrmaschine.json` anlegen (track `free`, ≥3 Labels, ≥1 Messung, B/A/P = 0/2/1), Matrix-Eintrag, 2 Baseline-Snapshots | M |
| `chemie-koffein` | 3D, neu (s. §4) | neu | Modul + Manifest + Matrix + 2 Baselines; **zusätzlich** `scripts/chemie-e2e.mjs` `SPECS` von `h2o`/`nacl` auf `kaffee` umstellen (Spec in **mm**, s. §4.3) | M |

### 3.2 Umstellen auf 2D (6 Labs)

| ID | Ist (Haupt-Build) | Ist (Standalone) | Ziel | Konkrete Umsetzung | Aufwand |
|---|---|---|---|---|---|
| `dup-1` | 3D | 2D | 2D | Standalone: nur `META['dup-1'].is3d` bleibt `false` — **kein Eingriff**. Haupt-Build: braucht den 2D-Pfad (s. 3.3) | S / M |
| `dup-2` | 3D | 2D | 2D | dito | S / M |
| `dup-3` | 3D | 2D | 2D | dito | S / M |
| `ae-1` | 3D | 3D | **2D** | Standalone: `META['ae-1'].is3d = false` — der `renderDiagram2D`-Zweig für `ae-1` **existiert bereits** (Klassenbox mit Trennlinien + Vererbungspfeil). Haupt-Build: 2D-Pfad nötig | S / M |
| `ae-2` | 3D | 3D | **2D** | Standalone: `META['ae-2'].is3d = false` (SVG-Zweig existiert: Balkenfeld + Marker + Tauschpfeil). Haupt-Build: 2D-Pfad nötig | S / M |
| `ae-3` | 3D | 3D | **2D** | Standalone: `META['ae-3'].is3d = false` (SVG-Zweig existiert: Client→Gateway→Server→DB-Kette). Haupt-Build: 2D-Pfad nötig | S / M |

Nach dieser Umsetzung gilt die Standalone-Regel „Diagramme/Tabellen/Prozesse → 2D, sonst 3D“
vollständig konsistent: 6× 3D (Hardware/Chemie), 6× 2D (Notation/Diagramm).

### 3.3 Querschnittsaufgabe — 2D-Infrastruktur im Haupt-Build

Im Haupt-Build (`src/`) existiert **kein** fachlicher 2D-Pfad:

- `src/shell/index.html` hat einen Button „2D-Modus“ → `main.js: useFallback2D()` →
  `player.fallback2D(level)` → `src/runtime/fallback2d.js: renderFallback2D()`. Das ist eine
  **Notfall-Ersatzansicht** (Bauteilliste + leere Platzhalter-Kästchen), kein fachliches
  2D-Diagramm, und die UI meldet es korrekt als „WebGL nicht verfügbar – 2D-Fallback aktiv“.
- `src/` enthält weder `renderDiagram2D` noch ein `is3d`-Flag (verifiziert: 0 Treffer in
  `src/`, 0 Treffer in `dist/lab-player.html`).

Für „nur fachlich sinnvolle 3D behalten, Rest 2D“ im Haupt-Build fehlen daher:
`is3d`-Flag je Lab (Vorschlag: in `src/data/modellmatrix.json` als 12. Feld neben
`labelsMin`/`units`/`tasks` — die Matrix ist laut `src/runtime/verify.js` + `O-10` die einzige
Soll-Quelle und wird schon per `sollFromMatrixEntry()` gelesen), ein `renderDiagram2D`-Äquivalent
mit fachlichen Zweigen je 2D-Lab, und ein `player.load()`-Zweig analog zum Standalone
(`loadLab` prüft dort `META[id].is3d === false` und rendert sofort 2D). Aufwand: **M**,
bewusst getrennt von den Flag-Drehern im Standalone.

---

## 4. Ersatzmolekül: Koffein (C8H10N4O2)

### 4.1 Warum Koffein statt H2O, NaCl, Ethanol, Aspirin

| Kandidat | Atome | Ringsysteme | benennbare Teile | Urteil |
|---|---|---|---|---|
| H2O | 3 | 0 | 2 (O, H) | **ersetzt** — zu wenig Teilstruktur, Labels unlesbar, Spec-Zahlen nie in der Annotation-Liste |
| NaCl | 2 Ionen (+Gitter) | 0 | 1–2 | **ersetzt** — kein Teilbezug, Verify rot |
| Ethanol (C2H6O) | 9 | 0 | 2–3 | verworfen — 3D liefert keinen Mehrwert, gleiche Argumentation wie bei H2O |
| Aspirin (C9H8O4) | 21 | 1 | 5–6 | **Reserve** — gute Alternative (Benzol + Carboxyl + Ester + Acetyl), aber ein Ringsystem und planar; Koffein hat zwei Ringsysteme und drei Methylgruppen |
| **Koffein (C8H10N4O2)** | **24** | **2** (Imidazol + Pyrimidinon) | **6–8** | **empfohlen** |

Fachliche Substanz (Primärquellen): 1,3,7-Trimethylxanthin, C8H10N4O2, M = 194,19 g/mol
(NIST Chemistry WebBook; Fisher Scientific CAS 58-08-2). Bindungsgeometrie aus der
Gasphasen-Elektronenbeugung (Hokkaido/Miyazaki, J. Mol. Struct.):
r(C=O) = 1,206(5) Å, r(C=C) = 1,382 Å, r(N–C)₍ring₎ = 1,382(3) Å, r(C–C) = 1,446 Å,
r(C=N) = 1,297 Å, r(N–C)₍methyl₎ = 1,459 Å, r(C–H) = 1,085 Å; Winkel ∠N1–C2–N3 = 116,5(11)°,
∠C4=C5–N7 = 104,7(14)°. Zum Vergleich: berechnete Werte aus einer Adsorptionsstudie
(PMC12903138, Tabelle 2): C=O 1,23 Å (exp. 1,26 Å), C–C 1,43 Å, C–N 1,35 Å, ∠N–C–N 116,7°.
→ Die Spec-Zahlen für den Testfall sind **literaturbelegt**, nicht geraten (das war beim H2O-Fall
die offene Frage, siehe `dist/chemie-h2o-meta.json` → Feld `ehrlichkeit`).

### 4.2 three.js-Budget-Nachweis (150.000 Tris / 400 Draw-Calls / 250 Meshes)

Gemessen mit `three@0.186.1` (Repo-Version, `package.json`), Segmentregel des Guides
(`docs/implementation-guide-3d-qualitaet.md` §2: Sphere 16×12, Cylinder 12 Segmente):

| Position | Rechnung | Tris | Anteil Budget |
|---|---|---|---|
| 24 Atome (8 C, 10 H, 4 N, 2 O) | 24 × 352 (Sphere 16×12) | 8.448 | 5,6 % |
| 25 Bindungen | 25 × 48 (Cylinder 12 Seg.) | 1.200 | 0,8 % |
| **Summe Geometrie** | | **9.648** | **6,4 %** von 150.000 (grün bis 120.000) |

| Budget | Grenze | Wert Koffein | Anteil | Ampel |
|---|---|---|---|---|
| Dreiecke | 150.000 | 9.648 | 6,4 % | grün |
| Draw-Calls | 400 | 49 (1 Mesh je Atom + 1 je Bindung) | 12,3 % | grün (grün bis 300) |
| Draw-Calls (variante) | 400 | 5 (4 Elementfamilien als `InstancedMesh` + 1 InstancedMesh Bindungen) | 1,3 % | grün |
| Meshes | 250 (grün ≤ 120, Ziel ~ 45) | 49 (bzw. 5 instanziert) | 20 % | grün / mit Instancing im Zielbereich |
| Modul-Bytes | 34.000 (`scripts/build.mjs` `maxViolations`) | Ziel < 20.000 (24 Koordinatenpaare + 25 Bindungspaare kompakt als Arrays; Referenz `gpu-example` = 21.604 B bei 10 Labels + 2 Messungen) | < 60 % | grün |
| Erster Frame | 8.000 ms | 49 Meshes, keine Texturen, keine Schattenpass-Kosten nennenswert | – | grün |

Vergleich zum Bestand: das schwerste existierende Lab ist `dup-2` mit 12.106 Tris — Koffein liegt
mit 9.648 darunter, `gpu-example` mit 10.144 auf gleicher Höhe. Der Austausch von H2O gegen
Koffein **verbraucht kein zusätzliches Budget**.

### 4.3 Einheiten- und Maßstabsentscheidung (der entscheidende Detailpunkt)

**Problem:** `pm` ist im System nicht zulässig. `src/schema/manifest.schema.json`
(`measurement.unit`-Enum) und `src/runtime/didactics.js` (`UNIT_RE = /\d+(?:[.,]\d+)?\s*(mm|cm|m|HE|kB|MB)/`)
lassen nur `mm|cm|m|HE|kB|MB` zu; `src/shell/ui-livegen.js` (`UNIT_RE`, `extractMeasureHints`)
filtert mit derselben Liste. Ein Manifest mit `unit: "pm"` fällt im S5-Gate durch
(nachgerechnet mit `validateManifest` → `ok: false, invalid: ["measurements"]`), und ein
Messhinweis „…: 96 pm“ wird beim Extrahieren **verworfen** — genau der Grund, warum
`dist/chemie-h2o-meta.json` `zahlenGefunden: []` meldet.

**Lösung (Empfehlung): maßstäblich strecken und in mm messen.**

- **Modellmaßstab 1 Å ≙ 10 mm** (Streckung 10¹⁰). Damit misst die C=O-Bindung im Modell
  1,206 Å × 10 mm/Å = **12,06 mm**, gerundet **12,1 mm** → Einheit `mm`, schema- und
  didaktik-konform, ohne Code-Änderung an Regex oder Schema.
- Der Maßstab wird **ausdrücklich im Lernziel/Objektiv genannt** („Maßstab: 1 Å ≙ 10 mm“),
  damit die gestreckte Darstellung nicht als physikalische Größe missverstanden wird. Das ist
  gängige Praxis in Chemie-Visualisierungen und in `docs/NEXT-STEPS.md` nicht beanstandet.
- **Maßstabs-Konsistenz mit dem Framework:** Die Framework-Invarianten erwarten, dass die
  Mess-Endpunkte im Modell die genannte Länge abbilden. Bei Streckung 1 Å ≙ 10 mm ist die
  C=O-Bindungslinie im Modell **12,06 mm** lang und der Text nennt 12,1 mm → Abweichung 0,04 mm,
  also innerhalb der 2-mm-Toleranz der Geometrieprüfung (`GEO_LIMITS.penetrationMm`).
- **Nicht maßstabsgetreu bauen:** Bei echten pm-Abständen wäre das Molekül 1,5 nm breit
  (unsichtbar), die Label-Sprites (14,4 mm Höhe) wären 10⁷-mal zu groß — genau der H2O-Befund
  „winzige Labels“ in umgekehrter Form.
- **Toleranz beachten (verifizierte Divergenz der beiden Builds):** `src/shell/ui-tasks.js`
  `checkNumeric()` rechnet **relativ in Prozent** (`|g−e|/e·100 ≤ tol`), der Standalone-Button
  rechnet **absolut** (`|g−e| ≤ tol`). Bei einem Wert < 1 mm ist die 1-%-Toleranz im Haupt-Build
  unbrauchbar (0,12 mm ± 0,0012 mm); mit 12,1 mm ist sie tragfähig. → Messwerte **≥ 1 mm**
  wählen, `tolerance: 1` beibehalten.

### 4.4 Vorgeschlagene Spec für das neue Chemie-Lab

| Feld | Wert | Begründung |
|---|---|---|
| `id` | `chemie-koffein` | Namensschema `chemie-*` analog zu den Testfall-Belegen |
| `track` | `free` | freies Fachthema, nicht Teil des SI/DuP/AE-Kerncurriculums (Chemie ist fachfremd, so auch in `scripts/chemie-e2e.mjs` vermerkt) |
| `title` | „Koffein-Molekül“ | Alltagsbegriff, im Gegensatz zu „Wassermolekül“ |
| `parts` (6–8) | Puringerüst, Carbonylgruppe, Methylgruppe, Amidstickstoff, Ringschluss-Bindung, C=O-Doppelbindung | jede Teilgruppe ist chemisch benennbar und räumlich zuordenbar |
| `labels` | 6 (Basis-Patch blendet ohnehin auf 5 aus, `buildLevelPatch('basis')`) | ≥ 3 Pflicht (S5), `labelsMin` in der Matrix konsistent setzen |
| `measurements` (2) | „C=O-Bindungslaenge: 12,1 mm“ (Modellmaßstab 1 Å ≙ 10 mm) und „Ring-Durchmesser Puringerüst: 88,9 mm“ | beide ≥ 1 mm (Toleranz-Tauglichkeit), beide aus der Literatur (1,206 Å bzw. 8,89 Å Molekülspannweite), beide im Modell maßstäblich abbildbar |
| `tasks` | B/A/P = 0/2/1: zuordnung (Carbonyl- vs. Methylgruppe), messwert (C=O-Länge), transfer/fehlersuche (Maßstab → reale Å-Angabe) | Matrix-Soll und S5-Regeln (`S5-aufbau-aufgaben-min2`, `S5-profi-transfer-min1`) |
| `i18n` | de/en/es, gleiche Label-/Mess-IDs | Pflicht in `manifest.schema.json` (`i18n` mit `required: [en, es]`) |
| `modellmatrix.json` | `labelsMin: 6`, `units: ["mm"]`, `tasks: [0,2,1]` | Quelle für `sollFromMatrixEntry()` → S5-Soll-Kriterium |
| `scripts/chemie-e2e.mjs` `SPECS` | `kaffee`: Begriff mit „Maßstab 1 Å = 10 mm“, `zahlen: ['12,1','1,206']`, `labelsMin: ['Carbonyl','Methyl']`, `check: 'C=O 1,206 Å ≙ 12,1 mm'` | ersetzt `h2o`/`nacl`; Spec in **mm**, damit `UNIT_RE` greift und die Zahlen in der Annotation-Liste landen |

---

## 5. Blocker und Abhängigkeiten (jeder Punkt ist verifiziert)

| # | Blocker | Beleg | Wirkung auf die Umsetzung |
|---|---|---|---|
| B1 | **Standalone-Builder hat harte Zähl-Guards.** `scripts/build-standalone.mjs` erwartet exakt 9 kuratierte Modelle: `R5` 9× `mapSize.set(2048)`, `R7` 9× `shadow.radius`, `R11` 9× Raumlicht, `R16d` 8× IBL-Guard, Invarianten `IBL-Waende == 9`, `Raumlicht == 9`, `shadow.radius == 10`, `bias == 10`. | `scripts/build-standalone.mjs` Z. 105/129/204/228–231 | Ein 11. kuratiertes Lab (GPU oder Koffein) im Standalone bricht den Builder per `must()` ab → **Zähl-Guards müssen mitgezogen werden**, sonst kein Standalone-Build. |
| B2 | **Builder ist nicht idempotent-fähig für neue Inhalte.** Der Builder patcht eine v11-Basis und bricht beim Zweitlauf ab („v12-guide bereits appliziert“). | `scripts/build-standalone.mjs` Z. 74–76 | Ein neues Lab im Standalone braucht einen neuen Assembly-Weg (das `designer-scratch`-Assembler-Chain ist am 28.10. entfernt worden, `docs/ABLAGEKONVENTION.md`) — **Aufwand steigt von S auf M**. |
| B3 | **Unit-Test fixiert die Modellanzahl auf 10.** | `tests-unit/matrix.test.mjs` Z. 42: `assert.ok(mods.length === 10, …)` | Ein 11. Modul in `src/models/` (Koffein) bricht `npm run test:unit` → Test mitziehen (Assertion auf „≥ 10“ plus Matrix-Vollständigkeit). |
| B4 | **`src/models/`-Budget im Build-Plan.** | `scripts/build.mjs` Z. 21: `models: 304000` (Plan) vs. aktuell 139.779 B | Ein neues Modul passt bequem; die Planzahl bleibt gültig. |
| B5 | **Modul-Byte-Grenze 34.000 B je Modell.** | `scripts/build.mjs` Z. 140 (`maxViolations`) | Koffein-Modul mit 24 Koordinaten + 25 Bindungspaaren muss kompakt kodiert sein (Arrays statt Objektliteral pro Atom) — der `gpu-example` mit 10 Labels belegt bereits 21.604 B. |
| B6 | **3D-Pfade im Standalone bleiben auch bei `is3d:false` im File** (Byte-Kosten, kein Laufzeitkosten-Nutzen, weil `loadLab` bei `is3d === false` gar nicht erst das 3D-Modul lädt). | `dist-standalone/skillspark-standalone.html`: `INIT['dup-1']` … vorhanden **und** `META['dup-1'].is3d = false` | Kein Handlungsbedarf; relevant nur für die Dateigröße (281.629 B). |
| B7 | **Kein 2D-Pfad im Haupt-Build.** | `src/` und `dist/lab-player.html`: 0 Treffer für `is3d` / `renderDiagram2D` | Umsetzung „Rest auf 2D“ im Haupt-Build erfordert Querschnittsaufgabe 3.3 (M). |
| B8 | **`si-2`-Messwert inkonsistent.** | Manifest `from [-0.20,-0.22,0.02]` → `to [0.20,-0.22,0.02]` = 0,400 m; Text „Kabellaenge: 2 m“ | Unabhängig von 2D/3D zu korrigieren (sonst ist der Messwert im Modell falsch abgebildet). |
| B9 | **Screenshot-Belege veraltet.** | `dist/verify-report.json`: S3/S4 `skip` mit „Beleg aelter als Modellquelle“ für alle 10 Labs | Vor einer Portfolio-Freigabe Baseline neu abnehmen (`npm run baseline:update`), sonst prüft das Portfolio gegen alte Bilder. |
| B10 | **`chemie-koffein` braucht einen eigenen 2D-Zweig**, falls es im Standalone auch 2D schaltbar sein soll; der generische V9-Overlay-Zweig (`renderDiagram2D` `else`) zeichnet nur leere Kästchen. | `dist-standalone/skillspark-standalone.html`, `renderDiagram2D` letzter Zweig | Für die 3D-Variante irrelevant; für 2D-Tauglichkeit ein M-Aufwand. |

---

## 6. Risiken und Grenzen (ehrlich benannt)

- **Der 3D/2D-Split ist eine Produktentscheidung, kein Datenbefund.** Die technische
  Infrastruktur für 2D existiert nur im Standalone und ist dort als `is3d`-Flag + handgeschriebene
  SVG-Zweige realisiert; im Haupt-Build ist sie nicht vorhanden. Ein Portfolio, das im Haupt-Build
  gelten soll, braucht zuerst diese Infrastruktur (3.3).
- **Die 2D-Diagramme sind derzeit Platzhalter-Niveau.** `renderDiagram2D` zeichnet für `ae-1`,
  `ae-2`, `ae-3` je ein vereinfachtes Schema; ein fachlich fertiges 2D-Lab (UML mit allen
  Attribut-/Methodenzeilen, BPMN mit allen Symbolvarianten, Sequenzdiagramm mit Pfeilrichtungen)
  ist zusätzliche Arbeit, die das Portfolio-Vorhaben nicht ersetzt, sondern begleitet.
- **Der 3D-Labs-Bestand hat eigene Qualitätsmängel**, die ein Portfolio-Urteil nicht behebt:
  Label-Überlagerung bei `gpu-example` (10 Labels), verdeckter Client und fehlende Ports bei
  `si-2`, abgeschnittene Client-/DB-Szene bei `ae-3`. Diese Mängel liegen im 3D-Modul, nicht in
  der 2D/3D-Frage.
- **Die Baseline-Sichtung ist Sichtung, kein Messwert.** Die 3D-vs-2D-Begründungen in Tabelle B
  stützen sich auf Baseline-Screenshots plus Code- und Manifestbefunde; die Geometrie-Aussagen
  (Bezugsachsen, Verdeckung) sind qualitative Sichtbefunde, keine vermessenen Größen.
- **Der Chemie-Vorschlag ersetzt Testfälle, nicht kuratierte Labs.** H2O/NaCl sind Freimodus-Belege;
  sie in der Bibliothek zu ersetzen hieße, etwas zu ersetzen, das dort nicht war. Richtig ist:
  `chemie-koffein` **neu kuratieren** und parallel die `SPECS` in `scripts/chemie-e2e.mjs` auf
  Koffein umstellen (dort ist der alte Pfad ablösbar).
- **Budget ist nicht der limitierende Faktor.** Alle 10 Labs liegen bei ≤ 12 % des Tris-Budgets und
  ≤ 30 % der Draw-Call-Grenze; die Entscheidung ist eine didaktische, keine rechnerische.
- **Prüfstand ist nicht grün.** `npm run verify:all` meldet alle Labs „gelb“ (auto-geprüft),
  S3/S4 per `skip`. Vor der Portfolio-Freigabe ist ein Baseline-Neulauf nötig (B9).

---

## 7. Empfohlene Reihenfolge (Vorschlag, keine Ausführung)

| Schritt | Inhalt | Abhängigkeit | Aufwand |
|---|---|---|---|
| 1 | `si-2`-Messwert korrigieren (0,400 m → 2,000 m) | — | S |
| 2 | Standalone: `META['ae-1'/'ae-2'/'ae-3'].is3d = false` (3 Zeilen) | Zweighes im Standalone vorhanden | S |
| 3 | Baseline neu abnehmen + `npm run verify:all`, `npm run test:unit` | B3 (Test anpassen), B9 | S |
| 4 | `chemie-koffein` bauen: Modul + Manifest + `modellmatrix.json` + 2 Baselines; Spec-Zahlen aus §4.4, Maßstab 1 Å ≙ 10 mm, Messwerte ≥ 1 mm | B3, B5, B10 | M |
| 5 | `scripts/chemie-e2e.mjs`: `SPECS` `h2o`/`nacl` → `kaffee` (Spec in mm) | 4 | S |
| 6 | `free-handbohrmaschine` kuratisieren (Modul + Manifest + Matrix + Baselines) | — | M |
| 7 | `gpu-example` in den Standalone aufnehmen + Builder-Guards nachziehen | B1, B2 | M |
| 8 | Haupt-Build: `is3d` in `modellmatrix.json` + `renderDiagram2D`-Äquivalent + `player.load()`-Zweig | B7 | M |
| 9 | `si-2`-Render-Fix (Licht, Ports, vier Kabel, Client sichtbar) | 1 | M |
| 10 | Label-LOD-Regel (Kamera-unabhängige Skalierung) für `gpu-example` und Chemie-Labs | — | M |

---

## 8. Offene Punkte zur Entscheidung

1. **Geltungsbereich des Portfolios:** soll es im Standalone, im Haupt-Build oder in beiden
   gelten? (Empfehlung: Standalone zuerst — dort ist die 2D-Infrastruktur bereits vorhanden und
   `is3d` pro Lab schaltbar.)
2. **Soll `gpu-example` in den Standalone?** (Empfehlung: ja — der Nutzerwunsch „GPU behalten“
   ist im Standalone derzeit nicht erfüllbar, weil das Lab dort nicht existiert.)
3. **Maßstab der Chemie-Lab-Darstellung:** 1 Å ≙ 10 mm (empfohlen) oder eine rein visuelle
   Streckung ohne Maßstabsangabe? (Empfehlung: mit Maßstabsangabe — sonst erzeugt das Modell
   ein falsches physikalisches Größengefühl.)
4. **Bleibt `chemie-nacl` als Beleg erhalten oder wird es eingestellt?** (Empfehlung: als Beleg
   behalten, aber den Verify-Lauf reparieren — `kein-rot=false`.)
5. **Sollen die AE-Labs (UML, Bubblesort, API-Kette) im Haupt-Build vollständig auf 2D gehen
   oder nur im Standalone?** (Empfehlung: beide, aber gestaffelt — Schritt 2 vor Schritt 8.)
