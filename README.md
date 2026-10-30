# SkillSpark Models — Standalone Release

SkillSpark is a static single-page application. The only release artifact is
[`dist-standalone/skillspark-standalone.html`](dist-standalone/skillspark-standalone.html).
It can be hosted on GitHub Pages or another static host; users do not need to
build the project or run a backend. The application requires a network connection
for its four CDN references: three.js 0.186.1, Vue 3, Tailwind CSS Play CDN, and
Inter. See the [license and attribution audit](docs/LIZENZEN.md).

Runtime generation and revision use a direct browser request to
`https://inference.baseten.co/v1/chat/completions`, with model
`meta-models/muse-spark-open-1026`. Users supply their own API key (BYOK); the
key is stored only in `sessionStorage`. No local proxy port is required, and no
proxy starts automatically.

**Kurzstatus 30.10.2026 (v15a):** Standalone-Artefakt mit 10 Modellen
(5× 3D: `si-1`, `gpu-example`, `free-handbohrmaschine`, `chemie-koffein`,
`arch-brandenburger-tor` + 5× 2D-Vendor-Engines: `demo-2d-svg/mermaid/chart/d3/katex`),
378 KB, Single-File, 5 CDN-Abhängigkeiten (Vue, Three.js, OrbitControls, Tailwind, Inter),
0 lokale Referenzen. Baseten-BYOK-Direktaufruf, kein lokaler Proxy nötig.
`npm run build:standalone` → `scripts/build-standalone-v15a.mjs`, idempotent.
Aktuelle Inventur: [`docs/INVENTUR-2026-10-30.md`](docs/INVENTUR-2026-10-30.md).
Bereinigt 30.10.2026 (Tag `v15a-basis-vor-bereinigung`): 30 2D-Quellen versioniert,
`node_modules/`, `dist/manual-tests/`, `cache/`, Legacy-Tarballs, alte Proxy-E2E-Skripte
und Root-Backups entfernt (~105 MB frei, 140 MB → 35 MB). Build danach verifiziert.

> The earlier 12-model v13 baseline is preserved in the German source archive
> at [`docs/source-de/STANDALONE-REPORT-2026-10-29.md`](docs/source-de/STANDALONE-REPORT-2026-10-29.md).
> Do not use that historical report as evidence that the current artifact
> contains 12 models. See the current
> [standalone report](dist-standalone/STANDALONE-REPORT-2026-10-29.md).
>
> The former `dist/lab-player.html` artifact has been retired and deleted.
> `src/` and `scripts/` remain development and harness tools. The verification
> command is `npm run verify:all`, which gates the standalone artifact.
>
> **Publication hold resolved 29.10.2026:** `npm run test:unit` passes 148/148
> (13 model sources restored + new `arch-brandenburger-tor`, matrix in sync). The browser
> suite covers the 5 showcase models; see the current
> [showcase report](dist-standalone/SHOWCASE-REPORT-2026-10-29.md).

## License and attribution

The full component inventory, license evidence, attribution text, and open items
are documented in [`docs/LIZENZEN.md`](docs/LIZENZEN.md). The evaluated
components use MIT, Apache-2.0, ISC, or SIL Open Font License 1.1 terms. The
standalone artifact references its CDN components; it does not bundle their
libraries. This statement does not determine the license for SkillSpark's own
code: the repository still requires an owner decision on its project license.

## Model and provider policy

- The default Muse model for development generation is
  `muse-spark-1.3-contributor`. Requests leave provider and model unset unless
  the user explicitly selects an alternative and supplies their own key.
- The standalone release uses the Baseten direct path described above. It does
  not use a local proxy by default.
- The historical 2D source modules use static SVG data from
  `src/vendor/diagram-2d.js`; they do not require a runtime model call. They are
  not bundled in the current EMPTY-STAND artifact.

## Historical 2D model sources

- The previous 12-model baseline included `dup-1`–`dup-3` and `ae-1`–`ae-3` as
  SVG data modules. Das v15a-Artefakt bündelt 5 2D-Demo-Modelle
  (`demo-2d-svg/mermaid/chart/d3/katex`); `dup-*`/`ae-*`/`si-2`/`si-3` liegen nur in `src/`.
- The source implementation uses the `2d-svg` vendor specification. SVG
  verification checks parsing, pixels, and the type allowlist when models are
  present.
- See [`docs/ROUTER-KONZEPT.md`](docs/ROUTER-KONZEPT.md) for the routing design
  and [`docs/2D-UMSTELLUNG-2026-10-28.md`](docs/2D-UMSTELLUNG-2026-10-28.md)
  for historical implementation evidence.

## Development checks

- `npm run build:standalone` builds the v15a release artifact.
- `npm run verify:standalone` checks the artifact's release invariants.
- `npx playwright test tests/standalone.spec.mjs` runs the standalone browser
  suite.
- `npm run test:unit` runs the Node.js unit tests.
- `npm run verify:all` runs the model verification gates and checks the
  standalone artifact.

The legacy `build`, `render`, and `verify:dist` scripts remain development
utilities; they do not produce the release artifact.

## 3D implementation guide

The model-source implementation guidance and its evidence are maintained in
[`docs/implementation-guide-3d-qualitaet.md`](docs/implementation-guide-3d-qualitaet.md).
The guide specifies the r186 API pin, image-based lighting, shadow configuration,
texture conventions, geometry budgets, and verification workflow.
