/** Unittests Teil 1: Multi-Provider-Registry (ohne Key, ohne Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateProviders, getProvider, getModel, listModels,
  recommendModel, privacyNotice, generationTarget, didaktikHinweis,
} from '../src/runtime/providers.js';

const reg = JSON.parse(await readFile('src/data/providers.json', 'utf8'));

test('Registry ist gueltig: 2 Anbieter, 6 Modelle, Defaults belegt', () => {
  const { ok, errors } = validateProviders(reg);
  assert.equal(ok, true, errors.join('; '));
  assert.equal(reg.providers.length, 2);
  assert.equal(listModels(reg).length, 6);
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

test('OpenRouter: Gratis-Test zuerst, verifizierte Slugs, Rest Benchmark-Referenz', () => {
  const ids = (getProvider(reg, 'openrouter')?.models ?? []).map((m) => m.id);
  assert.deepEqual(ids, ['gemma-4-26b-it-free', 'gpt-6-astra', 'claude-opus-5-5', 'gemini-4-argon']);
  // Verifizierte Slugs (offizielle OpenRouter-Modellliste GET /api/v1/models,
  // Stand 27.10.2026 live geprueft, kein Raten).
  assert.equal(getModel(reg, 'openrouter', 'gemma-4-26b-it-free')?.providerModellId, 'google/gemma-4-26b-a4b-it:free');
  assert.equal(getModel(reg, 'openrouter', 'gpt-6-astra')?.providerModellId, 'openai/gpt-6-astra');
  assert.equal(getModel(reg, 'openrouter', 'claude-opus-5-5')?.providerModellId, 'anthropic/claude-opus-5.5');
  assert.equal(getModel(reg, 'openrouter', 'gemini-4-argon')?.providerModellId, 'google/gemini-4-argon');
  for (const id of ids) {
    const m = getModel(reg, 'openrouter', id);
    assert.ok((m.badges ?? []).length >= 1, `${id}: Badge fehlt`);
    const doc = JSON.stringify(m);
    const belegt = /3JSBench|threejseval|benchmark\.ai|AA-3D/.test(doc);
    const gratis = m.empfehlung === 'gratis-test' && /openrouter\.ai\/google\/gemma-4-26b-a4b-it:free/.test(doc);
    assert.ok(belegt || gratis, `${id}: weder Benchmark-Beleg noch Gratis-Doku`);
  }
});

test('Empfehlungen: Geometrie=Astra, Aesthetik=Opus, Allround=Spark, Datenschutz=Standard', () => {
  assert.equal(recommendModel(reg, 'geometrie').modelId, 'gpt-6-astra');
  assert.equal(recommendModel(reg, 'aesthetik').modelId, 'claude-opus-5-5');
  assert.equal(recommendModel(reg, 'allround').modelId, 'muse-spark-1.3-contributor');
  assert.equal(recommendModel(reg, 'datenschutz').modelId, 'muse-spark-1.3');
});

test('Generierungspfade: Muse-CLI echt, OpenRouter ehrlich deaktiviert (kein Key)', () => {
  const cli = generationTarget(reg, 'meta-muse', 'muse-spark-1.3-contributor', 'p1-test.txt');
  assert.equal(cli.ready, true);
  assert.ok(cli.text.includes('muse.exe exec --model muse-spark-1.3-contributor'));
  assert.ok(cli.text.includes('--api-key-stdin'), 'Key nur per stdin (Flag-Name, kein Key-Wert)');
  assert.ok(!cli.text.includes('Key_muse'), 'kein Key-Dateiname mit Inhalt');
  const proxy = generationTarget(reg, 'openrouter', 'gpt-6-astra');
  assert.equal(proxy.ready, false);
  assert.match(proxy.text, /Deaktiviert/);
});

test('Didaktik-Hinweis: kein Benchmark misst Didaktik', () => {
  assert.match(didaktikHinweis(reg), /Kein Benchmark misst Didaktik/);
});

test('Keine Halluzination: keine erfundenen API-Endpunkte im Repo', async () => {
  const txt = await readFile('src/data/providers.json', 'utf8');
  assert.ok(!/api\.openrouter\.ai\/v1|openai\.com\/v1/i.test(txt), 'keine Provider-API-URLs hart kodiert');
  assert.ok(!/sk-[A-Za-z0-9]/.test(txt), 'kein Key-Muster');
});
