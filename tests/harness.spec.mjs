/**
 * Teil 1–3 (Browser, Chromium + SwiftShader, 1280x720):
 * Anbieter-/Modellauswahl klickbar, Bibliothek Aktionen, Harness-Scoreboard.
 */
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function ready(page) {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    { timeout: 45000 }
  );
}

/**
 * Ruhiger Klick auf Sidebar-Buttons: erst scrollen + CPU beruhigen, dann
 * klicken — unter SwiftShader konkurriert Scrollen sonst mit dem ersten
 * Frame (S2-Budget 8000 ms). Auf echter Hardware unkritisch.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function settledClick(page, selector, scrollSelector) {
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'center' });
  }, scrollSelector ?? selector);
  await page.waitForTimeout(1500);
  await page.click(selector);
}

test('Teil 1: Anbieter- und Modellauswahl klickbar mit Badges + Datenschutz', async ({ page }) => {
  await ready(page);
  const provOpts = await page.locator('#prov-provider option').allTextContents();
  expect(provOpts.length).toBe(2);
  // Default: Meta/Muse Contributor.
  await expect(page.locator('#prov-model')).toHaveValue('muse-spark-1.3-contributor');
  await expect(page.locator('#prov-privacy')).toContainText('Training');
  await expect(page.locator('#prov-cmd')).toContainText('muse.exe exec --model muse-spark-1.3-contributor');
  // Wechsel: Standard-Variante (M3 benutzersteuerbar).
  await page.selectOption('#prov-model', 'muse-spark-1.3');
  await expect(page.locator('#prov-privacy')).toContainText('datenschutzfreundlich');
  await expect(page.locator('#prov-cmd')).toContainText('--model muse-spark-1.3 ');
  // Wechsel: OpenRouter/Astra — ehrlich deaktivierter Pfad + Benchmark-Badges.
  await page.selectOption('#prov-provider', 'openrouter');
  await page.selectOption('#prov-model', 'gpt-6-astra');
  await expect(page.locator('#prov-badges')).toContainText('Geometrie: 3JSBench 80,0 %');
  await expect(page.locator('#prov-cmd')).toContainText('Deaktiviert');
  await expect(page.locator('#prov-status')).toContainText('Benchmark misst Didaktik');
  const docs = await page.locator('#prov-docs a').evaluateAll((els) => els.map((e) => e.href));
  expect(docs.length).toBeGreaterThanOrEqual(2);
  expect(docs.join(' ')).toContain('3jsbench.com');
});

test('Teil 2: Bibliothek spiegelt kuratierte 10, Adopt/Ueberarbeiten/Loeschen/Import', async ({ page }) => {
  await ready(page);
  const rows = page.locator('#lib-list .lib-row');
  await expect(rows).toHaveCount(10);
  // Adopt: aktuelles Modell als Sitzungseintrag.
  await settledClick(page, '#lib-adopt');
  await expect(page.locator('#lib-status')).toContainText('bernommen');
  await expect(rows).toHaveCount(11);
  // Ueberarbeiten: P2-Notfallpfad mit Messwert-Feedback + muse.exe-Befehl.
  await settledClick(page, '.lib-row[data-id="frei-gpu-example"] >> button:has-text("berarbeiten")', '.lib-row[data-id="frei-gpu-example"]');
  await expect(page.locator('#lib-detail')).toContainText('P2-NOTFALLPFAD');
  await expect(page.locator('#lib-detail')).toContainText('muse.exe exec --model');
  // Ansehen: Sitzungseintrag lädt.
  await settledClick(page, '.lib-row[data-id="frei-gpu-example"] >> button:has-text("Ansehen")', '.lib-row[data-id="frei-gpu-example"]');
  await expect(page.locator('#lib-status')).toContainText('geladen', { timeout: 30000 });
  // Loeschen: Sitzungseintrag weg, kuratierte bleiben.
  await settledClick(page, '.lib-row[data-id="frei-gpu-example"] >> button:has-text("schen")', '.lib-row[data-id="frei-gpu-example"]');
  await expect(rows).toHaveCount(10);
  // Import: .js-Datei wird neue Revision.
  await page.setInputFiles('#lib-import', {
    name: 'import-demo.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from('export const meta = { title: "Import-Demo", category: "demo", detailLevel: 2, parts: ["A","B","C"], units: "m" };\nexport function init(c, p) { return { update(patch) {}, dispose() {} }; }\n'),
  });
  await expect(page.locator('#lib-status')).toContainText('importiert');
  await expect(rows).toHaveCount(11);
  await expect(page.locator('#lib-list')).toContainText('Import-Demo');
});

test('Teil 3: Harness-Scoreboard misst sechs Klassen + Vergleich, S5-Soll + M7', async ({ page }) => {
  await ready(page);
  await page.click('#harness-one');
  await expect(page.locator('#harness-status')).toContainText('geprüft');
  const board = page.locator('#harness-board');
  for (const cls of ['intersect', 'backface', 'flicker', 'orient', 'connect', 'meshcount']) {
    await expect(board.locator('th', { hasText: cls }).first()).toBeVisible();
  }
  await expect(board).toContainText('Anbieter-Vergleich');
  await expect(page.locator('#harness-soll')).toContainText('Labels ≥ 3');
  await expect(page.locator('#harness-m7')).toContainText('M7-Minimalsatz');
});

test('Teil 3: P2-Notfallpfad-Datei (V6-Harness, Iteration max 2)', async () => {
  const p2 = await readFile('prompts/p2-repair.v6-harness.txt', 'utf8');
  expect(p2).toContain('maximal 2');
  expect(p2).toContain('FLARE');
  expect(p2).toContain('Meshes ≤250');
  expect(p2).toContain('keine Markdown-Code-Fences');
});
