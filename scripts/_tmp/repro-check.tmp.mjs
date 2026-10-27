import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://127.0.0.1:8080/dist/lab-player.html';
const OUT = process.argv[3] ?? 'C:/Users/flori/AppData/Local/hermes/profiles/coder/cache/scratch/repro-v1.png';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const consoles = [];
const pageerrors = [];
page.on('console', (m) => consoles.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => pageerrors.push(String(e).slice(0, 500)));
page.on('requestfailed', (r) => consoles.push(`REQFAIL: ${r.url().slice(0, 160)} :: ${r.failure()?.errorText}`));
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(10000);
let report = '';
try { report = await page.textContent('#verify-report', { timeout: 5000 }) ?? ''; } catch (e) { report = `NO-REPORT: ${e.message.slice(0, 200)}`; }
const hasIframe = await page.locator('#lab-mount iframe').count();
let srcdocLen = 0;
try { srcdocLen = (await page.getAttribute('#lab-mount iframe', 'srcdoc'))?.length ?? 0; } catch {}
await page.screenshot({ path: OUT, animations: 'disabled' });
console.log(JSON.stringify({ url: URL, hasIframe, srcdocLen, report: report.slice(0, 1200), consoles: consoles.slice(0, 30), pageerrors: pageerrors.slice(0, 10), out: OUT }, null, 2));
await browser.close();
