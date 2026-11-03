/**
 * Redesign Phase 2 — Vorher/Nachher-Screenshots (Playwright, kein Test-Runner).
 * Aufruf: node docs/redesign-phase2/shots.mjs <before|after> [baseUrl]
 * Schreibt docs/redesign-phase2/<before|after>/{hell-1440,dunkel-1440,hell-390}.png
 * Server separat starten: node scripts/serve.mjs 8091
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const which = process.argv[2] ?? 'before';
const base = process.argv[3] ?? 'http://127.0.0.1:8091';
const outDir = `docs/redesign-phase2/${which}`;
mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { name: 'hell-1440', theme: 'light', width: 1440, height: 900 },
  { name: 'dunkel-1440', theme: 'dark', width: 1440, height: 900 },
  { name: 'hell-390', theme: 'light', width: 390, height: 844 },
];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
try {
  for (const s of SHOTS) {
    const page = await (await browser.newContext({ viewport: { width: s.width, height: s.height }, locale: 'de-DE' })).newPage();
    await page.addInitScript((theme) => {
      try { localStorage.setItem('modelmuse-theme', theme); } catch {}
    }, s.theme);
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#labs-list li', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const file = `${outDir}/${s.name}.png`;
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    const hScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`shot: ${file} hScroll=${hScroll}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('shots: OK ' + which);
