/**
 * Freimodus-Generierung: Direkt-Call zuerst (Browser -> Upstream, BYOK),
 * lokaler Proxy nur als Fallback (CORS/Netz). Niemals api.meta.ai-Key im
 * Code — Keys nur laufzeitsseitig (Speicher/sessionStorage mit Zustimmung).
 * Bauplan Abschnitt 4 (generateLive) und Abschnitt 9 (E-GEN-*).
 */
import { repairThreeImports, TWOD_KINDS } from './guard-static.js';

/** P0-Router: 2D-Darstellungstypen (Whitelist, vgl. prompts/p0-router.txt). */
export const ROUTER_2D_TYPES = Object.freeze(['schaltplan', 'flussdiagramm', 'schnitt-ansicht', 'diagramm', 'tabelle']);
/** P0-Router: 3D-Kurztypen (freie Konvention, Beispiele aus dem Few-shot). */
export const ROUTER_3D_TYPES = Object.freeze(['baugruppe', 'volumen', 'montage', 'innenleben']);
/** P0: Fachtext-Kappung (Router-Konzept §2: max. ~4000 Zeichen). */
export const ROUTER_FACHTEXT_MAX = 4000;

/** @typedef {{ source: string, meta: { title: string, category: string, detailLevel: number, parts: string[], units: string }, raw: string }} GeneratedModule */

let proxyUrl = null;
let timeoutMs = 300000; // E2E-Befund 2026-10-27: Upstream-SSE-Streams brauchen > 90 s (CLI-Historie bis 537 s)
/** Eigener Muse-API-Key der Lehrkraft: nur im Speicher, nie persistiert ohne
 * Zustimmung (Session-Storage nur per Checkbox in der UI), nie in Logs. */
let liveApiKey = null;
/** Direkt-Call zuerst (Browser -> Upstream, BYOK); false = nur Proxy. */
let directFirst = true;

/**
 * Direkt-Endpunkte (OpenAI-kompatibel, POST /chat/completions, SSE).
 * Browser-faehig mit User-Key (BYOK); CORS-Fehler -> Proxy-Fallback.
 * @type {Record<string, string>}
 */
export const DIRECT_BASES = Object.freeze({
  'meta-muse': 'https://api.meta.ai/v1',
  baseten: 'https://inference.baseten.co/v1',
});

/** Upstream-Default-Modelle je Anbieter (stimmen mit scripts/proxy.mjs ueberein). */
export const DIRECT_DEFAULT_MODEL = Object.freeze({
  'meta-muse': 'muse-spark-1.3-contributor',
  baseten: 'meta-models/muse-spark-open-1026',
});

/** @param {string} provider */
export function directChatUrl(provider) {
  const base = DIRECT_BASES[provider];
  return typeof base === 'string' ? `${base}/chat/completions` : null;
}

/**
 * @param {{ proxyUrl?: string, timeoutMs?: number, direct?: boolean }} cfg
 */
export function configureLiveGen(cfg = {}) {
  if (cfg.proxyUrl !== undefined) proxyUrl = cfg.proxyUrl || null;
  if (cfg.timeoutMs !== undefined) timeoutMs = cfg.timeoutMs;
  if (cfg.direct !== undefined) directFirst = cfg.direct !== false;
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
  return { configured: proxyUrl !== null || (directFirst && liveApiKey !== null), proxyUrl: proxyUrl ? '(gesetzt)' : null, timeoutMs, hasKey: liveApiKey !== null, direct: directFirst };
}

/** Transport-Fehler (Netz/CORS/Abort, keine HTTP-Antwort) vs. definitive E-GEN-Antwort.
 * E-GEN-DIREKT ist das Fallback-Signal (Direktversuch gescheitert -> Proxy). */
function isTransportFailure(e) {
  if (!e) return false;
  if (e.code === 'E-GEN-DIREKT') return true;
  if (e.code && String(e.code).startsWith('E-GEN-')) return false;
  const msg = String((e && e.message) || e);
  return /fetch failed|failed to fetch|ECONNREFUSED|connection refused|ENOTFOUND|ERR_CONNECTION|TypeError|abort|AbortError/i.test(msg)
    || e?.name === 'AbortError' || e?.cause?.code === 'ECONNREFUSED' || e instanceof TypeError;
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
 * Modul aus SSE-Volltext bauen (Direkt- und Proxy-Pfad teilen sich das).
 * @param {string} full
 * @param {string | null} finishReason
 * @param {'direct' | 'proxy'} via
 */
function finishModule(full, finishReason, via) {
  // E-S2-BOOT-Repair: fehlende benannte Imports (z.B. Scene) ergaenzen,
  // bevor Quelle gespeichert/gebootet wird (E2E-Befund 2026-10-27).
  const source = repairThreeImports(extractModuleSource(full));
  if (!source.includes('export const meta') || !source.includes('export function init')) {
    throw Object.assign(new Error('E-GEN-PARSE: kein Modul extrahierbar'), { code: 'E-GEN-PARSE' });
  }
  if (finishReason && finishReason !== 'stop') {
    throw Object.assign(new Error(`E-GEN-PARSE: finish_reason=${finishReason}`), { code: 'E-GEN-PARSE' });
  }
  return { source, meta: { title: '', category: '', detailLevel: 1, parts: [], units: 'm' }, raw: full, via };
}

/**
 * Direkt-Call: Browser -> Upstream (OpenAI-kompatibel, SSE), Key per BYOK.
 * Ein Versuch, keine Wiederholung: definitive HTTP-Fehler werfen E-GEN-*,
 * Transport-Fehler (Netz/CORS/Timeout) werfen E-GEN-DIREKT (Fallback-Signal).
 */
async function generateDirect(url, model, promptText, opts, key) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, accept: 'text/event-stream' },
      body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: promptText }] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const code = classify(res.status);
      throw Object.assign(new Error(`${code}: HTTP ${res.status}`), { code });
    }
    const { full, finishReason } = await readSseModule(res, opts.onToken);
    return finishModule(full, finishReason, 'direct');
  } catch (e) {
    clearTimeout(timer);
    if (e && typeof e.code === 'string' && e.code.startsWith('E-GEN-')) throw e;
    throw Object.assign(new Error('E-GEN-DIREKT: Direkt-Call nicht moeglich (Netz/CORS/Timeout)'), { code: 'E-GEN-DIREKT' });
  }
}

/**
 * @param {string} promptText vollstaendiger P1-Prompt inkl. Thema
 * @param {{ seed?: number, onToken?: (t: string) => void, provider?: string, model?: string }} [opts]
 * provider/model: Optional — Defaults (meta-muse/muse-spark-1.3-contributor).
 * Ablauf: Direkt-Call zuerst (BYOK-Key im Browser), Proxy nur als Fallback
 * bei Transport-Fehler; ohne Key nur Proxy (Server-Key), sonst E-GEN-OFFLINE.
 * @returns {Promise<GeneratedModule & { via: 'direct' | 'proxy' }>}
 */
export async function generateLive(promptText, opts = {}) {
  if (typeof promptText !== 'string' || promptText.length < 16) {
    throw Object.assign(new Error('E-GEN-400: Prompt zu kurz'), { code: 'E-GEN-400' });
  }
  const provider = typeof opts.provider === 'string' && opts.provider ? opts.provider : 'meta-muse';
  const model = typeof opts.model === 'string' && opts.model
    ? opts.model
    : (DIRECT_DEFAULT_MODEL[provider] ?? undefined);
  const key = liveApiKey;
  const directUrl = directFirst && key && model ? directChatUrl(provider) : null;
  if (directUrl) {
    try {
      return await generateDirect(directUrl, model, promptText, opts, key);
    } catch (e) {
      // Definitive Antwort (Key/Modell/Parse) sofort melden; nur bei
      // Transport-Fehler UND konfiguriertem Proxy als Fallback weiter.
      if (!isTransportFailure(e) || !proxyUrl) throw e;
    }
  }
  if (!proxyUrl) {
    throw Object.assign(new Error('E-GEN-OFFLINE: kein Generierungs-Proxy konfiguriert'), { code: 'E-GEN-OFFLINE' });
  }
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
      return finishModule(full, finishReason, 'proxy');
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

/** P0-Router: 2D-Modell-Kinds je Router-Typ (Vendor-Kinds aus TWOD_KINDS). */
export const ROUTER_TYP_TO_KIND = Object.freeze({
  'schaltplan': 'chain',
  'flussdiagramm': 'bpmn',
  'schnitt-ansicht': 'generic',
  'diagramm': 'bars',
  'tabelle': 'generic',
});
void TWOD_KINDS;

/**
 * Kappt den Fachtext fuer den P0-Call (Router-Konzept §2: max. 4000 Zeichen).
 * @param {string} fachtext
 */
export function truncateFachtext(fachtext) {
  return String(fachtext ?? '').slice(0, ROUTER_FACHTEXT_MAX);
}

/**
 * Parst eine P0-Router-Antwort (längster {...}-Block, JSON, Schema-Check).
 * Fail-closed: jede Abweichung -> { mode: '3d', fallback: true }.
 * @param {string} rawText
 * @returns {{ mode: '3d' | '2d', typ: string, begruendung: string, fallback: boolean }}
 */
export function parseRouterDecision(rawText) {
  const fallback = (typ = 'baugruppe') => ({ mode: '3d', typ, begruendung: 'Parser-Fallback (Fail-closed 3D)', fallback: true });
  try {
    const raw = String(rawText ?? '');
    const blocks = [];
    let depth = 0;
    let start = -1;
    let inStr = null;
    for (let i = 0; i < raw.length; i += 1) {
      const c = raw[i];
      if (inStr) {
        if (c === '\\') {
          i += 1;
          continue;
        }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'") inStr = c;
      else if (c === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (c === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          blocks.push(raw.slice(start, i + 1));
          start = -1;
        }
        if (depth < 0) depth = 0;
      }
    }
    if (blocks.length === 0) return fallback();
    const longest = blocks.sort((a, b) => b.length - a.length)[0];
    const obj = JSON.parse(longest);
    if (!obj || typeof obj !== 'object') return fallback();
    const { mode, typ, begruendung } = /** @type {{ mode?: unknown, typ?: unknown, begruendung?: unknown }} */ (obj);
    if (mode !== '3d' && mode !== '2d') return fallback();
    if (typeof typ !== 'string' || typ.length < 1 || typ.length > 32) return fallback();
    if (typeof begruendung !== 'string' || begruendung.length < 10 || begruendung.length > 140) return fallback();
    if (mode === '2d' && !ROUTER_2D_TYPES.includes(typ)) return fallback();
    return { mode, typ, begruendung, fallback: false };
  } catch {
    return fallback();
  }
}

/**
 * P0-Router-Call: klassifiziert den Fachtext (2D vs 3D + Typ) VOR der
 * Generierung. Ein kleiner nicht-streamender Call, Fail-closed auf 3D
 * (Bestandspfad) bei jedem Fehler — wirft nie in den Generierungspfad.
 * Meta-Regel: provider/model bleiben Default (Proxy: meta-muse /
 * muse-spark-1.3-contributor); Fremdmodelle nur explizit per Opts + BYOK.
 * @param {string} fachtext
 * @param {{ promptTemplate?: string, timeoutMs?: number, provider?: string, model?: string }} [opts]
 * @returns {Promise<{ mode: '3d' | '2d', typ: string, begruendung: string, fallback: boolean }>}
 */
export async function routeGeneration(fachtext, opts = {}) {
  if (!proxyUrl) {
    throw Object.assign(new Error('E-GEN-OFFLINE: kein Proxy konfiguriert'), { code: 'E-GEN-OFFLINE' });
  }
  if (typeof fachtext !== 'string' || fachtext.length < 8) {
    throw Object.assign(new Error('E-GEN-400: Fachtext zu kurz'), { code: 'E-GEN-400' });
  }
  const template = typeof opts.promptTemplate === 'string' && opts.promptTemplate.includes('{FACHTEXT}')
    ? opts.promptTemplate
    : 'P0 ROUTER-KLASSIFIKATION: <FACHTEXT>\n{FACHTEXT}\n</FACHTEXT>\nAntworte NUR mit {"mode":"3d|2d","typ":"...","begruendung":"..."} (deutsch, max. 140 Zeichen).';
  const prompt = template.split('{FACHTEXT}').join(truncateFachtext(fachtext));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const headers = { 'content-type': 'application/json', accept: 'application/json' };
    if (liveApiKey) headers.authorization = 'Bearer ' + liveApiKey;
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        provider: typeof opts.provider === 'string' && opts.provider ? opts.provider : undefined,
        model: typeof opts.model === 'string' && opts.model ? opts.model : undefined,
        stream: false,
        max_tokens: 300,
        temperature: 0,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { mode: '3d', typ: 'baugruppe', begruendung: `Router-HTTP ${res.status} (Fail-closed 3D)`, fallback: true };
    let raw = '';
    try {
      const data = await res.json();
      raw = typeof data?.text === 'string' ? data.text
        : typeof data?.output_text === 'string' ? data.output_text
        : typeof data?.content === 'string' ? data.content
        : Array.isArray(data?.choices) && typeof data.choices[0]?.message?.content === 'string' ? data.choices[0].message.content
        : JSON.stringify(data);
    } catch {
      try {
        raw = await res.text();
      } catch {
        return { mode: '3d', typ: 'baugruppe', begruendung: 'Router-Antwort unlesbar (Fail-closed 3D)', fallback: true };
      }
    }
    const parsed = parseRouterDecision(raw);
    if (parsed.fallback) return { mode: '3d', typ: 'baugruppe', begruendung: 'Router-Parse ungueltig (Fail-closed 3D)', fallback: true };
    return parsed;
  } catch {
    clearTimeout(timer);
    return { mode: '3d', typ: 'baugruppe', begruendung: 'Router-Fehler/Timeout (Fail-closed 3D)', fallback: true };
  }
}
