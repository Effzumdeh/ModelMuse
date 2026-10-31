/**
 * Standalone builder v20 (Budget hoch, GitHub-Pages-faehig):
 * Baut auf dem v19-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Vorgabe 31.10.2026: Budget noch hoeher, Contributor ist sehr
 * guenstig — keine strikte Begrenzung noetig.
 *
 * B3  Erst-Budget 16384 -> 65536, Retry-Budget 32768 -> 131072
 *     (generate + modify). 1M-Kontext Muse Spark Open
 *     (dev.meta.ai/docs/muse-spark-open/deploy); passt das Limit bei
 *     api.meta.ai nicht, meldet Upstream ehrlich HTTP 400 statt stille Leere.
 *     Retry-Regel unveraendert (max 1x bei leer + length + nur Reasoning).
 *
 * Aufruf: node scripts/build-standalone-v20.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v20-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v20: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 26], ['OpenRouter', 12],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 2], ['stream:true', 3],
    // v23-Nachfolger (kein Length-Limit): 4->1 / 2->0 (exakt in v23).
    ['budgetRetryable', 3],
    // v21-Nachfolger (Thinking-Reduktion): reasoning_effort 2->4 (exakt in v21).
    // Exakte v21-Werte prueft build-standalone-v21.mjs.
    // v26-Nachfolger (Reasoning xhigh/max mit Leitplanken): reasoningAllowed 5->7.
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    ['collectChatText', 4], ['emptyDetail', 3],
    // v22-Nachfolger (Diagnose-Export): diagText liest _lastChatInfo/_lastHttp
    // je +1 (exakt in v22: 7/6). Exakte v22-Werte prueft build-standalone-v22.mjs.
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v26-Toleranz: R0 Reasoning xhigh/max (Methode + selects + defaults + bodies) 5->7.
  must(cnt(s, 'reasoningAllowed') === 5 || (s.includes('standalone-build v26') && cnt(s, 'reasoningAllowed') === 7), 'Invariante reasoningAllowed: ' + cnt(s, 'reasoningAllowed') + ', erwartet 5 (v26: 7)');
  // v23-Toleranz: kein Length-Limit (Werte 4/2/2 -> 1/0/0; exakt in v23).
  must(cnt(s, 'max_completion_tokens') === 4 || (s.includes('standalone-build v23') && cnt(s, 'max_completion_tokens') === 1), 'Invariante max_completion_tokens: ' + cnt(s, 'max_completion_tokens') + ', erwartet 4 (v23: 1)');
  must(cnt(s, 'max_completion_tokens:65536') === 2 || (s.includes('standalone-build v23') && cnt(s, 'max_completion_tokens:65536') === 0), 'Invariante max_completion_tokens:65536: ' + cnt(s, 'max_completion_tokens:65536') + ', erwartet 2 (v23: 0)');
  must(cnt(s, 'max_completion_tokens=131072') === 2 || (s.includes('standalone-build v23') && cnt(s, 'max_completion_tokens=131072') === 0), 'Invariante max_completion_tokens=131072: ' + cnt(s, 'max_completion_tokens=131072') + ', erwartet 2 (v23: 0)');
  // v21-Toleranz: Thinking-Reduktion (pre-v21: 2 | v21: 4).
  // v23-Toleranz: Request-Echo (2 + 2 + 4 + 2 = 10).
  must(cnt(s, 'reasoning_effort') === 2 || cnt(s, 'reasoning_effort') === 4 || (s.includes('standalone-build v23') && cnt(s, 'reasoning_effort') === 10), 'Invariante reasoning_effort: ' + cnt(s, 'reasoning_effort') + ', erwartet 2 oder 4 (v23: 10)');
  // v22-Toleranz: Diagnose-Export (pre-v22: 6/5 | v22: 7/6).
  // v37-Nachfolger (Tele-Snapshot liest _lastChatInfo/_lastHttp je +1): 7->8, 6->7.
  must(cnt(s, '_lastChatInfo') === 6 || cnt(s, '_lastChatInfo') === 7 || cnt(s, '_lastChatInfo') === 8, 'Invariante _lastChatInfo: ' + cnt(s, '_lastChatInfo') + ', erwartet 6, 7 oder 8');
  must(cnt(s, '_lastHttp') === 5 || cnt(s, '_lastHttp') === 6 || cnt(s, '_lastHttp') === 7, 'Invariante _lastHttp: ' + cnt(s, '_lastHttp') + ', erwartet 5, 6 oder 7');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v20 Budget 65536 + Retry 131072)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v20: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v19-budget-retry',
    standalone: 'v20',
    fixes: [
      'B3 Erst-Budget 16384 -> 65536, Retry-Budget 32768 -> 131072 (generate + modify)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v20: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v19'), 'kein v19-Stempel (falsche Basis)');
if (s.includes('standalone-build v20')) {
  console.log('build-v20: bereits v20 — pruefe Invarianten ...');
  checkInvariants(s);
  console.log('build-v20: bereits v20 — ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- B3: Budgets hoch (generate + modify) ----------
must(cnt(s, 'max_completion_tokens:16384') === 2, 'B3 Erst-Budget-Anker: ' + cnt(s, 'max_completion_tokens:16384') + ', erwartet 2');
s = s.split('max_completion_tokens:16384').join('max_completion_tokens:65536');
console.log('  B3: Erst-Budget 16384 -> 65536 (generate + modify)');
must(cnt(s, 'max_completion_tokens=32768') === 2, 'B3 Retry-Budget-Anker: ' + cnt(s, 'max_completion_tokens=32768') + ', erwartet 2');
s = s.split('max_completion_tokens=32768').join('max_completion_tokens=131072');
console.log('  B3: Retry-Budget 32768 -> 131072 (generate + modify)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v19 (Budget 16384 + Auto-Retry 32768 bei leer+length+nur-Reasoning, via scripts/build-standalone-v19.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v20 (Budget 65536 + Retry 131072, Eigentuemer-Vorgabe 31.10.2026, via scripts/build-standalone-v20.mjs) -->');
  console.log('  Stempel: v20');
}
checkInvariants(s);

await writeFile(FILE, s);
console.log(`build-v20: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v20: OK v20 (Budget hoch)');
