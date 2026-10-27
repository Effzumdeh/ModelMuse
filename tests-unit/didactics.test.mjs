/** Unittests S5-Didaktik (node-Testrunner). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { validateManifest, checkLevelRules, buildLevelPatch, findPedagogyLeak } from '../src/runtime/didactics.js';

function goodManifest() {
  return {
    schemaVersion: 1.0,
    title: 'PC-Arbeitsplatz (SI-1)',
    track: 'SI',
    objectives: ['Ziel eins mit Inhalt.', 'Ziel zwei mit Inhalt.'],
    labels: ['Mainboard', 'CPU', 'RAM'],
    measurements: [{ id: 'm1', from: [0, 0, 0], to: [1, 0, 0], text: 'Breite: 24 cm', unit: 'cm' }],
    tasks: [
      { id: 'a1', level: 'aufbau', type: 'zuordnung', prompt: 'Ordne das Bauteil zu.', expected: 'CPU', tolerance: 0 },
      { id: 'a2', level: 'aufbau', type: 'messwert', prompt: 'Lies die Breite ab.', expected: '24', tolerance: 1 },
      { id: 'p1', level: 'profi', type: 'fehlersuche', prompt: 'Finde den Fehler im Aufbau.', expected: 'RAM neu stecken', tolerance: 0 },
    ],
  };
}

test('validateManifest ok bei vollstaendigem Manifest', () => {
  const rep = validateManifest(goodManifest());
  assert.ok(rep.ok, JSON.stringify(rep));
  assert.equal(rep.counts.labels, 3);
});

test('validateManifest meldet missing/invalid (E-S5-MANIFEST)', () => {
  const rep = validateManifest({ title: 'x' });
  assert.ok(!rep.ok && rep.missing.length > 0);
  const rep2 = validateManifest({ ...goodManifest(), measurements: [{ id: 'm1', text: 'ohne Einheit' }] });
  assert.ok(!rep2.ok);
});

test('Niveauregeln: Basis<=5 Labels/0 Messungen, Aufbau>=2, Profi Transfer>=1', () => {
  const m = goodManifest();
  assert.ok(checkLevelRules('basis', m).every((r) => r.verdict === 'pass'));
  assert.ok(checkLevelRules('aufbau', m).every((r) => r.verdict === 'pass'));
  assert.ok(checkLevelRules('profi', m).every((r) => r.verdict === 'pass'));
  const noTransfer = { ...m, tasks: m.tasks.filter((t) => t.type !== 'fehlersuche') };
  assert.ok(checkLevelRules('profi', noTransfer).some((r) => r.verdict === 'fail'));
});

test('buildLevelPatch: nur Sichtbarkeit/Kamera, E-S5-LEVEL bei Unsinn', () => {
  const b = buildLevelPatch('basis');
  assert.equal(b.labels.max, 5);
  assert.equal(b.measurements.enabled, false);
  assert.throws(() => buildLevelPatch('meister'), /E-S5-LEVEL/);
});

test('validateManifest: gueltiges i18n-Segment (en/es), Id-Deckung geprueft', () => {
  const m = goodManifest();
  m.i18n = {
    en: { title: 'PC workstation', objectives: ['Goal one here.', 'Goal two here.'], labels: ['Mainboard', 'CPU', 'RAM'], measurements: [{ id: 'm1', text: 'Width: 24 cm' }], tasks: [{ id: 'a1', prompt: 'Match the part here.', expected: 'CPU' }, { id: 'a2', prompt: 'Read the width.', expected: '24' }, { id: 'p1', prompt: 'Find the fault here.', expected: 'Reseat RAM' }] },
    es: { title: 'Puesto de PC', objectives: ['Meta uno aqui.', 'Meta dos aqui.'], labels: ['Placa', 'CPU', 'RAM'], measurements: [{ id: 'm1', text: 'Anchura: 24 cm' }], tasks: [{ id: 'a1', prompt: 'Relacione aqui.', expected: 'CPU' }, { id: 'a2', prompt: 'Lea la anchura.', expected: '24' }, { id: 'p1', prompt: 'Halle el fallo.', expected: 'Reencajar RAM' }] },
  };
  assert.ok(validateManifest(m).ok, JSON.stringify(validateManifest(m)));
  const badId = structuredClone(m);
  badId.i18n.en.measurements = [{ id: 'falsch', text: 'Width: 1 cm' }];
  assert.ok(!validateManifest(badId).ok, 'falsche Messungs-Id muss scheitern');
  const badCount = structuredClone(m);
  badCount.i18n.es.labels = ['Nur eins'];
  assert.ok(!validateManifest(badCount).ok, 'falsche Label-Anzahl muss scheitern');
});

test('findPedagogyLeak findet Lernzieltext im Modulcode', () => {
  const leaks = findPedagogyLeak('const x = "Ordne das Bauteil zu.";', ['Ordne das Bauteil zu.']);
  assert.deepEqual(leaks, ['Ordne das Bauteil zu.']);
  assert.deepEqual(findPedagogyLeak('const x = 1;', ['Ordne das Bauteil zu.']), []);
});

test('alle versionierten Manifeste sind gueltig und niveautreu', async () => {
  const dir = 'src/models/manifests';
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 7, `erwarte >=7 Manifeste, habe ${files.length}`);
  for (const f of files) {
    const m = JSON.parse(await readFile(`${dir}/${f}`, 'utf8'));
    const rep = validateManifest(m);
    assert.ok(rep.ok, `${f}: missing=${rep.missing} invalid=${rep.invalid}`);
    for (const level of ['basis', 'aufbau', 'profi']) {
      for (const r of checkLevelRules(level, m)) {
        assert.equal(r.verdict, 'pass', `${f}/${level}/${r.id}`);
      }
    }
  }
});
