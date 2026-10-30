# FINALE NACHWEISE — ModelMuse (nur lokal, kein Push)

Stand: 2026-10-29 nachts (MEZ). Branch: `main`. Tag: `nachts-final`.
Verifikation: `git log --oneline -5`, `git show --stat HEAD`, `git tag --list`.

## 1) Final grün (29.10.2026, Workdir-Stand)

| Schritt | Befehl | Ergebnis |
|---|---|---|
| Build | `npm run build` | OK — `hash=69155f1d78755733`, three-bundle 610955 B, shell-js 68126, runtime-js 171381, css 8914, modelle 89720 |
| Verify | `npm run verify:all` | OK — 12 Modelle, alle **gelb** (keine Fehler): ae-1..3, chemie-koffein, dup-1..3, free-handbohrmaschine, gpu-example, si-1..3; Artefakt 996825 B (Komfort 1500000) |
| Unit | `npm run test:unit` | **148/148 pass, 0 fail** (inkl. modify, guide-3d-qualitaet, router-2d, livegen, providers, session-library, scoreboard) |

Reports: `dist/build-report.json`, `dist/verify-report.json` (createdAt 2026-10-29T00:17–00:18Z),
`dist/generation-log.json`, `dist/attestation.json` — alle versioniert.

## 2) MEDIA-Liste (Screenshots)

Lokale Pfade (relativ zum Repo-Root). Dateien unter `dist/screenshots/` und
`dist/baseten-migration/` sind per `.gitignore` (`dist/*`) bewusst **nicht versioniert**
und liegen nur lokal; `dist-standalone/proof-*.png` sind versioniert.

### dist/screenshots/ (Slim-Generator-Suite `tests/slim.spec.mjs`, 29.10. 01:08)
- MEDIA: `dist/screenshots/labs.png` (107195 B) — Labs-Nav links, 12 kuratierte Modelle
- MEDIA: `dist/screenshots/generieren.png` (128461 B) — Generieren-Panel (Validierungspfad)
- MEDIA: `dist/screenshots/modify.png` (128442 B) — Modify-Flow
- MEDIA: `dist/screenshots/sprache.png` (123860 B) — Sprache (i18n de/en/es)

### dist-standalone/proof-*.png (versioniert)
- MEDIA: `dist-standalone/proof-si-1-v12.png` (150573 B)
- MEDIA: `dist-standalone/proof-ae-2-v12.png` (124440 B)
- MEDIA: `dist-standalone/proof-free-handbohrmaschine-v12.png` (152537 B)
- MEDIA: `dist-standalone/proof-dup-1-v12.png` (109814 B) — 2D-Lab (SVG, kein Canvas)
- MEDIA: `dist-standalone/proof-slim-modify.png` (122619 B) — Slim-Modify-Beleg
- Begleit-Reports: `dist-standalone/proof-report.json` (ok:true, 0 errors/pageerrors/warnings,
  10 Inits, si-1/ae-2/free-handbohrmaschine 3D + dup-1 2D),
  `dist-standalone/proof-6modelle.json` (6-Modelle-Matrix),
  `dist-standalone/build-standalone-report.json`, `dist-standalone/ledger-muse-calls.md`

### dist/baseten-migration/*.png (lokal, nicht versioniert)
- MEDIA: `dist/baseten-migration/proxy-e2e-baseten.png` (84814 B, sha256 `b0f6b245…`) — Baseten-E2E ok
- MEDIA: `dist/baseten-migration/step1-anbieter-baseten.png` (147749 B) — Anbieter-Dialog Baseten
- Logs lokal: `dist/baseten-migration/e2e-run.log`, `e2e-run2.log`
- Doku (versioniert): `docs/BASETEN-MIGRATION.md`

## 3) Commit-Umfang (geprüft gestagt, NICHT `git add -A`)

- Enthalten: alle getrackten Änderungen (3D-Sanierung, 2D+Router, Baseten-Proxy, Lizenz, Slim-Generator
  `src/shell/ui-modify.js` + `tests/slim.spec.mjs` + `tests-unit/modify.test.mjs`, Direkt-Call+UI,
  i18n, Baselines inkl. neu `chemie-koffein-*`/`free-handbohrmaschine-*`, Docs, Prompts, Skripte),
  Löschungen `src/shell/ui-scoreboard.js`, `src/shell/ui-tasks.js`, `tests/harness.spec.mjs` (Slim),
  neue Proof-Helfer `scripts/_tmp/audit-standalone.mjs`, `scripts/_tmp/proof-standalone-guide.mjs`.
- Bewusst NICHT enthalten: `cache/` (Scratch/Tarballs/Logs), `scripts/_tmp/standalone-v11-basis.html`
  (temporäre v11-Basis-Kopie), `*.log` (per `.gitignore` ignoriert), `dist/screenshots/`,
  `dist/baseten-migration/*.png` (per `.gitignore` lokal).

## 4) Belege einholen

```sh
git -C "C:/Users/flori/OneDrive/modelMuse" log --oneline -5
git -C "C:/Users/flori/OneDrive/modelMuse" show --stat HEAD
git -C "C:/Users/flori/OneDrive/modelMuse" tag --list | tail -5
git -C "C:/Users/flori/OneDrive/modelMuse" status --porcelain=v1 -b
```
