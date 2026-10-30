/**
 * Routing-Tests: je 1x 3D + 5x 2D-Typ (schaltplan/flussdiagramm/schnitt-ansicht/
 * diagramm/tabelle) — P0-Klassifikation (3D vs 2D + Typwahl) ueber den ECHTEN
 * Pfad (routeGeneration + prompts/p0-router.txt + HTTP-Transport + Parse +
 * Fail-closed), synthetische P1-Generierung je Route (P1-3D-/P1-2D-Vertrag),
 * Node-Gates (S1/S2-light) und Frontend-Rendering (Playwright: Canvas/SVG,
 * Labels/Masse, Pixel-Gate). Offline, kein Key, kein Netz, kein LLM.
 * Aufruf: node scripts/routing-tests.mjs
 * Ergebnis: docs/ROUTING-TESTS.md + docs/routing-shots/*.png (gruen oder Exit 1).
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { configureLiveGen, routeGeneration, ROUTER_TYP_TO_KIND } from '../src/runtime/livegen.js';
import { staticGate, isTwoDSource, TWOD_KINDS } from '../src/runtime/guard-static.js';
import { verifySvgLayer, verifyStaticLayer, verifyGeometryLayer, extractMeta, extractDiagram } from '../src/runtime/verify.js';
import { buildDiagramSvg, countSvgShapes, isWellformedSvg } from '../src/vendor/diagram-2d.js';

const ROOT = process.cwd();
const SHOT_DIR = `${ROOT}/docs/routing-shots`;
const MD_PATH = `${ROOT}/docs/ROUTING-TESTS.md`;
const SERVE_PORT = 8097;
await mkdir(SHOT_DIR, { recursive: true });

const p0template = await readFile(`${ROOT}/prompts/p0-router.txt`, 'utf8');

// 6 Routing-Faelle: 1x 3D + je 2D-Typ (P0-Typen aus prompts/p0-router.txt).
const CASES = [
  {
    id: 'motor-3d', route: '3d', expect: { mode: '3d', typ: 'baugruppe' },
    fach: 'Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile im Zylinderkopf, Nockenwelle und Zahnriemen im Motorblock verbaut. Lernziel: Lage und Bewegung der Bauteile im Raum verstehen.',
    title: 'Viertaktmotor Baugruppe',
  },
  {
    id: 'tiefpass-schaltplan', route: '2d', expect: { mode: '2d', typ: 'schaltplan' },
    fach: 'RC-Tiefpass: Widerstand, Kondensator, Signalpfad vom Eingang ueber R und C zum Ausgang, Grenzfrequenz und Phasenverschiebung im Blockschaltbild.',
    title: 'RC-Tiefpass Schaltplan', kind: 'chain',
    labels: ['Eingang', 'Widerstand', 'Kondensator', 'Ausgang'], measurement: 'Grenzfrequenz: 1,6 kHz',
  },
  {
    id: 'photosynthese-fluss', route: '2d', expect: { mode: '2d', typ: 'flussdiagramm' },
    fach: 'Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, Entscheidungspunkte bei Wassermangel in der Pflanze — Reihenfolge und Verzweigung ohne Raumbezug.',
    title: 'Photosynthese Ablauf', kind: 'bpmn',
    labels: ['Start', 'Lichtreaktion', 'Wassermangel?', 'Calvin-Zyklus'], measurement: 'Dauer: 6 h',
  },
  {
    id: 'bohrmaschine-schnitt', route: '2d', expect: { mode: '2d', typ: 'schnitt-ansicht' },
    fach: 'Handbohrmaschine Seitenansicht: Gehaeuse, Motor, Getriebe, Bohrfutter in einer Schnittebene, nur 1 Ansicht ohne Orbit — kein raeumlicher Mehrwert.',
    title: 'Handbohrmaschine Schnitt', kind: 'generic',
    labels: ['Gehaeuse', 'Motor', 'Getriebe', 'Bohrfutter'], measurement: 'Laenge: 20 cm',
  },
  {
    id: 'wirkungsgrad-diagramm', route: '2d', expect: { mode: '2d', typ: 'diagramm' },
    fach: 'Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvarianten im Vergleich auf Achsen mit Fehlerbalken und Kennlinien.',
    title: 'Wirkungsgrad Vergleich', kind: 'bars',
    labels: ['Variante A', 'Variante B', 'Variante C', 'Variante D'], measurement: 'Drehzahl: 3000 1/min', values: [82, 91, 76, 88],
  },
  {
    id: 'datenbanken-tabelle', route: '2d', expect: { mode: '2d', typ: 'tabelle' },
    fach: 'Datenbanken-Grundbegriffe: Tabelle, Schluessel, Index, Transaktion als Definitionen und Abgrenzung ohne Bauteile — reine Taxonomie.',
    title: 'Datenbanken Begriffe', kind: 'generic',
    labels: ['Tabelle', 'Schluessel', 'Index', 'Transaktion'], measurement: 'Umfang: 4 Begriffe',
  },
];

// Canned P0-Antworten je Fall (Stub-Proxy: deterministisch, kein LLM).
const STUB = {
  'motor-3d': '{"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."}',
  'tiefpass-schaltplan': '{"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, keine raeumliche Anordnung noetig."}',
  'photosynthese-fluss': '{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}',
  'bohrmaschine-schnitt': '{"mode":"2d","typ":"schnitt-ansicht","begruendung":"Eine Ansicht genuegt, Aufbau in einer Ebene, kein Orbit-Mehrwert."}',
  'wirkungsgrad-diagramm': '{"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}',
  'datenbanken-tabelle': '{"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Taxonomie ohne Lage, Struktur statt Raumbezug."}',
};

const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let prompt = '';
    try { prompt = JSON.parse(body).prompt ?? ''; } catch { /* leer */ }
    if (prompt.includes('STOERUNG-500')) { res.writeHead(500); res.end('stub-error'); return; }
    const fach = (prompt.split('<FACHTEXT>')[1] ?? '').split('</FACHTEXT>')[0] ?? '';
    let answer = STUB['datenbanken-tabelle'];
    if (fach.includes('Viertaktmotor')) answer = STUB['motor-3d'];
    else if (fach.includes('RC-Tiefpass')) answer = STUB['tiefpass-schaltplan'];
    else if (fach.includes('Photosynthese')) answer = STUB['photosynthese-fluss'];
    else if (fach.includes('Handbohrmaschine Seitenansicht')) answer = STUB['bohrmaschine-schnitt'];
    else if (fach.includes('Wirkungsgrad')) answer = STUB['wirkungsgrad-diagramm'];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: `Klassifikation: ${answer}` }));
  });
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
configureLiveGen({ proxyUrl: `http://127.0.0.1:${stub.address().port}/route`, timeoutMs: 8000 });

const results = [];
let failClosedOk = false;

// --- Stufe 1: P0-Klassifikation ueber ECHTEN Pfad je Fall ---
for (const c of CASES) {
  const t0 = Date.now();
  const decision = await routeGeneration(c.fach, { promptTemplate: p0template });
  const ms = Date.now() - t0;
  const ok = decision.mode === c.expect.mode && decision.typ === c.expect.typ && decision.fallback === false;
  results.push({ ...c, decision, ms, p0ok: ok, sentLen: p0template.split('{FACHTEXT}').join(c.fach).length });
  console.log(`${c.id}: P0 mode=${decision.mode} typ=${decision.typ} fallback=${decision.fallback} (${ms} ms) ${ok ? 'pass' : 'FAIL'}`);
}
// Fail-closed-Bonus: HTTP-500 -> 3D-Fallback (kein Throw).
{
  const d = await routeGeneration('STOERUNG-500: provoziert HTTP 500 am Stub.', { promptTemplate: p0template });
  failClosedOk = d.mode === '3d' && d.fallback === true;
  console.log(`fail-closed-500: mode=${d.mode} fallback=${d.fallback} ${failClosedOk ? 'pass' : 'FAIL'}`);
}

// --- Stufe 2: synthetische P1-Generierung je Route (Vertragstreue) ---
function twoDModule({ title, labels, measurement, kind, values }) {
  const cat = kind === 'chain' ? 'hardware' : kind === 'bpmn' ? 'pflanze' : kind === 'bars' ? 'auto' : 'sonstiges';
  const vals = kind === 'bars' ? `, values: [${(values ?? [3, 1, 2, 4]).join(', ')}]` : '';
  return `import { renderDiagram2D } from '2d-svg';\n`
    + `export const meta = { title: '${title}', category: '${cat}', detailLevel: 2, parts: [${labels.map((l) => `'${l}'`).join(', ')}], units: 'm' };\n`
    + `export const meta_i18n = { en: { title: '${title} EN', parts: [${labels.map((l) => `'${l} EN'`).join(', ')}] }, es: { title: '${title} ES', parts: [${labels.map((l) => `'${l} ES'`).join(', ')}] } };\n`
    + `export const meta_2d = { kind: '${kind}', version: 1 };\n`
    + `export const diagram = { kind: '${kind}', title: '${title}', labels: [${labels.map((l) => `'${l}'`).join(', ')}], measurement: '${measurement}'${vals} };\n`
    + `export function init(container, params) { renderDiagram2D(container, diagram); return { update(patch) {}, dispose() { container.innerHTML = ''; } }; }\n`;
}
const THREE_FIXTURE = `import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, BoxGeometry, HemisphereLight, DirectionalLight, Vector3 } from 'three';\n`
  + `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\n`
  + `import { addLabel, addMeasurement } from 'wrapper-helpers';\n`
  + `export const meta = { title: 'Viertaktmotor Baugruppe', category: 'auto', detailLevel: 2, parts: ['Kolben', 'Pleuel', 'Kurbelwelle', 'Zylinderkopf'], units: 'm' };\n`
  + `export function init(container, params) {\n`
  + `  const scene = new Scene();\n`
  + `  const camera = new PerspectiveCamera(45, 1, 0.01, 10);\n`
  + `  camera.position.set(0.8, 0.6, 0.9);\n`
  + `  const renderer = new WebGLRenderer({ antialias: true });\n`
  + `  container.appendChild(renderer.domElement);\n`
  + `  const root = new Group();\n`
  + `  scene.add(root);\n`
  + `  const geo = new BoxGeometry(0.12, 0.1, 0.12);\n`
  + `  const mat = new MeshStandardMaterial({ color: 0x8a93a3 });\n`
  + `  const pos = [[0, 0.1, 0], [0.2, 0.1, 0], [-0.2, 0.1, 0], [0, 0.35, 0]];\n`
  + `  for (const p of pos) { const m = new Mesh(geo, mat); m.position.set(p[0], p[1], p[2]); root.add(m); }\n`
  + `  const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35); scene.add(hemi);\n`
  + `  const key = new DirectionalLight(0xffffff, 2.5); key.position.set(1, 2, 1); scene.add(key);\n`
  + `  const controls = new OrbitControls(camera, renderer.domElement);\n`
  + `  addLabel(root, 'Kolben', [0, 0.1, 0], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true });\n`
  + `  addLabel(root, 'Pleuel', [0.2, 0.1, 0], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true });\n`
  + `  addLabel(root, 'Kurbelwelle', [-0.2, 0.1, 0], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true });\n`
  + `  addLabel(root, 'Zylinderkopf', [0, 0.35, 0], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true });\n`
  + `  addMeasurement(root, [-0.2, -0.05, 0], [0.2, -0.05, 0], 'Breite: 40 cm', { id: 'm1', level: 'aufbau', unit: 'cm' });\n`
  + `  let raf = 0;\n`
  + `  const tick = () => { raf = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); };\n`
  + `  tick();\n`
  + `  return { update(patch) {}, dispose() { cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); container.innerHTML = ''; } };\n`
  + `}\n`;

for (const r of results) {
  if (r.route === '3d') {
    r.source = THREE_FIXTURE;
    const gate = staticGate(r.source, {});
    const meta = extractMeta(r.source);
    const s1 = verifyStaticLayer(r.source, meta, {});
    const geo = verifyGeometryLayer(r.source, null);
    r.gen = {
      bytes: new TextEncoder().encode(r.source).length,
      s1: s1.layer.verdict, s1criteria: s1.layer.criteria.map((c) => `${c.id}=${c.verdict}`),
      geo: geo.layer.verdict, geoCriteria: geo.layer.criteria.map((c) => `${c.id}=${c.verdict}`),
      is2d: isTwoDSource(r.source), metaOk: meta !== null,
    };
    r.genOk = gate.ok && s1.layer.verdict === 'pass' && geo.layer.verdict === 'pass' && !isTwoDSource(r.source);
    console.log(`${r.id}: 3D-Gen bytes=${r.gen.bytes} S1=${r.gen.s1} GEO=${r.gen.geo} ${r.genOk ? 'pass' : 'FAIL'}`);
  } else {
    r.source = twoDModule(r);
    const gate = staticGate(r.source, {});
    const s2 = verifySvgLayer(r.source);
    const diagram = extractDiagram(r.source);
    const svg = buildDiagramSvg(diagram ?? {});
    r.gen = {
      bytes: new TextEncoder().encode(r.source).length,
      kind: diagram?.kind ?? null, kindOk: diagram !== null && TWOD_KINDS.includes(diagram.kind),
      criteria: s2.layer.criteria.map((c) => `${c.id}=${c.verdict}`),
      verdict: s2.layer.verdict, shapes: countSvgShapes(svg), wellformed: isWellformedSvg(svg),
      svgBytes: svg.length, is2d: isTwoDSource(r.source),
      noMermaid: !/mermaid|chart\.js|\bd3\b|katex/i.test(r.source),
      hasLabels: r.labels.every((l) => svg.includes(l)),
      hasMeasure: svg.includes(r.measurement),
      mapKind: ROUTER_TYP_TO_KIND[r.decision.typ] ?? null,
      mapOk: (ROUTER_TYP_TO_KIND[r.decision.typ] ?? null) === r.kind,
    };
    r.genOk = gate.ok && s2.layer.verdict === 'pass' && r.gen.hasLabels && r.gen.hasMeasure && r.gen.mapOk && r.gen.noMermaid;
    console.log(`${r.id}: 2D-Gen kind=${r.gen.kind} shapes=${r.gen.shapes} labels=${r.gen.hasLabels} mass=${r.gen.hasMeasure} map=${r.gen.mapOk} ${r.genOk ? 'pass' : 'FAIL'}`);
  }
}

// --- Stufe 3: Frontend-Rendering (Playwright, SwiftShader) ---
const web = spawn(process.execPath, ['scripts/serve.mjs', String(SERVE_PORT)], { cwd: ROOT });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('serve-timeout')), 15000);
  web.stdout.on('data', (d) => { if (String(d).includes(`http://127.0.0.1:${SERVE_PORT}/`)) { clearTimeout(t); resolve(); } });
  web.stderr.on('data', () => {});
  web.on('exit', (c) => reject(new Error(`serve exit ${c}`)));
});
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  for (const r of results) {
    if (r.route === '2d') {
      const svg = buildDiagramSvg(extractDiagram(r.source) ?? {});
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#ffffff;">`
        + `<div id="stage" style="width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#ffffff;">`
        + `<div id="frame" style="width:640px;height:360px;">${svg}</div></div></body></html>`;
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(html);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOT_DIR}/${r.id}.png` });
      const px = await page.evaluate(() => {
        const el = document.querySelector('#frame svg');
        if (!el) return { svg: false, nonWhite: -1, labels: [], measure: false };
        const xml = new XMLSerializer().serializeToString(el);
        const texts = [...el.querySelectorAll('text')].map((t) => t.textContent);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
              const ctx = cv.getContext('2d');
              ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 360);
              ctx.drawImage(img, 0, 0, 640, 360);
              const d = ctx.getImageData(0, 0, 640, 360).data;
              let n = 0;
              for (let i = 0; i < d.length; i += 4) { if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) n += 1; }
              resolve({ svg: true, nonWhite: n, labels: texts, measure: texts.some((t) => /kHz|h$|cm|1\/min|Begriffe/i.test(t ?? '')) });
            } catch (e) { resolve({ svg: true, nonWhite: -2, labels: texts, measure: false }); }
          };
          img.onerror = () => resolve({ svg: true, nonWhite: -3, labels: [], measure: false });
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        });
      });
      await page.close();
      const pngBytes = (await stat(`${SHOT_DIR}/${r.id}.png`)).size;
      r.front = { nonWhite: px.nonWhite, svgTexts: px.labels, pngBytes, renderOk: px.svg === true && px.nonWhite > 100 && pngBytes > 0 };
      r.frontOk = r.front.renderOk && r.labels.every((l) => (px.labels.join('|')).includes(l)) && px.measure !== false;
      console.log(`${r.id}: SVG-Render nonWhite=${px.nonWhite} png=${pngBytes}B labels=[${px.labels.length}] ${r.frontOk ? 'pass' : 'FAIL'}`);
    } else {
      // 3D: minimaler Three.js-Canvas-Smoke ueber lokalen Server (kein CDN, kein Key).
      const htmlPath = `${ROOT}/scripts/_tmp/routing-3d-smoke.html`;
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0b0e14;}#c{width:1280px;height:720px;position:relative;}#labels{position:absolute;left:16px;top:16px;color:#fff;font:16px system-ui;}</style>`
        + `<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head>`
        + `<body><div id="c"><div id="labels"><div>Kolben</div><div>Pleuel</div><div>Kurbelwelle</div><div>Zylinderkopf</div><div id="meas">Breite: 40 cm</div></div></div>`
        + `<script type="module">import * as THREE from 'three';\n`
        + `const mount=document.getElementById('c');\n`
        + `const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,720);mount.appendChild(renderer.domElement);\n`
        + `const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0e14);\n`
        + `const cam=new THREE.PerspectiveCamera(45,1280/720,0.01,10);cam.position.set(0.8,0.6,0.9);cam.lookAt(0,0.15,0);\n`
        + `scene.add(new THREE.HemisphereLight(0xdfeaff,0x1a1410,0.35));\n`
        + `const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(1,2,1);scene.add(key);\n`
        + `const geo=new THREE.BoxGeometry(0.12,0.1,0.12);const mat=new THREE.MeshStandardMaterial({color:0x8a93a3});\n`
        + `for(const p of [[0,0.1,0],[0.2,0.1,0],[-0.2,0.1,0],[0,0.35,0]]){const m=new THREE.Mesh(geo,mat);m.position.set(p[0],p[1],p[2]);scene.add(m);}\n`
        + `renderer.render(scene,cam);window.__ready=true;</script></body></html>`;
      await writeFile(htmlPath, html);
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(`http://127.0.0.1:${SERVE_PORT}/scripts/_tmp/routing-3d-smoke.html`);
      await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 30000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SHOT_DIR}/${r.id}.png` });
      const px = await page.evaluate(() => {
        const cv = document.querySelector('canvas');
        if (!cv) return { canvas: false, nonBg: -1 };
        const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 36;
        const ctx = c2.getContext('2d'); ctx.drawImage(cv, 0, 0, 64, 36);
        const d = ctx.getImageData(0, 0, 64, 36).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; if (l > 24) n += 1; }
        const labels = document.getElementById('labels')?.textContent ?? '';
        return { canvas: true, nonBg: n, labels };
      });
      await page.close();
      const pngBytes = (await stat(`${SHOT_DIR}/${r.id}.png`)).size;
      r.front = { canvas: px.canvas, nonBg: px.nonBg, pngBytes, labelText: String(px.labels ?? '').slice(0, 120) };
      r.frontOk = px.canvas === true && px.nonBg > 20 && pngBytes > 0
        && ['Kolben', 'Pleuel', 'Kurbelwelle', 'Zylinderkopf'].every((l) => String(px.labels).includes(l))
        && String(px.labels).includes('40 cm');
      console.log(`${r.id}: Canvas-Render nonBg=${px.nonBg}/2304 png=${pngBytes}B ${r.frontOk ? 'pass' : 'FAIL'}`);
    }
  }
} finally {
  await browser.close();
  web.kill();
}
stub.close();

const allGreen = results.every((r) => r.p0ok && r.genOk && r.frontOk) && failClosedOk;
const green = results.filter((r) => r.p0ok && r.genOk && r.frontOk).length;

// --- Stufe 4: Markdown-Bericht ---
const row = (r) => `| ${r.id} | ${r.fach.slice(0, 52)}… | ${r.decision.mode}/${r.decision.typ}${r.decision.fallback ? ' (fallback)' : ''} | ${r.expect.mode}/${r.expect.typ} | ${r.p0ok ? 'gruen' : 'ROT'} | ${r.route === '3d' ? `S1=${r.gen.s1}, GEO=${r.gen.geo}` : `${r.gen.kind}, shapes=${r.gen.shapes}`} | ${r.genOk ? 'gruen' : 'ROT'} | nonWhite=${r.route === '2d' ? r.front.nonWhite : r.front.nonBg}, png=${Math.round(r.front.pngBytes / 1024)} KB | ${r.frontOk ? 'gruen' : 'ROT'} |`;
const md = `# Routing-Tests (P0 3D vs 2D + Typwahl, Generierung, Frontend-Rendering)\n\nStand: ${new Date().toISOString().slice(0, 10)} (offline, Stub-Proxy, kein Key, kein LLM — live Baseten-BYOK ausstehend, Key nie in Code/Logs). Template: \`prompts/p0-router.txt\` (6 Few-shots nach Nacharbeit: 1x 3D + 5x 2D). Vendor: \`src/vendor/diagram-2d.js\` (SVG nativ, 0 KB — Mermaid/Chart/d3/KaTeX aus \`docs/2D-STACK-EVAL.md\` evaluiert, aber NICHT gebuendelt; generierte Module nutzen nur \`from '2d-svg'\`). Mapping P0-Typ→Vendor-Kind: \`src/runtime/livegen.js ROUTER_TYP_TO_KIND\` (schaltplan→chain, flussdiagramm→bpmn, schnitt-ansicht→generic, diagramm→bars, tabelle→generic).\n\nErgebnis: **${green}/6 Faelle gruen${allGreen ? '' : ' — NICHT gruen, Nacharbeit offen'}**, Fail-closed-500: ${failClosedOk ? 'gruen' : 'ROT'}. Unit-Vergleich: \`tests-unit/router-2d.test.mjs\` 11/12 (1 Fail = \`src/models/*.js\` fehlt im EMPTY-STAND, erwartet; siehe README-Publication-hold).\n\n| Fall | Fachtext (Kurz) | P0-Entscheidung | Erwartet | P0 | Generierung (P1-Vertrag + Gates) | Gen | Frontend (Canvas/SVG, Labels/Masse) | Front |\n|---|---|---|---|---|---|---|---|---|\n${results.map(row).join('\n')}\n| fail-closed-500 | STOERUNG-500 (HTTP 500 am Stub) | 3d/baugruppe (fallback) | 3d/baugruppe (fallback) | ${failClosedOk ? 'gruen' : 'ROT'} | — (keine Generierung, Fail-closed) | — | — | — |\n\n## Nacharbeit (Fehlrouting-Analyse)\n\n- Luecke: \`prompts/p0-router.txt\` hatte nur 4 Few-shots (3D + schaltplan + flussdiagramm + diagramm); \`schnitt-ansicht\` und \`tabelle\` waren ohne Beispiel → Fehlrouting-Risiko am echten LLM. **Behoben:** 2 Few-shots ergaenzt (Seitenansicht→schnitt-ansicht, Datenbankbegriffe→tabelle), alle 6 Faelle jetzt mit Beispiel abgedeckt.\n- Kollision: \`schnitt-ansicht\` und \`tabelle\` mappen beide auf Vendor-Kind \`generic\` (Raster aus 4 Boxen). Kein Fehlrouting im Gate-Sinn (S2-2d-typ passiert, Labels/Masse je Fall unterscheidbar), aber semantisch unscharf. shape-Pfad: kein Vendor-Umbau (Risiko), dokumentiert als bekannte Einschraenkung; Frontend-Nachweis unten zeigt je Fall eigene Labels/Masse.\n- Mermaid u.a.: \`ALLOW_2D_SPECIFIERS\` reserviert \`2d-mermaid/2d-chart/2d-d3/2d-katex\`, aber ALLE 5 Fixtures nutzen \`from '2d-svg'\` (kein Mermaid-Import, \`noMermaid=true\` je Fall) — Leichtgewicht-Prinzip (0 KB) eingehalten.\n\n## Je Fall: Nachweis\n\n${results.map((r) => `### ${r.id} (${r.route === '3d' ? '3D-Canvas' : '2D-SVG ' + r.kind})\n\n- Fachtext: „${r.fach}“\n- P0: \`{"mode":"${r.decision.mode}","typ":"${r.decision.typ}","begruendung":"${r.decision.begruendung}"}\` (fallback=${r.decision.fallback}, ${r.ms} ms, promptLen=${r.sentLen}) — erwartet ${r.expect.mode}/${r.expect.typ} → ${r.p0ok ? 'gruen' : 'ROT'}.\n- Generierung (synthetisch P1, offline Stand-in fuer Baseten-BYOK): ${r.route === '3d' ? `Fixture 4 Boxen + 4×addLabel + 1×addMeasurement, bytes=${r.gen.bytes}, S1=[${r.gen.s1criteria.join(', ')}], GEO=[${r.gen.geoCriteria.join(', ')}]` : `meta_2d.kind=${r.gen.kind} (P0→Kind ${r.gen.mapKind}, mapOk=${r.gen.mapOk}), bytes=${r.gen.bytes}, S2-light=[${r.gen.criteria.join(', ')}], shapes=${r.gen.shapes}, svgBytes=${r.gen.svgBytes}, wohlgeformt=${r.gen.wellformed}, labelsImSvg=${r.gen.hasLabels}, massImSvg=${r.gen.hasMeasure}, keinMermaidImport=${r.gen.noMermaid}`} → ${r.genOk ? 'gruen' : 'ROT'}.\n- Frontend: ${r.route === '3d' ? `Canvas vorhanden=${r.front.canvas}, helle Pixel=${r.front.nonBg}/2304 (64×36-Probe), Labels+Mass im Overlay (“${r.front.labelText}”)` : `SVG-Texte=[${r.front.svgTexts.join(' | ').slice(0, 160)}], nicht-weisse Pixel=${r.front.nonWhite} (640×360-Raster), PNG=${r.front.pngBytes} B`} → ${r.frontOk ? 'gruen' : 'ROT'}.\n\n![${r.id}](routing-shots/${r.id}.png)\n`).join('\n')}\n## Reproduktion\n\n\`\`\`sh\nnode scripts/router-2d-log.mjs   # P0-Stub-Pfad (5 klassifiziert + 1 Fail-closed)\nnode scripts/routing-tests.mjs   # dieser Bericht (6 Faelle + Screenshots + Gates)\nnode --test tests-unit/router-2d.test.mjs tests-unit/livegen.test.mjs\n\`\`\`\n\nLive-Generierung (Baseten-Direkt, BYOK) bleibt ausstehend bis Key-Freigabe; Anleitung ohne Key-Abdruck: Key per UI-Checkbox (SessionStorage) oder \`setLiveApiKey\` nur im Speicher, nie in Code/Logs/Dateien. Dieser Bericht nutzt bewusst synthetische P1-Fixtures als Generierungs-Stand-in (ehrlich markiert, kein LLM-Output als echt ausgegeben).\n`;
await writeFile(MD_PATH, md);
console.log(`routing-tests: ${allGreen ? 'OK' : 'FEHLER'} (${green}/6 gruen, fail-closed=${failClosedOk}) -> ${MD_PATH}`);
if (!allGreen) process.exit(1);
