# ModelMuse

<!-- Badges (placeholder): add project badges here once the repository is public. -->
<!-- Example: CI status, GitHub Pages status, license badge. No badge URLs yet. -->

## Overview

ModelMuse is a static single-page application for viewing and creating 3D and 2D educational models directly in the browser. It needs no backend and no build step to run: the only release artifact is a single self-contained HTML file:

- `dist-standalone/modelmuse-standalone.html` (approx. 430 KB, single file, zero local references)

Publish this file via GitHub Pages or any other static web server, open it in a browser, and you are ready. The application requires an internet connection at startup: it loads five CDN libraries (Three.js 0.186.1 pinned, Vue 3 unpinned via `vue@3`, OrbitControls from the Three.js 0.186.1 package, Tailwind CSS Play CDN unpinned, and Inter from Google Fonts). It is therefore a single file, but not offline-capable.

Runtime generation and revision run in the browser against one of three providers — Meta Muse, Baseten, or OpenRouter (see [Features](#features)). You provide your own API key where required (bring your own key); keys are kept only in memory or `sessionStorage` and are never written to the repository. A local proxy (`scripts/proxy.mjs`, localhost only) exists solely as a fallback for network/CORS problems on the Baseten path; OpenRouter is direct-call only.

## Features

- **Single-file release:** one HTML file (`dist-standalone/modelmuse-standalone.html`), no backend, no local references.
- **6 built-in labs:** 5 x 3D (`si-1`, `gpu-example`, `free-handbohrmaschine`, `chemie-koffein`, `arch-brandenburger-tor`) plus 1 x 2D demo (`demo-2d-chart`). Each lab ships trilingual per-part explanations (German, English, Spanish) aligned with its labels.
- **Interactive 3D viewer:** Three.js-based rendering with orbit controls, part toggles, and a component-info overlay with explanations.
- **2D renderers:** SVG, Mermaid-style, chart, D3-style, and KaTeX-style renderers for teaching content, plus automatic 2D detection — diagram terms are routed to the 2D contract without an extra model call.
- **Three generation providers (bring your own key, session only):**

| Provider | Path | Models | Key handling |
|---|---|---|---|
| Meta Muse | `muse` CLI harness (active, documented command) | `muse-spark-1.3-contributor` (default, Hackathon tariff), `muse-spark-1.3` (Standard) | No key field in the UI; authentication runs via the CLI, never through logs, files, or chat |
| Baseten | Direct browser call first, local proxy (`scripts/proxy.mjs`) only as fallback for network/CORS issues | `meta-models/muse-spark-open-1026` (Muse Spark Open) | Own Baseten key, session only, never a server key |
| OpenRouter | Direct browser call only (no proxy path; `scripts/proxy.mjs` rejects `provider=openrouter` and points to the direct call) | `openai/gpt-6.1-sol`, `meta/muse-spark-1.3`, `anthropic/claude-opus-5.5` (slugs verified against `https://openrouter.ai/models` on 31.10.2026) | Own OpenRouter key (`https://openrouter.ai/keys`), session only |

- **Per-model reasoning levels:** the reasoning selector (`Standard` / `xhigh` / `max`) is enabled per model exactly where the level is documented — `max` for 1.3/wonder on Meta Muse and for all three OpenRouter slugs, `xhigh` cap for Contributor models and the Baseten path (`max` is rejected there and would return HTTP 400). The UI default is the documented `xhigh`; requests always send an explicit output limit (`max_completion_tokens`/`max_tokens` = 131072) — omitting it is not unlimited, the upstream then defaults to 32768.
- **Sequential generation queue with ETA and overtime:** generate and revise jobs share one queue (further jobs can be submitted while one is running; results land as separate models). Each provider/model/reasoning combination has an ETA entry (60 s default, 240 s for heavy configurations and new OpenRouter models until measurements exist). The countdown shows remaining time, keeps counting past the ETA ("longer than expected · +{s} s"), reports total duration on completion, and aborts follow ETA + 120 s. A cost/duration estimate from collected telemetry averages updates live under the model selection.
- **Voluntary telemetry opt-in:** after a successful generation, a dialog asks whether to share a telemetry block (model, provider, reasoning, prompt, usage/HTTP codes, duration — keys redacted, memory only, never persisted). With star rating and optional comment, the block can be copied and then reported as an issue via a link button to `https://github.com/Effzumdeh/ModelMuse/issues`.
- **Redacted diagnostics export:** one-click copy of the run diagnostics (mode, reasoning, HTTP status, token usage including reasoning tokens, retry flag) with keys redacted — safe to paste into bug reports.
- **Model export menu:** bottom-left in the viewer — 3D views export GLB (label/measurement texts preserved via `userData` extras) and PNG screenshots of the current view; 2D views export SVG (with `xmlns` fix) and PNG. The session library additionally exports model source with a provenance header (no key material).
- **Session library with universal delete:** curated labs stay a read-only reference; session entries can be viewed, revised, adopted, imported, exported, and deleted. Every lab — including curated ones — has a delete button with confirmation, and deletions always win over persisted state (no ghost models).
- **Docked overlay windows:** generate, queue, revise, and component-info overlays stack like notifications at the screen corner, each minimizable to a bubble and closable.
- **Persistent start selection:** the last viewed model in the last used mode (3D/2D) is restored on launch, with sane fallbacks when the persisted selection was deleted.
- **Hardened generation pipeline:** fenced-code-only scanning, position-independent import stripping, tolerant part mapping with validation detail, and robust response parsing that tolerates reasoning-only responses (single retry without extras on HTTP 400).
- **Privacy-friendly key handling:** keys live only in memory or `sessionStorage` (with explicit consent) and never enter version control; telemetry and diagnostics never contain key material.
- **Verified quality gates:** unit tests plus Playwright browser tests cover the standalone artifact.

## Hackathon

ModelMuse is built for the Meta Global AI Developer Hackathon (virtual, 26 Oct – 4 Nov 2026) in the Indie Developer Track under the theme "Build for Your World".

The challenge entry is a browser-only tutor that turns an IT-vocational topic into a verified interactive 3D/2D model: a Muse Spark agent emits a declarative spec, a deterministic library renders it, and a build-verify loop checks by measurement and iterates.

This approach is timely because agentic self-verifying generation was not practical a year ago.

It is submitted in the Indie Developer Track by a FernUniversitaet Hagen student as a single file that runs on any school PC or tablet without installation.

## Live Demo

Try it live: [https://effzumdeh.github.io/ModelMuse/](https://effzumdeh.github.io/ModelMuse/) — serves `dist-standalone/modelmuse-standalone.html` via GitHub Pages (deployed automatically from `main` by `.github/workflows/pages.yml`).

Alternatively, run the app locally (see Quickstart below) or open the release file through any static web server.

## Quickstart

Prerequisites: **Node.js >= 20** (check with `node --version`; required by the `engines` field in `package.json`) and npm. `package-lock.json` is versioned, so `npm ci` installs the locked dependency tree reproducibly.

```sh
npm ci                    # install dependencies from package-lock.json
npm run build:standalone  # build the release artifact (requires the v15 baseline, see Build Notes)
npm run verify:standalone # check the release invariants of the artifact
npm run serve              # local development server (default port 8080)
npm run test:unit          # Node.js unit tests
npm run verify:all         # model check gates plus the standalone artifact (release approval command)
npx playwright test tests/standalone.spec.mjs  # browser suite for the standalone file (starts the server itself if needed)
```

Note: the older `build`, `render`, and `verify:dist` scripts remain as development tools; they do **not** produce the release artifact.

## Tech Stack

Exact versions are taken from `package.json` (devDependencies):

| Component | Version | Source |
|---|---|---|
| Node.js | >= 20 | `engines` field |
| Three.js (`three`) | 0.186.1 | npm devDependency, also pinned via CDN |
| Playwright (`@playwright/test`) | 1.64.1 | npm devDependency |
| esbuild | 0.28.2 | npm devDependency |
| Alpine.js (`alpinejs`) | 3.17.5 | npm devDependency |
| Vue 3 | unpinned (`vue@3`) | runtime CDN load, not from npm |
| Tailwind CSS Play CDN | unpinned | runtime CDN load, not from npm |
| OrbitControls | 0.186.1 | example module from the Three.js package |
| Inter font | unpinned | Google Fonts CDN load |

## Project Structure

| Path | Role |
|---|---|
| `dist-standalone/` | **Release target.** Contains `modelmuse-standalone.html`, the only shipping file. Build reports (`*-report.json`, `STANDALONE-REPORT-*.md`, `SHOWCASE-REPORT-*.md`) are generated locally only and excluded via `.gitignore`. |
| `src/` | Sources of all artifacts (models, vendor engines, runtime, shell). Development tooling, not a release. |
| `scripts/` | Build and verify chain (`build-standalone-v15a.mjs`, `verify-standalone.mjs`, and others). Development tooling, not a release. |
| `dist/`, `dist-2d/` | Older or prototype outputs and diagnostic artifacts. Not a release target. |
| `docs/` | Concept and verification documentation. Start at `docs/README.md`. |
| `tests/`, `tests-unit/` | Playwright specs and Node unit tests. |
| `prompts/`, `eval/` | Prompt versions and the 3jsbench benchmark. |

## Build Notes

- The build is **incremental**: `scripts/build-standalone-v15a.mjs` patches the existing v15 file, and follow-up builders (currently up to v41) layer features on top. Do **not** delete `dist-standalone/modelmuse-standalone.html` — without this v15 baseline, the build cannot be re-run.
- Before changing the artifact, keep a copy, e.g. a Git tag such as `standalone-v15a-basis`.
- The release approval command is `npm run verify:all`, which also covers the standalone artifact.
- `src/` and `scripts/` remain development and verification tools; only `dist-standalone/modelmuse-standalone.html` ships.

## Known Limitations

- **Single file, but not offline:** the app needs an internet connection at startup (CDN libraries, provider APIs). If a CDN is unreachable, it cannot start — check the connection and reload.
- **Keys are your responsibility:** Baseten and OpenRouter generation require your own key (session only); without a key, only the prepared library is available. Never use pupil or school data without the school leadership's approval — prompts are transmitted to the selected provider.
- **Local proxy is fallback-only:** `scripts/proxy.mjs` (localhost) only compensates for network/CORS problems on the Baseten path; OpenRouter has no proxy path by design.
- **WebGL2 required for 3D:** without WebGL2, the app falls back to a 2D fallback view with parts list and dimensions, marked as auto-checked with limitations.
- **Estimates are estimates:** the cost/duration forecast under the model selection is computed from collected telemetry averages, not a guarantee — new models start with a conservative 240 s ETA until measurements exist.
- **Explicit output limit (131072):** every request carries `max_completion_tokens`/`max_tokens` = 131072, so complex generations can legitimately run for several minutes before the ETA-based abort (ETA + 120 s) applies.
- **Model quality varies:** benchmark figures in the provider registry (e.g. 3JSBench, threejseval, AA-3D) describe geometry/aesthetics behaviour, not didactics — labels, measurements, and levels are measured only by the ModelMuse harness.

## Origin Story

ModelMuse was built with Meta models to showcase and use Meta models (see [Hackathon](#hackathon)): the bulk of the work was produced with Muse Spark 1.3 on the Contributor tier, driven through a mix of Hermes Agent and the Muse Code CLI, the CLI tool for Muse models.

Total build cost was about $5, thanks to the low Contributor pricing. The most expensive single step, at just under $2, was a one-off experiment with Muse Wonder (Frontier, outside the Contributor tier) for detailed computer-hardware 3D (mainboard, GPU, CPU). The Wonder output was more detailed than the 1.3 Contributor comparison run, but many times more expensive — a surcharge the price/performance ratio did not justify.

The takeaway is a value-for-money recommendation: Muse Spark 1.3 is remarkably capable for its price.

## Contributing

Contributions are welcome. Please keep pull requests focused, run `npm run verify:all` before submitting, and do not commit generated reports, `node_modules/`, or API keys. For larger changes, open an issue first to discuss scope and direction.

## License

This project is released under the MIT License. See [`LICENSE`](LICENSE) for details. Third-party components and their licenses are documented in [`docs/LICENSES.md`](docs/LICENSES.md).
