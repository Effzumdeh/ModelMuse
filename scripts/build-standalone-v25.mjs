/**
 * Standalone builder v25 (Fence-Robustheit Freimodus):
 * Baut auf dem v24-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Eigentuemer-Meldung 31.10.2026, live reproduziert):
 * - Antwort 14k Zeichen OHNE Code-Fence (fence:nein), Guard prueft den
 *   GESAMTTEXT inkl. Prosa und stolpert ueber das Wort 'window' in der
 *   Prosa -> "E-FREE-FORBID: window" (falsches Positiv, Modul verworfen).
 * - Ursache Kette: v23-Prompt-Slim (F4) hat die Fence-Anweisung gekuerzt
 *   ("keine Erklaerung, keine Fences ... antworte direkt mit dem Modulcode")
 *   -> Modell liefert Prosa + fence-losen Code; UI-Extraktion
 *   (generate/modify: `var quelle=text;var fm=...`) nimmt bei fehlendem
 *   Fence den Gesamttext; registerFree-Guard scannt diesen Gesamttext.
 *
 * F0  Prompt wieder mit Fence-Pflicht (generate + modify, je 1x = 2x):
 *     "Liefere AUSSCHLIESSLICH einen ```js-Codeblock ..." (kurz,
 *     verbindlich, dezent: kein Text davor/danach, nur der Block).
 * F1  Extraktion tolerant (generate + modify-Erst + modify-Retry = 3x):
 *     kein Fence -> heuristisch ab "export const meta" bis Dateiende
 *     schneiden (Import-Block davor bleibt erhalten: frueheste
 *     `import `-Zeile vor meta wird mitgenommen), statt Gesamttext
 *     zu verwerfen/weiterzureichen.
 * F2  Guard NUR auf extrahiertem Code (registerFree, 1x defensiv):
 *     Prosa-Anteil vor dem Modul wird auch in registerFree noch
 *     abgeschnitten (idempotent, Import-erhaltend), BEVOR clean/is2D/
 *     FORBID-Scan laufen — Prosa wird nie gescannt, Code immer.
 * F3  Build-Stempel v25 (Kommentar, emptyDetail-Bits, buildTag,
 *     staleHint-mine, diagText-bld).
 *
 * Aufruf: node scripts/build-standalone-v25.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v25-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v25: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen. */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v25-syn-'));
  const keep = !!process.env.V25_DUMP;
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

// ---------- F0: Prompt wieder mit Fence-Pflicht (generate + modify) ----------
const OLD_PROMPT = 'Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences. Kein Nachdenken, keine Einleitung \\u2014 antworte direkt mit dem Modulcode.';
const NEW_PROMPT = 'Liefere AUSSCHLIESSLICH einen ```js-Codeblock mit dem kompletten Modulcode (kein Text davor/danach). Kein Nachdenken, keine Einleitung \\u2014 antworte nur mit dem ```js-Block.';

// ---------- F1: tolerante Extraktion (generate + modify-Erst + modify-Retry) ----------
const FENCE_RE = '/```(?:[a-zA-Z0-9_-]+)?\\n([\\s\\S]*?)```/.exec(text)';
const FENCE_RE_MOD = '/\\`\\`\\`(?:[a-zA-Z0-9_-]+)?\\n([\\s\\S]*?)\\`\\`\\`/.exec(text)';
const FALLBACK = 'else{var __m25=quelle.indexOf("export const meta");if(__m25>=0){var __i25=quelle.search(/^\\s*import[ \\t]/m);quelle=quelle.slice((__i25>=0&&__i25<__m25)?__i25:__m25);var __t25=quelle.lastIndexOf("}");if(__t25>0){quelle=quelle.slice(0,__t25+1);}}}';
const OLD_GEN_EXT = 'var quelle=text;var fm=' + FENCE_RE + ';if(fm&&fm[1]){quelle=fm[1];}quelle=quelle.trim();';
const NEW_GEN_EXT = 'var quelle=text;var fm=' + FENCE_RE + ';if(fm&&fm[1]){quelle=fm[1];}' + FALLBACK + 'quelle=quelle.trim();';
const OLD_MOD_EXT = 'var quelle=text;var fm=' + FENCE_RE_MOD + ';if(fm&&fm[1]){quelle=fm[1];}quelle=(quelle||"").trim();';
const NEW_MOD_EXT = 'var quelle=text;var fm=' + FENCE_RE + ';if(fm&&fm[1]){quelle=fm[1];}' + FALLBACK + 'quelle=(quelle||"").trim();';
const OLD_RETRY_EXT = 'quelle=text;var fm2=' + FENCE_RE_MOD + ';if(fm2&&fm2[1]){quelle=fm2[1];}quelle=(quelle||"").trim();';
const NEW_RETRY_EXT = 'quelle=text;var fm2=' + FENCE_RE + ';if(fm2&&fm2[1]){quelle=fm2[1];}' + FALLBACK + 'quelle=(quelle||"").trim();';
// v25-V1 (Erststand ohne Nachlauf-Kappung): Migrationsanker.
const FALLBACK_V1 = 'else{var __m25=quelle.indexOf("export const meta");if(__m25>=0){var __i25=quelle.search(/^\\s*import[ \\t]/m);quelle=quelle.slice((__i25>=0&&__i25<__m25)?__i25:__m25);}}';
const V1_GEN = 'var quelle=text;var fm=' + FENCE_RE + ';if(fm&&fm[1]){quelle=fm[1];}' + FALLBACK_V1 + 'quelle=quelle.trim();';
const V1_MOD = 'var quelle=text;var fm=' + FENCE_RE + ';if(fm&&fm[1]){quelle=fm[1];}' + FALLBACK_V1 + 'quelle=(quelle||"").trim();';
const V1_RETRY = 'quelle=text;var fm2=' + FENCE_RE + ';if(fm2&&fm2[1]){quelle=fm2[1];}' + FALLBACK_V1 + 'quelle=(quelle||"").trim();';
const V1_GUARD = 'var code=String(source||"");/*__FREE_FENCE_V25__*/try{var __m25=code.indexOf("export const meta");if(__m25>=0){var __i25=code.search(/^\\s*import[ \\t]/m);code=code.slice((__i25>=0&&__i25<__m25)?__i25:__m25);}}catch(__e25){}var is2D=';

// ---------- F2: Guard defensiv auf extrahierten Code (Prosa nie scannen) ----------
const OLD_GUARD_IN = 'var code=String(source||"");var is2D=';
const NEW_GUARD_IN = 'var code=String(source||"");/*__FREE_FENCE_V25__*/try{var __m25=code.indexOf("export const meta");if(__m25>=0){var __i25=code.search(/^\\s*import[ \\t]/m);code=code.slice((__i25>=0&&__i25<__m25)?__i25:__m25);var __t25=code.lastIndexOf("}");if(__t25>0){code=code.slice(0,__t25+1);}}}catch(__e25){}if(code.indexOf("export const meta")===-1||code.indexOf("export function init")===-1){throw new Error("E-FREE-SHAPE: init/meta fehlt (Antwort ohne ```js-Block?)");}var is2D=';

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 3], ['stream:true', 3],
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
    ['gbody.reasoning_effort="low"', 1],
    ['mbody.reasoning_effort="low"', 1],
    ['reasoning_effort="none"', 0],
    ['stream_options', 4],
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    ['reasoningAllowed', 5],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 7], ['_lastHttp', 6],
    ['_lastRetry', 7],
    ['_lastReqR', 3],
    ['this._lastReq={', 4],
    ['staleHint', 2], ['buildTag', 3],
    ['Build v25', 1], ['Build v24', 0], ['Strg+F5', 1],
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
    ['req_max_completion_tokens: ', 1],
    ['req_max_tokens: ', 1],
    ['req_reasoning_effort: ', 1],
    ['req_temperature: ', 1],
    ['req_400_fallback: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    ['req_retry_400_fallback: ', 1],
    // v24:
    ['Fix3 Import-Strip v24', 1],
    ['E-FREE-FORBID: import(', 1],
    ['import verblieben', 1],
    ['Z,fence:', 2],
    // v25 neu:
    ['__FREE_FENCE_V25__', 1],
    ['```js-Codeblock', 2],
    ['keine Erklaerung, keine Fences', 0],
    ['var __m25=', 4],
    ['var __i25=', 4],
    ['var __t25=', 4],
    ['}catch(__e25){}', 1],
    ['init/meta fehlt (Antwort ohne', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v25 Fence-Pflicht + tolerante Extraktion + Guard-nur-Code)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v25: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v24-import-strip-validierung',
    standalone: 'v25',
    befund: [
      'Live 31.10.2026 (fence:nein, 14k Zeichen): Antwort OHNE Code-Fence, Guard prueft Gesamttext inkl. Prosa und stolpert ueber Wort "window" -> E-FREE-FORBID: window (falsches Positiv).',
      'Ursache Kette: v23-Prompt-Slim kuerzte Fence-Anweisung ("keine Fences ... direkt mit dem Modulcode"); UI-Extraktion (generate/modify) reicht bei fehlendem Fence den Gesamttext an registerFree; Guard scannt Prosa mit.',
    ],
    fixes: [
      'F0 Prompt wieder mit Fence-Pflicht (generate + modify): AUSSCHLIESSLICH ```js-Codeblock, kein Text davor/danach',
      'F1 Extraktion tolerant (generate + modify-Erst + modify-Retry): ohne Fence heuristisch ab "export const meta" (Import-Block davor erhalten) bis Dateiende',
      'F2 Guard defensiv NUR auf extrahiertem Code (registerFree schneidet Prosa vor clean/is2D/FORBID-Scan ab, idempotent)',
      'F3 Build-Stempel v25',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v25: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v24'), 'kein v24-Stempel (falsche Basis)');
if (s.includes('standalone-build v25')) {
  let migrated = false;
  if (cnt(s, FALLBACK_V1) === 3 && cnt(s, V1_GUARD) === 1) {
    s = rep1(s, V1_GEN, NEW_GEN_EXT, 'Extraktion generate V1->V2');
    s = rep1(s, V1_MOD, NEW_MOD_EXT, 'Extraktion modify V1->V2');
    s = rep1(s, V1_RETRY, NEW_RETRY_EXT, 'Extraktion modify-Retry V1->V2');
    s = rep1(s, V1_GUARD, NEW_GUARD_IN, 'Guard-nur-Code V1->V2');
    migrated = true;
    console.log('  Migration: v25-V1 -> v25-V2 (Nachlauf-Prosa kappen + fruehes SHAPE)');
  }
  assertInlineScriptsParse(s);
  checkInvariants(s);
  if (!migrated) {
    console.log('build-v25: bereits v25 - ok (idempotent, exit 0)');
    process.exit(0);
  }
  await writeFile(FILE, s);
  console.log(`build-v25: migriert V1 -> V2 (${s.length} Zeichen)`);
  await writeReport(s);
  console.log('build-v25: OK v25 (Fence-Pflicht + tolerante Extraktion + Guard-nur-Code)');
  process.exit(0);
}

// ---------- F0: Prompt-Fence-Pflicht (beide Prompt-Bauer) ----------
must(cnt(s, OLD_PROMPT) === 2, 'Prompt-Anker: ' + cnt(s, OLD_PROMPT) + ', erwartet 2');
s = s.split(OLD_PROMPT).join(NEW_PROMPT);
console.log('  F0: Prompt-Fence-Pflicht (generate + modify)');

// ---------- F1: tolerante Extraktion ----------
s = rep1(s, OLD_GEN_EXT, NEW_GEN_EXT, 'Extraktion generate');
s = rep1(s, OLD_MOD_EXT, NEW_MOD_EXT, 'Extraktion modify');
s = rep1(s, OLD_RETRY_EXT, NEW_RETRY_EXT, 'Extraktion modify-Retry');
console.log('  F1: tolerante Extraktion (generate + modify + Retry)');

// ---------- F2: Guard nur auf extrahiertem Code ----------
s = rep1(s, OLD_GUARD_IN, NEW_GUARD_IN, 'Guard-nur-Code');
console.log('  F2: Guard-nur-Code (registerFree)');

// ---------- F3: Build-Stempel v25 ----------
s = rep1(s, 'bits.push("Build v24")', 'bits.push("Build v25")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v24";try{bld=this.buildTag();}', 'var bld="v25";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v24";},', 'buildTag:function(){return "v25";},', 'buildTag');
s = rep1(s, 'var mine=24;', 'var mine=25;', 'staleHint-mine');
s = rep1(s, ',10)||24;', ',10)||25;', 'staleHint-fallback');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v24 (Import-Strip positionsunabhaengig + Validierung, via scripts/build-standalone-v24.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v25 (Fence-Pflicht + tolerante Extraktion + Guard-nur-Code, via scripts/build-standalone-v25.mjs) -->');
  console.log('  Stempel: v25');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v25: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v25: OK v25 (Fence-Pflicht + tolerante Extraktion + Guard-nur-Code)');
