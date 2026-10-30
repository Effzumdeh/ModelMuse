# Router Concept: Routing Between 2D and 3D (Design Proposal)

**Status:** Design proposal, not an implementation specification for the current
release. No code change is implied by this document. The German source is
preserved at [`docs/source-de/ROUTER-KONZEPT.md`](source-de/ROUTER-KONZEPT.md).

## 1. Purpose and constraints

At the start of generation, a small classifier would choose between a 3D model
(using three.js) and a lightweight 2D representation. If it chooses 2D, it would
also select a representation type. The proposal limits routing to one additional
model call and introduces no npm dependencies.

- **3D route:** the existing P1 prompt, `meta / init / update / dispose` wrapper
  contract, S1–S5 verification, and `budget.js` limits.
- **2D route:** inline SVG for diagrams and charts; Canvas 2D for schematic
  cross-sections, extending `src/runtime/fallback2d.js` where appropriate.
  No new charting or diagram library is proposed.
- **Router:** a separate P0 prompt with a JSON-only response, parsed
  deterministically without streaming or generated code.

## 2. Classification rules

Choose 3D only when all of the following are true:

1. The source describes a spatial object, assembly, device, anatomy, or structure
   with meaningful position, orientation, assembly, or volume.
2. The learning objective benefits from spatial understanding or changing views.
3. At least two identifiable parts or sub-volumes can be inferred with spatial
   relationships.

Choose 2D when the task is primarily a process or algorithm, a circuit or signal
flow, a chart or comparison, a definition or taxonomy, or contains at most one
spatial object without a meaningful 3D learning benefit. An explicit request for
a 2D representation takes precedence over spatial cues.

Proposed 2D types are `schaltplan` (circuit/block diagram), `flussdiagramm`
(flowchart), `schnitt-ansicht` (schematic cross-section), `diagramm` (chart), and
`tabelle` (table). The German identifiers are retained because they are part of
the proposed source schema.

## 3. Response contract and fallback

The proposed response has exactly three keys: `mode`, `typ`, and `begruendung`.
`mode` is `3d` or `2d`; `typ` is a short 3D category or one of the five 2D
identifiers; and `begruendung` is limited to 140 characters. The schema disallows
additional properties.

The proposed parser extracts the longest JSON object, parses it, and validates
the schema and value lengths. Invalid JSON, a timeout, or an HTTP error fails
closed to the existing 3D route and records `routerFallback: true`; routing must
not abort generation. The rationale is logged and is not copied into model code.
The proposal caps P0 input at about 4,000 characters and output at about 300
tokens, with a single non-streaming call.

## 4. Proposed flow

```text
Source text
  -> P0 classifier (JSON response)
  -> schema validation
  -> 3D: existing P1 and full S1-S5 verification
     2D: proposed P1-2D, S1/S5, and static S2-light checks
  -> route-specific repair loop
  -> artifact and verification report with route metadata
```

For the proposed S2-light checks, validate SVG structure and reject scripts,
external URLs, and unsupported Canvas contexts. The 3D geometry layers would be
marked `skip` for a 2D route with an explicit reason, rather than reported as
passed. The proposal also calls for route metadata in the verification report
and attestation.

## 5. Proposed implementation work

- **`src/runtime/livegen.js`:** Add `routeGeneration()`, a short timeout,
  schema parsing, fail-closed behavior, and optional route selection in
  `generateLive()`. Acceptance evidence: unit tests for 3D/2D choices, malformed
  responses, timeouts, and input truncation.
- **`prompts/`:** Add `p0-router.txt` and a lightweight `p1-generate-2d.txt`; keep
  the current 3D prompt unchanged. Acceptance evidence: example responses validate
  against the schema, and 2D output has no three.js import.
- **`scripts/build.mjs`:** Add 2D-specific limits and route fields to reports;
  do not raise unrelated file-size limits. Acceptance evidence: the build report
  contains the proposed route fields.
- **`src/runtime/verify.js` and `scripts/verify-all.mjs`:** Add an SVG verifier,
  a 2D allowlist, explicit `skip` results for 3D-only checks, and route metadata.
  Acceptance evidence: 3D regression tests pass, and malformed SVG fails with a
  criterion ID.
- **Harness and repair prompts:** Supply 2D repair examples and keep the proposed
  retry, stagnation, regression, and budget limits. Acceptance evidence: defects
  repair within two automatic attempts; P0 is not repeated in the repair loop.

## 6. Risks and non-goals

The proposal identifies misclassification and prompt drift as risks. The proposed
mitigations are fail-closed routing, a recorded route, a later manual override,
few-shot examples, and schema tests. It does not propose a new 2D library, an
interactive 2D framework, a redesign of the 3D path, changes to the standalone
builder, or semantic component retrieval.

## 7. Proposed delivery order

1. Add P0, schema tests, and the route parser.
2. Add the 2D prompt and static verification path.
3. Connect 2D repair blocks to the harness.
4. Add route-specific build and verification report fields.

This remains a proposal. Consult the archived source document for the original
German prompt examples, schema, thresholds, and detailed acceptance checklist.
