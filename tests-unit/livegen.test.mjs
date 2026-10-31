/** Unittests Freimodus-Generierung (node-Testrunner, fetch gemockt, Key nie im Log). */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey, hasLiveApiKey, liveGenStatus, extractModuleSource,
  directChatUrl, DIRECT_BASES, DIRECT_DEFAULT_MODEL,
  GEN_TEMPERATURE,
  buildChatBody, isBudgetExhausted, reasoningMaxAllowed, requestEcho,
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
  configureLiveGen({ proxyUrl: null, direct: true });
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

test('E-GEN-OFFLINE ohne Key und ohne Proxy (UI schaltet auf Bibliothek)', async () => {
  configureLiveGen({ proxyUrl: null });
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-OFFLINE/);
});

test('Direkt-Mapping: Upstream-URLs + Defaults, unbekannt -> null', () => {
  assert.equal(directChatUrl('baseten'), `${DIRECT_BASES.baseten}/chat/completions`);
  assert.equal(directChatUrl('meta-muse'), 'https://api.meta.ai/v1/chat/completions');
  assert.equal(directChatUrl('openrouter'), null);
  assert.equal(DIRECT_DEFAULT_MODEL.baseten, 'meta-models/muse-spark-open-1026');
  assert.equal(DIRECT_DEFAULT_MODEL['meta-muse'], 'muse-spark-1.3-contributor');
});

test('Direkt zuerst: Key + kein Proxy -> via direct an Upstream-URL', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let seenUrl = null;
  let seenBody = null;
  let seenAuth = null;
  globalThis.fetch = async (url, opts) => {
    seenUrl = String(url);
    seenBody = JSON.parse(opts?.body ?? '{}');
    seenAuth = opts?.headers?.authorization ?? null;
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(seenUrl, 'https://inference.baseten.co/v1/chat/completions');
  assert.equal(seenBody.model, 'meta-models/muse-spark-open-1026');
  assert.ok(Array.isArray(seenBody.messages) && seenBody.messages[0]?.role === 'user');
  assert.ok(String(seenAuth).startsWith('Bearer '), 'BYOK-Header gesetzt');
  assert.ok(!String(seenAuth).includes('http'), 'kein URL-Leak');
  assert.equal(gen.via, 'direct');
  assert.ok(gen.source.includes('export function init'));
});

test('Direkt-Transportfehler + Proxy -> Fallback via proxy', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    if (calls.length === 1) throw new TypeError('fetch failed');
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(calls.length, 2, 'direkt + proxy-fallback');
  assert.equal(calls[0], 'https://inference.baseten.co/v1/chat/completions');
  assert.equal(calls[1], 'http://127.0.0.1:9/mock');
  assert.equal(gen.via, 'proxy');
});

test('Direkt-Transportfehler ohne Proxy -> E-GEN-DIREKT (kein 5XX-Leak)', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-DIREKT/);
});

test('Direkt-401 definitiv: kein Proxy-Fallback (genau ein Call)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let n = 0;
  globalThis.fetch = async () => { n += 1; return { ok: false, status: 401 }; };
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug'), /E-GEN-401/);
  assert.equal(n, 1, 'kein Fallback bei definitiver Antwort');
});

test('Ohne Key + Proxy -> nur Proxy (Server-Key), via proxy', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  let seenUrl = null;
  globalThis.fetch = async (url, opts) => {
    seenUrl = String(url);
    assert.ok(!opts?.headers?.authorization, 'kein BYOK ohne Key');
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug');
  assert.equal(seenUrl, 'http://127.0.0.1:9/mock');
  assert.equal(gen.via, 'proxy');
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

test('Proxy-Body: Provider/Modell immer aufgeloest (Defaults meta-muse)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000, direct: false });
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
  assert.equal(seen.provider, 'meta-muse');
  assert.equal(seen.model, 'muse-spark-1.3-contributor');
});

test('deutsche UI-Meldungen fuer alle Codes vorhanden', () => {
  for (const code of ['E-GEN-400', 'E-GEN-401', 'E-GEN-402', 'E-GEN-403', 'E-GEN-404', 'E-GEN-413', 'E-GEN-429', 'E-GEN-5XX', 'E-GEN-504', 'E-GEN-PARSE', 'E-GEN-CONFIG', 'E-GEN-OFFLINE', 'E-GEN-DIREKT']) {
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

test('Key-Policy: Speicher + Session-Storage nur mit Zustimmung (nie Logs)', () => {
  assert.equal(loadStoredKey(), null);
  assert.equal(hasLiveApiKey(), false);
  storeKey('LLM_12345678_abcdefghijklmnop', false);
  assert.equal(hasLiveApiKey(), true, 'Speicher gesetzt');
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

/** Regression leere Antwort: simulierte Reasoning-SSE-Formen (beide Provider). */
function reasoningSseResponse(events) {
  const enc = new TextEncoder();
  const lines = events.map((e) => `data: ${JSON.stringify(e)}`);
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

test('Reasoning-only SSE (Meta-Form) -> E-GEN-PARSE mit Provider/Modell/finish', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => reasoningSseResponse([
    { choices: [{ delta: { reasoning_content: 'Denke nach...' } }] },
    { choices: [{ delta: {} }] },
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
  ]);
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'meta-muse', model: 'muse-spark-1.3-contributor' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  assert.match(String(err?.message ?? err), /meta-muse/, 'Provider in Meldung');
  assert.match(String(err?.message ?? err), /muse-spark-1\.3-contributor/, 'Modell in Meldung');
});

test('finish length bei kappbarem Modul -> E-GEN-PARSE mit length-Hinweis + Provider', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => reasoningSseResponse([
    { choices: [{ delta: { reasoning_content: 'r'.repeat(10) } }] },
    { choices: [{ delta: { content: MODULE }, finish_reason: 'length' }] },
  ]);
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  assert.match(String(err?.message ?? err), /length/, 'finish-Hinweis');
  assert.match(String(err?.message ?? err), /baseten/, 'Provider in Meldung');
});

test('Leerer SSE-Stream (nur DONE) -> E-GEN-PARSE mit Provider/Modell', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => reasoningSseResponse([]);
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  assert.match(String(err?.message ?? err), /baseten/);
  assert.match(String(err?.message ?? err), /muse-spark-open-1026/);
});

/* v19: Budget + Auto-Retry (simulierte length-Reasoning-Antwort). */

function lengthReasoningResponse() {
  return reasoningSseResponse([
    { choices: [{ delta: { reasoning_content: 'Denke nach...' } }], usage: { completion_tokens: 200, prompt_tokens: 22, total_tokens: 222, reasoning_tokens: 198 } },
    { choices: [{ delta: {}, finish_reason: 'length' }] },
  ]);
}

test('v23 kein Length-Limit: Temperatur 0.2, keine Limit-Konstanten', () => {
  assert.equal(GEN_TEMPERATURE, 0.2);
});

test('v23 buildChatBody: KEIN max_completion_tokens/max_tokens, Temperatur + Baseten-Extras, Reasoning-Gate (nie -contributor)', () => {
  const base = buildChatBody('meta-models/muse-spark-open-1026', 'Hallo Welt, lang genug', { provider: 'baseten' });
  assert.ok(!('max_completion_tokens' in base), 'kein max_completion_tokens (Modell nutzt eigenes Maximum)');
  assert.ok(!('max_tokens' in base), 'kein max_tokens');
  assert.equal(base.reasoning_effort, 'low', 'kleinstes belegtes Thinking-Budget (kein Abschalter, Doku: low)');
  assert.deepEqual(base.stream_options, { include_usage: true }, 'Usage im Stream fuer Diagnose');
  assert.equal(base.temperature, 0.2);
  assert.equal(base.stream, true);
  const noProv = buildChatBody('meta-models/muse-spark-open-1026', 'Hallo Welt, lang genug');
  assert.ok(!('max_completion_tokens' in noProv) && !('max_tokens' in noProv) && !('reasoning_effort' in noProv) && !('stream_options' in noProv), 'ohne Provider keine Extras');
  const contrib = buildChatBody('muse-spark-1.3-contributor', 'Hallo Welt, lang genug', { provider: 'meta-muse', reasoning: 'max' });
  assert.ok(!('reasoning_effort' in contrib), 'kein max bei -contributor');
  assert.ok(!('max_tokens' in contrib) && !('max_completion_tokens' in contrib), 'Meta-Pfad unveraendert (keine Extras, kein Limit)');
  const spark = buildChatBody('muse-spark-1.3', 'Hallo Welt, lang genug', { provider: 'meta-muse', reasoning: 'max' });
  assert.equal(spark.reasoning_effort, 'max', 'max nur 1.3/wonder auf meta-muse');
  const wonder = buildChatBody('muse-wonder-1.0', 'Hallo Welt, lang genug', { provider: 'meta-muse', reasoning: 'max' });
  assert.equal(wonder.reasoning_effort, 'max');
  const ignored = buildChatBody('m', 'Hallo Welt, lang genug', { maxTokens: 999999 });
  assert.ok(!('max_completion_tokens' in ignored) && !('max_tokens' in ignored), 'Legacy-maxTokens wird ignoriert (kein Limit-Param)');
});

test('v23 requestEcho: belegt gesendete Params + 400-Fallback, key-frei', () => {
  const e1 = requestEcho({ temperature: 0.2, reasoning_effort: 'low', stream_options: { include_usage: true } }, false);
  assert.deepEqual(e1, { maxCompletionTokens: null, maxTokens: null, reasoningEffort: 'low', temperature: 0.2, fallback400: false });
  const e2 = requestEcho({ temperature: 0.2 }, true);
  assert.equal(e2.reasoningEffort, null);
  assert.equal(e2.fallback400, true);
  assert.equal(requestEcho(null, false).maxCompletionTokens, null);
});

test('v19 reasoningMaxAllowed + isBudgetExhausted', () => {
  assert.equal(reasoningMaxAllowed('meta-muse', 'muse-spark-1.3'), true);
  assert.equal(reasoningMaxAllowed('meta-muse', 'muse-wonder-1.0'), true);
  assert.equal(reasoningMaxAllowed('meta-muse', 'muse-spark-1.3-contributor'), false);
  assert.equal(reasoningMaxAllowed('baseten', 'meta-models/muse-spark-open-1026'), false);
  const exhausted = { chunks: 0, empty: 2, reason: 3, finish: 'length', err: '', usage: 'reasoning 198/200 tokens' };
  assert.equal(isBudgetExhausted('', 'length', exhausted), true);
  assert.equal(isBudgetExhausted('  ', 'length', exhausted), true);
  assert.equal(isBudgetExhausted('', 'stop', exhausted), false, 'kein Retry bei stop');
  assert.equal(isBudgetExhausted('export const meta = 1', 'length', exhausted), false, 'kein Retry bei Content');
  assert.equal(isBudgetExhausted('', 'length', { ...exhausted, chunks: 1 }), false, 'kein Retry bei Teil-Content');
  assert.equal(isBudgetExhausted('', 'length', { ...exhausted, reason: 0 }), false, 'kein Retry ohne Reasoning');
  assert.equal(isBudgetExhausted('', 'length', null), false);
  assert.equal(isBudgetExhausted('', null, exhausted), false);
});

test('v23 Direkt: length+Reasoning-only -> genau 1 Retry mit UNVERAENDERTEM Body (kein Limit), dann Erfolg via direct', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  const bodies = [];
  let n = 0;
  globalThis.fetch = async (url, opts) => {
    n += 1;
    bodies.push(JSON.parse(opts?.body ?? '{}'));
    assert.equal(String(url), 'https://inference.baseten.co/v1/chat/completions');
    if (n === 1) return lengthReasoningResponse();
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(n, 2, 'genau 1 Retry');
  for (const [i, b] of bodies.entries()) {
    assert.ok(!('max_completion_tokens' in b), `Versuch ${i + 1}: kein max_completion_tokens`);
    assert.ok(!('max_tokens' in b), `Versuch ${i + 1}: kein max_tokens`);
  }
  assert.deepEqual(bodies[0], bodies[1], 'Retry mit unveraendertem Body');
  assert.equal(bodies[0].temperature, 0.2);
  assert.equal(bodies[0].reasoning_effort, 'low', 'Thinking-Reduktion angefordert');
  assert.equal(bodies[1].reasoning_effort, 'low');
  assert.equal(gen.via, 'direct');
  assert.ok(gen.source.includes('export function init'));
});

test('v19 Direkt: doppeltes length -> E-GEN-PARSE nach genau 1 Retry', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let n = 0;
  globalThis.fetch = async () => { n += 1; return lengthReasoningResponse(); };
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  assert.equal(n, 2, 'max 1 Retry, dann Fehlermeldung');
});

test('v19 Direkt: stop+Reasoning-only (leer) -> KEIN Retry (genau 1 Call)', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    return reasoningSseResponse([
      { choices: [{ delta: { reasoning_content: 'Denke nach...' } }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ]);
  };
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  assert.equal(n, 1, 'kein Retry ohne length');
});

test('v23 Proxy: length+Reasoning-only -> genau 1 Retry mit UNVERAENDERTEM Body (kein Limit)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  const bodies = [];
  let n = 0;
  globalThis.fetch = async (_url, opts) => {
    n += 1;
    bodies.push(JSON.parse(opts?.body ?? '{}'));
    if (n === 1) return lengthReasoningResponse();
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'meta-muse', model: 'muse-spark-1.3-contributor' });
  assert.equal(n, 2, 'genau 1 Retry');
  for (const [i, b] of bodies.entries()) {
    assert.ok(!('max_completion_tokens' in b), `Versuch ${i + 1}: kein max_completion_tokens im Proxy-Body`);
    assert.ok(!('max_tokens' in b), `Versuch ${i + 1}: kein max_tokens im Proxy-Body`);
  }
  assert.deepEqual(bodies[0], bodies[1], 'Retry mit unveraendertem Body');
  assert.equal(gen.via, 'proxy');
});

/* v21: gehärteter Reader (alle plausiblen Content-Felder) + Retry-Sichtbarkeit. */

test('v21 collectChatText: delta.text, message.output_text, choice.output_text', async () => {
  const { collectChatText } = await import('../src/runtime/livegen.js');
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  assert.equal(collectChatText({ choices: [{ delta: { text: 'DT' } }] }, info), 'DT');
  assert.equal(collectChatText({ choices: [{ message: { output_text: 'MO' } }] }, info), 'MO');
  assert.equal(collectChatText({ choices: [{ message: { text: 'MT' } }] }, info), 'MT');
  assert.equal(collectChatText({ choices: [{ text: 'CT' }] }, info), 'CT');
  assert.equal(collectChatText({ choices: [{ output_text: 'CO' }] }, info), 'CO');
  assert.equal(info.chunks, 5);
});

test('v21 collectChatText: Responses-output-Array, nested text.value, leeres delta verdeckt nichts', async () => {
  const { collectChatText } = await import('../src/runtime/livegen.js');
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  const out = { output: [{ type: 'message', content: [{ type: 'output_text', text: 'R1' }, { type: 'output_text', text: 'R2' }] }] };
  assert.equal(collectChatText(out, info), 'R1R2');
  assert.equal(collectChatText({ choices: [{ message: { content: [{ text: { value: 'NV' } }] } }] }, info), 'NV');
  assert.equal(collectChatText({ choices: [{ delta: { content: '' }, message: { content: 'MB' } }] }, info), 'MB');
  assert.equal(info.chunks, 3);
});

test('v21 collectChatText: reasoning-Parts kein Content, strukturiertes Reasoning zählt, refusal -> err', async () => {
  const { collectChatText } = await import('../src/runtime/livegen.js');
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  assert.equal(collectChatText({ choices: [{ message: { content: [{ type: 'reasoning', text: 'geheim' }] } }] }, info), '');
  assert.equal(info.empty, 1);
  assert.equal(collectChatText({ choices: [{ delta: { reasoning_content: [{ text: 'r' }] } }] }, info), '');
  assert.equal(info.reason, 1, 'strukturiertes Reasoning zählt');
  assert.equal(collectChatText({ choices: [{ delta: { reason: 'r' } }] }, info), '');
  assert.equal(info.reason, 2, 'reason-Feld zählt');
  assert.equal(collectChatText({ choices: [{ delta: {}, message: { refusal: 'policy-stop', content: null } }] }, info), '');
  assert.equal(info.err, 'policy-stop');
});

test('v21 Diagnose: Retry 1/1 nach Budget-Retry, Retry 0/1 ohne Retry', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  const bodies = [];
  let n = 0;
  globalThis.fetch = async (_url, opts) => {
    n += 1;
    bodies.push(JSON.parse(opts?.body ?? '{}'));
    if (n === 1) return lengthReasoningResponse();
    return lengthReasoningResponse();
  };
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.message ?? err), /Retry 1\/1/, 'Retry lief sichtbar');
  assert.equal(n, 2, 'genau 1 Retry');
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => reasoningSseResponse([
    { choices: [{ delta: { reasoning_content: 'Denke nach...' } }] },
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
  ]);
  const err2 = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err2?.message ?? err2), /Retry 0\/1/, 'kein Retry ohne length sichtbar');
});

test('v23 Direkt: 400 mit Extras -> genau 1 Fallback ohne Extras (kein Limit je Versuch)', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  const bodies = [];
  let n = 0;
  globalThis.fetch = async (url, opts) => {
    n += 1;
    const b = JSON.parse(opts?.body ?? '{}');
    bodies.push(b);
    if (n === 1) {
      assert.equal(b.reasoning_effort, 'low', 'erst mit Extras');
      assert.ok(!('max_completion_tokens' in b) && !('max_tokens' in b), 'kein Limit trotz Extras');
      return { ok: false, status: 400 };
    }
    assert.ok(!('reasoning_effort' in b) && !('max_tokens' in b) && !('max_completion_tokens' in b) && !('stream_options' in b), 'Fallback ohne Extras, ohne Limit');
    assert.equal(b.temperature, 0.2, 'Temperatur bleibt');
    return sseResponse([MODULE]);
  };
  const gen = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(n, 2, 'genau 1 Fallback-Call');
  assert.equal(gen.via, 'direct');
  assert.ok(gen.source.includes('export function init'));
});

test('v23 Direkt: 400-Fallback landet als Request-Echo in der Diagnose (E-GEN-401-Form)', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-401/);
  assert.equal(err?.diagnose?.req?.reasoningEffort, 'low', 'Echo: reasoning low gesendet');
  assert.equal(err?.diagnose?.req?.temperature, 0.2, 'Echo: Temperatur gesendet');
  assert.equal(err?.diagnose?.req?.maxCompletionTokens, null, 'Echo: kein max_completion_tokens');
  assert.equal(err?.diagnose?.req?.maxTokens, null, 'Echo: kein max_tokens');
  assert.equal(err?.diagnose?.req?.fallback400, false, 'Echo: kein 400-Fallback (401 ist definitiv)');
});

test('v21 Direkt: 400 ohne Extras (meta-muse) -> kein Fallback, direkt E-GEN-400', async () => {
  configureLiveGen({ proxyUrl: null, timeoutMs: 2000 });
  setLiveApiKey('LLM_12345678_abcdefghijklmnop');
  let n = 0;
  globalThis.fetch = async () => { n += 1; return { ok: false, status: 400 }; };
  await assert.rejects(generateLive('Begriff Windkraftanlage lang genug', { provider: 'meta-muse', model: 'muse-spark-1.3-contributor' }), /E-GEN-400/);
  assert.equal(n, 1, 'kein Fallback ohne Extras');
});

test('v23 stripChatExtras: entfernt Baseten-Extras + defensive Limit-Felder, meldet ob gestrippt', async () => {
  const { stripChatExtras } = await import('../src/runtime/livegen.js');
  const b = { model: 'm', max_completion_tokens: 1, max_tokens: 1, reasoning_effort: 'low', stream_options: { include_usage: true }, temperature: 0.2 };
  assert.equal(stripChatExtras(b), true);
  assert.deepEqual(b, { model: 'm', temperature: 0.2 });
  assert.equal(stripChatExtras({ model: 'm' }), false, 'nichts zu strippen');
  assert.equal(stripChatExtras({ model: 'm', reasoning_effort: 'max' }), false, 'max bleibt (Meta-Gate)');
  assert.equal(stripChatExtras({ model: 'm', reasoning_effort: 'none' }), false, 'none ist kein Baseten-Extra (Doku: rejected/nur low)');
  assert.equal(stripChatExtras(null), false);
});

/* v22: Diagnose-Export (Copy-Button) + belegte Thinking-Stufe low. */

test('v23 GEN_BUILD + Fehlermeldung traegt Provider/Modell/HTTP/finish/Retry/Build + Request-Echo', async () => {
  const { GEN_BUILD } = await import('../src/runtime/livegen.js');
  assert.equal(GEN_BUILD, 'v23');
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => reasoningSseResponse([
    { choices: [{ delta: { reasoning_content: 'Denke nach...' } }], usage: { completion_tokens: 200, prompt_tokens: 22, total_tokens: 222, reasoning_tokens: 198 } },
    { choices: [{ delta: {}, finish_reason: 'length' }] },
  ]);
  const err = await generateLive('Begriff Windkraftanlage lang genug', { provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }).catch((e) => e);
  assert.match(String(err?.code ?? err), /E-GEN-PARSE/);
  for (const bit of ['baseten', 'muse-spark-open-1026', 'HTTP 200', 'finish_reason=length', 'Retry 1/1', 'Build v23']) {
    assert.match(String(err?.message ?? err), new RegExp(bit.replace(/[./]/g, (c) => `\\${c}`)), bit);
  }
  assert.equal(err?.diagnose?.build, 'v23');
  assert.equal(err?.diagnose?.provider, 'baseten');
  assert.equal(err?.diagnose?.model, 'meta-models/muse-spark-open-1026');
  assert.equal(err?.diagnose?.status, 200);
  assert.equal(err?.diagnose?.finish, 'length');
  assert.equal(err?.diagnose?.usageReasoning, 198);
  assert.equal(err?.diagnose?.usageCompletion, 200);
  assert.equal(err?.diagnose?.retried, true);
  assert.ok(String(err?.diagnose?.rawSnippet ?? '').includes('Denke nach'), 'Rohantwort-Auszug enthaelt Reasoning');
  assert.equal(err?.diagnose?.req?.maxCompletionTokens, null, 'Echo: kein max_completion_tokens (Proxy-Upstream)');
  assert.equal(err?.diagnose?.req?.maxTokens, null, 'Echo: kein max_tokens (Proxy-Upstream)');
  assert.equal(err?.diagnose?.req?.reasoningEffort, 'low', 'Echo: reasoning low (Proxy-Upstream, baseten)');
  assert.equal(err?.diagnose?.req?.temperature, 0.2, 'Echo: Temperatur 0.2 (Proxy-Upstream)');
  assert.equal(err?.diagnose?.reqRetry?.reasoningEffort, 'low', 'Echo: Retry-Versuch belegt');
});

test('v22 collectChatText: Usage-Zahlen + completion_tokens_details + reasonSample-Cap', async () => {
  const { collectChatText } = await import('../src/runtime/livegen.js');
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  collectChatText({ choices: [{ delta: { reasoning_content: 'r1' } }], usage: { completion_tokens: 10, reasoning_tokens: 8 } }, info);
  assert.equal(info.usageReasoning, 8);
  assert.equal(info.usageCompletion, 10);
  assert.equal(info.reasonSample, 'r1');
  const info2 = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  collectChatText({ choices: [{ delta: { content: 'x' } }], usage: { completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 3 } } }, info2);
  assert.equal(info2.usageReasoning, 3, 'OpenAI-Form completion_tokens_details');
  assert.equal(info2.usageCompletion, 5);
  const info3 = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '', reasonSample: 'a'.repeat(2040) };
  collectChatText({ choices: [{ delta: { reasoning_content: 'b'.repeat(100) } }] }, info3);
  assert.ok(info3.reasonSample.length <= 2048, 'reasonSample gedeckelt');
});

test('v22 redactDiagnoseText: Key-Formen raus, Modell-Slug bleibt', async () => {
  const { redactDiagnoseText } = await import('../src/runtime/livegen.js');
  const dirty = 'Authorization: Bearer SECRETKEY12345678\nkey=LLM_12345678_abcdefghijklmnop\nsk-geheim4567890\napi_key: topsecret999\nmodel meta-models/muse-spark-open-1026';
  const clean = redactDiagnoseText(dirty);
  assert.ok(!clean.includes('SECRETKEY12345678'), 'Bearer-Token redigiert');
  assert.ok(!clean.includes('LLM_12345678_abcdefghijklmnop'), 'Meta-Key redigiert');
  assert.ok(!clean.includes('sk-geheim4567890'), 'sk-Key redigiert');
  assert.ok(!clean.includes('topsecret999'), 'api_key redigiert');
  assert.ok(clean.includes('[REDACTED]'), 'Redaktionsmarker gesetzt');
  assert.ok(clean.includes('meta-models/muse-spark-open-1026'), 'Modell-Slug bleibt lesbar');
});

test('v23 buildDiagnoseText: alle Felder + Request-Echo, ~2KB-Cap, de/en/es, nie Key', async () => {
  const { buildDiagnoseText } = await import('../src/runtime/livegen.js');
  const diag = {
    provider: 'baseten', model: 'meta-models/muse-spark-open-1026', via: 'direct',
    status: 200, finish: 'length', usage: 'reasoning 198/200 tokens',
    usageReasoning: 198, usageCompletion: 200, retried: true, build: 'v23',
    rawSnippet: `x\nAuthorization: Bearer HACKME12345678\n${'y'.repeat(5000)}`,
    req: { maxCompletionTokens: null, maxTokens: null, reasoningEffort: 'low', temperature: 0.2, fallback400: true },
    reqRetry: { maxCompletionTokens: null, maxTokens: null, reasoningEffort: null, temperature: 0.2, fallback400: true },
  };
  const want = {
    de: ['req_max_completion_tokens: (nicht gesendet)', 'req_max_tokens: (nicht gesendet)',
      'req_reasoning_effort: low', 'req_temperature: 0.2', 'req_400_fallback: ja',
      'req_retry_reasoning_effort: (keins)', 'req_retry_400_fallback: ja'],
    en: ['req_max_completion_tokens: (not sent)', 'req_max_tokens: (not sent)',
      'req_reasoning_effort: low', 'req_temperature: 0.2', 'req_400_fallback: yes',
      'req_retry_reasoning_effort: (none)', 'req_retry_400_fallback: yes'],
    es: ['req_max_completion_tokens: (no enviado)', 'req_max_tokens: (no enviado)',
      'req_reasoning_effort: low', 'req_temperature: 0.2', 'req_400_fallback: sí',
      'req_retry_reasoning_effort: (ninguno)', 'req_retry_400_fallback: sí'],
  };
  for (const loc of ['de', 'en', 'es']) {
    const t = buildDiagnoseText(diag, loc);
    for (const bit of ['provider: baseten', 'model: meta-models/muse-spark-open-1026', 'via: direct', 'http: 200',
      'finish: length', 'usage_reasoning_tokens: 198', 'usage_completion_tokens: 200', 'retry: 1/1', 'build: v23',
      ...want[loc]]) {
      assert.ok(t.includes(bit), `${loc}: ${bit}`);
    }
    const rawLine = t.split('\n').find((l) => l.startsWith('raw_snippet_2k: '));
    assert.ok(rawLine && rawLine.length <= 'raw_snippet_2k: '.length + 2048, `${loc}: Rohantwort gedeckelt`);
    assert.ok(!t.includes('HACKME12345678'), `${loc}: kein Key im Clipboard-Text`);
  }
  assert.ok(buildDiagnoseText(diag, 'de').startsWith('ModelMuse Diagnose'), 'de-Kopf');
  assert.ok(buildDiagnoseText(diag, 'en').startsWith('ModelMuse diagnostics'), 'en-Kopf');
  assert.ok(buildDiagnoseText(diag, 'es').startsWith('ModelMuse diagnóstico'), 'es-Kopf');
  assert.ok(buildDiagnoseText(diag, 'fr').startsWith('ModelMuse Diagnose'), 'unbekannt -> de');
  const noRetry = buildDiagnoseText({ ...diag, retried: false, reqRetry: null }, 'de');
  assert.ok(!noRetry.includes('req_retry_'), 'ohne Retry keine Retry-Echo-Zeilen');
  assert.ok(noRetry.includes('req_400_fallback: ja'), 'Erstversuch-Echo bleibt');
});

test('v23 errorDiagnose: Fallback ohne diagnose-Feld inkl. Request-Echo, nie Key', async () => {
  const { errorDiagnose, buildDiagnoseText } = await import('../src/runtime/livegen.js');
  const e = Object.assign(new Error('E-GEN-401: HTTP 401'), { code: 'E-GEN-401' });
  const d = errorDiagnose(e);
  assert.equal(d.build, 'v23');
  assert.ok(String(d.rawSnippet).includes('E-GEN-401'));
  assert.equal(d.req.maxCompletionTokens, null, 'Echo: kein Limit gesendet');
  assert.equal(d.req.maxTokens, null, 'Echo: kein Limit gesendet');
  const t = buildDiagnoseText(d, 'de');
  assert.ok(t.includes('req_max_completion_tokens: (nicht gesendet)'), 'Echo belegt kein Limit');
  assert.ok(!/Bearer \S{8,}/.test(t) || t.includes('Bearer [REDACTED]'), 'kein offener Bearer-Token');
});
