/** Unittests M4/M5/M6/M7/M8: Prompt-Hygiene, Checklisten-Kopplung, P2-Notfallpfad, Minimalsatz, Material-Dosierung. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DEFAULT_BUDGET_LIMITS, TRAFFIC } from '../src/runtime/budget.js';
import { validateManifest, checkLevelRules } from '../src/runtime/didactics.js';

async function prompts() {
  const out = {};
  for (const f of await readdir('prompts')) {
    if (f.endsWith('.txt')) out[f] = await readFile(`prompts/${f}`, 'utf8');
  }
  return out;
}

test('M4: P1 ohne Duplikat, mit Fence-Verbot, Budgets aus budget.js', async () => {
  const p = await readFile('prompts/p1-generate.txt', 'utf8');
  // (a) kein doppelter Beendigungs-Satz mehr
  assert.equal((p.match(/Du beendest die Ausgabe nach dem letzten Export\./g) ?? []).length, 1);
  // (b) Fence-Verbot explizit
  assert.ok(p.includes('Keine Markdown-Code-Fences'), 'Fence-Verbot');
  // (c) Import-Allowlist als Signaturliste
  assert.ok(p.includes('ABSCHLIESSEND') && p.includes('wrapper-helpers'));
  // (d) Zahlen mit Korridor, konsistent mit budget.js
  assert.ok(p.includes(String(DEFAULT_BUDGET_LIMITS.triangles)));
  assert.ok(p.includes(String(DEFAULT_BUDGET_LIMITS.drawCalls)));
  assert.ok(p.includes(String(DEFAULT_BUDGET_LIMITS.meshCount)));
  assert.ok(p.includes(String(TRAFFIC.drawCalls[0])) && p.includes(String(TRAFFIC.meshCount[0])));
});

test('M2: Mesh-Constraint in allen aktiven P1-Prompts', async () => {
  const all = await prompts();
  const active = Object.entries(all).filter(
    ([f]) => f === 'p1-generate.txt' || f === 'p1-generate.v6-standard.txt' || f.endsWith('-v6hyper400.txt')
  );
  assert.ok(active.length >= 10, `erwarte >=10 aktive Prompts, habe ${active.length}`);
  for (const [f, p] of active) {
    assert.ok(p.includes('250'), `${f}: Hart-Limit 250`);
    assert.ok(p.includes('InstancedMesh je Teilefamilie'), `${f}: Instancing-Vorgabe`);
  }
});

test('M5: V6-Standardformat mit AUFGABE-Block und S5-Kopplung', async () => {
  const p = await readFile('prompts/p1-generate.txt', 'utf8');
  assert.ok(p.includes('AUFGABE-Block'));
  assert.ok(p.includes('Anforderung statt Verfahren'));
  assert.ok(p.includes('S5'));
  assert.ok(p.includes('addLabel') && p.includes('addMeasurement'));
});

test('M6: P2 mit Iteration 2, FLARE-Format, kein Bauteil-Zuwachs', async () => {
  const p = await readFile('prompts/p2-repair.txt', 'utf8');
  assert.ok(p.includes('maximal 2'), 'Iterationsgrenze 2');
  assert.ok(p.includes('manuelle Reserve'), 'Iteration 3 Reserve');
  assert.ok(p.includes('FAIL | Soll:'), 'FLARE-Format');
  assert.ok(p.includes('keine neuen Bauteile'), 'kein Zuwachs');
  assert.ok(p.includes('Meshes'), 'Budget im P2');
});

test('M7: didaktischer Minimalsatz valide (S5), mit 3JSBench-Hinweis', async () => {
  const set = JSON.parse(await readFile('eval/didaktik-minimalsatz.json', 'utf8'));
  assert.equal(set.standard, 'didaktik-minimalsatz-v1');
  assert.ok(set.hinweis3JSBench.includes('MIT'), 'MIT-Hinweis');
  assert.ok((set.aufgaben ?? []).length >= 5, 'mindestens 5 Aufgaben');
  for (const a of set.aufgaben) {
    const rep = validateManifest(a);
    assert.ok(rep.ok, `${a.title}: missing=${rep.missing} invalid=${rep.invalid}`);
    for (const level of ['basis', 'aufbau', 'profi']) {
      for (const r of checkLevelRules(level, a)) {
        assert.equal(r.verdict, 'pass', `${a.title}/${level}/${r.id}`);
      }
    }
  }
});

test('M8: Material-Dosierung in P1, keine verbotenen Shader-Flags in Modellen', async () => {
  const p = await readFile('prompts/p1-generate.txt', 'utf8');
  assert.ok(p.includes('clearcoat'), 'clearcoat-Dosierung');
  assert.ok(p.includes('AUSDRUECKLICH NICHT'), 'Verbotsliste');
  assert.ok(p.includes('DataTexture'), 'DataTexture-Pflicht');
  for (const f of (await readdir('src/models')).filter((f) => f.endsWith('.js'))) {
    const src = await readFile(`src/models/${f}`, 'utf8');
    for (const flag of ['transmission', 'iridescence', 'sheen']) {
      assert.ok(!new RegExp(`\\b${flag}\\b`, 'i').test(src), `${f}: kein ${flag}`);
    }
  }
});

test('Teil 5: P1-Standardprompt mit locale-Parameter + meta_i18n-Vertrag', async () => {
  const p = await readFile('prompts/p1-generate.v6-standard.txt', 'utf8');
  assert.ok(p.includes('{LOCALE}'), 'locale-Platzhalter');
  assert.ok(p.includes('meta_i18n'), 'meta_i18n-Vertrag');
  assert.ok(p.includes('KEINE Sprachlogik'), 'Module bleiben sprachneutral');
});

test('Bestandteil-Erklaerungen: P1-2D/P1-v6/P2-Harness liefern Format, Verify-Regel', async () => {
  for (const f of ['p1-generate.v6-standard.txt', 'p1-generate-2d.txt', 'p1-generate-2d-varianten.txt']) {
    const p = await readFile(`prompts/${f}`, 'utf8');
    assert.ok(p.includes('explanations'), `${f}: explanations-Feld`);
    assert.ok(p.includes('meta_i18n'), `${f}: meta_i18n`);
    assert.ok(p.includes('gleiche Anzahl'), `${f}: Laengen-Deckung`);
    assert.ok(p.includes('Verify'), `${f}: Verify-Regel`);
  }
  const p2 = await readFile('prompts/p2-repair.v6-harness.txt', 'utf8');
  assert.ok(p2.includes('meta.explanations'), 'P2: meta.explanations erhalten');
  assert.ok(p2.includes('meta_i18n'), 'P2: meta_i18n erhalten');
  assert.ok(p2.includes('niemals entfernen'), 'P2: nie entfernen');
  const free = (await import('../src/shell/ui-livegen.js')).buildFreePrompt('Windrad', 'de');
  assert.ok(free.includes('explanations'), 'Freimodus-Prompt: explanations-Vertrag');
});
