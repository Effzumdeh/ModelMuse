/**
 * v55-Regression (Erklaervideo-Pfad Pages-fix, 04.11.2026):
 * Prueft das GEBAUTE Standalone-Artefakt
 * (dist-standalone/modelmuse-standalone.html):
 *  P2 videoBase je Kontext (dist-standalone-Vorschau ../docs/, Pages docs/),
 *  P3 @error-Fallback mit Alternativbasis (videoAlt, einmalig, Cleanup),
 *  Kette intakt (v50-v55, <600 KB), v54-Invarianten erhalten.
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

test('v55-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v50', 'v51 (Logo-V2 header links)', 'v52', 'v53', 'v54', 'v55']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('P2: videoBase je Kontext (dist-standalone ../docs/, Pages docs/)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'videoBase:function'), 1, 'videoBase genau 1x');
  assert.equal(cnt(s, 'videoFile:function'), 1, 'videoFile genau 1x');
  assert.equal(cnt(s, 'return "docs/";'), 1, 'Pages-Basis docs/ genau 1x');
  assert.equal(cnt(s, 'return "../docs/";'), 1, 'Lokal-Basis ../docs/ genau 1x');
  assert.ok(s.includes('dist-standalone/'), 'Vorschau-Erkennung fehlt');
  assert.ok(s.includes('modelmuse-standalone'), 'Dateinamen-Erkennung fehlt');
  assert.ok(s.includes('this.videoBase()+this.videoFile(l)'), 'Quelle nutzt Basis+Datei');
  // Aufloesungs-Beleg (Pages-Projektseite): relativ docs/ bleibt im Subpfad.
  const pages = new URL('docs/erklaervideo-de-180.mp4', 'https://effzumdeh.github.io/ModelMuse/').href;
  assert.equal(pages, 'https://effzumdeh.github.io/ModelMuse/docs/erklaervideo-de-180.mp4');
  // Altverhalten (Bug): ../docs/ verlaesst den Subpfad -> 404.
  const buggy = new URL('../docs/erklaervideo-de-180.mp4', 'https://effzumdeh.github.io/ModelMuse/').href;
  assert.equal(buggy, 'https://effzumdeh.github.io/docs/erklaervideo-de-180.mp4');
});

test('P3: @error-Fallback mit Alternativbasis (einmalig, Cleanup beim Schliessen)', async () => {
  const s = await html();
  assert.equal(cnt(s, '@error="onVideoError"'), 1, 'Error-Bindung genau 1x');
  assert.equal(cnt(s, 'onVideoError:function'), 1, 'Fallback-Methode genau 1x');
  assert.equal(cnt(s, 'videoAlt:function'), 1, 'Alternativ-Methode genau 1x');
  assert.equal(cnt(s, 'data-v55-alt'), 3, 'Markierung Get+Set+Cleanup');
  assert.ok(s.includes('this.videoAlt('), 'Fallback nutzt videoAlt');
  assert.ok(s.includes('removeAttribute("data-v55-alt")'), 'Close-Cleanup fehlt');
});

test('v54-Invarianten erhalten (Dual-Pfad, Quelle je UI-Sprache)', async () => {
  const s = await html();
  assert.equal(cnt(s, '../docs/erklaervideo-'), 2, 'Video-Pfad (CSS-Kommentar + Fallback)');
  assert.ok(s.includes('"../docs/erklaervideo-"+l+"-180.mp4"'), 'Fallback-Literal fehlt');
  assert.ok(s.includes('videoSrc:function'), 'Quell-Methode fehlt');
  assert.equal(cnt(s, 'v-if="videoOpen"'), 1, 'Popup-Template genau 1x');
  assert.equal(cnt(s, 'id="erklaervideo54"'), 1, 'Video-Element genau 1x');
});
