/** Unittests lokale Modell-Versionshistorie (rein, DOM-frei, Memory-Storage). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_LIMIT, HISTORY_KEY_PREFIX, baseLabId, historyKey,
  loadHistory, saveHistory, nextVersionNumber,
  appendVersion, recordModify, getVersion,
} from '../src/runtime/model-history.js';

const SRC_A = `import { Scene } from 'three';
export const meta = { title: "Bank", category: "hardware", detailLevel: 2, parts: ["A","B","C"], units: "m" };
export function init(c, p) { return { update(patch) {}, dispose() {} }; }
`;
const SRC_B = SRC_A.replace('"Bank"', '"Bank rot"');
const SRC_C = SRC_A.replace('"Bank"', '"Bank gross"');

/** @returns {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void, _map: Map<string, string> }} */
function memoryStorage() {
  const map = new Map();
  return {
    _map: map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('baseLabId/historyKey: -modN-Familie teilt einen Key', () => {
  assert.equal(baseLabId('si-1-mod3'), 'si-1');
  assert.equal(baseLabId('si-1'), 'si-1');
  assert.ok(historyKey('si-1-mod1') === historyKey('si-1'), 'gleicher Key');
  assert.ok(historyKey('si-1').startsWith(HISTORY_KEY_PREFIX), 'Namespace');
  assert.ok(historyKey('si-1') !== historyKey('si-2'), 'Trennung je Lab');
});

test('loadHistory: leer/kaputt -> [], valide sortiert', () => {
  const s = memoryStorage();
  assert.deepEqual(loadHistory(s, 'si-1'), []);
  assert.deepEqual(loadHistory(null, 'si-1'), []);
  s.setItem(historyKey('si-1'), 'kein-json{{{');
  assert.deepEqual(loadHistory(s, 'si-1'), [], 'kaputt toleriert');
  s.setItem(historyKey('si-1'), JSON.stringify({ v: 1, versions: [{ v: 2, ts: new Date().toISOString(), title: 'B', source: SRC_B }, { v: 1, ts: new Date().toISOString(), title: 'A', source: SRC_A }, { v: 0, title: 'x', source: SRC_A }, { v: 3, title: 'ohne quelle', source: 'leer' }] }));
  const got = loadHistory(s, 'si-1');
  assert.deepEqual(got.map((e) => e.v), [1, 2], 'nur valide, aufsteigend');
});

test('appendVersion: V1..VX Nummerierung, Zeitstempel, Titel', () => {
  const s = memoryStorage();
  const r1 = appendVersion(s, 'si-1', { source: SRC_A, title: 'Bank' });
  assert.equal(r1.entry.v, 1, 'Erstgenerierung = V1');
  assert.ok(!Number.isNaN(Date.parse(r1.entry.ts)), 'Zeitstempel');
  const r2 = appendVersion(s, 'si-1', { source: SRC_B, title: 'Bank rot' });
  assert.equal(r2.entry.v, 2, 'Ueberarbeitung +1');
  assert.equal(loadHistory(s, 'si-1').length, 2);
  assert.equal(nextVersionNumber(loadHistory(s, 'si-1')), 3);
});

test('appendVersion: Deckel 10 — neueste bleiben, Nummern monoton', () => {
  const s = memoryStorage();
  for (let n = 0; n < HISTORY_LIMIT + 4; n += 1) {
    appendVersion(s, 'ae-1', { source: SRC_A.replace('"Bank"', `"V${n}"`), title: `V${n}` });
  }
  const got = loadHistory(s, 'ae-1');
  assert.equal(got.length, HISTORY_LIMIT, `Deckel ${HISTORY_LIMIT}`);
  assert.equal(got[got.length - 1].v, HISTORY_LIMIT + 4, 'neueste Version da');
  assert.equal(got[0].v, 5, 'aelteste evictet');
  assert.equal(nextVersionNumber(got), HISTORY_LIMIT + 5, 'monoton weiter');
});

test('appendVersion: ungueltige Quelle wirft E-HIST-SOURCE', () => {
  const s = memoryStorage();
  assert.throws(() => appendVersion(s, 'si-1', { source: 'kein modul', title: 'x' }), /E-HIST-SOURCE/);
  assert.deepEqual(loadHistory(s, 'si-1'), [], 'nichts gespeichert');
});

test('recordModify: leer -> V1 Vorgaenger + V2 Ergebnis', () => {
  const s = memoryStorage();
  const { entry, versions } = recordModify(s, { labId: 'si-1-mod1', prevSource: SRC_A, prevTitle: 'Bank', nextSource: SRC_B, nextTitle: 'Bank rot' });
  assert.equal(versions.length, 2);
  assert.deepEqual(versions.map((e) => e.v), [1, 2]);
  assert.equal(versions[0].source, SRC_A, 'V1 = Vorgaenger');
  assert.equal(entry.v, 2, 'Ergebnis = V2');
  assert.equal(entry.source, SRC_B);
});

test('recordModify: bestehend -> nur Ergebnis V(n+1)', () => {
  const s = memoryStorage();
  appendVersion(s, 'si-1', { source: SRC_A, title: 'Bank' });
  const { versions } = recordModify(s, { labId: 'si-1-mod7', prevSource: SRC_A, prevTitle: 'Bank', nextSource: SRC_C, nextTitle: 'Bank gross' });
  assert.deepEqual(versions.map((e) => e.v), [1, 2], 'Familien-Key ohne -modN');
  assert.equal(versions[1].source, SRC_C);
});

test('getVersion: Treffer/Fehl -> null', () => {
  const s = memoryStorage();
  recordModify(s, { labId: 'dup-1', prevSource: SRC_A, prevTitle: 'A', nextSource: SRC_B, nextTitle: 'B' });
  const versions = loadHistory(s, 'dup-1');
  assert.equal(getVersion(versions, 1)?.title, 'A');
  assert.equal(getVersion(versions, 2)?.title, 'B');
  assert.equal(getVersion(versions, 99), null);
  assert.equal(getVersion(versions, 'x'), null);
});

test('saveHistory: Quota-Eviction wirft Aelteste raus statt zu scheitern', () => {
  const mem = memoryStorage();
  let budget = 0;
  const knapp = {
    getItem: mem.getItem,
    removeItem: mem.removeItem,
    setItem: (k, v) => {
      if (String(v).length > budget) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      mem.setItem(k, v);
    },
  };
  const versions = [];
  for (let n = 1; n <= 3; n += 1) {
    versions.push({ v: n, ts: new Date().toISOString(), title: `T${n}`, source: SRC_A });
  }
  budget = JSON.stringify({ v: 1, versions: versions.slice(-1) }).length;
  const saved = saveHistory(knapp, 'si-2', versions);
  assert.ok(saved.length >= 1 && saved.length < 3, 'evictet statt Abbruch');
  assert.equal(saved[saved.length - 1].v, 3, 'neueste bleibt');
});

test('saveHistory: ohne Storage -> E-HIST-SPEICHER', () => {
  assert.throws(() => saveHistory(null, 'si-1', []), /E-HIST-SPEICHER/);
});
