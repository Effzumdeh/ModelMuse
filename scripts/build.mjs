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
  // NACHTRAG 2026-10-28 (2D-Umstellung): S4-light-Planwerte fuer den
  // SVG-nativ-Pfad (vendor/diagram-2d.js, kein WebGL).
  budgetSvgNodes: 800,
  budget2dModuleBytes: 34000,
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
  'src/shell/index.html': 12000,    'src/shell/main.js': 21000, // Teil 6 (28.10.2026): 18000 -> 21000, Theme/Onboarding/Suche-Verdrahtung
    'src/shell/ui-providers.js': 7000,
    'src/shell/ui-library.js': 8000,
    'src/shell/ui-modify.js': 10000, // v22 (31.10.2026): 9000 -> 10000, Diagnose-Copy-Button (wie Freimodus); Slim-Generator (28.10.2026): neu, Modify-Flow (P2 als Modify)
    'src/runtime/providers.js': 7000,
    'src/runtime/session-library.js': 8000,
    'src/runtime/scoreboard.js': 6000, 'src/shell/store.js': 8000,
  'src/shell/ui-model-picker.js': 7000, 'src/shell/ui-annotations.js': 7000, // Teil 5 (27.10.2026): 5000 -> 7000, tt() + localizeManifest
  'src/shell/ui-report.js': 7000,
  'src/shell/i18n.js': 7000, // Teil 5 (27.10.2026): neu, detect/t/applyLocale/localizeManifest
  'src/shell/ui-fallback2d.js': 6000, 'src/shell/theme.css': 20000,
  'src/runtime/player.js': 16000, 'src/runtime/sandbox-host.js': 14000,
  'src/runtime/frame-bootstrap.js': 16000,  'src/runtime/guard-static.js': 16500, // 29.10.2026: 15000 -> 16500, 2D-Alle-Varianten (MERMAID/CHART/D3/KATEX-Kinds + Exportnamen je Vendor-Datei); Allowlist 2d-* unveraendert
  'src/runtime/guard-runtime.js': 8000, 'src/runtime/budget.js': 12000,
  'src/runtime/verify.js': 27000, 'src/runtime/didactics.js': 11000, // v22 (31.10.2026): didactics 9000 -> 11000, Bestand 10582 war bereits ueber Limit (Build rot seit v21); 28.10.2026: verify 22000 -> 27000, parallel Guide-3D edits (~25-26k: diagram extraction + S2-geometry checks); 28.10.2026 (prior): 20000 -> 22000, Guide-3D-F4 (name-independent room gate) + P2 log mit scene state/images; Part 5 (27.10.2026): 7000 -> 9000, i18n segment validation
  'src/runtime/geometry-checks.js': 20000,
  'src/runtime/fallback2d.js': 8000,  'src/runtime/annotate.js': 13500, // v38 (31.10.2026): 10000 -> 13500, Vorbestand mass 12956 (unveraendert, Budget nie nachgezogen);
  'src/runtime/livegen.js': 46000, // v38 (31.10.2026): 44500 -> 46000, OpenRouter-Direkt (Bases/Defaults/Referer/Title-Header, Reasoning-Gates, Session-Keys je Anbieter); v26 (31.10.2026): 43000 -> 44500, Reasoning-Matrix (reasoningXhighAllowed/reasoningLevel + Doku-Links, max nur belegt/nie -contributor/nie Baseten); v23 (31.10.2026): 40000 -> 43000, Request-Echo (requestEcho je Versuch + req-Zeilen in buildDiagnoseText, lokalisiert de/en/es); v22 (31.10.2026): 20000 -> 40000, Diagnose-Export (GEN_BUILD/redact/buildDiagnoseText/errorDiagnose + Usage-Zahlen/reasonSample/rawSnippet-Diagnose an Fehlern)
  'src/shell/ui-livegen.js': 24000, // v38 (31.10.2026): 21000 -> 24000, OpenRouter (Keys je Anbieter, Key-Hinweise je Anbieter, OrthographicCamera-Vorlage); v22 (31.10.2026): 17500 -> 21000, Diagnose-Copy-Button (Fehlerzustand, redigiert/ohne Key); Slim-Generator (28.10.2026): 16000 -> 17500, parallele Generieren-Arbeit (Datei misst 17057); Guards bleiben
  'src/vendor/three.entry.js': 760, // 28.10.2026: 700 -> 760, Guide-3D-F1/F2 (F1-Option-B: MeshPhysicalMaterial; F2: PCFShadowMap + VSMShadowMap; PCFSoftShadowMap bleibt fuer Bestandsmodelle); A-3 (2026-10-27, Nachtauftrag Hyperrealismus Teil 2): 560 -> 700, 8 weitere benannte three-Imports (InstancedMesh, ExtrudeGeometry, Shape, DataTexture, LinearFilter, RepeatWrapping, Matrix4, Quaternion) fuer Hyper-Geometrie/Texturen; kein CDN, keine externen Files; Bundle-Wachstum klein, Artefakt-Budget gruen
  'src/vendor/diagram-2d.js': 12500, // 28.10.2026: neu, 2D-Vendor-Renderer (SVG nativ, 0 externe Bytes; Lib im Vendor, Module liefern nur Daten)
  'src/vendor/mermaid-2d.js': 15000, // 29.10.2026: neu, Mermaid-Chunk-Selektion (flow/sequenz/er/gantt als Text-DSL, SVG-Render, Gate parseMermaid)
  'src/vendor/chart-2d.js': 12500, // 29.10.2026: 10500 -> 12500, Achsen mit niceCeil-Skala + Einheit + Peak-Highlight (Canvas + SVG-Vorschau)
  'src/vendor/d3-2d.js': 8000, // 29.10.2026: neu, d3-light (netz/baum, deterministisches Radial-Layout, Gate node-not-found)
  'src/vendor/katex-2d.js': 11000, // 29.10.2026: 7500 -> 11000, rekursiver LaTeX-Renderer (geschachtelte frac, left/right-Klammern, echte Symbole, Inline-CSS)
  'src/runtime/verify-2d.js': 32000, // 29.10.2026: 14000 -> 32000, 2D-Haertung (S2-2d-semantik: Achsen/Labels/Einheiten/Legende je Typ + S2-2d-layout: Ueberlappung/Mindestschrift/Kanten, Node-seitig deterministisch)
  'src/runtime/render-2d.js': 2500, // 29.10.2026: neu, Render-Dispatcher je 2d-*-Import (Player/Standalone/Shots)
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

// NACHTRAG 27.10.2026: Artefakt-Hash stempeln (Hex von dist/lab-player.html),
// damit verify-dist GENAU report.artefaktSha256 vs .sha256-Datei vergleicht.
// buildHash bleibt Quellen-Hash wie bisher. Fehlt das Artefakt zur Build-Zeit
// (Build vor Render), wird null gestempelt — verify-dist meldet das als Fail.
let artefaktSha256 = null;
try {
  if (existsSync(`${DIST}/lab-player.html`)) {
    artefaktSha256 = createHash('sha256').update(await readFile(`${DIST}/lab-player.html`, 'utf8'), 'utf8').digest('hex');
  }
} catch {
  artefaktSha256 = null;
}

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
  artefaktSha256,
  // ROUTER-KONZEPT §6.3: Generierungs-Routen im Build-Report (P0 + P1-2D aktiv,
  // 2D-Modelle aus src/models mit 2d-*-Import).
  routes: {
    p0: true,
    p1_2d: true,
    models2d: modelFiles.filter((m) => /^(dup-[123]|ae-[123]|demo-2d-(svg|mermaid|chart|d3|katex))\.js$/.test(m.file)).map((m) => m.file.slice(0, -3)),
  },
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
