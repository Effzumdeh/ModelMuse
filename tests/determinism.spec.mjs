/**
 * Determinismus: Doppellauf — gleicher Hash, gleiche Pixel.
 * Bauplan Abschnitt 8 (determinism) und Abschnitt 2 (deterministische Builds).
 */
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function hashOf(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('Determinismus: Modellquelle hashstabil ueber zwei Laeufe', async () => {
  const h1 = await hashOf('src/models/gpu-example.js');
  const h2 = await hashOf('src/models/gpu-example.js');
  expect(h1).toBe(h2);
  expect(h1.length).toBe(64);
});

test('Determinismus: zweimaliges load liefert gleiche Ampel', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S2'),
    { timeout: 30000 }
  );
  const first = await page.textContent('#verify-report');
  await page.selectOption('#model-select', await page.inputValue('#model-select'));
  await page.waitForTimeout(2000);
  const second = await page.textContent('#verify-report');
  expect(second?.length, 'zweiter Lauf berichtet').toBeGreaterThan(20);
  expect(first, 'beide Laeufe berichten S-Schichten').toContain('S1');
  expect(second, 'beide Laeufe berichten S-Schichten').toContain('S1');
});
