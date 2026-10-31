/**
 * v33-Regression: Mesh-Text raus + Erklaerungs-Haertung.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  G) 'x von y Meshes zugeordnet' ersatzlos entfernt (Anzeige + Methode
 *     + de/en/es-Keys); Rest des Bestandteile-Overlays intakt.
 *  H) Teilerklaerungen tolerant pro Index (normExp), fehlende als ""
 *     statt Totalausfall; Prompt-Forderung + Guard unveraendert.
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

test('v33-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v33'), 1, 'v33-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v32'), 1, 'v32-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('G: Mesh-Text ersatzlos entfernt, Overlay-Rest intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'mappingNote'), 0, 'kein mappingNote-Key/Template mehr');
  assert.equal(cnt(s, 'mappingText'), 0, 'keine mappingText-Methode mehr');
  assert.equal(cnt(s, 'Meshes zugeordnet'), 0, 'kein Meshes-Text mehr');
  // Rest des Bestandteile-Overlays: Liste + Info-Dialog + Texte bleiben.
  assert.equal(cnt(s, 'partExplanations'), 2, 'Erklaerungs-Computed + Template bleiben');
  assert.ok(s.includes('id="part-info"') || s.includes('partInfoIndex'), 'Part-Dialog bleibt');
  assert.equal(cnt(s, 'role="dialog"'), 2, 'weiter genau 2 Dialoge');
});

test('H: tolerante Erklaerungs-Zuordnung (normExp)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'normExp:function'), 1, 'normExp-Helper 1x');
  assert.equal(cnt(s, 'this.normExp('), 3, 'de/en/es ueber normExp');
  assert.ok(s.includes('var expDe=this.normExp(meta&&meta.explanations,parts.length,null)'), 'de tolerant');
  assert.ok(s.includes('var expEn=this.normExp(metaI18n&&metaI18n.en&&metaI18n.en.explanations,parts.length,expDe)'), 'en tolerant mit de-Fallback');
  assert.ok(s.includes('var expEs=this.normExp(metaI18n&&metaI18n.es&&metaI18n.es.explanations,parts.length,expDe)'), 'es tolerant mit de-Fallback');
  // Kein Alles-oder-Nichts mehr (expDe=null fiel auf [] zurueck).
  assert.equal(cnt(s, '?meta.explanations.slice():null'), 0, 'kein Totalausfall de mehr');
  assert.equal(cnt(s, 'explanations.length===parts.length)?metaI18n.en.explanations.slice():(expDe||[]).slice()'), 0, 'kein Totalausfall en mehr');
  // Prompt-Forderung (Pflicht) + Guard unveraendert.
  assert.ok(s.includes('Bestandteil-Erklaerungen (Pflicht'), 'Prompt-Forderung bleibt');
  assert.ok(s.includes('E-FREE-META: parts'), 'Guard bleibt');
});

test('H: v32-Vertrag bleibt (Overtime, Gesamtzeit, Tabelle)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'länger als erwartet'), 2, 'Overtime-Texte bleiben');
  assert.equal(cnt(s, 'fertig nach {s} s'), 2, 'Gesamtzeit-Texte bleiben');
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'ETA-Tabelle bleibt');
  assert.equal(cnt(s, '*1000+120000'), 2, 'dynamischer Abort bleibt');
  assert.equal(cnt(s, 'enqueueGenerate'), 2, 'Queue bleibt');
});
