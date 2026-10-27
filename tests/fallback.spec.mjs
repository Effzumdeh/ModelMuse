/**
 * F2/F3/F4-Pfade, WebGL2-Entzug: 2D-Ersatzansicht mit Bauteilliste und Massen,
 * Status-Badge, F4-Textkarte als letzter Pfad.
 * Bauplan Abschnitt 9 (Fallback-Tabelle) und Abschnitt 8.
 */
import { test, expect } from '@playwright/test';
import { renderFallback2D } from '../src/runtime/fallback2d.js';

test('F3: renderFallback2D zeichnet Bauteilliste + Masse', async ({ page }) => {
  await page.goto('/');
  const nonBlank = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    document.body.appendChild(canvas);
    return new Promise((resolve) => {
      import('./src/runtime/fallback2d.js').then(({ renderFallback2D }) => {
        renderFallback2D(canvas, {
          title: 'Graphics Card',
          labels: ['GPU-Die', 'VRAM 1', 'Lüfter 1'],
          measurements: [{ text: 'Kartenlänge: 267 mm', unit: 'mm' }],
        }, 'aufbau');
        const ctx = canvas.getContext('2d');
        const d = ctx.getImageData(0, 0, 640, 360).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 40) {
          if (d[i] + d[i + 1] + d[i + 2] > 60) lit += 1;
        }
        resolve(lit / (d.length / 40));
      });
    });
  });
  expect(nonBlank, `2D-Ansicht nicht leer (${nonBlank})`).toBeGreaterThan(0.05);
});

test('F3/F4: Fallback-Panel und 2D-Modus ueber UI erreichbar', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#lab-mount iframe', { timeout: 30000 });
  await page.click('text=2D-Modus');
  await expect(page.locator('#fallback-panel')).toBeVisible();
  await expect(page.locator('#fallback-text')).toContainText('F3');
});

test('F4: E-FACH faellt auf Textkarte zurueck (Logik)', async () => {
  const { validateManifest } = await import('../src/runtime/didactics.js');
  const rep = validateManifest({ title: 'x', track: 'free', objectives: ['a', 'b'], labels: ['l1', 'l2', 'l3'], measurements: [{ id: 'm-1', from: [0, 0, 0], to: [1, 0, 0], text: '1 cm', unit: 'cm' }], tasks: [] });
  expect(rep.ok, 'leere Tasks schlagen fehl (F4-Pfad)').toBe(false);
});
