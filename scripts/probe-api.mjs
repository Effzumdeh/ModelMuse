/**
 * Probe: ermittelt Endpoint- und SSE-Form der Muse-API. Gibt niemals den Key aus.
 * Aufruf: node scripts/probe-api.mjs
 */
import { readFileSync } from 'node:fs';

const KEY_FILE = 'C:/Users/flori/OneDrive/Key_muse.md';
const key = readFileSync(KEY_FILE, 'utf8').trim().replace(/^["'`]|["'`]$/g, '');
if (!/^LLM_[0-9]{8,}_[A-Za-z0-9_-]{16,}$/.test(key)) {
  console.error('KEY-FORMAT UNERWARTET (len=' + key.length + ')');
  process.exit(2);
}
console.log('key-format: LLM_ID_Secret ok, len=' + key.length);

const BASE = 'https://api.meta.ai/v1';

async function probe(path, body, label) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
        accept: body.stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log(`[${label}] NETWORK-FEHLER: ${e.message}`);
    return;
  }
  console.log(`[${label}] ${path} -> HTTP ${res.status} in ${Date.now() - t0}ms ct=${res.headers.get('content-type')}`);
  const text = await res.text();
  const lines = text.split('\n').filter(Boolean);
  console.log(`[${label}] body-len=${text.length} lines=${lines.length}`);
  for (const line of lines.slice(0, 8)) console.log(`[${label}]   ${line.slice(0, 220)}`);
  if (lines.length > 8) console.log(`[${label}]   ... last: ${lines[lines.length - 1].slice(0, 220)}`);
}

await probe('/chat/completions', {
  model: 'muse-spark-1.3',
  stream: true,
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
}, 'chat');

await probe('/responses', {
  model: 'muse-spark-1.3',
  stream: true,
  max_output_tokens: 16,
  input: 'Antworte nur mit: OK',
}, 'responses');

await probe('/chat/completions', {
  model: 'muse-spark-1.3',
  stream: false,
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
}, 'chat-nostream');

// Modell-Liste, falls vorhanden
try {
  const r = await fetch(BASE + '/models', { headers: { authorization: 'Bearer ' + key } });
  console.log('[models] HTTP ' + r.status);
  const t = await r.text();
  console.log('[models] ' + t.slice(0, 400));
} catch (e) {
  console.log('[models] FEHLER ' + e.message);
}
