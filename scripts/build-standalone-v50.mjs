/**
 * Standalone builder v50 (Baseten-Doku-Regel + zweistufiger 400-Fallback, 03.11.2026):
 * Baut auf dem v49-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Live-Fehler 03.11.2026, bestaetigt als Baseten):
 * 400 "Invalid request: max_completion_tokens (131072): Extra inputs are
 * not permitted" — die Baseten-Chat-Completions-Referenz (live geprueft
 * 03.11.2026) listet ausschliesslich max_tokens (1..262144, Default 4096);
 * max_completion_tokens ist dort kein gueltiges Feld. Andere Provider
 * behalten beide Felder.
 *
 * Umsetzung (je generate/modify, alle Provider):
 * D0 Baseten-Doku-Regel im Erst-Body: baseten-direct sendet NUR max_tokens
 *     (bedingtes delete direkt nach Body-Erzeugung; Meta/OpenRouter/Ollama
 *     weiter beide Felder). Echo-Snapshots lesen mc/mt aus dem Body und
 *     zeigen dadurch ehrlich "(nicht gesendet)" bei Baseten.
 * F1/F2 Stufe 1 (bestehend): 400 -> Extras raus (reasoning_effort +
 *     stream_options), einmal ohne neu.
 * F3/F4 Stufe 2 (neu): 400 + Extra-inputs-Hinweis im Antworttext ->
 *     Limit-Felder raus (max_completion_tokens + max_tokens), einmal ohne
 *     neu. Fehlertext wird einmal gelesen und fuer die Statuszeile
 *     wiederverwendet (Body ist danach verbraucht).
 * E1-E4 Echo-Snapshots tragen ls (Limit-Strip-Flag: 0 Erst/Fallback,
 *     slimLimG/slimLimM beim Retry, 1 bei Stufe 2).
 * D2 diagText: req_400_limit_strip / req_retry_400_limit_strip aus rq.ls/rr.ls
 *     (Stufe-2-Nachweis in der kopierten Diagnose).
 * D1 Diagnose-Stempel v48 -> v50 (alle 5 Stellen, rep1-geprueft).
 * S  Stempel v50 + Invarianten + Syntax-Gate.
 *
 * Nachfolger-Toleranz: aeltere Builder (v23-v26: Limit-/Echo-Invarianten;
 * v40-v43: reasoning_effort) tragen is50-Toleranz; v48/v49 steigen bei
 * v50-Stempel frueh aus (Muster wie v47 bei v48).
 *
 * Aufruf: node scripts/build-standalone-v50.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v50-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v50: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v49 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v50-syn-'));
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
          console.error('build-v50: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v50-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v48', 1], ['standalone-build v49', 1],
    ['standalone-build v50', 1],
    // D1: Laufzeit-Diagnose-Stempel v50 (exakt je 1x), Alt-Stempel raus.
    ['bits.push("Build v50")', 1],
    ['bits.push("Build v49")', 0],
    ['bits.push("Build v48")', 0],
    ['var bld="v50";try{bld=this.buildTag();}', 1],
    ['var bld="v49";try{bld=this.buildTag();}', 0],
    ['var bld="v48";try{bld=this.buildTag();}', 0],
    ['buildTag:function(){return "v50";},', 1],
    ['buildTag:function(){return "v49";},', 0],
    ['buildTag:function(){return "v48";},', 0],
    ['var mine=50;', 1],
    ['var mine=49;', 0],
    ['var mine=48;', 0],
    [',10)||50;', 1],
    [',10)||49;', 0],
    [',10)||48;', 0],
    ['buildTag', 3], ['staleHint', 2], ['Strg+F5', 1],
    // D0/D2: explizites Maximum 131072 in beiden Erst-Body-Literalen (gen+mod);
    // Baseten-Doku-Regel loescht max_completion_tokens bedingt (D0),
    // Stufe 2 loescht beide Limit-Felder bei Extra-inputs-400 (F3/F4) —
    // max_completion_tokens daher je 2x (D0 + Stufe 2), max_tokens je 1x.
    ['temperature:0.2,max_completion_tokens:131072,max_tokens:131072', 2],
    ['max_completion_tokens:131072', 2],
    ['max_tokens:131072', 2],
    ['max_completion_tokens=131072', 0],
    ['max_completion_tokens:65536', 0],
    ['max_tokens=65536', 0],
    ['max_tokens=131072', 0],
    ['delete gbody.max_completion_tokens', 2],
    ['delete mbody.max_completion_tokens', 2],
    ['delete gbody.max_tokens', 1],
    ['delete mbody.max_tokens', 1],
    ['/extra inputs/i', 2],
    // Stufe 1 bleibt: strippt nur reasoning_effort + stream_options.
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    // Echo-Snapshots tragen mc/mt/ls (je gen/mod: Erst + Fallback + Retry + Stufe 2).
    ['this._lastReq={', 6],
    ['_lastReqR', 3],
    ['mc:gbody.max_completion_tokens', 4],
    ['mt:gbody.max_tokens', 4],
    ['mc:mbody.max_completion_tokens', 4],
    ['mt:mbody.max_tokens', 4],
    [',ls:0', 4],
    [',ls:(slimLimG?1:0)', 1],
    [',ls:(slimLimM?1:0)', 1],
    [',ls:1', 2],
    // Echo-Labels (Erst + Retry): Anzeige bleibt, dazu Limit-Strip-Nachweis.
    ['req_max_completion_tokens: ', 1],
    ['req_max_tokens: ', 1],
    ['req_retry_max_completion_tokens: ', 1],
    ['req_retry_max_tokens: ', 1],
    ['req_reasoning_effort: ', 1],
    ['req_temperature: ', 1],
    ['req_400_fallback: ', 1],
    ['req_400_limit_strip: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    ['req_retry_400_fallback: ', 1],
    ['req_retry_400_limit_strip: ', 1],
    ['reasoning_effort', 12],
    ['usage_completion_tokens: ', 2], // diagText-Echo + Tele-Kopiertext (beides Anzeige, kein Request)
    ['stream_options', 4], // 2 Bodies + 2 Stufe-1-Strips
    ['slimG', 4], ['slimM', 4], // Stufe-1-Flags unveraendert (Stufe 2 nutzt slimLimG/slimLimM)
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
  console.log('  Invarianten ok (v50 Diagnose-Stempel v50 + Baseten-Doku-Regel + Stufe-2-Fallback)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v50: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v49-countdown-eine-deadline',
    standalone: 'v50',
    befund: [
      'Live-400 03.11.2026 (Baseten): "Invalid request: max_completion_tokens (131072): Extra inputs are not permitted". Baseten-Chat-Completions-Referenz (live geprueft) listet ausschliesslich max_tokens (1..262144).',
      'Generischer Schutz: zweistufiger 400-Fallback — Stufe 1 Extras (jedes 400), Stufe 2 Limits (nur Extra-inputs-400), je einmal, generate+modify+Retry, alle Provider.',
    ],
    fixes: [
      'D0 Erst-Body gen/mod: baseten-direct loescht max_completion_tokens bedingt (nur max_tokens); andere Provider beide Felder',
      'F3/F4 Stufe-2-Fallback gen/mod: Extra-inputs-400 -> Limits raus, einmal ohne neu (Fehlertext einmal gelesen, Statuszeile wiederverwendet)',
      'E1-E4 Echo-Snapshots (Erst+Fallback+Retry+Stufe2) mit ls-Flag; D2 diagText req_400_limit_strip/req_retry_400_limit_strip',
      'D1 Laufzeit-Diagnose-Stempel v48 -> v50 (emptyDetail-Bits + diagText-Default + buildTag + staleHint mine/Fallback)',
      'S Stempel v50 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v50: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v49'), 'kein v49-Stempel (falsche Basis)');
if (s.includes('standalone-build v50')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v50: bereits v50 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- D0: Baseten-Doku-Regel im Erst-Body (nur max_tokens) ----------
s = rep1(s,
  'max_tokens:131072};var wantG=this.genReasoning',
  'max_tokens:131072};if(this.genProvider==="baseten-direct"){delete gbody.max_completion_tokens;}var wantG=this.genReasoning',
  'Doku-Regel gen');
s = rep1(s,
  'max_tokens:131072};var wantM=this.genReasoning',
  'max_tokens:131072};if(this.genProvider==="baseten-direct"){delete mbody.max_completion_tokens;}var wantM=this.genReasoning',
  'Doku-Regel mod');
console.log('  D0: Baseten-Erst-Body gen/mod ohne max_completion_tokens (nur max_tokens)');

// ---------- S1/S2/E1/E2/R1/R2: Echo-Snapshots tragen ls-Flag ----------
s = rep1(s,
  'this._lastReq={re:null,te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:1}',
  'this._lastReq={re:null,te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:1,ls:0}',
  'Echo-Snapshot gen-Fallback +ls');
s = rep1(s,
  'this._lastReq={re:null,te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:1}',
  'this._lastReq={re:null,te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:1,ls:0}',
  'Echo-Snapshot mod-Fallback +ls');
s = rep1(s,
  'this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:0}',
  'this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:0,ls:0}',
  'Echo-Snapshot gen-Erst +ls');
s = rep1(s,
  'this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:0}',
  'this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:0,ls:0}',
  'Echo-Snapshot mod-Erst +ls');
s = rep1(s,
  'this._lastReqR={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:(slimG?1:0)}',
  'this._lastReqR={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:(slimG?1:0),ls:(slimLimG?1:0)}',
  'Echo-Snapshot gen-Retry +ls');
s = rep1(s,
  'this._lastReqR={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:(slimM?1:0)}',
  'this._lastReqR={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:(slimM?1:0),ls:(slimLimM?1:0)}',
  'Echo-Snapshot mod-Retry +ls');
console.log('  S1/S2/E1/E2/R1/R2: Echo-Snapshots mit ls-Flag');

// ---------- L1: Stufe-2-Flags + Fehlertext-Puffer ----------
s = rep1(s, 'var slimG=false;', 'var slimG=false;var slimLimG=false;var eTxtG="";', 'Stufe-2-Flags gen');
s = rep1(s, 'var slimM=false;', 'var slimM=false;var slimLimM=false;', 'Stufe-2-Flags mod');
console.log('  L1: Stufe-2-Flags (slimLimG/slimLimM) + Fehlertext-Puffer');

// ---------- F3/F4: Stufe-2-Fallback (Extra-inputs-400 -> Limits raus, einmal neu) ----------
s = rep1(s,
  'if(resF0){res=resF0;}}catch(eRF0){}}',
  'if(resF0){res=resF0;}}catch(eRF0){}}if(res&&res.status===400&&!slimLimG){slimLimG=true;try{eTxtG=await res.text();}catch(eTg){eTxtG="";}if(/extra inputs/i.test(eTxtG)){try{delete gbody.max_completion_tokens;delete gbody.max_tokens;}catch(eDg){}try{this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,mc:gbody.max_completion_tokens,mt:gbody.max_tokens,fb:1,ls:1};}catch(eQgL){}try{var resL0=await fetch(this.genDirectUrl,{method:"POST",headers:this.directHeaders(),body:JSON.stringify(gbody),signal:ctrl.signal});if(resL0){res=resL0;eTxtG="";}}catch(eRL0){}}}',
  'Stufe-2-Fallback gen');
s = rep1(s,
  'if(resF1){res=resF1;}}catch(eRF1){}}',
  'if(resF1){res=resF1;}}catch(eRF1){}}if(res&&res.status===400&&!slimLimM){slimLimM=true;var eTxtM="";try{eTxtM=await res.text();}catch(eTm){eTxtM="";}if(/extra inputs/i.test(eTxtM)){try{delete mbody.max_completion_tokens;delete mbody.max_tokens;}catch(eDm){}try{this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,mc:mbody.max_completion_tokens,mt:mbody.max_tokens,fb:1,ls:1};}catch(eQmL){}try{var resL1=await fetch(this.genDirectUrl,{method:"POST",headers:this.directHeaders(),body:JSON.stringify(mbody),signal:ctrl.signal});if(resL1){res=resL1;}}catch(eRL1){}}}',
  'Stufe-2-Fallback mod');
console.log('  F3/F4: Stufe-2-Fallback gen/mod (Extra-inputs -> ohne Limits neu)');

// ---------- G1: Statuszeile nutzt gelesenen Fehlertext (Body verbraucht) ----------
s = rep1(s,
  'var st="";try{st=await res.text();}catch(ee){st="";}',
  'var st="";try{st=eTxtG||await res.text();}catch(ee){st="";}',
  'Fehlertext-Wiederverwendung gen');
console.log('  G1: Fehlertext-Wiederverwendung in Statuszeile');

// ---------- D2: diagText-Vars + Limit-Strip-Zeilen ----------
s = rep1(s,
  'var rfb=nn2;try{if(rq&&rq.fb){rfb=yy;}}catch(eF3){}',
  'var rfb=nn2;try{if(rq&&rq.fb){rfb=yy;}}catch(eF3){}var rls=nn2;try{if(rq&&rq.ls){rls=yy;}}catch(eF3b){}',
  'Echo-Var Limit-Strip');
s = rep1(s,
  'var rre=nn;var rrf=nn2;var rrmc=nl;var rrmt=nl;',
  'var rre=nn;var rrf=nn2;var rrmc=nl;var rrmt=nl;var rrls=nn2;',
  'Echo-Var Retry-Limit-Strip');
s = rep1(s,
  'if(typeof rr.mt==="number"){rrmt=String(rr.mt);}}}catch(eF4){}',
  'if(typeof rr.mt==="number"){rrmt=String(rr.mt);}if(rr.ls){rrls=yy;}}}catch(eF4){}',
  'Echo-Var Retry-Limit-Strip lesen');
s = rep1(s,
  String.raw`req_400_fallback: "+rfb+(hasRr?("\nreq_retry_max_completion_tokens: "+rrmc+"\nreq_retry_max_tokens: "+rrmt+"\nreq_retry_reasoning_effort: "+rre+"\nreq_retry_400_fallback: "+rrf):"")`,
  String.raw`req_400_fallback: "+rfb+"\nreq_400_limit_strip: "+rls+(hasRr?("\nreq_retry_max_completion_tokens: "+rrmc+"\nreq_retry_max_tokens: "+rrmt+"\nreq_retry_reasoning_effort: "+rre+"\nreq_retry_400_fallback: "+rrf+"\nreq_retry_400_limit_strip: "+rrls):"")`,
  'Echo-Zeilen Limit-Strip');
console.log('  D2: diagText Limit-Strip-Zeilen (Erst + Retry)');

// ---------- D1: Laufzeit-Diagnose-Stempel v48 -> v50 ----------
s = rep1(s, 'bits.push("Build v48")', 'bits.push("Build v50")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v48";try{bld=this.buildTag();}', 'var bld="v50";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v48";},', 'buildTag:function(){return "v50";},', 'buildTag');
s = rep1(s, 'var mine=48;', 'var mine=50;', 'staleHint-mine');
s = rep1(s, ',10)||48;', ',10)||50;', 'staleHint-Fallback');
console.log('  D1: Diagnose-Stempel v48 -> v50 (5 Stellen)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v49 (Countdown-eine-Deadline: Kopf+Queue aus Job-Start+ETA, kein eigener Zaehler, via scripts/build-standalone-v49.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v50 (Baseten-Doku-Regel nur max_tokens + zweistufiger 400-Fallback Extra-inputs-Limit-Strip + Diagnose-Limit-Strip + Stempel v50, via scripts/build-standalone-v50.mjs) -->');
  console.log('  Stempel: v50');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v50: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v50: OK v50 (Baseten-Doku-Regel + Stufe-2-Fallback + Diagnose-Limit-Strip)');
