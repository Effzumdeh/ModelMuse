/**
 * Showcase-Builder: bettet 5 3D-Erststart-Defaults in das leere
 * v13-Standalone-Artefakt ein (LABS/META/INIT + __SOURCES + ES/MEAS).
 * Idempotent: Zweitlauf meldet "bereits showcase" (exit 0, ohne Schreiben).
 * Laeuft NUR auf der Empty-Stand-Basis (const LABS=[]).
 *
 * Showcase (je Domaene 1): arch-brandenburger-tor (Architektur, neu),
 * si-1 (Informatik), chemie-koffein (Chemie),
 * free-handbohrmaschine (Mechanik), gpu-example (Hardware/Computergrafik).
 * Alle 5: Harness-gruen (scripts/showcase-harness.mjs, Iter 0).
 *
 * Aufruf: node scripts/build-showcase.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const SHOWCASE = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example'];
const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-showcase-report.json';

function must(cond, msg) {
  if (!cond) { console.error('showcase: FEHLER ' + msg); process.exit(1); }
}
const q = (x) => JSON.stringify(x);

let s = await readFile(FILE, 'utf8');
console.log(`showcase: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v13'), 'kein v13-Stempel (falsche Basis)');
if (s.includes('{id:"arch-brandenburger-tor"')) {
  console.log('showcase: bereits Showcase (arch-brandenburger-tor vorhanden) — nichts zu tun (idempotent, exit 0)');
  process.exit(0);
}
must(s.includes('const LABS=[];'), 'keine Empty-Stand-Basis (LABS nicht leer)');
must(s.includes('window.__SOURCES = {};'), 'SOURCES-Anker fehlt');
must(s.split('PointLight(0xffffff, 900').length - 1 === 0, 'Basis enthaelt Raumlicht 900 (falsche Basis)');

// ---------- 1) Modell-Codebloecke (Muster build-standalone-v13 M1) ----------
const destrM = /const \{ ([^}]*) \} = THREE;/.exec(s);
must(destrM, 'THREE-Destruktorliste fehlt');
const HAVE = new Set(destrM[1].split(',').map((x) => x.trim()));
const blocks = [];
for (const id of SHOWCASE) {
  const sid = id.replace(/-/g, '_');
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  const im = /import \{ ([^}]*) \} from 'three';/.exec(src);
  must(im, `${id}: three-Import fehlt`);
  const missing = im[1].split(',').map((x) => x.trim()).filter((x) => !HAVE.has(x));
  must(missing.length === 0, `${id}: fehlende THREE-Namen: ${missing.join(',')}`);
  must(src.includes("from 'three/addons/controls/OrbitControls.js'"), `${id}: OrbitControls-Import fehlt`);
  must(src.includes("from 'wrapper-helpers'"), `${id}: wrapper-helpers-Import fehlt`);
  let body = src.split('\n').filter((ln) => !ln.startsWith('import ')).join('\n');
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
  must(!body.includes('900, 28, 2'), `${id}: Raumlicht 900`);
  must(!body.includes('envMapIntensity'), `${id}: envMapIntensity`);
  must(!body.includes('PCFSoftShadowMap'), `${id}: PCFSoft`);
  must(!body.includes('0x11141a'), `${id}: Dunkel-Raum`);
  must(!body.includes('mapSize.set(2048'), `${id}: mapSize 2048`);
  must(body.includes('scene.environmentIntensity = 0.55'), `${id}: environmentIntensity fehlt`);
  blocks.push(`{\n${body}\nINIT['${id}'] = init_${sid};\nMETA['${id}'] = meta_${sid};\nMETA['${id}'].is3d = true;\n}`);
  console.log(`  Block ${id}: ${body.length} Zeichen`);
}
const metaAnchor = 'const META = {};';
must(s.split(metaAnchor).length - 1 === 1, 'META-Anker nicht eindeutig');
s = s.replace(metaAnchor, `${metaAnchor}\n${blocks.join('\n')}`);

// ---------- 2) LABS-Eintraege aus Manifesten (de/en/es, 3 Tasks) ----------
function hintsFor(type, p0) {
  const H = {
    de: ['Suche das Bauteil in der Ansicht.', 'Nutze die Bauteilliste.', 'Zoome an das Bauteil heran.'],
    en: ['Find the part in the view.', 'Use the parts list.', 'Zoom to the part.'],
    es: ['Busca la pieza en la vista.', 'Usa la lista de piezas.', 'Acercate a la pieza.'],
  };
  if (type === 'messwert') {
    H.de = ['Suche die Messlinie.', 'Lies Zahl plus Einheit.', 'Pruefe mm/cm/m.'];
    H.en = ['Find the measure line.', 'Read number plus unit.', 'Check mm/cm/m.'];
    H.es = ['Busca la linea de medida.', 'Lee numero y unidad.', 'Comprueba mm/cm/m.'];
  } else if (type === 'transfer' || type === 'fehlersuche') {
    H.de = ['Denke an die Hauptfunktion.', 'Verbinde Form und Aufgabe.', 'Erklaere in einem Satz.'];
    H.en = ['Think about the main function.', 'Connect shape and task.', 'Explain in one sentence.'];
    H.es = ['Piensa en la funcion principal.', 'Relaciona forma y tarea.', 'Explica en una frase.'];
  }
  return `{de:[${H.de.map(q).join(',')}],en:[${H.en.map(q).join(',')}],es:[${H.es.map(q).join(',')}]}`;
}
function labsEntry(id, man) {
  const en = man.i18n?.en ?? {};
  const es = man.i18n?.es ?? {};
  const track = man.track === 'SI' ? 'SI' : 'Free';
  const title = { de: man.title ?? id, en: en.title ?? man.title ?? id, es: es.title ?? en.title ?? man.title ?? id };
  const labels = { de: man.labels, en: en.labels ?? man.labels, es: es.labels ?? en.labels ?? man.labels };
  const objectives = {
    de: man.objectives ?? [],
    en: en.objectives ?? man.objectives ?? [],
    es: es.objectives ?? en.objectives ?? man.objectives ?? [],
  };
  const measurements = (man.measurements ?? []).map((m) => {
    const men = (en.measurements ?? []).find((x) => x.id === m.id);
    const mes = (es.measurements ?? []).find((x) => x.id === m.id);
    return `{id:${q(m.id)},text:{de:${q(m.text)},en:${q(men?.text ?? m.text)},es:${q(mes?.text ?? men?.text ?? m.text)}},unit:${q(m.unit ?? 'cm')}}`;
  });
  const tasks = (man.tasks ?? []).map((t) => {
    const ten = (en.tasks ?? []).find((x) => x.id === t.id);
    const tes = (es.tasks ?? []).find((x) => x.id === t.id);
    return `{id:${q(t.id)},type:${q(t.type)},tolerance:${Number(t.tolerance ?? 0)},expected:${q(t.expected ?? '')},prompt:{de:${q(t.prompt)},en:${q(ten?.prompt ?? t.prompt)},es:${q(tes?.prompt ?? ten?.prompt ?? t.prompt)}},hints:${hintsFor(t.type, t.prompt)}}`;
  });
  const p0 = man.labels[0] ?? 'Bauteil';
  const quiz = `{q:{de:${q(`Welches Bauteil gehoert zu ${title.de}?`)},en:${q(`Which part belongs to ${title.en}?`)},es:${q(`Que pieza pertenece a ${title.es}?`)}},options:{de:[${q(labels.de[0] ?? p0)},${q(labels.de[1] ?? p0)},${q(labels.de[2] ?? p0)},"Keines davon"],en:[${q(labels.en[0] ?? p0)},${q(labels.en[1] ?? p0)},${q(labels.en[2] ?? p0)},"None of these"],es:[${q(labels.es[0] ?? p0)},${q(labels.es[1] ?? p0)},${q(labels.es[2] ?? p0)},"Ninguna"]},correct:0,rationale:{de:${q(`${labels.de[0] ?? p0} ist in parts gelistet.`)},en:${q(`${labels.en[0] ?? p0} is listed in parts.`)},es:${q(`${labels.es[0] ?? p0} esta en la lista.`)}}}`;
  return `{id:${q(id)},track:${q(track)},is3d:true,title:{de:${q(title.de)},en:${q(title.en)},es:${q(title.es)}},objectives:{de:[${objectives.de.map(q).join(',')}],en:[${objectives.en.map(q).join(',')}],es:[${objectives.es.map(q).join(',')}]},measurements:[${measurements.join(',')}],labels:{de:[${labels.de.map(q).join(',')}],en:[${labels.en.map(q).join(',')}],es:[${labels.es.map(q).join(',')}]},tasks:[${tasks.join(',')}],quiz:${quiz},curriculum_ref:{badge:"Free",lf:"Freimodus",arp:"-"}}`;
}
{
  const entries = [];
  for (const id of SHOWCASE) {
    const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
    must(Array.isArray(man.labels) && man.labels.length >= 3, `${id}: Manifest-Labels fehlen`);
    must((man.tasks ?? []).length === 3, `${id}: genau 3 Tasks erwartet`);
    entries.push(labsEntry(id, man));
    console.log(`  LABS ${id}: labels=${man.labels.length} meas=${(man.measurements ?? []).length} tasks=${man.tasks.length}`);
  }
  must(s.includes('const LABS=[];'), 'LABS-Anker fehlt');
  s = s.replace('const LABS=[];', `const LABS=[\n${entries.join(',\n')}\n];`);
}

// ---------- 3) __SOURCES (Modulquellen fuer Revision) ----------
{
  const map = {};
  for (const id of SHOWCASE) map[id] = await readFile(`src/models/${id}.js`, 'utf8');
  const json = JSON.stringify(map);
  must(!json.includes('</script'), 'SOURCES: </script-Sequenz');
  s = s.replace('window.__SOURCES = {};', `window.__SOURCES = ${json};`);
  console.log(`  SOURCES: ${SHOWCASE.length} Modelle, ${json.length} Zeichen`);
}

// ---------- 4) ES-/MEAS-Anreicherung (arch-brandenburger-tor) ----------
{
  const man = JSON.parse(await readFile('src/models/manifests/arch-brandenburger-tor.json', 'utf8'));
  const esEntry = `"arch-brandenburger-tor":{title:${q(man.i18n.es.title)},parts:[${man.i18n.es.labels.map(q).join(',')}]}`;
  const esAnchor = '"gpu-example":{title:"Tarjeta gráfica"';
  must(s.includes(esAnchor), 'ES-Anker fehlt');
  s = s.replace(esAnchor, `${esEntry},${esAnchor}`);
  const measAnchor = '"gpu-example":"Kartenl\\u00e4nge: 267 mm"';
  must(s.includes(measAnchor), 'MEAS-Anker fehlt');
  s = s.replace(measAnchor, `"arch-brandenburger-tor":"Gesamtbreite: 62,5 m",${measAnchor}`);
  console.log('  ES/MEAS: arch-brandenburger-tor');
}

await writeFile(FILE, s);
console.log(`showcase: geschrieben (${s.length} Zeichen)`);
if (REPORT) {
  await writeFile(REPORT, JSON.stringify({ createdAt: new Date().toISOString(), showcase: SHOWCASE, bytes: s.length }, null, 2));
}
