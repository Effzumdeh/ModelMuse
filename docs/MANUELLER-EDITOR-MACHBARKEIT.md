# Manueller Online-Editor: Machbarkeit (Standalone v14, kein Einbau)

Stand: 2026-10-29. Basis: `dist-standalone/modelmuse-standalone.html`
(362.894 Bytes, ~354 KB, Limit 600 KB per V8-Invariante ⇒ ~240 KB Reserve).
Kein Backend (GitHub-Pages), Verify-Gates S1/S2, BYOK per sessionStorage.

## 1. Empfohlener Ansatz: eigenes Textfeld + Live-Preview + Verify

- `<textarea>` (oder contenteditable-light) + Button „Prüfen & Vorschau".
- Pipeline wiederverwenden, nichts Neues erfinden:
  1. `staticGate(code)` aus `src/runtime/guard-static.js` (S1).
  2. Bei OK: `registerFree`/`loadLab`-Pfad in Sandbox-Preview
     (`iframe sandbox=allow-scripts`, `frame-bootstrap.js`).
  3. S2/Budget-Feedback (`guard-runtime.js`, `budget.js`) anzeigen.
- Syntax-Highlight optional via <5 KB Regex-Highlighter (kein Vendor).
- Groesse: ~8–15 KB HTML+JS. Passt locker in Reserve.
- Offline-faehig, keine CDN-Abhaengigkeit, gleiche Datei-Philosophie wie V1-IIFE.

## 2. Verworfen: CodeMirror / Monaco-lite

| Option | Gewicht (inline, kein CDN) | Urteil |
|---|---|---|
| CodeMirror 6 (minimal, JS-Mode) | ~150–350 KB min | frisst Reserve,I'll-Bezug fraglich |
| CodeMirror 5 (legacy) | ~150–250 KB | veraltet, Mobil-UX schwach |
| Monaco (-lite/AMD) | ~1–2 MB+, WASM/Worker | klar ueber Limit, CSP/Worker-Konflikt (`worker-src none`), kein GitHub-Pages-Single-File |

- Zusaetzlich: Editor-Vendor muesste wie V1 als IIFE ohne `</script>`/Import
  eingebettet werden — bei Monaco praktisch nicht machbar.
- Fazit: Komfortgewinn (Zeilen-Nr., Folding) rechtfertigt weder Gewicht
  noch Wartungslast. Wenn Highlight noetig: spaeter CodeMirror-6-minimal
  als optionales `dist-standalone`-Profil, nicht im Default.

## 3. Sandbox-Sicherheit (S1-Verbote gelten auch fuer Editor-Code)

- S1-Tokenliste (`guard-static.js`): `eval`, `Function`, `fetch`,
  `XMLHttpRequest`, `WebSocket`, `document`, `window`, `parent`, `top`,
  `localStorage`, `sessionStorage`, `indexedDB`, `sendBeacon`, `navigator`.
- Editor-Code MUSS durch `staticGate` (inkl. Import-Allowlist:
  nur `three`, `wrapper-helpers`, `2d-*`, `OrbitControls`-Addon;
  kein dynamisches `import()`, keine URLs/relativen Pfade).
- Preview nur im bestehenden Sandbox-`iframe`
  (`allow-scripts` ohne `allow-same-origin`; CSP `connect-src none`,
  `worker-src none`). Editor-Host und Modell-Code strikt trennen:
  Editieren ausserhalb, Rendern nur innerhalb des Frames.
- Editor selbst darf `document`/`localStorage` nutzen (Host-UI),
  Nutzer-Modellcode nie — Gate vor jedem Render erzwingen, Fehler als
  `E-S1-*`/`E-S2-*` anzeigen, nie still ausfuehren.

## 4. Persistenz (BYOK-Regel uebertragen)

- Default: nur Arbeitsspeicher + `sessionStorage` (Tab-Sitzung),
  erst nach Consent-Checkbox — analog BYOK (`livegen.js`, `providers.js`).
- Modellcode ≠ Key: Code-Drafts duerfen bei explizitem Opt-in nach
  `localStorage` (Muster `main.js`: Bibliothek dauerhaft merken) —
  Keys niemals dorthin, niemals in Logs/Dateien/Exporte.
- Export/Import: Datei-Download (`Blob`, `.mjs`/`.json` mit `meta`+`code`)
  und Datei-Upload; quota-sicher (try/catch, `E-BUDGET`-artige Meldung).
- Kontra `localStorage`-Default: 5-MB-Quota, Schueler-Endgeraete geteilt —
  deshalb Session-Default + sichtbarer „Verwerfen"-Hinweis.

## 5. Undo / Reset (klein halten)

- Undo: In-Memory-Stack (z. B. 50 Schritte, debounced 500 ms), Strg+Z/
  Buttons pro Editor-Instanz; keinverify pro Zwischenschritt (nur on-demand).
- Reset: eingebetteter Original-Payload (`META`/`diagram2d` je Demo, V2/V5)
  neu laden = garantierter Ausgangszustand; „Auf Original zuruecksetzen"
  mit Confirm. Kein Server-Roundtrip noetig.

## 6. Aufwand / Nutzen

- Eigenes Textfeld: ~0,5–1 Tag (UI ~150 Zeilen, Gate-Anbindung existiert,
  Preview-Frame existiert, Tests in `tests-unit/modify.test.mjs`-Naehe).
- CodeMirror-Integration: ~2–4 Tage + Dauer-Wartung + Gewichtsrisiko.
- Nutzen: Nutzer-Anpassungen (Farben, Labels, Masse, 2D-Daten) ohne Build —
  passt zu Modify-/RegisterFree-Pfad (V7). Risiko: S1-Umgehungsversuche
  per Editor — durch Gate-Zwang beherrschbar.
- Empfehlung: **Eigenes Textfeld + Live-Preview + Verify umsetzen**,
  CodeMirror/Monaco **nicht** einbauen. Naechster Schritt (falls gewuenscht):
  Spec `docs/MANUELLER-EDITOR-SPEC.md` (UI-Wireframe, API, Fehlermatrix).
