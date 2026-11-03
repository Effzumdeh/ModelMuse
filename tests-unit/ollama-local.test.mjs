/**
 * Ollama-Lokal (Final-Sprint 03.11.2026): reine Funktions-Tests ohne Netz.
 * Belegt: localhost-Basis, Default-Tag, Direkt-Call ohne Key, kein
 * Reasoning-Param, localhost-Fehlerhinweise, Registry-Eintrag.
 * Quellen: https://ollama.com/blog/openai-compatibility,
 * https://docs.ollama.com/api/openai-compatibility,
 * https://docs.ollama.com/faq, https://docs.ollama.com/api/introduction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECT_BASES, DIRECT_DEFAULT_MODEL, directChatUrl, reasoningLevel,
  reasoningEffortsFor, reasoningXhighAllowed, reasoningMaxAllowed,
  buildChatBody, liveKeySessionKey,
} from '../src/runtime/livegen.js';
import { keyHintFor } from '../src/shell/ui-livegen.js';
import { getProvider, getModel } from '../src/runtime/providers.js';
import { readFile } from 'node:fs/promises';

const reg = JSON.parse(await readFile('src/data/providers.json', 'utf8'));

test('Basis + Default-Tag belegt (localhost:11434, OpenAI-kompatibel)', () => {
  assert.equal(DIRECT_BASES.ollama, 'http://localhost:11434/v1');
  assert.equal(DIRECT_DEFAULT_MODEL.ollama, 'llama3.1:8b');
  assert.equal(directChatUrl('ollama'), 'http://localhost:11434/v1/chat/completions');
});

test('Kein Reasoning-Param fuer Ollama (unverifiziert = 400-Risiko)', () => {
  assert.deepEqual(reasoningEffortsFor('ollama', 'llama3.1:8b'), []);
  assert.equal(reasoningMaxAllowed('ollama', 'llama3.1:8b'), false);
  assert.equal(reasoningXhighAllowed('ollama', 'llama3.1:8b'), false);
  assert.equal(reasoningLevel('ollama', 'llama3.1:8b', undefined), null);
  assert.equal(reasoningLevel('ollama', 'beliebiges-modell', 'xhigh'), null);
  const body = buildChatBody('llama3.1:8b', 'Begriff lang genug zum Generieren', { provider: 'ollama' });
  assert.equal(body.model, 'llama3.1:8b');
  assert.equal(body.stream, true);
  assert.ok(!('reasoning_effort' in body), 'kein reasoning_effort fuer Ollama');
  assert.ok(!('stream_options' in body), 'kein stream_options fuer Ollama');
});

test('Key-Hinweis: kein Key, localhost statt Key-Quelle (de/en/es/fr)', () => {
  for (const loc of ['de', 'en', 'es', 'fr']) {
    const hint = keyHintFor('ollama', loc);
    assert.ok(hint.includes('http://localhost:11434'), `${loc}: localhost-Hinweis`);
    assert.ok(!/openrouter\.ai\/keys|dev\.meta\.ai|Baseten-Key/i.test(hint), `${loc}: kein fremder Key-Hinweis`);
  }
  assert.equal(liveKeySessionKey('ollama'), 'modelmuse-live-key-ollama');
});

test('Registry: Ollama lokal-ohne-key mit belegten Doku-Links', () => {
  const p = getProvider(reg, 'ollama');
  assert.ok(p, 'ollama in Registry');
  assert.equal(p.generation.kind, 'direct');
  assert.ok((p.docs ?? []).length >= 3, 'mindestens 3 belegte Doku-Links');
  for (const d of p.docs ?? []) {
    assert.ok(/^https:\/\/(ollama\.com|docs\.ollama\.com)\//.test(d.url), d.url);
  }
  assert.ok(getModel(reg, 'ollama', 'llama3.1:8b'), 'Beispiel-Tag in Registry');
});
