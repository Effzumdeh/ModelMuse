import { stat } from 'node:fs/promises';
const table = [
  ['src/shell/index.html', 12000], ['src/shell/main.js', 9000], ['src/shell/store.js', 8000],
  ['src/shell/ui-model-picker.js', 7000], ['src/shell/ui-annotations.js', 5000],
  ['src/shell/ui-tasks.js', 8000], ['src/shell/ui-report.js', 7000],
  ['src/shell/ui-fallback2d.js', 6000], ['src/shell/theme.css', 20000],
  ['src/runtime/player.js', 12000], ['src/runtime/sandbox-host.js', 14000],
  ['src/runtime/frame-bootstrap.js', 10000], ['src/runtime/guard-static.js', 9000],
  ['src/runtime/guard-runtime.js', 7000], ['src/runtime/budget.js', 8000],
  ['src/runtime/verify.js', 11000], ['src/runtime/didactics.js', 7000],
  ['src/runtime/fallback2d.js', 8000], ['src/runtime/annotate.js', 10000],
  ['src/runtime/livegen.js', 6000], ['src/vendor/three.entry.js', 400],
  ['src/vendor/alpine.module.esm.min.js', 55919],
  ['src/schema/model-meta.schema.json', 2000], ['src/schema/manifest.schema.json', 4000],
  ['src/schema/verify-report.schema.json', 3000],
  ['prompts/p1-generate.txt', 2000], ['prompts/p2-repair.txt', 2000],
  ['scripts/build.mjs', 12000], ['scripts/render-single-file.mjs', 9000],
  ['scripts/verify-all.mjs', 11000], ['scripts/baseline-update.mjs', 5000],
  ['tests/static.spec.mjs', 6000], ['tests/sandbox.spec.mjs', 9000],
  ['tests/visual.spec.mjs', 7000], ['tests/perf.spec.mjs', 6000],
  ['tests/didactics.spec.mjs', 6000], ['tests/labs.matrix.spec.mjs', 8000],
  ['tests/fallback.spec.mjs', 6000], ['tests/determinism.spec.mjs', 5000],
  ['src/models/manifests/gpu-example.json', 3000],
];
let fail = 0;
for (const [f, max] of table) {
  try {
    const b = (await stat(f)).size;
    const ok = b <= max;
    if (!ok) fail += 1;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(b).padStart(6)} / ${String(max).padStart(6)}  ${f}`);
  } catch {
    fail += 1;
    console.log(`FEHLT                          ${f}`);
  }
}
console.log(fail === 0 ? 'AUDIT: alle im Budget' : `AUDIT: ${fail} Verstosse`);
