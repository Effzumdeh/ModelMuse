/**
 * Standalone builder v24 (Freimodus-Ausfuehrung + Validierung):
 * Baut auf dem v23-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Eignetuemer-Meldung 31.10.2026, live reproduziert):
 * - 5500-Token-Antwort, HTTP 200, finish STOP kommt an (Reader/Fence/Shape
 *   ok), scheitert aber in window.__viewer.registerFree mit
 *   "Quelle ungueltig oder nicht nutzbar. Cannot use import statement
 *   outside a module".
 * - Ursache: Fix3-Strip war zeilenverankert (/^\s*import.../gm). Jeder
 *   statische Import NICHT am Zeilenanfang (zweite Import-Anweisung in
 *   derselben Zeile, `;import` nach Code, Side-effect-Import mitten in der
 *   Zeile — typischer "Provide code only"-Output) ueberlebte den Strip.
 *   new Function ist Classic-Script (kein Modul) -> Engine-SyntaxError,
 *   als unklassifizierter Engine-Text an die Statuszeile gehaengt.
 * - Zweitbefund (eigener Repro): Trailing-//-Kommentar ohne Zeilenumbruch
 *   kommentiert den angehaengten Epilog (`;return {...}`) aus -> fn liefert
 *   undefined -> TypeError statt Modul.
 *
 * F0  Import-Strip positionsunabhaengig: Treffer auf der offset-gleichen
 *     Maske `clean` (Kommentare/Strings geblankt, Offsets identisch) per
 *     globalem Regex suchen (statisch mit/ohne from + Side-effect, NICHT
 *     am Zeilenanfang verankert, kein dynamisches import(), kein
 *     Property (.import) dank (?:^|[^.\w$])-Anker), Bereiche in `code`
 *     UND `clean` mit Leerzeichen blanken (Zeilenumbrueche erhalten).
 * F1  Nachvalidierung: verbliebenes `import` (z.B. import.meta) ->
 *     E-FREE-SHAPE "import verblieben" statt Engine-SyntaxError;
 *     dynamisches import() -> E-FREE-FORBID: import( (klassifiziert).
 * F2  Epilog-Sicherung: genau ein "\n" am Code-Ende, damit ein
 *     Trailing-Kommentar den Rueckgabe-Epilog nicht verschluckt.
 * F3  Status-Metriken (generate + modify): "[<len>Z,fence:ja/nein]" vor
 *     der Fehlermeldung — Content-Laenge, Fence-ja/nein und
 *     Validierungsfehler (E-FREE-*) stehen kuenftig getrennt in der
 *     Statuszeile statt nur "Quelle ungueltig".
 * F4  Build-Stempel v24 (Kommentar, emptyDetail-Bits, buildTag,
 *     staleHint-mine, diagText-bld).
 *
 * Aufruf: node scripts/build-standalone-v24.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v24-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v24: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen. */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v24-syn-'));
  const keep = !!process.env.V24_DUMP;
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

// ---------- F0/F1/F2: neuer Strip + Nachvalidierung + Epilog-Sicherung ----------
// Anker sind String.raw (kein Backtick, kein ${ im Alttext).
const OLD_STRIP = String.raw`/*Fix3 Import-Strip*/code=code.replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"]\s*;?/gm,"");code=code.replace(/^\s*import\s*['"][^'"]+['"]\s*;?/gm,"");`;
const NEW_STRIP = String.raw`/*Fix3 Import-Strip v24 positionsunabhaengig (Treffer auf offset-gleicher Maske clean, in code+clean blanken)*/var __v24r=[];try{var __v24re=/(?:^|[^.\w$])import\b(?!\s*\()(?!\s*\.)[^;]*?\bfrom\b[^;]*?(?:;|(?=\n|$))|(?:^|[^.\w$])import\b(?!\s*\()(?!\s*\.)[^;\n]*?(?:;|(?=\n|$))/g,__v24m;while((__v24m=__v24re.exec(clean))!==null){if(__v24m[0].length===0){__v24re.lastIndex++;continue;}__v24r.push([__v24m.index,__v24m.index+__v24m[0].length]);}}catch(__v24e){}try{__v24r.sort(function(a,b){return b[0]-a[0];});for(var __v24k=0;__v24k<__v24r.length;__v24k++){var __v24a=__v24r[__v24k][0],__v24b=__v24r[__v24k][1],__v24s="";for(var __v24j=__v24a;__v24j<__v24b;__v24j++){__v24s+=code.charAt(__v24j)==="\n"?"\n":" ";}code=code.slice(0,__v24a)+__v24s+code.slice(__v24b);clean=clean.slice(0,__v24a)+__v24s+clean.slice(__v24b);}}catch(__v24e2){}if(/(?:^|[^.\w$])import\s*\(/.test(clean)){throw new Error("E-FREE-FORBID: import(");}if(!/[\r\n]$/.test(code)){code+="\n";}`;

const OLD_EXPORTCHK = String.raw`if(/export\s+/.test(code)){throw new Error("E-FREE-SHAPE: export unerwartet");}`;
const NEW_EXPORTCHK = String.raw`if(/(?:^|[^.\w$])import\b/.test(clean)){throw new Error("E-FREE-SHAPE: import verblieben");}if(/export\s+/.test(code)){throw new Error("E-FREE-SHAPE: export unerwartet");}`;

// ---------- F3: Status-Metriken (Content-Laenge + Fence) ----------
const OLD_GEN_CATCH = String.raw`try{reg=window.__viewer.registerFree(fid,quelle);}catch(e){this.genStatus=this.t('badSource')+" "+(e&&e.message?e.message:e);this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}`;
const NEW_GEN_CATCH = String.raw`try{reg=window.__viewer.registerFree(fid,quelle);}catch(e){var v24m="";try{v24m=(e&&e.message?e.message:e);}catch(eM){}var v24l=0;try{v24l=String(quelle||"").length;}catch(eL){}var v24f="nein";try{v24f=((fm&&fm[1])?"ja":"nein");}catch(eF){}this.genStatus=this.t('badSource')+" ["+v24l+"Z,fence:"+v24f+"] "+v24m;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}`;

const OLD_MOD_CATCH = String.raw`try{reg=window.__viewer.registerFree(lab.id,quelle);}catch(e){this.modStatus=this.t('badSource')+" "+(e&&e.message?e.message:e);this.modStatusBad=true;return;}`;
const NEW_MOD_CATCH = String.raw`try{reg=window.__viewer.registerFree(lab.id,quelle);}catch(e){var v24m="";try{v24m=(e&&e.message?e.message:e);}catch(eM){}var v24l=0;try{v24l=String(quelle||"").length;}catch(eL){}var v24f="nein";try{v24f=((fm&&fm[1])?"ja":"nein");}catch(eF){}this.modStatus=this.t('badSource')+" ["+v24l+"Z,fence:"+v24f+"] "+v24m;this.modStatusBad=true;return;}`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', (s.includes('standalone-build v46') ? 29 : (s.includes('standalone-build v42') ? 31 : (s.includes('standalone-build v40') ? 28 : 26)))], ['OpenRouter', (s.includes('standalone-build v42') ? 16 : (s.includes('standalone-build v40') ? 13 : 12))],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 2], ['stream:true', 3],
    ['temperature:0.2,max_completion_tokens', (s.includes('standalone-build v48') ? 2 : 0)],
    ['temperature:0.2,max_tokens', 0],
    ['max_completion_tokens=131072', 0],
    ['max_tokens=65536', 0],
    ['max_tokens=131072', 0],
    ['delete gbody.max_tokens', (s.includes('standalone-build v50') ? 1 : 0)],
    ['delete mbody.max_tokens', (s.includes('standalone-build v50') ? 1 : 0)],
    ['budgetRetryable', 3],
    ['reasoning_effort', (s.includes('standalone-build v50') ? 12 : 10)],
    ['req_reasoning_effort: ', 1],
    ['req_retry_reasoning_effort: ', 1],
    // v26-Nachfolger (R0 Reasoning xhigh statt low): low 1->0, xhigh 0->1 (je Body).
    ['reasoning_effort="none"', 0],
    ['stream_options', 4],
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    // v26-Nachfolger (Reasoning xhigh/max mit Leitplanken): reasoningAllowed 5->7.
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', (s.includes('standalone-build v42') ? 13 : 10)],
    // v37-Nachfolger (Tele-Snapshot liest _lastChatInfo/_lastHttp je +1): 7->8, 6->7.
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 8], ['_lastHttp', 7],
    // v37-Nachfolger (Tele-Snapshot liest _lastRetry +1): 7->8.
    ['_lastRetry', 8],
    ['_lastReqR', 3],
    ['this._lastReq={', (s.includes('standalone-build v50') ? 6 : 4)],
    ['staleHint', 2], ['buildTag', 3],
    ['Build v23', 0], ['Strg+F5', 1],
    ['slice(0,200)', 2], ['slice(0,160)', 0],
    ['slice(0,2048)', 2],
    ['emptyResponse', (s.includes('standalone-build v42') ? 5 : 4)],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    // v26-Nachfolger (T0 2D-Vertrag im Prompt): 2->3 (generate + modify + 2D).
    ['diagText:function', 1], ['copyDiag:function', 1],
    ['copyDiagBtn', (s.includes('standalone-build v42') ? 5 : 4)],
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
    // v24 neu:
    ['Fix3 Import-Strip v24', 1],
    ['E-FREE-FORBID: import(', 1],
    ['import verblieben', 1],
    ['Z,fence:', 2],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v26-Toleranz: R0 low->xhigh (je Body 1->0), reasoningAllowed 5->7; T0 2D-Prompt (Fence-Satz 2->3).
  const is26 = s.includes('standalone-build v26');
  must(cnt(s, 'gbody.reasoning_effort="low"') === 1 || (is26 && cnt(s, 'gbody.reasoning_effort="low"') === 0), 'Invariante gbody-low: ' + cnt(s, 'gbody.reasoning_effort="low"') + ', erwartet 1 (v26: 0)');
  must(cnt(s, 'mbody.reasoning_effort="low"') === 1 || (is26 && cnt(s, 'mbody.reasoning_effort="low"') === 0), 'Invariante mbody-low: ' + cnt(s, 'mbody.reasoning_effort="low"') + ', erwartet 1 (v26: 0)');
  must(cnt(s, 'reasoningAllowed') === 5 || (is26 && cnt(s, 'reasoningAllowed') === 7), 'Invariante reasoningAllowed: ' + cnt(s, 'reasoningAllowed') + ', erwartet 5 (v26: 7)');
  must(cnt(s, 'Kein Nachdenken, keine Einleitung') === 2 || (is26 && cnt(s, 'Kein Nachdenken, keine Einleitung') === 3), 'Invariante Kein-Nachdenken-Satz: ' + cnt(s, 'Kein Nachdenken, keine Einleitung') + ', erwartet 2 (v26: 3)');
  // v25-Toleranz: Build-Stempel v24->v25 (v25 aendert Diagnose-Default/buildTag/mine).
  const is25 = s.includes('standalone-build v25');
  must(cnt(s, 'Build v24') === 1 || (is25 && cnt(s, 'Build v24') === 0), 'Invariante Build v24: ' + cnt(s, 'Build v24') + ', erwartet 1 (v25: 0)');
  must(cnt(s, 'Build v25') === 0 || (is25 && cnt(s, 'Build v25') === 1), 'Invariante Build v25: ' + cnt(s, 'Build v25') + ', erwartet 0 (v25: 1)');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v24 Import-Strip + Validierung + Metriken)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v24: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v23-freemodus-ausfuehrung',
    standalone: 'v24',
    befund: [
      'Live 31.10.2026 (baseten-direct, muse-spark-open-1026): 5500-Token-Antwort, HTTP 200, finish stop kommt an, scheitert in registerFree mit "Cannot use import statement outside a module" (Repro am Artefakt bestaetigt).',
      'Ursache: Fix3-Strip zeilenverankert (/^\\s*import.../gm) — nicht-zeilenstartende statische Imports ueberleben, new Function (Classic, kein Modul) verwirft das gueltige Modul.',
      'Zweitbefund: Trailing-//-Kommentar ohne Umbruch kommentiert den Rueckgabe-Epilog aus (fn -> undefined).',
    ],
    fixes: [
      'F0 Import-Strip positionsunabhaengig (Treffer auf offset-gleicher Maske clean, blanken in code+clean; dynamisches import() und .import-Property ausgenommen)',
      'F1 Nachvalidierung: verbliebenes import -> E-FREE-SHAPE (klassifiziert), dynamisches import() -> E-FREE-FORBID',
      'F2 Epilog-Sicherung: genau ein NL am Code-Ende (Trailing-Kommentar schluckt ;return nicht mehr)',
      'F3 Status-Metriken generate+modify: [LaengeZ,fence:ja/nein] + klassifizierter Validierungsfehler',
      'F4 Build-Stempel v24',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v24: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v23'), 'kein v23-Stempel (falsche Basis)');
{
  const DOTGUARD = String.raw`(?!\s*\.)`;
  must(cnt(NEW_STRIP, DOTGUARD) === 2, 'v24 Strip-Dotguard fehlt');
  var V1_STRIP = NEW_STRIP.split(DOTGUARD).join('');
  must(V1_STRIP !== NEW_STRIP && !V1_STRIP.includes(DOTGUARD), 'v24 V1-Ableitung');
}
const DOT2 = String.raw`(?!\s*\()(?!\s*\.)`;
if (s.includes('standalone-build v24')) {
  if (s.includes(DOT2)) {
    assertInlineScriptsParse(s);
    checkInvariants(s);
    console.log('build-v24: bereits v24 - ok (idempotent, exit 0)');
    process.exit(0);
  }
  // Migration V1 -> V2 (nur Strip-Delta; Rest ist bereits v24).
  s = rep1(s, V1_STRIP, NEW_STRIP, 'Import-Strip v24 dot-guard');
  checkInvariants(s);
  assertInlineScriptsParse(s);
  await writeFile(FILE, s);
  console.log(`build-v24: migriert V1 -> V2 (${s.length} Zeichen)`);
  await writeReport(s);
  console.log('build-v24: OK v24 (Import-Strip + Validierung + Metriken)');
  process.exit(0);
}

// ---------- F0/F1/F2: Strip + Validierung + Epilog-Sicherung ----------
s = rep1(s, OLD_STRIP, NEW_STRIP, 'Import-Strip v24');
s = rep1(s, OLD_EXPORTCHK, NEW_EXPORTCHK, 'Rest-Import-Validierung');

// ---------- F3: Status-Metriken generate + modify ----------
s = rep1(s, OLD_GEN_CATCH, NEW_GEN_CATCH, 'Status-Metriken generate');
s = rep1(s, OLD_MOD_CATCH, NEW_MOD_CATCH, 'Status-Metriken modify');

// ---------- F4: Build-Stempel v24 ----------
s = rep1(s, 'bits.push("Build v23")', 'bits.push("Build v24")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v23";try{bld=this.buildTag();}', 'var bld="v24";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v23";},', 'buildTag:function(){return "v24";},', 'buildTag');
s = rep1(s, 'var mine=23;', 'var mine=24;', 'staleHint-mine');
s = rep1(s, ',10)||23;', ',10)||24;', 'staleHint-fallback');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v23 (kein Limit + Request-Echo + Prompt-Slim, via scripts/build-standalone-v23.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v24 (Import-Strip positionsunabhaengig + Validierung, via scripts/build-standalone-v24.mjs) -->');
  console.log('  Stempel: v24');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v24: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v24: OK v24 (Import-Strip + Validierung + Metriken)');
