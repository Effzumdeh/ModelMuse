# SkillSpark — Standalone-Release

SkillSpark ist eine statische Single-Page-Anwendung zum Betrachten und Erzeugen von 3D- und 2D-Lehrmodellen im Browser. Du brauchst dafür weder ein Backend noch einen Build: Das einzige Release-Artefakt ist
[`dist-standalone/skillspark-standalone.html`](dist-standalone/skillspark-standalone.html).
Lege diese Datei auf GitHub Pages oder einen anderen statischen Host, öffne sie im Browser — fertig. Die Anwendung braucht eine Netzverbindung
für ihre fünf CDN-Bibliotheken: Three.js 0.186.1, Vue 3, OrbitControls (Three.js-Beispielmodul), Tailwind CSS Play CDN und
Inter. Siehe den [Lizenz- und Quellenangaben-Audit](docs/LIZENZEN.md).

Die Erzeugung und Überarbeitung zur Laufzeit nutzt einen direkten Browser-Aufruf an
`https://inference.baseten.co/v1/chat/completions` mit dem Modell
`meta-models/muse-spark-open-1026`. Du lieferst deinen eigenen API-Schlüssel (BYOK); der
Schlüssel liegt nur in `sessionStorage`. Es ist kein lokaler Proxy-Port nötig, und es
startet kein Proxy automatisch.

## Status (30.10.2026, v15a)

| Feld | Stand |
|---|---|
| **Release** | `dist-standalone/skillspark-standalone.html`, 378 KB, Single-File, 0 lokale Referenzen. Gebaut mit `npm run build:standalone` → `scripts/build-standalone-v15a.mjs` (idempotent). |
| **Inhalt** | 10 Modelle: 5× 3D (`si-1`, `gpu-example`, `free-handbohrmaschine`, `chemie-koffein`, `arch-brandenburger-tor`) + 5× 2D-Vendor-Engines (`demo-2d-svg/mermaid/chart/d3/katex`). |
| **Netz** | Die Datei ist Single-File, aber **nicht offline-fähig**: Sie lädt beim Start 5 CDN-Bibliotheken — Vue 3, Three.js 0.186.1, OrbitControls (Three.js-Beispielmodul), Tailwind CSS Play CDN und Inter (Google Fonts). Ohne Netz startet die App nicht. Zur Laufzeit ruft sie zusätzlich `https://inference.baseten.co/v1/chat/completions` direkt im Browser auf. |
| **Build** | Der Build ist **inkrementell**: `build-standalone-v15a.mjs` patcht die vorhandene v15-Datei. Lösche `dist-standalone/skillspark-standalone.html` nicht — ohne diese v15-Baseline lässt sich der Build nicht erneut ausführen. Vor jeder Änderung am Artefakt lege eine Kopie an (z. B. Git-Tag `standalone-v15a-basis`). |

Aktuelle Inventur: [`docs/INVENTUR-2026-10-30.md`](docs/INVENTUR-2026-10-30.md) (historische Momentaufnahme vor der Bereinigung vom 30.10.2026 — Details siehe Hinweis dort).
Bereinigt am 30.10.2026 (Tag `v15a-basis-vor-bereinigung`): 30 2D-Quellen versioniert, `node_modules/`, `dist/manual-tests/`, `cache/`, Legacy-Tarballs, alte Proxy-E2E-Skripte und Root-Backups entfernt (~105 MB frei, 140 MB → 35 MB). Build danach verifiziert.

> Die frühere 12-Modell-v13-Baseline ist im deutschen Quellarchiv unter [`docs/source-de/STANDALONE-REPORT-2026-10-29.md`](docs/source-de/STANDALONE-REPORT-2026-10-29.md) erhalten. Nutze diesen historischen Bericht nicht als Beleg dafür,
> dass das aktuelle Artefakt 12 Modelle enthält. Maßgeblich ist der aktuelle
> [Standalone-Report](dist-standalone/STANDALONE-REPORT-2026-10-29.md).
>
> Das frühere `dist/lab-player.html`-Artefakt ist stillgelegt und gelöscht.
> `src/` und `scripts/` bleiben Entwicklungs- und Prüfwerkzeuge. Der Freigabe-Befehl
> ist `npm run verify:all`, der das Standalone-Artefakt mit prüft.
>
> **Publikationssperre aufgehoben am 29.10.2026:** `npm run test:unit` besteht 148/148
> (13 Modellquellen wiederhergestellt + neues `arch-brandenburger-tor`, Matrix synchron). Die Browser-
> Suite deckt die 5 Vorzeigemodelle ab; siehe den aktuellen
> [Showcase-Report](dist-standalone/SHOWCASE-REPORT-2026-10-29.md).

## Schnellstart

Voraussetzung: **Node.js ≥ 20** (`node --version` prüfen).

```sh
npm ci                    # Abhängigkeiten aus package-lock.json installieren
npm run build:standalone  # baut das v15a-Release-Artefakt (braucht die v15-Baseline, siehe Status-Tabelle)
npm run verify:standalone # prüft die Release-Invarianten des Artefakts
npm run serve              # lokaler HTTP-Server zum Ausprobieren
npx playwright test tests/standalone.spec.mjs  # Browser-Suite für das Standalone
npm run test:unit          # Node.js-Unit-Tests
npm run verify:all         # Modellprüf-Gates + Standalone-Artefakt (Freigabe-Befehl)
```

Hinweis: Die älteren Skripte `build`, `render` und `verify:dist` bleiben als Entwicklungswerkzeuge erhalten; sie erzeugen **nicht** das Release-Artefakt.

## Verzeichnisübersicht (Root)

| Pfad | Rolle |
|---|---|
| `dist-standalone/` | **Release-Ziel.** Enthält `skillspark-standalone.html` (einziges Auslieferungsartefakt) plus Reports und Nachweisbilder. |
| `src/` | Quelle aller Artefakte (Modelle, Vendor-Engines, Runtime, Shell). Entwicklungswerkzeug, kein Release. |
| `scripts/` | Build- und Verify-Kette (`build-standalone-v15a.mjs`, `verify-standalone.mjs` u. a.). Entwicklungswerkzeug, kein Release. |
| `dist/`, `dist-2d/` | Ältere bzw. Prototyp-Ausgaben und Diagnose-Artefakte. Kein Release-Ziel. |
| `docs/` | Konzept- und Nachweisdokumentation. Einstieg: [`docs/README.md`](docs/README.md). |
| `tests/`, `tests-unit/` | Playwright-Specs und Node-Unit-Tests. |
| `prompts/`, `eval/` | Prompt-Versionen und 3jsbench-Benchmark. |

## Lizenz und Quellenangaben

Die vollständige Komponenten-Inventur, Lizenznachweise, Quellenangaben und offene Punkte stehen in [`docs/LIZENZEN.md`](docs/LIZENZEN.md). Die ausgewerteten
Komponenten nutzen MIT-, Apache-2.0-, ISC- oder SIL-Open-Font-License-1.1-Bedingungen. Das
Standalone-Artefakt **referenziert** seine 5 CDN-Bibliotheken (Vue 3, Three.js, OrbitControls, Tailwind CSS, Inter); es bündelt deren Bibliotheken nicht.
Diese Aussage legt die Lizenz für SkillSparks eigenen Code nicht fest:
Für das Repository steht die Projektlizenz-Entscheidung der Eigentümer noch aus.

## Modell- und Anbieter-Regel

- Das Standard-Muse-Modell für die Entwicklungserzeugung ist
  `muse-spark-1.3-contributor`. Anfragen lassen Anbieter und Modell offen, außer
  du wählst ausdrücklich eine Alternative und lieferst deinen eigenen Schlüssel.
- Das Standalone-Release nutzt den oben beschriebenen direkten Baseten-Pfad. Es
  nutzt standardmäßig keinen lokalen Proxy.
- Die historischen 2D-Quellmodule nutzen statische SVG-Daten aus
  `src/vendor/diagram-2d.js`; sie brauchen zur Laufzeit keinen Modellaufruf. Sie sind
  nicht im aktuellen EMPTY-STAND-Artefakt gebündelt.

## Historische 2D-Modellquellen

- Die frühere 12-Modell-Baseline enthielt `dup-1`–`dup-3` und `ae-1`–`ae-3` als
  SVG-Datenmodule. Das v15a-Artefakt bündelt 5 2D-Demo-Modelle
  (`demo-2d-svg/mermaid/chart/d3/katex`); `dup-*`/`ae-*`/`si-2`/`si-3` liegen nur in `src/`.
- Die Quellimplementierung nutzt die `2d-svg`-Vendor-Spezifikation. Die SVG-
  Prüfung kontrolliert Parsing, Pixel und die Typ-Allowlist, sofern Modelle vorhanden sind.
- Siehe [`docs/ROUTER-KONZEPT.md`](docs/ROUTER-KONZEPT.md) für das Routing-Design
  und [`docs/2D-UMSTELLUNG-2026-10-28.md`](docs/2D-UMSTELLUNG-2026-10-28.md)
  als historischen Implementierungsbeleg.

## 3D-Implementierungsleitfaden

Die Implementierungshilfe für Modellquellen und ihre Nachweise pflegst du in
[`docs/implementation-guide-3d-qualitaet.md`](docs/implementation-guide-3d-qualitaet.md).
Der Leitfaden legt den r186-API-Pin, bildbasierte Beleuchtung, Schattenkonfiguration,
Texturkonventionen, Geometrie-Budgets und den Prüfablauf fest.
