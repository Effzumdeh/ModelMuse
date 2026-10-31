/** Unittests Bauteil-Toggles + Harness-Test pro Teil (rein, ohne DOM/Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  partEntries, toggleHidden, hasLabelCall, checkPart, checkAllParts,
  normalizePartName, partNameVariants, assignPartMeshes, formatPartWarnings,
  extractMeshIdentifiers, checkPartMeshCoverage, stemPartToken,
} from '../src/runtime/parts.js';
import { registerPartGroups, applyPartVisibility } from '../src/runtime/annotate.js';

const SRC =
  `export const meta = { title: 'Windrad', category: 'demo', detailLevel: 2, parts: ['Mast','Rotor','Gondel'], units: 'm' };\n` +
  `import { addLabel } from 'wrapper-helpers';\n` +
  `addLabel(root, 'Mast', [0,0,0], { id: 'l1' });\n` +
  `addLabel(root, 'Rotor', [0,1,0], { id: 'l2' });\n` +
  `addLabel(root, 'Gondel', [0,2,0], { id: 'l3' });\n` +
  `export function init(c, p) { return { update(patch) {}, dispose() {} }; }`;
const MAN = { labels: ['Mast', 'Rotor', 'Gondel'] };

test('partEntries: Index+Name aus Manifest', () => {
  assert.deepEqual(partEntries(MAN), [
    { index: 0, name: 'Mast' },
    { index: 1, name: 'Rotor' },
    { index: 2, name: 'Gondel' },
  ]);
  assert.deepEqual(partEntries({}), []);
  assert.deepEqual(partEntries(null), []);
});

test('toggleHidden: an/aus, sortiert, duplikatfrei', () => {
  assert.deepEqual(toggleHidden([], 1), [1]);
  assert.deepEqual(toggleHidden([1], 1), []);
  assert.deepEqual(toggleHidden([2], 0), [0, 2]);
  assert.deepEqual(toggleHidden([1, 1], 2), [1, 2]);
});

test('hasLabelCall: exakter Text, keine Teiltreffer', () => {
  assert.equal(hasLabelCall(SRC, 'Mast'), true);
  assert.equal(hasLabelCall(SRC, 'Rotor'), true);
  assert.equal(hasLabelCall(SRC, 'Mastodon'), false);
  assert.equal(hasLabelCall(SRC, 'Turm'), false);
});

test('checkPart: pass bei vollem Nachweis, fail bei Luecke', () => {
  const ok = checkPart(SRC, MAN, 0);
  assert.equal(ok.verdict, 'pass');
  assert.equal(ok.criteria.length, 3);
  const noSrc = checkPart('export const meta = {};', MAN, 0);
  assert.equal(noSrc.verdict, 'fail');
  assert.ok(noSrc.criteria.some((c) => c.id === 'part-label-quelle' && c.verdict === 'fail'));
  const noMan = checkPart(SRC, { labels: ['Anderes'] }, 0);
  assert.equal(noMan.verdict, 'fail');
  const badIdx = checkPart(SRC, MAN, 9);
  assert.equal(badIdx.verdict, 'fail');
});

test('checkAllParts: 3/3 pass, 0 Teile = fail', () => {
  const all = checkAllParts(SRC, MAN);
  assert.equal(all.count, 3);
  assert.equal(all.passed, 3);
  assert.equal(all.verdict, 'pass');
  const empty = checkAllParts(SRC, { labels: [] });
  assert.equal(empty.verdict, 'fail');
});

test('normalizePartName: de/en/es-Normalisierung', () => {
  assert.equal(normalizePartName('Eckfahne'), 'eckfahne');
  assert.equal(normalizePartName('ECK-FAHNE '), 'eckfahne');
  assert.equal(normalizePartName('Größe'), 'grosse');
  assert.equal(normalizePartName('Straße'), 'strasse');
  assert.equal(normalizePartName('línea'), 'linea');
  assert.equal(normalizePartName('LÍNEAS'), 'lineas');
  assert.equal(normalizePartName('  Tor! '), 'tor');
  assert.equal(normalizePartName(''), '');
  assert.equal(normalizePartName(null), '');
});

test('partNameVariants: kanonisch + Uebersetzungen, entdupliziert', () => {
  assert.deepEqual(partNameVariants('Eckfahne', ['corner flag', 'bandera']), ['eckfahne', 'cornerflag', 'bandera']);
  assert.deepEqual(partNameVariants('Tor', ['goal', 'porteria']), ['tor', 'goal', 'porteria']);
  assert.deepEqual(partNameVariants('x', ['y']), []);
});

test('stemPartToken: Plural-Staemme, kurze Woerter unversehrt', () => {
  assert.equal(stemPartToken('linien'), 'lini');
  assert.equal(stemPartToken('seitenlinie'), 'seitenlini');
  assert.equal(stemPartToken('lineas'), 'linea');
  assert.equal(stemPartToken('flags'), 'flag');
  assert.equal(stemPartToken('tor'), 'tor');
  assert.equal(stemPartToken('rasen'), 'rase');
  assert.equal(stemPartToken('mast'), 'mast');
});

// Live-Befund Fussballfeld: Eckfahne (4x) / Linien (alle) / Tor (nicht Rasenmuster).
test('assignPartMeshes: Fussballfeld trifft alle Familien, Tor nicht Rasen', () => {
  const labels = ['Eckfahne', 'Linien', 'Tor', 'Rasen'];
  const meshes = ['eckfahne1', 'eckfahne2', 'eckfahne3', 'eckfahne4', 'seitenlinie', 'mittellinie', 'torpfosten', 'rasenmuster'];
  const r = assignPartMeshes(labels, meshes);
  assert.deepEqual(r.groups[0].sort(), ['eckfahne1', 'eckfahne2', 'eckfahne3', 'eckfahne4']);
  assert.deepEqual(r.groups[1].sort(), ['mittellinie', 'seitenlinie']);
  assert.deepEqual(r.groups[2], ['torpfosten']);
  assert.deepEqual(r.groups[3], ['rasenmuster']);
  assert.deepEqual(r.unassigned, []);
  assert.deepEqual(r.warnings, []);
});

test('assignPartMeshes: Standard-Gruppe + Warnungen beidseitig', () => {
  const r = assignPartMeshes(['Tor', 'Anstoss'], ['torpfosten', 'zaun', 'x']);
  assert.deepEqual(r.groups[0], ['torpfosten']);
  assert.deepEqual(r.groups[2].sort(), ['x', 'zaun']);
  assert.deepEqual(r.unassigned.sort(), ['x', 'zaun']);
  const types = r.warnings.map((w) => w.type);
  assert.ok(types.includes('label-ohne-mesh'), 'Anstoss ohne Mesh');
  assert.ok(types.includes('mesh-ohne-treffer'), 'zaun/x ohne Treffer');
  const labelWarn = r.warnings.find((w) => w.type === 'label-ohne-mesh');
  assert.equal(labelWarn.label, 'Anstoss');
});

test('assignPartMeshes: laengster Treffer gewinnt, Uebersetzungen helfen', () => {
  const r = assignPartMeshes(['Linie', 'Liniennetz'], ['liniennetz'], { translations: [[], []] });
  assert.deepEqual(r.groups[1], ['liniennetz']);
  const t = assignPartMeshes(['Tor'], ['goalpost'], { translations: [['goal', 'porteria']] });
  assert.deepEqual(t.groups[0], ['goalpost']);
  assert.deepEqual(t.warnings, []);
});

test('formatPartWarnings: de/en/es/fr ohne Secrets', () => {
  const w = [{ type: 'label-ohne-mesh', label: 'Eckfahne' }, { type: 'mesh-ohne-treffer', mesh: 'zaun' }];
  const de = formatPartWarnings(w, 'de');
  assert.ok(de[0].startsWith('WARNUNG') && de[0].includes('Eckfahne'));
  assert.ok(de[1].includes('Standard-Gruppe'));
  assert.ok(formatPartWarnings(w, 'en')[0].startsWith('WARNING'));
  assert.ok(formatPartWarnings(w, 'es')[0].startsWith('AVISO'));
  assert.ok(formatPartWarnings(w, 'fr')[0].startsWith('AVERTISSEMENT'));
  assert.ok(formatPartWarnings(w, 'fr')[1].startsWith('NOTE'));
});

test('extractMeshIdentifiers: Variablen + .name-Literale', () => {
  const src = `const eckfahne1 = new Mesh(g, m);\nconst pins = new InstancedMesh(g, m, 4);\nfoo.name = 'Tor';\nconst x = new Group();`;
  assert.deepEqual(extractMeshIdentifiers(src), ['eckfahne1', 'pins', 'x', 'Tor']);
});

test('checkPartMeshCoverage: Selbst-Check mit WARNUNG statt Rot', () => {
  const src = `registerPartGroups(root, meta.parts);\nconst tor = new Mesh(g, m);\nfoo.name = 'Zaun';`;
  const cov = checkPartMeshCoverage(src, ['Tor', 'Eckfahne']);
  assert.equal(cov.registered, true);
  assert.equal(cov.criterion.id, 'S5-parts-coverage');
  assert.equal(cov.criterion.verdict, 'pass');
  assert.ok(cov.criterion.actual.includes('WARNUNG'), 'Eckfahne fehlt -> WARNUNG');
  assert.ok(cov.criterion.actual.includes('Eckfahne'));
  assert.ok(cov.warnings.some((w) => w.type === 'label-ohne-mesh' && w.label === 'Eckfahne'));
});

test('checkPartMeshCoverage: ohne Registrierung neutral (graceful)', () => {
  const cov = checkPartMeshCoverage(`addLabel(root, 'Tor', [0,0,0]);`, ['Tor']);
  assert.equal(cov.registered, false);
  assert.equal(cov.criterion.verdict, 'pass');
  assert.ok(cov.criterion.actual.includes('graceful'));
});

test('Gast-Paritaet: registerPartGroups/applyPartVisibility wie Host-Regel', () => {
  const mkMesh = (name, mat) => ({ isMesh: true, name, material: mat ? { name: mat } : undefined, userData: {}, visible: true });
  const meshes = [mkMesh('eckfahne1'), mkMesh('eckfahne2'), mkMesh('Seitenlinie'), mkMesh('torpfosten'), mkMesh('', 'RasenMaterial'), mkMesh('Zaun')];
  const root = { traverse(fn) { for (const m of meshes) fn(m); } };
  const reg = registerPartGroups(root, ['Eckfahne', 'Linien', 'Tor', 'Rasen']);
  assert.deepEqual(reg.groups, [2, 1, 1, 1, 1]);
  assert.deepEqual(meshes.map((m) => m.userData.partIndex), [0, 0, 1, 2, 3, 4]);
  assert.ok(reg.warnings.some((w) => w.type === 'mesh-ohne-treffer' && w.mesh === 'Zaun'));
  const host = assignPartMeshes(['Eckfahne', 'Linien', 'Tor', 'Rasen'], ['eckfahne1', 'eckfahne2', 'Seitenlinie', 'torpfosten', 'RasenMaterial', 'Zaun']);
  assert.equal(host.groups[4].length, reg.groups[4], 'Standard-Gruppe Host == Gast');
  assert.equal(host.warnings.length, reg.warnings.length, 'Warnungen Host == Gast');
  applyPartVisibility(root, [0]);
  assert.deepEqual(meshes.map((m) => m.visible), [false, false, true, true, true, true]);
  applyPartVisibility(root, []);
  assert.ok(meshes.every((m) => m.visible), 'alle wieder sichtbar');
});
