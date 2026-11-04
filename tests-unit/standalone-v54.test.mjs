/**
 * v54-Regression (Erklaervideo-Popup + TEMP-DEAKTIVIERT, 04.11.2026):
 * Prueft das GEBAUTE Standalone-Artefakt
 * (dist-standalone/modelmuse-standalone.html):
 *  V1 Player (Button + schliessbares Popup, Video je UI-Sprache, de/en/es/fr),
 *  D1 OpenRouter/Ollama auskommentiert (Text bleibt, keine Auswahl),
 *  Kette intakt (v50/v51/v52/v53-Stempel, <600 KB).
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

test('v54-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v50', 'v51 (Logo-V2 header links)', 'v52', 'v53', 'v54']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('V1: Video-Button + schliessbares Popup (Video je UI-Sprache)', async () => {
  const s = await html();
  assert.equal(cnt(s, '@click="openVideo"'), 1, 'Video-Button genau 1x');
  assert.equal(cnt(s, 'v-if="videoOpen"'), 1, 'Popup-Template genau 1x');
  assert.ok(s.includes('role="dialog"'), 'Dialog-Rolle fehlt');
  assert.ok(s.includes(':aria-label="t(\'videoTitle\')"'), 'Dialog-Label fehlt');
  assert.equal(cnt(s, 'id="erklaervideo54"'), 1, 'Video-Element genau 1x');
  assert.ok(s.includes(':src="videoSrc()"'), 'Video-Quelle nicht gebunden');
  assert.ok(s.includes('controls preload="none"'), 'Controls/preload fehlen');
  assert.equal(cnt(s, '@click="closeVideo"'), 1, 'Close-Button genau 1x');
  assert.equal(cnt(s, '@click.self="closeVideo"'), 1, 'Backdrop-Close genau 1x');
  assert.ok(s.includes('if(this.videoOpen){this.closeVideo();return;}'), 'Escape schliesst Video zuerst');
  assert.equal(cnt(s, '../docs/erklaervideo-'), 2, 'Video-Pfad (CSS-Kommentar + Methode)');
  assert.ok(s.includes('"../docs/erklaervideo-"+l+"-180.mp4"'), 'Quelle folgt UI-Sprache (de/en/es/fr-180, Fallback de)');
  assert.equal(cnt(s, 'v54-video-popup'), 2, 'Popup-Marker (CSS + Template)');
});

test('V1: Video-I18N de/en/es/fr (je 4 Keys, Paritaet)', async () => {
  const s = await html();
  for (const k of ['videoBtn:', 'videoTitle:', 'videoClose:', 'videoMissing:']) {
    assert.equal(cnt(s, k), 4, `${k} je Lokale`);
  }
  assert.ok(s.includes('videoBtn:"Erklärvideo"'), 'de videoBtn');
  assert.ok(s.includes('videoBtn:"Explainer video"'), 'en videoBtn');
  assert.ok(s.includes('deo explicativo'), 'es videoBtn');
  assert.ok(s.includes('o explicative'), 'fr videoBtn');
});

test('D1: TEMP-DEAKTIVIERT (auskommentiert, Text bleibt, keine Auswahl)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'TEMP-DEAKTIVIERT-v54'), 1, 'Deaktivierungs-Kommentar genau 1x');
  // Text bleibt (v38/v46-Zaehler), aber im Kommentar — keine aktive Auswahl.
  for (const keep of ['id:"openrouter"', 'id:"ollama"', 'https://openrouter.ai/api/v1', 'http://localhost:11434/v1']) {
    assert.equal(cnt(s, keep), 1, `${keep} bleibt (Kommentar)`);
  }
  assert.ok(s.includes('/* TEMP-DEAKTIVIERT-v54'), 'Blockkommentar oeffnet');
  assert.ok(s.includes(' */,{id:"meta-muse"'), 'Blockkommentar schliesst vor meta-muse');
  // Dropdown bleibt dynamisch (v-for) — deaktivierte Anbieter ohne eigenen Zweig.
  assert.equal(cnt(s, 'v-for="p in genProviders"'), 1, 'Dropdown rendert aktive Liste');
});
