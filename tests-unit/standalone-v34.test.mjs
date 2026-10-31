/**
 * v34-Regression: Overlay-Stapelung + Minimieren + Schliessen.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  I) Gen/Mod/Part-Fenster stapeln sich rechts (Win-Dock, neueste unten),
 *     je Fenster Win-Leiste mit Minimieren-zu-Bubble + Schliessen.
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

test('v34-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v34'), 1, 'v34-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v33'), 1, 'v33-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('I: Win-Dock stapelt rechts (neueste unten, aeltere oben)', async () => {
  const s = await html();
  assert.ok(s.includes('win-dock v34'), 'Dock-Skript vorhanden');
  assert.ok(s.includes('["gen-status","mod-status","part-info"]'), 'alle drei Fenster im Dock');
  assert.ok(s.includes('getBoundingClientRect'), 'nur sichtbare Fenster stapeln');
  assert.ok(s.includes('data-win-first'), 'Erst-Sehen-Reihenfolge (aeltere oben)');
  assert.ok(s.includes('ws[w].style.bottom'), 'Bottom-Offset pro Fenster');
  assert.ok(s.includes('.win-min>:not(.win-bar){display:none!important}'), 'Bubble blendet Inhalt aus');
});

test('I: je Fenster Minimieren-zu-Bubble + Schliessen', async () => {
  const s = await html();
  assert.equal(cnt(s, "toggleWinMin('gen')"), 1, 'Gen-Minimieren');
  assert.equal(cnt(s, "toggleWinMin('mod')"), 1, 'Mod-Minimieren');
  assert.equal(cnt(s, "toggleWinMin('part')"), 1, 'Part-Minimieren');
  assert.equal(cnt(s, 'winMin:{gen:false,mod:false,part:false}'), 1, 'Minimiert-State');
  assert.equal(cnt(s, '<div class="win-bar">'), 3, 'drei Win-Leisten');
  assert.ok(s.includes('@click="cancelGenerate();dismissGenNotice();"'), 'Gen-Close = Stopp + weg');
  assert.ok(s.includes('@click="closeModify"'), 'Mod-Close');
  assert.ok(s.includes('@click="closePartInfo"'), 'Part-Close');
  assert.equal(cnt(s, 'id="part-info"'), 1, 'Part-Dialog adressierbar');
});

test('I: Alt-Vertraege bleiben (Dialoge, Queue, Timer)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'role="dialog"'), 2, 'weiter genau 2 Dialoge');
  assert.equal(cnt(s, 'enqueueGenerate'), 2, 'Queue bleibt');
  assert.equal(cnt(s, 'normExp:function'), 1, 'Erklaerungs-Haertung bleibt');
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'ETA-Tabelle bleibt');
  assert.equal(cnt(s, '{{genEtaText}}'), 1, 'Countdown bleibt');
});
