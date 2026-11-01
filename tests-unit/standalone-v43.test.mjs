/**
 * v43-Regression: Versionshistorie ins Standalone-Release.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  H1 I18N-History-Keys (7 Keys x de/en/es/fr, Wortlaut Dev-Shell),
 *  H2 History-Helper (Vue-Methoden) + Tick-State,
 *  H3 History-UI — seit v44 (Historie gestrafft) OHNE Zurueck-Button, mit
 *      Ausgewaehlt-Markierung (Details siehe tests-unit/standalone-v44.test.mjs),
 *  H4 Verdrahtung (openModify-Tick, Record-Hook),
 *  H5 Kette intakt (Stempel v13..v43, 600-KB-Toleranz),
 *  H6 Verhalten: ausgelieferte Helper im Bundle (extrahiert, Stub-Kontext)
 *      V1..VX-Nummerierung, Familien-Key, Deckel 10, Restore in-place.
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

const HIST_KEYS = ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored'];

/** Klammer-Matching ab Index von '{' (string-sicher). */
function braceMatch(src, openIdx) {
  if (src[openIdx] !== '{') throw new Error('kein { bei ' + openIdx);
  let i = openIdx + 1; let depth = 1; let q = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null;
    } else if (c === "'" || c === '"' || c === '`') { q = c; }
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error('kein schliessendes } gefunden');
  return i - 1;
}

/** Extrahiert `name:function...` / `name:async function...` aus dem Bundle als Callable. */
function extractMethod(s, name) {
  let at = s.indexOf(name + ':async function');
  let asyncKw = at >= 0;
  if (!asyncKw) at = s.indexOf(name + ':function');
  assert.ok(at >= 0, 'Methode fehlt im Bundle: ' + name);
  const marker = name + (asyncKw ? ':async function' : ':function');
  assert.equal(s.indexOf(marker, at + 1), -1, 'Methode mehrdeutig: ' + name);
  const open = s.indexOf('{', at);
  const end = braceMatch(s, open);
  const params = s.slice(at + name.length + (asyncKw ? ':async function'.length : ':function'.length), open);
  const body = s.slice(open, end + 1);
  const factory = asyncKw
    ? new Function('return (async function' + params + body + ');')
    : new Function('return (function' + params + body + ');');
  return factory();
}

const SRC_A = 'import { Scene } from \'three\';\nexport const meta = { title: "Bank" };\nexport function init(c, p) { return { update() {}, dispose() {} }; }';
const SRC_B = SRC_A.replace('"Bank"', '"Bank rot"');
const SRC_C = SRC_A.replace('"Bank"', '"Bank gross"');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

/** Stub-Kontext: `this` fuer die extrahierten Bundle-Methoden. */
function stubContext(storage) {
  return {
    lang: 'de',
    modHistTick: 0,
    activeLab: { id: 'si-1', title: { de: 'Bank', en: 'Bank' }, _source: SRC_A },
    labs: [],
    modStatus: '',
    modStatusBad: false,
    t: (k) => ({
      histEntry: 'V{nr} · {datum} · {titel}',
      histRestored: '"{titel}" (V{nr}) wiederhergestellt.',
      histEmpty: 'leer',
      histNoPrev: 'kein-zurueck',
    }[k] || k),
    persistFree() {},
    syncViewer() {},
    _storage: storage,
  };
}

async function loadHelpers(storage) {
  const s = await html();
  const H = stubContext(storage);
  for (const name of ['histBaseId', 'histKey', 'histLoad', 'histSave', 'histAppend',
    'histRecord', 'histList', 'histEntryText', 'restoreHistoryVersion']) {
    H[name] = extractMethod(s, name);
  }
  return { s, H };
}

async function withGlobals(storage, fn) {
  const prevLS = globalThis.localStorage;
  const prevWin = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = {
    __viewer: {
      registerFree: (id, source) => ({ meta: { title: 'T', is3d: true }, metaI18n: null, source }),
    },
  };
  try {
    return await fn();
  } finally {
    if (prevLS === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLS;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
}

test('H5: v43-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v43'), 1, 'v43-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v42'), 1, 'v42-Stempel bleibt');
  assert.equal(cnt(s, 'standalone-build v41'), 1, 'v41-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB (Toleranz)');
});

test('H1: 7 History-Keys x de/en/es/fr (Wortlaut Dev-Shell)', async () => {
  const s = await html();
  for (const k of HIST_KEYS) {
    assert.equal(cnt(s, 'I18N.de.' + k + '='), 1, 'de-Key genau 1x: ' + k);
    assert.equal(cnt(s, 'I18N.en.' + k + '='), 1, 'en-Key genau 1x: ' + k);
    assert.equal(cnt(s, k + ':"'), 2, 'es/fr-Dict-Paar: ' + k);
  }
  assert.ok(s.includes('I18N.de.histBack="Zurück zur vorherigen Version";'), 'de Zurueck');
  assert.ok(s.includes('I18N.en.histBack="Back to previous version";'), 'en Back');
  assert.ok(s.includes('histBack:"Volver a la versión anterior"'), 'es Volver');
  assert.ok(s.includes('histBack:"Revenir à la version précédente"'), 'fr Revenir');
  assert.ok(s.includes('histRestore:"Restaurar"'), 'es Restaurar');
  assert.ok(s.includes('histRestore:"Restaurer"'), 'fr Restaurer');
  assert.ok(s.includes('I18N.de.histRestore="Wiederherstellen";'), 'de Wiederherstellen');
  assert.ok(s.includes('I18N.en.histRestore="Restore";'), 'en Restore');
  assert.ok(s.includes('V{nr}'), 'Platzhalter {nr} in histEntry');
  assert.ok(s.includes('Keine vorherige Version vorhanden.'), 'de keinZurueck');
  assert.ok(s.includes('No previous version available.'), 'en noPrev');
  assert.ok(s.includes('No hay ninguna versión anterior.'), 'es noPrev');
  assert.ok(s.includes('Aucune version précédente disponible.'), 'fr noPrev');
});

test('H2/H4: Helper-Methoden + Tick-State + Hooks genau 1x', async () => {
  const s = await html();
  for (const name of ['histBaseId:function', 'histKey:function', 'histLoad:function',
    'histSave:function', 'histAppend:function', 'histRecord:function',
    'histList:function', 'histEntryText:function',
    'restoreHistoryVersion:async function']) {
    assert.equal(cnt(s, name), 1, 'Methode genau 1x: ' + name);
  }
  // v44: Zurueck-Button + backHistory-Handler entfernt (Restore via V-Liste).
  assert.equal(cnt(s, 'backHistory:function'), 0, 'backHistory-Handler entfernt');
  assert.equal(cnt(s, 'modHistTick:0,'), 1, 'Tick-State genau 1x');
  assert.equal(cnt(s, 'this.modHistTick=(this.modHistTick||0)+1;'), 3, 'Tick-Bumps (openModify + append + restore)');
  assert.equal(cnt(s, 'this.histRecord(src,'), 1, 'Record-Hook im Modify-Erfolg');
  assert.equal(cnt(s, '"modelmuse-history-v1:"+'), 1, 'History-Namespace genau 1x');
});

test('H3: History-UI im Modify-Overlay (v44: ohne Zurueck-Button)', async () => {
  const s = await html();
  // v44 (Historie gestrafft): Zurueck-Button redundant zur V-Liste -> raus.
  assert.equal(cnt(s, '@click="backHistory"'), 0, 'Zurueck-Button entfernt');
  assert.equal(cnt(s, "{{t('histBack')}}"), 0, 'Zurueck-Label entfernt');
  assert.equal(cnt(s, '@click="restoreHistoryVersion(h.v)"'), 1, 'Wiederherstellen-Button genau 1x');
  assert.equal(cnt(s, 'v-for="h in histList()"'), 1, 'V-Liste genau 1x');
  assert.equal(cnt(s, "{{t('histTitle')}}"), 1, 'Verlaufstitel');
  assert.equal(cnt(s, "{{t('histEmpty')}}"), 1, 'Leer-Hinweis');
  assert.ok(s.includes('{{histEntryText(h)}}'), 'Versionseintrag V{nr} · Datum · Titel');
  // v44: aktives Label via histBtnText (Ausgewaehlt-Markierung, Details in v44-Test).
  assert.equal(cnt(s, "{{t('histRestore')}}"), 0, 'Restore-Label durch histBtnText ersetzt');
});

test('H6: Verhalten V1..VX (leer -> V1 Vorgaenger + V2 Ergebnis)', async () => {
  const storage = memoryStorage();
  const { H } = await loadHelpers(storage);
  await withGlobals(storage, async () => {
    assert.equal(H.histBaseId('si-1-mod3'), 'si-1', 'Familien-Key ohne -modN');
    assert.ok(H.histKey('si-1-mod1') === H.histKey('si-1'), 'gleicher Key');
    const vers = H.histRecord(SRC_A, 'Bank', SRC_B, 'Bank rot');
    assert.deepEqual(vers.map((e) => e.v), [1, 2], 'V1 + V2');
    assert.equal(vers[0].source, SRC_A, 'V1 = Vorgaenger');
    assert.equal(vers[1].source, SRC_B, 'V2 = Ergebnis');
    const list = H.histList();
    assert.deepEqual(list.map((e) => e.v), [2, 1], 'Liste neueste zuerst');
    assert.ok(H.histEntryText(list[1]).startsWith('V1 ·'), 'Eintragstext V1');
  });
});

test('H6: Verhalten Deckel 10 + Tore + Restore in-place', async () => {
  const storage = memoryStorage();
  const { H } = await loadHelpers(storage);
  await withGlobals(storage, async () => {
    for (let n = 0; n < 12; n += 1) {
      H.histAppend(SRC_A.replace('"Bank"', '"V' + n + '"'), 'V' + n);
    }
    const got = H.histLoad();
    assert.equal(got.length, 10, 'Deckel 10');
    assert.equal(got[got.length - 1].v, 12, 'neueste da');
    assert.equal(got[0].v, 3, 'aelteste evictet');
    assert.throws(() => H.histAppend('kein modul', 'x'), /E-HIST-SOURCE/, 'Tor wirft');
    // Restore V3 in-place (Historie bleibt, kein neuer Eintrag).
    H.activeLab = { id: 'si-1', title: { de: 'Bank', en: 'Bank' }, _source: SRC_C };
    await H.restoreHistoryVersion(3);
    assert.ok(H.activeLab._source.includes('"V2"') || H.activeLab._source.includes('V'), 'Snapshot geladen');
    assert.equal(H.histLoad().length, 10, 'kein neuer Eintrag bei Restore');
    assert.ok(String(H.modStatus).includes('(V3)'), 'Status mit Versionsnummer');
    assert.equal(H.modStatusBad, false, 'Restore ok');
  });
});
