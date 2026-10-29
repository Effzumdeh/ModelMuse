/** Unittests Teil 2: Sitzungs-Modellbibliothek (keine stille Persistenz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLibrary, setConsent, addEntry, getEntry, listEntries, removeEntry,
  touchEntryStatus, exportEntry, parseImportedSource, serializeForSession, restoreFromSession,
} from '../src/runtime/session-library.js';

const SRC = 'export const meta = { title: "T", category: "c", detailLevel: 2, parts: ["A","B","C"], units: "m" };\nexport function init(c, p) { return { update(patch) {}, dispose() {} }; }';

function lib1() {
  const lib = createLibrary();
  addEntry(lib, { id: 'si-1', title: 'SI 1', source: SRC, manifest: null, kind: 'kuratiert' });
  return lib;
}

test('add/get/list: kuratierte Referenz + Sitzungseintrag', () => {
  const lib = lib1();
  addEntry(lib, { id: 'frei-wind', title: 'Wind', source: SRC, providerId: 'baseten', modelId: 'muse-spark-open-1026', parentId: 'si-1' });
  assert.equal(listEntries(lib).length, 2);
  assert.equal(getEntry(lib, 'frei-wind').rev, 1);
  assert.equal(getEntry(lib, 'frei-wind').parentId, 'si-1');
});

test('Validierung: id-Format, Duplikat, Modulform', () => {
  const lib = lib1();
  assert.throws(() => addEntry(lib, { id: 'X!', title: 'x', source: SRC }), /E-LIB-ID/);
  assert.throws(() => addEntry(lib, { id: 'si-1', title: 'x', source: SRC }), /E-LIB-DUP/);
  assert.throws(() => addEntry(lib, { id: 'neu', title: 'x', source: 'kein modul' }), /E-LIB-SOURCE/);
  // Kuratierte Altform (ae-1/dup-1/si-2): export const init ist gueltig.
  const alt = SRC.replace('export function init(c, p)', 'export const init = (c, p) =>');
  addEntry(lib, { id: 'alt-1', title: 'alt', source: alt });
  assert.equal(getEntry(lib, 'alt-1').rev, 1);
});

test('Kuratiert ist schreibgeschuetzt (loeschen verboten)', () => {
  const lib = lib1();
  assert.throws(() => removeEntry(lib, 'si-1'), /E-LIB-READONLY/);
  addEntry(lib, { id: 'tmp-1', title: 't', source: SRC });
  assert.equal(removeEntry(lib, 'tmp-1'), true);
  assert.equal(getEntry(lib, 'tmp-1'), null);
});

test('Status/Ampel anhaengen (Harness-Scores)', () => {
  const lib = lib1();
  touchEntryStatus(lib, 'si-1', { ampel: 'gelb', scores: { punkte: 83 } });
  assert.equal(getEntry(lib, 'si-1').ampel, 'gelb');
});

test('Export enthaelt Provenienz, keinen Key', () => {
  const lib = lib1();
  const { filename, text } = exportEntry(lib, 'si-1');
  assert.equal(filename, 'si-1-r1.js');
  assert.ok(text.includes('si-1') && text.includes('meta-muse'));
  assert.ok(!/sk-|Bearer|api-key/i.test(text));
});

test('Import: gueltig ok, Fremdtext und script-Tag abgewiesen', () => {
  const { source } = parseImportedSource(`// Kopf\n${SRC}`);
  assert.ok(source.startsWith('export const meta'));
  assert.throws(() => parseImportedSource('hallo welt'), /E-LIB-SOURCE/);
  assert.throws(() => parseImportedSource(`${SRC}<\/script>`), /E-LIB-SOURCE/);
});

test('Serialisierung nur mit Zustimmung; Restore prueft Form', () => {
  const lib = lib1();
  assert.throws(() => serializeForSession(lib), /E-LIB-CONSENT/);
  setConsent(lib, true);
  const json = serializeForSession(lib);
  const back = restoreFromSession(json);
  assert.equal(back.entries.length, 1);
  assert.throws(() => restoreFromSession('{"v":2}'), /E-LIB-RESTORE/);
});
