/**
 * SkillSpark Generierungs-Proxy (localhost only, keine neuen Dependencies).
 * Bindet NUR 127.0.0.1, liest den Server-Key zur Laufzeit aus Env/Key-Datei
 * (niemals ins Repo, nie an den Browser, nie in Logs), reicht Generierungs-
 * anfragen als SSE-Stream an https://api.meta.ai/v1 weiter (DONE-Terminator,
 * finish_reason-Check auf Empfaengerseite) und meldet Fehler als E-GEN-*.
 * Offene Bauweise: weitere Anbieter/Modelle per PROVIDERS-Registry ergaenzbar.
 *
 * Endpunkte:
 *   GET  /health    -> { ok, service, providers, defaultModel, time } (ohne Key)
 *   POST /generate  -> { prompt, provider?, model?, seed?, stream? }
 *                      + optional Authorization: Bearer <BYOK-Key>
 *                      Antwort: SSE-Stream (Upstream, 1:1) oder JSON {code,message}
 * Aufruf: node scripts/proxy.mjs [port]  (Default 8787)
 * Env: META_API_KEY | MODEL_API_KEY | MUSE_API_KEY | KEY_FILE (Default s.u.)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const PROXY_DEFAULT_PORT = 8787;
export const META_BASE = 'https://api.meta.ai/v1';
// Offizielle OpenRouter-Doku (Stand 27.10.2026): Basis https://openrouter.ai/api/v1,
// OpenAI-kompatibel (POST /chat/completions, Authorization Bearer). Modell-Slugs
// aus https://openrouter.ai/models verifiziert; Keys NUR laufzeitsseitig (BYOK).
export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
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
  // OpenRouter-Pfad: Slugs am 27.10.2026 per offizieller OpenRouter-Modellliste
  // (GET https://openrouter.ai/api/v1/models, 463 Eintraege, 16 :free) live
  // verifiziert. Vorgaenger-Slug openai/gpt-oss-20b:free existiert dort NICHT
  // mehr (nur noch kostenpflichtiges openai/gpt-oss-20b) -> ersetzt durch das
  // gratis google/gemma-4-26b-a4b-it:free (pricing 0/0, ctx 262144).
  // KEIN Spark auf diesem Pfad (Kosten-Disziplin: OpenRouter AUSSCHLIESSLICH
  // gratis). byokOnly: KEIN Server-Key-Fallback — der Meta-Server-Key darf NIE
  // an OpenRouter gehen; Keys nur laufzeitsseitig per BYOK-Header, nie in Code/Logs.
  openrouter: {
    base: OPENROUTER_BASE,
    chatPath: '/chat/completions',
    models: [
      'google/gemma-4-26b-a4b-it:free',
    ],
    defaultModel: 'google/gemma-4-26b-a4b-it:free',
    byokOnly: true,
  },
};

export const DEFAULT_PROVIDER = 'meta-muse';

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
 * @returns {{ ok: true, prompt: string, provider: string, model: string } | { ok: false, code: string, message: string }}
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
  const reg = PROVIDERS[provider];
  if (!reg) {
    return { ok: false, code: 'E-GEN-404', message: `E-GEN-404: Unbekannter Anbieter ${provider}` };
  }
  const model = typeof body.model === 'string' && body.model ? body.model : reg.defaultModel;
  if (!reg.models.includes(model)) {
    return { ok: false, code: 'E-GEN-404', message: `E-GEN-404: Modell ${model} beim Anbieter ${provider} nicht registriert` };
  }
  return { ok: true, prompt, provider, model };
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

/** Upstream-Body fuer /chat/completions (OpenAI-Form, SSE). */
export function upstreamChatBody(model, prompt) {
  return {
    model,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  };
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
        service: 'skillspark-proxy',
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
      // OpenRouter (byokOnly): Meta-Server-Key darf NIE an OpenRouter gehen.
      // Key AUSSCHLIESSLICH laufzeitsseitig per BYOK-Header (User-Eingabe).
      if (reg.byokOnly && !byokOk) {
        console.log(`POST /generate -> 500 E-GEN-CONFIG (provider=${parsed.provider}, kein BYOK-Key)`);
        sendJson(res, 500, 'E-GEN-CONFIG', 'E-GEN-CONFIG: OpenRouter-Key als BYOK-Header eintragen (nur Sitzung, nie Logs/Dateien)');
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
      try {
        // OpenRouter-Attribution (offizielle Doku, optional, kein Key-Material).
        const extraHeaders = parsed.provider === 'openrouter'
          ? { 'HTTP-Referer': 'http://127.0.0.1/', 'X-Title': 'SkillSpark Lab-Player' }
          : {};
        upstream = await fetch(reg.base + reg.chatPath, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + key,
            accept: 'text/event-stream',
            ...extraHeaders,
          },
          body: JSON.stringify(upstreamChatBody(parsed.model, parsed.prompt)),
        });
      } catch (e) {
        console.log(`POST /generate -> 502 E-GEN-5XX (upstream-netz, key=${keySource})`);
        sendJson(res, 502, 'E-GEN-5XX', 'E-GEN-5XX: Upstream nicht erreichbar');
        return;
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
    console.log(`skillspark-proxy: http://127.0.0.1:${port}/ (nur localhost, upstream ${META_BASE})`);
  });
}
