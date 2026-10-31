/**
 * Standalone builder v18 (leere-Antwort-Fix + Viewer-v-if, GitHub-Pages-faehig):
 * Baut auf dem v17-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Hintergrund (Beleg 30.10.2026, probe-api + Live-Calls mit Meta-Key):
 * Muse-Modelle verbrennen das Output-Budget fast vollstaendig mit privatem
 * Hidden-Reasoning (live: reasoning_tokens=198/200, message.content=null,
 * finish_reason=length; SSE: leere Deltas + stop, kein sichtbarer Text).
 * Der v17-Reader sammelte nur choices[0].delta/message.content als String und
 * meldete sonst generisch "Leere Antwort" — ohne Provider/Modell/Status.
 *
 * R1  collectChatText(ev,info): sammelt delta.content + message.content +
 *     choices[0].text + output_text/text (String ODER Text-Parts-Array),
 *     ignoriert Reasoning-Felder (reasoning_content/reasoning: nur gezaehlt,
 *     nie abgebrochen), toleriert leere choices + Error-Envelopes
 *     (gateway_timeout & Co. landen in info.err statt im Nichts).
 * R2  readSseText/readChatText nutzen collectChatText; SSE-Content-Type mit
 *     reinem JSON-Body faellt auf JSON zurueck; Diagnose in _lastChatInfo.
 *     Unveraendert: stream:true, max_completion_tokens=8000, Temperatur,
 *     Reasoning-Gate, Body-Felder (keine verbotenen Felder).
 * R3  emptyDetail(): "Leere Antwort" + (provider/modell, HTTP status,
 *     finish_reason/Reasoning-/Usage-Hinweis), max. 160 Zeichen (genNotice).
 *     generate() nutzt es in beiden Leer-Branchen; _lastHttp je Call.
 * OOB-A (Designlob Eigentuemer): 3D-Viewer bei leerer Modellliste per
 *     v-if="labs.length" ausblenden (nur Empty-State + Generator sichtbar);
 *     selectLab nach Generierung via $nextTick, damit die Buehne beim ersten
 *     Modell wieder da ist (v-if rendert erst, loadLab braucht #viewport).
 *
 * Aufruf: node scripts/build-standalone-v18.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v18-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v18: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
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

// ---------- R1/R2: robuste Reader (keine verbotenen Literale!) ----------
// Darf NICHT enthalten (verify-Invarianten): "stop", max_output_tokens,
// logprobs, logit_bias, modalities, web_search_options, openrouter,
// zweites text/event-stream, zweites {stream:true}.
const COLLECT = String.raw`collectChatText:function(ev,info){var i=info||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};if(!ev||typeof ev!=="object"){return "";}if(typeof ev.error==="string"&&ev.error){i.err=String(ev.error).slice(0,80);}else if(ev.error&&typeof ev.error.message==="string"){i.err=String(ev.error.message).slice(0,80);}if(ev.usage&&typeof ev.usage.completion_tokens==="number"){var rt=(typeof ev.usage.reasoning_tokens==="number")?("reasoning "+ev.usage.reasoning_tokens+"/"):"";i.usage=rt+ev.usage.completion_tokens+" tokens";}var ch=(ev.choices&&ev.choices[0])||null;if(!ch){if(Object.prototype.toString.call(ev.choices)==="[object Array]"){i.empty++;}var fb=(typeof ev.output_text==="string"&&ev.output_text)||(typeof ev.text==="string"&&ev.text)||"";if(fb){i.chunks++;}return fb;}var fr=ch.finish_reason||ev.finish_reason||"";if(fr){i.finish=String(fr);}var d=ch.delta||null;var m=ch.message||null;if((d&&(typeof d.reasoning_content==="string"||typeof d.reason==="string"))||(m&&(typeof m.reasoning_content==="string"||typeof m.reasoning==="string"))){i.reason++;}var raw=(d&&d.content!=null)?d.content:((m&&m.content!=null)?m.content:((ch.text!=null)?ch.text:((ev.output_text!=null)?ev.output_text:((ev.text!=null)?ev.text:""))));var c="";if(typeof raw==="string"){c=raw;}else if(raw&&typeof raw.text==="string"){c=raw.text;}else if(Object.prototype.toString.call(raw)==="[object Array]"){for(var k=0;k<raw.length;k++){var p=raw[k];if(typeof p==="string"){c+=p;}else if(p&&typeof p.text==="string"){c+=p.text;}}}if(c){i.chunks++;}else{i.empty++;}return c;},`;

const READ_SSE = String.raw`readSseText:function(res){var self=this;return (async function(){var out="";var info={chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};var reader=null;try{reader=res.body.getReader();}catch(eG){info.err="kein Stream";try{self._lastChatInfo=info;}catch(eS){}return "";}var dec=new TextDecoder();var buf="";var raw="";var feed=function(line){var ln=String(line).trim();if(ln.indexOf("data:")!==0){if(ln){raw+=ln+"\n";}return;}var pay=ln.slice(5).trim();if(!pay||pay==="[DONE]"){return;}var evt=null;try{evt=JSON.parse(pay);}catch(pe){out+=pay;info.chunks++;return;}var c="";try{c=self.collectChatText(evt,info);}catch(ce){c="";}if(c){out+=c;}};for(;;){var step=await reader.read();if(step.done){break;}buf+=dec.decode(step.value,{stream:true});var lines=buf.split("\n");buf=lines.pop();for(var j=0;j<lines.length;j++){feed(lines[j]);}}var tail=String(raw+buf).trim();if(tail.indexOf("data:")===0){feed(tail);}else if(out===""&&tail.charAt(0)==="{"){try{var tc=self.collectChatText(JSON.parse(tail),info);if(tc){out+=tc;}}catch(te){}}try{self._lastChatInfo=info;}catch(eL){}return out;})();},`;

const READ_CHAT = String.raw`readChatText:function(res){var self=this;var ct="";try{ct=res.headers.get("content-type")||"";}catch(e){ct="";}if(ct.indexOf("text/event-stream")>=0){return this.readSseText(res);}return (async function(){var data=null;try{data=await res.json();}catch(e2){try{self._lastChatInfo={chunks:0,empty:1,reason:0,finish:"",err:"kein JSON",usage:""};}catch(e3){}return "";}var info={chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};var t="";try{t=self.collectChatText(data,info);}catch(e4){t="";}try{self._lastChatInfo=info;}catch(e5){}return t||"";})();},`;

const EMPTY_DETAIL = String.raw`emptyDetail:function(){var base="";try{base=this.t('emptyResponse');}catch(e){base="Leere Antwort.";}var info=this._lastChatInfo||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};var bits=[];try{bits.push(this.genProvider+"/"+this.genModel);}catch(eP){}try{bits.push("HTTP "+(this._lastHttp||"?"));}catch(eH){}if(info.finish){bits.push("finish="+String(info.finish).slice(0,24));}if(info.err){bits.push(String(info.err).slice(0,40));}else if(info.reason&&!info.chunks){bits.push("nur Reasoning, kein Content");}else if(info.usage){bits.push(String(info.usage).slice(0,40));}else if(!info.chunks){bits.push("0 Text-Chunks");}return (base+" ("+bits.join(", ")+")").slice(0,160);}`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 3], ['stream:true', 3],
    // v21-Nachfolger (Thinking-Reduktion): reasoning_effort 2->4 (exakt in v21).
    // Exakte v21-Werte prueft build-standalone-v21.mjs; hier nur Toleranz.
    ['reasoningAllowed', 5],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    ['collectChatText', 4], ['emptyDetail', 3],
    // v19-Nachfolger (Budget+Retry) veraendert diese Zaehler zusaetzlich:
    // max_completion_tokens 2->4, _lastChatInfo 5->6, _lastHttp 3->5.
    // Exakte v19-Werte prueft build-standalone-v19.mjs; hier nur Toleranz.
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v19-Toleranz: Budget+Retry erhoeht diese Zaehler (pre-v19 | v19).
  // v21-Toleranz: Thinking-Reduktion (pre-v21: 2 | v21: 4).
  for (const [sub, olds, news] of [['max_completion_tokens', 2, 4], ['_lastChatInfo', 5, 6], ['_lastHttp', 3, 5], ['reasoning_effort', 2, 4]]) {
    must(cnt(s, sub) === olds || cnt(s, sub) === news, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + olds + ' oder ' + news);
  }
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v18 Reader-Diagnose + Viewer-v-if)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v18: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v17-provider-umschalter',
    standalone: 'v18',
    fixes: [
      'R1 collectChatText: delta+message+text+output_text (String/Array), Reasoning nur gezaehlt',
      'R2 SSE/JSON-Fallback inkl. JSON-Body bei SSE-Content-Type, Diagnose in _lastChatInfo',
      'R3 emptyDetail: Provider/Modell/HTTP/finish statt nur Leere Antwort',
      'OOB-A Viewer v-if labs.length + $nextTick-selectLab beim ersten Modell',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v18: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v17'), 'kein v17-Stempel (falsche Basis)');
if (s.includes('standalone-build v18')) {
  console.log('build-v18: bereits v18 — pruefe Migrationen ...');
  if (!s.includes('var raw="";var feed')) {
    const mc = methodSpan(s, 'collectChatText');
    const me = methodSpan(s, 'emptyDetail');
    s = s.slice(0, mc[0]) + COLLECT + '\r\n' + READ_SSE + '\r\n' + READ_CHAT + '\r\n' + EMPTY_DETAIL + s.slice(me[1]).replace(/^,\r\n,/, ",");
    await writeFile(FILE, s);
    console.log('  R2-Migration: Reader-Block aktualisiert');
    await writeReport(s);
  }
  checkInvariants(s);
  console.log('build-v18: bereits v18 — ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- R1/R2: Reader ersetzen ----------
{
  const [a0, a1] = methodSpan(s, 'readSseText');
  const [b0, b1] = methodSpan(s, 'readChatText');
  must(a1 < b0, 'R: Methoden-Reihenfolge unerwartet');
  s = s.slice(0, a0) + COLLECT + '\r\n' + READ_SSE + '\r\n' + READ_CHAT + '\r\n' + EMPTY_DETAIL + '\r\n' + s.slice(b1);
  console.log('  R1/R2: Reader ersetzt (collectChatText + readSseText + readChatText + emptyDetail)');
}

// ---------- R3: _lastHttp je Call (generate + modify, je 1x) ----------
{
  const anchor = 'var text="";try{text=await this.readChatText(res);}catch(e){text="";}';
  must(cnt(s, anchor) === 2, 'R3 _lastHttp-Anker: ' + cnt(s, anchor) + ', erwartet 2');
  s = s.split(anchor).join('var text="";try{try{this._lastHttp=res.status;}catch(eH){}text=await this.readChatText(res);}catch(e){text="";}');
  console.log('  R3: _lastHttp je Call');
}

// ---------- R3: Diagnose statt barem emptyResponse (generate, je 1x) ----------
s = rep1(s,
  "if(!text){this.genStatus=this.t('emptyResponse');this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  "if(!text){this.genStatus=this.emptyDetail();this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  'R3 generate-leer');
s = rep1(s,
  "if(!quelle){this.genStatus=this.t('emptyResponse');this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}",
  "if(!quelle){this.genStatus=this.emptyDetail();this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}",
  'R3 generate-quelle-leer');

// ---------- OOB-A: Viewer v-if bei leerer Liste ----------
s = rep1(s,
  '<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all" :aria-label="t(\'viewportTitle\')">',
  '<section v-if="labs.length" class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all" :aria-label="t(\'viewportTitle\')">',
  'OOB-A viewer-v-if');

// ---------- OOB-A: selectLab nach erstem Modell erst nach Re-Render ----------
s = rep1(s,
  'try{this.selectLab(fid);}catch(e){this.activeLabId=fid;if(window.__viewer&&window.__viewer.loadLab){window.__viewer.loadLab(fid,this.level);}}',
  'var wasEmpty=this.labs.length<=1;var doSel=function(){try{self.selectLab(fid);}catch(e){self.activeLabId=fid;if(window.__viewer&&window.__viewer.loadLab){window.__viewer.loadLab(fid,self.level);}}};if(wasEmpty&&self.$nextTick){try{self.$nextTick(doSel);}catch(eN){doSel();}}else{doSel();}',
  'OOB-A nextTick-select');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v17 (Provider-Umschalter: Baseten + Meta/Muse direkt, Streaming-SSE, Keys je Provider, Reasoning nur 1.3/wonder, via scripts/build-standalone-v17.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + '\n<!-- standalone-build v18 (leere-Antwort-Fix: Reasoning-toleranter Reader, Diagnose mit Provider/Modell/Status, Viewer-v-if bei leerer Liste, via scripts/build-standalone-v18.mjs) -->');
  console.log('  Stempel: v18');
}
checkInvariants(s);

await writeFile(FILE, s);
console.log(`build-v18: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v18: OK v18 (Reader-Diagnose + Viewer-v-if)');
