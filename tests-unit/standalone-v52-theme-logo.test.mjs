/**
 * v52-Regression (Theme-Umschalter + Logo-Dark-Variante, 03.11.2026):
 * Prueft das GEBAUTE Standalone-Artefakt
 * (dist-standalone/modelmuse-standalone.html):
 *  L1) v52-Stempel genau 1x, Kette v50/v51 intakt, Groesse < 600 KB.
 *  L2) Duale Logo-Varianten: hell (Bestand) + dunkel (neu, helle Version mit
 *      #F8FAFC/#E8EDF3/#A5B4FC), je 1x vor dem App-Titel, Wechsel via
 *      .dark-Klasse (Pre-Paint-Head-Init), transparenter Chip (kein bg-white),
 *      kein <img>, keine data-URI, a11y genau 1x am Wrapper.
 *  L3) Theme-Umschalter: Default System (prefers-color-scheme + live),
 *      manuell persistiert (modelmuse.theme), Labels dark/light/themeLabel
 *      de/en/es/fr, kein System-only-Zwang mehr.
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

test('v52-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v50', 'v51 (Logo-V2 header links)', 'v52']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('L2: duale Logo-Varianten mit Farbschema-Wechsel', async () => {
  const s = await html();
  const H1_OLD = '<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>';
  const H1_NEW = '<h1 class="sr-only">{{t(\'appTitle\')}}</h1>';
  const is53 = s.includes('standalone-build v53');
  assert.equal(cnt(s, H1_OLD), is53 ? 0 : 1, 'H1-Anker v53-Toleranz (alt 1x pre-v53, 0x mit v53)');
  assert.equal(cnt(s, H1_NEW), is53 ? 1 : 0, 'H1-Anker v53-Toleranz (neu sr-only 0 pre, 1 mit v53)');
  const H1 = is53 ? H1_NEW : H1_OLD;
  assert.equal(cnt(s, H1), 1, 'H1-Anker fehlt/mehrdeutig');
  assert.equal(cnt(s, 'logo-chip-v51'), 1, 'Logo-Chip fehlt/mehrdeutig');
  assert.ok(s.indexOf('logo-chip-v51') < s.indexOf(H1), 'Logo steht vor dem App-Titel (oben links)');
  assert.equal(cnt(s, 'viewBox="0 0 621 170"'), 2, 'hell + dunkel je 1x');
  assert.equal(cnt(s, 'logo-v52-light'), 2, 'helle Variante (Span + CSS-Regel)');
  assert.equal(cnt(s, 'logo-v52-dark'), 3, 'dunkle Variante (Span + 2 CSS-Regeln)');
  assert.equal(cnt(s, 'logo-chip-v51 inline-flex items-center bg-white'), 0, 'Chip ist transparent (kein Weiss-Block im Dark Mode)');
  assert.equal(cnt(s, 'style="height:28px;width:auto;display:block"'), 2, 'Kopfzeilen-Stil je Variante');
  assert.equal(cnt(s, 'role="img" aria-label="ModelMuse Logo"'), 1, 'a11y genau 1x (Wrapper)');
  assert.ok(s.includes('.dark .logo-v52-light{display:none}'), 'Wechsel-Regel hell fehlt');
  assert.ok(s.includes('.dark .logo-v52-dark{display:block}'), 'Wechsel-Regel dunkel fehlt');
  assert.equal(cnt(s, '#F8FAFC'), 1, 'Dark-Text (Model) invertiert');
  assert.equal(cnt(s, '#E8EDF3'), 2, 'Dark-Kontur invertiert (Fill + Stroke)');
  assert.equal(cnt(s, '#A5B4FC'), 2, 'Dark-Indigo aufgehellt (Emblem + Muse)');
  assert.equal(cnt(s, '<img'), 0, 'kein externes <img>');
  assert.equal(cnt(s, 'data:image'), 1, 'keine neue Bild-data-URI (Bestand 1x, Favicon)');
});

test('L3: Theme-Umschalter (System-Default + live, Override persistiert)', async () => {
  const s = await html();
  // Head-Init: gespeicherte Wahl gewinnt, sonst System; live ohne Override.
  assert.ok(s.includes('ModelMuse Theme v52'), 'v52 Head-Init fehlt');
  assert.equal(cnt(s, 'modelmuse.theme'), 7, 'Storage-Key (Head 2 + Data 1 + Apply 1 + Mounted 2 + setTheme 1)');
  assert.equal(cnt(s, '__sysDark'), 0, 'kein System-only-Zwang');
  assert.equal(cnt(s, 'prefers-color-scheme'), 7, 'System-Default + Live-Listener');
  assert.ok(s.includes('addEventListener("change",__on52)') || s.includes('addListener(__on52)'), 'Live-Wechsel bei Systemaenderung');
  // Toggle-UI + Methoden.
  assert.equal(cnt(s, 'setTheme:function'), 1, 'setTheme-Methode');
  assert.equal(cnt(s, 'toggleTheme:function'), 1, 'toggleTheme-Methode');
  assert.equal(cnt(s, 'toggleTheme()'), 1, 'Toggle-Button');
  assert.ok(s.includes(':aria-label="t(\'themeLabel\')"'), 'Toggle-Gruppe mit Theme-Label');
  assert.equal(cnt(s, "t('dark')"), 1, 'Dunkel-Template');
  assert.equal(cnt(s, "t('light')"), 1, 'Hell-Template');
  // Labels de/en/es/fr.
  for (const [txt, code] of [['Dunkel', 'de'], ['Dark', 'en'], ['Oscuro', 'es'], ['Sombre', 'fr']]) {
    assert.ok(s.includes('dark:"' + txt + '"'), `dark-Label ${code}`);
  }
  for (const [txt, code] of [['Hell', 'de'], ['Light', 'en'], ['Claro', 'es'], ['Clair', 'fr']]) {
    assert.ok(s.includes('light:"' + txt + '"'), `light-Label ${code}`);
  }
  assert.equal(cnt(s, 'themeLabel'), 5, 'themeLabel de/en/es/fr + aria');
  assert.equal(cnt(s, 'theme:"dark"'), 0, 'kein hartcodierter Dark-Default');
  assert.equal(cnt(s, '<html lang="de" class="dark">'), 0, 'keine hartcodierte Dark-Klasse');
  assert.equal(cnt(s, '<html lang="de">'), 1, 'Sprach-Tag ohne Theme-Zwang');
});
