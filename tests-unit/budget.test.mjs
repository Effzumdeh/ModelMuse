/** Unittests S4-Budgetwaechter (node-Testrunner). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetWatcher, DEFAULT_BUDGET_LIMITS } from '../src/runtime/budget.js';

test('Defaults entsprechen Nachtrag 2026-10-27 (150000/400/30/8000/256)', () => {
  assert.equal(DEFAULT_BUDGET_LIMITS.triangles, 150000);
  assert.equal(DEFAULT_BUDGET_LIMITS.drawCalls, 400);
  assert.equal(DEFAULT_BUDGET_LIMITS.minFps, 30);
  assert.equal(DEFAULT_BUDGET_LIMITS.firstFrameMs, 8000);
  assert.equal(DEFAULT_BUDGET_LIMITS.heapMb, 256);
});

test('E-BUDGET-OPTS bei fehlendem/negativem Limit', () => {
  assert.throws(() => createBudgetWatcher({ triangles: -1 }), /E-BUDGET-OPTS/);
  assert.throws(() => createBudgetWatcher({ minFps: 0 }), /E-BUDGET-OPTS/);
});

test('E-BUDGET-STATE bei Doppel-begin und sample-vor-begin', () => {
  const w = createBudgetWatcher({});
  assert.throws(() => w.sample(16, {}), /E-BUDGET-STATE/);
  w.begin();
  assert.throws(() => w.begin(), /E-BUDGET-STATE/);
});

test('E-BUDGET-ARG bei NaN-Framezeit', () => {
  const w = createBudgetWatcher({});
  w.begin();
  assert.throws(() => w.sample(Number.NaN, {}), /E-BUDGET-ARG/);
});

test('snapshot ohne Bruch meldet pass, onBreach feuert einmal je Metrik', () => {
  const w = createBudgetWatcher({});
  w.begin();
  const seen = [];
  const off = w.onBreach((b) => seen.push(b.metric));
  assert.equal(typeof off, 'function');
  for (let i = 0; i < 10; i += 1) w.sample(16, { triangles: 50000, calls: 40 });
  const rep = w.snapshot();
  assert.equal(rep.verdict, 'pass');
  assert.deepEqual(rep.breaches, []);
  off();
});

test('Dreiecks-Bruch erzeugt E-S4-Budget-relevanten Breach', () => {
  const w = createBudgetWatcher({});
  w.begin();
  const seen = [];
  w.onBreach((b) => seen.push(b));
  w.sample(16, { triangles: 160000, calls: 10 });
  const rep = w.snapshot();
  assert.equal(rep.verdict, 'fail');
  assert.ok(rep.breaches.some((b) => b.metric === 'triangles' && b.limit === 150000));
  assert.ok(seen.some((b) => b.metric === 'triangles'));
  w.sample(16, { triangles: 170000, calls: 10 });
  assert.equal(seen.filter((b) => b.metric === 'triangles').length, 1);
});

test('stop ist idempotent', () => {
  const w = createBudgetWatcher({});
  w.begin();
  w.stop();
  w.stop();
});

test('M2-Defaults: meshCount 250 hart, Ampel 120/250', async () => {
  const { DEFAULT_BUDGET_LIMITS: L, TRAFFIC } = await import('../src/runtime/budget.js');
  assert.equal(L.meshCount, 250);
  assert.deepEqual(TRAFFIC.meshCount, [120, 250]);
});

test('M2: meshCount-Bruch erzeugt Breach, onBreach feuert einmal', () => {
  const w = createBudgetWatcher({});
  w.begin();
  const seen = [];
  w.onBreach((b) => seen.push(b.metric));
  w.sample(16, { triangles: 1000, calls: 10, meshCount: 300 });
  const rep = w.snapshot();
  assert.equal(rep.verdict, 'fail');
  assert.equal(rep.meshCount, 300);
  assert.ok(rep.breaches.some((b) => b.metric === 'meshCount' && b.limit === 250));
  assert.ok(seen.includes('meshCount'));
  w.sample(16, { triangles: 1000, calls: 10, meshCount: 310 });
  assert.equal(seen.filter((m) => m === 'meshCount').length, 1);
});

test('M2: meshes-Alias und gruenes Budget', () => {
  const w = createBudgetWatcher({});
  w.begin();
  w.sample(16, { triangles: 1000, calls: 10, meshes: 45 });
  const rep = w.snapshot();
  assert.equal(rep.meshCount, 45);
  assert.equal(rep.verdict, 'pass');
  assert.equal(w.traffic().meshCount, 'green');
  w.sample(16, { triangles: 1000, calls: 10, meshCount: 200 });
  assert.equal(w.traffic().meshCount, 'yellow');
});
