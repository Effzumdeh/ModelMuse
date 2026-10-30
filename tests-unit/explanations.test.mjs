/** Unittests Bestandteil-Erklaerungen (de/en/es): Manifeste, S5-Gates, Manifest-Ansicht, Prompts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { validateManifest, checkExplanationsPresence } from '../src/runtime/didactics.js';
import { partEntries, partExplanations } from '../src/runtime/parts.js';
import { localizeManifest } from '../src/shell/i18n.js';
import { buildFreeManifest } from '../src/shell/ui-livegen.js';

async function manifests() {
  const out = [];
  for (const f of (await readdir('src/models/manifests')).filter((x) => x.endsWith('.json')).sort()) {
    out.push([f, JSON.parse(await readFile(`src/models/manifests/${f}`, 'utf8'))]);
  }
  return out;
}

test('Manifeste: alle Standard-Modelle mit explanations de/en/es, Deckung zu labels', async () => {
  const all = await manifests();
  assert.ok(all.length >= 20, `erwarte >=20 Manifeste, habe ${all.length}`);
  for (const [f, m] of all) {
    const rep = checkExplanationsPresence(m);
    assert.ok(rep.ok, `${f}: ${rep.detail}`);
    const vrep = validateManifest(m);
    assert.ok(vrep.ok, `${f}: missing=${vrep.missing} invalid=${vrep.invalid}`);
  }
});

test('validateManifest: explanations optional, aber streng-wenn-vorhanden', () => {
  const base = {
    schemaVersion: 1.0, title: 'Windrad-Anlage', track: 'SI',
    objectives: ['Ziel eins mit Inhalt.', 'Ziel zwei mit Inhalt.'],
    labels: ['Mast', 'Rotor', 'Gondel'],
    measurements: [{ id: 'm1', from: [0, 0, 0], to: [1, 0, 0], text: 'Breite: 24 cm', unit: 'cm' }],
    tasks: [{ id: 'a1', level: 'aufbau', type: 'zuordnung', prompt: 'Ordne das Bauteil zu.', expected: 'Mast', tolerance: 0 }],
  };
  assert.ok(validateManifest(base).ok, 'ohne explanations ok (optional)');
  const aligned = { ...base, explanations: ['Mast erklaert lang genug.', 'Rotor erklaert lang genug.', 'Gondel erklaert lang genug.'] };
  assert.ok(validateManifest(aligned).ok, 'aligned ok');
  const short = { ...aligned, explanations: ['Mast a.', 'Rotor erklaert lang genug.', 'Gondel erklaert lang genug.'] };
  assert.ok(!validateManifest(short).ok && validateManifest(short).invalid.includes('explanations'), 'zu kurz invalid');
  const few = { ...aligned, explanations: ['Nur ein Text hier.'] };
  assert.ok(!validateManifest(few).ok && validateManifest(few).invalid.includes('explanations'), 'falsche Anzahl invalid');
  assert.ok(!checkExplanationsPresence(base).ok, 'Vorhandensein fehlt ohne Feld');
  assert.ok(!checkExplanationsPresence(aligned).ok, 'Vorhandensein braucht auch en/es');
  const full = {
    ...aligned,
    i18n: {
      en: { explanations: ['English Mast long enough here.', 'English Rotor long enough here.', 'English Gondel long enough here.'] },
      es: { explanations: ['Mastil explicado largo aqui.', 'Rotor explicado largo aqui.', 'Gondola explicada larga aqui.'] },
    },
  };
  assert.ok(checkExplanationsPresence(full).ok, 'Vorhandensein ok bei Deckung de/en/es');
});

test('validateManifest: i18n-explanations optional, aber streng-wenn-vorhanden', () => {
  const base = {
    schemaVersion: 1.0, title: 'Windrad-Anlage B', track: 'SI',
    objectives: ['Ziel eins mit Inhalt.', 'Ziel zwei mit Inhalt.'],
    labels: ['Mast', 'Rotor', 'Gondel'],
    measurements: [{ id: 'm1', from: [0, 0, 0], to: [1, 0, 0], text: 'Breite: 24 cm', unit: 'cm' }],
    tasks: [{ id: 'a1', level: 'aufbau', type: 'zuordnung', prompt: 'Ordne das Bauteil zu.', expected: 'Mast', tolerance: 0 }],
    explanations: ['Mast erklaert lang genug.', 'Rotor erklaert lang genug.', 'Gondel erklaert lang genug.'],
  };
  const badI18n = {
    ...base,
    i18n: {
      en: { title: 'Wind turbine', objectives: ['Goal one here.', 'Goal two here.'], labels: ['Mast', 'Rotor', 'Nacelle'], measurements: [{ id: 'm1', text: 'Width: 24 cm' }], tasks: [{ id: 'a1', prompt: 'Match the part here.', expected: 'Mast' }], explanations: ['Only one text.'] },
      es: { title: 'Aerogenerador', objectives: ['Meta uno aqui.', 'Meta dos aqui.'], labels: ['Mastil', 'Rotor', 'Gondola'], measurements: [{ id: 'm1', text: 'Anchura: 24 cm' }], tasks: [{ id: 'a1', prompt: 'Relacione aqui.', expected: 'Mast' }] },
    },
  };
  assert.ok(!validateManifest(badI18n).ok && validateManifest(badI18n).invalid.includes('i18n'), 'falsche i18n-Anzahl invalid');
  assert.ok(!checkExplanationsPresence(badI18n).ok, 'Vorhandensein fehlt bei Luecke');
});

test('localizeManifest + partExplanations: je Lokale, Fallback deutsch', () => {
  const man = {
    title: 'T', labels: ['A', 'B'],
    explanations: ['Deutsch A lang genug.', 'Deutsch B lang genug.'],
    i18n: { en: { explanations: ['English A long enough.', 'English B long enough.'] }, es: {} },
  };
  assert.deepEqual(localizeManifest(man, 'de').explanations, ['Deutsch A lang genug.', 'Deutsch B lang genug.']);
  assert.deepEqual(localizeManifest(man, 'en').explanations, ['English A long enough.', 'English B long enough.']);
  assert.deepEqual(localizeManifest(man, 'es').explanations, ['Deutsch A lang genug.', 'Deutsch B lang genug.'], 'es ohne Segment -> de');
  assert.deepEqual(localizeManifest({ labels: ['A'] }, 'en').explanations ?? null, null, 'ohne Feld kein Feld');
  assert.deepEqual(partExplanations(man, 'de'), ['Deutsch A lang genug.', 'Deutsch B lang genug.']);
  assert.deepEqual(partExplanations(man, 'en'), ['English A long enough.', 'English B long enough.']);
  assert.deepEqual(partExplanations(man, 'es'), ['Deutsch A lang genug.', 'Deutsch B lang genug.']);
  assert.deepEqual(partExplanations({ labels: ['A', 'B'] }, 'de'), ['', ''], 'fehlende Texte -> leer (Button aus)');
  assert.deepEqual(partEntries(man).length, partExplanations(man, 'de').length, 'Reihenfolge wie partEntries');
});

test('buildFreeManifest: explanations aus meta/meta_i18n nur bei Deckung', () => {
  const src = 'addMeasurement(scene, [0,0,0], [0,1,0], "Nabenhoehe: 80 m", { id: "m1", level: "aufbau", unit: "m" });';
  const meta = { title: 'Windrad', parts: ['Mast', 'Rotor', 'Gondel'], explanations: ['Mast traegt alles.', 'Rotor faengt Wind.', 'Gondel haelt Technik.'] };
  const hints = {
    en: { title: 'Wind turbine', parts: ['Mast', 'Rotor', 'Nacelle'], explanations: ['Mast carries all.', 'Rotor catches wind.', 'Nacelle holds tech.'] },
    es: { title: 'Aerogenerador', parts: ['Mastil', 'Rotor', 'Gondola'], explanations: ['El mastil lo sostiene.', 'El rotor capta viento.', 'La gondola alberga tecnica.'] },
  };
  const man = buildFreeManifest('Wind', meta, src, hints);
  assert.deepEqual(man.explanations, meta.explanations);
  assert.deepEqual(man.i18n.en.explanations, hints.en.explanations);
  assert.deepEqual(man.i18n.es.explanations, hints.es.explanations);
  assert.ok(validateManifest(man).ok, JSON.stringify(validateManifest(man)));
  const shortMeta = { ...meta, explanations: ['Nur eins.'] };
  const man2 = buildFreeManifest('Wind', shortMeta, src, hints);
  assert.ok(!('explanations' in man2), 'falsche de-Anzahl -> weggelassen');
  assert.ok(validateManifest(man2).ok, 'weiterhin valide');
});
