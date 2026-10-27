/** Unittests Modellmatrix + Dateigroessen (node-Testrunner, Bauplan Abschnitt 7/3). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
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

test('alle zehn Modellmodule vorhanden und im Byte-Budget (<=34000)', async () => {
  for (const id of Object.keys(MATRIX)) {
    const p = `src/models/${id}.js`;
    assert.ok(existsSync(p), `${id}.js fehlt`);
    const b = (await stat(p)).size;
    assert.ok(b <= 34000, `${id}: ${b} > 34000`);
  }
});

test('Matrix: Labels min, Messung mit Einheit, Aufgaben B/A/P je Modell', async () => {
  for (const [id, want] of Object.entries(MATRIX)) {
    const src = await readFile(`src/models/${id}.js`, 'utf8');
    const labels = (src.match(/addLabel\s*\(/g) ?? []).length;
    assert.ok(labels >= want.labelsMin, `${id}: addLabel ${labels} < ${want.labelsMin}`);
    const meas = (src.match(/addMeasurement\s*\(/g) ?? []).length;
    assert.ok(meas >= 1, `${id}: keine Messung`);
    for (const u of want.units) {
      assert.ok(src.includes(u), `${id}: Einheit ${u} fehlt im Modul`);
    }
    const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
    const count = (level) => man.tasks.filter((t) => t.level === level).length;
    assert.ok(count('aufbau') >= want.tasks[1], `${id}: Aufbau ${count('aufbau')} < ${want.tasks[1]}`);
    assert.ok(count('profi') >= want.tasks[2], `${id}: Profi ${count('profi')} < ${want.tasks[2]}`);
    const transfer = man.tasks.filter((t) => t.level === 'profi' && (t.type === 'transfer' || t.type === 'fehlersuche')).length;
    assert.ok(transfer >= 1, `${id}: Profi Transfer/Fehlersuche fehlt`);
  }
});

test('Manifeste je Modell versioniert', async () => {
  const mods = (await readdir('src/models')).filter((f) => f.endsWith('.js'));
  assert.ok(mods.length === 10, `erwarte 10 Module, habe ${mods.length}`);
  for (const f of mods) {
    assert.ok(existsSync(`src/models/manifests/${f.slice(0, -3)}.json`), `Manifest zu ${f} fehlt`);
  }
});
