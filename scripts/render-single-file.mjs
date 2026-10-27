/**
 * Rendert dist/lab-player.html: Shell + CSS + App-Bundle inline,
 * Modelle und Vendor-Texte als Payloads (kein Base64, kein CDN).
 * Escaping: `<` -> \u003c in allen eingebetteten Strings.
 * Abbruch bei > 1500000 Bytes (Komfortgrenze).
 * Bauplan Abschnitt 3 (Artefakt) und Abschnitt 8.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;
const COMFORT = 1500000;
const HARD = 2000000;

await mkdir(DIST, { recursive: true });

// App-Bundle: Shell + Runtime + Alpine inline (three bleibt Text-Asset im Frame).
const app = await build({
  entryPoints: [`${ROOT}/src/shell/main.js`],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2017',
  write: false,
  logLevel: 'silent',
});
const appCode = app.outputFiles[0].text;
if (/<\/script/i.test(appCode)) {
  console.error('render: ABBRUCH App-Bundle enthaelt </script');
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
  process.exit(1);
}
html = html.replace(
  '<script id="lab-models" type="application/json">[]</script>',
  () => `<script>window.__PROVIDERS__=${providersJson};</script>\n<script id="lab-models" type="application/json">[]</script>`
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
  process.exit(1);
}
if (bytes > COMFORT) {
  console.error(`render: ABBRUCH Komfortgrenze ${COMFORT} ueberschritten`);
  process.exit(1);
}
await writeFile(`${DIST}/lab-player.html`, html);
const sha = createHash('sha256').update(html, 'utf8').digest('hex');
await writeFile(`${DIST}/lab-player.html.sha256`, `${sha}  lab-player.html\n`);
console.log(`render: OK sha256=${sha.slice(0, 16)}…`);
