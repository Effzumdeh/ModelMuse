/**
 * ModelMuse Generierungs-Proxy (localhost only, keine neuen Dependencies).
 * Bindet NUR 127.0.0.1, liest den Server-Key zur Laufzeit aus Env/Key-Datei
 * (niemals ins Repo, nie an den Browser, nie in Logs), reicht Generierungs-
 * anfragen als SSE-Stream weiter (DONE-Terminator, finish_reason-Check auf
 * Empfaengerseite) und meldet Fehler als E-GEN-*.
 * Upstream-Standard (28.10.2026): Baseten Model APIs (OpenAI-kompatibel,
 * POST /v1/chat/completions, Bearer $BASETEN_API_KEY, Doku siehe
 * https://docs.baseten.co/inference/model-apis/overview) plus Meta Model API
 * (muse-cli-Pfad). Offene Bauweise: weitere Anbieter/Modelle per
 * PROVIDERS-Registry ergaenzbar.
 *
 * Endpunkte:
 *   GET  /health    -> { ok, service, providers, defaultModel, time } (ohne Key)
 *   POST /generate  -> { prompt, provider?, model?, seed?, stream? }
 *                      + optional Authorization: Bearer ***
 *                      Antwort: SSE-Stream (Upstream, 1:1) oder JSON {code,message}
 * Aufruf: node scripts/proxy.mjs [port]  (Default 8787)
 * Env: META_API_KEY | MODEL_API_KEY | MUSE_API_KEY | KEY_FILE (Default s.u.)
 *   Baseten-Key AUSSCHLIESSLICH laufzeitsseitig per BYOK-Header (User-Eingabe
 *   im Browser, nur Sitzung/sessionStorage mit Zustimmung) — nie Server-Key-
 *   Fallback fuer Baseten, nie in Code/Logs/Dateien.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const PROXY_DEFAULT_PORT = 8787;
export const META_BASE = 'https://api.meta.ai/v1';
// Baseten Model APIs (Stand 28.10.2026, Doku: https://docs.baseten.co/inference/model-apis/overview
// + https://docs.baseten.co/reference/inference-api/chat-completions):
// Basis https://inference.baseten.co/v1, OpenAI-kompatibel
// (POST /chat/completions, Authorization Bearer $BASETEN_API_KEY, SSE moeglich).
// Modell meta-models/muse-spark-open-1026 (Meta-Regel: Laufzeit nur Meta-Modelle).
// Keys NUR laufzeitsseitig per BYOK-Header (User-Eingabe, nur Sitzung), nie in Code/Logs/Dateien.
// INAKTIV seit 28.10.2026: OpenRouter-Pfad (zuvor https://openrouter.ai/api/v1,
// Modell google/gemma-4-26b-a4b-it:free) — entfernt, siehe docs/BASETEN-MIGRATION.md.
// Der Providername 'openrouter' wird in parseGenerateBody mit E-GEN-404 + Migrationshinweis
// abgewiesen (kein Upstream-Call).
export const BASETEN_BASE = 'https://inference.baseten.co/v1';
const KEY_FILE_DEFAULT = 'C:/Users/flori/OneDrive/Key_muse.md';

/**
 * Offene Anbieter-Registry: je Anbieter Basis-URL + Pfad-Bauer.
 * Neue Anbieter: Eintrag ergaenzen (base, chatPath, models), kein Umbau noetig.
 */
export const PROVIDERS = {
  'meta-muse': {
    base: META_BASE,
    chatPath: '/chat/completions',
    models: ['muse-spark-1.3-contributor', 'muse-spark-1.3', 'muse-wonder-1.0'],
    defaultModel: 'muse-spark-1.3-contributor',
  },
  // Baseten-Pfad (Standard seit 28.10.2026, Meta-Modell via Baseten Model APIs,
  // Doku: https://docs.baseten.co/inference/model-apis/overview).
  // byokOnly: KEIN Server-Key-Fallback — der Meta-Server-Key darf NIE an
  // Baseten gehen; Keys nur laufzeitsseitig per BYOK-Header, nie in Code/Logs.
  baseten: {
    base: BASETEN_BASE,
    chatPath: '/chat/completions',
    models: [
      'meta-models/muse-spark-open-1026',
    ],
    defaultModel: 'meta-models/muse-spark-open-1026',
    byokOnly: true,
  },
};

export const DEFAULT_PROVIDER = 'meta-muse';

/**
 * Upstream-Budget (Befund 30.10.2026: Reasoning frisst das Default-Budget —
 * HTTP 200, finish=length, kein Content; Eigentuemer-Vorgabe 31.10.2026:
 * deutlich hoeher, Contributor guenstig). 65536 initial / 131072 Retry
 * (1M-Kontext Muse Spark Open, dev.meta.ai/docs/muse-spark-open/deploy);
 * Temperatur 0.2 = deterministische Code-Gen (wie Standalone v17+).
 * Client darf pro Call mehr anfordern (Budget-Retry), Clamp 1000..131072
 * schuetzt vor 400/caps.
 */
export const UPSTREAM_MAX_COMPLETION_TOKENS = 65536;
export const UPSTREAM_TEMPERATURE = 0.2;

/**
 * Budget normalisieren (robust: ungueltig -> Default, nie Request-Abweisung).
 * @param {unknown} value
 */
export function normalizeMaxTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return UPSTREAM_MAX_COMPLETION_TOKENS;
  return Math.min(Math.max(Math.round(n), 1000), 131072);
}

/** HTTP-Status -> E-GEN-Code (vgl. src/runtime/livegen.js classify). */
export function mapStatusToCode(status) {
  if (status === 400) return 'E-GEN-400';
  if (status === 401) return 'E-GEN-401';
  if (status === 402) return 'E-GEN-402';
  if (status === 403) return 'E-GEN-403';
  if (status === 404) return 'E-GEN-404';
  if (status === 413) return 'E-GEN-413';
  if (status === 429) return 'E-GEN-429';
  if (status === 504) return 'E-GEN-504';
  if (status >= 500) return 'E-GEN-5XX';
  return 'E-GEN-5XX';
}

/**
 * Body-Pruefung (rein, ohne Key/Netz).
 * @returns {{ ok: true, prompt: string, provider: string, model: string, maxTokens: number } | { ok: false, code: string, message: string }}
 */
export function parseGenerateBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'E-GEN-400', message: 'E-GEN-400: Leerer Request-Body' };
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (prompt.length < 16) {
    return { ok: false, code: 'E-GEN-400', message: 'E-GEN-400: Prompt zu kurz (min. 16 Zeichen)' };
  }
  if (prompt.length > 60000) {
    return { ok: false, code: 'E-GEN-413', message: 'E-GEN-413: Prompt zu gross (max. 60000 Zeichen)' };
  }
  const provider = typeof body.provider === 'string' && body.provider ? body.provider : DEFAULT_PROVIDER;
  // INAKTIV seit 28.10.2026: OpenRouter-Pfad entfernt (siehe docs/BASETEN-MIGRATION.md).
  // Ehrliche Abweisung mit Migrationshinweis, kein Upstream-Call.
  if (provider === 'openrouter') {
    return { ok: false, code: 'E-GEN-404', message: 'E-GEN-404: Anbieter openrouter ist inaktiv (seit 28.10.2026) — nutze provider baseten, Modell meta-models/muse-spark-open-1026 (Key laufzeitsseitig per BYOK)' };
  }
  const reg = PROVIDERS[provider];
  if (!reg) {
    return { ok: false, code: 'E-GEN-404', message: `E-GEN-404: Unbekannter Anbieter ${provider}` };
  }
  const model = typeof body.model === 'string' && body.model ? body.model : reg.defaultModel;
  if (!reg.models.includes(model)) {
    return { ok: false, code: 'E-GEN-404', message: `E-GEN-404: Modell ${model} beim Anbieter ${provider} nicht registriert` };
  }
  const maxTokens = normalizeMaxTokens(body.max_completion_tokens ?? body.maxTokens);
  return { ok: true, prompt, provider, model, maxTokens };
}

/** Key-Shape pruefen (Laenge/Whitespace), Wert nie loggen. */
export function keyShapeOk(key) {
  return typeof key === 'string' && key.length >= 8 && !/\s/.test(key);
}

/** Server-Key zur Laufzeit: Env zuerst, dann Key-Datei (Rohinhalt getrimmt). */
export async function loadServerKey() {
  const env =
    process.env.META_API_KEY ?? process.env.MODEL_API_KEY ?? process.env.MUSE_API_KEY ?? '';
  if (keyShapeOk(env.trim())) return env.trim();
  const file = process.env.KEY_FILE ?? KEY_FILE_DEFAULT;
  if (!existsSync(file)) return null;
  try {
    const raw = (await readFile(file, 'utf8')).trim().replace(/^["'`]|["'`]$/g, '');
    return keyShapeOk(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Upstream-Body fuer /chat/completions (OpenAI-Form, SSE, Budget+Temperatur).
 * v21-Extras NUR fuer Baseten (provider-Param): max_tokens spiegelt
 * max_completion_tokens, reasoning_effort 'none' fordert direkte Antwort,
 * stream_options.include_usage liefert Usage im Stream. Meta-Pfad (und
 * unbekannte Provider) unveraendert — keine unverifizierten Params. */
export function upstreamChatBody(model, prompt, maxTokens = UPSTREAM_MAX_COMPLETION_TOKENS, provider = undefined) {
  const body = {
    model,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
    temperature: UPSTREAM_TEMPERATURE,
    max_completion_tokens: normalizeMaxTokens(maxTokens),
  };
  if (provider === 'baseten') {
    body.max_tokens = normalizeMaxTokens(maxTokens);
    body.reasoning_effort = 'none';
    body.stream_options = { include_usage: true };
  }
  return body;
}

/** v21-Extras aus einem Upstream-Body streichen (exakt v20-Form). @param {any} body */
export function stripUpstreamExtras(body) {
  if (!body || typeof body !== 'object') return false;
  let stripped = false;
  if ('max_tokens' in body) { delete body.max_tokens; stripped = true; }
  if (body.reasoning_effort === 'none') { delete body.reasoning_effort; stripped = true; }
  if ('stream_options' in body) { delete body.stream_options; stripped = true; }
  return stripped;
}

function sendJson(res, status, code, message) {
  const payload = JSON.stringify({ code, message });
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(payload);
}

function readBody(req, limit = 131072) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('E-GEN-413: Body zu gross'), { code: 'E-GEN-413' }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('E-GEN-400: Kein JSON-Body'), { code: 'E-GEN-400' }));
      }
    });
    req.on('error', reject);
  });
}

export function createProxyServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      });
      res.end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      const payload = JSON.stringify({
        ok: true,
        service: 'modelmuse-proxy',
        providers: Object.keys(PROVIDERS),
        defaultModel: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
        time: new Date().toISOString(),
      });
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      });
      res.end(payload);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/generate') {
      let body;
      try {
        body = await readBody(req);
      } catch (e) {
        const code = (e && e.code) || 'E-GEN-400';
        console.log(`POST /generate -> 400 ${code} (body unlesbar)`);
        sendJson(res, 400, code, String((e && e.message) || e).slice(0, 160));
        return;
      }
      const parsed = parseGenerateBody(body);
      if (!parsed.ok) {
        const status = parsed.code === 'E-GEN-404' ? 404 : parsed.code === 'E-GEN-413' ? 413 : 400;
        console.log(`POST /generate -> ${status} ${parsed.code} (validierung, promptBytes=${(body.prompt ?? '').length})`);
        sendJson(res, status, parsed.code, parsed.message);
        return;
      }
      const byok = (req.headers.authorization ?? '').startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : '';
      const reg = PROVIDERS[parsed.provider];
      const byokOk = keyShapeOk(byok);
      // Baseten (byokOnly): Meta-Server-Key darf NIE an Baseten gehen.
      // Key AUSSCHLIESSLICH laufzeitsseitig per BYOK-Header (User-Eingabe, nur Sitzung).
      if (reg.byokOnly && !byokOk) {
        console.log(`POST /generate -> 500 E-GEN-CONFIG (provider=${parsed.provider}, kein BYOK-Key)`);
        sendJson(res, 500, 'E-GEN-CONFIG', 'E-GEN-CONFIG: Baseten-Key als BYOK-Header eintragen (nur Sitzung, nie Logs/Dateien)');
        return;
      }
      const key = byokOk ? byok : await loadServerKey();
      if (!keyShapeOk(key)) {
        console.log('POST /generate -> 500 E-GEN-CONFIG (kein Key: weder BYOK noch Server-Key)');
        sendJson(res, 500, 'E-GEN-CONFIG', 'E-GEN-CONFIG: Kein API-Key (BYOK-Header oder Server-Key fehlt)');
        return;
      }
      const keySource = byokOk ? 'byok' : 'server';
      let upstream;
      const upHeaders = {
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
        accept: 'text/event-stream',
      };
      const upBody = upstreamChatBody(parsed.model, parsed.prompt, parsed.maxTokens, parsed.provider);
      try {
        // Baseten Model APIs: OpenAI-kompatibel, nur Bearer-Key (keine Zusatz-Header).
        upstream = await fetch(reg.base + reg.chatPath, {
          method: 'POST',
          headers: upHeaders,
          body: JSON.stringify(upBody),
        });
      } catch (e) {
        console.log(`POST /generate -> 502 E-GEN-5XX (upstream-netz, key=${keySource})`);
        sendJson(res, 502, 'E-GEN-5XX', 'E-GEN-5XX: Upstream nicht erreichbar');
        return;
      }
      if (!upstream.ok && upstream.status === 400 && stripUpstreamExtras(upBody)) {
        // v21: Gateway lehnt unverifizierte Extras ab -> exakt v20-Body erneut.
        try {
          await upstream.body?.cancel();
        } catch {
          /* ignorieren */
        }
        try {
          upstream = await fetch(reg.base + reg.chatPath, {
            method: 'POST',
            headers: upHeaders,
            body: JSON.stringify(upBody),
          });
        } catch (e) {
          console.log(`POST /generate -> 502 E-GEN-5XX (upstream-netz slim, key=${keySource})`);
          sendJson(res, 502, 'E-GEN-5XX', 'E-GEN-5XX: Upstream nicht erreichbar');
          return;
        }
      }
      if (!upstream.ok || !upstream.body) {
        const code = mapStatusToCode(upstream.status);
        let hint = '';
        try {
          hint = (await upstream.text()).slice(0, 160);
        } catch {
          hint = '';
        }
        console.log(`POST /generate -> ${upstream.status} ${code} (upstream, modell=${parsed.model}, key=${keySource})`);
        try {
          await upstream.body?.cancel();
        } catch {
          /* ignorieren */
        }
        sendJson(res, upstream.status, code, `${code}: Upstream HTTP ${upstream.status}${hint ? ` (${hint.slice(0, 80)})` : ''}`);
        return;
      }
      console.log(`POST /generate -> 200 stream (modell=${parsed.model}, key=${keySource}, promptBytes=${parsed.prompt.length})`);
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      });
      try {
        const reader = upstream.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch {
        /* Client weg oder Stream-Abbruch: nur loggen, kein Key-Kontakt */
      }
      res.end();
      return;
    }
    sendJson(res, 404, 'E-GEN-404', 'E-GEN-404: Unbekannter Pfad (nur /health, /generate)');
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const port = Number(process.argv[2] ?? PROXY_DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error(`proxy: ungueltiger Port ${process.argv[2]}`);
    process.exit(2);
  }
  const server = createProxyServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`modelmuse-proxy: http://127.0.0.1:${port}/ (nur localhost, upstream Meta ${META_BASE} + Baseten ${BASETEN_BASE})`);
  });
}
