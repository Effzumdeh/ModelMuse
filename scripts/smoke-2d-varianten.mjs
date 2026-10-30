/**
 * Smoke-2D-Varianten: je Testsachverhalt P0-Routing (3D vs 2D-Typ) ueber den
 * ECHTEN Pfad (routeGeneration + prompts/p0-router.txt + HTTP-Transport +
 * Parse + Fail-closed) plus Gates (S1/S2-light) und korrektes Rendering
 * (Vendor-Renderer + Pixel-Beleg aus shot-2d-variants-report.json).
 * Offline, kein Key, kein Netz ausser lokalem Stub, kein LLM.
 * Aufruf: node scripts/smoke-2d-varianten.mjs
 * Ergebnis: dist-2d/smoke-2d-varianten.json (gruen oder Exit 1).
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { configureLiveGen, routeGeneration } from '../src/runtime/livegen.js';
import { staticGate, isTwoDSource } from '../src/runtime/guard-static.js';
import { verifyTwoDLayer, twoDVariantOf } from '../src/runtime/verify-2d.js';

const ROOT = process.cwd();
const OUT = `${ROOT}/dist-2d`;
await mkdir(OUT, { recursive: true });
const p0template = await readFile(`${ROOT}/prompts/p0-router.txt`, 'utf8');

// 6 Testsachverhalte: 1x 3D + 5x 2D (je Variante einer).
const CASES = [
  {
    id: 'motor-3d', route: '3d', expect: { mode: '3d', typ: 'baugruppe' },
    fach: 'Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile im Zylinderkopf, Nockenwelle und Zahnriemen im Motorblock verbaut. Lernziel: Lage und Bewegung der Bauteile im Raum verstehen.',
  },
  {
    id: 'demo-2d-svg', variant: 'svg', spec: '2d-svg', route: '2d', expect: { mode: '2d', typ: 'schnitt-ansicht' },
    fach: 'Handbohrmaschine Seitenansicht: Gehaeuse, Motor, Getriebe, Bohrfutter in einer Schnittebene, nur 1 Ansicht ohne Orbit — kein raeumlicher Mehrwert.',
  },
  {
    id: 'demo-2d-mermaid', variant: 'mermaid', spec: '2d-mermaid', route: '2d', expect: { mode: '2d', typ: 'flussdiagramm' },
    fach: 'Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, Entscheidungspunkte bei Wassermangel in der Pflanze — Reihenfolge und Verzweigung ohne Raumbezug.',
  },
  {
    id: 'demo-2d-chart', variant: 'chart', spec: '2d-chart', route: '2d', expect: { mode: '2d', typ: 'diagramm' },
    fach: 'Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvarianten im Vergleich auf Achsen mit Fehlerbalken und Kennlinien.',
  },
  {
    id: 'demo-2d-d3', variant: 'd3', spec: '2d-d3', route: '2d', expect: { mode: '2d', typ: 'schaltplan' },
    fach: 'Rechnernetz-Topologie: Router, Switches und Clients als Knoten mit sternfoermiger Verbindungsstruktur, Topologie statt Geometrie.',
  },
  {
    id: 'demo-2d-katex', variant: 'katex', spec: '2d-katex', route: '2d', expect: { mode: '2d', typ: 'tabelle' },
    fach: 'pq-Formel und Diskriminante als Formelsatz mit Definitionen und Abgrenzung ohne Bauteile — reine begriffliche Struktur.',
  },
];

const STUB = {
  'motor-3d': '{"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."}',
  'demo-2d-svg': '{"mode":"2d","typ":"schnitt-ansicht","begruendung":"Eine Ansicht genuegt, Aufbau in einer Ebene, kein Orbit-Mehrwert."}',
  'demo-2d-mermaid': '{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}',
  'demo-2d-chart': '{"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}',
  'demo-2d-d3': '{"mode":"2d","typ":"schaltplan","begruendung":"Netztopologie und Verbindungsstruktur, keine raeumliche Geometrie."}',
  'demo-2d-katex': '{"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Formeln ohne Lage, Struktur statt Raumbezug."}',
};

const stub = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let prompt = '';
    try { prompt = JSON.parse(body).prompt ?? ''; } catch { /* leer */ }
    if (prompt.includes('STOERUNG-500')) { res.writeHead(500); res.end('stub-error'); return; }
    const fach = (prompt.split('<FACHTEXT>')[1] ?? '').split('</FACHTEXT>')[0] ?? '';
    let answer = STUB['demo-2d-katex'];
    if (fach.includes('Viertaktmotor')) answer = STUB['motor-3d'];
    else if (fach.includes('Handbohrmaschine Seitenansicht')) answer = STUB['demo-2d-svg'];
    else if (fach.includes('Photosynthese')) answer = STUB['demo-2d-mermaid'];
    else if (fach.includes('Wirkungsgrad')) answer = STUB['demo-2d-chart'];
    else if (fach.includes('Rechnernetz-Topologie')) answer = STUB['demo-2d-d3'];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: `Klassifikation: ${answer}` }));
  });
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
configureLiveGen({ proxyUrl: `http://127.0.0.1:${stub.address().port}/route`, timeoutMs: 8000 });

let shot = null;
try {
  shot = JSON.parse(await readFile(`${OUT}/shot-2d-variants-report.json`, 'utf8'));
} catch {
  /* Shot-Report fehlt: Rendering-Spalte failt ehrlich. */
}
const shotById = new Map((shot?.models ?? []).map((m) => [m.id, m]));

const results = [];
for (const c of CASES) {
  const t0 = Date.now();
  let routed = null;
  let routing = 'fail';
  try {
    routed = await routeGeneration(c.fach, { promptTemplate: p0template });
    routing = routed.mode === c.expect.mode && routed.typ === c.expect.typ && routed.fallback === false ? 'pass' : 'fail';
  } catch (e) {
    routed = { error: String((e && e.message) || e).slice(0, 120) };
  }
  const entry = {
    id: c.id, route: c.route, variant: c.variant ?? null, spec: c.spec ?? null,
    fachKurz: c.fach.slice(0, 60), expect: c.expect, routed,
    routing, s1: 'skip', s2: 'skip', render: 'skip', verdict: 'fail', ms: Date.now() - t0,
  };
  if (c.route === '2d') {
    const src = await readFile(`${ROOT}/src/models/${c.id}.js`, 'utf8');
    const gate = staticGate(src, {});
    entry.s1 = gate.ok && gate.imports.specifiers.includes(c.spec) && isTwoDSource(src) ? 'pass' : 'fail';
    const { layer } = verifyTwoDLayer(src);
    entry.s2 = layer.verdict;
    entry.s2Variant = twoDVariantOf(src);
    const shotRow = shotById.get(c.id);
    entry.render = shotRow && shotRow.verdict === 'pass' && shotRow.nonWhitePixels > 100 ? 'pass' : 'fail';
    entry.pixels = shotRow?.nonWhitePixels ?? -1;
    entry.shapes = shotRow?.shapes ?? -1;
  } else {
    entry.s1 = 'n/a-3d';
    entry.s2 = 'n/a-3d';
    entry.render = shotById.size >= 0 ? 'n/a-3d' : 'n/a-3d';
  }
  entry.verdict = entry.routing === 'pass'
    && (c.route === '3d' || (entry.s1 === 'pass' && entry.s2 === 'pass' && entry.render === 'pass'))
    ? 'pass' : 'fail';
  results.push(entry);
  console.log(`${c.id}: routing=${entry.routing} s1=${entry.s1} s2=${entry.s2} render=${entry.render} -> ${entry.verdict}`);
}

// Fail-closed-Beleg: HTTP-500 -> 3D-Fallback (kein Throw).
stub.close();
let failClosed = 'fail';
  const { default: http } = await import('node:http');
  const s2 = http.createServer((_req, res) => { res.writeHead(500); res.end('x'); });
  await new Promise((r) => s2.listen(0, '127.0.0.1', r));
  configureLiveGen({ proxyUrl: `http://127.0.0.1:${s2.address().port}/route`, timeoutMs: 8000 });
  const r = await routeGeneration('RC-Tiefpass Widerstand Kondensator Grenzfrequenz lang genug hier', { promptTemplate: p0template });
  if (r.mode === '3d' && r.fallback === true) failClosed = 'pass';
  s2.close();
console.log(`fail-closed-500: ${failClosed}`);

const report = {
  createdAt: new Date().toISOString(),
  p0Prompt: 'prompts/p0-router.txt',
  cases: results,
  failClosed500: failClosed,
  verdict: results.every((r) => r.verdict === 'pass') && failClosed === 'pass' ? 'pass' : 'fail',
};
await writeFile(`${OUT}/smoke-2d-varianten.json`, JSON.stringify(report, null, 2));
if (report.verdict !== 'pass') {
  console.error('smoke-2d-varianten: ABBRUCH (mind. 1 Testsachverhalt fail)');
  process.exit(1);
}
console.log('smoke-2d-varianten: OK (6/6 Testsachverhalte: P0-Routing + Gates + Rendering)');
