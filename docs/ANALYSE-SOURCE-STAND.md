# Source-Analyse: Stand (29.10.2026)

Stand: 29.10.2026, Repo `C:/Users/flori/OneDrive/modelMuse`, Branch `main` (HEAD `292494e`).
Regel dieser Analyse: **keine Codeänderung**, nur Befund. Verifiziert per
`npm run test:unit` (148/148), `npm run verify:all` (13 gelb), `npm run build:standalone`
(idempotent exit 0), `npm run verify:standalone` (showcase OK).

Einzige Release-Basis: `dist-standalone/modelmuse-standalone.html` (**v13-SHOWCASE**,
276.648 Bytes, < 600 KB). Tags: `nachts-final`, `models-pre-wipe-20261029-082023`.
`src/` + `scripts/` sind Entwicklungs-/Harness-Werkzeuge, kein Release.

## 1. Architektur

### 1.1 Builder (Release-Pfad)
| Skript | Zeilen | Rolle |
|---|---|---|
| `scripts/build-standalone-v13.mjs` | 655 (untracked, aktiv) | v12-guide → v13 Upgrade (M1–M8), idempotent via `standalone-build v13`-Stempel |
| `scripts/build-showcase.mjs` | 161 (untracked, aktiv) | Bettet genau 5 Showcase-Modelle ein (LABS/META/INIT + `__SOURCES` + ES/MEAS) |
| `scripts/build.mjs` | 211 | Legacy-Dev-Build (`dist/lab-player.html`), nicht Release |
| `scripts/double-build.mjs` | — | Byte-Identitäts-Nachweis (O-04) |
| `scripts/render-single-file.mjs`, `verify-dist.mjs`, `baseline-update.mjs` | — | Dev-Utilities |
| `scripts/_tmp/replace-showcase-arch.mjs` | untracked | Einmal-Swap `arch-fassade` → `arch-brandenburger-tor` |

Fluss: `src/models/*.js` + `manifests/*.json` + `modellmatrix.json` → `build-standalone-v13`
(v13-Stempel, M1–M8: 3D-Quellen, Licht, UI, Baseten) → `build-showcase` (5er-Schnitt) →
`verify:standalone` (SHOWCASE-Marker, 5 LABS/META/INIT, keine Alt-Muster, < 600 KB).

### 1.2 Runtime (`src/runtime/`, 16 Dateien, ~3.980 Zeilen)
| Datei | Zeilen | Rolle |
|---|---|---|
| `verify.js` | 554 | Verify-Orchestrierung S1..S5, Layer-Bau, Ampel, P2-Protokoll |
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
`alpine.module.esm.min.js` (21-Zeilen-Stub-Eintrag). Schema: `manifest` (109),
`model-meta` (23), `verify-report` (57). Daten: `modellmatrix.json` (15),
`providers.json` (Default `muse-spark-1.3-contributor` / `meta-muse`; Baseten-Direkt).

### 1.3 Prompts (P0 → P1 → P2 + 2D)
| Prompt | Zeilen | Status |
|---|---|---|
| `p0-router.txt` | 55 | **aktiv**: Klassifikator 3d/2d + 2D-Typ (schaltplan/flussdiagramm/schnitt-ansicht/diagramm/tabelle), few-shot, Meta-Regel (Proxy-Default Contributor, OpenRouter nur BYOK) |
| `p1-generate.v6-standard.txt` | 91 | **aktiv (3D)**: r186-Allowlist, wrapper-helpers, 4-Licht-PBR-Studio (Raumlicht 5, `environmentIntensity 0.55`, kein AmbientLight), Budget-Checkliste = `budget.js` |
| `p2-repair.v6-harness.txt` | 34 | **aktiv (Notfallpfad)**: max. Iteration 2 (+1 manuell), 6 FLARE-Fehlerklassen, nur protokollierte Fehler fixen |
| `p1-generate-2d.txt` | 33 | **aktiv (2D)**: SVG-Datenmodul (`2d-svg`) |
| `p1-generate.txt` (86), `p1-generate.v3/v5`, `p2-repair(.v3/.v5)` etc. | — | historisch, Referenz ungeprüft (Tech-Debt L22) |
| `gen-*/repair-*/worker-call*` (~90 Dateien) | je ~20–45 | Alt-Promptstände v1/v4/v5real/v6hyper + 36 Worker-Calls; Referenz durch `eval-harness`/`_make-*` ungeprüft |

Harness-Loop: `scripts/_harness-loop.mjs` (`MODULE_BYTES_HARD=34000`, `decideIteration`:
grün / repair-auto / repair-manual / stagnation / regression / budget, max 2+1) +
`scripts/showcase-harness.mjs` (5× P0-regelbasiert → P1-v6 → Verify S1/S2-statisch/S4/S5,
Belege `dist-standalone/showcase-harness/<id>.jsonl` + `SUMMARY.json`).

### 1.4 Verify (S1..S5)
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

### 1.5 Tests
- **Unit** (`tests-unit/`, 17 Dateien): `npm run test:unit` = **148/148 grün**.
  Abdeckung: guard-static, budget, didactics, livegen (292 Z.), matrix, geometry-checks,
  prompts-eval, providers, proxy (170 Z.), parts, i18n, modify, guide-3d-qualitaet (261 Z.),
  router-2d, scoreboard, session-library.
- **Browser** (`tests/`, 15 Specs, Playwright/Chromium-SwiftShader): `coldstart`,
  `determinism`, `didactics`, `fallback`, `geometry`, `i18n-ui`, `labs.matrix`,
  `layout`, `perf`, `sandbox`, `slim`, `standalone` (118 Z., untracked, 7/7 für Showcase),
  `static`, `visual`, `visual-matrix`. `tests/*.spec.mjs` ist als Alt-Frontend markiert,
  aber aktiv verdrahtet (`testDir: ./tests`, L16).
- **Eval/Regression**: `eval/3jsbench/` (~100 Prompts) + `didaktik-benchmark-v1.json`,
  `scripts/regression-3jsbench.mjs`, `scripts/eval-harness.mjs`, `scripts/routing-tests.mjs`.

## 2. Modellbestand (13 Module in `src/models/`)

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

## 3. Test-/Build-Lage (gemessen 29.10.2026)

- `npm run test:unit`: **148/148 bestanden** (13 Quellen + `arch-brandenburger-tor`, Matrix synchron).
- `npm run verify:all`: **OK (13 Modelle, alle gelb, keine Fehler)** — gelb = Teilbasis
  (Beleg älter als Quelle oder kein `final-budgets`-Messwert; Lehrkraft-Freigabe ausstehend).
- `npm run build:standalone`: **idempotent exit 0** (`bereits v13 — nichts zu tun`).
- `npm run verify:standalone`: **OK (showcase verified)** — 5 LABS/META/INIT, Baseten-Direkt,
  M8-UI, 276.648 B.
- Showcase-Harness: **5/5 grün in Iter 0** (Budget 2+1 ungenutzt), S3/S4-Browser-Belege skip.
- Playwright `tests/standalone.spec.mjs`: **7/7** (Boot, Labels, Banner, Baseten-Default,
  Generieren-Validierung, Stift-Modify, 5× Render + `dist-standalone/shots/`).
- Hinweis: `STANDALONE-REPORT-2026-10-29.md` (eingecheckt) beschreibt einen **EMPTY-STAND**
  (117 KB, 0 Modelle, 8 Unit-Fails) — **überholt**; maßgeblich ist
  `SHOWCASE-REPORT-2026-10-29.md` (5 Modelle, alles grün). Report-Divergenz aufräumen (s. §4).

## 4. Offene Baustellen + Tech-Debt

1. **Uncommitteter Arbeitsstand (Publish-Risiko)**: 17 modifizierte Dateien
   (README, Artefakt, `verify-report`/`attestation`/`build-report`, 5 Docs, `package.json`,
   `p0-router`, `verify-all`, `modellmatrix`, `manifest.schema`, `diagram-2d`) + ~50
   untracked (Showcase-Builder/Harness/Reports/Shots, `arch-brandenburger-tor` + Manifest,
   `tests/standalone.spec.mjs`, `scripts/{build-showcase,build-standalone-v13,showcase-harness,
   verify-standalone,routing-tests}.mjs`, `docs/{AKTUELL-SCREENSHOTS,NEUBAU-UI-CHECK,
   REALGEBAEUDE-MACHBARKEIT,ROUTING-TESTS,source-de}`). Tags `nachts-final`/`models-pre-wipe`
   decken das nicht ab. → Commit/Push-Freigabe + `scripts/_tmp/probe-*.png`-Aufräumung.
2. **Report-Divergenz**: eingecheckter `STANDALONE-REPORT-2026-10-29.md` = EMPTY-STAND
   (alt), `dist-standalone/SHOWCASE-REPORT-2026-10-29.md` (untracked) = Showcase (aktuell).
   → EMPTY-Report archivieren (`docs/source-de/`), Showcase-Report versionieren.
3. **Legacy L16–L26 offen** (`docs/LEGACY-OFFEN.md`): `tests/*.spec.mjs` aktiv-verdrahtet,
   `dist/*.png` (69 Dateien, 22 versioniert), `dist/manual-tests` (~44 MB, gitignored),
   `dist/last-green` (Wiederherstellungsanker), `dist/*.js`/Prompts/Reports (~1,5 MB),
   ~90 Alt-Prompts (L22), ~60 `scripts/*.mjs` teils aktiv (L23), `gpu-example.js`-Root-Dupe (L25),
   `eval/3jsbench` (L26). Jeweils Einzel-Freigabe nötig.
4. **Alles gelb, nichts grün**: 13× `ampel: gelb` (Teilbasis), S3/S4-Browser-Belege teils skip,
   Lehrkraft-Freigabe ausstehend. Kein gemessener Baseten-Live-Call (kein Key im Profil;
   Produktpfad nur statisch verifiziert). → Browser-Belege aktualisieren, BYOK-E2E belegen.
5. **Fachkonzept-Lücken** (`docs/NEXT-STEPS.md`, 27.10.): Curriculum-Mapping, Aufgaben-Nachweis
   (Zuordnung nur Selbst-Abhaken), Hints/Quiz/Adaptiv-Engine, Tutor-Texte, Fach-Invarianten,
   Schul-UX-Audit, Demo-Video/Submit (Abgabe 04.11.). Technik stark, Didaktik-Kern offen.
6. **Kleinere Debts**: Verify-EMPTY-STAND-Zweig vs. Showcase-Realität (toter Pfad pflegen oder
   streichen); `scripts/_tmp/`-Probes versioniert vs. unbeaufsichtigt; `dist-standalone/ledger-muse-calls.md`
   + `gen-stderr.log` sichten/archivieren (L21); `S3/S4`-Skip-Dokumentation pro Modell fehlt
   (`final-budgets.json`-Lücke bei 4 Showcase-Modellen).

## 5. Dateiliste mit Zeilen/Status

Status: `C`=committed (HEAD), `M`=modifiziert (uncommitted), `U`=untracked.
Zeilen via `wc -l` (29.10.2026).

### 5.1 `src/` (Aktiv, A01)
| Datei | Zeilen | Status |
|---|---|---|
| `runtime/verify.js` | 554 | C |
| `runtime/livegen.js` | 446 | C |
| `runtime/geometry-checks.js` | 438 | C |
| `runtime/guard-static.js` | 388 | C |
| `runtime/frame-bootstrap.js` | 356 | C |
| `runtime/player.js` | 333 | C |
| `runtime/sandbox-host.js` | 257 | C |
| `runtime/annotate.js` | 213 | C |
| `runtime/budget.js` | 203 | C |
| `runtime/didactics.js` | 185 | C |
| `runtime/session-library.js` | 145 | C |
| `runtime/providers.js` | 129 | C |
| `runtime/guard-runtime.js` | 102 | C |
| `runtime/parts.js` | 102 | C |
| `runtime/scoreboard.js` | 97 | C |
| `runtime/fallback2d.js` | 89 | C |
| `shell/main.js` | 513 | C |
| `shell/index.html` | 191 | C |
| `shell/theme.css` | 172 | C |
| `shell/i18n.js` | 144 | C |
| `shell/ui-livegen.js` | 331 | C |
| `shell/ui-modify.js` | 181 | C |
| `shell/ui-library.js` | 139 | C |
| `shell/ui-providers.js` | 120 | C |
| `shell/ui-report.js` | 49 | C |
| `shell/ui-annotations.js` | 61 | C |
| `shell/ui-fallback2d.js` | 28 | C |
| `shell/ui-model-picker.js` | 18 | C |
| `shell/store.js` | 51 | C |
| `vendor/diagram-2d.js` | 200 | M |
| `vendor/three.entry.js` | 2 | C |
| `vendor/alpine.module.esm.min.js` | 21 | C |
| `schema/manifest.schema.json` | 109 | M (`quellen` opt.) |
| `schema/model-meta.schema.json` | 23 | C |
| `schema/verify-report.schema.json` | 57 | C |
| `data/modellmatrix.json` | 15 | M (+`arch-brandenburger-tor`) |
| `data/providers.json` | — | C |
| `models/gpu-example.js` | 464 | C |
| `models/si-1.js` | 426 | C |
| `models/si-2.js` | 360 | C |
| `models/si-3.js` | 302 | C |
| `models/chemie-koffein.js` | 231 | C |
| `models/free-handbohrmaschine.js` | 231 | C |
| `models/arch-brandenburger-tor.js` | 226 | U (neu) |
| `models/dup-1.js` / `dup-2.js` / `dup-3.js` | je 19 | C (2D) |
| `models/ae-1.js` / `ae-2.js` / `ae-3.js` | je ~19 | C (2D) |
| `models/manifests/*.json` | 13× | C, außer `arch-brandenburger-tor.json` U |

### 5.2 `scripts/` (A03 aktiv + L23 offen)
Aktiv/verdrahtet: `build.mjs` (211), `build-showcase.mjs` (161, U),
`build-standalone-v13.mjs` (655, U), `showcase-harness.mjs` (U), `_harness-loop.mjs`,
`verify-all.mjs` (316, M), `verify-standalone.mjs` (246, U), `verify-dist.mjs` (130),
`serve.mjs`, `proxy.mjs`, `routing-tests.mjs` (U), `shot-2d.mjs`, `showcase-harness`.
Offen (L23, je einzeln prüfen): `shot-hyper/v2/v3`, `proxy-e2e-*`, `eval-harness.mjs`,
`regression-3jsbench.mjs`, `chemie-e2e.mjs`, `render-single-file.mjs`, `double-build.mjs`,
`baseline-update.mjs`, `demo-timed.mjs`, `usage-tagesstand.mjs`, `probe-api.mjs`,
`e2e-debug-tmp.mjs`, `_bausteine/_byok-*/_check-*/_gen-*/_shot-*/_ver*` (~40× `_*.mjs`),
`_tmp/*` (Probes/PNGs/`replace-showcase-arch`/`wipe-empty-stand`, U).

### 5.3 `prompts/` (P0/P1-v6/P2-v6 aktiv, Rest L22)
Aktiv: `p0-router.txt` (55, M), `p1-generate.v6-standard.txt` (91),
`p2-repair.v6-harness.txt` (34), `p1-generate-2d.txt` (33), `p1-generate.txt` (86).
Historisch (Referenz ungeprüft): `gen-*` (v1/v4/v5real/v6hyper, ~25×), `repair-*-head`
(4×), `worker-call*` (36×), `p1-generate.v3/v5`, `p2-repair.v3/v5`, `probe-ok.txt`.

### 5.4 `tests/` + `tests-unit/` + `eval/`
Browser (`tests/`, L16 — aktiv verdrahtet): `visual-matrix` (181), `standalone` (118, U),
`visual` (119), `slim` (93), `determinism` (86), `i18n-ui` (70), `geometry` (69),
`labs.matrix` (63), `static` (54), `layout` (38), `didactics` (38), `fallback` (48),
`coldstart` (44), `sandbox` (34), `perf` (31).
Unit (`tests-unit/`, 148 Tests grün): `livegen` (292), `guide-3d-qualitaet` (261),
`router-2d` (174), `proxy` (170), `geometry-checks` (166), `budget` (97),
`prompts-eval` (94), `guard-static` (94), `providers` (84), `didactics` (87),
`i18n` (74), `modify` (66), `scoreboard` (64), `session-library` (73), `parts` (61),
`matrix` (58). Eval: `eval/3jsbench/` (~100 Prompts) + 2 Didaktik-JSONs (L26).

### 5.5 `docs/` + Root + `dist*`
Docs (je Zeilen): `ki-modellqualitaet-recherche` (701), `2D-STACK-EVAL` (323),
`MODELLPORTFOLIO-VORSCHLAG` (345), `modelmuse-v8-spec` (182), `LIZENZEN` (171, M),
`implementation-guide-3d-qualitaet` (151, M), `REALGEBAEUDE-MACHBARKEIT` (150, U),
`ROUTER-KONZEPT` (110, M), `NEXT-STEPS` (113), `ROUTING-TESTS` (87, U),
`LEGACY-INVENTUR` (82), `INSTALLATION-MUSE` (21), `PROXY-BOOTSTRAP-BEFUND` (67),
`BASETEN-MIGRATION` (72), `FINAL-NACHWEISE` (52, M), `ARCHITEKTUR-PFADE` (40, M),
`2D-UMSTELLUNG` (115), `ABLAGEKONVENTION` (36), `ABWEICHUNGSBLATT` (18),
`LEGACY-OFFEN` (40), `AKTUELL-SCREENSHOTS` (57, U), `NEUBAU-UI-CHECK` (63, U),
`three-186-api-pin` (60), `source-de/` (U, Archiv: 12-Modell-Report + 3 Docs).
Root: `package.json` (M), `README.md` (M), `playwright.config.mjs`, `gpu-example.js`
(Root-Dupe, L25). `dist-standalone/`: Artefakt (276.648 B, M) + Reports/Shots/Harness
(teils U). `dist/`: `verify-report`/`attestation`/`build-report` (M),
`baselines/` (22 PNG, versioniert), Rest L17–L21.
