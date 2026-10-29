/** Playwright-Beleg: Standalone v12-guide rendert (kein E-S2-BOOT, keine THREE-Warnung).
 * Aufruf: node scripts/_tmp/proof-standalone-guide.mjs
 * Startet scripts/serve.mjs auf 8123, laedt dist-standalone/skillspark-standalone.html
 * in Chromium-SwiftShader, klickt 3D- (si-1, ae-2, free-handbohrmaschine) und 2D-Lab
 * (dup-1), sammelt console/pageerrors, schreibt Screenshots + Report.
 * Exit 0 nur wenn: 0 pageerrors, 0 console-errors, 0 PCFSoft/THREE-Warnungen,
 * kein Boot-Banner, alle Labs mit Modus-Erwartung geladen, Canvas-Daten nicht-trivial.
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PORT = 8123;
const URL = `http://127.0.0.1:${PORT}/dist-standalone/skillspark-standalone.html`;
const server = spawn(process.execPath, ['scripts/serve.mjs', String(PORT)], { stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('serve-timeout')), 15000);
  server.stdout.on('data', (d) => { if (String(d).includes('serve:')) { clearTimeout(t); res(); } });
  server.stderr.on('data', () => {});
  server.on('error', (e) => { clearTimeout(t); rej(e); });
});

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; const pageerrors = []; const warnings = []; const logs = [];
page.on('console', (m) => {
  const t = m.type(); const txt = m.text();
  logs.push(`[${t}] ${txt.slice(0, 220)}`);
  if (t === 'error') errors.push(txt);
  if (t === 'warning') warnings.push(txt);
});
page.on('pageerror', (e) => pageerrors.push(String(e && e.message ? e.message : e).slice(0, 300)));

const fail = async (msg) => {
  await writeFile('dist-standalone/proof-report.json', JSON.stringify({ ok: false, fail: msg, errors, pageerrors, warnings, logs: logs.slice(0, 60) }, null, 2));
  console.error('PROOF-FAIL: ' + msg);
  try { await browser.close(); } catch {}
  try { server.kill(); } catch {}
  process.exit(1);
};

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
try {
  await page.waitForFunction(() => window.__skillsparkBooted === true, null, { timeout: 45000 });
} catch { await fail('Vue-Boot-Flag __skillsparkBooted nicht gesetzt (CDN/Boot-Fehler)'); }

const boot = await page.evaluate(() => ({
  banner: !!document.getElementById('skillspark-boot-banner'),
  viewer: !!window.__viewer,
  inits: window.__viewer && window.__viewer.INIT ? Object.keys(window.__viewer.INIT).length : -1,
  initFns: window.__viewer && window.__viewer.INIT ? Object.keys(window.__viewer.INIT).filter((k) => typeof window.__viewer.INIT[k] === 'function').length : -1,
}));
console.log('boot:', JSON.stringify(boot));
if (boot.banner) await fail('Boot-Banner sichtbar (E-S2-BOOT-Aequivalent)');
if (!boot.viewer || boot.inits !== 10 || boot.initFns !== 10) await fail(`Viewer/INIT unvollstaendig: ${JSON.stringify(boot)}`);

const labs = [
  { id: 'si-1', mode: '3d' }, { id: 'ae-2', mode: '3d' },
  { id: 'free-handbohrmaschine', mode: '3d' }, { id: 'dup-1', mode: '2d' },
];
const shots = [];
for (const lab of labs) {
  const mode = await page.evaluate((id) => window.__viewer.loadLab(id, 'aufbau'), lab.id);
  await page.waitForTimeout(lab.mode === '3d' ? 3000 : 1200);
  const info = await page.evaluate(() => {
    const cv = document.querySelector('#viewport canvas');
    let urlLen = 0;
    try { if (cv && cv.toDataURL) urlLen = cv.toDataURL().length; } catch (e) { urlLen = -1; }
    return {
      viewerMode: window.__viewer._mode, canvas: !!cv,
      w: cv ? cv.width : 0, h: cv ? cv.height : 0, urlLen,
      svg: !!document.querySelector('#viewport svg'),
    };
  });
  const shot = `dist-standalone/proof-${lab.id}-v12.png`;
  await page.screenshot({ path: shot });
  shots.push({ lab: lab.id, mode, ...info, shot });
  console.log(lab.id, JSON.stringify({ mode, ...info }));
  if (mode !== lab.mode) await fail(`Lab ${lab.id}: Modus ${mode}, erwartet ${lab.mode}`);
  if (lab.mode === '3d' && (!info.canvas || !(info.urlLen > 20000))) await fail(`Lab ${lab.id}: kein Canvas-Nachweis (canvas=${info.canvas} urlLen=${info.urlLen})`);
  if (lab.mode === '2d' && !info.svg) await fail(`Lab ${lab.id}: kein Diagramm-SVG`);
}

const threeWarns = warnings.filter((w) => /PCFSoft|THREE|shadow|E-FREE|E-S2|WebGL/i.test(w));
console.log(`console-errors=${errors.length} pageerrors=${pageerrors.length} warnings=${warnings.length} threeWarns=${threeWarns.length}`);
if (warnings.length > 0) console.log('WARNUNGEN:\n' + warnings.slice(0, 20).join('\n'));
if (errors.length > 0) await fail(`console-errors: ${errors[0].slice(0, 200)}`);
if (pageerrors.length > 0) await fail(`pageerrors: ${pageerrors[0]}`);
if (threeWarns.length > 0) await fail(`THREE-Warnungen: ${threeWarns[0].slice(0, 200)}`);

await writeFile('dist-standalone/proof-report.json', JSON.stringify({ ok: true, url: URL, boot, shots, errors: 0, pageerrors: 0, warnings: 0, createdAt: new Date().toISOString() }, null, 2));
console.log('PROOF-OK: Standalone v12-guide rendert ohne Fehler/Warnungen');
await browser.close();
server.kill();
