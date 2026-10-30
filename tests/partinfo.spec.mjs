/**
 * Bestandteil-Info (v15/v15a): je Listeneintrag rechts Info-Kreis-i-Button,
 * Klick oeffnet textbasiertes Overlay-Popup mit fachlicher Erklaerung
 * (Fallback-Text wenn Eintrag fehlt); oeffnen/schliessen je Sprache
 * (de/en/es) + Reset bei Modellwechsel. Speichert Overlay-Screenshots.
 *
 * ready() wie standalone.spec: aside-li zuerst, dann Canvas 60s + 4s
 * Nachwarte (SwiftShader braucht ~25s). Buehne+Overlay leben in derselben
 * <section>: #viewport enthaelt nur den Canvas, Bestandteile-Liste,
 * Info-Buttons und Dialog liegen im Overlay-Panel daneben — darum
 * stage()-Scope statt #viewport. Screenshots als Ganzseite (Dialog fixed).
 */
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = '/dist-standalone/modelmuse-standalone.html';

async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(
    () => (document.querySelector('aside h2')?.textContent ?? '').includes('Modelle'),
    { timeout: 60000 },
  );
  await page.waitForSelector('aside li', { timeout: 30000 });
  await page.waitForSelector('#viewport canvas, #viewport svg', { timeout: 60000 });
  await page.waitForTimeout(4000);
}

// Buehnen-Section (enthaelt #viewport-Canvas + Overlay-Panel mit Dialog).
function stage(page) {
  return page.locator('section', { has: page.locator('#viewport') });
}

async function openFirstInfo(page) {
  const st = stage(page);
  const btn = st.locator('button[aria-label*="Info"], button[aria-label*="About"], button[aria-label*="Acerca"]').first();
  await expect(btn).toBeVisible();
  await btn.click();
  const dlg = st.locator('[role="dialog"]', { hasText: /Bestandteil-Info|Component info|Información del componente/ });
  await expect(dlg).toBeVisible();
  return dlg;
}

test.beforeAll(async () => {
  await mkdir('dist-standalone/shots', { recursive: true });
});

test('de: Bestandteile-Titel, 6 Info-Buttons rechts, Popup oeffnen/schliessen', async ({ page }) => {
  test.setTimeout(240000);
  await ready(page);
  const st = stage(page);
  await expect(st).toContainText('Bestandteile (6)');
  const buttons = st.locator('button[aria-label^="Info zum Bestandteil"]');
  await expect(buttons).toHaveCount(6);
  // Rechts vom Eintrag: Button beginnt rechts vom Label-Text derselben Zeile.
  const labelBox = await st.locator('span', { hasText: 'Säulenreihe' }).first().boundingBox();
  const boxBtn = await buttons.first().boundingBox();
  expect(boxBtn.x).toBeGreaterThan(labelBox.x + labelBox.width);
  expect(boxBtn.width).toBeGreaterThanOrEqual(43);
  const dlg = await openFirstInfo(page);
  await expect(dlg).toContainText('Bestandteil-Info: Säulenreihe');
  await expect(dlg).toContainText('dorische Saeulen');
  await page.screenshot({ path: 'dist-standalone/shots/partinfo-de.png' });
  await dlg.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test('en: Components-Titel, Popup mit englischer Erklaerung', async ({ page }) => {
  test.setTimeout(240000);
  await ready(page);
  const st = stage(page);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(st).toContainText('Components (6)');
  const buttons = st.locator('button[aria-label^="About this component"]');
  await expect(buttons).toHaveCount(6);
  await buttons.first().click();
  const dlg = st.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Component info: Colonnade');
  await expect(dlg).toContainText('Doric columns');
  await page.screenshot({ path: 'dist-standalone/shots/partinfo-en.png' });
  await dlg.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test('es: Componentes-Titel, Popup mit spanischer Erklaerung', async ({ page }) => {
  test.setTimeout(240000);
  await ready(page);
  const st = stage(page);
  await page.getByRole('button', { name: 'ES', exact: true }).click();
  await expect(st).toContainText('Componentes (6)');
  const buttons = st.locator('button[aria-label^="Acerca de este componente"]');
  await expect(buttons).toHaveCount(6);
  await buttons.first().click();
  const dlg = st.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Información del componente: Columnata');
  await expect(dlg).toContainText('columnas doricas');
  await page.screenshot({ path: 'dist-standalone/shots/partinfo-es.png' });
  await dlg.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test('Popup schliesst bei Modellwechsel (selectLab-Reset)', async ({ page }) => {
  test.setTimeout(240000);
  await ready(page);
  await openFirstInfo(page);
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await page.locator('aside li').nth(1).locator('button').first().click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(stage(page)).toContainText('Bestandteile (5)');
});
