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
 * Browser-faehig mit User-Key (BYOK); CORS-Fehler -> Proxy-Fallback
 * (OpenRouter: NUR Direkt-Call, kein Proxy-Pfad).
 * @type {Record<string, string>}
 */
export const DIRECT_BASES = Object.freeze({
  'meta-muse': 'https://api.meta.ai/v1',
  baseten: 'https://inference.baseten.co/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
});

/** Upstream-Default-Modelle je Anbieter (stimmen mit scripts/proxy.mjs ueberein). */
export const DIRECT_DEFAULT_MODEL = Object.freeze({
  'meta-muse': 'muse-spark-1.3-contributor',
  baseten: 'meta-models/muse-spark-open-1026',
  openrouter: 'openai/gpt-6.1-sol',
  ollama: 'llama3.1:8b',
});

/**
 * OpenRouter-Attribution (Pflicht-Empfehlung fuer Browser-Calls:
 * https://openrouter.ai/docs/api-reference/overview — nur statische
 * App-Kennung, nie Key-Material).
 */
export const OPENROUTER_REFERER = 'https://github.com/Effzumdeh/ModelMuse';
export const OPENROUTER_TITLE = 'ModelMuse';

/**
 * Session-Storage-Keys je Anbieter (BYOK, nur Sitzung, nie localStorage).
 * Legacy-Einzelschluessel 'modelmuse-live-key' bleibt Lese-Fallback.
 * @param {string} [providerId]
 */
export function liveKeySessionKey(providerId) {
  if (typeof providerId === 'string' && providerId.length >= 2 && !/\s/.test(providerId)) {
    return `modelmuse-live-key-${providerId}`;
  }
  return 'modelmuse-live-key';
}

/**
 * Diagnose-Build-Stempel (wird in Fehlermeldungen + kopierter Diagnose
 * mitgefuehrt, damit Support Faelle Build-Versionen zuordnen kann).
 * v48: explizites Maximum (Eigentuemer-Alternative 03.11.2026) + Stempel
 * v47 (war seit v26 stale: v23 hier, v26 im Standalone-Artefakt, obwohl
 * Builder-Stand v46 war); v23-Regel (kein Limit) ist aufgehoben.
 */
export const GEN_BUILD = 'v48';

/**
 * Explizites Maximum (Eigentuemer-Alternative 03.11.2026, v48): Sowohl
 * max_completion_tokens als auch max_tokens werden mit GEN_MAX_TOKENS
 * gesendet — in jedem Pfad (direkt/proxy, generate/modify, Retry, alle
 * Provider). Hintergrund: Weglassen != unbegrenzt — Upstream defaultet
 * sonst auf 32768 (Eisbecher-Fall, belegt); 131072 war belegt wirksam.
 * Der EINZIGE Retry bleibt: genau 1x bei leer + length + nur Reasoning,
 * mit unveraendertem Body (inkl. Limit). Temperatur 0.2 = deterministische
 * Code-Gen.
 */
export const GEN_TEMPERATURE = 0.2;

/**
 * Explizites Output-Maximum je Request (beide Limit-Felder, v48).
 * @type {number}
 */
export const GEN_MAX_TOKENS = 131072;

/**
 * Belegte Reasoning-Stufen je Modell (v40, Stand 31.10.2026, live verifiziert
 * via GET https://openrouter.ai/api/v1/models — 452 Modelle — plus Doku):
 * - openrouter openai/gpt-6.1-sol: max/xhigh/high/medium/low, Default medium,
 *   mandatory (kein none/minimal; reasoning + reasoning_effort belegt, KEIN
 *   supports_max_tokens -> nur effort, kein max_tokens-Budget).
 *   Doku: openrouter.ai/docs/guides/best-practices/reasoning-tokens
 *   (Discovering per-model reasoning options) + GPT-6-Migrationsguide
 *   (Sol akzeptiert none generell, aber 6.1-sol ist mandatory).
 * - openrouter meta/muse-spark-1.3: max/xhigh/high/medium/low/minimal,
 *   Default medium, mandatory (kein none).
 * - openrouter anthropic/claude-opus-5.5: max/xhigh/high/medium/low,
 *   Default high (live /models; Migrationsguide nennt medium als
 *   Anthropic-Default ohne Param), mandatory (none/enabled:false -> 400;
 *   reasoning.max_tokens wird akzeptiert, aber NICHT weitergeleitet —
 *   adaptive thinking ohne Budget — deshalb nur effort).
 *   Doku: openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-5-5.
 * - meta-muse 1.3/wonder: max/xhigh (Meta-Doku); -contributor: nur xhigh
 *   (max dort rejected); baseten spark-open: nur xhigh (max rejected).
 * Rueckgabe absteigend (hoechste Stufe zuerst, wie /models).
 * @param {string} provider
 * @param {string} model
 * @returns {string[]}
 */
export function reasoningEffortsFor(provider, model) {
  const m = String(model ?? '');
  const short = m.includes('/') ? m.slice(m.lastIndexOf('/') + 1) : m;
  const base = short.includes(':') ? short.slice(0, short.indexOf(':')) : short;
  if ((provider ?? '') === 'openrouter') {
    if (base === 'muse-spark-1.3') return ['max', 'xhigh', 'high', 'medium', 'low', 'minimal'];
    if (base === 'gpt-6.1-sol' || base === 'opus-5.5') return ['max', 'xhigh', 'high', 'medium', 'low'];
    return ['max', 'xhigh', 'high', 'medium', 'low'];
  }
  if ((provider ?? '') === 'meta-muse' && (model === 'muse-spark-1.3' || model === 'muse-wonder-1.0')) {
    return ['max', 'xhigh'];
  }
  if ((provider ?? '') === 'meta-muse' && String(model ?? '').includes('contributor')) return ['xhigh'];
  if ((provider ?? '') === 'baseten') return ['xhigh'];
  return [];
}

/**
 * reasoning_effort=max nur fuer 1.3/wonder auf meta-muse — NICHT fuer
 * -contributor (Meta-Doku: max dort nicht verfuegbar, dev.meta.ai/docs/reasoning)
 * und NIE max auf Baseten (Baseten-Doku: Spark Open supported nur
 * low/medium/high/xhigh(default), max wird rejected —
 * docs.baseten.co/inference/model-apis/reasoning).
 * OpenRouter: max ist BELEGT (alle 3 Slugs listen max in supported_efforts —
 * live /models 31.10.2026) und wird durchgereicht (400-Fallback bleibt).
 * Hoechstes BELEGTES Level je Modell: 1.3/wonder -> max, contributor-Modelle
 * (meta-muse -contributor, Baseten spark-open) -> xhigh.
 * @param {string} provider
 * @param {string} model
 */
export function reasoningMaxAllowed(provider, model) {
  return provider === 'meta-muse' && (model === 'muse-spark-1.3' || model === 'muse-wonder-1.0');
}

/**
 * Hoechstes BELEGT unterstuetztes Level ist xhigh: max-faehige Modelle (s.o.)
 * plus contributor-Modelle (meta-muse -contributor: xhigh akzeptiert, max
 * rejected — dev.meta.ai/docs/reasoning) plus Baseten-Pfad (spark-open:
 * xhigh default/belegt, max rejected — docs.baseten.co, dev.to-Analyse)
 * plus OpenRouter-Pfad (alle 3 Slugs: reasoning_effort belegt inkl.
 * xhigh/max — OpenRouter-Modelle-API 31.10.2026 + live supported_efforts;
 * max wird durchgereicht, 400-Fallback bleibt).
 * @param {string} provider
 * @param {string} model
 */
export function reasoningXhighAllowed(provider, model) {
  if (reasoningMaxAllowed(provider ?? '', model)) return true;
  if ((provider ?? '') === 'baseten') return true;
  if ((provider ?? '') === 'openrouter') return true;
  if ((provider ?? '') === 'meta-muse' && String(model ?? '').includes('contributor')) return true;
  return false;
}

/**
 * Hoechstes BELEGTES Level fuer (provider, model, Wunsch): 'max' wo
 * erlaubt (meta-muse 1.3/wonder + alle OpenRouter-Modelle — live
 * supported_efforts 31.10.2026), sonst 'xhigh' wo erlaubt, sonst die
 * gewuenschte Stufe falls sie in reasoningEffortsFor belegt ist
 * (low/medium/high/minimal — nur OpenRouter), sonst null (kein Param).
 * Default ohne Wunsch: xhigh auf Baseten + OpenRouter (belegt), sonst
 * nichts (Modell-Default).
 * @param {string} provider
 * @param {string} model
 * @param {string} [want]
 */
export function reasoningLevel(provider, model, want) {
  if (want === 'max' && (reasoningMaxAllowed(provider ?? '', model) || (provider ?? '') === 'openrouter')) {
    const eff = reasoningEffortsFor(provider ?? '', model);
    if (eff.includes('max')) return 'max';
  }
  if ((want === 'max' || want === 'xhigh') && reasoningXhighAllowed(provider ?? '', model)) return 'xhigh';
  if (typeof want === 'string' && want && reasoningEffortsFor(provider ?? '', model).includes(want)) return want;
  if (!want && ((provider ?? '') === 'baseten' || (provider ?? '') === 'openrouter')) return 'xhigh';
  return null;
}

/**
 * Chat-Body (Direkt- und Proxy-Pfad teilen sich Form/Felder; v48:
 * explizites Maximum GEN_MAX_TOKENS in beiden Limit-Feldern — alle
 * Provider, generate/modify/Retry).
 * Baseten-Extras (v22/v23, NUR provider baseten — Meta-Pfad unveraendert):
 * 'xhigh' fordert das hoechste BELEGTE Thinking-Budget
 * (Baseten-Doku: Spark Open supported low/medium/high/xhigh(default), max
 * wird rejected — docs.baseten.co/inference/model-apis/reasoning; Meta:
 * contributor max rejected, xhigh akzeptiert —
 * dev.meta.ai/docs/reasoning),
 * stream_options.include_usage liefert Usage im Stream (Diagnose
 * zeigt Reasoning-/Total-Tokens). OpenRouter (NUR provider openrouter):
 * reasoning_effort aus reasoningEffortsFor (belegt je Slug — live
 * /models 31.10.2026: gpt-6.1-sol + opus-5.5 max/xhigh/high/medium/low,
 * muse-spark-1.3 zusaetzlich minimal; Default xhigh); KEIN stream_options
 * (unverifiziert, kein Param-Risiko); KEIN reasoning.max_tokens
 * (supports_max_tokens bei keinem der 3 Slugs gesetzt, Budgets werden
 * laut Claude-5.5-Migrationsguide nicht weitergeleitet).
 * Unverifizierte Params -> 400-Risiko,
 * deshalb genau EIN Fallback ohne Extras bei HTTP 400.
 * @param {string} model
 * @param {string} promptText
 * @param {{ provider?: string, reasoning?: string }} [opts]
 */
export function buildChatBody(model, promptText, opts = {}) {
  const body = {
    model,
    stream: true,
    messages: [{ role: 'user', content: promptText }],
    temperature: GEN_TEMPERATURE,
    max_completion_tokens: GEN_MAX_TOKENS,
    max_tokens: GEN_MAX_TOKENS,
  };
  const level = reasoningLevel(opts.provider ?? '', model, opts.reasoning);
  if (level) body.reasoning_effort = level;
  if ((opts.provider ?? '') === 'baseten') {
    body.stream_options = { include_usage: true };
  }
  return body;
}

/** v48-Request-Echo aus einem Chat-Body: was wurde TATSAECHLICH gesendet
 * (Limit-Felder sind seit v48 explizit 131072 — Echo belegt die Werte) +
 * ob der 400-Fallback griff. Key-frei (nur Param-Namen/Werte, nie Credentials).
 * @param {any} body
 * @param {boolean} slimmed400
 */
export function requestEcho(body, slimmed400) {
  const b = body && typeof body === 'object' ? body : {};
  return {
    maxCompletionTokens: ('max_completion_tokens' in b) ? b.max_completion_tokens : null,
    maxTokens: ('max_tokens' in b) ? b.max_tokens : null,
    reasoningEffort: (typeof b.reasoning_effort === 'string') ? b.reasoning_effort : null,
    temperature: (typeof b.temperature === 'number') ? b.temperature : null,
    fallback400: !!slimmed400,
  };
}

/** v22/v23/v26/v40-Extras aus einem Chat-Body streichen (exakt v20-Form).
 * Gestrichen: low/medium/high/minimal/xhigh (belegte Stufen, aber
 * Gateway-abhaengig — 400-Fallback) + stream_options (Baseten-Extras);
 * max bleibt (Meta-Gate + OpenRouter-belegt, nie 400-Grund) UND die
 * v48-Limit-Felder (max_completion_tokens/max_tokens = 131072, belegt
 * wirksam — duerfen den Fallback ueberleben).
 * @param {any} body */
export function stripChatExtras(body) {
  if (!body || typeof body !== 'object') return false;
  let stripped = false;
  if (body.reasoning_effort === 'low' || body.reasoning_effort === 'minimal'
    || body.reasoning_effort === 'medium' || body.reasoning_effort === 'high'
    || body.reasoning_effort === 'xhigh') { delete body.reasoning_effort; stripped = true; }
  if ('stream_options' in body) { delete body.stream_options; stripped = true; }
  return stripped;
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

/** Content-Part-Helfer (Reasoning wird nie als Content gewertet). */
/**
 * Text aus einem Content-Part loesen (String, {text}, {text:{value}},
 * {content} als String/Array). Reasoning-/Thinking-Parts gehoeren NICHT
 * hierher (siehe joinContentParts).
 * @param {unknown} p
 */
function partText(p) {
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object') {
    const o = /** @type {{ text?: unknown, content?: unknown }} */ (p);
    if (typeof o.text === 'string') return o.text;
    if (o.text && typeof o.text === 'object'
      && typeof /** @type {{ value?: unknown }} */ (o.text).value === 'string') {
      return /** @type {{ value: string }} */ (o.text).value;
    }
    if (typeof o.content === 'string') return o.content;
    if (Array.isArray(o.content)) return joinContentParts(o.content);
  }
  return '';
}

/**
 * Parts-Array zu Text verketten; Parts mit type reasoning/thinking werden
 * uebersprungen (Denkarbeit ist kein Modul-Content).
 * @param {unknown} arr
 */
function joinContentParts(arr) {
  if (!Array.isArray(arr)) return '';
  let out = '';
  for (const p of arr) {
    if (p && typeof p === 'object'
      && (/** @type {{ type?: unknown }} */ (p).type === 'reasoning'
        || /** @type {{ type?: unknown }} */ (p).type === 'thinking')) {
      continue;
    }
    out += partText(p);
  }
  return out;
}

/**
 * Reasoning-Nachweis (nur Diagnose-Zaehler): reasoning_content/reasoning/
 * reason/thinking als nicht-leerer String ODER als Objekt/Array-Form
 * (einige Gateways liefern Reasoning strukturiert statt als String).
 * @param {unknown} v
 */
function hasReasoning(v) {
  if (!v || typeof v !== 'object') return false;
  const o = /** @type {{ reasoning_content?: unknown, reasoning?: unknown, reason?: unknown, thinking?: unknown }} */ (v);
  const r = o.reasoning_content ?? o.reasoning ?? o.reason ?? o.thinking;
  if (typeof r === 'string') return r.length > 0;
  return r != null;
}

/**
 * Reasoning-Textauszug fuer die Diagnose (gekürzt, nie Key-haltig —
 * Reasoning enthaelt Denkarbeit, keine Credentials; wird vor dem Kopieren
 * ohnehin redigiert). Gibt '' zurueck, wenn kein String-Reasoning vorliegt.
 * @param {unknown} v
 */
function reasoningSample(v) {
  if (!v || typeof v !== 'object') return '';
  const o = /** @type {{ reasoning_content?: unknown, reasoning?: unknown, reason?: unknown, thinking?: unknown }} */ (v);
  const r = o.reasoning_content ?? o.reasoning ?? o.reason ?? o.thinking;
  return typeof r === 'string' ? r : '';
}

/**
 * Erstes belegtes Content-Feld (leere Strings werden uebersprungen, damit
 * ein leeres delta.content kein belegtes message.content verdeckt).
 * @param {unknown[]} vals
 */
function firstContent(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    return v;
  }
  return '';
}

/**
 * Ein Chat-Chunk (SSE-Event oder JSON-Antwort) -> sichtbarer Text.
 * Sammelt delta.content + delta.text + message.content + message.output_text
 * + message.text + choices[0].text/output_text + output_text/text +
 * Responses-API-output-Array (String oder Text-Parts-Array wie
 * [{type:'text',text:...}]), ignoriert Reasoning-Felder
 * (reasoning_content/reasoning/reason/thinking: nur gezaehlt, nie
 * abgebrochen, nie als Content gewertet — auch nicht als Parts mit
 * type reasoning/thinking) und leere choices. Refusals landen in info.err.
 * Gibt '' zurueck, wenn der Chunk nichts Sichtbares traegt.
 * Diagnose laeuft ueber `info` (Seitenkanal, nie geloggt mit Key-Inhalten):
 * chunks/empty/reason/finish/err/usage wie bisher, dazu usageReasoning/
 * usageCompletion (Zahlen, null wenn unbekannt) und reasonSample
 * (Reasoning-Textauszug, max ~2KB, fuer den Diagnose-Export).
 * @param {unknown} evt
 * @param {{ chunks: number, empty: number, reason: number, finish: string, err: string, usage: string, usageReasoning?: number | null, usageCompletion?: number | null, reasonSample?: string }} [info]
 */
export function collectChatText(evt, info) {
  const st = info ?? { chunks: 0, empty: 0, reason: 0, finish: '', err: '', usage: '' };
  if (!evt || typeof evt !== 'object') return '';
  const rec = /** @type {any} */ (evt);
  if (typeof rec.error === 'string' && rec.error) st.err = String(rec.error).slice(0, 80);
  else if (rec.error && typeof rec.error.message === 'string') st.err = String(rec.error.message).slice(0, 80);
  if (rec.usage && typeof rec.usage.completion_tokens === 'number') {
    const details = rec.usage.completion_tokens_details;
    const rtRaw = typeof rec.usage.reasoning_tokens === 'number' ? rec.usage.reasoning_tokens
      : (details && typeof details.reasoning_tokens === 'number' ? details.reasoning_tokens : null);
    const rt = typeof rtRaw === 'number' ? `reasoning ${rtRaw}/` : '';
    st.usage = `${rt}${rec.usage.completion_tokens} tokens`;
    st.usageCompletion = rec.usage.completion_tokens;
    st.usageReasoning = typeof rtRaw === 'number' ? rtRaw : null;
  }
  const ch = (rec.choices && rec.choices[0]) || null;
  if (!ch) {
    if (Array.isArray(rec.choices)) st.empty += 1;
    const fb = partText(rec.output_text) || joinContentParts(rec.output_text)
      || partText(rec.text) || joinContentParts(rec.text) || joinContentParts(rec.output);
    if (fb) st.chunks += 1;
    return fb;
  }
  const fr = ch.finish_reason ?? rec.finish_reason ?? '';
  if (fr) st.finish = String(fr);
  const d = ch.delta ?? null;
  const m = ch.message ?? null;
  if (hasReasoning(d) || hasReasoning(m)) {
    st.reason += 1;
    try {
      const sample = reasoningSample(d) || reasoningSample(m);
      if (sample) {
        st.reasonSample = String(st.reasonSample ?? '') + sample;
        if (st.reasonSample.length > 2048) st.reasonSample = st.reasonSample.slice(0, 2048);
      }
    } catch { /* Diagnose-Seitenkanal darf nie werfen */ }
  }
  if (m && typeof m.refusal === 'string' && m.refusal) st.err = String(m.refusal).slice(0, 80);
  const raw = firstContent(
    d?.content, d?.text,
    m?.content, m?.output_text, m?.text,
    ch.text, ch.output_text,
    rec.output_text, rec.text, rec.output,
  );
  const out = partText(raw) || joinContentParts(raw);
  if (out) st.chunks += 1;
  else st.empty += 1;
  return out;
}

/** Kompakte Diagnose-Anreicherung fuer E-GEN-PARSE (Provider/Modell/Status/finish/Retry/Build). */
function emptyHint(info, retried) {
  const parts = [];
  if (info && info.finish) parts.push(`finish_reason=${info.finish}`);
  if (info && info.err) parts.push(String(info.err).slice(0, 60));
  else {
    if (info && info.reason > 0 && !(info.chunks > 0)) {
      parts.push('nur Reasoning, kein sichtbarer Content (Budget teilen sich Reasoning+Content)');
    } else if (!(info && info.chunks > 0)) parts.push('0 Text-Chunks');
    // Usage immer zeigen (unterscheidet "Budget ignoriert" vs "Thinking fuellt alles").
    if (info && info.usage) parts.push(String(info.usage).slice(0, 60));
  }
  parts.push(`Retry ${retried ? 1 : 0}/1`);
  parts.push(`Build ${GEN_BUILD}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/**
 * Redigiert einen Diagnosetext vor Anzeige/Clipboard: Authorization-Header,
 * Bearer-Tokens und Key-Formen (sk-*, LLM_*, api_key-Zuweisungen) werden
 * ersetzt. Modell-Slugs (mit '/') und kurze Kennungen bleiben lesbar.
 * @param {unknown} s
 */
export function redactDiagnoseText(s) {
  let out = String(s ?? '');
  out = out.replace(/Authorization\s*:\s*Bearer\s+\S+/gi, 'Authorization: Bearer [REDACTED]');
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-~+/=]{8,}/g, 'Bearer [REDACTED]');
  out = out.replace(/\bsk-[A-Za-z0-9\-_]{8,}\b/g, '[REDACTED]');
  out = out.replace(/\bLLM_[A-Za-z0-9._\-]{8,}\b/g, '[REDACTED]');
  out = out.replace(/(["']?api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[REDACTED]');
  return out;
}

/**
 * Baut den kopierbaren Diagnose-Text (stabile Feldnamen, lokalisierte Kopfzeile,
 * Rohantwort auf ~2KB gekuerzt, IMMER redigiert — nie ein Key im Clipboard).
 * v48: Request-Echo (tatsaechlich gesendete Limit-/Thinking-Params je Versuch
 * inkl. Retry-Limit-Werte + 400-Fallback) — belegt das explizite Maximum.
 * @param {{ provider?: unknown, model?: unknown, via?: unknown, status?: unknown, finish?: unknown, usage?: unknown, usageReasoning?: unknown, usageCompletion?: unknown, retried?: unknown, build?: unknown, rawSnippet?: unknown, req?: unknown, reqRetry?: unknown }} [diag]
 * @param {string} [locale]
 */
export function buildDiagnoseText(diag = {}, locale = 'de') {
  const loc = ['de', 'en', 'es', 'fr'].includes(locale) ? locale : 'de';
  const head = loc === 'en'
    ? 'ModelMuse diagnostics (redacted, no key).'
    : loc === 'es'
      ? 'ModelMuse diagnóstico (editado, sin clave).'
      : loc === 'fr'
        ? 'Diagnostic ModelMuse (expurgé, sans clé).'
        : 'ModelMuse Diagnose (redigiert, ohne Key).';
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
  const dict = loc === 'en'
    ? { noLimit: '(not sent)', none: '(none)', noTemp: '(none)', yes: 'yes', no: 'no' }
    : loc === 'es'
      ? { noLimit: '(no enviado)', none: '(ninguno)', noTemp: '(ninguna)', yes: 'sí', no: 'no' }
      : loc === 'fr'
        ? { noLimit: '(non envoyé)', none: '(aucun)', noTemp: '(aucune)', yes: 'oui', no: 'non' }
        : { noLimit: '(nicht gesendet)', none: '(keins)', noTemp: '(keine)', yes: 'ja', no: 'nein' };
  const lim = (r) => {
    const o = (r && typeof r === 'object') ? r : {};
    return {
      maxC: (typeof o.maxCompletionTokens === 'number' && Number.isFinite(o.maxCompletionTokens)) ? String(o.maxCompletionTokens) : dict.noLimit,
      maxT: (typeof o.maxTokens === 'number' && Number.isFinite(o.maxTokens)) ? String(o.maxTokens) : dict.noLimit,
      eff: (typeof o.reasoningEffort === 'string' && o.reasoningEffort) ? o.reasoningEffort : dict.none,
      temp: (typeof o.temperature === 'number' && Number.isFinite(o.temperature)) ? String(o.temperature) : dict.noTemp,
      fb: o.fallback400 ? dict.yes : dict.no,
    };
  };
  const req = lim(diag.req);
  const lines = [
    head,
    `provider: ${diag.provider ?? '?'}`,
    `model: ${diag.model ?? '?'}`,
    `via: ${diag.via ?? '?'}`,
    `http: ${diag.status ?? '?'}`,
    `finish: ${diag.finish ?? ''}`,
    `usage: ${diag.usage ?? ''}`,
    `usage_reasoning_tokens: ${num(diag.usageReasoning)}`,
    `usage_completion_tokens: ${num(diag.usageCompletion)}`,
    `retry: ${(diag.retried ? 1 : 0)}/1`,
    `req_max_completion_tokens: ${req.maxC}`,
    `req_max_tokens: ${req.maxT}`,
    `req_reasoning_effort: ${req.eff}`,
    `req_temperature: ${req.temp}`,
    `req_400_fallback: ${req.fb}`,
    `build: ${diag.build ?? GEN_BUILD}`,
    `raw_snippet_2k: ${String(diag.rawSnippet ?? '').slice(0, 2048)}`,
  ];
  if (diag.retried && diag.reqRetry && typeof diag.reqRetry === 'object') {
    const rr = lim(diag.reqRetry);
    lines.splice(lines.length - 2, 0,
      `req_retry_max_completion_tokens: ${rr.maxC}`,
      `req_retry_max_tokens: ${rr.maxT}`,
      `req_retry_reasoning_effort: ${rr.eff}`,
      `req_retry_400_fallback: ${rr.fb}`);
  }
  return redactDiagnoseText(lines.join('\n'));
}

/**
 * Diagnose zu einem Generierungsfehler: bevorzugt das strukturierte
 * Diagnose-Objekt am Fehler (via/finish/Usage/Retry/Build/Rohantwort),
 * sonst ehrlicher Fallback aus der (key-freien) Fehlermeldung.
 * @param {unknown} e
 */
export function errorDiagnose(e) {
  if (e && typeof e === 'object') {
    const d = /** @type {{ diagnose?: unknown }} */ (e).diagnose;
    if (d && typeof d === 'object') return /** @type {any} */ (d);
  }
  const msg = String((e && typeof e === 'object' && 'message' in e && e.message) || e);
  return {
    provider: '?', model: '?', via: '?', status: '?',
    finish: '', usage: '', usageReasoning: null, usageCompletion: null,
    retried: false, build: GEN_BUILD, rawSnippet: msg.slice(0, 2048),
    req: requestEcho({}, false), reqRetry: null,
  };
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
  // Rohantwort-Auszug fuer den Diagnose-Export (max ~2KB): sichtbarer Text
  // zuerst, sonst Reasoning-Auszug (Thinking-Fall), sonst Stream-Rest.
  // Enthaelt nie Key-Material (nur Modell-Output); wird vor dem Kopieren
  // ohnehin redigiert.
  const rawSnippet = String(
    full || info.reasonSample || `${raw}${buf}`.slice(-2048) || ''
  ).slice(0, 2048);
  return { full, finishReason: info.finish || null, info, rawSnippet };
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
 * Haengt jeden E-GEN-PARSE-Fehler an `err.diagnose` (Provider/Modell/HTTP/
 * finish/Usage-Zahlen/Retry/Build/Rohantwort, key-frei) fuer den
 * Diagnose-Export per Copy-Button.
 * @param {string} full
 * @param {string | null} finishReason
 * @param {'direct' | 'proxy'} via
 * @param {{ provider?: string, model?: string, status?: number, retried?: boolean, rawSnippet?: string, req?: { maxCompletionTokens: number | null, maxTokens: number | null, reasoningEffort: string | null, temperature: number | null, fallback400: boolean } | null, reqRetry?: { maxCompletionTokens: number | null, maxTokens: number | null, reasoningEffort: string | null, temperature: number | null, fallback400: boolean } | null, info?: { chunks: number, empty: number, reason: number, finish: string, err: string, usage: string, usageReasoning?: number | null, usageCompletion?: number | null, reasonSample?: string } }} [ctx]
 */
function finishModule(full, finishReason, via, ctx = {}) {
  const who = `${ctx.provider ?? '?'}/${ctx.model ?? '?'}`;
  const where = `(via ${via}, HTTP ${ctx.status ?? '?'}, ${who})`;
  const diagnose = () => ({
    provider: ctx.provider ?? '?',
    model: ctx.model ?? '?',
    via,
    status: ctx.status ?? '?',
    finish: (ctx.info && ctx.info.finish) || finishReason || '',
    usage: (ctx.info && ctx.info.usage) || '',
    usageReasoning: (ctx.info && ctx.info.usageReasoning) ?? null,
    usageCompletion: (ctx.info && ctx.info.usageCompletion) ?? null,
    retried: !!ctx.retried,
    build: GEN_BUILD,
    rawSnippet: String(ctx.rawSnippet ?? full ?? '').slice(0, 2048),
    req: ctx.req ?? requestEcho({}, false),
    reqRetry: ctx.reqRetry ?? null,
  });
  if (!full || !full.trim()) {
    const err = Object.assign(new Error(`E-GEN-PARSE: leere Antwort ${where}${emptyHint(ctx.info, ctx.retried)}`), { code: 'E-GEN-PARSE' });
    err.diagnose = diagnose();
    throw err;
  }
  // E-S2-BOOT-Repair: fehlende benannte Imports (z.B. Scene) ergaenzen,
  // bevor Quelle gespeichert/gebootet wird (E2E-Befund 2026-10-27).
  const source = repairThreeImports(extractModuleSource(full));
  if (!source.includes('export const meta') || !source.includes('export function init')) {
    const err = Object.assign(new Error(`E-GEN-PARSE: kein Modul extrahierbar ${where}${emptyHint(ctx.info, ctx.retried)}`), { code: 'E-GEN-PARSE' });
    err.diagnose = diagnose();
    throw err;
  }
  if (finishReason && finishReason !== 'stop') {
    const budget = finishReason === 'length'
      ? ' (Ausgabebudget erschoepft: Reasoning+Content teilen sich das Limit)'
      : '';
    const err = Object.assign(new Error(`E-GEN-PARSE: finish_reason=${finishReason} ${where}${budget}`), { code: 'E-GEN-PARSE' });
    err.diagnose = diagnose();
    throw err;
  }
  return { source, meta: { title: '', category: '', detailLevel: 1, parts: [], units: 'm' }, raw: full, via };
}

/**
 * Direkt-Call: Browser -> Upstream (OpenAI-kompatibel, SSE), Key per BYOK.
 * OpenRouter (NUR provider openrouter): zusaetzlich HTTP-Referer + X-Title
 * (App-Kennung, kein Key-Material).
 * v48: explizites Maximum GEN_MAX_TOKENS in beiden Limit-Feldern; bei
 * Budget-Erschoepfung (leer + finish length + nur Reasoning) max EIN Retry
 * mit UNVERAENDERTEM Body. Request-Echo je Versuch landet in err.diagnose.
 * Definitive HTTP-Fehler werfen E-GEN-*, Transport-Fehler (Netz/CORS/Timeout)
 * werfen E-GEN-DIREKT (Fallback-Signal).
 */
async function generateDirect(url, provider, model, promptText, opts, key) {
  const ctrl = new AbortController();
  try {
    let slimmed = false;
    const attempts = [];
    const extraHeaders = provider === 'openrouter'
      ? { 'HTTP-Referer': OPENROUTER_REFERER, 'X-Title': OPENROUTER_TITLE }
      : {};
    const once = async () => {
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const chatBody = buildChatBody(model, promptText, { provider, reasoning: opts.reasoning });
        if (slimmed) stripChatExtras(chatBody);
        const baseHeaders = { 'content-type': 'application/json', accept: 'text/event-stream', ...extraHeaders };
        // Ollama laeuft lokal ohne Key (BYOK entfaellt, localhost:11434).
        if (provider !== 'ollama' && key) baseHeaders.authorization = 'Bearer ' + key;
        const send = async (b) => fetch(url, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify(b),
          signal: ctrl.signal,
        });
        let res = await send(chatBody);
        if (!res.ok && res.status === 400 && !slimmed && stripChatExtras(chatBody)) {
          // v22/v23: Gateway lehnt unverifizierte Extras ab -> Body ohne
          // Extras erneut (nie schlechter als ohne Extras: ohne gab es
          // dasselbe 400).
          slimmed = true;
          res = await send(chatBody);
        }
        if (!res.ok) {
          const code = classify(res.status);
          const req = requestEcho(chatBody, slimmed);
          attempts.push(req);
          const err = Object.assign(new Error(`${code}: HTTP ${res.status}`), { code });
          err.diagnose = {
            provider, model, via: 'direct', status: res.status,
            finish: '', usage: '', usageReasoning: null, usageCompletion: null,
            retried: false, build: GEN_BUILD, rawSnippet: '',
            req, reqRetry: null,
          };
          throw err;
        }
        const { full, finishReason, info, rawSnippet } = await readSseModule(res, opts.onToken);
        attempts.push(requestEcho(chatBody, slimmed));
        return { full, finishReason, info, rawSnippet, status: res.status };
      } finally {
        clearTimeout(timer);
      }
    };
    let r = await once();
    let retried = false;
    if (isBudgetExhausted(r.full, r.finishReason, r.info)) {
      retried = true;
      r = await once(); // max 1 Retry, gleicher Body (inkl. Limit)
    }
    return finishModule(r.full, r.finishReason, 'direct', {
      provider, model, status: r.status, retried, info: r.info, rawSnippet: r.rawSnippet,
      req: attempts[0] ?? requestEcho({}, false),
      reqRetry: retried ? (attempts[attempts.length - 1] ?? null) : null,
    });
  } catch (e) {
    if (e && typeof e.code === 'string' && e.code.startsWith('E-GEN-')) throw e;
    throw Object.assign(new Error('E-GEN-DIREKT: Direkt-Call nicht moeglich (Netz/CORS/Timeout)'), { code: 'E-GEN-DIREKT' });
  }
}

/**
 * @param {string} promptText vollstaendiger P1-Prompt inkl. Thema
 * @param {{ seed?: number, onToken?: (t: string) => void, provider?: string, model?: string, reasoning?: string }} [opts]
 * provider/model: Optional — Defaults (meta-muse/muse-spark-1.3-contributor).
 * reasoning: belegte Stufe je Modell (reasoningEffortsFor — v40 live
 * verifiziert: meta-muse 1.3/wonder max, contributor/baseten xhigh,
 * OpenRouter je Slug max/xhigh/high/medium/low (+minimal nur spark);
 * unbelegte Stufe -> kein Param, 400-Fallback bleibt).
 * Direkt-Call zuerst (Browser -> Upstream, BYOK-Key; Ollama lokal ohne Key),
 * Proxy nur als Fallback
 * bei Transport-Fehler (OpenRouter: NUR Direkt-Call — Proxy lehnt openrouter
 * mit E-GEN-404 + Hinweis ab; ohne Key nur Proxy (Server-Key), sonst E-GEN-OFFLINE.
 * v48: explizites Maximum GEN_MAX_TOKENS im Proxy-Upstream-Body (Modell nutzt
 * NICHT mehr den Upstream-Default 32768);
 * max EIN Retry mit UNVERAENDERTEM Body bei Budget-Erschoepfung
 * (leer + finish length + nur Reasoning). Request-Echo (Proxy-Upstream-Form,
 * deterministisch aus Provider/Modell, gleiche Build-Version) in Diagnose.
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
  // Ollama braucht keinen Key (lokal, localhost:11434) — Direkt-Call auch ohne Key.
  const needsKey = provider !== 'ollama';
  const directUrl = directFirst && (!needsKey || key) && model ? directChatUrl(provider) : null;
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
  // v48-Request-Echo Proxy-Pfad: Upstream-Form ist deterministisch
  // (gleiche Build-Version): explizites Maximum GEN_MAX_TOKENS in beiden
  // Limit-Feldern, Temperatur 0.2,
  // reasoning_effort 'xhigh' nur bei baseten, 400-Fallback proxy-intern.
  const proxyReqEcho = () => requestEcho({
    temperature: GEN_TEMPERATURE,
    max_completion_tokens: GEN_MAX_TOKENS,
    max_tokens: GEN_MAX_TOKENS,
    ...(provider === 'baseten'
      ? { reasoning_effort: 'xhigh', stream_options: { include_usage: true } }
      : {}),
  }, false);
  let proxyRetried = false;
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
      const { full, finishReason, info, rawSnippet } = await readSseModule(res, opts.onToken);
      sawHttp = true;
      if (!proxyRetried && isBudgetExhausted(full, finishReason, info)) {
        // Reasoning-only + length — EIN Retry mit UNVERAENDERTEM Body
        // (attempt -= 1 gleicht das for-Inkrement aus, Flag begrenzt auf 1x).
        proxyRetried = true;
        attempt -= 1;
        continue;
      }
      return finishModule(full, finishReason, 'proxy', {
        provider, model, status: res.status, retried: proxyRetried, info, rawSnippet,
        req: proxyReqEcho(), reqRetry: proxyRetried ? proxyReqEcho() : null,
      });
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
