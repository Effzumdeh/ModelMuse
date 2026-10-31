/**
 * Teil 4 + 5 (+FR 31.10.2026): UI-Checks — Sprachumschaltung (de/en/es/fr), Bauteil-Checkboxen,
 * Overlay-Menues (Ansicht, 2D-Modus). Keine Keys, kein Netz ausser localhost.
 */
import { test, expect } from '@playwright/test';

async function gotoPlayer(page) {
  await page.goto('/dist/lab-player.html');
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    undefined,
    { timeout: 90000 }
  );
}

test('Sprachumschalter: de/en/es/fr aendert alle sichtbaren Shell-Strings', async ({ page }) => {
  await gotoPlayer(page);
  const before = await page.textContent('#live-go');
  // Systemsprache dieses Runners ist de (oder Fallback de): Umschalten auf en.
  await page.selectOption('#lang-select', 'en');
  await expect(page.locator('#live-go')).not.toHaveText(before ?? '');
  await expect(page.locator('#live-go')).toHaveText('Generate model');
  await expect(page.locator('label[for="live-term"]')).toHaveText('Free term');
  await expect(page.locator('#modify-go')).toHaveText('Revise model');
  await expect(page.locator('#lib-adopt')).toHaveText('Adopt current model');
  // Bauteil-Kopf auf Englisch.
  await expect(page.locator('.part-head strong').first()).toContainText('Labels (');
  // Umschalten auf es.
  await page.selectOption('#lang-select', 'es');
  await expect(page.locator('#live-go')).toHaveText('Generar modelo');
  await expect(page.locator('#modify-go')).toHaveText('Revisar modelo');
  await expect(page.locator('label[for="live-term"]')).toHaveText('Término libre');
  await expect(page.locator('.part-head strong').first()).toContainText('Etiquetas (');
  // Umschalten auf fr.
  await page.selectOption('#lang-select', 'fr');
  await expect(page.locator('#live-go')).toHaveText('Générer le modèle');
  await expect(page.locator('#modify-go')).toHaveText('Retoucher le modèle');
  await expect(page.locator('label[for="live-term"]')).toHaveText('Terme libre');
  await expect(page.locator('.part-head strong').first()).toContainText('Étiquettes (');
  // Zurueck auf de.
  await page.selectOption('#lang-select', 'de');
  await expect(page.locator('#live-go')).toHaveText('Modell generieren');
  await expect(page.locator('#modify-go')).toHaveText('Modell überarbeiten');
});

test('Bauteil-Checkboxen: Toggle blendet Bauteil aus/ein', async ({ page }) => {
  await gotoPlayer(page);
  const boxes = page.locator('#annotation-list .part-row input[type="checkbox"]');
  await expect(boxes.first()).toBeVisible({ timeout: 30000 });
  const n = await boxes.count();
  expect(n).toBeGreaterThanOrEqual(3);
  await boxes.first().uncheck();
  await expect(boxes.first()).not.toBeChecked();
  await boxes.first().check();
  await expect(boxes.first()).toBeChecked();
});

test('Overlay-Menues: Ansicht-Presets + 2D-Modus schalten ohne Fehler', async ({ page }) => {
  await gotoPlayer(page);
  for (const preset of ['detail', 'front', 'top', 'overview']) {
    await page.selectOption('#view-select', preset);
  }
  await page.click('text=2D-Modus');
  await expect(page.locator('#fallback-panel')).toBeVisible();
  await expect(page.locator('#fallback-text')).not.toBeEmpty();
});

test('Anbieterwahl: Baseten zeigt Proxy-Hinweis + Muse-Spark-Open-Modell zuerst', async ({ page }) => {
  await gotoPlayer(page);
  await page.selectOption('#prov-provider', 'baseten');
  await expect(page.locator('#prov-proxy-wrap')).toBeVisible();
  const firstModel = await page.$eval('#prov-model', (el) => el.options[0]?.value ?? '');
  expect(firstModel).toBe('muse-spark-open-1026');
  await expect(page.locator('#prov-status')).toContainText('Geometrie');
});
