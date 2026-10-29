# Implementation Guide 3D-Qualitaet (three.js r186, muse-spark-1.3)

Stand: 28.10.2026. Verbindliche Arbeitsvorlage fuer Coder-Agents.
Quellen: skillSpark-Forschung A (Realismus-Tricks, B1–B6), B (Alternativen), C (Loop-Architektur), Bestand (P1 v6-standard, P2 v6-harness, verify.js, budget.js, geometry-checks.js, ki-modellqualitaet-recherche.md Abschnitt 0).
Regel: keine Zeilennummern zitieren — nur Dateinamen + Symbolnamen. Parallele Session editiert Code; der Guide bleibt gueltig.

## 0. Management-Kurzfassung

Urteil: three.js r186 behalten — 25,79 Mio. Downloads/Woche, 117.133 Sterne, 617 Examples; einzige Engine mit LLM-3D-Benchmarks (6 Stueck). Kein Wechsel.
Hebel 1: IBL-Raum nach RoomEnvironment-Muster — Metall-IBL von Pixel [1,2,3] auf [245,245,245] (Faktor 245).
Hebel 2: Harness-Loop verdrahten (P2 bekommt S2/S4-Messwerte statt nur S1+S5) — Exec-Feedback +3,4 bis +38,8 pp Pass@1.
Hebel 3: Sofort-Fixes B1/B2/B3/B5/B6 — heute faellt jede Iteration mit MeshPhysicalMaterial-Import als E-S2-BOOT aus.
Risiko 1: MeshPhysicalMaterial und PCFSoftShadowMap stehen im Prompt, sind aber nicht im Vendor-Bundle (41 Exporte).
Risiko 2: API-Drift 186→187 (CubeUVReflectionMapping-Entfernung, PMREM-Aenderung, Object3D.dispose-Pflicht) bricht den Prompt erneut.
Risiko 3: Vision-Loop ohne Kostenrechnung — Bildpipeline kostet Tokens/Latenz gegenueber muse-Retry (60 s bei 429).
Reihenfolge: Loop verdrahten → Negativ-Muster → P1 entschlacken → Vision additiv → Retrieval optional. Kein Fine-Tuning.

## 1. Sofort-Fixes (vor jedem Prompt-Tuning)

Arbeite die Liste top-down ab. Jeder Fix ist unabhaengig testbar.

### F1 — MeshPhysicalMaterial-Verfuegbarkeit klaeren (B1, hoechste Prioritaet)
Symptom: P1 fordert MeshPhysicalMaterial mit clearcoat, aber weder die P1-Importliste noch das Vendor-Bundle (gebaut aus three.entry.js) noch THREE_KNOWN_EXPORTS in guard-static.js enthalten den Namen. Folge: SyntaxError im Frame-Boot, klassifiziert als E-S2-BOOT — ganze Iteration verloren.
Entscheide genau eine Option:
- Option A (schnell): Streiche MeshPhysicalMaterial aus P1. Ersetze lackiertes Blech durch T21-Rezept (Abschnitt 2). Passe zusaetzlich die P2-Budgetzeile an (kein clearcoat erwaehnen).
- Option B (teuer): Erweitere three.entry.js um MeshPhysicalMaterial, spiegele den Namen in THREE_KNOWN_EXPORTS in guard-static.js und in die P1-Importliste. Kosten: 1 zusaetzliches Shader-Programm (HAS_CLEARCOAT-Zweig in WebGLPrograms.js).
Akzeptanz: Generiere ein Testmodul mit jedem erlaubten Materialnamen — kein E-S2-BOOT, keine THREE-Warnung im S2-Gate.

### F2 — PCFSoftShadowMap ersetzen (B2, Blocker)
Symptom: P1 schreibt PCFSoftShadowMap vor; r186 hat den Modus entfernt (WebGLShadowMap.js warnt und schaltet selbst auf PCFShadowMap um). Jede Warnung frisst vom Budget MAX_THREE_WARNINGS in guard-static/guard-runtime.js (Limit 5).
Tue: Setze im P1-Lichtblock PCFShadowMap, ergaenze light.shadow.radius. Pruefe parallel, ob PCFShadowMap und VSMShadowMap im Vendor-Bundle exportiert sind — falls nein, erweitere three.entry.js analog F1.
Snippet ist in Abschnitt 2 (Lichtblock).

### F3 — envMapIntensity raus, scene.environmentIntensity rein (B3)
Symptom: P1 nennt environmentIntensity 0,55 mit Fallback envMapIntensity je Material. Gemessen: envMapIntensity wirkt nicht auf scene.environment (identische Pixel bei 0 vs. 1). 22 tote Zuweisungen im Referenzmodul gpu-example.js (Helper-Funktion M).
Tue: Schreibe in P1 exakt: Nur scene.environmentIntensity. Loesche jede envMapIntensity-Zuweisung aus P1, P2-Beispielen und pruefe gpu-example.js.

### F4 — Raumvariable `room` dokumentieren oder Gate entkoppeln (B5)
Symptom: verify.js prueft Backface-Ausnahme per Stringsuche nach room im Fenster ±2000 Zeichen. Variable envScene oder side: 1 ohne Raumbezug faellt durch (fail), obwohl korrekt.
Tue (eine Option): P1 schreibt zwingend `const room = new Scene();` vor (Snippet Abschnitt 2). Oder: entkopple das Gate in verify.js vom Bezeichner (z. B. PMREM-Quellszene per fromScene-Argument erkennen). Bis zur Entkopplung gilt die Namenspflicht.
Akzeptanz: S2-backface passiert mit room-Namen und faellt ohne ihn — oder Gate ist namensunabhaengig und beide passieren.

### F5 — BackSide-Import pruefen, numerisch schreiben (B6)
Symptom: BackSide/FrontSide sind nicht im Vendor-Bundle; frame-bootstrap.js vergleicht gegen NSref.BackSide (instrument-Funktion), das undefined ist — der Vergleich greift nie, nur der Raycast-Normalenpfad zaehlt.
Tue: Schreibe in P1: invertierte Boxen mit side: 1, nie die Konstante BackSide importieren. Pruefe guard-static.js THREE_KNOWN_EXPORTS auf BackSide-Eintrag — falls vorhanden, entfernen oder Bundle erweitern (konsistent mit F1-Entscheidung).

### F6 — three-Version pinnen, 186→187-Migration einplanen (B-Blocker)
Symptom: P1 pinnt die API nur implizit ueber three.entry.js. Der Migrations-Guide 186→187 listet bereits CubeUVReflectionMapping-Entfernung, PMREM auf Cube-Render-Targets, Object3D.dispose-Pflicht.
Tue: Ergaenze in P1 einen Satz (Snippet Abschnitt 2, Versions-Pin). Lege zusaetzlich eine Datei docs/three-186-api-pin.md an: erlaubte API-Namen = Schnittmenge aus P1-Importliste und Vendor-Bundle-Exporten.
Checkliste F1–F6 (umgesetzt 28.10.2026):
- [x] F1-Option B umgesetzt (MeshPhysicalMaterial in Bundle/Allowlist/P1), Testmodul ohne E-S2-BOOT
- [x] F2: PCFShadowMap im Prompt (PCFSoft nur im Nicht-verwenden-Pin), keine THREE-Warnung im Gate
- [x] F3: keine envMapIntensity-Zuweisung mehr im Prompt/Referenzmodul (nur scene.environmentIntensity)
- [x] F4: room-Pflicht im Prompt UND namensunabhaengiges Gate (fromScene-Bezug)
- [x] F5: side: 1 im Prompt, BackSide-Exportlage geklaert (nicht im Bundle, numerischer Fallback im Gate)
- [x] F6: Versions-Pin im Prompt, api-pin-Datei angelegt

## 2. P1-Prompt-Haertung (Licht- und Material-Rezept)

Alles unten sind Copy-Paste-Snippets. Ersetze die bestehenden P1-Bloecke LICHT & MATERIAL und Budgets 1:1.

### Versions-Pin (F6)
```
Ziel-API: three.js r186 (npm three@0.186.1). Verwende nur APIs, die in r186 existieren.
Nicht verwenden: outputEncoding (heisst outputColorSpace), PCFSoftShadowMap (entfernt, heisst PCFShadowMap).
```

### Inline-Environment / IBL-Fix (B4, T1)
Messwerte Metallkugel ohne Direktlicht: dunkle Basic-Waende [1,2,3] | helle Basic-Waende 0x6a7480 [79,90,103] | RoomEnvironment-Muster [245,245,245] | ohne Environment [0,0,0]. Metall ohne IBL ist schwarz.
```
Inline-Environment (Pflicht): PMREMGenerator + Mini-Raumszene.
Die PMREM-Raum-Szene heisst zwingend: const room = new Scene();
Raumaufbau: MeshStandardMaterial-Waende (side: 1) in 0xcccccc + PointLight(0xffffff, 900, 28, 2) im Raum + 2 emissive Softbox-Flächen (MeshBasicMaterial 0xffffff).
KEINE MeshBasicMaterial-Waende 0x11141a als Raum. pmrem.fromScene(room, 0.04).texture auf scene.environment.
Setze NUR scene.environmentIntensity = 0.55. envMapIntensity je Material bleibt ungesetzt.
```

### 4-Lichter-Setup (T12, T20, T6, T9–T11, T19)
```
Lichter (genau 4, KEIN AmbientLight — es ist richtungslos und flacht das Bild):
HemisphereLight(0xdfeaff, 0x1a1410, 0.35) als Fill.
Key-DirectionalLight(0xffffff, 2.5) MIT Schatten: shadow.mapSize 1024x1024,
Shadow-Frustum exakt um die Modell-Ausdehnung legen (nicht fix), danach shadow.camera.updateProjectionMatrix(),
shadow.bias = -0.0001, shadow.normalBias = 0.002-0.02.
Rim-DirectionalLight(0xbcd0ff, 0.7) ohne Schatten.
PointLight(0xffd9a0, 0.12, 1.5, 2) als warmer Akzent, OHNE Schatten (Point-Schatten = 6 Depth-Passes).
toneMapping ACESFilmicToneMapping, exposure 1.0-1.1, outputColorSpace SRGBColorSpace.
Kontaktboden: CircleGeometry mit ShadowMaterial({opacity: 0.55}), receiveShadow true.
Schatten-Regel: receiveShadow true auf allen Meshes; castShadow true NUR auf Hauptbauteilen.
```

### DataTexture-Mikrostruktur (T5, T13, T14)
```
DataTexture-Mikrostruktur (max 128x128, LinearFilter, rohe Uint8-Pixel, KEIN document/canvas):
Farb-Maps (map, emissiveMap): colorSpace SRGBColorSpace.
Daten-Maps (roughnessMap, metalnessMap, aoMap): KEIN colorSpace setzen (Default NoColorSpace).
Kanaele: roughnessMap nutzt GRUEN, metalnessMap nutzt BLAU, aoMap nutzt ROT.
aoMap nutzt den uv-Kanal (channel 0). KEIN uv1/uv2-Attribut noetig. aoMapIntensity 0.6.
```

### InstancedMesh-Regel (T7, T8)
```
Wiederholteile je Familie als EIN InstancedMesh (Schrauben, Ports, Pins, Pads, Lamellen).
Platzierung via Matrix4/Quaternion/Vector3 mit setMatrixAt (KEIN Object3D-Dummy, KEIN setColorAt ohne Color-Import).
Danach: instanceMatrix.needsUpdate = true; computeBoundingSphere().
```

### Bevel- und Segment-Regel (T15, T16)
Messwerte Platte: ohne Bevel 140 Tris | Bevel 1 + curveSegments 4 = 284 | Bevel 1 + curve 12 = 796 | Bevel 3 + curve 12 = 1596. Kugel 16x12 = 352 Tris vs. 32x16 = 960.
```
ExtrudeGeometry: curveSegments 4, bevelSegments 1, steps 1.
Segmente: Sphere 16x12, Cylinder 12, Torus 8x32, Circle 24-32.
```

### DPR-Cap (T17)
Messwerte: dpr 1 = 480 k Pixel, dpr 1.5 = 1,08 M, dpr 2 = 1,92 M (Fuellrate 4,0x).
```
dpr = params.dpr, begrenzt auf 1..2, Default 1. Auf iGPU nie 2 bei grosser Flaeche.
```

### Negativ-Liste (identisch in P1 UND P2 pflegen)
```
AUSDRUECKLICH NICHT: transmission, iridescence, sheen (eigene Shader-Zweige, transmission = extra Szenenpass).
KEIN AmbientLight. KEIN CanvasTexture/document/canvas. KEIN fetch/TextureLoader/CDN.
KEIN mapSize 2048 als Default. KEIN DPR >= 2 als Default.
KEIN curveSegments >= 12 / bevelSegments >= 3. KEIN DoubleSide global (nur duenne Teile).
KEIN PointLight mit Schatten. KEIN Schatten auf allen Meshes.
Ohne F1-Option-B: KEIN MeshPhysicalMaterial (Boot bricht ab).
```

### Klarlack-Ersatz ohne MeshPhysicalMaterial (T21, nur bis F1-Option-B)
```
Lackiertes Blech ohne MeshPhysicalMaterial: metalness 0.0-0.1, roughness 0.12-0.2, mit Environment.
Nicht metalness 0.8 (das wirkt wie Blankmetall).
Nach F1-Option-B: MeshPhysicalMaterial NUR fuer lackierte Blechflaechen, clearcoat 0.35, clearcoatRoughness 0.25.
```

## 3. P2-Repair-Ausbau (nur S1+S5-Luecke schliessen)

Befund C: Der Generator kennt kein Verify (Script _gen-one.mjs: 1 Call + Retry, sonst nichts). verify-all.mjs ruft verifyGeometryLayer ohne Boxen (statischer Pfad: S2-intersect und S2-flicker = pass mit Text ohne Boxen vermessen). Der Reparaturlauf bekommt S1+S5, aber kein Geometrie-, Visual- oder Budget-Feedback. P2 ist heute manueller Notfallpfad (de.json-Anweisung, harness.spec-Erwartung P2-NOTFALLPFAD).

### Was Du verdrahtest (Orchestrator-Seite, kein Prompttext)
1. Harness misst pro Iteration: snapshot-Felder (Abschnitt 4) + probeBoxes/probeBackfaces + PNGs + 2-Frame-Pixel-Diff.
2. verify.js baut Layer S1–S5 mit expected/actual; formatP2Protocol gibt NUR fail-Kriterien aus (bestehende Funktion, bereits FLARE-Klasse).
3. P2-Eingabe = vorheriges Modul + Protokolltext + optional Bilder (Regeln Abschnitt 4). Keine neuen Bauteile/Imports/Abhaengigkeiten.
4. P2-Vertrag bleibt: behebe genau die protokollierten Fehler, aendere keine bestandenen Schichten.

### P2-Prompt-Aenderung (minimal, Copy-Paste)
Haenge an prompts/p2-repair.v6-harness.txt an:
```
GEOMETRIE-MESSDATEN (aus dem Browser, nicht aus dem Quelltext):
[S2:S2-intersect] FAIL | Soll: <0 Ueberschneidungen, Toleranz 2,0 mm> | Ist: <Paarzahl, max Tiefe mm, betroffene IDs>
[S2:S2-backface] FAIL | Soll: <0 sichtbare Innenseiten> | Ist: <BackSide-Anzahl, inkonsistente Normalen, IDs>
[S2:S2-flicker] FAIL | Soll: <Pixel-Diff <= 0,002, Abstand >= 0,5 mm> | Ist: <Pixel-Diff, Paare>
[S2:S2-orient] FAIL | Soll: <Zentrum ±0,50 m, Ausdehnung <= 1,50 m> | Ist: <Zentrum, Spanne>
[S2:S2-connect] FAIL | Soll: <Label-Abstand >= 5,0 mm, Spanne <= 1,50 m> | Ist: <min Abstand, Spanne>
[S4-Budgets] FAIL | Soll: <Meshes <= 250 (gruen bis 120, Ziel ~45), Tris <= 150000, Draw-Calls <= 400, Modul <= 34000 Bytes> | Ist: <Messwerte renderer.info + Bytes>
Repariere genau die protokollierten Kriterien; bestandene Schichten unveraendert lassen.
```

### Iterations-Budget und Abbruch (hart)
```
Maximal 2 automatische Reparaturrunden + 1 manuelle Reserve (steht bereits im P2-Prompt, jetzt auch im Orchestrator durchsetzen).
Abbruch GRUEN: alle S1–S5 pass — Gate, kein weiterer Call.
Abbruch STAGNATION: dieselbe Fehlerklasse erscheint in Iteration 2 mit identischem Ist-Wert — stoppen, an User melden.
Abbruch REGRESSION: eine in Iteration n gruene Klasse wird in n+1 rot — Iteration n zurueckrollen, stoppen.
Nicht-Kriterium: sieht besser aus (ohne Messwert keine Iteration).
```
Akzeptanz: Ein Number-Fail (z. B. 2 Intersects, Tiefe 4,7 mm) ist nach P2-Lauf behoben oder als Stagnation gestoppt; kein dritter Auto-Call; Rollback bei Regression nachweisbar.

## 4. Headless-Self-Check-Spec (was das LLM pro Iteration zurueckbekommt)

Kanaele (bestehend, nicht neu erfinden): Metriken via lab-get-probe/postMessage in snapshot; Geometrie via probeBoxes/probeBackfaces (Raycast, max. 32 Meshes); Bilder via lab-capture in dataUrl; Szenen-Identitaet via meta plus Manifest. Kein window-3D-State im Gast (window ist per S1 verboten).

### 13-Felder-snapshot (Pflicht)
calls, triangles, meshes, geometries, textures, programs, frames, firstFrameAt, boxes, backfaceHits, geoNote plus Manifest-Anbindung (Titel, Teile, Einheiten) und 2-Frame-Pixel-Diff.
Schwellen (GEO_LIMITS aus geometry-checks.js): penetrationMm 2,0 | coplanarMm 0,5 | cohesionGapMm 50,0 | flickerMaxDiff 0,002 | centerTolM 0,5 | extentMaxM 1,5 | labelMinDistMm 5,0.
Budgets (budget.js DEFAULT_BUDGET_LIMITS + TRAFFIC): Modul 34000 Bytes hart | Tris 150000 (gruen bis 120000) | Draw-Calls 400 (gruen bis 300) | Meshes 250 (gruen bis 120, Ziel ~45) | erster Frame 8000 ms | 30 FPS | Heap 256 MB.

### Format-Beispiel (exakt so an P2 uebergeben)
```
FEHLERPROTOKOLL (Iteration 2 von maximal 2; Iteration 3 nur manuelle Reserve):
[S2:S2-intersect] FAIL | Soll: 0 Ueberschneidungen zwischen Baugruppen (Toleranz 2,0 mm) | Ist: 2 Paare ueber Toleranz (max Tiefe 4,7 mm) — Betroffen: gehaeuse<->luefter_rad (4,7 mm), luefter_rad<->luefter_blatt (1,9 mm)
[S2:S2-backface] FAIL | Soll: 0 sichtbare Innenseiten (kein BackSide, konsistente Normalen) | Ist: 3 BackSide, 0 inkonsistente Normalen — Betroffen: luefter_rad, gehaeuse_innen, schachtblech
[S2:S2-flicker] FAIL | Soll: keine koplanaren Ueberlappungen (Mindestabstand 0,5 mm, Pixel-Diff-Schwelle 0,002) | Ist: Pixel-Diff 0,0114 (Schwelle 0,002), Paare: deckblech<->luefter_blatt
[S2:S2-orient] FAIL | Soll: Bauteile zentriert (±0,50 m), Ausdehnung <= 1,50 m | Ist: Zentrum [0,31, -0,18, 0,04], Spanne 1,94 m (12 Labels)
[S2:S2-connect] FAIL | Soll: Baugruppen koharent (Label-Mindestabstand >= 5,0 mm, Spanne <= 1,50 m) | Ist: min Label-Abstand 1,2 mm, Spanne 1,94 m (12 Labels)
[S4:S4-meshcount] FAIL | Soll: <= 250 (gruen bis 120, Ziel ~45) | Ist: 187 Meshes statisch (Mesh 171 + Instanced 16)
[S4:S4-triangles] FAIL | Soll: <= 150000 (renderer.info) | Ist: 162480 Dreiecke (renderer.info)
[S4:S4-drawcalls] FAIL | Soll: <= 400 (renderer.info) | Ist: 431 Draw-Calls (renderer.info)
Hinweis: Repariere genau die 8 protokollierten Kriterien; bestandene Schichten unveraendert lassen.
Vorgaben: keine neuen Bauteile/Imports/Abhaengigkeiten; Budgets einhalten (Dreiecke <= 150000, Draw-Calls <= 400, Meshes <= 250, Modul <= 34000 Bytes).

SZENEN-STATE (aus der Browser-Probe, nicht aus dem Quelltext):
frames=42 | firstFrameAt=1183 ms | meshes=187 | triangles=162480 | drawCalls=431
geometries=23 | textures=4 | programs=7 | boxes=12 | backfaceHits=3
box-3 (luefter_rad): min [-0.214,-0.118,-0.041] max [0.171,0.096,0.052]

BILDER (3 Views, 1280x720, SwiftShader, Frame 42):
[BILD 1] overview -> luefter_rad ragt 4,7 mm in das Gehaeuse hinein (Sicht auf Ueberlappung)
[BILD 2] front -> linke Seitenflaeche des Gehaeuses sichtbar (Innenseite, 3 doppelte Normalen)
[BILD 3] top -> Flackern zwischen Deckblech und Luefterblatt (Pixel-Diff 0,0114)
```

### Feedback-Regeln (FLARE-Klasse halten)
1. Zahlen, keine Prosa: jede Zeile Soll/Ist mit Einheit (mm, m, Anzahl). Max. 4 Offender plus +N weitere (wie checkIntersections in geometry-checks.js).
2. Nur fail-Kriterien listen (formatP2Protocol in verify.js). Bestandenes nicht wiederholen.
3. Offen ist nicht gruen: scoreboard.js kennt offen — nicht gemessen heisst nicht bestanden.
4. Bildteil ist additiv: Screenshots ersetzen keine Zahl. Max. 3 Views (overview, front, top oder detail).
5. Bilder nur bei Bild-Fehlern: bei reinen S1/S4-Verstoessen (Bytes, Import, Mesh-Count) kein Bild mitschicken (Tokens/Rate-Limit: muse-Retry 60 s bei 429).
6. Kein Prompt-Selbstgespraech: kein Was ist dir aufgefallen (Self-Refine-Regime, 16/21 Regressionen). Nur: gemessen, Sollwert, Sitz des Fehlers.

## 5. Context-vs-FineTuning-Entscheidung

Empfehlungsskala: JA = umsetzen, BEDINGT = mit Bedingung, NEIN = nicht. Evidenz-Kuerzel: [A-Tab]=A Quellen-Tabelle, [B-Tab]=B Quellen-Tabelle, [C-Qn]=C Quellen-Tabelle Nummer n.

| Massnahme | Empfehlung | Begruendung mit Evidenz |
|---|---|---|
| Loop verdrahten (M2/M3: Exec-Feedback mit Zahlen in P2, S2 messen statt raten) | JA | Groesster ROI: exec-refine +3,4 bis +38,8 pp [C-Q1]; FLARE 54,86 vs 50,27 % und 58,51 vs 53,81 %, k=10 +8,50 pp [C-Q2]; heutige Luecke L3 (nur S1+S5 fliessen zurueck) genau dort |
| Iterations-Budget 2+1 mit Abbruch/Rollback (M5) | JA | Gewinne in Runde 1–2, ohne Early-Stopping jede Iteration netto-negativ [C-Q5]; SimWorld max. 3 Runden [C-Q21]; Code-as-Room Drift ab 10 Runden [C-Q20] |
| Negativ-Muster gemischt positiv+negativ (M8: 6 Fehlerklassen je 1 Negativ + 1 Positiv) | JA | 2-Shot gemischt bestes Setup (DeepSeek F1 +12,95 %) [C-Q18]; positiv allein schlaegt negativ allein; interpretierbar +0,15 bis +5,72 % [C-Q18] |
| P1 entschlacken (M1: Doppelungen raus, Checkliste statt Prosa, Korridor statt Grenzwert) | JA | Checkliste 7,50/8 vs. roh 5,67/8 [C-Q9]; Spezifitaet nicht monoton [C-Q6]; Inhalt erklaert 4x mehr Varianz als Position [C-Q11] |
| Mesh-Budget-Korridor mit Zielzahl + Instancing (M10) | JA | Median eigenes Modell 995 Meshes/177000 Tris vs. Astra 45 [C-Q26]; 20 % Intersektionen — Korridor ist Geometrie-Hebel |
| Vision-Loop additiv (M4: max. 3 Views nur als Zusatz zu Zahlen) | BEDINGT | Render-Critique-Revise steigt bis 5 Iterationen [C-Q20]; SimWorld 6 Views + PASS/NEEDS_IMPROVEMENT/FAIL [C-Q21]; aber Kosten/Latenz im Setup ungemessen, VLM-Judge nur 32–34 % exakt [C-Q24] |
| Retrieval Baustein-Bibliothek (M7) | BEDINGT | BlenderRAG 40,8→70,0 % Kompilierung, CLIP 0,41→0,77 ohne FT [C-Q16]; erst nach Loop, Kuratierung + Vektorindex noetig |
| Material-Lookup-Tabelle (M9) | NEIN (jetzt) | Materialdosierung bereits in P1; Geometrie-Defekte dominieren (3JSBench-Fehlerklassen) — erst wenn Geometrie gruen |
| Statische Few-Shots 5–25 (M6) | NEIN | Peak bei 5–25, Fall auf Near-Zero bei 125/625 [C-Q7]; grosse Code-Modelle teils schlechter [C-Q6]; Prompt-Budget durch 34-KB-Modul gebunden — Retrieval statt statisch |
| Prompt-Spezifitaet als Selbstzweck (M12) | NEIN | Nicht monoton [C-Q6]; Compliance 66,9 %, Prozess-Compliance 0 % unter Default [C-Q11/12] — messbares Feedback statt mehr Text |
| Prosa-Selbstkritik Self-Refine (M13) | NEIN | 16/21 Regressionen, nur 4 besser [C-Q3]; Self-Debug mit Diagnose 16/21 positiv — also Zahlen statt Prosa |
| Fine-Tuning/LoRA (M11) | NEIN | LoRA +15,92 % pass@1 nur bei kleinen Open-Source-Modellen [C-Q14/15]; braucht >4000 Skripte + GPUs [C-Q17]; Budget geht in den Loop |

## 6. Engine-Entscheid und Uebernahmen

Urteil: bei three.js r186 bleiben. Kein Engine-Wechsel.
Belege (B): Downloads/Woche 25,79 Mio. vs. Babylon 382.443 (67x), PlayCanvas 141.869 (182x), A-Frame 30.206 (854x). Sterne 117.133 vs. 26.238/17.155/17.681. Examples 617 vs. A-Frame 119. llms.txt 5.404 B + llms-full.txt 363.106 B (PlayCanvas 42,6 KB/1,37 MB am besten bei Alternativen, Babylon nur 4,3 KB Index, A-Frame 404). Alle 6 LLM-3D-Benchmarks messen three.js; fuer Alternativen existiert kein Halluzinations-Messwert. Kopplung klein (3 Dateien: three.entry.js, annotate.js, guard-static.js Allowlist-Regeln), Wechselnutzen nicht messbar. Eigenes Modell: 10,7 % Passrate, Median 995 Meshes/177000 Tris, 33 % Flacker — Fix per Loop, nicht per Engine.
Uebernahme 1 — NullEngine-Pruefebene (Babylon-Muster): Szenenaufbau zusaetzlich ohne GPU pruefen (Mesh/Dreiecks/Transform-Budgets, Beruehrung, Durchdringung, Einbaulage deterministisch rechnen). Erwartung: faengt 3JSBench-Klassen Flackern 22 % + Durchdringung 20 % vor dem Browser-Render.
Uebernahme 2 — Deklarative Bauteil-Semantik (A-Frame-Muster): Bauteil, Geometrie, Materialklasse, Masse, Label-Anker, Mess-Endpunkte, Level als Daten im Manifest; three.js-Aufbau daraus generieren. Senkt Durchdringung/Disconnect (36 % der Fehler) strukturell.
Uebernahme 3 — getMetrics-Kanal (PlayCanvas app-stats-Muster): Modul meldet neben update/dispose eigene Metriken (Draw-Calls, Frame-Zeit, VRAM) statt nur renderer.info-Auslesung; alternativ meta.metrics-Kanal im Manifest. Kosten: kein neues Addon noetig.
Verworfene: glTF/JSON-Emit als Renderer-Ersatz — GLB 0,5–19,8 MB vs. 34-KB-Budget (Faktor 15–580), Base64 +33 %, keine Label/Mess-Semantik (extras ungeprueft), Draw-Call-Budget unpruefbar. Raw WebGPU verworfen: nur 50 WGSL-Paare als Korpus, Headless-Captures blank, 31 % Nutzer ohne D3D11.1+.

## 7. Baustein-Roadmap fuer Agents

Reihenfolge aus C: Loop verdrahten → Negativ-Muster → P1 entschlacken → Vision additiv → Retrieval optional.

| ID | Titel | Dateien | Abhaengigkeiten | Akzeptanzkriterien (messbar) | Aufwand |
|---|---|---|---|---|---|
| M1 | Sofort-Fixes F1–F6 einarbeiten | prompts/p1-generate.v6-standard.txt, src/vendor/three.entry.js, src/runtime/guard-static.js, src/runtime/verify.js, docs/three-186-api-pin.md (neu) | keine | Testmodul mit allen erlaubten Imports ohne E-S2-BOOT; 0 THREE-Warnungen; 0 envMapIntensity-Treffer; room-Gate deterministisch; Versions-Pin im Prompt | M |
| M2 | Harness-Loop verdrahten (R2–R4) | scripts/_gen-one.mjs, scripts/verify-all.mjs, src/runtime/verify.js (formatP2Protocol), src/runtime/frame-bootstrap.js (snapshot, lab-capture, lab-get-probe) | M1 | P2-Eingabe enthaelt S2+S4-Messwerte; max. 2 Auto + 1 manuell; Abbruch gruen/Stagnation/Regression mit Rollback; kein dritter Auto-Call | L |
| M3 | Negativ-Muster-Katalog (6+6) | prompts/p1-generate.v6-standard.txt, prompts/p2-repair.v6-harness.txt | M2 | 6 Fehlerklassen je 1 Negativ + 1 Positiv im Kontext; Intersektions-Rate im A/B-Lauf sinkend | S |
| M4 | P1 entschlacken + Korridor | prompts/p1-generate.v6-standard.txt | M1 | Doppelungen (Output-Ende, Budget) entfernt; Checkliste statt Prosa; Mesh-Korridor 120/250 + Ziel ~45 + Instancing-Regel; Prompt kuerzer bei gleicher S1-Passrate | S |
| M5 | Vision additiv (max. 3 Views) | scripts/verify-all.mjs, src/runtime/frame-bootstrap.js, prompts/p2-repair.v6-harness.txt | M2 | Bilder nur bei Bild-Fehlern; max. 3 Views; Zahlen bleiben Pflicht; Token/Latenz pro Iteration protokolliert | M |
| M6 | Retrieval Baustein-Bibliothek (optional) | neu: Baustein-Index + Abruf im Orchestrator | M2, M4 | Kuratierte Muster mit Text+Code+Bild; Abruf semantisch statt statisch; Kompilierquote im A/B-Lauf steigend | L |

## 8. Quellen-Anhang

Abrufdatum alle Web-Quellen: 28.10.2026. Basisdokument: docs/ki-modellqualitaet-recherche.md (27.10.2026) — 6 3D-Benchmarks im Vergleich, eigenes Modell 10,7 %/995 Meshes/33 % Flacker, Exec-Feedback staerkster Hebel.

| # | URL | Kernaussage |
|---|---|---|
| A1 | https://raw.githubusercontent.com/mrdoob/three.js/r186/src/constants.js | REVISION 186; PCFSoftShadowMap deprecated; BackSide=1, DoubleSide=2 |
| A2 | https://raw.githubusercontent.com/mrdoob/three.js/r186/src/renderers/webgl/WebGLShadowMap.js | PCFSoftShadowMap entfernt, schaltet auf PCFShadowMap um |
| A3 | https://raw.githubusercontent.com/mrdoob/three.js/r186/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js | PCF 17 Taps Vogel-Disk + Noise; shadowBias/NormalBias/Radius |
| A4 | https://raw.githubusercontent.com/mrdoob/three.js/r186/src/renderers/webgl/WebGLPrograms.js | aoMap channel-Logik; HAS_CLEARCOAT/TRANSMISSION/SHEEN/IRIDESCENCE-Zweige |
| A5 | https://raw.githubusercontent.com/mrdoob/three.js/r186/src/extras/PMREMGenerator.js | fromScene-Signatur, Groesse 256, 6 Extra-LODs |
| A6 | https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/environments/RoomEnvironment.js | Referenz-Rezept: StandardMaterial-Raum + PointLight 900 + emissive Flaechen |
| A7 | https://threejs.org/docs/pages/MeshStandardMaterial.html | roughness=gruen, metalness=blau, aoMap=rot; Environment noetig |
| A8 | https://threejs.org/docs/pages/MeshPhysicalMaterial.html | Hoehere Pixelkosten; clearcoat/transmission/sheen-Eigenschaften |
| A9 | https://threejs.org/docs/pages/Scene.html | environmentIntensity wirkt nur auf scene.environment |
| A10 | https://threejs.org/docs/pages/DataTexture.html | Default NoColorSpace; flipY false; RGBA/UnsignedByte |
| A11 | https://threejs.org/docs/pages/Texture.html | channel 0=uv, 1=uv1, 2=uv2, 3=uv3 |
| A12 | https://threejs.org/docs/pages/ExtrudeGeometry.html | bevelSegments Default 3; curveSegments 12; steps 1 |
| A13 | https://threejs.org/docs/pages/InstancedMesh.html | Weniger Draw-Calls; needsUpdate + computeBoundingSphere |
| A14 | https://threejs.org/docs/pages/PointLight.html | Candela; decay 2; distance 0 = unendlich |
| A15 | https://threejs.org/manual/pages/color-management.html | Arbeitsraum Linear-sRGB; Farb- vs. Nicht-Farb-Texturen |
| A16 | https://threejs.org/manual/pages/shadows.html | Fake-Shadows; AO-Maps als Offline-Alternative |
| A17 | https://threejs.org/docs/pages/WebGLRenderer.html | Default SRGB + NoToneMapping; Exposure Default 1 |
| A18 | https://threejs.org/docs/pages/Info.html | calls/triangles-Messung via renderer.info |
| A19 | https://github.com/mrdoob/three.js/wiki/Migration-Guide | r163 Env-Intensitaet; r182 PCFSoft-Wechsel |
| A20 | https://threejs.org/docs/pages/ShadowMaterial.html | Transparenter Schattenfaenger; transparent Default true |
| A21 | https://threejs.org/docs/pages/EdgesGeometry.html | thresholdAngle; braucht LineSegments |
| A22 | https://discourse.threejs.org/t/meshphysicalmaterial-can-i-measure-how-much-more-expensive-is-it/60398 | Clearcoat billig; transmission = Extrapass |
| A23 | https://threejs.org/docs/pages/RoomEnvironment.html | fromScene-Textur als IBL |
| A24 | https://3jsbench.com/methodology | 100 Briefings, 696 Checks; haeufigste Fehler Intersect/See-through/Flicker |
| A25 | https://generalcontextlabs.com/research/threejs | 3JSBench-Uebersicht; Opus-Praeferenz vs. Astra-Korrektheit |
| A26 | https://threejseval.com/methodology | Elo aus Paarvergleichen; Both-bad-Signal |
| A27 | https://arxiv.org/html/2606.03852 | FLARE 54,86 vs. 50,27 %; k=10 58,29→65,14 % |
| A28 | https://arxiv.org/html/2407.14044v1 | exec-refine +3,4 bis +38,8 pp; Degradation ueber Iterationen |
| A29 | https://arxiv.org/html/2610.22341v1 | 3DCodeVerse Guidance-Bundle + Frame-Gate bei dunklen Frames |
| A30 | https://arxiv.org/html/2606.01869v2 | WorldCoder: Material/Shader Top-5-Fehlerklasse |
| A31 | https://arxiv.org/html/2610.10622v1 | WorldBench: Code- vs. Frame-Judge 32 % Widerspruch |
| A32 | https://pbr-book.org/3ed-2018/Texture/Solid_and_Procedural_Texturing | Prozedural-Details schwer kontrollierbar |
| A33 | https://salivity.github.io/three.js/article/fix-peter-panning-with-three-js-shadow-bias | normalBias vor bias; bias klein |
| A34 | https://threejsresources.com/guides/shadows | Acne vs. Peter-Panning; enges Frustum = mehr Texel |
| A35 | https://threejs.org/docs/pages/ColorManagement.html | Farbkonvertierung; Color in Linear-sRGB |
| A36 | https://threejs.org/manual/pages/optimize-lots-of-objects.html | Vertexfarben; Geometrie/Material teilen |
| A37 | https://github.com/gaoypeng/3dcodeverse | Harness-Referenz Guidance-Bundles |
| A38 | https://threejs.org/manual/pages/lights.html | Ambient richtungslos; Hemisphere = Verlauf |
| A39 | https://www.utsubo.com/blog/threejs-2026-what-changed | r186: PCFSoft weg, Source-Umbenennung, PBR-Energieerhaltung |
| A40 | https://webcodingcenter.com/three-js/getting-started-with-three-js--the-rnnn-release-model-and-verifying-your-version.html | r186 = 0.186.0/0.186.1; REVISION-Check |
| B1 | https://api.npmjs.org/downloads/point/last-week/three | 25,79 Mio. Downloads/Woche three.js |
| B2 | https://api.github.com/repos/mrdoob/three.js | 117.133 Sterne; 617 Examples |
| B3 | https://bundlephobia.com/api/size?package=three@0.186.1 | three.js 736 KB min / 185 KB gzip |
| B4 | https://threejs.org/docs/llms.txt | LLM-Leitfaden 5,4 KB |
| B5 | https://github.com/mrdoob/three.js/wiki/Migration-Guide | API-Drift 181/182, 185/186, 186/187 |
| B6 | https://github.com/mrdoob/three.js/releases | r186-Changelog: PCFSoft-Wegfall, Source-Umbenennung |
| B7 | https://generalcontextlabs.com/research/threejs | 3JSBench Passraten + Fehlermodi |
| B8 | https://techmoon.xyz/3jsbench-ai-3d-geometry/ | Median 995 Meshes/177 k Tris; 55/300 Code-Fences |
| B9 | https://threejseval.com/ranking | threejseval-Elo; muse-spark Rang 17 |
| B10 | https://www.benchmark.ai/text-to-3d-code | 135 k Vergleiche; Prompt pinnt r186 |
| B11 | https://artificialanalysis.ai/evaluations/aa-3d | AA-3D: 55 Tasks, Elo-Fuehrung Sonnet/Opus |
| B12 | https://arxiv.org/html/2610.10622v1 | WorldBench nur three.js; DEVTOOLS-Zugriff |
| B13 | https://developer.playcanvas.com/user-manual/engine/llms.txt | PlayCanvas-LLM-Doku 42,6 KB/1,37 MB |
| B14 | https://developer.playcanvas.com/user-manual/optimization/app-stats/ | primitiveCount nur Debug/Profiler |
| B15 | https://github.com/playcanvas/engine/blob/main/src/framework/app-stats.js | Primaerquelle primitiveCount-Bedingung |
| B16 | https://doc.babylonjs.com/setup/support/serverSide | NullEngine headless ohne GPU |
| B17 | https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene | Draw-Call/Frame-Instrumentierung |
| B18 | https://doc.babylonjs.com/llms.txt | Babylon-LLM-Index 4,3 KB |
| B19 | https://webcodingcenter.com/babylon-js/babylon-js-and-its-alternatives--licensing-bundle-size-and-long-term-support.html | One-Box-Groessen; Lizenzen/Kadenz |
| B20 | https://webcodingcenter.com/three-js/three-js-and-its-alternatives--a-frame-and-webxr-first-frameworks.html | A-Frame pinnt super-three r184 |
| B21 | https://aframe.io/blog/aframe-v1.8.0/ | A-Frame 1.8.0 mit three r184 |
| B22 | https://aframe.io/llms.txt | Kein llms.txt (404) |
| B23 | https://playcanvas.com/products/engine | PlayCanvas WebGL2/WebGPU, headless Node |
| B24 | https://github.com/gpuweb/gpuweb/wiki/Implementation-Status | WebGPU-Matrix Chrome/Firefox/Safari |
| B25 | https://developer.chrome.com/docs/web-platform/webgpu/overview | 31 % Nutzer ohne D3D11.1+ |
| B26 | https://github.com/visgl/luma.gl/issues/2874 | WebGPU-Canvas headless blank |
| B27 | https://www.w3.org/TR/WGSL/ | WGSL-Spezifikation; 50-Paar-Korpus |
| B28 | https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | glTF-Semantik accessors/bufferViews/nodes |
| B29 | https://threejs.org/docs/pages/USDLoader.html | USDLoader in three.js r186 |
| B30 | https://github.com/mvaligursky/web-engines-compare | CPU-Kosten je Draw-Call drei Engines |
| B31 | https://github.com/threejs/three-devtools | DEVTOOLS-Hook Szenenzugriff |
| B32 | https://github.com/dvscode/3D-Model-Extractor | Szenenextraktion als Messkanal |
| C1 | https://aclanthology.org/2024.emnlp-main.859.pdf | exec-refine +3,4 bis +38,8 pp |
| C2 | https://arxiv.org/html/2606.03852 | FLARE-Zahlen + Laufzeiten |
| C3 | https://www.mdpi.com/2673-2688/7/9/353 | Self-Refine 16/21 Regressionen |
| C4 | https://arxiv.org/html/2604.10508v1 | Self-Repair Gewinne Runde 1–2 |
| C5 | https://arxiv.org/html/2604.21950v1 | Ohne Early-Stopping netto-negativ |
| C6 | https://arxiv.org/html/2602.15228 | Spezifitaet nicht monoton |
| C7 | https://arxiv.org/html/2510.16809 | Many-Shot-Peak 5–25 |
| C8 | https://research.chalmers.se/publication/547601/file/547601_Fulltext.pdf | CodePromptEval 7072 Prompts |
| C9 | https://arxiv.org/html/2605.20149v2 | Checkliste 7,50/8 vs. roh 5,67/8 |
| C10 | https://arxiv.org/html/2507.18624v1 | RLCF +2–3 % |
| C11 | https://arxiv.org/html/2605.01771 | Inhalt 4x wichtiger als Position |
| C12 | https://arxiv.org/html/2510.18892 | Compliance 66,9 % ueber 256 Modelle |
| C13 | https://arxiv.org/html/2303.11366v4 | Reflexion HumanEval 91,0 % |
| C14 | https://arxiv.org/html/2405.18649v1 | SFT +15,92 % pass@1 |
| C15 | https://arxiv.org/html/2603.16526 | LoRA schlaegt Few-Shot/RAG |
| C16 | https://arxiv.org/html/2605.00632v1 | BlenderRAG 40,8→70,0 % |
| C17 | https://huggingface.co/lamm-mit/Bioinspired3D | 4000+ Blender-Skripte + LoRA |
| C18 | https://arxiv.org/html/2602.23047v1 | 2-Shot gemischt bestes Setup |
| C19 | https://arxiv.org/html/2402.11254v2 | c-ICL +26,22 % |
| C20 | https://arxiv.org/html/2605.18451v1 | Code-as-Room Drift ab 10 Runden |
| C21 | https://arxiv.org/html/2605.09423v2 | SimWorld max. 3 Runden, 6 Views |
| C22 | https://arxiv.org/html/2609.06535 | 3DHarnessBench Prompt-Vertrag ohne Fences |
| C23 | https://arxiv.org/html/2511.03001v2 | Regelbasiert F1 0,81 vs. VLM 0,40 |
| C24 | https://arxiv.org/html/2604.25235 | VLM-Judge nur 32–34 % exakt |
| C25 | https://arxiv.org/html/2606.10142 | VLM staerker bei Adherence als Geometrie |
| C26 | https://3jsbench.com | Astra 80 % vs. muse-spark 10,7 % |
| C27 | https://lzugis.cn/threejs-wiki/en/wiki/6.4-testing-and-quality-assurance.html | Headless-Render + Pixeldiff praxisreif |
| C28 | https://github.com/nicksonthc/ghibli-threejs/blob/main/skills/threejs-headless-visual-verification/SKILL.md | Headless-Fallstricke rAF/Cache/Shader |
