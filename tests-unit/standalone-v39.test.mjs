/**
 * v39-Regression: Kosten-/Dauer-Schaetzung unter Modellauswahl.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  K) #gen-estimate Template mit {{estimateText}} (reaktiv unter Auswahl),
 *     Methoden estimatePrice (Telemetrie-Tabelle) + estimateText
 *     (Dauer aus etaSeconds + Preis), I18N-Hinweis de/en/es.
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

test('v39-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v39'), 1, 'v39-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v38'), 1, 'v38-Stempel bleibt');
  assert.equal(cnt(s, 'standalone-build v37'), 1, 'v37-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('K: Schaetz-Template unter Modellauswahl (reaktiv)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'id="gen-estimate"'), 1, '#gen-estimate genau 1x');
  assert.equal(cnt(s, '{{estimateText}}'), 1, 'Binding genau 1x');
  // Direkt nach Generieren-Button (gleiche Auswahl-Zeile, w-full -> Umbruch).
  assert.ok(s.includes('>{{t(\'generateBtn\')}}</button><p id="gen-estimate"'), 'Estimate direkt unter Auswahl');
  assert.ok(s.includes('estimateText:function'), 'Methode vorhanden');
});

test('K: Dauer aus ETA-Tabelle, Preis aus Telemetrie', async () => {
  const s = await html();
  assert.equal(cnt(s, 'estimatePrice:function'), 1, 'Preis-Tabelle genau 1x');
  assert.ok(s.includes('d=this.etaSeconds()'), 'Dauer aus ETA-Tabelle');
  assert.ok(s.includes('p=this.estimatePrice()'), 'Preis aus Telemetrie-Tabelle');
  assert.ok(s.includes('I18N[L]&&I18N[L].genEstimate'), 'I18N-Anbindung mit lang');
  // Telemetrie-Mittelwerte je Modell (Eigentuemer 31.10.2026).
  assert.ok(s.includes('ct=0.6'), 'contributor ~0,6 ct');
  assert.ok(s.includes('ct=16.5'), '1.3 ~16,5 ct');
  assert.ok(s.includes('ct=78'), 'wonder ~78 ct');
  assert.ok(s.includes('ct=39'), 'gpt-6.1-sol ~39 ct');
  // Unvermessene (opus-5.5, spark-open-1026) -> '–', kein erfundener Preis.
  assert.ok(s.includes('includes("opus")'), 'opus-Zweig (unvermessen)');
  assert.ok(s.includes('includes("open")'), 'spark-open-Zweig (unvermessen)');
  // Modellschluessel robust: Prefix/Suffix gestrippt.
  assert.ok(s.includes('lastIndexOf("/")'), 'Vendor-Prefix gestrippt');
});

test('K: Hinweis de/en/es (Schaetzung aus Telemetrie)', async () => {
  const s = await html();
  assert.ok(s.includes('Schätzung aus Telemetrie'), 'de-Hinweis');
  assert.ok(s.includes('Estimate from telemetry'), 'en-Hinweis');
  assert.ok(s.includes('Estimaci'), 'es-Hinweis');
  assert.equal(cnt(s, 'genEstimate'), 5, 'genEstimate de+en+es+2 Referenzen');
});

test('K: Reaktivitaet (Provider/Modell/Sprache)', async () => {
  const s = await html();
  // estimatePrice liest genModel, estimateText ETA + Preis + lang.
  const priceFn = s.slice(s.indexOf('estimatePrice:function'), s.indexOf('estimatePrice:function') + 900);
  assert.ok(priceFn.includes('this.genModel'), 'Preis folgt Modellauswahl');
  const textFn = s.slice(s.indexOf('estimateText:function'), s.indexOf('estimateText:function') + 600);
  assert.ok(textFn.includes('this.etaSeconds()'), 'Text folgt ETA (= Provider/Modell/Reasoning)');
  assert.ok(textFn.includes('this.lang'), 'Text folgt Sprache');
});
