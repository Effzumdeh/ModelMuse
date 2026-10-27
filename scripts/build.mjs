/**
 * npm run build: Vendor-Bundle (esbuild), Modelle einlesen, Groessen pruefen,
 * dist/build-report.json schreiben. Abbrueche per Exit-Code ungleich 0.
 * Bauplan Abschnitt 8 (Build-Reihenfolge, Testbefehle).
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
const VENDOR_ABORT = 743075;

const plan = {
  threeBundle: 567964,
  helpers: 10000,
  alpine: 55919,
  shellJs: 90000,
  css: 20000,
  models: 304000,
  // Manifeste + i18n-Segmente (Teil 5: 40000 -> 60000, EN/ES je Modell).
  manifestsSchemas: 60000,
  overhead: 12000,
  sum: 1099883,
  comfort: 1500000,
  hard: 2000000,
  // NACHTRAG 2026-10-27 (Budget 400): S4-Planwerte, konsistent mit
  // src/runtime/budget.js DEFAULT_BUDGET_LIMITS und TRAFFIC [300,400].
  budgetTriangles: 150000,
  budgetDrawCalls: 400,
  budgetDrawCallsGreenBis: 300,
  budgetMeshCount: 250,
  budgetMeshCountGreenBis: 120,
  budgetMinFps: 30,
  budgetFirstFrameMs: 8000,
  budgetHeapMb: 256,
};

async function bytesOf(path) {
  try {
    const s = await stat(path);
    return s.size;
  } catch {
    return 0;
  }
}

async function jsBytes(dir) {
  let total = 0;
  const files = [];
  if (!existsSync(dir)) return { total, files };
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.js')) continue;
    const p = `${dir}/${f}`;
    const b = await bytesOf(p);
    total += b;
    files.push({ file: f, bytes: b });
  }
  return { total, files };
}

const failures = [];
// 1. Vendor-Bundle: benannte Imports, minify, esm, es2017.
await mkdir(DIST, { recursive: true });
try {
  await build({
    entryPoints: [`${ROOT}/src/vendor/three.entry.js`],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2017',
    outfile: `${DIST}/vendor-three.bundle.js`,
    logLevel: 'silent',
  });
} catch (e) {
  console.error(`build: esbuild FEHLER ${e.message}`);
  process.exit(1);
}
const threeBundle = await bytesOf(`${DIST}/vendor-three.bundle.js`);
console.log(`three-bundle: ${threeBundle} bytes (Plan ${plan.threeBundle})`);
if (threeBundle > VENDOR_ABORT) {
  console.error(`build: ABBRUCH Vendor-Bundle > ${VENDOR_ABORT}`);
  process.exit(1);
}

// 2. Vermessung.
const alpine = await bytesOf(`${ROOT}/src/vendor/alpine.module.esm.min.js`);
const shell = await jsBytes(`${ROOT}/src/shell`);
const runtime = await jsBytes(`${ROOT}/src/runtime`);
const helpers = await bytesOf(`${ROOT}/src/runtime/annotate.js`);
const css = await bytesOf(`${ROOT}/src/shell/theme.css`);
const models = await jsBytes(`${ROOT}/src/models`);
let manifests = 0;
if (existsSync(`${ROOT}/src/models/manifests`)) {
  for (const f of await readdir(`${ROOT}/src/models/manifests`)) {
    if (f.endsWith('.json')) manifests += await bytesOf(`${ROOT}/src/models/manifests/${f}`);
  }
}
let schemas = 0;
for (const f of await readdir(`${ROOT}/src/schema`)) {
  if (f.endsWith('.json')) schemas += await bytesOf(`${ROOT}/src/schema/${f}`);
}

// 3. Datei-Max-Pruefung (Bauplan Dateitabelle).
const maxTable = {
  'src/shell/index.html': 12000,    'src/shell/main.js': 16500, // Teil 2+5 (27.10.2026): 15000 -> 16500, getTarget + i18n-Verdrahtung + localStorage + repaintAll
    'src/shell/ui-providers.js': 7000,
    'src/shell/ui-library.js': 8000,
    'src/shell/ui-scoreboard.js': 6000,
    'src/runtime/providers.js': 7000,
    'src/runtime/session-library.js': 8000,
    'src/runtime/scoreboard.js': 6000, 'src/shell/store.js': 8000,
  'src/shell/ui-model-picker.js': 7000, 'src/shell/ui-annotations.js': 7000, // Teil 5 (27.10.2026): 5000 -> 7000, tt() + localizeManifest
  'src/shell/ui-tasks.js': 8000, 'src/shell/ui-report.js': 7000,
  'src/shell/i18n.js': 7000, // Teil 5 (27.10.2026): neu, detect/t/applyLocale/localizeManifest
  'src/shell/ui-fallback2d.js': 6000, 'src/shell/theme.css': 20000,
  'src/runtime/player.js': 16000, 'src/runtime/sandbox-host.js': 14000,
  'src/runtime/frame-bootstrap.js': 12000, 'src/runtime/guard-static.js': 9000,
  'src/runtime/guard-runtime.js': 8000, 'src/runtime/budget.js': 12000,
  'src/runtime/verify.js': 20000, 'src/runtime/didactics.js': 9000, // Teil 5 (27.10.2026): 7000 -> 9000, i18n-Segment-Validierung
  'src/runtime/geometry-checks.js': 20000,
  'src/runtime/fallback2d.js': 8000,  'src/runtime/annotate.js': 10000,
  'src/runtime/livegen.js': 9000, // E2E-Befund 2026-10-27: 7500 -> 9000, extractModuleSource (Import-erhaltende Extraktion, mit CLI-Pfad geteilt; behebt systematisches E-S2-BOOT "X is not defined")
  'src/shell/ui-livegen.js': 15500, // Teil 1+2+5 (27.10.2026): 13000 -> 15500, locale-Prompt, meta_i18n, i18n-Manifest, Speicher-Key-Policy
  'src/vendor/three.entry.js': 700, // A-3 (2026-10-27, Nachtauftrag Hyperrealismus Teil 2): 560 -> 700, 8 weitere benannte three-Imports (InstancedMesh, ExtrudeGeometry, Shape, DataTexture, LinearFilter, RepeatWrapping, Matrix4, Quaternion) fuer Hyper-Geometrie/Texturen; kein CDN, keine externen Files; Bundle-Wachstum klein, Artefakt-Budget gruen
  'src/vendor/alpine.module.esm.min.js': 55919,
};
const maxViolations = [];
for (const [rel, max] of Object.entries(maxTable)) {
  const b = await bytesOf(`${ROOT}/${rel}`);
  if (b === 0) {
    maxViolations.push(`${rel}: FEHLT`);
  } else if (b > max) {
    maxViolations.push(`${rel}: ${b} > max ${max}`);
  }
}
const modelFiles = models.files;
for (const m of modelFiles) {
  if (m.bytes > 34000) maxViolations.push(`src/models/${m.file}: ${m.bytes} > max 34000`);
}

// 4. Build-Hash ueber alle Quellen.
const hash = createHash('sha256');
for (const dir of [`${ROOT}/src/shell`, `${ROOT}/src/runtime`, `${ROOT}/src/vendor`, `${ROOT}/src/models`, `${ROOT}/src/schema`, `${ROOT}/prompts`]) {
  if (!existsSync(dir)) continue;
  const walk = async (d) => {
    for (const f of await readdir(d, { withFileTypes: true })) {
      const p = `${d}/${f.name}`;
      if (f.isDirectory()) await walk(p);
      else hash.update(await readFile(p));
    }
  };
  await walk(dir);
}
const buildHash = hash.digest('hex');

const shellJsTotal = shell.total + runtime.total;
const report = {
  createdAt: new Date().toISOString(),
  versions: {
    three: JSON.parse(await readFile(`${ROOT}/node_modules/three/package.json`, 'utf8')).version,
    esbuild: JSON.parse(await readFile(`${ROOT}/node_modules/esbuild/package.json`, 'utf8')).version,
    alpine: JSON.parse(await readFile(`${ROOT}/node_modules/alpinejs/package.json`, 'utf8')).version,
    playwright: JSON.parse(await readFile(`${ROOT}/node_modules/@playwright/test/package.json`, 'utf8')).version,
    node: process.version,
  },
  plan,
  measured: {
    threeBundle, alpine, helpers, shellJs: shell.total, runtimeJs: runtime.total,
    shellJsTotal, css, modelsTotal: models.total, modelFiles, manifests, schemas,
    manifestsSchemas: manifests + schemas,
  },
  maxViolations,
  buildHash,
  verdict: maxViolations.length === 0 && threeBundle <= VENDOR_ABORT ? 'pass' : 'fail',
};
await writeFile(`${DIST}/build-report.json`, JSON.stringify(report, null, 2));
console.log(`shell-js: ${shell.total} (Plan ${plan.shellJs}), runtime-js: ${runtime.total}, css: ${css}, modelle: ${models.total}, manifeste+schemas: ${manifests + schemas}`);
for (const v of maxViolations) console.error(`build: MAX ${v}`);
if (report.verdict !== 'pass') {
  console.error('build: ABBRUCH Groessenpruefung rot');
  process.exit(1);
}
console.log(`build: OK hash=${buildHash.slice(0, 16)}`);
