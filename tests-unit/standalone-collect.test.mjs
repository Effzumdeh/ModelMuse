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
  // v21-Regression (31.10.2026): Streukomma auf eigener Zeile zwischen den
  // Methoden (Separator `}` + Umbruch + `,`) brach den Vue-Boot mit
  // `Unexpected token ','` -> rohe Mustaches. `},,` allein greift zu kurz.
  const span = src.slice(ed, fs);
  const loneComma = span.split('\n').findIndex((l) => l.replace(/[\r \t]/g, '') === ',');
  assert.equal(loneComma, -1, 'Streukomma auf eigener Zeile zwischen emptyDetail und freeSlug');
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

test('emptyDetail meldet Provider/Modell/HTTP/finish/Usage/Retry/Build statt nur Leere Antwort', async () => {
  const app = appFrom(await html());
  app._lastHttp = 200;
  app._lastRetry = 1;
  app._lastChatInfo = { chunks: 0, empty: 5, reason: 3, finish: 'length', err: '', usage: 'reasoning 198/200 tokens' };
  const msg = app.emptyDetail();
  assert.match(msg, /Leere Antwort/);
  assert.match(msg, /baseten-direct/);
  assert.match(msg, /meta-models\/muse-spark-open-1026/);
  assert.match(msg, /HTTP 200/);
  assert.match(msg, /finish=length/);
  assert.match(msg, /reasoning 198\/200/, 'Usage immer sichtbar (Budget- vs Thinking-Hypothese)');
  assert.match(msg, /Retry 1\/1/, 'Retry-Zaehler sichtbar');
  assert.match(msg, /Build v25/, 'Build-Stempel sichtbar');
  assert.ok(msg.length <= 200, 'passt in genNotice (slice 200)');
  app._lastRetry = 0;
  assert.match(app.emptyDetail(), /Retry 0\/1/, 'kein Retry ohne Budget-Retry');
});

test('v23 kein Length-Limit in generate+modify (Erstversuch + Retry + Fallback)', async () => {
  const src = await html();
  const count = (sub) => src.split(sub).length - 1;
  assert.equal(count('temperature:0.2,max_completion_tokens'), 0, 'kein max_completion_tokens im Erst-Body');
  assert.equal(count('max_completion_tokens:65536'), 0, 'kein 65536-Erst-Budget');
  assert.equal(count('max_completion_tokens=131072'), 0, 'kein 131072-Retry-Budget');
  assert.equal(count('max_tokens=65536'), 0, 'kein max_tokens-Mirror');
  assert.equal(count('max_tokens=131072'), 0, 'kein max_tokens-Retry-Mirror');
  assert.equal(count('delete gbody.max_tokens'), 0, 'kein Limit-Strip noetig (gen)');
  assert.equal(count('delete mbody.max_tokens'), 0, 'kein Limit-Strip noetig (mod)');
  assert.equal(count('max_completion_tokens:8000'), 0, 'altes 8000-Budget ersetzt');
  assert.equal(count('max_completion_tokens:16384'), 0, 'v19-Zwischenwert ersetzt');
  assert.equal(count('max_completion_tokens=32768'), 0, 'v19-Zwischenwert ersetzt');
  assert.equal(count('budgetRetryable'), 3, 'Retry-Gate: Helper + 2 Calls (Regel unveraendert: 1x nur bei leer+length+nur Reasoning)');
});

/* v21: Thinking-Reduktion + 400-Fallback + gehärteter Reader + Diagnose. */

test('v23-Request: Baseten-Extras nur bei baseten-direct + 400-Fallback ohne Extras, nie Limit', async () => {
  const src = await html();
  const count = (sub) => src.split(sub).length - 1;
  assert.equal(count('gbody.max_tokens'), 0, 'kein max_tokens gen (Modell nutzt eigenes Maximum)');
  assert.equal(count('mbody.max_tokens'), 0, 'kein max_tokens mod');
  assert.equal(count('gbody.reasoning_effort="low"'), 1, 'Thinking-Budget gen (v22/v23: belegtes Minimum low)');
  assert.equal(count('mbody.reasoning_effort="low"'), 1, 'Thinking-Budget mod');
  assert.equal(count('reasoning_effort="none"'), 0, 'kein unbelegtes none (Doku: rejected/gemapped)');
  assert.equal(count('reasoning_effort'), 10, '2 Gates + 2 low + 4 Echo-Snapshots + 2 Echo-Labels');
  assert.equal(count('include_usage'), 2, 'Usage im Stream gen+mod');
  assert.equal(count('slimG'), 4, '400-Fallback gen (Flag+Check+Set+Echo)');
  assert.equal(count('slimM'), 4, '400-Fallback mod (Flag+Check+Set+Echo)');
  assert.ok(count('delete gbody.stream_options') === 1 && count('delete mbody.stream_options') === 1, 'Fallback strippt Extras (ohne Limit-Anteil)');
  assert.equal(count('Kein Nachdenken, keine Einleitung'), 2, 'Prompt-Direktantwort generate+modify');
  assert.equal(count('this._lastReq={'), 4, 'Request-Snapshots gen+mod (Erstversuch+Fallback)');
  assert.equal(count('_lastReqR'), 3, 'Request-Snapshots Retry gen+mod (+Diag-Lesen)');
});

test('v21-Reader: neue Content-Felder, Reasoning nie Content, strukturiertes Reasoning zählt', async () => {
  const app = appFrom(await html());
  const info = () => ({ chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' });
  let i = info();
  assert.equal(app.collectChatText({ choices: [{ delta: { text: 'DT' } }] }, i), 'DT');
  assert.equal(app.collectChatText({ choices: [{ message: { output_text: 'MO' } }] }, i), 'MO');
  assert.equal(app.collectChatText({ choices: [{ text: 'CT' }] }, i), 'CT');
  assert.equal(i.chunks, 3);
  i = info();
  assert.equal(app.collectChatText({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'R1' }] }] }, i), 'R1');
  assert.equal(app.collectChatText({ choices: [{ message: { content: [{ text: { value: 'NV' } }] } }] }, i), 'NV');
  assert.equal(app.collectChatText({ choices: [{ delta: { content: '' }, message: { content: 'MB' } }] }, i), 'MB');
  assert.equal(i.chunks, 3);
  i = info();
  assert.equal(app.collectChatText({ choices: [{ message: { content: [{ type: 'reasoning', text: 'geheim' }] } }] }, i), '');
  assert.equal(app.collectChatText({ choices: [{ delta: { thinking: ['t1'] } }] }, i), '');
  assert.equal(i.reason, 1, 'strukturiertes Thinking zählt');
  assert.equal(app.collectChatText({ choices: [{ delta: {}, message: { refusal: 'policy', content: null } }] }, i), '');
  assert.equal(i.err, 'policy');
});

test('v25-Diagnose: buildTag/staleHint vorhanden und verdrahtet', async () => {
  const src = await html();
  const count = (sub) => src.split(sub).length - 1;
  assert.equal(count('standalone-build v22'), 1, 'v22-Stempel (Historie) im HTML');
  assert.equal(count('standalone-build v23'), 1, 'v23-Stempel (Historie) im HTML');
  assert.equal(count('standalone-build v24'), 1, 'v24-Stempel (Historie) im HTML');
  assert.equal(count('standalone-build v25'), 1, 'v25-Stempel im HTML');
  assert.equal(count('buildTag:function'), 1, 'buildTag-Methode');
  assert.equal(count('staleHint:function'), 1, 'staleHint-Methode');
  assert.ok(count('Strg+F5') === 1, 'Hart-Neuladen-Hinweis');
  const app = appFrom(await html());
  for (const name of ['buildTag', 'staleHint']) {
    const code = extractMethod(src, name);
    app[name] = eval(`(${code.replace(`${name}:function`, 'function')})`);
  }
  assert.equal(app.buildTag(), 'v25');
  for (const name of ['collectChatText', 'readSseText', 'readChatText', 'emptyDetail', 'buildTag', 'staleHint']) {
    assert.notEqual(src.indexOf(`${name}:function`), -1, `${name} vorhanden`);
  }
  assert.ok(!src.includes('},,'), 'kein Doppelkomma (Vue-Boot)');
});

/* v22: Diagnose-Export (Copy-Button) + Usage-Zahlen + Reasoning-Auszug. */

test('v22-Reader: Usage-Zahlen + reasonSample (2KB-Cap) im Info-Seitenkanal', async () => {
  const app = appFrom(await html());
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  app.collectChatText({ choices: [{ delta: { reasoning_content: 'r1' } }], usage: { completion_tokens: 10, reasoning_tokens: 8 } }, info);
  assert.equal(info.usageReasoning, 8);
  assert.equal(info.usageCompletion, 10);
  assert.equal(info.reasonSample, 'r1');
  const text = await app.readSseText(sseRes([
    ev({ choices: [{ delta: { reasoning_content: 'Denke nach...' } }], usage: { completion_tokens: 200, reasoning_tokens: 198 } }),
    ev({ choices: [{ delta: {}, finish_reason: 'length' }] }),
    'data: [DONE]',
  ]));
  assert.equal(text, '');
  assert.equal(app._lastChatInfo.usageReasoning, 198);
  assert.equal(app._lastChatInfo.usageCompletion, 200);
  assert.ok(String(app._lastChatInfo.reasonSample).includes('Denke nach'), 'Reasoning-Auszug fuer Diagnose');
});

test('v25-Diagnose: diagText redigiert, alle Felder + Request-Echo, ~2KB-Cap', async () => {
  const src = await html();
  const app = appFrom(await html());
  const code = extractMethod(src, 'diagText');
  app.diagText = eval(`(${code.replace('diagText:function', 'function')})`);
  app.genProvider = 'baseten-direct';
  app.genModel = 'meta-models/muse-spark-open-1026';
  app._lastHttp = 200;
  app._lastRetry = 1;
  app._lastChatInfo = {
    chunks: 0, empty: 2, reason: 3, finish: 'length', err: '',
    usage: 'reasoning 198/200 tokens', usageReasoning: 198, usageCompletion: 200,
    reasonSample: 'Denke nach... Authorization: Bearer HACKME12345678 ' + 'y'.repeat(5000),
  };
  app._lastReq = { re: 'low', te: 0.2, fb: true };
  app._lastReqR = { re: null, te: 0.2, fb: true };
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
  for (const lang of ['de', 'en', 'es']) {
    app.lang = lang;
    const t = app.diagText();
    for (const bit of ['provider: baseten-direct', 'model: meta-models/muse-spark-open-1026', 'http: 200',
      'finish: length', 'usage_reasoning_tokens: 198', 'usage_completion_tokens: 200', 'retry: 1/1', 'build: v25',
      ...want[lang]]) {
      assert.ok(t.includes(bit), `${lang}: ${bit}`);
    }
    const rawLine = t.split('\n').find((l) => l.startsWith('raw_snippet_2k: '));
    assert.ok(rawLine && rawLine.length <= 'raw_snippet_2k: '.length + 2048, `${lang}: Rohantwort gedeckelt`);
    assert.ok(!t.includes('HACKME12345678'), `${lang}: kein Key im Clipboard-Text`);
    assert.ok(t.includes('[REDACTED]'), `${lang}: Redaktionsmarker`);
  }
  app._lastRetry = 0;
  app.lang = 'de';
  const noRetry = app.diagText();
  assert.ok(!noRetry.includes('req_retry_'), 'ohne Retry keine Retry-Echo-Zeilen');
  assert.ok(noRetry.includes('req_400_fallback: ja'), 'Erstversuch-Echo bleibt');
  assert.ok(!src.includes('},,'), 'kein Doppelkomma (Vue-Boot)');
});

test('v24-Diagnose: Copy-Button + Methoden + i18n de/en/es vorhanden', async () => {
  const src = await html();
  const count = (sub) => src.split(sub).length - 1;
  assert.equal(count('standalone-build v22'), 1, 'v22-Stempel (Historie)');
  assert.equal(count('standalone-build v23'), 1, 'v23-Stempel (Historie)');
  assert.equal(count('standalone-build v24'), 1, 'v24-Stempel (Historie)');
  assert.equal(count('standalone-build v25'), 1, 'v25-Stempel');
  assert.equal(count('diagText:function'), 1, 'diagText-Methode');
  assert.equal(count('copyDiag:function'), 1, 'copyDiag-Methode');
  assert.equal(count('copyDiagBtn'), 4, 'Button-Label: 3 Locales + Template');
  assert.equal(count('@click="copyDiag"'), 1, 'Button nur im Fehlerzustand (genStatusBad)');
  assert.equal(count('v-if="genStatusBad"'), 1, 'Button nur im Fehlerzustand');
  for (const [sub, n, label] of [
    ['copyDiagBtn:"Diagnose kopieren"', 1, 'de-Label'], ['copyDiagBtn:"Copy diagnostics"', 1, 'en-Label'],
    ['copyDiagBtn:"Copiar diagnóstico"', 1, 'es-Label'],
    ['diagCopied:"Diagnose kopiert (ohne Key)."', 1, 'de-Bestaetigung'],
    ['diagCopied:"Diagnostics copied (no key)."', 1, 'en-Bestaetigung'],
    ['diagCopied:"Diagnóstico copiado (sin clave)."', 1, 'es-Bestaetigung'],
  ]) assert.equal(count(sub), n, label);
});
