/** v24: registerFree nimmt gueltige Module mit nicht-zeilenstartenden Imports an.
 * Repro: zwei Imports in einer Zeile / `;import` nach Code (Modell-Output
 * "Provide code only") ueberlebten den zeilenverankerten Fix3-Strip
 * (/^\s*import.../gm) -> new Function (Classic, kein Modul) warf
 * "Cannot use import statement outside a module", UI zeigte
 * "Quelle ungueltig oder nicht nutzbar. ...".
 * Erwartung: v24-Strip (positionsunabhaengig, string-/kommentar-sicher ueber
 * die offset-gleiche Maske) entfernt alle statischen Imports; Reste
 * (import.meta, dynamisches import()) werden klassifiziert (E-FREE-*),
 * nie als Engine-SyntaxError durchgereicht.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FILE = 'dist-standalone/modelmuse-standalone.html';
const START = 'window.__viewer.registerFree=function(id,source){';
const END = 'return {meta:meta,metaI18n:r.meta_i18n||null};};';

let registerFree = null;
let seq = 0;

async function loadRegisterFree() {
  if (registerFree) return registerFree;
  const s = await readFile(FILE, 'utf8');
  const a = s.indexOf(START);
  assert.ok(a > 0, 'registerFree-Anker fehlt');
  const b = s.indexOf(END, a);
  assert.ok(b > a, 'registerFree-Ende fehlt');
  const fnSrc = s.slice(a + 'window.__viewer.registerFree='.length, b + END.length);
  const m = /ALLOWED_THREE=\[([^\]]*)\]/.exec(fnSrc);
  assert.ok(m, 'THREE-Allowlist fehlt');
  const threeNames = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(threeNames.length > 20, 'THREE-Allowlist zu kurz');
  const decls = threeNames.map((n) => `var ${n} = function ${n}(){};`).join('')
    + 'var addLabel=function(){};var addMeasurement=function(){};var clearAnnotations=function(){};';
  const factory = new Function('window', 'INIT', 'META', `${decls};var registerFree=${fnSrc};return registerFree;`);
  const INIT = {};
  const META = {};
  const fakeWindow = { __OrbitControls: function () {} };
  const fn = factory(fakeWindow, INIT, META);
  registerFree = { fn, INIT, META };
  return registerFree;
}

const META_LINE = 'export const meta = {title:"Fussballfeld Arena",parts:["Tor","Linie","Rasen"],category:"sonstiges"};';
const mod = (imp, body = 'return {update(){},dispose(){}};') =>
  `${imp}\n${META_LINE}\nexport function init(c,p){ ${body} }`;

async function regOk(quelle, body) {
  const { fn, INIT } = await loadRegisterFree();
  seq += 1;
  const id = `free-v24-${seq}`;
  const r = fn(id, quelle);
  assert.equal(r.meta.title, 'Fussballfeld Arena');
  assert.equal(r.meta.parts.length, 3);
  if (body !== false) {
    const h = INIT[id]({}, {});
    assert.equal(typeof h.update, 'function');
    assert.equal(typeof h.dispose, 'function');
  }
  return r;
}

test('v24 Basis: Imports am Zeilenanfang (Regression)', async () => {
  await regOk(mod(`import { Scene } from 'three';\nimport { addLabel } from 'wrapper-helpers';`));
});

test('v24 Repro: zwei Imports in einer Zeile', async () => {
  await regOk(mod(`import { Scene } from 'three'; import { addLabel } from 'wrapper-helpers';`));
});

test('v24 Repro: Import nach Code auf derselben Zeile', async () => {
  await regOk(mod(`const x = 1;import { Scene } from 'three';`));
});

test('v24 Repro: Side-effect-Import mitten in Zeile', async () => {
  await regOk(mod(`const x = 1;import 'three';`));
});

test('v24: mehrzeiliger Importblock + Tab-Einzug', async () => {
  await regOk(mod(`\timport {\n\tScene,\n\tMesh\n} from 'three';\n\timport { addLabel } from "wrapper-helpers";`));
});

test('v24: CRLF-Zeilenenden', async () => {
  await regOk(mod(`import { Scene } from 'three';\r\nimport { addLabel } from 'wrapper-helpers';\r\n`));
});

test('v24: String mit import-Wortlaut bleibt intakt, kein Ueber-Strip', async () => {
  const { INIT } = await loadRegisterFree();
  seq += 1;
  const id = `free-v24-${seq}`;
  const { fn } = await loadRegisterFree();
  const quelle = mod(
    `import { Scene } from 'three';`,
    `const label = 'Tor importiert aus Stahl'; return {update(){},dispose(){},tag:label};`,
  ) + `\n// Import-Liste: Scene, Mesh (Kommentar mit import-Wort)`;
  const r = fn(id, quelle);
  assert.equal(r.meta.title, 'Fussballfeld Arena');
  assert.equal(INIT[id]({}, {}).tag, 'Tor importiert aus Stahl');
});

test('v24: dynamisches import() -> E-FREE-FORBID (klassifiziert)', async () => {
  const { fn } = await loadRegisterFree();
  seq += 1;
  assert.throws(() => fn(`free-v24-${seq}`, mod(`import { Scene } from 'three';`, `const t = import('three'); return {update(){},dispose(){}};`)), /E-FREE-FORBID: import\(/);
});

test('v24: import.meta-Rest -> E-FREE-SHAPE statt Engine-SyntaxError', async () => {
  const { fn } = await loadRegisterFree();
  seq += 1;
  assert.throws(() => fn(`free-v24-${seq}`, mod(`import { Scene } from 'three';`, `const u = import.meta.url; return {update(){},dispose(){}};`)), /E-FREE-SHAPE: import verblieben/);
});

test('v24: unerlaubter Specifier -> E-FREE-IMPORT (Fail-closed bleibt)', async () => {
  const { fn } = await loadRegisterFree();
  seq += 1;
  assert.throws(() => fn(`free-v24-${seq}`, mod(`import { x } from 'https://cdn.example/x.js';`)), /E-FREE-IMPORT/);
});

test('v24: simuliertes 5500-Token-Modul (finish stop) laeuft durch', async () => {
  // ~5500 Tokens ~= ~22000 Zeichen: Rumpf als reine Daten aufblaehen
  // (API-frei, damit INIT im Node-Stub laeuft; Groesse kommt aus Text).
  const rows = [];
  for (let i = 0; i < 900; i += 1) {
    rows.push(`["teil-${i}", ${(i % 50) + 1}, ${(i * 7) % 20}, ${i % 30}]`);
  }
  const body = `const spec = [${rows.join(',')}]; let sum = 0; for (let k = 0; k < spec.length; k += 1) { sum += spec[k][1] + spec[k][2] + spec[k][3]; } return {update(){},dispose(){},sum:sum};`;
  const quelle = mod(`import { Scene, Mesh, BoxGeometry, MeshStandardMaterial } from 'three'; import { addLabel } from 'wrapper-helpers';`, body);
  assert.ok(quelle.length > 20000, `Simulationsgroesse: ${quelle.length}`);
  // Generate-Pfadschritte (Fence-Extraktion + Shape-Check) wie im UI:
  const text = `\`\`\`javascript\n${quelle}\n\`\`\``;
  let ext = text;
  const fm = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/.exec(text);
  if (fm && fm[1]) ext = fm[1];
  ext = ext.trim();
  assert.ok(ext.indexOf('export const meta') !== -1 && ext.indexOf('export function init') !== -1, 'Shape-Check');
  await regOk(ext);
});
