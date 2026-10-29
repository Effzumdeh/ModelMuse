/**
 * M6-minimal: Baustein-Abruf fuer den P2-Repair (Guide-3D Abschnitt 5/7).
 * Regelbasiert per Fehlerklasse (kein Vektorindex — semantischer Abruf ist
 * als naechste Stufe dokumentiert, nicht implementiert). Katalog:
 * prompts/bausteine.json. Maximal 2 Muster je Repair (Prompt-Budget).
 */
import { readFile } from 'node:fs/promises';

export const BAUSTEIN_MAX = 2;

/** @param {string} [path] */
export async function loadBausteine(path = 'prompts/bausteine.json') {
  const cat = JSON.parse(await readFile(path, 'utf8'));
  if (cat?.standard !== 'baustein-katalog-v1' || !Array.isArray(cat?.muster)) {
    throw Object.assign(new Error('E-BAUSTEIN: Katalog ungueltig'), { code: 'E-BAUSTEIN' });
  }
  return cat.muster.filter(
    (m) => m && typeof m.id === 'string' && Array.isArray(m.fails) && typeof m.hinweis === 'string'
  );
}

/**
 * Muster in Fail-Reihenfolge auswaehlen (dedupliziert, gedeckelt).
 * @param {string[]} failKeys z. B. ['S2:S2-intersect', 'S4:S4-meshcount']
 * @param {Array<{ id: string, fails: string[] }>} muster
 * @param {number} [max]
 */
export function selectBausteine(failKeys, muster, max = BAUSTEIN_MAX) {
  const out = [];
  const seen = new Set();
  for (const key of failKeys ?? []) {
    for (const m of muster ?? []) {
      if (out.length >= max) return out;
      if (!seen.has(m.id) && m.fails.includes(key)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

/**
 * Muster als P2-Prompt-Block rendern (Text + Code, ohne Prosa-Ueberbau).
 * @param {Array<{ id: string, titel?: string, hinweis?: string, code?: string }>} entries
 */
export function renderBausteine(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const lines = ['BAUSTEINE (kuratierte Repair-Muster, passend zu den protokollierten Fehlern):'];
  for (const e of entries) {
    lines.push(`[${e.id}] ${e.titel ?? ''} — ${e.hinweis ?? ''}`.slice(0, 400));
    if (e.code) lines.push(String(e.code).slice(0, 800));
  }
  return lines.join('\n');
}
