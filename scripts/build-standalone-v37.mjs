/**
 * Standalone builder v37 (M Minimieren-Zustand + E ETA-Tabelle wonder + T Telemetrie-Opt-in):
 * Baut auf dem v36-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Befunde (31.10.2026):
 * M) Minimieren-Button an den Generieren-/Ueberarbeiten-/Info-Overlays zeigt
 *    minimiert weiterhin '-', muss dann '+' zeigen (Zustandswechsel).
 * E) 1.3-contributor im Default (Standard-Reasoning) steht auf 240 s ETA —
 *    verifiziert korrekt (Standard loest auf reasoningDefault=xhigh auf,
 *    Request sendet reasoning_effort xhigh). Luecke: muse-wonder-1.0 mit
 *    max-Default fiel auf 60 s (kein "1.3" im Slug, obwohl max-Thinking
 *    gesendet und Abort bei ETA+120 s = 180 s legitime Laeufe killen kann).
 *    Tabelle je Modell+Reasoning am Default ausgerichtet: wonder wie 1.3.
 * T) Freiwilliges Telemetrie-Teilen nach erfolgreicher Generierung
 *    (gen + mod): Overlay Ja/Nein (de/en/es), bei Ja Sterne 1-5 +
 *    Freitext, kopierbarer Block (Modell/Provider/Reasoning/Prompt/
 *    Usage-HTTP-Codes/Dauer; Keys redigiert), danach Bitte um Issue auf
 *    https://github.com/Effzumdeh/ModelMuse/issues (Link-Button, de/en/es).
 *    Speicher nur im Arbeitsspeicher (teleInfo), nie persistiert.
 *
 * Umsetzung (keine Request-/Prompt-Aenderung):
 * M1  drei Min-Buttons statisch '-' -> zustandsabhaengig {{winMin.x?'+':'-'}}.
 * M2  winMin-Data += tele:false; M3 toggleWinMin += tele-Zweig.
 * E1  etaSeconds: is13 -> isBig (1.3 ODER wonder) mit xhigh/max.
 * T1  I18N tele*-Keys x de/en/es (11 Keys).
 * T2  Data: teleOpen/teleStep/teleKind/teleStars/teleComment/teleCopied/
 *     teleCopyMsg/teleCopyTimer/teleInfo.
 * T3  Methoden: openTele (Snapshot: Modell/Provider/Reasoning_effektiv/
 *     HTTP/Usage/Finish/Retry/Dauer/Prompt-4k), closeTele, teleBlock
 *     (redigiert wie diagText), copyTele (Clipboard + Fallback).
 * T4  Tele-Fenster (id tele-status, Win-Leiste + Min/Close, Ask/Rate-Schritte,
 *     Sterne, Freitext, Vorschau, Copy, Issue-Link) vor dem Mod-Fenster.
 * T5  Hooks: nach setGenDone (gen) + nach modTotal (mod) openTele().
 * T6  Win-Dock: tele-status in die Stapel-Liste.
 * T7  Stempel v37 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v37.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v37-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v37: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v36 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v37-syn-'));
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
          console.error('build-v37: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v37-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v36', 1], ['standalone-build v37', 1],
    // M: Zustandswechsel +/-, Dock kennt tele.
    ["winMin.gen?'+':'–'", 1], ["winMin.mod?'+':'–'", 1], ["winMin.part?'+':'–'", 1],
    ["toggleWinMin('tele')", 1],
    ['winMin:{gen:false,mod:false,part:false,tele:false}', 1],
    ['id==="tele"){this.winMin.tele', 1],
    // E: Tabelle je Modell+Reasoning (1.3 ODER wonder mit xhigh/max -> 240 s).
    // v38-Nachfolger (ETA robust): exakte v37-Zeile ersetzt, wonder bleibt.
    ['indexOf("wonder")', 1], ['if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}', 1],
    ['if(is13&&hi&&pv)', 0], ['if(isBig&&hi&&pv){return 240;}return 60;}', 0],
    // T: Overlay, Methoden, Hooks, Dock, i18n, Issue-Link.
    ['id="tele-status"', 1], ['"tele-status"', 2],
    ['openTele:function', 1], ["openTele('gen'", 1], ["openTele('mod'", 1],
    ['teleBlock:function', 1], ['copyTele:function', 1], ['closeTele', 3],
    ['teleTitle', (s.includes('standalone-build v42') ? 5 : 4)], ['teleAsk', (s.includes('standalone-build v42') ? 5 : 4)], ['teleYes', (s.includes('standalone-build v42') ? 5 : 4)], ['teleNo', (s.includes('standalone-build v42') ? 5 : 4)],
    ['teleRate', (s.includes('standalone-build v42') ? 5 : 4)], ['teleCommentPh', (s.includes('standalone-build v42') ? 5 : 4)], ['copyTele:function', 1],
    ['teleCopyMsg', 5], ['teleCopied', (s.includes('standalone-build v42') ? 9 : 8)], ['teleCopyFail', (s.includes('standalone-build v42') ? 5 : 4)],
    ['teleIssueLink', (s.includes('standalone-build v42') ? 5 : 4)], ["{{t('teleIssue')}}", 1], ['.teleIssue=', 2], ['teleIssue:"', (s.includes('standalone-build v42') ? 2 : 1)],
    // Q: Queue je Auftrag (Countdown/Overtime + Erfolgs-Feedback).
    ['jobTimeText:function', 1], ['jobTimeText(job,queueNow)', 1],
    ['queuedAt:Date.now()', 2], ['job.startedAt=Date.now()', 1],
    ['jobQueue', (s.includes('standalone-build v42') ? 6 : 5)], ['jobDoneHint', (s.includes('standalone-build v42') ? 5 : 4)],
    ['queueTickStart:function', 1], ['queueTickStop', 2],
    ['doneAt', 3], ['jj.labId=labId', 1], ['sj.labId===id', 1],
    ['https://github.com/Effzumdeh/ModelMuse/issues', 1],
    ['prompt_4k', 1], ['dauer_s', 1], ['bewertung:', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v37 Min-Zustand + ETA wonder + Telemetrie-Opt-in)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v37: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v36-startauswahl-fallback-geister-modell',
    standalone: 'v37',
    befund: [
      'Eigentuemer: Min-Button zeigt minimiert weiterhin - statt +; wonder-1.0/max-Default faellt auf 60-s-ETA; freiwilliges Telemetrie-Teilen nach Generierung (Ja/Nein, Sterne, Freitext, Copy-Block, Issue-Link).',
      'ETA-Verifikation: 1.3-contributor/Standard loest auf reasoningDefault=xhigh auf (Request sendet reasoning_effort xhigh) -> 240 s korrekt; nur wonder-1.0/max fiel auf 60 s -> Tabelle korrigiert.',
    ],
    fixes: [
      'M1-M3 Min-Buttons zustandsabhaengig (winMin.x?+:-), winMin.tele + toggleWinMin-Zweig',
      'E1 etaSeconds is13->isBig (1.3 oder wonder mit xhigh/max -> 240 s)',
      'T1-T6 Telemetrie-Opt-in (I18N x3, Data, Methoden, Fenster, Hooks gen+mod, Dock)',
      'T7 Stempel v37 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v37: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v36'), 'kein v36-Stempel (falsche Basis)');
if (s.includes('standalone-build v37')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v37: bereits v37 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- M1: Min-Buttons zustandsabhaengig ----------
s = rep1(s,
  "<button type=\"button\" @click=\"toggleWinMin('gen')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">–</button>",
  "<button type=\"button\" @click=\"toggleWinMin('gen')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">{{winMin.gen?'+':'–'}}</button>",
  'M1 Gen-Min');
s = rep1(s,
  "<button type=\"button\" @click=\"toggleWinMin('mod')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">–</button>",
  "<button type=\"button\" @click=\"toggleWinMin('mod')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">{{winMin.mod?'+':'–'}}</button>",
  'M1 Mod-Min');
s = rep1(s,
  "<button type=\"button\" @click=\"toggleWinMin('part')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">–</button>",
  "<button type=\"button\" @click=\"toggleWinMin('part')\" class=\"ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold\">{{winMin.part?'+':'–'}}</button>",
  'M1 Part-Min');
console.log('  M1: Min-Buttons zustandsabhaengig (gen/mod/part)');

// ---------- M2: winMin-Data += tele ----------
s = rep1(s,
  'modTotal:0,winMin:{gen:false,mod:false,part:false},',
  'modTotal:0,winMin:{gen:false,mod:false,part:false,tele:false},',
  'M2 Data');
console.log('  M2: Data (winMin.tele)');

// ---------- M3: toggleWinMin += tele ----------
s = rep1(s,
  'else if(id==="part"){this.winMin.part=!this.winMin.part;}}catch(e){}},enqueueModify:function(){',
  'else if(id==="part"){this.winMin.part=!this.winMin.part;}else if(id==="tele"){this.winMin.tele=!this.winMin.tele;}}catch(e){}},enqueueModify:function(){',
  'M3 Methode');
console.log('  M3: toggleWinMin-Zweig (tele)');

// ---------- E1: ETA-Tabelle (wonder wie 1.3) ----------
s = rep1(s,
  'var is13=(m.indexOf("1.3")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse");if(is13&&hi&&pv){return 240;}return 60;}',
  'var isBig=(m.indexOf("1.3")>=0||m.indexOf("wonder")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse");if(isBig&&hi&&pv){return 240;}return 60;}',
  'E1 Tabelle');
console.log('  E1: ETA-Tabelle (wonder mit xhigh/max -> 240 s)');

// ---------- T1: I18N tele*-Keys x de/en/es ----------
s = rep1(s,
  "I18N.de.partInfoMissing=\"Noch keine Erläuterung für diesen Bestandteil.\";",
  "I18N.de.partInfoMissing=\"Noch keine Erläuterung für diesen Bestandteil.\";" +
  "I18N.de.teleTitle=\"Telemetrie teilen (freiwillig)\";" +
  "I18N.de.teleAsk=\"Generierung gelungen! Telemetrie teilen? Enthält Modell, Provider, Reasoning, Prompt, Usage/HTTP-Codes und Dauer – ohne Key.\";" +
  "I18N.de.teleYes=\"Ja, teilen\";I18N.de.teleNo=\"Nein\";" +
  "I18N.de.teleRate=\"Wie gut ist das Modell? Sterne wählen, Kommentar ergänzen, Block kopieren.\";" +
  "I18N.de.teleCommentPh=\"Kommentar (optional, max. 500 Zeichen)\";" +
  "I18N.de.teleCopy=\"Telemetrie kopieren\";" +
  "I18N.de.teleCopied=\"Kopiert (ohne Key).\";I18N.de.teleCopyFail=\"Kopieren fehlgeschlagen.\";" +
  "I18N.de.teleIssue=\"Danach bitte als Issue melden:\";I18N.de.teleIssueLink=\"Issue auf GitHub öffnen\";",
  'T1 I18N de');
s = rep1(s,
  "I18N.en.partInfoMissing=\"No explanation for this component yet.\";",
  "I18N.en.partInfoMissing=\"No explanation for this component yet.\";" +
  "I18N.en.teleTitle=\"Share telemetry (voluntary)\";" +
  "I18N.en.teleAsk=\"Generation succeeded! Share the telemetry block? Contains model, provider, reasoning, prompt, usage/HTTP codes and duration – no key.\";" +
  "I18N.en.teleYes=\"Yes, share\";I18N.en.teleNo=\"No\";" +
  "I18N.en.teleRate=\"How good is the model? Pick stars, add a comment, copy the block.\";" +
  "I18N.en.teleCommentPh=\"Comment (optional, max. 500 characters)\";" +
  "I18N.en.teleCopy=\"Copy telemetry\";" +
  "I18N.en.teleCopied=\"Copied (no key).\";I18N.en.teleCopyFail=\"Copy failed.\";" +
  "I18N.en.teleIssue=\"Then please report it as an issue:\";I18N.en.teleIssueLink=\"Open issue on GitHub\";",
  'T1 I18N en');
s = rep1(s,
  'partInfoMissing:"Aún no hay explicación para este componente."',
  'partInfoMissing:"Aún no hay explicación para este componente.",' +
  'teleTitle:"Compartir telemetría (voluntario)",' +
  'teleAsk:"¡Generación correcta! ¿Compartir el bloque de telemetría? Contiene modelo, proveedor, razonamiento, prompt, códigos de uso/HTTP y duración – sin clave.",' +
  'teleYes:"Sí, compartir",teleNo:"No",' +
  'teleRate:"¿Cómo es el modelo? Elija estrellas, añada un comentario y copie el bloque.",' +
  'teleCommentPh:"Comentario (opcional, máx. 500 caracteres)",' +
  'teleCopy:"Copiar telemetría",' +
  'teleCopied:"Copiado (sin clave).",teleCopyFail:"No se pudo copiar.",' +
  'teleIssue:"Después, repórtelo como issue:",teleIssueLink:"Abrir issue en GitHub"',
  'T1 I18N es');
console.log('  T1: I18N (tele* x de/en/es)');

// ---------- T2: Data ----------
s = rep1(s,
  "overlayOpen:true,genAbort:null,genNotice:null,genNoticeTimer:null,",
  "overlayOpen:true,genAbort:null,genNotice:null,genNoticeTimer:null," +
  "teleOpen:false,teleStep:'ask',teleKind:'gen',teleStars:0,teleComment:'',teleCopied:false,teleCopyMsg:'',teleCopyTimer:null,teleInfo:null,",
  'T2 Data');
console.log('  T2: Data (tele*)');

// ---------- T3: Methoden ----------
s = rep1(s,
  "persistFree:function(){",
  "openTele:function(kind,labId,prompt){try{this.teleKind=kind;try{for(var ji=0;ji<this.genJobs.length;ji++){var jj=this.genJobs[ji];if(jj.kind===kind&&jj.statusKey==='jobRunning'&&!jj.labId){jj.labId=labId;break;}}}catch(eJ){}var info={kind:kind};try{info.model=String(this.genModel||\"?\");}catch(e1){info.model=\"?\";}try{info.provider=String(this.genProvider||\"?\");}catch(e2){info.provider=\"?\";}var rq=null;try{rq=this._lastReq||null;}catch(e3){}info.reasoning=(rq&&rq.re)?String(rq.re):\"Standard\";try{info.http=this._lastHttp||\"?\";}catch(e4){info.http=\"?\";}var ci=null;try{ci=this._lastChatInfo||null;}catch(e5){}info.usage=(ci&&ci.usage)?String(ci.usage):\"\";info.uR=(ci&&ci.usageReasoning!=null)?String(ci.usageReasoning):\"\";info.uC=(ci&&ci.usageCompletion!=null)?String(ci.usageCompletion):\"\";info.finish=(ci&&ci.finish)?String(ci.finish):\"\";try{info.retry=((this._lastRetry?1:0)+\"/1\");}catch(e6){info.retry=\"0/1\";}try{info.secs=(kind===\"mod\")?(this.modTotal||0):(this.genTotal||0);}catch(e7){info.secs=0;}try{info.lab=String(labId||\"\");}catch(e8){info.lab=\"\";}try{info.prompt=String(prompt||\"\").slice(0,4000);}catch(e9){info.prompt=\"\";}this.teleInfo=info;this.teleStars=0;this.teleComment=\"\";this.teleCopied=false;this.teleCopyMsg=\"\";this.teleStep=\"ask\";this.teleOpen=true;try{if(this.winMin){this.winMin.tele=false;}}catch(eA){}}catch(e){}}," +
  "closeTele:function(){try{if(this.teleCopyTimer){clearTimeout(this.teleCopyTimer);}}catch(e){}this.teleCopyTimer=null;this.teleOpen=false;this.teleStep=\"ask\";}," +
  "teleBlock:function(){var L=\"de\";try{L=this.lang||\"de\";}catch(eL){}var t=this.teleInfo||{};var head=L===\"en\"?\"ModelMuse telemetry (voluntary, no key).\":(L===\"es\"?\"ModelMuse telemetría (voluntaria, sin clave).\":\"ModelMuse Telemetrie (freiwillig, ohne Key).\");var s=head+\"\\nmodell: \"+(t.model||\"?\")+\"\\nprovider: \"+(t.provider||\"?\")+\"\\nreasoning: \"+(t.reasoning||\"?\")+\"\\nhttp: \"+(t.http||\"?\")+\"\\nfinish: \"+(t.finish||\"\")+\"\\nusage: \"+(t.usage||\"\")+\"\\nusage_reasoning_tokens: \"+(t.uR||\"\")+\"\\nusage_completion_tokens: \"+(t.uC||\"\")+\"\\nretry: \"+(t.retry||\"0/1\")+\"\\ndauer_s: \"+(t.secs||0)+\"\\nprompt_4k: \"+String(t.prompt||\"\").slice(0,4000)+\"\\nbewertung: \"+(this.teleStars||0)+\"/5\\nkommentar: \"+String(this.teleComment||\"\").slice(0,500);try{s=s.replace(/Authorization\\\\s*:\\\\s*Bearer\\\\s+\\\\S+/gi,\"Authorization: Bearer ***\");s=s.replace(/Bearer\\\\s+[A-Za-z0-9._\\\\-~+/=]{8,}/g,\"Bearer [REDACTED]\");s=s.replace(/\\\\bsk-[A-Za-z0-9\\\\-_]{8,}\\\\b/g,\"[REDACTED]\");s=s.replace(/\\\\bLLM_[A-Za-z0-9._\\\\-]{8,}\\\\b/g,\"[REDACTED]\");}catch(eX){}return s;}," +
  "copyTele:function(){var s=\"\";try{s=this.teleBlock();}catch(e){s=\"\";}var self=this;var done=function(ok){try{self.teleCopied=!!ok;self.teleCopyMsg=ok?self.t(\"teleCopied\"):self.t(\"teleCopyFail\");}catch(e2){}};var fb=function(){try{var ta=document.createElement(\"textarea\");ta.value=s;ta.setAttribute(\"readonly\",\"\");ta.style.position=\"fixed\";ta.style.opacity=\"0\";document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand(\"copy\");}catch(e4){ok=false;}ta.remove();done(ok);}catch(e5){done(false);}};try{if(navigator&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(function(){done(true);},function(){fb();});}else{fb();}}catch(e3){fb();}}," +
  "persistFree:function(){",
  'T3 Methoden');
console.log('  T3: Methoden (openTele/closeTele/teleBlock/copyTele)');

// ---------- T4: Tele-Fenster vor dem Mod-Fenster ----------
s = rep1(s,
  '<div v-if="modOverlay" id="mod-status"',
  '<div id="tele-status" v-if="teleOpen" :class="{\'win-min\':winMin.tele}" style="position:fixed;bottom:16px;right:16px;z-index:50;max-width:min(92vw,22rem);" class="z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4" role="dialog" aria-live="polite"><div class="win-bar"><span class="win-title">{{t(\'teleTitle\')}}</span><button type="button" @click="toggleWinMin(\'tele\')" class="ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">{{winMin.tele?\'+\':\'–\'}}</button><button type="button" @click="closeTele()" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm">×</button></div><div v-show="!winMin.tele"><div v-if="teleStep===\'ask\'"><p class="text-sm">{{t(\'teleAsk\')}}</p><div class="mt-2 flex gap-2"><button type="button" @click="teleStep=\'rate\'" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 min-h-[44px] text-sm font-semibold text-white">{{t(\'teleYes\')}}</button><button type="button" @click="closeTele()" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t(\'teleNo\')}}</button></div></div><div v-if="teleStep===\'rate\'"><p class="text-sm font-medium">{{t(\'teleRate\')}}</p><div class="mt-2 flex gap-1" role="radiogroup"><button v-for="n in 5" type="button" :key="n" @click="teleStars=n" :aria-pressed="teleStars===n" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">{{n}}</button></div><textarea v-model="teleComment" :placeholder="t(\'teleCommentPh\')" rows="2" maxlength="500" class="mt-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 p-2 text-sm"></textarea><p style="white-space:pre-wrap;max-height:10rem;overflow:auto" class="mt-2 text-xs">{{teleBlock()}}</p><button type="button" @click="copyTele()" class="mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 min-h-[44px] text-sm font-semibold text-white">{{t(\'teleCopy\')}}</button><p v-if="teleCopyMsg" class="mt-1 text-xs">{{teleCopyMsg}}</p><p v-if="teleCopied" class="mt-1 text-xs">{{t(\'teleIssue\')}} <a href="https://github.com/Effzumdeh/ModelMuse/issues" target="_blank" rel="noopener" style="text-decoration:underline">{{t(\'teleIssueLink\')}}</a></p></div></div></div>' +
  '<div v-if="modOverlay" id="mod-status"',
  'T4 Fenster');
console.log('  T4: Tele-Fenster (Ask/Rate/Copy/Issue-Link)');

// ---------- T5: Hooks nach Erfolg (gen + mod) ----------
s = rep1(s,
  'try{this.setGenDone(fid,reg.meta.title);}catch(eGD){}',
  'try{this.setGenDone(fid,reg.meta.title);}catch(eGD){}try{this.openTele(\'gen\',fid,prompt);}catch(eTL){}',
  'T5 Hook gen');
s = rep1(s,
  'this.modTotal=__mt;this.modStatus+=" "+this.modTotalText;}catch(eMT){}',
  'this.modTotal=__mt;this.modStatus+=" "+this.modTotalText;}catch(eMT){}try{this.openTele(\'mod\',(lab&&lab.id)||"",prompt);}catch(eTL){}',
  'T5 Hook mod');
console.log('  T5: Hooks (gen + mod)');

// ---------- T6: Win-Dock kennt tele-status ----------
s = rep1(s,
  'var ids=["gen-status","mod-status","part-info"]',
  'var ids=["gen-status","mod-status","part-info","tele-status"]',
  'T6 Dock');
console.log('  T6: Dock (tele-status stapelt mit)');

// ---------- Q1: I18N Queue-Feedback (je Auftrag + Erfolgs-Hinweis) ----------
s = rep1(s,
  "I18N.de.teleIssueLink=\"Issue auf GitHub öffnen\";",
  "I18N.de.teleIssueLink=\"Issue auf GitHub öffnen\";" +
  "I18N.de.jobQueue=\"Platz {n} · wartet ({s} s)\";" +
  "I18N.de.jobDoneHint=\"Erfolgreich abgeschlossen – siehe Bibliothek.\";",
  'Q1 I18N de');
s = rep1(s,
  "I18N.en.teleIssueLink=\"Open issue on GitHub\";",
  "I18N.en.teleIssueLink=\"Open issue on GitHub\";" +
  "I18N.en.jobQueue=\"Slot {n} · queued ({s} s)\";" +
  "I18N.en.jobDoneHint=\"Completed successfully – see library.\";",
  'Q1 I18N en');
s = rep1(s,
  'teleIssueLink:"Abrir issue en GitHub"',
  'teleIssueLink:"Abrir issue en GitHub",' +
  'jobQueue:"Puesto {n} · en espera ({s} s)",' +
  'jobDoneHint:"Completado con éxito – ver biblioteca."',
  'Q1 I18N es');
console.log('  Q1: I18N (jobQueue/jobDoneHint x de/en/es)');

// ---------- Q2: Data (Queue-Takt) ----------
s = rep1(s,
  "teleCopyTimer:null,teleInfo:null,",
  "teleCopyTimer:null,teleInfo:null,queueNow:0,queueTimer:null,",
  'Q2 Data');
console.log('  Q2: Data (queueNow/queueTimer)');

// ---------- Q3: Methoden (Takt + Auftragszeit) ----------
s = rep1(s,
  "openTele:function(kind,labId,prompt){",
  "queueTickStart:function(){try{if(this.queueTimer){return;}}catch(e){}var self=this;try{this.queueTimer=setInterval(function(){try{self.queueNow=(self.queueNow||0)+1;}catch(e2){}try{var cut=Date.now()-30000;var kept=[];for(var qi=0;qi<self.genJobs.length;qi++){var qj=self.genJobs[qi];if((qj.statusKey==='jobDone'||qj.statusKey==='jobError')&&(!qj.doneAt||qj.doneAt<cut)){continue;}kept.push(qj);}if(kept.length!==self.genJobs.length){self.genJobs=kept;}}catch(ePQ){}},1000);}catch(e3){}}," +
  "queueTickStop:function(){try{var busy=false;for(var i=0;i<this.genJobs.length;i++){var k=this.genJobs[i].statusKey;if(k==='jobWaiting'||k==='jobRunning'){busy=true;break;}}if(!busy){if(this.queueTimer){clearInterval(this.queueTimer);}this.queueTimer=null;}}catch(e){}}," +
  "jobTimeText:function(job,tick){try{tick=this.queueNow||0;}catch(eT){tick=0;}var L=\"de\";try{L=this.lang||\"de\";}catch(e0){}try{if(!job||typeof job!==\"object\"){return \"\";}var st=job.statusKey||\"\";if(st===\"jobError\"){return String(job.msg||\"\").slice(0,120);}if(st===\"jobDone\"){var s2=job.secs||0;var tpl=\"\";try{tpl=(job.kind===\"mod\")?((I18N[L]&&I18N[L].modTotal)||I18N.de.modTotal||\"\"):((I18N[L]&&I18N[L].genTotal)||I18N.de.genTotal||\"\");}catch(eD){}return String(tpl).split(\"{s}\").join(String(s2));}var t0=(st===\"jobWaiting\")?(job.queuedAt||0):(job.startedAt||0);var el=t0>0?Math.max(0,Math.round((Date.now()-t0)/1000)):0;if(st===\"jobRunning\"){var eta=job.eta||60;var rem=eta-el;var lg=false;try{lg=(eta>=120);}catch(eG){}var key=(job.kind===\"mod\")?(rem>=0?(lg?\"modEtaLong\":\"modEta\"):(lg?\"modEtaLong\":\"modOver\")):(rem>=0?(lg?\"genEtaLong\":\"genEta\"):(lg?\"genEtaLong\":\"genOver\"));var tx=\"\";try{tx=(I18N[L]&&I18N[L][key])||I18N.de[key]||\"\";}catch(eX){}var v=rem>=0?rem:(el-eta);return String(tx).split(\"{s}\").join(String(v));}var pos=0;try{var n2=0;for(var i=0;i<this.genJobs.length;i++){if(this.genJobs[i].statusKey===\"jobWaiting\"){n2++;if(this.genJobs[i]===job){pos=n2;}}}}catch(eP){}var q=\"\";try{q=(I18N[L]&&I18N[L].jobQueue)||I18N.de.jobQueue||\"\";}catch(eQ){}return String(q).split(\"{n}\").join(String(pos)).split(\"{s}\").join(String(el));}catch(e){return \"\";}}," +
  "openTele:function(kind,labId,prompt){",
  'Q3 Methoden');
console.log('  Q3: Methoden (queueTickStart/queueTickStop/jobTimeText)');

// ---------- Q4: Auftrags-Zeile mit eigenem Countdown + Erfolgs-Feedback ----------
s = rep1(s,
  '<div v-for="job in genJobs" :key="job.id" class="mt-1 flex items-center gap-2 text-xs"><span class="flex-1 min-w-0 truncate">{{job.term}}</span><span class="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-1">{{t(job.kindKey)}}</span><span>{{t(job.statusKey)}}</span></div>',
  '<div v-for="job in genJobs" :key="job.id" class="mt-1 text-xs" :style="job.statusKey===\'jobDone\'?\'border:2px solid #059669;border-radius:0.75rem;padding:0.375rem\':\'\'"><div class="flex items-center gap-2"><span class="flex-1 min-w-0 truncate">{{job.term}}</span><span class="shrink-0 rounded border border-slate-300 dark:border-slate-600 px-1">{{t(job.kindKey)}}</span><span>{{t(job.statusKey)}}</span><span class="shrink-0">{{jobTimeText(job,queueNow)}}</span></div><div v-if="job.statusKey===\'jobDone\'" class="mt-1">{{t(\'jobDoneHint\')}}</div><div v-if="job.msg" style="overflow-wrap:anywhere" class="mt-1">{{job.msg}}</div></div>',
  'Q4 Zeile');
console.log('  Q4: Auftrags-Zeile (Countdown je Auftrag + Erfolgs-Hinweis)');

// ---------- Q5: Hooks (Zeitstempel je Auftrag, Takt an/aus) ----------
s = rep1(s,
  "kind:'gen',kindKey:'jobGen',term:term,statusKey:'jobWaiting',msg:''",
  "kind:'gen',kindKey:'jobGen',term:term,statusKey:'jobWaiting',msg:'',queuedAt:Date.now(),startedAt:0,eta:0,secs:0",
  'Q5 gen-Auftrag');
s = rep1(s,
  "kind:'mod',kindKey:'jobMod',term:wish,labId:lab.id,wish:wish,statusKey:'jobWaiting',msg:''",
  "kind:'mod',kindKey:'jobMod',term:wish,labId:lab.id,wish:wish,statusKey:'jobWaiting',msg:'',queuedAt:Date.now(),startedAt:0,eta:0,secs:0",
  'Q5 mod-Auftrag');
s = rep1(s,
  "pumpGenQueue:async function(){if(this.genPumping){return;}this.genPumping=true;",
  "pumpGenQueue:async function(){if(this.genPumping){return;}this.genPumping=true;try{this.queueTickStart();}catch(eQT){}",
  'Q5 Takt an');
s = rep1(s,
  "job.statusKey='jobRunning';",
  "job.statusKey='jobRunning';try{job.startedAt=Date.now();job.eta=this.etaSeconds();}catch(eJS){}",
  'Q5 Start-Stempel');
s = rep1(s,
  "try{job.statusKey=ok?'jobDone':'jobError';job.msg=String(((job.kind==='mod')?this.modStatus:this.genStatus)||\"\").slice(0,120);}",
  "try{job.statusKey=ok?'jobDone':'jobError';job.msg=String(((job.kind==='mod')?this.modStatus:this.genStatus)||\"\").slice(0,120);try{job.secs=Math.max(0,Math.round((Date.now()-(job.startedAt||Date.now()))/1000));job.doneAt=Date.now();}catch(eS){}}",
  'Q5 Dauer-Stempel');
s = rep1(s,
  "}finally{this.genPumping=false;}",
  "}finally{try{this.queueTickStop();}catch(eQS){}this.genPumping=false;}",
  'Q5 Takt aus');
console.log('  Q5: Hooks (Stempel + Takt)');

// ---------- Q6: Hygiene (fertig + 30 s oder Modell geoeffnet -> raus) ----------
s = rep1(s,
  'selectLab:function(id){this.activeLabId=id;',
  'selectLab:function(id){try{var kept2=[];for(var si=0;si<this.genJobs.length;si++){var sj=this.genJobs[si];if((sj.statusKey===\'jobDone\'||sj.statusKey===\'jobError\')&&sj.labId&&sj.labId===id){continue;}kept2.push(sj);}if(kept2.length!==this.genJobs.length){this.genJobs=kept2;}}catch(eSP){}this.activeLabId=id;',
  'Q6 selectLab-Prune');
console.log('  Q6: Hygiene (30-s-Prune im Takt + Prune beim Modell-Oeffnen)');

// ---------- T7: Stempel ----------
{
  const stamp = '<!-- standalone-build v36 (Startauswahl + Fallback + Geister-Modell, via scripts/build-standalone-v36.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v37 (Min-Zustand + ETA wonder + Telemetrie-Opt-in, via scripts/build-standalone-v37.mjs) -->');
  console.log('  Stempel: v37');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v37: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v37: OK v37 (Min-Zustand + ETA wonder + Telemetrie-Opt-in)');
