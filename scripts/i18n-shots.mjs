/**
 * Teil 5 — i18n-Beleg: je ein Screenshot pro Sprache (de/en/es) mit demselben
 * Modell (gpu-example) — Labels + Aufgaben sichtbar in der jeweiligen Sprache.
 * Kein Key, kein Netz ausser localhost. Nutzt den gebauten dist/lab-player.html.
 * Aufruf: node.exe scripts/i18n-shots.mjs
 * Belege: dist/i18n-de.png, dist/i18n-en.png, dist/i18n-es.png
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const WEB_PORT = 8095;
function waitFor(proc, needle, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`${label}: Timeout (${needle})`)), timeoutMs);
    proc.stdout.on('data', (d) => { buf += d.toString(); if (buf.includes(needle)) { clearTimeout(timer); resolve(); } });
    proc.stderr.on('data', (d) => { buf += d.toString(); });
    proc.on('exit', (c) => reject(new Error(`${label}: Exit ${c} (log: ${buf.slice(-300)})`)));
  });
}

const web = spawn('node.exe', ['scripts/serve.mjs', String(WEB_PORT)], { cwd: process.cwd() });
let browser = null;
try {
  await waitFor(web, `http://127.0.0.1:${WEB_PORT}/`, 15000, 'web');
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${WEB_PORT}/dist/lab-player.html`);
  await page.waitForSelector('#lab-mount iframe', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#verify-report')?.textContent?.includes('S4'), undefined, { timeout: 90000 });
  // Kuratiertes gpu-example laden (Referenz, kein Freimodus-Key noetig).
  await page.selectOption('#model-select', 'gpu-example');
  await page.waitForFunction(() => (document.querySelector('#annotation-list')?.textContent ?? '').includes('GPU'), undefined, { timeout: 60000 });
  const out = {};
  // navigator.language-Default: je ein frischer Kontext (de-DE / en-US),
  // KEIN Umschalten — initiale #live-go muss der Systemsprache folgen.
  const defaults = {};
  for (const [ctxLocale, erwartet] of [['de-DE', 'Modell generieren'], ['en-US', 'Generate model']]) {
    const ctx = await browser.newContext({ locale: ctxLocale, viewport: { width: 1280, height: 720 } });
    const dp = await ctx.newPage();
    await dp.goto(`http://127.0.0.1:${WEB_PORT}/dist/lab-player.html`);
    await dp.waitForSelector('#lab-mount iframe', { timeout: 60000 });
    await dp.waitForFunction(() => document.querySelector('#verify-report')?.textContent?.includes('S4'), undefined, { timeout: 90000 });
    const goText = ((await dp.textContent('#live-go')) ?? '').trim();
    const selVal = await dp.inputValue('#lang-select');
    defaults[ctxLocale] = { goText, selVal, erwartet, ok: goText === erwartet };
    console.log(`default ${ctxLocale}: go=${JSON.stringify(goText)} select=${selVal} ${goText === erwartet ? 'OK' : 'FEHLER'}`);
    await ctx.close();
  }
  const defaultsOk = Object.values(defaults).every((d) => d.ok);
  if (!defaultsOk) process.exitCode = 2;
  for (const loc of ['de', 'en', 'es']) {
    await page.selectOption('#lang-select', loc);
    await page.waitForTimeout(800);
    const shot = `dist/i18n-${loc}.png`;
    await page.screenshot({ path: shot });
    const png = await readFile(shot);
    const sha = createHash('sha256').update(png).digest('hex');
    // Alle sichtbaren Shell-Strings je Sprache einsammeln (Playwright-Check-Basis).
    const strings = await page.evaluate(() => ({
      go: document.querySelector('#live-go')?.textContent ?? '',
      term: document.querySelector('label[for="live-term"]')?.textContent ?? '',
      harnessOne: document.querySelector('#harness-one')?.textContent ?? '',
      adopt: document.querySelector('#lib-adopt')?.textContent ?? '',
      partHead: document.querySelector('.part-head strong')?.textContent ?? '',
      reportHead: document.querySelector('#verify-report')?.textContent?.slice(0, 120) ?? '',
      tasks: [...document.querySelectorAll('#task-list li')].map((li) => (li.textContent ?? '').slice(0, 160)),
      annotations: [...document.querySelectorAll('#annotation-list li')].slice(0, 6).map((li) => (li.textContent ?? '').slice(0, 120)),
    }));
    out[loc] = { screenshot: shot, bytes: png.length, sha256: sha, strings };
    console.log(`${loc}: ${shot} bytes=${png.length} sha=${sha.slice(0, 16)}… go=${JSON.stringify(strings.go)}`);
  }
  await writeFileSafe('dist/i18n-shots.json', JSON.stringify({ defaults, defaultsOk, shots: out }, null, 2));
  // Umschalt-Check: keine Sprache darf deutsche Shell-Reste zeigen (ausser Eigennamen).
  const deGo = out.de.strings.go;
  const ok = out.en.strings.go !== deGo && out.es.strings.go !== deGo && out.en.strings.go !== out.es.strings.go;
  console.log(`umschalt-check: ${ok ? 'OK (alle Sprachen verschieden)' : 'FEHLER (Texte identisch)'}`);
  if (!ok) process.exitCode = 2;
  console.log('I18N-SHOTS-OK');
} finally {
  if (browser) await browser.close();
  web.kill();
}

async function writeFileSafe(p, content) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(p, content);
}
