/**
 * Matrix-Suite: 9 Labs + Graphics Card — Sollwerte, Mindest-Labels,
 * Pflichtbemassung, Aufgabenverteilung B/A/P.
 * Bauplan Abschnitt 7 (Modellmatrix) und Abschnitt 8.
 */
import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const MATRIX = {
  'si-1': { labelsMin: 5, units: ['cm'], tasks: [0, 2, 1] },
  'si-2': { labelsMin: 4, units: ['m'], tasks: [0, 2, 1] },
  'si-3': { labelsMin: 4, units: ['HE'], tasks: [0, 2, 1] },
  'dup-1': { labelsMin: 4, units: ['cm'], tasks: [0, 2, 1] },
  'dup-2': { labelsMin: 4, units: ['cm'], tasks: [0, 2, 1] },
  'dup-3': { labelsMin: 4, units: ['cm'], tasks: [0, 2, 1] },
  'ae-1': { labelsMin: 4, units: ['cm'], tasks: [0, 2, 1] },
  'ae-2': { labelsMin: 3, units: ['cm'], tasks: [0, 2, 1] },
  'ae-3': { labelsMin: 4, units: ['m'], tasks: [0, 2, 1] },
  'gpu-example': { labelsMin: 9, units: ['mm'], tasks: [0, 2, 1] },
};

for (const [id, m] of Object.entries(MATRIX)) {
  test(`Matrix: ${id} erfuellt Sollwerte`, async () => {
    expect(existsSync(`src/models/${id}.js`), 'Modul vorhanden').toBe(true);
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    const labels = (src.match(/addLabel\s*\(/g) ?? []).length;
    expect(labels, `addLabel >= ${m.labelsMin}`).toBeGreaterThanOrEqual(m.labelsMin);
    const measures = (src.match(/addMeasurement\s*\(/g) ?? []).length;
    expect(measures, 'mindestens 1 Messung').toBeGreaterThanOrEqual(1);
    for (const u of m.units) {
      expect(src, `Einheit ${u} im Modul`).toContain(u);
    }
    const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
    const count = (level) => man.tasks.filter((t) => t.level === level).length;
    expect(count('aufbau'), 'Aufbau >= 2').toBeGreaterThanOrEqual(2);
    expect(count('profi'), 'Profi >= 1').toBeGreaterThanOrEqual(1);
    const transfer = man.tasks.filter((t) => t.level === 'profi' && (t.type === 'transfer' || t.type === 'fehlersuche')).length;
    expect(transfer, 'Profi Transfer/Fehlersuche >= 1').toBeGreaterThanOrEqual(1);
  });
}

test('Matrix: Manifeste je Modell versioniert', async () => {
  const mods = (await readdir('src/models')).filter((f) => f.endsWith('.js'));
  for (const f of mods) {
    const id = f.slice(0, -3);
    expect(existsSync(`src/models/manifests/${id}.json`), `Manifest zu ${id}`).toBe(true);
  }
});
