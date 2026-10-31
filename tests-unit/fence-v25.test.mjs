/** v25 Fence-Robustheit (Live-Meldung 31.10.2026: [14264Z,fence:nein] E-FREE-FORBID: window).
 * - Prompt verlangt wieder ```js-Block als einzigen Output (generate + modify).
 * - Extraktion tolerant: ohne Fence heuristisch ab 'export const meta'
 *   (Import-Block davor erhalten) bis Dateiende.
 * - Guard NUR auf extrahiertem Code: Prosa mit 'window' wird nie gescannt,
 *   echtes 'window' IM Code bleibt FORBID.
 * Arbeitet gegen das echte Artefakt (kein Mock): Prompt-/Marker-Invarianten
 * am HTML, registerFree aus dem HTML geladen wie in der UI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FILE = 'dist-standalone/modelmuse-standalone.html';
const START = 'window.__viewer.registerFree=function(id,source){';
const END = 'return {meta:meta,metaI18n:r.meta_i18n||null};};';

let html = null;
async function loadHtml() {
  if (!html) {
    html = await readFile(FILE, 'utf8');
    assert.ok(html.length > 100000, 'Artefakt lesbar');
  }
  return html;
}

async function loadRegisterFree() {
  const s = await loadHtml();
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
  return factory(fakeWindow, INIT, META);
}

let seq = 0;
async function regOk(quelle) {
  const fn = await loadRegisterFree();
  seq += 1;
  const r = fn(`free-v25-${seq}`, quelle);
  assert.equal(r.meta.title, 'Handbohrmaschine');
  assert.deepEqual(r.meta.parts, ['Gehaeuse', 'Motor', 'Bohrfutter']);
  return r;
}

/** UI-Extraktion wie im Artefakt (generate/modify, v25: Fence sonst heuristisch). */
function uiExtract(text) {
  let quelle = text;
  const fm = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/.exec(text);
  if (fm && fm[1]) { quelle = fm[1]; }
  else {
    const mi = quelle.indexOf('export const meta');
    if (mi >= 0) {
      const im = quelle.search(/^\s*import[ \t]/m);
      quelle = quelle.slice((im >= 0 && im < mi) ? im : mi);
      const tail = quelle.lastIndexOf('}');
      if (tail > 0) quelle = quelle.slice(0, tail + 1);
    }
  }
  return quelle.trim();
}

const MODUL = `import { Scene, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { addLabel } from 'wrapper-helpers';
export const meta = { title: "Handbohrmaschine", category: "hardware", detailLevel: 2, parts: ["Gehaeuse","Motor","Bohrfutter"], units: "m" };
export function init(c, p) { const s = new Scene(); const m = new Mesh(); addLabel(s, "Gehaeuse", [0,0,0], { id: "a", level: "aufbau", sizePx: 16, leader: true }); return { update(patch) {}, dispose() {} }; }`;

/** Prosa wie live: enthaelt das Wort window mehrfach, KEIN Fence, KEIN Modul. */
function prosePad(targetLen) {
  const para = 'Hinweis zum Einbetten: Das Modell braucht keinen window-Resize-Listener '
    + '(kein window-Event, keine window-Groesse abfragen) — nur container und renderer.domElement anfassen. ';
  let out = 'Gerne! Hier ist dein Modell als 3D-Ansicht.\n\n';
  while (out.length < targetLen) out += para;
  return out.slice(0, targetLen) + '\n\n';
}

test('v25 Prompt: Fence-Pflicht (generate + modify), altes Verbot weg', async () => {
  const s = await loadHtml();
  assert.equal(s.split('```js-Codeblock').length - 1, 2, 'Fence-Pflicht je 1x generate/modify');
  assert.equal(s.split('keine Erklaerung, keine Fences').length - 1, 0, 'altes Fence-Verbot entfernt');
  assert.ok(s.includes('standalone-build v25'), 'v25-Stempel');
  assert.ok(s.includes('__FREE_FENCE_V25__'), 'Guard-nur-Code-Marker');
});

test('v25 Live-Repro fence:nein: 14k-Prosa mit window + fence-loser Code laeuft durch', async () => {
  const raw = prosePad(13750) + MODUL + '\nViel Erfolg beim Lernen!\n';
  assert.ok(raw.length >= 14000 && raw.length < 15000, `Simulationsgroesse 14k: ${raw.length}`);
  assert.equal(/```/.test(raw), false, 'fence:nein');
  assert.ok(/\bwindow\b/.test(raw), 'Prosa enthaelt Stolperwort window');
  // UI-Weg: heuristische Extraktion, dann Guard nur auf Code.
  const ext = uiExtract(raw);
  assert.ok(ext.startsWith('import'), 'Import-Block erhalten');
  assert.ok(ext.includes('export const meta') && ext.includes('export function init'), 'Modul extrahiert');
  assert.equal(/\bwindow\b/.test(ext), false, 'extrahierter Code ohne Prosa-window');
  await regOk(ext);
});

test('v25 Guard-nur-Code: Gesamttext inkl. Prosa direkt an registerFree bleibt ok', async () => {
  const raw = prosePad(13750) + MODUL + '\nViel Erfolg beim Lernen!\n';
  // Defensiv-Slice in registerFree schneidet Prosa vor dem FORBID-Scan ab.
  await regOk(raw);
});

test('v25 Fence-ja: Prosa mit window ausserhalb, Modul im ```js-Block', async () => {
  const raw = prosePad(13750) + '```js\n' + MODUL + '\n```\nDanach noch Prosa mit window-Wort.\n';
  const fm = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/.exec(raw);
  assert.ok(fm && fm[1], 'fence:ja erkannt');
  await regOk(uiExtract(raw));
});

test('v25 True-Positive: window IM Code bleibt E-FREE-FORBID', async () => {
  const fn = await loadRegisterFree();
  seq += 1;
  const bad = MODUL.replace(
    'return { update(patch) {}, dispose() {} };',
    'const w = window.top; return { update(patch) {}, dispose() {} };',
  );
  assert.throws(() => fn(`free-v25-${seq}`, bad), /E-FREE-FORBID: (window|top)/);
});

test('v25 Shape bleibt: Prosa ohne Modul faellt ehrlich auf E-FREE-SHAPE', async () => {
  const fn = await loadRegisterFree();
  seq += 1;
  assert.throws(
    () => fn(`free-v25-${seq}`, prosePad(500) + 'Leider kein Modul dabei.\n'),
    /E-FREE-SHAPE/,
  );
});
