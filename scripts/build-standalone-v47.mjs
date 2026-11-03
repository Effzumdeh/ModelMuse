/**
 * Standalone builder v47 (Diagnose-Stempel nachziehen, 03.11.2026):
 * Baut auf dem v46-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund: Die Laufzeit-Diagnose meldete `build: v26`, obwohl der
 * Builder-Stand v46 ist (User sieht v46-Features). Ursache: Die Builder
 * v27..v46 haben den Laufzeit-Diagnose-Stempel nie mitgezogen — nur noch
 * HTML-Kommentar-Stempel angehaengt. Betroffen (je genau 1x im Artefakt):
 *   - emptyDetail: bits.push("Build v26")
 *   - diagText-Default: var bld="v26";try{bld=this.buildTag();}
 *   - buildTag:function(){return "v26";}
 *   - staleHint: var mine=26; + Fallback parseInt(...)||26
 * Parallel war src/runtime/livegen.js GEN_BUILD='v23' (dient dist/lab-player
 * via npm run build) — ebenfalls auf v47 gezogen.
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * D1 Diagnose-Stempel v26 -> v47 (alle 5 Stellen, rep1-geprueft).
 * D2 Kein Limit-Rest: Spotchecks dass weiter kein max_completion_tokens /
 *    max_tokens in Request-Bodies steht (v23-Entfernung intakt, nur
 *    Echo-Labels req_max_* + Strip-Hygiene + usage-Anzeige vorhanden).
 * S  Stempel v47 + Invarianten (< 600 KB) + Syntax-Gate.
 *
 * Nachfolger-Toleranz: build-standalone-v26.mjs + -v29.mjs pinnen
 * 'Build v26' in ihren Idempotenz-Invarianten; beide tragen jetzt die
 * etablierte is47-Toleranz (Muster wie v22/v23/v24-Nachfolger).
 *
 * Aufruf: node scripts/build-standalone-v47.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v47-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v47: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v46 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v47-syn-'));
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
          console.error('build-v47: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v47-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v45', 1], ['standalone-build v46', 1],
    ['standalone-build v47', 1],
    // D1: Laufzeit-Diagnose-Stempel v47 (exakt je 1x), Alt-Stempel raus.
    ['bits.push("Build v47")', 1],
    ['bits.push("Build v26")', 0],
    ['var bld="v47";try{bld=this.buildTag();}', 1],
    ['var bld="v26";try{bld=this.buildTag();}', 0],
    ['buildTag:function(){return "v47";},', 1],
    ['buildTag:function(){return "v26";},', 0],
    ['var mine=47;', 1],
    ['var mine=26;', 0],
    [',10)||47;', 1],
    [',10)||26;', 0],
    ['buildTag', 3], ['staleHint', 2], ['Strg+F5', 1],
    // D2: v23-Regel intakt — keine Limit-Params in Request-Bodies.
    ['temperature:0.2,max_completion_tokens', 0],
    ['temperature:0.2,max_tokens', 0],
    ['max_completion_tokens=131072', 0],
    ['max_completion_tokens:65536', 0],
    ['max_tokens=65536', 0],
    ['max_tokens=131072', 0],
    ['delete gbody.max_tokens', 0],
    ['delete mbody.max_tokens', 0],
    // Echo-/Strip-Hygiene + Usage-Anzeige bleiben (Beleg: kein Limit).
    ['req_max_completion_tokens: ', 1],
    ['req_max_tokens: ', 1],
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
  console.log('  Invarianten ok (v47 Diagnose-Stempel v47 + kein Limit)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v47: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v46-final-sprint',
    standalone: 'v47',
    befund: [
      'Diagnose meldete build: v26 bei Builder-Stand v46 (v27..v46 zogen Laufzeit-Stempel nie mit); GEN_BUILD in src/runtime/livegen.js war v23.',
      'Limit-Audit generate/modify/retry (direkt+proxy, alle Provider): kein Rest-Limit — v23-Entfernung intakt (nur Echo-Labels + Strip-Hygiene); usage exakt 32768 ist Upstream-/Modell-Default, kein gesendeter Param.',
    ],
    fixes: [
      'D1 Laufzeit-Diagnose-Stempel v26 -> v47 (emptyDetail-Bits + diagText-Default + buildTag + staleHint mine/Fallback)',
      'D2 GEN_BUILD v23 -> v47 in src/runtime/livegen.js (dist/lab-player via npm run build)',
      'D3 is47-Nachfolger-Toleranz in build-standalone-v26.mjs + -v29.mjs (Idempotenz-Invarianten, Muster wie v22/v23/v24)',
      'S Stempel v47 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v47: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v46'), 'kein v46-Stempel (falsche Basis)');
if (s.includes('standalone-build v48')) {
  console.log('build-v47: neuerer Stand v48 - ok (idempotent, exit 0)');
  process.exit(0);
}
if (s.includes('standalone-build v47')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v47: bereits v47 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- D1: Laufzeit-Diagnose-Stempel v26 -> v47 ----------
s = rep1(s, 'bits.push("Build v26")', 'bits.push("Build v47")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v26";try{bld=this.buildTag();}', 'var bld="v47";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v26";},', 'buildTag:function(){return "v47";},', 'buildTag');
s = rep1(s, 'var mine=26;', 'var mine=47;', 'staleHint-mine');
s = rep1(s, ',10)||26;', ',10)||47;', 'staleHint-Fallback');
console.log('  D1: Diagnose-Stempel v26 -> v47 (5 Stellen)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v46 (Final-Sprint: ETA flat 240 s + Modus-Auto + Funktions-Footer + docs/LICENSES.md + Ollama lokal, via scripts/build-standalone-v46.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v47 (Diagnose-Stempel v26->v47 + GEN_BUILD v23->v47 + Limit-Audit, via scripts/build-standalone-v47.mjs) -->');
  console.log('  Stempel: v47');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log(`build-v47: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v47: OK v47 (Diagnose-Stempel nachgezogen, kein Limit-Rest)');
