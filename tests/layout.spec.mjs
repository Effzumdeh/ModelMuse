/**
 * Backlog A-07 (27.10.2026, Option b): .lab-side ist bewusst statischer
 * Inspector (sticky, kein Drawer). Belegt 1024px- und 1280px-Layout.
 * Keine neuen Deps, kein Key, kein Netz ausser localhost.
 */
import { test, expect } from '@playwright/test';

test.setTimeout(30000);

async function expectSideBySide(page) {
  await page.goto('/dist/lab-player.html');
  await page.waitForSelector('.lab-view', { timeout: 30000 });
  await page.waitForSelector('.lab-side', { timeout: 30000 });
  const boxes = await page.evaluate(() => {
    const view = document.querySelector('.lab-view')?.getBoundingClientRect();
    const side = document.querySelector('.lab-side')?.getBoundingClientRect();
    return {
      view: view && { x: view.x, width: view.width },
      side: side && { x: side.x, width: side.width },
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(boxes.view).toBeTruthy();
  expect(boxes.side).toBeTruthy();
  expect(boxes.side.x).toBeGreaterThanOrEqual(boxes.view.x + boxes.view.width - 8);
  expect(boxes.scrollWidth).toBeLessThanOrEqual(boxes.innerWidth + 1);
}

test('Layout 1024px: Seitenleiste neben Viewer, kein horizontaler Scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await expectSideBySide(page);
});

test('Layout 1280px: Seitenleiste neben Viewer, kein horizontaler Scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expectSideBySide(page);
});
