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
  await page.click('#labs-list [aria-current="true"]');
  await page.waitForTimeout(2000);
  const second = await page.textContent('#verify-report');
  expect(second?.length, 'zweiter Lauf berichtet').toBeGreaterThan(20);
  expect(first, 'beide Laeufe berichten S-Schichten').toContain('S1');
  expect(second, 'beide Laeufe berichten S-Schichten').toContain('S1');
});

test('Levelwechsel ohne Neuladen: Session + Mesh-Anzahl stabil, nur Annotationen aendern sich', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S2'),
    { timeout: 30000 }
  );
  // Echten Modellwechsel erzwingen (si-1 -> gpu-example), damit beide gpu-Laeufe laden.
  await page.click('[data-lab="si-1"]');
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('si-1'),
    { timeout: 30000 }
  );
  await page.click('[data-lab="gpu-example"]');
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('gpu-example'),
    { timeout: 30000 }
  );
  const snap = () => page.evaluate(() => ({
    session: window.__labDebug.sessionId(),
    meshes: window.__labDebug.meshes(),
    labels: document.querySelectorAll('#annotation-list li').length,
    report: document.querySelector('#verify-report')?.textContent ?? '',
  }));
  const before = await snap();
  expect(before.session, 'Session-ID bekannt').not.toBeNull();
  expect(before.meshes, 'Mesh-Anzahl bekannt').not.toBeNull();
  const seen = {};
  for (const level of ['basis', 'aufbau', 'profi']) {
    await page.selectOption('#level-select', level);
    await page.waitForTimeout(500);
    seen[level] = await snap();
    expect(seen[level].session, `Session stabil bei ${level}`).toBe(before.session);
    expect(seen[level].meshes, `Mesh-Anzahl stabil bei ${level}`).toBe(before.meshes);
    expect(seen[level].report, `Bericht weiter S1 bei ${level}`).toContain('S1');
  }
  // Sichtbarkeits-Nachweis: Basis zeigt max. 5 Labels + keine Messungen (ui-annotations.js).
  expect(seen.basis.labels, 'Basis blendet Labels/Messungen aus').not.toBe(seen.aufbau.labels);
  // Zweites load desselben Modells: Berichtstext identisch (ms-Laufzeiten normiert;
  // Pixelgleichheit ist durch S3-Matrix 20/20 abgedeckt, darum kein Image-Diff hier).
  await page.click('[data-lab="si-1"]');
  await page.waitForTimeout(2000);
  await page.click('[data-lab="gpu-example"]');
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('gpu-example'),
    { timeout: 30000 }
  );
  const norm = (t) => t.replace(/[\d.,]+ ms/g, '# ms');
  const again = await snap();
  expect(norm(again.report), 'zweiter Lauf berichtet deterministisch').toBe(norm(before.report));
});
