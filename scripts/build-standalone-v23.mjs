/**
 * Standalone builder v23 (kein Length-Limit + Request-Echo + Prompt-Slim):
 * Baut auf dem v22-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Vorgabe 31.10.2026 (verbindlich): KEIN Length-Limit senden —
 * weder max_completion_tokens noch max_tokens, in keinem Pfad (generate +
 * modify, Erstversuch + Retry). Das Modell nutzt sein eigenes Maximum.
 * Retry-Regel beibehalten: genau 1x, nur bei leer + finish length + nur
 * Reasoning, mit UNVERAENDERTEM Body.
 *
 * Doku-Befund (recherchiert 31.10.2026, nur belegte Fakten):
 * - Baseten reasoning-Doku (docs.baseten.co/inference/model-apis/reasoning):
 *   Muse Spark Open = "Always on / Control None"; reasoning.max_tokens
 *   ("reasoning"-Objekt, caps Reasoning allein) wird NUR auf
 *   DeepSeek V4 Flash 0731 enforced, alle anderen Modelle ignorieren es
 *   (Referenz: docs.baseten.co/reference/inference-api/chat-completions,
 *   OpenAPI-Spec: "other models ignore it").
 *   KONSEQUENZ: kein belegter Thinking-Cap fuer Muse Spark Open -> kein Cap
 *   eingebaut, stattdessen Prompt-Verschlankung (F5) + low beibehalten.
 * - Meta Deploy-Doku (dev.meta.ai/docs/muse-spark-open/deploy): Thinking
 *   cannot be turned off, reasoning_effort="none" is rejected; Default
 *   xhigh, low = kleinstes belegtes Budget (bleibt, nur baseten-direct).
 *
 * F0  Request (generate + modify): max_completion_tokens/max_tokens aus
 *     Erst-Body + Retry-Zuweisung + Fallback-Strip entfernen (0 Limit-Params
 *     im Artefakt-Code; Diagnose-Labels ausgenommen).
 * F1  Request-Echo: _lastReq/_lastReqR-Snapshots (reasoning_effort,
 *     Temperatur, 400-Fallback je Versuch) fuer diagText.
 * F2  Diagnose-Export: req_*-Zeilen (Limit nicht gesendet / Thinking /
 *     Temperatur / 400-Fallback, je Versuch, de/en/es) im Copy-Text.
 * F3  Diagnose-Stempel: Build v22 -> v23 (emptyDetail + buildTag +
 *     staleHint-mine).
 * F4  Prompt-Slim (nur generate-Prompt, nur Ballast): Licht&IBL-Details und
 *     update/dispose gekuerzt; alle Vertragsregeln + Direktantwort bleiben.
 *
 * Aufruf: node scripts/build-standalone-v23.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v23-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v23: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen. */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v23-syn-'));
  const keep = !!process.env.V23_DUMP;
  if (keep) console.log(`  Syntax-Gate workdir (behalten): ${dir}`);
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
        const detail = String((e.stdout || '') + (e.stderr || '')).split('\n').slice(0, 12).join(' | ');
        must(false, `Inline-Script ${n} (${isMod ? 'module' : 'classic'}) parst nicht: ${detail}`);
      }
    }
    must(n >= 5, 'zu wenige Inline-Scripts gefunden: ' + n);
    console.log(`  Syntax-Gate ok (${checked} Inline-Scripts parsen)`);
  } finally {
    if (!keep) { try { rmSync(dir, { recursive: true, force: true }); } catch {} }
  }
}

// ---------- F2: Request-Echo-Var-Block (nach Retry-Anker, String.raw!) ----------
const REQ_VARS = String.raw`var rq=null;try{rq=this._lastReq||null;}catch(eQ){}var rr=null;try{rr=this._lastReqR||null;}catch(eQ2){}var nl="(nicht gesendet)";var nn="(keins)";var nt="(keine)";var yy="ja";var nn2="nein";try{if(L==="en"){nl="(not sent)";nn="(none)";nt="(none)";yy="yes";nn2="no";}else if(L==="es"){nl="(no enviado)";nn="(ninguno)";nt="(ninguna)";yy="s\u00ed";nn2="no";}}catch(eLg){}var rmc=nl;var rmt=nl;var ref=nn;try{if(rq&&rq.re){ref=rq.re;}}catch(eF1){}var rte=nt;try{if(rq&&typeof rq.te==="number"){rte=String(rq.te);}}catch(eF2){}var rfb=nn2;try{if(rq&&rq.fb){rfb=yy;}}catch(eF3){}var hasRr=0;try{hasRr=((this._lastRetry?1:0)&&rr)?1:0;}catch(eF5){}var rre=nn;var rrf=nn2;try{if(hasRr){rre=(rr.re?rr.re:nn);rrf=(rr.fb?yy:nn2);}}catch(eF4){}`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 26], ['OpenRouter', 12],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 2], ['stream:true', 3],
    ['temperature:0.2,max_completion_tokens', 0],
    ['temperature:0.2,max_tokens', 0],
    ['max_completion_tokens=131072', 0],
    ['max_tokens=65536', 0],
    ['max_tokens=131072', 0],
    ['delete gbody.max_tokens', 0],
    ['delete mbody.max_tokens', 0],
    ['budgetRetryable', 3],
    ['reasoning_effort', 10],
    ['req_reasoning_effort: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    // v26-Nachfolger (R0 Reasoning xhigh statt low): low 1->0, xhigh 0->1 (je Body).
    ['reasoning_effort="none"', 0],
    ['stream_options', 4],
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    // v26-Nachfolger (Reasoning xhigh/max mit Leitplanken): reasoningAllowed 5->7.
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    // v37-Nachfolger (Tele-Snapshot liest _lastChatInfo/_lastHttp je +1): 7->8, 6->7.
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 8], ['_lastHttp', 7],
    // v37-Nachfolger (Tele-Snapshot liest _lastRetry +1): 7->8.
    ['_lastRetry', 8],
    ['_lastReqR', 3],
    ['this._lastReq={', 4],
    ['staleHint', 2], ['buildTag', 3],
    // v24-Nachfolger: Build v23->v24 (Toleranz unten).
    ['Build v22', 0], ['Strg+F5', 1],
    ['slice(0,200)', 2], ['slice(0,160)', 0],
    ['slice(0,2048)', 2],
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    // v26-Nachfolger (T0 2D-Vertrag im Prompt): 2->3 (generate + modify + 2D).
    ['diagText:function', 1], ['copyDiag:function', 1],
    ['copyDiagBtn', 4],
    ['diagCopied:false', 1],
    ['reasonSample', 7],
    // v37-Nachfolger (Tele-Snapshot liest Usage-Reasoning/Completion je +2): 3->5.
    ['usageReasoning', 5], ['usageCompletion', 5],
    ['req_max_completion_tokens: ', 1],
    ['req_max_tokens: ', 1],
    ['req_reasoning_effort: ', 1],
    ['req_temperature: ', 1],
    ['req_400_fallback: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    ['req_retry_400_fallback: ', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v26-Toleranz: R0 low->xhigh (je Body 1->0), reasoningAllowed 5->7; T0 2D-Prompt (Fence-Satz 2->3).
  const is26 = s.includes('standalone-build v26');
  must(cnt(s, 'gbody.reasoning_effort="low"') === 1 || (is26 && cnt(s, 'gbody.reasoning_effort="low"') === 0), 'Invariante gbody-low: ' + cnt(s, 'gbody.reasoning_effort="low"') + ', erwartet 1 (v26: 0)');
  must(cnt(s, 'mbody.reasoning_effort="low"') === 1 || (is26 && cnt(s, 'mbody.reasoning_effort="low"') === 0), 'Invariante mbody-low: ' + cnt(s, 'mbody.reasoning_effort="low"') + ', erwartet 1 (v26: 0)');
  must(cnt(s, 'reasoningAllowed') === 5 || (is26 && cnt(s, 'reasoningAllowed') === 7), 'Invariante reasoningAllowed: ' + cnt(s, 'reasoningAllowed') + ', erwartet 5 (v26: 7)');
  must(cnt(s, 'Kein Nachdenken, keine Einleitung') === 2 || (is26 && cnt(s, 'Kein Nachdenken, keine Einleitung') === 3), 'Invariante Kein-Nachdenken-Satz: ' + cnt(s, 'Kein Nachdenken, keine Einleitung') + ', erwartet 2 (v26: 3)');
  // v24-Toleranz: Build-Stempel v23->v24.
  const is24 = s.includes('standalone-build v24');
  must(cnt(s, 'Build v23') === 1 || (is24 && cnt(s, 'Build v23') === 0), 'Invariante Build v23: ' + cnt(s, 'Build v23') + ', erwartet 1 (v24: 0)');
  must(cnt(s, 'Build v24') === 0 || (is24 && cnt(s, 'Build v24') === 1), 'Invariante Build v24: ' + cnt(s, 'Build v24') + ', erwartet 0 (v24: 1)');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v23 kein Limit + Request-Echo + Prompt-Slim)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v23: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v22-diagnose-export',
    standalone: 'v23',
    Dokubefund: [
      'Baseten reasoning-Doku: reasoning.max_tokens nur auf DeepSeek V4 Flash 0731 enforced, andere Modelle ignorieren es (docs.baseten.co/inference/model-apis/reasoning + chat-completions-Referenz)',
      'Baseten reasoning-Doku: Muse Spark Open Always on / Control None, none/minimal laufen auf low (docs.baseten.co/inference/model-apis/reasoning)',
      'Meta deploy-Doku: Thinking cannot be turned off, none rejected, Default xhigh (dev.meta.ai/docs/muse-spark-open/deploy)',
    ],
    fixes: [
      'F0 Request: max_completion_tokens/max_tokens aus generate+modify (Erstversuch+Retry+Fallback) entfernt — 0 Limit-Params',
      'F1 Request-Echo: _lastReq/_lastReqR je Versuch (reasoning_effort, Temperatur, 400-Fallback)',
      'F2 Diagnose: req_*-Zeilen de/en/es im Copy-Export (belegt kein Limit)',
      'F3 Build-Stempel v23',
      'F4 Prompt-Slim generate: Licht&IBL + update/dispose gekuerzt, Vertrag unveraendert',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v23: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v22'), 'kein v22-Stempel (falsche Basis)');
if (s.includes('standalone-build v23')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v23: bereits v23 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F0: Limit-Params raus (generate + modify) ----------
s = rep1(s, 'var gbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:65536};', 'var gbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2};', 'Limit-Erst gen');
s = rep1(s, 'var mbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:65536};', 'var mbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2};', 'Limit-Erst mod');
s = rep1(s, '{gbody.max_tokens=65536;gbody.reasoning_effort="low";', '{gbody.reasoning_effort="low";', 'Limit-Mirror gen');
s = rep1(s, '{mbody.max_tokens=65536;mbody.reasoning_effort="low";', '{mbody.reasoning_effort="low";', 'Limit-Mirror mod');
s = rep1(s, 'slimG=true;try{delete gbody["reasoning_"+"effort"];delete gbody.max_tokens;delete gbody.stream_options;',
  'slimG=true;try{this._lastReq={re:null,te:gbody.temperature,fb:1};}catch(eQg){}try{delete gbody["reasoning_"+"effort"];delete gbody.stream_options;', 'Fallback gen (Strip + Echo)');
s = rep1(s, 'slimM=true;try{delete mbody["reasoning_"+"effort"];delete mbody.max_tokens;delete mbody.stream_options;',
  'slimM=true;try{this._lastReq={re:null,te:mbody.temperature,fb:1};}catch(eQm){}try{delete mbody["reasoning_"+"effort"];delete mbody.stream_options;', 'Fallback mod (Strip + Echo)');
s = rep1(s, 'try{gbody.max_completion_tokens=131072;gbody.max_tokens=131072;try{this._lastRetry=1;}',
  'try{try{this._lastReqR={re:(gbody.reasoning_effort||null),te:gbody.temperature,fb:(slimG?1:0)};}catch(eQg2){}try{this._lastRetry=1;}', 'Retry gen (gleiches Body + Echo)');
s = rep1(s, 'try{mbody.max_completion_tokens=131072;mbody.max_tokens=131072;try{this._lastRetry=1;}',
  'try{try{this._lastReqR={re:(mbody.reasoning_effort||null),te:mbody.temperature,fb:(slimM?1:0)};}catch(eQm2){}try{this._lastRetry=1;}', 'Retry mod (gleicher Body + Echo)');

// ---------- F1: Request-Snapshot nach Body-Aufbau (generate + modify) ----------
s = rep1(s, 'gbody.reasoning_effort="low";gbody.stream_options={include_usage:true};}try{res=await fetch',
  'gbody.reasoning_effort="low";gbody.stream_options={include_usage:true};}try{this._lastReq={re:(gbody.reasoning_effort||null),te:gbody.temperature,fb:0};}catch(eQg0){}try{res=await fetch', 'Echo-Snapshot gen');
s = rep1(s, 'mbody.reasoning_effort="low";mbody.stream_options={include_usage:true};}try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify(mbody),signal:ctrl.signal});}catch(e){this.modStatus',
  'mbody.reasoning_effort="low";mbody.stream_options={include_usage:true};}try{this._lastReq={re:(mbody.reasoning_effort||null),te:mbody.temperature,fb:0};}catch(eQm0){}try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify(mbody),signal:ctrl.signal});}catch(e){this.modStatus', 'Echo-Snapshot mod');

// ---------- F2: diagText-Request-Echo ----------
s = rep1(s, 'var rt="0/1";try{rt=((this._lastRetry?1:0)+"/1");}catch(eR3){}',
  'var rt="0/1";try{rt=((this._lastRetry?1:0)+"/1");}catch(eR3){}' + REQ_VARS, 'Echo-Vars diagText');
s = rep1(s, String.raw`"\nretry: "+rt+"\nbuild: "+bld+"\nraw_snippet_2k: "+raw;`,
  String.raw`"\nretry: "+rt+"\nreq_max_completion_tokens: "+rmc+"\nreq_max_tokens: "+rmt+"\nreq_reasoning_effort: "+ref+"\nreq_temperature: "+rte+"\nreq_400_fallback: "+rfb+(hasRr?("\nreq_retry_reasoning_effort: "+rre+"\nreq_retry_400_fallback: "+rrf):"")+"\nbuild: "+bld+"\nraw_snippet_2k: "+raw;`,
  'Echo-Zeilen diagText');

// ---------- F3: Build-Stempel v23 ----------
s = rep1(s, 'bits.push("Build v22")', 'bits.push("Build v23")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v22";try{bld=this.buildTag();}', 'var bld="v23";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v22";},', 'buildTag:function(){return "v23";},', 'buildTag');
s = rep1(s, 'var mine=22;', 'var mine=23;', 'staleHint-mine');
s = rep1(s, ',10)||22;', ',10)||23;', 'staleHint-fallback');

// ---------- F4: Prompt-Slim (nur generate-Prompt, nur Ballast) ----------
s = rep1(s,
  'Key-DirectionalLight(0xffffff, 2.5) mit Schatten (mapSize 1024x1024, PCFShadowMap, Frustum ums Modell + updateProjectionMatrix, bias -0.0001, normalBias 0.002-0.02, radius gesetzt); Rim-DirectionalLight(0xbcd0ff, 0.7); PointLight(0xffd9a0, 0.12, 1.5, 2) ohne Schatten. Inline-Environment: PMREMGenerator + const room = new Scene(); Waende MeshStandardMaterial 0xcccccc (side: 1) + PointLight(0xffffff, 5, 28, 2) (auf 2-m-Raum skaliert; 900 gilt nur im 30-m-Referenzraum) + 2 Softboxen MeshBasicMaterial 0xffffff; pmrem.fromScene(room, 0.04).texture auf scene.environment; NUR scene.environmentIntensity = 0.55. DPR 1..2 (Default 1). Negativ: KEIN transmission/iridescence/sheen, KEIN CanvasTexture/document/canvas, KEIN fetch/TextureLoader/CDN, KEIN mapSize 2048, KEIN DPR>=2-Default, KEIN curveSegments>=12/bevelSegments>=3, KEIN DoubleSide global, KEIN PointLight-Schatten.',
  'Key-DirectionalLight(0xffffff, 2.5) mit Schatten (1024, Frustum ums Modell); Rim-DirectionalLight(0xbcd0ff, 0.7); PointLight(0xffd9a0, 0.12, 1.5, 2) ohne Schatten. IBL: PMREMGenerator + const room = new Scene(); Standard-Waende + PointLight(0xffffff, 5, 28, 2) + 2 Softboxen; NUR scene.environmentIntensity = 0.55; DPR 1..2 (Default 1). Negativ: KEIN transmission/iridescence/sheen, KEIN CanvasTexture/canvas, KEIN fetch/CDN, KEIN mapSize 2048, KEIN DPR>=2, KEIN DoubleSide global, KEIN PointLight-Schatten.',
  'Prompt-Slim Licht&IBL');
s = rep1(s,
  '"update(patch): nur Sichtbarkeit (labels max, measurements) und Kamera schalten, nie neues Modell. dispose(): Schleife stoppen, Geometrien/Materialien/Renderer freigeben, Element entfernen."',
  '"update(patch): nur Sichtbarkeit (labels, measurements) und Kamera schalten. dispose(): Schleife stoppen, Ressourcen freigeben, Element entfernen."',
  'Prompt-Slim update/dispose');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v22 (Diagnose-Export + Thinking-Budget low, via scripts/build-standalone-v22.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v23 (kein Limit + Request-Echo + Prompt-Slim, via scripts/build-standalone-v23.mjs) -->');
  console.log('  Stempel: v23');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v23: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v23: OK v23 (kein Limit + Request-Echo + Prompt-Slim)');
