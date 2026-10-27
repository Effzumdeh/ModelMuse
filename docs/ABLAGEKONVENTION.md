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
