# ModelMuse

<!-- Badges (placeholder): add project badges here once the repository is public. -->
<!-- Example: CI status, GitHub Pages status, license badge. No badge URLs yet. -->

## Overview

ModelMuse is a static single-page application for viewing and creating 3D and 2D educational models directly in the browser. It needs no backend and no build step to run: the only release artifact is a single self-contained HTML file:

- `dist-standalone/modelmuse-standalone.html` (approx. 370 KB, single file, zero local references)

Publish this file via GitHub Pages or any other static web server, open it in a browser, and you are ready. The application requires an internet connection at startup: it loads five CDN libraries (Three.js 0.186.1 pinned, Vue 3 unpinned via `vue@3`, OrbitControls from the Three.js 0.186.1 package, Tailwind CSS Play CDN unpinned, and Inter from Google Fonts). It is therefore a single file, but not offline-capable.

Runtime generation and editing call `https://inference.baseten.co/v1/chat/completions` directly from the browser. You provide your own API key (bring your own key); the key is kept only in `sessionStorage` and is never written to the repository. No local proxy port is required, and no proxy starts automatically.

## Features

- **Single-file release:** one HTML file (`dist-standalone/modelmuse-standalone.html`), no backend, no local references.
- **10 built-in models:** 5 x 3D (`si-1`, `gpu-example`, `free-handbohrmaschine`, `chemie-koffein`, `arch-brandenburger-tor`) plus 5 x 2D demo engines (`demo-2d-svg`, `demo-2d-mermaid`, `demo-2d-chart`, `demo-2d-d3`, `demo-2d-katex`).
- **Interactive 3D viewer:** Three.js-based rendering with orbit controls.
- **2D diagram engines:** SVG, Mermaid-style, chart, D3-style, and KaTeX-style renderers for teaching content.
- **Runtime generation:** create and revise models in the browser via a direct Baseten inference call with your own API key.
- **Privacy-friendly key handling:** the API key lives only in `sessionStorage` and never enters version control.
- **Verified quality gates:** unit tests plus Playwright browser tests cover the standalone artifact.

## Hackathon

ModelMuse is built for the Meta Global AI Developer Hackathon (virtual, 26 Oct – 4 Nov 2026) in the Indie Developer Track under the theme "Build for Your World".

The challenge entry is a browser-only tutor that turns an IT-vocational topic into a verified interactive 3D/2D model: a Muse Spark agent emits a declarative spec, a deterministic library renders it, and a build-verify loop checks by measurement and iterates.

This approach is timely because agentic self-verifying generation was not practical a year ago.

It is submitted in the Indie Developer Track by a FernUniversitaet Hagen student as a single file that runs on any school PC or tablet without installation.

## Live Demo

> TODO: publish `dist-standalone/modelmuse-standalone.html` via GitHub Pages.
> Planned URL: `https://<user>.github.io/ModelMuse/` (placeholder — replace `<user>` with the actual GitHub username once the repository is public).

Until then, run the app locally (see Quickstart below) or open the release file through any static web server.

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

- The build is **incremental**: `scripts/build-standalone-v15a.mjs` patches the existing v15 file. Do **not** delete `dist-standalone/modelmuse-standalone.html` — without this v15 baseline, the build cannot be re-run.
- Before changing the artifact, keep a copy, e.g. a Git tag such as `standalone-v15a-basis`.
- The release approval command is `npm run verify:all`, which also covers the standalone artifact.
- `src/` and `scripts/` remain development and verification tools; only `dist-standalone/modelmuse-standalone.html` ships.

## Contributing

Contributions are welcome. Please keep pull requests focused, run `npm run verify:all` before submitting, and do not commit generated reports, `node_modules/`, or API keys. For larger changes, open an issue first to discuss scope and direction.

## License

This project is released under the MIT License. See [`LICENSE`](LICENSE) for details.
