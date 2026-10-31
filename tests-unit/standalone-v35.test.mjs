/**
 * v35-Regression: Modify in derselben Queue wie Generieren.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  J) Modify-Auftraege laufen sequenziell ueber dieselbe Pumpe
 *     (kein paralleler Direkt-Call), mit Art-Badge, Status, ETA/Overtime.
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

test('v35-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v35'), 1, 'v35-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v34'), 1, 'v34-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('J: ein Auftragstyp, eine Pumpe, kein Direkt-Call', async () => {
  const s = await html();
  assert.equal(cnt(s, "kind:'gen'"), 1, 'gen-Auftraege markiert');
  assert.equal(cnt(s, "kind:'mod'"), 1, 'mod-Auftraege markiert');
  assert.equal(cnt(s, 'modify(job.wish,job.labId)'), 1, 'Pumpe ruft modify mit Auftrag');
  assert.equal(cnt(s, 'enqueueModify'), 2, 'Einreihung (Call + Methode)');
  assert.equal(cnt(s, 'pumpGenQueue'), 3, 'eine Pumpe, zwei Einreihungen');
  assert.equal(cnt(s, 'modify:async function(jobWish,jobLabId)'), 1, 'modify nimmt Auftrag');
  assert.ok(!s.includes('return;}this.modify();}'), 'kein Direkt-Call aus submitModify');
  assert.ok(s.includes('try{this.enqueueModify();}catch(eSM){}'), 'submitModify reiht ein');
  assert.equal(cnt(s, ':disabled="modBusy"'), 0, 'Button nie disabled');
});

test('J: Statusliste mit Art-Badge, Ergebnis ersetzt Modell', async () => {
  const s = await html();
  assert.equal(cnt(s, 'jobGen'), 4, 'Neu-Badge (3 Locales + Einreihung)');
  assert.equal(cnt(s, 'jobMod'), 4, 'Ueberarbeiten-Badge (3 Locales + Einreihung)');
  assert.equal(cnt(s, 'job.kindKey'), 1, 'Badge im Template');
  assert.ok(s.includes('genBusy||genNotice||genPumping'), 'Fenster bei Pumpe sichtbar');
  assert.ok(s.includes('window.__viewer.registerFree(lab.id'), 'Ergebnis ersetzt bearbeitetes Modell');
  assert.ok(s.includes("((job.kind==='mod')?this.modStatus:this.genStatus)"), 'Status je Art');
});

test('J: Alt-Vertraege bleiben (Timer, Dock, Haertung)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'startModEta'), 2, 'Mod-Timer Start/Stopp bleiben');
  assert.equal(cnt(s, 'stopModEta'), 2, 'Mod-Timer Start/Stopp bleiben');
  assert.equal(cnt(s, 'toggleWinMin('), 3, 'Dock bleibt');
  assert.equal(cnt(s, 'normExp:function'), 1, 'Erklaerungs-Haertung bleibt');
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'ETA-Tabelle bleibt');
});
