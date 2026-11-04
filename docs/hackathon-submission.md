# ModelMuse — Hackathon Submission

## Title

ModelMuse — browser-based 3D tutor that generates verifiable educational 3D models.

## One-sentence pitch

ModelMuse turns an IT-vocational topic into a verified interactive 3D model directly in the browser: a Muse Spark agent emits a declarative spec and a deterministic library renders it.

## Problem

Vocational IT teaching needs interactive 3D models that run on any school PC or tablet without installation — while typical 3D tooling requires installs, accounts, or backends, and raw LLM geometry output is unverified.

## Solution

A static single-page application with no backend and no build step to run: the only release artifact is a single self-contained HTML file (`dist-standalone/modelmuse-standalone.html`, approx. 470 KB, zero local load dependencies), served via GitHub Pages or any static web server. A Muse Spark agent emits a declarative spec, a deterministic library renders it, and a build-verify loop checks by measurement and iterates.

## Core features

- **Generate, revise, version 3D models:** runtime generation and revision run in the browser; generate and revise jobs share one sequential queue (further jobs can be submitted while one is running; results land as separate models). Every model keeps a per-model version history from v1 to vx (`src/runtime/model-history.js`; history list marks the active version).
- **Provider choice (bring your own key, session only):** Meta Muse (`muse-spark-1.3-contributor` default, Hackathon tariff; `muse-spark-1.3` Standard; CLI harness, no key field in the UI), Baseten (direct browser call first, local proxy `scripts/proxy.mjs` only as fallback for network/CORS issues; `meta-models/muse-spark-open-1026`), OpenRouter (direct browser call only; `openai/gpt-6.1-sol`, `meta/muse-spark-1.3`, `anthropic/claude-opus-5.5`), and Ollama locally (`http://localhost:11434`, OpenAI-compatible path, no key field, free-text model field with `llama3.1:8b` as placeholder example). Keys live only in memory or `sessionStorage` and never enter version control.
- **Rotate, view, export:** Three.js-based interactive 3D viewer with orbit controls; 3D views export GLB (label/measurement texts preserved via `userData` extras) and PNG screenshots of the current view; 2D views export SVG (with `xmlns` fix) and PNG; the session library additionally exports model source with a provenance header (no key material).
- **Parts and explanations:** 6 built-in labs — 5 x 3D (`si-1`, `gpu-example`, `free-handbohrmaschine`, `chemie-koffein`, `arch-brandenburger-tor`) plus 1 x 2D demo (`demo-2d-chart`) — each shipping per-part explanations aligned with its labels. The viewer offers part toggles and a component-info overlay with explanations. UI languages: German, English, Spanish, French (`src/shell/i18n/{de,en,es,fr}.json`).

## Tech stack

Single self-contained HTML file; no backend. Runtime CDN loads at startup (internet connection required, not offline-capable): Three.js 0.186.1 (pinned), Vue 3 (unpinned, `vue@3`), OrbitControls from the Three.js 0.186.1 package, Tailwind CSS Play CDN (unpinned), Inter from Google Fonts. Dev dependencies from `package.json`: `three` 0.186.1, `@playwright/test` 1.64.1, `esbuild` 0.28.2, `alpinejs` 3.17.5. Requires Node.js >= 20 (`engines` field); `npm ci` installs the locked tree reproducibly. Quality gates: Node unit tests plus Playwright browser tests covering the standalone artifact (`npm run verify:all`).

## Live demo

- Live: <https://effzumdeh.github.io/ModelMuse/> — serves `dist-standalone/modelmuse-standalone.html` via GitHub Pages (deployed automatically from `main` by `.github/workflows/pages.yml`).

## Repository

- Repo: <https://github.com/Effzumdeh/ModelMuse> (MIT License, see `LICENSE`; third-party licenses in `docs/LICENSES.md`).

## Origin story (short)

Built for the Meta Global AI Developer Hackathon (virtual, 26 Oct – 4 Nov 2026), Indie Developer Track, theme "Build for Your World", submitted as a single file that runs on any school PC or tablet without installation. The bulk of the work was produced with Muse Spark 1.3 on the Contributor tier, driven through a mix of Hermes Agent and the Muse Code CLI — total build cost ~$10 thanks to Contributor pricing (the most expensive single step, just under $2, was a one-off Muse Wonder experiment whose price/performance did not justify the surcharge). Takeaway: Muse Spark 1.3 is remarkably capable for its price.
