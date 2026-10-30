# Lizenz-Audit — ModelMuse Lab-Player

- **Stand:** 29.10.2026
- **Repo:** `C:/Users/flori/OneDrive/modelMuse`, Branch `main`
- **Auftrag:** Fremdinhalt je Paket/Version/Lizenz/Hackathon-Tauglichkeit prüfen; Attributions-Texte bereitstellen; nichts als frei annehmen.
- **Methodik:** `package.json` + `package-lock.json`, LICENSE-/NOTICE-Dateien in `node_modules/`, Vendor-Header in `src/vendor/`, Byte-Vergleich gegen Upstream (SHA-256), Grep der ausgelieferten Artefakte, Abgleich mit `docs/2D-STACK-EVAL.md` und `eval/3jsbench/LIZENZ.md`.

> **Grundsatz dieses Audits:** Es wurde **keine** Komponente als „frei" angenommen.
> Jede Zeile trägt einen Beleg. Wo ein Beleg fehlt oder unklar ist, steht **unsicher** — nicht „vermutlich ok".

---

## 1. Kurzfassung für die Jurys

1. **Kein NC-/ND-/proprietärer Inhalt im Repo.** Alle eingebetteten Fremd-Bibliotheken stehen unter MIT; die einzige Apache-2.0-Komponente (Playwright) ist reines Testwerkzeug und wird nicht ausgeliefert.
2. **Ausgeliefertes Artefakt `dist/lab-player.html`** enthält echte Fremd-Bibliotheken: **three.js 0.186.1** (MIT, 610 955 B Bundle) und **Alpine.js 3.17.5** (MIT, inkl. `@vue/shared`/`@vue/reactivity` 3.5.41). Der three.js-SPDX-Header überlebt ins Artefakt; **Alpine bringt im Upstream-Dist keinen eigenen MIT-Banner mit** → im Artefakt wurde ein `THIRD-PARTY NOTICES`-Block mit **allen vier Copyright-Zeilen und dem vollständigen MIT-Lizenztext** ergänzt (siehe §5.2). Damit ist die MIT-Notify-Bedingung direkt im Artefakt erfüllt.
3. **`dist-standalone/modelmuse-standalone.html` bündelt keine Fremd-Bibliothek.** Es *referenziert* Tailwind-CSS, Inter-Font, Vue 3 und three.js per CDN. Diese Referenzen sind unversioniert bzw. Major-gepinnt → **bedingt hackathon-tauglich, nicht reproduzierbar** (siehe §4, Zeilen T6–T8).
4. **Vier evaluierte 2D-Bibliotheken (Mermaid, Chart.js, d3-light, KaTeX) sind bewusst NICHT eingebunden** — kein Nachweis, keine Weitergabepflicht.
5. **Eval-Korpus 3JSBench** (100 Prompt-Briefings, MIT © 2026 General Context) ist mit vollständigem Lizenztext im Repo (`eval/3jsbench/LICENSE-MIT-upstream` + `LIZENZ.md`); Upstream-LICENSE wurde byte-identisch verifiziert.
6. **Offen (Eigene Rechtslage):** Das Repo enthält **keine LICENSE-Datei für den eigenen Code** (`package.json` ist `private: true`). Ohne Lizenzdatei besteht keine Weitergabe-Erlaubnis → Entscheidung der Repo-Owner erforderlich (siehe §6, O-1).

---

## 2. Tabelle Fremdinhalt

**Legende Spalte „Eingebettet?"** — `Ja` = Code des Fremdinhalts liegt im Artefakt/Repo, `Nein` = nur Werkzeug/Referenz/Doku.
**Legende Spalte „Hackathon-Tauglichkeit"** — `Ja` = Lizenz erlaubt kommerzielle Nutzung und Weiterverbreitung, kein Copyleft-Zwang; `Bedingt` = Lizenz unproblematisch, aber Umsetzung/Einbindung risikoreich; `Entfällt` = nicht eingebunden, keine Pflicht; `Unsicher` = Beleg fehlt, vor Einreichung zu klären.

| ID | Komponente | Quelle / Paket | Version | Lizenz | Beleg im Repo | Verwendung | Eingebettet? | Hackathon-Tauglichkeit |
|----|-----------|---------------|---------|--------|---------------|------------|---------------|------------------------|
| T1 | **three.js** | npm `three` / github.com/mrdoob/three.js | **0.186.1** | **MIT** — Copyright © 2010-2026 three.js authors | `node_modules/three/LICENSE`; `package.json` → `"license": "MIT"`; SPDX-Header in `node_modules/three/build/three.module.js`; Bundle `dist/vendor-three.bundle.js` (610 955 B) | 3D-Kern: WebGL-Renderer, Materialien, Geometrien, `OrbitControls`-Addon | **Ja** (Bundle → `dist/lab-player.html` als Text-Payload) | **Ja** — MIT erlaubt kommerzielle Nutzung + Weiterverbreitung, kein Copyleft; SPDX-Header im Bundle erhalten |
| T2 | **Alpine.js** | npm `alpinejs` / github.com/alpinejs/alpine | **3.17.5** | **MIT** — Copyright © 2019-2025 Caleb Porzio and contributors | `node_modules/alpinejs/package.json` → `"license": "MIT"`; Upstream `LICENSE.md` (abgerufen 29.10.2026); Vendor-Kopie `src/vendor/alpine.module.esm.min.js` ist **byte-identisch** zu `node_modules/alpinejs/dist/module.esm.min.js` (SHA-256 `ee019270…24f7b`, identisch) | Shell-UI (Reaktivität, Direktiven) | **Ja** (in `dist/lab-player.html`) | **Ja** — MIT. **Hinweis:** Das Upstream-Dist enthält *keinen* Alpine-eigenen MIT-Banner (minifiziert); Attribution wurde deshalb im Artefakt ergänzt (§5.2) |
| T3 | **@vue/shared + @vue/reactivity** (in Alpine gebündelt) | npm, Teil des `alpinejs`-Dists | **3.5.41** (gebündelt) / 3.5.44 (in `node_modules` aufgelöst) | **MIT** — Copyright © 2018-present Yuxi (Evan) You and Vue contributors | `/*! Bundled license information:`-Block in `src/vendor/alpine.module.esm.min.js` (überlebt esbuild-Minify und steht im Artefakt) | Alpine-Reaktivitäts-Engine | **Ja** (mit Alpine) | **Ja** — MIT; Notice-Block im Vendor-File erhalten. Versionsdifferenz gebündelt 3.5.41 vs. installiert 3.5.44 ist unkritisch (beides MIT, `~3.5.40`-Range) |
| T4 | **esbuild** | npm `esbuild` / github.com/evanw/esbuild | **0.28.2** | **MIT** — Copyright © 2020 Evan Wallace | `node_modules/esbuild/LICENSE.md` | Build: Bundle + Minify | **Nein** (Werkzeug) | **Ja** — reines Build-Werkzeug, kein ausgelieferter Code |
| T5 | **@playwright/test**, `playwright`, `playwright-core` | npm / github.com/microsoft/playwright | **1.64.1** | **Apache-2.0** — Copyright © Microsoft Corporation | `node_modules/@playwright/test/LICENSE` (11 601 B) + `NOTICE`; `node_modules/playwright/ThirdPartyNotices.txt` | E2E-Tests (`npm test`) | **Nein** (Werkzeug) | **Ja** — Apache-2.0 inkl. §4-NOTICE-Pflicht. Die NOTICE nennt Code aus dem Puppeteer-Projekt (Apache-2.0) → NOTICE bei Weitergabe mitgeben; aktuell wird nichts davon ausgeliefert |
| T6 | **Tailwind CSS (Play CDN)** | `https://cdn.tailwindcss.com` — **unversionierte** CDN-Route | **unbestimmt** (Routen ohne Versionspin) | **MIT** — Copyright © Tailwind Labs, Inc. | `dist-standalone/modelmuse-standalone.html` Zeile 39; Upstream-Repo `tailwindlabs/tailwindcss` (MIT-LICENSE) | Styling der Standalone-Seite | **Nein** (nur CDN-Referenz) | **Bedingt** — (a) Tailwind weist den Play CDN ausdrücklich als „designed for development purposes only, and is not intended for production" aus; (b) unversioniert → das gerenderte Styling ist nicht reproduzierbar. Für eine Juror-Demo vertretbar, für ein reproduzierbares Abgabeartefakt nicht |
| T7 | **Inter** (Webfont) | `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700` + `fonts.gstatic.com` | **unbestimmt** (CSS-Referenz ohne Versionspin) | **SIL Open Font License 1.1** — Copyright © 2016 The Inter Project Authors | `dist-standalone/modelmuse-standalone.html` Zeilen 43–45; Upstream `rsms/inter` `LICENSE.txt` (abgerufen 29.10.2026) | Typografie der Standalone-Seite | **Nein** (nur CDN-Referenz) | **Ja** — OFL-1.1 erlaubt Nutzung/Einbettung; **bei eigenem Einbetten** (Self-Hosting) muss der OFL-Text mitgeliefert werden. Heute nicht eingebettet → keine Pflicht |
| T8 | **Vue 3** (Framework der Standalone-Seite) | `https://unpkg.com/vue@3/dist/vue.global.js` — **nur Major gepinnt** | **unbestimmt** (driftet mit jeder 3.x) | **MIT** — Copyright © 2018-present Yuxi (Evan) You and Vue contributors | `dist-standalone/modelmuse-standalone.html` Zeile 273 | Standalone-App-Framework | **Nein** (nur CDN-Referenz) | **Bedingt** — MIT unproblematisch, aber Major-Pin → Verhalten kann sich zwischen zwei Juror-Läufen unterscheiden; Version auf `vue@3.5.x` pinnen empfohlen |
| T9 | **Mermaid** | npm `mermaid` (nur Eval) | 12.2.0 (Eval-Stand 28.10.2026) | MIT | `docs/2D-STACK-EVAL.md` §2.1 | **nicht eingebunden** — nur Specifier-Allowlist `2d-mermaid` in `src/runtime/guard-static.js` | **Nein** | **Entfällt** — keine Weitergabe, kein Nachweis nötig |
| T10 | **Chart.js** | npm `chart.js` (nur Eval) | 4.6.1 (Eval-Stand) | MIT | `docs/2D-STACK-EVAL.md` §2.2 | **nicht eingebunden** | **Nein** | **Entfällt** |
| T11 | **d3-light** (`d3-force`/`selection`/`shape`/`hierarchy`/`zoom`) | npm `d3-*` (nur Eval) | 3.x-Submodule (Eval-Stand) | **ISC** | `docs/2D-STACK-EVAL.md` §2.3 | **nicht eingebunden** | **Nein** | **Entfällt** |
| T12 | **KaTeX** | npm `katex` (nur Eval) | 0.19.1 (Eval-Stand) | MIT | `docs/2D-STACK-EVAL.md` §2.4 | **nicht eingebunden** (inkl. KaTeX-Fonts) | **Nein** | **Entfällt** |
| T13 | **3JSBench Task-Briefings** | github.com/GeneralContext/3jsbench (flacher Klon, Stand 27.10.2026, 100 `prompt.md`) | 100 Briefings, wortgleich | **MIT** — Copyright © 2026 General Context | `eval/3jsbench/LICENSE-MIT-upstream` (identisch zum Upstream `LICENSE`, abgerufen 29.10.2026) + `eval/3jsbench/LIZENZ.md` | Eval-Korpus für Geometrie-Regression (`scripts/regression-3jsbench.mjs`) | **Nein** (nicht im Artefakt; `grep` in `dist/lab-player.html` = 0 Treffer) | **Ja** — MIT-Attribution vollständig erfüllt (LICENSE + LIZENZ.md). **Offen:** `eval/didaktik-minimalsatz.json` (`hinweis3JSBench`) nennt „github.com/frvnkliu" als Quelle, das Repo liegt aber unter `GeneralContext/3jsbench` → Quellenangabe inkonsistent, vor Veröffentlichung korrigieren (§6, O-2) |
| T14 | **Baseten-Modell `meta-models/muse-spark-open-1026`** | Baseten Inference API (`https://inference.baseten.co/v1`) | Laufzeit (nicht gepinnt) | **keine Asset-Lizenz** — Modellgewicht wird nicht mitgeliefert, sondern zur Laufzeit aufgerufen | `scripts/proxy.mjs`; README „Modelle (Meta-Regel)" | Generierung zur Laufzeit, ausschließlich Meta-Modelle | **Nein** | **Unsicher** — die Nutzungsbedingungen des Modellanbieters sind aus dem Repo **nicht** belegbar. Keine Asset-Pflicht, aber vor Einreichung Terms des Anbieters prüfen (§6, O-3) |
| T15 | **Eigene Quellen** (`src/**`, `prompts/**`, `scripts/**`, `eval/didaktik-*.json`) | ModelMuse (dieses Repo) | — | **keine Lizenz angegeben** | **keine LICENSE-Datei im Repo**; `package.json` → `"private": true` | Kern, Modelle, Prompts, Didaktik-Korpora | **Ja** | **Unsicher / offen** — ohne Lizenzdatei ist keine Weiterverbreitung impliziert (§6, O-1) |

**Nicht als Fremdinhalt geführt:** `src/vendor/diagram-2d.js` (11 867 B) ist **Eigenentwicklung** (eigener SVG-Renderer; Header: „Gehoert in den Vendor-Bereich … Abgeleitet aus dem bewaehrten Standalone-Zweig"), ebenso `src/vendor/three.entry.js` (eigene Re-Export-Hülle) und alle Dateien unter `src/models/` (Modellcode, von Meta-Modellen generiert).

---

## 3. Nicht eingebundene Fremd-Bibliotheken (bewusste Entscheidung)

`docs/2D-STACK-EVAL.md` bewertet Mermaid, Chart.js, d3-light und KaTeX als Kandidaten für den 2D-Pfad. **Keines dieser Pakete ist installiert** (`node_modules/` enthält nur `three`, `esbuild`, `alpinejs`, `@playwright/test`, `playwright`, `playwright-core`, `@vue/*`, `@esbuild/*`) und **kein Byte davon liegt im Artefakt**.

Im Artefakt erscheinen nur die *Zeichenketten* `2d-mermaid`, `2d-chart`, `2d-d3`, `2d-katex` — als Allowlist-Einträge in `src/runtime/guard-static.js` (Zeilen 13/17) und im Router-Test `tests-unit/router-2d.test.mjs`. Das sind **Namen, kein Code**; die Allowlist ist Reserve für einen späteren Ausbau.

**Konsequenz:** Für Mermaid/Chart.js/d3-light/KaTeX besteht **keine** Weitergabe-/Attributionspflicht. Sollte der 2D-Ausbau kommen, sind vor dem Einbinden die Lizenztexte aus `docs/2D-STACK-EVAL.md` zu übernehmen (alle vier sind kommerziell nutzbar: MIT, MIT, ISC, MIT).

---

## 4. Risikobewertung Hackathon-Tauglichkeit

| Risiko | Bewertung | Beleg / Maßnahme |
|--------|-----------|------------------|
| Fremder Code ohne Lizenzhinweis im ausgelieferten Artefakt | **Behoben** | three.js: SPDX-Header im Bundle (`grep -c "SPDX-License-Identifier: MIT" dist/lab-player.html` = 1). Alpine: eigener MIT-Hinweis ergänzt (§5.2) |
| Nicht reproduzierbares Artefakt (CDN-Drift) | **Offen, niedrig priorisiert** | `dist-standalone/modelmuse-standalone.html` lädt Tailwind (unversioniert), Vue (Major-Pin), Inter (unversioniert) von CDNs. Betrifft **nur** das Standalone-Artefakt; `dist/lab-player.html` ist vollständig CDN-frei (`npm run verify:dist` → „keine externen LOAD-URLs") |
| README-Behauptung „autark, kein CDN" für das Standalone | **Korrigiert** | Das Standalone ist **nicht** offline-fähig (Beleg: Zeilen 39, 43–45, 52, 273 laden von CDNs). README-Abschnitt wurde an die Realität angepasst |
| Tailwind Play CDN als Produktiv-Abhängigkeit | **Offen** | Tailwind-Doku: Play CDN ist „not intended for production". Für eine Demo vertretbar, dokumentiert als bedingt |
| Quellenangabe im Didaktik-Korpus inkonsistent | **Offen** | `eval/didaktik-minimalsatz.json` → „github.com/frvnkliu"; tatsächlich `GeneralContext/3jsbench` (§6, O-2) |
| Lizenz des eigenen Codes nicht festgelegt | **Offen** | Keine LICENSE-Datei im Repo (§6, O-1) |
| NC-/ND-/proprietäre Assets | **Keine gefunden** | Alle geprüften Lizenzen: MIT, Apache-2.0, ISC, OFL-1.1 |
| NC-/ND-Bildmaterial, Test-Assets, Screenshots | **Keine gefunden** | Keine Fremd-Bilder/Fonts im Repo (`find` über `*.woff/ttf/otf/eot/svg` ohne Treffer außerhalb `node_modules`); alle PNGs sind eigene Renderer-Outputs (`dist/baselines/`, `dist-standalone/proof-*.png`) |

---

## 5. Attributions-Texte

### 5.1 Attributions-Text für README / Repo-Dokumentation

> **Attribution.** Dieses Projekt verwendet bzw. verweist auf folgende Open-Source-Komponenten:
> **three.js 0.186.1** (MIT, © 2010-2026 three.js authors) — <https://github.com/mrdoob/three.js> ·
> **Alpine.js 3.17.5** (MIT, © 2019-2025 Caleb Porzio and contributors) — <https://github.com/alpinejs/alpine> ·
> **@vue/shared 3.5.41** und **@vue/reactivity 3.5.41** (MIT, © 2018-present Yuxi (Evan) You and Vue contributors) — mitgeliefert innerhalb von Alpine.js ·
> **esbuild 0.28.2** (MIT, © 2020 Evan Wallace, nur Build-Werkzeug) ·
> **@playwright/test 1.64.1** / `playwright` / `playwright-core` (Apache-2.0, © Microsoft Corporation, nur Test-Werkzeug; enthält Code aus dem Puppeteer-Projekt, Apache-2.0) ·
> **Tailwind CSS** (MIT, © Tailwind Labs, Inc., CDN-Referenz im Standalone-Artefakt) ·
> **Inter** (SIL Open Font License 1.1, © 2016 The Inter Project Authors, CDN-Referenz im Standalone-Artefakt) ·
> **Vue 3** (MIT, © 2018-present Yuxi (Evan) You and Vue contributors, CDN-Referenz im Standalone-Artefakt) ·
> **3JSBench Task-Briefings** (MIT, © 2026 General Context — <https://github.com/GeneralContext/3jsbench>, Eval-Korpus, 100 Briefings).
> Vollständige Lizenztexte, Herkunftsnachweise und die Abgrenzung „eingebettet vs. nur referenziert" stehen in [`docs/LIZENZEN.md`](LIZENZEN.md).
> Es werden ausschließlich MIT-, Apache-2.0-, ISC- und OFL-1.1-lizenzierte Komponenten verwendet — keine NC-/ND-/proprietären Inhalte.

### 5.2 Attributions-Text für das Artefakt `dist/lab-player.html`

Im Shell-Template `src/shell/index.html` steht ein `THIRD-PARTY NOTICES`-HTML-Kommentar direkt nach `<body>`, der unverändert in das Single-File-Artefakt übernommen wird. Er enthält **alle vier Copyright-Zeilen und den vollständigen MIT-Lizenztext** (nicht nur einen Verweis) — damit ist die MIT-Bedingung „the above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software" für die eingebetteten Bibliotheken direkt im Artefakt erfüllt.

Beleg im Artefakt:

```bash
grep -c "THIRD-PARTY NOTICES"            dist/lab-player.html   # -> 1
grep -c "Copyright 2010-2026 three.js authors" dist/lab-player.html   # -> 1
grep -c "Caleb Porzio"                   dist/lab-player.html   # -> 1
grep -c "Permission is hereby granted"   dist/lab-player.html   # -> 1
```

Wortlaut (Auszug, vollständig im Template):

```
ATTRIBUTION / THIRD-PARTY NOTICES — dist/lab-player.html
Dieses Artefakt bettet Fremd-Bibliotheken ein (alle MIT):
  three.js 0.186.1            - Copyright 2010-2026 three.js authors
  Alpine.js 3.17.5            - Copyright 2019-2025 Caleb Porzio and contributors
    @vue/shared 3.5.41        - Copyright 2018-present Yuxi (Evan) You and Vue contributors
    @vue/reactivity 3.5.41    - Copyright 2018-present Yuxi (Evan) You and Vue contributors

The MIT License (MIT), applies to all components listed above:
  … (vollständiger MIT-Text) …

Vollstaendiger Lizenz-Audit, Provenienznachweis und offene Punkte:
docs/LIZENZEN.md
```

### 5.3 Attributions-Text für den Footer des Standalone-Artefakts

`dist-standalone/modelmuse-standalone.html` bündelt **keine** Fremd-Bibliothek, referenziert aber vier per CDN. Der Footer nennt sie deshalb mit Version/Lizenz:

> Attribution: three.js 0.186.1 (MIT) · Vue 3 (MIT) · Tailwind CSS (MIT) · Inter Font (SIL OFL 1.1). Vollstaendige Lizenztexte, Provenienz und Abgrenzung (eingebettet vs. nur referenziert): docs/LIZENZEN.md

**Beleg der Abgrenzung:** Das Standalone enthält **keinen** Alpine-Code (`grep -c -i alpine` = 0) und **keinen** inline eingebetteten three.js-Bibliothekskörper (kein `REVISION = '…'`; die `WebGLRenderer`-Treffer sind ausschließlich Import-Listen im generierten Modellcode und eine Namens-Allowlist). Der three.js-Bezug entsteht allein über die Importmap auf `unpkg.com/three@0.186.1`, der Alpine-Bezug entfällt für dieses Artefakt vollständig.

### 5.4 MIT-Lizenztext (wortgleich, gilt für T1, T2, T3, T4, T6, T8, T9, T10, T12, T13)

```
The MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Die Copyright-Zeilen der einzelnen Komponenten sind in §2 (Spalte „Lizenz") je einzeln genannt und mit dem jeweiligen Original-Lizenztext im Repo belegt:
`node_modules/three/LICENSE`, `node_modules/esbuild/LICENSE.md`, `node_modules/alpinejs/package.json` (+ Upstream `LICENSE.md`), `eval/3jsbench/LICENSE-MIT-upstream`.

### 5.5 Apache-2.0 (T5, Playwright) und OFL-1.1 (T7, Inter) — Kurzverweis

- **Apache-2.0 (Playwright):** vollständiger Text in `node_modules/@playwright/test/LICENSE` (11 601 B), `NOTICE` (254 B) und `node_modules/playwright/ThirdPartyNotices.txt`. Wird nicht ausgeliefert; bei Weitergabe des Testwerkzeugs sind LICENSE + NOTICE mitzugeben.
- **OFL-1.1 (Inter):** vollständiger Text in `node_modules` nicht vorhanden (Font wird nur per CSS referenziert); Original: <https://github.com/rsms/inter/blob/master/LICENSE.txt> (abgerufen 29.10.2026). Wird die Schrift künftig selbst gehostet, ist der OFL-Text beizulegen.

---

## 6. Offene Punkte (vor Einreichung zu klären)

| ID | Punkt | Risiko | Zuständig |
|----|-------|--------|-----------|
| **O-1** | **Keine Lizenz für den eigenen Code.** `package.json` ist `private: true`, eine LICENSE-Datei fehlt. Ohne Lizenz ist keine Weiterverbreitung des eigenen Codes impliziert. | hoch (Abgabe an Dritte) | Repo-Owner |
| **O-2** | **Quellenangabe im Didaktik-Korpus inkonsistent.** `eval/didaktik-minimalsatz.json` (`hinweis3JSBench`) verweist auf „github.com/frvnkliu"; das tatsächliche Upstream-Repo ist `GeneralContext/3jsbench` (dort ist Frank Liu Autor). Lizenz (MIT) ist durch `eval/3jsbench/LICENSE-MIT-upstream` + `LIZENZ.md` korrekt belegt — nur der Fließtext nennt eine abweichende Quelle. | mittel (Irreführung) | Daten-/Doku-Owner |
| **O-3** | **Nutzungsbedingungen des Baseten/Meta-Modells** `meta-models/muse-spark-open-1026` sind aus dem Repo nicht belegbar. Keine Asset-Pflicht, aber Terms vor Einreichung prüfen. | mittel | Modell-/Recht-Owner |
| **O-4** | **CDN-Drift im Standalone-Artefakt** (Tailwind unversioniert, Vue nur Major-gepinnt, Inter unversioniert). Das gerenderte Styling und die Laufzeitversionen sind nicht reproduzierbar. Empfehlung: Versionen pinnen oder Assets lokal ausliefern. | niedrig (Demo) | Frontend-Owner |
| **O-5** | **Tailwind Play CDN** ist laut Anbieter „nicht für Produktion" gedacht. Für die Juror-Demo vertretbar, sollte aber als solcher gekennzeichnet bleiben. | niedrig | Frontend-Owner |
| **O-6** | **`scripts/_tmp/standalone-v11-basis.html` (v11-Basis des Standalone-Builders) ist nicht versioniert.** `scripts/build-standalone.mjs` setzt auf dieser Basis auf; ohne sie ist das Standalone-Artefakt nicht reproduzierbar neu baubar. | niedrig (Build-Hygiene) | Repo-Owner |

---

## 7. Prüfprotokoll (reproduzierbar)

```bash
# 1) Paketversionen + Lizenzfelder
node -e "const j=require('./package.json');console.log(j.devDependencies)"
for p in three esbuild alpinejs @playwright/test playwright playwright-core; do
  node -e "const j=require('./node_modules/$p/package.json');console.log(j.name,j.version,j.license)"
done

# 2) LICENSE-Dateien
ls node_modules/three/LICENSE node_modules/esbuild/LICENSE.md \
   node_modules/@playwright/test/LICENSE node_modules/@playwright/test/NOTICE \
   eval/3jsbench/LICENSE-MIT-upstream
# alpinejs: KEINE LICENSE-Datei im npm-Paket -> Upstream-LICENSE.md herangezogen

# 3) Vendor-Kopie == Upstream-Dist (Byte-Identitaet)
sha256sum src/vendor/alpine.module.esm.min.js node_modules/alpinejs/dist/module.esm.min.js
# -> beide ee019270eb31565b5258ca7e06391cc7f6cae8ed8f4b14db0d3d3d6f09524f7b

# 4) Vendor-Header lesen
head -12 src/vendor/diagram-2d.js   # Eigenentwicklung
cat  src/vendor/three.entry.js       # eigene Re-Export-Huelle

# 5) Fremdinhalt im ausgelieferten Artefakt
grep -c "SPDX-License-Identifier: MIT" dist/lab-player.html   # three.js
grep -c "Caleb Porzio"                  dist/lab-player.html   # -> 0 (Lücke, ergänzt)
grep -c "Bundled license information"   dist/lab-player.html   # @vue/*

# 6) Keine 2D-Eval-Libs eingebunden
grep -o -i "mermaid.min.js\|chart.umd\|d3.min.js\|katex.min.js" dist/lab-player.html | wc -l   # -> 0

# 7) CDN-Referenzen des Standalone-Artefakts
grep -oE "https?://[A-Za-z0-9./@?=&_:~-]+" dist-standalone/modelmuse-standalone.html | sort -u

# 8) Grüne Gates
npm run build && npm run test:unit && npm run render && npm run verify:dist
```

**Verifikationsprotokoll 29.10.2026 (nach Einbau der Attribution):**

| Gate | Ergebnis |
|------|----------|
| `npm run build` | **OK** — `build: OK hash=4f8c738401d7d708…`, three-Bundle 610 955 B, `verdict: pass` (keine Größenverletzung) |
| `npm run test:unit` | **grün — 142/142 Tests**, 0 fail |
| `npm run render` | **OK** — `dist/lab-player.html` 854 325 B, `sha256=0382a305d607cb7f…` (Komfortgrenze 1 500 000 B) |
| `npm run verify:dist` | **ALLE CHECKS GRUEN** — keine externen LOAD-URLs, keine Key-Muster, `artefaktSha256` == `.sha256` |
| `npm run verify:all` | **OK** — 12 Modelle, alle gelb, keine Fehler; Artefakt 854 325 B < Komfort |
| Standalone-Renderprobe (`scripts/_tmp/proof-standalone-guide.mjs`, Chromium/SwiftShader) | **PROOF-OK** — 0 Console-Errors, 0 Page-Errors, Boot ohne Banner, 10 Labs geladen; **Warnung erwartet**: „cdn.tailwindcss.com should not be used in production" (→ Risiko R6/O-5, kein Fehler) |
| Footer-Sichtprobe (Playwright, `footer.innerText`) | Attributions-Zeile sichtbar: „Attribution: three.js 0.186.1 (MIT) · Vue 3 (MIT) · Tailwind CSS (MIT) · Inter Font (SIL OFL 1.1). Vollständige Lizenztexte und Herkunftsnachweis: docs/LIZENZEN.md" |
| Nachweis im Hauptartefakt | `THIRD-PARTY NOTICES` = 1, `Caleb Porzio` = 1, `Copyright 2010-2026 three.js authors` = 1, `Permission is hereby granted` = 1 |

**Reihenfolge-Hinweis (wichtig für Reproduzierbarkeit):** `scripts/build.mjs` stempelt `artefaktSha256` aus der **bereits vorhandenen** `dist/lab-player.html`. Nach einer Änderung am Shell-Template muss deshalb **`npm run render` → `npm run build`** laufen, damit der Hash-Stempel zum Artefakt passt; erst danach ist `npm run verify:dist` grün. Die Reihenfolge `build → render → verify:dist` lässt einen veralteten Stempel zurück und meldet zu Unrecht „artefaktSha256 != Artefakt-sha256".

---

## 8. Änderungsprotokoll

| Datum | Änderung | Beleg |
|-------|----------|-------|
| 29.10.2026 | Erstaudit erstellt; Tabelle + Attributions-Texte + offene Punkte | dieses Dokument |
| 29.10.2026 | `src/shell/index.html`: `THIRD-PARTY NOTICES`-Kommentar mit vier Copyright-Zeilen + **vollständigem MIT-Text** ergänzt → erscheint unverändert in `dist/lab-player.html` | `grep -c "Permission is hereby granted" dist/lab-player.html` = 1 |
| 29.10.2026 | `scripts/build-standalone.mjs`: deterministischer Schritt **R19** (Attributions-Footer de/en/es + I18N-Key `footerAttrib`, 4 × `expectCount`); `dist-standalone/modelmuse-standalone.html` aus der v11-Basis neu gebaut | `grep -c "footerAttrib" dist-standalone/modelmuse-standalone.html` = 4 |
| 29.10.2026 | README: Abschnitt „Lizenzen & Attribution" + Attributions-Text; irreführende Aussage „autark, kein CDN" beim Standalone korrigiert | README, Abschnitte „Standalone-Hinweis" und „Lizenzen & Attribution" |
