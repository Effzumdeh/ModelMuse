# Analyse: Historie + Konzepte — Meta-Hackathon / ModelMuse

**Stand:** 29.10.2026 · **Repo:** `C:/Users/flori/OneDrive/modelMuse` (Branch `main`, HEAD `292494e` + uncommittete Änderungen)
**Konzeptebene:** `C:/Users/flori/OneDrive/` (Fachkonzept-Pakete) und `OneDrive/modelMuse/docs/` (Umsetzungsdokumente)
**Methodik:** Auswertung der Hermes-Session-Historie (FTS5-Volltextsuche über `researcher`-/`default`/`coder`/`designer`-Profil-DBs, 1011 + 113 Sessions gesichtet), der Git-Historie (7 Commits, 4 Tags), der Muse-Call-Ledger (32 + 27 Einträge) und der 26 Konzept-/Belegdokumente.

> **Belegregel:** Jede Aussage in diesem Bericht ist gegen eine Primärquelle aus dem Repo, der Session-Historie oder einem Messprotokoll geprüft. Wo die Quellen sich widersprechen, ist der Widerspruch als solcher ausgewiesen (Abschnitt 7). Wo keine Quelle existiert, steht „nicht belegt" — es wird nichts ergänzt.

---

## 1. Executive Summary

**Was das Projekt ist:** ModelMuse ist ein clientseitiger Single-Page-Generator, mit dem Lehrkräfte per Muse-Spark-Code interaktive 3D-/2D-Lernmodelle erzeugen. Ausgeliefert wird ausschließlich `dist-standalone/modelmuse-standalone.html` (276.648 Bytes, GitHub-Pages-tauglich). Ein Build-Verify-Loop prüft jedes erzeugte Modell in vier Schichten (S1 Codeform/Verbote → S2 Geometrie → S3 Rendering → S4 Budgets → S5 Didaktik) mit max. 2 automatischen Reparaturrunden + 1 manueller Reserve.

**Die inhaltliche Kernaussage des Projekts** in einem Satz: *Ein LLM schreibt keinen 3D-Code, sondern eine deklarierte Spezifikation; eine deterministische Baustein-Bibliothek führt sie aus, damit halluzinierte Physik strukturell statt nachträglich eliminiert wird* (`meta-hackathon-gesamt-v2.md`, Architektur-Axiom, Session `20261022_204726_5df61dfc`).

**Die drei Architekturentscheidungen, die das Projekt tragen:**
1. **Verifier vor Generator** (FI-Fachkonzept §11): „Wer erst den Generator baut und dann den Prüfer, hat am Ende einen Prüfer, der den Generator nicht behindert — genau die Selbstbestätigung, die das Projekt vermeiden will."
2. **Messwerte statt Selbstbewertung**: Der Repair-Loop bekommt numerische Soll/Ist-Werte mit Einheit, nicht Screenshot-Ästhetik.
3. **3D nur, wo 3D lehrt**: Der P0-Router trennt räumliche von diagrammatischen Inhalten; 6 von 12 Labs wurden deshalb auf SVG-Datenmodule umgestellt.

**Die wichtigste Erkenntnis aus der Recherche** (`docs/ki-modellqualitaet-recherche.md`): Es gibt kein „bestes 3D-Modell". Die sechs 3D-Benchmarks messen **verschiedene Achsen** (geometrische Korrektheit vs. menschliche Ästhetik vs. agentisches 3D-Erlebnis), und ihre Ranglisten widersprechen einander. Muse Spark 1.3 liegt in 3JSBench bei 10,7 % Passrate (Platz 11/13), dreijseval Platz 23/39 (Elo 1435), AA-3D Platz 9/23. Der eigene Fehlermodus ist benannt: **995 Meshes im Median, 33 % der Versuche flackern**.

**Entwicklungshistorie in Zahlen:** 8 Tage, ~60+ Sessions über 4 Hermes-Profile, 59 dokumentierte Muse-Calls, 7 Git-Commits, 1 großer Fachkonzept-Pivot (Elektro → Fachinformatiker), 1 Architektur-Pivot (deklarativ → Code-Gen), 1 Produkt-Pivot (OpenRouter → Baseten), 1 Endprodukt-Pivot (Lab-Player → Standalone-only), 1 Modeller-Wipe mit Empty-Stand und anschließender Wiederherstellung.

**Kritische Lage:** Der aktuelle Arbeitsstand trägt **eine dokumentierte Divergenz zwischen Beleg und Artefakt**. Die Datei `dist-standalone/STANDALONE-REPORT-2026-10-29.md` beschreibt den EMPTY-STAND (117.574 B, 0 Modelle, `test:unit` 140/148 rot) — das aktuelle Artefakt hat jedoch 276.648 B, 5 eingebettete Modelle und grüne Unit-Tests laut README. Details und Auflösungspfad in Abschnitt 7.

---

## 2. Entwicklungs-Historie: Meilensteine mit Zeiten

### 2.1 Phase 0 — Bewerbung (07.–13.10.2026)

| Zeit | Ereignis | Beleg |
|---|---|---|
| 07.10. 00:41 | Session „Close session and update skills docs" (Telegram, `20261007_004117_a6ff192f`, 184 Msg). Hackathon-Bewerbung: Indie Dev Track, FernUniversität Hagen. PULSEWALL (5.496-Zeilen-Single-File-Three.js) wird als Techniknachweis eingebracht: „Developed agentically in a single Hermes session across 10 iterative stages — ship, obstacles, scoring with local high scores, responsive HUD". | Notion-Page „Meta-Hackathon-Bewerbung Okt 2026" |
| 13.10. 22:13 | Session „Skills in Hermes aktualisieren, Notion dokumentieren" (`20261013_221301_0e146630`). Bewerbungsentwurf landet in `meta-hackathon-application.md`, **5 TODO-Felder offen** (LinkedIn, X, Ort, Studium, Quelle). Einreichung rollierend bis 20.000 Zusagen. | Notion „Meta-Hackathon-Bewerbung Okt 2026" |

**Kernaussage:** Der ursprüngliche Problem-Statement war Lernende der *technischen Berufe* (Elektro, Mechanik, Werkstoffe) gegen statisch gelehrten Stoff bei schwacher Schul-Hardware. Der Nachweis „agentic development" war von Anfang an das Argument.

### 2.2 Phase 1 — Konzeptbau, drei Stränge parallel (22.10.2026, 20:47–22:17)

Eine Telegram-Hauptsession (`20261022_204726_5df61dfc`, 287 Msg) startete **drei parallele Worker-Stränge**:

| Worker | Ergebnis | Größe |
|---|---|---|
| `tech` (→ `meta-hackathon-tech-v2.md`) | Stack- und Architektur-Entscheidung | 451 Z, Teil 1 v2 |
| `architektur` (→ `meta-hackathon-architektur-v2.md`) | Schichtenmodell, Retry-Loop, Datenmodell | 1.080 Z, Teil 2 v2 |
| `fachkonzept` (→ `meta-hackathon-fachkonzept-v2.md`) | Curriculum-Mapping, Didaktik, Verifikation | 719 Z, Teil 3 v2 |

Nachgelagert in **8 Sub-Sessions** (researcher-Profil, `oneshot`, 20:52–22:17, 3–18 min je):

- Architekturmodell für Single-File Tutor-Agent (4 Msg — auffällig kurz, siehe Abschnitt 6)
- Fachkonzept für adaptive Three.js-Lernlabore (99 Msg, 11 min)
- Lücken und Backlog für Meta Hackathon (49 Msg)
- PAKET 2 Lab-Spezifikation und Prompt-Vorlagen (127 Msg, 14 min)
- Meta-Hackathon Demo-Story und Risiko-Checkliste (61 Msg)
- START-READINESS-Konzept mit Offline-Paket und Geräteprobe (140 Msg)
- Review-Runde C: Spec / Demo / Readiness v2 (3 Sessions, 101/147/168 Msg)

**Ergebnis:** `meta-hackathon-gesamt-v2.md` — 4.736 Zeilen, 595 KB, **7 Teile** (Tech, Architektur, Fachkonzept, Backlog, Lab-Spec, Demo, Readiness), Stand 22.10.2026, „Zusammenführung von 7 verifizierten v2-Teilen ohne Kürzung und ohne neue Recherche".

**Die wichtigste Begründung aus dieser Phase** (Architektur-Worker, Session-Output):
> „Das Architekturmodell verzichtet bewusst darauf, das LLM lauffähigen 3D-Code schreiben zu lassen — das Modell erzeugt nur deklarative Lab-Specs, eine deterministische Baustein-Bibliothek führt aus, was halluzinierte Physik strukturell statt nachträglich eliminiert. Der Verifier prüft Messdaten und Invarianten (nicht Pixel), arbeitet komplett regelbasiert und ist deshalb vor dem Generator zu bauen, damit keine Selbstbestätigung entsteht."

### 2.3 Phase 2 — Pivot: Elektro → Fachinformatiker (23.–24.10.2026)

| Zeit | Ereignis |
|---|---|
| 23.10. ca. 20:00 | **User-Korrektur:** „Falscher Ausbildungsberuf. Ich wollte das alles für den ‚Fachinformatiker' bauen" (Session `20261022_204726_5df61dfc`, Msg 43121). Der 454-Zeilen-Fachkonzept-Stand wurde als „druckfertige Fassung" ausgeliefert — und war damit bereits 30 Minuten nach Erstellung überholt. |
| 23.10. ca. 20:05 | Clarify-Frage: „Für welche Fachrichtung des Fachinformatikers?" → Antwort: **„Si, DuP und AE"** (Systemintegration, Daten- und Prozessanalyse, Anwendungsentwicklung). „Digitale Vernetzung bleibt ausgeschlossen." |
| 23.10. 10:23 | Session „Fachinformatiker-Konzept für Meta Hackathon neu erstellen" (`20261023_102258_ff5860`, 200 Msg, 24 min). Budget: max. 8 Web-Suchen, 1 Durchgang. Quellen: KMK-Rahmenlehrplan Fachinformatiker (Beschluss 2020), ARP FIAusbV, Abrufdatum 23.10.2026. |
| 23.10. 11:10 | Session „Erweiterte Lab-Specs für neun FI-Labs" (`20261023_111038_26d7ed`, 261 Msg, **63 min** — die längste Recherche-Session der Projektphase). |

**Ergebnis:**
- `meta-hackathon-FACHKONZEPT-FI-final.md` — 751 Zeilen, 92 KB, 14 Kapitel, Stand 23.10.2026. **Geltende Spec.**
- `meta-hackathon-FI-Labspecs.md` — **8.109 Zeilen**, 370 KB: 9 vollständige Lab-Specs nach Schema-Profil `lab-spec.v1.1-fi`, je mit Aufgaben, Quiz, Verifier-Invarianten, Screenshot-Kriterien, Szenenparametern und vollständigem JSON.

**Die neun Labs (SI / DuP / AE), mit Lernfeld-Bezug und Visualisierungsidee:**

| ID | Titel | KMK-Lernfeld (Zeitrichtwert, AJ) | ARP-Bezug (Wochen) | Visualisierungsidee |
|---|---|---|---|---|
| SI-1 | Netzwerke und Subnetting | LF 3 (80 h, 1. AJ) + LF 9 (80 h, 2. AJ) | Abschn. C Pos. 2: 5 Wo (1.–18. M.) + 6 Wo (19.–36. M.) | 3D-Netztopologie, Adressbänder, Broadcast-Domänen |
| SI-2 | Betriebssysteme, Prozesse, Ressourcen | LF 2 (80 h, 1. AJ) + LF 10b (80 h, 3. AJ) | Abschn. C Pos. 1: 8 + 12 Wo | 3D-Zeitstrahl der Prozesszustände, Ressourcenbalken |
| SI-3 | IT-Sicherheit: Schutzziele, Verschlüsselung | LF 4 (40 h, 1. AJ) + LF 11b (80 h, 3. AJ) | Abschn. C Pos. 2: 6 Wo (19.–36. M.) | 3D-Bitgitter mit Diffusionskaskade, Angriffsvektorpfeile |
| DuP-1 | Datenbanken: ER-Modell, SQL-Joins | LF 5 (80 h, 1. AJ) + LF 8 (80 h, 2. AJ) | Abschn. A Pos. 4: 5 + 7 Wo | 3D-Tabellenwolken, Join-Tunnel, Kardinalitätsfächer |
| DuP-2 | Datenanalyse: Pipelines, Qualität, Kennzahlen | LF 8 (80 h, 2. AJ) + LF 10c (80 h, 3. AJ) | Abschn. D Pos. 2: 5 Wo | 3D-Pipeline mit Datenkubikoden, Qualitäts-Gates |
| DuP-3 | Prozessanalyse: BPMN, Engpässe, Varianten | LF 11c (80 h, 3. AJ) | Abschn. D Pos. 1: 8 Wo | 3D-BPMN-Pool mit Swimlanes, Engpass-Tunnel |
| AE-1 | Zahlensysteme, Rechnerarchitektur | LF 2 (80 h, 1. AJ) + LF 5 (80 h, 1. AJ) | Abschn. A Pos. 4: 5 Wo; Pos. 10: 5 + 10 Wo | 3D-Bitwürfel, Hex-Ziffernband, Adressraum |
| AE-2 | Algorithmen und Sortierverfahren | LF 5 (80 h, 1. AJ) + LF 11a (80 h, 3. AJ) | Abschn. A Pos. 4: 7 Wo (19.–36. M.) | 3D-Balkenarray mit Sortierbewegung, Tauschzähler |
| AE-3 | Programmierung, Modultests, Abnahme | LF 11a (80 h, 3. AJ) + LF 12a (120 h, 3. AJ) | Abschn. B Pos. 2: 5 + 7 Wo; Pos. 1: 15 Wo | 3D-Code-Ablauf mit Testhaken, Abdeckungsraster |

**Die didaktische Kernaussage je Lab** (verkürzt, Wortlaut FI-Fachkonzept §4.2 ff.):
- **SI-1:** Netz-ID, Broadcast, Hostzahl je Subnetz numerisch; Zerlegung in /26 muss disjunkt sein, vollständig decken, und die Hostzahlen-Summe muss stimmen (`NET.partition_disjoint`, `NET.partition_complete`).
- **SI-2:** Jeder Zustandsübergang muss legal sein; kein Übergang Wartend→Laufend ohne Bereitungsereignis; kein Zombie-Prozess; gemeldete Auslastung = aus Zustandshistorie berechnete Auslastung ±1 Prozentpunkt.
- **SI-3:** XOR-Rundlauf identisch; AES-Blockgröße 128 Bit; Schutzziel-Zuordnung je Angriff.
- **DuP-1:** Join-Kardinalität, 3NF-Zerlegung, Abfrageergebnis == Sollmenge.
- **DuP-2:** Vollständigkeitsquote, Plausibilitätsverstoßzahl, reproduzierbarer Pipeline-Output.
- **DuP-3:** Jedes Ereignis erreichbar, keine Sackgasse, Engpass identifiziert und begründet.
- **AE-1:** Binär/Dezimal/Hex-Rundlauf, Zweierkomplement-Bereich, Adressraum.
- **AE-2:** Ausgabe ist Permutation der Eingabe; Sortiertheit; Vergleichs-/Tauschzahlen im Sollkorridor.
- **AE-3:** Testfall trifft Fehlerursache; Branch-Coverage ≥ Sollwert; Mutation Score ≥ Sollwert.

**Das Backlog-Kern-Ziel** (FI-Fachkonzept §11) ist explizit reduziert: „ein lauffähiger, nachweisbar geprüfter kritischer Pfad — **nicht neun fertige Labs**." Blöcke B1–B6, Reihenfolge: **B1 (Verifier) → B2 (Generator)**.

### 2.4 Phase 3 — Buildvorbereitung (26.10.2026)

| Zeit | Ereignis | Beleg |
|---|---|---|
| 09:04 | Session „Meta hackathon termine in Google Calendar überführen" (`20261026_090428_40d77dc8`) — 4 Kickoff-/Vortragstermine (26.–30.10., 12:00 ET). | Google Calendar |
| 20:03 | 2 parallele Recherche-Sessions: „Recherche zu Three.js, Sandbox, Playwright, Meta API" (86 Msg, 5 min) und „GitHub-Recherche für Three.js Schul-Laborplan" (67 Msg, 4 min). | → `buildplan-docs.md` (950 Z), `buildplan-techspec.md` (575 Z), `buildplan-github.md` (731 Z) |
| 20:16 | Session „Muse Code CLI einrichten und OneDrive/modelMuse-BAUPLAN-v1.md umsetzen" (`20261026_201618_5d85ea90`, **682 Msg, 282 Tool-Calls** — die größte Session der gesamten Projektphase). | Git-Historie + Ledger |

**Kernaussagen der Buildplan-Recherche** (`buildplan-docs.md`, §0):
- **Three.js r186 ist WebGL2-only** — WebGL1-Support wurde in r163 entfernt. `renderer.info.render.calls` ist die einzige belastbare Draw-Call-Quelle.
- **Sandbox:** `iframe sandbox` + CSP im Sandbox-Frame, Import-Allowlist auf zwei Ebenen, Timeout/Abort, Fehlerkanal iframe→Parent, **kein Netz- und kein DOM-Zugriff**.
- **Playwright 1.64** mit SwiftShader-Flags, `toHaveScreenshot`, Konsolenfehler-Abgriff, `file://`-Tests.
- **Meta Model API:** Basis-URL, Auth, Modellname, Streaming (SSE), Fehler 402/429/500/503.
- **Modellnamen-Korrektur:** Der Fachkonzept-Name „muse-spark" wurde gegen die offizielle Doku korrigiert.

Der **Tech-Spec** (`buildplan-techspec.md`) hält einen **Entscheidungskonflikt** explizit fest: „Tech v2 (am angegebenen Pfad **nicht vorhanden**)" → alle Byte-/Versionsangaben stammen ersatzweise aus Teil 1 des Gesamtdokuments und sind **Planwerte, keine Messwerte**. Der Builder-Weg `src/` + `scripts/build.mjs` + `dist/lab-player.html` wird hier festgelegt.

### 2.5 Phase 4 — Implementierung (26.–27.10.2026)

**26.10., 20:19–23:25 — coder-Profil-Kette (11 Sessions):**

| Zeit | Session | Ergebnis |
|---|---|---|
| 20:19 | „Richte Muse Code CLI ein…" (`20261026_201908_eb3673`, 130 Msg) | `muse.exe` v1.4.13, Modell-Pin `muse-spark-1.3-contributor`, Key **ausschließlich** via `--api-key-stdin` |
| 20:26–20:30 | 3× „modelMuse Bauplan v1 Umsetzung starten" (44/21/261 Msg) | Prompt-Dateien `prompts/gen-*.txt`, erste Generierungen |
| 21:04 | „Fix Player-Build und baue neun FI-Labs" (156 Msg) | 9 Labs |
| 21:37 | „ModelMuse 3D-Rendering visuelle Qualität analysieren" (15 Msg) | → `docs/render-quality-options.md` |
| 21:46 | „Perfektioniere gpu-example Lab" (236 Msg) | 3 Reparaturrunden (P1 + P2×2) |
| 22:32 | „NACHTAUFTRAG ModelMuse" (543 Msg) | Budget-Nachtrag |
| 23:25 | „ModelMuse Hyperrealismus Nachtauftrag Teil 2" (253 Msg) | V6-Hyper-Prompts |

**Die erste dokumentierte Fehlerkette** (`dist/generation-log.json`, Call 1–6):
- **Call 1** (26.10. 19:41–19:44, 191 s): P1 gpu-example — „vollständiges Modul, S1 grün, aber **Helper-Signatur objektbasiert statt positional** → P2-Repair".
- **Call 2** (19:49–19:50, 37 s): P2-Repair — „12 Helper-Aufrufe positional korrigiert, **Nicht-Helper-Zeilen byteidentisch** zu Iteration 1". Das ist das Beleg-Prinzip: der Repair darf nur die Fehlerstelle anfassen.
- **Call 3–5** (20:57–21:11): Stil-Upgrade v2 → Review-Befunde (PointLight 3.0 überbelichtet, Shadow-Frustum via String-Concatenation, room-Leak) → 2 chirurgische Reparaturrunden (je exakt 3 Fixes, Rest byteidentisch).
- **Call 6** (21:38+, 284 s): P1 ae-1 Realismus-V5.

**27.10., 09:51–18:06 — Qualitäts-Recherche und Backlog:**

| Zeit | Session | Ergebnis |
|---|---|---|
| 09:51 | „Recherche zur Qualität KI-generierter Three.js-Modelle" (380 Msg, 220 Tools, 25 min) | `docs/ki-modellqualitaet-recherche.md` (701 Z, 85 KB) |
| 10:17–11:37 | 3 Sessions: „Top-8-Maßnahmen umsetzen", „Qualitaets-Harness mit Multi-Provider umbauen", „Build localhost proxy for Muse model comparisons" | M1–M8, Harness, `scripts/proxy.mjs` |
| 17:06 | „Vollständige Rest-Todo-Liste für ModelMuse erstellen" (167 Msg) | `modelmuse-backlog.md`: **24 erledigt + belegt / 11 angefangen / 15 offen** |
| 17:35 | **Git Erst-Commit** `69e2eec` „ModelMuse Stand 2026-10-27 (Backlog 24E/11A/15O, vor Restposten-Fixes)" | 1.348 Dateien inkl. 90 Prompt-Stände, 14 `.claude/skills/threejs-*` |
| 17:00–18:06 | 3 Sessions: „Muse Code orchestriert Restposten abarbeiten", „Backlog-Maengelliste abarbeiten", „backlog Mängelliste via muse.exe abarbeiten" | O-01…O-15, A-01…A-11 |

**Die entscheidende Budget-Korrektur** (`dist/BUDGET-NACHTRAG-2026-10-27.md` + `docs/ABWEICHUNGSBLATT-2026-10-27.md`): Draw-Call-Limit **120 → 400** (grün bis 300, gelb 301–400, rot darüber), begründet mit Zielklasse Ryzen-5-/i5-iGPU und SwiftShader-Toleranz. Triangles 150.000, minFps 30, firstFrame 8.000 ms, Heap 256 MB unverändert.

Der Abschlussreport `dist/AUFTRAG-REPORT-2026-10-27.md` bilanziert:
- **9/9 Labs neu generiert, alle Iteration 1 grün, 0 P2-Repairs** (V6-Hyper-Budget400-Prompts).
- Hyper senkt Draw-Calls via Instancing: si-2 111→34, si-1 100→60, si-3 78→30 — **trotz Detailplus**.
- BYOK-Feature end-to-end: 4/4 Keypfad-Tests grün (Dummy-Key → echte Meta-401 mit deutscher Meldung; echter Key → 200, Wert redaktiert; Mock-Vollpfad; ohne Proxy → E-GEN-OFFLINE).
- Teststand: **36/36 Unit + 28/28 Playwright + 10× gelb + 4/4 Keypfad**.

**Die Ampel-Logik (durchgängig):** „gelb" = *auto-geprüft, Lehrkraft-Freigabe ausstehend*. Es gibt bewusst **kein Grün** ohne menschliche Freigabe (`dist/attestation.json`).

**27.10., 20:01 — Session „Hermes mit Muse Spark für Hackathon einrichten"** (`20261027_200148_b6e15517`):
- Profil `hackathon` angelegt (Klon von `coder`, eigenes `.env`).
- Provider `custom`, `base_url: https://inference.baseten.co/v1`, Modell `meta-models/muse-spark-open-1026`.
- Key als `BASETEN_API_KEY` im Profil-`.env`, **kein Abdruck im Chat**.
- One-Shot-Probe mit `OK` bestanden. Default-Profil unverändert auf `opencode-go` / `muse-spark-1.3-contributor`.
- Notion-Entscheidung: „Key gilt nur mit exakt diesem Modell, daher kein Modellwechsel in diesem Profil."

### 2.6 Phase 5 — Standalone-UI-Kette v1…v11 (28.10.2026, 01:01–19:10)

Session `20261028_010153_3193af97` (539 Msg, 221 Tools) mit **8 designer-Profil-Sessions** und **27 Ledger-Einträgen** in `dist-standalone/ledger-muse-calls.md`. Jede Version hat: Backup → Muse-Call → deterministische Assembly per Skript → statische Verifikation → Playwright-Klickbeleg.

| Version | Zeit | Muse-Call | Inhalt |
|---|---|---|---|
| v1 | 01:05 | 374 s | Standalone-UI (9 Labs, curriculum_ref, Quiz), 57.796 B |
| v2 | 08:15 | 276 s | Progress-Balken, Verify-Ampel, Footer, 25× min-h-44px |
| v3 | 08:29 | 77 s | Viewer-Glue (`__viewer { loadLab, setView, setAnno, dispose }`) |
| v4 | 08:48 | 135 s | Generator + Overlay, 8 Snippets |
| v5 | 12:00 | 23 s | Viewport-first Layout (65vh/520px) |
| v6 | 12:11 | 90 s | **Erstes echtes Freimodell:** Handbohrmaschine (169 Zeilen, 6 Bauteile, Länge 448 mm) |
| v7 | 12:54 | 241 s | **Echte Bauteil-Toggles** (Fix zum wirkungslosen Ebenen-Schalter) |
| v8 | 14:01 | 233 s | 2D-Diagramm-Snippets + `is3d`-Flag |
| v9 | 16:52–17:15 | 0 (lokal) | 7-Punkte-Umbau, OpenRouter-Direkt |
| v9-Fix2/3 | 17:40/17:48 | 0 | Geometrie-Allowlist, Import-Strip in `registerFree` |
| v10 | 19:00/19:10 | 0 | Free-Reload-Fix + Fortschritts-Overlay (Generierung läuft parallel zur Nutzung) |
| v10-Fix4 | 18:45 | 0 | BufferAttribute-Allowlist (20 Namen) |
| v10-Fix | 18:47 | 0 | **P0 weiße Seite** → Boot-Watchdog vor allen CDN-Tags |
| v11 | 19:05 | 0 | Kamera-Framing (Auto-Frame 2,2× maxDim, Box3-Zentrum, GridHelper) |

**Der Design-Kern in v1** (User-Auftrag, Msg 47602): „moderne UI in einer einzigen, stand-alone HTML-Datei. Verwende Vue.js 3 (globales CDN-Skript mit Options-API) … Tailwind CSS (via CDN) … Dark Mode fokussiert, abgerundete Ecken, flüssige Transitions … die Client-Side Only App … professionell wie eine Kaufsoftware aussieht."

**Zwei Korrekturen des Users während der Kette:**
- Msg 47609 (OOB): „Nutze bei Vue.js die Options-API (data, methods, mounted) oder das klassische globale Setup, nicht moderne Vue 3 Single-File-Component-Syntax (`<script setup>`) oder TypeScript-Typen, die compiliert werden müssten."
- Msg 48036 / 48376: Ausrichtung der UI **weg von der Lernplattform hin zum 3D-Model-Generator und -Viewer**; 3D-Ansicht vergrößern; Overlay rechts oben zum Ein-/Ausblenden von Bauteilen; Generierungs-Status-Overlay in der unteren Seitenecke; Bug: „das Model wurde angezeigt und bleibt auch nach neu laden in der Labs Liste stehen. Allerdings ist nach Neu laden für das spezifisch durch das LLM generierte Model lediglich noch die 2D-Darstellung möglich, die 3D-Darstellung scheint beim Neu laden verloren zu gehen."

**28.10., 15:14 / 17:37–17:41 — Recherche-Phase:**
- „Browserferige 3D-Generierung mit Meta und OpenRouter" (69 Msg) → Baseten-Provider-Architektur.
- Session „ModelMuse three.js qualität massiv erhöhen" (`20261028_173724_c88010a0`, 336 Msg) mit **3 parallelen Subagenten**:
  - `20261028_174053_f4e72f` „three.js-Realismus für LLM-Code recherchieren" (213 Msg, 15 min)
  - `20261028_174054_851739` „Alternativen zu three.js für LLM-Codegenerierung" (158 Msg, 11 min)
  - `20261028_174055_b4b55f` „Recherche zu realistischen LLM-3D-Modellen und Selbstprüfung" (78 Msg, 4 min)
- 19:48: Session „Meta Model API in Hermes einbinden" (`20261028_194812_23f84e96`) → Provider `meta-ai` (`https://api.meta.ai/v1`), Live-Katalog mit 7 Chat-Modellen (`muse-wonder-1.0`, `sam-3.1`, `muse-spark-1.3-contributor`, `muse-spark-1.3`, `muse-spark-1.2-contributor`, `muse-spark-1.2`, `muse-spark-1.1`).

### 2.7 Phase 6 — Nacht 28.→29.10.: Kernsanierung, 2D-Router, Baseten (23:34–01:19)

**5 Subagent-Sessions, parallelisiert in 3 Wellen:**

| Zeit | Session | Ergebnis | Commit |
|---|---|---|---|
| 22:37 | „Inventur ModelMuse: liste ALLE Dateien…" (18 Msg) | — | — |
| 22:40 | „Standalone-Single-Page Variante auf Guide-Stand…" (254 Msg, 134 Tools) | `scripts/build-standalone.mjs` R1–R19 | — |
| 23:03 | „2D-Stack-Evaluierung: je 2D-Typ…" (248 Msg, 129 Tools) | `docs/2D-STACK-EVAL.md` | — |
| 23:03 | „Router-Konzept + Integrationsplan…" (21 Msg) | `docs/ROUTER-KONZEPT.md` | — |
| 23:34 | „3D-Kernsanierung 6 Modelle…" (342 Msg, 171 Tools) | `src/models/{gpu-example,si-1..3,free-handbohrmaschine,chemie-koffein}.js` | `341bcf5` (29.10. 00:05) |
| 23:34 | „2D-Umstellung + Router: dup-1..3/ae-1..3 auf 2D…" (416 Msg, 226 Tools) | SVG-Datenmodule, `routeGeneration()`, Verify-2D-Gates | `7f483de` (00:14) |
| 23:55 | „OpenRouter durch Baseten ersetzen…" (276 Msg, 152 Tools) | `docs/BASETEN-MIGRATION.md` | — |
| 00:15 | „Slim-Generator: Quiz/Progress/Tipps-Code…" (440 Msg, 241 Tools) | Slim-Standalone | `292494e` (01:19) |
| 00:15 | „Lizenz-Audit: je Fremdinhalt…" (233 Msg, 141 Tools) | `docs/licenses.md` | — |

**Git-Historie (vollständig, 7 Commits):**

| Hash | Zeit | Commit | Umfang |
|---|---|---|---|
| `69e2eec` | 27.10. 17:35 | Erst-Commit: ModelMuse Stand 2026-10-27 | 1.348 Dateien (inkl. 90 Prompt-Stände, 14 three.js-Skills) |
| `6ca4bda` | 28.10. 00:49 | Restposten-Fixes 27.10.: A-01/A-02/A-04–A-11, O-01–O-08/O-10–O-15, Baselines, O-04-Nachweise | +14 three.js-Skills, 22 Baseline-PNGs, Reports |
| `e06adfe` | 28.10. 00:54 | NEXT-STEPS-Plan: Fachkonzept-Abgleich + UX-Prioritäten | 1 Datei, 86 Zeilen |
| `341bcf5` | 29.10. 00:05 | 3D-Kernsanierung 6 Modelle: Guide-Konformität + chemie-koffein neu | 2 neue Modelle (je 231 Z), 6 Proof-PNG-Paare, Harness-6modelle.jsonl |
| `7f483de` | 29.10. 00:14 | 2D-Umstellung + P0-Router | Standalone +4.563 Z, 6× SVG/HTML/PNG in `dist-2d/`, 12 Baseline-PNGs neu |
| `6b261f8` | 29.10. 00:14 | Reports: build-/verify-report mit 2D-routes | 2 JSON-Dateien |
| `292494e` | 29.10. 01:19 | Finale Sicherung nachts: Slim-Generator + Direkt-Call/UI, Lizenzen, Baseten, 2D-Router | Tag `nachts-final` |

**Tags:** `pre-cleanup-L16-L26` / `post-cleanup-L16-L26` (beide 28.10. 00:54 auf `e06adfe` — **Rollback-Anker ohne Commit**, weil der Working Tree parallele Session-Änderungen enthielt), `nachts-final` (29.10. 01:19), `models-pre-wipe-20261029-082023` (29.10. 08:20).

### 2.8 Phase 7 — 29.10.: Verifikation, Wipe, Showcase

| Zeit | Ereignis | Beleg |
|---|---|---|
| 07:04 | Subagent „Verifizieren: Sind die 6 3D-Modelle + Koffein neu nach Guide gebaut?" (61 Msg) | `docs/NEUBAU-UI-CHECK.md` — alle 6 mit `environmentIntensity = 0.55`, `PCFShadowMap`, DPR-Cap, Harness 6/6 grün, Guide-Unit-Test 14/14 |
| 07:20 | Subagent „Standalone zur Basis machen…" (429 Msg) | v13-Standalone |
| 07:26 | `docs/AKTUELL-SCREENSHOTS.md` — 14 Shots, 0 pageerrors, 0 console-errors | — |
| 08:20 | **MODELS-WIPE**: `src/models/*` geleert, Tag `models-pre-wipe-20261029-082023`, Backup mit 24 SHA256-Summen, `regen-anleitung.md`, `pending-key-step.txt` | `cache/scratch/models-wipe-20261029-082023/` |
| 08:38 | Subagent „Routing-Tests: je 3D-Beispiel + je 2D-Typ…" (70 Msg) | `docs/ROUTING-TESTS.md` — 6/6 Fälle grün, Fail-closed-500 grün |
| 09:23 | Showcase-Harness: 5 Modelle (arch-brandenburger-tor, si-1, chemie-koffein, free-handbohrmaschine, gpu-example), **alle grün in Iteration 0**, 0 Auto-Repairs | `dist-standalone/showcase-harness/SUMMARY.json` |
| 09:29 | Showcase-Build, **Swap `arch-fassade` → `arch-brandenburger-tor`**, 276.375 B | `dist-standalone/build-showcase-report.json` |
| 10:09 | Subagent „Machbarkeit: was kann LLM-3D-Code aus Maßbeschreibung…" (382 Msg, 210 Tools) | `docs/REALGEBAEUDE-MACHBARKEIT.md` |
| 10:47 | `docs/REALGEBAEUDE-MACHBARKEIT.md` geschrieben (26 Quellen) | — |

**Der Swap ist inhaltlich der wichtigste Einzelschritt des 29.10.:**
- **Vorher:** `arch-fassade` — generischer Fassadenausschnitt (1,2 m), „unbelegte Maße", vom User als „langweilig" beanstandet.
- **Nachher:** **Brandenburger Tor** (Berlin) — Torbau 62,5 m breit, 20,3 m hoch (ca. 26 m mit Quadriga), 11 m tief; 12 dorische Säulen (13,5 m hoch, Basis-Ø 1,73 m); mittlere Durchfahrt 5,65 m, seitliche 3,80 m. **Maßstab Modell 1:50.**
- **Maßquellen im Manifest** (`quellen`-Feld, neu im Schema): Wikipedia „Brandenburger Tor" / Architektur-Abmessungen; visitBerlin.de; Bildhauerei in Berlin / Landesdenkmalamt Berlin (Denkmaldatenbank Dok-Nr. 09065019).
- `arch-fassade` restlos entfernt: Quellmodul, Manifest, Matrix-Eintrag, alle Referenzen in 5 Skripten + `tests/standalone.spec.mjs` + README; im Artefakt **0 Treffer** (`arch-fassade`, `arch_fassade`, `Fassade`, `Vormauerung`).

---

## 3. Session-Landkarte (alle Hackathon-relevanten Sessions)

### 3.1 Hauptsessions (Telegram/Desktop, Profil `default`)

| Zeit | Session-ID | Titel | Msg/Tools | Rolle |
|---|---|---|---|---|
| 07.10. 00:41 | `20261007_004117_a6ff192f` | Close session and update skills docs | 184/91 | Bewerbung + PULSEWALL-Nachweis |
| 13.10. 22:13 | `20261013_221301_0e146630` | Skills in Hermes aktualisieren, Notion dokumentieren | 193/89 | Bewerbungs-Doku |
| 22.10. 20:47 | `20261022_204726_5df61dfc` | **Bauen Three.js tutor für Meta Hackathon** | 287/99 | 3 Stränge, v2-Pakete, FI-Pivot |
| 26.10. 09:04 | `20261026_090428_40d77dc8` | Meta hackathon termine in Google Calendar überführen | 31/12 | Terminierung |
| 26.10. 20:16 | `20261026_201618_5d85ea90` | Muse Code CLI einrichten und modelMuse-BAUPLAN-v1.md umsetzen | **682/282** | Repo-Entstehung, 9 Labs |
| 27.10. 18:10 | `20261027_181053_5ce096ac` | ModelMuse anhand modelmuse-backlog.md weiterentwickeln | **764/357** | Backlog-Abbau |
| 27.10. 20:01 | `20261027_200148_b6e15517` | Hermes mit Muse Spark für Hackathon einrichten | 40/20 | hackathon-Profil, Baseten |
| 28.10. 01:01 | `20261028_010153_3193af97` | ModelMuse standalone HTML UI erstellen | 539/221 | Standalone v1–v11 |
| 28.10. 17:37 | `20261028_173724_c88010a0` | ModelMuse three.js qualität massiv erhöhen | 336/115 | 3 Realismus-Recherchen |
| 28.10. 19:48 | `20261028_194812_23f84e96` | Meta Model API in Hermes einbinden | 33/16 | Provider `meta-ai` |

### 3.2 Recherche-Sessions (Profil `researcher`, `oneshot`)

| Zeit | Session-ID | Titel | Msg | Dauer | Ergebnis |
|---|---|---|---|---|---|
| 22.10. 20:52 | `20261022_205207_197ee0` | Fachkonzept für adaptive Three.js-Lernlabore | 99 | 11 min | Teil 3 v2 |
| 22.10. 20:52 | `20261022_205207_b830a4` | Tech-Recherche zu Stack und Build-Verifikation | 99 | 6 min | Teil 1 v2 |
| 22.10. 20:52 | `20261022_205207_9fcb49` | Architekturmodell für Single-File Tutor-Agent | **4** | 3 min | Teil 2 v2 (via Folgesession) |
| 22.10. 21:09 | `20261022_210939_786d00` | Lücken und Backlog für Meta Hackathon | 49 | 5 min | Teil 4 v2 |
| 22.10. 21:15 | `20261022_211517_7ca0d2` | PAKET 2 Lab-Spezifikation und Prompt-Vorlagen | 127 | 14 min | Teil 5 v2 |
| 22.10. 21:30 | `20261022_213013_24f25d` | Meta-Hackathon Demo-Story und Risiko-Checkliste | 61 | 4 min | Teil 6 v2 |
| 22.10. 22:01 | `20261022_220135_f21705` | START-READINESS-Konzept mit Offline-Paket | 140 | 13 min | Teil 7 v2 |
| 22.10. 22:17 | `20261022_221747_d8f047` | Tech- und Architekturreview v2 abschließen | 147 | 14 min | Review v2 |
| 22.10. 22:17 | `20261022_221748_46ee17` | Fachkonzept und Backlog v2 aktualisieren | 168 | 17 min | Review v2 |
| 22.10. 22:17 | `20261022_221748_3ac927` | Review-Runde C Spec Demo Readiness v2 | 101 | 18 min | Review v2 |
| 23.10. 10:23 | `20261023_102258_ff5860` | **Fachinformatiker-Konzept für Meta Hackathon neu erstellen** | 200 | 24 min | FI-Fachkonzept (751 Z) |
| 23.10. 11:10 | `20261023_111038_26d7ed` | **Erweiterte Lab-Specs für neun FI-Labs** | 261 | **63 min** | FI-Labspecs (8.109 Z) |
| 26.10. 20:03 | `20261026_200348_12eeef` | Recherche zu Three.js, Sandbox, Playwright, Meta API | 86 | 5 min | `buildplan-docs.md` |
| 26.10. 20:03 | `20261026_200348_308d37` | GitHub-Recherche für Three.js Schul-Laborplan | 67 | 4 min | `buildplan-github.md` |
| 27.10. 09:51 | `20261027_095145_3c27b6` | **Recherche zur Qualität KI-generierter Three.js-Modelle** | 380 | 25 min | `ki-modellqualitaet-recherche.md` (701 Z) |
| 28.10. 15:14 | `20261028_151400_1d22d2` | Browserferige 3D-Generierung mit Meta und OpenRouter | 69 | 9 min | Provider-Architektur |
| 28.10. 17:41 | `20261028_174053_f4e72f` | three.js-Realismus für LLM-Code recherchieren | 213 | 15 min | Guide-Quelle |
| 28.10. 17:41 | `20261028_174054_851739` | Alternativen zu three.js für LLM-Codegenerierung | 158 | 11 min | Guide-Quelle |
| 28.10. 17:41 | `20261028_174055_b4b55f` | Recherche zu realistischen LLM-3D-Modellen und Selbstprüfung | 78 | 4 min | Guide-Quelle |
| 27.10. 17:06 | `20261027_170559_db0f9d` | Vollständige Rest-Todo-Liste für ModelMuse erstellen | 167 | 16 min | `modelmuse-backlog.md` |

### 3.3 Build-/Implementierungs-Sessions (Profil `coder`)

26.10. 20:19 → 27.10. 18:06, **20 Sessions** mit 4.006 Nachrichten: Muse-CLI-Setup, Bauplan-Umsetzung, 9 FI-Labs, GPU-Perfektionierung, Hyperrealismus-Nachtauftrag (2 Teile), Qualitäts-Harness mit Multi-Provider, localhost-Proxy für Modellvergleiche, Browser-E2E (Spark + OpenRouter), Workspace-Trust-Fix, Restposten-Abarbeitung, Backlog-Mängelliste (2×).

### 3.4 Design-Sessions (Profil `designer`)

28.10. 01:06 → 13:57, **8 Sessions**: v1 Standalone-UI → v2 Polish → v3 3D-Viewport → v4 Generator+Viewer → v5 viewport-first → v6 Echtheits-Beweis → v7 Bauteil-Toggles → v8 2D-Skizzen/`is3d`-Flag.

### 3.5 Umsetzungs-Subagenten (28.–29.10., 14 Sessions, 3.010 Msg)

| Zeit | Session-ID | Auftrag | Msg/Tools |
|---|---|---|---|
| 28.10. 22:37 | `20261028_223747_5b1c33` | Inventur ModelMuse (alle Dateien) | 18/8 |
| 28.10. 22:40 | `20261028_224019_1e322d` | Standalone-Single-Page auf Guide-Stand | 254/134 |
| 28.10. 23:03 | `20261028_230306_db8264` | 2D-Stack-Evaluierung je Typ | 248/129 |
| 28.10. 23:03 | `20261028_230306_567bda` | Router-Konzept + Integrationsplan | 21/13 |
| 28.10. 23:34 | `20261028_233452_0090b4` | 3D-Kernsanierung 6 Modelle | 342/171 |
| 28.10. 23:34 | `20261028_233452_4d27ae` | 2D-Umstellung + Router | 416/226 |
| 28.10. 23:55 | `20261028_235549_5192ba` | OpenRouter → Baseten | 276/152 |
| 29.10. 00:15 | `20261029_001527_ba7efd` | Slim-Generator | 440/241 |
| 29.10. 00:15 | `20261029_001527_b162e8` | Lizenz-Audit | 233/141 |
| 29.10. 07:04 | `20261029_070452_1224bf` | Verify 6 3D-Modelle + Koffein | 61/30 |
| 29.10. 07:20 | `20261029_072053_a7f053` | Standalone zur Basis machen | 429/218 |
| 29.10. 08:38 | `20261029_083811_e59bee` | Routing-Tests | 70/44 |
| 29.10. 09:36 | `20261029_093605_0260d4` | 3D-Showcase-Modelle generieren | 158/82 |
| 29.10. 10:09 | `20261029_100939_ad87e2` | Realgebäude-Machbarkeit | 382/210 |

### 3.6 Nicht-Hackathon-Sessions im gleichen Zeitraum (Abgrenzung)

`ver.di Fachbereich A` (26.10.), `Ollama-Entscheidungsmodelle/nimble` (25.10.), `JustWatch TV Top-100` (23.10.), `BeamNG-Video` (23.10.), `Winterdate-Ideen/Nestlé` (25.10.), Netflix-/Spotify-Kalender (25.10.), `Magic War of the Spark Lore` + `WotS-Roman` (17.–19.10., 849 Msg), `IT-Sicherheit-Praxisprojekt` (28.10.), `Buchprojekte` (Hermes-Buch, Tailwind-Buch, Spring-Buch, TypeScript-Lernpfad — Aug.), `Mnemosyne-Wrapper` (28.10.), `Hermes-resetwatch` (28.10.), diverse Cron-Jobs (Morgen-Briefing, Gmail-/Mailbox-Sortierung, SecondBrain-Mining).

---

## 4. Fachkonzepte: Kernaussagen je Konzept

### 4.1 `meta-hackathon-FACHKONZEPT-FI-final.md` (751 Z, 23.10.) — **geltende Spec**

**Kernaussage:** Ein Tutor-Agent erzeugt aus einem gewählten IT-Thema eine interaktive, in Three.js gerenderte Lernumgebung mit adaptiv nachgesteuerter Aufgabenreihe. Das Modell erzeugt **ausschließlich deklarative Spezifikationen, nie lauffähigen Produktionscode**.

Struktur (14 Kapitel): Ziel und Kontext · Zielgruppe und Nutzen · MVP-Umfang und Nicht-Ziele · Curriculum-Mapping der neun Labs (4.1–4.11) · Didaktik und Adaptivität (5.1–5.4) · Architektur (6.1–6.5) · Technische Festlegungen (7.1–7.4) · Lab-Spec-Hinweis · Prompt-Vorlagen P1/P2/P3 · Verifikationsregeln IT (10.1–10.4) · Backlog-Kern · Demo (180 s) · Start-Checkliste 26.10. · Quellen.

**Fünf tragende Kernsätze:**
1. **Adaptivität ist regelbasiert, nicht modellbasiert.** Stufe B Start, 2× hoch / 2× runter, **nie unter A**. Das Modell liefert Tutor-Texte, **nicht** die Stufenentscheidung.
2. **Drei Prompt-Rollen sind getrennt:** P1 = stabiler System-/Entwicklerprefix (wortgleich über alle Iterationen), P2 = Fach-Few-Shot je Fachrichtung (Bausteinsatz), P3 = Repair-Prompt mit Fehlerliste hinten angehängt.
3. **Fehlerbehandlung hat vier Schichten** (10.1–10.4): Fachlogik-Invarianten (harte Fehler) → Struktur-/Rendering-/Didaktikkriterien → Reihenfolge der Prüfung → Fehlerbehandlung.
4. **Degraded Mode 0–4** und **max. 3 Retry-Iterationen** mit informiertem Repair.
5. **Curriculare Aussagen sind gegen Primärquellen belegt** (KMK-Beschluss 13.12.2019, FIAusbV 28.02.2020), jedes Lab hat Zeitrichtwert und ARP-Wochenposition.

**Demokratische Besonderheit:** Das Konzept adressiert **drei Fachrichtungen gleichzeitig** (SI/DuP/AE) — jederzeit fünf Fachgebiete der Ausbildung (Rechnernetz, IT-Sicherheit, Datenbanken, Datenanalyse, Softwareentwicklung) statt einer Branchenschublade.

**Die Demo ist als Beweiskette gebaut, nicht als Show.** Der stärkste Moment ist explizit der **Retry-Loop live**: „Fehlerbehebung statt Fehlerfreiheit" (1:20–1:50, Verifier-Panel: erwartet gegen gemessen, harter Fehler, Iteration 2, Pass). Bei Ausfall gilt: „Nicht die Fachlogik improvisieren. Auf das kuratierte Demo-Lab zurückschalten … Ein ehrlicher Hinweis ist gegenüber der Jury stärker als ein gepatchter, nicht funktionierender Code-Block."

### 4.2 `meta-hackathon-FI-Labspecs.md` (8.109 Z, 370 KB) — **verbindliche Testbasis**

Anhang zum Fachkonzept: 9 vollständige Beispiel-Specs nach Schema-Profil `lab-spec.v1.1-fi`.

**Prüfregeln des Pakets (§1):**
- **Zwei getrennte Toleranzregister.** Item (Modell wählt, wird geprüft): relativ 2/5/15 %, absolut 0,05/0,1/0,2/1,0. Invariante (Verifier-eigen): relativ 2/5/15 %, absolut 0/0,01/0,05/0,1/0,2/1,0. „Ein Sollwert von 0 verlangt zwingend eine absolute Toleranz."
- **Vier-Schichten-Gate** mit „multiple_choice" → `value: null` + `correct_choice`.
- **Diskriminierbarkeit** als eigene Prüfrubrik.

### 4.3 `meta-hackathon-FACHKONZEPT-v3-codegen.md` (266 Z, 26.10.) — **Architektur-Pivot**

**Kernaussage:** „Du baust ein System, in dem Lehrkräfte per KI dreidimensionale Modelle als Programmcode von Muse Spark generieren lassen. Du führst diesen Code direkt im clientseitigen Single-Page-Wrapper aus."

**Der USP-Satz:** „Dein Alleinstellungsmerkmal besteht aus der Kombination von freiem Modell-Vokabular mit einer kuratierten Beweiskette."

**Der Rollenwechsel:** Nicht mehr „Lernende werden tutoriert", sondern **drei Rollen** — Lehrkraft (gibt Begriff vor, gibt frei → geprüftes, beschriftetes 3D-Modell), Auszubildende (erkundet in drei Niveaustufen), Implementierungsagent (setzt Generierungsvertrag, Schutzhülle, Verify-Loop um).

**Leitbeispiel Graphics Card:** GPU-Die, VRAM-Bausteine, 2 Axiallüfter, Heatpipes, Backplate, PCIe-x16-Stecker, Stromanschlüsse, Slotblende mit Displayanschlüssen + Längenbemaßung. „Du erreichst damit die Detailtiefe, die eine Lehrkraft im Unterricht besprechen kann."

**Generierungsvertrag (§5):** genau eine Schnittstelle (`init` / `update` / `dispose`), **genau ein Importursprung** (`three` + `wrapper-helpers`), **genau drei Helper** (`addLabel`, `addMeasurement`, `clearAnnotations`). „Du verwirfst jede Ausgabe, die den Vertrag verletzt."

> **Nicht verwechseln:** v3 ist der **Code-Gen-Kern**. `meta-hackathon-FACHKONZEPT-FI-final.md` beschreibt die **deklarative Spec-Variante** (Modell erzeugt JSON-Spec, Baustein-Bibliothek führt aus). Beide existieren im Repo; das gebaute Produkt entspricht **v3**, das Curriculum-Konzept entspricht **FI-final**.

### 4.4 `modelMuse-BAUPLAN-v1.md` (352 Z, 26.10.) — verbindliche Single-Shot-Bauanleitung

„Diese Anleitung ist die einzige Bauanleitung. Du setzt sie ohne Abweichung um."

11 Kapitel: Ziel und Abgrenzung · Festgelegter Stack mit Versionen und Begründung · Quelllayout und Artefakt `dist/lab-player.html` mit Größenbudget · Wrapper-API-Signaturen · Generierungs-/Repair-Prompts P1/P2 als Volltext · Verify-Loop S1–S5 mit Schwellen, Screenshot-Regeln, FPS-Messung, Sandbox, CSP, postMessage · **Modellmatrix 9 Labs + Graphics Card mit Sollwerten und Mindest-Labels** · Aufgabenliste in Baureihenfolge mit Akzeptanzkriterien · Risiko-/Fallback-Tabelle F2–F5 · Demo 180 s + Start-Checkliste · Übernommene GitHub-Patterns mit Name, URL und Lizenz.

**Budget-Kern:** Modul < 34.000 B, Triangles 150.000, Draw-Calls (nachträglich 400), minFps 30, firstFrame 8.000 ms, Heap 256 MB, Artefakt Komfort 1,5 MB / hart 2,0 MB.

### 4.5 `buildplan-docs.md` / `buildplan-techspec.md` / `buildplan-github.md` (26.10.) — Recherche-Grundlage

`buildplan-docs.md` §0 enthält die Vier-Punkte-Kurzfassung (Three.js r186 / Sandbox / Playwright 1.64 / Meta Model API) mit **Risiko-Hinweis je Snippet**: „Das Risiko bei Missbrauch benennt, was beim Kopieren der falschen Variante konkret kaputtgeht."

`buildplan-github.md` dokumentiert 10 verbrauchte Web-Suchen + GitHub-REST-API-Abfragen, inkl. der offengelegten Grenze: „Alle Snippets sind Konzeptmuster, keine Produktionsimplementierung."

### 4.6 `docs/implementation-guide-3d-qualitaet.md` (28.10., deutsch 33.763 B / engl. 7.411 B) — Qualitäts-Guide F1–F6

**Kernaussage:** three.js r186 behalten, Modellqualität über messbares Feedback, eng geführte Licht-/Geometrie-Regeln und begrenzte Repair-Loops verbessern.

**Die 5 Hauptempfehlungen:**
1. **IBL-Raum** (`PMREMGenerator`, helle Standardmaterial-Wände, `scene.environmentIntensity = 0.55`), damit metallische Oberflächen sichtbar bleiben. „Nicht das dunkle `0x11141a`-Raum-Rezept."
2. **Gemessene Verifikationsergebnisse in den Repair** — nicht visuelle Eindrücke, nicht nur Quellcode-Checks.
3. **Prompts und Modell-Output innerhalb der Vendor-API- und Ressourcenbudgets halten.**
4. **Visuelle Evidenz nur als Ergänzung** zu numerischen Checks.
5. **Automatische Reparatur auf 2 Runden + 1 manuelle Reserve begrenzen**, mit expliziten Stop-Bedingungen für Erfolg, Stagnation und Regression.

**Konkret festgelegte Werte:**

| Größe | Wert |
|---|---|
| Vier-Licht-Setup | Hemisphäre `0xdfeaff/0x1a1410` @ 0,35 · Key-Directional @ 2,5 (Schatten, 1024², Frustum an Modellgrenzen) · Rim-Directional @ 0,7 · warmer Point-Accent @ 0,12 |
| Tone Mapping | ACES Filmic, sRGB, Exposure 1,0–1,1 |
| Modulgröße | 34.000 B (hart) |
| Dreiecke | 150.000 (grün bis 120.000) |
| Draw Calls | 400 (grün bis 300) |
| Meshes | 250 (grün bis 120; Ziel ~45) |
| First Frame / FPS / Heap | 8.000 ms / 30 FPS / 256 MB |
| DPR | Default 1, begrenzt 1–2 |

**API-Pin-Regeln** (zusätzlich in `docs/three-186-api-pin.md`): 36 erlaubte three-Namen; `PCFSoftShadowMap` ist deprecated → `PCFShadowMap`; invertierter Raum mit numerischem `side: 1` statt `BackSide`; `scene.environmentIntensity` statt `envMapIntensity`; `PMREMGenerator`-Quelle muss `room` heißen, bis das Gate variablennamen-unabhängig ist. Verboten: `BackSide`, `FrontSide`, `outputEncoding`, `Clock`, `RGBELoader`, `RectAreaLight`, `SpotLight`, `MeshPhongMaterial`, `MeshLambertMaterial`, `CubeTextureLoader`.

**186→187-Drift ist vorbereitet:** `CubeUVReflectionMapping` entfernt, `PMREMGenerator` auf Cube-Render-Targets umgestellt, `Object3D.dispose` verpflichtend.

### 4.7 `docs/ki-modellqualitaet-recherche.md` (701 Z, 27.10.) — die zentrale Recherche

**Vier Thesen, alle mit Urteil:**

| Frage | Urteil | Kernaussage |
|---|---|---|
| Existiert „GPT-6 Astra"? | **belegt** | OpenAI, 3.9.2026, API-ID `gpt-6-astra` |
| Ist Astra „am leistungsfähigsten"? | **pauschal widerlegt** | Astra führt die **deterministische Geometrie-Passrate** (80,0 %) und die Prompt-Ähnlichkeit. Aber: bei **menschlicher Präferenz** führt Opus 5.5 (Elo 1083 vs. 1073), in **threejseval** Opus 5.5 High (2064 vs. 1882), in **AA-3D** Sonnet 5.5 (1199), in **WorldBench** Claude Fable 5.1 (210,79) |
| Hilft Prompt Engineering? | **ja, aber nicht beliebig** | Stärkste Evidenz: **Ausführungsfeedback mit Messwerten** (exec-refine +3,4 bis +38,8 Pass@1; FLARE 54,86 % vs. 50,27 %). **Widerlegt** die naive Form „mehr Constraints = mehr Qualität": System-Prompt-Spezifität wirkt nicht monoton, Few-Shots können bei großen Code-Modellen sogar verschlechtern |
| Ist unser Modell in 3D gut? | **nein, belegt** | Muse Spark 1.3: 3JSBench **10,7 %** (Platz 11/13), threejseval Platz 23/39 (Elo 1435), AA-3D Platz 9/23 (Elo 1033). Fehlermodus: 995 Meshes + 177.000 Dreiecke im Median, 33 % flackern |
| Sind Text-to-3D-Meshes eine Alternative? | **nein für dieses Setup** | Hunyuan3D 3.1: 40 k–1,5 Mio. Faces, typisch 20 k–300 k Dreiecke — Größenordnungen über dem 34-KB-Inline-Budget; GLBs 0,5–19,8 MB. Code-Gen behält Parametrik, Bauteilliste und editierbare Semantik |

**Die zentrale Erkenntnis (Wortlaut):** „Die **sechs** 3D-spezifischen Benchmarks messen **unterschiedliche Fähigkeiten** … Die Ranglisten **widersprechen einander** … Für ModelMuse heißt das: Es gibt **kein** ‚bestes Modell' — es gibt nur Modelle, die **verschiedene Achsen** abdecken. Die eigene Verify-Schleife muss entscheiden, welche Achse zählt."

**Maßnahmen-Rangliste M1–M8** mit Aufwand/Effekt/Evidenzgrad: M1 deterministische Geometrie-Checks (L/hoch) · M2 Mesh-Count als Budget-Kriterium (S/hoch) · M3 `muse-spark-1.3` statt `-contributor` + `reasoning_effort: max` (S/hoch) · M4 Prompt-Hygiene (S/mittel) · M5 Bauteilliste+Checkliste statt Mindestanforderungen (M/mittel-hoch) · M6 P2 mit Browser-Messwerten, Iterationsgrenze 2 (M) · M7 eigene Eval-Harness auf 3JSBench-Briefings (M/hoch) · M8 gezielte DataTexture-Mikrostruktur (M).
**Empfohlene Reihenfolge:** M2 → M3 → M4 → M5 (alle S/M, isolierbar messbar) → **M7** (Eval-Harness, damit die Folgenden messbar werden) → M1 → M6 → M8.

**Ehrliche Datenlücken (Abschnitt 7 des Dokuments):** Kein Benchmark misst ModelMuse **didaktische** Qualität — keine misst Label-Qualität, Messungs-Korrektheit, Niveautrennung oder Einheitenprüfung. M7 + ein **eigener didaktischer Benchmark-Satz** sind zwingend. Der 3JSBench-Grader-Code ist nicht veröffentlicht. Die Höhe des `max`-Reasoning-Effekts ist unbekannt (Daten aus anderen Aufgaben/Modellen). Ob `muse.exe` ein Reasoning-Effort-Flag durchreicht, ist **ungeprüft**. Zwischen benachbarten Modellen sind Elo-Differenzen oft **nicht signifikant** (±4,5 bis ±15).

### 4.8 `docs/2D-STACK-EVAL.md` (323 Z, 28.10.) — Bibliotheksauswahl, gemessen

**Entscheidungstabelle (Top-1 je Typ), mit lokal gemessenen Größen (esbuild 0.28.2, gzip level 9):**

| 2D-Typ | Top-1 | Version | Bundle (min/gzip) | Single-File (gzip) | LLM-Eignung | Lizenz | Offline |
|---|---|---|---|---|---|---|---|
| Diagramm | **Mermaid** | 12.2.0 | 5.366 KB / **1.542 KB** | 1.542 KB | **hoch** (MermaidSeqBench) | MIT | ja |
| Chart | **Chart.js** | 4.6.1 | 176 KB / **62 KB** | 62 KB | mittel-hoch | MIT | ja |
| Graph/Netz | **d3-light** | 3.x | 66 KB / **23 KB** | 23 KB | mittel | ISC | ja |
| Mathe | **KaTeX** | 0.19.1 | 262 KB / **76 KB** | 335 KB (mit Fonts) | **hoch** | MIT | ja |
| Technik-Skizze | **SVG nativ** (+ rough.js) | — | **0 KB** | 0,1 KB | mittel | — | ja |

**Die entscheidende Messung:** Nur Mermaid und KaTeX sind schwer genug, das Leichtgewicht-Ziel zu verletzen. Mermaid löst das über **Chunk-Selektion**: ESM-Build mit 104 Chunks (1.537 KB gzip gesamt), davon 47 Kern-Chunks (508 KB); die vier Zieltypen kosten **58,9 KB gzip** extra → **567 KB statt 1.542 KB** (Faktor 2,7).

**Gate-Tauglichkeit (gemessen, nicht behauptet):** Mermaid `parse()` wirft mit Zeile/Spalte + Caret (Parse 8–11 ms vs. Render 179 ms) → bestes Gate-Signal. **Chart.js ist das schwächste Gate**: bei ungültigem Typ `type:'quatsch'` wirft es **weder Exception noch Warnung** (`threw: null, warns: [], instExists: true`) — ein fehlerhafter Chart passiert ein Objekt-Existenz-Gate still; Gate muss daher **pixelbasiert** prüfen (gemessen 6.685 nicht-leere Alphapixel) + Typ-Whitelist. KaTeX: `throwOnError: false` **versteckt** den Fehler als `katex-error`-Span im HTML → Gate muss `throwOnError: true` erzwingen. SVG nativ: schwaches Gate (Layout-Fehler ohne Signal), braucht eigene Kriterien (Bauteilzahl, Label vorhanden).

**Offline-Nachweis:** 8 von 8 Kandidaten rendern offline (Playwright, `file://`, alle Nicht-`file://`-Requests per `route.abort()` blockiert).

**Lizenzlage:** Alle 9 verifizierten Pakete MIT/ISC/Apache-2.0 — **keine Copyleft-Pflicht, keine Namensnennungspflicht** über MIT/ISC/Apache-2.0 hinaus. Ausgeschlossen mit Risiko: `@skillpet/circuit` (kommerziell für Nicht-Erziehungsnutzung), `@jsplumb/browser-ui` (MIT ODER GPL-2.0), Highcharts (kommerziell), ApexCharts (Freigabe unter USD-2-Mio.-Schwelle).

**Entscheidung, die nicht umgesetzt wurde:** „Mermaid u.a. sind **evaluiert, aber nicht eingebunden**: SVG nativ (0 KB) deckt alle 6 Fälle ab." → Die 2D-Module nutzen ausschließlich `from '2d-svg'`.

### 4.9 `docs/MODELLPORTFOLIO-VORSCHLAG.md` (28.10.) — die 3D/2D-Trennung

**Kernaussage:** „Die 2D-Schaltfläche existiert nur im Standalone-Artefakt." `src/` (Haupt-Build) hat **kein** `is3d`, **kein** `renderDiagram2D` — dort ist „2D" nur der Notfallpfad F3 (`fallback2d.js`: flache Bauteilliste + Platzhalter-Kästchen).

**Die drei Befunde, die den Vorschlag tragen:**
1. Der 2D-Drehschalter ist im Standalone ein **Flag-Dreher pro Lab**, im Haupt-Build ein **Feature-Bau**.
2. **Die beiden Artefakte haben verschiedene Lab-Sätze** — GPU nur im Haupt-Build, Bohrmaschine nur im Standalone. „Ein Portfolio gibt es derzeit nicht, sondern zwei divergierende."
3. Das H2O-Problem ist **kein Modellfehler, sondern eine Einheiten-/Extraktions-Sache**: `UNIT_RE` und das `unit`-Enum erlauben nur `mm|cm|m|HE|kB|MB` — **kein `pm`**. Bei „96 pm" findet `extractMeasureHints` keine Einheit und **verwirft den Messhinweis komplett** (Fallback „Breite: 40 cm"). Beleg `dist/chemie-h2o-meta.json`: `zahlenGefunden: []`, `labelsGefunden: ["O","H"]` — die Spec-Zahlen 104,5/96 standen **nie** in der Annotationsliste. NaCl: `kein-rot=false` → Verify **rot**.

**Ersatzmolekül Koffein (C8H10N4O2)** statt H2O: 24 Atome, 2 Ringsysteme, 6–8 benennbare Teile; **9.648 Tris = 6,4 %** des 150-k-Budgets. Die Einheiten-/Maßstabsentscheidung (§4.3) ist „der entscheidende Detailpunkt" — und mündet später in die Architekturentscheidung „Maßstabsmodell mit echter Bemassung".

### 4.10 `docs/ROUTER-KONZEPT.md` (28.10., deutsch 15.277 B / engl. 5.441 B) — P0-Klassifikator

**Status ausdrücklich:** „Design proposal, not an implementation specification for the current release. No code change is implied by this document."

**Kern:** Bei Start der Generierung wählt ein kleiner Classifier zwischen 3D (three.js) und leichtgewichtiger 2D-Darstellung. „The proposal limits routing to **one additional model call** and introduces **no npm dependencies**."

**3D nur, wenn alle drei Bedingungen erfüllt sind:**
1. Quelle beschreibt ein räumliches Objekt / eine Baugruppe / ein Gerät / eine Anatomie mit relevanter Lage, Orientierung, Montage oder Volumen.
2. Das Lernziel profitiert von räumlichem Verstehen oder wechselnder Ansicht.
3. Mindestens **zwei** identifizierbare Teile oder Teilvolumen mit räumlichen Beziehungen.

**2D, wenn** primär Prozess/Algorithmus, Strom-/Signalfluss, Chart/Vergleich, Definition/Taxonomie — oder höchstens **ein** räumliches Objekt ohne 3D-Lernnutzen. „An explicit request for a 2D representation takes precedence over spatial cues."

**Antwortvertrag:** genau drei Keys `mode` / `typ` / `begruendung` (max. 140 Zeichen), `mode` ∈ {`3d`,`2d`}, 2D-Typen: `schaltplan`, `flussdiagramm`, `schnitt-ansicht`, `diagramm`, `tabelle`.

**Fail-closed:** „Invalid JSON, a timeout, or an HTTP error fails closed to the existing 3D route and records `routerFallback: true`; routing must not abort generation."

**Budget:** P0-Eingabe ~4.000 Zeichen, Ausgabe ~300 Token, **ein** nicht-streamender Call.

**Implementierungsvorschlag (5 Punkte):** `routeGeneration()` in `src/runtime/livegen.js` mit Timeout/Schema-Parser/Fail-closed · `prompts/p0-router.txt` + `prompts/p1-generate-2d.txt`, 3D-Prompt unverändert · `scripts/build.mjs` mit 2D-spezifischen Limits und Route-Feldern, **keine** Anhebung fremder Dateilimits · `verify.js` + `verify-all.mjs` mit SVG-Verifier, 2D-Allowlist, **explizite `skip`-Resultate** für 3D-only-Checks (statt „passed") · Harness + Repair-Prompts.

**Nicht-Ziele:** keine neue 2D-Bibliothek, kein interaktives 2D-Framework, kein Redesign des 3D-Pfads, keine Änderung am Standalone-Builder, kein semantischer Komponenten-Retrieval.

### 4.11 `docs/BASETEN-MIGRATION.md` (28.10.) — Provider-Wechsel

**Kernaussage:** „OpenRouter-Pfad entfernt, Baseten Model APIs als Laufzeit-Standard. Meta-Regel eingehalten: Laufzeit nur Meta-Modelle (`meta-models/muse-spark-open-1026`)."

| Punkt | Wert |
|---|---|
| base_url | `https://inference.baseten.co/v1` |
| Route | `POST /v1/chat/completions` (OpenAI-kompatibel, SSE) |
| Modell | `meta-models/muse-spark-open-1026` |
| Auth | `Authorization: Bearer ***` |
| Key-Regel | **ausschließlich** BYOK (Browser-Eingabe, sessionStorage **nur mit Zustimmung**). Nie Server-Key-Fallback, nie in Code/Logs/Chat/Dateien/Repo |
| Default | `meta-muse/muse-spark-1.3-contributor` unverändert (Proxy-Default; Baseten nur explizit + BYOK) |

**Geänderte Dateien:** `scripts/proxy.mjs` (`PROVIDERS.baseten`, `byokOnly`, OpenRouter-Header entfernt) · `src/data/providers.json` (`version` 1→2) · `src/runtime/providers.js` · `src/shell/ui-providers.js`, `ui-livegen.js` · `src/runtime/livegen.js` · i18n de/en/es · 5 Testdateien · **neu** `scripts/proxy-e2e-baseten.mjs` · `scripts/proxy-e2e-openrouter.mjs` **inaktiv** (Exit 3) · `scripts/chemie-e2e.mjs` · README + 3 Docs.

**Zwei echte E2E-Läufe (mit Fehlschlag):**
- **Versuch 1 (Handbohrmaschine):** Transport OK (SSE-Modul extrahiert), aber Boot-Fail `E-S2-BOOT: … does not provide an export named 'ConeGeometry'` — das Modell importiert `ConeGeometry`, das im Vendor-Bundle nicht exportiert ist und nicht in der `repairThreeImports`-Map steht. „Bundle-/Repair-Lücke (Fremd-Baustelle), kein Transportproblem."
- **Versuch 2 (Bücherregal, 80 s): VOLLTREFFER** — „Buecherregal geladen: 6 Labels, 1 Messungen, 3 Aufgaben", S1 grün, S2 first-frame pass, S5 vorhanden, kein Rot, Screenshot-SHA256 `b0f6b245cc4311ac…` (84.814 B), Generation-Log-Eintrag `browser-e2e-baseten` (genau 1, kein Key-Material).

**Testbelege ohne Key, ohne Netz:** `test:unit` 135/135 grün · `build` OK · `verify:all` OK (12 Modelle, alle gelb) · Proxy-Funktionsprobe `/health` → `providers: ["meta-muse","baseten"]`, `openrouter` → E-GEN-404, Baseten ohne BYOK → E-GEN-CONFIG.

**Dokumentierte Fremd-Baustelle:** `tests/i18n-ui.spec.mjs` (4 Tests) wartet auf `#lab-mount iframe` in `dist/lab-player.html`; alle 4 scheitern identisch in `gotoPlayer`, auch die 3 von der Migration unberührten.

### 4.12 `docs/PROXY-BOOTSTRAP-BEFUND.md` (28.10.) — Direkt-Call statt Proxy

**Kernaussage:** „Bootstrap" = **kein** Bootstrap-CSS-Framework im Repo (nie vorhanden). Gemeint ist die moderne Single-Page-UI aus `dist-standalone/modelmuse-standalone.html`.

**Wann Direkt, wann Proxy:**

| Pfad | Direkt-Call (Browser → Upstream, BYOK) | Proxy (localhost:8787) |
|---|---|---|
| `baseten` (Muse Spark Open) | **Standard** | Fallback bei Netz-/CORS-/Timeout-Fehler |
| `meta-muse` (Muse Spark 1.3) | **Standard** | Fallback; ohne User-Key nutzt er den Server-Key (Env/`Key_muse.md`) |
| `openrouter` | entfernt (E-GEN-404) | entfernt |

**Die technische Grenze, die nicht wegdiskutiert wird:** „CORS: Direkt-Calls senden `Authorization`-Header (Preflight). Antwortet der Upstream ohne `Access-Control-Allow-Origin`, wirft der Browser `TypeError` — das ist **kein Code-Problem, sondern unvermeidbar**. Genau dafür existiert der automatische Proxy-Fallback (nur bei Transport-Fehler; definitive Antworten wie 401/404 fallen **nicht** zurück)."

**Key-Schutz:** Key nie in Code/Logs/Dateien/Repo. `sessionStorage` **nur mit Zustimmung** (Checkbox, Muster `modelmuse-live-key`). `localStorage` **nie** für Keys. Server-Key erreicht nur den Proxy-Prozess, nie den Browser.

**CSP:** `connect-src` erweitert um `https://api.meta.ai https://inference.baseten.co` — sonst wäre jeder Direkt-Call blockiert.

**Transparenz:** `generateLive` liefert `via: 'direct' | 'proxy'`; UI hängt „(Direkt-Call)" / „(Proxy-Fallback)" an.

**Teststand:** 148/148 Unit grün, `build` OK (hash `69155f1d…`), `render` OK (996.825 B), `verify:all` 12 Modelle alle gelb, Playwright 46 passed.

### 4.13 `docs/ARCHITEKTUR-PFADE.md` (27.10., fortgeschrieben 29.10.) — zwei Generierungswege

**Der zentrale Satz:** „**Entscheidung: Abweichung ist Architektur, kein Mangel. Kein Umbau.**"

| Pfad | Ablauf | Einschränkung |
|---|---|---|
| **1 — Vorabgenerierung (Muse-CLI)** | `muse.exe exec` via `scripts/_gen-one.mjs`; Modell-Pin pro Env (`MUSE_MODEL`, Default `muse-spark-1.3-contributor`; `MUSE_EFFORT`, Default `high`) | Key aus Key-Datei **nur** via `--api-key-stdin`, nie Logs/Chat/Prozessliste. Belegt: 30 Calls, `dist/generation-log.json` |
| **2 — Browser-Freimodus (direkte Meta-API)** | `src/runtime/livegen.js` via `scripts/proxy.mjs` direkt gegen `https://api.meta.ai/v1` | „Darf **NICHT** über die CLI laufen: im Browser ist kein CLI-Prozess möglich (technisch zwingend, kein Provisorium, kein Umbau)." |

**Auslieferung (Stand 29.10., v13):** **Einzige Auslieferung** = `dist-standalone/modelmuse-standalone.html` (GitHub-Pages-fähig, kein Backend, keine Build-Pflicht). Builder `scripts/build-standalone-v13.mjs` (idempotent), Verify `scripts/verify-standalone.mjs`, Browser-Suite `tests/standalone.spec.mjs`. **Stillgelegt:** `dist/lab-player.html` (996 KB, gelöscht). `scripts/build.mjs`, `render-single-file.mjs`, `double-build.mjs`, `verify-dist.mjs` bleiben als Dev-Werkzeuge lauffähig, „sind aber kein Auslieferungspfad mehr (kein toter Code: Aufrufbarkeit erhalten)".

**Laufzeit-Generierung im Standalone:** direkter Browser-fetch an `https://inference.baseten.co/v1/chat/completions` (`meta-models/muse-spark-open-1026`, BYOK/sessionStorage). **Kein Proxy-Port**; `scripts/proxy.mjs` bleibt optionaler Fallback, wird **nie automatisch gestartet**.

### 4.14 `docs/NEXT-STEPS.md` (28.10., 86 Z) — die ehrliche Lückenanalyse

**Kernaussage:** „Das FI-Fachkonzept ist die geltende Spec — die Codebasis implementiert ihre **Hülle** (Player, Guard, Verify S1–S5, Bibliothek, Freimodus, i18n, 20/20-Baselines), aber **NICHT ihren didaktischen Kern**."

**10 dokumentierte Lücken (Fachkonzept-Forderung vs. Codebasis-Stand):**

| Forderung | Stand | Lücke |
|---|---|---|
| Curriculum-Mapping im Produkt (LF-Titel, Zeitrichtwert, ARP-Block, B-14) | Manifeste kennen kein `curriculum_ref`; UI zeigt keines | Daten + Badge fehlen |
| Aufgaben A/B/C mit Sollwert, Einheit, Toleranz + numerische Prüfung | `messwert`-Tasks werden geprüft (Toleranz %), `zuordnung`-Tasks nur per Klick abhakbar | Selbst-Abhaken ohne Nachweis |
| 3 Hinweisstufen je Aufgabe (B-07) | keine Hint-Daten, keine Anzeige | Daten + UI fehlen |
| Adaptives Stufenregelwerk (Start B, 2× hoch/runter, nie unter A, B-08) | keine Stage-Engine | Engine fehlt |
| Quiz je Lab (4 Optionen + Begründung je falscher Option, B-09) | kein Quiz-Modell, keine UI, keine Auswertung | alles fehlt |
| Tutor-Texte P3 mit Lernfeld-Anker (B-12) | Freimodus erzeugt Modelle, keine Tutor-Texte | Prompt + UI fehlen |
| Fehlvorstellungen als Interventions-Design | nicht abgebildet | Konzept-Arbeit |
| Physik-Invarianten je Domäne (B-05) | S2-Geometrie generisch; keine Fach-Invarianten (Subnet-Mathe, SQL-Mengen, Sortier-Traces) | je Lab 1 Satz echter Prüfungen |
| Schul-UX-Baseline (44px-Touch, Tastatur, Kontrast 4,5, B-11) | nie auditiert | Audit fehlt |
| Demo-Video + README + Submit (B-15, Abgabe 04.11.) | Demo-Timer-Skript existiert (10 s, fehlerfrei), Rest fehlt | zeitkritisch |

**Gegenposition, belegt:** „Technik-Seite ist dagegen stark: Build grün, Verify 10× gelb, 20/20-Baselines stabil, O-04-Nachweise (Doppel-Build byteidentisch, dist-Prüfung, Coldstarts), F5-Fallback simuliert bestanden, 35er-Didaktik-Benchmark + 100 3JSBench-Briefs als Regression."

**7 UX-Befunde per Screenshot-Sichtung (keine Vermutung):**
1. „**1 Messungen**" — Grammatik-Bug, Pluralisierung.
2. Verify-Panel zeigt stabil „Modell gpu-example", egal welches Lab geladen ist — irreführend; Ampel flippt zwischen Läufen (rot/gelb).
3. **3D-Labels aus der Distanz unlesbar** (H2O/NaCl: winzige Sprite-Punkte am Bildrand), obwohl „5 Labels geladen" gemeldet wird.
4. **Kein Onboarding** — Erststart landet kommentarlos im Default-Lab.
5. **Tastatur-/Touch-Bedienung unauditiert** — Orbit braucht Drag.
6. Aufgaben wirken **beliebig abhakbar** — „Vertrauensschaden beim Lehren-Publikum".
7. **Keine Lernfeld-Sichtbarkeit** — ein Azubi sieht nie, zu welchem LF/ARP sein Lab gehört.

**9 priorisierte Next Steps nach Wirkung pro Stunde:** 1 UX-Bugfix-Bundle (1 Call) · 2 Curriculum-Badges (1 Call, B-14, jury-sichtbar) · 3 Aufgaben-Nachweis (1 Call) · 4 Quiz v1 (2 Calls) · 5 Adaptiv-Engine (2 Calls) · 6 Schul-UX-Audit (1 Call + Geräte-Test) · 7 Tutor P3 light (1–2 Calls) · 8 Fach-Invarianten je Lab (je 1 Call, zuerst SI-1/DuP-1/AE-2 als Leuchttürme) · 9 README + Demo-Video + Submit (ab 02.11., zeitkritisch).

**Bewusst NICHT (mit Grund):**
- **E1/M1/W1-Elektro-Labs** (altes Fachkonzept-final): „FI-Track gewählt, keine Doppelspur vor der Abgabe."
- **OpenRouter-Pfad** (inaktiv seit 28.10.): ersetzt durch Baseten-Pfad.
- **Push auf GitHub**: nur lokale Commits (User-Vorgabe); Submit-Abgabe separat.
- **Live-Generierung im 180-s-Fenster**: „physikalisch unmöglich (92–401 s gemessen); Demo fährt ehrlich den F2-Pfad."
- **A-03**: Pfad + Skripte verifiziert grün, Generierung steht auf 429 des Gratis-Tiers → Retry innerhalb der Key-Stunde, danach als „ratenlimitiert, $0 verbraucht" dokumentieren.

### 4.15 `docs/licenses.md` (29.10.) — Lizenz-Audit

**Kernaussage:** Alle identifizierten Fremdbestandteile stehen unter MIT, Apache-2.0, ISC oder SIL OFL 1.1. **Kein NC-, ND- oder proprietäres Asset** im geprüften Material.

**Komponenten:** three.js 0.186.1 (MIT, CDN-Referenz) · Vue 3 (MIT, **Major-only-Pin → Versions-Drift**) · Tailwind CSS Play CDN (MIT, **unversioniert**; Anbieter dokumentiert Play CDN als „development-only, not intended for production") · Inter (SIL OFL 1.1, unversioniert, nicht selbst gehostet) · esbuild 0.28.2 (MIT, nur Build-Zeit) · Playwright 1.64.1 (Apache-2.0, nur Test) · Alpine.js 3.17.5 (MIT, im **stillgelegten** `dist/lab-player.html`, nicht im Standalone) · `@vue/shared`/`@vue/reactivity` 3.5.41 (MIT, nur via Alpine im Alt-Artefakt) · 3JSBench-Briefings (MIT, © 2026 General Context, nicht im Release-HTML) · Mermaid/Chart.js/d3-light/KaTeX (MIT/ISC, **nur Eval-Kandidaten, nicht installiert oder gebündelt**) · Baseten-Modell-Endpoint (keine Gewichte enthalten, **keine Modell-Gewicht-Lizenz im Repo**).

**Die 6 offenen Punkte (O-1…O-6):** O-1 **Projekt-Lizenz fehlt vollständig** — „The repository owner must choose and add a project license before redistribution." · O-2 3JSBench-Quellreferenz inkonsistent mit dem Upstream-Repo · O-3 Modell-Bedingungen des Baseten-Endpoints nicht belegt · O-4 CDN-Version-Drift (Tailwind, Vue, Inter nicht gepinnt) · O-5 Tailwind Play CDN ist development-only · O-6 Historische v11-Basis des Standalone-Builds nicht versioniert.

**Reproduzierbarkeit:** Der v13-HTML referenziert externe Ressourcen und **benötigt Netzwerk**. „CDN references are not equivalent to bundled copies and do not pin every version. This creates a reproducibility risk even where the referenced license permits use."

### 4.16 `docs/REALGEBAEUDE-MACHBARKEIT.md` (29.10., 26 Quellen) — Grenzenprüfung

**Kurzantwort (als Synthese gekennzeichnet):** „**Ja** — als didaktisches Maßstabsmodell. **Nein** — als metrisch maßgetreuer Nachbau."

**Die 3 tragenden Befunde:**
1. **Maße sind die Schwachstelle, nicht die Form.** L-Bracket-Studie: Code-Level-Prompts = perfekte Rekonstruktion über alle Metriken; 3-View-Zeichnungen am schlechtesten. P3D-Bench: J-Sem ≈ 0,7 vs. J-Geo ≈ 0,5. Für Gebäude verschärft sich das durch Fehlerkumulierung (12 Instanzen × n Fehlerstellen).
2. **Iterative Verifikation verbessert Geometrie messbar** (CADCodeVerify: −7,30 % Point-Cloud-Distanz, +5,5 % Compile-Rate). Aber **BIM-Code ist strukturell valide, semantisch lückenhaft** (Text2BIM: Pass-Raten > 0,95, aber fehlende Bauteile, unlogische Tür-/Fensterlagen, Halluzinationen).
3. **Rechtlich ist der 3D-Nachbau eines geschützten Bauwerks KEINE Panoramafreiheit-Nutzung.** BGH (I ZR 242/15, „East Side Gallery", 19.01.2017): „Eine Vervielfältigung des Werkes in dreidimensionaler Form ist danach auch dann nicht zulässig, wenn das Werk als verkleinertes Modell oder aus anderen Materialien nachgebildet wird". § 23 Abs. 2 Nr. 3 UrhG nennt den Nachbau eines Werks der Baukunst sogar **explizit** als zustimmungspflichtige Bearbeitung.

**Die Brücke zum Projekt:** Das Brandenburger-Tor-Modell ist bereits ein **1:50-Maßstabsmodell** — 1,25 Einheiten Modellbreite bei deklarierten 62,5 m Realmaß, Label-Spanne 1,30 m; `GEO_LIMITS.extentMaxM = 1,50 m` erzwingt den Maßstab strukturell. „Didaktisch ist das **richtig**: der Lernende liest ‚62,5 m' ab, statt eine maßhaltige Geometrie nachmessen zu müssen."

**Die 8 konkreten Schritte (Empfehlung):** Objektscreening nach Rechtsfilter → Geometrie aus offenen Daten (Berliner LoD-2, dl-de-zero-2.0) → **Maßliste als Single Source of Truth** (speist P1-Prompt, `addMeasurement`, Manifest) → **neue Verifikationsschicht S6 „Maßhaltung"** (Soll-Länge vs. modellierte Bounding-Box, Toleranz ±1 % Bauteillänge) → Instancing-Pflicht für Wiederholteile (Brandenburger Muster: 12 Säulen als 1 InstancedMesh → 6 Meshes) → Budget-Hinweis (**~378 Dreiecke, 6 Meshes, aber 9.630 von 34.000 Bytes** — „Die Byte-Grenze, nicht die Geometrie, limitiert Detailtiefe") → Repair-Loop aktivieren und messen → eigenes Realgebäude-Regressions-Set (3–5 Briefs) ergänzen.

**Belastbarkeitsgrenzen, die das Dokument selbst benennt:** Kein Benchmark misst „Realgebäude" (3JSBench-Tasks sind Objekte mit ~10 Bauteilen — die Extrapolation ist Ableitung, nicht Messung). Rechtsstand 29.10.2026,deutsches Recht, US/EU abweichend. **Keine unabhängige Messung**, wie oft ein LLM-Modul ein vorgegebenes Bauteilmaß korrekt umsetzt. threejseval-Werte sind Live-Board-Werte mit Betreiber-Vorbehalt.

### 4.17 Weitere Umsetzungsdokumente (Kurzcharakteristik)

| Dokument | Kernaussage |
|---|---|
| `docs/modelmuse-v8-spec.md` (182 Z) | v8-Design-Spec für den 2D-Diagramm-Zweig: Domain-Grenzen D1–D5, `renderDiagram2D(svgHost, lab)` mit exakter Signatur, State-Machine `viewerMode` ('2d'/'3d'), **einzige Schema-Änderung `is3d`**, i18n-Vertrag (DE+EN, `mode3d`/`diagramNote`/`is3dReason`), Assembly-Vertrag (Backup → Muse-Output mit Markern → deterministisches `assemble-v8.mjs` → `verify-v8.mjs`), Acceptance-Counts (`renderDiagram2D` ≥2, `is3d` ≥19 …) |
| `docs/three-186-api-pin.md` | API-Pin: 36 erlaubte three-Namen (Schnittmenge P1-Importliste ∩ Vendor-Bundle ∩ `THREE_KNOWN_EXPORTS`), Bundle-only-Namen mit Begründung, verbotene Namen, bekannte 186→187-Drift |
| `docs/ROUTING-TESTS.md` (87 Z) | 6/6 Routing-Fälle grün + Fail-closed-500 grün; **Fehlrouting-Analyse**: `p0-router.txt` hatte nur 4 Few-Shots → `schnitt-ansicht` und `tabelle` ohne Beispiel → 2 Few-shots ergänzt. Bekannte Kollision: `schnitt-ansicht` und `tabelle` mappen beide auf Vendor-Kind `generic` (semantisch unscharf, im Gate-Sinn korrekt) |
| `docs/NEUBAU-UI-CHECK.md` (63 Z) | Beweist, dass die 6 3D-Modelle + Koffein neu gebaut sind (Hashes, Timestamps 28.10. 23:40 → 29.10. 00:00, `environmentIntensity = 0.55` ×6, `PCFShadowMap` ×6, DPR-Cap, Harness 6/6 grün, Guide-Unit-Test 14/14). **Klärt 4 Diskrepanzen** — u. a. dass das „Fußball-Modell" im User-Vergleichsbild ein **vom User lokal generiertes Free-Lab** war (Browser-localStorage, nie committet), kein kuratiertes Modell |
| `docs/LEGACY-INVENTUR.md` (82 Z) | Inventur A01–A07 (aktiv, behalten) vs. L01–L26 (Löschliste). Regel: **„NICHTS gelöscht. Nur inventarisiert."** Risikostufen: `aktiv` / `unsicher` / `loeschbar`. L01–L15 = ca. 6,9 MB, **0 versioniert** (`git ls-files designer-scratch/` = 0) |
| `docs/LEGACY-OFFEN.md` (40 Z) | L16–L26 bleiben, je einzeln freizugeben. **Korrektur der Inventur**: „Tatsächlich sind in `scripts/_tmp/` **4 Dateien versioniert** (`.gitkeep`, `i18n-manifests-tmp.json`, `repro-check.tmp.mjs`, `tmp-ae3-verify.mjs`) (Commit `6ca4bda`). Diese 4 wurden **behalten**, nur Unversioniertes wurde gelöscht." Grün-Beleg nach L01–L15-Löschung: Backup-Tarball 2.285.265 B / 275 Einträge + SHA256, `build` OK, `verify:all` 10 Modelle gelb, `test:unit` 122/0 |
| `docs/ABWEICHUNGSBLATT-2026-10-27.md` (18 Z) | Datierte Abweichungen der Bauplan-Originalwerte: `guard-static.js` 9.000→12.902 (Neu-Max 13.500) · `livegen.js` 9.000→9.023 · `ui-livegen.js` 15.500→15.585 · `three.entry.js` 700→~707→~723 (700 bleibt, Istoleranz im Bundle) · `modellmatrix.json` gpu-example labelsMin 9→10. „Budget-Folge: keine. Alle Erhöhungen liegen im Artefakt-Komfort." |
| `docs/ABLAGEKONVENTION.md` (36 Z) | Ablageregeln (O-15, ab 27.10.): Diagnose-/Tmp-Skripte → `scripts/_tmp/` · Logs → `dist/logs/` · Roh-Outputs → `dist/raw/` · versioniert: `dist/baselines/`, `dist/{generation-log,verify-report,build-report,attestation}.json`, `dist/BACKLOGFIX-REPORT.md` · **Builder ist der einzige Schreibweg**: `node scripts/build-standalone.mjs` (Guards sichern die v11-Basis, Zweitlauf bricht ab) |
| `docs/INSTALLATION-MUSE.md` (21 Z) | `muse.exe` v1.4.13 (419 MB), Modell-Pin je Call, Auth nur `--api-key-stdin`. „**NICHT MACHBAR:** `creditsRemaining` pro Call — `muse usage` liefert im Key-Modus keine abfragbare Zahl (ehrlich, nicht erfunden)." |
| `docs/AKTUELL-SCREENSHOTS.md` (57 Z) | 14 Shots, nonBg ≥ 3 %, Helligkeit 10–245, SD ≥ 8, **0 pageerrors, 0 console-errors**; Canvas/SVG per Bounding-Box im Frame verifiziert. Dokumentiert: Standalone kennt nur 10 Labs; `ae-2` rendert je Viewer anders (Slim 2D-SVG, Standalone 3D-Canvas — „Kein Fehler, sondern Standalone-Produktstand") |

---

## 5. Entscheidungsprotokoll

| # | Entscheidung | Datum | Begründung | Beleg |
|---|---|---|---|---|
| E-1 | **Zielberuf: Fachinformatiker (SI/DuP/AE)** statt Elektro/Mechanik/Werkstoffe | 23.10. | User-Korrektur; die Elektro-Labs wären eine Doppelspur vor der Abgabe | Session `20261022_204726_5df61dfc` Msg 43121–43128; `docs/NEXT-STEPS.md` §4 |
| E-2 | **Verifier vor Generator** | 22.10. | „Wer erst den Generator baut und dann den Prüfer, hat am Ende einen Prüfer, der den Generator nicht behindert" | FI-Fachkonzept §11 |
| E-3 | **Modell erzeugt deklarative Spec, nicht Code** | 22.10. | Halluzinierte Physik strukturell eliminieren | Architektur-Axiom, `gesamt-v2` Teil 2 §1.3 |
| E-4 | **Pivot zu Code-Gen-Kern** (v3) | 26.10. | USP „freies Modell-Vokabular + kuratierte Beweiskette"; Rollenmodell Lehrer/Auszubildender/Agent | `meta-hackathon-FACHKONZEPT-v3-codegen.md` §1–§2 |
| E-5 | **three.js r186 behalten** | 28.10. | Guide §7; keine Engine-Migration | `implementation-guide-3d-qualitaet.md` §7 |
| E-6 | **Draw-Call-Limit 120 → 400** | 27.10. | Zielklasse Ryzen-5-/i5-iGPU + SwiftShader-Toleranz; alle Erhöhungen im Artefakt-Komfort | `dist/BUDGET-NACHTRAG-2026-10-27.md`; `docs/ABWEICHUNGSBLATT-2026-10-27.md` |
| E-7 | **OpenRouter entfernt, Baseten als Laufzeit-Standard** | 28.10. | Meta-Regel: Laufzeit nur Meta-Modelle. `openrouter` → E-GEN-404, Registry-Eintrag gelöscht, Unit-Test pinnt das | `docs/BASETEN-MIGRATION.md` |
| E-8 | **Key nur BYOK/sessionStorage mit Zustimmung; nie in Code/Logs/Docs** | 27.–28.10. | Durchgängig in allen Ledgern, Docs und Skripten | `docs/BASETEN-MIGRATION.md` §1; `docs/PROXY-BOOTSTRAP-BEFUND.md` §1; `docs/INSTALLATION-MUSE.md` |
| E-9 | **Direkt-Call vor Proxy**, Proxy nur als Transport-Fallback | 28.10. | CORS-Preflight ist unvermeidbar; definitive Antworten (401/404) fallen nicht zurück | `docs/PROXY-BOOTSTRAP-BEFUND.md` §1 |
| E-10 | **P0-Router: 3D vs. 2D, fail-closed auf 3D** | 28.10. | Ein zusätzlicher Call, keine npm-Dependency, Routing darf Generierung nie abbrechen | `docs/ROUTER-KONZEPT.md` §3 |
| E-11 | **SVG nativ statt Mermaid/Chart.js/d3/KaTeX** | 28.10. | „SVG nativ (0 KB) deckt alle 6 Fälle ab" — Leichtgewicht-Prinzip über Feature-Richheit | `docs/2D-UMSTELLUNG-2026-10-28.md` §7; `docs/2D-STACK-EVAL.md` §1 |
| E-12 | **6 Labs auf 2D umgestellt** (dup-1..3, ae-1..3) | 29.10. 00:14 | „Reine Notations-/Diagramm-Lernziele; 3D erzeugt falsches mentales Modell" | `docs/MODELLPORTFOLIO-VORSCHLAG.md` §3.2; Commit `7f483de` |
| E-13 | **Koffein (C8H10N4O2) als Chemie-Ersatz** | 28.–29.10. | 24 Atome, 2 Ringsysteme, 9.648 Tris = 6,4 % Budget; H2O scheiterte an fehlender `pm`-Einheit | `docs/MODELLPORTFOLIO-VORSCHLAG.md` §4; Commit `341bcf5` |
| E-14 | **Standalone = einzige Auslieferung; `dist/lab-player.html` stillgelegt** | 29.10. 01:19 | GitHub-Pages ohne Build; Dev-Skripte bleiben lauffähig (kein toter Code) | `docs/ARCHITEKTUR-PFADE.md`; `docs/source-de/STANDALONE-REPORT-2026-10-29.md` §5 |
| E-15 | **Slim-Generator** (Quiz/Progress/Tipps raus) | 29.10. 00:15 | UI weg von der Lernplattform, hin zum Model-Generator/-Viewer (User-Vorgabe) | Msg 48036; Commit `292494e` |
| E-16 | **Keine blinde Komplett-Regeneration** der 3D-Modelle | 29.10. | Alle 12 src-Modelle bestanden die Harness-Gates (Guide §3: Abbruch GRÜN, kein weiterer Call); Regeneration nur bei Fail — es gab keinen | `docs/source-de/STANDALONE-REPORT-2026-10-29.md` „Entscheidungen / offene Punkte" |
| E-17 | **Swap `arch-fassade` → `arch-brandenburger-tor`** | 29.10. 09:29 | „Real-Gebäude statt generischer Fassade (Maße belegbar, Quellen im Manifest)"; `arch-fassade` mit unbelegten Maßen war als „langweilig" beanstandet | `dist-standalone/build-showcase-report.json`; `dist-standalone/SHOWCASE-REPORT-2026-10-29.md` §1a |
| E-18 | **Maßstabsmodell + echte Bemassung statt 1:1-Nachbau** | 29.10. | Rechtlich (§ 59/§ 23 UrhG, BGH I ZR 242/15) und didaktisch („der Lernende liest ‚62,5 m' ab") | `docs/REALGEBAEUDE-MACHBARKEIT.md` §5.1 |
| E-19 | **Neue Verifikationsschicht S6 „Maßhaltung"** | 29.10. (Empfehlung) | „Maßtreue wird derzeit nicht geprüft" — S1–S5 prüfen Codeform, Verbote, Budgets, Didaktik, nicht die Maßhaltigkeit | `docs/REALGEBAEUDE-MACHBARKEIT.md` §5.2 Punkt 4 |
| E-20 | **Git: nur lokale Commits, kein Push** | laufend | User-Vorgabe; Submit-Abgabe separat | `docs/NEXT-STEPS.md` §4; alle Commit-Messages „(nur lokal, kein Push)" |
| E-21 | **Tags als Rollback-Anker statt Commit beim Legacy-Cleanup** | 28.10. | „Committing would misattribute foreign hunks" — der Working Tree enthielt parallele Session-Änderungen | `cache/scratch/legacy-cleanup-L16-L26-20261028/belege/ERGEBNIS-L16-L26.md` |
| E-22 | **Ampel bleibt „gelb" für alle 12/13 Modelle** | laufend | „auto-geprüft, Lehrkraft-Freigabe ausstehend" — kein Grün ohne menschliche Freigabe | `dist/attestation.json`; `docs/NEUBAU-UI-CHECK.md` §5 |
| E-23 | **Eigenes Hermes-Profil `hackathon`** | 27.10. | Schlüssel nur mit exakt diesem Modell gültig → kein Modellwechsel im Default-Profil | Session `20261027_200148_b6e15517` |
| E-24 | **Realgebäude-Prüfung zusätzlich zu den 5 Showcase-Modellen** | 29.10. 10:09 | Prüft, ob die Code-Gen-Architektur überhaupt für Gebäude trägt, bevor weiter investiert wird | `docs/REALGEBAEUDE-MACHBARKEIT.md` |

---

## 6. Irrwege, Fehlschläge und verworfene Spuren

### 6.1 Konzept-Irrwege

| Irrweg | Warum verworfen | Beleg |
|---|---|---|
| **Elektro/Mechanik/Werkstoffe** (454-Zeilen-Fachkonzept) | Falscher Ausbildungsberuf; User-Korrektur 23.10.; E1/M1/W1-Labs explizit als „bewusst NICHT" markiert | Session `20261022_204726_5df61dfc`; `docs/NEXT-STEPS.md` §4 |
| **Deklarative Spec als Endprodukt** (E3) | Für die „freie Begriffswahl"-USP zu starr; der Code-Gen-Kern ermöglicht Hardware/Architektur/Autos/Pflanzen | `meta-hackathon-FACHKONZEPT-v3-codegen.md` §1 |
| **`meta-hackathon-gesamt-v2.md` als lebende Spec** | Enthält die Elektro-Fassung und 4.736 Zeilen mit Changelogen; die tragenden Entscheidungen sind in die Einzel-Dokumente gewandert | Datei-Stand 22.10., FI-Fachkonzept 23.10. |
| **Architekturmodell-Session mit nur 4 Messages** | `20261022_205207_9fcb49` (4 Msg, 3 min) — auffällig kurz für ein 70-KB-Dokument. Die 70-KB-Architektur entstand laut Session-Output aus `proc_57e246cd6f56`, also einem **anderen** Worker-Durchlauf. Die Zuordnung der 4-Msg-Session zur Architektur-Arbeit ist damit **nicht belastbar belegt** | Session-Liste vs. Session-Output |

### 6.2 Produkt-Irrwege

| Irrweg | Befund | Beleg |
|---|---|---|
| **OpenRouter als Laufzeit-Provider** | 28.10. entfernt. Zuvor: 22 Fundstellen **erfundener** OpenRouter-Modell-IDs (`gpt-6-astra`, `claude-opus-5-5`, `gemini-4-argon`) in Registry, Proxy, Empfehlungstabelle und Tests | `dist/AUFTRAG-REPORT` / Worker-Call-02; `docs/BASETEN-MIGRATION.md` §3 |
| **Proxy als Primärweg** | Auf Direkt-Call umgestellt; Proxy nur Transport-Fallback, im Standalone **nie** automatisch gestartet, keine `8787`-Referenz im Artefakt | `docs/PROXY-BOOTSTRAP-BEFUND.md`; `docs/source-de/STANDALONE-REPORT-2026-10-29.md` §6 |
| **`dist/lab-player.html` als zweite Produktlinie** | „Die beiden Artefakte haben verschiedene Lab-Sätze … Ein Portfolio gibt es derzeit nicht, sondern **zwei divergierende**." → Lab-Player stillgelegt und gelöscht | `docs/MODELLPORTFOLIO-VORSCHLAG.md` §0; `docs/ARCHITEKTUR-PFADE.md` |
| **Mermaid/Chart.js/d3-light/KaTeX einbinden** | Evaluiert (mit allen Lizenz-/Größen-/Gate-Messungen), aber **nicht eingebunden**. `ALLOW_2D_SPECIFIERS` reserviert die Plätze, alle Fixtures nutzen `from '2d-svg'` | `docs/2D-UMSTELLUNG-2026-10-28.md` §7; `docs/ROUTING-TESTS.md` |
| **Text-to-3D-Meshes (Hunyuan3D u. a.)** | 40 k–1,5 Mio. Faces, 0,5–19,8 MB GLB — Größenordnungen über dem 34-KB-Budget | `docs/ki-modellqualitaet-recherche.md` §3 |
| **`arch-fassade` als Architektur-Showcase** | Generischer Fassadenausschnitt, 1,2 m, **unbelegte Maße**, als „langweilig" beanstandet → restlos entfernt (0 Treffer im Artefakt) | `dist-standalone/build-showcase-report.json`; `SHOWCASE-REPORT` §1a |

### 6.3 Technische Fehlschläge und Debugging-Ketten

| Fehler | Symptom | Ursache | Auflösung | Beleg |
|---|---|---|---|---|
| `E-S2-BOOT: does not provide an export named 'ConeGeometry'` | Modell bootet nicht | Modell importiert `ConeGeometry`, nicht im Vendor-Bundle, nicht in `repairThreeImports` | Bundle-/Repair-Map erweitern | `docs/BASETEN-MIGRATION.md` §6 Versuch 1 |
| `E-S2-BOOT: Scene is not defined` | Proxy-E2E scheitert, Exit 1 | Repair-Code war drin (`guard-static.js` Z. 294, `livegen.js` Z. 187), aber kein grüner Lauf belegt | Als offene Lücke gemeldet, nicht kaschiert | Worker-Call-Output 27.10. |
| Helper-Signatur objektbasiert statt positional | S1 grün, aber Annotationen fehlten | Modell-API-Missverständnis | P2-Repair, 12 Aufrufe korrigiert, Rest byteidentisch | `dist/generation-log.json` Call 1–2 |
| PointLight 3.0 überbelichtet / Shadow-Frustum via String-Concatenation / room-Leak | GPU-Karte „flach" | Stil-Rezept des Prompts | 2 chirurgische P2-Runden (je exakt 3 Fixes) | `dist/generation-log.json` Call 3–5 |
| Bauteil-Checkboxen blenden nur das Label aus | Overlay wirkungslos | `player.setParts` sendet `parts.hidden`, aber **kein** Modell wertet `patch.parts` aus (0 Treffer in `src/models/*.js`); `addLabel`/`addMeasurement`-Handles wurden nicht gespeichert | **v7**: `labelRegistry`/`measureRegistry` + `partGroups` via `scene.traverse` + `getWorldPosition` | v7-Briefing; `docs/NEUBAU-UI-CHECK.md` |
| Weiße Seite (3×) | Seite bleibt leer | Offline: Tailwind/Vue undefined → 2 pageerrors; online: **hängender Head-CDN-Tag blockiert den Parser** → rein weiß ohne Hinweis | v8-Fix (Tailwind-Guard, Vue-Mount-Guard, syncViewer-Give-up → 2D-Badge); v10-Fix (Boot-Watchdog **vor** allen CDN-Tags, `window.onerror`/`unhandledrejection`-Banner + 9-s-Timeout) | Ledger #16, #17, #26 |
| `E-FREE-IMPORT: IcosahedronGeometry` | Freimodus-Registrierung scheitert | Geometrie-Allowlist unvollständig | v9-Fix2: 28 neue Namen in ALLOWED/Außen-Destruktor/Prolog/T-Map | Ledger #21 |
| „Cannot use import statement outside a module" | auch für BoxGeometry, seit v8 | `registerFree` strippt Import-Zeilen nicht | v9-Fix3 Import-Strip | Ledger #22 |
| BufferGeometry-Attribute abgelehnt | Freimodus-Modell mit `BufferAttribute` | Allowlist-Lücke | v10-Fix4, 20 Namen × 4 Stellen | Ledger #25 |
| H2O/NaCl-Chemie-Modelle ohne Maße | Verify rot, `zahlenGefunden: []` | `UNIT_RE` kennt kein `pm` → Messhinweis verworfen | Ersatzmolekül Koffein; Einheiten-Entscheidung | `docs/MODELLPORTFOLIO-VORSCHLAG.md` §0 Punkt 3 |
| S3 durchgängig `skip`, S4 ohne Messwert | „gelb" stützt sich faktisch nur auf S1/S2/S5 | `verify-all.mjs` Z. 56/58–71 | Als **substanziellste Lücke zur Definition of Done** benannt | Worker-Call-Output 27.10.; `dist/verify-report.json` |
| 10 kuratierte Modelle ohne `meta_i18n` | Freimodus-Prompt verlangt es, 0/10 liefern es | Generator-Disziplin | Als offener Punkt im Backlog | Worker-Call-Output 27.10. |
| **Models-Wipe** 29.10. 08:20 | `src/models/*` geleert → EMPTY-STAND (117.574 B), `test:unit` 140/148 rot, Browser-Suite erwartet 12 Modelle | Absichtlicher Test des Neugenerierungswegs | Tag `models-pre-wipe-20261029-082023` + Backup (24 SHA256) + `regen-anleitung.md` + `pending-key-step.txt` (Key-Übernahme wartete auf Freigabe, „es wurde **KEIN** Key angefasst, kopiert oder geloggt") | `cache/scratch/models-wipe-20261029-082023/` |
| **Fußball-Modell** nicht reproduzierbar | User sah es im Vergleichsbild | Vom User im Browser per Generator erzeugtes Free-Lab (localStorage), **nie committet**; Ledger #22/#25 = nur Test-Snippet für `registerFree` | Als „falls gewünscht: per Generator neu erzeugen und als `free-fussball` kuratieren" notiert | `docs/NEUBAU-UI-CHECK.md` §4 Punkt 3 |

### 6.4 Prozess-Irrwege

- **Zwei parallele Produkt-Pfade über 48 h** (`dist/lab-player.html` vs. `dist-standalone/`) — Kosten: doppelte Builder, divergierende Lab-Sätze, wiederholte Screenshot-Belege. Auflösung: 29.10. Standalone-only.
- **`docs/`-Duplikate in zwei Sprachen** (deutsches Original + englische Release-Fassung mit `source-de/`-Archiv). Das ist eine bewusste Ablagekonvention (Release-facing englisch, historisch deutsch), erzeugt aber Doppelpflege — z. B. existieren `ROUTER-KONZEPT.md` (englisch) und `docs/source-de/ROUTER-KONZEPT.md` (deutsch, 15.277 B) nebeneinander.
- **Archivierung `dist/manual-tests/*.png`** (10 Dateien, ~44 MB) liegt als „unsicher" in L18 — nicht gelöscht, aber nicht archiviert.

---

## 7. Aktueller Stand, Beleg-Divergenzen und offene Lücken

### 7.1 Stand 29.10.2026 (verifiziert im Repo)

| Größe | Wert | Prüfmethode |
|---|---|---|
| `src/models/*.js` | **13** (ae-1..3, arch-brandenburger-tor, chemie-koffein, dup-1..3, free-handbohrmaschine, gpu-example, si-1..3) | `ls src/models/*.js \| wc -l` |
| `src/models/manifests/*.json` | **13** | `ls src/models/manifests \| wc -l` |
| `dist-standalone/modelmuse-standalone.html` | **276.648 B** | `wc -c` |
| Eingebettete Modelle im Artefakt | **5** (`INIT[...]`-Marker: arch-brandenburger-tor, chemie-koffein, free-handbohrmaschine, gpu-example, si-1) | `grep -oE "INIT\['…'\]"` |
| `__SOURCES` | gefüllt mit allen 5 Quelltexten | `grep __SOURCES` |
| `dist/verify-report.json` | **13 Modelle**, je `S1:pass, S2:pass, S5:pass`; **S3/S4 `skip`** bei arch-brandenburger-tor, chemie-koffein, free-handbohrmaschine, gpu-example, si-1, si-2, si-3 | JSON-Auswertung |
| `dist-standalone/showcase-harness/SUMMARY.json` | 5 Modelle, alle `green`, `fails: []`, 0 Auto-Repairs | JSON-Auswertung |
| `dist-standalone/build-showcase-report.json` | 5 Modelle, 276.375 B, Swap arch-fassade → arch-brandenburger-tor | JSON-Auswertung |
| Git | 7 Commits, 4 Tags, **21 uncommittete Änderungen** (u. a. 6 Docs, `package.json`, `prompts/p0-router.txt`, `src/vendor/diagram-2d.js`, `src/schema/manifest.schema.json`) | `git status --short` |

### 7.2 Beleg-Divergenz (offen, nicht aufgelöst)

**Befund:** `dist-standalone/STANDALONE-REPORT-2026-10-29.md` und `docs/FINAL-NACHWEISE.md` beschreiben den **EMPTY-STAND**:
- Artefakt **117.574 B** (bzw. 118.379 B im Nachtrag), **0 Modelle**, `LABS` und `__SOURCES` leer
- `test:unit` **140/148**, 8 Fehler (fehlende `src/models/si-1.js`, `gpu-example.js`, `dup-1.js`; Manifest-Inventar leer statt ≥ 7; 12-Entry-Matrix vs. leeres Inventar)
- Browser-Suite nicht gegen das leere Artefakt gelaufen
- „**Publication hold**": „Do not publish this empty-state artifact as the populated teaching release."

**Demgegenüber:**
- Das **aktuelle** Artefakt hat 276.648 B und 5 eingebettete Modelle (verifiziert per `grep`).
- `src/models/` enthält **13** Module + **13** Manifeste (verifiziert per `ls`).
- `README.md` (zuletzt 29.10. 10:23) sagt: „**Publication hold resolved 29.10.2026:** `npm run test:unit` passes **148/148** (13 model sources restored + new `arch-brandenburger-tor`, matrix in sync)."
- Der Showcase-Report (29.10. 09:2x) dokumentiert `verify:all` OK (13 Modelle, alle gelb), `test:unit` 148/148, Playwright 7/7.

**Bewertung:** Die beiden Dateien `dist-standalone/STANDALONE-REPORT-2026-10-29.md` und `docs/FINAL-NACHWEISE.md` sind **Zeitstempel-Snapshots vor der Wiederherstellung** (29.10. 08:24–08:32) und wurden seither nicht aktualisiert. Sie widersprechen dem aktuellen Artefakt-Stand. Sie sind nicht falsch in dem, was sie beschreiben — sie beschreiben einen überholten Zwischenstand. Das Muster „Das frühere v13-12-Modell-Report ist im deutschen Quellarchiv; benutze es nicht als Beleg für das aktuelle Artefakt" ist im Projekt bereits etabliert und gilt hier analog.

**Unabhängige Bestätigung:** Die parallele Source-Analyse `docs/ANALYSE-SOURCE-STAND.md` (29.10. 10:52) kommt zum identischen Befund und bezeichnet den eingecheckten EMPTY-Report ausdrücklich als „**überholt**; maßgeblich ist `SHOWCASE-REPORT-2026-10-29.md`". Sie misst den aktuellen Stand frisch: `test:unit` **148/148**, `verify:all` **13 Modelle alle gelb**, `build:standalone` idempotent exit 0, `verify:standalone` **OK (showcase verified)**, Playwright `tests/standalone.spec.mjs` **7/7**. Der Befund ist damit belegt, nicht nur vermutet.

**Zusätzlich belegt (Paralleldokument):** Es gibt **keinen gemessenen Baseten-Live-Call** — „kein Key im Profil; Produktpfad nur statisch verifiziert". Die 13× Ampel stehen auf „gelb (Teilbasis)", S3/S4-Browser-Belege sind teils skip. Das deckt sich mit dem 2D-Paket-Befund in `docs/BASETEN-MIGRATION.md` §6, wo beide E2E-Läufe über den **Proxy** liefen und nicht über den Standalone-Direktpfad.

**Auflösungspfad (empfohlen, nicht ausgeführt — außerhalb des Auftrags):**
1. `dist-standalone/STANDALONE-REPORT-2026-10-29.md` und `docs/FINAL-NACHWEISE.md` in `docs/source-de/` archivieren (die Paralleldoku empfiehlt denselben Weg) und den Showcase-Report versionieren.
2. `npm run test:unit` und `npm run verify:all` **frisch** laufen lassen und die Zahlen in die Doku übernehmen.
3. Die uncommitteten Änderungen committen — der Working Tree enthält versionierte Doku-Edits ohne Commit (17 modifizierte + ~50 untracked Dateien laut Paralleldoku; meine eigene Zählung: 21 modifizierte Einträge in `git status --short`).

### 7.2a Abgrenzung zu `docs/ANALYSE-SOURCE-STAND.md`

Diese Analyse und die parallele Source-Analyse decken **unterschiedliche Ausschnittsebenen** ab und ergänzen sich:

| | `ANALYSE-HISTORIE-KONZEPTE.md` (dieses Dokument) | `ANALYSE-SOURCE-STAND.md` |
|---|---|---|
| Fokus | **Entwicklungshistorie, Sessions, Konzepte, Entscheidungen, Irrwege** | **Quellcode-Stand, Architektur, Datei-Inventar, Tech-Debt** |
| Zeitachse | 07.–29.10.2026, 60+ Sessions, 7 Commits | Stand 29.10.2026, 17 modifizierte + ~50 untracked Dateien |
| Belegbasis | Session-DBs (FTS5), Git-Historie, Muse-Ledger, 26 Konzeptdokumente | `npm run test:unit`/`verify:all`/`build:standalone`/`verify:standalone`, Playwright, Dateiinventar |
| Überschneidung | Report-Divergenz 7.2 (beide identisch), Fachkonzept-Lücken, Legacy L16–L26 | — |

Kein Widerspruch zwischen beiden Dokumenten festgestellt.

### 7.3 Offene Lücken (aus den Belegdokumenten, priorisiert)

**Fachlich/didaktisch (aus `docs/NEXT-STEPS.md`, 28.10. — die substanziellste Lücke):**
1. Curriculum-Mapping **im Produkt** unsichtbar (kein `curriculum_ref` in den Manifesten, kein Badge) — direkt jury-sichtbares Kriterium (Impact + Educator-Reuse).
2. `zuordnung`-Aufgaben werden nur per Klick abgehakt, **ohne numerischen Nachweis** — „Vertrauensschaden beim Lehren-Publikum".
3. Keine Hinweisstufen (B-07), keine Adaptiv-Engine (B-08), kein Quiz (B-09), keine P3-Tutor-Texte (B-12).
4. **Keine Fach-Invarianten** in S2 — die Physik-/Fachlogik-Prüfungen aus dem FI-Fachkonzept sind nicht implementiert. Das ist der Kern der didaktischen Lücke: die Spezifikation definiert `NET.subnet_id_consistent`, `PROC.state_legal`, `PROC.utilization_matches` usw., der Code prüft generische Geometrie.
5. Kein didaktischer Benchmark: **kein** der 6 3D-Benchmarks misst Label-Qualität, Messungs-Korrektheit, Niveautrennung oder Einheitenprüfung (eigene Recherche, Abschnitt 7).
6. Schul-UX nie auditiert (44px-Touch, Tastaturpfad, Kontrast 4,5).

**Technisch:**
7. **S3 (Rendering) und S4 (Budgets) sind `skip`** bei 6 von 13 Modellen — die Ampel stützt sich faktisch auf S1/S2/S5.
8. **S6 „Maßhaltung" existiert nicht** — das Kernversprechen des Brandenburger-Tor-Modells (Maßstab 1:50 mit echter Bemassung) ist derzeit **ungeprüft**.
9. `tests/i18n-ui.spec.mjs` (4 Tests) wartet auf `#lab-mount iframe` in `dist/lab-player.html` — **seit dem Löschen von `dist/lab-player.html` strukturell obsolet**, aber noch im Testbestand.
10. Tailwind Play CDN ist development-only, Vue/Inter/Tailwind ohne Versions-Pin → Reproduzierbarkeitsrisiko bei CDN-Ausfall (bereits als „weiße Seite" erlebt).
11. **`dist/manual-tests/*.png`** (10 Dateien, ~44 MB) und L16–L26 warten auf Einzel-Freigabe.
12. 21 uncommittete Änderungen inkl. 6 Doc-Dateien.

**Rechtlich/Compliance:**
13. **O-1: Keine Projektlizenz** — „The repository owner must choose and add a project license before redistribution." Für eine Hackathon-Einreichung ist das der kritischste offene Punkt der Lizenz-Doku.
14. Baseten-Modellbedingungen sind im Repo nicht belegt (O-3).
15. Ein 3D-Nachbau geschützter Bauwerke ist rechtlich unzulässig — der aktuelle Showcase nutzt mit dem Brandenburger Tor ein **urheberrechtlich geschütztes** Bauwerk (Carl Gotthard Langhans, d. 1769; Schutzfrist 70 Jahre nach Tod → 1839, also **frei**). Dieser Punkt ist in `REALGEBAEUDE-MACHBARKEIT.md` §4.2 („Praktikum: vor 1956 verstorbene Architekten → i. d. R. frei") grundsätzlich adressiert, aber im Manifest nicht dokumentiert.

**Operativ (Abgabe 04.11.2026):**
16. **README + Demo-Video + Submit** fehlen (B-15). Der Demo-Timer-Skript läuft (10 s, fehlerfrei), der Rest steht aus.
17. Die Demo plant **keine Live-Generierung** — „physikalisch unmöglich (92–401 s gemessen); Demo fährt ehrlich den F2-Pfad."
18. Die 180-s-Demo-Fassung des Standalone-Standes (v13, ohne Quiz/Progress, 5 Modelle) ist **nicht** dieselbe wie die im FI-Fachkonzept §12 entworfene Demo (Fachrichtungswahl SI/DuP/AE, Retry-Loop live, Beweisketten-Export). Das Demo-Konzept und das ausgelieferte Produkt divergieren.

---

## 8. Belegverzeichnis

### 8.1 Konzeptebene (`C:/Users/flori/OneDrive/`)

| Datei | Bytes | Zeilen | Stand |
|---|---|---|---|
| `meta-hackathon-gesamt-v2.md` | 595.172 | 4.736 | 22.10.2026 |
| `meta-hackathon-FI-Labspecs.md` | 370.687 | 8.109 | 23.10.2026 |
| `meta-hackathon-FACHKONZEPT-FI-final.md` | 92.367 | 751 | 23.10.2026 |
| `meta-hackathon-FACHKONZEPT-final.md` | 47.379 | 454 | 22.10.2026 (verworfen) |
| `meta-hackathon-FACHKONZEPT-v3-codegen.md` | 19.853 | 266 | 26.10.2026 |
| `modelMuse-BAUPLAN-v1.md` | 57.568 | 352 | 26.10.2026 |
| `buildplan-docs.md` | 57.859 | 950 | 26.10.2026 |
| `buildplan-techspec.md` | 45.119 | 575 | 26.10.2026 |
| `buildplan-github.md` | 44.549 | 731 | 26.10.2026 |

### 8.2 Umsetzungsdokumente (`OneDrive/modelMuse/docs/`, 24 Dateien)

`2D-STACK-EVAL.md` (23.601 B) · `2D-UMSTELLUNG-2026-10-28.md` (6.362 B) · `ABLAGEKONVENTION.md` (2.508 B) · `ABWEICHUNGSBLATT-2026-10-27.md` (1.673 B) · `AKTUELL-SCREENSHOTS.md` (3.338 B) · `ARCHITEKTUR-PFADE.md` (2.182 B) · `BASETEN-MIGRATION.md` (5.823 B) · `FINAL-NACHWEISE.md` (2.377 B) · `implementation-guide-3d-qualitaet.md` (7.411 B) · `INSTALLATION-MUSE.md` (958 B) · `ki-modellqualitaet-recherche.md` (85.667 B) · `LEGACY-INVENTUR.md` (8.818 B) · `LEGACY-OFFEN.md` (5.176 B) · `licenses.md` (9.056 B) · `MODELLPORTFOLIO-VORSCHLAG.md` (31.852 B) · `NEUBAU-UI-CHECK.md` (7.333 B) · `NEXT-STEPS.md` (7.313 B) · `PROXY-BOOTSTRAP-BEFUND.md` (4.390 B) · `REALGEBAEUDE-MACHBARKEIT.md` (16.319 B) · `ROUTER-KONZEPT.md` (5.441 B) · `ROUTING-TESTS.md` (9.852 B) · `modelmuse-v8-spec.md` (9.901 B) · `three-186-api-pin.md` (2.956 B) + `source-de/` (5 Dateien: FINAL-NACHWEISE, implementation-guide, LIZENZEN, ROUTER-KONZEPT, STANDALONE-REPORT)

### 8.3 Mess- und Ledger-Belege

| Datei | Inhalt |
|---|---|
| `dist/generation-log.json` | 32 Call-Einträge mit Promptfile, Dauer, Output-Bytes, Exit, Befund |
| `dist/ledger-muse-calls.md` | 42 Zeilen (26.–27.10.), inkl. der lokalen Edits (Backlog O-06…O-14) |
| `dist-standalone/ledger-muse-calls.md` | 27 Zeilen (28.10.), Standalone-UI-Kette v1–v11 |
| `dist/verify-report.json` | 13 Modelle mit Layer-Verdicts, `routes`-Metadaten |
| `dist/attestation.json` | Ampel + Attestierung aller Modelle |
| `dist/build-report.json` | Build-Hash, Planwerte, `routes` |
| `dist/AUFTRAG-REPORT-2026-10-27.md` | Abschlussreport 27.10. (Budget-Nachtrag, 9/9 Hyper-Rollout, BYOK, Testzahlen) |
| `dist/BUDGET-NACHTRAG-2026-10-27.md` | Draw-Call-Nachtrag 120→400 |
| `dist-standalone/proof-report.json`, `proof-6modelle.json`, `final-budgets-6modelle.json`, `harness-6modelle.jsonl` | 3D-Kernsanierungs-Belege |
| `dist-standalone/showcase-harness/SUMMARY.json` | 5 Showcase-Modelle, alle grün in Iteration 0 |
| `dist-standalone/build-showcase-report.json` | Showcase-Build + Swap-Protokoll |
| `dist-standalone/SHOWCASE-REPORT-2026-10-29.md` | Showcase-Hauptbericht (5 Modelle, Swap, Harness, Verifikation, Screenshots) |
| `dist-standalone/STANDALONE-REPORT-2026-10-29.md` | EMPTY-STAND-Report (**veraltet**, siehe 7.2) |
| `dist-2d/router-2d-log.json`, `shot-2d-report.json` | Router-Beispiele (5 klassifiziert + 1 Fail-closed) und 2D-Pixel-Gate |
| `cache/scratch/models-wipe-20261029-082023/` | Wipe-Backup, 24 SHA256-Summen, Regen-Anleitung, Pending-Key-Step |
| `cache/scratch/legacy-cleanup-20261028/` | L01–L15-Backup (2.285.265 B, 275 Einträge) + build/verify/test-Logs |
| `cache/scratch/legacy-cleanup-L16-L26-20261028/belege/ERGEBNIS-L16-L26.md` | 85 Dateien gelöscht (alle git-ignored), Tags als Anker, `build.mjs`-Diff |

### 8.4 Session-Quellen

- Profil-`default`-DB `C:/Users/flori/AppData/Local/hermes/state.db` — 1.011 Sessions (10 Telegram-Hauptsessions im Hackathon-Fenster)
- Profil-`researcher` — 113 Sessions (19 Recherche-/Fachkonzept-Sessions)
- Profil-`coder` — 49 Sessions (20 Build-Sessions)
- Profil-`designer` — 8 Sessions (v1–v8)
- FTS5-Volltextsuche über `messages_fts` und `messages_fts_trigram` via `session_search`

### 8.5 Verwandtes Dokument

- `docs/ANALYSE-SOURCE-STAND.md` (29.10. 10:52, 16.816 B) — **parallele Source-Analyse** desselben Arbeitsstands (Quellcode-Architektur, Datei-Inventar, Tech-Debt). Ergänzt diese Analyse um die Frischmessung der Test-/Build-Lage und bestätigt den Befund aus Abschnitt 7.2 unabhängig. Abgrenzung siehe 7.2a.

---

## 9. Fazit

Die Projektgeschichte ist in 8 Tagen von einem **pädagogisch ambitionierten, curricular sauber belegten Konzept** zu einem **funktionsfähigen, messbar geprüften Generator** gewandert — mit **vier Richtungskorrekturen** (Fachinformatiker statt Elektro; Code-Gen statt deklarativer Spec; Baseten statt OpenRouter; Standalone-only statt zwei Artefakte), die jeweils durch einen belegten Befund ausgelöst wurden, nicht durch Präferenz.

Das stärkste Argument des Projekts ist **nicht** das 3D-Rendering, sondern die **Beweiskette**: Verifier vor Generator, Messwerte statt Selbstbewertung, `guideFails: []` als Abbruchkriterium, echte Negativtests (Fail-closed-500), echte Regressionen (20 Baseline-PNGs, 3JSBench-Briefings), und ein Belegketten-Export statt Marketing-Versprechen. Die Schwäche ist genau die Kehrseite: **die Implementierung hat die Hülle gebaut, nicht den Kern** — die Fach-Invarianten, das Curriculum-Mapping im Produkt, die Adaptivität und der didaktische Benchmark fehlen.

Der Zeitplan macht das zum kritischen Punkt: Abgabe 04.11.2026, verbleibende Zeit ~6 Tage. Die Priorisierung aus `docs/NEXT-STEPS.md` ist tragfähig und der Autor hat sie bereits nach „Wirkung pro Stunde" sortiert — aber sie beginnt mit dem UX-Bugfix-Bundle und endet mit README + Demo-Video + Submit, nicht mit dem didaktischen Kern.

**Die drei nächsten Schritte, die ich aus der Gesamtauswertung ableite:**
1. **Die Beleg-Divergenz auflösen** (7.2): Die beiden veralteten Reports auf den aktuellen Stand bringen oder als Snapshot kennzeichnen, die 21 uncommitteten Änderungen committen, `test:unit`/`verify:all` frisch laufen lassen. Ohne das ist die Veröffentlichungsentscheidung auf einer inkonsistenten Grundlage.
2. **Den didaktischen Kern schließen** — mindestens 1 Lab mit echter Fach-Invariante (SI-1 Subnetting: `NET.partition_disjoint` + `NET.host_count_formula` sind ohne 3D-Geometrie prüfbar) und das `curriculum_ref`-Feld in den Manifesten. Das sind 2 Calls und die sichtbarsten Lücken gegenüber dem FI-Fachkonzept.
3. **S6 „Maßhaltung" implementieren** (Empfehlung E-19): Wenn das Showcase-Modell ein Maßstabsmodell mit echter Bemassung ist, dann ist die Bemaßung eine Behauptung, die kein Gate prüft. Genau diese Behauptung trägt die Right-to-Answer-Position der Jurystory.
