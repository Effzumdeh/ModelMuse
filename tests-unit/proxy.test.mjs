/** Unittests Proxy (scripts/proxy.mjs) + OFFLINE-Verhalten (livegen, ohne Key/Netz). */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROXY_DEFAULT_PORT, OPENROUTER_BASE,
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
    assert.equal(h.service, 'skillspark-proxy');
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

test('Registry: openrouter-Pfad (byokOnly, verifizierte Slugs, localhost-Bindung bleibt)', async () => {
  assert.equal(OPENROUTER_BASE, 'https://openrouter.ai/api/v1');
  assert.equal(PROVIDERS.openrouter.base, 'https://openrouter.ai/api/v1');
  assert.equal(PROVIDERS.openrouter.byokOnly, true);
  assert.equal(PROVIDERS.openrouter.defaultModel, 'google/gemma-4-26b-a4b-it:free');
  assert.ok(PROVIDERS.openrouter.models.includes('google/gemma-4-26b-a4b-it:free'));
  assert.ok(PROVIDERS.openrouter.models.includes('openai/gpt-6-astra'));
  assert.ok(PROVIDERS.openrouter.models.includes('anthropic/claude-opus-5.5'));
  assert.ok(PROVIDERS.openrouter.models.includes('google/gemini-4-argon'));
  assert.ok(!PROVIDERS.openrouter.models.some((m) => /muse/i.test(m)), 'KEIN Spark auf OpenRouter-Pfad');
  assert.equal(DEFAULT_PROVIDER, 'meta-muse');
  const okFree = parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it:free' });
  assert.equal(okFree.ok, true);
  assert.equal(okFree.model, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(parseGenerateBody({ prompt: 'x'.repeat(20), provider: 'openrouter', model: 'erfunden-99' }).code, 'E-GEN-404');
});

test('Server: openrouter ohne BYOK -> E-GEN-CONFIG (Meta-Server-Key geht NIE an OpenRouter)', async () => {
  const keepEnv = { ...process.env };
  process.env.META_API_KEY = 'LLM_12345678_abcdefghijklmnop';
  delete process.env.OPENROUTER_API_KEY;
  process.env.KEY_FILE = 'C:/nonexistent-definitiv-kein-key.json';
  const server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Begriff Windkraftanlage lang genug', provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it:free' }),
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
