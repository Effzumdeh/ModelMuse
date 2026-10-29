/**
 * Slim-Generator-Suite: Labs-Nav links, Generieren-Panel, Modify-Flow, Sprache.
 * Keine Keys, kein Netz ausser localhost. Generieren/Modify laufen nur als
 * Validierungspfad (leerer Prompt -> Fehlermeldung), kein Upstream-Call.
 * Screenshots: dist/screenshots/{labs,generieren,modify,sprache}.png
 */
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function ready(page) {
  await page.goto('/');
  await page.waitForSelector('#labs-list [data-lab]', { timeout: 45000 });
  await page.waitForSelector('#lab-mount iframe', { timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    { timeout: 45000 }
  );
}

test.beforeAll(async () => {
  await mkdir('dist/screenshots', { recursive: true });
});

test('Labs: Nav links listet alle kuratierten Modelle, Klick laedt Modell', async ({ page }) => {
  await ready(page);
  const labs = page.locator('#labs-list [data-lab]');
  await expect(labs).toHaveCount(12);
  await page.click('[data-lab="si-1"]');
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('si-1'),
    { timeout: 45000 }
  );
  await expect(page.locator('[data-lab="si-1"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#modify-model')).toContainText('si-1');
  await page.locator('#labs-list').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'dist/screenshots/labs.png' });
});

test('Generieren: Panel vorhanden, Validierung ohne Upstream', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#live-go')).toHaveText('Modell generieren');
  await page.locator('#live-go').scrollIntoViewIfNeeded();
  await page.fill('#live-term', '');
  await page.click('#live-go');
  await expect(page.locator('#live-status')).toContainText('mindestens 2 Zeichen');
  await page.screenshot({ path: 'dist/screenshots/generieren.png' });
});

test('Modify: Modell vorausgewaehlt, Validierung ohne Upstream', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#modify-go')).toHaveText('Modell überarbeiten');
  await expect(page.locator('#modify-model')).not.toBeEmpty();
  await page.locator('#modify-go').scrollIntoViewIfNeeded();
  await page.fill('#modify-prompt', '');
  await page.click('#modify-go');
  await expect(page.locator('#modify-status')).toContainText('mindestens 2 Zeichen');
  // Ueberarbeiten-Button der Bibliothek laedt Eintrag ins Modify-Panel.
  await page.locator('.lib-row[data-id="gpu-example"] >> button', { hasText: 'Überarbeiten' }).scrollIntoViewIfNeeded();
  await page.locator('.lib-row[data-id="gpu-example"] >> button', { hasText: 'Überarbeiten' }).click();
  await expect(page.locator('#modify-model')).toContainText('gpu-example');
  await expect(page.locator('#lib-status')).toContainText('Modify-Panel');
  await page.screenshot({ path: 'dist/screenshots/modify.png' });
});

test('Sprache: de/en/es schaltet Generieren + Modify um', async ({ page }) => {
  await ready(page);
  await page.selectOption('#lang-select', 'en');
  await expect(page.locator('#modify-go')).toHaveText('Revise model');
  await expect(page.locator('#live-go')).toHaveText('Generate model');
  await page.selectOption('#lang-select', 'es');
  await expect(page.locator('#modify-go')).toHaveText('Revisar modelo');
  await expect(page.locator('#live-go')).toHaveText('Generar modelo');
  await page.locator('#modify-go').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'dist/screenshots/sprache.png' });
  await page.selectOption('#lang-select', 'de');
  await expect(page.locator('#modify-go')).toHaveText('Modell überarbeiten');
});

test('Slim: keine Quiz-/Fortschritts-/Harness-/Tipps-UI, keine Toten', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#task-list')).toHaveCount(0);
  await expect(page.locator('#harness-one')).toHaveCount(0);
  await expect(page.locator('#harness-board')).toHaveCount(0);
  await expect(page.locator('#lib-detail')).toHaveCount(0);
  await expect(page.locator('#model-select')).toHaveCount(0);
  const body = await page.textContent('body');
  // Entfernte Didaktik-UI (Aufgaben/Harness-Scoreboard/P2-Notfallpfad) darf nicht
  // mehr rendern. Anbieter-Panel (muse.exe-Generierungspfad, Harness als
  // Verify-Pipeline in Doku-Strings) bleibt bewusst erhalten.
  for (const wort of ['Harness-Scoreboard', 'P2-NOTFALLPFAD', 'Quiz', 'Keine Aufgaben', 'Als erledigt']) {
    expect(body, `kein dead UI-Text: ${wort}`).not.toContain(wort);
  }
});
