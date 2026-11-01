/**
 * Standalone-v13/v14/v15a/v16-Suite (einzige Auslieferung, GitHub-Pages-faehig).
 * Laedt dist-standalone/modelmuse-standalone.html ueber den Repo-Server
 * (CDN: Vue/three via unpkg), prueft Struktur (6 Modelle, Stift-Modify,
 * Banner oben, Referenzbericht/Details/Modify-Block entfernt, universelles
 * Loeschen jeder Lab-ID (Stift -> Overlay -> Loeschen-Button, Leerzustand),
 * Baseten-Default) und rendert jedes Modell mit Screenshot
 * nach dist-standalone/shots/<id>.png.
 * Kein Key, kein Netz ausser CDN. Generieren/Modify nur Validierungspfad.
 */
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = '/dist-standalone/modelmuse-standalone.html';
const ORDER = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example', 'demo-2d-chart'];
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

test('Boot: Titel v13/v14, 6 Modelle, 6 Stift-Buttons, keine Errors', async ({ page }) => {
  await ready(page);
  await expect(page).toHaveTitle(/v13-standalone/);
  await expect(page.locator('aside h2')).toHaveText('Modelle (6)');
  await expect(page.locator('aside li')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Überarbeiten', exact: true })).toHaveCount(6);
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
  // v38/27d68d6: OpenRouter ist absichtlich Drittprovider (direkt) — kein entfernter Block mehr.
  expect(body).toMatch(/openrouter/i);
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

test('Provider-Umschalter: 3 Optionen (v38/27d68d6: +OpenRouter direkt), Default Baseten ohne (direkt)', async ({ page }) => {
  await ready(page);
  const prov = page.locator('#gen-provider');
  await expect(prov).toBeVisible();
  await expect(prov.locator('option')).toHaveCount(3);
  await expect(prov).toHaveValue('baseten-direct');
  await expect(prov.locator('option[value="baseten-direct"]')).toHaveText('Baseten');
  await expect(prov.locator('option[value="openrouter"]')).toHaveText('OpenRouter');
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
  // Reasoning (v26 R0 mit Leitplanken): max nur bei 1.3/wonder (Option-Gate);
  // -contributor und Baseten bekommen belegtes Maximum xhigh (Select aktiv).
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await expect(page.locator('#gen-reasoning')).toHaveValue('xhigh');
  await expect(page.locator('#gen-reasoning option[value="xhigh"]')).toBeEnabled();
  await expect(page.locator('#gen-reasoning option[value="max"]')).toBeDisabled();
  await page.selectOption('#gen-model', 'muse-spark-1.3');
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await expect(page.locator('#gen-reasoning')).toHaveValue('max');
  await expect(page.locator('#gen-reasoning option[value="max"]')).toBeEnabled();
  await page.selectOption('#gen-model', 'muse-wonder-1.0');
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await expect(page.locator('#gen-reasoning option[value="max"]')).toBeEnabled();
  await page.selectOption('#gen-model', 'muse-spark-1.3-contributor');
  await expect(page.locator('#gen-reasoning')).toBeEnabled();
  await expect(page.locator('#gen-reasoning')).toHaveValue('xhigh');
  await expect(page.locator('#gen-reasoning option[value="max"]')).toBeDisabled();
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

test('Loeschen-Button universell: fuer alle 6 Modelle im Overlay sichtbar', async ({ page }) => {
  test.setTimeout(120000);
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) {
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
  await expect(page.locator('aside h2')).toHaveText('Modelle (6)');
  await page.locator('aside li', { hasText: 'Brandenburger Tor' }).getByRole('button', { name: 'Überarbeiten' }).click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li', { hasText: 'Brandenburger Tor' })).toHaveCount(0);
  await expect(page.locator('aside li')).toHaveCount(5);
  await expect(page.locator('aside h2')).toHaveText('Modelle (5)');
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
  await expect(page.locator('aside h2')).toHaveText('Modelle (7)');
  // Eigenes Modell: Loeschen mit Rueckfrage entfernt State + Listeneintrag.
  await page.locator('aside li', { hasText: 'Test Loesch' }).getByRole('button', { name: 'Überarbeiten' }).click();
  const dlg = page.locator('[role="dialog"]');
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Löschen' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li', { hasText: 'Test Loesch' })).toHaveCount(0);
  await expect(page.locator('aside li')).toHaveCount(6);
  await expect(page.locator('aside h2')).toHaveText('Modelle (6)');
  const stored = await page.evaluate((k) => localStorage.getItem(k), seedKey);
  expect(stored).toBeNull();
});

test('Leerzustand: alle 6 nacheinander loeschbar, Liste leer, Viewer-Hinweis, Generator nutzbar', async ({ page }) => {
  test.setTimeout(180000);
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(6);
  for (let n = 6; n >= 1; n -= 1) {
    await expect(page.locator('aside li')).toHaveCount(n);
    await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  }
  await expect(page.locator('aside li')).toHaveCount(0);
  await expect(page.locator('aside h2')).toHaveText('Modelle (0)');
  // v18 (OOB Designlob): Viewer bei leerer Liste ausgeblendet (v-if labs.length),
  // nur Empty-State + Generator sichtbar.
  await expect(page.locator('section[aria-label="3D-Ansicht"]')).toHaveCount(0);
  await expect(page.locator('#viewport')).toHaveCount(0);
  await expect(page.getByText('Keine Modelle gespeichert')).toBeVisible();
  // Generator weiter nutzbar (Validierungspfad ohne Upstream).
  await expect(page.locator('#gen-desc')).toBeVisible();
  await page.fill('#gen-desc', '');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-desc')).toBeVisible();
  await expect(page.locator('#gen-status')).toHaveCount(1);
});

test('Reload behaelt Loeschungen (kuratiert + free-* persistiert, W9)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(6);
  await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.locator('aside li')).toHaveCount(5);
  await page.reload();
  await ready(page);
  await expect(page.locator('aside li')).toHaveCount(5);
  await expect(page.locator('aside h2')).toHaveText('Modelle (5)');
  const deleted = await page.evaluate(() => localStorage.getItem('modelmuse.deleted'));
  expect(JSON.parse(deleted)).toContain('arch-brandenburger-tor');
});

test('Alle 6 Modelle (5x 3D + 1x 2D v14/chart): rendern + Screenshots', async ({ page }) => {
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
  // Buehne zeigt zuletzt den Wirkungsgradvergleich (Chart rendert per Canvas-2D, SVG nur Fallback).
  await expect(page.locator('#viewport canvas')).toHaveCount(1);
});

/**
 * Regression leere Antwort (v18): simulierter Upstream ohne Key/Netz.
 * Meta/Baseten liefern bei Reasoning-Last leere Deltas + stop bzw.
 * content null + finish length (live belegt 30.10.2026: 198/200 Tokens
 * Reasoning, kein sichtbarer Text). Der Reader darf das nicht still
 * verschlucken: Diagnose mit Provider/Modell/HTTP/finish statt nur
 * "Leere Antwort".
 */
const SSE_MIN_MODULE = [
  'import { Scene, Group, Mesh, MeshStandardMaterial, BoxGeometry, HemisphereLight, DirectionalLight, Vector3 } from \'three\';',
  'import { addLabel, addMeasurement } from \'wrapper-helpers\';',
  'export const meta = { title: "Regressionsquader", category: "hardware", detailLevel: 2, parts: ["Korpus", "Deckel", "Boden"], units: "m" };',
  'export function init(container, params) { const scene = new Scene(); const g = new Group(); scene.add(g); return { update(patch) {}, dispose() {} }; };',
].join('\n');

function sseBody(events) {
  return `${events.map((e) => `data: ${JSON.stringify(e)}`).join('\n')}\ndata: [DONE]\n`;
}

test('Regression: leere SSE-Antwort meldet Diagnose mit Provider Modell Status', async ({ page }) => {
  await ready(page);
  await page.route('https://inference.baseten.co/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([
        { choices: [{ delta: { reasoning_content: 'Denke nach...' } }] },
        { choices: [{ delta: {} }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ]),
    });
  });
  await page.fill('#gen-key', 'byok-test-key-12345');
  await page.fill('#gen-desc', 'Regressionsquader leer');
  await page.getByRole('button', { name: 'Generieren' }).click();
  const status = page.locator('#gen-status');
  await expect(status).toContainText('Leere Antwort');
  await expect(status).toContainText('baseten-direct');
  await expect(status).toContainText('meta-models/muse-spark-open-1026');
  await expect(status).toContainText('HTTP 200');
});

test('Regression: Reasoning plus Content-Array wird gesammelt (kein Leere-Antwort)', async ({ page }) => {
  await ready(page);
  await page.route('https://inference.baseten.co/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([
        { choices: [{ delta: { reasoning_content: 'plane...' } }] },
        { choices: [{ delta: {} }] },
        { choices: [{ message: { content: [{ type: 'text', text: SSE_MIN_MODULE }], role: 'assistant' }, finish_reason: 'stop' }] },
      ]),
    });
  });
  await page.fill('#gen-key', 'byok-test-key-12345');
  await page.fill('#gen-desc', 'Regressionsquader voll');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-status')).toContainText('Modell bereit', { timeout: 60000 });
  await expect(page.locator('#gen-status')).toContainText('Regressionsquader');
  await expect(page.locator('aside h2')).toHaveText('Modelle (7)');
});

test('Regression: leere Liste blendet Viewer aus, erstes Modell bringt ihn zurueck', async ({ page }) => {
  test.setTimeout(180000);
  page.on('dialog', (d) => d.accept());
  await ready(page);
  await page.route('https://inference.baseten.co/v1/chat/completions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([
        { choices: [{ delta: { content: SSE_MIN_MODULE, finish_reason: 'stop' } }] },
      ]),
    });
  });
  for (let n = 6; n >= 1; n -= 1) {
    await expect(page.locator('aside li')).toHaveCount(n);
    await page.locator('aside li').first().getByRole('button', { name: 'Überarbeiten' }).click();
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Löschen' }).click();
  }
  await expect(page.locator('aside h2')).toHaveText('Modelle (0)');
  await expect(page.locator('#viewport')).toHaveCount(0);
  await page.fill('#gen-key', 'byok-test-key-12345');
  await page.fill('#gen-desc', 'Regressionsquader neu');
  await page.getByRole('button', { name: 'Generieren' }).click();
  await expect(page.locator('#gen-status')).toContainText('Modell bereit', { timeout: 60000 });
  await expect(page.locator('aside h2')).toHaveText('Modelle (1)');
  await expect(page.locator('#viewport')).toHaveCount(1);
});
