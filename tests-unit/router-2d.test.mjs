/** Unittests P0-Router + 2D-Gates (node-Testrunner, fetch gemockt). */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  configureLiveGen, routeGeneration, parseRouterDecision, truncateFachtext,
  ROUTER_2D_TYPES, ROUTER_3D_TYPES, ROUTER_FACHTEXT_MAX, ROUTER_TYP_TO_KIND,
} from '../src/runtime/livegen.js';
import {
  ALLOW_SPECIFIERS, ALLOW_2D_SPECIFIERS, TWOD_KNOWN_EXPORTS, TWOD_KINDS,
  isTwoDSource, staticGate,
} from '../src/runtime/guard-static.js';
import { verifySvgLayer, extractDiagram } from '../src/runtime/verify.js';
import { buildDiagramSvg, countSvgShapes, isWellformedSvg, renderDiagram2D, DIAGRAM_KINDS } from '../src/vendor/diagram-2d.js';

const REAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  configureLiveGen({ proxyUrl: null });
});

function jsonResponse(obj) {
  return { ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) };
}

test('P0-Prompts vorhanden: p0-router mit Platzhalter + Few-shots, p1-2d mit Vertrag', async () => {
  const p0 = await readFile('prompts/p0-router.txt', 'utf8');
  assert.ok(p0.includes('{FACHTEXT}'), 'Platzhalter');
  assert.ok(p0.includes('schaltplan') && p0.includes('flussdiagramm') && p0.includes('schnitt-ansicht') && p0.includes('diagramm') && p0.includes('tabelle'));
  assert.ok(p0.includes('Viertaktmotor') && p0.includes('RC-Tiefpass'), 'Few-shots');
  assert.ok(p0.includes('muse-spark-1.3-contributor') && p0.includes('Kein Fremdmodell'), 'Meta-Regel im P0-Prompt');
  const p1 = await readFile('prompts/p1-generate-2d.txt', 'utf8');
  assert.ok(p1.includes("from '2d-svg'") && p1.includes('renderDiagram2D') && p1.includes('{FACHTEXT}'));
  assert.ok(p1.includes('document') && p1.includes('NIEMALS'), 'Verbote dokumentiert');
});

test('parseRouterDecision: 4 Few-shots parsen exakt', () => {
  const cases = [
    ['Vorlauf {"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."} Nachlauf', '3d', 'baugruppe', false],
    ['{"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, keine raeumliche Anordnung noetig."}', '2d', 'schaltplan', false],
    ['{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}', '2d', 'flussdiagramm', false],
    ['Text {"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}', '2d', 'diagramm', false],
  ];
  for (const [raw, mode, typ, fb] of cases) {
    const r = parseRouterDecision(raw);
    assert.equal(r.mode, mode, raw.slice(0, 40));
    assert.equal(r.typ, typ);
    assert.equal(r.fallback, fb);
  }
});

test('parseRouterDecision: Fail-closed 3D bei allem Ungueltigen', () => {
  for (const bad of [
    '',
    'Nur Prosa ohne JSON.',
    '{"mode":"2d","typ":"quatsch","begruendung":"Unbekannter Typ mit genug Zeichen hier."}',
    '{"mode":"4d","typ":"x","begruendung":"Unbekannter Modus mit genug Zeichen hier."}',
    '{"mode":"2d","typ":"schaltplan"}',
    '{"mode":"3d","typ":"baugruppe","begruendung":"kurz"}',
    '{kein json}',
  ]) {
    const r = parseRouterDecision(bad);
    assert.equal(r.mode, '3d', bad.slice(0, 40));
    assert.equal(r.fallback, true);
  }
});

test('parseRouterDecision: laengster Block gewinnt', () => {
  const raw = '{"mode":"3d","typ":"baugruppe","begruendung":"Kurz, aber lang genug fuer Schema."} und {"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Taxonomie ohne Lage, Struktur statt Raumbezug hier."}';
  const r = parseRouterDecision(raw);
  assert.equal(r.mode, '2d');
  assert.equal(r.typ, 'tabelle');
});

test('truncateFachtext: Kappe bei 4000 Zeichen', () => {
  assert.equal(truncateFachtext('abc').length, 3);
  assert.equal(truncateFachtext('x'.repeat(5000)).length, ROUTER_FACHTEXT_MAX);
  assert.equal(ROUTER_FACHTEXT_MAX, 4000);
});

test('routeGeneration: E-GEN-OFFLINE ohne Proxy, E-GEN-400 bei Kurztext', async () => {
  configureLiveGen({ proxyUrl: null });
  await assert.rejects(routeGeneration('Lang genug fuer den Router-Pfad hier'), /E-GEN-OFFLINE/);
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  await assert.rejects(routeGeneration('kurz'), /E-GEN-400/);
});

test('routeGeneration: Fail-closed 3D bei HTTP-Fehler/Timeout (kein Throw)', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const r1 = await routeGeneration('Viertaktmotor Kolben Pleuel Kurbelwelle Ventile Zylinderkopf lang');
  assert.equal(r1.mode, '3d');
  assert.equal(r1.fallback, true);
  globalThis.fetch = async () => { throw new Error('fetch failed'); };
  const r2 = await routeGeneration('RC-Tiefpass Widerstand Kondensator Bode-Diagramm Grenzfrequenz lang');
  assert.equal(r2.mode, '3d');
  assert.equal(r2.fallback, true);
  globalThis.fetch = async () => jsonResponse({ text: 'Nur Prosa, kein JSON.' });
  const r3 = await routeGeneration('Photosynthese Lichtreaktion Calvin-Zyklus Entscheidungspunkte lang');
  assert.equal(r3.mode, '3d');
  assert.equal(r3.fallback, true);
});

test('routeGeneration: Erfolgspfad + Kappung + 2D-Typ', async () => {
  configureLiveGen({ proxyUrl: 'http://127.0.0.1:9/mock', timeoutMs: 2000 });
  let seen = null;
  globalThis.fetch = async (_url, opts) => {
    seen = JSON.parse(opts?.body ?? '{}');
    return jsonResponse({ text: '{"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, kein Raumbezug noetig."}' });
  };
  const tpl = 'P0:\n{FACHTEXT}\nENDE';
  const r = await routeGeneration('RC-Tiefpass: ' + 'Widerstand '.repeat(1000), { promptTemplate: tpl });
  assert.equal(r.mode, '2d');
  assert.equal(r.typ, 'schaltplan');
  assert.equal(r.fallback, false);
  assert.ok(seen.prompt.startsWith('P0:\nRC-Tiefpass: '), 'Template ersetzt');
  assert.ok(seen.prompt.length <= tpl.length + ROUTER_FACHTEXT_MAX, 'Fachtext gekappt');
  assert.equal(seen.stream, false);
  assert.equal(seen.max_tokens, 300);
  assert.equal(seen.temperature, 0);
});

test('Router-Typ-Mapping deckt alle 2D-Typen auf Vendor-Kinds ab', () => {
  for (const t of ROUTER_2D_TYPES) {
    assert.ok(ROUTER_TYP_TO_KIND[t], `Mapping fuer ${t}`);
    assert.ok(TWOD_KINDS.includes(ROUTER_TYP_TO_KIND[t]), `Kind ${ROUTER_TYP_TO_KIND[t]} in Whitelist`);
  }
  assert.ok(ROUTER_3D_TYPES.length >= 3);
});

test('Guard: 2D-Allowlist (Vendor-Prinzip: Lib in Vendor, Modul liefert Daten)', () => {
  for (const spec of ['2d-svg', '2d-mermaid', '2d-chart', '2d-d3', '2d-katex']) {
    assert.ok(ALLOW_SPECIFIERS.includes(spec), spec);
    assert.ok(ALLOW_2D_SPECIFIERS.includes(spec), spec);
  }
  assert.ok(TWOD_KNOWN_EXPORTS.includes('renderDiagram2D'));
  assert.ok(TWOD_KINDS.includes('er') && TWOD_KINDS.includes('bars'));
  assert.ok(isTwoDSource("import { renderDiagram2D } from '2d-svg';"));
  assert.ok(!isTwoDSource("import { Scene } from 'three';"));
  const gate = staticGate("import { renderDiagram2D } from '2d-svg';\nexport const meta={};\nexport function init(c){}", {});
  assert.ok(gate.imports.ok && gate.ok, JSON.stringify(gate.imports.offending));
  const bad = staticGate("import { x } from '2d-evil';\nexport const meta={};\nexport function init(c){}", {});
  assert.ok(!bad.imports.ok, 'unbekannte 2d-Spec abgelehnt');
});

test('Vendor-Renderer: alle Kinds bauen wohlgeformtes SVG mit >= 4 Shapes', () => {
  for (const kind of DIAGRAM_KINDS) {
    const svg = buildDiagramSvg({ kind, title: 'T', labels: ['A', 'B', 'C', 'D'], measurement: 'M: 1 m', values: [3, 1, 2, 4] });
    assert.ok(isWellformedSvg(svg), `${kind}: wohlgeformt`);
    assert.ok(countSvgShapes(svg) >= 4, `${kind}: ${countSvgShapes(svg)} Shapes`);
  }
  assert.ok(!isWellformedSvg('<svg><script>alert(1)</script></svg>'), 'script abgelehnt');
  assert.ok(!isWellformedSvg('<div>kein svg</div>'), 'nicht-svg abgelehnt');
  assert.throws(() => renderDiagram2D(null, {}), /E-2D-CONTAINER/);
});

test('Verify-2D-Gates: 6 Datenmodule pass, 3D-Modul faellt parse', async () => {
  for (const id of ['dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3']) {
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    const diagram = extractDiagram(src);
    assert.ok(diagram && TWOD_KINDS.includes(diagram.kind), `${id}: kind`);
    const { layer } = verifySvgLayer(src);
    assert.equal(layer.verdict, 'pass', `${id}: ${JSON.stringify(layer.criteria)}`);
    for (const cid of ['S2-2d-parse', 'S2-2d-typ', 'S2-2d-parse-svg', 'S2-2d-pixel', 'S2-2d-wellformed']) {
      assert.ok(layer.criteria.some((c) => c.id === cid && c.verdict === 'pass'), `${id}: ${cid}`);
    }
  }
  const src3d = await readFile('src/models/si-1.js', 'utf8');
  assert.equal(extractDiagram(src3d), null);
  const { layer } = verifySvgLayer(src3d);
  assert.equal(layer.verdict, 'fail', '3D-Modul besteht S2-light nicht');
  const evil = "import { renderDiagram2D } from '2d-svg';\nexport const diagram = { kind: 'quatsch', labels: ['A'], measurement: 'M: 1 m' };";
  assert.equal(verifySvgLayer(evil).layer.verdict, 'fail', 'Typ-Whitelist greift');
});
