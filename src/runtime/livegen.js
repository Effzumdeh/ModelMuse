/**
 * Freimodus-Generierung NUR ueber den serverseitigen Proxy, niemals api.meta.ai direkt.
 * Ohne Proxy-Konfiguration: sofort E-GEN-OFFLINE, UI schaltet auf Bibliothek.
 * Bauplan Abschnitt 4 (generateLive) und Abschnitt 9 (E-GEN-*).
 */
import { repairThreeImports } from './guard-static.js';

/** @typedef {{ source: string, meta: { title: string, category: string, detailLevel: number, parts: string[], units: string }, raw: string }} GeneratedModule */

let proxyUrl = null;
let timeoutMs = 300000; // E2E-Befund 2026-10-27: Upstream-SSE-Streams brauchen > 90 s (CLI-Historie bis 537 s)
/** Eigener Muse-API-Key der Lehrkraft: nur im Speicher, nie persistiert ohne
 * Zustimmung (Session-Storage nur per Checkbox in der UI), nie in Logs. */
let liveApiKey = null;

/**
 * @param {{ proxyUrl?: string, timeoutMs?: number }} cfg
 */
export function configureLiveGen(cfg = {}) {
  if (cfg.proxyUrl !== undefined) proxyUrl = cfg.proxyUrl || null;
  if (cfg.timeoutMs !== undefined) timeoutMs = cfg.timeoutMs;
  if (proxyUrl !== null && typeof proxyUrl !== 'string') {
    proxyUrl = null;
    throw Object.assign(new Error('E-GEN-CONFIG: proxyUrl fehlt'), { code: 'E-GEN-CONFIG' });
  }
}

/** Hinterlegt den eigenen Key nur im Speicher (kein Log, keine Datei). */
export function setLiveApiKey(key) {
  if (typeof key !== 'string' || key.length < 8 || /\s/.test(key)) {
    throw Object.assign(new Error('E-GEN-CONFIG: Key-Format ungueltig'), { code: 'E-GEN-CONFIG' });
  }
  liveApiKey = key;
}

export function clearLiveApiKey() {
  liveApiKey = null;
}

export function hasLiveApiKey() {
  return liveApiKey !== null;
}

export function liveGenStatus() {
  return { configured: proxyUrl !== null, proxyUrl: proxyUrl ? '(gesetzt)' : null, timeoutMs, hasKey: liveApiKey !== null };
}

/**
 * SSE-Stream lesen: data-Prefix, DONE-Terminator, finish_reason pruefen.
 * @param {Response} res
 */
async function readSseModule(res, onToken) {
  const reader = res.body?.getReader();
  if (!reader) throw Object.assign(new Error('E-GEN-PARSE: kein Stream'), { code: 'E-GEN-PARSE' });
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let finishReason = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        const delta =
          evt.choices?.[0]?.delta?.content ?? evt.choices?.[0]?.message?.content ?? evt.output_text ?? '';
        if (typeof delta === 'string') {
          full += delta;
          if (onToken) onToken(delta);
        }
        const fr = evt.choices?.[0]?.finish_reason ?? evt.finish_reason ?? null;
        if (fr) finishReason = fr;
      } catch {
        full += payload;
      }
    }
  }
  return { full, finishReason };
}

/** @param {number} status */
function classify(status) {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Modulcode aus Modell-Rohtext extrahieren (CLI- UND Browser-Pfad teilen sich
 * diese Funktion; scripts/_extract-model.mjs nutzt sie ebenfalls).
 * Schritte (bewaehrt an 10 kuratierten Modellen): Fences normalisieren und den
 * laengsten Block mit `export const meta` waehlen, ab erster Zeile mit
 * `import `/`export ` schneiden (Imports stehen VOR meta und duerfen NICHT
 * verloren gehen — sonst E-S2-BOOT "X is not defined"), Nachlauf-Prosa nach
 * der letzten `}`/`;`-Zeile kappen (nur wenn `export function init` enthalten).
 * @param {string} rawText
 */
export function extractModuleSource(rawText) {
  let raw = String(rawText ?? '');
  raw = raw.replace(/```(?:js|javascript)?\s*/gi, '```');
  const fenceParts = raw.split('```').filter((p) => p.includes('export const meta'));
  if (fenceParts.length > 0) raw = fenceParts.sort((a, b) => b.length - a.length)[0];
  const mStart = /^\s*(import |export )/m.exec(raw);
  if (!mStart) return '';
  let source = raw.slice(mStart.index).trim();
  const lines = source.split('\n');
  let end = lines.length;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^}?\s*;?\s*$/.test(lines[i]) || /}\s*$/.test(lines[i])) {
      if (lines.slice(0, i + 1).join('\n').includes('export function init')) {
        end = i + 1;
        break;
      }
    }
  }
  source = lines.slice(0, end).join('\n').trim();
  return source;
}

/**
 * @param {string} promptText vollstaendiger P1-Prompt inkl. Thema
 * @param {{ seed?: number, onToken?: (t: string) => void, provider?: string, model?: string }} [opts]
 * provider/model: Optional — Proxy-Defaults (meta-muse/muse-spark-1.3-contributor)
 * greifen, wenn leer. OpenRouter-Pfad nur mit User-BYOK-Key (nie Server-Key).
 * @returns {Promise<GeneratedModule>}
 */
export async function generateLive(promptText, opts = {}) {
  if (!proxyUrl) {
    throw Object.assign(new Error('E-GEN-OFFLINE: kein Proxy konfiguriert'), { code: 'E-GEN-OFFLINE' });
  }
  if (typeof promptText !== 'string' || promptText.length < 16) {
    throw Object.assign(new Error('E-GEN-400: Prompt zu kurz'), { code: 'E-GEN-400' });
  }
  const provider = typeof opts.provider === 'string' && opts.provider ? opts.provider : undefined;
  const model = typeof opts.model === 'string' && opts.model ? opts.model : undefined;
  let lastCode = 'E-GEN-5XX';
  let lastError = null;
  let sawHttp = false;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const attemptStart = Date.now();
    try {
      const headers = { 'content-type': 'application/json', accept: 'text/event-stream' };
      if (liveApiKey) headers.authorization = 'Bearer ' + liveApiKey;
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: promptText, provider, model, seed: opts.seed ?? null, stream: true }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        sawHttp = true;
        lastCode = classify(res.status);
        lastError = new Error(`${lastCode}: HTTP ${res.status}`);
        if (lastCode === 'E-GEN-429') await sleep(500 * 2 ** attempt + Math.random() * 1000);
        else if (lastCode === 'E-GEN-5XX' || lastCode === 'E-GEN-504') {
          await sleep(500 * 2 ** attempt + Math.random() * 1000);
        } else {
          throw Object.assign(lastError, { code: lastCode });
        }
        continue;
      }
      const { full, finishReason } = await readSseModule(res, opts.onToken);
      sawHttp = true;
      // E-S2-BOOT-Repair: fehlende benannte Imports (z.B. Scene) ergaenzen,
      // bevor Quelle gespeichert/gebootet wird (E2E-Befund 2026-10-27).
      const source = repairThreeImports(extractModuleSource(full));
      if (!source.includes('export const meta') || !source.includes('export function init')) {
        throw Object.assign(new Error('E-GEN-PARSE: kein Modul extrahierbar'), { code: 'E-GEN-PARSE' });
      }
      if (finishReason && finishReason !== 'stop') {
        throw Object.assign(new Error(`E-GEN-PARSE: finish_reason=${finishReason}`), { code: 'E-GEN-PARSE' });
      }
      return { source, meta: { title: '', category: '', detailLevel: 1, parts: [], units: 'm' }, raw: full };
    } catch (e) {
      clearTimeout(timer);
      if (e && (e.code === 'E-GEN-PARSE' || e.code === 'E-GEN-400' || e.code === 'E-GEN-401' || e.code === 'E-GEN-402' || e.code === 'E-GEN-403' || e.code === 'E-GEN-404' || e.code === 'E-GEN-413')) {
        throw e;
      }
      // Proxy laeuft nicht (Verbindung verweigert, kein HTTP gesehen, kein Timeout):
      // ehrlich OFFLINE melden statt 5XX — Bibliothek bleibt nutzbar.
      if (!sawHttp && Date.now() - attemptStart < timeoutMs) {
        const msg = String((e && e.message) || e);
        if (/fetch failed|failed to fetch|ECONNREFUSED|connection refused|ENOTFOUND|ERR_CONNECTION/i.test(msg) || e?.cause?.code === 'ECONNREFUSED') {
          throw Object.assign(new Error('E-GEN-OFFLINE: kein Generierungs-Proxy erreichbar'), { code: 'E-GEN-OFFLINE' });
        }
      }
      lastCode = (e && e.code) || 'E-GEN-5XX';
      lastError = e;
      if (attempt < 3) await sleep(500 * 2 ** attempt + Math.random() * 1000);
    }
  }
  throw Object.assign(lastError ?? new Error(`${lastCode}: Transportversuche erschoepft`), { code: lastCode });
}
