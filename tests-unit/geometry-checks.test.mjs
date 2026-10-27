/** Unittests M1: deterministische Geometrie-Checks (FLARE-Klasse, deutsche Texte). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEO_LIMITS,
  fmtMm,
  checkIntersections,
  checkBackfaces,
  checkCoplanarity,
  checkFlicker,
  checkOrientation,
  checkConnectivity,
  verifyGeometryScene,
  countMeshesStatic,
  scanMaterialFlags,
} from '../src/runtime/geometry-checks.js';
import { verifyGeometryLayer, formatP2Protocol } from '../src/runtime/verify.js';
import { readFile } from 'node:fs/promises';

test('fmtMm nutzt deutsches Komma', () => {
  assert.equal(fmtMm(4.2), '4,2 mm');
  assert.equal(fmtMm(0), '0,0 mm');
});

test('S2-intersect: beruehrende Boxen pass, tiefe Durchdringung fail mit Messwerten', () => {
  const touch = [
    { id: 'A', group: 'g1', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
    { id: 'B', group: 'g2', min: [0.099, 0, 0], max: [0.2, 0.1, 0.1] },
  ];
  const r1 = checkIntersections(touch);
  assert.equal(r1.verdict, 'pass');
  assert.ok(r1.actual.includes('0 Paare'));
  const deep = [
    { id: 'Mainboard', group: 'board', min: [0, 0, 0], max: [0.24, 0.01, 0.24] },
    { id: 'CPU', group: 'cpu', min: [0.1, 0.005, 0.1], max: [0.2, 0.05, 0.2] },
  ];
  const r2 = checkIntersections(deep);
  assert.equal(r2.verdict, 'fail');
  assert.ok(r2.actual.includes('Mainboard↔CPU'));
  assert.ok(r2.actual.includes('mm'));
  assert.ok(r2.measurements.maxPenetrationMm > GEO_LIMITS.penetrationMm);
});

test('S2-intersect: gleiche Baugruppe erlaubt, Helper ignoriert', () => {
  const same = [
    { id: 'S1', group: 'ram', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
    { id: 'S2', group: 'ram', min: [0.05, 0, 0], max: [0.15, 0.1, 0.1] },
  ];
  assert.equal(checkIntersections(same).verdict, 'pass');
  const helper = [
    { id: 'label-1', min: [0, 0, 0], max: [0.1, 0.1, 0.1] },
    { id: 'B', min: [0.05, 0, 0], max: [0.15, 0.1, 0.1] },
  ];
  assert.equal(checkIntersections(helper).verdict, 'pass');
});

test('S2-intersect: ungueltige Eintraege werden gefiltert', () => {
  assert.throws(() => checkIntersections('x'), /E-GEO-ARG/);
  assert.equal(checkIntersections([{ id: 'A' }]).verdict, 'pass');
});

test('S2-backface: BackSide fail, DoubleSide nur Hinweis', () => {
  const ok = checkBackfaces([
    { id: 'a', side: 'front', normalConsistent: true },
    { id: 'b', side: 'double', normalConsistent: true },
  ]);
  assert.equal(ok.verdict, 'pass');
  assert.ok(ok.actual.includes('DoubleSide'));
  const bad = checkBackfaces([{ id: 'rueck', side: 'back', normalConsistent: true }]);
  assert.equal(bad.verdict, 'fail');
  assert.ok(bad.actual.includes('rueck'));
  const inc = checkBackfaces([{ id: 'w', side: 'front', normalConsistent: false }]);
  assert.equal(inc.verdict, 'fail');
});

test('S2-flicker (Koplanar + Render): Schwelle 0,002', () => {
  const planes = [
    { id: 'P1', normal: [0, 0, 1], constant: 0.01, min: [0, 0, 0.01], max: [0.2, 0.2, 0.01] },
    { id: 'P2', normal: [0, 0, 1], constant: 0.0102, min: [0.05, 0.05, 0.0102], max: [0.25, 0.25, 0.0102] },
  ];
  const r = checkCoplanarity(planes);
  assert.equal(r.verdict, 'fail');
  assert.ok(r.actual.includes('P1↔P2'));
  assert.equal(checkFlicker(0.001).verdict, 'pass');
  assert.equal(checkFlicker(0.01).verdict, 'fail');
  assert.throws(() => checkFlicker(2), /E-GEO-ARG/);
});

test('S2-orient: Zentrum/Ausdehnung/Neigung', () => {
  const ok = checkOrientation([
    { id: 'a', position: [0.1, 0, 0], up: [0, 1, 0] },
    { id: 'b', position: [-0.1, 0.05, 0], up: [0, 1, 0] },
  ]);
  assert.equal(ok.verdict, 'pass');
  const off = checkOrientation([
    { id: 'a', position: [2, 0, 0] },
    { id: 'b', position: [2.1, 0, 0] },
  ]);
  assert.equal(off.verdict, 'fail');
});

test('S2-connect: isolierte Baugruppe fail mit Spalt in mm', () => {
  const ok = checkConnectivity([
    { id: 'a', centroid: [0, 0, 0], radius: 0.05 },
    { id: 'b', centroid: [0.09, 0, 0], radius: 0.05 },
  ]);
  assert.equal(ok.verdict, 'pass');
  const bad = checkConnectivity([
    { id: 'a', centroid: [0, 0, 0], radius: 0.02 },
    { id: 'b', centroid: [0.5, 0, 0], radius: 0.02 },
  ]);
  assert.equal(bad.verdict, 'fail');
  assert.ok(bad.actual.includes('mm'));
});

test('verifyGeometryScene: leere Deskriptoren = 5x pass', () => {
  const { criteria, verdict } = verifyGeometryScene({});
  assert.equal(criteria.length, 5);
  assert.equal(verdict, 'pass');
  assert.deepEqual(criteria.map((c) => c.id), ['S2-intersect', 'S2-backface', 'S2-flicker', 'S2-orient', 'S2-connect']);
});

test('countMeshesStatic + scanMaterialFlags auf si-1', async () => {
  const src = await readFile('src/models/si-1.js', 'utf8');
  const counts = countMeshesStatic(src);
  assert.ok(counts.total > 0 && counts.total <= 250, `si-1 Meshes ${counts.total} im Budget`);
  const flags = scanMaterialFlags(src);
  assert.ok(flags.doubleSide >= 1);
  assert.equal(flags.transmission + flags.iridescence + flags.sheen, 0);
});

test('verifyGeometryLayer statisch: alle zehn Modelle pass', async () => {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir('src/models')).filter((f) => f.endsWith('.js'));
  assert.ok(files.length === 10);
  for (const f of files) {
    const src = await readFile(`src/models/${f}`, 'utf8');
    const { layer } = verifyGeometryLayer(src, null);
    assert.equal(layer.layer, 'S2');
    assert.equal(layer.verdict, 'pass', `${f}: ${JSON.stringify(layer.criteria.filter((c) => c.verdict !== 'pass'))}`);
  }
});

test('verifyGeometryLayer mit sceneStats: echter fail wird gemeldet', () => {
  const src = 'export const meta={}; export function init(){}';
  const { layer } = verifyGeometryLayer(src, {
    boxes: [
      { id: 'A', group: 'g1', min: [0, 0, 0], max: [0.2, 0.2, 0.2] },
      { id: 'B', group: 'g2', min: [0.1, 0.1, 0.1], max: [0.3, 0.3, 0.3] },
    ],
  });
  assert.equal(layer.verdict, 'fail');
  assert.ok(layer.criteria.some((c) => c.id === 'S2-intersect' && c.verdict === 'fail'));
});

test('formatP2Protocol: FLARE-Zeilen mit Soll/Ist, leer = kein Repair', () => {
  const empty = formatP2Protocol([{ layer: 'S1', verdict: 'pass', criteria: [{ id: 'S1-x', verdict: 'pass', expected: 'a', actual: 'b' }] }]);
  assert.ok(empty.includes('kein Repair'));
  const full = formatP2Protocol([
    { layer: 'S2', verdict: 'fail', criteria: [{ id: 'S2-intersect', verdict: 'fail', expected: 'Soll 0', actual: 'Ist 3 Paare (max Tiefe 4,2 mm)' }] },
    { layer: 'S4', verdict: 'fail', criteria: [{ id: 'S4-meshcount', verdict: 'fail', expected: '≤ 250', actual: '312 Meshes' }] },
  ]);
  assert.ok(full.includes('[S2:S2-intersect] FAIL | Soll: Soll 0 | Ist: Ist 3 Paare'));
  assert.ok(full.includes('maximal 2'));
});
