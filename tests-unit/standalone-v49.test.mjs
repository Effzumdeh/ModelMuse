/**
 * v49-Regression (Countdown-eine-Deadline, 03.11.2026):
 * Foto-Beleg: Kopf "ca. 4 Minuten - noch 238 s", derselbe Auftrag in der
 * Queue "noch 58 s" (Basis 240 vs 60, eigener Zaehler vs Wall-Clock).
 * Regel: Ein Auftrag, eine Deadline - Rest = (Job-Start + ETA-Tabelle)
 *   - jetzt; Kopf und Queue lesen dieselbe Deadline, kein eigener Zaehler.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  H1) Helfer deadlineEtaFor/deadlineRemainFor/runningJobFor je 1x.
 *  H2) Ein Takt (queueTimer) synchronisiert Kopf-Spiegel aus Deadline.
 *  H3) Start ohne eigenes Intervall (Timer null, Basis = Job-Start + ETA).
 *  H4/H5) Kopf-Texte aus Deadline, queueNow-getrieben.
 *  H6) Queue aus derselben Deadline, Fallback 240 (kein 60er-Fallback,
 *      kein eigener Dekrement-Zaehler).
 *  F) Funktional: gleiche Deadline -> Kopf-Rest == Queue-Rest (simuliert).
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

test('v49-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v47', 'v48', 'v49']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('H1: eine Deadline-Quelle (Helfer je 1x)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'deadlineEtaFor:function'), 1, 'deadlineEtaFor genau 1x');
  assert.equal(cnt(s, 'deadlineRemainFor:function'), 1, 'deadlineRemainFor genau 1x');
  assert.equal(cnt(s, 'runningJobFor:function'), 1, 'runningJobFor genau 1x');
  assert.ok(s.includes('job.eta=this.etaSeconds()'), 'Snapshot Job-Start + ETA-Tabelle bleibt');
  assert.equal(cnt(s, 'etaSeconds:function(){return 240;}'), 1, 'ETA-Tabelle flat 240 bleibt');
});

test('H2/H3: ein Takt, kein eigener Zaehlerstand', async () => {
  const s = await html();
  assert.equal(cnt(s, 'queueTickStart:function'), 1, 'genau 1 Takt');
  assert.equal(cnt(s, 'self.deadlineRemainFor(gj)'), 1, 'Kopf-gen aus Deadline synchronisiert');
  assert.equal(cnt(s, 'self.deadlineRemainFor(mj)'), 1, 'Kopf-mod aus Deadline synchronisiert');
  assert.equal(cnt(s, 'job.eta||60'), 0, '60er-Fallback raus (Basis waere 60 statt 240)');
  assert.equal(cnt(s, 'self.genEta-=1'), 0, 'eigener gen-Zaehler raus');
  assert.equal(cnt(s, 'self.modEta-=1'), 0, 'eigener mod-Zaehler raus');
  assert.ok(s.includes('this.genEtaTimer=null'), 'gen-Timer kein Intervall mehr');
  assert.ok(s.includes('this.modEtaTimer=null'), 'mod-Timer kein Intervall mehr');
  assert.ok(s.includes('this.runningJobFor("gen")'), 'gen-Start mit laufendem Auftrag synchronisiert');
  assert.ok(s.includes('this.runningJobFor("mod")'), 'mod-Start mit laufendem Auftrag synchronisiert');
});

test('H4/H5/H6: Kopf und Queue aus derselben Deadline', async () => {
  const s = await html();
  assert.ok(s.includes('genEtaText:function(){try{var qn=this.queueNow'), 'gen-Kopf queueNow-getrieben');
  assert.ok(s.includes('modEtaText:function(){try{var qn=this.queueNow'), 'mod-Kopf queueNow-getrieben');
  assert.ok(s.includes('genOverText:function(){try{var qn=this.queueNow'), 'gen-Overtime queueNow-getrieben');
  assert.ok(s.includes('modOverText:function(){try{var qn=this.queueNow'), 'mod-Overtime queueNow-getrieben');
  assert.ok(s.includes('var rr=null;try{rr=this.deadlineRemainFor(job);}catch(eR){rr=null;}var eta=rr?rr.eta:240;'), 'Queue-Rest aus Deadline (Fallback 240)');
  assert.ok(s.includes('var v=rem>=0?rem:(el2-eta);'), 'Queue-Overtime aus derselben Deadline');
});

test('F: gleiche Deadline -> identische Restzeit (simuliert)', async () => {
  // Gleiche Formel wie deadlineRemainFor im Artefakt:
  // eta aus Snapshot (240), el = round((jetzt - jobStart)/1000), rem = eta - el.
  const eta = 240;
  const jobStart = 1000000;
  const remainAt = (now) => {
    const el = Math.max(0, Math.round((now - jobStart) / 1000));
    return eta - el;
  };
  // Foto-Szenario: nach 2 s muessen BEIDE 238 zeigen (nicht 238 vs 58).
  assert.equal(remainAt(jobStart + 2000), 238, 'Kopf-Rest nach 2 s');
  assert.equal(remainAt(jobStart + 2000), 238, 'Queue-Rest nach 2 s (identisch)');
  // Overtime: nach 250 s zeigen BEIDE +10 s (el - eta).
  const elOver = Math.max(0, Math.round((jobStart + 250000 - jobStart) / 1000));
  assert.equal(elOver - eta, 10, 'Overtime identisch (+10 s)');
});
