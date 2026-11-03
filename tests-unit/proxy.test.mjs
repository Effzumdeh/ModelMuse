/** Unittests Proxy (scripts/proxy.mjs) + OFFLINE-Verhalten (livegen, ohne Key/Netz). */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROXY_DEFAULT_PORT, BASETEN_BASE,
  PROVIDERS, DEFAULT_PROVIDER, mapStatusToCode, parseGenerateBody,
  keyShapeOk, upstreamChatBody, createProxyServer,
} from '../scripts/proxy.mjs';
import { configureLiveGen, generateLive, clearLiveApiKey } from '../src/runtime/livegen.js';

const REAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  clearLiveApiKey();
  configureLiveGen({ proxyUrl: null });
});

test('Registry: meta-muse default, offene Bauweise, nur localhost-Bindung', async () => {
  assert.equal(DEFAULT_PROVIDER, 'meta-muse');
  assert.ok(PROVIDERS['meta-muse'].models.includes('muse-spark-1.3-contributor'));
  assert.ok(PROVIDERS['meta-muse'].models.includes('muse-wonder-1.0'));
  assert.equal(PROXY_DEFAULT_PORT, 8787);
  const src = await readFile('scripts/proxy.mjs', 'utf8');
  assert.ok(src.includes("listen(port, '127.0.0.1'"), 'nur localhost');
  assert.ok(!src.includes('0.0.0.0'), 'kein Wildcard-Bind');
  assert.ok(!/sk-|Bearer \+ key|api[_-]?key["']?\s*:\s*["'][A-Za-z0-9]/i.test(src.replace(/Bearer ' \+ key/, '')), 'kein Key im Code');
});

test('mapStatusToCode: alle E-GEN-Codes', () => {
  assert.equal(mapStatusToCode(400), 'E-GEN-400');
  assert.equal(mapStatusToCode(401), 'E-GEN-401');
  assert.equal(mapStatusToCode(402), 'E-GEN-402');
  assert.equal(mapStatusToCode(403), 'E-GEN-403');
  assert.equal(mapStatusToCode(404), 'E-GEN-404');
  assert.equal(mapStatusToCode(413), 'E-GEN-413');
  assert.equal(mapStatusToCode(429), 'E-GEN-429');
  assert.equal(mapStatusToCode(504), 'E-GEN-504');
  assert.equal(mapStatusToCode(500), 'E-GEN-5XX');
  assert.equal(mapStatusToCode(502), 'E-GEN-5XX');
  assert.equal(mapStatusToCode(418), 'E-GEN-5XX');
});

test('parseGenerateBody: ok, Defaults, Fehlfaelle', () => {
  const ok = parseGenerateBody({ prompt: 'Begriff Windkraftanlage lang genug' });
  assert.equal(ok.ok, true);
  assert.equal(ok.provider, 'meta-muse');
  assert.equal(ok.model, 'muse-spark-1.3-contributor');
  const custom = parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'meta-muse', model: 'muse-wonder-1.0' });
  assert.equal(custom.ok, true);
  assert.equal(custom.model, 'muse-wonder-1.0');
  assert.equal(parseGenerateBody({ prompt: 'kurz' }).code, 'E-GEN-400');
  assert.equal(parseGenerateBody({}).code, 'E-GEN-400');
  assert.equal(parseGenerateBody(null).code, 'E-GEN-400');
  assert.equal(parseGenerateBody({ prompt: 'x'.repeat(60001) }).code, 'E-GEN-413');
  assert.equal(parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'phantasia' }).code, 'E-GEN-404');
  assert.equal(parseGenerateBody({ prompt: 'x'.repeat(20), model: 'gpt-99' }).code, 'E-GEN-404');
});

test('keyShapeOk + upstreamChatBody-Form', () => {
  assert.equal(keyShapeOk('LLM_12345678_abcdefghijklmnop'), true);
  assert.equal(keyShapeOk('kurz'), false);
  assert.equal(keyShapeOk('mit leer zeichen x'), false);
  assert.equal(keyShapeOk(''), false);
  assert.equal(keyShapeOk(null), false);
  const up = upstreamChatBody('muse-spark-1.3-contributor', 'Hallo Welt, lang genug');
  assert.equal(up.model, 'muse-spark-1.3-contributor');
  assert.equal(up.stream, true);
  assert.equal(up.messages[0].role, 'user');
});

test('Server: /health ok, unbekannter Pfad 404, /generate kurz 400', async () => {
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  assert.equal(server.address().address, '127.0.0.1');
  try {
    const h = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
    assert.equal(h.ok, true);
    assert.equal(h.service, 'modelmuse-proxy');
    assert.ok(h.providers.includes('meta-muse'));
    assert.ok(!JSON.stringify(h).includes('LLM_'), 'kein Key im Health');
    const nf = await fetch(`http://127.0.0.1:${port}/irgendwo`);
    assert.equal(nf.status, 404);
    assert.equal((await nf.json()).code, 'E-GEN-404');
    const bad = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'kurz' }),
    });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).code, 'E-GEN-400');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('Server: /generate ohne Key -> E-GEN-CONFIG (nie Upstream)', async () => {
  const keepEnv = { ...process.env };
  delete process.env.META_API_KEY;
  delete process.env.MODEL_API_KEY;
  delete process.env.MUSE_API_KEY;
  process.env.KEY_FILE = 'C:/nonexistent-definitiv-kein-key.json';
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Begriff Windkraftanlage lang genug' }),
    });
    assert.equal(r.status, 500);
    const j = await r.json();
    assert.equal(j.code, 'E-GEN-CONFIG');
    assert.ok(!JSON.stringify(j).includes('LLM_'), 'kein Key im Fehler');
  } finally {
    await new Promise((r) => server.close(r));
    process.env = keepEnv;
  }
});

test('Registry: baseten-Pfad (byokOnly, NUR Meta-Modell, localhost-Bindung bleibt)', async () => {
  assert.equal(BASETEN_BASE, 'https://inference.baseten.co/v1');
  assert.equal(PROVIDERS.baseten.base, 'https://inference.baseten.co/v1');
  assert.equal(PROVIDERS.baseten.byokOnly, true);
  assert.equal(PROVIDERS.baseten.defaultModel, 'meta-models/muse-spark-open-1026');
  assert.deepEqual(PROVIDERS.baseten.models, ['meta-models/muse-spark-open-1026']);
  assert.ok(PROVIDERS.baseten.models.every((m) => /muse/i.test(m)), 'NUR Meta-Modelle (Meta-Regel)');
  assert.equal(DEFAULT_PROVIDER, 'meta-muse');
  const okFree = parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'baseten', model: 'meta-models/muse-spark-open-1026' });
  assert.equal(okFree.ok, true);
  assert.equal(okFree.model, 'meta-models/muse-spark-open-1026');
  assert.equal(parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'baseten', model: 'erfunden-99' }).code, 'E-GEN-404');
  const orDirect = parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'openrouter', model: 'openai/gpt-6.1-sol' });
  assert.equal(orDirect.code, 'E-GEN-404', 'openrouter NUR Direkt-Call, kein Proxy-Pfad');
  assert.match(orDirect.message, /Direkt-Call/, 'Abweisung nennt den Direkt-Pfad');
  assert.match(orDirect.message, /openrouter\.ai\/api\/v1\/chat\/completions/, 'Abweisung nennt belegten Endpunkt');
});

test('Server: baseten ohne BYOK -> E-GEN-CONFIG (Meta-Server-Key geht NIE an Baseten)', async () => {
  const keepEnv = { ...process.env };
  process.env.META_API_KEY = 'LLM_12345678_abcdefghijklmnop';
  delete process.env.BASETEN_API_KEY;
  process.env.KEY_FILE = 'C:/nonexistent-definitiv-kein-key.json';
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Begriff Windkraftanlage lang genug', provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }),
    });
    assert.equal(r.status, 500);
    const j = await r.json();
    assert.equal(j.code, 'E-GEN-CONFIG');
    assert.ok(!JSON.stringify(j).includes('LLM_'), 'kein Key im Fehler');
  } finally {
    await new Promise((r) => server.close(r));
    process.env = keepEnv;
  }
});
test('livegen: Verbindung verweigert -> E-GEN-OFFLINE (nicht 5XX)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/proxy-aus', timeoutMs: 3000 });
  globalThis.fetch = async () => {
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  await assert.rejects(
    generateLive('Begriff Windkraftanlage lang genug'),
    /E-GEN-OFFLINE/
  );
});

/* v19: Budget + Temperatur im Proxy (simulierte length-Reasoning-Antwort). */

test('v48 upstreamChatBody: Limit 131072 (beide Felder), Temperatur 0.2, kein Reasoning-Feld ohne Provider', async () => {
  const { upstreamChatBody: up, UPSTREAM_TEMPERATURE, UPSTREAM_MAX_TOKENS } = await import('../scripts/proxy.mjs');
  assert.equal(UPSTREAM_TEMPERATURE, 0.2);
  assert.equal(UPSTREAM_MAX_TOKENS, 131072);
  const d = up('muse-spark-1.3-contributor', 'Hallo Welt, lang genug');
  assert.equal(d.max_completion_tokens, 131072, 'explizites Maximum (Upstream-Default 32768 reicht nicht)');
  assert.equal(d.max_tokens, 131072, 'Mirror-Feld');
  assert.equal(d.temperature, 0.2);
  assert.equal(d.stream, true);
  assert.ok(!('reasoning_effort' in d), 'Proxy setzt nie reasoning_effort ohne Provider');
});

test('v48 parseGenerateBody: Client-Limit-Felder werden ignoriert (Proxy setzt 131072 selbst)', () => {
  const d = parseGenerateBody({ prompt: 'x'.repeat(20) });
  assert.equal(d.ok, true);
  assert.ok(!('maxTokens' in d), 'kein maxTokens im Parse-Ergebnis');
  const c = parseGenerateBody({ prompt: 'x'.repeat(20), max_completion_tokens: 131072, maxTokens: 999 });
  assert.equal(c.ok, true);
  assert.ok(!('maxTokens' in c), 'Limit-Felder ignoriert statt gereicht');
});

test('v48 Server: /generate reicht Limit 131072 an Upstream weiter (Stub-Upstream)', async () => {
  const keepEnv = { ...process.env };
  process.env.META_API_KEY = 'LLM_12345678_abcdefghijklmnop';
  process.env.KEY_FILE = 'C:/nonexistent-definitiv-kein-key.json';
  const seen = [];
  const realFetch = REAL_FETCH;
  globalThis.fetch = async (_url, opts) => {
    if (String(_url).includes('127.0.0.1')) return realFetch(_url, opts);
    seen.push(JSON.parse(opts?.body ?? '{}'));
    const enc = new TextEncoder();
    const bytes = enc.encode('data: [DONE]\n');
    return {
      ok: true, status: 200,
      body: { getReader() { let u = false; return { async read() { if (u) return { done: true, value: undefined }; u = true; return { done: false, value: bytes }; } }; } },
    };
  };
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Begriff Windkraftanlage lang genug', max_completion_tokens: 131072 }),
    });
    assert.equal(r.status, 200);
    await r.text();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].max_completion_tokens, 131072, 'explizites Maximum erreicht Upstream');
    assert.equal(seen[0].max_tokens, 131072, 'Mirror-Limit erreicht Upstream');
    assert.equal(seen[0].temperature, 0.2);
    assert.ok(!('reasoning_effort' in seen[0]));
  } finally {
    await new Promise((r) => server.close(r));
    process.env = keepEnv;
  }
});

/* v21: Baseten-Extras + 400-Fallback (simulierter Upstream, kein Netz). */

test('v48 upstreamChatBody: Baseten-Extras nur mit provider=baseten, immer Limit 131072', async () => {
  const { upstreamChatBody: up, stripUpstreamExtras } = await import('../scripts/proxy.mjs');
  const b = up('meta-models/muse-spark-open-1026', 'Hallo Welt, lang genug', 'baseten');
  assert.equal(b.max_completion_tokens, 131072, 'explizites Maximum');
  assert.equal(b.max_tokens, 131072, 'Mirror-Feld');
  assert.equal(b.reasoning_effort, 'low');
  assert.deepEqual(b.stream_options, { include_usage: true });
  const m = up('muse-spark-1.3-contributor', 'Hallo Welt, lang genug', 'meta-muse');
  assert.equal(m.max_completion_tokens, 131072, 'Meta-Pfad mit Limit (Thinking-Gate unveraendert)');
  assert.equal(m.max_tokens, 131072);
  assert.ok(!('reasoning_effort' in m) && !('stream_options' in m), 'Meta-Pfad ohne Thinking-Extras');
  const d = up('muse-spark-1.3-contributor', 'Hallo Welt, lang genug');
  assert.equal(d.max_tokens, 131072, 'Limit ohne Provider');
  assert.equal(stripUpstreamExtras(b), true);
  assert.ok(!('reasoning_effort' in b) && !('stream_options' in b), 'Extras gestrippt');
  assert.equal(b.max_completion_tokens, 131072, 'Limit ueberlebt den 400-Fallback');
  assert.equal(b.max_tokens, 131072, 'Mirror ueberlebt den 400-Fallback');
  assert.equal(stripUpstreamExtras(m), false, 'Limit allein ist kein Strip-Grund');
  assert.equal(stripUpstreamExtras(null), false);
  const legacy = { model: 'm', max_completion_tokens: 1, max_tokens: 1, temperature: 0.2 };
  assert.equal(stripUpstreamExtras(legacy), false, 'Alt-Limit-Felder werden nicht mehr defensiv gestrippt (v48 sendet sie selbst)');
  assert.deepEqual(legacy, { model: 'm', max_completion_tokens: 1, max_tokens: 1, temperature: 0.2 });
});

test('v48 Server: Upstream-400 mit Extras -> genau 1 Slim-Fallback ohne Extras, mit Limit', async () => {
  const keepEnv = { ...process.env };
  process.env.KEY_FILE = 'C:/nonexistent-definitiv-kein-key.json';
  const seen = [];
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (_url, opts) => {
    if (String(_url).includes('127.0.0.1')) return realFetch(_url, opts);
    n += 1;
    seen.push(JSON.parse(opts?.body ?? '{}'));
    if (n === 1) return { ok: false, status: 400, body: { cancel: async () => {} } };
    const enc = new TextEncoder();
    const bytes = enc.encode('data: [DONE]\n');
    return {
      ok: true, status: 200,
      body: { getReader() { let u = false; return { async read() { if (u) return { done: true, value: undefined }; u = true; return { done: false, value: bytes }; } }; } },
    };
  };
  const { createProxyServer } = await import('../scripts/proxy.mjs');
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await realFetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer LLM_12345678_abcdefghijklmnop' },
      body: JSON.stringify({ prompt: 'Begriff Windkraftanlage lang genug', provider: 'baseten', model: 'meta-models/muse-spark-open-1026' }),
    });
    assert.equal(r.status, 200);
    await r.text();
    assert.equal(n, 2, 'genau 1 Slim-Fallback');
    assert.equal(seen[0].reasoning_effort, 'low', 'erst mit Extras');
    assert.ok(!('reasoning_effort' in seen[1]), 'Fallback ohne Extras');
    assert.equal(seen[1].max_completion_tokens, 131072, 'Fallback mit Limit (belegt wirksam)');
    assert.equal(seen[1].max_tokens, 131072, 'Fallback mit Mirror');
  } finally {
    await new Promise((r) => server.close(r));
    globalThis.fetch = realFetch;
    process.env = keepEnv;
  }
});
