/**
 * v36-Regression: Startauswahl + Fallback + Geister-Modell.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  K) Start = zuletzt angesehenes Modell im zuletzt genutzten Modus;
 *     1-Modell-Fallback; 3D-zuerst; Loeschungen gewinnen immer (kein Geist).
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

test('v36-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v36'), 1, 'v36-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v35'), 1, 'v35-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('K: Startaufloesung (Loeschungen gewinnen, Fallback-Kette)', async () => {
  const s = await html();
  assert.ok(s.includes('__dd.indexOf(this.labs[__pi].id)'), 'Loeschungen gewinnen in gemergter Liste');
  assert.ok(s.includes('if(this.labs.length===1){__pick=this.labs[0];}'), '1-Modell-Fallback');
  assert.ok(s.includes('__L.is3d===false'), '3D-zuerst (nur explizit-2D ist 2D)');
  assert.ok(s.includes('localStorage.setItem("modelmuse.lab",__pick.id)'), 'Aufloesung persistiert');
  assert.equal(cnt(s, 'localStorage.removeItem("modelmuse.lab")'), 2, 'stale Auswahl geraeumt (Start + Loeschen)');
  assert.ok(s.includes('this.syncViewer();}catch(eSY){}'), 'Viewer folgt Aufloesung');
});

test('K: Modus persistiert und wiederhergestellt (3D/2D)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'modelmuse.mode'), 5, 'Modus: 4x persist + 1x restore');
  assert.ok(s.includes('if(__svm==="2d"&&this.viewerMode==="3d"){this.force2D();}'), '2D-Restore nur auf 3D-Stand');
  assert.ok(s.includes('localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eSM0){}'), 'syncViewer persistiert');
  assert.ok(s.includes('localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eTM){}'), 'to3D persistiert');
  assert.ok(s.includes('localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eFM){}'), 'force2D persistiert');
});

test('K: Alt-Vertraege bleiben (Queue, Dock, Timer, Haertung)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'enqueueModify'), 2, 'einheitliche Queue bleibt');
  assert.equal(cnt(s, 'pumpGenQueue'), 3, 'eine Pumpe bleibt');
  assert.equal(cnt(s, 'toggleWinMin('), 3, 'Dock bleibt');
  assert.equal(cnt(s, 'normExp:function'), 1, 'Erklaerungs-Haertung bleibt');
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'ETA-Tabelle bleibt');
  assert.equal(cnt(s, 'modify:async function(jobWish,jobLabId)'), 1, 'Auftrags-Modify bleibt');
});
