/** Unittests S1-Statik (node-Testrunner, kein Playwright-Ueberkill). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripComments, maskStrings, scanForbidden, checkSize, checkImports, checkMeta, staticGate,
  repairThreeImports,
} from '../src/runtime/guard-static.js';

test('stripComments entfernt Zeilen- und Blockkommentare, laesst Strings', () => {
  const out = stripComments('const a = 1; // fetch\n/* window */ const s = "document";');
  assert.ok(!out.includes('fetch'));
  assert.ok(out.includes('"document"'));
});

test('scanForbidden findet eval/Function/fetch/document/window/parent/top/Speicher', () => {
  for (const tok of ['eval(', 'fetch(', 'document', 'window', 'parent', 'localStorage', 'navigator']) {
    const hits = scanForbidden(`x ${tok} y`);
    assert.ok(hits.length >= 1, tok);
  }
});

test('scanForbidden wirft nie und meldet Offset/Kontext', () => {
  const hits = scanForbidden('export const meta={}; export function init(){ fetch("http://x"); }');
  assert.equal(hits[0].token, 'fetch');
  assert.ok(typeof hits[0].offset === 'number' && hits[0].context.length > 0);
  assert.deepEqual(scanForbidden('const harmlos = 1;'), []);
});

test('checkSize: green/yellow/reject an 1.5M/2.0M', () => {
  assert.equal(checkSize(100, { comfort: 1500000, hard: 2000000 }).tier, 'green');
  assert.equal(checkSize(1500001, { comfort: 1500000, hard: 2000000 }).tier, 'yellow');
  assert.equal(checkSize(2000001, { comfort: 1500000, hard: 2000000 }).tier, 'reject');
});

test('checkImports: nur three/wrapper-helpers/OrbitControls-Addon ok', () => {
  const ok = checkImports('import { Scene } from "three";\nimport { addLabel } from "wrapper-helpers";\nimport { OrbitControls } from "three/addons/controls/OrbitControls.js";');
  assert.ok(ok.ok);
  const bad = checkImports('import x from "http://evil/x.js";');
  assert.ok(!bad.ok && bad.offending.length === 1);
  const dyn = checkImports('const m = await import("three");');
  assert.ok(!dyn.ok);
});

test('checkMeta: vollstaendig ok, Luecken gemeldet', () => {
  const good = checkMeta({ title: 'PC-Arbeitsplatz', category: 'hardware', detailLevel: 2, parts: ['A', 'B', 'C'], units: 'm' });
  assert.ok(good.ok);
  const bad = checkMeta({ title: 'x', category: 'mars', parts: ['A'] });
  assert.ok(!bad.ok && bad.missing.length > 0 && bad.invalid.length > 0);
});

test('staticGate aggregiert E-S1-* ohne Wurf', () => {
  const gate = staticGate('export const meta={}; export function init(){ fetch("http://x"); }', {});
  assert.ok(gate.hits.length > 0 && gate.ok === false);
});

test('S1-Verbotsangriffe aus Bauplan werden alle abgelehnt', () => {
  const attacks = [
    'export const meta={}; export function init(){ fetch("http://x"); }',
    'export const meta={}; export function init(c){ document.body.innerHTML="x"; }',
    'import x from "http://evil/x.js"; export const meta=x; export function init(){ }',
  ];
  for (const src of attacks) {
    const gate = staticGate(src, {});
    assert.ok(gate.hits.length > 0 || !gate.imports.ok, src.slice(0, 40));
  }
});

test('maskStrings behaelt Offsets bei', () => {
  const code = 'const s = "fetch"; fetch(';
  const masked = maskStrings(code);
  assert.equal(masked.length, code.length);
  assert.deepEqual(scanForbidden(masked).map((h) => h.token), ['fetch']);
});

test('repairThreeImports ergaenzt fehlendes Scene (E-S2-BOOT "Scene is not defined")', () => {
  const src = `import { Mesh } from 'three';\nexport const meta = {};\nexport function init(c){ const s = new Scene(); return { update(){}, dispose(){} }; }`;
  const out = repairThreeImports(src);
  assert.ok(/import \{[^}]*\bMesh\b[^}]*\bScene\b[^}]*\} from 'three'/.test(out), out.slice(0, 120));
  assert.ok(checkImports(out).ok, 'Specifier weiter S1-ok');
});

test('repairThreeImports stellt fehlende Import-Zeile voran, fasst Helper/OrbitControls an', () => {
  const src = `export const meta = {};\nexport function init(c){ const s = new Scene(); addLabel(s, 'x', [0,0,0]); new OrbitControls(); return { update(){}, dispose(){} }; }`;
  const out = repairThreeImports(src);
  assert.ok(out.includes(`from 'three'`) && out.includes('Scene'), out.slice(0, 200));
  assert.ok(out.includes(`from 'wrapper-helpers'`) && out.includes('addLabel'), out.slice(0, 300));
  assert.ok(out.includes('three/addons/controls/OrbitControls.js'), out.slice(0, 400));
  assert.ok(checkImports(out).ok, 'Specifier weiter S1-ok');
});

test('repairThreeImports ist byte-identisch bei Vollstaendigkeit, ignoriert Strings/Props/Lokale', () => {
  const src = `import { Scene, Mesh } from 'three';\nconst Scene2 = 'Scene';\nexport const meta = {};\nexport function init(c){ const m = new Mesh(); o.Scene; const Group = 1; return { update(){}, dispose(){} }; }`;
  assert.equal(repairThreeImports(src), src);
});
