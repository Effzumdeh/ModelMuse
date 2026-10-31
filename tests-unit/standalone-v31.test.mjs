/**
 * v31-Regression: Eck-Overlay + ETA-Countdown + Auftrags-Queue.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html
 * (A/B/C des Eigentuemer-Auftrags 31.10.2026):
 *  A) Ueberarbeiten-Dialog wie Generieren unten in der Ecke.
 *  B) ETA-Countdown mit Geduld-Hinweis nach Ablauf, de/en/es, in beiden Overlays.
 *  C) Auftrags-Queue: Eingabe nach Start leer, weitere Generierung waehrend
 *     eine laeuft beauftragbar, Status je Auftrag, Ergebnisse eigene Modelle.
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

test('v31-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v31'), 1, 'v31-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v30'), 1, 'v30-Stempel bleibt');
  assert.equal(cnt(s, 'showcase: 5 Modelle'), 1, 'Showcase-Marker bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('A: Ueberarbeiten als Eck-Overlay wie Generieren', async () => {
  const s = await html();
  // Gleiche Eck-Geometrie in beiden Overlays (fixiert unten rechts).
  assert.equal(cnt(s, 'position:fixed;bottom:16px;right:16px'), 3, 'gen + mod + tele teilen die Eck-Geometrie');
  // Mod-Overlay bleibt Dialog mit Titel 'Modell ueberarbeiten'.
  assert.ok(s.includes('id="mod-status"'), 'Mod-Overlay mit eigener ID');
  assert.ok(s.includes('I18N.de.modifyTitle="Modell \u00fcberarbeiten"'), 'de-Titel Modell ueberarbeiten');
  assert.ok(s.includes('{{t(\'modifyTitle\')}}'), 'Titel aus i18n-Key');
  assert.equal(cnt(s, 'role="dialog"'), 3, 'genau 3 Dialoge (Tele + Modify + Bestandteil-Info)');
});

test('B: ETA-Countdown mit Geduld-Hinweis de/en/es in beiden Overlays', async () => {
  const s = await html();
  for (const loc of ['de', 'en', 'es']) {
    for (const key of ['genEta', 'modEta', 'genPatient', 'modPatient']) {
      assert.ok(s.includes(key) && cnt(s, key) >= 1, `${key} vorhanden (${loc}-Abdeckung im Block)`);
    }
  }
  // Countdown-Platzhalter und Geduld-Texte je Sprache.
  assert.ok(s.includes('ca. 1 Minute'), 'de-ETA ca. 1 Minute');
  assert.ok(s.includes('about 1 minute'), 'en-ETA about 1 minute');
  assert.ok(s.includes('aprox. 1 minuto'), 'es-ETA aprox. 1 minuto');
  assert.ok(s.includes('{s}'), 'Countdown-Sekundenplatzhalter');
  assert.equal(cnt(s, 'Hab noch einen Moment Geduld.'), 2, 'de-Geduld (gen + mod)');
  assert.ok(s.includes('Hang on a moment.'), 'en-Geduld');
  assert.ok(s.includes('Ten un poco m\u00e1s de paciencia.'), 'es-Geduld');
  // Timer-Verdrahtung: Start/Stopp je Overlay, Countdown ab 60.
  for (const m of ['startGenEta', 'stopGenEta', 'startModEta', 'stopModEta', 'genEtaText', 'modEtaText']) {
    assert.equal(cnt(s, m), 2, `${m} (Definition + Nutzung)`);
  }
  assert.ok(s.includes('genEta:0') && s.includes('modEta:0'), 'ETA-State ab 0');
  assert.ok(s.includes('id="gen-status"'), 'Gen-Overlay bleibt');
  assert.ok(s.includes('{{genEtaText}}') && s.includes('{{modEtaText}}'), 'Countdown im Template beider Overlays');
});

test('C: Auftrags-Queue (Eingabe leeren, beauftragbar, Status je Auftrag)', async () => {
  const s = await html();
  // Button nie disabled: weitere Generierung waehrend eine laeuft beauftragbar.
  assert.equal(cnt(s, '@click="generate"'), 0, 'kein blockierender Handler');
  assert.equal(cnt(s, '@click="enqueueGenerate"'), 1, 'Queue-Einstieg');
  assert.ok(!s.includes('@click="enqueueGenerate" :disabled'), 'Button ohne disabled-Gate');
  // Eingabe wird nach Start geleert (gen + mod).
  assert.ok(s.includes('try{this.genDesc="";}catch(eGenClear){}'), 'Gen-Eingabe leeren');
  assert.ok(s.includes('try{this.modDesc="";}catch(eModClear){}'), 'Mod-Eingabe leeren');
  // Queue-Kern: Pumpe + Status je Auftrag.
  assert.equal(cnt(s, 'enqueueGenerate'), 2, 'enqueue (Template + Methode)');
  assert.equal(cnt(s, 'pumpGenQueue'), 3, 'Pumpe (2 Einreihungen + Methode, v35)');
  assert.ok(s.includes('id="gen-jobs"'), 'Auftragsliste im Overlay');
  for (const key of ['jobWaiting', 'jobRunning', 'jobDone', 'jobError', 'genJobsTitle']) {
    assert.ok(cnt(s, key) >= 3, `${key} mit de/en/es-Abdeckung`);
  }
  // Ergebnis je Auftrag eigenes Modell: generate nimmt Auftrags-Term,
  // Modellbau (makeFreeLab/persistFree) unveraendert im Ablauf.
  assert.ok(s.includes('generate:async function(jobTerm)'), 'generate mit Auftrags-Term');
  assert.ok(s.includes('makeFreeLab') && s.includes('persistFree'), 'Modellablage unveraendert');
  // Stopp markiert Wartende (kein silently-hanging).
  assert.ok(s.includes('genStopped'), 'Stopp-Hinweis vorhanden');
});

test('C: Queue frisst keine Alt-Invarianten (Stichprobe)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'modify:async function'), 1, 'Modify-Logik genau 1x');
  assert.equal(cnt(s, 'id="mod-desc2"'), 1, 'Mod-Eingabe genau 1x');
  assert.equal(cnt(s, 'text/event-stream'), 3, 'SSE-Pfade unveraendert');
  assert.equal(cnt(s, 'reasoningAllowed'), 7, 'Reasoning-Gates unveraendert');
});
