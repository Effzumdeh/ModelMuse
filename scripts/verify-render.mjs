/**
 * npm run verify:render — Render-Beleg fuer das Standalone-Artefakt
 * (Headless-Chromium + statisches Syntax-Gate).
 * Prueft das GEBAUTE dist-standalone/modelmuse-standalone.html:
 *  1. Jedes Inline-Script (classic + module) parst (node --check) —
 *     faengt Builder-Escaping-Fehler (z. B. Streukomma -> Unexpected token).
 *  2. Headless-Load via lokalem HTTP (exakte Artefakt-Bytes): keine pageerrors.
 *  3. Nach Hydration: kein rohes {{...}} im gerenderten Text.
 *  4. Provider-Optionen real (baseten-direct + meta-muse vorhanden).
 *  5. Vue-Hydration sichtbar (Titel + "Modelle"-Liste gerendert).
 * Exit 0 = Render ok; exit 1 = Render defekt.
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const failures = [];
const ok = (m) => console.log(`verify-render: OK ${m}`);
const fail = (m) => { failures.push(m); console.error(`verify-render: FAIL ${m}`); };
const NL = String.fromCharCode(10);

let s = '';
try {
  s = await readFile(FILE, 'utf8');
  ok(`Artefakt lesbar (${s.length} Zeichen)`);
} catch {
  fail('Artefakt fehlt (erst npm run build:standalone).');
  process.exit(1);
}

// ---------- 1. Syntax-Gate ----------
{
  const dir = mkdtempSync(join(tmpdir(), 'verify-render-'));
  try {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let m, n = 0;
    while ((m = re.exec(s))) {
      const attrs = m[1];
      if (/src\s*=/i.test(attrs)) continue;
      if (/type\s*=\s*['"]?(importmap|application\/ld\+json|application\/json)/i.test(attrs)) continue;
      n += 1;
      const isMod = /type\s*=\s*['"]?module/i.test(attrs);
      const f = join(dir, `inline-${n}${isMod ? '.mjs' : '.js'}`);
      writeFileSync(f, m[2]);
      try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      } catch (e) {
        const detail = String((e.stdout || '') + (e.stderr || '')).split(NL).slice(0, 3).join(' | ');
        fail(`Inline-Script ${n} (${isMod ? 'module' : 'classic'}) parst nicht: ${detail}`);
      }
    }
    if (n < 5) fail(`zu wenige Inline-Scripts gefunden: ${n}`);
    else if (!failures.length) ok(`${n} Inline-Scripts parsen (classic + module)`);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}
if (failures.length) process.exit(1);

// ---------- 2.-5. Headless-Hydration ----------
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(s);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser = null;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const pageerrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageerrors.push(String((e && e.message) || e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  const st = await page.evaluate(() => {
    const text = document.body ? (document.body.innerText ?? '') : '';
    const mustaches = (text.match(/\{\{/g) || []).length;
    const values = [];
    for (const sel of document.querySelectorAll('select')) {
      for (const o of sel.options) values.push(o.value || o.text);
    }
    return {
      title: document.title,
      mustaches,
      hasModelle: text.includes('Modelle'),
      hasAppTitleKey: text.includes("t('appTitle')") || text.includes('{{'),
      selectValues: values.slice(0, 20),
    };
  });
  if (pageerrors.length) fail(`pageerrors: ${pageerrors.slice(0, 3).join(' // ')}`);
  else ok('keine pageerrors (Vue-App-Script laeuft)');
  if (consoleErrors.length) fail(`console errors: ${consoleErrors.slice(0, 3).join(' // ')}`);
  else ok('keine console errors');
  if (st.mustaches > 0 || st.hasAppTitleKey) fail(`rohe Mustaches nach Hydration (${st.mustaches}x "{{")`);
  else ok('keine rohen {{}} nach Hydration');
  const hasBaseten = st.selectValues.includes('baseten-direct');
  const hasMuse = st.selectValues.includes('meta-muse');
  if (hasBaseten && hasMuse) ok(`Provider-Optionen real (${st.selectValues.length} Werte, baseten-direct + meta-muse)`);
  else fail(`Provider-Optionen unvollstaendig: ${JSON.stringify(st.selectValues)}`);
  if (st.hasModelle) ok('Vue-Hydration sichtbar ("Modelle"-Liste gerendert)');
  else fail('keine Hydration ("Modelle" fehlt im Text)');
  if (/standalone/.test(st.title)) ok(`Titel: ${st.title}`);
  else fail(`Titel unerwartet: ${st.title}`);
} catch (e) {
  fail(`Browser-Lauf: ${String((e && e.message) || e).slice(0, 250)}`);
} finally {
  if (browser) await browser.close();
  server.close();
}
if (failures.length) { console.error(`verify-render: ABORT (${failures.length} Fehler)`); process.exit(1); }
console.log('verify-render: OK (Render-Beleg: Syntax + Hydration + Provider)');
