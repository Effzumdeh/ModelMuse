/**
 * Erklaervideo-Player (04.11.2026): statische Nachweise ohne DOM/Netz.
 * Welcome-Dialog (#onboard) hat Erklaervideo-Button + schliessbares Popup mit
 * Videoplayer (Sprache = UI-Sprache, Videos docs/erklaervideo-{de,en,es,fr}-180.mp4).
 * TEMP-DEAKTIVIERT-Pin: UI-Liste zeigt nur aktive Anbieter (meta-muse, baseten).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { providerOptions } from '../src/shell/ui-providers.js';
import { isProviderDeaktiviert, activeProviders } from '../src/runtime/providers.js';

const reg = JSON.parse(await readFile('src/data/providers.json', 'utf8'));

test('Shell: Welcome-Dialog hat Erklaervideo-Button + schliessbares Popup', async () => {
  const html = await readFile('src/shell/index.html', 'utf8');
  assert.ok(html.includes('id="onboard-video"'), 'Erklaervideo-Button fehlt');
  assert.ok(html.includes('data-i18n="onboarding.videoBtn"'), 'Button-i18n-Anker fehlt');
  assert.ok(html.includes('id="video-popup"'), 'Popup fehlt');
  assert.ok(html.includes('role="dialog"'), 'Dialog-Rolle fehlt');
  assert.ok(html.includes('aria-modal="true"'), 'Modal-Markierung fehlt');
  assert.ok(html.includes('id="erklaervideo"'), 'Videoplayer fehlt');
  assert.ok(html.includes('controls'), 'Video-Controls fehlen');
  assert.ok(html.includes('id="video-close"'), 'Schliessen-Button fehlt');
  assert.ok(html.includes('data-i18n="video.titel"'), 'Titel-i18n fehlt');
  assert.ok(html.includes('data-i18n="video.schliessen"'), 'Schliessen-i18n fehlt');
  assert.ok(!html.includes('video.missing'), 'video.missing-Fallback entfernt (Videos immer mitgeliefert)');
  assert.ok(html.includes("media-src 'self'"), 'CSP media-src fehlt (Video wuerde blocken)');
});

test('Shell: Videos je UI-Sprache vorhanden (docs/erklaervideo-{de,en,es,fr}-180.mp4)', async () => {
  for (const loc of ['de', 'en', 'es', 'fr']) {
    const p = `docs/erklaervideo-${loc}-180.mp4`;
    const s = await stat(p);
    assert.ok(s.size > 1000000, `${p}: zu klein (${s.size} Bytes)`);
  }
});

test('Shell: Player-Logik (Sprache=UI-Sprache, Close/Esc/Backdrop, Sprachwechsel)', async () => {
  const js = await readFile('src/shell/main.js', 'utf8');
  assert.ok(js.includes('erklaervideo-'), 'Video-Dateiname fehlt');
  assert.ok(js.includes('-180.mp4'), 'Video-Dateiname folgt nicht dem -180-Finalschnitt');
  assert.ok(js.includes('videoSrcFor(getLocale())'), 'Quelle folgt UI-Sprache nicht');
  assert.ok(js.includes("getElementById('onboard-video')"), 'Button-Verdrahtung fehlt');
  assert.ok(js.includes("getElementById('video-close')"), 'Close-Verdrahtung fehlt');
  assert.ok(js.includes("ev.key === 'Escape'"), 'Escape-Close fehlt');
  assert.ok(js.includes('ev.target === videoPopup'), 'Backdrop-Close fehlt');
  assert.ok(js.includes('.pause()'), 'Video-Stopp beim Schliessen fehlt');
  assert.ok(js.includes('removeAttribute'), 'Video-Reset beim Schliessen fehlt');
  assert.ok(js.includes('videoSrcFor(getLocale())'), 'Sprachwechsel-Refresh fehlt');
  const css = await readFile('src/shell/theme.css', 'utf8');
  assert.ok(css.includes('.lab-video-popup'), 'Popup-CSS fehlt');
  assert.ok(css.includes('.lab-video-panel'), 'Panel-CSS fehlt');
});

test('Shell: Video-i18n de/en/es/fr (Paritaet via i18n.test, hier Inhalt; kein missing-Fallback)', async () => {
  const { t } = await import('../src/shell/i18n.js');
  for (const loc of ['de', 'en', 'es', 'fr']) {
    assert.ok(t(loc, 'onboarding.videoBtn').length > 2, `${loc}: videoBtn leer`);
    assert.ok(t(loc, 'video.titel').length > 2, `${loc}: titel leer`);
    assert.ok(t(loc, 'video.schliessen').length > 2, `${loc}: schliessen leer`);
    assert.equal(t(loc, 'video.missing'), 'video.missing', `${loc}: missing-Fallback unerwartet vorhanden`);
  }
  for (const loc of ['de', 'en', 'es', 'fr']) {
    const dict = JSON.parse(await readFile(`src/shell/i18n/${loc}.json`, 'utf8'));
    assert.ok(!('missing' in (dict.video ?? {})), `${loc}: video.missing-Key entfernt`);
  }
});

test('TEMP: UI-Liste zeigt nur aktive Anbieter (OpenRouter/Ollama deaktiviert)', () => {
  assert.equal(isProviderDeaktiviert('openrouter'), true);
  assert.equal(isProviderDeaktiviert('ollama'), true);
  const opts = providerOptions(reg).map((o) => o.id).sort();
  assert.deepEqual(opts, ['baseten', 'meta-muse']);
  assert.deepEqual(activeProviders(reg).map((p) => p.id).sort(), ['baseten', 'meta-muse']);
});
