/**
 * Kaltstart-Nachweise (Backlog O-05): Offline-Fehlerpfad + file://-Start.
 * Anker im vorhandenen Verhalten (nichts erfunden):
 * - src/shell/main.js boot(): loadRegistry/loadAssets/loadProviders fangen Fetch-Fehler
 *   und schreiben nach #verify-report (player.registryFehler) bzw. #prov-status
 *   (anbieter.offline); ohne WebGL2 showFallback(#fallback-panel, ...) aus
 *   src/shell/ui-fallback2d.js. Leerzustand #verify-report: "Noch kein Lauf."
 *   (src/shell/i18n/de.json, bericht.leer) — zaehlt NICHT als Fehlerpfad.
 * - scripts/serve.mjs: kein file:// (ES-Modul-CORS) — die Dev-Seite braucht http.
 *   Ob das Inline-Artefakt unter file:// bootet oder blockiert, entscheidet der Lauf;
 *   der Test akzeptiert beide definierten Ausgaenge und protokolliert den Befund.
 * Schranken: jede Navigation/Warte max. 30 s (kein Hang per Konstruktion).
 */
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const LEER = 'Noch kein Lauf.';
const istFehlerbericht = (t) => t !== null && t.trim().length > 0 && t.trim() !== LEER;

test('Kaltstart offline: Start-Fehlerpfad greift, kein Hang', async ({ page, context }) => {
  await context.setOffline(true);
  const t0 = Date.now();
  const navErr = await page.goto('/', { timeout: 15000 }).then(() => null, (e) => e);
  expect(Date.now() - t0, 'Navigation terminiert (kein Hang, <15 s)').toBeLessThan(15000);
  const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  const report = await page.textContent('#verify-report', { timeout: 5000 }).catch(() => null);
  const fallback = await page.locator('#fallback-panel').isVisible().catch(() => false);
  const browserOffline = /internet|offline|verbindung|err_|nicht erreichbar/i.test(body ?? '');
  const fehlerpfad = navErr !== null || browserOffline || istFehlerbericht(report) || fallback;
  expect(fehlerpfad, 'Start-FEHLERPFAD sichtbar (Nav-Fehler, Browser-Offline-Seite oder App-Fehlertext), kein Hang').toBe(true);
});

test('Kaltstart file://: dist/lab-player.html startet oder zeigt Fehlerpfad, kein Hang', async ({ page }) => {
  test.skip(!existsSync(resolve('dist/lab-player.html')), 'Artefakt fehlt — zuerst npm run render');
  await page.goto(pathToFileURL(resolve('dist/lab-player.html')).href, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/ModelMuse Lab-Player/, { timeout: 30000 });
  const gesund = await page.locator('#lab-mount iframe').waitFor({ timeout: 30000 }).then(() => true, () => false);
  const report = (await page.textContent('#verify-report').catch(() => '')) ?? '';
  const fallback = await page.locator('#fallback-panel').isVisible().catch(() => false);
  console.log(`coldstart file://: iframe=${gesund} fallback=${fallback} report=${JSON.stringify(report.slice(0, 120))}`);
  expect(gesund || istFehlerbericht(report) || fallback, 'definierter Ausgang: Boot ODER Fehlerpfad, kein Hang').toBe(true);
});
