# Proxy vs. Direkt-Call + Bootstrap-UI — Befund & Umsetzung (28.10.2026)

## 1. Wo Proxy noch Pflicht ist, wo Direkt geht

| Pfad | Direkt-Call (Browser → Upstream, BYOK) | Proxy (`scripts/proxy.mjs`, localhost:8787) |
|---|---|---|
| `baseten` (Muse Spark Open) | **Standard**: `POST https://inference.baseten.co/v1/chat/completions` (OpenAI-kompatibel, SSE), Key nur Sitzung. | **Fallback** bei Netz-/CORS-/Timeout-Fehler. `byokOnly` — nie Server-Key. |
| `meta-muse` (Muse Spark 1.3) | **Standard**: `POST https://api.meta.ai/v1/chat/completions` (SSE), Key nur Sitzung. | **Fallback**; ohne User-Key nutzt er den Server-Key (Env/`Key_muse.md`). |
| `openrouter` | Entfernt (inaktiv seit 28.10.2026, `E-GEN-404` + Hinweis) | Entfernt |

- **CORS**: Direkt-Calls senden `Authorization`-Header (Preflight). Antwortet der
  Upstream ohne `Access-Control-Allow-Origin`, wirft der Browser `TypeError` —
  das ist kein Code-Problem, sondern unvermeidbar. Genau dafür existiert der
  automatische Proxy-Fallback (nur bei Transport-Fehler; definitive Antworten
  wie 401/404 fallen **nicht** zurück).
- **Key-Schutz**: Key nie in Code/Logs/Dateien/Repo. Speicher (livegen-Modul) +
  `sessionStorage` **nur mit Zustimmung** (Checkbox, Muster `modelmuse-live-key`
  aus Standalone). `localStorage` nie für Keys. Server-Key (`Key_muse.md`/Env)
  erreicht nur den Proxy-Prozess, nie den Browser.
- **CSP**: `connect-src` in `src/shell/index.html` (→ `dist/lab-player.html`)
  erweitert um `https://api.meta.ai https://inference.baseten.co`; sonst wäre
  jeder Direkt-Call vom Browser geblockt.
- **Transparenz**: `generateLive` liefert `via: 'direct' | 'proxy'`; UI hängt
  „(Direkt-Call)“ / „(Proxy-Fallback)“ an die Statusmeldung. Neuer Code
  `E-GEN-DIREKT` (de/en/es) für „Direkt blockiert + kein Fallback konfiguriert“.

## 2. Wo die Bootstrap-UI geblieben ist

- „Bootstrap“ = **kein Bootstrap-CSS-Framework** im Repo (nie vorhanden; `grep`
  findet nur `frame-bootstrap`/`sandbox-host`-Bezeichner). Gemeint ist die
  **moderne Single-Page-UI aus `dist-standalone/modelmuse-standalone.html`**
  (Vue 3 + Tailwind via CDN, Generator mit **direktem** OpenRouter-Browser-Call,
  `sessionStorage`-Key mit Zustimmung, Onboarding, Suche, Fortschritt,
  Hell/Dunkel-Theme, Footer, 44px-Touch-Ziele).
- **Nicht verloren**: `dist-standalone/` ist versioniert und intakt; die
  `designer-scratch/`-Kette (assemble-v4…v11) war unversioniert und wurde beim
  Parallel-Cleanup entfernt — `scripts/build-standalone.mjs` ersetzt sie als
  versionierter Builder (v12-guide). Kein Builder-Verlust, nur
  veraltete Zwischenstände weg.
- **Zurückgeholt** (ohne CDN/Framework — Single-File- + CSP-sicher, Vanilla-CSS):
  Onboarding-Banner (einmalig, `localStorage`), Labs-Suche mit Zähler,
  Hell/Dunkel-Umschalter (Default dunkel), Footer, 44px-Touch-Mindestgrößen,
  Karten-Radien 14px, Freimodus-Panel mit Direkt-Hinweis + Proxy-nur-Fallback.

## 3. Umsetzung (diese Session, kein Umbau der Architektur)

- `src/runtime/livegen.js`: `DIRECT_BASES`/`DIRECT_DEFAULT_MODEL`/`directChatUrl`,
  `configureLiveGen({direct})`, `generateDirect` + gemeinsames `finishModule`,
  3-stufig: Direkt (mit Key) → Proxy-Fallback (nur Transport-Fehler) →
  `E-GEN-OFFLINE`/`E-GEN-DIREKT`. `modify`-Pfad nutzt denselben Fluss.
- `src/shell/ui-livegen.js`/`ui-modify.js`: Session-Key-Restore, Proxy-Feld
  optional (leer = nur Direkt), `via`-Anzeige.
- `src/runtime/providers.js`: Baseten-Text auf Direkt-zuerst umgestellt (BYOK bleibt).
- `src/shell/{index.html,main.js,theme.css,i18n/*.json}`: UI-Teil 6 (s. §2) + CSP.
- `scripts/build.mjs`: `main.js`-Budget 18000 → 21000 (livegen/ui-livegen-Marge
  hatte die Parallel-Session bereits vorgesehen: 19500/17500).
- Tests: 7 neue Direkt-Fälle in `tests-unit/livegen.test.mjs` (Mapping,
  Direkt-Erfolg, Fallback, E-GEN-DIREKT, 401 ohne Fallback, Server-Key-Pfad,
  Provider-Defaults im Proxy-Body); i18n-Parität de/en/es bleibt Pflicht.

## 4. Belege (28.10.2026, diese Session)

- `npm run test:unit` → **148/148 grün**
- `npm run build` → OK (`hash=69155f1d…`), `npm run render` → OK (996825 B)
- `npm run verify:all` → **12 Modelle, alle gelb**
- `npx playwright test` (voll, `npm test`) → **46 passed** (inkl. slim/layout/i18n-ui;
  Screenshots u. a. `dist/screenshots/{labs,generieren,modify,sprache}.png`)
