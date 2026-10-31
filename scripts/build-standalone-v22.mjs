/**
 * Standalone builder v22 (Diagnose-Export + belegtes Thinking-Budget):
 * Baut auf dem v21-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Doku-Befund (recherchiert 31.10.2026, nur belegte Fakten):
 * - Baseten Reasoning-Doku (docs.baseten.co/inference/model-apis/reasoning):
 *   Muse Spark Open = "Always on / Control None", supported
 *   low/medium/high/xhigh (default), none/minimal laufen auf low;
 *   "Beam and Muse Spark Open always reason."
 * - Chat-Completions-Referenz
 *   (docs.baseten.co/reference/inference-api/chat-completions): Gateway
 *   akzeptiert none..max, Modelle ohne Support ignorieren den Parameter.
 * - Meta Prompting-Doku (dev.meta.ai/docs/muse-spark-open/prompting): nur
 *   low/medium/high/xhigh zulaessig, none/max werden rejected
 *   ("Reasoning can't be turned off").
 * - Meta Deploy-Doku Fireworks-Abschnitt
 *   (dev.meta.ai/docs/muse-spark-open/deploy): Thinking cannot be turned
 *   off, reasoning_effort="none" is rejected; Kontext 1.048.576 Tokens.
 * - Meta Settings (dev.meta.ai/docs/muse-spark-open/settings): low=8,
 *   medium=32, high=256, xhigh=512 (default).
 * - Meta Reasoning (dev.meta.ai/docs/reasoning): Reasoning-Tokens zaehlen
 *   gegen Output-Budget + Billing (completion_tokens_details.reasoning_tokens).
 * - Baseten Launch-Blog (baseten.co/blog/muse-spark-open-launch): 1M Kontext,
 *   816B/42.7B, NVFP4, reasoning output + volle 1M-Kontext Unterstuetzung.
 * KONSEQUENZ: v21-'none' war unbelegt (wird rejected bzw. auf low
 * gemappt) -> v22 sendet 'low' (kleinstes BELEGTES Budget, nur
 * baseten-direct; Meta-Pfad unveraendert), 400-Fallback bleibt.
 *
 * F1  Request (generate + modify, NUR baseten-direct): reasoning_effort
 *     'low' statt 'none' (Doku: low ist Minimum, none rejected/gemapped).
 * F2  Reader: Usage-Zahlen (usageReasoning/usageCompletion, inkl.
 *     completion_tokens_details-Form) + Reasoning-Auszug (reasonSample,
 *     max 2KB) im _lastChatInfo fuer den Diagnose-Export.
 * F3  Diagnose-Copy (generate-Fehlerzustand): Button "Diagnose kopieren"
 *     neben genStatus (nur bei genStatusBad), kopiert redigierte Diagnose
 *     (Provider/Modell/HTTP/finish/Usage-Zahlen/Retry/Build v22 +
 *     raw_snippet_2k), Authorization/Key IMMER redigiert; Bestaetigung
 *     diagCopied (de/en/es), Clipboard-API mit Textarea-Fallback.
 * F4  Diagnose-Stempel: Build v21 -> v22 (emptyDetail + buildTag +
 *     staleHint-mine).
 *
 * Aufruf: node scripts/build-standalone-v22.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v22-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v22: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen. */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v22-syn-'));
  try {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    let m, n = 0, checked = 0;
    while ((m = re.exec(s))) {
      const attrs = m[1];
      if (/src\s*=/i.test(attrs)) continue;
      if (/type\s*=\s*['"]?(importmap|application\/ld\+json|application\/json)/i.test(attrs)) continue;
      n += 1;
      const isMod = /type\s*=\s*['"]?module/i.test(attrs);
      const f = join(dir, `inline-${n}${isMod ? '.mjs' : '.js'}`);
      writeFileSync(f, m[2]);
      try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        checked += 1;
      } catch (e) {
        const detail = String((e.stdout || '') + (e.stderr || '')).split('\n').slice(0, 4).join(' | ');
        must(false, `Inline-Script ${n} (${isMod ? 'module' : 'classic'}) parst nicht: ${detail}`);
      }
    }
    must(n >= 5, 'zu wenige Inline-Scripts gefunden: ' + n);
    console.log(`  Syntax-Gate ok (${checked} Inline-Scripts parsen)`);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// ---------- F3: Diagnose-Methoden (keine Backticks/Template-Literale,
// kein ${}, keine Regex-Literale mit {} — Klammer-Bilanz der Pruef-Tools!) ----------
const NEW_DIAG_METHODS = String.raw`diagText:function(){var L="de";try{L=this.lang||"de";}catch(eL){}var head=(L==="es")?"ModelMuse diagnostico (editado, sin clave).":((L==="en")?"ModelMuse diagnostics (redacted, no key).":"ModelMuse Diagnose (redigiert, ohne Key).");var i={};try{i=this._lastChatInfo||{};}catch(eI){}var prov="?";try{prov=this.genProvider||"?";}catch(eP){}var mod="?";try{mod=this.genModel||"?";}catch(eM){}var http="?";try{http=this._lastHttp||"?";}catch(eH){}var fin="";try{fin=i.finish||"";}catch(eF){}var usg="";try{usg=i.usage||"";}catch(eU){}var ur="";try{ur=(i.usageReasoning==null)?"":String(i.usageReasoning);}catch(eR1){}var uc="";try{uc=(i.usageCompletion==null)?"":String(i.usageCompletion);}catch(eR2){}var rt="0/1";try{rt=((this._lastRetry?1:0)+"/1");}catch(eR3){}var bld="v22";try{bld=this.buildTag();}catch(eB){}var raw="";try{raw=String(i.reasonSample||"").slice(0,2048);}catch(eR4){}var s=head+"\nprovider: "+prov+"\nmodel: "+mod+"\nhttp: "+http+"\nfinish: "+fin+"\nusage: "+usg+"\nusage_reasoning_tokens: "+ur+"\nusage_completion_tokens: "+uc+"\nretry: "+rt+"\nbuild: "+bld+"\nraw_snippet_2k: "+raw;try{var r1=new RegExp("Authorization\\s*:\\s*Bearer\\s+\\S+","gi");s=s.replace(r1,"Authorization: Bearer [REDACTED]");var r2=new RegExp("Bearer\\s+[A-Za-z0-9._\\-~+/=]{8,}","g");s=s.replace(r2,"Bearer [REDACTED]");var r3=new RegExp("\\bsk-[A-Za-z0-9\\-_]{8,}\\b","g");s=s.replace(r3,"[REDACTED]");var r4=new RegExp("\\bLLM_[A-Za-z0-9._\\-]{8,}\\b","g");s=s.replace(r4,"[REDACTED]");}catch(eX){}return s;},
copyDiag:function(){var s="";try{s=this.diagText();}catch(e){s="ModelMuse Diagnose (redigiert, ohne Key).";}var self=this;var done=function(ok){try{self.diagCopied=!!ok;}catch(eD){}try{setTimeout(function(){try{self.diagCopied=false;}catch(eT){}},4000);}catch(eS){}};try{if(navigator&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(function(){done(true);},function(){done(false);});}else{var ta=document.createElement("textarea");ta.value=s;document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand("copy");}catch(eC){ok=false;}try{document.body.removeChild(ta);}catch(eR){}done(!!ok);}}catch(eF){done(false);}},`;

// ---------- F3: Copy-Button im Fehlerzustand (Template, nach genStatus) ----------
const GENSTATUS_ANCHOR = `<p v-if="genStatus" :class="genStatusBad ? 'mt-2 text-sm text-red-600 dark:text-red-400' : 'mt-2 text-sm text-emerald-700 dark:text-emerald-300'">{{genStatus}}</p>`;
const GENSTATUS_NEW = GENSTATUS_ANCHOR + `<button v-if="genStatusBad" type="button" @click="copyDiag" class="mt-2 inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-600 px-3 min-h-[44px] text-sm">{{t('copyDiagBtn')}}</button><span v-if="diagCopied" class="mt-2 ml-2 text-sm text-emerald-700 dark:text-emerald-300">{{t('diagCopied')}}</span>`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 3], ['stream:true', 3],
    // v23-Nachfolger (kein Length-Limit): 4->1 / 2->0 (exakt in v23).
    // v23-Nachfolger (Request-Echo): reasoning_effort 4->10 (exakt in v23).
    ['budgetRetryable', 3],
    ['gbody.reasoning_effort="low"', 1],
    ['mbody.reasoning_effort="low"', 1],
    ['reasoning_effort="none"', 0],
    ['stream_options', 4],
    ['reasoningAllowed', 5],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 7], ['_lastHttp', 6],
    // v23-Nachfolger: _lastRetry 6->7, Build v22->v23 (Toleranz unten).
    ['staleHint', 2], ['buildTag', 3],
    ['Build v21', 0], ['Strg+F5', 1],
    ['slice(0,200)', 2], ['slice(0,160)', 0],
    ['slice(0,2048)', 2],
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    ['Kein Nachdenken, keine Einleitung', 2],
    ['diagText:function', 1], ['copyDiag:function', 1],
    ['copyDiagBtn', 4],
    ['diagCopied:false', 1],
    ['reasonSample', 7],
    ['usageReasoning', 3], ['usageCompletion', 3],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v23-Toleranz: kein Length-Limit (4/2/2 -> 1/0/0), Request-Echo
  // (reasoning 4->10, _lastRetry 6->7, Build v22->v23).
  const is23 = s.includes('standalone-build v23');
  must(cnt(s, 'max_completion_tokens') === 4 || (is23 && cnt(s, 'max_completion_tokens') === 1), 'Invariante max_completion_tokens: ' + cnt(s, 'max_completion_tokens') + ', erwartet 4 (v23: 1)');
  must(cnt(s, 'max_completion_tokens:65536') === 2 || (is23 && cnt(s, 'max_completion_tokens:65536') === 0), 'Invariante max_completion_tokens:65536: ' + cnt(s, 'max_completion_tokens:65536') + ', erwartet 2 (v23: 0)');
  must(cnt(s, 'max_completion_tokens=131072') === 2 || (is23 && cnt(s, 'max_completion_tokens=131072') === 0), 'Invariante max_completion_tokens=131072: ' + cnt(s, 'max_completion_tokens=131072') + ', erwartet 2 (v23: 0)');
  must(cnt(s, 'reasoning_effort') === 4 || (is23 && cnt(s, 'reasoning_effort') === 10), 'Invariante reasoning_effort: ' + cnt(s, 'reasoning_effort') + ', erwartet 4 (v23: 10)');
  must(cnt(s, '_lastRetry') === 6 || (is23 && cnt(s, '_lastRetry') === 7), 'Invariante _lastRetry: ' + cnt(s, '_lastRetry') + ', erwartet 6 (v23: 7)');
  must(cnt(s, 'Build v22') === 1 || (is23 && cnt(s, 'Build v22') === 0), 'Invariante Build v22: ' + cnt(s, 'Build v22') + ', erwartet 1 (v23: 0)');
  must(cnt(s, 'Build v23') === 0 || (is23 && cnt(s, 'Build v23') === 1), 'Invariante Build v23: ' + cnt(s, 'Build v23') + ', erwartet 0 (v23: 1)');
  for (const [sub, want] of [['gbody.max_tokens=65536', 1], ['mbody.max_tokens=65536', 1], ['gbody.max_tokens=131072', 1], ['mbody.max_tokens=131072', 1]]) {
    must(cnt(s, sub) === want || (is23 && cnt(s, sub) === 0), 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want + ' (v23: 0)');
  }
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v22 Diagnose-Export + Thinking-Budget low)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v22: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v21-thinking-reduktion',
    standalone: 'v22',
   Dokubefund: [
      'Baseten reasoning-Doku: Muse Spark Open Always on / Control None, low/medium/high/xhigh(default) (docs.baseten.co/inference/model-apis/reasoning)',
      'Meta prompting-Doku: nur low/medium/high/xhigh, none rejected (dev.meta.ai/docs/muse-spark-open/prompting)',
      'Meta deploy-Doku: none is rejected, Kontext 1048576 (dev.meta.ai/docs/muse-spark-open/deploy)',
      'Meta settings: low=8/medium=32/high=256/xhigh=512 default (dev.meta.ai/docs/muse-spark-open/settings)',
      'Meta reasoning: Reasoning-Tokens in Output-Budget/Billing (dev.meta.ai/docs/reasoning)',
      'Baseten blog: 1M Kontext, reasoning output (baseten.co/blog/muse-spark-open-launch)',
    ],
    fixes: [
      'F1 Baseten-Extras: reasoning_effort low statt none (kleinstes belegtes Budget, nur baseten-direct)',
      'F2 Reader: Usage-Zahlen + Reasoning-Auszug (2KB) im _lastChatInfo',
      'F3 Diagnose-Copy-Button im Fehlerzustand (redigiert, ohne Key, de/en/es)',
      'F4 Diagnose-Stempel Build v22',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v22: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v21'), 'kein v21-Stempel (falsche Basis)');
if (s.includes('standalone-build v22')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v22: bereits v22 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F1: Thinking-Budget low statt none (generate + modify) ----------
s = rep1(s, 'gbody.reasoning_effort="none"', 'gbody.reasoning_effort="low"', 'Thinking-Budget gen');
s = rep1(s, 'mbody.reasoning_effort="none"', 'mbody.reasoning_effort="low"', 'Thinking-Budget mod');

// ---------- F2: Usage-Zahlen + Reasoning-Auszug im Reader ----------
s = rep1(s,
  'i.usage=rt+ev.usage.completion_tokens+" tokens";',
  'i.usage=rt+ev.usage.completion_tokens+" tokens";try{i.usageCompletion=ev.usage.completion_tokens;var rtv=null;try{if(typeof ev.usage.reasoning_tokens==="number"){rtv=ev.usage.reasoning_tokens;}else if(ev.usage.completion_tokens_details&&typeof ev.usage.completion_tokens_details.reasoning_tokens==="number"){rtv=ev.usage.completion_tokens_details.reasoning_tokens;}}catch(eD2){}i.usageReasoning=rtv;}catch(eU){}',
  'Usage-Zahlen');
s = rep1(s,
  'if(hr(d)||hr(m)){i.reason++;}',
  'if(hr(d)||hr(m)){i.reason++;try{var rs="";try{var ddr=d||null;if(ddr&&typeof ddr.reasoning_content==="string"&&ddr.reasoning_content){rs=ddr.reasoning_content;}else if(ddr&&typeof ddr.reasoning==="string"&&ddr.reason){rs=ddr.reasoning;}else if(ddr&&typeof ddr.reason==="string"&&ddr.reason){rs=ddr.reason;}else if(ddr&&typeof ddr.thinking==="string"&&ddr.thinking){rs=ddr.thinking;}}catch(eD1){}if(!rs){try{var mmr=m||null;if(mmr&&typeof mmr.reasoning_content==="string"&&mmr.reasoning_content){rs=mmr.reasoning_content;}else if(mmr&&typeof mmr.reasoning==="string"&&mmr.reason){rs=mmr.reasoning;}else if(mmr&&typeof mmr.reason==="string"&&mmr.reason){rs=mmr.reason;}else if(mmr&&typeof mmr.thinking==="string"&&mmr.thinking){rs=mmr.thinking;}}catch(eM1){}}if(rs){try{i.reasonSample=String(i.reasonSample||"")+rs;}catch(eS1){}try{if(i.reasonSample&&i.reasonSample.length>2048){i.reasonSample=i.reasonSample.slice(0,2048);}}catch(eS2){}}}catch(eR){}}',
  'Reasoning-Auszug');

// ---------- F3: Copy-Button + Methoden + i18n ----------
s = rep1(s, 'genStatus:"",', 'genStatus:"",diagCopied:false,', 'diagCopied-State');
s = rep1(s, GENSTATUS_ANCHOR, GENSTATUS_NEW, 'Copy-Button Template');
s = rep1(s,
  `copyPrompt:function(){this.genStatus=this.t('directHint');this.genStatusBad=false;},`,
  NEW_DIAG_METHODS + `copyPrompt:function(){this.genStatus=this.t('directHint');this.genStatusBad=false;},`,
  'Diagnose-Methoden');
s = rep1(s,
  'promptCopied:"Prompt in Zwischenablage kopiert.",',
  'promptCopied:"Prompt in Zwischenablage kopiert.",copyDiagBtn:"Diagnose kopieren",diagCopied:"Diagnose kopiert (ohne Key).",',
  'i18n de');
s = rep1(s,
  'promptCopied:"Prompt copied to clipboard.",',
  'promptCopied:"Prompt copied to clipboard.",copyDiagBtn:"Copy diagnostics",diagCopied:"Diagnostics copied (no key).",',
  'i18n en');
s = rep1(s,
  'promptCopied:"Prompt copiado al portapapeles.",',
  'promptCopied:"Prompt copiado al portapapeles.",copyDiagBtn:"Copiar diagnóstico",diagCopied:"Diagnóstico copiado (sin clave).",',
  'i18n es');

// ---------- F4: Build-Stempel v22 ----------
s = rep1(s, 'bits.push("Build v21")', 'bits.push("Build v22")', 'Diagnose-Stempel');
s = rep1(s, 'buildTag:function(){return "v21";},', 'buildTag:function(){return "v22";},', 'buildTag');
s = rep1(s, 'var mine=21;', 'var mine=22;', 'staleHint-mine');
s = rep1(s, ',10)||21;', ',10)||22;', 'staleHint-fallback');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v21 (Thinking-Reduktion + 400-Fallback + Reader + Retry/Build-Diagnose, via scripts/build-standalone-v21.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v22 (Diagnose-Export + Thinking-Budget low, via scripts/build-standalone-v22.mjs) -->');
  console.log('  Stempel: v22');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v22: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v22: OK v22 (Diagnose-Export + belegtes Thinking-Budget)');
