/**
 * Standalone builder v17 (Provider-Umschalter, GitHub-Pages-faehig):
 * Baut auf dem v16-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * P1  'Baseten (direkt)' ueberall zu 'Baseten' umbenennen (de/en/es
 *     providerFixed-Keys + genProviders-Label; keine Logik geaendert).
 * P2  Provider-Auswahl beim Modellerstellen (oben): <select id="gen-provider">
 *     mit genau 2 Optionen — Baseten (Basis https://inference.baseten.co/v1,
 *     Modell meta-models/muse-spark-open-1026) + Meta/Muse (Basis
 *     https://api.meta.ai/v1, Modelle muse-spark-1.3-contributor [Default],
 *     muse-spark-1.3, muse-wonder-1.0). Alter Baseten-Pfad (Basis + Modell +
 *     Direkt-URL-Fallback) bleibt unangetastet.
 * P3  Keyfeld-BYOK je ausgewaehltem Provider: getrennte sessionStorage-Keys
 *     (modelmuse-key-baseten-direct / modelmuse-key-meta-muse, Legacy
 *     modelmuse-proxy-key wird fuer Baseten als Fallback gelesen),
 *     In-Memory-Cache je Provider beim Umschalten, Key-Format-Hinweis
 *     LLM_... nur bei meta-muse (Placeholder + keyFormatMeta-Zeile),
 *     keine Keys in Logs/Reports (nur sessionStorage).
 * P4  Direktaufruf ohne Proxy fuer beide (fetch mit Bearer, Streaming-SSE
 *     bevorzugt, Timeout 120 s): Chat-Completions-Body nur mit
 *     model/stream/messages/temperature/max_completion_tokens; verboten
 *     sind stop/n>1/logprobs/logit_bias/modalities/audio/web_search_options/
 *     max_output_tokens — und reasoning_effort ausserhalb der P5-Regel.
 * P5  reasoning_effort max nur bei 1.3/wonder anbieten (Reasoning-Select,
 *     deaktiviert sonst), nie bei -contributor (Guard in generate+modify
 *     UND Reset bei Modell-/Providerwechsel).
 * P6  Fehlertexte je Provider: 401-Key-Hinweis mit Dashboard-Link dev.meta.ai
 *     nur bei meta-muse (keyMissingMeta/keyInvalidMeta de/en/es),
 *     Baseten-Texte unveraendert.
 *
 * Aufruf: node scripts/build-standalone-v17.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v17-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v17: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig');
  return s.replace(oldStr, newStr);
}

// ---------- G0: Standalone-Guard (strip+mask, top/parent praezise) ----------
// Der alte Rohtext-Wortcheck (\btop\b auf unbereinigtem Code) warf schon
// 'const top = 2.44' (Torlatte) oder '// top edge'. Wie
// src/runtime/guard-static.js werden Kommentare/Strings ausgeblendet;
// 'top'/'parent' sind nur noch als Frame-Flucht (window.top, top.document,
// top.postMessage, top[..], ungedehnter Global-Read) verboten. window,
// document, eval & Co. bleiben strikte \b-Verbote. Idempotent via Marker.
const GUARD_MARK = '__FREE_GUARD_V18__';
const GUARD_OLD = 'var words=["document","window","parent","top","fetch","eval","Function","navigator","localStorage","sessionStorage","indexedDB","sendBeacon","WebSocket","XMLHttpRequest","THREE"];for(var wi=0;wi<words.length;wi++){var w=words[wi];var wr=new RegExp("\\\\b"+w+"\\\\b");if(wr.test(code)){throw new Error("E-FREE-FORBID: "+w);}}';
const GUARD_NEW = String.raw`/*__FREE_GUARD_V18__ strip+mask, top/parent member-only*/var clean=code;var BT=String.fromCharCode(96),DL=String.fromCharCode(36,123);try{var __so="",__si=0,__sn=clean.length,__sq=null;while(__si<__sn){var __sc=clean.charAt(__si);var __sd=clean.charAt(__si+1);if(__sq){__so+=__sc;if(__sc==="\\"){__so+=__sd||"";__si+=2;continue;}if(__sc===__sq){__sq=null;}__si+=1;continue;}if(__sc==='"'||__sc==="'"||__sc===BT){__sq=__sc;__so+=__sc;__si+=1;continue;}if(__sc==="/"&&__sd==="/"){while(__si<__sn&&clean.charAt(__si)!=="\n"){__so+=" ";__si+=1;}continue;}if(__sc==="/"&&__sd==="*"){__so+="  ";__si+=2;while(__si<__sn&&!(clean.charAt(__si)==="*"&&clean.charAt(__si+1)==="/")){__so+=clean.charAt(__si)==="\n"?"\n":" ";__si+=1;}__so+="  ";__si+=2;continue;}__so+=__sc;__si+=1;}clean=__so;}catch(__se){}try{var __mo="",__mi=0,__mn=clean.length,__mq=null,__md=0;while(__mi<__mn){var __mc=clean.charAt(__mi);if(__mq){if(__mc==="\\"){__mo+="  ";__mi+=2;continue;}if(__md===0&&__mc===__mq){__mo+=" ";__mq=null;__mi+=1;continue;}if(__mc==="$"&&clean.charAt(__mi+1)==="{"&&__mq===BT){__md+=1;__mo+=DL;__mi+=2;continue;}if(__md>0){if(__mc==="{"){__md+=1;}if(__mc==="}"){__md-=1;}__mo+=__mc;__mi+=1;continue;}__mo+=__mc==="\n"?"\n":" ";__mi+=1;continue;}if(__mc==='"'||__mc==="'"||__mc===BT){if(__mc===BT){__mq=BT;__md=0;}else{__mq=__mc;}__mo+=" ";__mi+=1;continue;}__mo+=__mc;__mi+=1;}clean=__mo;}catch(__me){}var words=["document","window","fetch","eval","Function","navigator","localStorage","sessionStorage","indexedDB","sendBeacon","WebSocket","XMLHttpRequest","THREE"];for(var wi=0;wi<words.length;wi++){var w=words[wi];var wr=new RegExp("\\b"+w+"\\b");if(wr.test(clean)){throw new Error("E-FREE-FORBID: "+w);}}var __dc=function(__dn){if(new RegExp("(?:^|[^.\\w$])(?:var|let|const)\\s+"+__dn+"\\b").test(clean)){return true;}if(new RegExp("function\\s+"+__dn+"\\b").test(clean)){return true;}if(new RegExp("class\\s+"+__dn+"\\b").test(clean)){return true;}if(new RegExp("(?:var|let|const)\\s*\\{[^}]*\\b"+__dn+"\\b").test(clean)){return true;}if(new RegExp("(?:var|let|const)\\s*\\[[^\\]]*\\b"+__dn+"\\b").test(clean)){return true;}if(new RegExp("catch\\s*\\(\\s*"+__dn+"\\b").test(clean)){return true;}if(new RegExp("function\\s*\\([^)]*\\b"+__dn+"\\b").test(clean)){return true;}if(new RegExp("\\([^()]*\\b"+__dn+"\\b[^()]*\\)\\s*=>").test(clean)){return true;}if(new RegExp("[^\\w$]"+__dn+"\\s*=>").test(clean)){return true;}return false;};var __tn=["top","parent"];for(var __ti=0;__ti<__tn.length;__ti++){var __t2=__tn[__ti];if(__dc(__t2)){continue;}if(new RegExp("(?:\\bwindow|\\bself|\\bglobalThis|\\bframes?|\\bframe|\\bcontentWindow)\\s*\\.\\s*"+__t2+"\\b").test(clean)){throw new Error("E-FREE-FORBID: "+__t2);}if(new RegExp("\\b"+__t2+"\\s*\\.\\s*(?:document|window|location|frames?|postMessage|top|parent|self|opener|close|length|name)\\b").test(clean)){throw new Error("E-FREE-FORBID: "+__t2);}if(new RegExp("\\b"+__t2+"\\s*\\[").test(clean)){throw new Error("E-FREE-FORBID: "+__t2);}var __tr=new RegExp("\\b"+__t2+"\\b","g");var __tm;while((__tm=__tr.exec(clean))!==null){if(clean.charAt(__tm.index-1)!=="."){throw new Error("E-FREE-FORBID: "+__t2);}}}`;
function applyGuardFix(s) {
  if (s.includes(GUARD_MARK)) return { s, changed: false };
  must((s.split(GUARD_OLD).length - 1) === 1, 'G Guard-Anker fehlt/mehrdeutig');
  return { s: s.replace(GUARD_OLD, GUARD_NEW), changed: true };
}

// ---------- W0: Owner-Liste (W1..W11), idempotent auf v16/v17 ----------
function applyOwnerFixes(s) {
  let changed = false;
  const rep = (oldStr, newStr, label) => {
    if (newStr && s.includes(newStr)) return;
    const n = s.split(oldStr).length - 1;
    if (n === 0) return;
    must(n === 1, label + ': Anker fehlt/mehrdeutig x' + n);
    s = s.split(oldStr).join(newStr);
    changed = true;
    console.log('  ' + label);
  };
  // W1 Loesch-Confirm ohne 'eigene' (gilt fuer alle Modelle)
  rep(`I18N.de.deleteConfirm="Dieses eigene Modell wirklich löschen?";`, `I18N.de.deleteConfirm="Dieses Modell wirklich löschen?";`, 'W1 Confirm de');
  rep(`I18N.en.deleteConfirm="Really delete this custom model?";`, `I18N.en.deleteConfirm="Really delete this model?";`, 'W1 Confirm en');
  rep(`deleteConfirm:"¿Eliminar este modelo propio?"`, `deleteConfirm:"¿Eliminar este modelo?"`, 'W1 Confirm es');
  // W2 Labels-/Masse-Toggles nur im Overlay-Menue (Dopplung ueber Viewer raus)
  rep(`{{t('is3dReason')}}</p>\n<label class="inline-flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" v-model="showLabels" @change="toggleAnno" class="w-5 h-5"> {{t('showLabels')}}</label>\n<label class="inline-flex items-center gap-2 text-sm min-h-[44px]"><input type="checkbox" v-model="showMeasures" @change="toggleAnno" class="w-5 h-5"> {{t('showMeasures')}}</label>\n</div>\n<div class="relative">\n<div id="viewport"`, `{{t('is3dReason')}}</p>\n</div>\n<div class="relative">\n<div id="viewport"`, 'W2 Viewer-Toggles raus (Overlay bleibt)');
  // W3 unteren Block mit Modellnamen entfernen
  rep(`<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<h2 class="text-2xl font-bold mb-3">{{activeLab.title[lang]}}</h2>\n</section>\n`, '', 'W3 Titel-Block unten raus');
  // W4 WebGL-/2D-Fallback-Hinweis unter Viewer entfernen (Logik bleibt)
  rep(`<p v-if="viewerMode==='2d'" class="mt-2 text-sm text-amber-600 dark:text-amber-400">{{t('webglFallback')}}</p>\n<p v-if="viewerMode==='2d'" class="mt-2 text-sm text-amber-600 dark:text-amber-400">{{t('diagramNote')}}</p>\n`, '', 'W4 Fallback-Hinweise raus');
  // W5 Generatortext neu (Provider/Key/Modell statt Objekt/3D/Baseten-Direkt)
  rep(`generatorHint:"Beschreibe ein Objekt und erzeuge ein neues 3D-Modell (Baseten-Direkt, Key nur Sitzung)."`, `generatorHint:"Wähle Provider und Modell, trage deinen Key ein und erzeuge ein neues Modell."`, 'W5 GeneratorHint de');
  rep(`generatorHint:"Describe an object and create a new 3D model (Baseten direct, key session-only)."`, `generatorHint:"Choose provider and model, enter your key and create a new model."`, 'W5 GeneratorHint en');
  rep(`generatorHint:"Describe un objeto y crea un nuevo modelo con Baseten (clave propia, directo en el navegador)."`, `generatorHint:"Elige proveedor y modelo, introduce tu clave y crea un nuevo modelo."`, 'W5 GeneratorHint es');
  // W6 Detailblock mit POST-Befehl entfernen (Template + Computeds)
  rep(`<details class="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">\n<summary class="cursor-pointer text-sm font-medium min-h-[44px] flex items-center">{{t('genDetails')}}</summary>\n<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genDetailsMsg}}</p>\n</details>\n`, '', 'W6 POST-Detailblock raus');
  {
    const a6 = 'genDetailsMsg:function(){';
    if (s.includes(a6)) {
      const st6 = s.indexOf(a6);
      const en6 = s.indexOf('keyMissingMsg:function(){', st6);
      must(st6 > 0 && en6 > st6, 'W6 genDetailsMsg-Grenzen');
      must(s.slice(st6, en6).trimEnd().endsWith('},'), 'W6 genDetailsMsg-Ende');
      s = s.slice(0, st6) + s.slice(en6);
      changed = true;
      console.log('  W6: genDetailsMsg-Computed entfernt');
    }
  }
  {
    const a6k = 'keyStore:function(){';
    if (s.includes(a6k)) {
      const st6k = s.indexOf(a6k);
      const en6k = s.indexOf('genKeyPlaceholder:function(){', st6k);
      must(st6k > 0 && en6k > st6k, 'W6 keyStore-Grenzen');
      must(s.slice(st6k, en6k).trimEnd().endsWith('},'), 'W6 keyStore-Ende');
      s = s.slice(0, st6k) + s.slice(en6k);
      changed = true;
      console.log('  W6: keyStore-Computed entfernt');
    }
  }
  // W7 Versionspill aus Menueleiste entfernen (Titel/I18N bleiben)
  rep(`<span class="text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{{t('viewerBadge')}}</span>\n`, '', 'W7 Versionspill raus');
  // W8 Key-Persistenz: Checkbox aus = dauerhaft localStorage (+Feedback+Prefill)
  rep(`loadKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{var v=sessionStorage.getItem(k);if(typeof v==="string"&&v.length>=8){return v;}}catch(e){}if(id!=="meta-muse"){try{var w=sessionStorage.getItem("modelmuse-proxy-key");if(typeof w==="string"&&w.length>=8){return w;}}catch(e2){}}return null;},`, `loadKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{var v=sessionStorage.getItem(k);if(typeof v==="string"&&v.length>=8){return v;}}catch(e){}if(id!=="meta-muse"){try{var w=sessionStorage.getItem("modelmuse-proxy-key");if(typeof w==="string"&&w.length>=8){return w;}}catch(e2){}}try{var lp=JSON.parse(localStorage.getItem("modelmuse.keys")||"{}");var lv=lp[id];if(typeof lv==="string"&&lv.length>=8){return lv;}}catch(e3){}return null;},keyLocation:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{var v=sessionStorage.getItem(k);if(typeof v==="string"&&v.length>=8){return "session";}}catch(e){}try{var lp2=JSON.parse(localStorage.getItem("modelmuse.keys")||"{}");if(typeof lp2[id]==="string"&&lp2[id].length>=8){return "local";}}catch(e2){}return null;},`, 'W8 loadKeyFor+keyLocation (session+local)');
  rep(`saveKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{if(this.genConsent&&this.genKey){sessionStorage.setItem(k,this.genKey);}else{sessionStorage.removeItem(k);}}catch(e){}},`, `saveKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{if(this.genConsent&&this.genKey){sessionStorage.setItem(k,this.genKey);try{var lp=JSON.parse(localStorage.getItem("modelmuse.keys")||"{}");if(lp&&lp[id]){delete lp[id];localStorage.setItem("modelmuse.keys",JSON.stringify(lp));}}catch(eL){}}else if(!this.genConsent&&this.genKey){try{var lp2=JSON.parse(localStorage.getItem("modelmuse.keys")||"{}");lp2[id]=this.genKey;localStorage.setItem("modelmuse.keys",JSON.stringify(lp2));}catch(eL2){}try{sessionStorage.removeItem(k);}catch(eS){}}else{try{sessionStorage.removeItem(k);}catch(eS2){}try{var lp3=JSON.parse(localStorage.getItem("modelmuse.keys")||"{}");if(lp3&&lp3[id]){delete lp3[id];localStorage.setItem("modelmuse.keys",JSON.stringify(lp3));}}catch(eL3){}}}catch(e){}},`, 'W8 saveKeyFor je Checkbox (session/local)');
  rep(`try{var sk=this.loadKeyFor(this.genProvider);if(sk){this.genKey=sk;}}catch(eSK2){}`, `try{var sk=this.loadKeyFor(this.genProvider);if(sk){this.genKey=sk;try{var wl=this.keyLocation(this.genProvider);if(wl){this.genConsent=(wl==="session");}}catch(eWL){}}}catch(eSK2){}`, 'W8 Prefill+Consent mounted');
  rep(`try{var k=this.loadKeyFor(this.genProvider);if(k&&!this.genKey){this.genKey=k;}}catch(e2){}`, `try{var k=this.loadKeyFor(this.genProvider);if(k&&!this.genKey){this.genKey=k;try{var wl2=this.keyLocation(this.genProvider);if(wl2){this.genConsent=(wl2==="session");}}catch(eWL2){}}}catch(e2){}`, 'W8 Prefill+Consent openModify');
if (!s.includes('keyStoreMsg:function'))   rep(`directHintMsg:function(){return this.genProvider==="meta-muse"?this.t('directHintMeta'):this.t('directHint');},`, `directHintMsg:function(){return this.genProvider==="meta-muse"?this.t('directHintMeta'):this.t('directHint');},\nkeyStoreMsg:function(){return this.genConsent?this.t('keyStoredSession'):this.t('keyStoredLocal');},`, 'W8 keyStoreMsg-Computed');
if (!s.includes('{{keyStoreMsg}}'))   rep(`{{directHintMsg}}</p>\n</div>`, `{{directHintMsg}}</p>\n<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{keyStoreMsg}}</p>\n</div>`, 'W8 Feedback-Zeile (Speicherort)');
  rep(`I18N.de.keyMissing="Baseten-Key fehlt. Fuege oben deinen Key ein.";`, `I18N.de.keyMissing="Baseten-Key fehlt. Fuege oben deinen Key ein.";I18N.de.keyStoredSession="Key nur fuer diese Sitzung gespeichert (sessionStorage).";I18N.de.keyStoredLocal="Key dauerhaft gespeichert (localStorage).";`, 'W8 I18N de');
  rep(`I18N.en.keyMissing="Baseten key missing. Paste your key above.";`, `I18N.en.keyMissing="Baseten key missing. Paste your key above.";I18N.en.keyStoredSession="Key stored for this session only (sessionStorage).";I18N.en.keyStoredLocal="Key stored permanently (localStorage).";`, 'W8 I18N en');
  rep(`keyMissing:"Falta la clave Baseten. Pega tu clave arriba.",`, `keyMissing:"Falta la clave Baseten. Pega tu clave arriba.",keyStoredSession:"Clave guardada solo para esta sesion (sessionStorage).",keyStoredLocal:"Clave guardada permanente (localStorage).",`, 'W8 I18N es');
  // W9 Loeschungen (kuratiert + free-*) in localStorage persistieren
  rep(`data(){return{labs:LABS,activeLabId:null`, `data(){return{labs:(function(){try{var __dd=JSON.parse(localStorage.getItem("modelmuse.deleted")||"[]");if(Object.prototype.toString.call(__dd)!=="[object Array]"||!__dd.length){return LABS.slice();}return LABS.filter(function(__l){return __dd.indexOf(__l.id)<0;});}catch(__e){try{return LABS.slice();}catch(__e2){return LABS;}}})(),activeLabId:null`, 'W9 Boot-Filter (deleted)');
  rep(`if(at>=0){this.labs.splice(at,1);}try{localStorage.removeItem("modelmuse.free."+id);}catch(e2){}`, `if(at>=0){this.labs.splice(at,1);}try{localStorage.removeItem("modelmuse.free."+id);}catch(e2){}try{var __dl=[];try{__dl=JSON.parse(localStorage.getItem("modelmuse.deleted")||"[]");}catch(__eD){__dl=[];}if(Object.prototype.toString.call(__dl)!=="[object Array]"){__dl=[];}if(__dl.indexOf(id)<0){__dl.push(id);}localStorage.setItem("modelmuse.deleted",JSON.stringify(__dl));}catch(__eD2){}`, 'W9 deleteLab persistiert ID');
  rep(`try{var raw=localStorage.getItem(k);var o=JSON.parse(raw);if(!o||!o.id){continue;}`, `try{var raw=localStorage.getItem(k);var o=JSON.parse(raw);if(!o||!o.id){continue;}try{var __dd2=JSON.parse(localStorage.getItem("modelmuse.deleted")||"[]");if(Object.prototype.toString.call(__dd2)==="[object Array]"&&__dd2.indexOf(o.id)>=0){continue;}}catch(__eDD0){}`, 'W9 restoreFree ueberspringt deleted');
  // W10 Leerzustand ohne Suche (eigener Text statt noResults)
  rep(`<p class="text-slate-500 dark:text-slate-400">{{t('noResults')}}</p>\n<button type="button" @click="search=''"`, `<p class="text-slate-500 dark:text-slate-400">{{search?t('noResults'):t('emptyLibrary')}}</p>\n<button v-if="search" type="button" @click="search=''"`, 'W10 Leerzustand konditional');
  rep(`,viewportTitle:"3D-Ansicht",`, `,emptyLibrary:"Keine Modelle gespeichert, nutze den Generator.",viewportTitle:"3D-Ansicht",`, 'W10 I18N de');
  rep(`,viewportTitle:"3D viewport",`, `,emptyLibrary:"No models saved, use the generator.",viewportTitle:"3D viewport",`, 'W10 I18N en');
  rep(`,viewportTitle:"Vista",`, `,emptyLibrary:"No hay modelos guardados, usa el generador.",viewportTitle:"Vista",`, 'W10 I18N es');
  // W11 Button 'Beispiel laden' neben Generieren entfernen
  rep(`<button @click="selectLab('free-handbohrmaschine')" type="button" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-4 min-h-[44px] min-w-[44px] text-sm font-semibold">{{t('exampleLoad')}}</button>\n`, '', 'W11 Beispiel-Button raus');
  return { s, changed };
}

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1], ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['Baseten (direkt)', 0], ['Baseten (direct)', 0], ['Baseten (directo)', 0],
    ['I18N.de.providerFixed="Baseten";', 1], ['I18N.en.providerFixed="Baseten";', 1], ['providerFixed:"Baseten"', 1],
    ["{{t('providerFixed')}}", 0],
    ['id="gen-provider"', 1], ['id="gen-reasoning"', 1], ['id:"baseten-direct"', 1], ['id:"meta-muse"', 1],
    ['label:"Baseten"', 1], ['label:"Meta Muse"', 1],
    ['models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]', 1],
    ['https://api.meta.ai/v1', 1], ['https://api.meta.ai/v1/chat/completions', 0],
    ['https://inference.baseten.co/v1/chat/completions', 1],
    ['meta-models/muse-spark-open-1026', 2],
    ['modelmuse-key-baseten-direct', 3], ['modelmuse-key-meta-muse', 3], ['modelmuse-proxy-key', 1],
    ['text/event-stream', 3], ['stream:true', 3],
    // v19-Nachfolger (Budget+Retry): max_completion_tokens 2->4 (exakt in v19).
    ['max_output_tokens', 0],
    // v21-Nachfolger (Thinking-Reduktion): reasoning_effort 2->4 (exakt in v21).
    ['logit_bias', 0], ['web_search_options', 0], ['"stop"', 0], ['modalities', 0], ['logprobs', 0],
    ['dev.meta.ai', 10], ['LLM_...', 10],
    ['keyMissingMeta', 4], ['keyInvalidMeta', 4], ['keyFormatMeta', 4], ['directHintMeta', 4],
    ['reasoningLabel', 4], ['reasoningStd', 4], ['reasoningMax', 4],
    ['genProviderChanged', 2], ['genModelChanged', 2], ['reasoningAllowed', 5],
    ['aria-label="modify"', 0], ['id="mod-desc"', 0], ['@click="modify"', 0],
    ['id="mod-desc2"', 1], ['@click="openModify', 1], ['modify:async function', 1], ['submitModify:function', 1], ['closeModify:function', 1],
    ['deleteLab', 6], ['deleteConfirm', 4],
    ['v-if="showOnboarding"', 1], ['id="gen-status"', 1], ['showcase: 5 Modelle', 1],
    ['__FREE_GUARD_V18__', 1],
    ['emptyLibrary', 4],
    ['modelmuse.deleted', 4],
    ['modelmuse.keys', 8],
    ['keyStoredSession', 4],
    ['keyStoredLocal', 4],
    ['keyStoreMsg', 2],
    ['{{genDetailsMsg}}', 0],
    ["{{t('viewerBadge')}}", 0],
    ["{{t('exampleLoad')}}", 0],
    ['exampleLoad', 3],
    ["{{t('webglFallback')}}</p>", 0],
    ["{{t('diagramNote')}}</p>", 0],
    ['keyStore:function', 0],
    ['genDetailsMsg:function', 0],
    ['Dieses eigene Modell', 0],
    ['delete this custom model', 0],
    ['modelo propio', 0],
    ['Baseten-Direkt', 1],
    ['Meta-Direkt', 0],
    ['Baseten direct', 0],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // v19-Toleranz: Budget+Retry erhoeht auf 4 (pre-v19: 2).
  // v23-Toleranz: kein Length-Limit (nur noch Echo-Label 'req_max_completion_tokens: ').
  must(cnt(s, 'max_completion_tokens') === 2 || cnt(s, 'max_completion_tokens') === 4 || (s.includes('standalone-build v23') && cnt(s, 'max_completion_tokens') === 1), 'Invariante max_completion_tokens: ' + cnt(s, 'max_completion_tokens') + ', erwartet 2 oder 4 (v23: 1)');
  // v21-Toleranz: Thinking-Reduktion (pre-v21: 2 | v21: 4).
  // v23-Toleranz: Request-Echo-Snapshots + Echo-Labels (2 + 2 + 4 + 2 = 10).
  must(cnt(s, 'reasoning_effort') === 2 || cnt(s, 'reasoning_effort') === 4 || (s.includes('standalone-build v23') && cnt(s, 'reasoning_effort') === 10), 'Invariante reasoning_effort: ' + cnt(s, 'reasoning_effort') + ', erwartet 2 oder 4 (v23: 10)');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (Provider-Umschalter, Streaming, Keys je Provider)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v17: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v16-universelles-loeschen',
    standalone: 'v17',
    fixes: ['P1 Baseten-Label ohne (direkt)', 'P2 Provider-Select Baseten + Meta/Muse (3 Modelle)', 'P3 BYOK-Keys je Provider (sessionStorage getrennt)', 'P4 Direkt-Call Streaming-SSE ohne verbotene Felder', 'P5 reasoning_effort max nur 1.3/wonder', 'P6 401-Texte je Provider (dev.meta.ai nur Meta)'],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v17: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v16'), 'kein v16-Stempel (falsche Basis)');
if (s.includes('standalone-build v17')) {
  console.log('build-v17: bereits v17 — prüfe Migrationen ...');
  let changed17 = false;
  const g17 = applyGuardFix(s);
  if (g17.changed) { s = g17.s; changed17 = true; console.log('  G: Guard gehärtet (strip+mask, top/parent präzise)'); }
  const w17 = applyOwnerFixes(s);
  if (w17.changed) { s = w17.s; changed17 = true; }
  checkInvariants(s);
  if (!changed17) {
    console.log('build-v17: bereits v17 — nichts zu tun (idempotent, exit 0)');
    process.exit(0);
  }
  await writeFile(FILE, s);
  console.log(`build-v17: migriert + geschrieben (${s.length} Zeichen)`);
  await writeReport(s);
  console.log('build-v17: OK v17 (Guard+Owner migriert)');
  process.exit(0);
}

// ---------- P1: Rename 'Baseten (direkt)' -> 'Baseten' (Labels only) ----------
s = rep1(s, 'I18N.de.providerFixed="Baseten (direkt)";', 'I18N.de.providerFixed="Baseten";', 'P1 de');
s = rep1(s, 'I18N.en.providerFixed="Baseten (direct)";', 'I18N.en.providerFixed="Baseten";', 'P1 en');
s = rep1(s, 'providerFixed:"Baseten (directo)"', 'providerFixed:"Baseten",reasoningLabel:"Razonamiento",reasoningStd:"Est\\u00e1ndar",reasoningMax:"M\\u00e1x (solo 1.3/wonder)"', 'P1 es');
console.log('  P1: Baseten-Label ohne (direkt) (de/en/es)');

// ---------- P2/I18N: neue Keys de/en ----------
s = rep1(s, 'I18N.de.keyMissing="Baseten-Key fehlt. Fuege oben deinen Key ein.";', 'I18N.de.keyMissing="Baseten-Key fehlt. Fuege oben deinen Key ein.";I18N.de.keyMissingMeta="Meta-Key (LLM_...) fehlt. Fuege oben deinen Key ein (dev.meta.ai).";', 'P6 de missing');
s = rep1(s, 'I18N.en.keyMissing="Baseten key missing. Paste your key above.";', 'I18N.en.keyMissing="Baseten key missing. Paste your key above.";I18N.en.keyMissingMeta="Meta key (LLM_...) missing. Paste your key above (dev.meta.ai).";', 'P6 en missing');
s = rep1(s, 'I18N.de.keyInvalid="Key falsch (401). Pruefe deinen Baseten-Key.";', 'I18N.de.keyInvalid="Key falsch (401). Pruefe deinen Baseten-Key.";I18N.de.keyInvalidMeta="Key falsch (401). Pruefe deinen Meta-Key (LLM_... von dev.meta.ai).";', 'P6 de invalid');
s = rep1(s, 'I18N.en.keyInvalid="Wrong key (401). Check your Baseten key.";', 'I18N.en.keyInvalid="Wrong key (401). Check your Baseten key.";I18N.en.keyInvalidMeta="Wrong key (401). Check your Meta key (LLM_... from dev.meta.ai).";', 'P6 en invalid');
s = rep1(s, 'keyMissing:"Falta la clave Baseten. Pega tu clave arriba.",keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave Baseten.",', 'keyMissing:"Falta la clave Baseten. Pega tu clave arriba.",keyMissingMeta:"Falta la clave Meta (LLM_...). Pega tu clave arriba (dev.meta.ai).",keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave Baseten.",keyInvalidMeta:"Clave inv\\u00e1lida (401). Comprueba tu clave Meta (LLM_... de dev.meta.ai).",', 'P6 es keys');
s = rep1(s, 'I18N.de.directHint="Direktaufruf Baseten in deinem Browser (OpenAI-kompatibel). Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";', 'I18N.de.directHint="Direktaufruf Baseten in deinem Browser (OpenAI-kompatibel). Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";I18N.de.directHintMeta="Direktaufruf Meta Muse in deinem Browser (OpenAI-kompatibel). Kein Proxy. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";I18N.de.keyFormatMeta="Meta-Key beginnt mit LLM_... (Dashboard: dev.meta.ai).";', 'P6 de hint');
s = rep1(s, 'I18N.en.directHint="Direct Baseten call in your browser (OpenAI-compatible). No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.";', 'I18N.en.directHint="Direct Baseten call in your browser (OpenAI-compatible). No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.";I18N.en.directHintMeta="Direct Meta Muse call in your browser (OpenAI-compatible). No proxy. Your key lives only in sessionStorage with your consent.";I18N.en.keyFormatMeta="Meta keys start with LLM_... (Dashboard: dev.meta.ai).";', 'P6 en hint');
s = rep1(s, 'directHint:"Llamada directa a Baseten en tu navegador (compatible con OpenAI). Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso.",', 'directHint:"Llamada directa a Baseten en tu navegador (compatible con OpenAI). Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso.",directHintMeta:"Llamada directa a Meta Muse en tu navegador (compatible con OpenAI). Sin proxy. Tu clave solo vive en sessionStorage con tu permiso.",keyFormatMeta:"La clave Meta empieza por LLM_... (Panel: dev.meta.ai).",', 'P6 es hint');
s = rep1(s, 'I18N.de.mappingNote="Bauteil-Zuordnung";', 'I18N.de.mappingNote="Bauteil-Zuordnung";I18N.de.reasoningLabel="Denktiefe";I18N.de.reasoningStd="Standard";I18N.de.reasoningMax="Max (nur 1.3/wonder)";', 'P5 de reasoning');
s = rep1(s, 'I18N.en.mappingNote="Part mapping";', 'I18N.en.mappingNote="Part mapping";I18N.en.reasoningLabel="Reasoning";I18N.en.reasoningStd="Standard";I18N.en.reasoningMax="Max (1.3/wonder only)";', 'P5 en reasoning');
console.log('  P5/P6: I18N-Keys Meta/Reasoning (de/en/es)');

// ---------- P2/Template: Provider-Select + Reasoning-Select + dynamische Texte ----------
s = rep1(s, '<span class="inline-flex items-center px-3 min-h-[44px] rounded-xl bg-slate-200 dark:bg-slate-800 text-sm font-semibold">{{t(\'providerFixed\')}}</span>\n<select id="gen-model" v-model="genModel" class=', '<select id="gen-provider" v-model="genProvider" @change="genProviderChanged" class="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm">\n<option v-for="p in genProviders" :key="p.id" :value="p.id">{{p.label}}</option>\n</select>\n<select id="gen-model" v-model="genModel" @change="genModelChanged" class=', 'P2 provider-select');
s = rep1(s, '<option v-for="m in genModels" :key="m" :value="m">{{m}}</option>\n</select>\n<button @click="generate"', '<option v-for="m in genModels" :key="m" :value="m">{{m}}</option>\n</select>\n<select id="gen-reasoning" v-model="genReasoning" :disabled="!reasoningAllowed" :title="t(\'reasoningLabel\')" class="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm">\n<option value="">{{t(\'reasoningStd\')}}</option>\n<option value="max" :disabled="!reasoningAllowed">{{t(\'reasoningMax\')}}</option>\n</select>\n<button @click="generate"', 'P5 reasoning-select');
s = rep1(s, '<input id="gen-key" v-model="genKey" type="password" autocomplete="off" placeholder="Baseten-API-Key"', '<input id="gen-key" v-model="genKey" @input="cacheGenKey" type="password" autocomplete="off" :placeholder="genKeyPlaceholder"', 'P3 key-input');
s = rep1(s, '{{t(\'keyConsent\')}}</label>\n<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'directHint\')}}</p>', '{{t(\'keyConsent\')}}</label>\n<p v-if="genProvider===\'meta-muse\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatMeta\')}}</p>\n<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{directHintMsg}}</p>', 'P3/P6 hint-zeilen');
s = rep1(s, '<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Baseten-Direkt: POST https://inference.baseten.co/v1/chat/completions · Modell meta-models/muse-spark-open-1026 · Timeout 120 s · Key nur sessionStorage (modelmuse-proxy-key).</p>', '<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{genDetailsMsg}}</p>', 'P2 details-zeile');
s = rep1(s, '<p class="text-xs text-slate-500 dark:text-slate-400 mb-2">{{t(\'providerFixed\')}} · {{genModel}}</p>', '<p class="text-xs text-slate-500 dark:text-slate-400 mb-2">{{genProviderLabel}} · {{genModel}}</p>', 'P2 overlay-zeile');
console.log('  P2/P3/P5: Template (Provider-/Reasoning-Select, Key-Hinweis, Details, Overlay)');

// ---------- P2/Data: Provider-Liste + State ----------
s = rep1(s, 'genDesc:"",\ngenProvider:"baseten-direct",\ngenModel:"meta-models/muse-spark-open-1026",\ngenKey:"",\ngenConsent:false,\ngenDirectUrl:"https://inference.baseten.co/v1/chat/completions",', 'genDesc:"",\ngenProvider:"baseten-direct",\nprevProvider:"baseten-direct",\ngenModel:"meta-models/muse-spark-open-1026",\ngenKey:"",\ngenKeyCache:{},\ngenConsent:false,\ngenReasoning:"",', 'P2/P3 data');
s = rep1(s, 'genProviders:[{id:"baseten-direct",label:"Baseten (direkt)",kind:"direct",models:["meta-models/muse-spark-open-1026"]}]', 'genProviders:[{id:"baseten-direct",label:"Baseten",kind:"direct",base:"https://inference.baseten.co/v1",models:["meta-models/muse-spark-open-1026"]},{id:"meta-muse",label:"Meta Muse",kind:"direct",base:"https://api.meta.ai/v1",models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]}]', 'P2 providers');
console.log('  P2/P3: Data (2 Provider, Meta-Modelle, Key-Cache, Reasoning-State)');

// ---------- P2-P5/Computed ----------
s = rep1(s, 'genModels:function(){var ps=this.genProviders||[];for(var i=0;i<ps.length;i++){if(ps[i].id===this.genProvider){return ps[i].models.slice();}}return [];},', 'genModels:function(){var ps=this.genProviders||[];for(var i=0;i<ps.length;i++){if(ps[i].id===this.genProvider){return ps[i].models.slice();}}return [];},\ngenDirectUrl:function(){var ps=this.genProviders||[];for(var i=0;i<ps.length;i++){if(ps[i].id===this.genProvider&&ps[i].base){return ps[i].base+"/chat/completions";}}return "https://inference.baseten.co/v1/chat/completions";},\ngenProviderLabel:function(){var ps=this.genProviders||[];for(var i=0;i<ps.length;i++){if(ps[i].id===this.genProvider){return ps[i].label;}}return this.t(\'providerFixed\');},\nkeyStore:function(){return this.genProvider==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";},\ngenKeyPlaceholder:function(){return this.genProvider==="meta-muse"?"LLM_... (Meta API-Key, dev.meta.ai)":"Baseten-API-Key";},\ndirectHintMsg:function(){return this.genProvider==="meta-muse"?this.t(\'directHintMeta\'):this.t(\'directHint\');},\ngenDetailsMsg:function(){if(this.genProvider==="meta-muse"){return "Meta-Direkt: POST https://api.meta.ai/v1/chat/completions · Modell "+this.genModel+" · Timeout 120 s · Streaming (SSE) · Key nur sessionStorage ("+this.keyStore+")";}return "Baseten-Direkt: POST https://inference.baseten.co/v1/chat/completions · Modell "+this.genModel+" · Timeout 120 s · Streaming (SSE) · Key nur sessionStorage ("+this.keyStore+")";},\nkeyMissingMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyMissingMeta\'):this.t(\'keyMissing\');},\nkeyInvalidMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyInvalidMeta\'):this.t(\'keyInvalid\');},\nreasoningAllowed:function(){return this.genProvider==="meta-muse"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0");},', 'P2-P6 computed');
console.log('  P2-P6: Computed (URL/Label/Keys/Hints/Reasoning-Gate)');

// ---------- P3/P5/Methods: Providerwechsel, Key-Ablage, SSE-Reader ----------
s = rep1(s, 'genProviderChanged:function(){var ms=this.genModels;if(ms&&ms.length){this.genModel=ms[0];}},', 'genProviderChanged:function(){var old=this.prevProvider||"baseten-direct";try{if(this.genKeyCache){this.genKeyCache[old]=this.genKey;}}catch(e0){}var ms=this.genModels;if(ms&&ms.length){this.genModel=ms[0];}if(!this.reasoningAllowed){this.genReasoning="";}var nx=null;try{nx=this.genKeyCache?this.genKeyCache[this.genProvider]:null;}catch(e2){nx=null;}if(!nx){nx=this.loadKeyFor(this.genProvider);}this.genKey=nx||"";this.prevProvider=this.genProvider;},\ngenModelChanged:function(){if(!this.reasoningAllowed){this.genReasoning="";}},\ncacheGenKey:function(){try{if(this.genKeyCache){this.genKeyCache[this.genProvider]=this.genKey;}}catch(e){}},\nloadKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{var v=sessionStorage.getItem(k);if(typeof v==="string"&&v.length>=8){return v;}}catch(e){}if(id!=="meta-muse"){try{var w=sessionStorage.getItem("modelmuse-proxy-key");if(typeof w==="string"&&w.length>=8){return w;}}catch(e2){}}return null;},\nsaveKeyFor:function(id){var k=id==="meta-muse"?"modelmuse-key-meta-muse":"modelmuse-key-baseten-direct";try{if(this.genConsent&&this.genKey){sessionStorage.setItem(k,this.genKey);}else{sessionStorage.removeItem(k);}}catch(e){}},\nreadSseText:function(res){return (async function(){var out="";var reader=res.body.getReader();var dec=new TextDecoder();var buf="";for(;;){var step=await reader.read();if(step.done){break;}buf+=dec.decode(step.value,{stream:true});var lines=buf.split("\\n");buf=lines.pop();for(var i=0;i<lines.length;i++){var ln=lines[i].trim();if(ln.indexOf("data:")!==0){continue;}var pay=ln.slice(5).trim();if(!pay||pay==="[DONE]"){continue;}try{var ev=JSON.parse(pay);var ch=(ev&&ev.choices&&ev.choices[0])||null;var d=(ch&&(ch.delta||ch.message))||null;var c=(d&&typeof d.content==="string")?d.content:((ev&&typeof ev.output_text==="string")?ev.output_text:"");if(c){out+=c;}}catch(pe){out+=pay;}}}var tail=String(buf||"").trim();if(tail.indexOf("data:")===0){var tp=tail.slice(5).trim();if(tp&&tp!=="[DONE]"){try{var tev=JSON.parse(tp);var tch=(tev&&tev.choices&&tev.choices[0])||null;var td=(tch&&(tch.delta||tch.message))||null;if(td&&typeof td.content==="string"){out+=td.content;}}catch(te){out+=tp;}}}return out;})();},\nreadChatText:function(res){var ct="";try{ct=res.headers.get("content-type")||"";}catch(e){ct="";}if(ct.indexOf("text/event-stream")>=0){return this.readSseText(res);}return (async function(){var data=null;try{data=await res.json();}catch(e2){return "";}var t="";try{if(data&&data.choices&&data.choices[0]&&data.choices[0].message&&typeof data.choices[0].message.content==="string"){t=data.choices[0].message.content;}}catch(e3){t="";}return t||"";})();},', 'P3/P4 methoden');
s = rep1(s, 'try{var k=sessionStorage.getItem("modelmuse-proxy-key");if(k&&!this.genKey){this.genKey=k;}}catch(e2){}', 'try{var k=this.loadKeyFor(this.genProvider);if(k&&!this.genKey){this.genKey=k;}}catch(e2){}', 'P3 openModify');
s = rep1(s, 'try{var sk=null;try{sk=sessionStorage.getItem("modelmuse-proxy-key");}catch(eSK){sk=null;}if(sk){this.genKey=sk;}}catch(eSK2){}', 'try{var sk=this.loadKeyFor(this.genProvider);if(sk){this.genKey=sk;}}catch(eSK2){}', 'P3 mounted');
s = rep1(s, 'submitModify:function(){if(!this.genKey){this.modStatus=this.t(\'keyMissing\');', 'submitModify:function(){if(!this.genKey){this.modStatus=this.keyMissingMsg;', 'P6 submitModify');
console.log('  P3/P4: Methoden (Key je Provider, SSE-Reader, Stellen)');

// ---------- P4/P6: generate()/modify() auf Streaming-Direkt-Call ----------
s = rep1(s, 'if(!this.genKey){this.genStatus=this.t(\'keyMissing\');', 'if(!this.genKey){this.genStatus=this.keyMissingMsg;', 'P6 generate-missing');
s = rep1(s, 'try{res=await fetch(\'https://inference.baseten.co/v1/chat/completions\',{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify({model:this.genModel,messages:[{role:"user",content:prompt}],temperature:0.2}),signal:ctrl.signal});}catch(e){', 'var gbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:8000};if(this.genProvider==="meta-muse"&&this.genReasoning==="max"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0")){gbody.reasoning_effort="max";}try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify(gbody),signal:ctrl.signal});}catch(e){', 'P4 generate-fetch');
s = rep1(s, 'if(!res||!res.ok){if(res&&res.status===401){this.genStatus=this.t(\'keyInvalid\');}', 'if(!res||!res.ok){if(res&&res.status===401){this.genStatus=this.keyInvalidMsg;}', 'P6 generate-401');
s = rep1(s, 'try{if(this.genConsent&&this.genKey){try{sessionStorage.setItem("modelmuse-proxy-key",this.genKey);}catch(e){}}else{try{sessionStorage.removeItem("modelmuse-proxy-key");}catch(e){}}}catch(e){}', 'try{this.saveKeyFor(this.genProvider);}catch(e){}', 'P3 generate-persist');
s = rep1(s, 'if(!this.genKey){this.modStatus=this.t(\'keyMissing\');this.modStatusBad=true;return;}var lab=this.activeLab;', 'if(!this.genKey){this.modStatus=this.keyMissingMsg;this.modStatusBad=true;return;}var lab=this.activeLab;', 'P6 modify-missing');
s = rep1(s, 'try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"},body:JSON.stringify({model:this.genModel,messages:[{role:"user",content:prompt}],temperature:0.2}),signal:ctrl.signal});}catch(e){this.modStatus=this.t(\'networkError\');this.modStatusBad=true;return;}finally{if(timer){clearTimeout(timer);}}if(!res||!res.ok){this.modStatus=this.t(\'badSource\')+" ("+(res?res.status:"?")+")";this.modStatusBad=true;return;}', 'var mbody={model:this.genModel,stream:true,messages:[{role:"user",content:prompt}],temperature:0.2,max_completion_tokens:8000};if(this.genProvider==="meta-muse"&&this.genReasoning==="max"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0")){mbody.reasoning_effort="max";}try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify(mbody),signal:ctrl.signal});}catch(e){this.modStatus=this.t(\'networkError\');this.modStatusBad=true;return;}finally{if(timer){clearTimeout(timer);}}if(!res||!res.ok){if(res&&res.status===401){this.modStatus=this.keyInvalidMsg;}else{this.modStatus=this.t(\'badSource\')+" ("+(res?res.status:"?")+")";}this.modStatusBad=true;return;}', 'P4/P6 modify-fetch');
must(cnt(s, 'var data=null;try{data=await res.json();}catch(e){data=null;}var text="";try{if(data&&data.choices&&data.choices[0]&&data.choices[0].message&&typeof data.choices[0].message.content==="string"){text=data.choices[0].message.content;}}catch(e){text="";}') === 2, 'P4 parse-Snippet (generate+modify) fehlt/mehrdeutig');
s = s.split('var data=null;try{data=await res.json();}catch(e){data=null;}var text="";try{if(data&&data.choices&&data.choices[0]&&data.choices[0].message&&typeof data.choices[0].message.content==="string"){text=data.choices[0].message.content;}}catch(e){text="";}').join('var text="";try{text=await this.readChatText(res);}catch(e){text="";}');
console.log('  P4/P6: generate+modify (Streaming, 401 je Provider, Key je Provider)');

// ---------- G+W: Guard haerten + Owner-Liste (idempotent) ----------
{
  const gf = applyGuardFix(s);
  if (gf.changed) console.log('  G: Guard gehärtet (strip+mask, top/parent präzise)');
  else console.log('  G: Guard bereits gehärtet');
  s = gf.s;
  const wf = applyOwnerFixes(s);
  s = wf.s;
}

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v16 (UI-Stromlinien: Modify-Block raus, Loeschen im Overlay, Referenzbericht raus, Details raus, Banner oben, via scripts/build-standalone-v16.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + '\n<!-- standalone-build v17 (Provider-Umschalter: Baseten + Meta/Muse direkt, Streaming-SSE, Keys je Provider, Reasoning nur 1.3/wonder, via scripts/build-standalone-v17.mjs) -->');
  console.log('  Stempel: v17');
}
checkInvariants(s);

await writeFile(FILE, s);
console.log(`build-v17: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v17: OK v17');
