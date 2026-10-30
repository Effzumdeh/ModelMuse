/**
 * Owner-Suite (W1..W11): entfernte Bloecke, neuer Generatortext,
 * Key-Prefill aus localStorage, Toggles nur im Overlay.
 */
import { test, expect } from '@playwright/test';

const URL = '/dist-standalone/modelmuse-standalone.html';

async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(
    () => (document.querySelector('aside h2')?.textContent ?? '').includes('Modelle'),
    { timeout: 60000 },
  );
  await page.waitForSelector('aside li', { timeout: 30000 });
}

test('Bloecke raus, Generatortext neu, Toggles nur Overlay', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('button', { name: 'Beispiel laden' })).toHaveCount(0);
  await expect(page.getByText('Modelle v13-standalone', { exact: true })).toHaveCount(0);
  await expect(page.locator('label', { hasText: 'Labels' })).toHaveCount(1);
  await expect(page.locator('label', { hasText: 'Maße' })).toHaveCount(1);
  await expect(page.getByText('WebGL nicht verfügbar')).toHaveCount(0);
  await expect(page.getByText('2D-Diagramm aktiv')).toHaveCount(0);
  await expect(page.locator('h2.text-2xl')).toHaveCount(0);
  await expect(page.locator('details')).toHaveCount(0);
  await expect(page.getByText(/Wähle Provider/)).toBeVisible();
  await expect(page.getByText(/dauerhaft gespeichert/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
});

test('Key-Prefill aus localStorage + Consent-Sync (W8)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('modelmuse.keys', JSON.stringify({ 'baseten-direct': 'persist-key-1234567890' })));
  await ready(page);
  await expect(page.locator('#gen-key')).toHaveValue('persist-key-1234567890');
  await expect(page.getByText(/dauerhaft gespeichert/)).toBeVisible();
});

test('Leerzustand ohne Suche zeigt Generator-Hinweis (W10)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await ready(page);
  for (let n = 10; n >= 1; n -= 1) {
    await expect(page.locator('aside li')).toHaveCount(n);
    await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  }
  await expect(page.locator('aside li')).toHaveCount(0);
  await expect(page.getByText(/keine Modelle gespeichert, nutze den Generator/i)).toBeVisible();
});
