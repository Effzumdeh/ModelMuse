/** Unittests Bauteil-Toggles + Harness-Test pro Teil (rein, ohne DOM/Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  partEntries, toggleHidden, hasLabelCall, checkPart, checkAllParts,
} from '../src/runtime/parts.js';

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
