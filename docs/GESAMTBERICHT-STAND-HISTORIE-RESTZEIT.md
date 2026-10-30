# Gesamtbericht: Ist-Stand, Historie, Konzepte, Restzeit-Plan (29.10.2026)

**Stand:** 29.10.2026, ca. 11:00 Uhr · **Repo:** `C:/Users/flori/OneDrive/modelMuse`, Branch `main`, HEAD `292494e`
**Release-Artefakt (einzig maßgeblich):** `dist-standalone/modelmuse-standalone.html` (276.648 Bytes, Stand `ls` 29.10.)
**Abgabe:** Submit 04.11.2026 · **Restzeit:** ca. 6 Tage
**Meta-Regeln:** Laufzeit nur Meta-Modelle · Tooling-Anteil 25 %

**Eingaben dieses Berichts (keine Neuerhebung, keine Codeänderung):**
`docs/ANALYSE-SOURCE-STAND.md` (29.10. 10:52) · `docs/ANALYSE-HISTORIE-KONZEPTE.md` (29.10. 11:04)
· `docs/REALGEBAEUDE-MACHBARKEIT.md` (29.10. 10:47) · `dist-standalone/SHOWCASE-REPORT-2026-10-29.md`
· `dist-standalone/STANDALONE-REPORT-2026-10-29.md` (EMPTY-STAND, überholt — s. § 1.6)
· `docs/FINAL-NACHWEISE.md` (EMPTY-STAND, überholt — s. § 1.6) · `docs/NEXT-STEPS.md` (27./28.10.)
· `README.md` (29.10. 10:23) · `dist-standalone/build-showcase-report.json` · `showcase-harness/SUMMARY.json`

**Belegregel:** Jede Zahl in § 1 ist einer der obigen Quellen entnommen. Wo Quellen sich
widersprechen, ist der Widerspruch ausgewiesen (§ 1.6). Wo keine Quelle existiert, steht
„nicht belegt". Es wird nichts ergänzt oder erfunden.

---

## 1. Ist-Stand: Architektur, Modelle, Tests

### 1.1 Architektur — Release-Pfad vs. Dev-Werkzeuge

Es gibt genau einen Release-Pfad. Alles andere ist Entwicklungswerkzeug.

| Skript | Zeilen / Status | Rolle |
|---|---|---|
| `scripts/build-standalone-v13.mjs` | 655, untracked, aktiv | v12-guide → v13-Upgrade (M1–M8), idempotent via `standalone-build v13`-Stempel |
| `scripts/build-showcase.mjs` | 161, untracked, aktiv | Bettet genau 5 Showcase-Modelle ein (LABS/META/INIT + `__SOURCES` + ES/MEAS) |
| `scripts/build.mjs` | 211 | Legacy-Dev-Build (`dist/lab-player.html`, stillgelegt/gelöscht), nicht Release |
| `scripts/double-build.mjs` | — | Byte-Identitäts-Nachweis (O-04) |
| `scripts/_tmp/replace-showcase-arch.mjs` | untracked | Einmal-Swap `arch-fassade` → `arch-brandenburger-tor` |

Fluss: `src/models/*.js` + `manifests/*.json` + `modellmatrix.json` → `build-standalone-v13`
(v13-Stempel, M1–M8) → `build-showcase` (5er-Schnitt) → `verify:standalone`
(SHOWCASE-Marker, 5 LABS/META/INIT, keine Alt-Muster, < 600 KB).

`src/` + `scripts/` sind Entwicklungs-/Harness-Werkzeuge, kein Release.
Tags `nachts-final` / `models-pre-wipe-20261029-082023` decken den aktuellen
Arbeitsstand nicht ab (s. § 1.6).

### 1.2 Runtime (`src/runtime/`, 16 Dateien, ~3.980 Zeilen)

| Datei | Zeilen | Rolle |
|---|---|---|
| `verify.js` | 554 | Verify-Orchestrierung S1–S5, Layer-Bau, Ampel, P2-Protokoll |
| `livegen.js` | 446 | BYOK-Direkt-Call zuerst (Baseten/Browser→Upstream), Proxy nur Fallback; `ROUTER_*`, `DIRECT_BASES`, Key nur Speicher/sessionStorage |
| `geometry-checks.js` | 438 | S2/S4-Statik: Mesh-Count, Schnitte, Backface, Flicker, Orientierung |
| `guard-static.js` | 388 | S1: Verbote (Wortgrenzen), Imports-Allowlist (`three`/`wrapper-helpers`/`2d-*`), Größe, `isTwoDSource`, `repairThreeImports` |
| `frame-bootstrap.js` | 356 | Frame/Renderer-Setup |
| `player.js` | 333 | Single-Page-Wrapper-Player |
| `sandbox-host.js` | 257 | Sandbox-Generat-Laufzeit |
| `budget.js` | 203 | `DEFAULT_BUDGET_LIMITS` + TRAFFIC — einzige Zahlenquelle (Modul ≤ 34.000 B hart; Tris ≤ 150.000; Draws ≤ 400; Meshes ≤ 250/hart, grün ≤ 120, Ziel ~45; 8 s/30 FPS/256 MB) |
| `annotate.js` | 213 | Labels/Messungen (`addLabel`/`addMeasurement`) |
| `didactics.js` | 185 | S5: Manifest-Schema, Level-Regeln, `findPedagogyLeak` |
| `session-library.js` | 145 | Bibliothek Export/Import (Provenienz, kein Key) |
| `providers.js` | 129 | Anbieter/Modell-Registry (passend zu `src/data/providers.json`) |
| `guard-runtime.js` | 102 | Laufzeit-Guard |
| `parts.js` | 102 | Bauteil-Zuordnung |
| `scoreboard.js` | 97 | Ampel/Score |
| `fallback2d.js` | 89 | 2D-Fallback |

Shell (`src/shell/`): `index.html` (191), `main.js` (513), `store.js` (51),
`theme.css` (172), `i18n.js` (144) + `i18n/{de,en,es}.json`, UI-Module
`ui-livegen` (331), `ui-modify` (181), `ui-library` (139), `ui-providers` (120),
`ui-report` (49), `ui-annotations` (61), `ui-fallback2d` (28), `ui-model-picker` (18).
Vendor: `three.entry.js` (2, Pin `three@0.186.1`), `diagram-2d.js` (200, SVG-Renderer),
`alpine.module.esm.min.js` (21-Zeilen-Stub). Schema: `manifest` (109),
`model-meta` (23), `verify-report` (57). Daten: `modellmatrix.json` (15),
`providers.json` (Default `muse-spark-1.3-contributor` / `meta-muse`; Baseten-Direkt).

### 1.3 Prompts (P0 → P1 → P2 + 2D)

| Prompt | Zeilen | Status |
|---|---|---|
| `p0-router.txt` | 55 | **aktiv**: Klassifikator 3d/2d + 2D-Typ (schaltplan/flussdiagramm/schnitt-ansicht/diagramm/tabelle), few-shot, Meta-Regel (Proxy-Default Contributor, OpenRouter nur BYOK → faktisch entfernt, s. § 5) |
| `p1-generate.v6-standard.txt` | 91 | **aktiv (3D)**: r186-Allowlist, wrapper-helpers, 4-Licht-PBR-Studio (Raumlicht 5, `environmentIntensity 0.55`, kein AmbientLight), Budget-Checkliste = `budget.js` |
| `p2-repair.v6-harness.txt` | 34 | **aktiv (Notfallpfad)**: max. Iteration 2 (+1 manuell), 6 FLARE-Fehlerklassen, nur protokollierte Fehler fixen |
| `p1-generate-2d.txt` | 33 | **aktiv (2D)**: SVG-Datenmodul (`2d-svg`) |
| `p1-generate.txt` (86), `p1-generate.v3/v5`, `p2-repair(.v3/.v5)` etc. | — | historisch, Referenz ungeprüft (Tech-Debt L22) |
| `gen-*/repair-*/worker-call*` (~90 Dateien) | je ~20–45 | Alt-Promptstände v1/v4/v5real/v6hyper + 36 Worker-Calls |

Harness-Loop: `scripts/_harness-loop.mjs` (`MODULE_BYTES_HARD=34000`, `decideIteration`:
grün / repair-auto / repair-manual / stagnation / regression / budget, max 2+1) +
`scripts/showcase-harness.mjs` (5× P0-regelbasiert → P1-v6 → Verify S1/S2-statisch/S4/S5,
Belege `dist-standalone/showcase-harness/<id>.jsonl` + `SUMMARY.json`).

### 1.4 Verify (S1–S5)

`scripts/verify-all.mjs` (316): S1+S5 in Node, S2 als Browser-Messung (Playwright-Suiten)
bzw. statisch gespiegelt, S3/S4 aus `dist/final-budgets.json` nur wenn Beleg aktuell —
sonst `skip`/gelb. Schreibt `dist/verify-report.json` + `dist/attestation.json`.
`scripts/verify-standalone.mjs` (246, untracked): SHOWCASE-Zweig (5 LABS/META/INIT,
Raumlicht-5 ×11, `environmentIntensity` ×11, Baseten ×3, M8-UI-Invarianten, < 600 KB)
plus EMPTY-STAND-Zweig (0 Modelle, `LABS=[]`, `__SOURCES={}`) — letzterer aktuell tot,
weil das Artefakt Showcase enthält.
Schichten: S1 Verbote/Größe/Imports/Meta · S2 Geometrie (3D) bzw. SVG-Gates (2D:
Parse/Typ/Pixel/Wellformed) · S3 Screenshot · S4 Budgets · S5 Didaktik
(Manifest + Matrix-Soll `labelsMin`/`tasks[B,A,P]` via `sollFromMatrixEntry`).

### 1.5 Modellbestand (13 Module in `src/models/`)

Vollbestand 13 (Matrix-synchron, alle mit Manifest): **5 Showcase-3D** im Artefakt,
**2 Reserve-3D** (`si-2`, `si-3`), **6 2D-SVG-Datenmodule** (`dup-1..3`, `ae-1..3`, je ~19 Z.).

| ID | Domäne | Art | Quelle (Zeilen/Bytes) | Labels / Mess | Matrix-Soll | Harness |
|---|---|---|---|---|---|---|
| `arch-brandenburger-tor` | Architektur | 3D Showcase **neu** | 226 Z. / 9.630 B | 6 / 2 (m) | 6, [m], 0/2/1 | grün Iter 0, 6 Meshes |
| `si-1` | Informatik | 3D Showcase | 426 Z. / ~16.183 B | 5 / 1 | 5, [cm], 0/2/1 | grün Iter 0, 33 Meshes |
| `chemie-koffein` | Chemie | 3D Showcase | 231 Z. / ~10.489 B | 6 / 2 | 6, [mm], 0/2/1 | grün Iter 0, 6 Meshes |
| `free-handbohrmaschine` | Mechanik | 3D Showcase | 231 Z. / ~10.386 B | 6 / 1 | 6, [mm], 0/2/1 | grün Iter 0, 5 Meshes |
| `gpu-example` | Hardware/CG | 3D Showcase | 464 Z. / ~22.428 B | 10 / 2 | 10, [mm], 0/2/1 | grün Iter 0, 22 Meshes |
| `si-2` / `si-3` | Informatik | 3D Reserve (nicht eingebettet) | 360 / 302 Z. | 4 / 1 (m bzw. HE) | Matrix ok | verify gelb |
| `dup-1..3` / `ae-1..3` | Diverse | 2D-SVG (`2d-svg`) | je ~19 Z. | 4 bzw. 3 / 1 | Matrix ok | verify gelb |

Manifeste (`src/models/manifests/`, 13×): inkl. `quellen`-Feld (optional, Schema erweitert)
bei `arch-brandenburger-tor` (Brandenburger-Tor-Maße: 62,5 m breit, 20,3 m hoch,
11 m tief, 12 Säulen 13,5 m — Belegquellen im Manifest). Alle S5-pflichtig
(≥2 Ziele, ≥3 Labels, ≥1 Messung) erfüllt.

### 1.6 Test-/Build-Lage (gemessen 29.10.2026) + Beleg-Divergenz

- `npm run test:unit`: **148/148 bestanden** (13 Quellen + `arch-brandenburger-tor`, Matrix synchron).
- `npm run verify:all`: **OK (13 Modelle, alle gelb, keine Fehler)** — gelb = Teilbasis
  (Beleg älter als Quelle oder kein `final-budgets`-Messwert; Lehrkraft-Freigabe ausstehend).
- `npm run build:standalone`: **idempotent exit 0** (`bereits v13 — nichts zu tun`).
- `npm run verify:standalone`: **OK (showcase verified)** — 5 LABS/META/INIT, Baseten-Direkt,
  M8-UI, 276.648 B (per `ls`; `build-showcase-report.json` nennt 276.375 B vor Swap-Rundung).
- Showcase-Harness: **5/5 grün in Iter 0** (Budget 2+1 ungenutzt), S3/S4-Browser-Belege skip.
- Playwright `tests/standalone.spec.mjs`: **7/7** (Boot, Labels, Banner, Baseten-Default,
  Generieren-Validierung, Stift-Modify, 5× Render + `dist-standalone/shots/`).
- **Kein gemessener Baseten-Live-Call** (kein Key im Profil; Produktpfad nur statisch
  verifiziert, BYOK-E2E im Browser bleibt möglich aber unbelegt). S3/S4 teils skip.

**Divergenz-Warnung (auflösungspflichtig vor Submit):**
`dist-standalone/STANDALONE-REPORT-2026-10-29.md` (eingecheckt) und `docs/FINAL-NACHWEISE.md`
beschreiben einen **EMPTY-STAND** (117.574 B, 0 Modelle, `test:unit` 140/148 mit 8 Fails) —
das ist ein **Zeitstempel-Snapshot vor der Wiederherstellung (29.10. 08:20–08:32)** und
**nicht** der aktuelle Stand. Maßgeblich ist `dist-standalone/SHOWCASE-REPORT-2026-10-29.md`
(5 Modelle, alles grün). Auflösungspfad: EMPTY-Reports nach `docs/source-de/` archivieren,
Showcase-Report versionieren, `test:unit`/`verify:all` frisch laufen lassen und Zahlen
übernehmen (vgl. `ANALYSE-HISTORIE-KONZEPTE.md` § 7.2, identischer Befund).

### 1.7 Offene Baustellen + Tech-Debt (kurz)

1. **Uncommitteter Arbeitsstand (Publish-Risiko):** 14+ modifizierte Dateien
   (README, Artefakt, `verify-report`/`attestation`/`build-report`, Docs, `package.json`,
   `p0-router`, `verify-all`, `modellmatrix`, `manifest.schema`, `diagram-2d`) + ~50
   untracked (Showcase-Builder/Harness/Reports/Shots, `arch-brandenburger-tor` + Manifest,
   `tests/standalone.spec.mjs`, 5 Builder/Verify/Harness-Skripte, 4 neue Docs, `scripts/_tmp/`-Probes).
   Tags decken das nicht ab → Commit/Publish-Freigabe + `probe-*.png`-Aufräumung.
2. **Report-Divergenz** (s. § 1.6).
3. **Legacy L16–L26 offen** (`docs/LEGACY-OFFEN.md`): `tests/*.spec.mjs` aktiv-verdrahtet,
   `dist/*.png` (69 Dateien, 22 versioniert), `dist/manual-tests` (~44 MB, gitignored),
   `dist/last-green`, `dist/*.js`/Prompts/Reports (~1,5 MB), ~90 Alt-Prompts (L22),
   ~60 `scripts/*.mjs` teils aktiv (L23), `gpu-example.js`-Root-Dupe (L25), `eval/3jsbench` (L26).
4. **Alles gelb, nichts grün:** 13× `ampel: gelb` (Teilbasis), S3/S4 teils skip,
   Lehrkraft-Freigabe ausstehend, BYOK-E2E unbelegt.
5. **Fachkonzept-Lücken** (`docs/NEXT-STEPS.md`): Curriculum-Mapping, Aufgaben-Nachweis,
   Hints/Quiz/Adaptiv-Engine, Tutor-Texte, Fach-Invarianten, Schul-UX-Audit, Demo-Video/Submit.
   Technik stark, Didaktik-Kern offen.
6. Kleinere Debts: toter EMPTY-STAND-Zweig im Verifier; `scripts/_tmp/`-Probes;
   `ledger-muse-calls.md` + `gen-stderr.log` sichten/archivieren; S3/S4-Skip-Doku pro Modell fehlt.

---

## 2. Acht-Tage-Historie: 4 Richtungswechsel, 24 Entscheidungen, Irrwege

### 2.1 Meilensteine mit Zeiten

**Phase 0 — Bewerbung (07.–13.10.):** Indie-Dev-Track, FernUni Hagen. Techniknachweis
PULSEWALL (5.496-Zeilen-Single-File-Three.js, agentisch in einer Session über 10 Stufen).
Bewerbungsentwurf mit 5 offenen TODO-Feldern; Einreichung rollierend bis 20.000 Zusagen.

**Phase 1 — Konzeptbau, drei Stränge parallel (22.10. 20:47–22:17):**
Eine Telegram-Hauptsession (287 Msg) startet drei parallele Worker (Tech 451 Z.,
Architektur 1.080 Z., Fachkonzept 719 Z.) + 8 Sub-Sessions (3–63 min). Ergebnis:
`meta-hackathon-gesamt-v2.md` — 4.736 Zeilen, 595 KB, 7 Teile. Tragendes Axiom:
*„Das LLM schreibt keine lauffähigen 3D-Code, sondern deklarierte Specs; eine deterministische
Baustein-Bibliothek führt aus — halluzinierte Physik wird strukturell statt nachträglich eliminiert."*
Dazu: **Verifier vor Generator** (FI-Fachkonzept §11), Messwerte statt Screenshot-Ästhetik,
3D nur wo 3D lehrt.

**Phase 2 — Pivot Elektro → Fachinformatiker (23.–24.10.):**
User-Korrektur: „Falscher Ausbildungsberuf. Ich wollte das alles für den Fachinformatiker bauen
(Si, DuP und AE)". Ergebnis: FI-Fachkonzept (751 Z., 92 KB, 14 Kapitel, geltende Spec, KMK/ARP-belegt)
+ FI-Labspecs (8.109 Z., 370 KB, 9 Labs SI/DuP/AE mit Aufgaben/Quiz/Invarianten).
Kernziel reduziert: „ein lauffähiger, nachweisbar geprüfter kritischer Pfad — nicht neun fertige Labs"
(B1 Verifier → B2 Generator).

**Phase 3 — Buildvorbereitung (26.10.):** Termine in Kalender (4 Kickoffs 26.–30.10.),
2 Recherche-Sessions → `buildplan-docs/techspec/github.md` (Three.js r186 WebGL2-only,
Sandbox/CSP, Playwright 1.64 SwiftShader, Meta-API). Größte Session der Phase:
`20261026_201618` (682 Msg, 282 Tool-Calls). Tech-Spec hält Entscheidungskonflikt fest
(Tech v2 am Pfad nicht vorhanden → Planwerte statt Messwerte).

**Phase 4 — Implementierung (26.–27.10.):** coder-Kette (11 Sessions): Muse-CLI-Setup
(`muse.exe` v1.4.13, Pin `muse-spark-1.3-contributor`, Key nur `--api-key-stdin`),
9 Labs, GPU-Perfektionierung (3 Reparaturrunden P1+P2×2), Nachtrag/Hyper (M1–M8),
Qualitäts-Harness, Proxy. Fehlerkette belegt in `generation-log.json` Call 1–6
(Helper-Signatur, PointLight-Überbelichtung, room-Leak — je chirurgisch, Rest byteidentisch).
27.10.: Qualitäts-Recherche (380 Msg) → `ki-modellqualitaet-recherche.md` (701 Z.),
M1–M8, `scripts/proxy.mjs`; Backlog 24E/11A/15O; Erst-Commit `69e2eec` (1.348 Dateien);
Restposten O-01–O-15/A-01–A-11. Budget-Korrektur Draw-Calls 120 → 400 (Ryzen-5/i5-iGPU,
SwiftShader-Toleranz). Abschluss: 9/9 Labs Iter-1-grün, 0 P2-Repairs; BYOK-E2E 4/4;
36/36 Unit + 28/28 Playwright + 10× gelb. Ampel-Logik: gelb = auto-geprüft,
Lehrkraft-Freigabe ausstehend (kein Grün ohne Mensch).

**Phase 5 — Standalone-UI-Kette v1–v11 (28.10. 01:01–19:10):**
Session `20261028_010153` (539 Msg, 221 Tools) + 8 designer-Sessions + 27 Ledger-Einträge.
Jede Version: Backup → Muse-Call → deterministische Assembly → statische Verifikation →
Playwright-Klickbeleg. v1 UI (Vue Options-API, Tailwind, Dark Mode) → v5 viewport-first →
v6 erstes echtes Freimodell (Handbohrmaschine, 169 Z., 6 Bauteile, 448 mm) → v7 echte
Bauteil-Toggles (Fix wirkungsloser Schalter) → v8 2D-Snippets + `is3d` → v9 7-Punkte-Umbau
+ Import-Strip → v10 Reload-Fix + Fortschritts-Overlay + Boot-Watchdog (P0-weiße-Seite-Fix) →
v11 Kamera-Framing (2,2× maxDim). Zwei User-Korrekturen: Options-API statt `<script setup>`,
Ausrichtung weg von Lernplattform hin zu Generator/Viewer (3D groß, Overlay rechts oben,
Status unten, Free-Lab-persistenz-Bug).

**Phase 6 — Kernsanierung, 2D-Router, Baseten (28. 23:34 → 29. 01:19):**
5 Subagent-Sessions in 3 Wellen: Guide-Stand (R1–R19), 2D-Eval (248 Msg), Router (21 Msg),
3D-Kernsanierung 6 Modelle (`341bcf5`), 2D-Umstellung (`7f483de`, SVG-Datenmodule +
`routeGeneration` + Verify-2D-Gates), Baseten-Migration, Slim-Generator (`292494e`),
Lizenz-Audit. Git: 7 Commits total, Tags `pre/post-cleanup-L16-L26`, `nachts-final`.

**Phase 7 — Verifikation, Wipe, Showcase (29.10.):**
07:04 Neubau-Check (alle 6 mit `environmentIntensity 0.55`, `PCFShadowMap`, Harness 6/6 grün) ·
07:20 v13-Standalone · 07:26 14 Shots (0 pageerrors) · 08:20 MODELS-WIPE (Backup 24 SHA256,
`regen-anleitung.md`, `pending-key-step.txt` — kein Key angefasst) · 08:38 Routing-Tests
6/6 + Fail-closed-500 · 09:23 Showcase-Harness 5/5 grün Iter 0 · 09:29 Showcase-Build
(Swap `arch-fassade` → `arch-brandenburger-tor`, 276.375 B) · 10:09 Realgebäude-Machbarkeit
(382 Msg, 26 Quellen).

**Der Swap 29.10. (wichtigster Einzelschritt):** Vorher `arch-fassade` (generisch, 1,2 m,
unbelegte Maße, „langweilig"). Nachher **Brandenburger Tor** (62,5 m breit, 20,3 m hoch,
11 m tief; 12 Säulen 13,5 m, Basis-Ø 1,73 m; Durchfahrten 5,65/3,80 m; Maßstab 1:50).
Maßquellen im Manifest (`quellen`-Feld, neu). `arch-fassade` restlos entfernt
(0 Treffer im Artefakt).

### 2.2 Die 4 Richtungswechsel

| # | Wechsel | Datum | Auslöser (belegt, nicht Präferenz) |
|---|---|---|---|
| W-1 | **Elektro → Fachinformatiker (SI/DuP/AE)** | 23.10. | User-Korrektur; Elektro-Labs als Doppelspur vor Abgabe verworfen (`NEXT-STEPS.md` §4) |
| W-2 | **Deklarative Spec → Code-Gen-Kern (v3)** | 26.10. | USP „freies Modell-Vokabular + kuratierte Beweiskette"; Rollenmodell Lehrer/Azubi/Agent (`FACHKONZEPT-v3-codegen.md`) |
| W-3 | **OpenRouter → Baseten (Meta-only)** | 28.10. | Meta-Regel Laufzeit-nur-Meta; 22 erfundene OpenRouter-IDs entfernt (`BASETEN-MIGRATION.md`) |
| W-4 | **Zwei Artefakte → Standalone-only** | 29.10. | Divergierende Lab-Sätze („kein Portfolio, sondern zwei divergierende"); `lab-player.html` stillgelegt/gelöscht (`ARCHITEKTUR-PFADE.md`) |

Hinzu als Endprodukt-Pivot dokumentiert: Lab-Player → Standalone-only (W-4) sowie
Modell-Wipe mit Empty-Stand und Wiederherstellung (29.10. 08:20, absichtlicher Test des
Neugenerierungswegs, Tag + Backup).

### 2.3 Entscheidungsprotokoll (24 Entscheidungen)

| # | Entscheidung | Datum | Begründung / Beleg |
|---|---|---|---|
| E-1 | Zielberuf Fachinformatiker (SI/DuP/AE) | 23.10. | User-Korrektur; `NEXT-STEPS.md` §4 |
| E-2 | Verifier vor Generator | 22.10. | Anti-Selbstbestätigung; FI-Fachkonzept §11 |
| E-3 | Modell erzeugt deklarative Spec, nicht Code | 22.10. | Strukturelle Physik-Eliminierung; `gesamt-v2` Teil 2 §1.3 |
| E-4 | Pivot zu Code-Gen-Kern (v3) | 26.10. | Freies Vokabular + Beweiskette; `v3-codegen.md` §1–2 |
| E-5 | three.js r186 behalten | 28.10. | Guide §7; keine Engine-Migration |
| E-6 | Draw-Call-Limit 120 → 400 | 27.10. | iGPU/SwiftShader-Toleranz; `BUDGET-NACHTRAG` |
| E-7 | OpenRouter entfernt, Baseten-Standard | 28.10. | Meta-Regel; `BASETEN-MIGRATION.md` |
| E-8 | Key nur BYOK/sessionStorage mit Zustimmung | 27.–28.10. | Nie in Code/Logs/Docs; mehrere Docs §1 |
| E-9 | Direkt-Call vor Proxy | 28.10. | CORS-Preflight unvermeidbar; 401/404 kein Fallback; `PROXY-BOOTSTRAP-BEFUND` |
| E-10 | P0-Router 3D/2D, fail-closed auf 3D | 28.10. | 1 Zusatz-Call, keine Dependency; `ROUTER-KONZEPT.md` §3 |
| E-11 | SVG nativ statt Mermaid/Chart.js/d3/KaTeX | 28.10. | 0 KB deckt 6 Fälle; `2D-UMSTELLUNG` §7 |
| E-12 | 6 Labs auf 2D umgestellt | 29.10. | Diagramm-Lernziele, kein 3D-Mental-Modell; `7f483de` |
| E-13 | Koffein statt H2O | 28.–29.10. | `pm`-Einheit fehlte (`zahlenGefunden: []`); 9.648 Tris = 6,4 %; `341bcf5` |
| E-14 | Standalone einzige Auslieferung | 29.10. | GitHub-Pages ohne Build; `ARCHITEKTUR-PFADE.md` |
| E-15 | Slim-Generator | 29.10. | Weg von Lernplattform, hin zu Generator/Viewer; User-Vorgabe |
| E-16 | Keine blinde Komplett-Regeneration | 29.10. | Alle Gates grün → kein weiterer Call; v13-Report |
| E-17 | Swap `arch-fassade` → `arch-brandenburger-tor` | 29.10. | Real-Gebäude, Maße belegbar; `build-showcase-report.json` |
| E-18 | Maßstabsmodell + echte Bemassung statt 1:1 | 29.10. | §59/§23 UrhG, BGH I ZR 242/15; `REALGEBAEUDE` §5.1 |
| E-19 | Neue Schicht S6 „Maßhaltung" (Empfehlung) | 29.10. | Maßtreue derzeit ungeprüft; `REALGEBAEUDE` §5.2.4 |
| E-20 | Nur lokale Commits, kein Push | laufend | User-Vorgabe; alle Messages „(nur lokal, kein Push)" |
| E-21 | Tags als Rollback-Anker beim Cleanup | 28.10. | Parallele Session-Hunks; `ERGEBNIS-L16-L26.md` |
| E-22 | Ampel bleibt gelb (12/13 Modelle) | laufend | Kein Grün ohne Lehrkraft-Freigabe; `attestation.json` |
| E-23 | Eigenes Hermes-Profil `hackathon` | 27.10. | Key nur mit exakt diesem Modell gültig |
| E-24 | Realgebäude-Prüfung zusätzlich | 29.10. | Tragfähigkeit vor Invest prüfen; `REALGEBAEUDE` |

### 2.4 Irrwege, Fehlschläge, verworfene Spuren

**Konzept-Irrwege:** Elektro/Mechanik/Werkstoffe (454 Z., falscher Beruf) · deklarative Spec
als Endprodukt (zu starr für freie Begriffswahl) · `gesamt-v2.md` als lebende Spec
(Elektro-Fassung, 4.736 Z. mit Changelogs) · 4-Msg-Architektursession (Zuordnung nicht belastbar).

**Produkt-Irrwege:** OpenRouter-Laufzeit (22 erfundene Modell-IDs) · Proxy als Primärweg
→ Direkt-Call · `lab-player.html` als Zweitlinie (divergierende Lab-Sätze) ·
Mermaid/Chart.js/d3/KaTeX einbinden (evaluiert, nicht eingebunden — 0-KB-Pfad genügt) ·
Text-to-3D-Meshes (40 k–1,5 Mio. Faces, 0,5–19,8 MB GLB vs. 34-KB-Budget) ·
`arch-fassade` (unbelegte Maße, „langweilig" → 0 Treffer).

**Technische Fehlschläge (alle belegt, keine kaschiert):**
`ConeGeometry`-Boot-Fail (Bundle-/Repair-Lücke) · `Scene is not defined` (offen gemeldet) ·
Helper-Signatur objektbasiert (P2-Fix, Rest byteidentisch) · PointLight-Überbelichtung/
Shadow-Frustum-String-Concat/room-Leak (je 3 Fixes) · wirkungslose Bauteil-Checkboxen
(`patch.parts` nie ausgewertet → v7-Fix mit `partGroups`) · weiße Seite 3× (Tailwind/Vue
undefined; hängender CDN-Tag → Boot-Watchdog vor allen CDN-Tags) · `E-FREE-IMPORT:
IcosahedronGeometry` / Import-Strip / BufferAttribute-Allowlist (v9–v10-Fixes) ·
H2O/NaCl ohne Maße (`pm`-Lücke → Koffein) · S3 durchgängig `skip` (substanziellste DoD-Lücke) ·
10 Modelle ohne `meta_i18n` (offen) · Models-Wipe 08:20 (absichtlich, Backup + Tag) ·
Fußball-Modell (User-Free-Lab, localStorage, nie committet).

**Prozess-Irrwege:** 48 h Doppelpflege zweier Produktpfade · `docs/`-Duplikate de/en mit
`source-de/`-Archiv (bewusst, aber Doppelpflege) · `dist/manual-tests/*.png` (~44 MB,
„unsicher", weder gelöscht noch archiviert).

---

## 3. Konzept-Kernaussagen

### 3.1 FI-Fachkonzept (751 Z., 23.10. — geltende Spec)

Tutor-Agent erzeugt interaktive Three.js-Lernumgebungen mit adaptiver Aufgabenreihe.
Fünf Kernsätze: (1) Adaptivität regelbasiert, nicht modellbasiert (Start B, 2× hoch/runter,
nie unter A; Modell liefert nur Tutor-Texte). (2) Drei Prompt-Rollen getrennt
(P1 stabiler Prefix, P2 Fach-Few-Shot, P3 Repair mit Fehlerliste hinten).
(3) Vier-Schichten-Fehlerbehandlung (Fach-Invarianten hart → Struktur/Render/Didaktik →
Reihenfolge → Behandlung). (4) Degraded Mode 0–4, max. 3 Retries mit informiertem Repair.
(5) Curriculare Aussagen gegen Primärquellen belegt (KMK 13.12.2019, FIAusbV 28.02.2020;
je Lab Zeitrichtwert + ARP-Wochen). Demo als Beweiskette („Fehlerbehebung statt
Fehlerfreiheit", Retry-Loop live 1:20–1:50; bei Ausfall ehrlich auf kuratiertes Lab
zurückschalten — „ein ehrlicher Hinweis ist stärker als gepatchter Code").

Je Lab didaktische Kernaussage (verkürzt, FI-Fachkonzept §4.2 ff.): SI-1 Subnetz-Partition
(disjunkt/vollständig/Hostsumme) · SI-2 legale Zustandsübergänge, kein Zombie, Auslastung ±1 pp ·
SI-3 XOR-Rundlauf, AES-128, Schutzziel-Zuordnung · DuP-1 Join-Kardinalität, 3NF, Sollmenge ·
DuP-2 Vollständigkeit/Plausibilität/reproduzierbarer Output · DuP-3 Erreichbarkeit,
Sackgassenfreiheit, Engpass begründet · AE-1 Bin/Hex-Rundlauf, Zweierkomplement, Adressraum ·
AE-2 Permutation/Sortiertheit/Vergleichs-Korridor · AE-3 Treffer-Ursache, Coverage ≥ Soll,
Mutation-Score ≥ Soll.

### 3.2 v3-Codegen-Kern (266 Z., 26.10. — gebaute Architektur)

„Lehrkräfte lassen per Muse Spark 3D-Modelle als Programmcode generieren; der
clientseitige Single-Page-Wrapper führt ihn aus." USP: „freies Modell-Vokabular +
kuratierte Beweiskette". Drei Rollen: Lehrkraft (Begriff → Freigabe → geprüftes Modell),
Azubildende (3 Niveaustufen), Implementierungsagent (Generierungsvertrag, Schutzhülle,
Verify-Loop). Leitbeispiel Graphics Card (Die, VRAM, 2 Lüfter, Heatpipes, Backplate,
PCIe-x16, Strom, Slotblende + Bemaßung — „Unterrichts-Detailtiefe"). Generierungsvertrag:
genau eine Schnittstelle (`init`/`update`/`dispose`), genau ein Importursprung
(`three` + `wrapper-helpers`), genau drei Helper (`addLabel`, `addMeasurement`,
`clearAnnotations`) — jede Vertragsverletzung wird verworfen.
Nicht verwechseln: v3 = gebauter Code-Gen-Kern; FI-final = deklarative Spec-Variante
(Modell → JSON-Spec → Baustein-Bibliothek). Curriculum = FI-final, Produkt = v3.

### 3.3 Qualitäts-Guide F1–F6 + Recherche (28.10.)

Guide-Kernaussage: r186 behalten, Qualität über messbares Feedback + enge Licht-/Geometrie-Regeln
+ begrenzte Repair-Loops. Fünf Empfehlungen: IBL-Raum (`PMREMGenerator`, `environmentIntensity
0.55`, nicht `0x11141a`-Rezept) · Messwerte in den Repair (nicht Eindrücke) · Prompts/Output in
Vendor-/Budget-Grenzen · visuelle Evidenz nur als Ergänzung · max. 2+1 Repairs mit
Erfolg/Stagnation/Regression-Stops. Festwerte: 4-Licht-Setup (Hemi 0,35 / Key 2,5 1024² /
Rim 0,7 / Warm-Point 0,12), ACES/sRGB/Exposure 1,0–1,1, Budgets (34.000 B / 150.000 Tris /
400 Draws / 250 Meshes / 8.000 ms / 30 FPS / 256 MB / DPR 1–2). API-Pin: 36 erlaubte
three-Namen; `PCFSoftShadowMap` deprecated → `PCFShadowMap`; `side: 1` numerisch;
`PMREM`-Quelle `room`; Verbote (`BackSide`, `Clock`, `RectAreaLight`, `SpotLight`, u. a.).
186→187-Drift vorbereitet.

Zentrale Recherche (`ki-modellqualitaet-recherche.md`, 701 Z.): 4 Thesen mit Urteil —
Astra existiert (belegt) · „am leistungsfähigsten" pauschal widerlegt (Geometrie vs.
Präferenz vs. Agentik widersprechen einander) · Prompt-Engineering hilft, aber nicht beliebig
(exec-refine +3,4–38,8 pp, FLARE 54,86 vs. 50,27 %; Constraints nicht monoton, Few-Shots
können schaden) · eigenes Modell in 3D „nein, belegt" (3JSBench 10,7 %, Platz 11/13;
threejseval 23/39; AA-3D 9/23; Fehlermodus 995 Meshes / 33 % Flicker) · Text-to-3D-Meshes
„nein für dieses Setup" (Budget-Sprengung). **Erkenntnis:** „Es gibt kein bestes Modell —
nur verschiedene Achsen. Die eigene Verify-Schleife entscheidet, welche Achse zählt."
Maßnahmen M1–M8 mit Aufwand/Effekt/Evidenz; Reihenfolge M2→M3→M4→M5→M7→M1→M6→M8.
Ehrliche Lücken: kein Benchmark misst Didaktik (Labels/Messungen/Niveaus/Einheiten) —
eigener didaktischer Benchmark + M7 zwingend; Grader-Code unveröffentlicht;
Reasoning-Effekt-Höhe unbekannt; Elo-Diffs oft nicht signifikant.

### 3.4 2D-Stack, Portfolio, Router, Baseten

2D-Eval (gemessen, esbuild 0.28.2/gzip-9): Mermaid 1.542 KB (Chunk-Selektion → 567 KB),
Chart.js 62 KB, d3-light 23 KB, KaTeX 76 KB (335 KB mit Fonts), SVG nativ 0 KB.
Gate-Tauglichkeit gemessen: Mermaid-`parse()` bestes Gate (Zeile/Spalte, 8–11 ms);
Chart.js schwächstes (ungültiger Typ ohne Exception/Warnung → Pixel-Gate nötig);
KaTeX versteckt Fehler ohne `throwOnError: true`; SVG braucht eigene Kriterien.
Offline 8/8, Lizenzen MIT/ISC/Apache-2.0 (kein Copyleft). **Entscheidung: nicht eingebunden —
SVG nativ deckt alle 6 Fälle (0 KB).**

Portfolio-Vorschlag: 2D-Schalter nur im Standalone; `src/` kennt kein `is3d`
(F3 nur Notfallpfad); divergierende Lab-Sätze (GPU nur Haupt-Build, Bohrmaschine nur
Standalone); H2O-Root-Cause (`pm` fehlt in `UNIT_RE`/`unit`-Enum → Messhinweis verworfen,
`zahlenGefunden: []`, NaCl `kein-rot=false` → rot). Ersatz Koffein (24 Atome, 2 Ringe,
9.648 Tris = 6,4 %).

Router-Konzept (Design-Proposal, kein Release-Eingriff): 1 Zusatz-Call, keine Dependency;
3D nur bei (räumliches Objekt + räumliches Lernziel + ≥2 Teile mit Lagebezug);
2D bei Prozess/Fluss/Chart/Taxonomie oder ≤1 Objekt ohne 3D-Nutzen; expliziter 2D-Wunsch
sticht; Vertrag `mode`/`typ`/`begruendung` (≤140 Z.); fail-closed auf 3D mit
`routerFallback: true`; P0 ~4.000 Z. in / ~300 Token out; 5-Punkte-Plan
(`routeGeneration()`, `p0-router`+`p1-2d`, 2D-Limits/Route-Felder, SVG-Verifier mit
expliziten `skip`s, Harness+Repair). Nicht-Ziele: keine 2D-Lib, kein 2D-Framework,
kein 3D-Redesign, keine Standalone-Builder-Änderung, kein Retrieval.

Baseten-Migration: OpenRouter entfernt, Laufzeit-Standard `POST /v1/chat/completions`
(`https://inference.baseten.co/v1`, `meta-models/muse-spark-open-1026`, BYOK).
E2E: Versuch 1 Transport-OK aber `ConeGeometry`-Boot-Fail (Bundle-Lücke, kein Transportproblem);
Versuch 2 Bücherregal-Volltreffer (6 Labels, S1 grün, Screenshot-SHA256 `b0f6b2…`, 1 Log-Eintrag,
kein Key-Material). Proxy-Funktionsprobe ohne Key/Netz grün. Fremd-Baustelle
`i18n-ui.spec.mjs` (wartet auf `#lab-mount iframe` in gelöschtem `lab-player.html`).

### 3.5 Realgebäude-Machbarkeit (26 Quellen, 29.10.)

Kurzantwort (Synthese): **Ja als didaktisches Maßstabsmodell, nein als metrisch
maßgetreuer Nachbau.** Befunde: Maße sind die Schwachstelle (Code-Prompts perfekt,
3-View-Zeichnungen am schlechtesten; P3D J-Sem 0,7 vs. J-Geo 0,5; Fehler kumulieren
12×n) · iterative Verifikation hilft messbar (CADCodeVerify −7,3 % Distanz, +5,5 %
Compile-Rate), aber BIM-Code bleibt semantisch lückenhaft (Pass > 0,95, dennoch falsche
Türen/Räume/Halluzinationen) · Fotos geben Form, kein Maß („lacks dimensional accuracy").
Recht: **3D-Nachbau geschützter Bauwerke ist keine Panoramafreiheit** (BGH I ZR 242/15:
auch verkleinertes Modell/anderes Material zustimmungspflichtig; §23 Abs.2 Nr.3 nennt
Nachbau explizit; nur Außenansicht per Foto/Film frei; Drohnenaufnahmen fallen nicht
darunter). Frei: Schutzfrist abgelaufen (70 J. p.m.a.; Mies v.d. Rohe d. 1969 → bis 2039
geschützt; vor 1956 Verstorbene i. d. R. frei), gängige Planungslösungen nicht
schutzfähig (BGH I ZR 166/05, Schätzung ≤10 % schutzfähig), offene Geodaten
(Berlin LoD1/LoD2, dl-de-zero-2.0). Brücke: Brandenburger Tor bereits 1:50-Modell
(1,25 Einheiten bei 62,5 m Realmaß, Spanne 1,30 m; `extentMaxM = 1,50 m` erzwingt Maßstab;
Realmaß als Text-Bemassung — didaktisch richtig). 8 Schritte: Rechtsfilter →
Geometrie aus offenen Daten → Maßliste als Single Source of Truth (P1 + `addMeasurement` +
Manifest) → **S6 „Maßhaltung"** (Soll vs. Bounding-Box, ±1 %) → Instancing-Pflicht
(12 Säulen = 1 InstancedMesh → 6 Meshes) → Byte-Engpass beachten (378 Tris/6 Meshes,
aber 9.630/34.000 B — Bytes, nicht Geometrie, limitieren) → Repair-Loop messen →
eigenes Realgebäude-Regressions-Set (3–5 Briefs). Grenzen: kein Benchmark misst
Realgebäude (Extrapolation, nicht Messung); Rechtsstand DE 29.10.; keine unabhängige
Maßtreue-Messung (S6 schließt genau diese Lücke); threejseval = Live-Board mit Vorbehalt.
Hinweis: technische Recherche, keine Rechtsberatung; veröffentlichte Demo anwaltlich prüfen.

---

## 4. Restzeit-Plan bis 04.11.: priorisierte Features, Aufwand/Nutzen, Pflichten

### 4.1 Sortierprinzip (aus `NEXT-STEPS.md`, bestätigt)

Reihenfolge nach **Wirkung pro Stunde**, Abhängigkeiten beachtet. Technik-Seite ist stark
(Build grün, 13× gelb, 20/20-Baselines, O-04-Nachweise, Regression vorhanden) —
**Didaktik-Kern fehlt** (Hülle gebaut, nicht Kern: Fach-Invarianten, Curriculum im Produkt,
Adaptivität, didaktischer Benchmark).

### 4.2 Priorisierte Arbeitspakete (Aufwand ehrlich, Nutzen für Jury/Nutzbarkeit)

| Rang | Paket | Aufwand | Nutzen | Konkret |
|---|---|---|---|---|
| P-0 | **Beleg-Divergenz auflösen + Publish-Freigabe** | 0,5 Tag | kritisch (Submit-Blocker) | EMPTY-Reports → `docs/source-de/` archivieren; Showcase-Report versionieren; `test:unit` + `verify:all` frisch laufen lassen, Zahlen übernehmen; ~50 untracked sichten/committen; `probe-*.png` aufräumen; `STANDALONE-REPORT`-Verweis im README auf Showcase umstellen |
| P-1 | **UX-Bugfix-Bundle** | 1 Call | sofort sichtbar | Pluralisierung („1 Messungen") · Panel-Modellname ans geladene Lab binden (oder als „Referenzbericht" labeln) · Mindest-Labelgröße/LOD · Onboarding-Hinweiszeile beim Erststart |
| P-2 | **Curriculum-Badges (B-14, jury-sichtbar)** | 1 Call | hoch (Impact + Educator-Reuse) | `curriculum_ref` (LF-Nummer/Titel/Zeitrichtwert/AJ, ARP-Position/Wochen aus FI-Fachkonzept §4.2–4.10 — belegt, nichts erfinden) in alle 13 Manifeste + Badge je Lab + Bibliotheks-Spalte; S5 prüft Anwesenheit (analog `meta_i18n`-Muster) |
| P-3 | **Aufgaben-Nachweis** | 1 Call | hoch (Vertrauen) | `zuordnung`-Tasks per Textvergleich prüfen (erwartete Antwort, case-insensitiv) statt Selbst-Abhaken + `hints[3]`-Feld ins Manifest-Schema (zunächst Anzeige, ohne Engine) |
| P-4 | **Quiz v1** | 2 Calls | hoch (Didaktik sichtbar) | 1 Frage/Lab, 4 Optionen + Rationale (aus Fachkonzept-Erfolgsnachweisen), UI + Auswertung mit Lernfeld-Anker, S5-Kriterium |
| P-5 | **Adaptiv-Engine** | 2 Calls | mittel-hoch | Stage B-Start, 2-hoch/2-runter, nie unter A, Hinweis-Zähler („mit Unterstützung"), Fortschritt; reine Funktion + Unit-Tests (deterministisch, kein Modell nötig) |
| P-6 | **Schul-UX-Audit** | 1 Call + Geräte-Test (Florian) | mittel (Nutzbarkeit) | 44px-Touch-Ziele messen, Tastaturpfad (Tab-Reihenfolge, Orbit ohne Drag), Kontrast-Rechnung, Befund-Tabelle; Fix-Call danach |
| P-7 | **Tutor P3 light** | 1–2 Calls | mittel | Hinweis-/Feedback-Texte regelbasiert aus Spec (falsche Antwort → passende Stufe + Fachbegriff), Anzeige mit Lernfeld-Anker; kein Modell-Call |
| P-8 | **Fach-Invarianten-Leuchttürme** | je 1 Call, zuerst SI-1/DuP-1/AE-2 | höchst (Kern) | Echte S2-Prüfungen: Subnet-Mathe, Join-Kardinalität, Sortier-Permutation (gemessen-gegen-erwartet); ohne 3D-Geometrie prüfbar |
| P-9 | **S6 „Maßhaltung" (neu aus Realgebäude-Analyse)** | 1–2 Calls | hoch (trägt Brandenburger-Story) | Soll-Länge vs. Bounding-Box je Baugruppe (±1 %, Mindestabstand analog S2 2,0 mm); Maßliste als Single Source of Truth |
| P-10 | **README + Demo-Video + Submit (B-15)** | ab 02.11., zeitkritisch | **Pflicht** | Demo-Timer belegt 10 s; Video + Submit gehen vor allem Rest-Polish |

**Won't (bewusst nicht, mit Grund):** E1/M1/W1-Elektro-Labs (FI-Track, keine Doppelspur) ·
OpenRouter-Pfad (entfernt, Baseten-Standard) · Push auf GitHub (nur lokale Commits,
Submit separat) · Live-Generierung im 180-s-Fenster (92–401 s gemessen, physikalisch
unmöglich — Demo fährt ehrlich F2-Pfad mit kuratiertem Lab) · A-03-Gratis-Tier-Retry
(Retry in Key-Stunde, danach „ratenlimitiert, $0 verbraucht" dokumentieren).

**Guide-Follow-ups (außerhalb Sandbox, mit Browser):** `npm run build` (Vendor-Bundle
mit `MeshPhysicalMaterial`/`PCFShadowMap`/`VSMShadowMap` erst nach Rebuild) ·
`baseline:update` + visuelle Re-Abnahme (v. a. `gpu-example` heller) · M6-Vektorstufe
(semantischer statt Regel-Abruf, optional) · Guide-§6 (NullEngine-Prüfebene, deklarative
Bauteil-Semantik, getMetrics-Kanal).

### 4.3 Tagesplan-Vorschlag (29.10. → 04.11.)

| Tag | Fokus | Erfolgskriterium |
|---|---|---|
| 29.–30.10. | P-0 (Divergenz + Freigabe) + P-1 (UX-Bundle) | Reports konsistent, Tree committet, 148/148 + 7/7 frisch belegt, Pluralisierung/Onboarding drin |
| 30.–31.10. | P-2 (Curriculum) + P-3 (Nachweis) | `curriculum_ref` in 13 Manifesten, Badges sichtbar, `zuordnung` geprüft statt abgehakt |
| 31.10.–01.11. | P-8 (1 Leuchtturm SI-1) + P-9 (S6) | 1 echte Fach-Invariante grün, Maßhaltung für Brandenburger Tor geprüft |
| 01.–02.11. | P-4 (Quiz v1) + P-5 (Adaptiv) | 5 Showcase-Quizfragen + Engine mit Unit-Tests |
| 02.–03.11. | P-6 (Audit) + P-7 (Tutor light) + Reserve | Audit-Tabelle + Fixes, Hinweis-Texte mit LF-Anker |
| 03.–04.11. | **P-10 (README + Video + Submit)** | Video, README, Submit-Abgabe; kein neues Feature nach 03.11. mittags |

Reserve-Regel: Scheitert ein P-Paket nach 2+1 Versuchen (Stagnation/Regression),
wird es auf „dokumentiert-offen" gesetzt statt die Submit-Frist zu gefährden
(selbe Stop-Logik wie Harness: Erfolg/Stagnation/Regression).

### 4.4 Demo-/README-Pflicht (Submit 04.11.)

Demo fährt **ehrlich F2-Pfad** (kuratiertes Showcase-Lab, kein Live-Call im 180-s-Fenster).
Stärkster Moment laut Fachkonzept: Retry-Loop live („Fehlerbehebung statt Fehlerfreiheit",
1:20–1:50). Bei Ausfall: auf kuratiertes Lab zurückschalten + ehrlicher Hinweis
(„stärker als gepatchter Code"). README muss enthalten: Ein-Artefakt-Aussage
(Standalone-only, GitHub-Pages, kein Build/Backend), 5er-Showcase (je Domäne 1),
BYOK-Fluss (Baseten-Direkt, Key nur sessionStorage mit Zustimmung, kein Proxy-Port),
Budget-/Verify-Kurzbeleg (148/148, 7/7, 5/5 grün Iter 0, 13× gelb = Lehrkraft-Freigabe
ausstehend), Lizenz-Verweis (`docs/licenses.md`) + O-1-Vorbehalt (Projekt-Lizenz fehlt),
Quellen-Hinweis Brandenburger Tor. Demo-Video + Submit gehen vor allem Rest-Polish (P-10).

---

## 5. Meta-Regeln-Compliance

**Laufzeit nur Meta-Modelle:** eingehalten. Laufzeit-Standard ist
`meta-models/muse-spark-open-1026` (Baseten-Direkt, BYOK); Dev-Default
`muse-spark-1.3-contributor` (`meta-muse`). OpenRouter-Pfad entfernt (E-GEN-404,
Registry-Eintrag gelöscht, Unit-Test pinnt das). Kein Fremd-Laufzeit-Modell im Artefakt
(`verify:standalone` prüft Baseten ×3, kein Proxy-Port, kein OpenRouter).
**Tooling-Anteil 25 %:** `src/` + `scripts/` sind Dev-/Harness-Werkzeuge (kein Release);
einziges Release-Artefakt ist das statische Standalone-HTML (GitHub-Pages, kein Backend,
kein Build beim Nutzer). CDN-Referenzen (three 0.186.1, Vue 3, Tailwind Play, Inter)
sind Laufzeit-Bestandteil mit bekannten Drift-Risiken (Vue major-only, Tailwind/Inter
unversioniert, Play-CDN development-only — `docs/licenses.md` O-4/O-5); kein Tooling-Modell
in der Laufzeit. **Key-Regel:** BYOK ausschließlich (Browser-Eingabe, sessionStorage nur
mit Zustimmung; nie Server-Fallback, nie Code/Logs/Chat/Dateien/Repo).

---

## 6. Risiken vor Submit (Top 5)

1. **Beleg-Divergenz (P-0):** zwei eingecheckte EMPTY-Reports widersprechen dem Showcase-Artefakt —
   ohne Archivierung + frische Messung ist die Veröffentlichungsgrundlage inkonsistent.
2. **Didaktik-Kern fehlt:** ohne P-2/P-3/P-8 steht „Hülle ohne Kern" gegen das FI-Fachkonzept
   (Jury-Kriterien Impact/Educator-Reuse).
3. **S3/S4-`skip` + S6 fehlt:** Ampel stützt sich auf S1/S2/S5; Maßstabs-Behauptung (1:50 +
   Realmaß-Bemassung) derzeit ungeprüft.
4. **O-1 Projekt-Lizenz fehlt** („owner must choose before redistribution") — kritischster
   Lizenz-Punkt vor Einreichung; dazu O-3 (Baseten-Bedingungen unbelegt), O-4/O-5 (CDN-Drift),
   weiße-Seite-Risiko bei CDN-Ausfall (Watchdog mindert, heilt nicht).
5. **Zeit:** 6 Tage für P-0–P-10; Demo/Video/Submit (P-10) ab 02.11. priorisieren,
   danach Feature-Freeze (03.11. mittags).

---

## Anhang A — Dateiliste mit Zeilen/Status (29.10.)

Status: `C` = committed (HEAD `292494e`), `M` = modifiziert (uncommitted), `U` = untracked.
Zeilen via `wc -l` (29.10., aus `ANALYSE-SOURCE-STAND.md` §5 übernommen).

**`src/` (aktiv):** `runtime/verify.js` 554 C · `livegen.js` 446 C · `geometry-checks.js` 438 C ·
`guard-static.js` 388 C · `frame-bootstrap.js` 356 C · `player.js` 333 C · `sandbox-host.js` 257 C ·
`annotate.js` 213 C · `budget.js` 203 C · `didactics.js` 185 C · `session-library.js` 145 C ·
`providers.js` 129 C · `guard-runtime.js` 102 C · `parts.js` 102 C · `scoreboard.js` 97 C ·
`fallback2d.js` 89 C · `shell/main.js` 513 C · `index.html` 191 C · `theme.css` 172 C ·
`i18n.js` 144 C · `ui-livegen.js` 331 C · `ui-modify.js` 181 C · `ui-library.js` 139 C ·
`ui-providers.js` 120 C · `ui-report.js` 49 C · `ui-annotations.js` 61 C · `ui-fallback2d.js` 28 C ·
`ui-model-picker.js` 18 C · `store.js` 51 C · `vendor/diagram-2d.js` 200 M ·
`three.entry.js` 2 C · `alpine.stub` 21 C · `manifest.schema.json` 109 M (`quellen` opt.) ·
`model-meta` 23 C · `verify-report` 57 C · `modellmatrix.json` 15 M · `models/gpu-example.js`
464 C · `si-1.js` 426 C · `si-2.js` 360 C · `si-3.js` 302 C · `chemie-koffein.js` 231 C ·
`free-handbohrmaschine.js` 231 C · `arch-brandenburger-tor.js` 226 U · `dup/ae je` ~19 C ·
13 Manifeste (12 C + `arch-brandenburger-tor.json` U).

**`scripts/` (A03 aktiv + L23 offen):** aktiv `build.mjs` 211 · `build-showcase.mjs` 161 U ·
`build-standalone-v13.mjs` 655 U · `showcase-harness.mjs` U · `_harness-loop.mjs` ·
`verify-all.mjs` 316 M · `verify-standalone.mjs` 246 U · `verify-dist.mjs` 130 ·
`serve/proxy/routing-tests/shot-2d/showcase-harness` (teils U). Offen: ~60 `*.mjs`
(je einzeln prüfen), `scripts/_tmp/` (Probes/PNGs/`replace-showcase-arch`/`wipe-empty-stand`, U).

**`prompts/`:** aktiv `p0-router.txt` 55 M · `p1-generate.v6-standard.txt` 91 ·
`p2-repair.v6-harness.txt` 34 · `p1-generate-2d.txt` 33 · `p1-generate.txt` 86.
Historisch: `gen-*` (~25×), `worker-call*` (36×), `p1-v3/v5`, `p2-v3/v5` (L22).

**`tests/` + `tests-unit/` + `eval/`:** Browser 15 Specs (`visual-matrix` 181 ·
`standalone` 118 U · `visual` 119 · `slim` 93 · `determinism` 86 · `i18n-ui` 70 ·
`labs.matrix` 63 · `static` 54 · `layout` 38 · `didactics` 38 · `fallback` 48 ·
`coldstart` 44 · `sandbox` 34 · `perf` 31); Unit 17 Dateien 148 Tests grün
(`livegen` 292 · `guide-3d` 261 · `router-2d` 174 · `proxy` 170 · `geometry` 166 ·
`budget` 97 · `prompts-eval` 94 · `guard-static` 94 · `providers` 84 · `didactics` 87 ·
`i18n` 74 · `modify` 66 · `scoreboard` 64 · `session-library` 73 · `parts` 61 · `matrix` 58).
Eval: `eval/3jsbench/` (~100 Prompts) + 2 Didaktik-JSONs (L26).

**`docs/` + Root + `dist*`:** 24+ Dateien (je Zeilen s. §3/§4-Belege; neu 29.10.:
`ANALYSE-HISTORIE-KONZEPTE`, `ANALYSE-SOURCE-STAND`, `REALGEBAEUDE-MACHBARKEIT`,
`ROUTING-TESTS`, `AKTUELL-SCREENSHOTS`, `NEUBAU-UI-CHECK`); Root `package.json` M,
`README.md` M; `dist-standalone/`: Artefakt 276.648 B M + Reports/Shots/Harness
(teils U); `dist/`: `verify-report`/`attestation`/`build-report` M, `baselines/` (22 PNG),
Rest L17–L21.

## Anhang B — Lücken, die dieser Bericht offen lässt

- Keine frische eigene Messung (`test:unit`/`verify:all`/`verify:standalone`/Playwright
  nicht erneut ausgeführt — Zahlen aus den Eingaben übernommen, Stand 29.10.).
- Kein Baseten-Live-Call gemessen (kein Key in diesem Profil) — BYOK-Pfad nur statisch belegt.
- Keine Rechtsberatung (technische Recherche, s. `REALGEBAEUDE-MACHBARKEIT.md` §4–§6).
- Keine unabhängige Maßtreue-Messung (S6-Empfehlung schließt genau diese Lücke).
- Session-DB-Zahlen (60+ Sessions, 1011+113, 59 Muse-Calls, 7 Commits) aus
  `ANALYSE-HISTORIE-KONZEPTE.md` übernommen, nicht erneut per FTS5 geprüft.
