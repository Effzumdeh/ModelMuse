/** Unittests 2D-Alle-Varianten: Vendor-Gates, Allowlist, P0-Routing je Fall. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ALLOW_SPECIFIERS, ALLOW_2D_SPECIFIERS, TWOD_KNOWN_EXPORTS, TWOD_KINDS,
  MERMAID_DIAGRAMS, CHART_KINDS, D3_KINDS, KATEX_KINDS,
  MERMAID_KNOWN_EXPORTS, CHART_KNOWN_EXPORTS, D3_KNOWN_EXPORTS, KATEX_KNOWN_EXPORTS,
  isTwoDSource, staticGate,
} from '../src/runtime/guard-static.js';
import { verifyTwoDLayer, twoDVariantOf, countTwoDShapes, extractTwoDLiteral, TWOD_VARIANT_LITERAL } from '../src/runtime/verify-2d.js';
import { renderTwoDSource } from '../src/runtime/render-2d.js';
import { parseRouterDecision, ROUTER_TYP_TO_VARIANT, ROUTER_TOPOLOGY_VARIANT } from '../src/runtime/livegen.js';

const DEMOS = [
  { id: 'demo-2d-svg', variant: 'svg', spec: '2d-svg' },
  { id: 'demo-2d-mermaid', variant: 'mermaid', spec: '2d-mermaid' },
  { id: 'demo-2d-chart', variant: 'chart', spec: '2d-chart' },
  { id: 'demo-2d-d3', variant: 'd3', spec: '2d-d3' },
  { id: 'demo-2d-katex', variant: 'katex', spec: '2d-katex' },
];

test('Allowlist: alle 5 Specifier + Exportnamen je Vendor-Datei', () => {
  for (const { spec } of DEMOS) {
    assert.ok(ALLOW_SPECIFIERS.includes(spec), spec);
    assert.ok(ALLOW_2D_SPECIFIERS.includes(spec), spec);
  }
  for (const name of [...MERMAID_KNOWN_EXPORTS, ...CHART_KNOWN_EXPORTS, ...D3_KNOWN_EXPORTS, ...KATEX_KNOWN_EXPORTS]) {
    assert.ok(TWOD_KNOWN_EXPORTS.includes(name), name);
  }
  assert.deepEqual([...MERMAID_DIAGRAMS], ['fluss', 'sequenz', 'er', 'gantt']);
  assert.deepEqual([...CHART_KINDS], ['balken', 'linie', 'kreis']);
  assert.deepEqual([...D3_KINDS], ['netz', 'baum']);
  assert.deepEqual([...KATEX_KINDS], ['formel']);
});

test('Demo-Modelle: S1-ok, Variante erkannt, S2-light pass, S4-light pass', async () => {
  for (const { id, variant, spec } of DEMOS) {
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    assert.ok(isTwoDSource(src), `${id}: 2d-Pfad`);
    assert.equal(twoDVariantOf(src), variant);
    const gate = staticGate(src, {});
    assert.ok(gate.ok, `${id}: S1 ${JSON.stringify(gate.errors)}`);
    assert.ok(gate.imports.specifiers.includes(spec), `${id}: Spec ${spec}`);
    const { layer } = verifyTwoDLayer(src);
    assert.equal(layer.verdict, 'pass', `${id}: ${JSON.stringify(layer.criteria.filter((c) => c.verdict !== 'pass'))}`);
    for (const cid of ['S2-2d-parse', 'S2-2d-typ', 'S2-2d-semantik', 'S2-2d-parse-svg', 'S2-2d-pixel', 'S2-2d-layout', 'S2-2d-wellformed']) {
      assert.ok(layer.criteria.some((c) => c.id === cid && c.verdict === 'pass'), `${id}: ${cid}`);
    }
    const shapes = countTwoDShapes(variant, extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]) ?? {});
    assert.ok(shapes >= 4 && shapes <= 800, `${id}: shapes ${shapes}`);
    const box = { innerHTML: '' };
    const info = renderTwoDSource(box, src);
    assert.equal(info.variant, variant);
    assert.ok(box.innerHTML.length > 100, `${id}: Render-Output`);
  }
});

test('Negativ: jede Variante faellt bei falschem Typ + leerem Render', async () => {
  const bad = {
    svg: "import { renderDiagram2D } from '2d-svg';\nexport const diagram = { kind: 'quatsch', labels: ['A'], measurement: 'M: 1 m' };",
    mermaid: "import { renderMermaid2D } from '2d-mermaid';\nexport const mermaid = { diagram: 'quatsch', source: 'graph TD\nA-->B' };",
    chart: "import { renderChart2D } from '2d-chart';\nexport const chart = { kind: 'quatsch', labels: ['A'], values: [1] };",
    d3: "import { renderGraph2D } from '2d-d3';\nexport const graph = { kind: 'quatsch', nodes: [{ id: 'a' }], edges: [] };",
    katex: "import { renderMath2D } from '2d-katex';\nexport const formula = { kind: 'quatsch', tex: 'x' };",
  };
  for (const [variant, src] of Object.entries(bad)) {
    assert.equal(verifyTwoDLayer(src).layer.verdict, 'fail', `${variant}: Typ-Whitelist`);
  }
  assert.equal(verifyTwoDLayer("import { renderGraph2D } from '2d-d3';\nexport const graph = { kind: 'netz', nodes: [{ id: 'a' }], edges: [{ from: 'a', to: 'FEHLT' }] };").layer.verdict, 'fail', 'd3: node not found');
  assert.equal(verifyTwoDLayer("import { renderChart2D } from '2d-chart';\nexport const chart = { kind: 'balken', labels: ['A'], values: [] };").layer.verdict, 'fail', 'chart: leere Daten');
  assert.equal(verifyTwoDLayer("import { renderMath2D } from '2d-katex';\nexport const formula = { kind: 'formel', tex: '\\\\frac{1' };").layer.verdict, 'fail', 'katex: offene Klammer');
  assert.equal(verifyTwoDLayer("import { renderMermaid2D } from '2d-mermaid';\nexport const mermaid = { diagram: 'fluss', source: 'kein graph' };").layer.verdict, 'fail', 'mermaid: UnknownDiagram');
});

test('Haertung Semantik: je Typ schlaegt ein semantischer Fehler fehl', async () => {
  const { verifyTwoDSemantics } = await import('../src/runtime/verify-2d.js');
  const meta4 = "export const meta = { title: 'Titel-Test', category: 'sonstiges', detailLevel: 2, parts: ['Alpha', 'Beta', 'Gamma', 'Delta'], units: 'm' };";
  const i18n4 = "export const meta_i18n = { en: { title: 'Title test', parts: ['A', 'B', 'C', 'D'] }, es: { title: 'Titulo', parts: ['A', 'B', 'C', 'D'] } };";
  const src4 = (m2d) => `${meta4}\n${i18n4}\nexport const meta_2d = ${m2d};`;
  // svg: labels != parts
  assert.equal(verifyTwoDSemantics('svg', { kind: 'generic', title: 'T', labels: ['X', 'Y', 'Z', 'W'], measurement: 'H: 1 m' }, src4("{ kind: 'generic', version: 1 }")).ok, false, 'svg labels!=parts');
  // svg: measurement ohne Einheit
  assert.equal(verifyTwoDSemantics('svg', { kind: 'generic', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma', 'Delta'], measurement: 'ohne Einheit' }, src4("{ kind: 'generic', version: 1 }")).ok, false, 'svg mass ohne einheit');
  // mermaid: Legende nicht im Diagramm
  assert.equal(verifyTwoDSemantics('mermaid', { diagram: 'fluss', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma', 'Delta'], measurement: 'D: 6 h', source: 'graph TD\nA[Alpha]-->B[Beta]' }, src4("{ kind: 'fluss', version: 1 }")).ok, false, 'mermaid legende unvollstaendig');
  // mermaid: Knoten ohne Kante (Zusammenhang)
  assert.equal(verifyTwoDSemantics('mermaid', { diagram: 'fluss', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma', 'Delta'], measurement: 'D: 6 h', source: 'graph TD\nA[Alpha]\nB[Beta]\nC[Gamma]\nD[Delta]' }, src4("{ kind: 'fluss', version: 1 }")).ok, false, 'mermaid ohne kante');
  // chart: unit fehlt + labels/values-Mismatch + keine Spreizung
  const chartOk = { kind: 'balken', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma', 'Delta'], measurement: 'D: 1 %', values: [3, 1, 2, 4], unit: '%' };
  assert.equal(verifyTwoDSemantics('chart', chartOk, src4("{ kind: 'balken', version: 1 }")).ok, true, 'chart ok');
  assert.equal(verifyTwoDSemantics('chart', { ...chartOk, unit: '' }, src4("{ kind: 'balken', version: 1 }")).ok, false, 'chart unit fehlt');
  assert.equal(verifyTwoDSemantics('chart', { ...chartOk, values: [5, 5, 5, 5] }, src4("{ kind: 'balken', version: 1 }")).ok, false, 'chart keine spreizung');
  assert.equal(verifyTwoDSemantics('chart', { ...chartOk, values: [1, 2] }, src4("{ kind: 'balken', version: 1 }")).ok, false, 'chart zu wenig werte');
  // d3: Selbstkante / Insel / Label-Mismatch
  const d3src = (n, ni) => src4("{ kind: 'netz', version: 1 }").replaceAll("'Alpha', 'Beta', 'Gamma', 'Delta'", n).replaceAll("'A', 'B', 'C', 'D'", ni);
  const d3base = { kind: 'netz', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma'], measurement: 'L: 10 m', nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };
  assert.equal(verifyTwoDSemantics('d3', d3base, d3src("'Alpha', 'Beta', 'Gamma'", "'A', 'B', 'C'")).ok, true, 'd3 ok');
  assert.equal(verifyTwoDSemantics('d3', { ...d3base, edges: [{ from: 'a', to: 'a' }, { from: 'a', to: 'b' }] }, d3src("'Alpha', 'Beta', 'Gamma'", "'A', 'B', 'C'")).ok, false, 'd3 selbstkante');
  assert.equal(verifyTwoDSemantics('d3', { ...d3base, edges: [{ from: 'a', to: 'b' }] }, d3src("'Alpha', 'Beta', 'Gamma'", "'A', 'B', 'C'")).ok, false, 'd3 insel');
  // katex: Fliesstext ohne Formelzeichen
  assert.equal(verifyTwoDSemantics('katex', { kind: 'formel', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma', 'Delta'], measurement: 'B: 12 cm', tex: 'nur worte hier' }, src4("{ kind: 'formel', version: 1 }")).ok, false, 'katex kein formelzeichen');
  // meta_2d-Mismatch
  assert.equal(verifyTwoDSemantics('chart', chartOk, src4("{ kind: 'linie', version: 1 }")).ok, false, 'meta_2d mismatch');
});

test('Haertung Layout: Ueberlappung, Mindestschrift, Kanten-Regeln', async () => {
  const { verifyTwoDLayout } = await import('../src/runtime/verify-2d.js');
  const tight = { kind: 'netz', title: 'Titel-Test', labels: ['Alpha', 'Beta', 'Gamma'], measurement: 'L: 10 m', nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };
  assert.equal(verifyTwoDLayout('d3', tight).ok, true, 'd3 layout ok');
  const oneTick = { kind: 'balken', title: 'T', labels: ['A', 'B', 'C'], measurement: 'M: 1 %', values: [3, 1, 2], unit: '%' };
  assert.equal(verifyTwoDLayout('chart', oneTick).ok, true, 'chart layout ok');
  const katex = { kind: 'formel', title: 'T', labels: ['A1', 'B2', 'C3'], measurement: 'B: 12 cm', tex: 'x = \\frac{1}{2}' };
  assert.equal(verifyTwoDLayout('katex', katex).ok, true, 'katex layout ok');
  // Negativ: 9 Sequenz-Teilnehmer -> Akteur-Boxen ueberlappen (Spacing < Boxbreite)
  const parts = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const seq = 'sequenceDiagram\n' + parts.map((p) => `participant ${p}`).join('\n') + '\nA->>B: hi';
  const seqRes = verifyTwoDLayout('mermaid', { diagram: 'sequenz', title: 'Titel-Test', labels: parts.slice(0, 3), measurement: 'D: 1 h', source: seq });
  assert.equal(seqRes.ok, false, `sequenz-ueberlappung fail (${seqRes.actual})`);
});

test('P0-Routing je Testsachverhalt: 3D vs 2D-Typ (parse-Ebene, kein Netz)', () => {
  const cases = [
    ['{"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lagebezug, Orbit bringt Mehrwert hier."}', '3d', 'baugruppe'],
    ['{"mode":"2d","typ":"schnitt-ansicht","begruendung":"Eine Ansicht genuegt, Aufbau in einer Ebene, kein Mehrwert."}', '2d', 'schnitt-ansicht'],
    ['{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}', '2d', 'flussdiagramm'],
    ['{"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, kein raeumliches Modell."}', '2d', 'diagramm'],
    ['{"mode":"2d","typ":"schaltplan","begruendung":"Netztopologie und Verbindungsstruktur, keine Geometrie."}', '2d', 'schaltplan'],
    ['{"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Taxonomie ohne Lage, Struktur statt Raum."}', '2d', 'tabelle'],
  ];
  for (const [raw, mode, typ] of cases) {
    const r = parseRouterDecision(raw);
    assert.equal(r.mode, mode, raw.slice(0, 30));
    assert.equal(r.typ, typ);
    assert.equal(r.fallback, false);
  }
});

test('P1-Variantenwahl: P0-Typ -> Variante/Spec abgedeckt (d3 = Topologie-Spezial)', () => {
  for (const t of ['schaltplan', 'flussdiagramm', 'schnitt-ansicht', 'diagramm', 'tabelle']) {
    assert.ok(ROUTER_TYP_TO_VARIANT[t], t);
    assert.ok(ALLOW_2D_SPECIFIERS.includes(ROUTER_TYP_TO_VARIANT[t].spec), t);
  }
  assert.ok(ALLOW_2D_SPECIFIERS.includes(ROUTER_TOPOLOGY_VARIANT.spec));
  assert.equal(ROUTER_TYP_TO_VARIANT['flussdiagramm'].spec, '2d-mermaid');
  assert.equal(ROUTER_TYP_TO_VARIANT['diagramm'].spec, '2d-chart');
  assert.equal(ROUTER_TOPOLOGY_VARIANT.spec, '2d-d3');
});
