# Router-Konzept: 2D-vs-3D-Routing am Generierungsstart (Plan, kein Code)

Stand: 28.10.2026 · Status: **Plan / Entscheidungsvorlage** — keine Codeänderung in diesem Schritt.
Ziel: Am Anfang der Generierung entscheidet das LLM (kleiner Klassifikations-Call),
ob ein Fachtext ein **3D-Modell (three.js)** oder eine **leichte 2D-Darstellung
(passende eingebaute Technik, keine neue schwere Lib)** braucht — inkl. 2D-Typ.
Leichtgewichtig halten: 1 zusätzlicher LLM-Call, 0 neue npm-Dependencies.

## 1. Leitentscheidung (kurz)

- **3D-Pfad (Bestand):** `three.js r186` via bestehenden P1-Prompt (`p1-generate.v6-standard.txt`),
  Wrapper-Vertrag `meta / init / update / dispose`, Verify S1–S5, Budgets aus `budget.js`.
- **2D-Pfad (neu, leicht):** **keine neue Bibliothek.** Darstellung mit Bordmitteln:
  **inline-SVG** (Schalt-/Ablauf-/Diagramm-Typen) oder **Canvas-2D** (Schnitt-/Aufbau-Schematik,
  Ausbau von `src/runtime/fallback2d.js`). Grund: SVG/Canvas sind Web-Standard,
  0 Bytes Bundle-Mehraufwand, kein Vendor-Pinning, kein iGPU-Risiko.
  Eine Chart-/Diagramm-Lib (z. B. lazy) ist explizit **Nicht-Ziel** dieser Stufe.
- **Router (neu, klein):** separater Prompt `prompts/p0-router.txt`, JSON-only-Antwort,
  deterministisch geparst. Kein Streaming, kein Modellcode, niedrige Token-Kosten.

## 2. Klassifikations-Prompt P0 (verbindliche Vorlage)

Datei (neu): `prompts/p0-router.txt`. Platzhalter: `{FACHTEXT}` (max. ~4000 Zeichen,
vorher in `livegen.js` kappen). Modell: wie Generierung (Default `muse-spark-1.3-contributor`),
`temperature 0`, `stream false`, `max_tokens ~300`.

```
P0 ROUTER-KLASSIFIKATION (verbindlich, Version 1.0)
Du bist ein Klassifikator, kein Generator. Du schreibst KEINEN Modellcode,
keine Erklaerung, keine Markdown-Fences — NUR ein JSON-Objekt.

AUFGABE: Entscheide anhand des FACHTEXTS, ob die Generierung einen
3D-Pfad (three.js, raeumliches Modell) oder einen 2D-Pfad (leichtes
SVG/Canvas-Schematik) nehmen soll, und bei 2D welchen Darstellungstyp.

EINGABE:
<FACHTEXT>
{FACHTEXT}
</FACHTEXT>

REGELN 3D (mode "3d") — genau dann, wenn ALLE drei zutreffen:
1. Der Text beschreibt einen raeumlichen Gegenstand (Bauteil, Baugruppe,
   Geraet, Anatomie, Aufbau mit Lage/Orientierung/Montage/Volumen).
2. Das Lernziel braucht raeumliches Verstaendnis (Anordnung, Innenleben,
   Schnittlage, Funktion aus Form, Orbit/Ansichtwechsel bringt Mehrwert).
3. Mindestens 2 benennbare Bauteile/Teilvolumina mit Lagebezug sind ableitbar.

REGELN 2D (mode "2d") — wenn EINE zutrifft:
- Text beschreibt Ablauf/Prozess/Algorithmus ohne Raumbezug.
- Text beschreibt Schaltung/Signalfluss/Blockstruktur (Topologie statt Geometrie).
- Text fordert Kennlinie/Vergleich/Statistik (Achsen, Werte, Kategorien).
- Text ist rein begrifflich (Definitionen, Taxonomie, Tabelle) ohne Bauteil-Lage.
- Text nennt nur 0–1 raeumliche Objekte (kein Modell lohnend).

TYP-WAHL bei mode "2d" (genau einer):
- "schaltplan" ..... Schaltung, Bloecke, Signal-/Energiefluss, Topologie.
- "flussdiagramm" .. Ablauf, Prozess, Entscheidung, Algorithmus.
- "schnitt-ansicht"  Vereinfachte 2D-Aufbau-/Schnitt-/Seitenansicht eines
                     Gegenstands, bei dem 3D nicht lohnt (1 Ansicht genügt).
- "diagramm" ....... Kennlinie, Balken-/Linien-Vergleich, Messwerte auf Achsen.
- "tabelle" ........ Begriffs-/Merkmalsvergleich, Taxonomie, reine Struktur.

AUSGABE (EXAKT dieses JSON, keine weiteren Keys):
{"mode":"3d|2d","typ":"<freitext bei 3d: z.B. 'baugruppe'|'volumen'|'montage'| null bei 2d-Pflicht? siehe Schema>","begruendung":"<max. 140 Zeichen, deutsch>"}

BEISPIELE (few-shot, verbindlich):
Fachtext "Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile im Zylinderkopf..."
-> {"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."}
Fachtext "RC-Tiefpass: Widerstand, Kondensator, Bode-Diagramm der Grenzfrequenz..."
-> {"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, keine raeumliche Anordnung noetig."}
Fachtext "Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, Entscheidungspunkte..."
-> {"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}
Fachtext "Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvarianten im Vergleich..."
-> {"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}
```

### 2.1 Output-Schema (Router-Ergebnis, JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RouterDecision",
  "type": "object",
  "required": ["mode", "typ", "begruendung"],
  "additionalProperties": false,
  "properties": {
    "mode": { "type": "string", "enum": ["3d", "2d"] },
    "typ": {
      "type": "string",
      "description": "Bei 2d: einer von schaltplan|flussdiagramm|schnitt-ansicht|diagramm|tabelle. Bei 3d: freier Kurztyp (baugruppe|volumen|montage|innenleben) oder leer.",
      "minLength": 1, "maxLength": 32
    },
    "begruendung": { "type": "string", "minLength": 10, "maxLength": 140 }
  },
  "allOf": [
    { "if": { "properties": { "mode": { "const": "2d" } } },
      "then": { "properties": { "typ": { "enum": ["schaltplan", "flussdiagramm", "schnitt-ansicht", "diagramm", "tabelle"] } } } }
  ]
}
```

Parser-Regeln (in `livegen.js` zu implementieren, hier nur spezifiziert):
1. Längsten `{...}`-Block aus Rohantwort extrahieren, `JSON.parse`.
2. Schema prüfen (Enum, Längen). Bei Verstoß → **Fail-closed auf `3d`** (Bestandspfad,
   kein Generierungsabbruch) + `routerFallback: true` ins Protokoll.
3. `begruendung` wird geloggt (generation-log), nie in Modellcode übernommen.

## 3. Schwellen: wann 3D, wann 2D

| # | Signal im Fachtext | Pfad | Begründung |
|---|---|---|---|
| T1 | ≥2 Bauteile mit Lage-/Montage-/Orientierungsbezug (z. B. „sitzt auf", „im Gehäuse", „koaxial") | **3D** | Räumliches Verständnis nötig, Orbit-Mehrwert |
| T2 | Innenleben/Schnittlage/Volumen als Lernziel („Querschnitt", „Schichten", „Strömung im Kanal") | **3D** | Nur räumlich vermittelbar |
| T3 | Einzelobjekt mit Form-Funktion-Bezug („Tragfläche", „Gehäuseform", „Implantat-Sitz") + Ansichtwechsel nützlich | **3D** | 1 Objekt, aber Raum-Mehrwert |
| T4 | Ablauf/Algorithmus/Entscheidungsbaum ohne Raumbezug | **2D `flussdiagramm`** | Sequenz statt Geometrie |
| T5 | Schaltung/Block-/Signalfluss („Verstärker", „Bus", „Regelkreis") | **2D `schaltplan`** | Topologie statt Geometrie |
| T6 | Messwerte/Kennlinien/Vergleiche („über Drehzahl", „drei Varianten") | **2D `diagramm`** | Achsen statt Raum |
| T7 | Begriffe/Taxonomie/Merkmalsvergleich ohne Lage | **2D `tabelle`** | Struktur statt Raum |
| T8 | Gegenstand genannt, aber 1 Ansicht genügt / Detailgrad niedrig | **2D `schnitt-ansicht`** | 3D-Kosten (Budget S4) > Mehrwert |

Vorrang: **T4–T7 schlagen T1–T3**, wenn der explizite Arbeitsauftrag im Text
(„zeichne Schaltplan", „stelle Ablauf dar", „vergleiche Kennlinien") 2D verlangt.
Unentschieden (0–1 räumliche Objekte, kein 2D-Auftrag) → **2D `schnitt-ansicht`**
(leichteste Darstellung), nicht 3D.

Negativ-Beispiele (kein 3D): Ohmsches Gesetz als Formel + Tabelle; Sortieralgorithmus;
Netzwerk-Topologie ohne Gerätemontage; reine Vokabelliste.

## 4. Ablauf (Text-Diagramm)

```
Fachtext (UI / CLI)
  │
  ▼
[P0 Router-Call] prompts/p0-router.txt ── JSON-only, ~300 Tokens, kein Stream
  │  Input: Fachtext (gekürzt ≤4000 Z.)   Output: {mode, typ, begruendung}
  │  Parse-Fehler / Timeout ──▶ Fail-closed: mode=3d + routerFallback=true
  ▼
mode = 3d ────────────────────────────── mode = 2d
  │                                        │
  ▼                                        ▼
[P1-3D] p1-generate.v6-standard.txt   [P1-2D] p1-generate-2d.txt (NEU, light)
bestehend, unverändert                 SVG- oder Canvas-Modul, gleiche
  │                                    init/update/dispose-Signatur, KEIN three-Import
  ▼                                        │
generateLive() ──► extractModuleSource()   │
  │                                        │
  ▼                                        ▼
Verify S1–S5 (3D voll)                 Verify S1+S5 (Node) + S2-light* (SVG/Canvas statisch)
  │                                        │
  ▼                                        ▼
Harness-Loop P2-Repair (bestehend)     Harness-Loop P2-Repair (2D-Textbausteine, neu)
  │                                        │
  └──────────────► dist/ + Verify-Report ◄──┘
                   (mit Feld route:{mode,typ,begruendung})
```

`*` S2-light: keine Boot-/WebGL-Prüfung; statische Checks (wohlgeformtes SVG,
keine Fremd-Imports/URLs, Canvas nur 2D-Kontext, Textmengen-Limits). Details §6.4.

Kosten-Deckel: P0 schlägt nur bei Antwort >15 s oder >600 Tokens fehl → Fallback 3D.
P0 wird **nicht** in der Harness-Schleife wiederholt (einmal je Fachtext, dann
per `route`-Feld durchgereicht).

## 5. 2D-Darstellungstechnik (leichtgewichtig, ohne neue Lib)

| 2D-Typ | Technik | Warum |
|---|---|---|
| `schaltplan`, `flussdiagramm`, `diagramm`, `tabelle` | **inline-SVG** als DOM-Element im Wrapper | vektor-scharf, keine Lib, S1-prüfbar (XML-Wellformedness), i18n via Textknoten |
| `schnitt-ansicht` | **Canvas-2D**, Ausbau `fallback2d.js` → `renderSchematic2D()` | Freihand-Schematik mit Bemaßung, Bestand wiederverwendet |

Verbote 2D-Prompt (Spiegel zu P1-3D): keine `<script>`-Imports außer Wrapper-Helpers,
keine Fremd-URLs/`fetch`/DOM-Zugriffe außer eigenem Container, keine Canvas-3D/WebGL.
SVG muss ohne externe Fonts/Symbole auskommen (Systemschrift, Pfade/Rechtecke/Kreise/Text).

## 6. Integrationsplan: anzufassende Dateien + Akzeptanzkriterien

Kein Code in diesem Schritt — Reihenfolge und Abnahmemerkmale für die Umsetzung.

### 6.1 `src/runtime/livegen.js` — Router-Routine + 2D-Pfad

- **Änderung (Plan):** neue Funktion `routeGeneration(fachtext, opts)` — baut P0-Prompt,
  ruft Proxy (nicht-streamend, eigenes kurzes Timeout ~20 s), parst JSON per §2.1,
  Fail-closed 3D. `generateLive()` bekommt optionalen `route`-Param und wählt
  P1-3D vs. P1-2D; Fachtext-Kappung ≤4000 Zeichen für P0; Protokollfeld
  `route: {mode, typ, begruendung, fallback}` im Rückgabeobjekt.
- **Akzeptanz:**
  - [ ] `routeGeneration("Viertaktmotor Kolben Pleuel ...")` → `{mode:"3d"}` (Stub-Test).
  - [ ] `routeGeneration("RC-Tiefpass Bode-Diagramm ...")` → `{mode:"2d", typ:"schaltplan"}`.
  - [ ] Ungültiges JSON / Timeout / HTTP-Fehler → `{mode:"3d", fallback:true}`, kein Throw in den Generierungspfad.
  - [ ] Unit-Tests in `tests-unit/livegen.test.mjs` ergänzt (Parser + Fail-closed + Kappung).
  - [ ] Keine Persistierung von Keys/Protokollen über bestehenden Standard hinaus.

### 6.2 `prompts/` — P0 neu, P1-2D neu, P1-3D unverändert

- **Änderung (Plan):** neu `prompts/p0-router.txt` (Wortlaut §2, Platzhalter `{FACHTEXT}`);
  neu `prompts/p1-generate-2d.txt` (schlanke Variante: SVG/Canvas-Modul, gleiche
  `meta/init/update/dispose`-Signatur, Verbote §5, Budgets: Modul ≤34 KB wie 3D,
  keine Dreiecks-/Draw-Call-Budgets, stattdessen SVG-Knoten ≤800 / Canvas-Ops ≤500);
  `p1-generate.v6-standard.txt` + Varianten **unverändert** (3D-Pfad stabil).
- **Akzeptanz:**
  - [ ] P0-Antwort auf 4 Beispielfachtexte (§2) parst gegen Schema §2.1.
  - [ ] P1-2D erzeugt Modul mit `meta` + `init` + `update`/`dispose`, ohne `three`-Import
        (S1-Importcheck besteht mit 2D-Allowlist).
  - [ ] `prompts-eval`-Test (vgl. `tests-unit/prompts-eval.test.mjs`) deckt P0+P1-2D ab.

### 6.3 `scripts/build.mjs` + `scripts/build-standalone.mjs` — Budgets/Reports

- **Änderung (Plan):** `build.mjs`: Budget-Tabelle um 2D-Grenzen erweitern
  (SVG-Knoten, keine WebGL-Budgets im 2D-Pfad), `build-report.json` bekommt Feld
  `routes: {p0: bool, p1_2d: bool}`; Datei-Max-Tabelle nur ergänzen falls neue
  Runtime-Datei nötig (kein pauschales Hochsetzen). `build-standalone.mjs`:
  **keine Änderung** (v11-Basis + R1–R17-Guards bleiben unberührt; Router betrifft
  nur Generierungs-, nicht Standalone-Artefakt).
- **Akzeptanz:**
  - [ ] `npm run build` grün mit neuer Budget-Tabelle; Report enthält `routes`-Feld.
  - [ ] `build-standalone.mjs` unverändert idempotent (Zweitlauf bricht wie bisher ab).

### 6.4 Verify S1–S5 (`src/runtime/verify.js`, `scripts/verify-all.mjs`) + Harness (`scripts/_harness-loop.mjs`)

- **Änderung (Plan):**
  - `verify.js`: `verifyStaticLayer` bekommt `route`-Option — 2D-Allowlist
    (kein `three`, nur `wrapper-helpers`; SVG: wohlgeformt, keine `<script>`/Fremd-URL;
    Canvas: nur `getContext('2d')`); Geometrie-Layer (S2/S4-3D) wird im 2D-Pfad als
    `skip` mit Grund `2D-Route` geführt; S5 (Didaktik/Manifest) gilt unverändert.
    Neue reine Funktion `verifySvgLayer(source)` für S2-light.
  - `verify-all.mjs`: `--only`-Stufen bleiben; Report + `attestation.json` bekommen
    `route`-Feld je Modell; 2D-Modelle ohne `final-budgets.json`-WebGL-Beleg sind
    kein Fail (S3/S4 → `skip`, nicht `fail`).
  - `_harness-loop.mjs`: P2-Repair bekommt 2D-Bausteine (neue Einträge in
    `prompts/bausteine.json`, z. B. `svg-wellformed`, `svg-text-i18n`, `canvas-2d-only`);
    Bild-Policy M5 bleibt (2D: max. 1 PNG-Screenshot statt 3); Abbruchlogik
    (grün/Stagnation/Regression/Budget) unverändert, P0 wird nicht wiederholt.
- **Akzeptanz:**
  - [ ] 3D-Bestand: `npm run verify:all` + Harness-Verhalten unverändert (Regressionstest grün).
  - [ ] 2D-Probe (SVG-Schaltplan + Canvas-Schnitt): S1 pass, S2-light pass, S5 pass,
        S3/S4 `skip` mit Grund, Report enthält `route`.
  - [ ] Defektes SVG (unwohlgeformt / Fremd-URL) → S1/S2-light `fail` mit exakter
        Kriterium-ID; P2-Repair mit neuem Baustein behebt es in ≤2 Auto-Runden.
  - [ ] `verify-report.schema.json` um optionales `route`-Objekt erweitert, alte Reports validieren weiter.

## 7. Budgets, Risiken, Nicht-Ziele

- **Kosten:** +1 kleiner LLM-Call je Generierung (~P0-Limit 600 Tokens out); keine
  neuen Laufzeit-/Bundle-Kosten (0 neue Deps).
- **Risiken:** Fehlklassifikation → mitigiert durch Fail-closed 3D + `route`-Protokoll
  + manuelle Override-Option in UI (später, nicht in dieser Stufe). Prompt-Drift P0 →
  Few-shots + Schema-Test pinnen.
- **Nicht-Ziele (diese Stufe):** keine neue 2D-Lib (D3/Mermaid/Cytoscape o. ä.),
  kein 2D-Interactive-Framework, kein Umbau 3D-Pfad/P1-v6/Standalone-Builder,
  kein semantischer Baustein-Retrieval (bleibt M6-minimal wie in `bausteine.json` vermerkt).

## 8. Umsetzungsreihenfolge (Vorschlag, 4 Schritte)

1. **P0 + Schema + Tests:** `prompts/p0-router.txt`, Parser-Spec als Unit-Tests
   (rot), dann `routeGeneration()` in `livegen.js` (grün). Abnahme §6.1.
2. **P1-2D + S1-Allowlist:** `p1-generate-2d.txt`, `verifySvgLayer`, Report-`route`-Feld. Abnahme §6.2/§6.4 (statisch).
3. **Harness-2D:** Bausteine + P2-Ansteuerung + `--only`-Reports. Abnahme §6.4 (Loop).
4. **Build-Reports:** `build.mjs`-Budgetzeilen + Doku (`docs/NEXT-STEPS.md`-Eintrag).
   `build-standalone.mjs` bleibt unangetastet.
