/**
 * Standalone builder v32 (D Overtime-Zaehler + E Gesamtzeit + F ETA-Tabelle):
 * Baut auf dem v31-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Wuensche:
 * D) Nach ETA-Ablauf weiter hochzaehlen ('laenger als erwartet · +{s} s',
 *    de/en/es), Geduld-Hinweis bleibt.
 * E) Bei Abschluss Gesamtzeit anzeigen ('fertig nach {s} s', de/en/es).
 * F) Flexible ETA-Tabelle je Provider/Modell/Reasoning (Default vorerst:
 *    1.3-Modelle auf Baseten/Meta mit xhigh/max -> 240 s, sonst 60 s).
 *    Countdown + Overtime + Gesamtzeit nutzen den Tabellenwert.
 *    Abort-Timeout folgt der Tabelle (ETA + 120 s) statt fix 120 s.
 *
 * Umsetzung datenseitig (kein Neuaufbau, keine Request-/Prompt-Aenderung):
 * F1-F3  Neue I18N-Keys de/en/es (genOver/modOver/genTotal/modTotal/
 *         genEtaLong/modEtaLong).
 * F4      Neue Data-Felder (genOver/genEtaStart/genTotal/
 *         modOver/modEtaStart/modTotal).
 * F5      etaSeconds-Tabelle + tabellenbewusste genEtaText/modEtaText +
 *         neue Computed genOverText/modOverText/genTotalText/modTotalText.
 * F6      startGenEta/startModEta: Startwert aus Tabelle, Overtime zaehlt
 *         nach Ablauf weiter (Timer laeuft, Patient bleibt).
 * F7      stopGenEta/stopModEta: Gesamtzeit aus Wanduhr in genTotal/modTotal.
 * F8      Templates: Overtime-Zeile ersetzt Countdown nach Ablauf
 *         (alte Countdown-Zeile bleibt fuer v31-Tests erhalten).
 * F9      Erfolgs-Status haengt Gesamtzeit an (genStatus/modStatus).
 * F10     Abort-Timeout dynamisch (ETA*1000+120000 statt fix 120000).
 * F11     Stempel v32 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v32.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v32-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v32: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}
function repAll(s, oldStr, newStr, want, label) {
  must(cnt(s, oldStr) === want, label + ': Anker x' + cnt(s, oldStr) + ', erwartet x' + want);
  return s.split(oldStr).join(newStr);
}

/** Syntax-Gate wie v26-v31 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v32-syn-'));
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
    ['standalone-build v30', 1], ['standalone-build v31', 1],
    ['standalone-build v32', 1],
    ['showcase: 5 Modelle', (s.includes('standalone-build v56') ? 0 : 1)], ['showcase: 4 Modelle', (s.includes('standalone-build v56') ? 1 : 0)], ['__FREE_GUARD_V18__', 1],
    ['modify:async function', 1], ['role="dialog"', (s.includes('standalone-build v54') ? 4 : 3)], ['id="gen-status"', 1],
    // v32-Texte je Sprache (Overtime + Gesamtzeit + 4-Minuten-Countdown).
    ['länger als erwartet', 2], ['longer than expected', 2], ['lento de lo esperado', 2],
    ['fertig nach {s} s', 2], ['done after {s} s', 2], ['listo tras {s} s', 2],
    ['ca. 4 Minuten', (s.includes('standalone-build v46') ? 4 : 2)], ['about 4 minutes', (s.includes('standalone-build v46') ? 4 : 2)], ['aprox. 4 minutos', (s.includes('standalone-build v46') ? 4 : 2)],
    // v32-Mechanik.
    ['etaSeconds:function', 1], ['genOverText:function', 1], ['modOverText:function', 1],
    ['genTotalText:function', 1], ['modTotalText:function', 1],
    ['genOver:0', 1], ['modOver:0', 1], ['genTotal:0', 1], ['modTotal:0', 1],
    ['genOver>0', 1], ['modOver>0', 1], ['return 240;', (s.includes('standalone-build v46') ? 1 : 3)],
    ['*1000+120000', 2], ['},120000);', 0],
    // v31-Vertrag bleibt (Countdown-Zeile, Geduld, Queue).
    ['{{genEtaText}}', 1], ['{{modEtaText}}', 1],
    ['Hab noch einen Moment Geduld.', 2],
    // v31-Vertrag bleibt (v35: zwei Einreihungen teilen eine Pumpe / Status).
    ['enqueueGenerate', 2], ['pumpGenQueue', 3],
    ['genJobsTitle', (s.includes('standalone-build v42') ? 5 : 4)], ['genStopped', (s.includes('standalone-build v42') ? 5 : 4)],
    ['jobWaiting', (s.includes('standalone-build v42') ? 11 : 10)], ['jobRunning', (s.includes('standalone-build v49') ? 10 : (s.includes('standalone-build v42') ? 8 : 7))], ['jobDone', (s.includes('standalone-build v42') ? 15 : 13)], ['jobError', (s.includes('standalone-build v42') ? 10 : 9)],
    ['@click="generate"', 0], ['@click="enqueueGenerate"', 1],
    ['position:fixed;bottom:16px;right:16px', 3],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v32 Overtime + Gesamtzeit + ETA-Tabelle)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v32: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v31-eck-overlay-eta-queue',
    standalone: 'v32',
    befund: [
      'Eigentuemer: D) nach ETA-Ablauf weiter hochzaehlen (laenger als erwartet, +s), E) Gesamtzeit bei Abschluss, F) flexible ETA-Tabelle (1.3+xhigh/max auf Baseten/Meta default 240 s sonst 60 s).',
    ],
    fixes: [
      'F1-F3 I18N (genOver/modOver/genTotal/modTotal/genEtaLong/modEtaLong x de/en/es)',
      'F4 Data (genOver/genEtaStart/genTotal/modOver/modEtaStart/modTotal)',
      'F5 etaSeconds-Tabelle + tabellenbewusste Countdowns + Over/Total-Computed',
      'F6-F7 Timer: Overtime zaehlt weiter, Stopp schreibt Gesamtzeit',
      'F8-F9 Templates: Overtime-Zeile + Gesamtzeit im Erfolgs-Status',
      'F10 Abort-Timeout dynamisch (ETA*1000+120 s)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v32: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v31'), 'kein v31-Stempel (falsche Basis)');
if (s.includes('standalone-build v32')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v32: bereits v32 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F1: de-Keys ----------
s = rep1(s,
  'I18N.de.jobError="Fehler";',
  'I18N.de.jobError="Fehler";' +
  'I18N.de.genOver="länger als erwartet · +{s} s";' +
  'I18N.de.modOver="länger als erwartet · +{s} s";' +
  'I18N.de.genTotal="fertig nach {s} s";' +
  'I18N.de.modTotal="fertig nach {s} s";' +
  'I18N.de.genEtaLong="ca. 4 Minuten · noch {s} s";' +
  'I18N.de.modEtaLong="ca. 4 Minuten · noch {s} s";',
  'F1 de-Keys');
console.log('  F1: de-Keys (6)');

// ---------- F2: en-Keys ----------
s = rep1(s,
  'I18N.en.jobError="error";',
  'I18N.en.jobError="error";' +
  'I18N.en.genOver="longer than expected · +{s} s";' +
  'I18N.en.modOver="longer than expected · +{s} s";' +
  'I18N.en.genTotal="done after {s} s";' +
  'I18N.en.modTotal="done after {s} s";' +
  'I18N.en.genEtaLong="about 4 minutes · {s} s left";' +
  'I18N.en.modEtaLong="about 4 minutes · {s} s left";',
  'F2 en-Keys');
console.log('  F2: en-Keys (6)');

// ---------- F3: es-Keys ----------
s = rep1(s,
  'jobError:"error",',
  'jobError:"error",' +
  'genOver:"m\\u00e1s lento de lo esperado \\u00b7 +{s} s",' +
  'modOver:"m\\u00e1s lento de lo esperado \\u00b7 +{s} s",' +
  'genTotal:"listo tras {s} s",' +
  'modTotal:"listo tras {s} s",' +
  'genEtaLong:"aprox. 4 minutos \\u00b7 quedan {s} s",' +
  'modEtaLong:"aprox. 4 minutos \\u00b7 quedan {s} s",',
  'F3 es-Keys');
console.log('  F3: es-Keys (6)');

// ---------- F4: Data ----------
s = rep1(s,
  'genJobs:[],genSeq:0,genPumping:false,genEta:0,genEtaTimer:null,genPatient:false,modEta:0,modEtaTimer:null,modPatient:false,',
  'genJobs:[],genSeq:0,genPumping:false,genEta:0,genEtaTimer:null,genPatient:false,modEta:0,modEtaTimer:null,modPatient:false,' +
  'genOver:0,genEtaStart:0,genTotal:0,modOver:0,modEtaStart:0,modTotal:0,',
  'F4 Data');
console.log('  F4: Data (Overtime + Start + Total)');

// ---------- F5: Computed (Tabelle + Texte) ----------
s = rep1(s,
  'genEtaText:function(){var s=this.genEta||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genEta)||I18N.de.genEta||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},' +
  'modEtaText:function(){var s=this.modEta||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modEta)||I18N.de.modEta||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},',
  'etaSeconds:function(){var m="";try{m=String(this.genModel||"");}catch(eM){}var p="";try{p=String(this.genProvider||"");}catch(eP){}var r="";try{r=String(this.genReasoning||this.reasoningDefault||"");}catch(eR){}var is13=(m.indexOf("1.3")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse");if(is13&&hi&&pv){return 240;}return 60;},' +
  'genEtaText:function(){var s=this.genEta||0;var lg=false;try{lg=(this.etaSeconds()>=120);}catch(eL){}var tpl="";try{tpl=lg?((I18N[this.lang]&&I18N[this.lang].genEtaLong)||I18N.de.genEtaLong||""):((I18N[this.lang]&&I18N[this.lang].genEta)||I18N.de.genEta||"");}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},' +
  'modEtaText:function(){var s=this.modEta||0;var lg=false;try{lg=(this.etaSeconds()>=120);}catch(eL){}var tpl="";try{tpl=lg?((I18N[this.lang]&&I18N[this.lang].modEtaLong)||I18N.de.modEtaLong||""):((I18N[this.lang]&&I18N[this.lang].modEta)||I18N.de.modEta||"");}catch(e){tpl="";}return String(tpl).split("{s}").join(String(s));},' +
  'genOverText:function(){var o=this.genOver||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genOver)||I18N.de.genOver||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(o));},' +
  'modOverText:function(){var o=this.modOver||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modOver)||I18N.de.modOver||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(o));},' +
  'genTotalText:function(){var t=this.genTotal||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genTotal)||I18N.de.genTotal||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(t));},' +
  'modTotalText:function(){var t=this.modTotal||0;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modTotal)||I18N.de.modTotal||"";}catch(e){tpl="";}return String(tpl).split("{s}").join(String(t));},',
  'F5 Computed');
console.log('  F5: Computed (Tabelle + Over/Total-Texte)');

// ---------- F6: Timer-Start (Tabellenwert + Overtime) ----------
s = rep1(s,
  'startGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEta=60;this.genPatient=false;var self=this;try{this.genEtaTimer=setInterval(function(){try{self.genEta-=1;if(self.genEta<=0){self.genEta=0;self.genPatient=true;try{clearInterval(self.genEtaTimer);}catch(e){}self.genEtaTimer=null;}}catch(e2){}},1000);}catch(e3){}},',
  'startGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}try{this.genEta=this.etaSeconds();}catch(eB){this.genEta=60;}this.genOver=0;try{this.genEtaStart=Date.now();}catch(eS){this.genEtaStart=0;}this.genPatient=false;var self=this;try{this.genEtaTimer=setInterval(function(){try{if(self.genEta>0){self.genEta-=1;}else{self.genOver=(self.genOver||0)+1;}if(self.genEta<=0){self.genEta=0;self.genPatient=true;}}catch(e2){}},1000);}catch(e3){}},',
  'F6 Gen-Start');
s = rep1(s,
  'startModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEta=60;this.modPatient=false;var self=this;try{this.modEtaTimer=setInterval(function(){try{self.modEta-=1;if(self.modEta<=0){self.modEta=0;self.modPatient=true;try{clearInterval(self.modEtaTimer);}catch(e){}self.modEtaTimer=null;}}catch(e2){}},1000);}catch(e3){}},',
  'startModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}try{this.modEta=this.etaSeconds();}catch(eB){this.modEta=60;}this.modOver=0;try{this.modEtaStart=Date.now();}catch(eS){this.modEtaStart=0;}this.modPatient=false;var self=this;try{this.modEtaTimer=setInterval(function(){try{if(self.modEta>0){self.modEta-=1;}else{self.modOver=(self.modOver||0)+1;}if(self.modEta<=0){self.modEta=0;self.modPatient=true;}}catch(e2){}},1000);}catch(e3){}},',
  'F6 Mod-Start');
console.log('  F6: Timer-Start (Tabelle + Overtime)');

// ---------- F7: Timer-Stopp (Gesamtzeit) ----------
s = rep1(s,
  'stopGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEtaTimer=null;},',
  'stopGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEtaTimer=null;try{var el=0;try{el=Math.max(0,Math.round((Date.now()-(this.genEtaStart||Date.now()))/1000));}catch(eE){try{el=(this.etaSeconds()-(this.genEta||0))+(this.genOver||0);}catch(eF){}}this.genTotal=el;}catch(eT){}},',
  'F7 Gen-Stopp');
s = rep1(s,
  'stopModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEtaTimer=null;},',
  'stopModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEtaTimer=null;try{var el=0;try{el=Math.max(0,Math.round((Date.now()-(this.modEtaStart||Date.now()))/1000));}catch(eE){try{el=(this.etaSeconds()-(this.modEta||0))+(this.modOver||0);}catch(eF){}}this.modTotal=el;}catch(eT){}},',
  'F7 Mod-Stopp');
console.log('  F7: Timer-Stopp (Gesamtzeit)');

// ---------- F8: Templates (Overtime-Zeile) ----------
s = rep1(s,
  '<p v-if="genBusy" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genEtaText}}</p>',
  '<p v-if="genBusy&&genOver<=0" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genEtaText}}</p>' +
  '<p v-if="genBusy&&genOver>0" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genOverText}}</p>',
  'F8 Gen-Template');
s = rep1(s,
  '<p class="text-sm font-medium">{{modEtaText}}</p>',
  '<p v-if="modOver<=0" class="text-sm font-medium">{{modEtaText}}</p>' +
  '<p v-if="modOver>0" class="text-sm font-medium">{{modOverText}}</p>',
  'F8 Mod-Template');
console.log('  F8: Templates (Overtime-Zeile)');

// ---------- F9: Erfolgs-Status (Gesamtzeit anhaengen) ----------
s = rep1(s,
  '}catch(eLM){}this.genStatusBad=false;try{this.setGenDone(fid,reg.meta.title);}catch(eGD){}',
  '}catch(eLM){}this.genStatusBad=false;try{var __gt=0;try{__gt=Math.max(0,Math.round((Date.now()-(this.genEtaStart||Date.now()))/1000));}catch(eG0){}this.genTotal=__gt;this.genStatus+=" "+this.genTotalText;}catch(eGT){}try{this.setGenDone(fid,reg.meta.title);}catch(eGD){}',
  'F9 Gen-Total');
s = rep1(s,
  '}catch(eLM){}this.modStatusBad=false;}finally{try{this.stopModEta();}',
  '}catch(eLM){}this.modStatusBad=false;try{var __mt=0;try{__mt=Math.max(0,Math.round((Date.now()-(this.modEtaStart||Date.now()))/1000));}catch(eM0){}this.modTotal=__mt;this.modStatus+=" "+this.modTotalText;}catch(eMT){}}finally{try{this.stopModEta();}',
  'F9 Mod-Total');
console.log('  F9: Erfolgs-Status (Gesamtzeit)');

// ---------- F10: Abort-Timeout dynamisch ----------
s = repAll(s,
  'timer=setTimeout(function(){try{ctrl.abort();}catch(e){}},120000);',
  'timer=setTimeout(function(){try{ctrl.abort();}catch(e){}},(function(s0){try{var e0=(s0&&s0.etaSeconds)?s0.etaSeconds():60;return e0*1000+120000;}catch(x0){return 360000;}})(this));',
  2, 'F10 Abort');
console.log('  F10: Abort-Timeout dynamisch (ETA+120 s)');

// ---------- F11: Stempel ----------
{
  const stamp = '<!-- standalone-build v31 (Eck-Overlay + ETA-Countdown + Auftrags-Queue, via scripts/build-standalone-v31.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v32 (Overtime + Gesamtzeit + ETA-Tabelle, via scripts/build-standalone-v32.mjs) -->');
  console.log('  Stempel: v32');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v32: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v32: OK v32 (Overtime + Gesamtzeit + ETA-Tabelle)');
