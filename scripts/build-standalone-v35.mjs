/**
 * Standalone builder v35 (J Modify in dieselbe Queue):
 * Baut auf dem v34-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Befund: Ueberarbeiten laeuft an der Queue vorbei
 * (scheinbar parallel, ueberlappt und ueberschreibt ggf. laufende
 * Generierung). Gewuenscht: Modify-Auftraege in dieselbe sequenzielle
 * Queue wie Generieren einreihen (gleiche Pumpe, Statusliste,
 * ETA/Overtime, kein paralleler Direkt-Call mehr), Ergebnis ersetzt
 * das bearbeitete Modell.
 *
 * Umsetzung datenseitig (keine Request-/Prompt-Aenderung):
 * J1  I18N-Keys jobGen/jobMod (de/en/es) als Auftragsart-Badge.
 * J2  enqueueGenerate: Auftraege tragen kind/kindKey ('gen'/'jobGen').
 * J3  pumpGenQueue: Dispatch je kind (mod -> modify(wish,labId)).
 * J4  pumpGenQueue: Statusmeldung je kind (modStatus/genStatus).
 * J5  submitModify: kein Direkt-Call mehr, sondern enqueueModify.
 * J6  enqueueModify: validiert, leert Eingabe, reiht mod-Auftrag ein.
 * J7  modify(wish,labId): Auftrags-Parameter, Lab per ID (Fallback aktiv).
 * J8  Ueberarbeiten-Button nie disabled (beauftragbar waehrend Lauf).
 * J9  Auftragsliste zeigt Art-Badge (job.kindKey).
 * J10 Gen-Fenster bleibt waehrend Pumpe sichtbar (auch reine Mod-Queue).
 * J11 Stempel v35 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v35.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v35-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v35: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v34 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v35-syn-'));
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
    ['standalone-build v33', 1], ['standalone-build v34', 1],
    ['standalone-build v35', 1],
    ['showcase: 5 Modelle', 1],
    // J: einheitliche Queue (gen + mod, eine Pumpe).
    ['jobGen', (s.includes('standalone-build v42') ? 5 : 4)], ['jobMod', (s.includes('standalone-build v42') ? 5 : 4)],
    ['enqueueModify', 2], ['modify(job.wish,job.labId)', 1],
    ["kind:'mod'", 1], ["kind:'gen'", 1],
    [':disabled="modBusy"', 0],
    ['genBusy||genNotice||genPumping', 1],
    ['job.kindKey', 1],
    ['submitModify', 2], ['modify:async function(jobWish,jobLabId)', 1],
    // v34-Vertrag bleibt.
    // v37-Nachfolger (Tele-Fenster): 3->4.
    ['toggleWinMin(', 4], ['win-dock v34', 1], ['id="part-info"', 1],
    // v33-Vertrag bleibt.
    ['mappingNote', 0], ['normExp:function', 1],
    // v32-Vertrag bleibt.
    ['etaSeconds:function', 1], ['länger als erwartet', 2],
    ['fertig nach {s} s', 2],
    // v31-Vertrag bleibt (v35: zwei Einreihungen teilen eine Pumpe).
    ['enqueueGenerate', 2], ['pumpGenQueue', 3], ['role="dialog"', (s.includes('standalone-build v54') ? 4 : 3)],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v35 Modify in derselben Queue)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v35: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v34-overlay-stapelung-minimieren-schliessen',
    standalone: 'v35',
    befund: [
      'Eigentuemer: Ueberarbeiten laeuft an der Queue vorbei (parallel, ueberschreibt ggf. laufende Generierung). Gewuenscht: Modify-Auftraege in dieselbe sequenzielle Queue (Pumpe, Statusliste, ETA/Overtime), kein Direkt-Call.',
    ],
    fixes: [
      'J1-J4 Auftragsarten (jobGen/jobMod) + Pump-Dispatch je kind',
      'J5-J7 submitModify enqueuet, modify nimmt Auftrags-Parameter',
      'J8-J10 Button nie disabled, Art-Badge, Fenster bei Pumpe sichtbar',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v35: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v34'), 'kein v34-Stempel (falsche Basis)');
if (s.includes('standalone-build v35')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v35: bereits v35 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- J1: I18N-Keys Auftragsart ----------
s = rep1(s,
  'I18N.de.modTotal="fertig nach {s} s";',
  'I18N.de.modTotal="fertig nach {s} s";' +
  'I18N.de.jobGen="Neu";I18N.de.jobMod="Überarbeiten";',
  'J1 de-Keys');
s = rep1(s,
  'I18N.en.modTotal="done after {s} s";',
  'I18N.en.modTotal="done after {s} s";' +
  'I18N.en.jobGen="New";I18N.en.jobMod="Revise";',
  'J1 en-Keys');
s = rep1(s,
  'modTotal:"listo tras {s} s",',
  'modTotal:"listo tras {s} s",' +
  'jobGen:"Nuevo",jobMod:"Revisar",',
  'J1 es-Keys');
console.log('  J1: Auftragsart-Keys (de/en/es)');

// ---------- J2: gen-Auftraege mit kind ----------
s = rep1(s,
  "var job={id:(this.genSeq=(this.genSeq||0)+1),term:term,statusKey:'jobWaiting',msg:''};",
  "var job={id:(this.genSeq=(this.genSeq||0)+1),kind:'gen',kindKey:'jobGen',term:term,statusKey:'jobWaiting',msg:''};",
  'J2 gen-kind');
console.log('  J2: gen-Auftraege mit kind');

// ---------- J3: Pump-Dispatch je kind ----------
s = rep1(s,
  "job.statusKey='jobRunning';var ok=false;try{await this.generate(job.term);ok=!this.genStatusBad;}catch(e){ok=false;}",
  "job.statusKey='jobRunning';var ok=false;try{if(job.kind==='mod'){await this.modify(job.wish,job.labId);ok=!this.modStatusBad;}else{await this.generate(job.term);ok=!this.genStatusBad;}}catch(e){ok=false;}",
  'J3 Dispatch');
console.log('  J3: Pump-Dispatch je kind');

// ---------- J4: Statusmeldung je kind ----------
s = rep1(s,
  'job.msg=String(this.genStatus||"").slice(0,120);',
  'job.msg=String(((job.kind===\'mod\')?this.modStatus:this.genStatus)||"").slice(0,120);',
  'J4 Status');
console.log('  J4: Statusmeldung je kind');

// ---------- J5: submitModify enqueuet ----------
s = rep1(s,
  'el.scrollIntoView({block:"center"});el.focus();}}catch(e){}return;}this.modify();},',
  'el.scrollIntoView({block:"center"});el.focus();}}catch(e){}return;}try{this.enqueueModify();}catch(eSM){}},',
  'J5 submitModify');
console.log('  J5: submitModify enqueuet (kein Direkt-Call)');

// ---------- J6: enqueueModify vor persistFree ----------
s = rep1(s,
  'persistFree:function(){',
  'enqueueModify:function(){var wish=(this.modDesc||"").trim();if(wish.length<2){this.modStatus=this.t(\'modTooShort\');this.modStatusBad=true;return;}if(!this.genKey){this.modStatus=this.keyMissingMsg;this.modStatusBad=true;return;}var lab=this.activeLab;if(!lab||!lab.id){this.modStatus=this.t(\'modNoSource\');this.modStatusBad=true;return;}var job={id:(this.genSeq=(this.genSeq||0)+1),kind:\'mod\',kindKey:\'jobMod\',term:wish,labId:lab.id,wish:wish,statusKey:\'jobWaiting\',msg:\'\'};this.genJobs.push(job);try{this.modDesc="";}catch(eCl){}try{this.pumpGenQueue();}catch(eP){}},' +
  'persistFree:function(){',
  'J6 enqueueModify');
console.log('  J6: enqueueModify-Methode');

// ---------- J7: modify mit Auftrags-Parametern ----------
s = rep1(s,
  'modify:async function(){var wish=(this.modDesc||"").trim();',
  'modify:async function(jobWish,jobLabId){var wish=String(jobWish!=null?jobWish:this.modDesc||"").trim();',
  'J7 Signatur');
s = rep1(s,
  'var lab=this.activeLab;var src=(lab&&(lab._source||lab.source))||null;',
  'var lab=null;try{if(jobLabId!=null){for(var __li=0;__li<this.labs.length;__li++){if(this.labs[__li]&&this.labs[__li].id===jobLabId){lab=this.labs[__li];break;}}if(!lab){this.modStatus=this.t(\'modNoSource\');this.modStatusBad=true;return;}}else{lab=this.activeLab;}}catch(eLab){lab=this.activeLab;}var src=(lab&&(lab._source||lab.source))||null;',
  'J7 Lab-Lookup');
console.log('  J7: modify mit Auftrags-Parametern');

// ---------- J8: Button nie disabled ----------
s = rep1(s,
  '@click="submitModify" :disabled="modBusy"',
  '@click="submitModify"',
  'J8 Button');
console.log('  J8: Button nie disabled');

// ---------- J9: Art-Badge in Auftragsliste ----------
s = rep1(s,
  '{{job.term}}</span><span>{{t(job.statusKey)}}',
  '{{job.term}}</span><span class="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-1">{{t(job.kindKey)}}</span><span>{{t(job.statusKey)}}',
  'J9 Badge');
console.log('  J9: Art-Badge');

// ---------- J10: Fenster bei Pumpe sichtbar ----------
s = rep1(s,
  '<div id="gen-status" v-if="genBusy||genNotice"',
  '<div id="gen-status" v-if="genBusy||genNotice||genPumping"',
  'J10 Sichtbarkeit');
console.log('  J10: Fenster bei Pumpe sichtbar');

// ---------- J11: Stempel ----------
{
  const stamp = '<!-- standalone-build v34 (Overlay-Stapelung + Minimieren + Schliessen, via scripts/build-standalone-v34.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v35 (Modify in derselben Queue, via scripts/build-standalone-v35.mjs) -->');
  console.log('  Stempel: v35');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v35: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v35: OK v35 (Modify in derselben Queue)');
