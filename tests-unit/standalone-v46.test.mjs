/**
 * v46-Regression (Final-Sprint 03.11.2026): ETA flat 240 s, Modus-Auto,
 * Funktions-Footer, docs/LICENSES.md-Link, Ollama lokal, System-Theme.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  E) etaSeconds flat 240 (keine Tabelle), Kurz-Texte ca. 4 Minuten x4.
 *  M) Modus-Buttons raus, 2D nur Fallback-Hinweis.
 *  F/L) Funktions-Footer x4, Lizenz-Link auf docs/LICENSES.md.
 *  O) Ollama-Provider (localhost:11434, Freitext leer, kein Key, localhost-Hinweise).
 *  T) Kein Umschalter, Farbschema ausschliesslich System (live).
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

test('v46-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v44', 'v45', 'v46']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('E: ETA flat 240 s fuer alle Modelle/Reasoning-Stufen', async () => {
  const s = await html();
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'genau 1 ETA-Methode');
  assert.ok(s.includes('etaSeconds:function(){return 240;}'), 'flat 240 s (Tabelle ersetzt)');
  for (const [txt, n] of [['ca. 4 Minuten', 4], ['about 4 minutes', 4], ['aprox. 4 minutos', 4], ['env. 4 minutes', 4]]) {
    assert.equal(cnt(s, txt), n, `Countdown-Texte: ${txt}`);
  }
  for (const txt of ['ca. 1 Minute', 'about 1 minute', 'aprox. 1 minuto', 'env. 1 minute']) {
    assert.equal(cnt(s, txt), 0, `1-Min-Text raus: ${txt}`);
  }
});

test('M: Modus-Auto ohne Buttons (3D bzw. 2D-Fallback)', async () => {
  const s = await html();
  assert.equal(cnt(s, '@click="force2D"'), 0, 'force2D-Button raus');
  assert.equal(cnt(s, '@click="to3D"'), 0, 'to3D-Button raus');
  assert.equal(cnt(s, "{{t('mode2d')}}"), 0, 'Modus-2D-Template raus');
  assert.equal(cnt(s, "{{t('mode3d')}}"), 0, 'Modus-3D-Template raus');
  assert.equal(cnt(s, "{{t('is3dReason')}}"), 1, '2D-Fallback-Hinweis bleibt');
});

test('F/L: Funktions-Footer + LICENSES-Link', async () => {
  const s = await html();
  for (const [txt, code] of [
    ['Baue 3D-Modelle mit deinem LLM', 'de'], ['Build 3D models with your LLM', 'en'],
    ['Crea modelos 3D con tu LLM', 'es'], ['avec ton LLM', 'fr'],
  ]) {
    assert.ok(s.includes(txt), `Funktions-Satz fehlt: ${code}`);
  }
  assert.equal(cnt(s, 'Standalone · Client-only.'), 0, 'alter Footer-Text raus');
  assert.equal(cnt(s, 'docs/LIZENZEN.md'), 0, 'alte Lizenzablage raus');
  assert.ok(cnt(s, 'docs/LICENSES.md') >= 5, 'Lizenzverweis + Link vorhanden');
  assert.equal(cnt(s, 'href="docs/LICENSES.md"'), 1, 'Lizenz-Link genau 1x');
  assert.equal(cnt(s, 'footerLic:'), 4, 'footerLic-Keys de/en/es/fr');
});

test('O: Ollama lokal (Freitext leer, kein Key, localhost-Hinweise)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'id:"ollama"'), 1, 'Provider-ID genau 1x');
  assert.ok(s.includes('http://localhost:11434/v1'), 'OpenAI-kompatible Basis');
  assert.equal(cnt(s, 'models:[]'), 1, 'kein Dropdown-Modell (Freitext)');
  assert.ok(s.includes("if(this.genProvider==='ollama'){this.genModel='';}"), 'Modellfeld wird geleert');
  assert.equal(cnt(s, "v-if=\"genProvider!=='ollama'\""), 2, 'Modell-Select + Key-Block nur non-ollama');
  assert.equal(cnt(s, "v-if=\"genProvider==='ollama'\""), 1, 'ollama-Hinweiszeile');
  assert.equal(cnt(s, 'modelmuse-key-ollama'), 3, 'eigene Key-Namen (load/location/save)');
  for (const k of ['ollamaHint', 'keyMissingOllama', 'ollamaModelPh', 'ollamaModelEmpty']) {
    assert.ok(cnt(s, k) >= 5, `${k} de/en/es/fr + Verwendung`);
  }
  assert.ok(s.includes('OLLAMA_ORIGINS'), 'CORS-Hinweis');
  assert.ok(!s.includes('127.0.0.1:8787') && !s.includes('localhost:8787'), 'kein lokaler Proxy-Port');
});

test('T: System-Default + Umschalter mit Override (v52-Nachfolger)', async () => {
  const s = await html();
  // v52: Umschalter zurueck — Default folgt System (live), manuell persistiert.
  assert.equal(cnt(s, 'setTheme:function'), 1, 'setTheme-Methode genau 1x');
  assert.equal(cnt(s, 'toggleTheme:function'), 1, 'toggleTheme-Methode genau 1x');
  assert.equal(cnt(s, 'toggleTheme()'), 1, 'Toggle-Button ruft toggleTheme');
  assert.equal(cnt(s, 'modelmuse.theme'), 7, 'Theme-Override persistiert (Head/Data/Apply/Mounted/setTheme)');
  assert.equal(cnt(s, '__sysDark'), 0, 'kein System-only-Zwang mehr');
  assert.equal(cnt(s, 'prefers-color-scheme'), 7, 'System-Default + Live-Listener (Head/Data/Apply/Mounted)');
  assert.ok(s.includes(":aria-label=\"t('themeLabel')\""), 'Toggle-Gruppe mit Theme-Label');
  assert.equal(cnt(s, "t('dark')"), 1, 'Dunkel-Label (Template)');
  assert.equal(cnt(s, "t('light')"), 1, 'Hell-Label (Template)');
  assert.equal(cnt(s, 'themeLabel'), 5, 'themeLabel de/en/es/fr + aria');
  for (const [txt, code] of [['Dunkel', 'de'], ['Dark', 'en'], ['Oscuro', 'es'], ['Sombre', 'fr']]) {
    assert.ok(s.includes('dark:"' + txt + '"'), 'dark-Label ' + code);
  }
  for (const [txt, code] of [['Hell', 'de'], ['Light', 'en'], ['Claro', 'es'], ['Clair', 'fr']]) {
    assert.ok(s.includes('light:"' + txt + '"'), 'light-Label ' + code);
  }
});
