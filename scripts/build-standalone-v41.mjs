/**
 * Standalone builder v41 (Export-Menue unten links im Viewer): baut auf dem
 * v40-Artefakt auf und ist idempotent (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (docs/export-formate-recherche-r186.md, empirisch r186.1):
 * - Kein three.js-Exporter serialisiert Sprites -> Label-Text geht in allen
 *   3D-Formaten verloren. Rettung: userData -> node.extras (nur GLB) + PNG.
 * - GLTFExporter kommt per Importmap (0 Bytes): import 'three/addons/...'.
 * - PNG braucht preserveDrawingBuffer (in allen 7 WebGL-Modellen gesetzt).
 * - 2D-SVGs haben kein xmlns (sonst als Bild nicht ladbar).
 * - i18n-Key 'export' = Quellcode-Export (src) -> dort umbenannt; hier neue Keys.
 *
 * Umsetzung (nur Standalone-Artefakt + Quell-Fixes; Kette nie umschreiben):
 * E1  Export-Button unten links im Viewer + Menue (3D: GLB+PNG, 2D: SVG+PNG).
 * E2  GLB hostseitig via __findLabScene (Gast-Fence unberuehrt): GridHelper-/
 *     Shadow-Filter, Label-/Mess-Texte als userData (GLB extras), onlyVisible
 *     respektiert den Part-Toggle automatisch.
 * E3  PNG als Screenshot der aktuellen Ansicht (3D: canvas.toDataURL;
 *     2D: SVG-Rasterung per Image+Canvas, Chart-Canvas/Fallback direkt).
 * E4  SVG mit xmlns-Fix + festen Pixeln (640x360).
 * E5  I18N-Keys de/en/es (saveModel/saveGlb/savePng/saveSvg/saveOk/saveErr/
 *     saveNone/saveNoSvg), xmlns auch in den 5 Inline-SVG-Tags.
 * E6  Stempel v41 + Invarianten (Alt-Zaehler unveraendert) + Syntax-Gate.
 * E7  Renderer-Pflicht preserveDrawingBuffer im Inline-Freimodus-Prompt.
 * E8  v38-Destructure-Luecke: OrthographicCamera fehlte im Modul-Destructure,
 *     registerFree warf ReferenceError (alle Freimodus-Generierungen rot).
 *
 * Aufruf: node scripts/build-standalone-v41.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v41-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v41: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}
function repAll(s, oldStr, newStr, want, label) {
  must(cnt(s, oldStr) === want, label + ': ' + cnt(s, oldStr) + ' statt ' + want);
  return s.split(oldStr).join(newStr);
}

/** Syntax-Gate wie v26-v40 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v41-syn-'));
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
          console.error('build-v41: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v41-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v39', 1], ['standalone-build v40', 1],
    ['standalone-build v41', 1],
    // E: I18N-Keys je Sprache genau 1x.
    ['saveModel:', 3], ['saveGlb:', 3], ['savePng:', 3], ['saveSvg:', 3],
    ['saveOk:', 3], ['saveErr:', 3], ['saveNone:', 3], ['saveNoSvg:', 3],
    // E: Menue-Template + Vue-Anbindung genau 1x.
    ['id="export-menu"', 1], ['toggleExportMenu:function', 1],
    ['exportGLB:async function', 1], ['exportPNG:async function', 1],
    ['exportSVG:async function', 1], ['exportFailMsg:function', 1],
    ['exportOpen:false', 1],
    // E: Host-Exportlogik (Modul-Scope) genau 1x definiert.
    ['window.__viewer.exportSceneGLB = async function', 1],
    ['window.__viewer.exportViewPNG = async function', 1],
    ['window.__viewer.exportDiagramFile = function', 1],
    ['window.__viewer.exportSVGText = function', 1],
    ['GLTFExporter', 2],
    // E: SVG-xmlns in allen 5 Inline-Tags.
    ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"', 5],
    // E: Renderer-Pflicht im Inline-Freimodus-Prompt.
    ['Renderer-Pflicht: new WebGLRenderer({antialias:true, preserveDrawingBuffer:true}) (PNG-Export braucht den Buffer).', 1],
    // E: v38-Destructure-Luecke geschlossen (registerFree funktionsfaehig).
    ['OctahedronGeometry, OrthographicCamera, PCFShadowMap', 1],
    // O: OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    // Alt-Gates: alle Zaehler unveraendert.
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 6],
    ['reasoning_effort', 10],
    ['reasoning_effort="xhigh"', 2],
    ['genReasoning:"xhigh"', 1],
    ['this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 1],
    ['||this.genProvider==="openrouter"', 2],
    ['this.genProvider==="openrouter"?"xhigh":"max"', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v41 Export-Menue + Alt-Zaehler unveraendert)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v41: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v40-export',
    standalone: 'v41',
    befund: [
      'Export-Menue unten links im Viewer (3D: GLB+PNG, 2D: SVG+PNG); GLB hostseitig via __findLabScene per Importmap-GLTFExporter (0 Bytes), GridHelper/Shadow-Filter, Label-/Mess-Texte als userData/extras, Part-Ausblendung via onlyVisible.',
      'PNG als Screenshot der aktuellen Ansicht (3D preserveDrawingBuffer, 2D SVG-Rasterung); SVG mit xmlns-Fix + festen Pixeln; I18N-Keys save* de/en/es.',
    ],
    fixes: [
      'E1 Export-Button + modusabhaengiges Menue (id=export-menu)',
      'E2 __viewer.exportSceneGLB (GLTF, Filter, extras, onlyVisible)',
      'E3 __viewer.exportViewPNG (3D-Screenshot, 2D-Rasterung)',
      'E4 __viewer.exportDiagramFile/exportSVGText (xmlns + 640x360)',
      'E5 I18N saveModel/saveGlb/savePng/saveSvg/saveOk/saveErr/saveNone/saveNoSvg de/en/es',
      'E5b xmlns in 5 Inline-SVG-Tags + E7 Renderer-Pflicht im Inline-Prompt',
      'E6 Stempel v41 + Invarianten + Syntax-Gate',
      'E8 v38-Destructure-Luecke OrthographicCamera (registerFree funktionsfaehig)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v41: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v40'), 'kein v40-Stempel (falsche Basis)');
if (s.includes('standalone-build v41')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v41: bereits v41 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- E5a: I18N-Keys de/en/es ----------
s = rep1(s,
  'showMeasures:"Maße"',
  'showMeasures:"Maße",saveModel:"Speichern",saveGlb:"GLB (3D-Modell)",savePng:"PNG (aktuelle Ansicht)",saveSvg:"SVG (Vektor)",saveOk:"{f} gespeichert.",saveErr:"Speichern fehlgeschlagen: {f}",saveNone:"Kein Modell geladen.",saveNoSvg:"Für diese Ansicht gibt es kein SVG."',
  'E5a I18N de');
s = rep1(s,
  'showMeasures:"Dimensions"',
  'showMeasures:"Dimensions",saveModel:"Save",saveGlb:"GLB (3D model)",savePng:"PNG (current view)",saveSvg:"SVG (vector)",saveOk:"{f} saved.",saveErr:"Save failed: {f}",saveNone:"No model loaded.",saveNoSvg:"No SVG available for this view."',
  'E5b I18N en');
s = rep1(s,
  'showMeasures:"Medidas"',
  'showMeasures:"Medidas",saveModel:"Guardar",saveGlb:"GLB (modelo 3D)",savePng:"PNG (vista actual)",saveSvg:"SVG (vector)",saveOk:"{f} guardado.",saveErr:"Error al guardar: {f}",saveNone:"Ningún modelo cargado.",saveNoSvg:"No hay SVG para esta vista."',
  'E5c I18N es');
console.log('  E5: I18N-Keys de/en/es (saveModel/saveGlb/savePng/saveSvg/saveOk/saveErr/saveNone/saveNoSvg)');

// ---------- E5b: xmlns in 5 Inline-SVG-Tags ----------
s = repAll(s,
  '<svg viewBox="0 0 640 360" width="100%" height="100%" role="img">',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" role="img">',
  5, 'E5b xmlns');
console.log('  E5: xmlns in 5 Inline-SVG-Tags');

// ---------- E1: Export-Menue unten links (Vue-Template) ----------
s = rep1(s,
  '<div id="viewport" style="height:70vh;min-height:560px" class="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700"></div>',
  `<div id="viewport" style="height:70vh;min-height:560px" class="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700"></div>
<div id="export-menu" class="absolute bottom-3 left-3 z-10">
<button type="button" @click="toggleExportMenu" class="px-4 rounded-xl bg-slate-800/90 text-slate-100 font-semibold min-h-[44px] border border-slate-600 shadow-lg hover:bg-slate-700">{{t('saveModel')}} ▾</button>
<div v-show="exportOpen" class="mt-2 flex flex-col gap-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 shadow-xl" role="menu">
<button v-if="viewerMode!=='2d'" type="button" @click="exportGLB" class="px-4 text-left rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] text-sm font-semibold text-slate-900 dark:text-slate-100">GLB &middot; {{t('saveGlb')}}</button>
<button type="button" @click="exportPNG" class="px-4 text-left rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] text-sm font-semibold text-slate-900 dark:text-slate-100">PNG &middot; {{t('savePng')}}</button>
<button v-if="viewerMode==='2d'" type="button" @click="exportSVG" class="px-4 text-left rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] text-sm font-semibold text-slate-900 dark:text-slate-100">SVG &middot; {{t('saveSvg')}}</button>
</div>
<p v-if="exportMsg" class="mt-2 max-w-[16rem] rounded-lg bg-slate-900/90 text-slate-100 text-xs px-3 py-2 shadow-lg">{{exportMsg}}</p>
</div>`,
  'E1 Menue-Template');
console.log('  E1: Export-Menue unten links (3D: GLB+PNG, 2D: SVG+PNG)');

// ---------- E1b: Vue-State ----------
s = rep1(s,
  'viewerMode:"3d",showLabels:true,showMeasures:true,',
  'viewerMode:"3d",showLabels:true,showMeasures:true,exportOpen:false,exportMsg:"",',
  'E1b Vue-State');
console.log('  E1: Vue-State (exportOpen/exportMsg)');

// ---------- E1c: Vue-Methoden ----------
s = rep1(s,
  `togglePart:function(name){var i=this.partsHidden.indexOf(name);var vis=true;if(i===-1){this.partsHidden.push(name);vis=false;}else{this.partsHidden.splice(i,1);vis=true;}try{if(window.__viewer&&window.__viewer.setPartVisible){window.__viewer.setPartVisible(name,vis);}}catch(e){}},`,
  `togglePart:function(name){var i=this.partsHidden.indexOf(name);var vis=true;if(i===-1){this.partsHidden.push(name);vis=false;}else{this.partsHidden.splice(i,1);vis=true;}try{if(window.__viewer&&window.__viewer.setPartVisible){window.__viewer.setPartVisible(name,vis);}}catch(e){}},
toggleExportMenu:function(){this.exportOpen=!this.exportOpen;try{this.exportMsg="";}catch(e){}},
exportFailMsg:function(d){var dd=String(d||"?");if(dd==="no-scene")return this.t("saveNone");if(dd==="no-svg")return this.t("saveNoSvg");return this.t("saveErr").split("{f}").join(dd);},
exportGLB:async function(){var self=this;self.exportOpen=false;self.exportMsg="";try{var r=await window.__viewer.exportSceneGLB();if(r&&r.ok){self.exportMsg=self.t("saveOk").split("{f}").join(r.file);}else{self.exportMsg=self.exportFailMsg(r&&r.detail);}}catch(e){var m="?";try{m=String((e&&e.message)||e).slice(0,120);}catch(e2){}self.exportMsg=self.exportFailMsg(m);}},
exportPNG:async function(){var self=this;self.exportOpen=false;self.exportMsg="";try{var r=await window.__viewer.exportViewPNG();if(r&&r.ok){self.exportMsg=self.t("saveOk").split("{f}").join(r.file);}else{self.exportMsg=self.exportFailMsg(r&&r.detail);}}catch(e){var m="?";try{m=String((e&&e.message)||e).slice(0,120);}catch(e2){}self.exportMsg=self.exportFailMsg(m);}},
exportSVG:async function(){var self=this;self.exportOpen=false;self.exportMsg="";try{var r=window.__viewer.exportDiagramFile();if(r&&r.ok){self.exportMsg=self.t("saveOk").split("{f}").join(r.file);}else{self.exportMsg=self.exportFailMsg(r&&r.detail);}}catch(e){var m="?";try{m=String((e&&e.message)||e).slice(0,120);}catch(e2){}self.exportMsg=self.exportFailMsg(m);}},`,
  'E1c Vue-Methoden');
console.log('  E1: Vue-Methoden (toggleExportMenu/exportGLB/exportPNG/exportSVG/exportFailMsg)');

// ---------- E2-E4: Host-Exportlogik im Modul-Scope ----------
s = rep1(s,
  'window.__viewer._partsHidden = window.__viewer._partsHidden || [];',
  `window.__viewer._partsHidden = window.__viewer._partsHidden || [];
// v41 Export (hostseitig, Gast-Fence unberuehrt): GLB/PNG/SVG aus Szene bzw. 2D-Ansicht.
window.__viewer.exportSVGText = function () {
  var fix = function (t) {
    var out = String(t || "");
    if (out.indexOf("xmlns=") < 0) { out = out.replace(/<svg\\b/, '<svg xmlns="http://www.w3.org/2000/svg"'); }
    if (out.indexOf('width="100%"') >= 0) { out = out.split('width="100%"').join('width="640"').split('height="100%"').join('height="360"'); }
    return out;
  };
  var host = null;
  try { host = document.getElementById("viewport"); } catch (eH) { host = null; }
  if (host) {
    var live = null;
    try { live = host.querySelector("svg"); } catch (eQ) { live = null; }
    if (live) {
      var ser = "";
      try { ser = new XMLSerializer().serializeToString(live); } catch (eX) { ser = ""; }
      if (ser) { return fix(ser); }
    }
  }
  try {
    var self = window.__viewer;
    var id = self._currentId;
    var meta = (typeof META !== "undefined" && id) ? META[id] : null;
    var vd = meta && meta.diagram2d;
    if (vd && vd.variant && vd.data) {
      var txt = "";
      // Hinweis: bewusst kein Vendor-Literal (v29-Zaehler bleiben exakt 3x).
      var modKey = ({ svg: "SVG", mermaid: "MERMAID", chart: "CHART", d3: "D3" })[vd.variant] || "SVG";
      var vendor = window["__V14" + modKey] || null;
      if (vendor && typeof vendor.build === "function") { txt = vendor.build(vd.data); }
      if (txt) { return fix(txt); }
    }
  } catch (eB) {}
  return "";
};
window.__viewer.exportDiagramFile = function () {
  var txt = "";
  try { txt = window.__viewer.exportSVGText(); } catch (e) { txt = ""; }
  if (!txt) { return { ok: false, detail: "no-svg" }; }
  var id = "modell";
  try { id = String(window.__viewer._currentId || "modell"); } catch (eI) {}
  var file = "modelmuse-" + id + ".svg";
  try {
    var blob = new Blob([txt], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click();
    try { a.remove(); } catch (eA) {}
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (eU) {} }, 4000);
  } catch (eD) { return { ok: false, detail: "download" }; }
  return { ok: true, file: file };
};
window.__viewer.exportViewPNG = async function () {
  var self = window.__viewer;
  var host = null;
  try { host = document.getElementById("viewport"); } catch (e) { host = null; }
  if (!host) { return { ok: false, detail: "no-viewport" }; }
  var id = "modell";
  try { id = String(self._currentId || "modell"); } catch (eI) {}
  var file = "modelmuse-" + id + ".png";
  var fire = function (dataUrl, blobObj) {
    var url = dataUrl;
    var created = false;
    if (!url && blobObj) { url = URL.createObjectURL(blobObj); created = true; }
    var a = document.createElement("a");
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click();
    try { a.remove(); } catch (eA) {}
    if (created) { setTimeout(function () { try { URL.revokeObjectURL(url); } catch (eU) {} }, 4000); }
  };
  if (self._mode !== "2d") {
    var cv = null;
    try { cv = host.querySelector("canvas"); } catch (eC) { cv = null; }
    if (!cv) { return { ok: false, detail: "no-canvas" }; }
    var durl = "";
    try { durl = cv.toDataURL("image/png"); } catch (eT) { return { ok: false, detail: "todata" }; }
    if (!durl || durl.indexOf("data:image/png") !== 0) { return { ok: false, detail: "empty" }; }
    try { fire(durl, null); } catch (eD) { return { ok: false, detail: "download" }; }
    return { ok: true, file: file };
  }
  var svgText = "";
  try { svgText = self.exportSVGText(); } catch (eS) { svgText = ""; }
  if (svgText) {
    var blob = null;
    try { blob = await __rasterizeSvg41(svgText, 1280, 720); } catch (eR) { return { ok: false, detail: "raster" }; }
    if (!blob) { return { ok: false, detail: "raster" }; }
    try { fire(null, blob); } catch (eD2) { return { ok: false, detail: "download" }; }
    return { ok: true, file: file };
  }
  var cv2 = null;
  try { cv2 = host.querySelector("canvas"); } catch (eC2) { cv2 = null; }
  if (cv2) {
    var durl2 = "";
    try { durl2 = cv2.toDataURL("image/png"); } catch (eT2) { return { ok: false, detail: "todata" }; }
    try { fire(durl2, null); } catch (eD3) { return { ok: false, detail: "download" }; }
    return { ok: true, file: file };
  }
  return { ok: false, detail: "no-svg" };
};
window.__viewer.exportSceneGLB = async function () {
  var self = window.__viewer;
  var scene = null;
  try { scene = __findLabScene(); } catch (e) { scene = null; }
  if (!scene) { return { ok: false, detail: "no-scene" }; }
  try {
    for (var li = 0; li < _items.length; li++) {
      var it = _items[li];
      try {
        if (it && it.obj && it.obj.userData) {
          if (it.kind === "label" && !it.obj.userData.labelText) { it.obj.userData.labelText = String(it.text || ""); }
          if (it.kind === "measurement" && !it.obj.userData.measureText) { it.obj.userData.measureText = String(it.text || ""); }
        }
      } catch (eI2) {}
    }
  } catch (eL) {}
  var detached = [];
  try {
    scene.traverse(function (o) {
      if (!o || o === scene) { return; }
      var hide = false;
      try { if (o.type === "GridHelper" || o.type === "AxesHelper" || o.type === "PolarGridHelper") { hide = true; } } catch (e1) {}
      try { if (o.isGridHelper || o.isAxesHelper || o.isPolarGridHelper) { hide = true; } } catch (e2) {}
      try { if (o.userData && o.userData.helperId === "__autoGrid") { hide = true; } } catch (e3) {}
      try {
        var mm = o.material;
        if (mm) {
          if (mm.isShadowMaterial || mm.type === "ShadowMaterial") { hide = true; }
          else if (Array.isArray(mm)) { for (var mi = 0; mi < mm.length; mi++) { if (mm[mi] && (mm[mi].isShadowMaterial || mm[mi].type === "ShadowMaterial")) { hide = true; break; } } }
        }
      } catch (eSM) {}
      if (hide && o.parent) { detached.push(o); }
    });
  } catch (eT) {}
  var saved = [];
  try {
    for (var di = 0; di < detached.length; di++) {
      var dobj = detached[di];
      try { if (dobj && dobj.parent) { saved.push({ obj: dobj, parent: dobj.parent }); dobj.parent.remove(dobj); } } catch (eR1) {}
    }
  } catch (eR0) {}
  var buf = null;
  var err = "";
  try {
    var mod = await import("three/addons/exporters/GLTFExporter.js");
    var exp = new mod.GLTFExporter();
    buf = await exp.parseAsync(scene, { binary: true, onlyVisible: true });
  } catch (eP) { try { err = String((eP && eP.message) || eP); } catch (eM) { err = "export"; } }
  try { for (var ri = 0; ri < saved.length; ri++) { try { saved[ri].parent.add(saved[ri].obj); } catch (eRA) {} } } catch (eR2) {}
  if (!buf) { return { ok: false, detail: String(err || "empty").slice(0, 120) }; }
  var gid = "modell";
  try { gid = String(self._currentId || "modell"); } catch (eG) {}
  var file = "modelmuse-" + gid + ".glb";
  try {
    var blob = new Blob([buf], { type: "model/gltf-binary" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click();
    try { a.remove(); } catch (eA2) {}
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (eU2) {} }, 4000);
  } catch (eD4) { return { ok: false, detail: "download" }; }
  return { ok: true, file: file };
};
function __rasterizeSvg41(svgText, w, h) {
  return new Promise(function (resolve, reject) {
    try {
      var blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          var ctx = cv.getContext("2d");
          if (!ctx) { try { URL.revokeObjectURL(url); } catch (e0) {} reject(new Error("no-ctx")); return; }
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try { URL.revokeObjectURL(url); } catch (e1) {}
          cv.toBlob(function (b) { if (b) { resolve(b); } else { reject(new Error("toBlob")); } }, "image/png");
        } catch (e) { try { URL.revokeObjectURL(url); } catch (e2) {} reject(e); }
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e3) {} reject(new Error("img")); };
      img.src = url;
    } catch (e) { reject(e); }
  });
}`,
  'E2-E4 Host-Exportlogik');
console.log('  E2-E4: Host-Exportlogik (GLB/PNG/SVG, Filter, Extras, Rasterung)');

// ---------- E7: Renderer-Pflicht im Inline-Freimodus-Prompt (PNG braucht Buffer) ----------
s = rep1(s,
  'DPR 1..2 (Default 1). Negativ:',
  'DPR 1..2 (Default 1). Renderer-Pflicht: new WebGLRenderer({antialias:true, preserveDrawingBuffer:true}) (PNG-Export braucht den Buffer). Negativ:',
  'E7 Prompt preserveDrawingBuffer');
console.log('  E7: Renderer-Pflicht im Inline-Prompt');

// ---------- E8: v38-Luecke schliessen (registerFree brach an fehlendem Destructure-Eintrag) ----------
s = rep1(s,
  'OctahedronGeometry, PCFShadowMap',
  'OctahedronGeometry, OrthographicCamera, PCFShadowMap',
  'E8 Destructure OrthographicCamera');
console.log('  E8: Destructure-Luecke OrthographicCamera (registerFree wieder funktionsfaehig)');

// ---------- E6: Stempel v41 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v40 (Modell-spezifische Reasoning-Stufen je OpenRouter-Modell: max nur wo belegt, via scripts/build-standalone-v40.mjs) -->';
must(cnt(s, stamp) === 1, 'v40-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v41 (Export-Menue unten links im Viewer: GLB/PNG/SVG je Modus + I18N de/en/es, via scripts/build-standalone-v41.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v41: OK v41 (Export-Menue GLB/PNG/SVG)');
