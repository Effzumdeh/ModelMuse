/**
 * UI-Beleg Teil 3: laedt den Player, zeigt Bauteil-Checkboxen, schaltet ein
 * Bauteil aus, klickt "Alle pruefen", Screenshots dist/ui-modern.png und
 * dist/parts-toggles.png. Kein Key-Kontakt, keine Generierung.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const WEB_PORT = 8096;

function waitFor(proc, needle, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${label}: Timeout`)), timeoutMs);
    proc.stdout.on('data', (d) => {
      buf += d.toString();
      if (buf.includes(needle)) { clearTimeout(timer); resolve(); }
    });
    proc.on('exit', (c) => reject(new Error(`${label}: Exit ${c} (${buf.slice(-200)})`)));
  });
}

const web = spawn('node', ['scripts/serve.mjs', String(WEB_PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(web, `http://127.0.0.1:${WEB_PORT}/`, 15000, 'web');
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${WEB_PORT}/dist/lab-player.html`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector('#verify-report')?.textContent?.includes('S4'),
    undefined, { timeout: 90000 }
  );
  const parts = await page.locator('#annotation-list .part-row').count();
  console.log(`bauteil-zeilen: ${parts}`);
  if (parts < 3) throw new Error('Bauteil-Checkboxen fehlen');
  await page.screenshot({ path: 'dist/ui-modern.png' });
  // Ein Bauteil ausblenden + alle pruefen.
  await page.locator('#annotation-list .part-row input[type="checkbox"]').first().uncheck();
  await page.click('#annotation-list .part-head button');
  await page.waitForFunction(
    () => document.querySelectorAll('#annotation-list .part-row .crit-pass, #annotation-list .part-row .crit-fail').length > 0,
    undefined, { timeout: 15000 }
  );
  const badges = await page.locator('#annotation-list .part-row .crit-pass').count();
  console.log(`part-badges-pass: ${badges}/${parts}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'dist/parts-toggles.png' });
  console.log('UI-OK');
} finally {
  if (browser) await browser.close();
  web.kill();
}
