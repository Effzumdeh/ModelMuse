# Routing-Tests (P0 3D vs 2D + Typwahl, Generierung, Frontend-Rendering)

Stand: 2026-10-29 (offline, Stub-Proxy, kein Key, kein LLM — live Baseten-BYOK ausstehend, Key nie in Code/Logs). Template: `prompts/p0-router.txt` (6 Few-shots nach Nacharbeit: 1x 3D + 5x 2D). Vendor: `src/vendor/diagram-2d.js` (SVG nativ, 0 KB — Mermaid/Chart/d3/KaTeX aus `docs/2D-STACK-EVAL.md` evaluiert, aber NICHT gebuendelt; generierte Module nutzen nur `from '2d-svg'`). Mapping P0-Typ→Vendor-Kind: `src/runtime/livegen.js ROUTER_TYP_TO_KIND` (schaltplan→chain, flussdiagramm→bpmn, schnitt-ansicht→generic, diagramm→bars, tabelle→generic).

Ergebnis: **6/6 Faelle gruen**, Fail-closed-500: gruen. Unit-Vergleich: `tests-unit/router-2d.test.mjs` 11/12 (1 Fail = `src/models/*.js` fehlt im EMPTY-STAND, erwartet; siehe README-Publication-hold).

| Fall | Fachtext (Kurz) | P0-Entscheidung | Erwartet | P0 | Generierung (P1-Vertrag + Gates) | Gen | Frontend (Canvas/SVG, Labels/Masse) | Front |
|---|---|---|---|---|---|---|---|---|
| motor-3d | Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile … | 3d/baugruppe | 3d/baugruppe | gruen | S1=pass, GEO=pass | gruen | nonWhite=98, png=12 KB | gruen |
| tiefpass-schaltplan | RC-Tiefpass: Widerstand, Kondensator, Signalpfad vom… | 2d/schaltplan | 2d/schaltplan | gruen | chain, shapes=19 | gruen | nonWhite=50987, png=10 KB | gruen |
| photosynthese-fluss | Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, … | 2d/flussdiagramm | 2d/flussdiagramm | gruen | bpmn, shapes=18 | gruen | nonWhite=25906, png=12 KB | gruen |
| bohrmaschine-schnitt | Handbohrmaschine Seitenansicht: Gehaeuse, Motor, Get… | 2d/schnitt-ansicht | 2d/schnitt-ansicht | gruen | generic, shapes=14 | gruen | nonWhite=77196, png=9 KB | gruen |
| wirkungsgrad-diagramm | Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvar… | 2d/diagramm | 2d/diagramm | gruen | bars, shapes=24 | gruen | nonWhite=51451, png=10 KB | gruen |
| datenbanken-tabelle | Datenbanken-Grundbegriffe: Tabelle, Schluessel, Inde… | 2d/tabelle | 2d/tabelle | gruen | generic, shapes=14 | gruen | nonWhite=77177, png=9 KB | gruen |
| fail-closed-500 | STOERUNG-500 (HTTP 500 am Stub) | 3d/baugruppe (fallback) | 3d/baugruppe (fallback) | gruen | — (keine Generierung, Fail-closed) | — | — | — |

## Nacharbeit (Fehlrouting-Analyse)

- Luecke: `prompts/p0-router.txt` hatte nur 4 Few-shots (3D + schaltplan + flussdiagramm + diagramm); `schnitt-ansicht` und `tabelle` waren ohne Beispiel → Fehlrouting-Risiko am echten LLM. **Behoben:** 2 Few-shots ergaenzt (Seitenansicht→schnitt-ansicht, Datenbankbegriffe→tabelle), alle 6 Faelle jetzt mit Beispiel abgedeckt.
- Kollision: `schnitt-ansicht` und `tabelle` mappen beide auf Vendor-Kind `generic` (Raster aus 4 Boxen). Kein Fehlrouting im Gate-Sinn (S2-2d-typ passiert, Labels/Masse je Fall unterscheidbar), aber semantisch unscharf. shape-Pfad: kein Vendor-Umbau (Risiko), dokumentiert als bekannte Einschraenkung; Frontend-Nachweis unten zeigt je Fall eigene Labels/Masse.
- Mermaid u.a.: `ALLOW_2D_SPECIFIERS` reserviert `2d-mermaid/2d-chart/2d-d3/2d-katex`, aber ALLE 5 Fixtures nutzen `from '2d-svg'` (kein Mermaid-Import, `noMermaid=true` je Fall) — Leichtgewicht-Prinzip (0 KB) eingehalten.

## Je Fall: Nachweis

### motor-3d (3D-Canvas)

- Fachtext: „Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile im Zylinderkopf, Nockenwelle und Zahnriemen im Motorblock verbaut. Lernziel: Lage und Bewegung der Bauteile im Raum verstehen.“
- P0: `{"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."}` (fallback=false, 81 ms, promptLen=3693) — erwartet 3d/baugruppe → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): Fixture 4 Boxen + 4×addLabel + 1×addMeasurement, bytes=2104, S1=[S1-forbidden=pass, S1-size=pass, S1-imports=pass, S1-shape=pass], GEO=[S2-intersect=pass, S2-backface=pass, S2-flicker=pass, S2-orient=pass, S2-connect=pass, S2-meshcount-statisch=pass] → gruen.
- Frontend: Canvas vorhanden=true, helle Pixel=98/2304 (64×36-Probe), Labels+Mass im Overlay (“KolbenPleuelKurbelwelleZylinderkopfBreite: 40 cm”) → gruen.

![motor-3d](routing-shots/motor-3d.png)

### tiefpass-schaltplan (2D-SVG chain)

- Fachtext: „RC-Tiefpass: Widerstand, Kondensator, Signalpfad vom Eingang ueber R und C zum Ausgang, Grenzfrequenz und Phasenverschiebung im Blockschaltbild.“
- P0: `{"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, keine raeumliche Anordnung noetig."}` (fallback=false, 72 ms, promptLen=3659) — erwartet 2d/schaltplan → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): meta_2d.kind=chain (P0→Kind chain, mapOk=true), bytes=850, S2-light=[S2-2d-parse=pass, S2-2d-typ=pass, S2-2d-parse-svg=pass, S2-2d-pixel=pass, S2-2d-wellformed=pass], shapes=19, svgBytes=1931, wohlgeformt=true, labelsImSvg=true, massImSvg=true, keinMermaidImport=true → gruen.
- Frontend: SVG-Texte=[RC-Tiefpass Schaltplan | Eingang | Widerstand | Kondensator | Ausgang | Grenzfrequenz: 1,6 kHz], nicht-weisse Pixel=50987 (640×360-Raster), PNG=10580 B → gruen.

![tiefpass-schaltplan](routing-shots/tiefpass-schaltplan.png)

### photosynthese-fluss (2D-SVG bpmn)

- Fachtext: „Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, Entscheidungspunkte bei Wassermangel in der Pflanze — Reihenfolge und Verzweigung ohne Raumbezug.“
- P0: `{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}` (fallback=false, 16 ms, promptLen=3664) — erwartet 2d/flussdiagramm → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): meta_2d.kind=bpmn (P0→Kind bpmn, mapOk=true), bytes=863, S2-light=[S2-2d-parse=pass, S2-2d-typ=pass, S2-2d-parse-svg=pass, S2-2d-pixel=pass, S2-2d-wellformed=pass], shapes=18, svgBytes=2007, wohlgeformt=true, labelsImSvg=true, massImSvg=true, keinMermaidImport=true → gruen.
- Frontend: SVG-Texte=[Photosynthese Ablauf | Start | Lichtreaktion | Wassermangel? | Calvin-Zyklus | Dauer: 6 h], nicht-weisse Pixel=25906 (640×360-Raster), PNG=12743 B → gruen.

![photosynthese-fluss](routing-shots/photosynthese-fluss.png)

### bohrmaschine-schnitt (2D-SVG generic)

- Fachtext: „Handbohrmaschine Seitenansicht: Gehaeuse, Motor, Getriebe, Bohrfutter in einer Schnittebene, nur 1 Ansicht ohne Orbit — kein raeumlicher Mehrwert.“
- P0: `{"mode":"2d","typ":"schnitt-ansicht","begruendung":"Eine Ansicht genuegt, Aufbau in einer Ebene, kein Orbit-Mehrwert."}` (fallback=false, 16 ms, promptLen=3661) — erwartet 2d/schnitt-ansicht → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): meta_2d.kind=generic (P0→Kind generic, mapOk=true), bytes=838, S2-light=[S2-2d-parse=pass, S2-2d-typ=pass, S2-2d-parse-svg=pass, S2-2d-pixel=pass, S2-2d-wellformed=pass], shapes=14, svgBytes=1563, wohlgeformt=true, labelsImSvg=true, massImSvg=true, keinMermaidImport=true → gruen.
- Frontend: SVG-Texte=[Handbohrmaschine Schnitt | Gehaeuse | Motor | Getriebe | Bohrfutter | Laenge: 20 cm], nicht-weisse Pixel=77196 (640×360-Raster), PNG=9243 B → gruen.

![bohrmaschine-schnitt](routing-shots/bohrmaschine-schnitt.png)

### wirkungsgrad-diagramm (2D-SVG bars)

- Fachtext: „Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvarianten im Vergleich auf Achsen mit Fehlerbalken und Kennlinien.“
- P0: `{"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}` (fallback=false, 16 ms, promptLen=3630) — erwartet 2d/diagramm → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): meta_2d.kind=bars (P0→Kind bars, mapOk=true), bytes=888, S2-light=[S2-2d-parse=pass, S2-2d-typ=pass, S2-2d-parse-svg=pass, S2-2d-pixel=pass, S2-2d-wellformed=pass], shapes=24, svgBytes=2375, wohlgeformt=true, labelsImSvg=true, massImSvg=true, keinMermaidImport=true → gruen.
- Frontend: SVG-Texte=[Wirkungsgrad Vergleich | 82 | Variante A | 91 | Variante B | 76 | Variante C | 88 | Variante D | Drehzahl: 3000 1/min], nicht-weisse Pixel=51451 (640×360-Raster), PNG=9779 B → gruen.

![wirkungsgrad-diagramm](routing-shots/wirkungsgrad-diagramm.png)

### datenbanken-tabelle (2D-SVG generic)

- Fachtext: „Datenbanken-Grundbegriffe: Tabelle, Schluessel, Index, Transaktion als Definitionen und Abgrenzung ohne Bauteile — reine Taxonomie.“
- P0: `{"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Taxonomie ohne Lage, Struktur statt Raumbezug."}` (fallback=false, 15 ms, promptLen=3646) — erwartet 2d/tabelle → gruen.
- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): meta_2d.kind=generic (P0→Kind generic, mapOk=true), bytes=835, S2-light=[S2-2d-parse=pass, S2-2d-typ=pass, S2-2d-parse-svg=pass, S2-2d-pixel=pass, S2-2d-wellformed=pass], shapes=14, svgBytes=1568, wohlgeformt=true, labelsImSvg=true, massImSvg=true, keinMermaidImport=true → gruen.
- Frontend: SVG-Texte=[Datenbanken Begriffe | Tabelle | Schluessel | Index | Transaktion | Umfang: 4 Begriffe], nicht-weisse Pixel=77177 (640×360-Raster), PNG=9283 B → gruen.

![datenbanken-tabelle](routing-shots/datenbanken-tabelle.png)

## Reproduktion

```sh
node scripts/router-2d-log.mjs   # P0-Stub-Pfad (5 klassifiziert + 1 Fail-closed)
node scripts/routing-tests.mjs   # dieser Bericht (6 Faelle + Screenshots + Gates)
node --test tests-unit/router-2d.test.mjs tests-unit/livegen.test.mjs
```

Live-Generierung (Baseten-Direkt, BYOK) bleibt ausstehend bis Key-Freigabe; Anleitung ohne Key-Abdruck: Key per UI-Checkbox (SessionStorage) oder `setLiveApiKey` nur im Speicher, nie in Code/Logs/Dateien. Dieser Bericht nutzt bewusst synthetische P1-Fixtures als Generierungs-Stand-in (ehrlich markiert, kein LLM-Output als echt ausgegeben).
