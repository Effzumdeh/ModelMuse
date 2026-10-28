/** Unittests Freimodus-Generierung (node-Testrunner, fetch gemockt, Key nie im Log). */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey, hasLiveApiKey, liveGenStatus, extractModuleSource,
} from '../src/runtime/livegen.js';
import {
  E_GEN_DE, germanMessage, buildFreePrompt, freeModelId, extractMeasureHints, buildFreeManifest, extractMetaI18n,
  loadStoredKey, storeKey, forgetStoredKey,
} from '../src/shell/ui-livegen.js';
import { validateManifest } from '../src/runtime/didactics.js';

const REAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  clearLiveApiKey();
  configureLiveGen({ proxyUrl: null });
});

function sseResponse(chunks, finish = 'stop') {
  const enc = new TextEncoder();
  const lines = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`);
  lines.push(`data: ${JSON.stringify({ choices: [{ delta: { content: '' }, finish_reason: finish }] })}`);
  lines.push('data: [DONE]');
  const bytes = enc.encode(`${lines.join('\n')}\n`);
  let used = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (used) return { done: true, value: undefined };
            used = true;
            return { done: false, value: bytes };
          },
        };
      },
    },
  };
}

const MODULE = 'export const meta = { title: "X", category: "hardware", detailLevel: 2, parts: ["A","B","C"], units: "m" };\nexport function init(c, p) { return { update(patch) {}, dispose() {} }; }';

test('E-GEN-CONFIG bei ungueltiger Proxy-URL und ungueltigem Key', () => {
  assert.throws(() => configureLiveGen({ proxyUrl: 42 }), /E-GEN-CONFIG/);
  assert.throws(() => setLiveApiKey('zu kurz'), /E-GEN-CONFIG/);
  assert.throws(() => setLiveApiKey('mit leerzeichen drin x'), /E-GEN-CONFIG/);
  assert.equal(hasLiveApiKey(), false);
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  assert.equal(hasLiveApiKey(), true);
  assert.equal(liveGenStatus().hasKey, true);
});

test('E-GEN-OFFLINE ohne Proxy (UI schaltet auf Bibliothek)', async () => {
  configureLiveGen({ proxyUrl: null });
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-OFFLINE/);
});

test('E-GEN-401 ohne Retry, Key als Bearer-Header (redaktiert geprüft)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let seenAuth = null;
  globalThis.fetch = async (_url, opts) => {
    seenAuth = opts?.headers?.authorization ?? null;
    return { ok: false, status: 401 };
  };
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-401/);
  assert.ok(typeof seenAuth === 'string' && seenAuth.startsWith('Bearer '), 'Authorization-Header gesetzt');
  assert.ok(!seenAuth.includes('http'), 'kein URL-Leak im Header-Check');
});

test('E-GEN-404 ohne Retry', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-404/);
});

test('E-GEN-PARSE bei 200 ohne extrahierbares Modul', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => sseResponse(['Nur Prosa, kein Modul.']);
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-PARSE/);
});

test('Erfolgspfad: Modul extrahiert, finish_reason stop', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => sseResponse([`Vorlauf\n${MODULE}\nNachlauf`]);
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { seed: 7 });
  assert.ok(gen.source.includes('export const meta') && gen.source.includes('export function init'));
  assert.ok(gen.raw.includes('Vorlauf'));
});

test('provider/model-Optionen landen im Proxy-Body (Defaults bleiben Proxy-Sache)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  let seen = null;
  globalThis.fetch = async (_url, opts) => {
    seen = JSON.parse(opts?.body ?? '{}');
    return sseResponse([MODULE]);
  };
  await generateLive('Begriff Windkraftanlage lang genug', { seed: 7, provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(seen.provider, 'baseten');
  assert.equal(seen.model, 'meta-models/muse-spark-open-1026');
  assert.equal(seen.seed, 7);
  await generateLive('Begriff Windkraftanlage lang genug');
  assert.equal(seen.provider, undefined);
  assert.equal(seen.model, undefined);
});

test('deutsche UI-Meldungen fuer alle Codes vorhanden', () => {
  for (const code of ['E-GEN-400', 'E-GEN-401', 'E-GEN-402', 'E-GEN-403', 'E-GEN-404', 'E-GEN-413', 'E-GEN-429', 'E-GEN-5XX', 'E-GEN-504', 'E-GEN-PARSE', 'E-GEN-CONFIG', 'E-GEN-OFFLINE']) {
    assert.ok(typeof E_GEN_DE[code] === 'string' && E_GEN_DE[code].length > 10, code);
    assert.ok(!E_GEN_DE[code].includes('LLM_'), `${code} ohne Key-Spuren`);
  }
  assert.ok(germanMessage({ code: 'E-GEN-401' }).includes('401'));
  assert.ok(germanMessage(new Error('x')).length > 10);
});

test('buildFreePrompt enthaelt Begriff, Vertrag und Helper-Pflicht', () => {
  const p = buildFreePrompt('Windkraftanlage');
  assert.ok(p.includes('Windkraftanlage') && p.includes('addLabel') && p.includes('addMeasurement') && p.includes('muse-spark'));
  assert.ok(p.includes('hardware, architektur, auto, pflanze, sonstiges'), 'category-Enum vorgegeben (E2E-Befund 27.10.2026)');
  assert.ok(p.includes('NIEMALS kuergen') && p.includes('MUSS in der Importliste stehen'), 'Import-Vorlage unkuerzbar (E-S2-BOOT "Scene is not defined")');
});

test('freeModelId ist regex-konform (^[a-z0-9-]{2,24}$)', () => {
  for (const t of ['Windkraftanlage', 'Graphikkarte 3000!', 'A']) {
    assert.match(freeModelId(t), /^[a-z0-9-]{2,24}$/);
  }
});

test('extractMeasureHints liest Messungen positional aus', () => {
  const src = `import { addMeasurement } from 'wrapper-helpers';\naddMeasurement(scene, [-0.1,0,0], [0.1,0,0], 'Breite: 40 cm', { id: 'm1', level: 'aufbau', unit: 'cm' });`;
  const hints = extractMeasureHints(src);
  assert.equal(hints.length, 1);
  assert.deepEqual(hints[0].from, [-0.1, 0, 0]);
  assert.equal(hints[0].unit, 'cm');
});

test('setLocale/getLocale/tt: Umschaltung en/es/de, Fallback de', async () => {
  const i18n = await import('../src/shell/i18n.js');
  i18n.setLocale('en');
  assert.equal(i18n.getLocale(), 'en');
  assert.equal(i18n.tt('toolbar.modell'), 'Model');
  i18n.setLocale('es');
  assert.equal(i18n.tt('toolbar.modell'), 'Modelo');
  i18n.setLocale('fr');
  assert.equal(i18n.getLocale(), 'de');
  assert.equal(i18n.tt('toolbar.modell'), 'Modell');
  i18n.setLocale('de');
});

test('buildFreeManifest: deutsche Fallbacks ohne Hints, Manifest valide', () => {
  const src = `export const meta = { title: 'Windrad', category: 'sonstiges', detailLevel: 2, parts: ['Mast','Rotor','Gondel'], units: 'm' };\naddMeasurement(scene, [0,0,0], [0,1,0], 'Nabenhoehe: 80 m', { id: 'm1', level: 'aufbau', unit: 'm' });`;
  const man = buildFreeManifest('Windkraftanlage', { title: 'Windrad', parts: ['Mast', 'Rotor', 'Gondel'] }, src);
  assert.equal(man.track, 'free');
  assert.deepEqual(man.labels, ['Mast', 'Rotor', 'Gondel']);
  const rep = validateManifest(man);
  assert.ok(rep.ok, JSON.stringify(rep));
  assert.equal(man.tasks.filter((t) => t.level === 'aufbau').length, 2);
  assert.equal(man.tasks.filter((t) => t.level === 'profi').length, 1);
  assert.ok(!('i18n' in man), 'ohne Hints kein i18n-Segment');
});

test('buildFreePrompt: locale-Parameter + meta_i18n-Vertrag, keine Sprachlogik', () => {
  const p = buildFreePrompt('Windkraftanlage', 'en');
  assert.ok(p.includes('(locale): en'), 'locale im Prompt');
  assert.ok(p.includes('meta_i18n'), 'meta_i18n-Vertrag im Prompt');
  assert.ok(p.includes('KEINE Sprachlogik'), 'Code bleibt sprachneutral');
  assert.ok(buildFreePrompt('Windkraftanlage', 'xx').includes('(locale): de'), 'unbekannte Lokale -> de');
});

test('extractMetaI18n + buildFreeManifest: Hints erzeugen en/es-Segment, valide', () => {
  const src = `export const meta_i18n = { en: { title: 'Wind turbine', parts: ['Mast','Rotor','Nacelle'] }, es: { title: 'Aerogenerador', parts: ['Mástil','Rotor','Góndola'] } };`;
  const hints = extractMetaI18n(src);
  assert.deepEqual(hints.en.parts, ['Mast', 'Rotor', 'Nacelle']);
  assert.equal(extractMetaI18n('kein Export hier'), null);
  const man = buildFreeManifest('Windkraftanlage', { title: 'Windrad', parts: ['Mast', 'Rotor', 'Gondel'] }, 'addMeasurement(scene, [0,0,0], [0,1,0], "Nabenhoehe: 80 m", { id: "m1", level: "aufbau", unit: "m" });', hints);
  assert.deepEqual(man.i18n.en.labels, ['Mast', 'Rotor', 'Nacelle']);
  assert.equal(man.i18n.es.title, 'Aerogenerador');
  const rep = validateManifest(man);
  assert.ok(rep.ok, JSON.stringify(rep));
  // Falsche parts-Laenge -> kein Segment (ehrlicher Fallback statt falscher Labels).
  const bad = buildFreeManifest('X', { title: 'Windrad lang', parts: ['A', 'B', 'C'] }, '', { en: { title: 'T', parts: ['nur', 'zwei'] } });
  assert.ok(!('i18n' in bad));
});

test('Key-Policy Teil 5: nur Speicher, nie Storage', () => {
  assert.equal(loadStoredKey(), null);
  storeKey('LLM_12345678_abcdefghijklmnop', true);
  assert.equal(loadStoredKey(), null);
  forgetStoredKey();
  assert.equal(hasLiveApiKey(), false);
});

test('extractModuleSource: Imports VOR meta bleiben erhalten (E-S2-Befund 27.10.2026)', () => {
  const raw = `Gerne! Hier das Modul:\nimport { Scene } from 'three';\nimport { addLabel } from 'wrapper-helpers';\nexport const meta = { title: 'X' };\nexport function init(c, p) { const s = new Scene(); return { update() {}, dispose() {} }; }`;
  const src = extractModuleSource(raw);
  assert.ok(src.includes(`import { Scene } from 'three'`), 'Import erhalten');
  assert.ok(src.includes('export function init'), 'init erhalten');
  assert.ok(!src.startsWith('Gerne'), 'Prosa-Anfang gekappt');
});

test('extractModuleSource: Fences + Nachlauf-Prosa werden entfernt', () => {
  const raw = `Erklaerung davor\n\`\`\`js\nimport { Scene } from 'three';\nexport const meta = { title: 'X' };\nexport function init(c, p) { return { update() {}, dispose() {} }; }\n\`\`\`\nDanach noch Prosa mit top und window Worten.`;
  const src = extractModuleSource(raw);
  assert.ok(src.includes('export function init'), 'init erhalten');
  assert.ok(!src.includes('Danach noch'), 'Nachlauf gekappt');
  assert.ok(!src.includes('```'), 'keine Fences');
});

test('extractModuleSource: ohne Modul-Anfang leer (E-GEN-PARSE-Pfad)', () => {
  assert.equal(extractModuleSource('Nur Prosa, kein Code.'), '');
  assert.equal(extractModuleSource(''), '');
});
