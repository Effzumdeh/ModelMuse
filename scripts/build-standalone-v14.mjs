/**
 * Standalone builder v14 (2D-Alle-Varianten, GitHub-Pages-faehig):
 * Erweitert das v13-Showcase-Artefakt additiv um die 2D-Variante chart
 * (Wirkungsgradvergleich, einzige kuratierte 2D-Demo seit v29).
 * Laeuft NUR auf v13-Basis (Stamp vorhanden, showcase oder voll) und ist
 * idempotent (Zweitlauf meldet "bereits v14", exit 0).
 *
 * V1  Vendor-Renderer einbetten (src/vendor/*-2d.js als IIFE, gleiche Dateien
 *     wie Produktion; kein CDN, keine Fonts, kein WASM) + Dispatcher
 *     __renderVariant2D(variant, box, data).
 * V2  META-Bloecke je Demo-Modell (is3d:false + diagram2d-Payload).
 * V3  LABS-Katalogeintraege je Demo (de/en/es, Tasks, Quiz, diagram2d).
 * V4  ES-Anreicherung + MEAS-Eintraege je Demo.
 * V5  __SOURCES um die Demo-Quellen erweitern (Modify-/RegisterFree-Pfad).
 * V6  loadLab/force2D: Varianten-Dispatch vor SVG-Fallback.
 * V7  registerFree: 2d-*-Imports zulassen (Prolog mit Vendor-Renderern,
 *     is3d:false, diagram2d-Persistenz) — Ueberarbeiten auch fuer 2D.
 * V8  v14-Stempel + Invarianten (Groesse < 600 KB, 1 LABS/META/diagram2d).
 *
 * Aufruf: node scripts/build-standalone-v14.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { twoDVariantOf, extractTwoDLiteral, TWOD_VARIANT_LITERAL } from '../src/runtime/verify-2d.js';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v14-report.json';
const DEMOS = ['demo-2d-chart'];

function must(cond, msg) {
  if (!cond) { console.error('build-v14: FEHLER ' + msg); process.exit(1); }
}
const q = (x) => JSON.stringify(x);
let s = await readFile(FILE, 'utf8');
console.log(`build-v14: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v13'), 'kein v13-Stempel (falsche Basis)');
if (s.includes('standalone-build v14')) {
  console.log('build-v14: bereits v14 — nichts zu tun (idempotent, exit 0)');
  process.exit(0);
}
must(s.includes('{id:"arch-brandenburger-tor"'), 'kein Showcase (arch fehlt)');
for (const id of DEMOS) must(!s.includes(`{id:"${id}"`), `${id} schon vorhanden`);
must(!s.includes('__V14SVG'), '__V14 schon vorhanden (falsche Basis)');

// ---------- V1: Vendor-Renderer als IIFE ----------
const VENDOR_SRC = {
  __V14SVG: 'src/vendor/diagram-2d.js',
  __V14MERMAID: 'src/vendor/mermaid-2d.js',
  __V14CHART: 'src/vendor/chart-2d.js',
  __V14D3: 'src/vendor/d3-2d.js',
  __V14KATEX: 'src/vendor/katex-2d.js',
};
const VENDOR_RET = {
  __V14SVG: '{render:renderDiagram2D,build:buildDiagramSvg,shapes:countSvgShapes}',
  __V14MERMAID: '{render:renderMermaid2D,parse:parseMermaid,build:buildMermaidSvg}',
  __V14CHART: '{render:renderChart2D,parse:parseChartConfig,build:buildChartSvg}',
  __V14D3: '{render:renderGraph2D,parse:parseGraph,build:buildGraphSvg}',
  __V14KATEX: '{render:renderMath2D,parse:parseLatex,build:buildMathHtml}',
};
const iifes = [];
for (const [name, rel] of Object.entries(VENDOR_SRC)) {
  let code = await readFile(rel, 'utf8');
  code = code.split('\n').filter((ln) => !ln.startsWith('import ')).join('\n');
  code = code.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
  must(!code.includes('export '), `${name}: Rest-Export`);
  must(!/from '[^']+'/.test(code), `${name}: Rest-Import`);
  must(!/<\/script/i.test(code), `${name}: script-Ende im Vendor`);
  iifes.push(`window.${name}=(function(){\n${code}\nreturn ${VENDOR_RET[name]};})();`);
}
const dispatcher = 'function __renderVariant2D(box,vd){var v=vd&&vd.variant;var d=(vd&&vd.data)||{};'
  + "if(v==='mermaid'){return __V14MERMAID.render(box,d);}"
  + "if(v==='chart'){return __V14CHART.render(box,d);}"
  + "if(v==='d3'){return __V14D3.render(box,d);}"
  + "if(v==='katex'){return __V14KATEX.render(box,d);}"
  + 'return __V14SVG.render(box,d);}';
{
  const anchor = 'function renderDiagram2D(svgHost, lab) {';
  must(s.split(anchor).length - 1 === 1, 'V1 Renderer-Anker fehlt');
  s = s.replace(anchor, `${iifes.join('\n')}\n${dispatcher}\n${anchor}`);
  console.log(`  V1: 5 Vendor-IIFE + Dispatcher (${iifes.join('').length} Zeichen)`);
}

// Demo-Daten einlesen (Variante + Datenliteral je Modell).
const demoData = {};
for (const id of DEMOS) {
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
  const variant = twoDVariantOf(src);
  must(variant, `${id}: Variante unerkannt`);
  const data = extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]);
  must(data && typeof data === 'object', `${id}: Daten fehlen`);
  must(!/<\/script/i.test(JSON.stringify(data)), `${id}: script-Ende in Daten`);
  must(!/<\/script/i.test(src), `${id}: script-Ende in Quelle`);
  demoData[id] = { src, man, variant, data };
  console.log(`  Daten ${id}: variante=${variant} shapes-test folgt in Gates`);
}

// ---------- V2: META-Bloecke ----------
{
  const blocks = DEMOS.map((id) => {
    const { man, variant, data } = demoData[id];
    const sid = id.replace(/-/g, '_');
    const metaJs = `{ title: ${q(man.title)}, parts: ${q(man.labels)} }`;
    return `{var meta_${sid} = ${metaJs};\nMETA['${id}'] = meta_${sid};\nMETA['${id}'].is3d = false;\nMETA['${id}'].diagram2d = ${q({ variant, data })};\n}`;
  });
  const anchor = 'const META = {};';
  must(s.split(anchor).length - 1 === 1, 'V2 META-Anker fehlt');
  s = s.replace(anchor, `${anchor}\n${blocks.join('\n')}`);
  console.log('  V2: 1 META-Block (is3d:false + diagram2d)');
}

// ---------- V3: LABS-Eintraege ----------
function hintsFor(type) {
  const H = {
    zuordnung: { de: ['Suche das Bauteil in der Ansicht.', 'Nutze die Bauteilliste.', 'Zoome an das Bauteil heran.'], en: ['Find the part in the view.', 'Use the parts list.', 'Zoom to the part.'], es: ['Busca la pieza en la vista.', 'Usa la lista de piezas.', 'Acercate a la pieza.'] },
    messwert: { de: ['Suche die Messlinie.', 'Lies Zahl plus Einheit.', 'Pruefe mm/cm/m.'], en: ['Find the measure line.', 'Read number plus unit.', 'Check mm/cm/m.'], es: ['Busca la linea de medida.', 'Lee numero y unidad.', 'Comprueba mm/cm/m.'] },
    transfer: { de: ['Denke an die Hauptfunktion.', 'Verbinde Form und Aufgabe.', 'Erklaere in einem Satz.'], en: ['Think about the main function.', 'Connect shape and task.', 'Explain in one sentence.'], es: ['Piensa en la funcion principal.', 'Relaciona forma y tarea.', 'Explica en una frase.'] },
  };
  const h = H[type] ?? H.zuordnung;
  return `{de:[${h.de.map(q).join(',')}],en:[${h.en.map(q).join(',')}],es:[${h.es.map(q).join(',')}]}`;
}
function labsEntry2D(id, man, variant, data) {
  const en = man.i18n?.en ?? {};
  const es = man.i18n?.es ?? {};
  const title = { de: man.title, en: en.title ?? man.title, es: es.title ?? en.title ?? man.title };
  const labels = { de: man.labels, en: en.labels ?? man.labels, es: es.labels ?? en.labels ?? man.labels };
  const measurements = (man.measurements ?? []).map((m) => {
    const men = (en.measurements ?? []).find((x) => x.id === m.id);
    const mes = (es.measurements ?? []).find((x) => x.id === m.id);
    return `{id:${q(m.id)},text:{de:${q(m.text)},en:${q(men?.text ?? m.text)},es:${q(mes?.text ?? men?.text ?? m.text)}},unit:${q(m.unit ?? 'cm')}}`;
  });
  const tasks = (man.tasks ?? []).map((t) => {
    const ten = (en.tasks ?? []).find((x) => x.id === t.id);
    const tes = (es.tasks ?? []).find((x) => x.id === t.id);
    const lvl = t.level === 'basis' || t.level === 'aufbau' || t.level === 'profi' ? t.level : 'aufbau';
    return `{id:${q(t.id)},type:${q(t.type)},level:${q(lvl)},tolerance:${Number(t.tolerance ?? 0)},expected:${q(t.expected)},prompt:{de:${q(t.prompt)},en:${q(ten?.prompt ?? t.prompt)},es:${q(tes?.prompt ?? ten?.prompt ?? t.prompt)}},hints:${hintsFor(t.type)}}`;
  });
  const p0 = man.labels[0] ?? 'Bauteil';
  const quiz = `{q:{de:${q(`Welches Bauteil gehoert zu ${title.de}?`)},en:${q(`Which part belongs to ${title.en}?`)}},options:{de:[${q(p0)},${q(man.labels[1] ?? p0)},${q(man.labels[2] ?? p0)},"Keines davon"],en:[${q((en.labels ?? [])[0] ?? p0)},${q((en.labels ?? [])[1] ?? p0)},${q((en.labels ?? [])[2] ?? p0)},"None of these"]},correct:0,rationale:{de:${q(`${p0} ist in parts gelistet.`)},en:${q(`${(en.labels ?? [])[0] ?? p0} is listed in parts.`)}}}`;
  return `{id:${q(id)},track:"Free",is3d:false,title:${q(title)},objectives:{de:${q(man.objectives)},en:${q(en.objectives ?? man.objectives)},es:${q(es.objectives ?? en.objectives ?? man.objectives)}},measurements:[${measurements.join(',')}],labels:${q(labels)},tasks:[${tasks.join(',')}],quiz:${quiz},curriculum_ref:{badge:"Free",lf:"Freimodus",arp:"-"},diagram2d:${q({ variant, data })}}`;
}
{
  const entries = DEMOS.map((id) => labsEntry2D(id, demoData[id].man, demoData[id].variant, demoData[id].data));
  const anchor = '];\n// V9: ES-Anreicherung';
  must(s.split(anchor).length - 1 === 1, 'V3 LABS-Anker fehlt');
  const lastClose = s.lastIndexOf('{id:"gpu-example"');
  must(lastClose >= 0 && lastClose < s.indexOf(anchor), 'V3 Reihenfolge');
  s = s.replace(anchor, `,\n${entries.join(',\n')}\n];\n// V9: ES-Anreicherung`);
  console.log('  V3: 1 LABS-Eintrag (is3d:false + diagram2d)');
}

// ---------- V4: ES-Anreicherung + MEAS ----------
{
  const esParts = DEMOS.map((id) => {
    const es = demoData[id].man.i18n?.es ?? {};
    return `"${id}":{title:${q(es.title ?? demoData[id].man.title)},parts:[${(es.labels ?? demoData[id].man.labels).map(q).join(',')}]}`;
  });
  const esTail = '"Chapa del slot con puertos de pantalla"]}};';
  must(s.split(esTail).length - 1 === 1, 'V4 ES-Ende fehlt');
  s = s.replace(esTail, `"Chapa del slot con puertos de pantalla"]},${esParts.join(',')}};`);
  console.log('  V4a: ES-Anreicherung (1 Demo)');
}
{
  const measParts = DEMOS.map((id) => {
    const m0 = demoData[id].man.measurements?.[0];
    const txt = m0?.text ?? `${demoData[id].man.labels[0]}: 10 cm`;
    return `"${id}":${q(txt)}`;
  });
  const measAnchor = '"gpu-example":"Kartenl\\u00e4nge: 267 mm"}';
  must(s.split(measAnchor).length - 1 === 1, 'V4 MEAS-Anker fehlt');
  s = s.replace(measAnchor, `"gpu-example":"Kartenl\\u00e4nge: 267 mm",${measParts.join(',')}}`);
  console.log('  V4b: MEAS-Eintraege (1 Demo)');
}

// ---------- V5: __SOURCES ----------
{
  const anchor = 'window.__SOURCES = {"arch-brandenburger-tor"';
  must(s.split(anchor).length - 1 === 1, 'V5 SOURCES-Anker fehlt');
  const add = DEMOS.map((id) => `"${id}":${JSON.stringify(demoData[id].src)}`).join(',');
  must(!/<\/script/i.test(add), 'V5 script-Ende in Quellen');
  s = s.replace(anchor, `window.__SOURCES = {${add},"arch-brandenburger-tor"`);
  console.log('  V5: __SOURCES +1 Demo-Quelle (Modify-Pfad)');
}

// ---------- V6: loadLab/force2D Varianten-Dispatch ----------
{
  const anchor = 'renderDiagram2D(container, __labForDiagram(id));';
  must(s.split(anchor).length - 1 === 2, `V6 Anker-Zaehler=${s.split(anchor).length - 1}, erwartet 2`);
  s = s.split(anchor).join("if(META[id]&&META[id].diagram2d&&META[id].diagram2d.variant){__renderVariant2D(container,META[id].diagram2d);}else{renderDiagram2D(container, __labForDiagram(id));}");
  console.log('  V6: Varianten-Dispatch (loadLab + force2D)');
}

// ---------- V7: registerFree 2D ----------
{
  const a1 = 'var ALLOWED_FROM=["three","three/addons/controls/OrbitControls.js","wrapper-helpers"];';
  must(s.split(a1).length - 1 === 1, 'V7 ALLOWED_FROM fehlt');
  s = s.replace(a1, 'var ALLOWED_FROM=["three","three/addons/controls/OrbitControls.js","wrapper-helpers","2d-svg","2d-mermaid","2d-chart","2d-d3","2d-katex"];');
  const a2 = 'var code=String(source||"");';
  must(s.split(a2).length - 1 === 1, 'V7 code-Anker fehlt');
  s = s.replace(a2, `${a2}var is2D=/from\\s*['"]2d-/.test(code);`);
  const a3 = 'code.split("export const meta_i18n").join("const meta_i18n");';
  must(s.split(a3).length - 1 === 1, 'V7 Export-Anker fehlt');
  s = s.replace(a3, `${a3}code=code.split("export const meta_2d").join("const meta_2d");code=code.split("export const diagram").join("const diagram");code=code.split("export const mermaid").join("const mermaid");code=code.split("export const chart").join("const chart");code=code.split("export const graph").join("const graph");code=code.split("export const formula").join("const formula");`);
  const a4 = 'var fn=new Function("__C",prolog+code+epilog);';
  must(s.split(a4).length - 1 === 1, 'V7 fn-Anker fehlt');
  s = s.replace(a4, 'if(is2D){prolog="var renderDiagram2D=window.__V14SVG.render;var renderMermaid2D=window.__V14MERMAID.render;var renderChart2D=window.__V14CHART.render;var renderGraph2D=window.__V14D3.render;var renderMath2D=window.__V14KATEX.render;";epilog=";return {init:init,meta:(typeof meta!==\\"undefined\\" ?meta:null),meta_i18n:(typeof meta_i18n!==\\"undefined\\" ?meta_i18n:null),d2:(typeof diagram!==\\"undefined\\" ?{variant:\\"svg\\",data:diagram}:typeof mermaid!==\\"undefined\\" ?{variant:\\"mermaid\\",data:mermaid}:typeof chart!==\\"undefined\\" ?{variant:\\"chart\\",data:chart}:typeof graph!==\\"undefined\\" ?{variant:\\"d3\\",data:graph}:typeof formula!==\\"undefined\\" ?{variant:\\"katex\\",data:formula}:null)};";}'
    + a4);
  const a5 = 'var meta=r.meta;if(typeof meta.is3d!=="boolean"){meta.is3d=true;}';
  must(s.split(a5).length - 1 === 1, 'V7 meta-Anker fehlt');
  s = s.replace(a5, 'var meta=r.meta;if(is2D){meta.is3d=false;}else if(typeof meta.is3d!=="boolean"){meta.is3d=true;}');
  const a6 = 'INIT[id]=function(c,p){return r.init(c,p);};META[id]={title:meta.title,parts:meta.parts.slice(),is3d:meta.is3d};';
  must(s.split(a6).length - 1 === 1, 'V7 INIT-Anker fehlt');
  s = s.replace(a6, `${a6}if(is2D&&r.d2){META[id].diagram2d=r.d2;}`);
  console.log('  V7: registerFree 2D (Allowlist + Prolog + is3d:false + diagram2d)');
}

// ---------- V8: Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v13 (GitHub-Pages-Auslieferung, kein Backend): Modelle aus src/models (Harness-verifiziert), 2D-Metamodule aus Manifesten, Provider Baseten-Direkt, via scripts/build-standalone-v13.mjs -->';
  must(s.split(stamp).length - 1 === 1, 'V8 Stempel-Anker fehlt');
  s = s.replace(stamp, `${stamp}\n<!-- standalone-build v14 (2D-Variante: chart als Vendor-IIFE + Dispatcher + 1 Demo-Modell Wirkungsgradvergleich, via scripts/build-standalone-v14.mjs) -->`);
  console.log('  V8: v14-Stempel');
}
{
  const cnt = (sub) => s.split(sub).length - 1;
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1],
    ['PointLight(0xffffff, 900', 0], ['0x11141a', 0], ['envMapIntensity', 0],
    ['mapSize.set(2048', 0], ['openrouter', (s.includes('standalone-build v42') ? 31 : (s.includes('standalone-build v40') ? 28 : 26))], ['OpenRouter', (s.includes('standalone-build v42') ? 16 : (s.includes('standalone-build v40') ? 13 : 12))],
    ['__V14SVG', 3], ['__V14MERMAID', 3], ['__V14CHART', 3], ['__V14D3', 3], ['__V14KATEX', 3],
    ['__renderVariant2D', 3],
    ['META[id].diagram2d', 7],
  ];
  for (const [sub, want] of inv) must(cnt(sub) === want, `Invariante ${sub}: ${cnt(sub)}, erwartet ${want}`);
  for (const id of [...DEMOS, 'arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine']) {
    must(cnt(`{id:"${id}"`) >= 1, `LABS ${id} fehlt`);
    must(cnt(`META['${id}']`) >= 1, `META ${id} fehlt`);
  }
  for (const id of DEMOS) {
    must(cnt(`INIT['${id}'] = `) === 0, `tote INIT ${id}`);
  }
  must(cnt('diagram2d:{"variant"') === 1, `diagram2d-LABS: ${cnt('diagram2d:{"variant"')}, erwartet 1`);
  must(cnt('.diagram2d = {"variant"') === 1, `diagram2d-META: ${cnt('.diagram2d = {"variant"')}, erwartet 1`);
  must(s.length < 600000, `Datei zu gross: ${s.length}`);
  console.log('  Invarianten ok');
}

await writeFile(FILE, s);
console.log(`build-v14: geschrieben (${s.length} Zeichen)`);
if (REPORT) {
  const cnt = (sub) => s.split(sub).length - 1;
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v13-showcase',
    standalone: 'v14',
    fixes: ['V1 Vendor-IIFE svg/mermaid/chart/d3/katex + Dispatcher', 'V2 META is3d:false + diagram2d', 'V3 LABS-Katalog 1 Demo (chart)', 'V4 ES/MEAS', 'V5 SOURCES +1', 'V6 loadLab/force2D Dispatch', 'V7 registerFree 2D', 'V8 Stempel + Invarianten'],
    counts: { zeichen: s.length, labs: DEMOS.map((id) => ({ id, labs: cnt(`{id:"${id}"`), meta: cnt(`META['${id}']`) })) },
  };
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('build-v14: OK v14');
} else {
  console.log('build-v14: DRY-RUN ok (kein Report geschrieben)');
}
