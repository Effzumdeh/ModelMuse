# Baseten-Migration (28.10.2026)

OpenRouter-Pfad entfernt, Baseten Model APIs als Laufzeit-Standard.
Meta-Regel eingehalten: Laufzeit nur Meta-Modelle (`meta-models/muse-spark-open-1026`).

## 1. Config (aus Session-Vorgabe + Baseten-Docs)

| Punkt | Wert |
|---|---|
| base_url | `https://inference.baseten.co/v1` |
| Route | `POST /v1/chat/completions` (OpenAI-kompatibel, SSE) |
| Modell | `meta-models/muse-spark-open-1026` (Registry-ID: `muse-spark-open-1026`) |
| Auth | `Authorization: Bearer $BASETEN_API_KEY` (Doku: `https://docs.baseten.co/inference/model-apis/overview`, `https://docs.baseten.co/reference/inference-api/chat-completions`) |
| Key-Regel | AUSSCHLIESSLICH laufzeitsseitig per BYOK (Browser-Eingabe, nur Sitzung/sessionStorage mit Zustimmung). Nie Server-Key-Fallback fuer Baseten, nie in Code/Logs/Chat/Dateien/Repo. |
| Default | Unveraendert `meta-muse/muse-spark-1.3-contributor` (Proxy-Default; Baseten nur explizit + BYOK). |

## 2. Geaenderte Dateien

| Datei | Aenderung |
|---|---|
| `scripts/proxy.mjs` | `PROVIDERS.baseten` (base `https://inference.baseten.co/v1`, 1 Modell, `byokOnly`), `OPENROUTER_BASE` entfernt (`BASETEN_BASE` neu), Legacy-`openrouter` → E-GEN-404 mit Migrationshinweis, OpenRouter-Attributionsheader entfernt, BYOK-Fehlermeldung auf Baseten-Key |
| `src/data/providers.json` | `openrouter`-Eintrag → `baseten`-Eintrag (Modell `muse-spark-open-1026` → `meta-models/muse-spark-open-1026`, Baseten-Docs verlinkt), `version` 1 → 2 |
| `src/runtime/providers.js` | Kommentare + `recommendModel`-Gruende + `generationTarget`-Proxytext auf Baseten |
| `src/shell/ui-providers.js`, `src/runtime/livegen.js`, `src/shell/ui-livegen.js` | Pfad-Kommentare OpenRouter → Baseten |
| `src/shell/i18n/{de,en,es}.json` | `anbieter.proxyUrl` → Baseten-Wortlaut |
| `tests-unit/providers.test.mjs`, `proxy.test.mjs`, `scoreboard.test.mjs`, `session-library.test.mjs` | Baseten-Assertions; Legacy-`openrouter` → E-GEN-404-Test; `BASETEN_API_KEY`-Env |
| `tests/harness.spec.mjs`, `tests/i18n-ui.spec.mjs` | Anbieterwahl-Assertions auf `baseten`/`muse-spark-open-1026` |
| `scripts/proxy-e2e-baseten.mjs` | NEU: echter Browser-Generierungsbeleg via Baseten (Quelle `browser-e2e-baseten`) |
| `scripts/proxy-e2e-openrouter.mjs` | INAKTIV (Header + `process.exit(3)`, Historie bleibt) |
| `scripts/chemie-e2e.mjs` | Zweitpfad `openrouter` → `baseten` (Key per `BASETEN_API_KEY`-Env); Pfadname `openrouter` → ehrlicher Abbruch |
| `README.md`, `docs/NEXT-STEPS.md`, `docs/skillspark-v8-spec.md` | Pfad-Erwahnungen auf Baseten umgestellt / als inaktiv markiert |

## 3. OpenRouter-Inaktiv-Doku

- Proxy: `parseGenerateBody({provider:'openrouter',...})` → `E-GEN-404` mit Hinweis auf `baseten` (kein Upstream-Call).
- Registry: kein `openrouter`-Eintrag mehr (`getProvider` → `null`, Unit-Test pinnt das).
- Skripte: `proxy-e2e-openrouter.mjs` bricht mit Exit 3 ab; `chemie-e2e.mjs` mit Pfad `openrouter` ebenfalls.

## 4. Testbelege (ohne Key, ohne Netz)

- `npm run test:unit`: 135/135 gruen (28.10.2026, inkl. neuer Baseten-Tests).
- `npm run build`: OK (nach Migration).
- `npm run verify:all`: OK (12 Modelle, alle gelb).
- Proxy-Funktionsprobe (localhost, ohne Key): `/health` → `providers: ["meta-muse","baseten"]`; Baseten-Body valide; `openrouter` → E-GEN-404; Baseten ohne BYOK → E-GEN-CONFIG.
- Browser-Rauchprobe (Schritt 1): Anbieter-Dropdown `["Meta Muse","Baseten (eigener Key, Muse Spark Open)"]`, Modell `muse-spark-open-1026`, Meta-Modell-/BYOK-Badges, keine Page-Errors — Screenshot `dist/baseten-migration/step1-anbieter-baseten.png`.

## 5. Echter Generierungsbeleg (Baseten, BYOK)

- Skript: `BASETEN_API_KEY=... node scripts/proxy-e2e-baseten.mjs Handbohrmaschine`
- Transport: Browser → `http://127.0.0.1:8787/generate` (BYOK User-Sitzung) → `https://inference.baseten.co/v1/chat/completions` (SSE), Modell `meta-models/muse-spark-open-1026`.
- Screenshot: `dist/baseten-migration/proxy-e2e-baseten.png` (Key-Feld `type=password`, kein Key sichtbar).
- Generation-Log: `dist/generation-log.json`, Eintrag `quelle: browser-e2e-baseten` (genau EIN Auftrag; nur Metadaten + Status-Head, kein Key-Material).
- Ergebnis: siehe Abschnitt 6.

## 6. Ergebnis des E2E-Laufs

- Versuch 1 (`Handbohrmaschine`, 28.10.2026): Transport OK (SSE-Modul vom Modell
  extrahiert), aber Boot-Fail `E-S2-BOOT: ... does not provide an export named
  'ConeGeometry'` — das Modell importiert `ConeGeometry`, das im Vendor-Bundle
  (`src/vendor/three.entry.js`) nicht exportiert ist und nicht in der
  `repairThreeImports`-Map steht. Bundle-/Repair-Luecke (Fremd-Baustelle,
  ausserhalb dieser Migration), kein Transportproblem. Log: `e2e-run.log`.
- Versuch 2 (`Buecherregal`, 28.10.2026, 80 s): VOLLTREFFER.
  Status: `"Buecherregal" geladen: 6 Labels, 1 Messungen, 3 Aufgaben.`
  Verify: S1 gruene (imports/shape/size), S2 first-frame pass, S5 vorhanden,
  kein Rot. Screenshot-SHA256 `b0f6b245cc4311ac...` (84814 Bytes),
  Generation-Log-Eintrag `browser-e2e-baseten` (genau 1, kein Key-Material).
  Screenshot zeigt 3D-Regal + S5-`pass`-Zeile, Key-Feld maskiert.

## 7. Bekannte Fremd-Baustelle (nicht Scope dieser Migration)

- `tests/i18n-ui.spec.mjs` (4 Tests) wartet auf `#lab-mount iframe` in `dist/lab-player.html`; das Single-File-Artefakt erzeugt derzeit keinen Modell-iframe (auch nach frischem `npm run render`, keine Console-/Page-Errors, WebGL2 ok). Alle 4 Tests scheitern identisch in `gotoPlayer` — auch die 3 von dieser Migration unberuehrten. Boot-/Player-Dateien (`main.js`, `player.js`, `sandbox-host.js`) sind von parallelen Arbeiten betroffen, nicht von dieser Migration (keine meiner Dateien liegt auf dem iframe-Pfad; Nachweis: `git diff --name-only`). `tests/harness.spec.mjs` Teil 1 (gleiche Anbieter-UI via `/`) ist gruen.
