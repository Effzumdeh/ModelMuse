/**
 * Rendert dist/lab-player.html: Shell + CSS + App-Bundle inline,
 * Modelle und Vendor-Texte als Payloads (kein Base64, kein CDN).
 * Escaping: `<` -> \u003c in allen eingebetteten Strings.
 * Abbruch bei > 1500000 Bytes (Komfortgrenze).
 * Bauplan Abschnitt 3 (Artefakt) und Abschnitt 8.
 */
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
const COMFORT = 1500000;
const HARD = 2000000;

await mkdir(DIST, { recursive: true });

// O-07 (27.10.2026): letzte gruene Version sichern vor dem ersten Schreiben.
// Gruen = build-report.json verdict pass + verify-report.json buildHash == build-report.json buildHash.
const LAST_GREEN = `${DIST}/last-green`;
async function fallbackRot(grund) {
  try {
    if (existsSync(`${LAST_GREEN}/lab-player.html`) && existsSync(`${LAST_GREEN}/lab-player.html.sha256`)) {
      await copyFile(`${LAST_GREEN}/lab-player.html`, `${DIST}/lab-player.html`);
      await copyFile(`${LAST_GREEN}/lab-player.html.sha256`, `${DIST}/lab-player.html.sha256`);
      await writeFile(`${DIST}/FALLBACK-ROT.json`, JSON.stringify({ datum: new Date().toISOString(), grund: String(grund).slice(0, 160), quelle: 'last-green' }, null, 2));
      console.error('render: FALLBACK letzte gruene Version (ROT markiert)');
    }
  } catch { /* kein Fallback moeglich */ }
}
try {
  if (existsSync(`${DIST}/lab-player.html`) && existsSync(`${DIST}/lab-player.html.sha256`)) {
    const buildRep = JSON.parse(await readFile(`${DIST}/build-report.json`, 'utf8'));
    const verifyRep = JSON.parse(await readFile(`${DIST}/verify-report.json`, 'utf8'));
    if (buildRep?.verdict === 'pass' && verifyRep?.buildHash && verifyRep.buildHash === buildRep.buildHash) {
      await mkdir(LAST_GREEN, { recursive: true });
      await copyFile(`${DIST}/lab-player.html`, `${LAST_GREEN}/lab-player.html`);
      await copyFile(`${DIST}/lab-player.html.sha256`, `${LAST_GREEN}/lab-player.html.sha256`);
    }
  }
} catch { /* ohne Gruen-Beleg keine Sicherung */ }

// App-Bundle: Shell + Runtime + Alpine inline (three bleibt Text-Asset im Frame).
// O-07-Nachtrag (Orchestrator): unbehandelte Fehler (z.B. fehlender Entry) wuerden
// sonst ohne Fallback crashen — globale Wache sichert die letzte gruene Version.
process.on('unhandledRejection', async (e) => {
  console.error(`render: ABBRUCH unbehandelt: ${String((e && e.message) || e).slice(0, 160)}`);
  await fallbackRot(`unbehandelt: ${String((e && e.message) || e).slice(0, 160)}`);
  process.exit(1);
});
let app;
try {
app = await build({
  entryPoints: [`${ROOT}/src/shell/main.js`],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2017',
  write: false,
  logLevel: 'silent',
});
} catch (e) {
  console.error(`render: ABBRUCH App-Bundle: ${String((e && e.message) || e).slice(0, 160)}`);
  await fallbackRot(`App-Bundle: ${String((e && e.message) || e).slice(0, 160)}`);
  process.exit(1);
}
const appCode = app.outputFiles[0].text;
if (/<\/script/i.test(appCode)) {
  console.error('render: ABBRUCH App-Bundle enthaelt </script');
  await fallbackRot('App-Bundle enthaelt </script');
  process.exit(1);
}

const css = await readFile(`${ROOT}/src/shell/theme.css`, 'utf8');
let html = await readFile(`${ROOT}/src/shell/index.html`, 'utf8');

/** JSON sicher fuer <script>-Einbettung machen. */
function scriptSafe(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

// Anbieter-Registry (Teil 1): Datei als Single Source, Build bettet ein.
const providersReg = JSON.parse(await readFile(`${ROOT}/src/data/providers.json`, 'utf8'));
const providersJson = scriptSafe(providersReg);
if (/<\/script/i.test(providersJson)) {
  console.error('render: ABBRUCH unescaptes </script in providers.json');
  await fallbackRot('unescaptes </script in providers.json');
  process.exit(1);
}
// Modellmatrix (O-10, S5-soll): Datei als Single Source, Build bettet ein.
const matrixReg = JSON.parse(await readFile(`${ROOT}/src/data/modellmatrix.json`, 'utf8'));
const matrixJson = scriptSafe(matrixReg);
if (/<\/script/i.test(matrixJson)) {
  console.error('render: ABBRUCH unescaptes </script in modellmatrix.json');
  await fallbackRot('unescaptes </script in modellmatrix.json');
  process.exit(1);
}
html = html.replace(
  '<script id="lab-models" type="application/json">[]</script>',
  () => `<script>window.__PROVIDERS__=${providersJson};</script>\n<script>window.__MODELLMATRIX__=${matrixJson};</script>\n<script id="lab-models" type="application/json">[]</script>`
);
// Modelle + Manifeste einsammeln.
const models = [];
if (existsSync(`${ROOT}/src/models`)) {
  for (const f of await readdir(`${ROOT}/src/models`)) {
    if (!f.endsWith('.js')) continue;
    const id = f.slice(0, -3);
    const source = await readFile(`${ROOT}/src/models/${f}`, 'utf8');
    let manifest = null;
    const mp = `${ROOT}/src/models/manifests/${id}.json`;
    if (existsSync(mp)) manifest = JSON.parse(await readFile(mp, 'utf8'));
    models.push({ id, title: manifest?.title ?? id, source, manifest });
  }
}
models.sort((a, b) => (a.id < b.id ? -1 : 1));

// Vendor-Texte als Frame-Payloads (Blob-Umschreibung im Frame).
const threeText = await readFile(`${DIST}/vendor-three.bundle.js`, 'utf8').catch(async () => {
  console.error('render: vendor-three.bundle.js fehlt — zuerst npm run build');
  await fallbackRot('vendor-three.bundle.js fehlt');
  process.exit(1);
});
const helpersText = await readFile(`${ROOT}/src/runtime/annotate.js`, 'utf8');

html = html.replace(
  '<link rel="stylesheet" href="./src/shell/theme.css">',
  () => `<style>${css.replace(/<\//g, '<\\/')}</style>`
);
// Payloads vorab pruefen: kein unescaptes </script in eingebetteten Strings.
const modelsJson = scriptSafe(models.map(({ id, title, source, manifest }) => ({ id, title, source, manifest })));
const assetsJson = { three: scriptSafe(threeText), helpers: scriptSafe(helpersText) };
for (const [name, payload] of [['models', modelsJson], ['threeText', assetsJson.three], ['helpersText', assetsJson.helpers]]) {
  if (/<\/script/i.test(payload)) {
    console.error(`render: ABBRUCH unescaptes </script in ${name}`);
    await fallbackRot(`unescaptes </script in ${name}`);
    process.exit(1);
  }
}
html = html.replace(
  '<script id="lab-models" type="application/json">[]</script>',
  () => `<script>window.__LAB_MODELS__=${modelsJson};</script>`
);
html = html.replace(
  '<script type="module" src="./src/shell/main.js"></script>',
  () => `<script>window.__LAB_ASSETS__={threeText:${assetsJson.three},helpersText:${assetsJson.helpers}};</script>\n<script type="module">${appCode}</script>`
);

const bytes = Buffer.byteLength(html, 'utf8');
console.log(`single-file: ${bytes} bytes, modelle: ${models.length}, app-bundle: ${appCode.length}`);
if (bytes > HARD) {
  console.error(`render: ABBRUCH harte Grenze ${HARD} ueberschritten`);
  await fallbackRot(`harte Grenze ${HARD} ueberschritten`);
  process.exit(1);
}
if (bytes > COMFORT) {
  console.error(`render: ABBRUCH Komfortgrenze ${COMFORT} ueberschritten`);
  await fallbackRot(`Komfortgrenze ${COMFORT} ueberschritten`);
  process.exit(1);
}
await writeFile(`${DIST}/lab-player.html`, html);
const sha = createHash('sha256').update(html, 'utf8').digest('hex');
await writeFile(`${DIST}/lab-player.html.sha256`, `${sha}  lab-player.html\n`);
await rm(`${DIST}/FALLBACK-ROT.json`, { force: true });
console.log(`render: OK sha256=${sha.slice(0, 16)}…`);
