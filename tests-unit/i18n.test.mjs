/** Unittests Teil 5: Internationalisierung (rein, ohne DOM/Netz). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LOCALES, detectLocale, normalizeLocale, t, localizeManifest } from '../src/shell/i18n.js';

const de = JSON.parse(await readFile('src/shell/i18n/de.json', 'utf8'));
const en = JSON.parse(await readFile('src/shell/i18n/en.json', 'utf8'));
const es = JSON.parse(await readFile('src/shell/i18n/es.json', 'utf8'));

test('Locales: genau de/en/es, gleiche Schluesselmenge', () => {
  assert.deepEqual([...LOCALES], ['de', 'en', 'es']);
  const keys = (o, pre = '') =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const dk = keys(de).filter((k) => !k.startsWith('_meta')).sort();
  for (const [name, dict] of [['en', en], ['es', es]]) {
    const got = keys(dict).filter((k) => !k.startsWith('_meta')).sort();
    assert.deepEqual(got, dk, `${name}: Schluesselmenge weicht ab`);
    for (const k of dk) {
      const v = k.split('.').reduce((o, x) => o?.[x], dict);
      assert.ok(typeof v === 'string' && v.length > 0, `${name}.${k} leer`);
      assert.ok(!/\{[^}]* (deutsch|bitte|Modell|Fehler)[^}]*\}/i.test(v) || k === '_meta', `${name}.${k}: deutsche Platzhalter`);
    }
  }
});

test('detectLocale: Systemsprache -> de/en/es, sonst de', () => {
  assert.equal(detectLocale({ language: 'de-DE' }), 'de');
  assert.equal(detectLocale({ language: 'de' }), 'de');
  assert.equal(detectLocale({ language: 'en-US' }), 'en');
  assert.equal(detectLocale({ language: 'es-ES' }), 'es');
  assert.equal(detectLocale({ language: 'fr-FR' }), 'de');
  assert.equal(detectLocale({}), 'de');
  assert.equal(detectLocale({ languages: ['fr-FR', 'en-GB'] }), 'en');
  assert.equal(normalizeLocale('it'), 'de');
  assert.equal(normalizeLocale('es'), 'es');
});

test('t(): Pfad + Platzhalter + Fallbacks', () => {
  assert.equal(t('de', 'toolbar.modell'), 'Modell');
  assert.equal(t('en', 'toolbar.modell'), 'Model');
  assert.equal(t('es', 'toolbar.modell'), 'Modelo');
  assert.equal(t('de', 'freimodus.generiere', { term: 'X', modell: 'M' }), 'Generiere „X“ … (Modell M, Stream)');
  assert.equal(t('en', 'freimodus.geladen', { titel: 'T', labels: 1, messungen: 2, aufgaben: 3 }), '“T” loaded: 1 labels, 2 measurements, 3 tasks.');
  assert.equal(t('it', 'toolbar.modell'), 'Modell');
  assert.equal(t('en', 'gibt.es.nicht'), 'gibt.es.nicht');
  for (const code of ['E-GEN-400', 'E-GEN-429', 'E-GEN-5XX', 'E-GEN-OFFLINE']) {
    assert.ok(t('en', `fehler.${code}`).length > 10, code);
    assert.ok(t('es', `fehler.${code}`).length > 10, code);
  }
});

test('localizeManifest: de kanonisch, en/es ueberschreiben Texte, Vektoren bleiben', () => {
  const man = {
    title: 'Grafikkarte', labels: ['Luefter'], measurements: [{ id: 'm1', from: [0, 0, 0], to: [1, 0, 0], text: 'Laenge: 10 mm', unit: 'mm' }],
    tasks: [{ id: 't1', level: 'aufbau', type: 'messwert', prompt: 'Lies ab.', expected: '10', tolerance: 1 }],
    i18n: {
      en: { title: 'Graphics card', labels: ['Fan'], measurements: [{ id: 'm1', text: 'Length: 10 mm' }], tasks: [{ id: 't1', prompt: 'Read it.', expected: '10' }] },
      es: { title: 'Tarjeta grafica', labels: ['Ventilador'] },
    },
  };
  assert.equal(localizeManifest(man, 'de').title, 'Grafikkarte');
  const view = localizeManifest(man, 'en');
  assert.equal(view.title, 'Graphics card');
  assert.deepEqual(view.labels, ['Fan']);
  assert.equal(view.measurements[0].text, 'Length: 10 mm');
  assert.deepEqual(view.measurements[0].from, [0, 0, 0]);
  assert.equal(view.tasks[0].prompt, 'Read it.');
  const ves = localizeManifest(man, 'es');
  assert.equal(ves.title, 'Tarjeta grafica');
  assert.equal(ves.measurements[0].text, 'Laenge: 10 mm');
  assert.equal(localizeManifest(man, 'fr').title, 'Grafikkarte');
  assert.equal(localizeManifest({ title: 'Solo' }, 'en').title, 'Solo');
});
