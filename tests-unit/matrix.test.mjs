/** Unittests Modellmatrix + Dateigroessen (node-Testrunner, Bauplan Abschnitt 7/3). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// O-10: MATRIX als einzige Quelle in src/data/modellmatrix.json (Lesart per
// readFile, gleiche Konvention wie tests-unit/providers.test.mjs — kein
// statischer JSON-Import, damit node --test ohne Import-Attribute laeuft).
const MATRIX = JSON.parse(await readFile('src/data/modellmatrix.json', 'utf8'));

test('alle Modellmodule vorhanden und im Byte-Budget (<=34000)', async () => {
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
    if (src.includes("from '2d-svg'") || src.includes('from "2d-svg"')) {
      // 2D-Route: Labels/Messung als Daten (diagram), nicht als Helper-Calls.
      const { extractDiagram } = await import('../src/runtime/verify.js');
      const diagram = extractDiagram(src);
      assert.ok(diagram && typeof diagram === 'object', `${id}: diagram fehlt`);
      const labels = Array.isArray(diagram.labels) ? diagram.labels : [];
      assert.ok(labels.length >= want.labelsMin, `${id}: diagram.labels ${labels.length} < ${want.labelsMin}`);
      assert.ok(typeof diagram.measurement === 'string' && diagram.measurement.length > 3, `${id}: diagram.measurement fehlt`);
      assert.ok(src.includes("from '2d-svg'") || src.includes('from "2d-svg"'), `${id}: 2d-svg-Import fehlt`);
      assert.ok(!src.includes("from 'three'"), `${id}: 2D-Modul darf kein three importieren`);
    } else {
      const labels = (src.match(/addLabel\s*\(/g) ?? []).length;
      assert.ok(labels >= want.labelsMin, `${id}: addLabel ${labels} < ${want.labelsMin}`);
      const meas = (src.match(/addMeasurement\s*\(/g) ?? []).length;
      assert.ok(meas >= 1, `${id}: keine Messung`);
    }
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
  assert.equal(mods.length, Object.keys(MATRIX).length, `Module (${mods.length}) == Matrix-Eintraege (${Object.keys(MATRIX).length})`);
  for (const f of mods) {
    assert.ok(existsSync(`src/models/manifests/${f.slice(0, -3)}.json`), `Manifest zu ${f} fehlt`);
  }
});
