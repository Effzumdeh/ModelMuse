/**
 * Standalone-v13/v14/v15a/v16-Suite (einzige Auslieferung, GitHub-Pages-faehig).
 * Laedt dist-standalone/modelmuse-standalone.html ueber den Repo-Server
 * (CDN: Vue/three via unpkg), prueft Struktur (10 Modelle, Stift-Modify,
 * Banner oben, Referenzbericht/Details/Modify-Block entfernt, universelles
 * Loeschen jeder Lab-ID (Stift -> Overlay -> Loeschen-Button, Leerzustand),
 * Baseten-Default) und rendert jedes Modell mit Screenshot
 * nach dist-standalone/shots/<id>.png.
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

test('Entfernte Bloecke: keine Ziele/Niveau/Modus/Track/Lernfeld-Anzeigen, kein Referenzbericht, keine Details, kein Modify-Hauptblock', async ({ page }) => {
  await ready(page);
  // innerText = nur gerendertes UI (keine <script>-Inhalte wie SOURCES/LABS).
  const body = await page.evaluate(() => document.body.innerText ?? '');
  for (const wort of [
    'Lernziele', 'Lernziel', 'Niveau', 'Lernmodus', 'Lernfeld', 'ARP-Block',
    'Curriculum-Details', 'LF 3', 'LF 2', 'ARP C-', 'Keine Labs',
    'Referenzbericht', 'Details (Messungen', 'Messwerte', 'Modell überarbeiten',
  ]) {
    expect(body, `kein entferntes UI-Wort: ${wort}`).not.toContain(wort);
  }
  expect(body).not.toMatch(/openrouter/i);
  expect(body).toContain('Baseten');
});

test('Banner oben: Onboarding steht direkt unter der Menueleiste, ueber Liste und Viewer; Verstanden dismissed', async ({ page }) => {
  await ready(page);
  const pos = await page.evaluate(() => {
    const txt = document.body.innerText ?? '';
    return {
      iBanner: txt.indexOf('Willkommen bei ModelMuse'),
      iListe: txt.indexOf('Modelle ('),
      iViewport: txt.indexOf('3D-Ansicht'),
    };
  });
  expect(pos.iBanner).toBeGreaterThanOrEqual(0);
  expect(pos.iListe).toBeGreaterThan(pos.iBanner);
  expect(pos.iViewport).toBeGreaterThan(pos.iBanner);
  const above = await page.evaluate(() => {
    const header = document.querySelector('#app > header');
    const next = header?.nextElementSibling ?? null;
    return { hasBanner: (next?.textContent ?? '').includes('Willkommen bei ModelMuse') };
  });
  expect(above.hasBanner).toBe(true);
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await expect(page.getByText('Willkommen bei ModelMuse')).toHaveCount(0);
});

test('Provider-Umschalter: genau 2 Optionen, Default Baseten ohne (direkt)', async ({ page }) => {
  await ready(page);
  const prov = page.locator('#gen-provider');
  await expect(prov).toBeVisible();
  await expect(prov.locator('option')).toHaveCount(2);
  await expect(prov).toHaveValue('baseten-direct');
  await expect(prov.locator('option[value="baseten-direct"]')).toHaveText('Baseten');
  await expect(prov.locator('option[value="meta-muse"]')).toHaveText('Meta Muse');
  await expect(page.locator('#gen-model')).toHaveValue('meta-models/muse-spark-open-1026');
  await expect(page.locator('#gen-key')).toHaveAttribute('placeholder', 'Baseten-API-Key');
  const label = await page.textContent('body');
  expect(label).not.toContain('Baseten (direkt)');
  expect(label).not.toContain('Baseten (direct)');
  expect(label).toContain('Baseten');
});

test('Provider-Wechsel Meta: Modelle + LLM-Hinweis + Reasoning-Gate + Key-Cache', async ({ page }) => {
  await ready(page);
  await page.selectOption('#gen-provider', 'meta-muse');
  await expect(page.locator('#gen-model')).toHaveValue('muse-spark-1.3-contributor');
  await expect(page.locator('#gen-model option')).toHaveCount(3);
  const models = await page.locator('#gen-model option').allTextContents();
  expect(models).toEqual(['muse-spark-1.3-contributor', 'muse-spark-1.3', 'muse-wonder-1.0']);
  await expect(page.locator('#gen-key')).toHaveAttribute('placeholder', 'LLM_... (Meta API-Key, dev.meta.ai)');
  await expect(page.getByText('Meta-Key beginnt mit LLM_')).toBeVisible();
  // Reasoning: bei -contributor deaktiviert, bei 1.3/wonder aktiv.
  await expect(page.locator('#gen-reasoning')).toBeDisabled();
  await expect(page.locator('#gen-reasoning')).toHaveValue('');
  await page.selectOption('#gen-model', 'muse-spark-1.3');
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await page.selectOption('#gen-model', 'muse-wonder-1.0');
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await page.selectOption('#gen-model', 'muse-spark-1.3-contributor');
  await expect(page.locator('#gen-reasoning')).toBeDisabled();
  // Key-Cache je Provider (ohne Consent, offline, kein Upstream).
  await page.fill('#gen-key', 'LLM_meta-test-key-12345');
  await page.selectOption('#gen-provider', 'baseten-direct');
  await expect(page.locator('#gen-key')).toHaveValue('');
  await expect(page.locator('#gen-key')).toHaveAttribute('placeholder', 'Baseten-API-Key');
  await page.fill('#gen-key', 'baseten-test-key-12345');
  await page.selectOption('#gen-provider', 'meta-muse');
  await expect(page.locator('#gen-key')).toHaveValue('LLM_meta-test-key-12345');
  await page.selectOption('#gen-provider', 'baseten-direct');
  await expect(page.locator('#gen-key')).toHaveValue('baseten-test-key-12345');
  // Fehlertexte je Provider (gueltiger Begriff, Key fehlt, kein Upstream).
  await page.fill('#gen-key', '');
  await page.fill('#gen-desc', 'Testmodell Handbohrmaschine');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-status')).toContainText('Baseten-Key fehlt');
  await page.selectOption('#gen-provider', 'meta-muse');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-status')).toContainText('Meta-Key');
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

test('Loeschen-Button universell: fuer alle 10 Modelle im Overlay sichtbar', async ({ page }) => {
  test.setTimeout(120000);
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(10);
  for (let i = 0; i < 10; i += 1) {
    await page.locator('aside li').nth(i).getByRole('button', { name: 'Überarbeiten' }).click();
    const dlg = page.locator('[role="dialog"]');
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Löschen' })).toBeVisible();
    await dlg.getByRole('button', { name: 'Schließen' }).click();
    await expect(dlg).toHaveCount(0);
  }
});

test('Loeschen kuratiert: Built-in (Brandenburger Tor) mit Rueckfrage loeschbar, Fallback greift', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside h2')).toHaveText('Modelle (10)');
  await page.locator('aside li', { hasText: 'Brandenburger Tor' }).getByRole('button', { name: 'Überarbeiten' }).click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li', { hasText: 'Brandenburger Tor' })).toHaveCount(0);
  await expect(page.locator('aside li')).toHaveCount(9);
  await expect(page.locator('aside h2')).toHaveText('Modelle (9)');
  // Fallback: erstes Rest-Modell aktiv, Buehne lebt.
  await expect(page.locator('section[aria-label="3D-Ansicht"] h2')).toContainText('PC-Arbeitsplatz');
  await page.waitForSelector('#viewport canvas, #viewport svg', { timeout: 60000 });
  // Kein persistierter free-*-Eintrag fuer kuratierte IDs.
  const stored = await page.evaluate(() => localStorage.getItem('modelmuse.free.arch-brandenburger-tor'));
  expect(stored).toBeNull();
});

test('Loeschen eigen: free-Modell mit Rueckfrage loeschbar, localStorage-Cleanup', async ({ page }) => {
  const seedKey = 'modelmuse.free.free-test-loesch';
  const seedVal = JSON.stringify({
    id: 'free-test-loesch',
    title: { de: 'Test Loesch', en: 'Test Delete', es: 'Prueba' },
    meta: { title: 'Test Loesch', parts: ['Teil A', 'Teil B', 'Teil C'], category: 'sonstiges', is3d: true },
    manifest: {
      labels: { de: ['Teil A', 'Teil B', 'Teil C'], en: ['Part A', 'Part B', 'Part C'], es: ['Pieza A', 'Pieza B', 'Pieza C'] },
      measurements: [],
      tasks: [],
      quiz: { q: { de: '?', en: '?', es: '?' }, options: { de: ['a', 'b', 'c', 'd'], en: ['a', 'b', 'c', 'd'], es: ['a', 'b', 'c', 'd'] }, correct: 0, rationale: { de: '', en: '', es: '' } },
    },
    source: null,
    sourceOmitted: true,
  });
  await page.addInitScript(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: seedKey, v: seedVal },
  );
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside h2')).toHaveText('Modelle (11)');
  // Eigenes Modell: Loeschen mit Rueckfrage entfernt State + Listeneintrag.
  await page.locator('aside li', { hasText: 'Test Loesch' }).getByRole('button', { name: 'Überarbeiten' }).click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li', { hasText: 'Test Loesch' })).toHaveCount(0);
  await expect(page.locator('aside li')).toHaveCount(10);
  await expect(page.locator('aside h2')).toHaveText('Modelle (10)');
  const stored = await page.evaluate((k) => localStorage.getItem(k), seedKey);
  expect(stored).toBeNull();
});

test('Leerzustand: alle 10 nacheinander loeschbar, Liste leer, Viewer-Hinweis, Generator nutzbar', async ({ page }) => {
  test.setTimeout(180000);
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(10);
  for (let n = 10; n >= 1; n -= 1) {
    await expect(page.locator('aside li')).toHaveCount(n);
    await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  }
  await expect(page.locator('aside li')).toHaveCount(0);
  await expect(page.locator('aside h2')).toHaveText('Modelle (0)');
  // Viewer mit Hinweis (activeLab-Fallback), Buehne rendert Fallback.
  await expect(page.locator('section[aria-label="3D-Ansicht"] h2')).toContainText('Keine Modelle');
  await page.waitForSelector('#viewport canvas, #viewport svg', { timeout: 60000 });
  // Generator weiter nutzbar (Validierungspfad ohne Upstream).
  await expect(page.locator('#gen-desc')).toBeVisible();
  await page.fill('#gen-desc', '');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-desc')).toBeVisible();
  await expect(page.locator('#gen-status')).toHaveCount(1);
});

test('Reload stellt kuratierte wieder her (nur free-* persistiert)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(10);
  await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li')).toHaveCount(9);
  await page.reload();
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(10);
  await expect(page.locator('aside h2')).toHaveText('Modelle (10)');
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
