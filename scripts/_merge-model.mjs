/** Mergen: Imports aus Iteration 1 + korrigierte Helper-Aufrufe aus Repair. */
import { readFile, writeFile } from 'node:fs/promises';
import { staticGate } from '../src/runtime/guard-static.js';

const iter1 = (await readFile('dist/gpu-iter1.js', 'utf8')).split('\n');
const rep = (await readFile('dist/gpu-example-repair1.js', 'utf8')).split('\n');
const isHelper = (l) => /addLabel\s*\(|addMeasurement\s*\(/.test(l);
const repHelpers = rep.filter(isHelper);
const iterHelpers = iter1.filter(isHelper);
console.log(`iter1-helper: ${iterHelpers.length}, repair-helper: ${repHelpers.length}`);
if (repHelpers.length !== 12 || iterHelpers.length !== 12) {
  console.error('MERGE: unerwartete Helper-Anzahl');
  process.exit(1);
}
let k = 0;
const merged = iter1.map((l) => (isHelper(l) ? repHelpers[k++] : l)).join('\n');
const bytes = Buffer.byteLength(merged, 'utf8');
console.log(`merged: ${bytes} bytes`);
const gate = staticGate(merged, { comfort: 1500000, hard: 2000000 });
console.log(`S1: hits=${gate.hits.length} size=${gate.size.tier} imports=${gate.imports.ok ? 'ok' : 'FREMD:' + gate.imports.offending.join(',')}`);
if (gate.hits.length > 0 || !gate.imports.ok || gate.size.tier === 'reject') process.exit(1);
await writeFile('src/models/gpu-example.js', merged);
console.log('geschrieben: src/models/gpu-example.js');
