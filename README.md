# SkillSpark Lab-Player

Single-Page-Wrapper fuer generierte Lehr-Labs (three.js 3D + leichte 2D-Diagramme).
Offline-faehig, Single-File-Artefakt (`dist/lab-player.html`), Standalone-Variante
(`dist-standalone/skillspark-standalone.html`, autark, kein CDN).

## Modelle (Meta-Regel, verbindlich)

Jeder Modell-Call zur Laufzeit laeuft ueber den **Proxy-Default
`meta-muse/muse-spark-1.3-contributor`**. Das gilt auch fuer 2D und Router:

- `routeGeneration()` (`src/runtime/livegen.js`): laesst `provider`/`model`
  unbelegt → Proxy-Default. Fremdmodelle nur explizit per Opts + BYOK-Key,
  nie als Default.
- `prompts/p0-router.txt`, `prompts/p1-generate-2d.txt`: pinnen den
  Meta-Default im Promptkopf (`Kein Fremdmodell als Default`).
- Baseten-Pfad (`scripts/proxy.mjs` -> `https://inference.baseten.co/v1`, Modell
  `meta-models/muse-spark-open-1026`): nur explizit + BYOK (nie Server-Key).
- 2D-Module brauchen zur Laufzeit **gar kein Modell** (statisches SVG aus
  `src/vendor/diagram-2d.js`).

Test-Pin: `tests-unit/router-2d.test.mjs` (`Meta-Regel im P0-Prompt`).

## 2D-Pfad (leichtgewichtig)

- 6 Labs als Datenmodule (SVG nativ, 0 externe Bytes): `dup-1..3`, `ae-1..3`
  (`export const diagram` + `meta_2d`, Render via Vendor-Spec `2d-svg`).
- Vendor-Prinzip: Lib in `src/vendor/diagram-2d.js`, Modul liefert nur Daten.
- Verify-2D-Gates (`src/runtime/verify.js::verifySvgLayer`): parse + pixel +
  Typ-Whitelist. Belege: `dist-2d/*.png`, `dist-2d/shot-2d-report.json`.
- Router-Beispiele: `dist-2d/router-2d-log.json`
  (`node scripts/router-2d-log.mjs`).
- Doku: `docs/2D-UMSTELLUNG-2026-10-28.md` (Umsetzungsbeleg),
  `docs/ROUTER-KONZEPT.md` (P0-Spec), `docs/2D-STACK-EVAL.md` (Lib-Eval).

## Demo (180 s, ohne Generierung)

`node scripts/demo-timed.mjs [port]` — F2-Pfad mit vorbereitetem Modell,
**kein Modell-Call** (Meta-Regel sichtbar in `dist/demo-timed.json`,
Feld `bemerkung`). Ergebnis: `dist/demo-timed.json`.

## Pruefung

- `npm run test:unit` — Node-Tests (u. a. Router/2D, Guards, Matrix).
- `npm run build && npm run render && npm run verify:all` — Build, Artefakt,
  Verify S1–S5 (2D: S2-light, S3 aus `dist-2d`, S4-light).
- `npm test` — Playwright-Suiten (u. a. S3-Matrix mit 2D-Baselines).

## 3D-Kernsanierung (6 Modelle, 28.10.2026)

Kuratiert nach `docs/implementation-guide-3d-qualitaet.md` (IBL-Raum,
4 Lichter, PCFShadowMap, DPR-Cap, Negativ-Liste), Harness-Loop max 2+1:
`gpu-example`, `si-1`, `si-2`, `si-3`, `free-handbohrmaschine`
(kuratiert aus Standalone-Embed), `chemie-koffein` (neu, C8H10N4O2,
24 Atome, 9.648 Tris Geometrie-Summe, Maßstab 1 Å ≙ 10 mm, in mm
gemessen, Budgets 150k Tris / 400 Calls).

Belege: `dist/verify-report.json`, `dist/harness-6modelle.jsonl`,
`dist/final-budgets-6modelle.json`,
`dist-standalone/proof-<id>-{overview,detail}.png` +
`dist-standalone/proof-6modelle.json`
(Generator: `node scripts/_tmp/proof-6modelle.mjs`).
