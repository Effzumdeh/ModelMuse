/** Repro-Tests Standalone-Guard (E-FREE-FORBID): Torlatte/Kommentar ok, XSS-Flucht weiter FORBID. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FILE = 'dist-standalone/modelmuse-standalone.html';

let html = null;
async function loadHtml() {
  if (!html) {
    html = await readFile(FILE, 'utf8');
    assert.ok(html.length > 100000, 'Artefakt lesbar');
  }
  return html;
}

async function loadGuard() {
  const src = await loadHtml();
  assert.ok(src.includes('__FREE_GUARD_V18__'), 'Guard-Fix-Marker fehlt');
  assert.ok(!src.includes('"parent","top"'), 'altes Wortpaar noch vorhanden');
  const start = src.indexOf('/*__FREE_GUARD_V18__');
  assert.ok(start > 0, 'Guard-Anker (Marker) fehlt');
  const endMark = 'if(code.indexOf("export function init")===-1';
  const end = src.indexOf(endMark, start);
  assert.ok(end > start, 'Guard-Ende fehlt');
  const body = 'var code=String(source||"");' + src.slice(start, end);
  return new Function('source', body + ';return "ok";');
}

const MOD = (extra) => `import { Mesh } from 'three';\nexport const meta = {title:"Torlatte H1",parts:["A","B","C"],category:"hardware"};\nexport function init(c){ ${extra} return {update(){},dispose(){}}; }`;

test('Repro OK: const top = 2.44 (Torlatte)', async () => {
  assert.equal((await loadGuard())(MOD('const top = 2.44;')), 'ok');
});

test('Repro OK: Kommentar und String mit top', async () => {
  assert.equal((await loadGuard())(MOD('const label = "top edge"; // top edge')), 'ok');
});

test('Repro OK: mesh.parent (three.js Property)', async () => {
  assert.equal((await loadGuard())(MOD('var p = mesh.parent;')), 'ok');
});

test('FORBID-Faelle (window.top, parent.document, top.postMessage, eval, Alias)', async () => {
  const g = await loadGuard();
  assert.throws(() => g(MOD('var x = window.top;')), /E-FREE-FORBID: (window|top)/);
  assert.throws(() => g(MOD('var d = parent.document;')), /E-FREE-FORBID/);
  assert.throws(() => g(MOD('top.postMessage("x","*");')), /E-FREE-FORBID: top/);
  assert.throws(() => g(MOD('eval("1");')), /E-FREE-FORBID: eval/);
  assert.throws(() => g(MOD('const t = top;')), /E-FREE-FORBID: top/);
});
