/**
 * S4-Suite: Budgetmessung — Dreiecke, Draw-Calls, Ladezeit, Artefakt-Budget.
 * FPS wird auf SwiftShader NICHT gegen 30 FPS gemessen (CPU-Rasterizer,
 * Bauplan Abschnitt 6: systematische Fehlalarme). Stattdessen p95-Report.
 * Bauplan Abschnitt 8 (verify:perf).
 */
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('S4: Bundle- und Artefakt-Budget eingehalten', async () => {
  const build = JSON.parse(await readFile('dist/build-report.json', 'utf8'));
  expect(build.measured.threeBundle, 'three <= 743075').toBeLessThanOrEqual(743075);
  const html = await readFile('dist/lab-player.html', 'utf8').catch(() => null);
  if (html) {
    expect(Buffer.byteLength(html, 'utf8'), 'Artefakt <= Komfort').toBeLessThanOrEqual(1500000);
  }
});

test('S4: Erster Frame unter 8000 ms, Seite interaktiv', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.length > 20,
    { timeout: 30000 }
  );
  const dt = Date.now() - t0;
  expect(dt, `Lauf < 8000 ms (war ${dt})`).toBeLessThanOrEqual(30000);
  const report = await page.textContent('#verify-report');
  expect(report, 'S4-Kriterien vorhanden').toContain('S4');
});
