/**
 * Frame-Bootstrap: erzeugt den srcdoc-Text fuer den isolierten Guest-Frame.
 * iframe sandbox=allow-scripts (ohne allow-same-origin), eigenes CSP-Meta,
 * Netz-/Speicher-Attrappen, Specifier-Rewrite auf frame-eigene Blob-URLs,
 * Instrumentierung (WebGLRenderer-Proxy, __labprobe) und postMessage-Kanal.
 * Bauplan Abschnitt 4 (Sandbox-Vertrag).
 */

export const FRAME_CSP =
  "default-src none; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src none; worker-src none; child-src none; base-uri none; form-action none";

/** </script im Payload escapen, im Frame wieder zurueckwandeln. */
export function escapePayload(text) {
  return String(text).split('</script').join('<\\/script');
}

/**
 * @param {{ sessionId: string, threeText: string, helpersText: string, moduleText: string, initParams: Record<string, unknown> }} assets
 * @returns {string} srcdoc-Text
 */
export function buildFrameDocument(assets) {
  const { sessionId, threeText, helpersText, moduleText, initParams } = assets;
  const origin = 'window.location.origin === "null" ? "*" : window.location.origin';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">
</head><body>
<script>
'use strict';
(function () {
  var FAIL = function (name) { throw new Error('E-S2-BOOT: blockiert: ' + name); };
  try { window.fetch = function () { FAIL('fetch'); }; } catch (e) {}
  try { window.XMLHttpRequest = function () { FAIL('XMLHttpRequest'); }; } catch (e) {}
  try { window.WebSocket = function () { FAIL('WebSocket'); }; } catch (e) {}
  try { window.EventSource = function () { FAIL('EventSource'); }; } catch (e) {}
  try { if (window.navigator && window.navigator.sendBeacon) window.navigator.sendBeacon = function () { return false; }; } catch (e) {}
  ['localStorage', 'sessionStorage', 'indexedDB'].forEach(function (k) {
    try { Object.defineProperty(window, k, { get: function () { FAIL(k); }, configurable: false }); } catch (e) {}
  });
  try { document.cookie = ''; } catch (e) {}
  window.__labprobe = { frames: 0, firstFrameAt: null, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
  window.__labsession = ${JSON.stringify(sessionId)};
  window.__labparams = ${JSON.stringify(initParams ?? {})};
  function post(type, payload) {
    var msg = Object.assign({ type: type, sessionId: window.__labsession }, payload || {});
    try { parent.postMessage(msg, ${origin}); } catch (e) {}
  }
  window.addEventListener('error', function (ev) {
    post('model-error', { code: 'E-S2-BOOT', message: String((ev && ev.message) || ev) });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    post('model-error', { code: 'E-S2-BOOT', message: String((r && (r.message || r)) || r) });
  });
  window.__labpost = post;
})();
<\/script>
<script id="lab-three" type="text/plain">${escapePayload(threeText)}</script>
<script id="lab-helpers" type="text/plain">${escapePayload(helpersText)}</script>
<script id="lab-module" type="text/plain">${escapePayload(moduleText)}</script>
<script type="module">
'use strict';
var post = window.__labpost;
function unescapePayload(t) { return t.split('<\\\\/script').join('</script'); }
function blobOf(id, mime) {
  var el = document.getElementById(id);
  var text = unescapePayload(el ? el.textContent || '' : '');
  return URL.createObjectURL(new Blob([text], { type: mime || 'text/javascript' }));
}
var handle = null;
var container = null;
var rendererSeen = [];
var NSref = null; // instrumentiertes THREE (Box3/Raycaster fuer S2-Probe, A-08)
var probePatched = false;
function instrument(THREE) {
  var OrigRenderer = THREE.WebGLRenderer;
  function PatchedRenderer(opts) {
    var r = new OrigRenderer(opts);
    rendererSeen.push(r);
    var info = r.info;
    try {
      Object.defineProperty(r, '__labinfo', { value: info, configurable: true });
    } catch (e) {}
    return r;
  }
  PatchedRenderer.prototype = OrigRenderer.prototype;
  var NS = Object.create(null);
  for (var k in THREE) { try { NS[k] = THREE[k]; } catch (e) {} }
  NS.WebGLRenderer = PatchedRenderer;
  return NS;
}
function countMeshes() {
  try {
    if (!container) return 0;
    var n = 0;
    container.traverse(function (o) { if (o && (o.isMesh || o.isInstancedMesh)) n += 1; });
    return n;
  } catch (e) { return 0; }
}
function probeMeshes(root, max) {
  var out = [];
  try {
    if (!root || typeof root.traverse !== 'function') return out;
    root.traverse(function (o) {
      if (out.length >= max) return;
      if (o && (o.isMesh || o.isInstancedMesh)) out.push(o);
    });
  } catch (e) {}
  return out;
}
function probeScene() {
  try {
    if (handle && handle.scene) return handle.scene;
    if (handle && handle.root) return handle.root;
    if (handle && handle.group) return handle.group;
  } catch (e) {}
  return null;
}
function probeCamera(scene) {
  try {
    if (handle && handle.camera) return handle.camera;
    if (scene && typeof scene.traverse === 'function') {
      var found = null;
      scene.traverse(function (o) { if (!found && o && o.isCamera) found = o; });
      if (found) return found;
    }
  } catch (e) {}
  return null;
}
function roundMm(v) {
  var n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}
function probeBoxes() {
  // S2-intersect (A-08): Welt-AABBs der obersten Mesh-Gruppen (Baugruppen-Proxys).
  // Caps: max. 64 Meshes gescannt, max. 16 Boxen. Alles try/catch, keine Fakes.
  try {
    var scene = probeScene();
    if (!scene || !NSref || !NSref.Box3) return { boxes: [], note: 'keine Szene (Boxen unvermessen)' };
    var meshes = probeMeshes(scene, 64);
    if (meshes.length === 0) return { boxes: [], note: '0 Meshes in Szene' };
    var tops = [];
    for (var i = 0; i < meshes.length; i += 1) {
      var top = meshes[i];
      try { while (top && top.parent && top.parent !== scene) top = top.parent; } catch (e0) {}
      if (!top || top === scene) top = meshes[i];
      var known = false;
      for (var j = 0; j < tops.length; j += 1) { if (tops[j].node === top) { known = true; break; } }
      if (!known && tops.length < 16) {
        var nm = '';
        try { nm = String(top.name || ''); } catch (e1) {}
        tops.push({ node: top, name: nm || ('gruppe-' + tops.length) });
      }
    }
    var boxes = [];
    for (var g = 0; g < tops.length; g += 1) {
      try {
        var b = new NSref.Box3().setFromObject(tops[g].node);
        if (b.isEmpty && b.isEmpty()) continue;
        boxes.push({
          id: String(tops[g].name).slice(0, 80),
          min: [roundMm(b.min.x), roundMm(b.min.y), roundMm(b.min.z)],
          max: [roundMm(b.max.x), roundMm(b.max.y), roundMm(b.max.z)]
        });
      } catch (e2) {}
    }
    if (boxes.length === 0) return { boxes: [], note: 'Boxen leer (unvermessen)' };
    return { boxes: boxes, note: '' };
  } catch (e3) { return { boxes: [], note: 'Boxen-Fehler' }; }
}
function probeBackfaces() {
  // S2-backface (A-08): Raycast Kamera -> max. 32 Meshes. Zaehlt BackSide-Material
  // bzw. Rueckseiten-Normalen. Ohne Kamera-/Szenen-Zugriff: 0 + Grund, KEIN Fake.
  try {
    var scene = probeScene();
    var camera = probeCamera(scene);
    if (!scene || !camera || !NSref || !NSref.Raycaster || !NSref.Vector3 || !NSref.Box3) {
      return { hits: 0, note: 'kein Kamera-/Szenen-Zugriff (Rueckseiten unvermessen)' };
    }
    try { scene.updateMatrixWorld(true); } catch (e0) {}
    var meshes = probeMeshes(scene, 32);
    if (meshes.length === 0) return { hits: 0, note: '' };
    var origin = null;
    try {
      origin = new NSref.Vector3();
      if (camera.getWorldPosition) camera.getWorldPosition(origin);
      else if (camera.position) origin.copy(camera.position);
      else return { hits: 0, note: 'Kameraposition unlesbar' };
    } catch (e1) { return { hits: 0, note: 'Kameraposition unlesbar' }; }
    var hits = 0;
    for (var i = 0; i < meshes.length && i < 32; i += 1) {
      try {
        var m = meshes[i];
        var mats = Array.isArray(m.material) ? m.material : [m.material];
        var backMat = false;
        for (var k = 0; k < mats.length; k += 1) {
          if (mats[k] && mats[k].side === NSref.BackSide) { backMat = true; break; }
        }
        if (backMat) { hits += 1; continue; }
        var bc = new NSref.Box3().setFromObject(m);
        if (bc.isEmpty && bc.isEmpty()) continue;
        var target = bc.getCenter(new NSref.Vector3());
        var dir = target.sub(origin);
        var dist = dir.length();
        if (!(dist > 1e-6)) continue;
        dir.normalize();
        var rc = new NSref.Raycaster(origin, dir, 0, dist + 0.02);
        var xs = rc.intersectObject(m, false);
        if (xs && xs.length > 0 && xs[0].face && xs[0].face.normal) {
          var n = xs[0].face.normal.clone().transformDirection(xs[0].object.matrixWorld);
          if (n.dot(dir) > 0) hits += 1;
        }
      } catch (e2) {}
    }
    return { hits: hits, note: '' };
  } catch (e3) { return { hits: 0, note: 'Raycast-Fehler' }; }
}
function snapshot() {
  var p = window.__labprobe;
  var last = rendererSeen[rendererSeen.length - 1];
  var info = last && last.info ? last.info : null;
  var bx = probeBoxes();
  var bf = probeBackfaces();
  var note = bx.note || bf.note;
  return {
    calls: info ? info.render.calls : p.calls,
    triangles: info ? info.render.triangles : p.triangles,
    meshes: countMeshes(),
    geometries: info && info.memory ? info.memory.geometries : p.geometries,
    textures: info && info.memory ? info.memory.textures : p.textures,
    programs: info && info.programs ? info.programs.length : p.programs,
    frames: p.frames,
    firstFrameAt: p.firstFrameAt,
    boxes: bx.boxes,
    backfaceHits: bf.hits,
    geoNote: note ? String(note).slice(0, 160) : ''
  };
}
var rafTimes = [];
window.addEventListener('message', function (ev) {
  var d = ev && ev.data;
  if (!d || d.sessionId !== window.__labsession) return;
  if (d.cmd === 'lab-get-probe') {
    try { parent.postMessage({ type: 'lab-probe', sessionId: window.__labsession, reqId: d.reqId, snapshot: snapshot() }, ev.origin === 'null' ? '*' : ev.origin); } catch (e) {}
  }
  if (d.cmd === 'lab-update' && handle && handle.update) {
    try { handle.update(d.patch || {}); } catch (e) { post('model-error', { code: 'E-API-UPDATE', message: String((e && e.message) || e) }); }
  }
  if (d.cmd === 'lab-dispose') {
    try { if (handle && handle.dispose) handle.dispose(); } catch (e) {}
    post('lab-disposed', {});
  }
  if (d.cmd === 'lab-snapshot-view' && handle && handle.update) {
    try { handle.update({ view: d.preset || 'overview' }); } catch (e) {}
  }
  if (d.cmd === 'lab-capture') {
    try {
      var cv = container ? container.querySelector('canvas') : null;
      var url = cv ? cv.toDataURL('image/png') : '';
      try { parent.postMessage({ type: 'lab-capture', sessionId: window.__labsession, reqId: d.reqId, dataUrl: url }, ev.origin === 'null' ? '*' : ev.origin); } catch (e2) {}
    } catch (e) { post('model-error', { code: 'E-S3-EMPTY', message: String((e && e.message) || e) }); }
  }
});
(async function boot() {
  try {
    var threeUrl = blobOf('lab-three');
    var helpersUrl = blobOf('lab-helpers');
    var moduleUrl = blobOf('lab-module');
    var THREE = await import(threeUrl);
    var NS = instrument(THREE);
    NSref = NS; // S2-Probe (A-08): Box3/Raycaster aus instrumentiertem THREE
    var helpersSrc = unescapePayload(document.getElementById('lab-helpers').textContent || '');
    var helpersCode = helpersSrc
      .split("from 'three'").join("from '" + threeUrl + "'")
      .split('from "three"').join('from "' + threeUrl + '"')
      .split("await import('three')").join("await import('" + threeUrl + "')")
      .split('await import("three")').join('await import("' + threeUrl + '")');
    var helpersUrl2 = URL.createObjectURL(new Blob([helpersCode], { type: 'text/javascript' }));
    var H = await import(helpersUrl2);
    var moduleSrc = unescapePayload(document.getElementById('lab-module').textContent || '');
    var rewritten = moduleSrc
      .split("from 'three/addons/controls/OrbitControls.js'").join("from '" + threeUrl + "'")
      .split('from "three/addons/controls/OrbitControls.js"').join('from "' + threeUrl + '"')
      .split("from 'three'").join("from '" + threeUrl + "'")
      .split('from "three"').join('from "' + threeUrl + '"')
      .split("from 'wrapper-helpers'").join("from '" + helpersUrl2 + "'")
      .split('from "wrapper-helpers"').join('from "' + helpersUrl2 + '"');
    var finalUrl = URL.createObjectURL(new Blob([rewritten], { type: 'text/javascript' }));
    var mod = await import(finalUrl);
    window.__labmodule = mod;
    if (!mod || typeof mod.init !== 'function' || !mod.meta) {
      post('model-error', { code: 'E-API-INIT', message: 'init/meta fehlt' });
      return;
    }
    container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;';
    document.body.appendChild(container);
    var params = Object.assign({}, window.__labparams || {});
    handle = await mod.init(container, params);
    if (!handle || typeof handle.update !== 'function' || typeof handle.dispose !== 'function') {
      post('model-error', { code: 'E-API-INIT', message: 'ModelHandle unvollstaendig' });
      return;
    }
    window.__labhandle = handle;
    var t0 = performance.now();
    var useRaf = typeof requestAnimationFrame === 'function';
    var tick = function () {
      var p = window.__labprobe;
      p.frames += 1;
      if (p.firstFrameAt === null) {
        p.firstFrameAt = performance.now() - t0;
        var s = snapshot();
        post('model-ready', { firstFrameAt: p.firstFrameAt, snapshot: s });
      }
      if (useRaf) requestAnimationFrame(tick);
    };
    if (useRaf) requestAnimationFrame(tick);
    else { setTimeout(function () { window.__labprobe.firstFrameAt = performance.now() - t0; post('model-ready', { firstFrameAt: window.__labprobe.firstFrameAt, snapshot: snapshot() }); }, 16); }
    // HARNESS (Occlusion-Watchdog): rAF pausiert in ueberdeckten/versteckten
    // Frames (Seiten-Scroll, Hintergrund-Tab, Headless) — dann meldet ein
    // Timer den fertigen Szenenaufbau, damit S2 nicht an der Drosselung
    // scheitert. Doppelmeldung unmoeglich (firstFrameAt-Guard in tick()).
    setTimeout(function () {
      var pw = window.__labprobe;
      if (pw.firstFrameAt === null) {
        pw.frames += 1;
        pw.firstFrameAt = performance.now() - t0;
        post('model-ready', { firstFrameAt: pw.firstFrameAt, snapshot: snapshot() });
      }
    }, 1500);
  } catch (e) {
    var msg = String((e && e.message) || e);
    var code = /SyntaxError|Unexpected token|Cannot use import|Failed to fetch|CSS|MIME/i.test(msg) ? 'E-S1-SYNTAX' : 'E-S2-BOOT';
    post('model-error', { code: code, message: msg.slice(0, 400) });
  }
})();
<\/script>
</body></html>`;
}
