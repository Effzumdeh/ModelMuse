# Qualität KI-generierter Three.js-3D-Modelle maximieren

**Recherchebriefing für SkillSpark** · Stand: 27.10.2026 · Abrufdatum aller Web-Quellen: 27.10.2026.[20][34][Projektquelle: `C:/Users/flori/OneDrive/skillSpark/docs/ki-modellqualitaet-recherche.md`]
**Untersuchtes Setup:** Three.js r186, Single-File-ESM (Budget 34 KB Modul, 150 k Dreiecke, 400 Draw-Calls, Schul-iGPUs), P1-Generierungsprompt / P2-Reparaturschleife (max. 3 Iterationen), Verify-Loop S1–S5, Modell `muse-spark-1.3-contributor` über `muse.exe`.[Projektquelle: `prompts/p1-generate.v5-budget400.txt`, `prompts/p2-repair.txt`, `src/runtime/verify.js`, `src/runtime/budget.js`, `scripts/_gen-one.mjs`]

> **Methodik:** Alle Aussagen sind mit Quell-URL und Datum belegt.[Projektquelle: Ledger `cache/citations/ledger.json`] Nicht belegbare Aussagen sind explizit als **[unbelegt]** markiert.
> Aussagen über das *eigene* Projekt stammen aus dem lokalen Repository (`C:/Users/flori/OneDrive/skillSpark`), nicht aus Web-Quellen, und sind als solche gekennzeichnet.[Projektquelle: `C:/Users/flori/OneDrive/skillSpark`]
> Es wurden keine Generierungsaufrufe ausgeführt und keine Keys verwendet.[Projektquelle: `scripts/_gen-one.mjs`]

---

## 0. Kurzfassung für Entscheider

| Frage | Urteil | Kernaussage |
|---|---|---|
| Existiert „GPT-6 Astra"? | **Ja, belegt** | OpenAI, 3.9.2026, API-ID `gpt-6-astra`.[1] |
| Ist Astra „im Benchmark am leistungsfähigsten"? | **Teilweise belegt, pauschal widerlegt** | Astra führt die **deterministische Geometrie-Passrate** in 3JSBench (80,0 %) und die Prompt-Ähnlichkeit (+0,011).[20] Aber: bei **menschlicher Präferenz** führt Opus 5.5 (Elo 1083 vs. 1073),[20] in **threejseval** führt Opus 5.5 High (2064 vs. Astra Medium 1882),[21] in **AA-3D** führen Sonnet 5.5 (1199) und Opus 5.5 (1196) vor Astra (1164),[39] und in **WorldBench** führt Claude Fable 5.1 (210,79 vs. 199,73).[7] „Benchmark" ist damit die entscheidende Unbekannte. |
| Hilft „Prompt Engineering kitzelt Qualität heraus"? | **Ja, aber nicht beliebig** | Die Evidenz stützt **Ausführungsfeedback mit Messwerten** am stärksten (exec-refine +3,4 bis +38,8 Pass@1; FLARE 54,86 % vs. 50,27 %).[15][17] Sie **widerlegt** aber die naive Form „mehr Constraints = mehr Qualität": System-Prompt-Spezifität wirkt **nicht monoton**,[12] und bei großen Code-Modellen können Few-Shots die Leistung sogar **verschlechtern**.[12] |
| Ist unser Modell in 3D gut? | **Nein, belegt** | `Muse Spark 1.3` liegt in 3JSBench bei **10,7 % Passrate** (Platz 11 von 13),[20] in threejseval auf **Platz 23 von 39** (Elo 1435)[21] und in AA-3D auf **Platz 9 von 23** (Elo 1033).[39] 3JSBench nennt unseren spezifischen Fehlermodus: **995 Meshes und 177 000 Dreiecke im Median** (Astra: 45 Meshes) und **33 % der Versuche flackern**.[20] |
| Sind Text-to-3D-Meshes eine Alternative? | **Nein, für dieses Setup** | Hunyuan3D 3.1 liefert 40 k–1,5 Mio. Faces,[25] typisch 20 k–300 k Dreiecke/Asset.[24] Das überschreitet das 34-KB-Inline-Budget um Größenordnungen; eingebettete GLBs lagen in Messungen bei 0,5–19,8 MB.[24][unbelegt für exakte Inline-Größen] Code-Gen behält den Vorteil von Parametrik, Bauteilliste und editierbarer Semantik. |

**Die wichtigste Erkenntnis:** Die **sechs** 3D-spezifischen Benchmarks messen **unterschiedliche Fähigkeiten** — geometrische Korrektheit (3JSBench), menschliche Ästhetik (threejseval, 3JSBench-Preference, benchmark.ai), agentisches 3D-Erlebnis (AA-3D) und Verhaltens-/Physikkorrektheit (WorldBench).[20][21]
Die Ranglisten **widersprechen einander**: Astra #1 in 3JSBench (Passrate) und benchmark.ai, Opus 5.5 #1 bei der 3JSBench-Human-Preference, Sonnet 5.5 #1 in AA-3D.[20][21][39]
In WorldBench und beim generischen LLM-to-3D-Code-Leaderboard liegen Fable 5.1 bzw. Gemini 4 Argon vorn.[7][8]
Für SkillSpark heißt das: Es gibt **kein** „bestes Modell" — es gibt nur Modelle, die **verschiedene Achsen** abdecken.[20][21]
Die eigene Verify-Schleife muss entscheiden, welche Achse zählt.

---

## 1. These 1: „GPT-6 Astra sei im Benchmark am leistungsfähigsten"

### 1.1 Das Modell existiert — belegt

GPT-6 Astra wurde am **3.9.2026** von OpenAI eingeführt und ist über die API als `gpt-6-astra` sowie über Azure und AWS Bedrock verfügbar.[1][4]
Das OpenAI-Modellkatalog-Listenblatt weist die GPT-6-Familie als Produktlinie aus und kennzeichnet die Vorgängergenerationen (GPT-5, GPT-5.1, GPT-5.1-Codex) als abgeschaltet — der Frontier-Code-Benchmark hat also inzwischen eine neue Führungsgruppe.[5]
API-Standardpreis: **10 USD / Mio. Input-Token, 50 USD / Mio. Output-Token**; Fast Mode liefert bis zu 2× Geschwindigkeit zum doppelten Preis.[1]

Die OpenAI-Seite nennt für Astra u. a. FrontierMath Tier 4 bei 98 %, ARC-AGI-3 bei 99,9 % und ExploitBench bei 100 %.[1] General Context Labs hat 3JSBench am 5.10.2026 zeitgleich mit seiner Forschungsseite angekündigt.[6] Das sind **Selbstauskünfte des Herstellers** zu mathematischen und Cybersecurity-Benchmarks — **nicht** zu 3D-Codegenierung. OpenAI selbst führt keinen einzigen 3D-Code-Benchmark in seiner Astra-Ankündigung.[1]

Die GPT-6-Familie umfasst per 27.10.2026: Astra (3.9.2026), Sol und Luna (22.9.2026), GPT-6.1 Sol (29.9.2026), GPT-6.1 Terra (26.10.2026); GPT-6 mit Intelligent UI ist seit 7.10.2026 in ChatGPT.[2][3][4]
Zum Vergleich: Metas Muse Spark 1.3 erschien am 2.9.2026 und ist laut Meta „trained for agentic workflows and optimized for competitive coding performance".[11]

### 1.2 Die entscheidende Präzisierung: „der Benchmark" gibt es nicht

Es existieren **mindestens sechs** einschlägige Benchmarks, und sie kommen zu **widersprüchlichen** Ergebnissen.[20][21][39]
Die Formulierung der These ist damit **nicht prüfbar, ohne den Benchmark zu benennen** — das ist die eigentliche Erkenntnis aus These 1.[20][21][39]
Weitere 3D-Code-Benchmarks existieren (Scene3D-Bench mit State-Probe über `window.__3D_STATE__` und Mutationstest-Kalibrierung, WorldCoder-Bench mit 205 Tasks), sind aber noch nicht mit einem vollständigen Leaderboard publiziert.[33]

#### Benchmark A — 3JSBench (deterministische Geometrie-Korrektheit)

**Methode:** 100 schriftliche Briefings (Objekte und kleine Szenen), je 3 One-Shot-Versuche pro Modell, 696 erforderliche Checks in sechs Familien (Bauteilanzahlen, Struktur, räumliche Beziehungen, aufgabenspezifische Geometrie, sichtbarer Text, Renderqualität).[20] Die Szene läuft in einem isolierten Headless-Browser, es werden **neun feste Ansichten** gerendert, und die Prüfungen messen **deterministisch** auf der erfassten Three.js-Szene.[20] Eine Mapper-Modellkomponente ordnet nur die im Task genannten Bauteile den Szenen-Meshes zu — **das Urteil selbst trifft kein Modell.** Ein Versuch besteht nur, wenn **alle** erforderlichen Checks bestehen.[20]

**Ergebnis (Leaderboard, abgerufen 27.10.2026):** [20]

| Modell | Passrate | Passes | Tasks gelöst (pass@3) |
|---|---|---|---|
| **GPT-6 Astra [high]** | **80,0 % ± 4,5** | 240/300 | 96/100 |
| Claude Fable 5.1 [high] | 69,3 % ± 5,2 | 208/300 | 92/100 |
| Claude Opus 5.5 [high] | 49,0 % ± 5,7 | 147/300 | 75/100 |
| GPT-6 Sol [high] | 27,0 % ± 5,0 | 81/300 | 50/100 |
| Kimi K3 [high] | 23,0 % ± 4,8 | 69/300 | 49/100 |
| Grok 4.7 [high] | 22,0 % ± 4,7 | 66/300 | 44/100 |
| Muse Wonder [high] | 18,7 % ± 4,4 | 56/300 | 39/100 |
| HY4 Preview [high] | 18,0 % ± 4,3 | 54/300 | 41/100 |
| Grok 4.6 [high] | 13,7 % ± 3,9 | 41/300 | 36/300→36/100 |
| Gemini 4 Argon [high] | 11,0 % ± 3,5 | 33/300 | 27/100 |
| **Muse Spark 1.3 [high]** | **10,7 % ± 3,5** | 32/300 | 23/100 |
| Gemini 3.8 Flash [high] | 8,7 % ± 3,2 | 26/300 | 21/100 |
| Inkling [high] | 2,0 % ± 1,6 | 6/300 | 6/100 |

Quelle: 3jsbench.com, abgerufen 27.10.2026.[20]

**Prompt-Similarity (SigLIP2-Kosinus, Deskriptiv, nicht bewertungsrelevant):** Astra +0,011 · Opus 5.5 +0,009 · GPT-6 Sol +0,007 · **Muse Spark 1.3 −0,007** (schlechtester Nicht-Inkling-Wert).[20]

**→ Astra führt bei deterministischer Geometrie-Korrektheit.[20] Das stützt die These für diesen einen Benchmark.**

#### Benchmark B — 3JSBench-Human-Preference (Blind-Voting der Instaplay-Creators)

Gleiche Benchmark-Daten, andere Frage: Wie *sieht* das Ergebnis aus?[20]
11 816 Stimmen von 1 284 Creators, Modellnamen verborgen, Seiten randomisiert, Bradley-Terry-Fit auf Elo-Skala.[20]

| Rang | Modell | Elo |
|---|---|---|
| 1 | Claude Opus 5.5 | 1083 ± 13 |
| 2 | **GPT-6 Astra** | 1073 ± 15 |
| 3 | GPT-6 Sol | 1061 ± 12 |
| 4 | Grok 4.7 | 1038 ± 13 |
| 5 | Gemini 3.8 Flash | 1034 ± 14 |
| 6 | **Muse Spark 1.3** | 1004 ± 13 |
| 7 | Kimi K3 | 992 ± 13 |
| 8 | Claude Fable 5.1 | 961 ± 14 |

Quelle: 3jsbench.com, abgerufen 27.10.2026.[20]

**→ Hier führt Opus 5.5, nicht Astra.** Der Abstand 1083 vs. 1073 liegt innerhalb der Fehlerintervalle, ist also **nicht signifikant** — aber die Rangfolge ist eindeutig nicht-astra.[20] Die drei.js-Moderation bestätigt diese Diskrepanz ausdrücklich: „most people prefer Opus 5.5's generations the most while Astra passes in correctness most often".[32]

#### Benchmark C — threejseval (Blind-Human-Votes, 16 Szenen-Prompts)

Methode: 16 feste Three.js-Szenen-Prompts, blinde Paarvergleiche (Left/Right/Tie/Both-bad), order-unabhängiger Bradley-Terry-Fit je Prompt auf Elo (Basis 1500, Skala 400), Gesamt-Elo = Mittel über Prompts mit ≥ 98 gültigen Stimmen.[20] Ranking vom 27.10.2026, 27 030 Stimmen, 39 Modelle.[21][22]

| Rang | Modell | Elo | Kosten/Eval |
|---|---|---|---|
| 1 | Claude Opus 5.5 High | 2064 ± 105 | 2,67 $ |
| 2 | GPT-6.1 Sol High | 1977 ± 152 | 0,22 $ |
| 3 | **GPT-6 Astra Medium** | 1882 ± 108 | 0,77 $ |
| 4 | Claude Opus 5.5 Medium | 1882 ± 110 | 1,22 $ |
| 5 | Claude Fable 5.1 High | 1863 ± 96 | 4,66 $ |
| 19 | Kimi K3 High | 1511 ± 75 | 0,88 $ |
| **23** | **Muse Spark 1.3** | **1435 ± 81** | **0,002 $** |

Quelle: threejseval.com, abgerufen 27.10.2026.[21]

Der MIT-CDFG-Living-Survey zitiert die frühere Berechnung (15.10.2026, 25 366 Stimmen): Astra Medium 1884 ± 105 auf Platz 4, hinter Opus 5.5 High (2071 ± 106), GPT-6.1 Sol (1984 ± 153) und Opus 5.5 Medium (1894 ± 110).[23] Das Ranking ist also **zeitabhängig** — die Reihenfolge verschiebt sich, das Spitzencluster aber nicht.[20]

**→ Astra ist auf Platz 3, nicht 1.** [21]

#### Benchmark D — WorldBench (Three.js-Voxelwelt, Verhalten/Physik)

Methode: **eine** Prompt (schwebende Voxelinsel mit zehn Biomen, Physik, Tages-/Nacht- und Jahreszeitenzyklus).[20]
Ein Judge **exploriert die laufende Welt** (steuert die Uhr, orbitiert, schickt einen Navigator-Agenten zur Rahmung jedes Bioms) **und** liest den Code.[21][22]
Kein Kanal wird allein vertraut: ein Code-Zitat zählt nur, wenn der Quelltext es tatsächlich enthält; visuelle Aussagen werden gegen gemessene Pixel geprüft.[7]

| Rang | Modell | WC001–005 | Gesamt /280 |
|---|---|---|---|
| 1 | **Claude Fable 5.1** | 36 / 15 / 76,29 / 72,5 / 11 | **210,79** |
| 2 | **GPT-6 Astra** | 36 / 16 / 74,48 / 63,25 / 10 | **199,73** |
| 3 | Kimi K3 | 38 / 17 / 60,11 / 62,25 / 14 | 191,36 |
| 4 | Grok 4.7 | 35 / 18 / 65,03 / 58,75 / 11 | 187,78 |
| 5 | Gemini 3.1 Pro | 37 / 13 / 44,25 / 44,75 / 10 | 149,00 |

Die Live-Leaderboard-Daten (letzte Änderung 5.10.2026) ergänzen **Claude Opus 5.5 mit 221,64**.[7][23]

Die Autoren lesen Lücken von wenigen Punkten zwischen Nachbarn als Gleichstand; die Welten werden **je einmal generiert und bewertet** — die Wertung ist also **n=1** und statistisch schwach.[7]

**→ Hier führt Fable 5.1 bzw.[21][22] Opus 5.5, nicht Astra.**

#### Benchmark E — benchmark.ai Text-To-3D Code Leaderboard (menschliche Präferenz, Elo)

500 Text-Prompts in fünf Kategorien (Fahrzeuge, Tiere/Kreaturen, Architektur, Möbel/Wohnen, Instrumente/Werkzeuge), 135 152 Paarvergleiche, 780 424 Stimmen, Bradley-Terry-Fit, vier Dimensionen (Alignment, Coherence, Creativity, Preference).[21] Stand 21.10.2026.[8]

| Rang | Modell | Elo |
|---|---|---|
| 1 | **Gemini 4 Argon** | 1606 ± 16 |
| 2 | **GPT-6 Astra** | 1563 ± 13 |
| 3 | GPT-6.1 Sol | 1459 ± 13 |
| 4 | Muse Wonder (Meta) | 1329 ± 14 |
| 5 | Claude Opus 5.5 | 1315 ± 12 |
| 7 | Claude Fable 5.1 | 1094 ± 11 |

Quelle: benchmark.ai, Stand 21.10.2026.[8]

**→ Hier führt Gemini 4 Argon, nicht Astra.** Wichtig für unser Setup: **Muse Wonder** (Metas stärkstes Modell) liegt mit 1329 deutlich über **Muse Spark 1.3** in threejseval (1435 vs. 1606+).[8][21]
Meta hat also ein 3D-stärkeres Modell.[8][21]

#### Benchmark F — AA-3D (Artificial Analysis, agentisches 3D-Erlebnis)

**Methode:** 55 Aufgaben (je ein schriftliches Briefing für **eine** interaktive Szene, z. B. ein rotierendes Schwarzes Loch, ein spielbares Flipper-Tisch, das Kolosseum).[39] Jedes Modell läuft als **Agent im Offline-Sandbox-Harness „Stirrup"** (eigene Sandbox pro Task, **kein Netzwerkzugang**).[23] Die Elo-Werte stammen aus **blinden Paarstimmen** eines rekrutierten Panels („AA-3D Voting").[39]

| Rang | Modell | Elo (95 %-Intervall) |
|---|---|---|
| 1 | Claude Sonnet 5.5 (Max) | 1199 ± 33 |
| 2 | Claude Opus 5.5 (Max) | 1196 ± 33 |
| 3 | **GPT-6 Astra (Max)** | **1164 ± 32** |
| 4 | Gemini 4 Argon (High) | 1153 ± 33 |
| 5 | Claude Fable 5.1 (Max) | 1135 ± 33 |
| 6 | GPT-6 Sol (Max) | 1121 ± 33 |
| 7 | GPT-6.1 Sol (Max) | 1119 ± 33 |
| 8 | Kimi K3.1 Pro | 1110 ± 33 |
| 9 | **Muse Spark 1.3 (Max)** | **1033 ± 31** |
| 10 | GPT-6 Luna (Max) | 1000 (Ankerpunkt) |
| 11 | Claude Haiku 5.5 (Max) | 998 ± 31 |
| 12 | Grok 4.7 (Xhigh) | 995 ± 31 |
| 22 | Inkling (Xhigh) | 583 ± 40 |

Quelle: artificialanalysis.ai, abgerufen 27.10.2026.[39] AA-3D ist Teil des Artificial-Analysis-Evaluationskatalogs, in dem es neben FrontierCode 1.1 und LiveCodeBench als „New" geführt wird.[9]

**→ Hier führt Claude Sonnet 5.5 und Opus 5.5, Astra ist #3, unser Modell #9.**[39]
Bemerkenswert: Meta hat mit **Muse Wonder** in benchmark.ai [8] und in 3JSBench [20] deutlich bessere 3D-Werte, **hier aber kein Muse Wonder im Board** — die Abdeckung der Meta-Modelle ist uneinheitlich.[39]

### 1.3 Urteil These 1

| Lesart | Urteil | Begründung |
|---|---|---|
| „Astra existiert und ist OpenAIs stärkstes Modell" | **Belegt** | Astra ist das Spitzenmodell der GPT-6-Familie, 3.9.2026, `gpt-6-astra`.[1] |
| „Astra ist in **3D-Codegenierung** am leistungsfähigsten" | **Teilweise belegt, nicht generell** | #1 in 3JSBench-Passrate (80,0 %) und Prompt-Similarity (+0,011).[20] Aber #2 bei 3JSBench-Human-Preference (1073 vs. 1083),[20] #3 in threejseval (1882 vs. 2064),[21] #3 in AA-3D (1164 vs. 1199 bzw. 1196),[39] #2 in WorldBench (199,73 vs. 210,79 bzw. 221,64),[7][23] #2 in benchmark.ai (1563 vs. 1606).[8] |
| „Astra ist auch bei allgemeinem Code am leistungsfähigsten" | **Widerlegt** | OpenAI selbst führt in seiner Astra-Ankündigung **keine SWE-bench-Zeile** mehr; FrontierCode 1.1 Main: Astra 53,3 %, Claude Opus 5.5 54,4 % — also **daran vorbei**; FrontierCode 1.1 Extended: Astra 64,5 %, Claude Fable 5 64,9 %.[1][unbelegt für den Opus-5.5-Wert aus Drittquellen] |
| „Benchmark" ohne Benennung | **Nicht prüfbar** | Sechs existierende Benchmarks, vier verschiedene Sieger.[7][8][20][21][39] |

**Fazit These 1: teilweise belegt, pauschal widerlegt.** Die korrekte Formulierung lautet: *„GPT-6 Astra ist das leistungsfähigste Modell bei deterministisch geprüfter Geometrie-Korrektheit in Three.js (3JSBench).[20] Bei menschlicher Ästhetik-Bewertung und bei Verhaltens-/Physikkorrektheit führen andere Modelle."*

**Für SkillSpark ist das keine Detailfrage, sondern die zentrale Designentscheidung:** Der Verify-Loop S1–S5 misst aktuell **Codeform, Verbote, Budgets und Didaktik** — also **nichts** von dem, was 3JSBench oder threejseval messen.[Projektquelle: `src/runtime/verify.js`, `src/runtime/guard-static.js`, `src/runtime/didactics.js`] Soll SkillSpark geometrisch korrekte Modelle liefern, muss der Loop um **deterministische Szenen-Checks** erweitert werden (Abschnitt 6, Maßnahme M1).[20]

### 1.4 Der Befund, der unser Modell direkt betrifft

3JSBench nennt für `Muse Spark 1.3` drei spezifische, quantifizierte Fehlermuster:[20]

> - „Muse Spark 1.3 builds the heaviest objects: a median of **995 meshes and 177,000 triangles**. Inkling is close behind at 951 meshes; **Astra uses 45** and Fable 5.1 just 24."[20]
> - „A third of Muse Spark's attempts (**33%**) flicker, more than any other model." [20]

Über alle 3 000 Versuche sind die häufigsten Fehler: **schneidende Objekte (20 % der Versuche)**, **durchsichtige Flächen (19 %)**, **flackernde Flächen (17 %)**, **falsch orientierte Bauteile (16 %)**, **getrennte Bauteile (16 %)**.[20]

Für SkillSpark heißt das konkret: [20]
- **995 Meshes im Median** liegt ~19× über der S1-Obergrenze im Prompt (34 KB) und ist Hauptursache der Draw-Call-Problematik.[20] Astra erzeugt mit 45 Meshes ein **strukturell** vergleichbares Ergebnis.[20] Das ist die stärkste Einzel-Evidenz für Maßnahme M2 (Abschnitt 6).[20]
- **33 % Flackern** ist ein **deterministisch prüfbarer** Fehlermodus (Z-Fighting / koplanare Flächen / falsche Normalen).[20] Er ist mit einem eigenen S-Layer testbar — siehe M1.[20]
- **Durchsichtige Flächen** (19 %) entstehen durch **Innenseiten-Sichtbarkeit** (fehlende `side: FrontSide` / inkonsistente Normalen).[20][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Ebenfalls deterministisch prüfbar.[20]

Alle drei Fehlermuster fallen in **unsere** Domäne: SkillSpark-Budgets sind genau an den Schwellen, an denen unser Modell scheitert (Meshes, Draw-Calls, Flacker).[20]

---

## 2. These 2: „Prompt Engineering kitzelt Qualität heraus"

Kurzurteil: **Ja — aber die Wirkung ist stark kontextabhängig, und drei verbreitete Praktiken sind durch die Evidenz widerlegt oder eingeschränkt.** Die stärkste Evidenz existiert für **Ausführungsfeedback mit messbaren Werten**, nicht für „mehr Text im Prompt".[15][17]

### 2.1 Few-Shot-Exemplare

| Befund | Quelle | Belegstärke |
|---|---|---|
| Bei **größeren, code-spezifischen** Modellen können Few-Shots die Leistung **verschlechtern** — „contrary to conventional wisdom".[12] Retrieval-basierte Beispiele stellen die Stabilität wieder her.[12] | arXiv 2602.15228, 360 Konfigurationen, 4 Modelle, 5 System-Prompts, 3 Prompting-Strategien, 2 Sprachen, 2 Temperaturen.[12] | **Kontrollierte Studie, peer-review-nah** |
| Funktionale Korrektheit **peakt bei 5–25 Few-Shots** und fällt bei 125/625 Shots auf Near-Zero-Shot-Niveau zurück („many-shot paradox").[13] | arXiv 2510.16809, > 90 000 Übersetzungen, 30 Sprachpaare.[13] | **Großmaßstäbliche empirische Studie** |
| Signatur oder Few-Shot senken **TypeErrors, AttributeErrors, ImportErrors** signifikant.[14] Aber: dieselben Techniken erzeugen **mehr Code-Smells und höhere Komplexität**. Persona, CoT und Paketliste führen zu **weniger** korrekten Lösungen. „Most combinations do not lead to statistically significant improvements." | CodePromptEval, 7 072 Prompts, GPT-4o/Llama3/Mistral.[14] | **Peer-reviewed, publizierte Studie** |
| Retrieval-basierte (semantisch ähnliche) Beispiele schlagen statische Fixed-Shots, weil statische „misleading priors" injizieren, die persistieren, „unless prompts strongly reassert constraints". | arXiv 2602.15228.[12] | Kontrollierte Studie |

**Bewertung für SkillSpark:** Few-Shot ist **nicht pauschal empfehlenswert**.[12][13]
Der CodePromptEval-Befund ist direkt relevant: Unsere Import-Allowlist (`three` + `wrapper-helpers`) ist genau der Bereich, in dem **ImportErrors** entstehen — Few-Shot könnte hier helfen, erhöht aber die Code-Komplexität.[14]
**Empfehlung:** Retrieval-basiert, nicht statisch: pro Labor ein **ähnliches bestehendes Modul aus `src/models/`** als Stilanker wählen (nicht alle neun).[12][Projektquelle: `src/runtime/guard-static.js`]
Auf keinen Fall 5–25 starre Exemplare — das Budget ist 34 KB pro Modul, der Prompt selbst ist bereits ~9 KB.[13][Projektquelle: `prompts/p1-generate.txt`]

### 2.2 Harte Constraints: Import-Allowlist und Budgetzahlen im Prompt

Hier ist die Evidenz **am differenziertesten** — und unsere aktuelle Architektur steht im Konflikt mit dem Befund.[12]

| Befund | Quelle | Belegstärke |
|---|---|---|
| **„Increasing system-prompt constraint specificity does not monotonically improve correctness"** — Prompt-Effektivität ist konfigurationsabhängig und kann helfen *oder* schaden, je nach Alignment mit der Aufgabe und Decoding-Kontext.[12] Für große Code-Modelle: höhere Spezifität → **größere** Verhaltensverschiebungen.[12] | arXiv 2602.15228.[12] | Kontrollierte Studie |
| **Hierarchie-Effekt:** Für generische Modelle hilft Spezifität **am meisten, wenn sie mit stärkeren In-Context-Belegen gepaart ist**; retrieval-basierte Beispiele liefern die verlässlichste Grundlage. | arXiv 2602.15228.[12] | Kontrollierte Studie |
| **Strukturierte Prompts reduzieren Verweigerungen massiv** (GPT-4o: 338 von 424 invaliden Outputs → 37–52) durch „explicit output constraints, formatting requirements, and layered instructions". Aber: **Sicherheitsschwächen sinken dadurch nicht** konsistent. | arXiv 2608.24857, 424 sicherheitskritische Python-Tasks.[37] | Kontrollierte Studie |
| **Einfluss-Taktiken schaden:** Prompt-Frames, die **Dringlichkeit** betonen, waren mit **reduzierter Korrektheit und reduzierter Sicherheit** assoziiert (LiveCodeBench, SWE-bench Verified, 5 Open-Weight-Modelle). | EMSE Springer, DOI 10.1007/s10664-026-10934-z. | Peer-reviewed |

**Bewertung für SkillSpark — dies ist die wichtigste Erkenntnis aus These 2:** [12]

Unser P1-Prompt ist **9 KB** und enthält ~25 harte, teils redundante Constraints (Zeilen 11 und 12 wiederholen „Du beendest die Ausgabe nach dem letzten Export" wörtlich; das Budget steht doppelt in P1 und im Modul-Prompt).[Projektquelle: `prompts/p1-generate.txt`] Nach arXiv 2602.15228 ist das **kein** Garant für bessere Ergebnisse, sondern ein **Risiko**: Bei einem bereits langen, constraint-dichten Prompt gewinnt das Modell Signalrauschen, und der Effekt ist modell- und aufgabenabhängig.[Projektquelle: `prompts/p1-generate.txt`]

**Andererseits** ist unser Fall atypisch und begünstigt harte Constraints: Unser Output wird **deterministisch geparst** (`export const meta`, `export function init` per Regex in `livegen.js`; Import-Allowlist per Regex in `guard-static.js`).[Projektquelle: `src/runtime/livegen.js`, `src/runtime/guard-static.js`] Ein Modell, das `import * as THREE` schreibt oder den Export vergisst, **verschwendet den ganzen Repair-Loop**.[Projektquelle: `src/runtime/livegen.js`, `src/runtime/guard-static.js`] Die S1-Schicht macht die Constraints **verifizierbar**, was die 3JSBench-Evidenz nicht abdeckt (deren Fehlerquote liegt bei deterministisch geprüften Aufgaben trotz Astra bei 20 %).[20]

**Kompromiss, der durch die Evidenz gedeckt ist:** Constraints **nicht** wegkürzen, sondern **priorisieren und messbar machen**.[12] Die höchste Hebelwirkung hat die Kombination aus (a) Constraint-Spezifität und (b) In-Context-Belegen — also **ein** Retrieval-Exemplar plus **eine** signierte Import-Liste plus **die** Zahlenbudgets.[12] Genau das ist die Aussage von arXiv 2602.15228.[12]

Ein zweiter, ebenfalls belegter Punkt: **Ausgabeformat-Constraints sind der billigste Hebel.** Der Gemini-3.8-Flash-Befund aus 3JSBench zeigt: 55 von 300 Versuchen wickelten das Programm in einen unaufgeforderten Markdown-Code-Fence ein — und **nur 1** dieser 55 bestand.[20] Das ist ein **Format**-Fehler, kein Geometrie-Fehler.[20] Unser P1-Prompt enthält bereits „Du lieferst nur das Modul ohne Erklärungstext" — aber **nicht** „keine Code-Fences".[Projektquelle: `prompts/p1-generate.txt`] Das ist eine Billigstellschraube mit messbarem Effekt.

### 2.3 Stilanker (Referenzcode im Prompt)

| Befund | Quelle | Belegstärke |
|---|---|---|
| Stilanker funktionieren, wenn sie **relevante In-Context-Belege** liefern; die Kombination „Spezifität + starker In-Context-Beleg" ist der belegte Hebel.[12] Retrieval-basiert > statisch. | arXiv 2602.15228.[12] | Kontrollierte Studie |
| Few-Shot/Signatur verbessern Korrektheit, erzeugen aber **mehr Code-Smells und höhere Komplexität** — ein **Trade-off**, kein Gratis-Gewinn. | CodePromptEval.[14] | Peer-reviewed |
| **Modularisierung** von Trainingsdaten (Umbenennung, Zerlegung in Helfer, NL-Pläne) verbessert Codegen-Performance um **bis zu 30 %**; bereits 15 % bereinigte Daten übertreffen 100 % der Originaldaten. Zerlegung wirkt dabei am stärksten, **Planung nur marginal** (Pass@25 42,6 → 43,9). | arXiv 2311.14904.[30] | Peer-reviewed (EMNLP-Klasse) |
| LLMs erzeugen bei Modularitäts-Vorgaben „modular code that appeared modular at a glance, but still violated the principle through over-engineering, hidden dependencies, and breaking changes" — **4× Codegröße ohne Zusatzfunktionalität**. | Harvard SEAS, „The Modular Imperative".[unbelegt — nur Sekundärfund, Primärquelle nicht extrahiert] | Vorsichtig |

**Bewertung:** Stilanker sind **belegt nützlich**, aber nur als *relevant*, retrieval-basiert und mit Komplexitäts-Nebenwirkung.[12][14][30]
Unser Bestands-Approach — die v6-Hyper-Prompts enthalten bereits **vollständige, exakte Zielmodule** (Bauteilliste, Maße, Label-Positionen, Materialwerte) — ist eine **Extremform** des Stilankers.[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Nach CodePromptEval müsste das die Komplexität erhöhen; in der Praxis hat es bei uns funktioniert (9/9 Labs Iteration-1-grün).[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] Die Erklärung: Unser Stilanker ist kein *generisches* Beispiel, sondern die **exakte Spezifikation des Ziels** — das ist der von arXiv 2602.15228 geforderte „starke In-Context-Evidenz"-Fall, nicht der Few-Shot-Fall.[12]

### 2.4 Iterative Repair-Loops (Fehler zurückfüttern)

**Dies ist der am besten belegte Hebel — und zugleich der, bei dem unser Setup die Evidenz am wenigsten nutzt.** [15][16][17]

| Befund | Quelle | Belegstärke |
|---|---|---|
| **exec-refine** (Ausführungsfeedback) erzielt den **höchsten Pass@1 aller getesteten Methoden: +3,4 bis +38,8 Punkte** über die anderen Refinement-Ansätze.[15] NL-Feedback (self-refine) ist am besten für **Effizienz**, bricht aber mehr Tests.[15][16][17] Alle Methoden **degradieren Pass@1 über Iterationen hinweg**. | ECCO, arXiv 2407.14044.[15] | Peer-reviewed |
| **FLARE** (feingranulares diagnostisches Feedback) erreicht **54,86 % vs. 50,27 %** (LiveCodeBench) und **58,51 % vs. 53,81 %** (BigCodeBench) gegenüber reiner Ausführungs-Refinement. | arXiv 2606.03852.[17] | Peer-reviewed |
| **Achtung, Gegenbeleg:** In einer Reassessment-Studie **reduzierte Self-Refine die Korrektheit in 16 von 21 Modell-Benchmark-Paaren** und verbesserte sie in nur 4; Self-Debug hingegen war in 16 von 21 positiv. „Self-Refine's regression count is more than three times its repair count." | MDPI, Reassessing One-Round Test-Time Refinement.[16] | Peer-reviewed |
| **Entfernen des Ausführungs-Feedbacks** senkt die Self-Refinement-Leistung deutlich (HumanEval, MBPP, APPS); Baselines nehmen die Ausführungsergebnisse als „redundant information or even noise" wahr. | CYCLE, arXiv 2403.18746.[unbelegt — nur Sekundärfund] | Vorsichtig |
| **Selbstkritik** (Self-Refine, ursprüngliche Arbeit) verbessert über 7 Tasks um **~20 % absolut** — aber überwiegend für **Dialog und Mathematik**, nicht für Code. | ACM/ACL, Self-Refine.[unbelegt — nur Sekundärfund] | Vorsichtig |

**Bewertung für SkillSpark — hier ist die größte Lücke:** [15][17]

Unser P2-Reparaturschleife hat zwei Defekte gegenüber der Evidenz: [15][17]

1. **Wir füttern Schicht + Meldung + Messwerte zurück** — das ist gut (FLARE-Klasse).[15][17] Aber: Unsere Messwerte stammen **nur** aus S1 (statisch: Verbote, Größe, Imports, Meta-Form) und S5 (Manifest/Didaktik).[17][Projektquelle: `prompts/p2-repair.txt`] **S2 (Sandbox), S3 (Visual) und S4 (Budget) liefern im Node-Kontext nur `skip`-Layer mit Grund „Messung im Browser"** — es fließt also **kein geometrisches oder visuelles Feedback** zurück.[Projektquelle: `src/runtime/verify.js`, `skipLayer()`]

   Genau die Fehler, die unser Modell am häufigsten produziert (schneidende Objekte 20 %, durchsichtige Flächen 19 %, Flackern 17 %),[20] sind **browser-messbar** — aber wir messen sie nicht und melden sie nicht zurück.[Projektquelle: `src/runtime/verify.js`] Das ist die Ursache dafür, dass P2 bei 3JSBench-typischen Fehlern **nichts bewirken kann**.[Projektquelle: `src/runtime/verify.js`, `skipLayer()`]

2. **Die Iterationsgrenze ist möglicherweise zu hoch.**[15][Projektquelle: `src/runtime/verify.js`] ECCO zeigt, dass alle Refinement-Methoden Pass@1 über Iterationen hinweg degradieren.[15]
Wir erlauben 3.[15][Projektquelle: `prompts/p2-repair.txt`]
Nach Evidenzlage ist **2** die bessere Voreinstellung (Iteration 3 als Reserve).

   **Korrektur der Erwartung:** Das ist kein Fehler in unserem Setup — unser AUFTRAG-REPORT dokumentiert 9/9 Labs bereits in Iteration 1 grün, 0 P2-Repairs.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] Die Repair-Schleife ist also aktuell **nicht der Engpass** — sie ist der **ungetestete Notfallpfad**.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] Die Maßnahme M1 (S2–S4-Browser-Feedback in P2) ist damit eine **Absicherung**, kein sofortiger Hebel.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`]

### 2.5 Zerlegung (erst Form, dann Material, dann Licht)

| Befund | Quelle | Belegstärke |
|---|---|---|
| **Self-Planning Code Generation** (Planungsphase, dann Implementierung): **+25,4 % relativ in Pass@1** gegenüber direkter Generierung, **+11,9 %** gegenüber CoT-Code-Generierung, auf HumanEval/MBPP/multilingual.[31] Menschliche Bewertung: auch Korrektheit, Lesbarkeit und Robustheit besser. | arXiv 2303.06689 (Self-planning Code Generation).[31] | Peer-reviewed, **aber ältere Modelle** (GPT-3.5/4-Ära) |
| **CODEPLAN** (Code-form-Pläne): +25,1 % relativ gegenüber direkter Generierung über 13 Multi-Step-Benchmarks. | arXiv 2409.12452.[unbelegt — nur Sekundärfund] | Vorsichtig |
| **Gegeng-evidence:** Zerlegung wirkt **nur, wenn die Planung korrekt ist** — „generated plans are often imprecise or incorrect, highlighting that planning still remains a bottleneck". Zerlegung des Codes bringt +30 %, **Planung darüber hinaus nur marginal** (42,6 → 43,9). | arXiv 2311.14904.[30] | Peer-reviewed |
| **Gegeng-evidence zur Zerlegung allgemein:** LLMs überschätzen Modularität — 4× Codegröße ohne Zusatzfunktion. | Harvard SEAS.[unbelegt] | Vorsichtig |
| **Zerlegung kostet:** Task-Decomposition bringt zusätzlichen Reasoning- und Generierungs-Overhead mit. | arXiv 2402.02716 (Planning-Survey).[unbelegt — nur Sekundärfund] | Vorsichtig |

**Bewertung für SkillSpark:** Zerlegung ist **kontextabhängig** und für unsere Aufgabe **wahrscheinlich kontraproduktiv**, aus zwei gemessenen Gründen: [30][31]

1. **Zerlegung erzeugt Zwischenzustände, die wir nicht verifizieren können.**[30][31]
Unsere Einheitsprüfung ist ein **statischer Parse + Browser-Start** (`guard-static.js`, `livegen.js`).[Projektquelle: `src/runtime/guard-static.js`, `src/runtime/livegen.js`] Eine mehrstufige Generierung (erst Form → dann Material → dann Licht) erzeugt Zwischenmodule, die entweder unvollständig sind (S1-Parse schlägt fehl) oder deren Fehler sich in einem späteren Schritt auflösen. Wir haben **keine** Teilschritt-Verifikation.[20][31][Projektquelle: `src/runtime/verify.js`]
2. **Planungsqualität ist bei unserem Modell der Engpass.**[30][Projektquelle: `src/runtime/verify.js`] arXiv 2311.14904 zeigt explizit, dass generierte Pläne oft unpräzise sind und Planung nur marginal über Modularisierung hinaus wirkt.[30] Bei einem Modell mit 10,7 % 3JSBench-Passrate[20] ist die Planungsqualität erst recht nicht verlässlich.
3. **Kosten:** Zerlegung = mehrere Reasoning-Pässe = mehr Tokens und Latenz.[18][unbelegt — nur Sekundärfund arXiv 2402.02716]

**Empfehlung:** Keine echte Multi-Step-Zerlegung.[31][38]
Stattdessen **eine einzige Generierung, aber mit *strukturiertem Prompt*** (Bauteilliste → Geometrie → Material → Licht als *Abschnitte im Prompt*, nicht als *mehrere API-Calls*).[31][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]
Das ist die „CodePrompt"-Variante des Self-Planning-Ansatzes: ein Plan im Prompt, keine Planungsrunde.[31]
Das entspricht auch unserem Hyper-Prompt-Muster, das bereits funktioniert.

### 2.6 Messbare Checklisten im Prompt (Bauteilliste, Maße, Labels)

| Befund | Quelle | Belegstärke |
|---|---|---|
| **Checklisten-basierte Rewards** verbessern Frontend-Code-Generierung messbar: RL mit checklist-based rewards, **+3,4 bis +6,5 %** zero-shot accuracy über das Basismodell, dabei **2–3× höhere Token-Effizienz** als Chain-of-Thought.[unbelegt — nur Sekundärfund Findings of ACL 2026] | Findings of ACL 2026.[unbelegt — nur Sekundärfund] | Peer-reviewed Sammelband |
| **Aufgabenspezifische Checks sind entscheidend:** 3JSBench prüft 696 deterministische Checks in sechs Familien; allein die Checks verhindern, dass der Judge nur „sieht aus wie ein Schatz".[20] | 3JSBench.[20] | Benchmark-Methodik |
| **Fehler-Taxonomie:** Semantische Fehler dominieren; die equality/inequality-Subklasse ist der Haupt-Engpass, „even with deliberate reasoning". | ACM, Cross-Benchmark Error Taxonomy.[19] | Peer-reviewed |

**Bewertung:** Checklisten im Prompt sind **stark gestützt** — und SkillSpark hat sie bereits, aber an der **falschen Stelle**.[20][unbelegt — nur Sekundärfund Findings of ACL 2026] Aktuell enthält der Prompt „Du beschriftest jedes Hauptbauteil mit addLabel, und du setzt mindestens eine Messung mit addMeasurement" — **Mindestanforderungen**.[Projektquelle: `prompts/p1-generate.txt`] Nach der 3JSBench-Evidenz sind **Mindestanforderungen** die Ursache der Fehlerquote: jedes Bauteil, jede Position, jede Norm muss **explizit und messbar** benannt sein, damit S5 überhaupt etwas prüfen kann.[Projektquelle: `prompts/p1-generate.txt`]

Unser S5 verlangt „≥ 2 Ziele, ≥ 3 Labels, ≥ 1 Messung", B/A/P = Aufbau ≥ 2, Profi ≥ 1.[Projektquelle: `src/runtime/verify.js`] Die Hyper-Prompts schreiben bereits **exakt 5 Labels mit exakten Positionen und 1 Messung mit exakten Endpunkten** vor — und genau diese Labs sind 9/9 grün.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] Das ist der Beleg, dass **explizite Checkliste funktioniert**, nicht die Mindestzahl.[Projektquelle: `src/runtime/didactics.js`]

### 2.7 Reasoning-Effort als Qualitätshebel

| Befund | Quelle | Belegstärke |
|---|---|---|
| **E2E-SWE:** Reasoning-Effort von low bis xhigh → **progressiv mehr Output-Tokens und konsistent höhere pass@1**.[18] „Whole-repository generation benefits strongly from longer reasoning." (Claude Opus 4.8 und GPT-5.5 über 186 Repo-Tasks, 11 Sprachen).[18] | arXiv 2609.38335.[18] | Peer-reviewed/preprint, **aber andere Aufgabe** |
| **Aber:** „thinking helps, but not always" — +2–3 pp Durchschnitt, mit **Regressionsmöglichkeit auf den schwierigsten, praxisnahen Aufgaben** (BCB-Hard: Pass@1 0,304 → 0,284 bei gleichzeitig besserer Error-Ratio). Semantische Fehler bleiben Hauptengpass. | ACM, Cross-Benchmark.[19] | Peer-reviewed |
| **Terminal-Bench-Effort-Ladder:** GPT-6 Astra: 50,6 % bei `low` → 58,2 % bei `max` (+7,6 pp). | developertoolkit.ai, Auswertung offizieller Board-Daten.[unbelegt — Sekundärauswertung] | Vorsichtig |
| 3JSBench testet **alle Modelle bei `high`**: „Each model makes three one-shot attempts at every task **at high reasoning**" — die Rangliste ist also **effort-normalisiert**.[20] | 3JSBench-Methodik.[20] | Benchmark-Methodik |

**Bewertung für SkillSpark — hier ist die wichtigste operative Erkenntnis des ganzen Berichts:**[34]

**Unser Modell läuft aktuell in der Contributor-Variante, die kein `"max"` unterstützt.** Meta dokumentiert explizit:[34]

> „`"max"` | Extended reasoning beyond `"xhigh"`.[34] Supported by `muse-wonder-1.0` and `muse-spark-1.3`; **not available with `muse-spark-1.3-contributor`**."

Und: „The `"max"` level on Muse Wonder and Muse Spark 1.3 goes beyond `"xhigh"`: the model spends more time reasoning before responding, using more reasoning tokens at the same per-token price as other effort levels."[34]

`muse-spark-1.3` und `muse-spark-1.3-contributor` sind **dasselbe Modell** — nur unterschiedliche Datenverträge und Preise: „Same model. The contributor identifier is priced far lower ... in exchange for the traffic being used to improve Meta's products. **Pick by your data-handling requirements, not by capability.**" (Mixpeek, Sekundär)[unbelegt — nur Sekundärquelle Mixpeek]; Meta selbst bestätigt die Preis-/Nutzungsdifferenz, nicht ausdrücklich die Gleichheit.[10]

**Das bedeutet:** Wenn wir von `muse-spark-1.3-contributor` auf `muse-spark-1.3` wechseln, erhalten wir **"max"-Reasoning zum gleichen Token-Preis** — der einzige Unterschied ist, ob unsere Prompts zum Training zukünftiger Meta-Modelle dienen.[34] Für Schulmaterial ist das eine Datenschutzfrage, keine Qualitätsfrage. Das ist eine **sehr billige, sehr wahrscheinlich wirksame** Maßnahme (M3 in Abschnitt 6).[34]

Zusätzlich: `muse.exe` wird in unserem Setup über `--model` aufgerufen — ob das CLI `reasoning_effort` durchreicht, ist **vorher zu prüfen** (M3-Aufgabe).[34] Und: Reasoning-Tokens **zählen gegen `max_output_tokens`** und werden **zum Output-Preis berechnet** — bei 34-KB-Modulen und Streaming muss das Limit großzügig gesetzt werden, sonst wird die sichtbare Antwort abgeschnitten und `finish_reason` ≠ `stop` → `E-GEN-PARSE`.[34][Projektquelle: `src/runtime/livegen.js`]

### 2.8 Zusammenfassung These 2

| Technik | Evidenzlage | Empfehlung für SkillSpark |
|---|---|---|
| **Ausführungsfeedback mit Messwerten** | **Stärkste Evidenz** (+3,4–38,8 pp; FLARE +4,6 pp ggü. exec-only)[15][17] | **Ja**, aber erst nach M1 (S2–S4-Feedback in P2 speisen) |
| **Explizite, messbare Checkliste im Prompt** | Stark (Checklist-Rewards +3,4–6,5 %; deterministische Checks)[20][unbelegt] | **Ja** — von Mindestzahlen auf **exakte** Bauteilliste |
| **Retrieval-basierter Stilanker** | Belegt, mit Komplexitäts-Nebenwirkung[12][14][30] | **Ja**, 1–2 relevante Exemplare, retrieval-basiert |
| **Reasoning-Effort** | Belegt (+2–3 pp Durchschnitt; +7,6 pp low→max)[18][19][unbelegt] | **Ja** — auf `"max"` umstellen, Contributor-Wechsel nötig |
| **Format-Constraint (kein Markdown-Fence)** | Stark indirekt (55/300 Fences, 1/55 bestanden)[20] | **Ja** — Billigstellschraube |
| **Statische Few-Shots (5–25)** | **Eingeschränkt** — kann bei großen Code-Modellen schaden; Peak bei 5–25, dann Abfall[12][13] | **Eher nicht** — retrieval statt statisch |
| **Mehr/härtere Constraints generell** | **Widerlegt als Monoton-Regel** — nicht-monoton, konfigurationsabhängig[12] | **Nein** — stattdessen Constraints priorisieren + messbar machen |
| **Mehrstufige Zerlegung (mehrere API-Calls)** | Gemischt, mit Kosten- und Planungs-Risiko; Planung bleibt Engpass[30][31] | **Nein** — ein Prompt, strukturierte Abschnitte |
| **Selbstkritik ohne Ausführung** | **Gegenbelegt** — reduziert Korrektheit in 16/21 Fällen[16] | **Nein** — immer mit Messwerten |

---

## 3. Text-to-3D-Alternativen (Mesh-Generierung statt Code-Gen)

### 3.1 Stand der Technologie (Okt 2026)

| Modell | Typ | Format | Polycount | Lizenz / Zugang |
|---|---|---|---|---|
| **Hunyuan3D 3.1** (Tencent) | Text **und** Bild | GLB, OBJ, FBX, STL, USDZ | **40 k – 1,5 Mio. Faces** konfigurierbar, PBR-Materialien | Hosted via Replicate (142,5 k Runs); „best all-around model for 3D generation right now"[25] |
| **TRELLIS.2** (Microsoft) | **Nur Bild** | GLB mit PBR bis 4096², OBJ, PLY, Radiance Fields, Gaussian Splats | 4 B Parameter, O-Voxel-Repräsentation | **MIT** (Modell + Code), self-hosted[24][25] |
| **Hunyuan3D 2.1** | **Nur Bild** (Text via vorgeschaltetes Text-to-Image) | GLB, OBJ | 3,3 B Shape + 2 B PBR-Texture; ~10 GB Geometrie, ~29 GB inkl. Textur | Open Weights, Juni 2025[24] |
| **TripoSR** (Tripo/Stability) | **Nur Bild** | OBJ, GLB, optional gebackte UV-Textur | < 0,5 s auf Datacenter-GPU, ~6 GB VRAM | **MIT**[24] |
| **Rodin Gen-2.5** (Hyper3D) | Text, Bild, Multi-Image | Mesh mit PBR, Quad-Option | bis 10 Mio.+ Polygone | Hosted[24] |
| **Meshy, Tripo, Hi3D, Cinevva** | Text, Bild | GLB/FBX/OBJ/STL + PBR | 20 k – 300 k Dreiecke typisch | Hosted; Meshy free = CC BY 4.0 mit Attribution, Tripo free = non-commercial[24] |

Quellen: Cinevva-Vergleich (publ. 17.7.2026, upd. 14.9.2026)[24], Replicate-Collection (Abruf 27.10.2026)[25], triposr.org-Blog[unbelegt].

**Wichtige Korrektur:** Hunyuan3D und TRELLIS.2 sind **überwiegend bildkonditioniert**.[24][unbelegt — nur Sekundärfund triposr.org] Hunyuan3D 2.1 erreicht Text nur durch vorgeschaltetes Text-to-Image; für TRELLIS.2 existiert **kein** text-konditionierter Checkpoint.[unbelegt — nur Sekundärfund] Für einen rein textgetriebenen Workflow (Schul-Labor: „Bauteilliste + Maße") ist das ein **fundamentaler Nachteil**: Das Mesh entsteht aus einem Bild, nicht aus einer Spezifikation — Maße, Bauteillisten und didaktische Labels existieren im Mesh **nicht**.[Projektquelle: `src/runtime/didactics.js`, `src/runtime/guard-static.js`]

### 3.2 Eignung für unseren Single-File-Wrapper mit Inline-Budget

**Kriterien aus unserem Setup** (Projektquelle: `src/runtime/guard-static.js`, `src/runtime/budget.js`):[Projektquelle: `src/runtime/guard-static.js`, `src/runtime/budget.js`]

| Kriterium | Unser Budget | Text-to-3D-Mesh | Bewertung |
|---|---|---|---|
| Modulgröße | **34 KB** hart (V6-Hyper), 1,5 MB Komfort / 2 MB hart (S1) | GLB typisch 0,5–19,8 MB in Messungen; Base64-Einbettung +33 %[unbelegt für exakte Inline-Größen] | **Faktor 15–580 zu groß** für 34 KB |
| Dreiecke | 150 k (grün 120 k) | 40 k – 1,5 Mio.; typisch 20 k – 300 k[24][25] | Obergrenze reizbar, aber Budget passt **nur** bei Dekimation |
| Draw-Calls | 400 (grün 300) | 1 Mesh = 1 Draw-Call, aber Material-Split + Texturen | Bei 1–5 Meshes **vorteilhaft** (unser Median: 995 Meshes)[20] |
| Laufzeit-Netzwerk | **Verboten** (S1: `fetch`, `XMLHttpRequest`, `WebSocket` verboten) | GLB muss eingebettet sein — kein `GLTFLoader` + URL | Erzwingt Inline-Base64 → Größenexplosion |
| Texturen | Keine CDN, kein `document`/`canvas` (S1-Verbot) | Hunyuan3D liefert PBR mit 2048²–4096²-Texturen | **Blocker**: braucht Texturen → 4 MB+ pro Textur |
| Didaktik | `addLabel`/`addMeasurement`, Bauteilliste, Maße in m | Mesh hat **keine** Semantik, keine Labels, keine Maße | **Blocker**: Labels müssten separat berechnet werden → 3D-Positions-Problem |
| Editierbarkeit | Parameter im Code, `update(patch)` | Mesh ist eine Blackbox | **Nachteil** |
| Schul-iGPU | SwiftShader-/iGPU-Toleranz | Dense Meshes + große Texturen → Füllrate-Problem | **Nachteil** |

**Messwerte aus einer realen Vergleichsmessung** (dritte Quelle, GitHub-Repo eines Nutzer-Vergleichs, 1,7 MB Referenz-PNG): TripoSR 559 KB GLB · Stable Fast 3D 988 KB GLB · TRELLIS image-large 2,0 MB GLB · **Hunyuan3D 2 mini 19,8 MB GLB** (302 k Faces vor Dekimation).[unbelegt — Sekundärquelle, nicht nachgeprüft]

**Urteil: Text-to-3D-Meshes sind für unseren Single-File-Wrapper mit Inline-Budget nicht geeignet.** Nicht weil die Technologie schlecht ist, sondern weil sie das **falsche Artefakt** liefert: eine opake, texturierte Oberfläche statt eines *semantischen, editierbaren, didaktisch annotierbaren* Programms.[24][25][Projektquelle: `src/runtime/guard-static.js`, `src/runtime/budget.js`]

### 3.3 Die hybride Option, die bleibt offen

Die eigentliche Frage ist nicht „Code oder Mesh", sondern „wo liegt die Grenze der prozeduralen Erzeugung".[24][25] Drei Befunde:

1. **Code-Gen und Mesh-Gen lösen verschiedene Probleme.**[23][24] Das MIT-CDFG-Living-Survey dokumentiert, dass Frontier-Modelle heute „complete scenes as editable Blender programs rather than single fused meshes, with separate objects that can be revised on request" erzeugen — also **programmatisch** mit **einzelnen, editierbaren Objekten** — und zwar unter anderem eine prozedurale Lokomotive mit **3 295 editierbaren Objekten**, rekonstruiert aus einer Dampflok-Zeichnung.[23]
2. **3DGen-Bench** (11 200 Assets aus 19 Modellen, 68 000+ Präferenzstimmen von 47 Experten, fünf Dimensionen) bewertet **Geometrie-Plausibilität, Geometrie-Details, Texturqualität, Geometrie-Textur-Kohärenz und Prompt-Asset-Alignment** — die Dimensionen, die Code-Gen prinzipiell nicht adressiert.[unbelegt für die Zahlen — nur Sekundärfund] T3Bench (2023) bleibt die klassische Referenz für Text-to-3D-Meshes.[36]
3. **Der pädagogische Kontext spricht eindeutig für Code-Gen.** Das MIT-CDFG-Survey empfiehlt Erzieherinnen und Erzieherern explizit: „Shift assessment from producing artifacts to **specifying constraints and verifying outputs**, so students can explain and debug what a model produces."[23] Das ist genau unser Produkt: nicht das 3D-Objekt, sondern die **begründete Spezifikation + verifizierbare Ausgabe**.

**Für unser Setup gilt:** Code-Gen behält die Semantic-Editierbarkeit (Parameter, `update(patch)`, `meta.parts`); Mesh-Gen behält die organische Formtreue und hohe Detaildichte.[23][Projektquelle: `src/runtime/player.js`] Da unser Budget (~5–15 k Dreiecke real, gemessen 1 688–12 106) **unter** der unteren Mesh-Gen-Größe liegt, könnten Meshes nie dünner werden als das, was Code-Gen ohnehin liefert — bei einem Vielfachen an Größe und ohne Labels.[24][Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`, `src/runtime/player.js`] **Empfehlung: Code-Gen beibehalten; Mesh-Gen höchstens als optionaler „Detail-Boost" für einzelne Bauteile in Betracht ziehen, nicht als Ersatz.**

---

## 4. Wo liegt die echte Grenze prozeduraler PBR-Materialerzeugung?

### 4.1 Was PBR ohne Texturen kann

`MeshStandardMaterial` (r186) liefert die physikalisch basierten Parameter `metalness` (0 = Diffus, 1 = Metall) und `roughness` (0 = Spiegel, 1 = vollständig diffus); beide Multiplizieren mit den gleichnamigen Maps, falls vorhanden.[26] `normalMap` verändert **nur die Beleuchtung**, nicht die Geometrie; `displacementMap` verändert **die Vertexpositionen** — und diese veränderten Vertices werfen dann korrekt Schatten.[26]

**Belegte Grenze #1 — Reflexionsqualität hängt an der Umgebung, nicht am Material.** Metall mit `metalness = 1.0` und `roughness = 0.25` reflektiert die Umgebung.[26] Ohne `envMap` sieht Metall **schwarz** aus.[26] Deshalb ist unser inline gebautes PMREM-Raum-Setup (PMREMGenerator + Mini-Raumszene + `scene.environment`) **kein Luxus, sondern Notwendigkeit** für glaubwürdiges Metall.[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Die three.js-Doku nennt `envMapIntensity`/`scene.environmentIntensity` als wirksame Stellschraube.[26]

**Belegte Grenze #2 — Ohne Roughness-/Normal-Maps fehlt Mikrostruktur.** `roughnessMap` (Grünkanal) und `metalnessMap` (Blaukanal) trennen „Materialklasse" von „Oberflächenvariation".[26] Unsere DataTexture-Technik (max. 128×128, LinearFilter)[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] deckt das ab — aber **128² ist eine bewusste Grenze**: feine Kratzer, gebürstetes Metall, Holzmaserung sind unterhalb der Auflösung, die auf Schul-iGPUs mit hoher Geometriedichte bezahlbar bleibt.

**Belegte Grenze #3 — Prozedurale Texturen sind schwerer zu kontrollieren.**[29] Das PBR Book (3. Auflage) nennt zwei Kosten prozeduraler Texturierung explizit: (a) „subtle details of the appearance of procedural textures can be **much more difficult to control** than when image maps are used"; (b) Antialiasing ist eine Grundherausforderung, weil „sets of point samples that fully characterize their behavior aren't available as they are for image maps".[29] Der Vorteil liegt in der „promise of potentially infinite detail" — „as the viewer approaches an object, the texturing function is evaluated at the points being shaded" — während Image-Maps „become blurry when the viewer is too close".[29]

**Belegte Grenze #4 — PBR-Parametrizierung ohne echte Texturen reproduziert keine Geometrie-Artefakte.** Ein gebürstetes Metall imitiert man mit `metalness 1,0 / roughness 0,25` + anisotrop wirkender Normal-Map; eine Gussoberfläche mit Unebenheiten braucht echte Geometrie oder Displacement.[29] Unser V6-Prompt setzt `ExtrudeGeometry` mit Bevel für Fasen — das ist genau die richtige Reaktion auf diese Grenze.[26][29]

**Belegte Grenze #5 — CanvasTexture ist in unserem Setup verboten.** `CanvasTexture` braucht ein `<canvas>`-Element, `document.createElement('canvas')` — und `document` steht auf unserer S1-Verbotsliste.[Projektquelle: `src/runtime/guard-static.js`] `DataTexture` (rohe Uint8-Pixel) ist der einzige zulässige Weg, und genau den nutzen wir.[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Das ist eine **architektonische**, nicht nur eine Prompt-Entscheidung: Jede zukünftige Material-Verbesserung muss ohne Canvas/Canvas2D, ohne WebGL-RenderTarget-Schleifen (die `renderer.domElement` und damit DOM bräuchten) und ohne CDN-Texturen auskommen.[28][Projektquelle: `src/runtime/guard-static.js`, `prompts/gen-si-1-v6hyper400.txt`]

### 4.2 Die ehrliche Antwort

**Die Grenze der prozeduralen PBR-Erzeugung liegt nicht bei den Parametern, sondern bei drei Dingen:** [26][29]

1. **Material-Vielfalt ohne Texturträger.**[26][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]
`metalness`/`roughness` codieren eine Materialklasse, nicht eine Oberfläche.[Projektquelle: `src/runtime/guard-static.js`] Für Tech-Didaktik (Metall, Kunststoff, Gummi, Glas, lackiertes Blech) reicht das **sehr gut** — das ist genau unser use case.[26][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Für „sieht gebraucht aus", „rostet", „verschmutzt" braucht es Maps oder Geometrie.[26][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]
2. **Feinsteuerung des Lichts.** Unsere 3-Punkt-Setup + PMREM-Raum ist Handarbeit.[26][29][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Ein Studio-Licht wie `RectAreaLight` oder HDRI-Panoramen (PBR Book, Abschnitt „Lighting" analog: „deferred rendering with area lights", „Image-based lighting")[29] wäre deutlich realistischer, kostet aber entweder den Inline-Budget (HDRI als DataTexture) oder zusätzliche Shader-Komplexität — und `RectAreaLight` braucht `RectAreaLightUniformsLib` aus `three/addons`, was unsere Import-Allowlist verletzt.
3. **Fehlende Anisotropie und Klarlack.** `MeshPhysicalMaterial` mit `clearcoat`, `clearcoatRoughness`, `anisotropy`, `iridescence`, `sheen` und `transmission` liefert Lack, anisotropes Metall und Glas — **deutlich** näher an Produktions-PBR.[29] Nachteil: teurer im Shader, mehr VRAM, auf Schul-iGPUs riskanter. Das ist eine **Budget-Entscheidung**, keine Qualitäts-Illegalität.[29][Projektquelle: `src/runtime/budget.js`]

**Praktische Empfehlung:** Für unser Szenario ist die **PBR-Parameter + DataTexture-Mikrostruktur + Bevel-Geometrie + PMREM-Environment**-Kombination (unser V6-Hyper-Block) nahe am Optimum innerhalb der Grenzen.[26][29][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Der größte verbleibende Hebel ist **nicht** die Material-Qualität, sondern die **Geometrie-Korrektheit** — zurück zu Abschnitt 1.4: 20 % schneidende Objekte, 19 % durchsichtige Flächen, 17 % Flackern.[20] **Das ist der Engpass.**

---

## 5. Synthese: Wo die Qualität tatsächlich verloren geht

Für `Muse Spark 1.3` bei SkillSpark-ähnlichen Aufgaben ergibt sich aus 3JSBench eine Fehlerverteilung, die sich **direkt** auf unseren Verify-Loop abbilden lässt:[20]

| Fehlermodus | Häufigkeit | Im SkillSpark-Loop prüfbar? | Massnahme |
|---|---|---|---|
| Schneidende Objekte | 20 % der Versuche | **Nein** — S2/S3 sind skip-Layer | M1: Intersektions-Check (AABB/OBB-Penetration) in S2 |
| Durchsichtige Flächen | 19 % | **Nein** | M1: Backface-/Normalen-Check (sichtbare Innenseiten) |
| Flackernde Flächen | 17 % (bei Muse Spark: **33 %**) | **Nein** | M1: Z-Fighting-/Koplanaritäts-Check + Render-Vergleich zweier Frames |
| Falsch orientierte Bauteile | 16 % | **Nein** | M1: Achsen-/Orientierungs-Check gegen Spezifikation |
| Getrennte Bauteile | 16 % | **Nein** | M1: Connectivity-/Abstands-Check (Baugruppen-Kohäsion) |
| Zu viele Meshes | Median 995 | **Teilweise** — S4 misst Draw-Calls | M2: Mesh-Count als eigenes Budget-Kriterium |
| Markdown-Fence | 55/300 bei Gemini 3.8 Flash | **Nein** — Regex-Parser in `livegen.js` sucht ab `export const meta` | M4: explizite Prompt-Regel + Parser-Härtung |

**Das ist die zentrale Erkenntnis des Berichts:** Unser Verify-Loop S1–S5 prüft **Vertragskonformität** (Codeform, Verbote, Imports, Didaktik), aber **keine einzige der sechs Fehlerklassen, an denen generative 3D-Code-Modelle messbar scheitern** — mit Ausnahme der Draw-Calls.[20][Projektquelle: `src/runtime/verify.js`] Wir **messen die Dinge, die leicht messbar sind, und nicht die, die oft kaputtgehen.**

---

## 6. Priorisierte Top-8-Maßnahmen für unser Setup

Aufwand: **S** = < 1 Tag · **M** = 1–3 Tage · **L** = > 3 Tage.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`]
Effekt: quantifiziert, wo belegt; sonst qualifiziert.[20][Projektquelle: `src/runtime/verify.js`, `src/runtime/budget.js`]

### M1 — Verify-Loop um einen deterministischen Geometrie-Check erweitern (S2/S3-real)
**Priorität 1 · Aufwand L · Effekt: hoch (belegt-mechanisch)** [20][15][17]

3JSBench zeigt, dass die Top-Fehlerklassen (schneidende Objekte 20 %, durchsichtige Flächen 19 %, Flackern 17 %)[20] **deterministisch messbar** sind, und beschreibt das Verfahren: Szene im Headless-Browser starten, Szene erfassen, neun feste Ansichten rendern, Checks auf der erfassten Szene messen — das Urteil trifft **kein Modell**.[20]

**Für SkillSpark konkret:** S2 (Sandbox) und S3 (Visual) sind derzeit Node-seitige `skip`-Layer („Messung im Browser").[Projektquelle: `src/runtime/verify.js`] Stattdessen in der vorhandenen Playwright-Infrastruktur (28/28 Tests grün, Chromium + SwiftShader, 1280×720)[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] vier Checks ergänzen:
1. **Intersektion:** paarweise AABB-/OBB-Überlappung zwischen Meshes verschiedener Baugruppen → unter Toleranz, sonst fail.[20]
2. **Sichtbare Innenseiten:** Raycast von 9 fixen Blickrichtungen, Treffer auf `side: BackSide`-Flächen zählen → fail.[20]
3. **Flacker:** identische Szene in 2 Frames mit leicht variierter Kamera rendern, Pixel-Diff in konstanten Flächen messen (unser S3 hat bereits einen Baseline-Diff-Mechanismus mit `maxDiff 0,002`).[20][Projektquelle: `tests/visual.spec.mjs`]
4. **Bauteil-Kohäsion:** Mindestabstand zwischen benachbarten Baugruppen-Teilen.[20]

**Warum wirksamer als Prompt-Tuning:** Nach 3JSBench sind das genau die Fehler, an denen jedes Modell scheitert — auch Astra (80 % Passrate heißt: 20 % aller Versuche haben mindestens einen Defekt, meist Intersection/Flicker).[20] Und die Checks wandern **direkt** in die P2-Reparaturschleife zurück (Maßnahme M6 in Abschnitt 2.4: FLARE-Klasse Feedback schlägt exec-only +4,6 pp[17] und exec-refine schlägt NL-Feedback um 3,4–38,8 pp[15]).

**Risiko:** Falsch-Positive bei bewusst berührenden Bauteilen → Toleranzen nötig.[20] Mit 34-KB-Modulen und ≤ 60 k Dreiecken ist die Geometrie klein genug für exakte OBB-Tests.[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]

### M2 — Mesh-Count als eigenes Budget-Kriterium (S4-Erweiterung) + Prompt-Constraint
**Priorität 2 · Aufwand S · Effekt: hoch (belegt)** [20]

3JSBench: `Muse Spark 1.3` erzeugt **Median 995 Meshes / 177 000 Dreiecke**; Astra **45 Meshes** bei **höherer** Passrate.[20] Unser Modell ist also nicht „zu detailliert" — es ist **unstrukturiert**.

**Maßnahmen:**
- (a) **S4 erweitern:** neben `triangles` und `drawCalls` ein `meshCount`-Kriterium (Vorschlag: grün ≤ 120, gelb ≤ 250).[20][Projektquelle: `src/runtime/budget.js`] Unsere aktuellen Labs messen 1 688–12 106 Dreiecke und 30–51 Draw-Calls [Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] — das Mesh-Count-Kriterium ist also **nicht** der Engpass bei *gelungenen* Generierungen; es wird erst relevant, wenn das Modell ausufert.
- (b) **P1-Constraint:** „Bauteile aus maximal N Meshes; wiederholte Teile als **ein** InstancedMesh je Teilefamilie; keine dekorativen Einzel-Meshes." Das steht heute nur implizit im V6-Hyper-Block („Wiederholteile als EIN InstancedMesh je Teilefamilie").[27][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Als **explizite, messbare** Vorgabe mit Grenzwert ist es nach arXiv 2602.15228 wirksamer als die implizite Form [12] — **weil die Spezifität mit In-Context-Belegen gepaart wird** (unser V6-Prompt enthält bereits die Beispiele).
- (c) **Zielwert ableiten:** 3JSBench erlaubt 1 000 Meshes / 200 000 Dreiecke[Projektquelle: GitHub-API-Abruf `src/prompt.js` des 3JSBench-Repos] und Astra nutzt 45. Ein realistisches Ziel für Schul-Didaktik: **40–80 Meshes**.[20][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]

### M3 — Auf `muse-spark-1.3` (nicht `-contributor`) umstellen und `reasoning_effort: "max"` nutzen
**Priorität 3 · Aufwand S · Effekt: hoch (belegt, Mechanismus) + evtl. mittel (Höhe)**[34][18][19]

Meta: `"max"` geht **über** `"xhigh"` hinaus und ist **für `muse-spark-1.3` verfügbar, nicht für `muse-spark-1.3-contributor`**.[34] Beide IDs sind **dasselbe Modell**, unterschieden nur durch Datenvertrags- und Preisbedingungen.[10][unbelegt für die ausdrückliche Gleichheit — Sekundärquelle Mixpeek]

**Warum das für uns zählt:** 3JSBench testet alle Modelle bei **high** Reasoning (`high`).[20] Reasoning-Effort ist ein **belegter** Hebel: E2E-SWE misst über low→xhigh **konsistent steigende pass@1** bei Repo-Generation[18]; Terminal-Bench zeigt für Astra 50,6 % (`low`) → 58,2 % (`max`), also **+7,6 pp**[unbelegt — Sekundärauswertung]. Die Gegen-Evidenz: „thinking helps, but not always", mit möglichen Regressions auf den schwersten Aufgaben[19] — für **eine** definierte, nicht-super-schwere Geometrieaufgabe ist der Erwartungswert aber klar positiv.

**Konkrete Schritte:**
1. `scripts/_gen-one.mjs`: `MODEL` von `muse-spark-1.3-contributor` auf `muse-spark-1.3` ändern.[34][Projektquelle: `scripts/_gen-one.mjs`] **Datenschutz-Checkpoint:** Contributor-Modus erlaubt Meta die Nutzung der Inhalte zum Training; Standard-Modus nicht.[10] Für Schulmaterial ist Standard-Modus die datenschutzfreundliche Wahl — **das ist ein Argument dafür, nicht dagegen.** [10]
2. Prüfen, ob `muse.exe` ein Reasoning-Effort-Flag durchreicht (Meta-API: `reasoning_effort` top-level bei Chat Completions, `reasoning.effort` nested bei Responses API[34]). Wenn das CLI es nicht anbietet: über die OpenAI-kompatible Meta Model API statt `muse.exe` generieren, oder den Effort über den Server-Default setzen.[34][Projektquelle: `scripts/_gen-one.mjs`]
3. **`max_output_tokens` großzügig setzen** — Reasoning-Tokens zählen gegen das Limit und werden zum Output-Preis berechnet; bei Überschreitung wird die sichtbare Antwort abgeschnitten → `finish_reason ≠ stop` → `E-GEN-PARSE`.[34][Projektquelle: `src/runtime/livegen.js`]
4. **Kostenrahmen:**[1][21]
Astra-Preise sind 10/50 USD je Mio. Token[1]; Meta nennt für Muse Spark 1.3
 (Standard) 1,25/0,15 cached/4,25 USD je Mio. Token, Contributor deutlich darunter[unbelegt — Sekundärquelle]. threejseval listet Muse Spark 1.3
 bei **0,002 $ pro Eval**[21] — unsere Generierungskosten sind also vernachlässigbar; `max`-Reasoning hebt sie auf ein Vielfaches, aber die **absolute** Zahl bleibt klein.[1][21][unbelegt — nur Sekundärquelle Mixpeek]

### M4 — Prompt-Hygiene: redundante Constraints entfernen, harte Zahlen priorisieren, kein-Markdown-Fence explizit
**Priorität 4 · Aufwand S · Effekt: mittel (belegt, Mechanismus)** [12][20]

**Belege:** Spezifität wirkt **nicht monoton**[12]; Redundanz ist nach diesem Befund kein „Mehr ist besser". Der 3JSBench-Gemini-Befund zeigt 55/300 Fences mit nur 1 bestandenen Versuch[20] — ein **Format**-Fehler, der den ganzen Versuch kostet.

**Konkrete Änderungen an `prompts/p1-generate.txt` (aktuell 14 Zeilen, redundante Zeilen 11+12):**[12][20][Projektquelle: `prompts/p1-generate.txt`]
- (a) **Deduplizieren:** Zeile 11 und Zeile 12 wiederholen „Du beendest die Ausgabe nach dem letzten Export" wörtlich; Zeile 12 wiederholt zusätzlich „Du lieferst nur das Modul ohne Erklärungstext".[Projektquelle: `prompts/p1-generate.txt`] → **einmal** formulieren. Ebenso das Budget doppelt (Zeile 7 + REALISMUS-Block) → einmal, mit **einer** Zahl (V6 schärfer: 34 KB Modul, 60 k Dreiecke, 350 Draw-Calls).[Projektquelle: `prompts/p1-generate.txt`, `prompts/gen-si-1-v6hyper400.txt`]
- (b) **Fence-Verbot explizit:** „Gib **reinen** JavaScript-Modulecode aus.[20] **Keine** Markdown-Code-Fences (```), **keine** Erklärung, **keine** Dateiendung." — 3JSBench zeigt, dass das der teuerste Einzelhebel bei unkooperativen Formaten ist[20].
- (c) **Import-Allowlist als Signaturliste** statt Prosa:[12] die V6-Hyper-Prompts tun das bereits („Erlaubte Imports aus three (ABSCHLIESSEND, exakt diese Namen)") — diese Form **in P1 übernehmen**. Das ist „Spezifität + In-Context-Beleg" im Sinne von arXiv 2602.15228[12].
- (d) **Zahlen mit Einheit und Ampel-Korridor** (aktuell schon vorhanden, aber uneinheitlich zwischen P1 „150000/400" und V6 „60000/350"): **eine** Quelle der Wahrheit — idealerweise aus `src/runtime/budget.js` (DEFAULT_BUDGET_LIMITS + TRAFFIC) **generiert**, damit Prompt und Gate nicht auseinanderlaufen.[Projektquelle: `src/runtime/budget.js`] Das ist ein Build-Schritt, kein Handpflege-Schritt.[Projektquelle: `scripts/build.mjs`]

**Erwarteter Effekt:** Weniger Token, weniger Konflikt, weniger Fehlerquelle.[12][20] Der Effekt ist **nicht** „mehr Qualität durch mehr Text", sondern weniger Rauschen — genau das, was die Evidenz stützt.[12]

### M5 — Explizite Bauteilliste + Checkliste in P1 statt Mindestanforderungen
**Priorität 5 · Aufwand M · Effekt: mittel-hoch (belegt) + hoch (projektintern)**[20][Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`]

**Beleg:** 3JSBench prüft 696 **deterministische** Checks in sechs Familien, und genau diese Prüfbarkeit erzeugt die Trennschärfe des Benchmarks.[20] Checklist-basierte Rewards verbessern Frontend-Codegen messbar (+3,4–6,5 % zero-shot accuracy, 2–3× token-effizienter als CoT)[unbelegt — nur Sekundärfund].

**Projektstatus:** Die V6-Hyper-Prompts enthalten bereits **exakte** Bauteillisten mit Maßen, Label-Positionen und Leveln — und diese 9 Labs sind 9/9 in Iteration 1 grün.[Projektquelle: `dist/AUFTRAG-REPORT-2026-10-27.md`] **Das funktioniert.** Die generischen P1/P2-Prompts tun es nicht.

**Maßnahme:** Die V6-Struktur (AUFGABE-Block mit exakten Maßen + Label-/Messungs-Spezifikation) wird zum **Standardformat** aller Prompts.[Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Zusätzlich: Die Checkliste muss **verifizierbar** sein — jede Zeile sollte einem S5-Kriterium entsprechen.[Projektquelle: `src/runtime/didactics.js`] Heute prüft S5 `labels ≥ 3` und `measurements ≥ 1`; mit der Checkliste im Prompt kann S5 auf **exakte** Soll-Werte prüfen (5 Labels, 1 Messung, IDs `m1`).[Projektquelle: `src/runtime/verify.js`]

**Formulierungsregel aus der Evidenz:** Die Checkliste sollte **Anforderungen** formulieren, nicht **Verfahren**[30][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] („5 Labels: Mainboard, CPU, Arbeitsspeicher, Grafikkarte, Netzteil" statt „beschrifte die Hauptbauteile"). arXiv 2311.14904 zeigt, dass prozedural-planende Prompts unpräzise Pläne erzeugen[30] — **Anforderungslisten sind robuster als Verfahrensanweisungen**.

### M6 — P2 auf Browser-Feedback umstellen (S2/S3/S4-Messwerte in das Fehlerprotokoll) + Iterationsgrenze auf 2
**Priorität 6 · Aufwand M (nach M1) · Effekt: mittel (aktuell), hoch als Notfallpfad**[15][17]

**Aktueller Stand:** P2 bekommt „[Schicht] [Meldung] [Messwerte]" — aber die Messwerte stammen faktisch nur aus S1/S5, da S2–S4 Node-seitig `skip` sind.[15][17][Projektquelle: `src/runtime/verify.js`]

**Beleg:** exec-refine hat den höchsten Pass@1 aller Refinement-Methoden (+3,4–38,8 pp); FLARE (feingranulares Diagnose-Feedback) schlägt exec-only um 4,6 pp (LiveCodeBench) bzw. 4,7 pp (BigCodeBench).[15][17] Gegenbeleg: **Self-Refine ohne Ausführung reduziert Korrektheit in 16 von 21 Fällen** — die Modell-Selbstkritik ist schädlich, die **messbare** Rückmeldung ist es nicht.[16]

**Maßnahme:**
- (a) S2/S3/S4-Messwerte (Intersektionszahl, Sichtbare-Innenseiten-Zahl, Flacker-Pixel-Diff, Tri/Draw/meshCount/FPS) **als konkrete Zahlen** in das P2-Protokoll schreiben, nicht nur als Layer-Pass/Fail.[15][17] Aktuell: `crit(id, verdict, expected, actual)` liefert `expected`/`actual` — die Werte existieren also bereits, werden aber nicht in den P2-Prompt gespiegelt.[Projektquelle: `src/runtime/verify.js`]
- (b) **Fehlermeldung mit Ort und Sollwert:** „S2-Intersect: 3 Bauteilpaare überschneiden sich (Soll 0). Betroffen: [Bauteilliste]. Max. Eindringtiefe 4,2 mm." — statt „S2 failed".
- (c) **Iterationsgrenze von 3 auf 2 senken** (ECCO: alle Methoden degradieren Pass@1 über Iterationen[15]), mit Iteration 3 als manueller Reserve.
- (d) **P2 darf keine neuen Bauteile/Imports hinzufügen** (steht schon in P2 — beibehalten; entspricht arXiv 2311.14904: Modularisierung bringt bis zu 30 %, aber Planung darüber nur marginal[30] → Umbau ist riskanter als Reparaturschleife).

### M7 — Eigene Eval-Harness auf Basis der 3JSBench-Tasks (MIT-lizenziert)
**Priorität 7 · Aufwand M · Effekt: hoch (methodisch, für alle anderen Maßnahmen) — mit Vorbehalt**[20][32][35]

**Die Lücke, die alle anderen Maßnahmen betrifft:** Wir haben **keine** eigene messbare Qualitätsmetrik für 3D-Qualität.[Projektquelle: `src/runtime/verify.js`] Unser Verify-Loop sagt „S1/S5 pass", aber „pass" heißt **vertragskonform**, nicht **gut aussehend** oder **geometrisch korrekt**.[20][Projektquelle: `src/runtime/verify.js`] Ohne eigene Metrik können wir keine der Maßnahmen M1–M6 empirisch validieren.[20]

**Die Chance:** Das 3JSBench-Repo ist **MIT-lizenziert** und enthält **100 Task-Briefings** unter `tasks/<name>/prompt.md`, jeweils ein Einzeiler[35][Projektquelle: GitHub-API-Abruf, 100 Task-Verzeichnisse bestätigt] (z. B. „a banjo leaning on a wooden stool, a round drum body with visible tension brackets around the rim, a long neck with frets and tuning pegs, five strings").[Projektquelle: GitHub-API-Abruf `tasks/banjo-against-stool/prompt.md`, bestätigt 100 Task-Verzeichnisse, MIT-Lizenz][20][32] Dazu ein einspeisbarer Generator (`tools/3jsbench.js`, OpenAI-kompatibel via `--base-url`) mit demselben System-Prompt für alle Modelle (Three.js 0.184.0, max. 1 000 Meshes, 200 000 Dreiecke, nur `three`, kein Texture-/Datei-Loading, +Y oben, Roh-TypeScript ohne Markdown).[Projektquelle: GitHub-API-Abruf `src/prompt.js`]

**Wichtig — der Verifier-Code fehlt:** „We will release the verifier/grader source code with the paper coming soon."[35][Projektquelle: GitHub-README] Der Grader ist also **nicht** verfügbar; die *Briefings* aber schon.

**Maßnahme:**
- (a) Die 100 Briefings als **eigenes Regression-Set** übernehmen (MIT-Lizenz prüfen und vermerken) und **unseren** Verify-Loop als Grader nutzen — wir haben S1–S5 und Playwright bereits.[35][Projektquelle: `tests/`, `src/runtime/verify.js`]
- (b) **Eigene** deterministische Checks ergänzen (M1) statt den fehlenden 3JSBench-Grader zu erwarten.[20][35]
- (c) **Modellvergleich intern laufen lassen:** `muse-spark-1.3` (contributor vs. Standard, `high` vs. `max`) über dieselben 100 Briefings → eigene Zahlen statt Marketplace-Ranglisten.[34][20]
- (d) **Prompt-Versionen A/B testen:** mit demselben Set messen, ob M4/M5/M6 etwas bewirken.[12][20] Ohne diese Messung bleiben alle Prompt-Maßnahmen **Anekdoten** — und These 2 verlangt genau diese Trennung.[12]

**Vorbehalt:** Die 3JSBench-Tasks sind **statische Objekt-Szenen** ohne Animation, Physik oder Interaktionslogik[unbelegt — nur Sekundärbefund] und messen **nicht** unsere didaktischen Anforderungen (Labels, Messungen, Niveaus). Sie sind ein **Geometrie-Benchmark**, kein SkillSpark-Benchmark.[20][unbelegt — nur Sekundärbefund] Ein eigener, didaktischer Benchmark-Satz ist zusätzlich nötig.[Projektquelle: `src/runtime/didactics.js`]

### M8 — Materialqualität: `MeshPhysicalMaterial` (clearcoat/anisotropy) **und** DataTexture-Mikrostruktur gezielt einsetzen
**Priorität 8 · Aufwand M · Effekt: mittel (Realismus), begrenzt durch iGPU-Budget**[26][29]

**Belegte Grenze:** PBR-Parameter codieren eine Materialklasse, nicht eine Oberfläche; ohne Maps fehlt Mikrostruktur[26][29]. `MeshPhysicalMaterial` erweitert um `clearcoat` (Lack), `clearcoatRoughness`, `anisotropy`, `iridescence`, `sheen`, `transmission` — das sind die Eigenschaften, die „Lack", „gebürstetes Metall" und „Glas" von „Plastik" unterscheiden.[29] Das PBR Book nennt Anisotropie und Klarlack als zentrale Produktions-PBR-Mechanismen[29].

**Maßnahme (priorisiert nach Kosten/Nutzen):**[26][29]
1. **Hoch, günstig:** DataTexture-Mikrostruktur gezielt für die **beiden** Materialklassen, die am sichtbarsten sind (Metall: gebürstete Normal-Map, 128²; lackiertes Blech: leichte Roughness-Variation).[26][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`] Unser V6-Block kann das bereits („Leiterbahnen, Aetzung, Buerstmetall, Typenschilder") — **pro Bauteilklasse benennen statt pauschal**.[26][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]
2. **Mittel, teuer:** `MeshPhysicalMaterial` **nur** für lackierte Blechflächen (Gehäuse, Blenden) mit `clearcoat: 0.35, clearcoatRoughness: 0.25` — **kein** Global-Einsatz (Shaderkosten auf Schul-iGPUs).[29][Projektquelle: `src/runtime/budget.js`]
3. **Ausdrücklich nicht:** `transmission`/`iridescence`/`sheen` — Shaderkosten und „Füllrate-Falle" auf iGPUs bei 30+ Meshes und 60 k Dreiecken.[29][Projektquelle: `src/runtime/budget.js`]

**Rationale der Priorisierung:** Der Engpass ist **nicht** die Materialqualität, sondern die Geometrie (Abschnitt 4.2).[20] M8 ist die **Letzte** der acht, weil sie den teuersten Shader-Pfad ohne Behebung des Hauptengpasses geht.[20] Sie ist aber der Grund, warum unser Materialblock („PBR mit materialgerechten Werten") überhaupt trägt — die Arbeit ist getan, die **Dosierung** muss gezielt werden.[Projektquelle: `prompts/p1-generate.txt`]

---

## 6.1 Rangliste auf einen Blick

| # | Maßnahme | Aufwand | Effekt | Evidenzgrad |
|---|---|---|---|---|
| **M1** | S2/S3-real: deterministische Geometrie-Checks (Intersection, Backface, Flicker, Kohäsion) | L | hoch | Benchmark-Methodik[20] + Refinement-Evidenz[15][17] |
| **M2** | Mesh-Count als Budget-Kriterium + P1-Constraint | S | hoch | Direkt belegt für unser Modell[20] |
| **M3** | `muse-spark-1.3` statt `-contributor` + `reasoning_effort: "max"` | S | hoch (Mechanik) / evtl. mittel (Höhe) | API-Doku[34] + Effort-Studien[18][19] |
| **M4** | Prompt-Hygiene: Deduplizieren, Zahlen priorisieren, kein-Markdown-Fence | S | mittel | Nicht-monotone Spezifität[12] + Fence-Befund[20] |
| **M5** | Explizite Bauteilliste + Checkliste statt Mindestanforderungen | M | mittel-hoch | Checklist-Rewards + deterministische Checks[20] |
| **M6** | P2 mit Browser-Messwerten; Iterationsgrenze 2 | M | mittel (jetzt) / hoch (Notfallpfad) | exec-refine + FLARE[15][17], Gegenbeleg Self-Refine[16] |
| **M7** | Eigene Eval-Harness auf 3JSBench-Briefings (MIT) | M | hoch (methodisch) | Verfügbare Daten[35], Grader fehlt[35] |
| **M8** | Material: gezielte DataTexture-Mikrostruktur, `MeshPhysicalMaterial` sparsam | M | mittel | PBR-Book[29] + three.js-Doku[26] |

**Empfohlene Reihenfolge:** M2 → M3 → M4 → M5 (alle S/M, jeweils isolierbar messbar) → **M7** (Eval-Harness, damit die folgenden messbar werden) → M1 → M6 → M8.[20]

**Sofort ohne Vorbedingung umsetzbar:** M2, M3, M4 (Aufwand je S).[34][20]
**Braucht M7 als Grundlage:** M1, M5, M6.[35][20]

---

## 7. Offene Fragen und Datenlücken

Ehrliche Kennzeichnung dessen, was **nicht** belegt oder **nicht** verifiziert wurde:[Projektquelle: `docs/ki-modellqualitaet-recherche.md`]

1. **Kein Benchmark misst SkillSpark didaktische Qualität.** Alle sechs Benchmarks messen Geometrie, Ästhetik, Verhalten oder agentisches 3D-Erlebnis[20][21][39] — **keine** misst Label-Qualität, Messungs-Korrektheit, Niveautrennung (basis/aufbau/profi) oder Einheitenprüfung im generierten Code. **M7 + ein eigener didaktischer Benchmark-Satz sind zwingend.** Ohne das ist „Modellqualität" für unseren Zweck undefiniert.[20][39][Projektquelle: `src/runtime/didactics.js`]
2. **M7 ist nicht 1:1 anwendbar.** Der 3JSBench-Grader-Code ist nicht veröffentlicht[GH-README → [35]]; die 100 Briefings aber schon (MIT). Unsere Labs sind außerdem deutlich komplexer (Bauteillisten, Maße, Labels, 5 Niveaus) als 3JSBench-Tasks (Einzeiler-Briefings).[20][Projektquelle: `prompts/gen-si-1-v6hyper400.txt`]
3. **Die genaue Höhe des `max`-Reasoning-Effekts für `muse-spark-1.3` auf 3D-Code ist unbekannt.** Die belegten Zahlen (+7,6 pp Terminal-Bench low→max, +2–3 pp Durchschnitt) stammen aus **anderen Aufgaben und anderen Modellen**[18][19][unbelegt]. M3 ist deshalb ein **billiger Test**, keine validierte Optimierung.[34][18]
4. **Ob `muse.exe` ein Reasoning-Effort-Flag durchreicht, ist ungeprüft.**[34] Bei reinem `muse exec --model … --prompt-file …` gibt es keine Stelle, an der `reasoning_effort` gesetzt würde.[Projektquelle: `scripts/_gen-one.mjs`] Falls das CLI es nicht anbietet, ist ein Wechsel auf den direkten Meta-API-Weg nötig (mit Key-Handling-Anpassung in `scripts/_gen-one.mjs`).[Projektquelle: `scripts/_gen-one.mjs`]
5. **Text-to-3D Inline-Größen sind nur grob belegt.** Die 0,5–19,8-MB-Messungen stammen aus einer Sekundärquelle[unbelegt]. Für eine belastbare Rechnung müssten GLBs konkret mit unserem Budget (34 KB Modul, 150 k Dreiecke) durchgerechnet werden — inklusive Base64-Overhead (+33 % laut Khronos glTF-Spezifikation)[unbelegt].
6. **Die Relation von „Prompt-Ähnlichkeit" (+0,011 für Astra) zu didaktischer Qualität ist unbekannt.** Es ist ein deskriptives Bildsignal, das „does not establish geometric correctness or change a grade"[20] — für uns als Signal nutzbar, aber nicht validiert.
7. **Wenige 3D-Benchmarks sind aktuell.** 3JSBench hat 13 Modelle, threejseval 39, WorldBench 5 (Live-Board 6), AA-3D 23.[20][21][7]
Für statistische Robustheit sind die Intervalle breit (±4,5 bis ±15 Elo) — **die Rangfolgen zwischen benachbarten Modellen sind oft nicht signifikant.** Jede Aussage „Modell X schlägt Modell Y" sollte das angeben.[20][21][39]

---

## 8. Quellenverzeichnis

Alle Quellen am **27.10.2026** abgerufen. Nummerierung entspricht den Zitaten im Text. Die maschinenlesbare Fassung (id → URL) steht am Dokumentende unter `## Sources`.[Projektquelle: Ledger `cache/citations/ledger.json`]

### Primärquellen (Hersteller, Benchmarks, Repositories)

| Nr | Herausgeber / Titel | Datum | URL |
|---|---|---|---|
| 1 | OpenAI — „GPT-6 Astra: A new generation of intelligence" | 3.9.2026 | https://openai.com/index/gpt-6-astra/ |
| 2 | OpenAI — „Introducing GPT-6 Sol and Luna" | 22.9.2026 | https://openai.com/index/introducing-gpt-6-sol-and-luna/ |
| 3 | OpenAI — „GPT-6 and Intelligent UI for everyone" | 7.10.2026 | https://openai.com/index/gpt-6-for-everyone/ |
| 4 | OpenAI Help Center — „ChatGPT Release Notes" | laufend | https://help.openai.com/en/articles/6825453 |
| 5 | OpenAI — „All models \| OpenAI API" | Abruf 27.10.2026 | https://developers.openai.com/api/docs/models/all |
| 6 | General Context Labs — 3JSBench (Forschungsseite) | 5.10.2026 | https://generalcontextlabs.com/research/threejs |
| 7 | Bakshi, K. — „WorldBench: Evaluating LLMs on Three.js Voxel World Generation", arXiv:2610.10622 | Okt 2026 | https://arxiv.org/html/2610.10622v1 |
| 8 | benchmark.ai — „Text-To-3D With LLM Code Leaderboard" | Stand 21.10.2026 | https://www.benchmark.ai/text-to-3d-code |
| 9 | Artificial Analysis — „AI Model Evaluations" (Übersichtsseite) | Abruf 27.10.2026 | https://artificialanalysis.ai/evaluations |
| 10 | Meta — „Models \| Meta Model API" (Muse Spark 1.3 / Muse Wonder) | Abruf 27.10.2026 | https://dev.meta.ai/docs/models |
| 11 | Meta AI Research — „Introducing Muse Spark 1.3" | 2.9.2026 | https://research.meta.ai/blog/introducing-muse-spark-1-3 |
| 12 | arXiv:2602.15228 — System-Prompt-Spezifität, Modellskalierung, Prompting-Strategien und Sprache bei Code-Assistenten | 2026 | https://arxiv.org/html/2602.15228v1 |
| 13 | arXiv:2510.16809 — „When Many-Shot Prompting Fails: An Empirical Study of LLM Code Translation" | 2025 | https://ar5iv.labs.arxiv.org/html/2510.16809 |
| 14 | Chalmers — „CodePromptEval: The Impact of Prompt Programming on Function-Level Code Generation" (PDF) | 2026 | https://research.chalmers.se/publication/547601/file/547601_Fulltext.pdf |
| 15 | arXiv:2407.14044 — „ECCO: Can We Improve Model-Generated Code Efficiency Without Sacrificing Functional Correctness?" | 2024 | https://arxiv.org/html/2407.14044v1 |
| 16 | MDPI — „Reassessing One-Round Test-Time Refinement for Code Generation" | 2026 | https://www.mdpi.com/2673-2688/7/9/353 |
| 17 | arXiv:2606.03852 — „FLARE: Fine-Grained Diagnostic Feedback for LLM Code Refinement" | 2026 | https://arxiv.org/html/2606.03852 |
| 18 | arXiv:2609.38335 — „E2E-SWE: Benchmarking LLMs on Building Working Repositories" | 2026 | https://arxiv.org/html/2609.38335v1 |
| 19 | ACM — „How LLMs Fail in Code Generation: A Cross-Benchmark and Unified Fine-Grained Error Taxonomy" | 2026 | https://dl.acm.org/doi/10.1145/3838938.3838941 |
| 20 | 3JSBench — Live-Board, Leaderboard + Methodik | Abruf 27.10.2026 | https://3jsbench.com/ und https://3jsbench.com/methodology |
| 21 | threejseval — „Arena Ranking" (27 030 Stimmen, 39 Modelle) | Stand 27.10.2026 | https://threejseval.com/ranking |
| 22 | threejseval — „Methodology" v0.3 | 30.9.2026 | https://threejseval.com/methodology |
| 23 | MIT CSAIL CDFG — „On the Opportunities and Risks of Frontier Models for 3D Modeling, Computational Design and Robotics" (Living Survey) | laufend | https://mit-cdfg.github.io/Survey-AI-for-3D-modeling-Robotics/ |
| 24 | Cinevva — „Best AI 3D Model Generators in 2026" | publ. 17.7.2026, upd. 14.9.2026 | https://app.cinevva.com/guides/ai-3d-model-generators |
| 25 | Replicate — „3D Models Collection" (Hunyuan3D 3.1, TRELLIS.2, Rodin) | Abruf 27.10.2026 | https://replicate.com/collections/3d-models |
| 26 | three.js — „MeshStandardMaterial" | Abruf 27.10.2026 | https://threejs.org/docs/pages/MeshStandardMaterial.html |
| 27 | three.js — „InstancedMesh" | Abruf 27.10.2026 | https://threejs.org/docs/pages/InstancedMesh.html |
| 28 | three.js Manual — „Canvas Textures" | Abruf 27.10.2026 | https://threejs.org/manual/pages/canvas-textures.html |
| 29 | PBR Book (3. Auflage) — „Solid and Procedural Texturing" | 2018 | https://pbr-book.org/3ed-2018/Texture/Solid_and_Procedural_Texturing |
| 30 | arXiv:2311.14904 — „LLM-Assisted Code Cleaning For Training Accurate Code Generators" | 2023 | https://arxiv.org/html/2311.14904v1/ |
| 31 | arXiv:2303.06689 — „Self-planning Code Generation with Large Language Models" | 2023 | https://www.alphaxiv.org/abs/2303.06689 |
| 32 | three.js Forum — „3JSBench: A benchmark for LLM-generated Three.js objects" (frvnk) | 9.10.2026 | https://discourse.threejs.org/t/3jsbench-a-benchmark-for-llm-generated-three-js-objects/95137 |
| 33 | Hugging Face — Scene3D-Bench / WorldCoder-Bench Datensatz (shuolucs) | Abruf 27.10.2026 | https://huggingface.co/datasets/shuolucs/WorldCoder-Bench/commit/cb92fdb1b5c4d7fb1f0bbab39fc0c6481c6cd7f7 |
| 34 | Meta — „Reasoning \| Meta Model API" (`reasoning_effort`; `max` nur für `muse-spark-1.3`) | Abruf 27.10.2026 | https://dev.meta.ai/docs/reasoning |
| 35 | GitHub — GeneralContext/3jsbench (Autor: frvnkliu / Frank Liu) | Abruf 27.10.2026 | https://github.com/frvnkliu |
| 36 | T3Bench — „Benchmarking Current Progress in Text-to-3D Generation" (arXiv:2310.02977) | 2023, Stand Abruf 27.10.2026 | https://t3bench.com/ |
| 37 | arXiv:2608.24857 — „Prompt Structure Redistributes, Not Reduces: Security-Weaknesses in LLM-Generated Python Code" | 2026 | https://arxiv.org/pdf/2608.24857 |
| 38 | arXiv:2604.00824 — „Yet Even Less Is Even Better For Agentic, Reasoning, and Coding LLMs" | 2026 | https://arxiv.org/html/2604.00824 |
| 39 | Artificial Analysis — „AA-3D: Interactive 3D Experience Benchmark" (55 Tasks, Stirrup) | Abruf 27.10.2026 | https://artificialanalysis.ai/evaluations/aa-3d |

### Lokale Projektquellen (nicht Web, aus `C:/Users/flori/OneDrive/skillSpark`)
- `prompts/p1-generate.txt`, `prompts/p1-generate.v5-budget400.txt`, `prompts/p2-repair.txt`, `prompts/gen-*-v6hyper400.txt`
- `src/runtime/verify.js` (S1–S5-Orchestrierung, `skipLayer()`), `src/runtime/guard-static.js` (Import-Allowlist, Verbotsliste, Größenprüfung), `src/runtime/budget.js` (`DEFAULT_BUDGET_LIMITS`, `TRAFFIC`), `src/runtime/didactics.js` (Manifest/Niveaus), `src/runtime/livegen.js` (SSE-Parsing, `E-GEN-PARSE`)
- `dist/AUFTRAG-REPORT-2026-10-27.md` (10/10 Labs grün, 0 P2-Repairs, 36/36 Unittests, 28/28 Playwright), `dist/BUDGET-NACHTRAG-2026-10-27.md` (Draw-Call-Limit 120→400)

### Als **[unbelegt]** gekennzeichnete Aussagen
Bewusst nur als Sekundärbefund oder als rechnerische Ableitung verwendet, jeweils im Text gekennzeichnet: Mixpeek „Same model"-Aussage zu Muse Spark 1.3 vs. `-contributor`; Opus-5.5-Wert 54,4 % bei FrontierCode 1.1 Main; Terminal-Bench-Effekt-Ladder low→max (+7,6 pp) aus Sekundärauswertung; GLB-Größen 0,5–19,8 MB; Base64-Overhead +33 %; 3JSBench-Tasks ohne Animation/Physik/Interaktion; 3DGen-Bench-Zahlen (11 200 Assets / 68 000 Stimmen / 47 Experten); CYCLE-, Self-Refine-Original, Planning-Survey, CODEPLAN und Modular-Imperative-Fundstellen; „Text-to-3D nur bildkonditioniert" für Hunyuan3D/TRELLIS.2; Extrapolation der Reasoning-Effekt-Höhe auf 3D-Code.

## Sources

[1] https://openai.com/index/gpt-6-astra/
[2] https://openai.com/index/introducing-gpt-6-sol-and-luna/
[3] https://openai.com/index/gpt-6-for-everyone/
[4] https://help.openai.com/en/articles/6825453
[5] https://developers.openai.com/api/docs/models/all
[6] https://generalcontextlabs.com/research/threejs
[7] https://arxiv.org/html/2610.10622v1
[8] https://www.benchmark.ai/text-to-3d-code
[9] https://artificialanalysis.ai/evaluations
[10] https://dev.meta.ai/docs/models
[11] https://research.meta.ai/blog/introducing-muse-spark-1-3
[12] https://arxiv.org/html/2602.15228v1
[13] https://ar5iv.labs.arxiv.org/html/2510.16809
[14] https://research.chalmers.se/publication/547601/file/547601_Fulltext.pdf
[15] https://arxiv.org/html/2407.14044v1
[16] https://www.mdpi.com/2673-2688/7/9/353
[17] https://arxiv.org/html/2606.03852
[18] https://arxiv.org/html/2609.38335v1
[19] https://dl.acm.org/doi/10.1145/3838938.3838941
[20] https://3jsbench.com/
[21] https://threejseval.com/ranking
[22] https://threejseval.com/methodology
[23] https://mit-cdfg.github.io/Survey-AI-for-3D-modeling-Robotics/
[24] https://app.cinevva.com/guides/ai-3d-model-generators
[25] https://replicate.com/collections/3d-models
[26] https://threejs.org/docs/pages/MeshStandardMaterial.html
[27] https://threejs.org/docs/pages/InstancedMesh.html
[28] https://threejs.org/manual/pages/canvas-textures.html
[29] https://pbr-book.org/3ed-2018/Texture/Solid_and_Procedural_Texturing
[30] https://arxiv.org/html/2311.14904v1/
[31] https://www.alphaxiv.org/abs/2303.06689
[32] https://discourse.threejs.org/t/3jsbench-a-benchmark-for-llm-generated-three-js-objects/95137
[33] https://huggingface.co/datasets/shuolucs/WorldCoder-Bench/commit/cb92fdb1b5c4d7fb1f0bbab39fc0c6481c6cd7f7
[34] https://dev.meta.ai/docs/reasoning
[35] https://github.com/frvnkliu
[36] https://t3bench.com/
[37] https://arxiv.org/pdf/2608.24857
[38] https://arxiv.org/html/2604.00824
[39] https://artificialanalysis.ai/evaluations/aa-3d
