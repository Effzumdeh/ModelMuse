/**
 * Standalone builder v43 (Versionshistorie ins Standalone-Release, GitHub-Pages-faehig):
 * Baut auf dem v42-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Stand: Versionshistorie (V1..VX, Wiederherstellen, Zurueck-Button, de/en/es/fr)
 * existiert nur in der Dev-Shell (src/runtime/model-history.js, src/shell/ui-modify.js,
 * src/shell/i18n/*.json, Verlauf im Modify-Overlay); das Standalone-Artefakt kennt
 * weder History-Logik noch History-UI (modify-history fehlt im Bundle).
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * H1  I18N-History-Keys je Sprache (7 Keys: histBack/histTitel...): de/en als
 *     I18N.de|en.X-Zeilen, es/fr als Dict-Paare (Wortlaut = Dev-Shell i18n,
 *     du-Form wie Bestand, fr Tutoiement).
 * H2  History-Helper als Vue-Methoden (histBaseId/histKey/histLoad/histSave/
 *     histAppend/histRecord/histList/histEntryText/restoreHistoryVersion/
 *     backHistory): V1 = Erstgenerierung, jede Ueberarbeitung +1, Deckel 10
 *     (neueste bleiben, Nummern monoton), Familien-Key ohne -modN-Suffix,
 *     Quota-Eviction (aelteste raus), Best-effort (Fehler -> Status, nie Absturz).
 *     Meta/Init-Tore wie Modify/Import ("export const "+"meta", "export function "+"init"
 *     bewusst getrennt, damit Guard-/Fence-Zaehlungen unberuehrt bleiben).
 * H3  History-UI im Modify-Overlay: Zurueck-Button neben Schliessen,
 *     Verlaufstitel + V-Liste (V{nr} · Datum · Titel) mit Wiederherstellen-Button
 *     je Version, Leer-Hinweis; Liste re-rendert via modHistTick.
 * H4  Verdrahtung: openModify frischt Tick auf; modify-Erfolg sichert
 *     Vorgaenger (V1, falls leer) + Ergebnis (Vn+1); restore laedt Snapshot
 *     in-place (Historie bleibt erhalten, kein neuer Eintrag).
 * H5  Stempel v43 + Invarianten (Alt-Zaehler unveraendert, 600-KB-Toleranz) + Syntax-Gate.
 *
 * Hinweis (v44-Nachfolger, 01.11.2026): v44 entfernt den Zurueck-Button +
 * backHistory-Handler und ersetzt das histRestore-Label durch histBtnText
 * (Ausgewaehlt-Markierung). checkInvariants() unten erkennt den v44-Stempel
 * und erwartet dann 0 fuer die vier abgeloesten UI-/Methoden-Zaehler; der
 * v43-Transformpfad ist unveraendert.
 *
 * Aufruf: node scripts/build-standalone-v43.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v43-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v43: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v42 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v43-syn-'));
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
          console.error('build-v43: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v43-inline-' + n + '.js')); } catch {}
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

// ---------- H1: History-Strings (Wortlaut = Dev-Shell src/shell/i18n/*.json) ----------
// de/en als I18N.de|en-Zeilen (roh UTF-8, Stil Bestand), es/fr als Dict-Paare (roh UTF-8).
const HIST_DE = 'I18N.de.histBack="Zurück zur vorherigen Version";'
  + 'I18N.de.histTitle="Verlauf (lokal, max. 10 Versionen)";'
  + 'I18N.de.histRestore="Wiederherstellen";'
  + 'I18N.de.histEntry="V{nr} · {datum} · {titel}";'
  + 'I18N.de.histEmpty="Noch keine Versionen — nach der ersten Überarbeitung steht hier V1.";'
  + 'I18N.de.histNoPrev="Keine vorherige Version vorhanden.";'
  + 'I18N.de.histRestored="„{titel}“ (V{nr}) wiederhergestellt.";';
const HIST_EN = 'I18N.en.histBack="Back to previous version";'
  + 'I18N.en.histTitle="History (local, max. 10 versions)";'
  + 'I18N.en.histRestore="Restore";'
  + 'I18N.en.histEntry="V{nr} · {datum} · {titel}";'
  + 'I18N.en.histEmpty="No versions yet — V1 appears here after the first revision.";'
  + 'I18N.en.histNoPrev="No previous version available.";'
  + 'I18N.en.histRestored="“{titel}” (V{nr}) restored.";';
const HIST_ES = ',histBack:"Volver a la versión anterior"'
  + ',histTitle:"Historial (local, máx. 10 versiones)"'
  + ',histRestore:"Restaurar"'
  + ',histEntry:"V{nr} · {datum} · {titel}"'
  + ',histEmpty:"Aún no hay versiones — V1 aparecerá aquí tras la primera revisión."'
  + ',histNoPrev:"No hay ninguna versión anterior."'
  + ',histRestored:"«{titel}» (V{nr}) restaurado."';
const HIST_FR = ',histBack:"Revenir à la version précédente"'
  + ',histTitle:"Historique (local, 10 versions max.)"'
  + ',histRestore:"Restaurer"'
  + ',histEntry:"V{nr} · {datum} · {titel}"'
  + ',histEmpty:"Aucune version pour l’instant — V1 apparaîtra ici après la première retouche."'
  + ',histNoPrev:"Aucune version précédente disponible."'
  + ',histRestored:"« {titel} » (V{nr}) restauré."';

const HIST_KEYS = ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored'];

// ---------- H2: History-Helper (Vue-Methoden, kompakt; Tore bewusst getrennt) ----------
const HIST_METHODS = ''
  + 'histBaseId:function(id){return String(id||"").replace(/-mod\\d+$/,"").slice(0,32)||"modell";},\r\n'
  + 'histKey:function(id){var b="modell";try{b=String(this.histBaseId(id)).toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"modell";}catch(eB){b="modell";}return "modelmuse-history-v1:"+b;},\r\n'
  + 'histLoad:function(){var raw=null;try{raw=localStorage.getItem(this.histKey(this.activeLab&&this.activeLab.id));}catch(eG){return [];}if(typeof raw!=="string"||!raw){return [];}var d=null;try{d=JSON.parse(raw);}catch(eJ){return [];}var l=Array.isArray(d)?d:d.versions;if(!Array.isArray(l)){return [];}var o=[];for(var i=0;i<l.length;i++){var e=l[i];if(!e||typeof e!=="object"){continue;}var v=Number(e.v);if(!(v>=1&&Math.floor(v)===v)){continue;}var so=String(e.source||"");if(so.indexOf("export const "+"meta")<0){continue;}var tt=new Date(0).toISOString();try{if(e.ts&&!isNaN(Date.parse(e.ts))){tt=e.ts;}}catch(eT){}o.push({v:v,ts:tt,title:String(e.title||"").slice(0,80),source:so});}o.sort(function(a,b){return a.v-b.v;});return o;},\r\n'
  + 'histSave:function(vers){var k=this.histKey(this.activeLab&&this.activeLab.id);var q=vers.slice().sort(function(a,b){return a.v-b.v;});var last=null;while(q.length){try{localStorage.setItem(k,JSON.stringify({v:1,versions:q}));return q.slice();}catch(eS){last=eS;q.shift();}}throw last||new Error("E-HIST-SPEICHER");},\r\n'
  + 'histAppend:function(src,title){var s=String(src||"");if(s.indexOf("export const "+"meta")<0||s.indexOf("export function "+"init")<0){throw new Error("E-HIST-SOURCE");}var vers=[];try{vers=this.histLoad();}catch(eL){vers=[];}var mx=0;for(var i=0;i<vers.length;i++){var n=Number(vers[i]&&vers[i].v);if(n>mx){mx=n;}}var en={v:mx+1,ts:new Date().toISOString(),title:String(title||"").slice(0,80),source:s};vers.push(en);vers.sort(function(a,b){return a.v-b.v;});while(vers.length>10){vers.shift();}this.histSave(vers);try{this.modHistTick=(this.modHistTick||0)+1;}catch(eH){}return vers;},\r\n'
  + 'histRecord:function(prevSrc,prevTitle,nextSrc,nextTitle){var vers=[];try{vers=this.histLoad();}catch(eR){vers=[];}if(!vers.length){try{vers=this.histAppend(prevSrc,prevTitle);}catch(eA){vers=[];try{vers=this.histLoad();}catch(eA2){vers=[];}}}try{return this.histAppend(nextSrc,nextTitle);}catch(eN){return vers;}},' + '\r\n'
  + 'histList:function(){try{this.modHistTick;}catch(eU){}var v=[];try{v=this.histLoad();}catch(eV){v=[];}return v.slice().reverse();},\r\n'
  + 'histEntryText:function(h){var tpl="";try{tpl=this.t(\'histEntry\');}catch(eTT){}var dd=h.ts;try{dd=new Date(h.ts).toLocaleString(this.lang||"de");}catch(eD){}return String(tpl).split("{nr}").join(String(h.v)).split("{datum}").join(String(dd)).split("{titel}").join(String(h.title||h.ts));},\r\n'
  + 'restoreHistoryVersion:async function(v){var lab=this.activeLab;if(!lab){this.modStatus=this.t(\'histNoPrev\');this.modStatusBad=true;return;}var vers=[];try{vers=this.histLoad();}catch(eVL){}var snap=null;for(var i=0;i<vers.length;i++){if(vers[i]&&Number(vers[i].v)===Number(v)){snap=vers[i];break;}}if(!snap){this.modStatus=this.t(\'histNoPrev\');this.modStatusBad=true;return;}var reg=null;try{reg=window.__viewer.registerFree(lab.id,snap.source);}catch(eRR){this.modStatus=this.t(\'badSource\');this.modStatusBad=true;return;}lab._source=snap.source;lab._meta=reg.meta;lab._metaI18n=reg.metaI18n;try{if(snap.title){lab.title.de=snap.title;}}catch(eTD){}try{this.persistFree();}catch(eP){}try{this.syncViewer();}catch(eSV){}try{this.modHistTick=(this.modHistTick||0)+1;}catch(eMT){}this.modStatus=String(this.t(\'histRestored\')).split("{titel}").join(String(snap.title||lab.id)).split("{nr}").join(String(snap.v));this.modStatusBad=false;},\r\n'
  + 'backHistory:function(){var vers=[];try{vers=this.histLoad();}catch(eB2){}if(!vers.length){this.modStatus=this.t(\'histEmpty\');this.modStatusBad=true;return;}if(vers.length<2){this.modStatus=this.t(\'histNoPrev\');this.modStatusBad=true;return;}try{this.restoreHistoryVersion(vers[vers.length-2].v);}catch(eBH){}},';

// ---------- H3: History-UI (Zurueck-Button + Verlauf V1..VX) ----------
const HIST_UI_BUTTON = '\r\n<button type="button" @click="backHistory" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t(\'histBack\')}}</button>';
const HIST_UI_LIST = '\r\n<p class="mt-2 text-sm font-medium">{{t(\'histTitle\')}}</p><ul class="mt-1 space-y-1"><li v-for="h in histList()" :key="h.v" class="flex items-center justify-between gap-2 text-sm"><span>{{histEntryText(h)}}</span><button type="button" @click="restoreHistoryVersion(h.v)" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-3 min-h-[44px] text-xs font-semibold">{{t(\'histRestore\')}}</button></li><li v-if="!histList().length" class="text-xs text-slate-500 dark:text-slate-400">{{t(\'histEmpty\')}}</li></ul>';

function checkInvariants(s) {
  // v44-Nachfolger: Zurueck-Button + backHistory-Handler + histRestore-Label
  // sind abgeloest (Ausgewaehlt-Markierung via histBtnText) -> Zaehler 0.
  const hasV44 = s.includes('standalone-build v44');
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
    ['standalone-build v42', 1],
    ['standalone-build v43', 1],
    // F1 (v42): FR-Button + fr-Dict + 4-sprachige Prompts.
    ['>FR</button>', 1], ["setLang('fr')", 1], ['I18N.fr={', 1],
    ["(locale==='en'||locale==='es'||locale==='fr')?locale:'de'", 1],
    ['(locale==="en"||locale==="es"||locale==="fr")?locale:"de"', 1],
    ['fr: { title, parts: [...] }', 2],
    ['en.explanations + es.explanations + fr.explanations als', 2],
    // F2/F3 (v42): LABS/META fr (6 Modelle je Feld, 5 meta_i18n-Konstanten).
    ['titleFr', 6], ['partsFr', 12], ['expFr', 2], ['measTextFr', 3],
    ['const meta_i18n_arch_brandenburger_tor = {', 1], ['const meta_i18n_si_1 = {', 1],
    ['const meta_i18n_chemie_koffein = {', 1], ['const meta_i18n_free_handbohrmaschine = {', 1],
    ['const meta_i18n_gpu_example = {', 1],
    // E (v41): I18N-Keys je Sprache genau 4x (de/en/es/fr).
    ['saveModel:', 4], ['saveGlb:', 4], ['savePng:', 4], ['saveSvg:', 4],
    ['saveOk:', 4], ['saveErr:', 4], ['saveNone:', 4], ['saveNoSvg:', 4],
    // E (v42): FR-Anreicherung + Fallbacks.
    ['var FR={', 1], ['title.fr', 4], ['labels.fr', 3],
    // O (v38): OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    // Alt-Gates: Zaehler mit fr-+1.
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 6],
    ['reasoning_effort', 10],
    ['reasoning_effort="xhigh"', 2],
    ['genReasoning:"xhigh"', 1],
    ['this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 1],
    ['||this.genProvider==="openrouter"', 2],
    ['this.genProvider==="openrouter"?"xhigh":"max"', 1],
    // H2 (v43): History-Helper genau 1x je Methode.
    ['histBaseId:function', 1], ['histKey:function', 1], ['histLoad:function', 1],
    ['histSave:function', 1], ['histAppend:function', 1], ['histRecord:function', 1],
    ['histList:function', 1], ['histEntryText:function', 1],
    ['restoreHistoryVersion:async function', 1], ['backHistory:function', hasV44 ? 0 : 1],
    // H2/H4 (v43): Tick-State + Bumps (Data + openModify + append + restore).
    ['modHistTick:0,', 1], ['this.modHistTick=(this.modHistTick||0)+1;', 3],
    // H3 (v43): History-UI (Button + Verlauf) — v44: Zurueck raus (0),
    // histRestore-Label durch histBtnText ersetzt (0).
    ['@click="backHistory"', hasV44 ? 0 : 1], ['@click="restoreHistoryVersion(h.v)"', 1],
    ['v-for="h in histList()"', 1],
    ["{{t('histBack')}}", hasV44 ? 0 : 1], ["{{t('histTitle')}}", 1],
    ["{{t('histRestore')}}", hasV44 ? 0 : 1], ["{{t('histEmpty')}}", 1],
    // H4 (v43): Record-Hook im Modify-Erfolg genau 1x.
    ['this.histRecord(src,', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  // H1 (v43): 7 History-Keys je Sprache (de/en-Zeilen, es/fr-Dict-Paare).
  for (const k of HIST_KEYS) {
    must(cnt(s, 'I18N.de.' + k + '=') === 1, 'de-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, 'I18N.en.' + k + '=') === 1, 'en-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, k + ':"') === 2, 'es/fr-Paar fehlt/mehrdeutig: ' + k + ' x' + cnt(s, k + ':"'));
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v43 History + Alt-Zaehler)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v43: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v42-fr',
    standalone: 'v43',
    befund: [
      'Versionshistorie existiert nur in der Dev-Shell (model-history.js, ui-modify.js, i18n de/en/es/fr); Standalone-Bundle kennt weder History-Logik noch History-UI.',
      'Standalone-Modify (Vue) sichert keinen Vorgaenger, keine V1..VX-Liste, kein Wiederherstellen/Zurueck im Bundle.',
    ],
    fixes: [
      'H1 I18N-History-Keys (7 Keys x de/en/es/fr, Wortlaut Dev-Shell)',
      'H2 History-Helper als Vue-Methoden (V1..VX, Familien-Key, Deckel 10, Quota-Eviction, Best-effort)',
      'H3 History-UI im Modify-Overlay (Zurueck-Button, Verlaufstitel, V-Liste mit Wiederherstellen, Leer-Hinweis)',
      'H4 Verdrahtung (openModify-Tick, Record bei Modify-Erfolg, Restore in-place)',
      'H5 Stempel v43 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v43: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v42'), 'kein v42-Stempel (falsche Basis)');
if (s.includes('standalone-build v43')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v43: bereits v43 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- H1: I18N-History-Keys de/en (Zeilen) + es/fr (Dict-Paare) ----------
s = rep1(s,
  'I18N.de.modifyOpen="Überarbeiten";',
  'I18N.de.modifyOpen="Überarbeiten";' + HIST_DE,
  'H1 de-History-Keys');
s = rep1(s,
  'I18N.en.modifyOpen="Revise";',
  'I18N.en.modifyOpen="Revise";' + HIST_EN,
  'H1 en-History-Keys');
s = rep1(s,
  'jobDoneHint:"Completado con éxito – ver biblioteca."};',
  'jobDoneHint:"Completado con éxito – ver biblioteca."' + HIST_ES + '};',
  'H1 es-History-Keys');
s = rep1(s,
  'jobDoneHint:"Termin\\u00e9 avec succ\\u00e8s \\u2013 voir la biblioth\\u00e8que."};',
  'jobDoneHint:"Termin\\u00e9 avec succ\\u00e8s \\u2013 voir la biblioth\\u00e8que."' + HIST_FR + '};',
  'H1 fr-History-Keys');
console.log('  H1: I18N-History-Keys (7 Keys x de/en/es/fr)');

// ---------- H3: History-UI (Zurueck-Button + Verlauf) im Modify-Overlay ----------
s = rep1(s,
  "{{t('genClose')}}</button>\r\n</div><div v-if=\"modBusy\"",
  "{{t('genClose')}}</button>" + HIST_UI_BUTTON + "\r\n</div>" + HIST_UI_LIST + '<div v-if="modBusy"',
  'H3 History-UI (Button + Verlauf)');
console.log('  H3: History-UI (Zurueck-Button + V-Liste mit Wiederherstellen)');

// ---------- H2/H4: Tick-State + Helper-Methoden + Hooks ----------
s = rep1(s,
  'modOverlay:false,modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,',
  'modOverlay:false,modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,modHistTick:0,',
  'H2 modHistTick-State');
s = rep1(s,
  'modify:async function(jobWish,jobLabId){',
  HIST_METHODS + 'modify:async function(jobWish,jobLabId){',
  'H2 History-Helper (10 Methoden)');
s = rep1(s,
  'this.modOverlay=true;this.modStatus="";this.modStatusBad=false;},',
  'this.modOverlay=true;this.modStatus="";this.modStatusBad=false;try{this.modHistTick=(this.modHistTick||0)+1;}catch(eHT){}},',
  'H4 openModify-Tick');
s = rep1(s,
  'lab._source=quelle;lab._meta=reg.meta;lab._metaI18n=reg.metaI18n;',
  'try{this.histRecord(src,(lab.title&&(lab.title.de||lab.title.en))||lab.id,quelle,(reg.meta&&reg.meta.title)||((lab.title&&(lab.title.de||lab.title.en))||lab.id));}catch(eHR){}lab._source=quelle;lab._meta=reg.meta;lab._metaI18n=reg.metaI18n;',
  'H4 Record-Hook (Vorgaenger + Ergebnis)');
console.log('  H2/H4: Helper + Tick-State + Hooks (openModify, modify-Erfolg)');

// ---------- H5: Stempel v43 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v42 (FR-Portierung: FR-Button + I18N.fr + LABS/META fr + Prompts 4-sprachig, via scripts/build-standalone-v42.mjs) -->';
must(cnt(s, stamp) === 1, 'v42-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v43 (Versionshistorie: History-Logik + V1..VX-UI + de/en/es/fr, via scripts/build-standalone-v43.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v43: OK v43 (Versionshistorie ins Standalone-Release)');
