/**
 * Standalone builder v49 (Countdown-Vereinheitlichung, 03.11.2026):
 * Baut auf dem v48-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Foto-Beleg): Kopf zeigt "ca. 4 Minuten - noch 238 s", derselbe
 * Auftrag in der Queue zeigt "noch 58 s" - Job-Timer und Kopf-Timer laufen
 * auseinander (unterschiedliche Basis/Startpunkte, eigener Zaehlerstand).
 * Ursachen im Artefakt:
 *   - Kopf (genEta/modEta) ist ein dekrementierender Intervall-Zaehler
 *     (startGenEta/startModEta: genEta-=1 je Sekunde, eigener Start
 *     genEtaStart in generate()/modify()), gedrosselt im Hintergrund-Tab.
 *   - Queue (jobTimeText) rechnet ab Job-Start neu (Date.now()-startedAt)
 *     mit Fallback eta=60 (job.eta||60), Kopf mit 240 - schon die Basis
 *     unterscheidet sich (60 vs 240), dazu zwei Intervalle (genEtaTimer
 *     vs queueTimer) mit eigenem Takt.
 * Regel (eine Zeile): Ein Auftrag, eine Deadline -
 *   Rest = (Job-Start + ETA-Tabelle) - jetzt, Kopf und Queue lesen
 *   dieselbe Deadline, kein eigener Zaehlerstand.
 *
 * Umsetzung (keine Request-/Prompt-Aenderung, nur Zeit-Ableitung):
 * H1  Neue Helfer vor queueTickStart: deadlineEtaFor (Snapshot job.eta,
 *     sonst Tabelle, Fallback 240 - nie 60), deadlineRemainFor
 *     ({eta,el,rem} aus Date.now()-startedAt, Rundung wie bisher),
 *     runningJobFor(kind) (laufender Auftrag je Art).
 * H2  queueTickStart: EIN Takt (queueTimer) synchronisiert Kopf-Spiegel
 *     (genEta/genOver/genPatient, modEta/modOver/modPatient) je Sekunde
 *     aus derselben Deadline (kein zweiter Zaehler).
 * H3  startGenEta/startModEta: kein eigenes Intervall mehr (Timer null),
 *     Start/ETA werden mit dem laufenden Auftrag synchronisiert
 *     (genEtaStart=job.startedAt, genEta=deadlineEtaFor), Takt via
 *     queueTickStart - gleiche Basis wie die Queue.
 * H4  genEtaText/modEtaText: Rest aus deadlineRemainFor des laufenden
 *     Auftrags (Math.max(0,rem), lg aus Snapshot-ETA), abhaengig von
 *     queueNow (gleicher Render-Takt wie die Queue); ohne laufenden
 *     Auftrag Fallback auf Spiegel/Tabelle wie bisher.
 * H5  genOverText/modOverText: Overtime (el-eta) aus derselben Deadline,
 *     ebenfalls queueNow-getrieben; ohne Auftrag Fallback Spiegel.
 * H6  jobTimeText (laufend): gleiche Helfer (deadlineRemainFor),
 *     Fallback 60 -> 240 (Tabelle); wartend/fertig unveraendert.
 * S   Stempel v49 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v49.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v49-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v49: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v48 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v49-syn-'));
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
          console.error('build-v49: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v49-inline-' + n + '.js')); } catch {}
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
    // H1: Helfer genau je 1x (eine Deadline-Quelle).
    ['deadlineEtaFor:function', 1],
    ['deadlineRemainFor:function', 1],
    ['runningJobFor:function', 1],
    // H6: kein 60er-Fallback mehr, kein eigener Dekrement-Zaehler.
    ['job.eta||60', 0],
    ['self.genEta-=1', 0],
    ['self.modEta-=1', 0],
    // H2/H3: ein Takt (queueTimer) + Sync ohne eigenes Intervall.
    ['queueTickStart:function', 1],
    ['self.deadlineRemainFor(gj)', 1],
    ['self.deadlineRemainFor(mj)', 1],
    ['this.queueTickStart();', 3],
    // v48-Erbe intakt (Limit + Stempel + Groesse).
    ['temperature:0.2,max_completion_tokens:131072,max_tokens:131072', 2],
    ['max_completion_tokens:131072', 2],
    ['max_tokens:131072', 2],
    ['etaSeconds:function(){return 240;}', 1],
    ['id:"ollama"', 1],
    ['footerLic:', 4],
    ['jobTimeText:function', 1], ['jobTimeText(job,queueNow)', 1],
    ['queuedAt:Date.now()', 2], ['job.startedAt=Date.now()', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v49 Countdown-eine-Deadline + v48-Erbe)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v49: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v48-explizites-limit',
    standalone: 'v49',
    befund: [
      'Foto-Beleg: Kopf ca. 4 Minuten - noch 238 s, derselbe Auftrag in Queue noch 58 s (Basis 240 vs 60, eigener Zaehlerstand vs Wall-Clock, zwei Intervalle).',
      'Kopf dekrementierte per genEtaTimer (throttling-anfaellig), Queue rechnete per Date.now()-startedAt mit Fallback 60.',
    ],
    regel: 'Ein Auftrag, eine Deadline - Rest = (Job-Start + ETA-Tabelle) - jetzt; Kopf und Queue lesen dieselbe Deadline, kein eigener Zaehlerstand.',
    fixes: [
      'H1 Helfer deadlineEtaFor/deadlineRemainFor/runningJobFor (Snapshot job.eta, sonst Tabelle, Fallback 240)',
      'H2 queueTickStart: ein Takt synchronisiert Kopf-Spiegel aus derselben Deadline',
      'H3 startGenEta/startModEta: kein eigenes Intervall, Start/ETA mit laufendem Auftrag synchronisiert',
      'H4/H5 genEtaText/modEtaText/genOverText/modOverText: Rest/Overtime aus Deadline, queueNow-getrieben',
      'H6 jobTimeText laufend: gleiche Helfer, Fallback 60->240',
      'S Stempel v49 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v49: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v48'), 'kein v48-Stempel (falsche Basis)');
if (s.includes('standalone-build v50')) {
  console.log('build-v49: neuerer Stand v50 - ok (idempotent, exit 0)');
  process.exit(0);
}
if (s.includes('standalone-build v49')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v49: bereits v49 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- H1: Helfer (eine Deadline-Quelle) vor queueTickStart ----------
s = rep1(s,
  'queueTickStart:function(){try{if(this.queueTimer){return;}}catch(e){}',
  'deadlineEtaFor:function(job){var e=0;try{if(job&&typeof job.eta==="number"&&job.eta>0){e=job.eta;}else{e=this.etaSeconds();}}catch(x){try{e=this.etaSeconds();}catch(y){e=240;}}if(!(e>0)){e=240;}return e;},deadlineRemainFor:function(job){var eta=240;try{eta=this.deadlineEtaFor(job);}catch(x){try{eta=this.etaSeconds();}catch(y){eta=240;}}if(!(eta>0)){eta=240;}var t0=0;try{t0=(job&&job.startedAt)||(job&&job.queuedAt)||0;}catch(z){t0=0;}var el=0;try{el=t0>0?Math.max(0,Math.round((Date.now()-t0)/1000)):0;}catch(w){el=0;}return{eta:eta,el:el,rem:eta-el};},runningJobFor:function(kind){try{for(var i=0;i<this.genJobs.length;i++){var j=this.genJobs[i];if(j&&j.statusKey==="jobRunning"&&(!kind||j.kind===kind)){return j;}}}catch(x){}return null;},queueTickStart:function(){try{if(this.queueTimer){return;}}catch(e){}',
  'H1 Helfer');
console.log('  H1: Helfer deadlineEtaFor/deadlineRemainFor/runningJobFor');

// ---------- H2: ein Takt synchronisiert Kopf-Spiegel aus derselben Deadline ----------
s = rep1(s,
  'try{this.queueTimer=setInterval(function(){try{self.queueNow=(self.queueNow||0)+1;}catch(e2){}try{var cut=Date.now()-30000;',
  'try{this.queueTimer=setInterval(function(){try{self.queueNow=(self.queueNow||0)+1;}catch(e2){}try{var gj=null;var mj=null;try{for(var gi=0;gi<self.genJobs.length;gi++){var g=self.genJobs[gi];if(g&&g.statusKey==="jobRunning"){if(g.kind==="mod"&&!mj){mj=g;}else if(g.kind!=="mod"&&!gj){gj=g;}}}}catch(eG){}try{if(gj){var gr=self.deadlineRemainFor(gj);self.genEta=Math.max(0,gr.rem);self.genOver=gr.rem<0?(gr.el-gr.eta):0;self.genPatient=gr.rem<=0;}}catch(eS1){}try{if(mj){var mr=self.deadlineRemainFor(mj);self.modEta=Math.max(0,mr.rem);self.modOver=mr.rem<0?(mr.el-mr.eta):0;self.modPatient=mr.rem<=0;}}catch(eS2){}}catch(eS){}try{var cut=Date.now()-30000;',
  'H2 Takt-Sync');
console.log('  H2: queueTickStart synchronisiert Kopf-Spiegel (ein Takt)');

// ---------- H3: startGenEta/startModEta ohne eigenes Intervall, gleiche Basis ----------
s = rep1(s,
  'startGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}try{this.genEta=this.etaSeconds();}catch(eB){this.genEta=240;}this.genOver=0;try{this.genEtaStart=Date.now();}catch(eS){this.genEtaStart=0;}this.genPatient=false;var self=this;try{this.genEtaTimer=setInterval(function(){try{if(self.genEta>0){self.genEta-=1;}else{self.genOver=(self.genOver||0)+1;}if(self.genEta<=0){self.genEta=0;self.genPatient=true;}}catch(e2){}},1000);}catch(e3){}}',
  'startGenEta:function(){try{if(this.genEtaTimer){clearInterval(this.genEtaTimer);}}catch(e){}this.genEtaTimer=null;try{var rj=null;try{rj=this.runningJobFor("gen");}catch(x){rj=null;}var eta=240;try{eta=this.deadlineEtaFor(rj);}catch(y){try{eta=this.etaSeconds();}catch(z){eta=240;}}if(!(eta>0)){eta=240;}this.genEta=eta;}catch(eB){try{this.genEta=this.etaSeconds();}catch(eC){this.genEta=240;}}this.genOver=0;try{var st=0;try{st=(rj&&rj.startedAt)||Date.now();}catch(sx){st=Date.now();}this.genEtaStart=st;}catch(eS){try{this.genEtaStart=Date.now();}catch(zz){this.genEtaStart=0;}}this.genPatient=false;try{this.queueTickStart();}catch(eQ){}}',
  'H3 gen-Start');
s = rep1(s,
  'startModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}try{this.modEta=this.etaSeconds();}catch(eB){this.modEta=240;}this.modOver=0;try{this.modEtaStart=Date.now();}catch(eS){this.modEtaStart=0;}this.modPatient=false;var self=this;try{this.modEtaTimer=setInterval(function(){try{if(self.modEta>0){self.modEta-=1;}else{self.modOver=(self.modOver||0)+1;}if(self.modEta<=0){self.modEta=0;self.modPatient=true;}}catch(e2){}},1000);}catch(e3){}}',
  'startModEta:function(){try{if(this.modEtaTimer){clearInterval(this.modEtaTimer);}}catch(e){}this.modEtaTimer=null;try{var rjm=null;try{rjm=this.runningJobFor("mod");}catch(x){rjm=null;}var etam=240;try{etam=this.deadlineEtaFor(rjm);}catch(y){try{etam=this.etaSeconds();}catch(z){etam=240;}}if(!(etam>0)){etam=240;}this.modEta=etam;}catch(eB){try{this.modEta=this.etaSeconds();}catch(eC){this.modEta=240;}}this.modOver=0;try{var stm=0;try{stm=(rjm&&rjm.startedAt)||Date.now();}catch(sx){stm=Date.now();}this.modEtaStart=stm;}catch(eS){try{this.modEtaStart=Date.now();}catch(zz){this.modEtaStart=0;}}this.modPatient=false;try{this.queueTickStart();}catch(eQ){}}',
  'H3 mod-Start');
console.log('  H3: Start ohne eigenes Intervall (Basis = Job-Start + ETA)');

// ---------- H4: Kopf-Texte aus derselben Deadline (queueNow-Takt) ----------
s = rep1(s,
  'genEtaText:function(){var s=this.genEta||0;var lg=false;try{lg=(this.etaSeconds()>=120);}catch(eL){}',
  'genEtaText:function(){try{var qn=this.queueNow||0;}catch(eQ){}var s=0;var lg=false;try{var job=null;try{job=this.runningJobFor("gen");}catch(eJ){job=null;}if(job){var r=this.deadlineRemainFor(job);s=Math.max(0,r.rem);lg=(r.eta>=120);}else{s=this.genEta||0;try{lg=(this.etaSeconds()>=120);}catch(eL){lg=(s>=120);}}}catch(e){try{s=this.genEta||0;}catch(e2){s=0;}}',
  'H4 gen-Text');
s = rep1(s,
  'modEtaText:function(){var s=this.modEta||0;var lg=false;try{lg=(this.etaSeconds()>=120);}catch(eL){}',
  'modEtaText:function(){try{var qn=this.queueNow||0;}catch(eQ){}var s=0;var lg=false;try{var job=null;try{job=this.runningJobFor("mod");}catch(eJ){job=null;}if(job){var r=this.deadlineRemainFor(job);s=Math.max(0,r.rem);lg=(r.eta>=120);}else{s=this.modEta||0;try{lg=(this.etaSeconds()>=120);}catch(eL){lg=(s>=120);}}}catch(e){try{s=this.modEta||0;}catch(e2){s=0;}}',
  'H4 mod-Text');
console.log('  H4: Kopf-Rest aus Deadline (identisch zur Queue)');

// ---------- H5: Kopf-Overtime aus derselben Deadline ----------
s = rep1(s,
  'genOverText:function(){var o=this.genOver||0;',
  'genOverText:function(){try{var qn=this.queueNow||0;}catch(eQ){}var o=0;try{var job=null;try{job=this.runningJobFor("gen");}catch(eJ){job=null;}if(job){var r=this.deadlineRemainFor(job);o=r.rem<0?(r.el-r.eta):0;}else{o=this.genOver||0;}}catch(e){try{o=this.genOver||0;}catch(e2){o=0;}}var unusedQn=0;try{unusedQn=qn||0;}catch(eU){}var o2=o;var o=o2;',
  'H5 gen-Over');
s = rep1(s,
  'modOverText:function(){var o=this.modOver||0;',
  'modOverText:function(){try{var qn=this.queueNow||0;}catch(eQ){}var o=0;try{var job=null;try{job=this.runningJobFor("mod");}catch(eJ){job=null;}if(job){var r=this.deadlineRemainFor(job);o=r.rem<0?(r.el-r.eta):0;}else{o=this.modOver||0;}}catch(e){try{o=this.modOver||0;}catch(e2){o=0;}}var unusedQn=0;try{unusedQn=qn||0;}catch(eU){}var o2=o;var o=o2;',
  'H5 mod-Over');
console.log('  H5: Kopf-Overtime aus Deadline');

// H5 erzeugt "var o" doppelt (var o2/o-Spiegel): zu sauberem "var o" vereinfachen.
s = rep1(s,
  '}catch(e2){o=0;}}var unusedQn=0;try{unusedQn=qn||0;}catch(eU){}var o2=o;var o=o2;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genOver)',
  '}catch(e2){o=0;}}var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].genOver)',
  'H5 gen-Cleanup');
s = rep1(s,
  '}catch(e2){o=0;}}var unusedQn=0;try{unusedQn=qn||0;}catch(eU){}var o2=o;var o=o2;var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modOver)',
  '}catch(e2){o=0;}}var tpl="";try{tpl=(I18N[this.lang]&&I18N[this.lang].modOver)',
  'H5 mod-Cleanup');
console.log('  H5: Cleanup Doppel-Var');

// ---------- H6: Queue-Timer gleiche Deadline, Fallback 240 ----------
s = rep1(s,
  'if(st==="jobRunning"){var eta=job.eta||60;var rem=eta-el;',
  'if(st==="jobRunning"){var rr=null;try{rr=this.deadlineRemainFor(job);}catch(eR){rr=null;}var eta=rr?rr.eta:240;var el2=rr?rr.el:el;var rem=eta-el2;',
  'H6 Queue-Basis');
s = rep1(s,
  'var v=rem>=0?rem:(el-eta);',
  'var v=rem>=0?rem:(el2-eta);',
  'H6 Queue-Rest');
console.log('  H6: Queue aus derselben Deadline (Fallback 240)');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v48 (explizites Limit 131072 generate/modify/Retry, direkt, alle Provider + Diagnose-Echo-Werte + Stempel v48, via scripts/build-standalone-v48.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v49 (Countdown-eine-Deadline: Kopf+Queue aus Job-Start+ETA, kein eigener Zaehler, via scripts/build-standalone-v49.mjs) -->');
  console.log('  Stempel: v49');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v49: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v49: OK v49 (Countdown-eine-Deadline)');
