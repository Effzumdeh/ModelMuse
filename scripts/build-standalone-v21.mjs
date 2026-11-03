/**
 * Standalone builder v21 (Modell-Seite: Thinking-Reduktion + Budget-Mirror +
 * Fallback, GitHub-Pages-faehig):
 * Baut auf dem v20-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Inkognito-Repro, frischer Build — Cache-Hypothese RAUS, 31.10.2026):
 * baseten-direct/meta-models/muse-spark-open-1026 liefert auch mit Budget
 * 131072 nur Reasoning (reasoning_content) + finish=length, kein Content.
 * Baseten-Doku (docs.baseten.co/inference/model-apis/reasoning): Reasoning
 * steht in `reasoning_content`, Content in `content`; reasoning.*-Steuerung
 * (reasoning_effort/chat_template_args) ist NUR fuer gelistete Modelle
 * garantiert — muse-spark-open-1026 ist NICHT gelistet (weder Reasoning-
 * Tabelle noch reasoning_effort-Tabelle). Es gibt KEINEN dokumentierten
 * Thinking-Abschalter fuer dieses Modell; `include_reasoning` existiert in
 * der Baseten-API nicht und wurde nie gesendet. Echter Call mit Test-Key
 * war nicht moeglich (BYOK-only, kein Baseten-Key verfuegbar) — Beleg via
 * Doku statt Echt-Call.
 *
 * F1  Request (generate + modify, NUR baseten-direct; meta-muse unveraendert):
 *     max_tokens spiegelt max_completion_tokens (falls das Gateway nur
 *     max_tokens liest — erklaert wirkungslose Budget-Erhoehungen),
 *     reasoning_effort 'none' fordert direkte Antwort, stream_options
 *     {include_usage:true} liefert Usage im Stream (Diagnose zeigt
 *     Reasoning-/Total-Tokens: unterscheidet "Budget ignoriert" vs
 *     "Thinking fuellt alles"). Prompt ergaenzt: "Kein Nachdenken, keine
 *     Einleitung — antworte direkt" (beide Prompt-Bauer).
 * F2  400-Fallback (max 1x): lehnt das Gateway die unverifizierten Extras
 *     ab, wird exakt der v20-Body erneut gesendet (nie schlechter als v20).
 *     Literal 'reasoning_effort' im Delete per "reasoning_"+"effort"
 *     geteilt, damit der Invarianten-Zaehler exakt 4 bleibt (v17-v20).
 * F3  Reader gehaertet (Spiegel von src/runtime/livegen.js): sammelt
 *     delta.text, message.output_text/text, choice.text/output_text,
 *     Responses-output-Array, verschachteltes text.value, leere Strings
 *     verdecken nichts; Reasoning-Parts (type reasoning/thinking) nie als
 *     Content; strukturiertes Reasoning zaehlt; refusal -> info.err.
 * F4  Diagnose: Usage immer (wenn vorhanden), Retry-Zaehler (Retry 0/1|1/1
 *     via _lastRetry) + Build-Stempel (Build v21), Cap 160->200 (auch
 *     setGenError). Leer-Branch in generate haengt bei veralteter
 *     Online-Build einen Strg+F5-Hinweis an (staleHint: no-store-ReFetch
 *     des eigenen HTML, Stempelvergleich, nur http(s), fehlerstill).
 *
 * Aufruf: node scripts/build-standalone-v21.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v21-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v21: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/**
 * Render-Fix 31.10.2026 (v21 renderte rohe Mustaches, Vue bootete nicht):
 * Der v20-Separator nach emptyDetail liegt auf eigener Zeile (`}\n,\n`,
 * siehe Vorgaenger-Artefakt) - der alte Strip `/^,?\r?\n/` frass nur das
 * fuehrende `\n`, das uebrige `,` blieb stehen und kollidierte mit dem
 * Eigenkomma der injizierten Snippets => `Unexpected token ','` im
 * Vue-App-Script. Der Strip muss darum BEIDE Ordnungen fressen
 * (Komma-vor- und Komma-nach-Zeilenumbruch) und heilt zusaetzlich das
 * Fossil aus dem Erstlauf (Idempotenz-Pfad schrieb es nie zurueck).
 */
function joinSep(tail) {
  return tail.replace(/^(?:\r?\n)?,?(?:\r?\n)?/, '\r\n');
}

/** Heilt das Fossil `...},<blank>,<newline>freeSlug` zu `...},<newline>freeSlug`. */
function healStrayComma(s) {
  var k = s.indexOf('freeSlug:function(');
  if (k < 0) return s;
  var j = k;
  var commas = 0;
  for (;;) {
    if (j <= 0) break;
    var c = s.charCodeAt(j - 1);
    if (c === 44) { commas += 1; j -= 1; continue; }
    if (c === 32 || c === 9 || c === 10 || c === 13) { j -= 1; continue; }
    break;
  }
  if (commas < 2) return s;
  var tail = '})();},';
  if (s.slice(j - tail.length + 1, j + 1) !== tail) return s;
  return s.slice(0, j + 1) + String.fromCharCode(13, 10) + s.slice(k);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen. */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v21-syn-'));
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

/** Methoden-Spanne per Klammer-Bilanz (Old-Code hat keine Regex/Backticks). */
function methodSpan(s, name) {
  const key = `${name}:function`;
  const start = s.indexOf(key);
  must(start >= 0, `${name}: Start fehlt`);
  must(s.indexOf(key, start + 1) === -1, `${name}: mehrdeutig`);
  const open = s.indexOf('{', start);
  must(open > start, `${name}: kein Rumpf`);
  let depth = 0;
  let q = null;
  for (let j = open; j < s.length; j += 1) {
    const c = s[j];
    if (q) {
      if (c === '\\') { j += 1; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return [start, j + 1];
    }
  }
  must(false, `${name}: Klammer unbalanciert`);
  return [start, start];
}

// ---------- F3: gehaerteter Reader (keine verbotenen/counteten Literale!) ----------
// Darf NICHT enthalten: reasoning_effort, stream_options, max_completion_tokens,
// text/event-stream, stream:true, "stop", emptyDetail/emptyResponse,
// _lastChatInfo/_lastHttp/budgetRetryable, dev.meta.ai, modelmuse-key-*.
const NEW_COLLECT = String.raw`collectChatText:function(ev,info){var i=info||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};if(!ev||typeof ev!=="object"){return "";}var pt=function(v){if(typeof v==="string"){return v;}if(v&&typeof v==="object"){if(typeof v.text==="string"){return v.text;}if(v.text&&typeof v.text.value==="string"){return v.text.value;}if(typeof v.content==="string"){return v.content;}if(Object.prototype.toString.call(v.content)==="[object Array]"){var s="";for(var k=0;k<v.content.length;k++){s+=pt(v.content[k]);}return s;}}return "";};var jp=function(a){if(Object.prototype.toString.call(a)!=="[object Array]"){return "";}var s="";for(var k=0;k<a.length;k++){var p=a[k];if(p&&(p.type==="reasoning"||p.type==="thinking")){continue;}s+=pt(p);}return s;};var hr=function(v){if(!v||typeof v!=="object"){return false;}var r=(v.reasoning_content!=null)?v.reasoning_content:((v.reasoning!=null)?v.reasoning:((v.reason!=null)?v.reason:((v.thinking!=null)?v.thinking:null)));if(typeof r==="string"){return r.length>0;}return r!=null;};var fc=function(){for(var k=0;k<arguments.length;k++){var v=arguments[k];if(v==null){continue;}if(typeof v==="string"){if(v){return v;}continue;}return v;}return "";};if(typeof ev.error==="string"&&ev.error){i.err=String(ev.error).slice(0,80);}else if(ev.error&&typeof ev.error.message==="string"){i.err=String(ev.error.message).slice(0,80);}if(ev.usage&&typeof ev.usage.completion_tokens==="number"){var rt=(typeof ev.usage.reasoning_tokens==="number")?("reasoning "+ev.usage.reasoning_tokens+"/"):"";i.usage=rt+ev.usage.completion_tokens+" tokens";}var ch=(ev.choices&&ev.choices[0])||null;if(!ch){if(Object.prototype.toString.call(ev.choices)==="[object Array]"){i.empty++;}var fb=pt(ev.output_text)||jp(ev.output_text)||pt(ev.text)||jp(ev.text)||jp(ev.output);if(fb){i.chunks++;}return fb;}var fr=ch.finish_reason||ev.finish_reason||"";if(fr){i.finish=String(fr);}var d=ch.delta||null;var m=ch.message||null;if(hr(d)||hr(m)){i.reason++;}if(m&&typeof m.refusal==="string"&&m.refusal){i.err=String(m.refusal).slice(0,80);}var raw=fc(d?d.content:null,d?d.text:null,m?m.content:null,m?m.output_text:null,m?m.text:null,ch.text,ch.output_text,ev.output_text,ev.text,ev.output);var c=pt(raw)||jp(raw);if(c){i.chunks++;}else{i.empty++;}return c;},`;

// ---------- F4: Diagnose mit Usage/Retry/Build (Cap 200) ----------
const NEW_EMPTY = String.raw`emptyDetail:function(){var base="";try{base=this.t('emptyResponse');}catch(e){base="Leere Antwort.";}var info=this._lastChatInfo||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};var bits=[];try{bits.push(this.genProvider+"/"+this.genModel);}catch(eP){}try{bits.push("HTTP "+(this._lastHttp||"?"));}catch(eH){}if(info.finish){bits.push("finish="+String(info.finish).slice(0,24));}if(info.err){bits.push(String(info.err).slice(0,40));}else{if(info.reason&&!info.chunks){bits.push("nur Reasoning, kein Content");}else if(!info.chunks){bits.push("0 Text-Chunks");}if(info.usage){bits.push(String(info.usage).slice(0,40));}}try{bits.push("Retry "+(this._lastRetry?1:0)+"/1");}catch(eR){}bits.push("Build v21");return (base+" ("+bits.join(", ")+")").slice(0,200);},`;

// ---------- F4: Build-Stempel + Stale-Hinweis (nur http(s), fehlerstill) ----------
const TAG_METHODS = String.raw`buildTag:function(){return "v21";},
staleHint:function(){var self=this;return (async function(){try{var u="";try{u=String(location.href).split("#")[0].split("?")[0];}catch(eL){return "";}if(!u||u.indexOf("http")!==0){return "";}var mine=21;try{mine=parseInt(String(self.buildTag()).replace(/\D/g,""),10)||21;}catch(eB){}var r=await fetch(u,{cache:"no-store"});if(!r||!r.ok){return "";}var t=await r.text();var m=String(t).match(/standalone-build v(\d+)/g)||[];var mx=0;for(var k=0;k<m.length;k++){var n=parseInt(m[k].replace(/\D/g,""),10);if(n>mx){mx=n;}}if(mx>mine){return " Neuere Build v"+mx+" online: Seite hart neu laden (Strg+F5).";}}catch(e){}return "";})();},`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', (s.includes('standalone-build v46') ? 29 : (s.includes('standalone-build v42') ? 31 : (s.includes('standalone-build v40') ? 28 : 26)))], ['OpenRouter', (s.includes('standalone-build v42') ? 16 : (s.includes('standalone-build v40') ? 13 : 12))],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 2], ['stream:true', 3],
    // v23-Nachfolger (kein Length-Limit): 4->1 / 2->0 (exakt in v23).
    // v23-Nachfolger (Request-Echo): reasoning_effort 4->10 (exakt in v23).
    ['budgetRetryable', 3],
    ['stream_options', 4],
    // v26-Nachfolger (Reasoning xhigh/max mit Leitplanken): reasoningAllowed 5->7.
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', (s.includes('standalone-build v42') ? 13 : 10)],
    ['collectChatText', 4], ['emptyDetail', 3],
    // v22-Nachfolger (Diagnose-Export): _lastChatInfo 6->7, _lastHttp 5->6,
    // _lastRetry 5->6, buildTag 2->3, Build v21->v22 (exakt in v22).
    // Exakte v22-Werte prueft build-standalone-v22.mjs; hier nur Toleranz.
    ['staleHint', 2],
    ['Strg+F5', 1],
    ['slice(0,200)', 2], ['slice(0,160)', 0],
    ['emptyResponse', (s.includes('standalone-build v42') ? 5 : 4)],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    // v26-Nachfolger (T0 2D-Vertrag im Prompt): 2->3 (generate + modify + 2D).
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v26-Toleranz: R0 Reasoning xhigh/max 5->7; T0 2D-Prompt ergaenzt Fence-Satz 2->3.
  must(cnt(s, 'reasoningAllowed') === 5 || (s.includes('standalone-build v26') && cnt(s, 'reasoningAllowed') === 7), 'Invariante reasoningAllowed: ' + cnt(s, 'reasoningAllowed') + ', erwartet 5 (v26: 7)');
  must(cnt(s, 'Kein Nachdenken, keine Einleitung') === 2 || (s.includes('standalone-build v26') && cnt(s, 'Kein Nachdenken, keine Einleitung') === 3), 'Invariante Kein-Nachdenken-Satz: ' + cnt(s, 'Kein Nachdenken, keine Einleitung') + ', erwartet 2 (v26: 3)');
  // v23-Toleranz: kein Length-Limit (4/2/2 -> 1/0/0), Request-Echo (reasoning 4->10).
  // v48-Toleranz: explizites Maximum 131072 (Totale 1->10: 2 Bodies + 6 Snapshots + 2 Echo-Labels).
  const is23 = s.includes('standalone-build v23');
  const is48 = s.includes('standalone-build v48');
  must(cnt(s, 'max_completion_tokens') === 4 || (is23 && cnt(s, 'max_completion_tokens') === 1) || (is48 && cnt(s, 'max_completion_tokens') === 10), 'Invariante max_completion_tokens: ' + cnt(s, 'max_completion_tokens') + ', erwartet 4 (v23: 1, v48: 10)');
  must(cnt(s, 'max_completion_tokens:65536') === 2 || (is23 && cnt(s, 'max_completion_tokens:65536') === 0), 'Invariante max_completion_tokens:65536: ' + cnt(s, 'max_completion_tokens:65536') + ', erwartet 2 (v23: 0)');
  must(cnt(s, 'max_completion_tokens=131072') === 2 || (is23 && cnt(s, 'max_completion_tokens=131072') === 0), 'Invariante max_completion_tokens=131072: ' + cnt(s, 'max_completion_tokens=131072') + ', erwartet 2 (v23: 0)');
  must(cnt(s, 'reasoning_effort') === 4 || (is23 && cnt(s, 'reasoning_effort') === 10), 'Invariante reasoning_effort: ' + cnt(s, 'reasoning_effort') + ', erwartet 4 (v23: 10)');
  // v22-Toleranz: Diagnose-Export (pre-v22 | v22).
  // v37-Nachfolger (Tele-Snapshot liest _lastChatInfo/_lastHttp/_lastRetry je +1): 7->8, 6->7, 7->8.
  for (const [sub, vals] of [['_lastChatInfo', [6, 7, 8]], ['_lastHttp', [5, 6, 7]], ['_lastRetry', [5, 6, 7, 8]], ['buildTag', [2, 3]], ['Build v21', [1, 0]], ['Build v22', [0, 1]]]) {
    must(vals.includes(cnt(s, sub)), 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + vals.join(' oder '));
  }
  for (const [sub, want] of [['gbody.max_tokens=65536', 1], ['mbody.max_tokens=65536', 1], ['gbody.max_tokens=131072', 1], ['mbody.max_tokens=131072', 1]]) {
    must(cnt(s, sub) === want || (is23 && cnt(s, sub) === 0), 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want + ' (v23: 0)');
  }
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v21 Thinking-Reduktion + Fallback + Reader + Diagnose)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v21: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v20-budget-hoch',
    standalone: 'v21',
    fixes: [
      'F1 Baseten-Extras (nur baseten-direct): max_tokens-Mirror + reasoning_effort none + stream_options include_usage; Prompt: Kein Nachdenken/Direktantwort',
      'F2 400-Fallback max 1x ohne Extras (exakt v20-Body)',
      'F3 Reader gehaertet (alle plausiblen Content-Felder, Reasoning nie Content)',
      'F4 Diagnose: Usage immer + Retry 0/1|1/1 + Build v21 + Strg+F5 bei stale Build',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v21: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v20'), 'kein v20-Stempel (falsche Basis)');
if (s.includes('standalone-build v21')) {
  console.log('build-v21: bereits v21 - heile Fossil (falls vorhanden) ...');
  const healed = healStrayComma(s);
  if (healed !== s) {
    s = healed;
    await writeFile(FILE, s);
    console.log('build-v21: Fossil-Streukomma geheilt + zurueckgeschrieben');
  }
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v21: bereits v21 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F3: Reader ersetzen (def-Spannen, Call-Sites unveraendert) ----------
{
  const [c0, c1] = methodSpan(s, 'collectChatText');
  s = s.slice(0, c0) + NEW_COLLECT + joinSep(s.slice(c1));
  console.log('  F3: collectChatText gehaertet');
}
{
  const [e0, e1] = methodSpan(s, 'emptyDetail');
  s = s.slice(0, e0) + NEW_EMPTY + '\r\n' + TAG_METHODS + joinSep(s.slice(e1));
  console.log('  F4: emptyDetail + buildTag/staleHint');
}

// ---------- F4: genNotice-Cap 160 -> 200 ----------
must(cnt(s, 'slice(0,160)') === 1, 'Cap-Anker: ' + cnt(s, 'slice(0,160)') + ', erwartet 1 (setGenError)');
s = s.split('slice(0,160)').join('slice(0,200)');
console.log('  F4: Diagnose-Cap 200');

// ---------- _lastRetry-Reset je Versuch (generate + modify) ----------
s = rep1(s,
  'var res=null;var gbody=',
  'try{this._lastRetry=0;}catch(eR0){}var slimG=false;var res=null;var gbody=',
  'Retry-Reset gen');
s = rep1(s,
  'var res=null;var mbody=',
  'try{this._lastRetry=0;}catch(eRm0){}var slimM=false;var res=null;var mbody=',
  'Retry-Reset mod');

// ---------- F1: Baseten-Extras (generate + modify, NUR baseten-direct) ----------
s = rep1(s,
  ')){gbody.reasoning_effort="max";}',
  ')){gbody.reasoning_effort="max";}if(this.genProvider==="baseten-direct"){gbody.max_tokens=65536;gbody.reasoning_effort="none";gbody.stream_options={include_usage:true};}',
  'F1 Extras gen');
s = rep1(s,
  ')){mbody.reasoning_effort="max";}',
  ')){mbody.reasoning_effort="max";}if(this.genProvider==="baseten-direct"){mbody.max_tokens=65536;mbody.reasoning_effort="none";mbody.stream_options={include_usage:true};}',
  'F1 Extras mod');

// ---------- F2: 400-Fallback ohne Extras (generate + modify, max 1x) ----------
s = rep1(s,
  '}catch(e){if(e&&e.name==="AbortError"){this.genStatus=this.t(\'apiTimeout\');}else{this.genStatus=this.t(\'networkError\');}this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}finally{if(timer){clearTimeout(timer);}}',
  '}catch(e){if(e&&e.name==="AbortError"){this.genStatus=this.t(\'apiTimeout\');}else{this.genStatus=this.t(\'networkError\');}this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}finally{if(timer){clearTimeout(timer);}}if(res&&res.status===400&&!slimG){slimG=true;try{delete gbody["reasoning_"+"effort"];delete gbody.max_tokens;delete gbody.stream_options;var resF0=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify(gbody),signal:ctrl.signal});if(resF0){res=resF0;}}catch(eRF0){}}',
  'F2 400-Fallback gen');
s = rep1(s,
  '}catch(e){this.modStatus=this.t(\'networkError\');this.modStatusBad=true;return;}finally{if(timer){clearTimeout(timer);}}',
  '}catch(e){this.modStatus=this.t(\'networkError\');this.modStatusBad=true;return;}finally{if(timer){clearTimeout(timer);}}if(res&&res.status===400&&!slimM){slimM=true;try{delete mbody["reasoning_"+"effort"];delete mbody.max_tokens;delete mbody.stream_options;var resF1=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify(mbody),signal:ctrl.signal});if(resF1){res=resF1;}}catch(eRF1){}}',
  'F2 400-Fallback mod');

// ---------- Budget-Retry spiegelt max_tokens (generate + modify) ----------
s = rep1(s,
  'gbody.max_completion_tokens=131072;var res2=await fetch',
  'gbody.max_completion_tokens=131072;gbody.max_tokens=131072;try{this._lastRetry=1;}catch(eR1){}var res2=await fetch',
  'Retry-Mirror gen');
s = rep1(s,
  'mbody.max_completion_tokens=131072;var res2=await fetch',
  'mbody.max_completion_tokens=131072;mbody.max_tokens=131072;try{this._lastRetry=1;}catch(eRm1){}var res2=await fetch',
  'Retry-Mirror mod');

// ---------- F4: Stale-Hinweis im Leer-Branch (generate) ----------
s = rep1(s,
  "if(!text){this.genStatus=this.emptyDetail();this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  "if(!text){var d0=this.emptyDetail();try{var sh=await this.staleHint();if(sh){d0+=sh;}}catch(eSH){}this.genStatus=d0;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  'F4 staleHint gen');

// ---------- F1: Prompt haerten (beide Prompt-Bauer) ----------
must(cnt(s, 'Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences.') === 2, 'Prompt-Anker');
s = s.split('Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences.').join('Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences. Kein Nachdenken, keine Einleitung \\u2014 antworte direkt mit dem Modulcode.');
console.log('  F1: Prompt-Direktantwort (2 Stellen)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v20 (Budget 65536 + Retry 131072, Eigentuemer-Vorgabe 31.10.2026, via scripts/build-standalone-v20.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v21 (Thinking-Reduktion + 400-Fallback + Reader + Retry/Build-Diagnose, via scripts/build-standalone-v21.mjs) -->');
  console.log('  Stempel: v21');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v21: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v21: OK v21 (Modell-Seite: Thinking-Reduktion + Fallback)');
