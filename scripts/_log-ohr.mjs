/** Ohr-Call in dist/generation-log.json belegen. Key erscheint nie (nur Status). */
import { readFile, writeFile, stat } from 'node:fs/promises';

const log = JSON.parse(await readFile('dist/generation-log.json', 'utf8'));
const promptBytes = (await stat('dist/ohr-test.prompt.txt')).size;
log.calls.push({
  zweck: 'P1-Freimodus Ohr-Haertetest (Iteration 1 von max 3, medizinisches Modell menschliches Außenohr, Realismus-P1-Stil, Labels+Didaktik-Manifest)',
  befehl: 'muse.exe exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file dist/ohr-test.prompt.txt (via scripts/_gen-one.mjs)',
  promptBytes,
  startUtc: '2026-10-27T08:32:30.280Z',
  endeUtc: '2026-10-27T08:36:58.418Z',
  dauerS: 268,
  output: 'dist/ohr-test.raw.txt',
  outputBytes: 6527,
  modul: 'dist/ohr-test.js (6526 Bytes)',
  exit: 0,
  attempt: 1,
  befund: 'vollstaendiges Modul im 1. Versuch, S1: hits=0 size=green imports=ok shape=ok; S5: Manifest 5 Labels/1 Messung/Aufgaben B-A-P=0-2-1, deklarativ sauber; kein P2-Repair noetig (GENAU EIN echter Modell-Call)',
});
await writeFile('dist/generation-log.json', JSON.stringify(log, null, 2));
console.log(`generation-log: jetzt ${log.calls.length} calls (ohr-test als Nr. ${log.calls.length})`);
