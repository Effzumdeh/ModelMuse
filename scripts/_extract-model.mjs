/**
 * Extrahiert das generierte Modul aus CLI-Rohoutput:
 * Fences entfernen, ab `export const meta` schneiden, S1-Gate fahren.
 * Aufruf: node scripts/_extract-model.mjs <raw.txt> <ziel.js>
 * Schreibt niemals den Key (kein Key-Kontakt).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { staticGate } from '../src/runtime/guard-static.js';
import { extractModuleSource } from '../src/runtime/livegen.js';

const [rawPath, destPath] = process.argv.slice(2);
if (!rawPath || !destPath) {
  console.error('Aufruf: node scripts/_extract-model.mjs <raw> <ziel>');
  process.exit(2);
}
const raw = await readFile(rawPath, 'utf8');
console.log(`raw: ${raw.length} Zeichen`);
const source = extractModuleSource(raw);
if (!source) {
  console.error('EXTRAKT: kein Modul-Anfang gefunden');
  process.exit(1);
}
const bytes = Buffer.byteLength(source, 'utf8');
console.log(`modul: ${source.length} Zeichen, ${bytes} bytes`);
const gate = staticGate(source, { comfort: 1500000, hard: 2000000 });
console.log(`S1-vorab: hits=${gate.hits.length} size=${gate.size.tier} imports=${gate.imports.ok ? 'ok' : 'FREMD:' + gate.imports.offending.join(',')}`);
await writeFile(destPath, source);
console.log(`geschrieben: ${destPath}`);
if (gate.hits.length > 0 || !gate.imports.ok || gate.size.tier === 'reject') process.exit(1);
