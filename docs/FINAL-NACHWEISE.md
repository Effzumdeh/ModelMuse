# Final Evidence — Current ModelMuse Checkout

**Date:** 29 October 2026. This is a local working-copy report; it does not
claim that changes were pushed. The historical German record, including its
screenshots and staged-file inventory, is preserved at
[`docs/source-de/FINAL-NACHWEISE.md`](source-de/FINAL-NACHWEISE.md).

## Current standalone state

The only release artifact is `dist-standalone/modelmuse-standalone.html`. It
is stamped v13 but is currently an EMPTY-STAND variant with zero bundled model
entries and an empty source registry. Its current verification is summarized in
the [standalone report](../dist-standalone/STANDALONE-REPORT-2026-10-29.md).
The prior 12-model report is historical and must not be used to describe the
current artifact.

## Checks run in this checkout

- `npm run build:standalone` — **passed**; the builder found the existing v13
  stamp and exited idempotently without writing.
- `npm run verify:standalone` — **passed**; the EMPTY-STAND checks confirmed
  zero models and a 117,574-byte artifact.
- `node --check scripts/build-standalone-v13.mjs` — **passed**.
- `node --check scripts/verify-standalone.mjs` — **passed**.
- `node --check scripts/verify-all.mjs` — **passed**.
- `npm run test:unit` — **failed: 140/148 passed, 8 failed**. Failures are
  caused by tests expecting removed model files/manifests: `si-1.js`,
  `gpu-example.js`, and `dup-1.js` are missing; some tests expect at least seven
  manifests, a 12-model matrix, or all model modules to exist.
- The standalone browser suite was not run against the empty artifact. The
  checked-in suite still expects a 12-model catalogue.

The detailed current build and verification record is in the
[standalone report](../dist-standalone/STANDALONE-REPORT-2026-10-29.md).

## Publication gate

The standalone build and empty-state verifier are green, but the unit suite is
red and the artifact no longer contains the 12-model catalogue documented in
the earlier v13 report. Do not publish this empty-state artifact as the populated
teaching release. Before release, either restore the model sources and manifests
or formally redefine the release as EMPTY-STAND, update the unit and browser
suites to match, and rerun all checks.

## Repository evidence commands

```sh
git log --oneline -5
git show --stat HEAD
git tag --list
git status --porcelain=v1 -b
```
