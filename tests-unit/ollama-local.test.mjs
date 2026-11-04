/**
 * Ollama-Lokal TEMP-DEAKTIVIERT (04.11.2026, Revert: diese Datei + auskommentierte
 * Zweige in src/runtime/livegen.js + src/shell/ui-livegen.js reaktivieren).
 * Pinnt die Deaktivierung: kein localhost-Direkt-Call, kein Reasoning-Param,
 * kein Key-Hinweis, Registry-Eintrag bleibt DATEN (nicht geloescht), Guard
 * meldet E-GEN-DEAKTIVIERT statt Upstream-Calls.
 * Belegte Doku-Quellen bleiben im Registry-Eintrag erhalten
 * (https://ollama.com/blog/openai-compatibility,
 * https://docs.ollama.com/api/openai-compatibility,
 * https://docs.ollama.com/faq, https://docs.ollama.com/api/introduction).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECT_BASES, DIRECT_DEFAULT_MODEL, directChatUrl, reasoningLevel,
  reasoningEffortsFor, reasoningXhighAllowed, reasoningMaxAllowed,
  buildChatBody, liveKeySessionKey, generateLive,
} from '../src/runtime/livegen.js';
import { keyHintFor } from '../src/shell/ui-livegen.js';
import { getProvider, getModel, isProviderDeaktiviert, generationTarget } from '../src/runtime/providers.js';
import { readFile } from 'node:fs/promises';

const reg = JSON.parse(await readFile('src/data/providers.json', 'utf8'));

test('TEMP: keine localhost-Basis, kein Default-Tag (auskommentiert, Daten bleiben)', () => {
  assert.equal(DIRECT_BASES.ollama, undefined, 'DIRECT_BASES.ollama auskommentiert');
  assert.equal(DIRECT_DEFAULT_MODEL.ollama, undefined, 'DIRECT_DEFAULT_MODEL.ollama auskommentiert');
  assert.equal(directChatUrl('ollama'), null, 'kein Direkt-URL fuer deaktivierten Anbieter');
  assert.equal(isProviderDeaktiviert('ollama'), true);
});

test('TEMP: kein Reasoning-Param fuer Ollama (wie zuvor [], Guard bleibt)', () => {
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

test('TEMP: kein Key-Hinweis, Guard meldet deaktiviert (de/en/es/fr)', async () => {
  for (const loc of ['de', 'en', 'es', 'fr']) {
    assert.equal(keyHintFor('ollama', loc), '', `${loc}: kein Hinweis fuer deaktivierten Anbieter`);
  }
  assert.equal(liveKeySessionKey('ollama'), 'modelmuse-live-key-ollama');
  const ziel = generationTarget(reg, 'ollama', 'llama3.1:8b');
  assert.equal(ziel.kind, 'deaktiviert');
  assert.equal(ziel.ready, false);
  assert.match(ziel.text, /TEMP-DEAKTIVIERT/);
  // generateLive lehnt frueh ab (kein Call, kein Key-Fluss).
  await assert.rejects(
    generateLive('Begriff lang genug zum Generieren', { provider: 'ollama', model: 'llama3.1:8b' }),
    (e) => e?.code === 'E-GEN-DEAKTIVIERT',
    'generateLive wirft E-GEN-DEAKTIVIERT'
  );
});

test('TEMP: Registry-Eintrag bleibt DATEN (nicht geloescht, Doku-Links belegt)', () => {
  const p = getProvider(reg, 'ollama');
  assert.ok(p, 'ollama in Registry');
  assert.equal(p.generation.kind, 'direct');
  assert.ok((p.docs ?? []).length >= 3, 'mindestens 3 belegte Doku-Links');
  for (const d of p.docs ?? []) {
    assert.ok(/^https:\/\/(ollama\.com|docs\.ollama\.com)\//.test(d.url), d.url);
  }
  assert.ok(getModel(reg, 'ollama', 'llama3.1:8b'), 'Beispiel-Tag in Registry');
});
