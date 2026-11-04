/**
 * v56-Regression: Modelliste 6->4 (si-1 + demo-2d-chart raus).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  R1 si-1 + demo-2d-chart raus (LABS/META/INIT + ES/FR/MEAS/SOURCES, de/en/es/fr),
 *  R2 force2D-Default kuratiert (gpu-example), R3 Showcase-Marker 4 Modelle.
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

const KEEP = ['arch-brandenburger-tor', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example'];
const GONE = ['si-1', 'demo-2d-chart'];

test('v56-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v56'), 1, 'v56-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v55'), 1, 'v55-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('R1: 4 LABS kuratiert (je mit explanations de/en/es/fr)', async () => {
  const s = await html();
  for (const id of KEEP) {
    assert.equal(cnt(s, `{id:"${id}",track`), 1, `LABS-Eintrag: ${id}`);
    assert.ok(cnt(s, `META['${id}']`) >= 1, `META-Eintrag: ${id}`);
    assert.equal(cnt(s, `INIT['${id}'] = `), 1, `3D-INIT: ${id}`);
  }
  assert.equal(cnt(s, 'explanations:{de:['), 4, '4 LABS mit explanations');
});

test('R1: si-1 + demo-2d-chart raus (LABS/META/INIT/ES/FR/MEAS/SOURCES)', async () => {
  const s = await html();
  for (const id of GONE) {
    assert.equal(cnt(s, `{id:"${id}",track`), 0, `LABS raus: ${id}`);
    assert.equal(cnt(s, `{id:"${id}"`), 0, `kein LABS-Rest: ${id}`);
    assert.equal(cnt(s, `META['${id}']`), 0, `META raus: ${id}`);
    assert.equal(cnt(s, `INIT['${id}'] = `), 0, `INIT raus: ${id}`);
    assert.equal(cnt(s, `"${id}":{title`), 0, `ES/FR raus: ${id}`);
    assert.equal(cnt(s, `"${id}":"`), 0, `MEAS/SOURCES raus: ${id}`);
  }
  assert.equal(cnt(s, 'meta_si_1'), 0, 'meta_si_1 raus');
  assert.equal(cnt(s, 'meta_demo_2d_chart'), 0, 'meta_demo_2d_chart raus');
  assert.equal(cnt(s, 'const meta_i18n_si_1 = {'), 0, 'meta_i18n_si_1 raus');
  assert.equal(cnt(s, ', fr: { title:'), 4, 'meta_i18n-Konstanten fr (4 Modelle)');
  assert.equal(cnt(s, 'diagram2d:{"variant"'), 0, 'kein diagram2d-Payload');
  assert.equal(cnt(s, '.diagram2d = {"variant"'), 0, 'kein META-diagram2d');
});

test('R1: Titel/Quiz der Entfernten weg, Behaltene belegt', async () => {
  const s = await html();
  assert.equal(cnt(s, ',fr:"Poste PC (SI-1)"}'), 0, 'si-1-Titel fr raus');
  assert.equal(cnt(s, '"fr":"Comparaison de rendement"}'), 0, 'chart-Titel fr raus');
  assert.equal(cnt(s, 'title:{de:"PC-Arbeitsplatz",en:"PC-Arbeitsplatz",es:"PC-Arbeitsplatz",fr:"Poste PC (SI-1)"}'), 0, 'si-1-Titel de/en/es/fr raus');
  assert.equal(cnt(s, 'de:"Grafikkarte"'), 1, 'gpu DE-Titel bleibt');
  assert.equal(cnt(s, 'Quel composant appartient à'), 4, 'Quiz-Frage fr (4 kuratierte)');
  assert.equal(cnt(s, 'Aucun de ceux-ci'), 5, 'Quiz-Option fr (4 + makeFreeLab)');
  assert.equal(cnt(s, 'figure dans la liste.'), 5, 'Quiz-Rationale fr (4 + makeFreeLab)');
});

test('R2/R3: force2D-Default kuratiert, Showcase-Marker 4', async () => {
  const s = await html();
  assert.ok(s.includes("self._currentId || 'gpu-example'"), 'force2D-Default gpu-example');
  assert.equal(cnt(s, "self._currentId || 'si-1'"), 0, 'force2D-Default si-1 weg');
  assert.equal(cnt(s, 'showcase: 4 Modelle'), 1, 'Showcase-Marker 4');
  assert.equal(cnt(s, 'showcase: 5 Modelle'), 0, 'alter Marker weg');
});

test('R4: Vendor-IIFE + 2D-Freemodus bleiben', async () => {
  const s = await html();
  for (const v of ['__V14SVG', '__V14MERMAID', '__V14CHART', '__V14D3', '__V14KATEX', '__renderVariant2D']) {
    assert.ok(cnt(s, v) >= 3, `${v} bleibt`);
  }
  assert.equal(cnt(s, '"2d-svg","2d-mermaid","2d-chart","2d-d3","2d-katex"'), 1, 'registerFree 2D-Allowlist bleibt');
});
