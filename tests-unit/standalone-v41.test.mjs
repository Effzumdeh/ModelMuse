/**
 * v41-Regression: Export-Menue unten links im Viewer (GLB/PNG/SVG je Modus).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  E1 Menue-Template unten links + Vue-State/Methoden (modusabhängig),
 *  E2 GLB hostseitig (GLTF-Importmap, Grid/Shadow-Filter, Extras, onlyVisible),
 *  E3 PNG-Screenshot (3D-Canvas, 2D-Rasterung), E4 SVG-xmlns + Pixel,
 *  E5 I18N-Keys de/en/es, E7 Renderer-Pflicht im Inline-Prompt.
 * Ablauf: erst bauen (npm run build:standalone), dann Tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HTML = new URL('../dist-standalone/modelmuse-standalone.html', import.meta.url);

async function html() {
  return readFile(HTML, 'utf8');
}

const cnt = (s, sub) => s.split(sub).length - 1;

test('v41-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v41'), 1, 'v41-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v40'), 1, 'v40-Stempel bleibt');
  assert.equal(cnt(s, 'standalone-build v39'), 1, 'v39-Stempel bleibt');
  assert.equal(cnt(s, 'standalone-build v38'), 1, 'v38-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('E1: Menue unten links, modusabhaengig (3D: GLB+PNG, 2D: SVG+PNG)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'id="export-menu"'), 1, 'Menue-Container genau 1x');
  assert.ok(s.includes('absolute bottom-3 left-3'), 'unten links positioniert');
  assert.equal(cnt(s, "v-if=\"viewerMode!=='2d'\" type=\"button\" @click=\"exportGLB\""), 1, 'GLB nur ausserhalb 2D');
  assert.equal(cnt(s, "v-if=\"viewerMode==='2d'\" type=\"button\" @click=\"exportSVG\""), 1, 'SVG nur in 2D');
  assert.equal(cnt(s, '@click="exportPNG"'), 1, 'PNG in beiden Modi');
  assert.equal(cnt(s, 'toggleExportMenu:function'), 1, 'Menue-Methode');
  assert.equal(cnt(s, 'exportGLB:async function'), 1, 'GLB-Methode');
  assert.equal(cnt(s, 'exportPNG:async function'), 1, 'PNG-Methode');
  assert.equal(cnt(s, 'exportSVG:async function'), 1, 'SVG-Methode');
  assert.equal(cnt(s, 'exportFailMsg:function'), 1, 'Fehlertext-Methode');
  assert.equal(cnt(s, 'exportOpen:false'), 1, 'Menue-State');
});

test('E2: GLB hostseitig (Importmap, Filter, Extras, onlyVisible)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'window.__viewer.exportSceneGLB = async function'), 1, 'GLB-Logik genau 1x');
  assert.equal(cnt(s, 'GLTFExporter'), 2, 'GLTFExporter-Import + Konstruktor (0 Bytes)');
  assert.ok(s.includes('three/addons/exporters/GLTFExporter.js'), 'Importmap-Pfad');
  assert.ok(s.includes('__findLabScene()'), 'Szenenzugriff hostseitig');
  assert.ok(s.includes('__autoGrid'), 'GridHelper-Filter');
  assert.ok(s.includes('isShadowMaterial'), 'Shadow-Filter');
  assert.ok(s.includes('userData.labelText'), 'Label-Text als userData (GLB extras)');
  assert.ok(s.includes('userData.measureText'), 'Messwert als userData (GLB extras)');
  assert.ok(s.includes('onlyVisible: true'), 'Part-Ausblendung wirkt');
});

test('E3/E4: PNG-Screenshot + SVG mit xmlns-Fix', async () => {
  const s = await html();
  assert.equal(cnt(s, 'window.__viewer.exportViewPNG = async function'), 1, 'PNG-Logik genau 1x');
  assert.ok(s.includes("toDataURL(\"image/png\")"), 'Screenshot aktuelle Ansicht');
  assert.ok(s.includes('preserveDrawingBuffer'), 'Buffer-Hinweis vorhanden');
  assert.equal(cnt(s, 'window.__viewer.exportDiagramFile = function'), 1, 'SVG-Download genau 1x');
  assert.equal(cnt(s, 'window.__viewer.exportSVGText = function'), 1, 'SVG-Serialisierung genau 1x');
  assert.equal(cnt(s, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"'), 5, 'xmlns in allen 5 Inline-Tags');
});

test('E5: I18N-Keys de/en/es (kein clash mit Quellcode-Export)', async () => {
  const s = await html();
  for (const k of ['saveModel:', 'saveGlb:', 'savePng:', 'saveSvg:', 'saveOk:', 'saveErr:', 'saveNone:', 'saveNoSvg:']) {
    assert.equal(cnt(s, k), 3, k + ' je Sprache');
  }
  assert.ok(s.includes('saveModel:"Speichern"'), 'de Speichern');
  assert.ok(s.includes('saveModel:"Save"'), 'en Save');
  assert.ok(s.includes('saveModel:"Guardar"'), 'es Guardar');
  assert.ok(s.includes('GLB (3D-Modell)'), 'de GLB');
  assert.ok(s.includes('GLB (3D model)'), 'en GLB');
  assert.ok(s.includes('GLB (modelo 3D)'), 'es GLB');
});

test('E8: v38-Destructure-Luecke geschlossen (registerFree funktionsfaehig)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'OctahedronGeometry, OrthographicCamera, PCFShadowMap'), 1, 'Destructure-Eintrag genau 1x');
  assert.ok(!s.includes('OctahedronGeometry, PCFShadowMap'), 'Luecke geschlossen');
});

test('E7: Renderer-Pflicht im Inline-Freimodus-Prompt', async () => {
  const s = await html();
  assert.equal(
    cnt(s, 'Renderer-Pflicht: new WebGLRenderer({antialias:true, preserveDrawingBuffer:true}) (PNG-Export braucht den Buffer).'),
    1, 'Prompt-Pflicht genau 1x');
});
