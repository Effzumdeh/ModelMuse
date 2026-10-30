# License and Provenance Audit — ModelMuse (v13, historical)

> **Status note on the current release (v15a, 30 October 2026, editorial — not a new legal review):** This audit describes the **v13 state** of 29 October 2026 and is retained as a historical record. For the current release artifact `dist-standalone/modelmuse-standalone.html` (v15a, 378,519 bytes, 10 models), the following applies instead: it references **5** CDN libraries — Vue 3, Three.js 0.186.1, OrbitControls (a Three.js example module), Tailwind CSS Play CDN, and Inter — rather than the four named below for v13. The caveats documented below (no offline operation, version drift from unpinned references, Tailwind Play CDN for development only) continue to apply unchanged to v15a. The project itself is licensed since (MIT, © 2026 Effzumdeh; see `LICENSE` in the repository root), which resolves the former open item O-1. A full v15a re-audit is still outstanding.

**Audit date:** 29 October 2026  
**Scope:** Repository dependencies, vendor files, model data, evaluated content,
and the standalone release artifact.  
**German source:** [`docs/source-de/LIZENZEN.md`](source-de/LIZENZEN.md).

This audit records evidence from the repository at the date above. It does not
replace a legal review. Do not treat an item as cleared where the evidence is
marked uncertain or an owner decision is pending.

## 1. Executive summary

- The identified third-party components are licensed under MIT, Apache-2.0, ISC,
  or SIL Open Font License 1.1. The audit found no NC, ND, or proprietary assets
  in the examined material.
- The v13 standalone HTML references three.js, Vue, Tailwind CSS, and Inter from
  CDNs; it does not bundle those libraries. The CDN references are not all
  version-pinned, so their exact runtime versions and styling are not
  reproducible.
- The previous `dist/lab-player.html` artifact embedded three.js and Alpine.js.
  The legacy artifact is retired; its attribution notes below are historical and
  must not be mistaken for a description of the current standalone artifact.
- The 3JSBench evaluation briefings are MIT-licensed and remain in the
  repository, not in the release HTML.
- ModelMuse's own code is released under the MIT License (© 2026 Effzumdeh);
  see the `LICENSE` file in the repository root.

## 2. Component inventory

- **three.js 0.186.1 — MIT.** CDN reference in the standalone; not bundled.
  Upstream: [three.js](https://github.com/mrdoob/three.js).
- **Vue 3 — MIT.** Referenced through `vue@3`; the major-only pin allows runtime
  version drift.
- **Tailwind CSS Play CDN — MIT.** Referenced through the unversioned
  `https://cdn.tailwindcss.com` route. The provider describes Play CDN as
  development-only, not intended for production.
- **Inter — SIL OFL 1.1.** Referenced through an unversioned Google Fonts CSS URL;
  not self-hosted. Include the OFL text if self-hosting. Upstream:
  [Inter](https://github.com/rsms/inter).
- **esbuild 0.28.2 — MIT.** Build-time tool only; not shipped. Evidence:
  `node_modules/esbuild/LICENSE.md`.
- **Playwright packages 1.64.1 — Apache-2.0.** Test-only tools; not shipped.
  Preserve applicable LICENSE and NOTICE files if redistributing the tools.
- **Alpine.js 3.17.5 — MIT.** Bundled in the retired `dist/lab-player.html`, not
  in the v13 standalone. The historical vendor copy matched the npm distribution
  by SHA-256.
- **`@vue/shared` and `@vue/reactivity` 3.5.41 — MIT.** Included through Alpine
  in the retired artifact; not part of the standalone release bundle.
- **3JSBench task briefings — MIT, © 2026 General Context.** The 100-prompt
  evaluation corpus is not included in the standalone HTML. License copy:
  `eval/3jsbench/LICENSE-MIT-upstream`.
- **Mermaid, Chart.js, d3-light, and KaTeX — MIT / ISC.** Evaluation candidates
  only; not installed or bundled. Evaluation references alone do not imply a
  redistribution duty.
- **Baseten model endpoint — `meta-models/muse-spark-open-1026`.** No model
  weights are included and no model-weight license is present in the repository.
  Provider terms are not evidenced here and must be checked by the owner.
- **ModelMuse source, prompts, and data — MIT, © 2026 Effzumdeh.** See the
  repository root `LICENSE` file. Redistribution of project-owned material
  follows those terms.

The project's own `src/vendor/diagram-2d.js` and `src/vendor/three.entry.js`
are described in their headers as project-authored code; model files are
project model sources. The German source audit contains the detailed package,
version, and hash evidence for the prior audit state.

## 3. Standalone release and external resources

The v13 HTML references external resources and requires network access. CDN
references are not equivalent to bundled copies and do not pin every version.
This creates a reproducibility risk even where the referenced license permits
use. Recommended release hygiene is to pin versions or host reviewed assets
locally, subject to the applicable license and attribution requirements.

The Tailwind Play CDN has a separate production-readiness concern: its provider
states that it is designed for development, not production. The audit records
this limitation; it does not certify the CDN configuration as production-ready.

## 4. Attribution text

The following summary attribution is suitable for repository documentation. It
lists project dependencies and referenced assets; it is not a replacement for
license texts where those must accompany a redistributed copy.

> **Attribution.** ModelMuse uses or references the following open-source
> components: **three.js 0.186.1** (MIT, © 2010–2026 three.js authors),
> **Vue 3** (MIT, © 2018–present Yuxi (Evan) You and Vue contributors),
> **Tailwind CSS** (MIT, © Tailwind Labs, Inc.), **Inter** (SIL Open Font License
> 1.1, © 2016 The Inter Project Authors), **esbuild 0.28.2** (MIT, © 2020 Evan
> Wallace; build tool), and **Playwright 1.64.1** (Apache-2.0, © Microsoft
> Corporation; test tool). The repository also contains **3JSBench task
> briefings** (MIT, © 2026 General Context; evaluation corpus). The v13
> standalone references its browser libraries through CDNs rather than bundling
> them. See this audit and upstream license files for full terms and evidence.

The retired legacy artifact had a `THIRD-PARTY NOTICES` block for its embedded
MIT-licensed libraries. Do not use that historical note as a claim that the
current standalone embeds the same libraries.

## 5. License texts and notices

For MIT-licensed dependencies, include each applicable copyright notice and the
permission notice with redistributed copies or substantial portions. The full
MIT text is reproduced here for reference:

```text
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

For Playwright, consult the package `LICENSE`, `NOTICE`, and
`ThirdPartyNotices.txt`; the audit notes third-party Puppeteer code in its
notices. For Inter, consult the upstream OFL text at
<https://github.com/rsms/inter/blob/master/LICENSE.txt> if the font is bundled
or self-hosted. These files are not a substitute for verifying the precise
license obligations for the copy being distributed.

## 6. Open items

- **O-1 — Project license: resolved.** ModelMuse's own code is released under
  the MIT License (© 2026 Effzumdeh); see the repository root `LICENSE` file.
  (At the v13 audit date no project license had been declared; that gap is now
  closed.)
- **O-2 — 3JSBench source:** A source reference in
  `eval/didaktik-minimalsatz.json` was recorded as inconsistent with the upstream
  repository. Correct it and verify the attribution against
  `GeneralContext/3jsbench`.
- **O-3 — Model terms:** Terms for the Baseten-hosted model are not evidenced in
  this repository. Check the provider and model terms before submission or
  publication.
- **O-4 — CDN version drift:** Tailwind, Vue, and Inter references do not pin all
  versions. Pin them or self-host reviewed assets, then rerun license and
  release checks.
- **O-5 — Tailwind Play CDN:** The provider documents Play CDN as development-only.
  Replace it for production or explicitly accept and document the limitation.
- **O-6 — Historical v11 base:** The original standalone build depended on an
  unversioned v11 base file. Retain historical builder inputs or document the
  current v13 builder's reproducibility separately.

## 7. Reproducible audit commands

```sh
node -p "JSON.stringify(require('./package.json').devDependencies, null, 2)"
node -p "require('./node_modules/three/package.json').version"
node -p "require('./node_modules/esbuild/package.json').version"
node -p "require('./node_modules/alpinejs/package.json').version"
npm run verify:standalone
```

The German source record contains the original detailed procedures, hashes, and
historical verification results. Re-run checks against the current checkout
before publishing a new license or artifact claim.
