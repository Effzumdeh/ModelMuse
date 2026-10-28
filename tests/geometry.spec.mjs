/**
 * M1/M2-Suite (Browser-Infra, Chromium + SwiftShader, 1280x720):
 * deterministische Geometrie-Checks + Mesh-Budget live.
 */
import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { verifyGeometryLayer, verifySvgLayer } from '../src/runtime/verify.js';
import { isTwoDSource } from '../src/runtime/guard-static.js';
import { countMeshesStatic, checkFlicker } from '../src/runtime/geometry-checks.js';

async function modelSources() {
  const out = [];
  for (const f of await readdir('src/models')) {
    if (f.endsWith('.js')) out.push({ id: f.slice(0, -3), source: await readFile(`src/models/${f}`, 'utf8') });
  }
  return out;
}

test('M1: S2 statisch pass ueber alle Modelle (3D-Geometrie, 2D-S2-light)', async () => {
  const models = await modelSources();
  expect(models.length).toBeGreaterThanOrEqual(10);
  for (const m of models) {
    if (isTwoDSource(m.source)) {
      // 2D-Route: S2-light (parse + pixel + Typ) statt 3D-Geometrie.
      const { layer } = verifySvgLayer(m.source);
      expect(layer.layer, `${m.id}: S2`).toBe('S2');
      expect(layer.verdict, `${m.id}: ${JSON.stringify(layer.criteria.filter((c) => c.verdict !== 'pass'))}`).toBe('pass');
      continue;
    }
    const { layer } = verifyGeometryLayer(m.source, null);
    expect(layer.layer, `${m.id}: S2`).toBe('S2');
    expect(layer.verdict, `${m.id}: ${JSON.stringify(layer.criteria.filter((c) => c.verdict !== 'pass'))}`).toBe('pass');
    expect(layer.criteria.length, `${m.id}: 6 Kriterien`).toBeGreaterThanOrEqual(5);
  }
});

test('M1: Detektoren schlagen bei echten Defekten an (FLARE-Messwerte)', async () => {
  const deep = verifyGeometryLayer('export const meta={}; export function init(){}', {
    boxes: [
      { id: 'A', group: 'g1', min: [0, 0, 0], max: [0.2, 0.2, 0.2] },
      { id: 'B', group: 'g2', min: [0.1, 0.1, 0.1], max: [0.3, 0.3, 0.3] },
    ],
    faces: [{ id: 'rueck', side: 'back' }],
    pixelDiff: 0.01,
  });
  expect(deep.layer.verdict).toBe('fail');
  const ids = deep.layer.criteria.filter((c) => c.verdict === 'fail').map((c) => c.id);
  expect(ids).toContain('S2-intersect');
  expect(checkFlicker(0.01).verdict).toBe('fail');
  expect(checkFlicker(0.001).verdict).toBe('pass');
});

test('M2: Mesh-Budget statisch ≤ 250 (gruen bis 120) ueber alle Modelle', async () => {
  for (const m of await modelSources()) {
    const counts = countMeshesStatic(m.source);
    expect(counts.total, `${m.id}: ${counts.total} Meshes`).toBeLessThanOrEqual(250);
  }
});

test('M2-live: Verify-Report enthaelt S4-meshcount', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    { timeout: 30000 }
  );
  const report = await page.textContent('#verify-report');
  expect(report, 'S4-meshcount im Report').toContain('S4-meshcount');
});
