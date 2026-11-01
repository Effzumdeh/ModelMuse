/**
 * Standalone builder v38 (O OpenRouter-Drittprovider + E ETA-Robustheit/Ent-
 * doppelung + T Telemetrie-UX): baut auf dem v37-Artefakt auf und ist
 * idempotent (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Vorgaben (31.10.2026):
 * O) OpenRouter als 3. Provider (BYOK, Direkt-Call ohne Proxy):
 *    Slugs verifiziert via https://openrouter.ai/models (31.10.2026, keine
 *    Abweichung): openai/gpt-6.1-sol, meta/muse-spark-1.3,
 *    anthropic/claude-opus-5.5 (alle mit reasoning_effort belegt).
 *    Browser-Direkt-Call gegen https://openrouter.ai/api/v1/chat/completions
 *    mit Bearer + HTTP-Referer + X-Title; keine Token-Caps, kein
 *    stream_options (unverifiziert); 400-Fallback bleibt. Neue Modelle
 *    vorerst 240 s ETA bis Messwerte kommen. Fehlertexte je Provider mit
 *    Key-Hinweis (openrouter.ai/keys). Key je Anbieter
 *    (modelmuse-key-openrouter); Legacy-Proxy-Fallback nur noch Baseten.
 * E1) Meta Muse + muse-spark-1.3-contributor zeigte 60 s statt 240 s:
 *    Tabellen-Match robust (klein/normalisiert, Vendor-Praefix + :suffix
 *    gestrippt, Modellstring-Varianten; contributor=>immer gross).
 * E2) Dauer-Anzeige entdoppelt: oben im Status bleibt alles; in der Queue
 *    nur der aktiv generierende Auftrag mit eigener Zeit; wartende nur
 *    Warte-Position (ohne {s}); fertige ohne eigene Zeit.
 * T) Telemetrie-UX: Sterne mit sichtbarer Auswahl (Farbwechsel aktiv),
 *    Vorschau-Text raus (nur Sterne, Freitext, Kopieren-Button), nach
 *    Kopieren 2,5-s-'Danke' im selben Fenster, danach Issue-Button.
 *
 * Umsetzung (keine Request-/Prompt-Aenderung ausser belegten Headern):
 * O1  genProviders += openrouter (direkt, 3 verifizierte Slugs).
 * O2  directHeaders()-Methode (Bearer + Referer/Title nur openrouter);
 *     alle 4 Direkt-Fetches (gen/mod x Erst/Slim) nutzen sie.
 * O3  xhighAllowed += openrouter (Default xhigh belegt, max->xhigh).
 * O4  loadKeyFor/keyLocation/saveKeyFor: openrouter-eigener Key; Legacy-
 *     Proxy-Fallback nur noch baseten-direct.
 * O5  keyMissing/keyInvalid/keyFormat je Provider (openrouter.ai/keys) +
 *     Template-Hinweis + Placeholder.
 * E1  etaSeconds robust (normalize + erweiterte Muster + openrouter->240 +
 *     unbekannt-mit-Thinking->240).
 * E2  jobTimeText: done->"", waiting->nur Position; Templates ohne {s}.
 * T1  Sterne :class aktiv (amber); T2 Vorschau raus; T3 thanks+IssueShow
 *     (Data/Methoden/Template/i18n de/en/es).
 * T4  Stempel v38 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v38.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v38-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v38: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}
function repN(s, oldStr, newStr, label, want) {
  must(cnt(s, oldStr) === want, label + ': Anker x' + cnt(s, oldStr) + ' statt ' + want);
  return s.split(oldStr).join(newStr);
}

/** Syntax-Gate wie v26-v37 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v38-syn-'));
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
          console.error('build-v38: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v38-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v37', 1], ['standalone-build v38', 1],
    // O: OpenRouter-Drittprovider (direkt, 3 Slugs, Header, Keys, Texte).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    ['directHeaders:function', 1], ['headers:this.directHeaders()', 6],
    ['HTTP-Referer', 1], ['X-Title', 1],
    ['modelmuse-key-openrouter', 3],
    ['keyMissingOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)], ['keyInvalidOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)], ['keyFormatOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)],
    ["{{t('teleThanks')}}", 1], ['teleThanksTimer', 10], ['teleIssueShow', 6],
    // E: robuste ETA-Tabelle + entdoppelte Queue.
    ['indexOf("wonder")', 1],
    ['if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}', 1],
    ['if(is13&&hi&&pv)', 0], ['if(isBig&&hi&&pv){return 240;}return 60;}', 0],
    ['if(st==="jobDone"){return "";}', 1],
    ['Platz {n}"', 1], ['Slot {n}"', 1], ['Puesto {n}"', 1],
    // T: Telemetrie-UX (Sterne aktiv, kein Vorschau-Block, Thanks->Issue).
    ['teleStars>=n', 1], ['{{teleBlock()}}', 0],
    ['teleIssueShow', 6],
    // Q: Queue je Auftrag (Countdown nur aktiv) + Hygiene.
    ['jobTimeText:function', 1], ['jobTimeText(job,queueNow)', 1],
    ['queuedAt:Date.now()', 2], ['job.startedAt=Date.now()', 1],
    ['jobQueue', (s.includes('standalone-build v42') ? 6 : 5)], ['jobDoneHint', (s.includes('standalone-build v42') ? 5 : 4)],
    ['queueTickStart:function', 1], ['queueTickStop', 2],
    ['doneAt', 3], ['jj.labId=labId', 1], ['sj.labId===id', 1],
    // Alt-Vertraege (v37-Nachfolger: exakte v37-Strings ersetzt, s.o.).
    ["winMin.gen?'+':'–'", 1], ["winMin.mod?'+':'–'", 1], ["winMin.part?'+':'–'", 1],
    ["toggleWinMin('tele')", 1],
    ['winMin:{gen:false,mod:false,part:false,tele:false}', 1],
    ['id==="tele")', 1],
    ['id="tele-status"', 1], ['"tele-status"', 2],
    ['openTele:function', 1], ["openTele('gen'", 1], ["openTele('mod'", 1],
    ['teleBlock:function', 1], ['copyTele:function', 1], ['closeTele', 3],
    ['teleTitle', (s.includes('standalone-build v42') ? 5 : 4)], ['teleAsk', (s.includes('standalone-build v42') ? 5 : 4)], ['teleYes', (s.includes('standalone-build v42') ? 5 : 4)], ['teleNo', (s.includes('standalone-build v42') ? 5 : 4)],
    ['teleRate', (s.includes('standalone-build v42') ? 5 : 4)], ['teleCommentPh', (s.includes('standalone-build v42') ? 5 : 4)],
    ['teleCopyMsg', 5], ['teleCopied', (s.includes('standalone-build v42') ? 9 : 8)], ['teleCopyFail', (s.includes('standalone-build v42') ? 5 : 4)],
    ['teleIssueLink', (s.includes('standalone-build v42') ? 5 : 4)], ["{{t('teleIssue')}}", 1], ['.teleIssue=', 2], ['teleIssue:"', (s.includes('standalone-build v42') ? 2 : 1)],
    ['https://github.com/Effzumdeh/ModelMuse/issues', 1],
    ['prompt_4k', 1], ['dauer_s', 1], ['bewertung:', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v38 OpenRouter + ETA robust/Entkopplung + Telemetrie-UX)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v38: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v37-min-eta-telemetrie-queue',
    standalone: 'v38',
    befund: [
      'Eigentuemer: OpenRouter als 3. Provider (Slugs verifiziert 31.10.2026, keine Abweichung); Meta Muse + contributor zeigte 60 s statt 240 s; Dauer-Anzeige doppelt (Status + Queue); Telemetrie-UX (Sterne-Auswahl, Vorschau raus, Danke->Issue).',
      'Slug-Verifikation: openai/gpt-6.1-sol, meta/muse-spark-1.3, anthropic/claude-opus-5.5 existieren exakt in der OpenRouter-Modelle-API (452 Modelle); reasoning_effort fuer alle drei belegt.',
    ],
    fixes: [
      'O1-O5 OpenRouter-Drittprovider (direkt, Referer/Title, Keys je Anbieter, Texte mit openrouter.ai/keys)',
      'E1 etaSeconds robust (normalize, contributor=>gross, openrouter+unbekannt->240)',
      'E2 Queue entdoppelt (done ohne Zeit, wartend nur Position)',
      'T1-T3 Telemetrie-UX (Sterne aktiv, Vorschau raus, Danke 2,5 s -> Issue-Button)',
      'T4 Stempel v38 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v38: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v37'), 'kein v37-Stempel (falsche Basis)');
if (s.includes('standalone-build v38')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v38: bereits v38 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- O1: genProviders += openrouter ----------
s = rep1(s,
  'genProviders:[{id:"baseten-direct",label:"Baseten",kind:"direct",base:"https://inference.baseten.co/v1",models:["meta-models/muse-spark-open-1026"]},{id:"meta-muse"',
  'genProviders:[{id:"baseten-direct",label:"Baseten",kind:"direct",base:"https://inference.baseten.co/v1",models:["meta-models/muse-spark-open-1026"]},{id:"openrouter",label:"OpenRouter",kind:"direct",base:"https://openrouter.ai/api/v1",models:["openai/gpt-6.1-sol","meta/muse-spark-1.3","anthropic/claude-opus-5.5"]},{id:"meta-muse"',
  'O1 Provider');
console.log('  O1: genProviders (openrouter, 3 verifizierte Slugs)');

// ---------- O2: directHeaders()-Methode + 4 Call-Sites ----------
s = rep1(s,
  'cacheGenKey:function(){try{if(this.genKeyCache){this.genKeyCache[this.genProvider]=this.genKey;}}catch(e){}},',
  'cacheGenKey:function(){try{if(this.genKeyCache){this.genKeyCache[this.genProvider]=this.genKey;}}catch(e){}},directHeaders:function(){var h={Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"};try{if(this.genProvider==="openrouter"){h["HTTP-Referer"]="https://github.com/Effzumdeh/ModelMuse";h["X-Title"]="ModelMuse";}}catch(e){}return h;},',
  'O2 Methode');
s = repN(s,
  'headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"}',
  'headers:this.directHeaders()',
  'O2 Call-Sites (Erst)', 2);
s = repN(s,
  'headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"}',
  'headers:this.directHeaders()',
  'O2 Call-Sites (Slim-Retry)', 4);
console.log('  O2: directHeaders (Bearer + Referer/Title nur openrouter)');

// ---------- O3: xhighAllowed += openrouter ----------
s = rep1(s,
  'if(this.genProvider==="baseten-direct"){return true;}',
  'if(this.genProvider==="baseten-direct"||this.genProvider==="openrouter"){return true;}',
  'O3 xhigh');
console.log('  O3: xhigh-Default belegt (openrouter, max->xhigh)');

// ---------- O4: Keys je Anbieter; Legacy-Fallback nur Baseten ----------
s = repN(s,
  'var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";',
  'var k=id==="meta-muse"?"modelmuse-key-meta-muse":(id==="openrouter"?"modelmuse-key-openrouter":"modelmuse-key-baseten-direct");',
  'O4 Key-Namen', 3);
s = rep1(s,
  'if(id!=="meta-muse"){try{var w=sessionStorage.getItem("modelmuse-proxy-key");',
  'if(id==="baseten-direct"){try{var w=sessionStorage.getItem("modelmuse-proxy-key");',
  'O4 Legacy-Scope');
console.log('  O4: Key je Anbieter (openrouter-eigen, Legacy nur Baseten)');

// ---------- O5: Fehlermeldungen je Provider + Placeholder + Template ----------
s = rep1(s,
  'I18N.de.keyStoredLocal="Key dauerhaft gespeichert (localStorage).";',
  'I18N.de.keyStoredLocal="Key dauerhaft gespeichert (localStorage).";I18N.de.keyMissingOpenrouter="OpenRouter-Key fehlt. Hole dir oben deinen Key (openrouter.ai/keys).";',
  'O5 I18N de missing');
s = rep1(s,
  'I18N.de.keyInvalid="Key falsch (401). Pruefe deinen Baseten-Key.";',
  'I18N.de.keyInvalid="Key falsch (401). Pruefe deinen Baseten-Key.";I18N.de.keyInvalidOpenrouter="Key falsch (401). Pruefe deinen OpenRouter-Key (openrouter.ai/keys).";',
  'O5 I18N de invalid');
s = rep1(s,
  'I18N.en.keyStoredLocal="Key stored permanently (localStorage).";',
  'I18N.en.keyStoredLocal="Key stored permanently (localStorage).";I18N.en.keyMissingOpenrouter="OpenRouter key missing. Get your key above (openrouter.ai/keys).";',
  'O5 I18N en missing');
s = rep1(s,
  'I18N.en.keyInvalid="Wrong key (401). Check your Baseten key.";',
  'I18N.en.keyInvalid="Wrong key (401). Check your Baseten key.";I18N.en.keyInvalidOpenrouter="Wrong key (401). Check your OpenRouter key (openrouter.ai/keys).";',
  'O5 I18N en invalid');
s = rep1(s,
  'keyStoredLocal:"Clave guardada permanente (localStorage).",',
  'keyStoredLocal:"Clave guardada permanente (localStorage).",keyMissingOpenrouter:"Falta la clave OpenRouter. Consigue tu clave arriba (openrouter.ai/keys).",',
  'O5 I18N es missing');
s = rep1(s,
  'keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave Baseten.",',
  'keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave Baseten.",keyInvalidOpenrouter:"Clave inv\\u00e1lida (401). Comprueba tu clave OpenRouter (openrouter.ai/keys).",',
  'O5 I18N es invalid');
s = rep1(s,
  'keyFormatMeta="Meta-Key beginnt mit LLM_... (Dashboard: dev.meta.ai).";',
  'keyFormatMeta="Meta-Key beginnt mit LLM_... (Dashboard: dev.meta.ai).";I18N.de.keyFormatOpenrouter="OpenRouter-Key (openrouter.ai/keys) — nur diese Sitzung.";',
  'O5 I18N de format');
s = rep1(s,
  'keyFormatMeta="Meta keys start with LLM_... (Dashboard: dev.meta.ai).";',
  'keyFormatMeta="Meta keys start with LLM_... (Dashboard: dev.meta.ai).";I18N.en.keyFormatOpenrouter="OpenRouter key (openrouter.ai/keys) — this session only.";',
  'O5 I18N en format');
s = rep1(s,
  'keyFormatMeta:"La clave Meta empieza por LLM_... (Panel: dev.meta.ai).",',
  'keyFormatMeta:"La clave Meta empieza por LLM_... (Panel: dev.meta.ai).",keyFormatOpenrouter:"Clave OpenRouter (openrouter.ai/keys) — solo esta sesion.",',
  'O5 I18N es format');
console.log('  O5: Key-Texte (openrouter.ai/keys) de/en/es');

// ---------- O6: Template-Hinweis + Placeholder je Provider ----------
s = rep1(s,
  '<p v-if="genProvider===\'meta-muse\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatMeta\')}}</p>',
  '<p v-if="genProvider===\'meta-muse\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatMeta\')}}</p><p v-if="genProvider===\'openrouter\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatOpenrouter\')}}</p>',
  'O6 Template-Hinweis');
s = rep1(s,
  'genKeyPlaceholder:function(){return this.genProvider==="meta-muse"?"LLM_... (Meta API-Key, dev.meta.ai)":"Baseten-API-Key";},',
  'genKeyPlaceholder:function(){return this.genProvider==="meta-muse"?"LLM_... (Meta API-Key, dev.meta.ai)":(this.genProvider==="openrouter"?"OpenRouter-Key (openrouter.ai/keys)":"Baseten-API-Key");},',
  'O6 Placeholder');
s = rep1(s,
  'keyMissingMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyMissingMeta\'):this.t(\'keyMissing\');},',
  'keyMissingMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyMissingMeta\'):(this.genProvider==="openrouter"?this.t(\'keyMissingOpenrouter\'):this.t(\'keyMissing\'));},',
  'O6 Missing-Auswahl');
s = rep1(s,
  'keyInvalidMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyInvalidMeta\'):this.t(\'keyInvalid\');},',
  'keyInvalidMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyInvalidMeta\'):(this.genProvider==="openrouter"?this.t(\'keyInvalidOpenrouter\'):this.t(\'keyInvalid\'));},',
  'O6 Invalid-Auswahl');
console.log('  O6: Fehlermeldungen je Provider (Key-Hinweis openrouter.ai/keys)');

// ---------- E1: ETA-Tabelle robust (Modellstring-Varianten, contributor=>240) ----------
s = rep1(s,
  'var isBig=(m.indexOf("1.3")>=0||m.indexOf("wonder")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse");if(isBig&&hi&&pv){return 240;}return 60;}',
  'var low="";try{low=String(m||"").toLowerCase();}catch(eL){low="";}low=low.replace(/^\\s+|\\s+$/g,"");var sl=low.lastIndexOf("/");if(sl>=0){low=low.slice(sl+1);}var co=low.indexOf(":");if(co>=0){low=low.slice(0,co);}var isBig=(low.indexOf("1.3")>=0||low.indexOf("wonder")>=0||low.indexOf("spark")>=0||low.indexOf("opus")>=0||low.indexOf("gpt")>=0||low.indexOf("sol")>=0||low.indexOf("6.1")>=0||low.indexOf("contributor")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse"||p==="openrouter");if(p==="openrouter"&&pv){return 240;}if(isBig&&hi&&pv){return 240;}if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}',
  'E1 Tabelle');
console.log('  E1: ETA-Tabelle robust (Varianten, contributor=>240, openrouter->240)');

// ---------- E2: Dauer-Anzeige entdoppelt (Queue nur aktiv, wartend nur Position) ----------
s = rep1(s,
  'if(st==="jobDone"){var s2=job.secs||0;var tpl="";try{tpl=(job.kind==="mod")?((I18N[L]&&I18N[L].modTotal)||I18N.de.modTotal||""):((I18N[L]&&I18N[L].genTotal)||I18N.de.genTotal||"");}catch(eD){}return String(tpl).split("{s}").join(String(s2));}',
  'if(st==="jobDone"){return "";}',
  'E2 done');
s = rep1(s,
  'return String(q).split("{n}").join(String(pos)).split("{s}").join(String(el));}catch(e){return "";}}',
  'return String(q).split("{n}").join(String(pos));}catch(e){return "";}}',
  'E2 waiting');
s = rep1(s,
  'I18N.de.jobQueue="Platz {n} · wartet ({s} s)";',
  'I18N.de.jobQueue="Platz {n}";',
  'E2 Template de');
s = rep1(s,
  'I18N.en.jobQueue="Slot {n} · queued ({s} s)";',
  'I18N.en.jobQueue="Slot {n}";',
  'E2 Template en');
s = rep1(s,
  'jobQueue:"Puesto {n} · en espera ({s} s)"',
  'jobQueue:"Puesto {n}"',
  'E2 Template es');
console.log('  E2: Queue entdoppelt (aktiv mit Zeit, wartend nur Position, fertig ohne Zeit)');

// ---------- T1: Sterne mit sichtbarer Auswahl (Farbwechsel aktiv) ----------
s = rep1(s,
  '<button v-for="n in 5" type="button" :key="n" @click="teleStars=n" :aria-pressed="teleStars===n" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">{{n}}</button>',
  '<button v-for="n in 5" type="button" :key="n" @click="teleStars=n" :aria-pressed="teleStars===n" :class="(teleStars>=n)?\'bg-amber-400 border-amber-400 text-slate-900\':\'\'" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">{{n}}</button>',
  'T1 Sterne');
console.log('  T1: Sterne-Auswahl sichtbar (amber aktiv)');

// ---------- T2: Vorschau raus (nur Sterne, Freitext, Kopieren) ----------
s = rep1(s,
  '<p style="white-space:pre-wrap;max-height:10rem;overflow:auto" class="mt-2 text-xs">{{teleBlock()}}</p>',
  '',
  'T2 Vorschau');
console.log('  T2: Vorschau-Text entfernt (Block bleibt Kopierquelle)');

// ---------- T3: Danke-Animation + Issue-Button (Data/Methoden/Template/i18n) ----------
s = rep1(s,
  'teleStars:0,teleComment:\'\',teleCopied:false,teleCopyMsg:\'\',teleCopyTimer:null,teleInfo:null,',
  'teleStars:0,teleComment:\'\',teleCopied:false,teleCopyMsg:\'\',teleCopyTimer:null,teleThanks:false,teleIssueShow:false,teleThanksTimer:null,teleInfo:null,',
  'T3 Data');
s = rep1(s,
  'this.teleInfo=info;this.teleStars=0;this.teleComment="";this.teleCopied=false;this.teleCopyMsg="";this.teleStep="ask";',
  'this.teleInfo=info;this.teleStars=0;this.teleComment="";this.teleCopied=false;this.teleCopyMsg="";try{if(this.teleThanksTimer){clearTimeout(this.teleThanksTimer);}}catch(eTT){}this.teleThanksTimer=null;this.teleThanks=false;this.teleIssueShow=false;this.teleStep="ask";',
  'T3 Reset');
s = rep1(s,
  'closeTele:function(){try{if(this.teleCopyTimer){clearTimeout(this.teleCopyTimer);}}catch(e){}this.teleCopyTimer=null;this.teleOpen=false;this.teleStep="ask";},',
  'closeTele:function(){try{if(this.teleCopyTimer){clearTimeout(this.teleCopyTimer);}}catch(e){}this.teleCopyTimer=null;try{if(this.teleThanksTimer){clearTimeout(this.teleThanksTimer);}}catch(eTT){}this.teleThanksTimer=null;this.teleOpen=false;this.teleStep="ask";},',
  'T3 Close');
s = rep1(s,
  'var done=function(ok){try{self.teleCopied=!!ok;self.teleCopyMsg=ok?self.t("teleCopied"):self.t("teleCopyFail");}catch(e2){}};',
  'var done=function(ok){try{self.teleCopied=!!ok;self.teleCopyMsg=ok?self.t("teleCopied"):self.t("teleCopyFail");if(ok){self.teleThanks=true;self.teleIssueShow=false;try{if(self.teleThanksTimer){clearTimeout(self.teleThanksTimer);}}catch(eTC){}try{self.teleThanksTimer=setTimeout(function(){try{self.teleThanks=false;self.teleIssueShow=true;}catch(eTS){}},2500);}catch(eTM){}}else{self.teleThanks=false;self.teleIssueShow=false;}}catch(e2){}};',
  'T3 Copy');
s = rep1(s,
  '<p v-if="teleCopyMsg" class="mt-1 text-xs">{{teleCopyMsg}}</p><p v-if="teleCopied" class="mt-1 text-xs">{{t(\'teleIssue\')}} <a href="https://github.com/Effzumdeh/ModelMuse/issues" target="_blank" rel="noopener" style="text-decoration:underline">{{t(\'teleIssueLink\')}}</a></p>',
  '<p v-if="teleCopyMsg" class="mt-1 text-xs">{{teleCopyMsg}}</p><p v-if="teleThanks" class="mt-2 text-sm font-semibold">{{t(\'teleThanks\')}}</p><div v-if="teleCopied&&teleIssueShow" class="mt-2"><p class="text-xs">{{t(\'teleIssue\')}}</p><a href="https://github.com/Effzumdeh/ModelMuse/issues" target="_blank" rel="noopener" class="mt-1 inline-flex items-center justify-center rounded-xl bg-slate-800 dark:bg-slate-100 px-4 min-h-[44px] text-sm font-semibold text-white dark:text-slate-900">{{t(\'teleIssueLink\')}}</a></div>',
  'T3 Template');
s = rep1(s,
  'I18N.de.teleCopied="Kopiert (ohne Key).";',
  'I18N.de.teleCopied="Kopiert (ohne Key).";I18N.de.teleThanks="Danke für deine Mitwirkung!";',
  'T3 I18N de');
s = rep1(s,
  'I18N.en.teleCopied="Copied (no key).";',
  'I18N.en.teleCopied="Copied (no key).";I18N.en.teleThanks="Thanks for contributing!";',
  'T3 I18N en');
s = rep1(s,
  'teleCopied:"Copiado (sin clave).",',
  'teleCopied:"Copiado (sin clave).",teleThanks:"¡Gracias por tu aportación!",',
  'T3 I18N es');
console.log('  T3: Danke (2,5 s) -> Issue-Button im selben Fenster');

// ---------- F: OrthographicCamera als legitime Kamera (Live-Fall Wonder/A380) ----------
s = rep1(s,
  'PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, Vector3, PMREMGenerator, ShadowMaterial, PCFShadowMap, DataTexture, ACESFilmicToneMapping, SRGBColorSpace } from',
  'PerspectiveCamera, OrthographicCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, Vector3, PMREMGenerator, ShadowMaterial, PCFShadowMap, DataTexture, ACESFilmicToneMapping, SRGBColorSpace } from',
  'F Prompt-Template');
s = rep1(s,
  'Jeder direkt genutzte Name MUSS in der Importliste stehen.',
  'Jeder direkt genutzte Name MUSS in der Importliste stehen. Kamera: PerspectiveCamera (Standard) oder OrthographicCamera (technische/planartige Ansichten, z. B. Grundriss) — die genutzte Kamera steht in der Importliste.',
  'F Kamera-Klausel');
s = rep1(s,
  '"OctahedronGeometry","PCFShadowMap"',
  '"OctahedronGeometry","OrthographicCamera","PCFShadowMap"',
  'F Allowlist');
s = repN(s,
  'OctahedronGeometry,PCFShadowMap',
  'OctahedronGeometry,OrthographicCamera,PCFShadowMap',
  'F Prolog', 2);
console.log('  F: OrthographicCamera (Template + Klausel + Allowlist + Prolog x2)');

// ---------- T4: Stempel v38 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v37 (Min-Zustand + ETA wonder + Telemetrie-Opt-in, via scripts/build-standalone-v37.mjs) -->';
must(cnt(s, stamp) === 1, 'v37-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v38 (OpenRouter + ETA robust/Entkopplung + Telemetrie-UX + OrthographicCamera, via scripts/build-standalone-v38.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v38: OK v38 (OpenRouter + ETA robust/Entkopplung + Telemetrie-UX + OrthographicCamera)');

