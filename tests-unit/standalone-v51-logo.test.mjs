/**
 * v51-Regression (Logo-V2-Header oben links, 03.11.2026):
 * Logo V2 freigegeben (docs/.erklaervideo-work/logo/logo-a-plain-header.*);
 * repo-faehige Quelle docs/assets/logo-header.svg (3,7 KB Inline-SVG statt
 * 78-KB-PNG: kein Netz, kein CDN, CSP-neutral).
 * Prueft das GEBAUTE Standalone-Artefakt
 * (dist-standalone/modelmuse-standalone.html) + das GEBAUTE
 * Shell-Artefakt (dist/lab-player.html):
 *  L1) v51-Stempel genau 1x, v50-Kette intakt, Groesse < 600 KB.
 *  L2) Logo-Chip vor App-Titel (Inline-SVG, kein Netz); seit v52-Nachfolger
 *      (Theme-Umschalter + Logo-Dark-Variante): hell + dunkel je 1x
 *      (viewBox 2x), Wechsel via .dark-Klasse, Chip transparent.
 *  L3) Shell-Artefakt enthaelt dieselben Logo-Varianten (lab-logo-Chip).
 * Ablauf: erst bauen (npm run build + render + build:standalone), dann Tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const STANDALONE = new URL('../dist-standalone/modelmuse-standalone.html', import.meta.url);
const SHELL = new URL('../dist/lab-player.html', import.meta.url);

const cnt = (s, sub) => s.split(sub).length - 1;

test('v51-Stempel und Kette intakt', async () => {
  const s = await readFile(STANDALONE, 'utf8');
  assert.equal(cnt(s, 'standalone-build v50'), 1, 'v50-Stempel fehlt/mehrdeutig');
  assert.equal(cnt(s, 'standalone-build v51 (Logo-V2 header links)'), 1, 'v51-Stempel fehlt/mehrdeutig');
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('L2: Logo-Chip vor App-Titel (Inline-SVG, kein Netz)', async () => {
  const s = await readFile(STANDALONE, 'utf8');
  const H1 = '<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>';
  const v52 = s.includes('standalone-build v52');
  assert.equal(cnt(s, H1), 1, 'H1-Anker fehlt/mehrdeutig');
  if (v52) {
    assert.equal(cnt(s, 'viewBox="0 0 621 170"'), 2, 'v52: hell + dunkel je 1x');
    assert.equal(cnt(s, 'logo-v52-light'), 2, 'v52: helle Variante (Span + CSS-Regel)');
    assert.equal(cnt(s, 'logo-v52-dark'), 3, 'v52: dunkle Variante (Span + 2 CSS-Regeln)');
    assert.equal(cnt(s, 'logo-chip-v51 inline-flex items-center bg-white'), 0, 'v52: kein weisser Chip mehr');
  } else {
    assert.equal(cnt(s, 'viewBox="0 0 621 170"'), 1, 'Logo-SVG fehlt/mehrdeutig');
  }
  assert.equal(cnt(s, 'logo-chip-v51'), 1, 'Logo-Chip fehlt/mehrdeutig');
  assert.ok(s.indexOf('logo-chip-v51') < s.indexOf(H1), 'Logo muss VOR dem App-Titel stehen (oben links)');
  assert.ok(s.includes('style="height:28px;width:auto;display:block"'), 'SVG-Kopfzeilen-Stil fehlt');
  assert.ok(s.includes('role="img" aria-label="ModelMuse Logo"'), 'SVG-a11y fehlt');
  assert.equal(cnt(s, '<img'), 0, 'kein externes <img> im Single-File-Artefakt');
  assert.equal(cnt(s, 'data:image'), 1, 'keine neue Bild-data-URI durch v51 (Bestand 1x, Favicon)');
});

test('L3: Shell-Artefakt enthaelt dasselbe Logo (oben links)', async () => {
  const s = await readFile(SHELL, 'utf8');
  const v52 = s.includes('ModelMuse Theme-Init (v52)');
  if (v52) {
    assert.equal(cnt(s, 'viewBox="0 0 621 170"'), 2, 'v52: Shell hell + dunkel je 1x');
    assert.ok(s.includes('logo-variant-dark'), 'v52: dunkle Shell-Variante fehlt');
    assert.ok(s.includes('role="img" aria-label="ModelMuse Logo"'), 'v52: Shell-a11y fehlt');
  } else {
    assert.equal(cnt(s, 'viewBox="0 0 621 170"'), 1, 'Logo-SVG im Shell-Artefakt fehlt/mehrdeutig');
  }
  assert.ok(s.includes('class="lab-logo"'), 'lab-logo-Chip im Shell-Artefakt fehlt');
  const start = s.indexOf('<div class="lab-brand">');
  assert.ok(start >= 0, 'Kopf-Marke fehlt');
  const end = s.indexOf('</div>', start);
  const v = s.indexOf('viewBox="0 0 621 170"', start);
  assert.ok(v > start && v < end, 'Logo steht in der Kopf-Marke (oben links)');
});
