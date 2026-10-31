/**
 * Standalone builder v16 (UI-Stromlinien, GitHub-Pages-faehig):
 * Baut auf dem v15a-Artefakt auf (Stempel vorhanden) und ist idempotent
 * (Zweitlauf meldet "bereits v16", exit 0).
 *
 * U1  Haupt-Block "Modell überarbeiten" aus der Hauptansicht entfernen
 *     (redundant zum Stift-Button je Modell); Edit-Logik (openModify,
 *     modify/submitModify/closeModify, modOverlay, Stift-Buttons) bleibt
 *     unangetastet — nur die Anzeige (aria-label="modify"-Section) faellt weg.
 * U2  Im Modify-Pop-in (modOverlay) je Modell einen Loeschen-Button ergaenzen:
 *     fuer JEDE Lab-ID sichtbar (kein free-*-Gate), mit Rueckfrage
 *     (window.confirm), aktualisiert State (labs-Array, activeLabId, Overlay
 *     zu) + Liste (localStorage-Eintrag modelmuse.free.* entfernen, Liste
 *     rendert reaktiv neu; Leerzustand: activeLab-Fallback + syncViewer).
 *     Neue Methode deleteLab + I18N-Keys de/en/es.
 * U3  Referenzbericht-Block entfernen (Template-Doppelsection + Computed
 *     verifyBadges + verifyTitle-Keys de/en/es); Build-/Verify-Logik sonst
 *     unberuehrt.
 * U4  Details-Block (Messungen/Labels) vollstaendig entfernen (details-Template
 *     + detailsTitle-Keys + measurementsTitle/labelsTitle-Keys de/en/es).
 * U5  Onboarding-Banner ("Willkommen bei ModelMuse! ...", Verstanden-Button)
 *     unter die Menueleiste verschieben (ueber Modell-Liste + 3D-Viewer);
 *     Dismiss-Logik (dismissOnboarding, localStorage, Esc) unveraendert.
 *
 * Aufruf: node scripts/build-standalone-v16.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v16-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v16: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

// Universelles Loeschen (kein free-*-Sonderfall): exakte Alt-/Neu-Texte,
// gemeinsam genutzt von Erstaufbau (U2) und idempotenter v16-Migration.
const DELETE_GATE_OLD = `<div v-if="activeLab.id&&activeLab.id.indexOf('free-')===0" class="mt-2 flex flex-wrap gap-2">`;
const DELETE_GATE_NEW = `<div class="mt-2 flex flex-wrap gap-2">`;
const DELETE_GUARD_OLD = `if(!lab||!lab.id||lab.id.indexOf("free-")!==0){return;}`;
const DELETE_GUARD_NEW = `if(!lab||!lab.id){return;}`;
const DELETE_EMPTY_OLD = `}else{this.activeLabId=null;}},`;
const DELETE_EMPTY_NEW = `}else{this.activeLabId=null;try{this.syncViewer();}catch(e4){}}},`;
const DELETE_METHOD_NEW = `closeModify:function(){this.modOverlay=false;},deleteLab:function(){var lab=this.activeLab;if(!lab||!lab.id){return;}var ok=true;try{ok=window.confirm(this.t('deleteConfirm'));}catch(e){ok=true;}if(!ok){return;}var id=lab.id;var at=-1;for(var i=0;i<this.labs.length;i++){if(this.labs[i].id===id){at=i;break;}}if(at>=0){this.labs.splice(at,1);}try{localStorage.removeItem("modelmuse.free."+id);}catch(e2){}this.modOverlay=false;this.modStatus="";this.modStatusBad=false;var nx=this.labs[0]||null;if(nx){try{this.selectLab(nx.id);}catch(e3){this.activeLabId=nx.id;}}else{this.activeLabId=null;try{this.syncViewer();}catch(e4){}}},`;

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

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1], ['standalone-build v15a', 1], ['standalone-build v16', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['aria-label="modify"', 0], ['id="mod-desc"', 0], ['@click="modify"', 0],
    ['id="mod-desc2"', 1], ['@click="openModify', 1], ['modify:async function', 1], ['submitModify:function', 1], ['closeModify:function', 1],
    ['deleteLab', 6], ['deleteConfirm', 4],
    ['v-if="activeLab.id&&activeLab.id.indexOf(\'free-\')===0"', 0],
    ['lab.id.indexOf("free-")!==0){return;}', 0],
    ['this.activeLabId=null;try{this.syncViewer();}', 1],
    ['verifyBadges', 0], ['verifyTitle', 0], ["{{t('verifyTitle')}}", 0],
    ['detailsTitle', 0], ["{{t('detailsTitle')}}", 0], ['measurementsTitle', 0], ['labelsTitle', 0],
    ['v-if="showOnboarding"', 1],
    ['shrink-0 inline-flex items-center justify-center rounded-xl border', 1],
    ['role="dialog"', 2], ['id="gen-status"', 1],    ['showcase: 5 Modelle', 1],
    ['__FREE_GUARD_V18__', 1],
    ['Fortschritt', 0], ['fortschritt', 0],
    // v29-Nachfolger (Modelliste 10->6): explanations 10->6 (exakt in v29).
    ['openPartInfo', 2], ['closePartInfo', 2], ['partInfoIndex', 7],
    ['partInfoTitle', 5], ['partInfoAbout', 5], ['partExplanations', 2], ['partInfoMissing', 4],
    ['v-if="partInfoIndex!==null"', 1], ['genClose:"Cerrar"', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, `Invariante ${sub}: ${cnt(s, sub)}, erwartet ${want}`);
  // v29-Toleranz: Modelliste 10->6 (4 Demos raus) — 6 nur mit v29-Stempel.
  must(cnt(s, 'explanations:{de:[') === 10 || (s.includes('standalone-build v29') && cnt(s, 'explanations:{de:[') === 6), `Invariante explanations:{de:[ ${cnt(s, 'explanations:{de:[')}, erwartet 10 (v29: 6)`);
  const iBanner = s.indexOf('v-if="showOnboarding"');
  const iAside = s.indexOf('<aside');
  const iViewport = s.indexOf('id="viewport"');
  must(iBanner > 0 && iAside > 0 && iViewport > 0, 'U5 Positions-Anker fehlen');
  must(iBanner < iAside && iAside < iViewport, `Banner-Position: Banner@${iBanner}, Aside@${iAside}, Viewport@${iViewport} (erwartet Banner < Aside < Viewport)`);
  must(s.length < 600000, `Datei zu gross: ${s.length}`);
  console.log('  Invarianten ok (Banner < Liste < Viewer, universelles Loeschen)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v16: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v15a-showcase',
    standalone: 'v16',
    fixes: ['U1 Modify-Hauptblock raus (Stift-Overlay bleibt)', 'U2 Loeschen-Button im Overlay universell (jede Lab-ID, Rueckfrage, State+Liste, Leerzustand)', 'U3 Referenzbericht raus (Template+Computed+Keys)', 'U4 Details (Messungen/Labels) raus (Template+Keys)', 'U5 Banner unter Menueleiste (ueber Liste+Viewer)'],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v16: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v15a'), 'kein v15a-Stempel (falsche Basis)');
if (s.includes('standalone-build v16')) {
  // Bereits v16: idempotente Migration auf universelles Loeschen.
  // Aeltere v16-Artefakte tragen noch Gate/Guard (free-*-Sonderfall);
  // ohne Gate/Guard ist dies ein No-Op (exit 0).
  console.log('build-v16: bereits v16 — migriere auf universelles Loeschen ...');
  let changed = false;
  if (s.includes(DELETE_GATE_OLD)) {
    must(cnt(s, DELETE_GATE_OLD) === 1, 'U2-Migration Gate-Anker fehlt/mehrdeutig');
    s = s.replace(DELETE_GATE_OLD, DELETE_GATE_NEW);
    changed = true;
    console.log('  U2-Migration: v-if-Gate (free-*) entfernt');
  }
  if (s.includes(DELETE_GUARD_OLD)) {
    must(cnt(s, DELETE_GUARD_OLD) === 1, 'U2-Migration Guard-Anker fehlt/mehrdeutig');
    s = s.replace(DELETE_GUARD_OLD, DELETE_GUARD_NEW);
    changed = true;
    console.log('  U2-Migration: deleteLab-Guard (free-*) entfernt');
  }
  if (s.includes(DELETE_EMPTY_OLD)) {
    must(cnt(s, DELETE_EMPTY_OLD) === 1, 'U2-Migration Empty-Anker fehlt/mehrdeutig');
    s = s.replace(DELETE_EMPTY_OLD, DELETE_EMPTY_NEW);
    changed = true;
    console.log('  U2-Migration: Leerzustand-Sync (syncViewer) ergaenzt');
  }
  const gg16 = applyGuardFix(s);
  if (gg16.changed) { s = gg16.s; changed = true; console.log('  G: Guard gehärtet (strip+mask, top/parent präzise)'); }
  checkInvariants(s);
  if (!changed) {
    console.log('build-v16: bereits universell — nichts zu tun (idempotent, exit 0)');
    process.exit(0);
  }
  await writeFile(FILE, s);
  console.log(`build-v16: migriert + geschrieben (${s.length} Zeichen)`);
  await writeReport(s);
  console.log('build-v16: OK v16 (universelles Loeschen)');
  process.exit(0);
}
must(s.includes('showcase: 5 Modelle'), 'kein Showcase-Stempel (falsche Basis)');

// ---------- U1: Haupt-Block "Modell überarbeiten" entfernen (Anzeige only) ----------
{
  const a = `<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all" aria-label="modify">\n<h2 class="text-lg font-bold tracking-tight">{{t('modifyTitle')}}</h2>`;
  must(cnt(s, a) === 1, 'U1 Modify-Section-Anker fehlt/mehrdeutig');
  must(cnt(s, '@click="modify"') === 1, 'U1 Haupt-Modify-Button fehlt/mehrdeutig');
  const start = s.indexOf(a);
  const endAnchor = `</section>\n<div v-if="modOverlay"`;
  const e0 = s.indexOf(endAnchor, start);
  must(e0 > start, 'U1 Modify-Section-Ende fehlt');
  s = s.slice(0, start) + s.slice(e0 + '</section>\n'.length);
  console.log('  U1: Haupt-Block "Modell überarbeiten" entfernt (Overlay/Stift-Logik bleibt)');
}

// ---------- U2: Loeschen-Button im Modify-Pop-in (universell, jede Lab-ID) ----------
{
  const a = `<button type="button" @click="closeModify" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t('genClose')}}</button>\n</div>`;
  must(cnt(s, a) === 1, 'U2 Overlay-Button-Anker fehlt/mehrdeutig');
  const add = `<button type="button" @click="closeModify" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t('genClose')}}</button>\n</div>\n${DELETE_GATE_NEW}\n<button type="button" @click="deleteLab" class="inline-flex items-center justify-center rounded-xl bg-red-600 text-white px-5 min-h-[44px] text-sm font-semibold transition-all hover:bg-red-500">{{t('deleteLab')}}</button>\n</div>`;
  s = s.replace(a, add);
  console.log('  U2: Loeschen-Button im Overlay (universell, jede Lab-ID)');
}
{
  const a = `closeModify:function(){this.modOverlay=false;},`;
  must(cnt(s, a) === 1, 'U2 Methoden-Anker fehlt/mehrdeutig');
  s = s.replace(a, DELETE_METHOD_NEW);
  console.log('  U2: deleteLab-Methode (Rueckfrage, State + Liste, Leerzustand-Sync)');
}
{
  const t = [
    [`I18N.de.modDone="Überarbeitung geladen.";I18N.de.modifyOpen="Überarbeiten";`, `I18N.de.modDone="Überarbeitung geladen.";I18N.de.modifyOpen="Überarbeiten";I18N.de.deleteLab="Löschen";I18N.de.deleteConfirm="Dieses Modell wirklich löschen?";`],
    [`I18N.en.modDone="Revision loaded.";I18N.en.modifyOpen="Revise";`, `I18N.en.modDone="Revision loaded.";I18N.en.modifyOpen="Revise";I18N.en.deleteLab="Delete";I18N.en.deleteConfirm="Really delete this model?";`],
    [`modDone:"Revision cargada.",modifyOpen:"Revisar"`, `modDone:"Revision cargada.",modifyOpen:"Revisar",deleteLab:"Eliminar",deleteConfirm:"¿Eliminar este modelo?"`],
  ];
  for (const [a, b] of t) {
    must(cnt(s, a) === 1, `U2 I18N-Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  console.log('  U2: I18N-Keys deleteLab/deleteConfirm (de/en/es)');
}

// ---------- U3: Referenzbericht-Block entfernen ----------
{
  const a = `<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<h3 class="text-lg font-bold mb-3">{{t('verifyTitle')}}: {{activeLab.title[lang]}}</h3>`;
  must(cnt(s, a) === 1, 'U3 Referenz-Template-Anker fehlt/mehrdeutig');
  const start = s.indexOf(a);
  const endAnchor = `</section>\n<div v-if="showOnboarding"`;
  const e0 = s.indexOf(endAnchor, start);
  must(e0 > start, 'U3 Referenz-Block-Ende fehlt');
  must(s.slice(start, e0).includes('v-for="b in verifyBadges"'), 'U3 Badges-Schleife fehlt im Block');
  s = s.slice(0, start) + s.slice(e0 + '</section>\n'.length);
  console.log('  U3: Referenzbericht-Template entfernt');
}
{
  const startA = `verifyBadges(){var lab=this.activeLab;`;
  const endA = `ok:hasCurr}];},`;
  must(cnt(s, startA) === 1, 'U3 verifyBadges-Start fehlt/mehrdeutig');
  const start = s.indexOf(startA);
  const e0 = s.indexOf(endA, start);
  must(e0 > start, 'U3 verifyBadges-Ende fehlt');
  s = s.slice(0, start) + s.slice(e0 + endA.length);
  console.log('  U3: verifyBadges-Computed entfernt');
}
{
  for (const a of [`verifyTitle:"Referenzbericht",`, `verifyTitle:"Reference report",`, `verifyTitle:"Informe de referencia",`]) {
    must(cnt(s, a) === 1, `U3 verifyTitle-Anker fehlt: ${a.slice(0, 30)}`);
    s = s.replace(a, '');
  }
  console.log('  U3: verifyTitle-Keys (de/en/es) entfernt');
}

// ---------- U4: Details-Block (Messungen/Labels) entfernen ----------
{
  const a = `<details class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<summary class="font-bold cursor-pointer min-h-[44px] flex items-center">{{t('detailsTitle')}}</summary>`;
  must(cnt(s, a) === 1, 'U4 Details-Anker fehlt/mehrdeutig');
  const start = s.indexOf(a);
  const endAnchor = `</details>\n<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all" :aria-label="t('generatorTitle')">`;
  const e0 = s.indexOf(endAnchor, start);
  must(e0 > start, 'U4 Details-Ende (Generator-Section) fehlt');
  must(s.slice(start, e0).includes('activeLab.measurements'), 'U4 Messungs-Renderer fehlt im Block');
  must(s.slice(start, e0).includes('activeLab.labels'), 'U4 Label-Renderer fehlt im Block');
  s = s.slice(0, start) + s.slice(e0);
  console.log('  U4: Details-Template (Messungen/Labels) entfernt');
}
{
  const t = [
    [`I18N.de.detailsTitle="Details (Messungen, Labels)";\n`, ``],
    [`I18N.en.detailsTitle="Details (measurements, labels)";\n`, ``],
    [`detailsTitle:"Detalles (mediciones, etiquetas)",`, ``],
    [`labelsTitle:"Labels",measurementsTitle:"Messwerte",`, ``],
    [`labelsTitle:"Labels",measurementsTitle:"Measurements",`, ``],
    [`labelsTitle:"Etiquetas",measurementsTitle:"Mediciones",`, ``],
  ];
  for (const [a, b] of t) {
    must(cnt(s, a) === 1, `U4 I18N-Anker fehlt: ${a.slice(0, 50)}`);
    s = s.replace(a, b);
  }
  console.log('  U4: detailsTitle-/measurementsTitle-/labelsTitle-Keys entfernt');
}

// ---------- U5: Onboarding-Banner unter die Menueleiste ----------
{
  const banner = `<div v-if="showOnboarding" class="rounded-2xl bg-indigo-600 text-white p-4 flex flex-wrap items-center gap-3 transition-all">\n<p class="flex-1 min-w-[200px]">{{t('onboarding')}}</p>\n<button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50">{{t('understood')}}</button>\n</div>\n`;
  must(cnt(s, banner) === 1, 'U5 Banner-Anker fehlt/mehrdeutig');
  s = s.replace(banner, '');
  const head = `</header>\n<div class="max-w-[1920px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 p-4">`;
  must(cnt(s, head) === 1, 'U5 Header/Content-Anker fehlt/mehrdeutig');
  s = s.replace(head, `</header>\n<div class="max-w-[1920px] mx-auto w-full px-4 pt-4">\n${banner}</div>\n<div class="max-w-[1920px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 p-4">`);
  console.log('  U5: Banner unter Menueleiste (ueber Liste + Viewer)');
}

// ---------- G: Guard härten (idempotent, fresh + migriert) ----------
{
  const gg = applyGuardFix(s);
  if (gg.changed) console.log('  G: Guard gehärtet (strip+mask, top/parent präzise)');
  else console.log('  G: Guard bereits gehärtet');
  s = gg.s;
}

// ---------- Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v15a (Bestandteil-Info Fallback-Text + es genClose, via scripts/build-standalone-v15a.mjs) -->';
  must(cnt(s, stamp) === 1, 'U5 Stempel-Anker fehlt');
  s = s.replace(stamp, `${stamp}\n<!-- standalone-build v16 (UI-Stromlinien: Modify-Block raus, Loeschen universell im Overlay, Referenzbericht raus, Details raus, Banner oben, via scripts/build-standalone-v16.mjs) -->`);
  console.log('  Stempel: v16');
}
checkInvariants(s);

await writeFile(FILE, s);
console.log(`build-v16: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v16: OK v16');
