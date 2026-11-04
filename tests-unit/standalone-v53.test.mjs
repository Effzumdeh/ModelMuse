/**
 * v53-Regression (Redesign-Port ins Standalone-Release, 04.11.2026):
 * Prueft das GEBAUTE Standalone-Artefakt
 * (dist-standalone/modelmuse-standalone.html):
 *  T1 Token-System (hell/dunkel, Kontrast-Fixwerte aus src/shell/theme.css),
 *  T2 Type-Skala (Panel-Titel 20 semibold, Micro 13px),
 *  H3 Dopplung raus (keine Etikett-Bullets, Badge-Chips, Count bleibt),
 *  H2+M2 Kompakt-Header + Branding (h1 sr-only, <640px-CSS, Onboarding neutral de/en/es/fr),
 *  M1 Primary-Buttons (je einer je Panel, Select-Hover neutral),
 *  S Glastoolbar + Crossfade 160ms mit Reduced-Motion-Schnitt (CSS + selectLab-JS),
 *  Kette intakt (v50/v51/v52-Stempel, <600 KB).
 * Ablauf: erst bauen (npm run build:standalone), dann Tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HTML = new URL('../dist-standalone/modelmuse-standalone.html', import.meta.url);

async function html() {
  return readFile(HTML, 'utf8');
}

const cnt = (s, sub) => s.split(sub).length - 1;

test('v53-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v50', 'v51 (Logo-V2 header links)', 'v52', 'v53']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('T1: Token-System hell/dunkel (Kontrast-Fixwerte)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'v53-tokens'), 1, 'Token-Kommentar');
  assert.equal(cnt(s, '--surface-0:#f1f4f9'), 1, 'hell surface-0');
  assert.equal(cnt(s, '--accent-2:#0277b6'), 1, 'hell accent-2 4,86:1');
  assert.equal(cnt(s, '.dark{--surface-0:#0c1118'), 1, 'dunkel surface-0');
  assert.equal(cnt(s, '--accent:#ffd34d'), 1, 'dunkel accent');
  assert.equal(cnt(s, '--accent-2:#4dd2ff'), 1, 'dunkel accent-2 9,76:1');
  assert.equal(cnt(s, '--bad:#ef6b6b'), 1, 'dunkel bad 5,69:1');
  // v52-Zaehler unberuehrt (kein prefers-color-scheme/modelmuse.theme in v53).
  assert.equal(cnt(s, 'modelmuse.theme'), 7, 'v52 Theme-Override unveraendert');
  assert.equal(cnt(s, 'prefers-color-scheme'), 7, 'v52 System-Default unveraendert');
});

test('T2: Type-Skala (Panel-Titel 20 semibold, Micro 13px)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'v53-panel-title'), 3, 'Panel-Titel-Klasse (CSS + labs + viewport)');
  assert.equal(cnt(s, 'text-xl font-semibold mb-3'), 1, 'Labs-Titel 20 semibold');
  assert.equal(cnt(s, 'text-xl font-semibold flex-1 min-w-[160px]'), 1, 'Viewport-Titel 20 semibold');
  assert.equal(cnt(s, '.text-xs{font-size:13px'), 1, 'Micro 13px-Override');
});

test('H3: Dopplung raus (keine Bullets, Badge-Chips, Count bleibt)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'Etikett:'), 0, 'keine Etikett-Bullets');
  assert.equal(cnt(s, 'v53-measure-badge'), 1, 'Measure-Badge-Chips (Shell-Paritaet)');
  assert.ok(s.includes("{{t('partsTitle')}} ({{overlayParts.length}})"), 'partsTitle-Count bleibt');
  assert.ok(s.includes("{{t('labs')}} ({{filteredLabs.length}})"), 'Labs-Count bleibt');
});

test('H2+M2: Kompakt-Header + Branding + Onboarding neutral', async () => {
  const s = await html();
  assert.equal(cnt(s, '<h1 class="sr-only">{{t(\'appTitle\')}}</h1>'), 1, 'H1 sr-only (visuelle Marke = Logo)');
  assert.equal(cnt(s, 'v53 Branding'), 1, 'Branding-Kommentar');
  assert.equal(cnt(s, '@media (max-width:639px)'), 1, 'Kompakt-CSS <640px');
  assert.equal(cnt(s, 'v53-kompakt'), 1, 'Kompakt-Kommentar');
  // Onboarding ohne Positions-Annahme (shell H2-Fix analog).
  assert.equal(cnt(s, 'Wähle links ein Modell'), 0, 'de ohne links');
  assert.equal(cnt(s, 'on the left or generate'), 0, 'en ohne on-the-left');
  assert.equal(cnt(s, 'a la izquierda o genera'), 0, 'es ohne izquierda');
  assert.equal(cnt(s, 'à gauche ou g'), 0, 'fr ohne a-gauche');
  assert.ok(s.includes('Wähle ein Modell oder generiere'), 'de neutral');
  assert.ok(s.includes('Pick a model or generate'), 'en neutral');
  assert.ok(s.includes('Elige un modelo o genera'), 'es neutral');
  assert.ok(s.includes('Choisis un mod'), 'fr neutral');
});

test('M1: Primary-Buttons (je einer je Panel) + Select-Hover', async () => {
  const s = await html();
  assert.equal(cnt(s, 'v53-primary'), 5, 'Primary-Marker (CSS-Kommentar + Regel + 3 Buttons)');
  assert.ok(s.includes('v53-primary-btn'), 'Primary-Kommentar');
  assert.equal(cnt(s, '@click="enqueueGenerate" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold v53-primary"'), 1, 'Generator-Primary (Akzent indigo-600)');
  assert.ok(s.includes('@click="submitModify"') && s.includes('v53-primary'), 'Modify-Primary');
  assert.ok(s.includes('@click="dismissOnboarding"') && s.includes('v53-primary'), 'Onboarding-Primary');
  assert.equal(cnt(s, 'select:hover{border-color:var(--ink-3)}'), 1, 'Select-Hover neutral');
});

test('S: Glas + Crossfade 160ms mit Reduced-Motion-Schnitt', async () => {
  const s = await html();
  assert.equal(cnt(s, '-webkit-backdrop-filter:blur(8px)'), 1, 'Glas -webkit-Prefix');
  assert.equal(cnt(s, 'v53-viewport'), 1, 'Viewport-Marker');
  assert.equal(cnt(s, '#viewport{transition:opacity 160ms ease-out}'), 1, 'Crossfade-Transition');
  assert.equal(cnt(s, '#viewport.v53-switching{opacity:0}'), 1, 'Crossfade-Ausblendung');
  assert.equal(cnt(s, 'v53-switching'), 6, 'Switching-Marker (CSS 2x + JS 4x)');
  assert.ok(s.includes('@media (prefers-reduced-motion:reduce)'), 'Reduced-Motion-CSS');
  assert.ok(s.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'), 'Reduced-Motion-Guard in selectLab');
  assert.ok(s.includes('classList.add("v53-switching")'), 'selectLab blendet aus');
  assert.ok(s.includes('classList.remove("v53-switching")'), 'selectLab blendet ein');
});
