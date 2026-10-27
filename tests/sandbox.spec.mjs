/**
 * S2-Suite: Sandbox-Ausfuehrung — Frame-Attribute, CSP, Kanal, Angriffe.
 * Bauplan Abschnitt 6 (S2) und Abschnitt 8 (verify:sandbox).
 */
import { test, expect } from '@playwright/test';

test('S2: Player erzeugt isolierten Frame (sandbox, ohne allow-same-origin)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  const sandbox = await page.getAttribute('#lab-mount iframe', 'sandbox');
  expect(sandbox, 'sandbox-Attribut').toContain('allow-scripts');
  expect(sandbox, 'kein allow-same-origin').not.toContain('allow-same-origin');
  const srcdoc = await page.getAttribute('#lab-mount iframe', 'srcdoc');
  expect(srcdoc, 'CSP im Frame').toContain('default-src none');
  expect(srcdoc, 'connect-src none').toContain('connect-src none');
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S2'),
    { timeout: 30000 }
  );
  expect(errors, `keine pageerrors (${errors.slice(0, 2)})`).toEqual([]);
});

test('S2: Konsole ohne error-Eintraege waehrend load', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.waitForTimeout(9000);
  expect(errors, `Konsole fehlerfrei (${errors.slice(0, 2)})`).toEqual([]);
});
