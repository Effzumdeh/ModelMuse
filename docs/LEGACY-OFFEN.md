# SkillSpark Legacy-Offen (L16–L26) — NICHT gelöscht

- Stand: 2026-10-28. Repo: `C:/Users/flori/OneDrive/skillSpark`, Branch `main`.
- Quelle: `docs/LEGACY-INVENTUR.md` Abschnitt 2. Am 2026-10-28 wurden **nur L01–L15** entfernt
  (Beleg: `cache/scratch/legacy-cleanup-20261028/` mit Backup-Tarball + `belege/`-Logs).
- Alles unter L16–L26 ist **unberührt** und braucht je eine eigene Freigabe/Prüfung.

## Abweichung bei L11 (dokumentiert, kein Mehr-Löschen)

- `docs/LEGACY-INVENTUR.md` claimed „L01–L15: 0 Dateien versioniert“. Tatsächlich sind in
  `scripts/_tmp/` **4 Dateien versioniert** (`git ls-files scripts/_tmp/`):
  `.gitkeep`, `i18n-manifests-tmp.json`, `repro-check.tmp.mjs`, `tmp-ae3-verify.mjs`
  (Commit `6ca4bda`). Diese 4 wurden **behalten**, nur Unversioniertes wurde gelöscht.
  Vor Einzel-Löschung dieser 4 braucht es `git rm`-Freigabe + Referenzprüfung.

## Offene Unsicherheiten (je einzeln freigeben)

| ID | Pfad/Glob | Stand 2026-10-28 | Warum nicht gelöscht | Nächster Schritt |
|----|-----------|------------------|----------------------|------------------|
| L16 | `tests/*.spec.mjs` (14 Dateien, 41709 B) | versioniert (`git ls-files tests/` = 14), `testDir: ./tests` in `playwright.config.mjs` (`npm test`) | Als Alt-Frontend markiert, ABER aktiv verdrahtet | Entscheiden: E2E nach `tests-unit/` migrieren oder `npm test`-Pfad behalten; erst dann löschen |
| L17 | `dist/*.png` Top-Level (69 Dateien, ~6,6 MB), davon 22 versioniert | 22 Dateien versioniert (`git ls-files dist/*.png` sinngemäß, A07: `dist/baselines/` + Audit-JSONs) | Einzelprüfung nötig, welche der 69 zu den 22 versionierten gehören | Pro Datei `git ls-files` + Referenz (`snapshotPathTemplate`) prüfen, Rest archivieren statt löschen |
| L18 | `dist/manual-tests/*.png` (10 Dateien, ~44 MB) | gitignored, evtl. Belegwert | Manuelle Testbelege — nicht ersatzlos löschen | Archivieren (externer Speicher) statt löschen; Aufbewahrungsfrist klären |
| L19 | `dist/last-green/*` (2 Dateien, ~1 MB) | Fallback-Quelle per `.gitignore` (O-07) | Letzte grüne Auslieferung, Wiederherstellungsanker | Erst nach stabilem Grün + getaggtem Release freigeben |
| L20 | `dist/*.js` Modell-Iterate (`gpu-*`, `si-*`, `dup-*`, `ae-*`, `compare-*`, `ohr-*`), `*.prompt.txt`, `*.verify.json`, `*.manifest.json`, `*.head.txt`, `worker-call*.out.txt` (~1,5 MB) | gitignored, teils Belegwert (Ohr-Test, Vergleiche) | Alt-Generierungen, teils noch Referenz für Diagnosen | Sichten, Belegwert-Subset benennen + archivieren, Rest freigeben |
| L21 | `dist/*.md` Reports, `dist/ledger-muse-calls.md`, `dist-standalone/ledger-muse-calls.md`, `dist-standalone/gen-stderr.log` (~0,1 MB) | Auftrags-/Belegdoku | Vor Löschung sichten (Abrechnungs-/Auftragsnachweis) | Sichten, ins Archiv übernehmen, dann freigeben |
| L22 | `prompts/gen-*.txt` (v1/v4/v5real/v6hyper/v2/v3hyper), `repair-*-head.txt`, `worker-call*.txt`, `p1-generate.v3/v5`, `p2-repair.v3/v5`, `probe-ok.txt`, `p1-generate.txt` (~90 Dateien, ~0,3 MB) | Referenz durch `eval-harness`/`_make-*.mjs` ungeprüft | Alt-Promptstände, evtl. noch referenziert | `grep` Referenzen (`eval-harness`, `_make-*`, `package.json`-Scripts) belegen, dann stufenweise freigeben |
| L23 | `scripts/*.mjs` ausser A03 (`_*.mjs`, `shot-*`, `proxy*`, `eval-harness`, `regression-3jsbench`, `chemie-e2e`, `render-single-file`, `serve`, `double-build`, `baseline-update`, `verify-dist`, `demo-timed`, `usage-tagesstand`, `probe-api`, `e2e-debug-tmp`) (~60 Dateien, ~0,35 MB) | Teilweise via `package.json`-Scripts verdrahtet | Einzeln prüfen — manche sind aktiv | Je Skript: `package.json` + `docs/NEXT-STEPS.md`-Verdrahtung prüfen, ungenutzte einzeln freigeben |
| L24 | `docs/` ausser A04 (`ARCHITEKTUR-PFADE`, `NEXT-STEPS`, `ABLAGEKONVENTION`, `ABWEICHUNGSBLATT`, `INSTALLATION-MUSE`, `ki-modellqualitaet-recherche`, `skillspark-v8-spec.md`) (7 Dateien, ~0,1 MB) | klein, Doku | Behalten bis Guide §6/M6 abgeschlossen | Nach Guide-Abschluss erneut inventarisieren |
| L25 | `gpu-example.js` (Root, 20507 B) | Dupe von `src/models/gpu-example.js`, ABER von Parallel-Session modifiziert (`M gpu-example.js` in `git status`) | Gehört Parallelsession — nicht anfassen | Mit Parallelsession klären, dann deduplizieren |
| L26 | `eval/3jsbench/`, `eval/didaktik-*.json` (~100 Dateien, ~0,1 MB) | evtl. Input für `regression-3jsbench.mjs` | Benchmark-Korpus, Referenz ungeprüft | `regression-3jsbench.mjs`-Input prüfen, dann entscheiden |

## Grün-Beleg nach L01–L15-Löschung (2026-10-28)

- Backup: `cache/scratch/legacy-cleanup-20261028/legacy-L01-L15-20261028.tar.gz`
  (2285265 B komprimiert, 275 Einträge, SHA256 in `belege/backup-sha256.txt`).
- `git status` vorher/nachher: `belege/git-status-vorher.txt`, `belege/git-status-nachher.txt`
  (Diff = nur entfallene Untracked-Einträge `designer-scratch/`, `scripts/_tmp/g3d-*`; keine versionierte Änderung durch die Löschung).
- `npm run build`: OK (`hash=b0881475b32b7f09`), Log `belege/build.log`.
- `npm run verify:all`: OK (10 Modelle, alle gelb), Log `belege/verify-all.log`.
- `npm run test:unit`: 122 pass / 0 fail, Log `belege/test-unit.log`.
