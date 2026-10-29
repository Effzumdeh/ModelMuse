# Ablagekonvention (O-15, ab 27.10.2026)

## Regel
- Diagnose-/Tmp-Skripte (`*-tmp.mjs`, `probe-*`, `diag-*`, `e2e-debug-*`, `_*.mjs`-Helfer): nach `scripts/_tmp/`.
- Logs (`*.log`): nach `dist/logs/`.
- Roh-Outputs (`*.raw.txt`, `*.err.txt`, `*-prev-backup.js`, `diag-*.json` ohne Audit-Status): nach `dist/raw/`.
- Neue Diagnose-Dateien folgen der Regel ab sofort, direkt am richtigen Ort anlegen.

## Versioniert vs. lokal (.gitignore)
- Versioniert: `dist/baselines/`, `dist/generation-log.json`, `dist/verify-report.json`, `dist/build-report.json`, `dist/attestation.json`, `dist/BACKLOGFIX-REPORT.md`.
- Lokal (ignoriert): `*-tmp.mjs`, `*-tmp.js`, `*.log`, sonstiges unter `dist/*`.
- `scripts/_tmp/`, `dist/logs/`, `dist/raw/` bleiben lokal; je ein `.gitkeep` haelt den Ordner.

## Referenzen
- Code-wirksame Referenzen (`package.json`-Scripts, `scripts/*.mjs`) werden vor jedem Move per grep geprueft; nichts Verschobenes darf dort per Pfad referenziert sein.
- `prompts/*.txt` und Docs sind historische Auftraege und werden NICHT umgeschrieben.

## Standalone-Build (dist-standalone/, Stand v12-guide ab 28.10.2026)
- Builder (einziger Schreibweg): `node scripts/build-standalone.mjs` (versioniert).
  Hebt `dist-standalone/skillspark-standalone.html` deterministisch auf Guide-Stand
  (`docs/implementation-guide-3d-qualitaet.md` Abschnitte 2-3: PCFShadowMap, IBL-Raum,
  4-Lichter, DPR-Cap, Negativ-Liste, F3). Guards sichern die v11-Basis
  (Titel v10 + v11-Framing); Zweitlauf bricht ab. Report:
  `dist-standalone/build-standalone-report.json`.
- Abgrenzung Haupt-Build: `scripts/build.mjs` baut `dist/lab-player.html` aus `src/`
  (Shell/Runtime/Models/Vendor). Standalone ist davon unabhaengig: muse-generierte
  Single-Page (Importmap-CDN `three@0.186.1`, 10 Labs), kein `src/`-Artefakt.
- Historie: Kette `designer-scratch/assemble-v4..v11.mjs` (unversioniert) ist entfallen
  (Parallel-Cleanup 28.10.2026, mitten im Task; Builder-Weg vorab per Ledger +
  Live-Sichtung von `assemble-v11.mjs` identifiziert); ersetzt durch obigen Builder.
  In diesem Task wurden KEINE Designer-Backups geloescht (weder angefasst noch
  wiederhergestellt; `dist-standalone/`-Dateien unangetastet ausser Builder-Output).
- Belege: `dist-standalone/proof-report.json` + `proof-*-v12.png`
  (Erzeuger: `scripts/_tmp/proof-standalone-guide.mjs` — 0 pageerrors, 0 console-errors,
  0 THREE-Warnungen, 3D-Modus je Lab verifiziert).
- `dist-standalone/` bleibt vollstaendig untracked (Einzeldatei-Distribution).
