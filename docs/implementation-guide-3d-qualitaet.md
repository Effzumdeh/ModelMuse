# 3D Quality Implementation Guide (three.js r186)

**Status:** Engineering guidance for the model-source and verification workflow.
**Evidence date:** 28 October 2026. This release-facing English edition summarizes
the detailed German source, which is preserved at
[`docs/source-de/implementation-guide-3d-qualitaet.md`](source-de/implementation-guide-3d-qualitaet.md).
The source retains original prompt excerpts, research notes, and reference tables.

## 1. Executive summary

The guide recommends retaining three.js r186 and improving model quality through
measurable feedback, constrained lighting and geometry, and bounded repair loops.
Its principal recommendations are:

1. Use an image-based-lighting (IBL) room so metallic surfaces remain visible.
2. Feed measured verification results into repair rather than relying on visual
   impressions or source-only checks.
3. Keep prompts and model output within the supported vendor API and resource
   budgets.
4. Add visual evidence only as a supplement to numerical checks.
5. Limit automatic repair to two rounds plus one manual reserve, with explicit
   stop conditions for success, stagnation, and regression.

The source research records API and lighting risks, model and runtime budgets,
and the evidence behind the recommendations. Those detailed citations remain in
the archived German source.

## 2. API and runtime constraints

The project pins its model-generation target to three.js r186 (`three@0.186.1`).
Generated modules must use APIs exported by the vendor bundle and accepted by the
static guard.

- `MeshPhysicalMaterial` must be present in the vendor bundle, the static
  allowlist, and the prompt import list before prompts request it. The source
  checklist records that this was implemented and tested.
- Use `PCFShadowMap`; do not request the removed `PCFSoftShadowMap` mode.
- Set `scene.environmentIntensity`; do not rely on per-material
  `envMapIntensity` for `scene.environment`.
- The guide requires a PMREM source scene named `room` until the verification
  gate is independent of variable names. The source checklist records both the
  prompt requirement and a name-independent gate based on the `fromScene`
  relationship.
- Inverted room geometry uses numeric `side: 1`; do not import `BackSide` unless
  the vendor bundle explicitly exports it.
- Pin the target API version in prompts and review migration changes before
  upgrading from r186.

## 3. Lighting and materials

### 3.1 IBL room

Use `PMREMGenerator` with a small room scene containing light-colored standard
material walls, a point light, and emissive softbox surfaces. Assign the PMREM
texture to `scene.environment` and set only `scene.environmentIntensity` (the
guide's reference value is `0.55`). Do not use the dark `0x11141a` room recipe.
The source measurements show that metallic materials without an environment can
render nearly black.

### 3.2 Four-light setup

The recommended setup uses four lights and no `AmbientLight`:

- Hemisphere fill: `HemisphereLight(0xdfeaff, 0x1a1410, 0.35)`.
- Shadow-casting key directional light: intensity `2.5`, 1024 × 1024 shadow map,
  a frustum fitted to the model bounds, and small bias/normal-bias values.
- Non-shadow-casting rim directional light: intensity `0.7`.
- Non-shadow-casting warm point accent: intensity `0.12`.

Use ACES filmic tone mapping, sRGB output, and exposure between 1.0 and 1.1.
The guide uses a circular contact floor with `ShadowMaterial`. All meshes may
receive shadows, but only principal parts should cast them. Avoid point-light
shadows because they require six depth passes.

### 3.3 Texture and material rules

- Keep generated `DataTexture` maps at or below 128 × 128 and use raw byte data;
  do not create a canvas or access `document`.
- Mark color maps as sRGB. Leave data maps such as roughness, metalness, and
  ambient occlusion in `NoColorSpace`.
- Follow the channel convention in the guide: roughness in green, metalness in
  blue, and ambient occlusion in red; use UV channel 0 for AO.
- Use `MeshPhysicalMaterial` clearcoat only for appropriate painted surfaces.
  Avoid expensive transmission, sheen, and iridescence shader paths unless
  explicitly approved.

## 4. Geometry and performance budgets

The source guide recommends instancing repeated parts by family and keeping
geometry resolution and shadow maps bounded. Use `InstancedMesh` with explicit
matrix updates and a recomputed bounding sphere. Avoid object-dummy transforms
and implicit color APIs that require unapproved imports.

| Metric | Hard limit | Guide target or warning threshold |
| --- | ---: | ---: |
| Model module size | 34,000 bytes | Hard limit |
| Triangles | 150,000 | Green through 120,000 |
| Draw calls | 400 | Green through 300 |
| Meshes | 250 | Green through 120; target about 45 |
| First frame | 8,000 ms | — |
| Frame rate | 30 FPS | — |
| Heap | 256 MB | — |

The guide also recommends a DPR default of 1, constrained to 1–2, and cautions
against defaulting to DPR 2, 2048 × 2048 shadow maps, high bevel/curve segment
counts, global `DoubleSide`, or shadow-casting point lights.

## 5. Verification feedback and bounded repair

The source guide identifies a gap between generation and verification: repair
must receive browser measurements, not only static source checks. The intended
repair input includes failed S2 geometry criteria, S4 budgets, and optional
screenshots. Only failed criteria should be sent; passing layers must remain
unchanged.

The protocol requires numeric expected/actual values with units, a bounded list
of offenders, and no unsupported self-evaluation. Screenshots supplement
measurements and are limited to three views. Do not send images for purely
static or budget failures.

Automatic repair is bounded to two rounds, with one manual reserve:

- **Success:** stop when all required S1–S5 checks pass.
- **Stagnation:** stop when the same failure and measured value persist.
- **Regression:** roll back to the last passing iteration and stop.
- Do not make another model call solely because a result “looks better” without
  a measured improvement.

## 6. Research-based prioritization

The source analysis prioritizes measured execution feedback, mixed positive and
negative examples, and prompt simplification. It treats visual critique as
conditional on cost and latency evidence, and retrieval as optional after the
repair loop is established. It does not recommend fine-tuning as the first
quality intervention.

The detailed source contains the recommendation matrix and cited results; this
summary does not restate or independently validate those research claims.

## 7. Engine decision and implementation roadmap

The recorded decision is to keep three.js r186. The source document proposes
borrowing selected ideas from other engines—headless geometry checks, declarative
part semantics, and explicit metrics—without replacing the renderer. Its roadmap
covers prompt hardening, harness feedback, negative examples, prompt
simplification, optional visual input, and optional component retrieval.

The original German prompt templates, source quotations, research tables, and
acceptance details are preserved in the linked source document. Treat this guide
as engineering guidance; current implementation status must be confirmed by the
build and verification commands rather than inferred from a planned roadmap.
