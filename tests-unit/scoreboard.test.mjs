/** Unittests Teil 3: Harness-Scoreboard (sechs Fehlerklassen + Vergleich). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIX_CLASSES, scoreReport, compareProviders, sollWerte } from '../src/runtime/scoreboard.js';

function report(id, fails = [], verdict = 'gelb') {
  const layers = [
    { layer: 'S1', verdict: 'pass', criteria: [] },
    {
      layer: 'S2',
      verdict: fails.length ? 'fail' : 'pass',
      criteria: ['S2-intersect', 'S2-backface', 'S2-flicker', 'S2-orient', 'S2-connect'].map((c) => ({
        id: c, verdict: fails.includes(c) ? 'fail' : 'pass', expected: 'soll', actual: 'ist',
      })),
    },
    {
      layer: 'S4', verdict: 'pass',
      criteria: [{ id: 'S4-meshcount', verdict: fails.includes('S4-meshcount') ? 'fail' : 'pass', expected: '<= 250', actual: '40' }],
    },
    { layer: 'S5', verdict: 'pass', criteria: [{ id: 'S5-manifest', verdict: 'pass', expected: 'ok', actual: 'ok' }] },
  ];
  return { modelId: id, iteration: 1, layers, verdict, failed: fails };
}

test('Sechs Klassen sind abgedeckt (M1/M2)', () => {
  assert.deepEqual(SIX_CLASSES.map((c) => c.key), ['intersect', 'backface', 'flicker', 'orient', 'connect', 'meshcount']);
});

test('scoreReport: voll pass = 100 Punkte; Defekt senkt Geometrie', () => {
  const full = scoreReport(report('si-1'));
  assert.equal(full.punkte, 100);
  assert.equal(full.geometryFails, 0);
  const bad = scoreReport(report('si-2', ['S2-intersect', 'S4-meshcount']));
  assert.equal(bad.classes.intersect, 'fail');
  assert.equal(bad.classes.meshcount, 'fail');
  assert.equal(bad.geometryFails, 2);
  assert.ok(bad.punkte < 100);
});

test('scoreReport: nicht gemessene Klassen sind offen, nicht pass', () => {
  const r = scoreReport({ modelId: 'x', verdict: 'gelb', layers: [] });
  assert.equal(r.classes.intersect, 'offen');
  assert.equal(r.punkte, 0);
});

test('compareProviders: beste Geometrie + beste Didaktik', () => {
  const a = { ...scoreReport(report('gratis-modell')), providerId: 'openrouter', modelId: 'gemma-4-26b-it-free' };
  const b = { ...scoreReport(report('spark-modell', ['S2-flicker'])), providerId: 'meta-muse', modelId: 'muse-spark-1.3-contributor' };
  const cmp = compareProviders([a, b]);
  assert.equal(cmp.anzahl, 2);
  assert.equal(cmp.geometrie.id, 'gemma-4-26b-it-free');
  assert.equal(cmp.didaktik.id, 'gemma-4-26b-it-free');
});

test('sollWerte: S5-Soll gegen Manifest (M5/M7)', () => {
  const good = sollWerte({
    labels: ['a', 'b', 'c'], measurements: [{ id: 'm1' }], objectives: ['z1', 'z2'],
    tasks: [{ level: 'aufbau' }, { level: 'aufbau' }, { level: 'profi' }],
  });
  assert.equal(good.ok, true);
  const bad = sollWerte({ labels: ['a'], measurements: [], objectives: ['z'], tasks: [] });
  assert.equal(bad.ok, false);
  assert.equal(bad.rows.length, 5);
});
