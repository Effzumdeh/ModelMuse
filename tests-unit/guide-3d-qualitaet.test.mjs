/** Unittests Guide-3D-Qualitaet (F1–F6, M2/M3/M4/M5/M6): Prompt-Haertung, Gates, Harness-Loop. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { THREE_KNOWN_EXPORTS, repairThreeImports, staticGate } from '../src/runtime/guard-static.js';
import { verifyGeometryLayer, formatP2Protocol } from '../src/runtime/verify.js';
import { decideIteration, failsOf, selectImages, buildP2Prompt, verifyLoopModule } from '../scripts/_harness-loop.mjs';
import { decodePngRgba, pixelDiff, crc32 } from '../scripts/_png-diff.mjs';
import { loadBausteine, selectBausteine, renderBausteine } from '../scripts/_bausteine.mjs';

async function read(p) {
  return readFile(p, 'utf8');
}

/** Benannte three-Exporte aus src/vendor/three.entry.js parsen. */
function entryExports(entrySrc) {
  const m = /export\s*\{([^}]*)\}\s*from\s*['"]three['"]/.exec(entrySrc);
  assert.ok(m, 'three-Exportblock gefunden');
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

/** P1-Importliste (drei-Abschnitt) parsen. */
function p1List(p1) {
  const start = p1.indexOf('Erlaubte Imports aus three');
  const end = p1.indexOf('Zusaetzlich genau ein Addon-Import');
  assert.ok(start >= 0 && end > start, 'P1-Importblock gefunden');
  const block = p1.slice(start, end);
  return [...block.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]).filter((n) => !['Erlaubte', 'Imports', 'ABSCHLIESSEND', 'Namen'].includes(n));
}

test('F1-Option-B: MeshPhysicalMaterial in Bundle, Allowlist und P1-Importliste', async () => {
  const entry = await read('src/vendor/three.entry.js');
  assert.ok(entry.includes('MeshPhysicalMaterial'), 'Bundle exportiert MeshPhysicalMaterial');
  assert.ok(THREE_KNOWN_EXPORTS.includes('MeshPhysicalMaterial'), 'Allowlist spiegelt MeshPhysicalMaterial');
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p1 = await read(f);
    assert.ok(p1List(p1).includes('MeshPhysicalMaterial'), `${f}: Importliste enthaelt MeshPhysicalMaterial`);
    assert.ok(p1.includes('clearcoat'), `${f}: Lack-Rezeptur erhalten`);
  }
  const src = `import { Mesh } from 'three';\nconst m = new MeshPhysicalMaterial({ clearcoat: 0.35 });\nconsole.log(m, Mesh);`;
  assert.ok(repairThreeImports(src).includes('MeshPhysicalMaterial'), 'Repair ergaenzt MeshPhysicalMaterial');
});

test('F1: Bundle-Spiegel exakt (THREE_KNOWN_EXPORTS == three.entry.js)', async () => {
  const names = entryExports(await read('src/vendor/three.entry.js'));
  assert.deepEqual(new Set(THREE_KNOWN_EXPORTS), new Set(names));
});

test('F1: Testmodul mit allen P1-Namen passiert S1 (kein E-S2-BOOT-Grund)', async () => {
  const p1 = await read('prompts/p1-generate.v6-standard.txt');
  const names = p1List(p1);
  assert.ok(names.length >= 30, `Importliste lang genug (${names.length})`);
  const uses = names.map((n) => `void ${n};`).join('\n');
  const src = `import { ${names.join(', ')} } from 'three';\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nimport { addLabel, addMeasurement } from 'wrapper-helpers';\n${uses}\nexport const meta = { title: 'T', category: 'hardware', detailLevel: 1, parts: ['A','B','C'], units: 'm' };\nexport function init() { return { update() {}, dispose() {} }; }`;
  const gate = staticGate(src, {});
  assert.ok(gate.imports.ok, 'Specifier ok');
  assert.deepEqual(repairThreeImports(src), src, 'nichts zu reparieren (byte-identisch)');
});

test('F2: PCFShadowMap vorgeschrieben, PCFSoft nur im Nicht-verwenden-Pin', async () => {
  const entry = await read('src/vendor/three.entry.js');
  assert.ok(entry.includes('PCFShadowMap') && entry.includes('VSMShadowMap'), 'Bundle kennt PCF/VSM');
  assert.ok(THREE_KNOWN_EXPORTS.includes('PCFShadowMap') && THREE_KNOWN_EXPORTS.includes('VSMShadowMap'), 'Allowlist spiegelt PCF/VSM');
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p1 = await read(f);
    assert.ok(p1List(p1).includes('PCFShadowMap'), `${f}: PCFShadowMap in Importliste`);
    assert.ok(!p1List(p1).includes('PCFSoftShadowMap'), `${f}: PCFSoft nicht in Importliste`);
    assert.ok(p1.includes('shadowMap PCFShadowMap'), `${f}: Lichtblock schreibt PCFShadowMap vor`);
    assert.ok(p1.includes('shadow.radius'), `${f}: shadow.radius ergaenzt`);
    const softHits = (p1.match(/PCFSoftShadowMap/g) ?? []).length;
    assert.equal(softHits, 1, `${f}: genau eine PCFSoft-Erwähnung (Nicht-verwenden-Pin)`);
    assert.ok(p1.includes('Nicht verwenden: outputEncoding (heisst outputColorSpace), PCFSoftShadowMap (entfernt, heisst PCFShadowMap).'), `${f}: Pin-Zeile`);
  }
});

test('F3: nur scene.environmentIntensity, keine toten envMapIntensity-Zuweisungen', async () => {
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p1 = await read(f);
    assert.ok(p1.includes('Setze NUR scene.environmentIntensity = 0.55.'), `${f}: Intensitaets-Regel`);
    assert.ok(p1.includes('envMapIntensity je Material bleibt ungesetzt.'), `${f}: envMapIntensity abgestellt`);
  }
  for (const f of ['prompts/p2-repair.txt', 'prompts/p2-repair.v6-harness.txt']) {
    assert.ok(!(await read(f)).includes('envMapIntensity'), `${f}: kein envMapIntensity`);
  }
  for (const f of ['src/models/gpu-example.js']) { // v22 (31.10.2026): Root-Backup gpu-example.js ist seit Bereinigung f292bb1 (30.10.2026) entfernt — nur noch kanonischer Modellpfad
    const src = await read(f);
    assert.ok(!src.includes('envMapIntensity'), `${f}: keine tote Zuweisung`);
    assert.ok(src.includes('scene.environmentIntensity = 0.55'), `${f}: scene.environmentIntensity gesetzt`);
    assert.ok(!src.includes('PCFSoftShadowMap'), `${f}: kein PCFSoftShadowMap`);
    assert.ok(src.includes('PCFShadowMap'), `${f}: PCFShadowMap`);
    assert.ok(src.includes('0xcccccc'), `${f}: heller IBL-Raum`);
    assert.ok(!src.includes('0x11141a'), `${f}: kein Dunkel-Raum`);
  }
});

test('F4: room-Pflicht im Prompt, Gate namensunabhaengig (fromScene-Bezug)', async () => {
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    assert.ok((await read(f)).includes('const room = new Scene();'), `${f}: room-Namenspflicht`);
  }
  const withRoom = `import { Scene } from 'three';\nconst room = new Scene();\nconst w = new Mesh(g, new MeshStandardMaterial({ color: 0xcccccc, side: 1 }));\nroom.add(w);\nconst t = pmrem.fromScene(room, 0.04).texture;`;
  const withEnvScene = `import { Scene } from 'three';\nconst envScene = new Scene();\nconst w = new Mesh(g, new MeshStandardMaterial({ color: 0xcccccc, side: 1 }));\nenvScene.add(w);\nconst t = pmrem.fromScene(envScene, 0.04).texture;`;
  const backfaceOf = (src) => verifyGeometryLayer(src, null).layer.criteria.find((c) => c.id === 'S2-backface');
  assert.equal(backfaceOf(withRoom).verdict, 'pass', 'room-Name passiert');
  assert.equal(backfaceOf(withEnvScene).verdict, 'pass', 'envScene-Name passiert (namensunabhaengig)');
  const real = `import { Scene } from 'three';\nconst room = new Scene();\nconst t = pmrem.fromScene(room, 0.04).texture;\n/*${'p'.repeat(5000)}*/\nconst bad = new Mesh(g, new MeshStandardMaterial({ side: 1 }));`;
  assert.equal(backfaceOf(real).verdict, 'fail', 'echte Rueckseite ausserhalb des Raums faellt');
});

test('F5: side: 1 im Prompt, BackSide-Fallback im Frame-Bootstrap', async () => {
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p1 = await read(f);
    assert.ok(p1.includes('side: 1'), `${f}: numerische Schreibweise`);
    assert.ok(!p1.includes('BackSide'), `${f}: keine BackSide-Konstante`);
  }
  assert.ok(!THREE_KNOWN_EXPORTS.includes('BackSide') && !THREE_KNOWN_EXPORTS.includes('FrontSide'), 'Allowlist ohne Seiten-Konstanten');
  const boot = await read('src/runtime/frame-bootstrap.js');
  assert.ok(boot.includes('backConst') && boot.includes('? NSref.BackSide : 1'), 'numerischer BackSide-Fallback');
  assert.ok(boot.includes('meta: probeMeta()') && boot.includes('pixelDiff: null'), '13-Felder-snapshot (meta + pixelDiff)');
});

test('F6: Versions-Pin im Prompt, api-pin-Datei = Schnittmenge', async () => {
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p1 = await read(f);
    assert.ok(p1.includes('three.js r186 (npm three@0.186.1)'), `${f}: Versions-Pin`);
  }
  const pin = await read('docs/three-186-api-pin.md');
  const entry = entryExports(await read('src/vendor/three.entry.js'));
  const p1names = p1List(await read('prompts/p1-generate.v6-standard.txt'));
  for (const n of p1names) {
    assert.ok(entry.includes(n), `P1-Name im Bundle: ${n}`);
    assert.ok(THREE_KNOWN_EXPORTS.includes(n), `P1-Name in Allowlist: ${n}`);
    assert.ok(pin.includes(n), `P1-Name im api-pin: ${n}`);
  }
  assert.ok(pin.includes('CubeUVReflectionMapping') && pin.includes('Object3D.dispose'), '186→187-Drift dokumentiert');
});

test('M2: decideIteration (gruen/Stagnation/Regression/Budget/Repair)', () => {
  const m = (obj) => new Map(Object.entries(obj));
  assert.equal(decideIteration({ prevFails: null, curFails: m({}), autoRepairs: 0, maxAuto: 2, manualAllowed: false }).action, 'green');
  assert.equal(decideIteration({ prevFails: null, curFails: m({ 'S2:S2-intersect': 'x' }), autoRepairs: 0, maxAuto: 2, manualAllowed: false }).action, 'repair-auto');
  assert.equal(decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '1' }), autoRepairs: 1, maxAuto: 2, manualAllowed: false }).action, 'stagnation');
  assert.equal(decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '2' }), autoRepairs: 1, maxAuto: 2, manualAllowed: false }).action, 'repair-auto');
  const reg = decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '1', b: '9' }), autoRepairs: 1, maxAuto: 2, manualAllowed: false });
  assert.equal(reg.action, 'regression');
  assert.deepEqual(reg.keys, ['b']);
  assert.equal(decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '2' }), autoRepairs: 2, maxAuto: 2, manualAllowed: false }).action, 'budget');
  assert.equal(decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '2' }), autoRepairs: 2, maxAuto: 2, manualAllowed: true }).action, 'repair-manual');
  assert.equal(decideIteration({ prevFails: m({ a: '1' }), curFails: m({ a: '2' }), autoRepairs: 3, maxAuto: 2, manualAllowed: true }).action, 'budget');
});

test('M2: failsOf, buildP2Prompt, verifyLoopModule (S4-Modulgroesse, pixelDiff)', () => {
  const layers = [{ layer: 'S2', criteria: [{ id: 'S2-intersect', verdict: 'fail', expected: 'e', actual: 'a1' }, { id: 'S2-orient', verdict: 'pass', expected: 'e', actual: 'ok' }] }];
  assert.deepEqual([...failsOf(layers).entries()], [['S2:S2-intersect', 'a1']]);
  const prompt = buildP2Prompt({ head: 'KOPF', module: 'MODUL', protocol: 'PROTOKOLL', bausteine: '' });
  assert.ok(prompt.includes('KOPF') && prompt.includes('VORHERIGES MODUL:') && prompt.includes('MODUL') && prompt.includes('PROTOKOLL'));
  const small = `export const meta = { title: 'Titel', category: 'hardware', detailLevel: 1, parts: ['A','B','C'], units: 'm' };\nexport function init() { return { update() {}, dispose() {} }; }`;
  const ok4 = verifyLoopModule(small, {}).layers.find((l) => l.layer === 'S4');
  assert.equal(ok4.criteria.find((c) => c.id === 'S4-modulesize').verdict, 'pass');
  const big = `${small}\n//${'x'.repeat(34010)}`;
  assert.equal(verifyLoopModule(big, {}).layers.find((l) => l.layer === 'S4').criteria.find((c) => c.id === 'S4-modulesize').verdict, 'fail');
  const flick = verifyLoopModule(small, { pixelDiff: 0.0114 }).layers.find((l) => l.layer === 'S2');
  const fr = flick.criteria.find((c) => c.id === 'S2-flicker-render');
  assert.ok(fr && fr.verdict === 'fail', 'pixelDiff 0,0114 meldet Flackern');
});

test('M2/M5: Bild-Policy (max 3, nur S2/S3) + Protokoll mit State/Bildern', () => {
  assert.deepEqual(selectImages(new Map([['S1:S1-size', 'x']]), ['a.png', 'b.png']), [], 'reine S1-Verstoesse ohne Bild');
  assert.deepEqual(selectImages(new Map([['S4:S4-meshcount', 'x']]), ['a.png']), [], 'reine S4-Verstoesse ohne Bild');
  const imgs = selectImages(new Map([['S2:S2-flicker', 'x']]), ['overview=a.png', 'b.png', 'c.png', 'd.png']);
  assert.equal(imgs.length, 3, 'max. 3 Views');
  assert.equal(imgs[0].view, 'overview');
  const layers = [{ layer: 'S2', criteria: [{ id: 'S2-flicker', verdict: 'fail', expected: 'e', actual: 'a' }] }];
  const proto = formatP2Protocol(layers, {
    iteration: 2,
    sceneState: { frames: 42, firstFrameAt: 1183, meshes: 3, triangles: 900, drawCalls: 5, geometries: 2, textures: 1, programs: 2, boxes: [{ id: 'b', min: [0, 0, 0], max: [1, 1, 1] }], backfaceHits: 0, pixelDiff: 0.0114 },
    images: [{ view: 'overview', note: 'n1' }, { view: 'front', note: 'n2' }, { view: 'top', note: 'n3' }, { view: 'detail', note: 'n4' }],
  });
  assert.ok(proto.includes('Iteration 2 von maximal 2'), 'Iterations-Rahmen');
  assert.ok(proto.includes('SZENEN-STATE'), 'Szenen-State angehaengt');
  assert.ok(proto.includes('pixelDiff=0,0114'), 'Pixel-Diff im State');
  assert.ok(proto.includes('BILDER (3 Views'), 'Bilder gedeckelt');
  assert.ok(!proto.includes('[BILD 4]'), 'kein 4. Bild');
});

function pngChunk(type, data) {
  const head = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  head.copy(out, 4);
  out.writeUInt32BE(crc32(head), 8 + data.length);
  return out;
}

/** @param {number} w @param {number} h @param {number[]} rgba */
function makePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba).copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

test('M2: _png-diff (identisch=0, 1px von 100=0,01, Massfehler wirft)', () => {
  const px = new Array(10 * 10 * 4).fill(128);
  const a = decodePngRgba(makePng(10, 10, px));
  assert.equal(pixelDiff(a, decodePngRgba(makePng(10, 10, px))).diff, 0);
  const changed = [...px];
  changed[0] = 0;
  changed[1] = 0;
  changed[2] = 0;
  const d = pixelDiff(a, decodePngRgba(makePng(10, 10, changed)));
  assert.equal(d.different, 1);
  assert.equal(d.diff, 0.01);
  assert.throws(() => pixelDiff(a, decodePngRgba(makePng(5, 5, new Array(100).fill(1)))), /Masse ungleich/);
  assert.throws(() => decodePngRgba(Buffer.from('kein-png')), /keine PNG-Signatur/);
});

test('M3/M4: Negativ-Muster 6+6 und Checklisten-Budgets in P1 und P2', async () => {
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt', 'prompts/p2-repair.v6-harness.txt']) {
    const p = await read(f);
    assert.ok(p.includes('NEGATIV-MUSTER (6 Fehlerklassen, je 1 Negativ + 1 Positiv):'), `${f}: Musterkopf`);
    for (const cls of ['S2-intersect', 'S2-backface', 'S2-flicker', 'S2-orient', 'S2-connect', 'S4-meshcount']) {
      assert.ok(p.includes(`[${cls}] NEGATIV:`), `${f}: Negativ ${cls}`);
      assert.ok(p.includes('POSITIV:'), `${f}: Positiv ${cls}`);
    }
  }
  for (const f of ['prompts/p1-generate.txt', 'prompts/p1-generate.v6-standard.txt']) {
    const p = await read(f);
    assert.ok(p.includes('Checkliste:'), `${f}: Checkliste statt Prosa`);
    assert.ok(p.includes('[ ] Moduldatei unter 34000 Bytes'), `${f}: Budget-Check`);
  }
  const p2 = await read('prompts/p2-repair.v6-harness.txt');
  assert.ok(p2.includes('GEOMETRIE-MESSDATEN (aus dem Browser, nicht aus dem Quelltext):'), 'P2-Messdatenblock');
  for (const s of ['maximal 2', 'FLARE', 'Meshes ≤250', 'keine Markdown-Code-Fences']) {
    assert.ok(p2.includes(s), `P2-Vertrag erhalten: ${s}`);
  }
});

test('M6: Baustein-Katalog laedt, Auswahl nach Fehlerklasse, max 2', async () => {
  const muster = await loadBausteine();
  assert.ok(muster.length >= 6, 'mindestens 6 Muster');
  const sel = selectBausteine(['S2:S2-intersect', 'S4:S4-meshcount', 'S2:S2-flicker'], muster);
  assert.equal(sel.length, 2, 'gedeckelt auf 2');
  assert.equal(sel[0].id, 'intersect-separation');
  assert.equal(sel[1].id, 'meshcount-instancing');
  const block = renderBausteine(sel);
  assert.ok(block.includes('BAUSTEINE') && block.includes('intersect-separation') && block.includes('meshcount-instancing'));
  assert.equal(renderBausteine([]), '');
});
