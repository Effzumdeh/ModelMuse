/**
 * v32-Regression: Overtime-Zaehler + Gesamtzeit + ETA-Tabelle.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  D) Nach ETA-Ablauf weiter hochzaehlen ('laenger als erwartet · +{s} s',
 *     de/en/es), Geduld-Hinweis bleibt.
 *  E) Bei Abschluss Gesamtzeit ('fertig nach {s} s', de/en/es).
 *  F) Flexible ETA-Tabelle (1.3 + Baseten/Meta + xhigh/max -> 240 s,
 *     sonst 60 s); Countdown + Overtime + Gesamtzeit nutzen Tabellenwert;
 *     Abort-Timeout folgt der Tabelle.
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

test('v32-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v32'), 1, 'v32-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v31'), 1, 'v31-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('D: Overtime-Texte de/en/es + Overtime-Mechanik', async () => {
  const s = await html();
  assert.equal(cnt(s, 'länger als erwartet'), 2, 'de-Overtime (gen + mod)');
  assert.equal(cnt(s, 'longer than expected'), 2, 'en-Overtime (gen + mod)');
  assert.equal(cnt(s, 'lento de lo esperado'), 2, 'es-Overtime (gen + mod)');
  assert.ok(s.includes('+{s} s'), 'Overtime-Platzhalter +s');
  assert.equal(cnt(s, 'genOverText:function'), 1, 'genOverText-Computed 1x');
  assert.equal(cnt(s, 'modOverText:function'), 1, 'modOverText-Computed 1x');
  assert.equal(cnt(s, 'genOver>0'), 1, 'Gen-Template schaltet auf Overtime');
  assert.equal(cnt(s, 'modOver>0'), 1, 'Mod-Template schaltet auf Overtime');
  assert.ok(s.includes('genOver:0') && s.includes('modOver:0'), 'Overtime-State ab 0');
  // Timer laeuft nach Ablauf weiter (kein clearInterval beim Erreichen von 0).
  assert.ok(s.includes('self.genOver=(self.genOver||0)+1'), 'Gen-Overtime zaehlt hoch');
  assert.ok(s.includes('self.modOver=(self.modOver||0)+1'), 'Mod-Overtime zaehlt hoch');
  // Geduld-Hinweis bleibt (v31-Vertrag).
  assert.equal(cnt(s, 'Hab noch einen Moment Geduld.'), 2, 'de-Geduld bleibt (gen + mod)');
});

test('E: Gesamtzeit bei Abschluss de/en/es', async () => {
  const s = await html();
  assert.equal(cnt(s, 'fertig nach {s} s'), 2, 'de-Gesamtzeit (gen + mod)');
  assert.equal(cnt(s, 'done after {s} s'), 2, 'en-Gesamtzeit (gen + mod)');
  assert.equal(cnt(s, 'listo tras {s} s'), 2, 'es-Gesamtzeit (gen + mod)');
  assert.equal(cnt(s, 'genTotalText:function'), 1, 'genTotalText-Computed 1x');
  assert.equal(cnt(s, 'modTotalText:function'), 1, 'modTotalText-Computed 1x');
  assert.ok(s.includes('this.genStatus+=" "+this.genTotalText'), 'Gen-Status haengt Gesamtzeit an');
  assert.ok(s.includes('this.modStatus+=" "+this.modTotalText'), 'Mod-Status haengt Gesamtzeit an');
});

test('F: ETA-Tabelle (240 s fuer 1.3+xhigh/max, sonst 60 s)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'Tabellen-Methode 1x');
  assert.ok(s.includes('m.indexOf("1.3")>=0') || s.includes('low.indexOf("1.3")>=0'), 'Modell-Filter 1.3 (v38 robust normalisiert)');
  assert.ok(s.includes('baseten-direct') && s.includes('meta-muse'), 'Provider-Filter');
  assert.ok(s.includes('return 240;'), 'Lang-ETA 240 s');
  // Countdown-Texte je Tabellenwert.
  assert.equal(cnt(s, 'ca. 4 Minuten'), 2, 'de-Lang-Countdown (gen + mod)');
  assert.equal(cnt(s, 'about 4 minutes'), 2, 'en-Lang-Countdown (gen + mod)');
  assert.equal(cnt(s, 'aprox. 4 minutos'), 2, 'es-Lang-Countdown (gen + mod)');
  assert.ok(s.includes('this.etaSeconds()>=120'), 'Countdown-Text folgt Tabelle');
  assert.ok(s.includes('this.genEta=this.etaSeconds()'), 'Gen-Start nutzt Tabelle');
  assert.ok(s.includes('this.modEta=this.etaSeconds()'), 'Mod-Start nutzt Tabelle');
  // Abort-Timeout folgt der Tabelle (kein fixer 120-s-Abbruch bei 4-Min-Jobs).
  assert.equal(cnt(s, '},120000);'), 0, 'kein fixer 120-s-Abort mehr');
  assert.equal(cnt(s, '*1000+120000'), 2, 'Abort = ETA + 120 s (gen + mod)');
});

test('F: v31-Vertrag bleibt (Countdown, Queue, Overlays)', async () => {
  const s = await html();
  assert.equal(cnt(s, '{{genEtaText}}'), 1, 'Gen-Countdown im Template');
  assert.equal(cnt(s, '{{modEtaText}}'), 1, 'Mod-Countdown im Template');
  assert.equal(cnt(s, 'enqueueGenerate'), 2, 'Queue-Einstieg unveraendert');
  assert.equal(cnt(s, 'pumpGenQueue'), 3, 'Queue-Pumpe (v35: 2 Einreihungen, 1 Pumpe)');
  assert.equal(cnt(s, 'position:fixed;bottom:16px;right:16px'), 3, 'Eck-Geometrie (gen + mod + tele)');
  assert.equal(cnt(s, 'modify:async function'), 1, 'Modify-Logik genau 1x');
  assert.equal(cnt(s, 'generate:async function(jobTerm)'), 1, 'Generate mit Auftrags-Term');
});
