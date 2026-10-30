/** Unittests 2D-V2-Varianten: sichtbar neue Demos je Typ (neuer Inhalt + neues
 * Layout), Gates S1/S2-light, Render-Output. Alte Demos bleiben unveraendert. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ALLOW_SPECIFIERS, ALLOW_2D_SPECIFIERS, TWOD_KNOWN_EXPORTS,
  MERMAID_KNOWN_EXPORTS, CHART_KNOWN_EXPORTS, D3_KNOWN_EXPORTS, KATEX_KNOWN_EXPORTS,
} from '../src/runtime/guard-static.js';
import { staticGate, isTwoDSource } from '../src/runtime/guard-static.js';
import { verifyTwoDLayer, twoDVariantOf, countTwoDShapes, extractTwoDLiteral, TWOD_VARIANT_LITERAL } from '../src/runtime/verify-2d.js';
import { renderTwoDSource } from '../src/runtime/render-2d.js';

const DEMOS_V2 = [
  { id: 'demo-2d-svg-v2', variant: 'svg', spec: '2d-svg', kind: 'chain' },
  { id: 'demo-2d-mermaid-v2', variant: 'mermaid', spec: '2d-mermaid', kind: 'sequenz' },
  { id: 'demo-2d-chart-v2', variant: 'chart', spec: '2d-chart', kind: 'linie' },
  { id: 'demo-2d-d3-v2', variant: 'd3', spec: '2d-d3', kind: 'baum' },
  { id: 'demo-2d-katex-v2', variant: 'katex', spec: '2d-katex', kind: 'formel' },
];

const V1_KIND = { svg: 'generic', mermaid: 'fluss', chart: 'balken', d3: 'netz' };

test('V2-Layout: je Typ anderer Kind als V1 (sichtbar neue Variante)', async () => {
  for (const { id, variant, kind } of DEMOS_V2) {
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    const data = extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]);
    const got = variant === 'mermaid' ? data.diagram : data.kind;
    assert.equal(got, kind, `${id}: kind ${got} != ${kind}`);
    if (V1_KIND[variant]) assert.notEqual(got, V1_KIND[variant], `${id}: Kind identisch zu V1`);
  }
});

test('V2-Inhalt: Labels/Parts frisch (kein V1-Label wiederverwendet)', async () => {
  const v1labels = new Set();
  for (const v1 of ['demo-2d-svg', 'demo-2d-mermaid', 'demo-2d-chart', 'demo-2d-d3', 'demo-2d-katex']) {
    const src = await readFile(`src/models/${v1}.js`, 'utf8');
    const variant = twoDVariantOf(src);
    const data = extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]);
    for (const l of (data.labels ?? [])) v1labels.add(String(l));
  }
  for (const { id, variant } of DEMOS_V2) {
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    const data = extractTwoDLiteral(src, TWOD_VARIANT_LITERAL[variant]);
    for (const l of (data.labels ?? [])) {
      assert.ok(!v1labels.has(String(l)), `${id}: Label "${l}" schon in V1`);
    }
  }
});

test('V2-Demo-Modelle: S1-ok, Variante erkannt, S2-light pass, Render ok', async () => {
  for (const { id, variant, spec } of DEMOS_V2) {
    assert.ok(ALLOW_SPECIFIERS.includes(spec) && ALLOW_2D_SPECIFIERS.includes(spec), spec);
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

test('V2-Exportnamen je Vendor-Datei in Allowlist', () => {
  for (const name of [...MERMAID_KNOWN_EXPORTS, ...CHART_KNOWN_EXPORTS, ...D3_KNOWN_EXPORTS, ...KATEX_KNOWN_EXPORTS]) {
    assert.ok(TWOD_KNOWN_EXPORTS.includes(name), name);
  }
});
