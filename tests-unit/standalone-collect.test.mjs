/**
 * Regressionstest: leere-Antwort-Ursache (Standalone-Reader).
 * Prueft den AUSGELIEFERTEN Reader aus dist-standalone/modelmuse-standalone.html
 * gegen simulierte Upstream-Formen BEIDER Provider (kein Key, kein Netz noetig):
 *  - Meta-SSE: reasoning-Chunks (privat, kein sichtbarer Text), leere Deltas,
 *    leeres Delta + finish stop, [DONE]  (live belegt via probe-api, 30.10.2026)
 *  - Meta-JSON: message.content null + finish length + usage.reasoning_tokens
 *    (live belegt: 198/200 Tokens Reasoning, content null)
 *  - Baseten/OpenAI-Formen: content als Array-Parts, choices[0].text,
 *    SSE-Content-Type mit reinem JSON-Body, Error-Envelopes, leere choices.
 * Fix-Umfang (v18): collectChatText sammelt delta+message+text+output_text,
 * ignoriert Reasoning (zaehlt es, bricht nicht ab), JSON-Fallback bei
 * SSE-Content-Type; emptyDetail meldet Provider/Modell/HTTP/finish statt nur
 * "leere Antwort".
 * Ablauf: erst bauen (npm run build:standalone), dann Tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HTML = new URL('../dist-standalone/modelmuse-standalone.html', import.meta.url);

async function html() {
  return readFile(HTML, 'utf8');
}

test('Artefakt-Boot-Schutz: kein Doppelkomma, Methoden sauber verdrahtet', async () => {
  const src = await html();
  assert.ok(!src.includes('},,'), 'kein Doppelkomma (wuerde Vue-Boot abbrechen)');
  for (const name of ['collectChatText', 'readSseText', 'readChatText', 'emptyDetail', 'freeSlug']) {
    assert.notEqual(src.indexOf(`${name}:function`), -1, `${name} vorhanden`);
  }
  const ed = src.indexOf('emptyDetail:function');
  const fs = src.indexOf('freeSlug:function', ed);
  assert.ok(ed > 0 && fs > ed, 'emptyDetail vor freeSlug');
});

/** Methode `name:function...{...}` per Klammer-Bilanz aus dem HTML loesen. */
function extractMethod(src, name) {
  const start = src.indexOf(`${name}:function`);
  assert.notEqual(start, -1, `${name} im Standalone-HTML vorhanden`);
  let i = src.indexOf('{', start);
  let depth = 0;
  let inStr = null;
  for (let j = i; j < src.length; j += 1) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') { j += 1; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanciert: ${name}`);
}

/** Sandbox-App mit dem ausgelieferten Reader-Code (this = app). */
function appFrom(src) {
  const app = {
    genProvider: 'baseten-direct',
    genModel: 'meta-models/muse-spark-open-1026',
    _lastHttp: null,
    _lastChatInfo: null,
    t: (k) => ({ emptyResponse: 'Leere Antwort. Erneut versuchen.' }[k] ?? k),
  };
  for (const name of ['collectChatText', 'readSseText', 'readChatText', 'emptyDetail']) {
    const code = extractMethod(src, name);
    app[name] = eval(`(${code.replace(`${name}:function`, 'function')})`);
  }
  return app;
}

function sseRes(lines, { contentType = 'text/event-stream', split = false } = {}) {
  const bytes = new TextEncoder().encode(`${lines.join('\n')}\n`);
  const pieces = split
    ? [bytes.slice(0, 7), bytes.slice(7, 31), bytes.slice(31, 33), bytes.slice(33)]
    : [bytes];
  let n = 0;
  return {
    headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? contentType : null) },
    body: {
      getReader() {
        return {
          async read() {
            if (n >= pieces.length) return { done: true, value: undefined };
            return { done: false, value: pieces[n++] };
          },
        };
      },
    },
  };
}

function jsonRes(data, { contentType = 'application/json' } = {}) {
  return {
    headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? contentType : null) },
    async json() { return data; },
  };
}

const ev = (o) => `data: ${JSON.stringify(o)}`;

/** Live belegte Meta-SSE-Form: nur Reasoning/leere Deltas, dann stop, kein Content. */
const META_REASONING_SSE = [
  ev({ choices: [{ delta: { reasoning_content: 'Denke nach...' } }] }),
  ev({ choices: [{ delta: { reasoning_content: 'Weiter...' } }] }),
  ev({ choices: [{ delta: {} }] }),
  ev({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
  'data: [DONE]',
];

/** Live belegte Meta-JSON-Form: content null, finish length, Reasoning frisst Budget. */
const META_NULL_JSON = {
  choices: [{ finish_reason: 'length', index: 0, message: { content: null, role: 'assistant' } }],
  usage: { completion_tokens: 200, prompt_tokens: 22, total_tokens: 222, reasoning_tokens: 198 },
};

test('collectChatText sammelt delta+message und ignoriert Reasoning ohne Abbruch', async () => {
  const app = appFrom(await html());
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  assert.equal(app.collectChatText({ choices: [{ delta: { reasoning_content: 'x' } }] }, info), '');
  assert.equal(info.reason, 1);
  assert.equal(app.collectChatText({ choices: [{ delta: { content: 'Hallo' } }] }, info), 'Hallo');
  assert.equal(app.collectChatText({ choices: [{ message: { content: ' Welt' } }] }, info), ' Welt');
  assert.equal(info.chunks, 2);
});

test('SSE: Reasoning-only + leere Deltas + stop -> Text leer, Info mit finish/reason', async () => {
  const app = appFrom(await html());
  const text = await app.readSseText(sseRes(META_REASONING_SSE));
  assert.equal(text, '');
  assert.equal(app._lastChatInfo.finish, 'stop');
  assert.ok(app._lastChatInfo.reason >= 2, 'Reasoning gezaehlt');
});

test('SSE: leere Deltas am Start verwerfen nichts (Content spaeter kommt an)', async () => {
  const app = appFrom(await html());
  const text = await app.readSseText(sseRes([
    ev({ choices: [{ delta: {} }] }),
    ev({ choices: [{ delta: { content: 'A' } }] }),
    ev({ choices: [{ delta: { content: 'B' }, finish_reason: 'stop' }] }),
    'data: [DONE]',
  ], { split: true }));
  assert.equal(text, 'AB');
});

test('SSE: choices[0].text und content-Array werden gesammelt (Gateway-Formen)', async () => {
  const app = appFrom(await html());
  const a = await app.readSseText(sseRes([ev({ choices: [{ text: 'Tx', finish_reason: 'stop' }] }), 'data: [DONE]']));
  assert.equal(a, 'Tx');
  const b = await app.readSseText(sseRes([
    ev({ choices: [{ message: { content: [{ type: 'text', text: 'P1' }, { type: 'text', text: 'P2' }] }, finish_reason: 'stop' }] }),
    'data: [DONE]',
  ]));
  assert.equal(b, 'P1P2');
});

test('SSE: leere choices + Error-Envelope -> Info (kein stilles Verschlucken)', async () => {
  const app = appFrom(await html());
  const text = await app.readSseText(sseRes([
    ev({ choices: [] }),
    ev({ error: { message: 'gateway_timeout' } }),
    'data: [DONE]',
  ]));
  assert.equal(text, '');
  assert.equal(app._lastChatInfo.err, 'gateway_timeout');
});

test('SSE-Content-Type mit reinem JSON-Body faellt auf JSON zurueck', async () => {
  const app = appFrom(await html());
  const text = await app.readSseText(sseRes(
    [JSON.stringify({ choices: [{ message: { content: 'JSONFALLBACK' }, finish_reason: 'stop' }] })],
    { contentType: 'text/event-stream' },
  ));
  assert.equal(text, 'JSONFALLBACK');
});

test('JSON: content null + finish length + Reasoning-Usage -> Info mit length/Usage', async () => {
  const app = appFrom(await html());
  const text = await app.readChatText(jsonRes(META_NULL_JSON));
  assert.equal(text, '');
  assert.equal(app._lastChatInfo.finish, 'length');
  assert.match(app._lastChatInfo.usage, /reasoning 198\/200/);
});

test('JSON: content-Array und delta-Form werden gesammelt', async () => {
  const app = appFrom(await html());
  const a = await app.readChatText(jsonRes({ choices: [{ message: { content: [{ text: 'X' }, 'Y'] }, finish_reason: 'stop' }] }));
  assert.equal(a, 'XY');
  const b = await app.readChatText(jsonRes({ choices: [{ delta: { content: 'D' }, finish_reason: 'stop' }] }));
  assert.equal(b, 'D');
});

test('emptyDetail meldet Provider/Modell/HTTP/finish statt nur Leere Antwort', async () => {
  const app = appFrom(await html());
  app._lastHttp = 200;
  app._lastChatInfo = { chunks: 0, empty: 5, reason: 3, finish: 'length', err: '', usage: 'reasoning 198/200 tokens' };
  const msg = app.emptyDetail();
  assert.match(msg, /Leere Antwort/);
  assert.match(msg, /baseten-direct/);
  assert.match(msg, /meta-models\/muse-spark-open-1026/);
  assert.match(msg, /HTTP 200/);
  assert.match(msg, /finish=length/);
  assert.ok(msg.length <= 160, 'passt in genNotice (slice 160)');
});

test('v19-Budget: 65536 initial + 131072-Retry mit Gate in generate+modify', async () => {
  const src = await html();
  const count = (sub) => src.split(sub).length - 1;
  assert.equal(count('max_completion_tokens:65536'), 2, 'Budget 65536 in generate + modify');
  assert.equal(count('max_completion_tokens=131072'), 2, 'Retry-Budget 131072 in generate + modify');
  assert.equal(count('budgetRetryable'), 3, 'Retry-Gate: Helper + 2 Calls');
  assert.equal(count('max_completion_tokens:8000'), 0, 'altes 8000-Budget ersetzt');
  assert.equal(count('max_completion_tokens:16384'), 0, 'v19-Zwischenwert ersetzt');
  assert.equal(count('max_completion_tokens=32768'), 0, 'v19-Zwischenwert ersetzt');
});
