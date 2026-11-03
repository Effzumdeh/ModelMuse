/**
 * Standalone builder v48 (explizites Limit 131072, 03.11.2026):
 * Baut auf dem v47-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Eigentuemer-Alternative 03.11.2026): Weglassen != unbegrenzt —
 * Upstream defaultet ohne Limit-Param auf 32768 (Eisbecher-Fall, belegt).
 * Deshalb wird jetzt in ALLEN Request-Pfaden explizit das Maximum gesendet:
 * max_completion_tokens: 131072 + max_tokens: 131072 (131072 war belegt
 * wirksam). Betroffen (je generate/modify, Erstversuch traegt, Retry und
 * 400-Fallback teilen sich dasselbe Body-Objekt):
 *   - var gbody={...temperature:0.2} -> + max_completion_tokens/max_tokens
 *   - var mbody={...temperature:0.2} -> + max_completion_tokens/max_tokens
 *   - 400-Fallback strippt weiter nur reasoning_effort + stream_options
 *     (Limits ueberleben den Fallback — 400-Fallback bleibt).
 *   - Request-Echo: _lastReq/_lastReqR tragen mc/mt aus dem Body, diagText
 *     zeigt die Werte (Erst + Retry) statt "(nicht gesendet)".
 *
 * Umsetzung:
 * L1/L2 Erst-Body gen/mod: explizites Maximum 131072 (beide Felder).
 * L3-L8 Echo-Snapshots (je gen/mod: Erst + Fallback + Retry) lesen mc/mt.
 * L9/L10 diagText-Vars: rmc/rmt + rrmc/rrmt aus rq/rr (Fallback: nl).
 * L11 diagText: req_retry_max_*-Zeilen (Erst-Zeilen bleiben, zeigen Werte).
 * D1 Diagnose-Stempel v47 -> v48 (alle 5 Stellen, rep1-geprueft).
 * S  Stempel v48 + Invarianten + Syntax-Gate.
 *
 * Nachfolger-Toleranz: v20/v21/v22 (max_completion_tokens-Totale 1->10),
 * v23/v24/v25/v26 (temperature-Prefix 0->2) und v47 (Guard: v48 neuer)
 * tragen die etablierte is48-Toleranz.
 *
 * Aufruf: node scripts/build-standalone-v48.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v48-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v48: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v47 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v48-syn-'));
  try {
    let pos = 0, n = 0, checked = 0;
    for (;;) {
      const open = s.indexOf('<script', pos);
      if (open < 0) break;
      const gt = s.indexOf('>', open);
      if (gt < 0) { must(false, 'Inline-Script: kein Ende des Tags'); }
      const attrs = s.slice(open + 7, gt);
      const low = attrs.toLowerCase();
      const end = s.indexOf('</script>', gt);
      if (end < 0) { must(false, 'Inline-Script: kein Ende'); }
      pos = end + 9;
      if (low.indexOf('src=') >= 0 || low.indexOf('src =') >= 0) continue;
      if (low.indexOf('importmap') >= 0 || low.indexOf('application/json') >= 0) continue;
      n += 1;
      const isMod = low.indexOf('module') >= 0;
      const f = join(dir, 'inline-' + n + (isMod ? '.mjs' : '.js'));
      writeFileSync(f, s.slice(gt + 1, end));
      try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        checked += 1;
      } catch (e) {
        try {
          const detail = String((e.stderr || e.stdout || e.message) || e);
          console.error('build-v48: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v48-inline-' + n + '.js')); } catch {}
        } catch {}
        must(false, 'Inline-Script ' + n + ' parst nicht');
      }
    }
    must(n >= 5, 'zu wenige Inline-Scripts gefunden: ' + n);
    console.log('  Syntax-Gate ok (' + checked + ' Inline-Scripts parsen)');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1], ['standalone-build v31', 1], ['standalone-build v32', 1],
    ['standalone-build v33', 1], ['standalone-build v34', 1], ['standalone-build v35', 1],
    ['standalone-build v36', 1], ['standalone-build v37', 1], ['standalone-build v38', 1],
    ['standalone-build v39', 1], ['standalone-build v40', 1], ['standalone-build v41', 1],
    ['standalone-build v42', 1], ['standalone-build v43', 1], ['standalone-build v44', 1],
    ['standalone-build v45', 1], ['standalone-build v46', 1], ['standalone-build v47', 1],
    ['standalone-build v48', 1],
    // D1: Laufzeit-Diagnose-Stempel v48 (exakt je 1x), Alt-Stempel raus.
    ['bits.push("Build v48")', 1],
    ['bits.push("Build v47")', 0],
    ['var bld="v48";try{bld=this.buildTag();}', 1],
    ['var bld="v47";try{bld=this.buildTag();}', 0],
    ['buildTag:function(){return "v48";},', 1],
    ['buildTag:function(){return "v47";},', 0],
    ['var mine=48;', 1],
    ['var mine=47;', 0],
    [',10)||48;', 1],
    [',10)||47;', 0],
    ['buildTag', 3], ['staleHint', 2], ['Strg+F5', 1],
    // D2: explizites Maximum 131072 in beiden Erst-Bodies (gen+mod);
    // Retry + 400-Fallback teilen sich dasselbe Body-Objekt (keine Literale).
    ['temperature:0.2,max_completion_tokens:131072,max_tokens:131072', 2],
    ['max_completion_tokens:131072', 2],
    ['max_tokens:131072', 2],
    ['max_completion_tokens=131072', 0],
    ['max_completion_tokens:65536', 0],
    ['max_tokens=65536', 0],
    ['max_tokens=131072', 0],
    ['delete gbody.max_tokens', 0],
    ['delete mbody.max_tokens', 0],
    // 400-Fallback bleibt: strippt nur reasoning_effort + stream_options.
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    // Echo-Snapshots tragen mc/mt (je gen/mod: Erst + Fallback + Retry).
    ['this._lastReq={', 4],
    ['_lastReqR', 3],
    ['mc:gbody.max_completion_tokens', 3],
    ['mt:gbody.max_tokens', 3],
    ['mc:mbody.max_completion_tokens', 3],
    ['mt:mbody.max_tokens', 3],
    // Echo-Labels (Erst + Retry): Anzeige bleibt, Werte sind 131072.
    ['req_max_completion_tokens: ', 1],
    ['req_max_tokens: ', 1],
    ['req_retry_max_completion_tokens: ', 1],
    ['req_retry_max_tokens: ', 1],
    ['req_reasoning_effort: ', 1],
    ['req_temperature: ', 1],
    ['req_400_fallback: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    ['req_retry_400_fallback: ', 1],
    ['reasoning_effort', 10],
    ['usage_completion_tokens: ', 2], // diagText-Echo + Tele-Kopiertext (beides Anzeige, kein Request)
    // v46-Features intakt (Spotchecks).
    ['etaSeconds:function(){return 240;}', 1],
    ['id:"ollama"', 1],
    ['footerLic:', 4],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v48 Diagnose-Stempel v48 + explizites Limit 131072)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v48: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v47-diagnose-stempel',
    standalone: 'v48',
    befund: [
      'Weglassen != unbegrenzt: Upstream defaultet ohne Limit-Param auf 32768 (Eisbecher-Fall, belegt). Eigentuemer-Alternative: explizit Maximum senden (131072 war belegt wirksam).',
      'Limit-Audit generate/modify/Retry (direkt, alle Provider): Erst-Bodies trugen kein Limit — v23-Entfernung im Artefakt + livegen.js + proxy.mjs.',
    ],
    fixes: [
      'L1/L2 Erst-Body gen/mod: temperature:0.2 + max_completion_tokens:131072,max_tokens:131072',
      'L3-L8 Echo-Snapshots (je gen/mod Erst+Fallback+Retry): mc/mt aus dem Body gelesen',
      'L9/L10 diagText-Vars: rmc/rmt + rrmc/rrmt aus rq/rr (Fallback: lokalisiertes "nicht gesendet")',
      'L11 diagText: req_retry_max_completion_tokens/req_retry_max_tokens-Zeilen (Erst + Retry)',
      'D1 Laufzeit-Diagnose-Stempel v47 -> v48 (emptyDetail-Bits + diagText-Default + buildTag + staleHint mine/Fallback)',
      'S Stempel v48 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v48: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v47'), 'kein v47-Stempel (falsche Basis)');
if (s.includes('standalone-build v48')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v48: bereits v48 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- L1/L2: Erst-Body gen/mod: explizites Maximum 131072 ----------
s = rep1(s,
  'var gbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2}',
  'var gbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:131072,max_tokens:131072}',
  'Limit-Erst gen');
s = rep1(s,
  'var mbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2}',
  'var mbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:131072,max_tokens:131072}',
  'Limit-Erst mod');
console.log('  L1/L2: Erst-Body gen/mod mit explizitem Maximum 131072 (beide Felder)');

// ---------- L3-L8: Echo-Snapshots lesen mc/mt aus dem Body ----------
// Retry + 400-Fallback teilen sich dasselbe Body-Objekt — Snapshots belegen
// die Werte je Versuch (Diagnose-Echo zeigt 131072).
s = rep1(s,
  'this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,fb:0}',
  'this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:0}',
  'Echo-Snapshot gen');
s = rep1(s,
  'this._lastReq={re:null,te:gbody.temperature,fb:1}',
  'this._lastReq={re:null,te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:1}',
  'Echo-Snapshot gen-Fallback');
s = rep1(s,
  'this._lastReqR={re:(gbody.reasoning_effort||null),te:gbody.temperature,fb:(slimG?1:0)}',
  'this._lastReqR={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:(slimG?1:0)}',
  'Echo-Snapshot gen-Retry');
s = rep1(s,
  'this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,fb:0}',
  'this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:0}',
  'Echo-Snapshot mod');
s = rep1(s,
  'this._lastReq={re:null,te:mbody.temperature,fb:1}',
  'this._lastReq={re:null,te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:1}',
  'Echo-Snapshot mod-Fallback');
s = rep1(s,
  'this._lastReqR={re:(mbody.reasoning_effort||null),te:mbody.temperature,fb:(slimM?1:0)}',
  'this._lastReqR={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:(slimM?1:0)}',
  'Echo-Snapshot mod-Retry');
console.log('  L3-L8: Echo-Snapshots gen/mod (Erst+Fallback+Retry) mit mc/mt');

// ---------- L9/L10: diagText-Vars lesen rmc/rmt + rrmc/rrmt ----------
s = rep1(s,
  'var rmc=nl;var rmt=nl;var ref=nn;',
  'var rmc=nl;try{if(rq&&typeof rq.mc==="number"){rmc=String(rq.mc);}}catch(eF0){}var rmt=nl;try{if(rq&&typeof rq.mt==="number"){rmt=String(rq.mt);}}catch(eF0b){}var ref=nn;',
  'Echo-Vars Erst-Limit');
s = rep1(s,
  'var rre=nn;var rrf=nn2;try{if(hasRr){rre=(rr.re?rr.re:nn);rrf=(rr.fb?yy:nn2);}}catch(eF4){}',
  'var rre=nn;var rrf=nn2;var rrmc=nl;var rrmt=nl;try{if(hasRr){rre=(rr.re?rr.re:nn);rrf=(rr.fb?yy:nn2);if(typeof rr.mc==="number"){rrmc=String(rr.mc);}if(typeof rr.mt==="number"){rrmt=String(rr.mt);}}}catch(eF4){}',
  'Echo-Vars Retry-Limit');
console.log('  L9/L10: diagText-Vars lesen Erst- + Retry-Limit');

// ---------- L11: diagText Retry-Zeilen fuer die Limit-Werte ----------
s = rep1(s,
  String.raw`req_retry_reasoning_effort: "+rre+"`,
  String.raw`req_retry_max_completion_tokens: "+rrmc+"\nreq_retry_max_tokens: "+rrmt+"\nreq_retry_reasoning_effort: "+rre+"`,
  'Echo-Zeilen Retry-Limit');
console.log('  L11: diagText Retry-Limit-Zeilen');

// ---------- D1: Laufzeit-Diagnose-Stempel v47 -> v48 ----------
s = rep1(s, 'bits.push("Build v47")', 'bits.push("Build v48")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v47";try{bld=this.buildTag();}', 'var bld="v48";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v47";},', 'buildTag:function(){return "v48";},', 'buildTag');
s = rep1(s, 'var mine=47;', 'var mine=48;', 'staleHint-mine');
s = rep1(s, ',10)||47;', ',10)||48;', 'staleHint-Fallback');
console.log('  D1: Diagnose-Stempel v47 -> v48 (5 Stellen)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v47 (Diagnose-Stempel v26->v47 + GEN_BUILD v23->v47 + Limit-Audit, via scripts/build-standalone-v47.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v48 (explizites Limit 131072 generate/modify/Retry, direkt, alle Provider + Diagnose-Echo-Werte + Stempel v48, via scripts/build-standalone-v48.mjs) -->');
  console.log('  Stempel: v48');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v48: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v48: OK v48 (explizites Limit 131072 + Diagnose-Echo-Werte)');
