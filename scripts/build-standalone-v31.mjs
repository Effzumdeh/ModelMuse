/**
 * Standalone builder v31 (A Eck-Overlay + B ETA-Countdown + C Auftrags-Queue):
 * Baut auf dem v30-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Wuensche 31.10.2026:
 * A) Ueberarbeiten-Dialog wie Generieren-Overlay unten in der Ecke
 *    (Titel 'Modell ueberarbeiten' bleibt, Geometrie ans Gen-Overlay
 *    angeglichen: position:fixed;bottom:16px;right:16px).
 * B) ETA-Anzeige in beiden Overlays (ca. 1 Minute, Countdown, danach
 *    Geduld-Hinweis de/en/es).
 * C) Auftrags-Queue fuer parallele Generierungen (Eingabe nach Start
 *    leeren, weitere Generierung beauftragbar waehrend eine laeuft,
 *    Status je Auftrag, Ergebnisse landen als eigene Modelle).
 *
 * Umsetzung datenseitig (kein Neuaufbau, keine Request-/Prompt-Aenderung):
 * E1-E3  Neue I18N-Keys de/en/es (genEta/modEta/genPatient/modPatient/
 *         genJobsTitle/genStopped/jobWaiting/jobRunning/jobDone/jobError).
 * E4      Neue Data-Felder (genJobs/genSeq/genPumping/genEta/genEtaTimer/
 *         genPatient/modEta/modEtaTimer/modPatient).
 * E5      Neue Computed (genEtaText/modEtaText, {s}-Interpolation).
 * E6      Generieren-Button: @click enqueueGenerate, nie disabled
 *         (beauftragbar waehrend ein Auftrag laeuft).
 * E7-E8   Gen-Overlay: ETA-Zeile + Geduld-Hinweis (busy) + Auftragsliste.
 * E9-E10  Mod-Overlay: Eck-Geometrie wie Gen-Overlay + ETA/Patient (busy).
 * E11-E13 generate(jobTerm): Term-Parameter, Eingabe nach Start leeren,
 *         ETA-Start/Stopp um den bestehenden Ablauf.
 * E14-E15 modify: Eingabe nach Start leeren, ETA-Start/Stopp.
 * E16     Neue Methoden (enqueueGenerate/pumpGenQueue/startGenEta/
 *         stopGenEta/startModEta/stopModEta) vor persistFree.
 * E17     cancelGenerate: wartende Auftraege als angehalten markieren.
 * E18     Stempel v31 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v31.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v31-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v31: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v30 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v31-syn-'));
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
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1],
    ['standalone-build v31', 1],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    ['modify:async function', 1], ['role="dialog"', 2], ['id="gen-status"', 1],
    ['{id:"demo-2d-chart",track', 1], ['explanations:{de:[', 6],
    // v32-Nachfolger (ETA-Tabelle liest Default): 5->6.
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 6],
    ['genReasoning:"xhigh"', 1],
    // v31-Marker.
    // v35-Nachfolger (eine Pumpe, zwei Einreihungen): 2->3.
    ['enqueueGenerate', 2], ['pumpGenQueue', 3],
    ['startGenEta', 2], ['stopGenEta', 2], ['startModEta', 2], ['stopModEta', 2],
    ['genEtaText', 2], ['modEtaText', 2],
    ['genJobsTitle', 4], ['genPatient', 8], ['modPatient', 8],
    // v35-Nachfolger (mod-Einreihung teilt Status): 6->7.
    ['jobWaiting', 7], ['jobRunning', 4], ['jobDone', 4], ['jobError', 6],
    ['genStopped', 4], ['genJobs:[]', 1],
    ['id="gen-jobs"', 1], ['id="mod-status"', 1],
    ['position:fixed;bottom:16px;right:16px', 2],
    ['@click="generate"', 0], ['@click="enqueueGenerate"', 1],
    ['Hab noch einen Moment Geduld.', 2],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v31 Eck-Overlay + ETA + Queue)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v31: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v30-r0-call-reparatur',
    standalone: 'v31',
    befund: [
      'Eigentuemer 31.10.2026: A) Ueberarbeiten als Eck-Overlay, B) ETA-Countdown mit Geduld-Hinweis (de/en/es), C) Auftrags-Queue fuer parallele Generierungen.',
    ],
    fixes: [
      'E1-E5 I18N (10 Keys x de/en/es) + Data + Computed (genEtaText/modEtaText)',
      'E6 Generieren-Button nie disabled (enqueueGenerate)',
      'E7-E8 Gen-Overlay: ETA + Geduld-Hinweis + Auftragsliste (genJobs)',
      'E9-E10 Mod-Overlay: Eck-Geometrie wie Gen-Overlay + ETA/Patient',
      'E11-E17 Queue-Pumpe (sequenziell, je Auftrag eigenes Modell) + Eingabe leeren + Stopp leert Warteschlange',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v31: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v30'), 'kein v30-Stempel (falsche Basis)');
if (s.includes('standalone-build v31')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v31: bereits v31 - ok (idempotent, exit 0)');
  process.exit(0);
}

const CRLF = String.fromCharCode(13, 10);

// ---------- E1: de-Keys ----------
s = rep1(s,
  'I18N.de.modifyTitle="Modell \u00fcberarbeiten";',
  'I18N.de.modifyTitle="Modell \u00fcberarbeiten";' +
  'I18N.de.genEta="ca. 1 Minute \u00b7 noch {s} s";' +
  'I18N.de.genPatient="Komplexe Modelle brauchen manchmal etwas l\u00e4nger. Hab noch einen Moment Geduld.";' +
  'I18N.de.modEta="ca. 1 Minute \u00b7 noch {s} s";' +
  'I18N.de.modPatient="Komplexe Modelle brauchen manchmal etwas l\u00e4nger. Hab noch einen Moment Geduld.";' +
  'I18N.de.genJobsTitle="Auftr\u00e4ge";' +
  'I18N.de.genStopped="Angehalten.";' +
  'I18N.de.jobWaiting="wartet";' +
  'I18N.de.jobRunning="l\u00e4uft";' +
  'I18N.de.jobDone="fertig";' +
  'I18N.de.jobError="Fehler";',
  'E1 de-Keys');
console.log('  E1: de-Keys (10)');

// ---------- E2: en-Keys ----------
s = rep1(s,
  'I18N.en.modifyTitle="Revise model";',
  'I18N.en.modifyTitle="Revise model";' +
  'I18N.en.genEta="about 1 minute \u00b7 {s} s left";' +
  'I18N.en.genPatient="Complex models sometimes take a bit longer. Hang on a moment.";' +
  'I18N.en.modEta="about 1 minute \u00b7 {s} s left";' +
  'I18N.en.modPatient="Complex models sometimes take a bit longer. Hang on a moment.";' +
  'I18N.en.genJobsTitle="Jobs";' +
  'I18N.en.genStopped="Stopped.";' +
  'I18N.en.jobWaiting="queued";' +
  'I18N.en.jobRunning="running";' +
  'I18N.en.jobDone="done";' +
  'I18N.en.jobError="error";',
  'E2 en-Keys');
console.log('  E2: en-Keys (10)');

// ---------- E3: es-Keys ----------
s = rep1(s,
  'modifyTitle:"Revisar modelo",',
  'modifyTitle:"Revisar modelo",' +
  'genEta:"aprox. 1 minuto \u00b7 quedan {s} s",' +
  'genPatient:"Los modelos complejos a veces tardan un poco m\u00e1s. Ten un poco m\u00e1s de paciencia.",' +
  'modEta:"aprox. 1 minuto \u00b7 quedan {s} s",' +
  'modPatient:"Los modelos complejos a veces tardan un poco m\u00e1s. Ten un poco m\u00e1s de paciencia.",' +
  'genJobsTitle:"Trabajos",' +
  'genStopped:"Detenido.",' +
  'jobWaiting:"en espera",' +
  'jobRunning:"en curso",' +
  'jobDone:"listo",' +
  'jobError:"error",',
  'E3 es-Keys');
console.log('  E3: es-Keys (10)');

// ---------- E4: Data ----------
s = rep1(s,
  'genBusy:false,modOverlay:false,modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,',
  'genBusy:false,modOverlay:false,modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,' +
  'genJobs:[],genSeq:0,genPumping:false,genEta:0,genEtaTimer:null,genPatient:false,' +
  'modEta:0,modEtaTimer:null,modPatient:false,',
  'E4 Data');
console.log('  E4: Data (Queue + ETA)');

// ---------- E5: Computed ----------
s = rep1(s,
  'museCmd:function(){return "";},',
  'museCmd:function(){return "";},' +
  'genEtaText:function(){var s=this.genEta||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genEta)||I18N.de.genEta||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},' +
  'modEtaText:function(){var s=this.modEta||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modEta)||I18N.de.modEta||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},',
  'E5 Computed');
console.log('  E5: Computed (genEtaText/modEtaText)');

// ---------- E6: Generieren-Button (nie disabled, enqueue) ----------
s = rep1(s,
  '<button @click="generate" :disabled="genBusy" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold disabled:opacity-50"><span v-if="genBusy" aria-hidden="true" class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>{{genBusy?t(\'genRunning\'):t(\'generateBtn\')}}</button>',
  '<button @click="enqueueGenerate" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold">{{t(\'generateBtn\')}}</button>',
  'E6 Button');
console.log('  E6: Button (enqueue, nie disabled)');

// ---------- E7: Gen-Overlay ETA ----------
s = rep1(s,
  '{{t(\'genStop\')}}</button></div><div v-else-if="genNotice&&genNotice.kind===\'done\'"',
  '{{t(\'genStop\')}}</button></div>' +
  '<p v-if="genBusy" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genEtaText}}</p>' +
  '<p v-if="genBusy&&genPatient" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{t(\'genPatient\')}}</p>' +
  '<div v-else-if="genNotice&&genNotice.kind===\'done\'"',
  'E7 Gen-ETA');
console.log('  E7: Gen-Overlay ETA + Geduld');

// ---------- E8: Gen-Overlay Auftragsliste ----------
s = rep1(s,
  'genNotice.msg}}</p><button type="button" @click="dismissGenNotice" :aria-label="t(\'genClose\')" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 min-h-[44px] min-w-[44px] text-sm">\u00d7</button></div></div>',
  'genNotice.msg}}</p><button type="button" @click="dismissGenNotice" :aria-label="t(\'genClose\')" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 min-h-[44px] min-w-[44px] text-sm">\u00d7</button></div>' +
  '<div v-if="genJobs.length" id="gen-jobs" class="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2"><p class="text-xs font-semibold">{{t(\'genJobsTitle\')}}</p><div v-for="job in genJobs" :key="job.id" class="mt-1 flex items-center gap-2 text-xs"><span class="flex-1 min-w-0 truncate">{{job.term}}</span><span>{{t(job.statusKey)}}</span></div></div>' +
  '</div>',
  'E8 Auftragsliste');
console.log('  E8: Gen-Overlay Auftragsliste');

// ---------- E9: Mod-Overlay Eck-Geometrie + id ----------
s = rep1(s,
  '<div v-if="modOverlay" class="fixed bottom-16 right-4 z-50 w-[min(92vw,24rem)]',
  '<div v-if="modOverlay" id="mod-status" style="position:fixed;bottom:16px;right:16px;z-index:50;max-width:min(92vw,22rem);" class="z-50 w-[min(92vw,24rem)]',
  'E9 Mod-Ecke');
console.log('  E9: Mod-Overlay Eck-Geometrie');

// ---------- E10: Mod-Overlay ETA ----------
s = rep1(s,
  '{{t(\'genClose\')}}</button>' + CRLF + '</div>' + CRLF + '<div class="mt-2 flex flex-wrap gap-2">' + CRLF + '<button type="button" @click="deleteLab"',
  '{{t(\'genClose\')}}</button>' + CRLF + '</div>' +
  '<div v-if="modBusy" class="mt-2 flex items-center gap-2"><span aria-hidden="true" class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"></span><p class="text-sm font-medium">{{modEtaText}}</p></div>' + CRLF +
  '<p v-if="modBusy&&modPatient" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{t(\'modPatient\')}}</p>' + CRLF +
  '<div class="mt-2 flex flex-wrap gap-2">' + CRLF + '<button type="button" @click="deleteLab"',
  'E10 Mod-ETA');
console.log('  E10: Mod-Overlay ETA + Geduld');

// ---------- E11: generate-Signatur (Auftrags-Term) ----------
s = rep1(s,
  'generate:async function(){var term=(this.genDesc||"").trim();',
  'generate:async function(jobTerm){var term=String(jobTerm!=null?jobTerm:this.genDesc||"").trim();',
  'E11 Signatur');
console.log('  E11: generate(jobTerm)');

// ---------- E12: generate-Start (Eingabe leeren + ETA-Start) ----------
s = rep1(s,
  'var prompt=this.buildFreePrompt(term,this.lang);this.genBusy=true;',
  'try{this.genDesc="";}catch(eGenClear){}var prompt=this.buildFreePrompt(term,this.lang);this.genBusy=true;try{this.startGenEta();}catch(eGenEta0){}',
  'E12 Gen-Start');
console.log('  E12: Eingabe leeren + ETA-Start');

// ---------- E13: generate-Finally (ETA-Stopp) ----------
s = rep1(s,
  '}}finally{this.genBusy=false;try{this.genAbort=null;}catch(eGB){}}},' + CRLF + 'persistFree:function(){',
  '}}finally{try{this.stopGenEta();}catch(eGenEta1){}this.genBusy=false;try{this.genAbort=null;}catch(eGB){}}},' + CRLF + 'persistFree:function(){',
  'E13 Gen-Stopp');
console.log('  E13: ETA-Stopp');

// ---------- E14: modify-Start (Eingabe leeren + ETA-Start) ----------
s = rep1(s,
  'var prompt=this.buildModifyPrompt(wish,src);this.modBusy=true;',
  'try{this.modDesc="";}catch(eModClear){}var prompt=this.buildModifyPrompt(wish,src);this.modBusy=true;try{this.startModEta();}catch(eModEta0){}',
  'E14 Mod-Start');
console.log('  E14: Mod-Eingabe leeren + ETA-Start');

// ---------- E15: modify-Finally (ETA-Stopp) ----------
s = rep1(s,
  '}finally{this.modBusy=false;}},',
  '}finally{try{this.stopModEta();}catch(eModEta1){}this.modBusy=false;}},',
  'E15 Mod-Stopp');
console.log('  E15: Mod-ETA-Stopp');

// ---------- E16: Queue-Methoden vor persistFree ----------
s = rep1(s,
  'persistFree:function(){',
  'enqueueGenerate:function(){var term=(this.genDesc||"").trim();if(term.length<2){this.genStatus=this.t(\'termTooShort\');this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}if(!this.genKey){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var job={id:(this.genSeq=(this.genSeq||0)+1),term:term,statusKey:\'jobWaiting\',msg:\'\'};this.genJobs.push(job);try{this.genDesc="";}catch(eCl){}try{this.pumpGenQueue();}catch(eP){}},' +
  'pumpGenQueue:async function(){if(this.genPumping){return;}this.genPumping=true;try{for(;;){var job=null;for(var i=0;i<this.genJobs.length;i++){if(this.genJobs[i].statusKey===\'jobWaiting\'){job=this.genJobs[i];break;}}if(!job){break;}job.statusKey=\'jobRunning\';var ok=false;try{await this.generate(job.term);ok=!this.genStatusBad;}catch(e){ok=false;}try{job.statusKey=ok?\'jobDone\':\'jobError\';job.msg=String(this.genStatus||"").slice(0,120);}catch(e2){try{job.statusKey=\'jobError\';}catch(e3){}}} }finally{this.genPumping=false;}},' +
  'startGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEta=60;this.genPatient=false;var self=this;try{this.genEtaTimer=setInterval(function(){try{self.genEta-=1;if(self.genEta<=0){self.genEta=0;self.genPatient=true;try{clearInterval(self.genEtaTimer);}catch(e){}self.genEtaTimer=null;}}catch(e2){}},1000);}catch(e3){}},' +
  'stopGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEtaTimer=null;},' +
  'startModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEta=60;this.modPatient=false;var self=this;try{this.modEtaTimer=setInterval(function(){try{self.modEta-=1;if(self.modEta<=0){self.modEta=0;self.modPatient=true;try{clearInterval(self.modEtaTimer);}catch(e){}self.modEtaTimer=null;}}catch(e2){}},1000);}catch(e3){}},' +
  'stopModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEtaTimer=null;},' +
  'persistFree:function(){',
  'E16 Queue-Methoden');
console.log('  E16: Queue + ETA-Methoden');

// ---------- E17: cancelGenerate leert Warteschlange ----------
s = rep1(s,
  'cancelGenerate:function(){try{if(this.genAbort){this.genAbort.abort();}}catch(e){}}',
  'cancelGenerate:function(){try{if(this.genAbort){this.genAbort.abort();}}catch(e){}try{for(var i=0;i<this.genJobs.length;i++){if(this.genJobs[i].statusKey===\'jobWaiting\'){this.genJobs[i].statusKey=\'jobError\';this.genJobs[i].msg=this.t(\'genStopped\');}}}catch(e2){}}',
  'E17 Stopp');
console.log('  E17: Stopp markiert Wartende');

// ---------- E18: Stempel ----------
{
  const stamp = '<!-- standalone-build v30 (R0-Call-Reparatur: Computed als Properties, via scripts/build-standalone-v30.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v31 (Eck-Overlay + ETA-Countdown + Auftrags-Queue, via scripts/build-standalone-v31.mjs) -->');
  console.log('  Stempel: v31');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v31: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v31: OK v31 (Eck-Overlay + ETA + Queue)');
