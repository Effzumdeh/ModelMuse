/**
 * Standalone builder v19 (Budget + Auto-Retry, GitHub-Pages-faehig):
 * Baut auf dem v18-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Hintergrund (Beleg live beim User, 31.10.2026):
 * (baseten-direct/meta-models/muse-spark-open-1026, HTTP 200, finish=length,
 * nur Reasoning, kein Content). HTTP ok, aber das Modell fuellt das
 * Output-Budget mit Reasoning und liefert finish=length ohne Content.
 * Ursache: max_completion_tokens zu klein (v17: 8000; livegen/Proxy: gar kein
 * Budget -> Upstream-Default) und Reasoning frisst alles (Meta-Doku:
 * Reasoning-Tokens zaehlen gegen max_completion_tokens, dev.meta.ai/docs/reasoning).
 *
 * B1  Budget 8000 -> 16384 (generate + modify). 16384 = Meta-Beispielwert
 *     fuer Muse Spark (dev.meta.ai/docs/muse-spark-open/deploy, 1M-Kontext);
 *     api.meta.ai-Limit ist modellabhaengig
 *     (dev.meta.ai/docs/protocols/chat-completions) — passt es nicht, meldet
 *     Upstream ehrlich HTTP 400 statt stiller Leere. Temperatur bleibt 0.2.
 *     Reasoning-Gate unveraendert: reasoning_effort=max nur 1.3/wonder auf
 *     meta-muse, NIE -contributor (API lehnt max dort ab), NIE Baseten
 *     (OpenAI-kompatibler Pfad, Param-Support unverifiziert -> 400-Risiko).
 * B2  Auto-Retry (max 1x) mit 32768, genau dann wenn Antwort leer UND
 *     finish=length UND nur Reasoning/kein Content (Helper budgetRetryable).
 *     Danach erst Fehlermeldung (emptyDetail/badSource). Retry-Request ohne
 *     zusaetzliches Accept-Literal: SSE steuert stream:true im Body, so bleiben
 *     die v17/v18-Zaehler (text/event-stream, stream:true) stabil.
 *
 * Aufruf: node scripts/build-standalone-v19.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v19-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v19: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

// Helper: genau die Budget-Erschoepfung erkennt (leer + length + nur Reasoning).
// _lastChatInfo-Referenz steht genau 1x hier (v18-Zaehler 5 -> 6).
const HELPER = 'budgetRetryable:function(){var i=this._lastChatInfo;return!!(i&&i.finish==="length"&&!i.chunks&&i.reason>0);},\r\n';

// Generate-Retry (vor der ersten Leer-Branche): zweiter Versuch mit 32768.
// Kein Accept-Literal (v17/v18-SSE-Zaehler bleiben stabil, SSE via stream:true).
const RETRY_GEN = 'if(!text&&this.budgetRetryable()){try{gbody.max_completion_tokens=32768;var res2=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify(gbody),signal:ctrl.signal});if(res2&&res2.ok){try{try{this._lastHttp=res2.status;}catch(eH2){}text=await this.readChatText(res2);}catch(eR){}}}catch(eR2){}}\r\n';

// Modify-Retry (vor der quelle-Pruefung): danach laeuft die bestehende
// Fence/meta/init-Pruefung ueber den Retry-Text.
const RETRY_MOD = 'if(!text&&this.budgetRetryable()){try{mbody.max_completion_tokens=32768;var res2=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify(mbody),signal:ctrl.signal});if(res2&&res2.ok){try{try{this._lastHttp=res2.status;}catch(eH2){}text=await this.readChatText(res2);}catch(eR){}quelle=text;var fm2=/\\`\\`\\`(?:[a-zA-Z0-9_-]+)?\\n([\\s\\S]*?)\\`\\`\\`/.exec(text);if(fm2&&fm2[1]){quelle=fm2[1];}quelle=(quelle||"").trim();}}catch(eR2){}}\r\n';

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 3], ['stream:true', 3],
    ['max_completion_tokens', 4],
    // v20-Nachfolger (Budget hoch) ersetzt die Werte 16384/32768 durch
    // 65536/131072 — exakte Werte prueft build-standalone-v20.mjs.
    ['budgetRetryable', 3],
    // v21-Nachfolger (Thinking-Reduktion): reasoning_effort 2->4 (exakt in v21).
    ['reasoningAllowed', 5],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 6], ['_lastHttp', 5],
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v20-Toleranz: Budget hoch (pre-v20 16384/32768 | v20 65536/131072).
  for (const [sub, olds, news] of [['max_completion_tokens:16384', 2, 0], ['max_completion_tokens:65536', 0, 2], ['max_completion_tokens=32768', 2, 0], ['max_completion_tokens=131072', 0, 2]]) {
    must(cnt(s, sub) === olds || cnt(s, sub) === news, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + olds + ' oder ' + news);
  }
  // v21-Toleranz: Thinking-Reduktion (pre-v21: 2 | v21: 4).
  must(cnt(s, 'reasoning_effort') === 2 || cnt(s, 'reasoning_effort') === 4, 'Invariante reasoning_effort: ' + cnt(s, 'reasoning_effort') + ', erwartet 2 oder 4');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v19 Budget 16384 + Retry 32768)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v19: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v18-leere-antwort-fix',
    standalone: 'v19',
    fixes: [
      'B1 Budget 8000 -> 16384 (generate + modify), Temperatur 0.2, Reasoning-Gate unveraendert',
      'B2 Auto-Retry max 1x mit 32768 bei leer+length+nur-Reasoning (budgetRetryable), dann erst Fehlermeldung',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v19: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v18'), 'kein v18-Stempel (falsche Basis)');
if (s.includes('standalone-build v19')) {
  console.log('build-v19: bereits v19 — pruefe Invarianten ...');
  checkInvariants(s);
  console.log('build-v19: bereits v19 — ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- B1: Budget 8000 -> 16384 (generate + modify) ----------
must(cnt(s, 'max_completion_tokens:8000') === 2, 'B1 Budget-Anker: ' + cnt(s, 'max_completion_tokens:8000') + ', erwartet 2');
s = s.split('max_completion_tokens:8000').join('max_completion_tokens:16384');
console.log('  B1: Budget 8000 -> 16384 (generate + modify)');

// ---------- B2a: Retry-Helper vor collectChatText ----------
s = rep1(s,
  'collectChatText:function(ev,info){var i=info||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};',
  HELPER + 'collectChatText:function(ev,info){var i=info||{chunks:0,empty:0,reason:0,finish:"",err:"",usage:""};',
  'B2a budgetRetryable-Helper');
console.log('  B2a: Helper budgetRetryable');

// ---------- B2b: Generate-Retry vor erster Leer-Branche ----------
s = rep1(s,
  "if(!text){this.genStatus=this.emptyDetail();this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  RETRY_GEN + "if(!text){this.genStatus=this.emptyDetail();this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var quelle=text;",
  'B2b generate-Retry');
console.log('  B2b: Generate-Retry (32768, max 1x)');

// ---------- B2c: Modify-Retry vor quelle-Pruefung ----------
s = rep1(s,
  'if(!quelle||quelle.indexOf("export const meta")===-1||quelle.indexOf("export function init")===-1){this.modStatus=this.t(\'badSource\');this.modStatusBad=true;return;}',
  RETRY_MOD + 'if(!quelle||quelle.indexOf("export const meta")===-1||quelle.indexOf("export function init")===-1){this.modStatus=this.t(\'badSource\');this.modStatusBad=true;return;}',
  'B2c modify-Retry');
console.log('  B2c: Modify-Retry (32768, max 1x)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v18 (leere-Antwort-Fix: Reasoning-toleranter Reader, Diagnose mit Provider/Modell/Status, Viewer-v-if bei leerer Liste, via scripts/build-standalone-v18.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v19 (Budget 16384 + Auto-Retry 32768 bei leer+length+nur-Reasoning, via scripts/build-standalone-v19.mjs) -->');
  console.log('  Stempel: v19');
}
checkInvariants(s);

await writeFile(FILE, s);
console.log(`build-v19: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v19: OK v19 (Budget + Retry)');
