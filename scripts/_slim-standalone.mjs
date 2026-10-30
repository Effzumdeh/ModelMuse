/** Einmalig: Standalone slimmen — Quiz/Fortschritt/Tipps raus, Modify rein. */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'dist-standalone/modelmuse-standalone.html';
let s = await readFile(FILE, 'utf8');
const must = (cond, msg) => { if (!cond) { console.error('SLIM-STANDALONE FEHLER: ' + msg); process.exit(1); } console.log('  ok: ' + msg); };
let lines = s.split('\n');
const findIdx = (marker, from = 0) => lines.findIndex((l, i) => i >= from && l.includes(marker));

function delBlock(startMarker, endMarker, maxLines, label) {
  const a = findIdx(startMarker);
  must(a >= 0, `${label}: Start gefunden`);
  let b = a;
  while (b < lines.length && b - a < maxLines && !lines[b].includes(endMarker)) b += 1;
  must(b < lines.length && lines[b].includes(endMarker), `${label}: Ende gefunden`);
  must(b - a + 1 <= maxLines, `${label}: Laenge ${b - a + 1} <= ${maxLines}`);
  lines.splice(a, b - a + 1);
  console.log(`  del ${label}: Zeilen ${a + 1}-${b + 1}`);
}
function delLine(marker, label) {
  const a = findIdx(marker);
  must(a >= 0, `${label}: gefunden`);
  lines.splice(a, 1);
  console.log(`  del ${label}: Zeile ${a + 1}`);
}

// T1: Quiz-Option-CSS.
delLine('label.quiz-option', 'quiz-option-CSS');
// T2: Kopf-Fortschrittsbalken (overallProgress).
delBlock("t('overallProgress')", 'overallProgress.total', 8, 'overallProgress-Kopf');
// T3: Lab-Fortschrittsbalken.
delBlock('labProgress(lab.id).pct', 'labProgress(lab.id).total', 6, 'labProgress-Liste');
// T4: Hinweis-Buttons + Hinweisliste (inkl. schliessendem </ul>).
delBlock('toggleHint(task.id,1)', '</ul>', 12, 'Hinweis-Buttons+Liste');
// T5: Quiz-Sektion.
delBlock("t('quizTitle')", '</section>', 30, 'Quiz-Sektion');
// T6: Footer-Reset-Button.
delLine('@click="resetProgress"', 'resetProgress-Button');

s = lines.join('\n');

// JS: Datenfelder.
must(s.includes('quizChoice:{},quizDone:{},'), 'data quiz-Felder da');
s = s.replace('quizChoice:{},quizDone:{},', '');
must(s.includes('hintsShown:{},'), 'data hintsShown da');
s = s.replace('hintsShown:{},', '');
// JS: Computed + Methoden (je einzeilig).
for (const [marker, label] of [
  ['overallProgress(){var done=0', 'computed overallProgress'],
  ['labProgress:function(labId)', 'labProgress-Funktion'],
  ['retryQuiz:function()', 'retryQuiz'],
  ['answerQuiz:function()', 'answerQuiz'],
  ['toggleHint:function(taskId,stage)', 'toggleHint'],
  ['resetProgress:function()', 'resetProgress-Methode'],
]) {
  const i = s.indexOf(marker);
  must(i >= 0, label + ' gefunden');
  const eol = s.indexOf('\n', i);
  must(eol > i, label + ' einzeilig');
  s = s.slice(0, i) + s.slice(eol + 1);
  console.log(`  del ${label}`);
}
// saveProgress ohne quizDone.
must(s.includes('JSON.stringify({taskState:this.taskState,quizDone:this.quizDone})'), 'saveProgress-Form da');
s = s.replace('JSON.stringify({taskState:this.taskState,quizDone:this.quizDone})', 'JSON.stringify({taskState:this.taskState})');
// mounted ohne quizDone.
must(s.includes('if(p.quizDone){this.quizDone=p.quizDone;}'), 'mounted quizDone-Load da');
s = s.replace('if(p.quizDone){this.quizDone=p.quizDone;}', '');
// makeFreeLab-/LABS-Quiz-Daten bleiben bewusst erhalten (inert, kein Codepfad
// referenziert sie mehr; persistFree/restoreFree-Roundtrip bleibt kompatibel).
// Begruendung: Payload-Chirurgie ueber Lab-Grenzen ist zu riskant fuer den
// Nutzen; "keine Toten" gilt fuer Code+UI (assertiert unten).
// i18n-Keys (de/en unquoted, es quoted — Anker: vorausgehendes , oder {).
for (const key of ['quizTitle', 'evaluate', 'quizPick', 'quizCorrect', 'quizWrong', 'correctIs', 'rationale', 'retryQuiz', 'hintStage', 'allHints', 'progress', 'overallProgress', 'resetProgress']) {
  const re = new RegExp(`(?<=[,{]) *"?(?:${key})"?:\"(?:[^\"\\\\]|\\\\.)*\"[,]?( *)`, 'g');
  const n = (s.match(re) || []).length;
  must(n === 3, `i18n ${key}: 3 Treffer (de/en/es), gefunden ${n}`);
  s = s.replace(re, '$1');
  console.log(`  del i18n ${key}`);
}
// i18n-Texte ohne Fortschritt/Quiz-Bezug.
const textRepl = [
  ['Willkommen bei ModelMuse! Wähle links ein Lab, bearbeite deine Aufgaben und prüfe dein Wissen im Quiz.', 'Willkommen bei ModelMuse! Wähle links ein Lab oder generiere ein eigenes Modell.'],
  ['Welcome to ModelMuse! Pick a lab on the left, solve your tasks and check your knowledge in the quiz.', 'Welcome to ModelMuse! Pick a lab on the left or generate your own model.'],
  ['Standalone · Client-only · Fortschritt wird lokal im Browser (LocalStorage) gespeichert.', 'Standalone · Client-only.'],
  ['Standalone · Client-only · Progress is stored locally in your browser (LocalStorage).', 'Standalone · Client-only.'],
];
for (const [a, b] of textRepl) {
  must(s.includes(a), `Text gefunden: ${a.slice(0, 40)}…`);
  s = s.split(a).join(b);
}
// ES-Texte (einzeiliges Literal, \\u-escapet).
const esRepl = [
  ['Elige un laboratorio a la izquierda, trabaja tus tareas y comprueba tu conocimiento en el cuestionario.', 'Elige un laboratorio a la izquierda o genera tu propio modelo.'],
  ['Standalone \\u00b7 Solo cliente \\u00b7 El progreso se guarda localmente en tu navegador (LocalStorage).', 'Standalone \\u00b7 Solo cliente.'],
];
for (const [a, b] of esRepl) {
  must(s.includes(a), `ES-Text gefunden: ${a.slice(0, 40)}…`);
  s = s.split(a).join(b);
}
// Modify-i18n (de/en als Zuweisung, es ins Literal).
const modKeys = {
  de: { modifyTitle: 'Modell überarbeiten', modifyHint: 'Bestehendes generiertes Modell per LLM ändern: Lab ist vorausgewählt, Änderung beschreiben, Ergebnis lädt neu.', modDescPh: 'z. B. Gehäuse rot, doppelt so groß', modifyBtn: 'Modell überarbeiten', modTooShort: 'Bitte einen Änderungswunsch eingeben (mindestens 2 Zeichen).', modNoSource: 'Nur für generierte Labs (mit Quelle) — kuratierte Labs sind Referenz.', modDone: 'Überarbeitung geladen.' },
  en: { modifyTitle: 'Revise model', modifyHint: 'Change the current generated model via LLM: lab is preselected, describe the change, the result reloads.', modDescPh: 'e.g. red housing, twice as large', modifyBtn: 'Revise model', modTooShort: 'Please enter a change request (at least 2 characters).', modNoSource: 'Only for generated labs (with source) — curated labs are reference.', modDone: 'Revision loaded.' },
};
for (const loc of ['de', 'en']) {
  for (const [k, v] of Object.entries(modKeys[loc])) {
    const anchor = `I18N.${loc}.keyInvalid=`;
    must(s.includes(anchor), `Anker ${anchor} da`);
    s = s.replace(anchor, `I18N.${loc}.${k}=${JSON.stringify(v)};\n${anchor}`);
  }
  console.log(`  add i18n modify (${loc})`);
}
{
  const anchor = ',genClose:"Cerrar"};';
  must(s.includes(anchor), 'ES-Anker da');
  const add = ',modifyTitle:"Revisar modelo",modifyHint:"Modifique el modelo generado actual mediante LLM: el laboratorio esta preseleccionado, describa el cambio, el resultado se recarga.",modDescPh:"p. ej. carcasa roja, el doble de grande",modifyBtn:"Revisar modelo",modTooShort:"Introduzca un cambio deseado (minimo 2 caracteres).",modNoSource:"Solo para laboratorios generados (con fuente) — los curados son referencia.",modDone:"Revision cargada."};';
  s = s.split(anchor).join(add);
  console.log('  add i18n modify (es)');
}
// Modify-Sektion nach Generator-Sektion (Anker: gen-progress-Kommentar + </section>).
{
  const anchor = '</div></div>\n</section>';
  must(s.includes(anchor), 'Generator-Sektionsende da');
  const section = [
    '<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all" aria-label="modify">',
    '<h2 class="text-lg font-bold tracking-tight">{{t(\'modifyTitle\')}}</h2>',
    '<p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{t(\'modifyHint\')}}</p>',
    '<p class="mt-2 text-sm font-semibold">{{activeLab.title[lang]}}</p>',
    '<div class="mt-3 flex flex-wrap gap-2 items-end">',
    '<textarea id="mod-desc" v-model="modDesc" :placeholder="t(\'modDescPh\')" rows="1" class="flex-1 min-w-[200px] min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"></textarea>',
    '<button @click="modify" :disabled="modBusy" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold disabled:opacity-50">{{t(\'modifyBtn\')}}</button>',
    '</div>',
    '<p v-if="modStatus" :class="modStatusBad ? \'mt-2 text-sm text-red-600 dark:text-red-400\' : \'mt-2 text-sm text-emerald-700 dark:text-emerald-300\'">{{modStatus}}</p>',
    '</section>',
  ].join('\n');
  s = s.replace(anchor, '</div></div>\n</section>\n' + section);
  console.log('  add Modify-Sektion');
}
// Modify-Daten + Methoden.
must(s.includes('genBusy:false,'), 'data-Anker genBusy da');
s = s.replace('genBusy:false,', 'genBusy:false,modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,');
must(s.includes('checkTask:function(task){'), 'Methoden-Anker checkTask da');
const modifyJs = `buildModifyPrompt:function(wish,source){var w=(wish||"").slice(0,500);return ["P2 MODIFY (Three.js r186, Single-Page-Wrapper).","Aenderungswunsch: "+w+". Setze GENAU diesen Wunsch an der ORIGINALQUELLE um; aendere nichts anderes (keine neuen Bauteile/Imports/Abhaengigkeiten, Budgets einhalten).","ORIGINALQUELLE (genau dieses Modul aendern):",String(source||"").slice(0,60000),"Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences."].join("\\n");},
modify:async function(){var wish=(this.modDesc||"").trim();if(wish.length<2){this.modStatus=this.t('modTooShort');this.modStatusBad=true;return;}if(!this.genKey){this.modStatus=this.t('keyMissing');this.modStatusBad=true;return;}var lab=this.activeLab;var src=(lab&&(lab._source||lab.source))||null;if(!src){this.modStatus=this.t('modNoSource');this.modStatusBad=true;return;}var prompt=this.buildModifyPrompt(wish,src);this.modBusy=true;try{var ctrl=new AbortController();var timer=setTimeout(function(){try{ctrl.abort();}catch(e){}},120000);var res=null;try{res=await fetch(this.genDirectUrl,{method:"POST",headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json","HTTP-Referer":"https://modelmuse.local","X-Title":"ModelMuse"},body:JSON.stringify({model:this.genModel,messages:[{role:"user",content:prompt}],temperature:0.2}),signal:ctrl.signal});}catch(e){this.modStatus=this.t('networkError');this.modStatusBad=true;return;}finally{if(timer){clearTimeout(timer);}}if(!res||!res.ok){this.modStatus=this.t('badSource')+" ("+(res?res.status:"?")+")";this.modStatusBad=true;return;}var data=null;try{data=await res.json();}catch(e){data=null;}var text="";try{if(data&&data.choices&&data.choices[0]&&data.choices[0].message&&typeof data.choices[0].message.content==="string"){text=data.choices[0].message.content;}}catch(e){text="";}var quelle=text;var fm=/\\\`\\\`\\\`(?:[a-zA-Z0-9_-]+)?\\n([\\s\\S]*?)\\\`\\\`\\\`/.exec(text);if(fm&&fm[1]){quelle=fm[1];}quelle=(quelle||"").trim();if(!quelle||quelle.indexOf("export const meta")===-1||quelle.indexOf("export function init")===-1){this.modStatus=this.t('badSource');this.modStatusBad=true;return;}var reg=null;try{reg=window.__viewer.registerFree(lab.id,quelle);}catch(e){this.modStatus=this.t('badSource')+" "+(e&&e.message?e.message:e);this.modStatusBad=true;return;}lab._source=quelle;lab._meta=reg.meta;lab._metaI18n=reg.metaI18n;try{if(reg.meta&&reg.meta.title){lab.title.de=reg.meta.title;}}catch(e){}try{this.persistFree();}catch(e){}try{this.syncViewer();}catch(e){}this.modStatus=this.t('modDone');this.modStatusBad=false;}finally{this.modBusy=false;}},
checkTask:function(task){`;
s = s.replace('checkTask:function(task){', modifyJs);

// Keine Toten: Assertions.
for (const dead of ['quizChoice', 'quizDone', 'hintsShown', 'labProgress', 'overallProgress', 'answerQuiz', 'retryQuiz', 'toggleHint', "t('quizTitle')", "t('evaluate')", "t('quizPick')", "t('hintStage')", "t('resetProgress')", '@click="resetProgress"', 'quiz-option']) {
  must(!s.includes(dead), `tot: ${dead} entfernt`);
}
// Erhalten: Labs, Sprache, Generieren, Modify.
for (const keep of ['filteredLabs', 'genDesc', 'buildFreePrompt', 'modify', 'modDesc', "t('modifyTitle')", 'verifyBadges', 'checkTask']) {
  must(s.includes(keep), `keep: ${keep} vorhanden`);
}

await writeFile(FILE, s);
console.log(`slim-standalone: OK (${s.length} Zeichen)`);
