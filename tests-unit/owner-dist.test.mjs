/** Owner-Dist-Marker (W1..W11 + Guard): statische Text-/Struktur-Invarianten des Bundle-Artefakts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FILE = 'dist-standalone/modelmuse-standalone.html';

let s = '';
test('setup: Artefakt lesbar', async () => {
  s = await readFile(FILE, 'utf8');
  assert.ok(s.length > 100000);
});

const eq = (sub, want) => assert.equal(s.split(sub).length - 1, want, sub);

test('Guard-Marker, altes Wortpaar weg', () => {
  eq('__FREE_GUARD_V18__', 1);
  eq('"parent","top"', 0);
});

test('W1 Confirm ohne eigene (de/en/es)', () => {
  assert.ok(s.includes('deleteConfirm="Dieses Modell wirklich l\u00f6schen?"'));
  assert.ok(s.includes('deleteConfirm="Really delete this model?"'));
  assert.ok(s.includes('deleteConfirm:"\u00bfEliminar este modelo?"'));
  eq('Dieses eigene Modell', 0);
  eq('delete this custom model', 0);
  eq('modelo propio', 0);
});

test('W2 Toggles nur Overlay, W7 Pill raus, W11 Beispiel raus', () => {
  eq('inline-flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" v-model="showLabels"', 0);
  eq('flex items-center gap-2 text-sm min-h-[44px] cursor-pointer"><input type="checkbox" v-model="showLabels"', 1);
  eq('flex items-center gap-2 text-sm min-h-[44px] cursor-pointer"><input type="checkbox" v-model="showMeasures"', 1);
  eq("{{t('viewerBadge')}}", 0);
  eq("{{t('exampleLoad')}}", 0);
  eq('exampleLoad', 4);
});

test('W3/W4/W6 Bloecke raus', () => {
  eq('<h2 class="text-2xl font-bold mb-3">{{activeLab.title[lang]}}</h2>', 0);
  eq("{{t('webglFallback')}}</p>", 0);
  eq("{{t('diagramNote')}}</p>", 0);
  eq('{{genDetailsMsg}}', 0);
  eq('genDetailsMsg:function', 0);
  eq('keyStore:function', 0);
});

test('W5 GeneratorHint neu (de/en/es)', () => {
  assert.ok(s.includes('W\u00e4hle Provider und Modell'));
  assert.ok(s.includes('Choose provider and model'));
  assert.ok(s.includes('Elige proveedor y modelo'));
  eq('Baseten-Direkt', 1);
  eq('Meta-Direkt', 0);
  eq('Baseten direct', 0);
});

test('W8 Key-Persistenz (Marker + I18N)', () => {
  eq('modelmuse.keys', 8);
  eq('keyStoredSession', 5);
  eq('keyStoredLocal', 5);
  eq('keyStoreMsg', 2);
  eq('keyStoredSession', 5);
});

test('W9 deleted-Persistenz, W10 emptyLibrary', () => {
  eq('modelmuse.deleted', 5); // v36 K1: Startaufloesung respektiert Loeschungen
  eq('emptyLibrary', 5);
  assert.ok(s.includes("{{search?t('noResults'):t('emptyLibrary')}}"));
});
