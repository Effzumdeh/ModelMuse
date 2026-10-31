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

/**
 * Ausgabe-Budget (Befund 30.10.2026: Reasoning frisst das Budget — HTTP 200,
 * finish=length, nur Reasoning, kein Content; Eigentuemer-Vorgabe 31.10.2026:
 * deutlich hoeher, Contributor ist guenstig). Meta-Doku: Reasoning-Tokens
 * zaehlen gegen max_completion_tokens/max_tokens, Limit grosszuegig setzen
 * (dev.meta.ai/docs/reasoning). 65536 initial / 131072 Retry (1M-Kontext
 * Muse Spark Open, dev.meta.ai/docs/muse-spark-open/deploy); passt das Limit
 * bei api.meta.ai nicht, meldet Upstream ehrlich HTTP 400 (E-GEN-400),
 * nie stille Leere. Clamp 1000..131072 schuetzt vor 400/caps.
 */
export const GEN_MAX_COMPLETION_TOKENS = 65536;
export const GEN_RETRY_MAX_COMPLETION_TOKENS = 131072;
export const GEN_TEMPERATURE = 0.2;

/**
 * reasoning_effort=max nur fuer 1.3/wonder auf meta-muse — NICHT fuer
 * -contributor (API: max dort nicht verfuegbar) und NICHT fuer Baseten
 * (OpenAI-kompatibler Pfad, Param-Support unverifiziert -> 400-Risiko).
 * @param {string} provider
 * @param {string} model
 */
export function reasoningMaxAllowed(provider, model) {
  return provider === 'meta-muse' && (model === 'muse-spark-1.3' || model === 'muse-wonder-1.0');
}

/**
 * Chat-Body (Direkt- und Proxy-Pfad teilen sich Form/Felder).
 * @param {string} model
 * @param {string} promptText
 * @param {{ provider?: string, reasoning?: string, maxTokens?: number }} [opts]
 */
export function buildChatBody(model, promptText, opts = {}) {
  const n = Number(opts.maxTokens ?? GEN_MAX_COMPLETION_TOKENS);
  const maxTokens = Number.isFinite(n)
    ? Math.min(Math.max(Math.round(n), 1000), 131072)
    : GEN_MAX_COMPLETION_TOKENS;
  const body = {
    model,
    stream: true,
    messages: [{ role: 'user', content: promptText }],
    temperature: GEN_TEMPERATURE,
    max_completion_tokens: maxTokens,
  };
  if (opts.reasoning === 'max' && reasoningMaxAllowed(opts.provider ?? '', model)) body.reasoning_effort = 'max';
  return body;
}

/**
 * Budget-erschoepft (genau dann lohnt EIN Retry mit hoeherem Budget):
 * leerer Text + finish length + nur Reasoning, kein sichtbarer Content.
 * @param {string} full
 * @param {string | null} finishReason
 * @param {{ chunks: number, empty: number, reason: number, finish: string, err: string, usage: string } | null} info
 */
export function isBudgetExhausted(full, finishReason, info) {
  return (!full || !String(full).trim())
    && finishReason === 'length'
    && !!info && !(info.chunks > 0) && info.reason > 0;
}

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
 * Ein Chat-Chunk (SSE-Event oder JSON-Antwort) -> sichtbarer Text.
 * Sammelt delta.content + message.content + text + output_text (String oder
 * Text-Parts-Array wie [{type:'text',text:...}]), ignoriert Reasoning-Felder
 * (reasoning_content/reasoning: nur gezaehlt, nie abgebrochen) und leere
 * choices. Gibt '' zurueck, wenn der Chunk nichts Sichtbares traegt.
 * Diagnose laeuft ueber `info` (Seitenkanal, nie geloggt mit Key-Inhalten).
 * @param {unknown} evt
 * @param {{ chunks: number, empty: number, reason: number, finish: string, err: string, usage: string }} [info]
 */
export function collectChatText(evt, info) {
  const st = info ?? { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  if (!evt || typeof evt !== 'object') return '';
  const rec = /** @type {any} */ (evt);
  if (typeof rec.error === 'string' && rec.error) st.err = String(rec.error).slice(0, 80);
  else if (rec.error && typeof rec.error.message === 'string') st.err = String(rec.error.message).slice(0, 80);
  if (rec.usage && typeof rec.usage.completion_tokens === 'number') {
    const rt = typeof rec.usage.reasoning_tokens === 'number' ? `reasoning ${rec.usage.reasoning_tokens}/` : '';
    st.usage = `${rt}${rec.usage.completion_tokens} tokens`;
  }
  const ch = (rec.choices && rec.choices[0]) || null;
  if (!ch) {
    if (Array.isArray(rec.choices)) st.empty += 1;
    const fb = (typeof rec.output_text === 'string' && rec.output_text)
      || (typeof rec.text === 'string' && rec.text) || '';
    if (fb) st.chunks += 1;
    return fb;
  }
  const fr = ch.finish_reason ?? rec.finish_reason ?? '';
  if (fr) st.finish = String(fr);
  const d = ch.delta ?? null;
  const m = ch.message ?? null;
  const hasReason = (d && (typeof d.reasoning_content === 'string' || typeof d.reason === 'string'))
    || (m && (typeof m.reasoning_content === 'string' || typeof m.reason === 'string'));
  if (hasReason) st.reason += 1;
  const raw = (d && d.content != null) ? d.content
    : (m && m.content != null) ? m.content
    : (ch.text != null) ? ch.text
    : (rec.output_text != null) ? rec.output_text
    : (rec.text != null) ? rec.text : '';
  let out = '';
  if (typeof raw === 'string') out = raw;
  else if (raw && typeof raw.text === 'string') out = raw.text;
  else if (Array.isArray(raw)) {
    for (const p of raw) {
      if (typeof p === 'string') out += p;
      else if (p && typeof p.text === 'string') out += p.text;
    }
  }
  if (out) st.chunks += 1;
  else st.empty += 1;
  return out;
}

/** Kompakte Diagnose-Anreicherung fuer E-GEN-PARSE (Provider/Modell/Status/finish). */
function emptyHint(info) {
  const parts = [];
  if (info && info.finish) parts.push(`finish_reason=${info.finish}`);
  if (info && info.err) parts.push(String(info.err).slice(0, 60));
  else if (info && info.reason > 0 && !(info.chunks > 0)) {
    parts.push('nur Reasoning, kein sichtbarer Content (Budget teilen sich Reasoning+Content)');
  } else if (info && info.usage) parts.push(String(info.usage));
  else if (!(info && info.chunks > 0)) parts.push('0 Text-Chunks');
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/**
 * SSE-Stream lesen: data-Prefix, DONE-Terminator, finish_reason pruefen.
 * Sammelt robust (collectChatText); Reasoning/leere Deltas verwerfen nichts.
 * @param {Response} res
 */
async function readSseModule(res, onToken) {
  const reader = res.body?.getReader();
  if (!reader) throw Object.assign(new Error('E-GEN-PARSE: kein Stream'), { code: 'E-GEN-PARSE' });
  const info = { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let raw = '';
  /** @param {string} line */
  const feed = (line) => {
    const t = String(line).trim();
    if (!t.startsWith('data:')) {
      // Kein SSE-Prefix: evtl. reiner JSON-Body bei SSE-Content-Type.
      if (t) raw += `${t}\n`;
      return;
    }
    const payload = t.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let evt = null;
    try {
      evt = JSON.parse(payload);
    } catch {
      full += payload;
      info.chunks += 1;
      return;
    }
    const c = collectChatText(evt, info);
    if (c) {
      full += c;
      if (onToken) onToken(c);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) feed(line);
  }
  const tail = String(`${raw}${buf}`).trim();
  if (tail.startsWith('data:')) feed(tail);
  else if (!full && tail.startsWith('{')) {
    // SSE-Content-Type, aber reiner JSON-Body (kein data:-Prefix).
    try {
      const c = collectChatText(JSON.parse(tail), info);
      if (c) {
        full += c;
        if (onToken) onToken(c);
      }
    } catch {
      /* kein valides JSON: kein sichtbarer Content */
    }
  }
  return { full, finishReason: info.finish || null, info };
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
 * @param {{ provider?: string, model?: string, status?: number, info?: { chunks: number, empty: number, reason: number, finish: string, err: string, usage: string } }} [ctx]
 */
function finishModule(full, finishReason, via, ctx = {}) {
  const who = `${ctx.provider ?? '?'}/${ctx.model ?? '?'}`;
  const where = `(via ${via}, HTTP ${ctx.status ?? '?'}, ${who})`;
  if (!full || !full.trim()) {
    throw Object.assign(new Error(`E-GEN-PARSE: leere Antwort ${where}${emptyHint(ctx.info)}`), { code: 'E-GEN-PARSE' });
  }
  // E-S2-BOOT-Repair: fehlende benannte Imports (z.B. Scene) ergaenzen,
  // bevor Quelle gespeichert/gebootet wird (E2E-Befund 2026-10-27).
  const source = repairThreeImports(extractModuleSource(full));
  if (!source.includes('export const meta') || !source.includes('export function init')) {
    throw Object.assign(new Error(`E-GEN-PARSE: kein Modul extrahierbar ${where}${emptyHint(ctx.info)}`), { code: 'E-GEN-PARSE' });
  }
  if (finishReason && finishReason !== 'stop') {
    const budget = finishReason === 'length'
      ? ' (Ausgabebudget erschoepft: Reasoning+Content teilen sich das Limit)'
      : '';
    throw Object.assign(new Error(`E-GEN-PARSE: finish_reason=${finishReason} ${where}${budget}`), { code: 'E-GEN-PARSE' });
  }
  return { source, meta: { title: '', category: '', detailLevel: 1, parts: [], units: 'm' }, raw: full, via };
}

/**
 * Direkt-Call: Browser -> Upstream (OpenAI-kompatibel, SSE), Key per BYOK.
 * Budget GEN_MAX_COMPLETION_TOKENS; bei Budget-Erschoepfung (leer + finish
 * length + nur Reasoning) max EIN Retry mit GEN_RETRY_MAX_COMPLETION_TOKENS.
 * Definitive HTTP-Fehler werfen E-GEN-*, Transport-Fehler (Netz/CORS/Timeout)
 * werfen E-GEN-DIREKT (Fallback-Signal).
 */
async function generateDirect(url, provider, model, promptText, opts, key) {
  const ctrl = new AbortController();
  try {
    const once = async (maxTokens) => {
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key, accept: 'text/event-stream' },
          body: JSON.stringify(buildChatBody(model, promptText, { provider, reasoning: opts.reasoning, maxTokens })),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const code = classify(res.status);
          throw Object.assign(new Error(`${code}: HTTP ${res.status}`), { code });
        }
        const { full, finishReason, info } = await readSseModule(res, opts.onToken);
        return { full, finishReason, info, status: res.status };
      } finally {
        clearTimeout(timer);
      }
    };
    let r = await once(GEN_MAX_COMPLETION_TOKENS);
    if (isBudgetExhausted(r.full, r.finishReason, r.info)) {
      r = await once(GEN_RETRY_MAX_COMPLETION_TOKENS); // max 1 Retry
    }
    return finishModule(r.full, r.finishReason, 'direct', { provider, model, status: r.status, info: r.info });
  } catch (e) {
    if (e && typeof e.code === 'string' && e.code.startsWith('E-GEN-')) throw e;
    throw Object.assign(new Error('E-GEN-DIREKT: Direkt-Call nicht moeglich (Netz/CORS/Timeout)'), { code: 'E-GEN-DIREKT' });
  }
}

/**
 * @param {string} promptText vollstaendiger P1-Prompt inkl. Thema
 * @param {{ seed?: number, onToken?: (t: string) => void, provider?: string, model?: string, reasoning?: string }} [opts]
 * provider/model: Optional — Defaults (meta-muse/muse-spark-1.3-contributor).
 * reasoning 'max': nur meta-muse + 1.3/wonder (nie -contributor/Baseten).
 * Ablauf: Direkt-Call zuerst (BYOK-Key im Browser), Proxy nur als Fallback
 * bei Transport-Fehler; ohne Key nur Proxy (Server-Key), sonst E-GEN-OFFLINE.
 * Budget GEN_MAX_COMPLETION_TOKENS, max EIN Retry mit hoeherem Budget bei
 * Budget-Erschoepfung (leer + finish length + nur Reasoning).
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
      return await generateDirect(directUrl, provider, model, promptText, opts, key);
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
  let budget = GEN_MAX_COMPLETION_TOKENS;
  let budgetRetried = false;
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
        body: JSON.stringify({ prompt: promptText, provider, model, seed: opts.seed ?? null, stream: true, max_completion_tokens: budget }),
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
      const { full, finishReason, info } = await readSseModule(res, opts.onToken);
      sawHttp = true;
      if (!budgetRetried && isBudgetExhausted(full, finishReason, info)) {
        // Budget-Retry: Reasoning hat das Limit gefressen (leer + length +
        // nur Reasoning) — EIN Retry mit hoeherem Budget, kein Transportversuch
        // (attempt -= 1 gleicht das for-Inkrement aus, Flag begrenzt auf 1x).
        budgetRetried = true;
        budget = GEN_RETRY_MAX_COMPLETION_TOKENS;
        attempt -= 1;
        continue;
      }
      return finishModule(full, finishReason, 'proxy', { provider, model, status: res.status, info });
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
/** P1-Variantenwahl (2D-Alle-Varianten): P0-Typ -> Rendering-Variante + Spec.
 * Der P0-Router entscheidet nur Modus/Typ; welche der fuenf Libs rendert,
 * waehlt P1 (Vertrag p1-generate-2d-varianten.txt). Tabelle = Checklist. */
export const ROUTER_TYP_TO_VARIANT = Object.freeze({
  'schaltplan': { variant: 'svg', spec: '2d-svg' },
  'flussdiagramm': { variant: 'mermaid', spec: '2d-mermaid' },
  'schnitt-ansicht': { variant: 'svg', spec: '2d-svg' },
  'diagramm': { variant: 'chart', spec: '2d-chart' },
  'tabelle': { variant: 'katex', spec: '2d-katex' },
});
/** Netz-Topologie (Spezialfall von schaltplan) rendert d3-light. */
export const ROUTER_TOPOLOGY_VARIANT = Object.freeze({ variant: 'd3', spec: '2d-d3' });

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
