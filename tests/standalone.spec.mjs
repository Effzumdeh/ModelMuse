/**
 * Standalone-v13/v14-Suite (einzige Auslieferung, GitHub-Pages-faehig).
 * Laedt dist-standalone/modelmuse-standalone.html ueber den Repo-Server
 * (CDN: Vue/three via unpkg), prueft Struktur (5 Showcase-3D + 5 2D-Demos v14,
 * entfernte Labels, Banner unten, Stift-Modify, Baseten-Default) und
 * rendert jedes Modell mit Screenshot nach dist-standalone/shots/<id>.png.
 * Kein Key, kein Netz ausser CDN. Generieren/Modify nur Validierungspfad.
 */
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = '/dist-standalone/modelmuse-standalone.html';
const ORDER = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example', 'demo-2d-svg', 'demo-2d-mermaid', 'demo-2d-chart', 'demo-2d-d3', 'demo-2d-katex'];
const IDS_3D = new Set(['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example']);

async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(
    () => (document.querySelector('aside h2')?.textContent ?? '').includes('Modelle'),
    { timeout: 60000 },
  );
  await page.waitForSelector('aside li', { timeout: 30000 });
}

test.beforeAll(async () => {
  await mkdir('dist-standalone/shots', { recursive: true });
});

test('Boot: Titel v13/v14, 10 Modelle, 10 Stift-Buttons, keine Errors', async ({ page }) => {
  await ready(page);
  await expect(page).toHaveTitle(/v13-standalone/);
  await expect(page.locator('aside h2')).toHaveText('Modelle (10)');
  await expect(page.locator('aside li')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Überarbeiten', exact: true })).toHaveCount(10);
  // Default-Modell: erstes Lab aktiv, Buehne lebt.
  await page.waitForSelector('#viewport canvas, #viewport svg', { timeout: 60000 });
  await page.waitForTimeout(4000);
});

test('Entfernte Labels: keine Ziele/Niveau/Modus/Track/Lernfeld-Anzeigen', async ({ page }) => {
  await ready(page);
  // innerText = nur gerendertes UI (keine <script>-Inhalte wie SOURCES/LABS).
  const body = await page.evaluate(() => document.body.innerText ?? '');
  for (const wort of [
    'Lernziele', 'Lernziel', 'Niveau', 'Lernmodus', 'Lernfeld', 'ARP-Block',
    'Curriculum-Details', 'LF 3', 'LF 2', 'ARP C-', 'Keine Labs',
  ]) {
    expect(body, `kein entferntes UI-Wort: ${wort}`).not.toContain(wort);
  }
  expect(body).not.toMatch(/openrouter/i);
  expect(body).toContain('Baseten');
});

test('Banner unten: Onboarding steht hinter dem Referenzbericht', async ({ page }) => {
  await ready(page);
  const pos = await page.evaluate(() => {
    const main = document.querySelector('main');
    const html = main?.innerHTML ?? '';
    const txt = main?.innerText ?? '';
    const iViewport = txt.indexOf('3D-Ansicht');
    const iVerify = txt.indexOf('Referenzbericht');
    const iBanner = txt.indexOf('Willkommen bei ModelMuse');
    return { iBanner, iVerify, iViewport, len: html.length };
  });
  expect(pos.iViewport).toBeGreaterThanOrEqual(0);
  expect(pos.iVerify).toBeGreaterThan(pos.iViewport);
  expect(pos.iBanner).toBeGreaterThan(pos.iVerify);
});

test('Provider-Default: Baseten muse-spark-open-1026, Key-Placeholder', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#gen-model')).toHaveValue('meta-models/muse-spark-open-1026');
  await expect(page.locator('#gen-key')).toHaveAttribute('placeholder', 'Baseten-API-Key');
  const label = await page.textContent('body');
  expect(label).toContain('Baseten (direkt)');
});

test('Generieren: Validierung ohne Upstream (leerer Begriff)', async ({ page }) => {
  await ready(page);
  await page.fill('#gen-desc', '');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-desc')).toBeVisible();
});

test('Stift-Modify: Overlay oeffnet mit Modell, Key-Abfrage ohne Key', async ({ page }) => {
  await ready(page);
  await page.locator('aside li', { hasText: 'Koffein' }).getByRole('button', { name: 'Überarbeiten' }).click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Koffein');
  await expect(dlg).toContainText('meta-models/muse-spark-open-1026');
  // Ohne Key: Absenden fragt Provider+Key ab (Scroll zum Key-Feld).
  await page.locator('[role="dialog"] textarea').fill('Test');
  await dlg.getByRole('button', { name: 'Modell überarbeiten' }).click();
  await expect(dlg).toContainText('Baseten-Key fehlt');
  await dlg.getByRole('button', { name: 'Schließen' }).click();
  await expect(dlg).toHaveCount(0);
});

test('Alle 10 Modelle (5x 3D + 5x 2D v14): rendern + Screenshots', async ({ page }) => {
  test.setTimeout(300000);
  await ready(page);
  for (let i = 0; i < ORDER.length; i += 1) {
    const id = ORDER[i];
    await page.locator('aside li').nth(i).locator('button').first().click();
    if (IDS_3D.has(id)) {
      await page.waitForSelector('#viewport canvas', { timeout: 60000 });
      await page.waitForTimeout(3500);
    } else {
      await page.waitForSelector('#viewport svg, #viewport canvas, #viewport .katex-block', { timeout: 60000 });
      await page.waitForTimeout(2500);
    }
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `dist-standalone/shots/${id}.png` });
  }
  // Buehne zeigt zuletzt die pq-Formel (KaTeX-Block, kein Canvas).
  await expect(page.locator('#viewport .katex-block')).toHaveCount(1);
});
