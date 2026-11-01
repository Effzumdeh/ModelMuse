/**
 * v44-Regression: Historien-UI gestrafft (Zurueck-Button raus, aktive
 * Version mit Ausgewaehlt-Markierung).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  S1 Zurueck-Button + backHistory-Handler entfernt,
 *  S2 histIsActive/histBtnText + emerald/disabled-Markierung nur fuer aktiv,
 *  S3 histSelected-Keys x de/en/es/fr (Wortlaut Dev-Shell),
 *  S4 Kette intakt (Stempel v13..v44, 600-KB-Toleranz),
 *  S6 Verhalten: Aktiv-Erkennung via lab._source, Restore in-place.
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
      histRestore: 'Wiederherstellen',
      histSelected: 'Ausgewählt',
      histEmpty: 'leer',
      histNoPrev: 'kein-zurueck',
    }[k] || k),
    persistFree() {},
    syncViewer() {},
    _storage: storage,
  };
}

async function loadHelpers(storage, names) {
  const s = await html();
  const H = stubContext(storage);
  for (const name of names) {
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

test('S4: v44-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v44'), 1, 'v44-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v43'), 1, 'v43-Stempel bleibt');
  assert.equal(cnt(s, 'standalone-build v42'), 1, 'v42-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB (Toleranz)');
});

test('S3: histSelected-Keys x de/en/es/fr (Wortlaut Dev-Shell)', async () => {
  const s = await html();
  for (const k of ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored', 'histSelected']) {
    assert.equal(cnt(s, 'I18N.de.' + k + '='), 1, 'de-Key genau 1x: ' + k);
    assert.equal(cnt(s, 'I18N.en.' + k + '='), 1, 'en-Key genau 1x: ' + k);
    assert.equal(cnt(s, k + ':"'), 2, 'es/fr-Dict-Paar: ' + k);
  }
  assert.ok(s.includes('I18N.de.histSelected="Ausgewählt";'), 'de Ausgewählt');
  assert.ok(s.includes('I18N.en.histSelected="Selected";'), 'en Selected');
  assert.ok(s.includes('histSelected:"Seleccionada"'), 'es Seleccionada');
  assert.ok(s.includes('histSelected:"Sélectionnée"'), 'fr Sélectionnée');
});

test('S1/S2: Zurueck raus, Ausgewaehlt-Markierung drin', async () => {
  const s = await html();
  assert.equal(cnt(s, 'backHistory:function'), 0, 'toter Handler entfernt');
  assert.equal(cnt(s, '@click="backHistory"'), 0, 'Zurueck-Button entfernt');
  assert.equal(cnt(s, "{{t('histBack')}}"), 0, 'Zurueck-Label entfernt');
  assert.equal(cnt(s, "{{t('histRestore')}}"), 0, 'Restore-Label durch histBtnText ersetzt');
  assert.equal(cnt(s, 'histIsActive:function'), 1, 'Aktiv-Erkennung genau 1x');
  assert.equal(cnt(s, 'histBtnText:function'), 1, 'Button-Label-Helper genau 1x');
  assert.equal(cnt(s, '{{histBtnText(h)}}'), 1, 'Listen-Button nutzt Label-Helper');
  assert.equal(cnt(s, ':disabled="histIsActive(h)"'), 1, 'aktiver Button disabled');
  assert.equal(cnt(s, "histIsActive(h)?'inline-flex"), 1, 'aktiver Button andere Farbe');
  assert.equal(cnt(s, '@click="restoreHistoryVersion(h.v)"'), 1, 'Restore-Klick bleibt');
  assert.equal(cnt(s, 'v-for="h in histList()"'), 1, 'V-Liste bleibt');
  assert.equal(cnt(s, 'this.modHistTick=(this.modHistTick||0)+1;'), 3, 'Tick-Bumps unveraendert');
});

test('S6: nur aktive Version unterscheidet sich (Quelle == Snapshot)', async () => {
  const storage = memoryStorage();
  const { H } = await loadHelpers(storage, ['histBaseId', 'histKey', 'histLoad', 'histSave', 'histAppend',
    'histRecord', 'histList', 'histEntryText', 'histIsActive', 'histBtnText', 'restoreHistoryVersion']);
  await withGlobals(storage, async () => {
    H.histRecord(SRC_A, 'Bank', SRC_B, 'Bank rot');
    const list = H.histList();
    assert.deepEqual(list.map((e) => e.v), [2, 1], 'Liste neueste zuerst');
    // Angezeigt wird V2-Ergebnis (lab._source = SRC_B) -> nur V2 aktiv.
    H.activeLab._source = SRC_B;
    assert.equal(H.histIsActive(list[0]), true, 'V2 aktiv');
    assert.equal(H.histIsActive(list[1]), false, 'V1 inaktiv');
    assert.equal(H.histBtnText(list[0]), 'Ausgewählt', 'aktiv: Ausgewählt');
    assert.equal(H.histBtnText(list[1]), 'Wiederherstellen', 'inaktiv: Wiederherstellen');
    // Nach Restore von V1 ist V1 aktiv, V2 inaktiv (in-place, kein neuer Eintrag).
    await H.restoreHistoryVersion(1);
    assert.equal(H.histLoad().length, 2, 'kein neuer Eintrag bei Restore');
    assert.equal(H.histIsActive({ v: 1, source: SRC_A }), true, 'V1 nach Restore aktiv');
    assert.equal(H.histIsActive({ v: 2, source: SRC_B }), false, 'V2 nach Restore inaktiv');
    assert.equal(H.histBtnText({ v: 1, source: SRC_A }), 'Ausgewählt', 'V1-Label nach Restore');
  });
});
