# SkillSpark Legacy-Inventur

- Stand: 2026-10-28. Repo: `C:/Users/flori/OneDrive/skillSpark`, Branch `main` (e06adfe).
- Arbeitsstand: parallele Session hat 16 Dateien uncommitted modifiziert (u. a. `src/`, `scripts/build.mjs`, `scripts/verify-all.mjs`, `prompts/*.v6*`, `package.json`) — siehe `git status` unten. Diese Inventur veraendert nichts davon.
- Regel: **NICHTS geloescht.** Nur inventarisiert. Risiko: `aktiv` = behalten, `unsicher` = erst pruefen/freigeben, `loeschbar` = unversioniert + unreferenziert, Loeschung trotzdem erst nach Backup.
- Groessen via `find -printf "%s %p" | sort -rn` und `du -sb` belegt (Abschnitt 3).

## 1. Aktiv — behalten, nicht anfassen

| ID | Pfad | Beleg |
|----|------|-------|
| A01 | `src/` (60 Dateien, 496184 B) | Build-Input (`scripts/build.mjs` liest `src/shell`, `src/runtime`, `src/models`, `src/vendor`, `src/schema`) |
| A02 | `prompts/p1-generate.v6-standard.txt` (8512 B), `prompts/p2-repair.v6-harness.txt` (3658 B) | V6-Standard, 28.10. modifiziert |
| A03 | `scripts/build.mjs` (8651 B), `scripts/verify-all.mjs` (10925 B), `scripts/_harness-loop.mjs` (12908 B) | `npm run build`, `verify:all`; Harness referenziert in `docs/NEXT-STEPS.md` |
| A04 | `docs/implementation-guide-3d-qualitaet.md` (33763 B), `docs/three-186-api-pin.md` (2956 B) | Guide §1–7 + API-Pin |
| A05 | `dist/lab-player.html` (1021392 B), `dist-standalone/skillspark-standalone.html` (281090 B) | Haupt-Build + Standalone |
| A06 | `package.json` (1636 B), `tests-unit/` (14 Dateien, 78910 B) | `npm run test:unit` (14 Testdateien) |
| A07 | `dist/baselines/` (22 PNG, 3148849 B), `dist/{generation-log,verify-report,build-report,attestation}.json` | Versioniert per `.gitignore`-Ausnahme; Snapshots via `snapshotPathTemplate` in `playwright.config.mjs` |

## 2. Loeschliste (gruppiert, keine Einzeldatei loeschen ohne Freigabe)

| ID | Pfad/Glob | Anzahl / Groesse | Grund | Risiko |
|----|-----------|------------------|-------|--------|
| L01 | `designer-scratch/skillspark-v*.html`, `v5-ctx-*.html` | 14 Dateien / ~3,0 MB | Versions-Backups v4–v11, abgeloest durch `dist/lab-player.html` + `dist-standalone/` | loeschbar |
| L02 | `designer-scratch/muse-v*-gen-out.*` | 5 Dateien / ~76 KB | Alt-Generierungen v4–v8, abgeloest durch V6-Prompts + `src/models/` | loeschbar |
| L03 | `designer-scratch/muse-v*-probe*` (txt/log/out) | 15 Dateien / ~1 KB | Alt-Probes, Ergebnis nur `probe-ok`-Plaetze | loeschbar |
| L04 | `designer-scratch/muse-v*-prompt.txt` | 5 Dateien / ~48 KB | Alt-Prompts v4–v8, abgeloest durch A02 | loeschbar |
| L05 | `designer-scratch/muse-v*-check-*` (mod.mjs/vue.js) | 12 Dateien / ~1,6 MB | Alt-Pruefskripte, abgeloest durch `scripts/verify-all.mjs` | loeschbar |
| L06 | `designer-scratch/verify-v*.mjs`, `verify-v*.png` | 17 Dateien / ~0,5 MB | Alt-Harnesse v4–v11, abgeloest durch A03 | loeschbar |
| L07 | `designer-scratch/diag-*.mjs`, `diag-*.png` | 14 Dateien / ~1,0 MB | Alt-Diagnosen v7/v8, kein Nachnutzen | loeschbar |
| L08 | `designer-scratch/assemble-v*.mjs` | 12 Dateien / ~0,2 MB | Alt-Builder v4–v11, abgeloest durch `scripts/build.mjs` | loeschbar |
| L09 | `designer-scratch/check-v4-deep.mjs`, `click-v*.mjs`, `fix-v*.mjs`, `mesh-toggle-*.mjs`, `validate-v6-gen.mjs`, `make-v6-prompt.mjs` | 8 Dateien / ~35 KB | Einmal-Fixes/-Klicks, abgeloest | loeschbar |
| L10 | `designer-scratch/*.log` | 12 Dateien / ~1 KB | Alt-Protokolle (`*-gen-err`, `*-probe-err`, `muse-v8-click.log`) | loeschbar |
| L11 | `scripts/_tmp/*` | ~85 KB | Temp-Artefakte (`g3d-*`, `*-tmp.mjs`), `.gitkeep` bleibt | loeschbar |
| L12 | `dist/raw/*`, `dist/*.err.txt` | ~0,6 MB | Alt-Protokolle (raw/err/prev-backup), gitignored | loeschbar |
| L13 | `dist/logs/*` | ~46 KB | Lauf-Logs, gitignored | loeschbar |
| L14 | `dist/failures/*` | 0 B (nur `.gitkeep`) | Leer, `.gitkeep` bleibt | loeschbar |
| L15 | `cache/scratch/*`, `test-results/*` | ~3 KB | Laufartefakte, gitignored | loeschbar |
| L16 | `tests/*.spec.mjs` | 14 Dateien / 41709 B | Vom Task als Alt-Frontend markiert, ABER versioniert + `testDir: ./tests` in `playwright.config.mjs` (`npm test`) | unsicher |
| L17 | `dist/*.png` (Top-Level) | 69 Dateien / 6872722 B | Alt-Screenshots, ABER 22 davon versioniert — Einzelpruefung noetig | unsicher |
| L18 | `dist/manual-tests/*.png` | 10 Dateien / 45735278 B | Manuelle Testbelege (~44 MB), gitignored, evtl. archivieren statt loeschen | unsicher |
| L19 | `dist/last-green/*` | 2 Dateien / ~1 MB | Fallback-Quelle per `.gitignore` (O-07) | unsicher |
| L20 | `dist/*.js` Modell-Iterate (`gpu-*`, `si-*`, `dup-*`, `ae-*`, `compare-*`, `ohr-*`), `*.prompt.txt`, `*.verify.json`, `*.manifest.json`, `*.head.txt`, `worker-call*.out.txt` | ~1,5 MB | Alt-Generierungen, gitignored, teils Belegwert (Ohr-Test, Vergleiche) | unsicher |
| L21 | `dist/*.md` Reports, `dist/ledger-muse-calls.md`, `dist-standalone/ledger-muse-calls.md`, `dist-standalone/gen-stderr.log` | ~0,1 MB | Auftrags-/Belegdoku, vor Loeschung sichten | unsicher |
| L22 | `prompts/gen-*.txt` (v1/v4/v5real/v6hyper400/v2/v3hyper), `repair-*-head.txt`, `worker-call*.txt`, `p1-generate.v3/v5`, `p2-repair.v3/v5`, `probe-ok.txt`, `p1-generate.txt` | ~90 Dateien / ~0,3 MB | Alt-Promptstaende — NICHT im Task-Legacy enthalten; Referenz durch `eval-harness`/`_make-*.mjs` ungeprueft | unsicher |
| L23 | `scripts/*.mjs` ausser A03 (`_*.mjs`, `shot-*`, `proxy*`, `eval-harness`, `regression-3jsbench`, `chemie-e2e`, `render-single-file`, `serve`, `double-build`, `baseline-update`, `verify-dist`, `demo-timed`, `usage-tagesstand`, `probe-api`, `e2e-debug-tmp`) | ~60 Dateien / ~0,35 MB | Teilweise via `package.json`-Scripts verdrahtet — einzeln pruefen | unsicher |
| L24 | `docs/` ausser A04 (`ARCHITEKTUR-PFADE`, `NEXT-STEPS`, `ABLAGEKONVENTION`, `ABWEICHUNGSBLATT`, `INSTALLATION-MUSE`, `ki-modellqualitaet-recherche`, `skillspark-v8-spec`) | 7 Dateien / ~0,1 MB | Doku, klein — behalten bis Guide §6/M6 abgeschlossen | unsicher |
| L25 | `gpu-example.js` (Root, 20507 B) | 1 Datei | Dupe von `src/models/gpu-example.js`, ABER von Parallel-Session modifiziert — nicht anfassen | unsicher |
| L26 | `eval/3jsbench/`, `eval/didaktik-*.json` | ~100 Dateien / ~0,1 MB | Benchmark-Korpus, evtl. Input fuer `regression-3jsbench.mjs` — ungeprueft | unsicher |

Summe `loeschbar` (L01–L15): ca. 6,9 MB, 0 Dateien versioniert (`git ls-files designer-scratch/` = 0, `dist/*` ausser A07 gitignored). Freigabe + Backup empfohlen, danach `git clean`-faehig.

## 3. Belege (ls + Groessen, 2026-10-28)

```
$ git status --short | head: M dist/attestation.json, M dist/build-report.json,
  M dist/verify-report.json, M docs/NEXT-STEPS.md, M gpu-example.js, M package.json,
  M prompts/p1-generate.txt, M prompts/p1-generate.v6-standard.txt,
  M prompts/p2-repair.v6-harness.txt, M scripts/build.mjs, M scripts/verify-all.mjs,
  M src/models/gpu-example.js, M src/runtime/frame-bootstrap.js,
  M src/runtime/guard-static.js, M src/runtime/verify.js, M src/vendor/three.entry.js
  Untracked: cache/, designer-scratch/, dist-standalone/, docs/*.md (3 neu), prompts/bausteine.json,
  scripts/_bausteine.mjs, scripts/_harness-loop.mjs, scripts/_png-diff.mjs, scripts/_tmp/, tests-unit/guide-3d-qualitaet.test.mjs
$ du -sb: designer-scratch/ 6061750 | src/ 496184 (60 Dateien) | tests/ 41709 (14) |
  tests-unit/ 78910 (14) | scripts/_tmp/ 86988 | dist/raw/ 559138 | dist/logs/ 46950 |
  dist/failures/ 0 | dist/baselines/ 3148849 (22 PNG) | dist/manual-tests/ 45735278 (10 PNG) |
  dist/*.png Top-Level 6872722 (69 Dateien)
$ git ls-files: designer-scratch/ 0 Dateien | tests/ 14 Dateien | dist/*.png 22 Dateien
$ grep-Referenzen: designer-scratch -> nur docs/skillspark-v8-spec.md (Doku, kein Build) |
  _harness-loop -> scripts/_harness-loop.mjs + docs/NEXT-STEPS.md |
  playwright.config.mjs: testDir ./tests, snapshotPathTemplate dist/baselines/{arg}{ext}
$ Aktiv-Dateien: prompts/p1-generate.v6-standard.txt 8512 B | prompts/p2-repair.v6-harness.txt 3658 B |
  scripts/build.mjs 8651 B | scripts/verify-all.mjs 10925 B | scripts/_harness-loop.mjs 12908 B |
  docs/implementation-guide-3d-qualitaet.md 33763 B | docs/three-186-api-pin.md 2956 B |
  dist/lab-player.html 1021392 B | dist-standalone/skillspark-standalone.html 281090 B | package.json 1636 B
```

## 4. Empfehlung

1. L01–L15 (`loeschbar`) nach Backup/Archivierung freigeben — kein versionierter, kein referenzierter Inhalt dabei.
2. L16–L26 (`unsicher`) nicht loeschen: L16/L17 sind (teil-)versioniert, L22/L23/L26 brauchen Referenzpruefung (`eval-harness`, `_make-*`, `regression-3jsbench`), L25 gehoert der Parallel-Session.
3. Naechster Schritt (getrennt beauftragen): git-faehiges Archiv der `loeschbar`-Menge + `npm run build && npm run verify:all && npm run test:unit` als Vorher/Nachher-Beleg.
