/** Vergleichs-Calls (Spark + Wonder) in dist/generation-log.json belegen. Key erscheint nie (nur Status). */
import { readFile, writeFile, stat } from 'node:fs/promises';

const log = JSON.parse(await readFile('dist/generation-log.json', 'utf8'));
const MUSE = 'C:/Users/flori/AppData/Local/Programs/muse/muse.exe';
const sparkPrompt = (await stat('dist/compare-spark.prompt.txt')).size;
const wonderPrompt = (await stat('dist/compare-wonder.prompt.txt')).size;
log.calls.push(
  {
    zweck: 'VERGLEICH Spark (V6-HYPER si-1 Task, byte-identischer Prompt, 1 Call, keine Reparatur)',
    befehl: MUSE + ' exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file dist/compare-spark.prompt.txt (via scripts/_gen-compare.mjs)',
    promptBytes: sparkPrompt,
    startUtc: '2026-10-27T10:42:12.263Z',
    endeUtc: '2026-10-27T10:48:53.277Z',
    dauerS: 401,
    output: 'dist/compare-spark.raw.txt',
    outputBytes: 15839,
    modul: 'dist/compare-spark.js (15838 Bytes)',
    exit: 0,
    attempt: 1,
    befund: 'vollstaendiges Hyper-Modul (S1 hits=0 green ok, S2 statisch pass, 33 Meshes statisch, Probe 58 Calls/2496 Tris gruen, S5 pass 5 Labels/1 Messung cm); kein Repair noetig (GENAU EIN echter Spark-Call)',
  },
  {
    zweck: 'VERGLEICH Wonder (V6-HYPER si-1 Task, byte-identischer Prompt, 1 Call, keine Reparatur)',
    befehl: MUSE + ' exec --model muse-wonder-1.0 --api-key-stdin --prompt-file dist/compare-wonder.prompt.txt (via scripts/_gen-compare.mjs)',
    promptBytes: wonderPrompt,
    startUtc: '2026-10-27T10:49:09.586Z',
    endeUtc: '2026-10-27T10:50:41.946Z',
    dauerS: 92,
    output: 'dist/compare-wonder.raw.txt',
    outputBytes: 15766,
    modul: 'dist/compare-wonder.js (15765 Bytes)',
    exit: 0,
    attempt: 1,
    befund: 'vollstaendiges Hyper-Modul (S1 hits=0 green ok, S2 statisch pass, 12 Meshes statisch, Probe 66 Calls/6948 Tris gruen, S5 pass 5 Labels/1 Messung cm); kein Contributor-Mode-Fehler; 1 vorausgehender lokaler Fehlstart (stdin-no-tty, keine Dateien/kein Modell-Call) danach Retry erfolgreich; kein Repair noetig (GENAU EIN echter Wonder-Call)',
  },
);
await writeFile('dist/generation-log.json', JSON.stringify(log, null, 2) + '\n');
console.log(`generation-log: jetzt ${log.calls.length} calls (vergleich spark+wonder als Nr. ${log.calls.length - 1} + ${log.calls.length})`);
