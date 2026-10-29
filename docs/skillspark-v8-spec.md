# SkillSpark v8 — Design-Spezifikation (Designer-Profil, Stand 28.10.2026)

Basis: `dist-standalone/skillspark-standalone.html` (Stand v7, 238.408 Bytes, Titel v7).
Befunde (belegt): `renderFallback2D` = Canvas-Text/Kaestchen (Titel, Bauteilliste,
Platzhalter-Kaestchen); `force2D` Einweg (kein Rueck-Button); kein `is3d`-Flag
(Grep negativ). ER/BPMN/ETL als 3D-Szene sinnlos.

## 1. Domain-Grenzen (strikt)

- D1 Diagramm-Renderer (neu): `renderDiagram2D(svgHost, lab)` — reines Inline-SVG,
  kein D3, kein neues CDN, file://-faehig. Liest NUR `lab`-Daten
  (labels/measurements/title/track/id). Schreibt NUR in `svgHost` (innerHTML).
  Kein Zugriff auf THREE, INIT, META, localStorage, fetch.
- D2 Viewer-Glue (Bestand erweitern): `window.__viewer { loadLab, setView, setAnno,
  setPartVisible, dispose, registerFree, force2D }` + NEU Rueckweg 3D.
  Einzige Stelle mit `document`/`container`/WebGL-Probe (Bestand).
  `renderDiagram2D` wird von hier aufgerufen, nie direkt aus Vue.
- D3 Vue-Shell (Options-API, Bestand): `viewerMode ('2d'/'3d')`, Buttons
  `force2D` / `loadLab(activeLab)`, Badge 2D/3D, i18n via `t(key)`.
  Kein neues CDN, kein `<script setup>`, kein `from 'vue'`, kein TS.
- D4 Generator (`buildFreePrompt` + `registerFree` + `makeFreeLab`): Prompt-Muster
  erweitern (is3d-Entscheidung), trotzdem gueltige 3D-Platzhalter-Init liefern.
  `registerFree` validiert `meta.is3d` boolean (Default true).
- D5 Daten (LABS + META): `is3d`-Flag als einzige Schema-Aenderung (siehe §3).

## 2. Komponenten-Vertraege

### 2.1 renderDiagram2D(svgHost, lab) — NEU, Pflicht-Name exakt

Signatur: `function renderDiagram2D(svgHost, lab)` im Modul-Skript (nahe
`renderFallback2D`). `svgHost` = `#viewport`-Div (geleert per
`container.innerHTML=''` durch Aufrufer). `lab` = `{ id, track, title,
labels:{de,en}, measurements:[{id,text:{de,en},unit}] }` (Vue-activeLab-Form).
Sprache: aktive `lang` ausserhalb aufloesen, Texte als Strings uebergeben
(z. B. `labelsDe`, `measText`) — KEINE i18n-Logik im Renderer.

SVG-Rahmen (alle Tracks identisch): `<svg viewBox="0 0 640 360" width="100%"
height="100%" role="img">` + Titel-Text (lab.title, max 48 Zeichen) oben links +
Masslinie unten (siehe 2.2). Inline-Attribute (fill/stroke), keine CSS-Klassen,
kein D3.

Je-Track-Mini-Grafik (Lab-Daten verwenden, Labels als Beschriftung):

- SI (si-1/si-2/si-3): Rack-Aussenrechteck (x40 y60 w240 h220) + 3 Innen-Boxen
  (labels[0..2]) + Kabel-Polylinie zwischen Boxen (stroke #4dd2ff).
- dup-1 ER: Entitaet-Rechteck links (labels[0]), Entitaet-Rechteck rechts
  ("Auftrag"), Raute Mitte ("hat"), Kardinalitaet-Text "1:N" an Linie.
- dup-2 BPMN: Startkreis (labels[0]) -> Aufgaben-Rechteck (labels[1]) ->
  Entscheidungs-Raute (labels[2]) -> Endkreis (labels[3]), Pfeile mit Marker.
- dup-3 ETL: 3 Stufen-Boxen horizontal (labels[0..2] bzw. Extract/Transform/Load)
  + 2 Pfeile.
- ae-1 UML: Klassenbox (3 Kompartimente: labels[0..2] + Vererbungspfeil-Linie).
- ae-2 Balken+Tauschpfeil: 2 Balken (labels[0..1]) + Doppelpfeil dazwischen.
- ae-3 Client/Server: 2 Boxen (labels[0..1]) + Verbindungslinie mit Punkten.
- Default (Free/unbekannt): generische Boxen aus labels (max 4, 2x2-Grid).

### 2.2 Bemassung als Masslinie

Aus `measurements[0]`: horizontale Linie y=330 x=40..420, End-Ticks,
Text mittig darueber (`measText`, z. B. "Mainboard-Breite: 24 cm").
Ohne Messung: keine Linie (kein Crash).

### 2.3 Modus-Wechsel (beidseitig) — State-Machine

- Zustand: Vue `viewerMode` + `__viewer._mode`, Werte `'2d'|'3d'`.
- `2D-Modus`-Button (Bestand, `@click="force2D"`): ruft `__viewer.force2D()`
  → rendert `renderDiagram2D` fuer `activeLab`, setzt `_mode='2d'`, gibt `'2d'`.
- `3D-Modus`-Button (NEU, `@click="to3D"` oder `syncViewer`): ruft
  `__viewer.loadLab(activeLabId, level)` → versucht 3D-Init, gibt Modus zurueck.
  Vue-Methode z. B. `to3D:function(){...this.viewerMode=window.__viewer.loadLab(...)}`.
- Badge (Bestand): `v-if viewerMode==='2d'` → "2D" (amber), `v-else` → "3D"
  (emerald). Text bleibt "2D"/"3D" (kein Versionssuffix).
- Hinweis unter Viewport: bei `viewerMode==='2d'` ZUSAETZLICH `t('diagramNote')`
  (siehe §5). Bestand-`webglFallback`-Zeile bleibt (Doppel-Zeile v7 ist Bug,
  eine Zeile entfernen im Zuge von A-Vue).
- Viewer-Default: `loadLab(id, level)` prueft ZUERST `META[id].is3d===false`
  → direkt `renderDiagram2D` (kein WebGL-Versuch), `_mode='2d'`, trotzdem
  3D-Button als Option (mit `diagramNote`-Hinweis). `is3d!==false` → bisheriger
  WebGL-Pfad (Fallback bei Fehler via `renderFallback2D` bleibt als F3-Reserve,
  wird von `renderDiagram2D` NICHT ersetzt).

### 2.4 buildFreePrompt-Erweiterung (Muster, exakt ein Absatz mehr)

An `buildFreePrompt`-Array EINEN Satz anhaengen (DE/EN-sinngleich):
"KI entscheidet meta.is3d (true/false): Diagramme/Tabellen/Prozesse → false,
sonst true; liefere TROTZDEM gueltige 3D-Platzhalter-Init (Vertrag unveraendert)."
Prompt bleibt ein String-Join mit "\n". `registerFree`-Validierung: `meta.is3d`
muss boolean sein (fehlt → Default true, kein Abbruch). Neue Free-Labs:
`LABS`-Eintrag `is3d` aus `meta.is3d` uebernehmen.

## 3. Datenmodell (JSON Schema, einzige Aenderung: is3d)

LABS-Eintrag (Bestand + 1 Feld):

```json
{ "id": "dup-1", "track": "DuP", "is3d": false,
  "title": {"de": "...", "en": "..."},
  "labels": {"de": ["..."], "en": ["..."]},
  "measurements": [{"id": "...", "text": {"de": "...", "en": "..."}, "unit": "cm"}] }
```

META-Eintrag (Bestand + 1 Feld): `{ title, category, detailLevel, parts, units,
is3d }`. Mapping v8: `dup-1, dup-2, dup-3 → is3d:false`, Rest
(`si-1..3, ae-1..3, free-*`) → `is3d:true`. Free-Default true.

State-Migration: alte localStorage-Eintraege (`skillspark.free.*`) ohne `is3d`
→ beim `restoreFree` Default true setzen (kein Crash, keine Migration-UI).

## 4. API-Konventionen (kein neues Netz, nur Bestand)

REST/Events unveraendert: einziger Netz-Pfad bleibt Proxy-POST
`genProxyUrl` (Baseten, seit 28.10.2026; zuvor OpenRouter — inaktiv, siehe
docs/BASETEN-MIGRATION.md). Muse-Pfad bleibt Copy-Prompt + `muse.exe exec`
(manuelle Ausfuehrung, Key NUR `--api-key-stdin`). Neue Viewer-Methoden sind
synchrone Vue→Glue-Calls (`force2D()`, `loadLab(id,level)`), Rueckgabe Modus-String.
Fehlerfaelle: unbekannte Lab-ID → Fallback-Skizze (Default-Zweig), leere
labels/measurements → Titel + Rahmen ohne Crash.

## 5. i18n-Vertrag (DE+EN, exakt diese Keys)

- `mode3d`: DE `"3D-Modus"`, EN `"3D mode"` (Button-Label Rueckweg).
- `diagramNote`: DE `"2D-Diagramm aktiv – 3D als Option verfuegbar."`,
  EN `"2D diagram active – 3D available as option."` (Hinweis unter Viewport).
- `is3dReason`: DE `"Diagramme/Tabellen/Prozesse → 2D, sonst 3D."`,
  EN `"Diagrams/tables/processes → 2D, else 3D."` (Generator-/Doku-Hinweis).
Paritaet: beide Sprachen je Key vorhanden, `t()`-Fallback DE bleibt.

## 6. Wireframe (Viewport-Sektion, ASCII)

+----------------------------------------------------------+
| ViewportTitle: <LabTitel>              [2D|3D-Badge]      |
| [Ansicht: select] [2D-Modus] [3D-Modus] [x Labels][x Masse]|
| +--------------------------------+---------------------+ |
| | #viewport (65vh/min520px)      | Overlay (Ebenen/     | |
| |  <svg renderDiagram2D> oder    |  Bauteile/partNote)> | |
| |  <canvas 3D/ κυρίως>            |                     | |
| +--------------------------------+---------------------+ |
| Hinweis (nur 2D): diagramNote + webglFallback (1x)       |
+----------------------------------------------------------+

## 7. Assembly-Vertrag (fuer Coder, deterministisch per Skript)

- Backup VORHER: `designer-scratch/skillspark-v7-backup.html`
  (Kopie der v7-Datei, Byte-Zahl loggen).
- Muse-Output: `designer-scratch/muse-v8-gen-out.txt` mit Markern
  `===SKILLSARK-V8-SNIP:<NAME>===` + `===SKILLSARK-V8-END===`.
  Min. Snippets: DIAGRAM (renderDiagram2D-Funktion komplett), VIEWER (force2D-
  Ersatz + loadLab-is3d-Default + to3D/tausch), LABSIS3D (9x `is3d`-Anker oder
  Patch-Anweisung), METAIS3D (10x inkl. free), I18N-DE, I18N-EN, PROMPT
  (buildFreePrompt-Zusatz). Max 3 Muse-Calls gesamt (Probe+Gen+Reserve).
- `designer-scratch/assemble-v8.mjs`: Anker-Ersetzung mit `must()`-Guards
  (Exit 1 = Datei unveraendert), danach Invarianten (siehe §8).
- `designer-scratch/verify-v8.mjs`: v7-Checks + neu (siehe §8),
  schreibt `muse-v8-check-mod.mjs` / `muse-v8-check-vue.js`, `node --check`.
- Ledger: `dist-standalone/ledger-muse-calls.md` je Call eine Zeile
  (Zeit/Modell/Promptdatei/Dauer/Bytes/Exit/Befund), Modell-Pin
  `muse-spark-1.3-contributor`, Key nie im Log.
- Verbote im NEU-Code (Wortgrenzen): fetch, WebSocket, XMLHttpRequest,
  sendBeacon, indexedDB, navigator, localStorage, sessionStorage,
  new Function (ausser Bestand-registerFree), eval. `document` NUR im
  Viewer-Glue-Bestand (kein neues document im DIAGRAM-Code — nur via
  svgHost-Parameter/innerHTML-String).

## 8. Abnahme (Verifikation, Exit 0 = ok)

- Verbote je 0 (neue + alte Bloecke).
- Pflicht: Vue.createApp, localStorage, importmap, __viewer, INIT,
  65vh + 520px, Ende `</html>`, div-Bilanz, alle 9 Lab-IDs + free-Handbohrmaschine
  (≥3x) + ConeGeometry (≥4x).
- Neu: `renderDiagram2D` ≥2x (Def + Call), `is3d` ≥19x (9 LABS + 10 META),
  `mode3d` ≥2x (i18n DE+EN), `diagramNote` ≥2x, `is3dReason` ≥2x,
  `3D-Modus`-Button + `2D-Modus`-Button je ≥1x, `loadLab(activeLab`-Rueckweg ≥1x,
  Titel/Badge v7→v8.
- `node --check` Modul-Block + Vue-Skript ok.
- Klick-Beleg (Orchestrator/Playwright, file://): DuP-1 zeigt SVG-Skizze
  (svg-Tag sichtbar), Rueckweg-Button rendert 3D-Canvas (canvas-Tag sichtbar).

## 9. Coder-Briefing (Uebergabe)

An Coder: implementiere NUR §2–§5 per Muse-CLI + Assembly-Skript (§7),
keine Modell-Edits (INIT-Quellen verbatim), keine neuen CDN, Vue Options-API.
Liefere: Backup-Bytes, Gen-Bytes, Verify-Log, Ledger-Zeilen, Klick-Beleg.
