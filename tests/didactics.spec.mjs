/**
 * S5-Suite: Manifest-Gate — Schema, Pflichtfelder, Niveauregeln.
 * Bauplan Abschnitt 6 (S5) und Abschnitt 8 (verify:didactics).
 */
import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { validateManifest, checkLevelRules } from '../src/runtime/didactics.js';

async function manifests() {
  const dir = 'src/models/manifests';
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of await readdir(dir)) {
    if (f.endsWith('.json')) out.push({ id: f.slice(0, -5), manifest: JSON.parse(await readFile(`${dir}/${f}`, 'utf8')) });
  }
  return out;
}

test('S5: Manifeste vorhanden und gueltig', async () => {
  const all = await manifests();
  expect(all.length, 'mindestens 1 Manifest').toBeGreaterThan(0);
  for (const m of all) {
    const rep = validateManifest(m.manifest);
    expect(rep.ok, `${m.id}: missing=${rep.missing} invalid=${rep.invalid}`).toBe(true);
  }
});

test('S5: Niveauregeln Basis/Aufbau/Profi', async () => {
  for (const m of await manifests()) {
    for (const level of ['basis', 'aufbau', 'profi']) {
      const rules = checkLevelRules(level, m.manifest);
      for (const r of rules) {
        expect(r.verdict, `${m.id}/${r.id}: ${r.actual}`).toBe('pass');
      }
    }
  }
});
