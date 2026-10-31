/**
 * Standalone builder v26 (E0 Erklaerungen-Prompt + D0 Disclaimer-raus + M0 tolerante Parts + T0 2D-Auto + B0 Stempel):
 * Baut auf dem v25-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befunde (Eigentuemer 31.10.2026):
 * - Generierte Labs ohne Erklaerungen: Artefakt-Prompt fordert keine an.
 *   Vorgabe: KEIN Fallback-Text — LLM liefert meta.explanations +
 *   meta_i18n en/es.explanations (Aufbau wie Standard-Modelle, Deckung).
 * - Disclaimer Baseten-Key-Hinweis ersatzlos raus (de/en/es).
 * - Live Modify Grafikkarte [fence:ja] E-FREE-META parts: Parts-Pruefung zu
 *   strikt, ohne Detail. Vorgabe: gleiche tolerante Regeln wie Generate,
 *   Pruefung auf echten Vertragsbruch (Anzahl 3-8, Label-Abgleich), Diagnose
 *   mit Validierungsdetail.
 * - Live Aktivitaetsdiagramm (finish stop, 4649 Tokens, kaum Reasoning):
 *   Modell denkt ueber is3d false + 3D-Platzhalter nach statt Diagramm zu
 *   liefern. Vorgabe: 2D-Auto-Erkennung (Diagramm-Begriffe -> 2D-Vertrag im
 *   Prompt), Validierung akzeptiert 2D-Output, Diagnose zeigt 2D/3D-Entscheid.
 *
 * Umsetzung (billig, datenseitig; KEIN Zweit-Call, KEIN Length-Limit):
 * E0  Generate-Prompt: Erklaerungs-Vertrag de/en/es, 1x (Modify unangetastet).
 * D0  Disclaimer raus (de/en/es Keys, Template-Zeile, Computed);
 *     copyPrompt-Status zeigt promptCopied.
 * M0  registerFree Parts tolerant: trimmen/Leere droppen, Count 3-8 mit Detail
 *     (n=..), Label-Abgleich gegen addLabel-Texte (exakt, Fallback
 *     case-insensitiv; ohne addLabel kein Abgleich — 2D bleibt zulassend),
 *     Fehler mit Detail (Label fehlt), meta.parts normalisiert.
 * T0  2D-Auto: diagramKind(term) klassifiziert clientseitig (ohne LLM-Call);
 *     buildFreePrompt verzweigt auf buildFreePrompt2D (2D-Vertrag: meta +
 *     meta_2d + DSL-Payload + Vendor-Render, is3d:false, KEIN 3D-Platzhalter,
 *     KEIN is3d-Deliberieren). Validierung: M0 + is2D-Zweig akzeptieren 2D
 *     (kein Label-Zwang ohne addLabel); Diagnose: [2D]/[3D] in
 *     gen/mod-Status, _lastMode in diagText (mode:).
 * R0  Reasoning max statt low (mit Leitplanken): max nur wo belegt (1.3/
 *     wonder auf meta-muse); Contributor-Modelle + Baseten-Pfad bekommen das
 *     hoechste BELEGTE Level (xhigh, Doku-Tabellen), nie max (sonst 400);
 *     UI-Select-Default dem erhoechten Maximum folgend; 400-Fallback bleibt.
 * B0  Build-Stempel v26.
 *
 * Aufruf: node scripts/build-standalone-v26.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v26-report.json';

const BS = String.fromCharCode(92);
const QC = String.fromCharCode(34);
const CRLF = String.fromCharCode(13, 10);

function must(cond, msg) {
  if (!cond) { console.error('build-v26: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate: jedes Inline-Script (classic + module) muss parsen (wie v25: iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v26-syn-'));
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

// ---------- E0: Generate-Prompt um Erklaerungs-Vertrag de/en/es erweitern ----------
const META_I18N_EL = '"Zusaetzlich meta_i18n liefern: export const meta_i18n = { en: { title, parts: [...] }, es: { title, parts: [...] } } mit fachgerechten Uebersetzungen von Titel + parts (gleiche Anzahl/Reihenfolge wie meta.parts)."';
const EXPLAIN_EL = ',"Bestandteil-Erklaerungen (Pflicht, NUR Daten, Aufbau wie Standard-Modelle): meta enthaelt zusaetzlich explanations: [je EIN Satz pro Hauptbauteil aus parts - WAS es ist + WOFUER im Modell, 8-200 Zeichen, gleiche Anzahl/Reihenfolge wie parts, Sprache wie parts]. meta_i18n enthaelt en.explanations + es.explanations als fachgerechte Uebersetzungen (gleiche Anzahl/Reihenfolge wie parts)."';

// ---------- D0: Disclaimer-Anker (Baseten-Variante de/en/es) ----------
const DE_HINT = 'I18N.de.directHint="Direktaufruf Baseten in deinem Browser (OpenAI-kompatibel). Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";';
const EN_HINT = 'I18N.en.directHint="Direct Baseten call in your browser (OpenAI-compatible). No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.";';
const ES_HINT = 'directHint:"Llamada directa a Baseten en tu navegador (compatible con OpenAI). Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso.",';
const TPL_HINT = '<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{directHintMsg}}</p>' + CRLF;
const COMPUTED_HINT = "directHintMsg:function(){return this.genProvider===" + '"meta-muse"' + "?this.t('directHintMeta'):this.t('directHint');},";
const OLD_COPYPROMPT = "copyPrompt:function(){this.genStatus=this.t('directHint');this.genStatusBad=false;}";
const NEW_COPYPROMPT = "copyPrompt:function(){this.genStatus=this.t('promptCopied');this.genStatusBad=false;}";

// ---------- M0: tolerante Parts-Pruefung in registerFree ----------
const OLD_PARTS = 'if(!Array.isArray(meta.parts)||meta.parts.length<3||meta.parts.length>8){throw new Error("E-FREE-META: parts");}for(var ki=0;ki<meta.parts.length;ki++){if(typeof meta.parts[ki]!=="string"||!meta.parts[ki]){throw new Error("E-FREE-META: parts");}}';
const NEW_PARTS = "var __parts=[];try{__parts=(Array.isArray(meta.parts)?meta.parts:[]).map(function(p){try{return String(p==null?'':p).trim();}catch(__pt){return '';}}).filter(function(p){return p.length>0;});}catch(__pe){__parts=[];}"
  + "if(__parts.length<3||__parts.length>8){throw new Error('E-FREE-META: parts (n='+__parts.length+', erwartet 3-8)');}"
  + "var __labels={},__hasLab=false;try{__hasLab=code.indexOf('addLabel(')>=0;}catch(__hl){__hasLab=false;}"
  + "if(__hasLab){try{var __sp=code.split('addLabel(');for(var __li=1;__li<__sp.length;__li++){var __cm=__sp[__li].indexOf(',');if(__cm<0){continue;}"
  + "var __qq=__sp[__li].slice(__cm+1);var __j=0;while(__j<__qq.length&&__qq.charCodeAt(__j)<=32){__j+=1;}"
  + "var __qc=__qq.charAt(__j);var __q34=String.fromCharCode(34),__q39=String.fromCharCode(39);if(__qc!==__q34&&__qc!==__q39){continue;}"
  + "var __t='',__k=__j+1,__bs=String.fromCharCode(92);"
  + "while(__k<__qq.length){var __ch=__qq.charAt(__k);if(__ch===__bs){__t+=__qq.charAt(__k+1)||'';__k+=2;continue;}if(__ch===__qc){break;}__t+=__ch;__k+=1;}"
  + "try{__t=__t.trim();}catch(__tt){}if(__t){__labels[__t]=1;}}}catch(__le){}}"
  + "var __missing=null;"
  + "if(__hasLab){for(var __kj=0;__kj<__parts.length;__kj++){var __pl=__parts[__kj];if(!__labels[__pl]){var __low=__pl.toLowerCase(),__found=false;"
  + "for(var __lk in __labels){if(__lk.toLowerCase()===__low){__found=true;break;}}if(!__found){__missing=__pl;break;}}}}"
  + "if(__missing!==null){throw new Error('E-FREE-META: parts (Label fehlt: '+String.fromCharCode(34)+String(__missing).slice(0,60)+String.fromCharCode(34)+')');}"
  + "meta.parts=__parts;";

// ---------- R0: Reasoning max statt low (mit Leitplanken, 400-Fallback bleibt) ----------
const R0_REASONING_ALLOWED = 'reasoningAllowed:function(){return this.genProvider==="meta-muse"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0");},';
const R0_METHODS = 'xhighAllowed:function(){if(this.reasoningAllowed){return true;}if(this.genProvider==="baseten-direct"){return true;}try{if(this.genProvider==="meta-muse"&&String(this.genModel||"").indexOf("contributor")>=0){return true;}}catch(eX){}return false;},'
  + 'reasoningDefault:function(){if(this.reasoningAllowed){return "max";}if(this.xhighAllowed){return "xhigh";}return "";},';
const R0_GEN_OLD = 'if(this.genProvider==="meta-muse"&&this.genReasoning==="max"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0")){gbody.reasoning_effort="max";}if(this.genProvider==="baseten-direct"){gbody.reasoning_effort="low";gbody.stream_options={include_usage:true};}';
const R0_GEN_NEW = 'var wantG=this.genReasoning||this.reasoningDefault;if(wantG==="max"&&this.reasoningAllowed){gbody.reasoning_effort="max";}else if((wantG==="xhigh"||wantG==="max")&&this.xhighAllowed){gbody.reasoning_effort="xhigh";}if(this.genProvider==="baseten-direct"){gbody.stream_options={include_usage:true};}';
const R0_MOD_OLD = 'if(this.genProvider==="meta-muse"&&this.genReasoning==="max"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0")){mbody.reasoning_effort="max";}if(this.genProvider==="baseten-direct"){mbody.reasoning_effort="low";mbody.stream_options={include_usage:true};}';
const R0_MOD_NEW = 'var wantM=this.genReasoning||this.reasoningDefault;if(wantM==="max"&&this.reasoningAllowed){mbody.reasoning_effort="max";}else if((wantM==="xhigh"||wantM==="max")&&this.xhighAllowed){mbody.reasoning_effort="xhigh";}if(this.genProvider==="baseten-direct"){mbody.stream_options={include_usage:true};}';
const R0_GM_OLD = 'genModelChanged:function(){if(!this.reasoningAllowed){this.genReasoning="";}},';
const R0_GM_NEW = 'genModelChanged:function(){this.genReasoning=this.reasoningDefault;},';
const R0_GP_OLD = 'if(ms&&ms.length){this.genModel=ms[0];}if(!this.reasoningAllowed){this.genReasoning="";}';
const R0_GP_NEW = 'if(ms&&ms.length){this.genModel=ms[0];}this.genReasoning=this.reasoningDefault;';
const R0_DATA_OLD = 'genReasoning:"",';
const R0_DATA_NEW = 'genReasoning:"xhigh",';
const R0_SELECT_ANCHOR = '<select id="gen-reasoning" v-model="genReasoning" :disabled="!reasoningAllowed"';
const R0_SELECT_NEW = '<select id="gen-reasoning" v-model="genReasoning" :disabled="!(reasoningAllowed||xhighAllowed)"';
const R0_MAXOPT_ANCHOR = '<option value="max" :disabled="!reasoningAllowed">';
const R0_MAXOPT_NEW = '<option value="xhigh" :disabled="!xhighAllowed">{{t(' + "'reasoningHigh'" + ')}}</option>' + '<option value="max" :disabled="!reasoningAllowed">';
const R0_DE_OLD = 'I18N.de.reasoningMax="Max (nur 1.3/wonder)";';
const R0_DE_NEW = 'I18N.de.reasoningMax="Max (nur 1.3/wonder)";I18N.de.reasoningHigh="Hoch (xhigh)";';
const R0_EN_OLD = 'I18N.en.reasoningMax="Max (1.3/wonder only)";';
const R0_EN_NEW = 'I18N.en.reasoningMax="Max (1.3/wonder only)";I18N.en.reasoningHigh="High (xhigh)";';
const R0_ES_OLD = 'reasoningMax:"M' + BS + 'u00e1x (solo 1.3/wonder)",';
const R0_ES_NEW = 'reasoningMax:"M' + BS + 'u00e1x (solo 1.3/wonder)",reasoningHigh:"Alto (xhigh)",';

// ---------- T0: 2D-Auto-Erkennung + 2D-Vertrag im Prompt + Modus-Diagnose ----------
const FREEPROMPT_HEAD = 'buildFreePrompt:function(term,locale){var loc=';
const T0_METHODS = "diagramKind:function(term){var t=String(term||'').toLowerCase();var pad=' '+t+' ';"
  + "function hasW(ws){for(var k=0;k<ws.length;k+=1){if(pad.indexOf(' '+ws[k]+' ')>=0){return true;}}return false;}"
  + "function hasS(ws){for(var k=0;k<ws.length;k+=1){if(t.indexOf(ws[k])>=0){return true;}}return false;}"
  + "if(hasS(['schaltplan','schaltkreis','stromlauf','schnittansicht','seitenansicht'])||hasW(['tabelle','checkliste','stueckliste','stückliste'])){return {v:'svg',kind:'generic',exp:'diagram',render:'renderDiagram2D',imp:'2d-svg'};}"
  + "if(hasS(['kennlinie','balkendiagramm','kuchendiagramm','tortendiagramm'])||hasW(['balken','saeule','säule','kuchen','torte','statistik','verlauf'])){return {v:'chart',kind:'balken',exp:'chart',render:'renderChart2D',imp:'2d-chart'};}"
  + "if(hasW(['formel','gleichung'])){return {v:'katex',kind:'formel',exp:'formula',render:'renderMath2D',imp:'2d-katex'};}"
  + "if(hasS(['netzplan','netzwerk','rechnernetz','topologie','organigramm','baumdiagramm','entscheidungsbaum','hierarchie'])||hasW(['netz'])){return {v:'d3',kind:'netz',exp:'graph',render:'renderGraph2D',imp:'2d-d3'};}"
  + "if(hasW(['sequenz'])){return {v:'mermaid',kind:'sequenz',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}"
  + "if(hasS(['erd','entity','beziehung','kardinalitaet','use-case','anwendungsfall'])||hasW(['er'])){return {v:'mermaid',kind:'er',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}"
  + "if(hasS(['diagramm','fluss','ablauf','aktivit','prozess','zustand','entscheidung','mindmap'])){return {v:'mermaid',kind:'fluss',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}"
  + "return null;},"
  + "buildFreePrompt2D:function(term,locale,dk){var loc=(locale==='en'||locale==='es')?locale:'de';var t=(term||'').slice(0,80);var skel='';"
  + "if(dk.exp==='mermaid'){skel='export const mermaid = { diagram: " + QC + "'+dk.kind+'" + QC + ", title: TITEL, labels: [...], measurement: " + QC + "Name: Zahl Einheit" + QC + ", source: " + QC + "Mermaid-DSL-Text des Diagramms" + QC + " };';}"
  + "else if(dk.exp==='chart'){skel='export const chart = { kind: " + QC + "'+dk.kind+'" + QC + ", title: TITEL, labels: [...], measurement: " + QC + "Name: Zahl Einheit" + QC + ", values: [Zahlen je Label], unit: " + QC + "%" + QC + " };';}"
  + "else if(dk.exp==='formula'){skel='export const formula = { kind: " + QC + "formel" + QC + ", title: TITEL, labels: [...], measurement: " + QC + "Name: Zahl Einheit" + QC + ", tex: " + QC + "LaTeX-Text der Formel" + QC + " };';}"
  + "else if(dk.exp==='graph'){skel='export const graph = { kind: " + QC + "netz" + QC + ", title: TITEL, labels: [...], measurement: " + QC + "Name: Zahl Einheit" + QC + ", nodes: [{ id: " + QC + "a" + QC + ", label: " + QC + "Knoten A" + QC + " }], edges: [{ from: " + QC + "a" + QC + ", to: " + QC + "b" + QC + ", label: " + QC + QC + " }] };';}"
  + "else{skel='export const diagram = { kind: " + QC + "generic" + QC + ", title: TITEL, labels: [...], measurement: " + QC + "Name: Zahl Einheit" + QC + " };';}"
  + "return ['P1 FREIMODUS-2D (Single-Page-Wrapper, Modell muse-spark-1.3-contributor).',"
  + "'Begriff: '+t+'. Baue das benannte Diagramm als 2D-Modell (Variante '+dk.v+', kind '+dk.kind+').',"
  + "'Vertrag: export const meta = { title, category, detailLevel: 2, parts: [3-8 Knotennamen aus dem Diagramm], units: " + QC + "m" + QC + ", is3d: false }. category MUSS exakt einer dieser Werte sein: hardware, architektur, auto, pflanze, sonstiges (nimm den passendsten, sonst " + QC + "sonstiges" + QC + "). export const meta_2d = { kind: " + QC + "'+dk.kind+'" + QC + ", version: 1 }. '+skel+' export function init(container, params) ruft NUR '+dk.render+'(container, DATEN) und gibt { update, dispose } zurueck (update: nichts tun; dispose: Container leeren).',"
  + "'Imports NUR: benannter Import { '+dk.render+' } aus '" + "+dk.imp+" + "'. Keine weiteren Module, keine URLs, keine dynamischen Imports, kein three.',"
  + "'VERBOTENE Bezeichner (Modul wird sonst abgelehnt): nutze NIEMALS document, window, parent, top, fetch, eval, Function, navigator, localStorage, sessionStorage, indexedDB, sendBeacon, WebSocket, XMLHttpRequest als Variablen, Properties oder Strings. Nur container anfassen (kein Resize-Listener).',"
  + "'Pflicht: meta.parts sind exakt die Knoten-/Bauteilnamen des Diagramms (3-8, gleiche Reihenfolge wie labels im Daten-Export). Genau EINE Messung als measurement-Text mit Einheit (mm/cm/m).',"
  + "'Antwortsprache (locale): '+loc+'. Titel, Labels und Erklaerungen in dieser Sprache; KEINE Sprachlogik im Code - Strings sind Daten.',"
  + "'Zusaetzlich meta_i18n liefern: export const meta_i18n = { en: { title, parts: [...] }, es: { title, parts: [...] } } mit fachgerechten Uebersetzungen von Titel + parts (gleiche Anzahl/Reihenfolge wie meta.parts). Keine weiteren Sprachen, kein Code, nur Daten.',"
  + "'Bestandteil-Erklaerungen (Pflicht, NUR Daten, Aufbau wie Standard-Modelle): meta enthaelt zusaetzlich explanations: [je EIN Satz pro Hauptbauteil aus parts - WAS es ist + WOFUER im Modell, 8-200 Zeichen, gleiche Anzahl/Reihenfolge wie parts, Sprache wie parts]. meta_i18n enthaelt en.explanations + es.explanations als fachgerechte Uebersetzungen (gleiche Anzahl/Reihenfolge wie parts).',"
  + "'Liefere AUSSCHLIESSLICH einen ```js-Codeblock mit dem kompletten Modulcode (kein Text davor/danach). Kein Nachdenken, keine Einleitung - antworte nur mit dem ```js-Block.'].join(String.fromCharCode(10));},";
const FREEPROMPT_BRANCH = 'buildFreePrompt:function(term,locale){var dk=null;try{dk=this.diagramKind(term);}catch(eD){dk=null;}if(dk){return this.buildFreePrompt2D(term,locale,dk);}var loc=';
const GEN_OK_OLD = 'this.genStatus=this.t(' + "'loadedFree'" + ')+reg.meta.title+" ("+reg.meta.parts.length+")";';
const GEN_OK_NEW = 'this.genStatus=this.t(' + "'loadedFree'" + ')+reg.meta.title+" ("+reg.meta.parts.length+")"+(reg.meta&&reg.meta.is3d===false?" [2D]":" [3D]");try{this._lastMode=(reg.meta&&reg.meta.is3d===false)?"2D":"3D";}catch(eLM){}';
const MOD_OK_OLD = "this.modStatus=this.t('modDone');";
const MOD_OK_NEW = "this.modStatus=this.t('modDone')+(reg.meta&&reg.meta.is3d===false?" + QC + " [2D]" + QC + ":" + QC + " [3D]" + QC + ");try{this._lastMode=(reg.meta&&reg.meta.is3d===false)?" + QC + "2D" + QC + ":" + QC + "3D" + QC + ";}catch(eLM){}";
const DIAG_RT_OLD = 'var rt="0/1";';
const DIAG_RT_NEW = 'var md="?";try{md=this._lastMode||"?";}catch(eMd){}var rt="0/1";';
const DIAG_MODE_OLD = '")+"' + BS + 'nbuild: "+bld+"' + BS + 'nraw_snippet_2k: "+raw;';
const DIAG_MODE_NEW = '")+"' + BS + 'nmode: "+md+"' + BS + 'nbuild: "+bld+"' + BS + 'nraw_snippet_2k: "+raw;';

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', (s.includes('standalone-build v40') ? 28 : 26)], ['OpenRouter', (s.includes('standalone-build v40') ? 13 : 12)],
    ['max_output_tokens', 0], ['"stop"', 0], ['logprobs', 0], ['logit_bias', 0],
    ['modalities', 0], ['web_search_options', 0],
    ['text/event-stream', 2], ['stream:true', 3],
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
    ['gbody.reasoning_effort="low"', 0],
    ['mbody.reasoning_effort="low"', 0],
    ['reasoning_effort="none"', 0],
    ['stream_options', 4],
    ['delete gbody.stream_options', 1],
    ['delete mbody.stream_options', 1],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['dev.meta.ai', 10],
    // v37-Nachfolger (Tele-Snapshot liest _lastChatInfo/_lastHttp je +1): 7->8, 6->7.
    ['collectChatText', 4], ['emptyDetail', 3], ['_lastChatInfo', 8], ['_lastHttp', 7],
    // v37-Nachfolger (Tele-Snapshot liest _lastRetry +1): 7->8.
    ['_lastRetry', 8],
    ['_lastReqR', 3],
    ['this._lastReq={', 4],
    ['reasoningAllowed', 7],
    ['xhighAllowed', 6],
    // v32-Nachfolger (ETA-Tabelle liest Default): 5->6.
    ['reasoningDefault', 6],
    ['genReasoning:"xhigh"', 1],
    ['genReasoning:""', 0],
    ['reasoningHigh', 4],
    ['value="xhigh"', 1],
    ['gbody.reasoning_effort="xhigh"', 1],
    ['mbody.reasoning_effort="xhigh"', 1],
    ['staleHint', 2], ['buildTag', 3],
    ['Build v26', 1], ['Build v25', 0], ['Build v24', 0], ['Strg+F5', 1],
    ['slice(0,200)', 2], ['slice(0,160)', 0],
    ['slice(0,2048)', 2],
    ['emptyResponse', 4],
    ['v-if="labs.length"', 1], ['$nextTick', 2],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    ['Kein Nachdenken, keine Einleitung', 3],
    ['diagText:function', 1], ['copyDiag:function', 1],
    ['copyDiagBtn', 4],
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
    ['Fix3 Import-Strip v24', 1],
    ['E-FREE-FORBID: import(', 1],
    ['import verblieben', 1],
    ['Z,fence:', 2],
    ['__FREE_FENCE_V25__', 1],
    ['```js-Codeblock', 3],
    ['keine Erklaerung, keine Fences', 0],
    ['var __m25=', 4],
    ['var __i25=', 4],
    ['var __t25=', 4],
    ['}catch(__e25){}', 1],
    ['init/meta fehlt (Antwort ohne', 1],
    ['Aufbau wie Standard-Modelle', 2],
    ['Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.', 0],
    ['No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.', 0],
    ['Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso.', 0],
    ['directHintMsg', 0],
    ["this.t('directHint')", 0],
    ["this.t('promptCopied')", 1],
    ['E-FREE-META: parts (n=', 1],
    ['Label fehlt: ', 1],
    ['meta.parts=__parts;', 1],
    ['for(var ki=0;ki<meta.parts.length;ki++)', 0],
    ['diagramKind:function', 1],
    ['buildFreePrompt2D:function', 1],
    ['FREIMODUS-2D', 1],
    ['" [2D]"', 2],
    ['" [3D]"', 2],
    ['this._lastMode', 3],
    ['mode: "+md', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v26 E0+D0+M0+T0+R0+B0)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v26: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v25-fence-robustheit',
    standalone: 'v26',
    befund: [
      'Generierte Labs ohne Erklaerungen: Artefakt-Prompt fordert keine an (Prompt statt Fallback, Owner-Vorgabe de/en/es).',
      'Disclaimer Baseten-Key-Hinweis soll ersatzlos raus (de/en/es).',
      'Live Modify Grafikkarte: [fence:ja] E-FREE-META parts — Parts-Pruefung zu strikt.',
      'Live Aktivitaetsdiagramm: Modell denkt ueber is3d+Platzhalter nach statt Diagramm zu liefern (4649 Tokens).',
      'Reasoning laeuft auf low statt belegtem Maximum (max nur 1.3/wonder; Contributor/Baseten brauchen xhigh, nie max wegen 400).',
    ],
    fixes: [
      'E0 Generate-Prompt: Erklaerungs-Vertrag de/en/es (Aufbau wie Standard-Modelle, Deckung zu parts) — kein Fallback-Text, kein Zweit-Call, kein Length-Limit',
      'D0 Disclaimer entfernt (de/en/es Baseten-Keys, Template-Zeile, Computed); copyPrompt-Status zeigt promptCopied',
      'M0 Parts-Pruefung tolerant: trimmen/Leere droppen, Count 3-8 mit Detail (n=..), Label-Abgleich mit Detail (Label fehlt), meta.parts normalisiert',
      'T0 2D-Auto: diagramKind klassifiziert clientseitig, 2D-Vertrag im Prompt (meta_2d + DSL + Vendor-Render, is3d:false, kein Platzhalter); Validierung akzeptiert 2D; Diagnose mit [2D]/[3D] und mode:',
      'R0 Reasoning max statt low: max nur wo belegt (1.3/wonder); Contributor + Baseten bekommen xhigh (belegt, nie max); UI-Default folgt; 400-Fallback bleibt',
      'B0 Build-Stempel v26',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v26: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v25'), 'kein v25-Stempel (falsche Basis)');
if (s.includes('standalone-build v26')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v26: bereits v26 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- E0: Erklaerungs-Vertrag in den Generate-Prompt ----------
must(cnt(s, META_I18N_EL) === 1, 'Prompt-Anker meta_i18n: ' + cnt(s, META_I18N_EL) + ', erwartet 1');
s = s.replace(META_I18N_EL, META_I18N_EL + EXPLAIN_EL);
console.log('  E0: Generate-Prompt um Erklaerungen de/en/es erweitert');

// ---------- D0: Disclaimer ersatzlos entfernen ----------
s = rep1(s, DE_HINT, '', 'Disclaimer de');
s = rep1(s, EN_HINT, '', 'Disclaimer en');
s = rep1(s, ES_HINT, '', 'Disclaimer es');
s = rep1(s, TPL_HINT, '', 'Disclaimer Template-Zeile');
s = rep1(s, COMPUTED_HINT, '', 'Disclaimer Computed');
s = rep1(s, OLD_COPYPROMPT, NEW_COPYPROMPT, 'copyPrompt-Status');
console.log('  D0: Disclaimer raus (de/en/es + Template + Computed), copyPrompt -> promptCopied');

// ---------- M0: tolerante Parts-Pruefung ----------
s = rep1(s, OLD_PARTS, NEW_PARTS, 'Parts-Pruefung tolerant');
console.log('  M0: Parts-Pruefung tolerant (Normalisierung + Count-Detail + Label-Abgleich)');

// ---------- R0: Reasoning max statt low (mit Leitplanken, 400-Fallback bleibt) ----------
s = rep1(s, R0_REASONING_ALLOWED, R0_METHODS + R0_REASONING_ALLOWED, 'Reasoning-Methoden');
s = rep1(s, R0_GEN_OLD, R0_GEN_NEW, 'Reasoning generate');
s = rep1(s, R0_MOD_OLD, R0_MOD_NEW, 'Reasoning modify');
s = rep1(s, R0_GM_OLD, R0_GM_NEW, 'Reasoning Modell-Wechsel');
s = rep1(s, R0_GP_OLD, R0_GP_NEW, 'Reasoning Provider-Wechsel');
s = rep1(s, R0_DATA_OLD, R0_DATA_NEW, 'Reasoning Default');
s = rep1(s, R0_SELECT_ANCHOR, R0_SELECT_NEW, 'Reasoning Select');
s = rep1(s, R0_MAXOPT_ANCHOR, R0_MAXOPT_NEW, 'Reasoning xhigh-Option');
s = rep1(s, R0_DE_OLD, R0_DE_NEW, 'Reasoning I18N de');
s = rep1(s, R0_EN_OLD, R0_EN_NEW, 'Reasoning I18N en');
s = rep1(s, R0_ES_OLD, R0_ES_NEW, 'Reasoning I18N es');
console.log('  R0: Reasoning max/xhigh mit Leitplanken (400-Fallback bleibt)');

// ---------- T0: 2D-Auto-Erkennung + 2D-Vertrag + Modus-Diagnose ----------
s = rep1(s, FREEPROMPT_HEAD, T0_METHODS + FREEPROMPT_BRANCH, '2D-Verzweigung');
s = rep1(s, GEN_OK_OLD, GEN_OK_NEW, 'Gen-Status Modus');
s = rep1(s, MOD_OK_OLD, MOD_OK_NEW, 'Mod-Status Modus');
s = rep1(s, DIAG_RT_OLD, DIAG_RT_NEW, 'Diag Modus-Variable');
s = rep1(s, DIAG_MODE_OLD, DIAG_MODE_NEW, 'Diag Modus-Zeile');
console.log('  T0: 2D-Auto (diagramKind + 2D-Vertrag) + Modus in Status/Diagnose');

// ---------- B0: Build-Stempel v26 ----------
s = rep1(s, 'bits.push("Build v25")', 'bits.push("Build v26")', 'Diagnose-Stempel');
s = rep1(s, 'var bld="v25";try{bld=this.buildTag();}', 'var bld="v26";try{bld=this.buildTag();}', 'Diagnose-Default');
s = rep1(s, 'buildTag:function(){return "v25";},', 'buildTag:function(){return "v26";},', 'buildTag');
s = rep1(s, 'var mine=25;', 'var mine=26;', 'staleHint-mine');
s = rep1(s, ',10)||25;', ',10)||26;', 'staleHint-fallback');

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v25 (Fence-Pflicht + tolerante Extraktion + Guard-nur-Code, via scripts/build-standalone-v25.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v26 (E0 Erklaerungen-Prompt + D0 Disclaimer-raus + M0 tolerante Parts + T0 2D-Auto + R0 Reasoning + B0 Stempel, via scripts/build-standalone-v26.mjs) -->');
  console.log('  Stempel: v26');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v26: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v26: OK v26 (E0+D0+M0+T0+R0+B0)');
