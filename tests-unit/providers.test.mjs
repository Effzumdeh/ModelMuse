/** Unittests Teil 1: Multi-Provider-Registry (ohne Key, ohne Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateProviders, getProvider, getModel, listModels,
  recommendModel, privacyNotice, generationTarget, didaktikHinweis,
} from '../src/runtime/providers.js';

const reg = JSON.parse(await readFile('src/data/providers.json', 'utf8'));

test('Registry ist gueltig: 4 Anbieter, 7 Modelle, Defaults belegt', () => {
  const { ok, errors } = validateProviders(reg);
  assert.equal(ok, true, errors.join('; '));
  assert.equal(reg.providers.length, 4);
  assert.equal(listModels(reg).length, 7);
  assert.equal(reg.defaultProvider, 'meta-muse');
  assert.equal(reg.defaultModel, 'muse-spark-1.3-contributor');
});

test('Meta: beide Muse-Varianten mit Datenschutz-Hinweis', () => {
  const c = getModel(reg, 'meta-muse', 'muse-spark-1.3-contributor');
  const s = getModel(reg, 'meta-muse', 'muse-spark-1.3');
  assert.ok(c && s);
  assert.match(privacyNotice(reg, 'meta-muse', 'muse-spark-1.3-contributor'), /Training/);
  assert.match(privacyNotice(reg, 'meta-muse', 'muse-spark-1.3'), /datenschutzfreundlich/);
  assert.ok((c.tags ?? []).includes('Default'));
  assert.ok((s.tags ?? []).includes('Standard'));
});

test('Baseten: NUR verifizierter Meta-Modell-Slug (keine erfundenen Slugs)', () => {
  const ids = (getProvider(reg, 'baseten')?.models ?? []).map((m) => m.id);
  assert.deepEqual(ids, ['muse-spark-open-1026']);
  // Verifizierter Slug (Session-Vorgabe 28.10.2026, Baseten Model APIs,
  // Basis https://inference.baseten.co/v1, Meta-Regel: Laufzeit nur Meta-Modelle).
  assert.equal(getModel(reg, 'baseten', 'muse-spark-open-1026')?.providerModellId, 'meta-models/muse-spark-open-1026');
  for (const id of ids) {
    const m = getModel(reg, 'baseten', id);
    assert.ok((m.badges ?? []).length >= 1, `${id}: Badge fehlt`);
    const doc = JSON.stringify(m);
    const belegt = /3JSBench|threejseval|benchmark\.ai|AA-3D/.test(doc);
    const baseten = m.empfehlung === 'baseten-default' && /meta-models\/muse-spark-open-1026/.test(doc);
    assert.ok(belegt || baseten, `${id}: weder Benchmark-Beleg noch Baseten-Doku`);
  }
});

test('OpenRouter: NUR verifizierte Slugs (31.10.2026, nichts erfunden)', () => {
  const p = getProvider(reg, 'openrouter');
  assert.ok(p, 'openrouter-Anbieter fehlt');
  assert.equal(p.generation?.kind, 'direct', 'OpenRouter: NUR Direkt-Call, kein Proxy-Pfad');
  const ids = (p.models ?? []).map((m) => m.id);
  assert.deepEqual(ids, ['gpt-6.1-sol', 'muse-spark-1.3', 'opus-5.5']);
  // Exakte OpenRouter-Slugs (verifiziert via https://openrouter.ai/models,
  // 31.10.2026 — keine Abweichung, keine erfundenen Slugs).
  assert.equal(getModel(reg, 'openrouter', 'gpt-6.1-sol')?.providerModellId, 'openai/gpt-6.1-sol');
  assert.equal(getModel(reg, 'openrouter', 'muse-spark-1.3')?.providerModellId, 'meta/muse-spark-1.3');
  assert.equal(getModel(reg, 'openrouter', 'opus-5.5')?.providerModellId, 'anthropic/claude-opus-5.5');
  for (const id of ids) {
    const m = getModel(reg, 'openrouter', id);
    assert.ok((m.badges ?? []).length >= 1, `${id}: Badge fehlt`);
    assert.match(String(m.routingHinweis ?? ''), /verifiziert/, `${id}: Verifikations-Beleg fehlt`);
    assert.match(String(m.privacy ?? ''), /OpenRouter-Key/, `${id}: BYOK-Hinweis fehlt`);
  }
});

test('Ollama: lokal ohne Key, Freitext-Modell, belegte Doku-Links', () => {
  const p = getProvider(reg, 'ollama');
  assert.ok(p, 'ollama-Anbieter fehlt');
  assert.equal(p.generation?.kind, 'direct', 'Ollama: Direkt-Call (kein Proxy)');
  assert.equal(p.generation?.status, 'lokal-ohne-key', 'Ollama: BYOK entfaellt');
  assert.match(p.generation?.keyHandling ?? '', /Kein Key-Feld/, 'Key-Feld-Hinweis');
  for (const url of (p.docs ?? []).map((d) => d.url)) {
    assert.ok(/^https:\/\/(ollama\.com|docs\.ollama\.com)\//.test(url), `unbelegte Ollama-URL: ${url}`);
  }
  const urls = (p.docs ?? []).map((d) => d.url).join(' ');
  assert.ok(urls.includes('http://localhost:11434') || /localhost:11434/.test(p.generation?.hinweis ?? ''), 'localhost:11434 belegt');
  assert.ok(/OLLAMA_ORIGINS/.test(p.generation?.hinweis ?? ''), 'CORS-Hinweis OLLAMA_ORIGINS');
  const m = getModel(reg, 'ollama', 'llama3.1:8b');
  assert.ok(m, 'Ollama-Beispiel-Tag fehlt');
  assert.ok((m.badges ?? []).some((b) => /ETA 240 s/.test(b.text)), 'ETA-240-Badge');
  const ziel = generationTarget(reg, 'ollama', 'llama3.1:8b');
  assert.equal(ziel.kind, 'direct');
  assert.equal(ziel.ready, true, 'Ollama braucht keinen Key (ready ohne BYOK)');
  assert.match(ziel.text, /localhost:11434/);
});

test('Empfehlungen: Geometrie/Aesthetik/Praeferenz=Fallback Standard, Allround=Contributor, Datenschutz=Standard', () => {
  assert.equal(recommendModel(reg, 'geometrie').modelId, 'muse-spark-1.3');
  assert.equal(recommendModel(reg, 'aesthetik').modelId, 'muse-spark-1.3');
  assert.equal(recommendModel(reg, 'praeferenz').modelId, 'muse-spark-1.3');
  assert.equal(recommendModel(reg, 'allround').modelId, 'muse-spark-1.3-contributor');
  assert.equal(recommendModel(reg, 'datenschutz').modelId, 'muse-spark-1.3');
  // Keine Empfehlung darf auf eine ID zeigen, die nicht in der Registry steht.
  for (const d of ['geometrie', 'aesthetik', 'praeferenz', 'allround', 'datenschutz']) {
    const r = recommendModel(reg, d);
    assert.ok(getModel(reg, r.providerId, r.modelId), `${d}: ${r.providerId}/${r.modelId} nicht in Registry`);
  }
});

test('Generierungspfade: Muse-CLI echt, Baseten braucht BYOK, OpenRouter direkt mit BYOK', () => {
  const cli = generationTarget(reg, 'meta-muse', 'muse-spark-1.3-contributor', 'p1-test.txt');
  assert.equal(cli.ready, true);
  assert.ok(cli.text.includes('muse.exe exec --model muse-spark-1.3-contributor'));
  assert.ok(cli.text.includes('--api-key-stdin'), 'Key nur per stdin (Flag-Name, kein Key-Wert)');
  assert.ok(!cli.text.includes('Key_muse'), 'kein Key-Dateiname mit Inhalt');
  const proxy = generationTarget(reg, 'baseten', 'muse-spark-open-1026');
  assert.equal(proxy.ready, false);
  assert.match(proxy.text, /BYOK/);
  const direkt = generationTarget(reg, 'openrouter', 'openai/gpt-6.1-sol');
  assert.equal(direkt.kind, 'direct', 'OpenRouter: eigener Direkt-Pfad (kein Proxy)');
  assert.equal(direkt.ready, false);
  assert.match(direkt.text, /BYOK/);
  assert.match(direkt.text, /HTTP-Referer/, 'Referer/Title-Hinweis im Pfadtext');
});

test('Didaktik-Hinweis: kein Benchmark misst Didaktik', () => {
  assert.match(didaktikHinweis(reg), /Kein Benchmark misst Didaktik/);
});

test('Keine Halluzination: keine erfundenen API-Endpunkte/Keys im Repo', async () => {
  const txt = await readFile('src/data/providers.json', 'utf8');
  // Belegte OpenRouter-URLs (Modelle-API-verifiziert 31.10.2026): Allowlist.
  const allowed = ['https://openrouter.ai/models', 'https://openrouter.ai/docs/api-reference/chat-completions', 'https://openrouter.ai/keys', 'https://openrouter.ai/api/v1'];
  for (const m of txt.match(/https:\/\/openrouter\.ai[^\s"']*/gi) ?? []) {
    assert.ok(allowed.some((a) => m === a || m.startsWith(a)), `unbelegte OpenRouter-URL: ${m}`);
  }
  assert.ok(!/openai\.com\/v1/i.test(txt), 'keine OpenAI-URLs mehr');
  assert.ok(!/sk-[A-Za-z0-9]/.test(txt), 'kein Key-Muster');
  assert.ok(!/LLM_[A-Za-z0-9]/.test(txt), 'kein Meta-Key-Muster');
});
