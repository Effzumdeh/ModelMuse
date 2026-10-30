/**
 * Standalone builder v13 (the only release artifact, GitHub Pages-ready):
 * Upgrades dist-standalone/modelmuse-standalone.html from v12-guide to v13.
 * Uses the current file as its v12-guide-stamped base; reruns are idempotent.
 * A rerun exits when it finds the v13 build stamp.
 *
 * M1  Replace the si-1, si-2, si-3, and free-handbohrmaschine 3D embeds
 *     with src/models/*.js sources (room light 5 instead of 900, exposure
 *     1.0/1.1, environmentIntensity 0.55); remove the old blocks.
 * M2  Add chemie-koffein and gpu-example from src/models (code, LABS entry,
 *     Spanish metadata, and measurement fallback); both were previously absent.
 * M3  Update dup-1..3/ae-1..3 metadata and remove obsolete 3D init blocks
 *     (including the old room-light value); derive META.parts from manifest
 *     labels (the dup-1 source metadata was stale).
 * M4  Assert that the old lighting artifacts are gone: no 900 room light,
 *     2048 shadow map, PCFSoftShadowMap, or envMapIntensity.
 * M5  Remove objectives, level, learning mode, track, badge, and curriculum UI;
 *     rename Labs to Models (de/en/es), move the welcome banner to end of <main>,
 *     add a per-model revision overlay (reuse the sessionStorage key or prompt
 *     for provider/key), and embed all 12 source modules for revision.
 * M6  Set Baseten as the provider default (model meta-models/muse-spark-open-1026,
 *     direct browser request to https://inference.baseten.co/v1/chat/completions,
 *     no OpenRouter default or proxy port, and no automatic proxy startup).
 * M7  Update the v13 standalone title, badges, and build stamp.
 *
 * Run with: node scripts/build-standalone-v13.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v13-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v13: FEHLER ' + msg); process.exit(1); }
}
let s = await readFile(FILE, 'utf8');
console.log(`build-v13: Basis ${s.length} Zeichen`);
// Idempotency: if the file is already v13, exit successfully without writing.
if (s.includes('standalone-build v13')) {
  console.log('build-v13: bereits v13 — nichts zu tun (idempotent, exit 0)');
  process.exit(0);
}
// Validate the expected base artifact before editing it.
must(s.includes('standalone-build v12-guide'), 'v12-guide-Stempel fehlt (falsche Basis)');
must(s.split('PointLight(0xffffff, 900').length - 1 === 10, 'Basis: Raumlicht-900-Zaehler != 10 (9 Code + 1 Prompttext)');
must(s.split('const LABS=').length - 1 === 1, 'LABS-Anker fehlt');
must(s.split('{id:"si-1"').length - 1 === 1, 'LABS si-1 fehlt');
must(!s.includes('chemie-koffein'), 'Basis enthaelt schon chemie-koffein (falsche Basis)');
must(!s.includes('__SOURCES'), 'SOURCES schon vorhanden (falsche Basis)');

// ---------- M1: Replace 3D blocks ----------
const THREE3D = ['si-1', 'si-2', 'si-3', 'free-handbohrmaschine'];
// Read the destructured names from the module prologue to validate imports.
const destrM = /const \{ ([^}]*) \} = THREE;/.exec(s);
must(destrM, 'THREE-Destrukturierung nicht gefunden');
const HAVE = new Set(destrM[1].split(',').map((x) => x.trim()));
for (const id of THREE3D) {
  const sid = id.replace(/-/g, '_');
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  // Check that every source import is available in the artifact.
  const im = /import \{ ([^}]*) \} from 'three';/.exec(src);
  must(im, `${id}: three-Import nicht gefunden`);
  const missing = im[1].split(',').map((x) => x.trim()).filter((x) => !HAVE.has(x));
  must(missing.length === 0, `${id}: fehlende THREE-Namen: ${missing.join(',')}`);
  must(src.includes("from 'three/addons/controls/OrbitControls.js'"), `${id}: OrbitControls-Import fehlt`);
  must(src.includes("from 'wrapper-helpers'"), `${id}: wrapper-helpers-Import fehlt`);
  // Transform the source module for embedding.
  let body = src
    .split('\n')
    .filter((ln) => !ln.startsWith('import '))
    .join('\n');
  must(!body.includes("from 'three'"), `${id}: Rest-Import`);
  body = body.replace('export const meta = ', `const meta_${sid} = `);
  body = body.replace('export const meta_i18n = ', `const meta_i18n_${sid} = `);
  if (body.includes('export const init = ')) {
    body = body.replace('export const init = ', `const init_${sid} = `);
  } else {
    must(body.includes('export function init('), `${id}: init-Form unbekannt`);
    body = body.replace('export function init(', `function init_${sid}(`);
  }
  must(!body.includes('export '), `${id}: Rest-Export`);
  const ocBefore = (body.match(/new OrbitControls\(/g) || []).length;
  body = body.split('new OrbitControls(').join('new window.__OrbitControls(');
  must(ocBefore >= 1, `${id}: kein OrbitControls-Aufruf`);
  must(!body.includes('new OrbitControls('), `${id}: OrbitControls-Rest`);
  // Enforce the source invariants documented in the implementation guide.
  must(!body.includes('900, 28, 2'), `${id}: Quelle enthaelt Raumlicht 900`);
  must(!body.includes('envMapIntensity'), `${id}: Quelle enthaelt envMapIntensity`);
  must(!body.includes('PCFSoftShadowMap'), `${id}: Quelle enthaelt PCFSoft`);
  must(!body.includes('0x11141a'), `${id}: Quelle enthaelt Dunkel-Raum`);
  must(!body.includes('mapSize.set(2048'), `${id}: Quelle enthaelt mapSize 2048`);
  must(body.includes('scene.environmentIntensity = 0.55') || body.includes('scene.environmentIntensity=0.55'), `${id}: environmentIntensity fehlt`);
  const block = `{\n${body}\nINIT['${id}'] = init_${sid};\nMETA['${id}'] = meta_${sid};\nMETA['${id}'].is3d = true;\n}`;
  // Locate and replace the old block (start at the preceding '\n{\n' before
  // the metadata; si-3 has helper functions before its metadata declaration).
  const metaPos = s.indexOf(`const meta_${sid} = `);
  must(metaPos >= 0, `${id}: alte Meta fehlt`);
  const openAt = s.lastIndexOf('\n{\n', metaPos);
  must(openAt >= 0, `${id}: Block-Oeffnung fehlt`);
  const between = s.slice(openAt, metaPos);
  must(!between.includes("INIT['") && !between.includes("META['"), `${id}: Blockstart mehrdeutig`);
  const a0 = openAt + 1;
  const endAnchor = `META['${id}'].is3d = true;\n}`;
  const e0 = s.indexOf(endAnchor, metaPos);
  must(e0 >= 0, `${id}: altes Blockende fehlt`);
  const oldBlock = s.slice(a0, e0 + endAnchor.length);
  const old900 = oldBlock.split('PointLight(0xffffff, 900').length - 1;
  if (id === 'free-handbohrmaschine') must(old900 === 0, 'free-alt: unerwartet Raumlicht 900');
  else must(old900 === 1, `${id}: alter Block 900-Zaehler=${old900}, erwartet 1`);
  s = s.slice(0, a0) + block + s.slice(e0 + endAnchor.length);
  console.log(`  M1 ${id}: Block ersetzt (${body.length} Zeichen)`);
}

// ---------- M2: Add chemie-koffein and gpu-example ----------
const NEW3D = ['chemie-koffein', 'gpu-example'];
const newBlocks = [];
for (const id of NEW3D) {
  const sid = id.replace(/-/g, '_');
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  const im = /import \{ ([^}]*) \} from 'three';/.exec(src);
  must(im, `${id}: three-Import nicht gefunden`);
  const missing = im[1].split(',').map((x) => x.trim()).filter((x) => !HAVE.has(x));
  must(missing.length === 0, `${id}: fehlende THREE-Namen: ${missing.join(',')}`);
  let body = src.split('\n').filter((ln) => !ln.startsWith('import ')).join('\n');
  body = body.replace('export const meta = ', `const meta_${sid} = `);
  body = body.replace('export const meta_i18n = ', `const meta_i18n_${sid} = `);
  must(body.includes('export function init('), `${id}: init-Form unbekannt`);
  body = body.replace('export function init(', `function init_${sid}(`);
  must(!body.includes('export '), `${id}: Rest-Export`);
  const oc = (body.match(/new OrbitControls\(/g) || []).length;
  body = body.split('new OrbitControls(').join('new window.__OrbitControls(');
  must(oc >= 1, `${id}: kein OrbitControls-Aufruf`);
  must(!body.includes('900, 28, 2'), `${id}: Raumlicht 900`);
  must(!body.includes('envMapIntensity'), `${id}: envMapIntensity`);
  must(body.includes('PointLight(0xffffff, 5, 28, 2)'), `${id}: Raumlicht 5 fehlt`);
  newBlocks.push(`{\n${body}\nINIT['${id}'] = init_${sid};\nMETA['${id}'] = meta_${sid};\nMETA['${id}'].is3d = true;\n}`);
  console.log(`  M2 ${id}: Block gebaut (${body.length} Zeichen)`);
}
{
  const anchor = `{\nconst meta_free_handbohrmaschine = `;
  const at = s.indexOf(anchor);
  must(at >= 0, 'M2: free-Block-Anker fehlt');
  s = s.slice(0, at) + newBlocks.join('\n') + '\n' + s.slice(at);
  console.log('  M2: Bloecke vor free-handbohrmaschine eingefuegt');
}

// ---------- M3: Replace 2D metadata blocks and remove obsolete 3D init code ----------
const TWOD = ['dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3'];
for (const id of TWOD) {
  const sid = id.replace(/-/g, '_');
  const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
  must(Array.isArray(man.labels) && man.labels.length >= 3, `${id}: Manifest-Labels fehlen`);
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  const metaLine = /export const meta = \{[^\n]*\};/.exec(src);
  must(metaLine, `${id}: src-meta fehlt`);
  const i18nLine = /export const meta_i18n = \{[^\n]*\};/.exec(src);
  must(i18nLine, `${id}: src-meta_i18n fehlt`);
  const partsJs = man.labels.map((p) => `'${p}'`).join(',');
  let metaNew = metaLine[0]
    .replace('export const meta = ', `const meta_${sid} = `)
    .replace(/parts: \[[^\]]*\]/, `parts: [${partsJs}]`);
  const i18nNew = i18nLine[0].replace('export const meta_i18n = ', `const meta_i18n_${sid} = `);
  const fresh = `{\n${metaNew}\n${i18nNew}\nMETA['${id}'] = meta_${sid};\nMETA['${id}'].is3d = false;\n}`;
  const metaPos = s.indexOf(`const meta_${sid} = `);
  must(metaPos >= 0, `${id}: alter Blockstart fehlt`);
  const openAt = s.lastIndexOf('\n{\n', metaPos);
  must(openAt >= 0, `${id}: Block-Oeffnung fehlt`);
  const between = s.slice(openAt, metaPos);
  must(!between.includes("INIT['") && !between.includes("META['"), `${id}: Blockstart mehrdeutig`);
  const a0 = openAt + 1;
  const initProbeA = s.indexOf(`const init_${sid} = `, a0);
  const initProbeB = s.indexOf(`function init_${sid}(`, a0);
  const initAt = initProbeA >= 0 ? initProbeA : initProbeB;
  must(initAt > a0, `${id}: tote INIT nicht gefunden`);
  const assignAnchor = `INIT['${id}'] = init_${sid};\n`;
  const asAt = s.indexOf(assignAnchor, initAt);
  must(asAt > initAt, `${id}: INIT-Zuweisung fehlt`);
  const endAnchorF = `META['${id}'].is3d = false;\n}`;
  const endAnchorT = `META['${id}'].is3d = true;\n}`;
  let e0 = s.indexOf(endAnchorF, asAt);
  if (e0 < 0) e0 = s.indexOf(endAnchorT, asAt);
  must(e0 >= 0, `${id}: Blockende fehlt`);
  const usedEnd = s.startsWith(endAnchorF, e0) ? endAnchorF : endAnchorT;
  s = s.slice(0, a0) + fresh + s.slice(e0 + usedEnd.length);
  console.log(`  M3 ${id}: 2D-Metablock, Teile=${man.labels.length}`);
}

// ---------- M4: Assert lighting invariants (after M1-M3; prompt updated in M6) ----------
must(s.split('PointLight(0xffffff, 900').length - 1 === 1, 'M4: nur Prompttext-900 darf uebrig sein');
must(s.split('PCFSoftShadowMap').length - 1 <= 5, 'M4: PCFSoft unerwartet hoch');
must(s.split('0x11141a').length - 1 === 0, 'M4: Dunkel-Raum-Rest');
must(s.split('mapSize.set(2048').length - 1 === 0, 'M4: mapSize-2048-Rest');
must(s.split('envMapIntensity').length - 1 === 0, 'M4: envMapIntensity-Rest');
console.log('  M4: Code-Reste beseitigt (900 nur noch Prompttext)');

// ---------- Add catalogue entries for koffein and gpu ----------
const q = (x) => JSON.stringify(x);
function labsEntry(id, man) {
  const d = man.i18n?.de ?? {};
  const en = man.i18n?.en ?? {};
  const es = man.i18n?.es ?? {};
  const title = { de: man.title ?? id, en: en.title ?? man.title ?? id, es: es.title ?? en.title ?? man.title ?? id };
  const labels = { de: man.labels, en: en.labels ?? man.labels, es: es.labels ?? en.labels ?? man.labels };
  const objectives = {
    de: man.objectives ?? [],
    en: en.objectives ?? man.objectives ?? [],
    es: es.objectives ?? en.objectives ?? man.objectives ?? [],
  };
  const measurements = (man.measurements ?? []).map((m) => {
    const men = (en.measurements ?? []).find((x) => x.id === m.id);
    return `{id:${q(m.id)},text:{de:${q(m.text)},en:${q(men?.text ?? m.text)}},unit:${q(m.unit ?? 'cm')}}`;
  });
  const tasks = (man.tasks ?? []).map((t) => {
    const ten = (en.tasks ?? []).find((x) => x.id === t.id);
    return `{id:${q(t.id)},type:${q(t.type)},tolerance:${Number(t.tolerance ?? 0)},expected:${q(t.expected)},prompt:{de:${q(t.prompt)},en:${q(ten?.prompt ?? t.prompt)}}}`;
  });
  const p0 = man.labels[0] ?? 'Bauteil';
  const m0 = man.measurements?.[0]?.text ?? '';
  const quiz = `{q:{de:${q(`Welches Bauteil gehört zu ${title.de}?`)},en:${q(`Which part belongs to ${title.en}?`)}},options:{de:[${q(p0)},${q(man.labels[1] ?? p0)},${q(man.labels[2] ?? p0)},"Keines davon"],en:[${q((en.labels ?? [])[0] ?? p0)},${q((en.labels ?? [])[1] ?? p0)},${q((en.labels ?? [])[2] ?? p0)},"None of these"]},correct:0,rationale:{de:${q(`${p0} ist in parts gelistet.`)},en:${q(`${(en.labels ?? [])[0] ?? p0} is listed in parts.`)}}}`;
  return `{id:${q(id)},track:"Free",is3d:true,title:{de:${q(title.de)},en:${q(title.en)},es:${q(title.es)}},objectives:{de:[${objectives.de.map(q).join(',')}],en:[${objectives.en.map(q).join(',')}],es:[${objectives.es.map(q).join(',')}]},measurements:[${measurements.join(',')}],labels:{de:[${labels.de.map(q).join(',')}],en:[${labels.en.map(q).join(',')}],es:[${labels.es.map(q).join(',')}]},tasks:[${tasks.join(',')}],quiz:${quiz},curriculum_ref:{badge:"Free",lf:"Freimodus",arp:"-"}}`;
}
{
  const entries = [];
  for (const id of NEW3D) {
    const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
    entries.push(labsEntry(id, man));
    console.log(`  LABS ${id}: labels=${man.labels.length} meas=${(man.measurements ?? []).length} tasks=${(man.tasks ?? []).length}`);
  }
  const anchor = `curriculum_ref:{badge:"Free",lf:"Freimodus",arp:"-"}}\n];`;
  must(s.split(anchor).length - 1 === 1, 'LABS-Arrayende nicht eindeutig');
  s = s.replace(anchor, `curriculum_ref:{badge:"Free",lf:"Freimodus",arp:"-"}},\n${entries.join(',\n')}\n];`);
}

// ---------- Embed all 12 original sources for the revision flow ----------
{
  const all = [...THREE3D, ...NEW3D, ...TWOD];
  const map = {};
  for (const id of all) map[id] = await readFile(`src/models/${id}.js`, 'utf8');
  const json = JSON.stringify(map);
  must(!json.includes('</script'), 'SOURCES: </script-Sequenz');
  must(s.indexOf('const LABS=[') >= 0, 'SOURCES-Anker fehlt');
  s = s.replace('const LABS=[', `window.__SOURCES = ${json};\nconst LABS=[`);
  console.log(`  SOURCES: ${all.length} Modelle, ${json.length} Zeichen`);
}

// ---------- Add Spanish metadata and measurement fallbacks ----------
{
  const manK = JSON.parse(await readFile('src/models/manifests/chemie-koffein.json', 'utf8'));
  const manG = JSON.parse(await readFile('src/models/manifests/gpu-example.json', 'utf8'));
  const kEs = `"chemie-koffein":{title:${q(manK.i18n.es.title)},parts:[${manK.i18n.es.labels.map(q).join(',')}]}`;
  const gEs = `"gpu-example":{title:${q(manG.i18n.es.title)},parts:[${manG.i18n.es.labels.map(q).join(',')}]}`;
  const esAnchor = `"free-handbohrmaschine":{title:"Taladro manual",parts:["Carcasa","Mango","Portabrocas","Broca","Interruptor","Rejillas de ventilaci\\u00f3n"]}`;
  must(s.split(esAnchor).length - 1 === 1, 'ES-Anker fehlt');
  s = s.replace(esAnchor, `${esAnchor},${kEs},${gEs}`);
  console.log('  ES-Anreicherung: koffein+gpu');
}
{
  const measAnchor = `"free-handbohrmaschine":"L\\u00e4nge: 448 mm"`;
  must(s.split(measAnchor).length - 1 === 1, 'MEAS-Anker fehlt');
  s = s.replace(measAnchor, `${measAnchor},"chemie-koffein":"C=O-Bindungsl\\u00e4nge: 12,1 mm","gpu-example":"Kartenl\\u00e4nge: 267 mm"`);
  console.log('  MEAS: koffein+gpu');
}

// ---------- M5: Apply template edits ----------
function cutOnce(find, label) {
  must(s.split(find).length - 1 === 1, `M5 ${label}: Anker nicht eindeutig`);
  s = s.replace(find, '');
  console.log(`  M5 ${label}: entfernt`);
}
// T1: Remove sidebar track and curriculum badges.
cutOnce(`<span class="flex flex-wrap items-center gap-2 mb-1">\n<span :class="trackClass(lab.track)" class="text-xs font-bold px-2 py-1 rounded-full">{{lab.track}}</span>\n<span class="text-[11px] px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100">{{lab.curriculum_ref.badge}}</span>\n</span>\n`, 'Sidebar-Badges');
// T1b: Add a revision button to each model in the list.
{
  const anchor = `<li v-for="lab in filteredLabs" :key="lab.id">\n<button type="button" @click="selectLab(lab.id)" :class="lab.id===activeLabId?'ring-2 ring-indigo-500 border-indigo-500':'border-slate-200 dark:border-slate-700'" class="w-full text-left rounded-2xl p-3 border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all min-h-[44px]">\n<span class="block font-semibold leading-snug">{{lab.title[lang]}}</span>\n</button>\n</li>`;
  must(s.split(anchor).length - 1 === 1, 'M5 Stift-Anker nicht eindeutig');
  const pencil = `<li v-for="lab in filteredLabs" :key="lab.id">\n<div class="flex items-center gap-2">\n<button type="button" @click="selectLab(lab.id)" :class="lab.id===activeLabId?'ring-2 ring-indigo-500 border-indigo-500':'border-slate-200 dark:border-slate-700'" class="flex-1 min-w-0 text-left rounded-2xl p-3 border bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all min-h-[44px]">\n<span class="block font-semibold leading-snug">{{lab.title[lang]}}</span>\n</button>\n<button type="button" @click="openModify(lab.id)" :title="t('modifyOpen')" :aria-label="t('modifyOpen')" class="shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 min-h-[44px] min-w-[44px] text-base font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"><span aria-hidden="true">\u270E</span><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">{{t('modifyOpen')}}</span></button>\n</div>\n</li>`;
  s = s.replace(anchor, pencil);
  console.log('  M5 Stift-Buttons: je Modell direkt neben dem Namen (Overlay wie Generieren, Key-Wiederverwendung)');
}
// T2: Remove title badges.
cutOnce(`<div class="flex flex-wrap items-center gap-2 mb-2">\n<span :class="trackClass(activeLab.track)" class="text-xs font-bold px-3 py-1 rounded-full min-h-[28px] inline-flex items-center">{{activeLab.track}}</span>\n<span class="text-xs px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 inline-flex items-center">{{activeLab.curriculum_ref.badge}}</span>\n</div>\n`, 'Titel-Badges');
// T3: Remove the level selector.
{
  const start = `<div class="flex flex-wrap items-center gap-2 mb-4">\n<span class="text-sm font-semibold">{{t('level')}}:</span>`;
  const end = `{{t('profi')}}</button>\n</div>`;
  must(s.split(start).length - 1 === 1, 'M5 Niveau-Start nicht eindeutig');
  must(s.split(end).length - 1 === 1, 'M5 Niveau-Ende nicht eindeutig');
  const a0 = s.indexOf(start);
  const e0 = s.indexOf(end, a0) + end.length;
  s = s.slice(0, a0) + s.slice(e0 + 1);
  console.log('  M5 Niveau-Block: entfernt');
}
// T4: Remove the learning objectives block.
{
  const start = `<h3 class="font-bold mb-2">{{plural(activeLab.objectives[lang].length,t('goalOne'),t('goalMany'))}}</h3>`;
  const end = `{{o}}</li>\n</ul>`;
  must(s.split(start).length - 1 === 1, 'M5 Lernziele-Start nicht eindeutig');
  must(s.split(end).length - 1 === 1, 'M5 Lernziele-Ende nicht eindeutig');
  const a0 = s.indexOf(start);
  const e0 = s.indexOf(end, a0) + end.length;
  s = s.slice(0, a0) + s.slice(e0 + 1);
  console.log('  M5 Lernziele-Block: entfernt');
}
// T5: Remove the tasks section from the learning-mode details.
{
  const start = `<section class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<h3 class="text-lg font-bold mb-4">{{plural(visibleTasks.length,t('taskOne'),t('taskMany'))}}</h3>`;
  must(s.split(start).length - 1 === 1, 'M5 Aufgaben-Start nicht eindeutig');
  const a0 = s.indexOf(start);
  const e0 = s.indexOf('</section>', a0);
  must(e0 > a0, 'M5 Aufgaben-Ende fehlt');
  must(s.slice(a0, e0).split('<section').length - 1 === 1, 'M5 Aufgaben: verschachtelte section');
  s = s.slice(0, a0) + s.slice(e0 + '</section>'.length + 1);
  console.log('  M5 Aufgaben-Section: entfernt');
}
// T6: Unwrap the learning-mode details and remove its closing details tag.
cutOnce(`<details class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 transition-all">\n<summary class="font-bold cursor-pointer min-h-[44px] flex items-center text-lg">{{t("learnMode")}}</summary>\n`, 'Lernmodus-Oeffnung');
// T7: Remove curriculum details.
cutOnce(`<div><h4 class="font-bold mb-1">{{t('curriculumTitle')}}</h4><p class="text-sm"><strong>{{t('lfLabel')}}:</strong> {{activeLab.curriculum_ref.lf}}</p><p class="mt-1 text-sm"><strong>{{t('arpLabel')}}:</strong> {{activeLab.curriculum_ref.arp}}</p></div>\n`, 'Curriculum-Details');
// T8: Move the welcome banner to the end of <main>.
{
  const banner = `<div v-if="showOnboarding" class="rounded-2xl bg-indigo-600 text-white p-4 flex flex-wrap items-center gap-3 transition-all">\n<p class="flex-1 min-w-[200px]">{{t('onboarding')}}</p>\n<button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50">{{t('understood')}}</button>\n</div>\n`;
  must(s.split(banner).length - 1 === 1, 'M5 Banner nicht eindeutig');
  s = s.replace(banner, '');
  const mainEnd = `</details>\n</main>`;
  must(s.split(mainEnd).length - 1 === 1, 'M5 main-Ende nicht eindeutig');
  s = s.replace(mainEnd, `</details>\n${banner}</main>`);
  console.log('  M5 Banner: ans Ende von <main> verlegt');
}
// T6b (after T8): remove the closing learning-mode </details> tag.
{
  const anchor = `</section>\n</details>\n<div v-if="showOnboarding"`;
  must(s.split(anchor).length - 1 === 1, 'M5 Lernmodus-Schluss nicht eindeutig');
  s = s.replace(anchor, `</section>\n<div v-if="showOnboarding"`);
  console.log('  M5 Lernmodus-Schluss: entfernt');
}
// T9: Localize the aside aria-label.
{
  const anchor = `<aside aria-label="Labs"`;
  must(s.split(anchor).length - 1 === 1, 'M5 aside-Anker fehlt');
  s = s.replace(anchor, `<aside :aria-label="t('labs')"`);
  console.log('  M5 aside-label: i18n');
}
// T10: Remove learning-field and ARP text from the S5 badge.
{
  const anchor = `{id:"S5",label:"Curriculum",detail:hasCurr?lab.curriculum_ref.badge:"-",ok:hasCurr}`;
  must(s.split(anchor).length - 1 === 1, 'M5 S5-Anker fehlt');
  s = s.replace(anchor, `{id:"S5",label:"Curriculum",detail:hasCurr?"ok":"-",ok:hasCurr}`);
  console.log('  M5 S5-Badge: neutralisiert');
}
// T11: Insert the fixed revision overlay before the revision panel's closing section.
{
  const anchor = `<p v-if="modStatus" :class="modStatusBad ? 'mt-2 text-sm text-red-600 dark:text-red-400' : 'mt-2 text-sm text-emerald-700 dark:text-emerald-300'">{{modStatus}}</p>\n</section>`;
  must(s.split(anchor).length - 1 === 1, 'M5 Modify-Anker fehlt');
  const overlay = `<p v-if="modStatus" :class="modStatusBad ? 'mt-2 text-sm text-red-600 dark:text-red-400' : 'mt-2 text-sm text-emerald-700 dark:text-emerald-300'">{{modStatus}}</p>\n</section>\n<div v-if="modOverlay" class="fixed bottom-16 right-4 z-50 w-[min(92vw,24rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4" role="dialog" :aria-label="t('modifyTitle')">\n<h3 class="font-bold mb-1">{{t('modifyTitle')}}: {{activeLab.title[lang]}}</h3>\n<p class="text-xs text-slate-500 dark:text-slate-400 mb-2">{{t('providerFixed')}} · {{genModel}}</p>\n<label class="block text-sm font-medium mb-1" for="mod-desc2">{{t('modDescPh')}}</label>\n<textarea id="mod-desc2" v-model="modDesc" rows="2" class="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"></textarea>\n<div class="mt-2 flex flex-wrap gap-2">\n<button type="button" @click="submitModify" :disabled="modBusy" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] text-sm font-semibold disabled:opacity-50">{{t('modifyBtn')}}</button>\n<button type="button" @click="closeModify" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t('genClose')}}</button>\n</div>\n<p v-if="modStatus" :class="modStatusBad ? 'mt-2 text-sm text-red-600 dark:text-red-400' : 'mt-2 text-sm text-emerald-700 dark:text-emerald-300'">{{modStatus}}</p>\n</div>`;
  s = s.replace(anchor, overlay);
  console.log('  M5 Modify-Overlay: eingefuegt');
}

// ---------- M6: Set Baseten provider, localization, and runtime behavior ----------
// M6a: Change the prompt's room-light intensity from 900 to the scaled value 5.
{
  const anchor = `PointLight(0xffffff, 900, 28, 2)`;
  must(s.split(anchor).length - 1 === 1, 'M6 Prompt-900 nicht eindeutig');
  s = s.replace(anchor, `PointLight(0xffffff, 5, 28, 2) (auf 2-m-Raum skaliert; 900 gilt nur im 30-m-Referenzraum)`);
  console.log('  M6 Prompttext: Raumlicht 5');
}
// M6b: Update endpoints and request headers.
{
  const urlOld = `https://openrouter.ai/api/v1/chat/completions`;
  must(s.split(urlOld).length - 1 === 3, 'M6 URL-Zaehler != 3');
  s = s.split(urlOld).join(`https://inference.baseten.co/v1/chat/completions`);
  const hdr = `headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json","HTTP-Referer":"https://modelmuse.local","X-Title":"ModelMuse"}`;
  must(s.split(hdr).length - 1 === 2, 'M6 Header-Zaehler != 2');
  s = s.split(hdr).join(`headers:{Authorization:"Bearer "+this.genKey,"Content-Type":"application/json"}`);
  console.log('  M6 Endpoint/Header: Baseten');
}
// M6c: Update JavaScript defaults.
{
  const pairs = [
    [`genProvider:"openrouter-direct"`, `genProvider:"baseten-direct"`],
    [`genModel:"meta/muse-spark-1.3-contributor"`, `genModel:"meta-models/muse-spark-open-1026"`],
    [`genDirectUrl:"https://openrouter.ai/api/v1/chat/completions"`, `genDirectUrl:"https://inference.baseten.co/v1/chat/completions"`],
  ];
  // genDirectUrl was already updated in M6b; validate it here.
  must(s.includes(`genDirectUrl:"https://inference.baseten.co/v1/chat/completions"`), 'M6 genDirectUrl-Default fehlt');
  for (const [a, b] of pairs.slice(0, 2)) {
    must(s.split(a).length - 1 === 1, `M6 Default ${a} fehlt`);
    s = s.replace(a, b);
  }
  const prov = `{id:"openrouter-direct",label:"OpenRouter (direkt)",kind:"direct",models:["meta/muse-spark-1.3-contributor","google/gemma-4-26b-a4b-it:free"]}`;
  must(s.split(prov).length - 1 === 1, 'M6 genProviders fehlt');
  s = s.replace(prov, `{id:"baseten-direct",label:"Baseten (direkt)",kind:"direct",models:["meta-models/muse-spark-open-1026"]}`);
  console.log('  M6 Defaults: Baseten muse-spark-open-1026');
}
// M6d: Add the source fallback, overlay methods, and state.
{
  const anchor = `var src=(lab&&(lab._source||lab.source))||null;`;
  must(s.split(anchor).length - 1 === 1, 'M6 Modify-Source-Anker fehlt');
  s = s.replace(anchor, `var src=(lab&&(lab._source||lab.source))||null;if(!src){try{src=(window.__SOURCES||{})[lab.id]||null;}catch(eSrc){}}`);
  must(!s.includes('openModify:function'), 'M6 openModify schon vorhanden');
  const methods = `openModify:function(id){try{this.selectLab(id);}catch(e){this.activeLabId=id;}try{var k=sessionStorage.getItem("modelmuse-proxy-key");if(k&&!this.genKey){this.genKey=k;}}catch(e2){}this.modOverlay=true;this.modStatus="";this.modStatusBad=false;},\ncloseModify:function(){this.modOverlay=false;},\nsubmitModify:function(){if(!this.genKey){this.modStatus=this.t('keyMissing');this.modStatusBad=true;try{var el=document.getElementById('gen-key');if(el){el.scrollIntoView({block:"center"});el.focus();}}catch(e){}return;}this.modify();},`;
  // No closeModify method exists yet; append the methods after dismissGenNotice.
  const dAnchor = `dismissGenNotice:function(){try{if(this.genNoticeTimer){clearTimeout(this.genNoticeTimer);}}catch(e){}this.genNoticeTimer=null;this.genNotice=null;},`;
  must(s.split(dAnchor).length - 1 === 1, 'M6 Methoden-Anker fehlt');
  s = s.replace(dAnchor, dAnchor + methods);
  const dataAnchor = `modDesc:"",modStatus:"",modStatusBad:false,modBusy:false,`;
  must(s.split(dataAnchor).length - 1 === 1, 'M6 Data-Anker fehlt');
  s = s.replace(dataAnchor, `modOverlay:false,${dataAnchor}`);
  console.log('  M6 Modify: SOURCES-Fallback + Overlay-Methoden');
}
// M6e: Update localized text, template copy, and provider details.
{
  const t = [
    [`I18N.de.directHint="Direktaufruf OpenRouter in deinem Browser. Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";`, `I18N.de.directHint="Direktaufruf Baseten in deinem Browser (OpenAI-kompatibel). Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.";`],
    [`I18N.en.directHint="Direct OpenRouter call in your browser. No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.";`, `I18N.en.directHint="Direct Baseten call in your browser (OpenAI-compatible). No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.";`],
    [`I18N.de.keyMissing="OpenRouter-Key fehlt. Fuege oben deinen Key ein.";`, `I18N.de.keyMissing="Baseten-Key fehlt. Fuege oben deinen Key ein.";`],
    [`I18N.en.keyMissing="OpenRouter key missing. Paste your key above.";`, `I18N.en.keyMissing="Baseten key missing. Paste your key above.";`],
    [`I18N.de.keyInvalid="Key falsch (401). Pruefe deinen OpenRouter-Key.";`, `I18N.de.keyInvalid="Key falsch (401). Pruefe deinen Baseten-Key.";`],
    [`I18N.en.keyInvalid="Wrong key (401). Check your OpenRouter key.";`, `I18N.en.keyInvalid="Wrong key (401). Check your Baseten key.";`],
    [`I18N.de.providerFixed="OpenRouter (direkt)";`, `I18N.de.providerFixed="Baseten (direkt)";`],
    [`I18N.en.providerFixed="OpenRouter (direct)";`, `I18N.en.providerFixed="Baseten (direct)";`],
    [`I18N.de.modDone="Überarbeitung geladen.";`, `I18N.de.modDone="Überarbeitung geladen.";I18N.de.modifyOpen="Überarbeiten";`],
    [`I18N.en.modDone="Revision loaded.";`, `I18N.en.modDone="Revision loaded.";I18N.en.modifyOpen="Revise";`],
  ];
  for (const [a, b] of t) {
    must(s.split(a).length - 1 === 1, `M6 I18N-Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  const esT = [
    [`labs:"Laboratorios"`, `labs:"Modelos"`],
    [`providerFixed:"OpenRouter (directo)"`, `providerFixed:"Baseten (directo)"`],
    [`directHint:"Llamada directa a OpenRouter en tu navegador. Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso."`, `directHint:"Llamada directa a Baseten en tu navegador (compatible con OpenAI). Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso."`],
    [`keyMissing:"Falta la clave OpenRouter. Pega tu clave arriba."`, `keyMissing:"Falta la clave Baseten. Pega tu clave arriba."`],
    [`keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave OpenRouter."`, `keyInvalid:"Clave inv\\u00e1lida (401). Comprueba tu clave Baseten."`],
    [`generatorHint:"Describe un objeto y crea un nuevo laboratorio con OpenRouter (clave propia, directo en el navegador)."`, `generatorHint:"Describe un objeto y crea un nuevo modelo con Baseten (clave propia, directo en el navegador)."`],
    [`modDone:"Revision cargada."`, `modDone:"Revision cargada.",modifyOpen:"Revisar"`],
  ];
  for (const [a, b] of esT) {
    must(s.split(a).length - 1 === 1, `M6 ES-Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  // Update German, English, and Spanish catalogue, onboarding, and detail copy.
  const litT = [
    [`labs:"Labs",noResults:"Keine Labs gefunden. Passe deine Suche an."`, `labs:"Modelle",noResults:"Keine Modelle gefunden. Passe deine Suche an."`],
    [`labs:"Labs",noResults:"No labs found. Adjust your search."`, `labs:"Models",noResults:"No models found. Adjust your search."`],
    [`onboarding:"Willkommen bei ModelMuse! Wähle links ein Lab oder generiere ein eigenes Modell."`, `onboarding:"Willkommen bei ModelMuse! Wähle links ein Modell oder generiere ein eigenes Modell."`],
    [`onboarding:"Welcome to ModelMuse! Pick a lab on the left or generate your own model."`, `onboarding:"Welcome to ModelMuse! Pick a model on the left or generate your own model."`],
    [`onboarding:"\\u00a1Bienvenido a ModelMuse! Elige un laboratorio a la izquierda o genera tu propio modelo."`, `onboarding:"\\u00a1Bienvenido a ModelMuse! Elige un modelo a la izquierda o genera tu propio modelo."`],
    [`searchPlaceholder:"Labs suchen …"`, `searchPlaceholder:"Modelle suchen …"`],
    [`searchPlaceholder:"Search labs …"`, `searchPlaceholder:"Search models …"`],
    [`searchPlaceholder:"Buscar laboratorios \\u2026"`, `searchPlaceholder:"Buscar modelos \\u2026"`],
    [`generatorHint:"Beschreibe ein Objekt, wähle Provider und Modell und erzeuge ein neues 3D-Labor."`, `generatorHint:"Beschreibe ein Objekt und erzeuge ein neues 3D-Modell (Baseten-Direkt, Key nur Sitzung)."`],
    [`generatorHint:"Describe an object, pick provider and model, and create a new 3D lab."`, `generatorHint:"Describe an object and create a new 3D model (Baseten direct, key session-only)."`],
    [`detailsTitle="Details (Messwerte, Labels, Curriculum)";`, `detailsTitle="Details (Messungen, Labels)";`],
    [`detailsTitle="Details (measurements, labels, curriculum)";`, `detailsTitle="Details (measurements, labels)";`],
    [`detailsTitle:"Detalles (mediciones, etiquetas, curr\\u00edculo)"`, `detailsTitle:"Detalles (mediciones, etiquetas)"`],
  ];
  for (const [a, b] of litT) {
    must(s.split(a).length - 1 === 1, `M6 Literal-Anker fehlt: ${a.slice(0, 50)}`);
    s = s.replace(a, b);
  }
  // Update the genDetails paragraph; M6b already changed its URL to Baseten.
  const gd = `OpenRouter-Direkt: POST https://inference.baseten.co/v1/chat/completions · Modelle meta/muse-spark-1.3-contributor (Default) + google/gemma-4-26b-a4b-it:free (Fallback) · Timeout 120 s · Key nur sessionStorage (modelmuse-proxy-key).`;
  must(s.split(gd).length - 1 === 1, 'M6 genDetails-Absatz fehlt');
  s = s.replace(gd, `Baseten-Direkt: POST https://inference.baseten.co/v1/chat/completions · Modell meta-models/muse-spark-open-1026 · Timeout 120 s · Key nur sessionStorage (modelmuse-proxy-key).`);
  // Replace unused proxy and Muse hints so they do not contradict the no-proxy flow.
  const deadT = [
    [`proxyHint:"Der Proxy läuft lokal. Starte ihn bei Bedarf mit npm run proxy."`, `proxyHint:"Kein Proxy nötig. Der Aufruf geht direkt an Baseten."`],
    [`museHint:"Muse läuft lokal über muse.exe. Kopiere den Prompt und führe das Kommando aus."`, `museHint:"Ohne muse.exe in diesem Fluss."`],
    [`proxyHint:"The proxy runs locally. Start it with npm run proxy if needed."`, `proxyHint:"No proxy needed. Calls go directly to Baseten."`],
    [`museHint:"Muse runs locally via muse.exe. Copy the prompt and run the command."`, `museHint:"No muse.exe in this flow."`],
    [`proxyHint:"Sin proxy local. La llamada va directa a OpenRouter."`, `proxyHint:"Sin proxy. La llamada va directa a Baseten."`],
  ];
  for (const [a, b] of deadT) {
    must(s.split(a).length - 1 === 1, `M6 Dead-Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  console.log('  M6 Proxy-Hinweise: kohärent (kein Proxy-Port)');
  // Update the API-key placeholder.
  must(s.split('placeholder="sk-or-..."').length - 1 === 1, 'M6 Key-Placeholder fehlt');
  s = s.replace('placeholder="sk-or-..."', 'placeholder="Baseten-API-Key"');
  console.log('  M6 I18N/Provider-Texte: Baseten + Modelle');
}
// M6f: Remove localization keys for features removed from the UI.
{
  const deKeys = [
    `level:"Niveau",basis:"Basis",aufbau:"Aufbau",profi:"Profi",`,
    `goalOne:"Lernziel",goalMany:"Lernziele",`,
    `taskOne:"Aufgabe",taskMany:"Aufgaben",`,
    `measurementOne:"Messung",measurementMany:"Messungen",`,
    `labelOne:"Beschriftung",labelMany:"Beschriftungen",`,
    `curriculumTitle:"Curriculum-Details",`,
    `check:"Prüfen",`,
    `correct:"Richtig! Gut gemacht.",wrong:"Leider falsch – versuche es erneut.",manual:"Eingereicht, manuell zu prüfen.",`,
    `answerPlaceholder:"Deine Antwort …",inputLabel:"Deine Eingabe",`,
    `lfLabel:"Lernfeld",arpLabel:"ARP-Block",`,
    `type_zuordnung:"Zuordnung",type_messwert:"Messwert",type_fehlersuche:"Fehlersuche",type_transfer:"Transfer",`,
    `tolerance:"Toleranz",`,
  ];
  const enKeys = [
    `level:"Level",basis:"Basic",aufbau:"Intermediate",profi:"Pro",`,
    `goalOne:"objective",goalMany:"objectives",`,
    `taskOne:"task",taskMany:"tasks",`,
    `measurementOne:"measurement",measurementMany:"measurements",`,
    `labelOne:"label",labelMany:"labels",`,
    `curriculumTitle:"Curriculum details",`,
    `check:"Check",`,
    `correct:"Correct! Well done.",wrong:"Not correct – try again.",manual:"Submitted, needs manual review.",`,
    `answerPlaceholder:"Your answer …",inputLabel:"Your input",`,
    `lfLabel:"Learning field",arpLabel:"ARP block",`,
    `type_zuordnung:"Matching",type_messwert:"Measurement",type_fehlersuche:"Troubleshooting",type_transfer:"Transfer",`,
    `tolerance:"Tolerance",`,
  ];
  const esKeys = [
    `level:"Nivel",basis:"B\\u00e1sico",aufbau:"Intermedio",profi:"Avanzado",`,
    `goalOne:"Objetivo",goalMany:"Objetivos",`,
    `taskOne:"Tarea",taskMany:"Tareas",`,
    `measurementOne:"Medici\\u00f3n",measurementMany:"Mediciones",`,
    `labelOne:"Etiqueta",labelMany:"Etiquetas",`,
    `curriculumTitle:"Detalles del curr\\u00edculo",`,
    `check:"Comprobar",`,
    `correct:"\\u00a1Correcto! Bien hecho.",wrong:"Incorrecto \\u2013 int\\u00e9ntalo de nuevo.",manual:"Enviado, pendiente de revisi\\u00f3n manual.",`,
    `answerPlaceholder:"Tu respuesta \\u2026",inputLabel:"Tu entrada",`,
    `lfLabel:"Campo de aprendizaje",arpLabel:"Bloque ARP",`,
    `type_zuordnung:"Asignaci\\u00f3n",type_messwert:"Medici\\u00f3n",type_fehlersuche:"B\\u00fasqueda de errores",type_transfer:"Transferencia",`,
    `tolerance:"Tolerancia",`,
  ];
  for (const k of [...deKeys, ...enKeys, ...esKeys]) {
    must(s.split(k).length - 1 === 1, `M6 Key fehlt: ${k.slice(0, 40)}`);
    s = s.replace(k, '');
  }
  // Remove the three learnMode keys; T6 removed the template summary.
  for (const k of [`learnMode:"Lernmodus",`, `learnMode:"Learn mode",`, `learnMode:"Modo de aprendizaje",`]) {
    must(s.split(k).length - 1 === 1, `M6 learnMode-Key fehlt: ${k.slice(0, 30)}`);
    s = s.replace(k, '');
  }
  console.log('  M6 Feature-Keys: entfernt');
}

// ---------- M8: UI-Fixes (Theme-Systemdefault, Fortschrittsleiste raus, Status-Overlay) ----------
// M8a: Theme-Default aus System (prefers-color-scheme), Toggle bleibt.
{
  const htmlOpen = `<html lang="de" class="dark">\n<head>`;
  must(s.split(htmlOpen).length - 1 === 1, 'M8 html-Anker fehlt');
  s = s.replace(htmlOpen, `<html lang="de">\n<head>\n<script>\n/*ModelMuse Theme-Init: Systemeinstellung (prefers-color-scheme) als Default, gespeicherte Wahl gewinnt (Toggle bleibt).*/\ntry{var __ssTheme=null;try{__ssTheme=localStorage.getItem("modelmuse.theme");}catch(eSS){}if(__ssTheme!=="light"&&__ssTheme!=="dark"){__ssTheme=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}if(__ssTheme==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(eSS2){}\n</script>`);
  console.log('  M8 Theme-Init: Systemdefault + Toggle');
  const dataTheme = `lang:"de",theme:"dark",search:""`;
  must(s.split(dataTheme).length - 1 === 1, 'M8 Data-Theme-Anker fehlt');
  s = s.replace(dataTheme, `lang:"de",theme:(function(){try{var __t=null;try{__t=localStorage.getItem("modelmuse.theme");}catch(eT){}if(__t==="light"||__t==="dark")return __t;if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";return "dark";}catch(eT2){return "dark";}})(),search:""`);
  const mountTheme = `var th=localStorage.getItem("modelmuse.theme");if(th==="light"||th==="dark"){this.theme=th;}var prog=localStorage.getItem("modelmuse.progress");if(prog){var p=JSON.parse(prog);if(p.taskState){this.taskState=p.taskState;}}`;
  must(s.split(mountTheme).length - 1 === 1, 'M8 Mounted-Anker fehlt');
  s = s.replace(mountTheme, `var th=localStorage.getItem("modelmuse.theme");if(th==="light"||th==="dark"){this.theme=th;}else{try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";}else{this.theme="dark";}}catch(eTh){}}`);
  console.log('  M8 Theme-Data/Mounted: Systemdefault');
}
// M8b: Fortschrittsleiste rechts oben restlos entfernen (Markup + JS + Key).
{
  const progBox = `{{t('light')}}</button>\n</div>\n<div class="flex items-center gap-2 min-w-[220px] flex-1 sm:flex-none sm:min-w-[260px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">\n</div>\n</div>\n</header>`;
  must(s.split(progBox).length - 1 === 1, 'M8 Progress-Box-Anker fehlt');
  s = s.replace(progBox, `{{t('light')}}</button>\n</div>\n</div>\n</header>`);
  const saveProg = `saveProgress:function(){try{localStorage.setItem("modelmuse.progress",JSON.stringify({taskState:this.taskState}));}catch(e){}},\n`;
  must(s.split(saveProg).length - 1 === 1, 'M8 saveProgress-Anker fehlt');
  s = s.replace(saveProg, '');
  const checkSave = `this.taskState[task.id]={status:status};this.saveProgress();},`;
  must(s.split(checkSave).length - 1 === 1, 'M8 checkTask-Anker fehlt');
  s = s.replace(checkSave, `this.taskState[task.id]={status:status};},`);
  console.log('  M8 Fortschrittsleiste: Box + Persistenz entfernt');
}
// M8c: Generator-Status-Overlay umbenennen (kein Progress-Rest).
{
  const v10c = `<!-- V10 Fortschritts-Overlay: fixiert unten rechts, Seite bleibt bedienbar (generate async) --><div id="gen-progress"`;
  must(s.split(v10c).length - 1 === 1, 'M8 V10-Anker fehlt');
  s = s.replace(v10c, `<!-- V10 Status-Overlay: fixiert unten rechts, Seite bleibt bedienbar (generate async) --><div id="gen-status"`);
  console.log('  M8 Status-Overlay: umbenannt');
}

// ---------- M7: Update title and stamp, then validate invariants and write the report ----------
{
  const t = [
    [`<title>ModelMuse Generator 3D-Viewer v12-guide</title>`, `<title>ModelMuse Modelle v13-standalone (GitHub-Pages)</title>`],
    [`viewerBadge:"3D-Viewer v12-guide"`, `viewerBadge:"Modelle v13-standalone"`],
    [`viewerBadge:"3D Viewer v12-guide"`, `viewerBadge:"Models v13-standalone"`],
    [`viewerBadge:"Visor 3D v12-guide"`, `viewerBadge:"Modelos v13-standalone"`],
    [`<!-- standalone-build v12-guide: Guide Abs. 2-3 (PCFShadowMap, IBL-Raum, 4-Lichter, DPR-Cap, Negativ-Liste) via scripts/build-standalone.mjs -->`, `<!-- standalone-build v13 (GitHub-Pages-Auslieferung, kein Backend): Modelle aus src/models (Harness-verifiziert), 2D-Metamodule aus Manifesten, Provider Baseten-Direkt, via scripts/build-standalone-v13.mjs --><!-- standalone-build v12-guide: Guide Abs. 2-3 via scripts/build-standalone.mjs -->`],
  ];
  for (const [a, b] of t) {
    must(s.split(a).length - 1 === 1, `M7 Anker fehlt: ${a.slice(0, 50)}`);
    s = s.replace(a, b);
  }
  console.log('  M7 Titel/Badges: v13-standalone');
}
// Validate artifact invariants.
{
  const cnt = (sub) => s.split(sub).length - 1;
  const inv = [
    ['PointLight(0xffffff, 900', 0], ['0x11141a', 0], ['envMapIntensity', 0],
    ['mapSize.set(2048', 0], ['PCFSoftShadowMap', 5], ['openrouter', 0], ['OpenRouter', 0],
    ['{{lab.track}}', 0], ['{{activeLab.track}}', 0], ['curriculum_ref.badge}}</span>', 0],
    ['curriculum_ref.lf', 0], ['curriculum_ref.arp', 0],
    ["{{t(\"learnMode\")}}", 0], ["{{t('level')}}", 0], ['goalOne', 0], ['learnMode', 0],
    ['<html lang="de" class="dark">', 0], ['<html lang="de">', 1],
    ['theme:"dark"', 0], ['prefers-color-scheme', 4],
    ['min-w-[220px]', 0], ['saveProgress', 0], ['modelmuse.progress', 0],
    ['gen-progress', 0], ['id="gen-status"', 1],
    ['Fortschritt', 0], ['fortschritt', 0],
    ['mt-2 w-full inline-flex', 0],
    ['standalone-build v13', 1],
  ];
  for (const [sub, want] of inv) must(cnt(sub) === want, `Invariante ${sub}: ${cnt(sub)}, erwartet ${want}`);
  must(cnt('shrink-0 inline-flex items-center justify-center rounded-xl border') === 1, `Stift-neben-Name: ${cnt('shrink-0 inline-flex items-center justify-center rounded-xl border')}, erwartet 1`);
  must(cnt('PointLight(0xffffff, 5, 28, 2)') === 11, `Raumlicht 5 (spaced): ${cnt('PointLight(0xffffff, 5, 28, 2)')}, erwartet 11 (5 Code + 5 SOURCES + 1 Prompt)`);
  must(cnt('PointLight(0xffffff,5,28,2)') === 2, `Raumlicht 5 (si-3): ${cnt('PointLight(0xffffff,5,28,2)')}, erwartet 2 (1 Code + 1 SOURCES)`);
  must(cnt('0xcccccc') === 13, `0xcccccc: ${cnt('0xcccccc')}, erwartet 13 (6 Code + 6 SOURCES + 1 Prompt)`);
  must(cnt('environmentIntensity') === 13, `environmentIntensity: ${cnt('environmentIntensity')}, erwartet 13 (6 Code + 6 SOURCES + 1 Glue)`);
  must(cnt('inference.baseten.co/v1/chat/completions') === 3, 'Baseten-Endpoint != 3');
  must(cnt('meta-models/muse-spark-open-1026') === 3, 'Baseten-Modell != 3');
  must(cnt('window.__SOURCES') === 2, 'SOURCES != 2');
  must(cnt('modifyOpen') === 6, `modifyOpen: ${cnt('modifyOpen')}, erwartet 6 (3 Template + 3 Locales)`);
  must(cnt('openModify:function') === 1, 'openModify-Methode fehlt');
  must(cnt('@click="openModify') === 1, 'Stift-Button fehlt');
  must(cnt('modOverlay') === 4, `modOverlay: ${cnt('modOverlay')}, erwartet 4`);
  for (const id of ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine']) {
    must(cnt(`META['${id}']`) >= 1, `META ${id} fehlt`);
    must(cnt(`{id:"${id}"`) >= 1, `LABS ${id} fehlt`);
  }
  for (const id of ['dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3']) {
    must(cnt(`INIT['${id}'] = `) === 0, `tote INIT ${id} noch da`);
  }
  for (const id of ['si-1', 'si-2', 'si-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine']) {
    must(cnt(`INIT['${id}'] = `) === 1, `INIT ${id} fehlt`);
  }
  must(s.length < 600000, `Datei zu gross: ${s.length}`);
  console.log('  Invarianten ok');
}

await writeFile(FILE, s);
console.log(`build-v13: geschrieben (${s.length} Zeichen)`);
const cntR = (sub) => s.split(sub).length - 1;
const report = {
  createdAt: new Date().toISOString(),
  basis: 'v12-guide',
  standalone: 'v13',
  guide: 'docs/implementation-guide-3d-qualitaet.md Abschnitte 2-3',
  fixes: ['M1 3D neu si-1/si-2/si-3/bohrmaschine aus src/models', 'M2 3D neu chemie-koffein/gpu-example', 'M3 2D-Metamodule dup/ae aus Manifesten, tote 3D-INITs raus', 'M4 Ueberstrahlung (Raumlicht 5, kein 900/2048/PCFSoft/envMap)', 'M5 UI: Ziele/Niveau/Modus/Track/Badge/Curriculum raus, Modelle-Labels, Banner unten, Stift-Modify', 'M6 Provider Baseten-Direkt muse-spark-open-1026, kein OpenRouter, kein Proxy-Port',    'M7 Titel v13-standalone', 'M8 UI: Theme-Systemdefault, Fortschrittsleiste raus, Stift neben Namen'],
  counts: {
    zeichen: s.length, raumlicht5: cntR('PointLight(0xffffff, 5, 28, 2)'), raumlicht900: cntR('PointLight(0xffffff, 900'),
    labs: ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine'].map((id) => ({ id, labs: cntR(`{id:"${id}"`), meta: cntR(`META['${id}']`) })),
  },
};
if (REPORT) {
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('build-v13: OK v13');
} else {
  console.log('build-v13: DRY-RUN ok (kein Report geschrieben)');
}

