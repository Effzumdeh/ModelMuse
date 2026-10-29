/** Unittests Slim-Modify: Prompt-Bau, Manifest-Merge, ID-Vergabe (rein, ohne DOM/Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModifyPrompt, mergeManifest, modifyModelId, MODIFY_MAX_ITERATION } from '../src/shell/ui-modify.js';

const TEMPLATE = `${'x'.repeat(64)} P2-Vertrag: nur Modulcode, keine Fences, Budgets einhalten.`;
const SOURCE = `import { Scene } from 'three';
export const meta = { title: "Bank", category: "hardware", detailLevel: 2, parts: ["A","B","C"], units: "m" };
export function init(c, p) { return { update(patch) {}, dispose() {} }; }
`;

test('MODIFY_MAX_ITERATION: P2-Regel max 2', () => {
  assert.equal(MODIFY_MAX_ITERATION, 2);
});

test('buildModifyPrompt: Wunsch + Quelle + Protokoll + Template enthalten', () => {
  const p = buildModifyPrompt({
    modelId: 'si-1', title: 'Tisch', source: SOURCE,
    userPrompt: 'mache die Platte rot', protocolText: '[S2:x] FAIL | Soll: a | Ist: b',
    p2Template: TEMPLATE, locale: 'de',
  });
  assert.ok(p.includes(TEMPLATE.slice(0, 20)), 'Template enthalten');
  assert.ok(p.includes('mache die Platte rot'), 'Wunsch enthalten');
  assert.ok(p.includes('export const meta'), 'Quelle enthalten');
  assert.ok(p.includes('[S2:x] FAIL'), 'Protokoll enthalten');
  assert.ok(p.includes('si-1'), 'Modell-ID enthalten');
  assert.ok(!p.includes('```'), 'keine Fences im Prompt-Bau');
});

test('buildModifyPrompt: ohne Protokoll ehrlicher Leertext, Locale es', () => {
  const p = buildModifyPrompt({
    modelId: 'm', title: 'T', source: SOURCE, userPrompt: 'dunkler',
    p2Template: TEMPLATE, locale: 'es',
  });
  assert.ok(p.includes('[keine] Alle Schichten pass'), 'Leer-Protokoll');
  assert.ok(p.includes('(es)'), 'Locale im Auftrag');
});

test('buildModifyPrompt: wirft bei kurzem Wunsch / fehlender Vorlage / schlechter Quelle', () => {
  assert.throws(() => buildModifyPrompt({ modelId: 'm', title: 'T', source: SOURCE, userPrompt: 'x', p2Template: TEMPLATE }), /E-MODIFY-400/);
  assert.throws(() => buildModifyPrompt({ modelId: 'm', title: 'T', source: SOURCE, userPrompt: 'ok lang', p2Template: 'kurz' }), /E-MODIFY-CONFIG/);
  assert.throws(() => buildModifyPrompt({ modelId: 'm', title: 'T', source: 'kein modul', userPrompt: 'ok lang', p2Template: TEMPLATE }), /E-MODIFY-SOURCE/);
});

test('mergeManifest: Titel/Labels aus neuer Meta, Messungen/Aufgaben bleiben', () => {
  const orig = { title: 'Alt', labels: ['A'], measurements: [{ id: 'm1' }], tasks: [{ id: 't1' }] };
  const m = mergeManifest(orig, { title: 'Neu', parts: ['X', 'Y', 'Z'] });
  assert.equal(m.title, 'Neu');
  assert.deepEqual(m.labels, ['X', 'Y', 'Z']);
  assert.deepEqual(m.measurements, [{ id: 'm1' }]);
  assert.deepEqual(m.tasks, [{ id: 't1' }]);
  assert.equal(orig.title, 'Alt', 'Original unveraendert');
});

test('mergeManifest: ohne Original Minimalmanifest, kurze Titel ignoriert', () => {
  const m = mergeManifest(null, { title: 'x', parts: ['nur-eins'] });
  assert.ok(Array.isArray(m.labels) && Array.isArray(m.tasks), 'Struktur vorhanden');
  assert.notEqual(m.title, 'x', 'zu kurzer Titel nicht uebernommen');
});

test('modifyModelId: -modN aufsteigend, Suffix-Strip, Wurf bei Erschöpfung', () => {
  assert.equal(modifyModelId('si-1', () => false), 'si-1-mod1');
  assert.equal(modifyModelId('si-1', (id) => id === 'si-1-mod1'), 'si-1-mod2');
  assert.equal(modifyModelId('si-1-mod1', () => false), 'si-1-mod1', 'Suffix gestrippt, neu vergeben');
  assert.throws(() => modifyModelId('m', () => true), /E-MODIFY-ID/);
});
