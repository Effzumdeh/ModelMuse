# Realgebäude-Machbarkeit: LLM-3D-Code aus Maßbeschreibung

**Stand:** 29.10.2026 · **Repo:** `C:/Users/flori/OneDrive/modelMuse` (Standalone v13) · **Setup:** three.js r186 Single-File, Harness P0→P1→Verify, Baseten `meta-models/muse-spark-open-1026`
**Frage:** Ist eine realistische 3D-Kopie eines bekannten Gebäudes aus exakter Architekturbeschreibung (alle Maße) machbar? [unverified] Auftragsfrage des Nutzers

## 0. Kurzantwort

**Ja — als didaktisches Maßstabsmodell. Nein — als metrisch maßgetreuer Nachbau.** [unverified] Synthese aus Abschnitt 1–5
Machbar, wenn (a) das Modell ein **Maßstabsmodell mit echten Bemassungen als Beschriftung** ist, kein 1:1-Nachbau, und (b) das Gebäude urheberrechtlich **frei** ist (Schutzfrist abgelaufen) oder aus offenen Daten stammt. [8][18][24] Ein 1:1-Nachbau eines geschützten Bauwerks ist nach § 59 Abs. 1 S. 1, 2 UrhG **nicht** von der Panoramafreiheit gedeckt — der BGH hat das explizit entschieden.[8][20]

## 1. Was LLM-3D-Code aus Maßbeschreibung leisten kann

| Fähigkeit | Beleg |
|---|---|
| Maßhaltige Geometrie aus **Code-Prompt** (besser als Bild) | L-Bracket-Studie: code-level prompts = perfekte Rekonstruktion über alle Metriken; 3-View-Zeichnungen schlechtesten ab[12] |
| Aus **Text** Semantik stark, Geometrie nur mäßig | P3D-Bench: J-Sem ≈ 0.7 vs. J-Geo ≈ 0.5; Assembly-3D J-Geo 0.43 bei J-Sem 0.64[10] |
| Iterative Verifikation verbessert Geometrie messbar | CADCodeVerify: −7,30 % Point-Cloud-Distanz, +5,5 % Compile-Rate[11] |
| BIM-Code strukturell valide, semantisch lückenhaft | Text2BIM: Pass-Raten > 0,95, aber fehlende Bauteile, unlogische Tür-/Fensterlagen, Halluzinationen[13]; IFC-Paper: Geometrie/Öffnungen/Raumbezug bleiben unzuverlässig[14] |
| Aus **Bild** nur Grundform, keine Maßhaltigkeit | Generative-AI-meets-CAD: "lacks dimensional accuracy", "struggles with precise scaling … without explicit dimensional data"[21] |

**Kernaussage: Maße sind die Schwachstelle, nicht die Form.** Für Gebäude verschärft sich das, weil Fehler sich kumulieren (12 Instanzen × n Fehlerstellen).[10][13]

### 1.1 Grenze vs. CAD und Photogrammetrie

| Verfahren | Maßstab | Kann | Kann nicht |
|---|---|---|---|
| **LLM-Three.js-Code** | Bauteilmaßstab (1–2 m) | Schnitt, Öffnungen, Lage, Benennung, Bemaßung | absolute Gebäudemetrik, Anschlussgenauigkeit |
| **CAD/BIM** | 1:1, parametrisch | exakte Maße, Raster, Schnitte, prüfbare Toleranzen | braucht Fachplanung, hours–days |
| **Photogrammetrie/Scan** | 1:1, real ~4–7 cm | maßhaltige Oberfläche, Bestand | keine Semantik, keine Bauteilnamen, teuer |

Belegte Aufmaß-Genauigkeiten: Photogrammetrie + Laserscanning **1–2 cm** für historische Gebäude[15]; aktueller Vergleichstest Photogrammetrie Ø **7,3 cm** vs. Laserscanning Ø **4,4 cm**[16]. Ein LLM-Modul hat **keine** absolute Genauigkeitsaussage — seine Korrektheit ist *relativ*: stimmt das Bauteilmaß mit der Vorgabe überein? [15][16]

**LLM-Code ersetzt weder CAD noch Photogrammetrie, sondern ist deren Eingangsformat-Frontend für didaktische Zwecke.** [unverified] Synthese

## 2. Was es dafür braucht

**2.1 Strukturierte Maße (Pflicht).** Bauteilliste je Bauteil: ID, Maß (L×B×H in m), Position rel. Ursprung, Materialklasse; Raster/Ebenen (Geschosshöhe, Achsabstand), Öffnungsmaße; **Soll-Maße für die `addMeasurement`-Bemaßung** — diese Zahlen sind die eigentliche didaktische Aussage. [unverified] Projektquelle `prompts/p1-generate.txt` Der P1-Prompt fordert das bereits („Bauteilliste mit exakten Massen in Metern", `prompts/p1-generate.txt`). [unverified] Projektquelle `prompts/p1-generate.txt` **Offene Lücke:** S1–S5 prüfen Codeform, Verbote, Budgets und Didaktik, **nicht die Maßhaltigkeit** — `src/runtime/didactics.js` prüft Manifestform und Aufgaben-IDs, nicht den Zahlenwert einer Messung. [unverified] Projektquellen `src/runtime/didactics.js`, `src/runtime/verify.js`

**2.2 Fotos und Skizzen (optional, hilfreich).** Fotos helfen bei Proportion und Material, **nicht** beim Maß — die Skalierung bleibt dem Modell überlassen, mit dokumentierter Fehlerneigung[21]. Skizzen (Grundriss/Schnitt) sind besser als Fotos für Lagebeziehungen: im L-Bracket-Test schnitt die 3-View-Zeichnung am schlechtesten ab, der Code-Prompt am besten[12]. Praxis: 1 Grundriss-Skizze + 2–4 Fassadenfotos + Maßliste.[12][21]

**2.3 Iterationen.** Der Harness hat bereits die richtige Form: **max. 2 automatische Reparaturrunden + 1 manuelle Reserve**, Stop-Bedingungen Erfolg/Stagnation/Regression (`docs/implementation-guide-3d-qualitaet.md` § 5) [unverified] Projektquelle `docs/implementation-guide-3d-qualitaet.md` § 5. Für Gebäude fehlt zusätzlich **messtechnische** Rückmeldung — genau die Lücke, die 3JSBench als entscheidend ausweist.[1]

## 3. Benchmarks

| Benchmark | Misst | Relevanz |
|---|---|---|
| **3JSBench** | deterministische Geometrie-Korrektheit, 697 Checks, 3 One-Shots/Task | **hoch** — Fehlermodi sind unsere: Intersecting 288/904, Disconnected 265/1.145, See-through 234/1.418, Flickering 217/1.477[1] |
| **threejseval** | menschliche Ästhetik-Präferenz (Blind-Votes, Elo) | mittel — misst Schönheit, nicht Maßtreue; Prompt-Set betont Komposition, nicht Interaktion[2] |
| **P3D-Bench** | parametrische Geometrie + Teile-Struktur | **hoch** — direkteste Entsprechung (Text/Image/Assembly → Three.js/CadQuery)[10] |

**Muse Spark 1.3 (Quellenstand):** 3JSBench **7,3 % ± 2,9** Passrate (22/300), Platz 11/13; Median 995 Meshes, 33 % Flackern[1] (unser Repo-Dokument nennt 10,7 % per 27.10. — Live-Board-Drift). threejseval **1435 ± 81 Elo**, bestes **Elo-pro-Dollar** ($0,002/Eval)[3]; Betreiber-Vorbehalt: „Vote volume is still early", „Small Elo differences … may not be meaningful"[2]. 3JSBench-Spitze: Astra 78,7 % ± 4,6 (236/300), Fable 5.1 68,3 %[1].

**Lesart:** Ein Architekturmodell ist deutlich **schwieriger** als die 3JSBench-Tasks (ein Objekt, ~10 Bauteile). Mit 7,3 % Passrate auf Objects ist ein Gebäude-Modul ohne Repair-Loop unrealistisch. Astra-Niveau (45 Meshes, hohe Passrate) ist die realistische Zielmarke, nicht der Median.[1][10]

## 4. Rechtliches (Hackathon-Demo, DE)

**4.1 Kernpunkt: § 59 deckt keinen 3D-Nachbau.** § 59 Abs. 1 S. 1, 2 UrhG erlaubt Vervielfältigung „mit Mitteln der Malerei oder Graphik, durch Lichtbild oder durch Film" — bei Bauwerken **nur die äußere Ansicht**; Abs. 2: keine Vervielfältigung *an* einem Bauwerk.[4][5]

Der BGH (I ZR 242/15, „East Side Gallery", 19.01.2017) ist eindeutig: „Eine Vervielfältigung des Werkes in dreidimensionaler Form ist danach auch dann nicht zulässig, wenn das Werk als verkleinertes Modell oder aus anderen Materialien nachgebildet wird" — und der „Bau und Vertrieb des Spielzeugmodells eines urheberrechtlich geschützten Bauwerks oder Denkmals innerhalb der Schutzfrist" ist „nur mit Zustimmung des Rechtsinhabers erlaubt".[8]

Klarstellung: „Unzulässig ist der (dreidimensionale) Nachbau eines Werkes der Architektur, und zwar unabhängig davon, ob sich das Bauwerk an einem öffentlichen Ort befindet."[20] § 23 Abs. 2 Nr. 3 UrhG nennt den „Nachbau eines Werkes der Baukunst" sogar explizit als zustimmungspflichtige Bearbeitung.[6]

**→ Ein 3D-Modell eines geschützten Gebäudes ist keine Panoramafreiheit-Nutzung.**

**4.2 Wann unkritisch?**

| Prüfpunkt | Regel | Beleg |
|---|---|---|
| **Schutzfähigkeit** | Bauwerk nur bei „persönlicher geistiger Schöpfung"; übliche/gängige Planungslösungen sind **nicht** schutzfähig (BGH I ZR 166/05). Schätzung: allenfalls 10 % der architektonischen Planungsleistungen | [5][17] |
| **Schutzfrist** | 70 Jahre nach Tod des Urhebers (§ 64) | [7] |
| **Praktikum** | Mies van der Rohe (d. 1969) → Freischwinger bis **2039** geschützt; vor 1956 verstorbene Architekten → i. d. R. frei | [24] |
| **Panoramafreiheit** | gilt für Foto/Film, **nicht** für 3D-Nachbau | [8][20] |
| **Drohnenaufnahmen** | BGH I ZR 67/23 (23.10.2024): Luftaufnahmen per Drohne unterfallen **nicht** der Panoramafreiheit | [9] |
| **Quellenangabe** | § 63 UrhG: bei Vervielfältigung nach § 59 ist die Quelle stets deutlich anzugeben | [23] |
| **Zugangsrecht** | § 25 UrhG: der Urheber kann Zugang zum Bauwerk verlangen | [25] |
| **Innenraum/Gestalt** | § 59 erfasst nur die äußere Ansicht; Innenräume, Personen, Kennzeichen brauchen separate Zustimmung | [22] |

**4.3 Rechtssichere Alternativen (Reihenfolge).** [unverified] Reihenfolge ist abgeleitete Empfehlung.

**(1) Offene Geodaten statt Nachbau.** Berlins 3D-Gebäudemodelle LoD 1/LoD 2 stehen unter **Datenlizenz Deutschland – Zero 2.0** (keine Bedingungen); das 3D-Stadtmodell von Berlin Partner verlangt Namensnennung („Text für Namensnennung: Berlin Partner für Wirtschaft und Technologie GmbH").[18][26] → Geometrie aus der Lizenzquelle, das LLM erzeugt nur die **didaktische Interpretation**.

**(2) Bauwerk mit abgelaufener Schutzfrist.** Architekt verstorben vor 1956, plus Außenansicht und Quellenangabe.[7][24]

**(3) Fiktives Gebäude** oder frei lizenziertes Referenzmodell — rechtlich trivial, didaktisch identisch. [unverified] abgeleitete Empfehlung

**Vermeiden:** Nachbau eines geschützten Bauwerks; Drohnenaufnahmen; Fotos Dritter ohne Lizenz; Nennung von Adresse/Bauherrn des Originals.[22][9]

> **Hinweis:** Technische Rechtsrecherche, keine Rechtsberatung. Für eine veröffentlichte Demo ist eine anwaltliche Prüfung sinnvoll.

## 5. Empfehlung für ModelMuse

**5.1 Strategie: Maßstabsmodell + echte Bemassung (kein 1:1-Nachbau).** Empirischer Beleg aus dem Repo: `src/models/arch-brandenburger-tor.js` (Brandenburger Tor, Berlin) modelliert das Tor als **1:50-Maßstabsmodell** — 1,25 Einheiten Modellbreite bei deklarierten 62,5 m Realmaß, Label-Spanne 1,30 m [unverified] eigene Harness-Messung, Projektquelle `src/models/arch-brandenburger-tor.js`. `GEO_LIMITS.extentMaxM = 1,50 m` (`src/runtime/geometry-checks.js`) erzwingt diesen Maßstab strukturell; das reale Maß steht als Text in der Bemassung [unverified] Projektquelle `src/runtime/geometry-checks.js`. Didaktisch ist das **richtig**: der Lernende liest „62,5 m" ab, statt eine maßhaltige Geometrie nachmessen zu müssen. [unverified] abgeleitete didaktische Bewertung

**Das Vorhaben ist damit kein 1:1-Projekt, sondern ein Maßstabs-Referenzmodell.** [unverified] Synthese

**5.2 Konkrete Schritte.**
1. **Objektwahl nach Rechtsfilter.** Erst Objekt-/Urheberscreening (Schutzfähigkeit § 2, Schutzfrist § 64), dann Geometrie. Bei geschütztem Bauwerk: **nicht** nachbauen.[5][7]
2. **Geometrie aus offenen Daten, nicht aus dem Prompt** (LoD 2 Berlin, dl-de-zero-2.0) — entkoppelt Maßtreue von Modellqualität und ist rechtlich sauber.[18][26]
3. **Maßliste als Single Source of Truth.** Eine JSON-Bauteilliste (Maße in m, Lage, Öffnungen) füttert (a) P1-Prompt, (b) `addMeasurement`-Endpunkte, (c) Manifest. Modell und Beschriftung können nicht auseinanderlaufen. [unverified] abgeleitete Empfehlung
4. **Neue Verifikationsschicht S6 „Maßhaltung".** Heute: S1 Codeform/Verbote, S2 Geometrie-Defekte, S4 Budgets, S5 Didaktik. **Maßtreue wird derzeit nicht geprüft.** S6 prüft jede Solllänge gegen die modellierte Bounding-Box der Baugruppe (Toleranz ±1 % Bauteillänge, Mindestabstand analog S2-intersect 2,0 mm) [unverified] Projektquelle `src/runtime/verify.js`.
5. **Instancing-Pflicht für Wiederholteile.** Das Brandenburger Muster nutzt 12 Säulen als **1** InstancedMesh → 6 Meshes statisch. Bei Fassadenrastern ist das der einzige Weg unter das Mesh-Budget. [unverified] eigene Harness-Messung, Projektquelle `src/models/arch-brandenburger-tor.js`
6. **Budget: Geometrie reichlich, Bytes sind der Engpass.** Statisch gemessen am Brandenburger Muster: **~378 Dreiecke** (Budget 150.000 → ~397× Headroom), **6 Meshes** (Budget 250), aber **9.630 von 34.000 Bytes** (~3,5× Headroom) [unverified] eigene Messung, Projektquellen `src/runtime/budget.js`, `src/models/arch-brandenburger-tor.js`. **Die Byte-Grenze, nicht die Geometrie, limitiert Detailtiefe** → kompakter Generator (Datenmodell + generische Bauteilfunktion).
7. **Repair-Loop aktivieren und messen.** Die 3JSBench-Fehlermodi (Intersecting, Disconnected, See-through, Flickering) sind genau die Defekte eines Gebäude-Moduls und von S2 statisch nur heuristisch sichtbar.[1] Nach jedem Reparaturlauf S1–S6 erneut; Stop bei Stagnation, Rollback bei Regression. [unverified] Projektquelle `docs/implementation-guide-3d-qualitaet.md` § 5
8. **Regressions-Set erweitern.** `eval/3jsbench/` enthält 100 fremde Briefs (MIT) für Geometrie-Regression (`scripts/regression-3jsbench.mjs`, Kosten-Schranke 3 Calls) [unverified] Projektquelle `scripts/regression-3jsbench.mjs`. **Eigenes Set ergänzen:** 3–5 Realgebäude-Briefs mit Maßliste durch dieselben Maßtreue-Checks — sonst messen wir nur Objekt- statt Gebäudequalität. [unverified] abgeleitete Empfehlung

**5.3 Risiken.**

| Risiko | Bewertung | Gegenmaßnahme |
|---|---|---|
| Rechtlicher Fehlgriff (geschütztes Bauwerk) | **hohe** Folgen, vermeidbar | Objektscreening vorab; LoD-2-Open-Data statt Nachbau |
| Maßtreue ungeprüft | **hohe** (didaktische Kernleistung) | S6-Maßhaltung als Gate; Messwerte in Manifest + Code |
| Modell-Maßstab ≠ Realmaß → Verwechslung | mittel | Maßstab im Manifest explizit („1:50-Modell, Bemassung in Realmaß") |
| 34.000-Byte-Grenze | mittel | kompakter Generator, Detailtiefe über Bauteilanzahl statt Codesize |
| Muse Spark 1.3 Geometrie-Qualität | mittel | Instancing, Repair-Loop, Notfall: handgeschriebenes Referenzmodell |
| Byte-Drift → Modul-Boot-Fail | niedrig | Größen-Gate existiert bereits (S1-size) |

## 6. Belastbarkeitsgrenzen dieser Recherche
- **Kein Benchmark misst „Realgebäude".** 3JSBench-Tasks sind Objekte (~10 Bauteile); die Extrapolation auf Gebäude ist meine Ableitung, nicht gemessen.[1][10] P3D-Bench ist geometrisch nächstliegend, ohne veröffentlichtes Gebäudetask-Subset.[10]
- **Rechtsstand 29.10.2026**, deutsche Rechtsprechung; US/EU abweichend — nicht geprüft. [unverified]
- **Keine unabhängige Messung**, wie oft ein LLM-Modul ein vorgegebenes Bauteilmaß korrekt umsetzt. Die S6-Empfehlung schließt genau diese Lücke; ohne sie bleibt „Maße stimmen" unbelegt. [unverified]
- threejseval-Werte sind Live-Board-Werte mit expliziten Betreiber-Vorbehalten.[2][3]
- Der Beleg zum Brandenburger Tor stammt aus laufender Parallel-Arbeit im Repo (Stand 29.10.2026); S1/S2 statisch grün, Browser-Probe steht aus. [unverified]
## Sources

[1] https://generalcontextlabs.com/research/threejs
[2] https://threejseval.com/methodology
[3] https://threejseval.com/best-llm-for-threejs
[4] https://www.gesetze-im-internet.de/urhg/__59.html
[5] https://www.gesetze-im-internet.de/urhg/__2.html
[6] https://www.gesetze-im-internet.de/urhg/__23.html
[7] https://www.gesetze-im-internet.de/urhg/__64.html
[8] https://www.bundesgerichtshof.de/SharedDocs/Entscheidungen/DE/Zivilsenate/I_ZS/2015/I_ZR_242-15.pdf
[9] https://www.bundesgerichtshof.de/SharedDocs/Entscheidungen/DE/Zivilsenate/I_ZS/2023/I_ZR__67-23.pdf
[10] https://arxiv.org/html/2606.11152v3
[11] https://arxiv.org/html/2410.05340v2
[12] https://arxiv.org/html/2509.07010v1
[13] https://arxiv.org/html/2408.08054v2
[14] https://arxiv.org/html/2511.05533v1
[15] https://www.hcu-hamburg.de/fileadmin/documents/Geomatik/Labor_Photo/publik/kersten_dgpf2006.pdf
[16] https://www.itcon.org/papers/2026_48-ITcon-Nascimento.pdf
[17] https://www.aknw.de/berufspraxis/beratungsportal/faq-urheberrecht
[18] https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf
[20] https://de.wikipedia.org/wiki/Panoramafreiheit
[21] https://link.springer.com/article/10.1007/s00170-025-15830-2
[22] https://www.akbw.de/fileadmin/download/dokumenten_datenbank/AKBW_Merkblaetter/Architekturbuero_Bueroberatung-Buerobetrieb/Merkblatt285_Urheberrecht.pdf
[23] https://www.gesetze-im-internet.de/urhg/__63.html
[24] https://www.dpma.de/service/presse/pressemitteilungen/07022024/index.html
[25] https://www.gesetze-im-internet.de/urhg/__25.html
[26] https://daten.berlin.de/datensaetze/3d-meshmodell-berlin

