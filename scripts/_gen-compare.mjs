/**
 * Vergleichs-Call via muse.exe (Spark vs Wonder, je EIN Call).
 * Modelle NUR aus offizieller Meta-Doku:
 *  - muse-spark-1.3-contributor (Spark Contributor, pay-as-you-go Contributor-Modus)
 *    Quelle: https://dev.meta.ai/docs/models ("muse-spark-1.3 for Standard mode
 *    or muse-spark-1.3-contributor for Contributor mode")
 *  - muse-wonder-1.0 (Muse Wonder, Standard mode only; Contributor nicht verfuegbar)
 *    Quelle: https://dev.meta.ai/docs/models ("Muse Wonder (muse-wonder-1.0)
 *    Available (Standard mode only)" + "For Muse Wonder, Contributor mode
 *    isn't available on pay-as-you-go.")
 * Key aus Key_muse.md NUR via stdin (--api-key-stdin), nie in Logs/Chat/Prozessliste.
 * Aufruf: node scripts/_gen-compare.mjs <model> <promptFile> <rawOut> <errOut>
 * Stdout: eine JSON-Zeile mit Zeiten/Bytes/Exit (kein Key, kein Modelltext).
 * 429-Policy: 60s warten, einzeln wiederholen (max 3 Versuche).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const MUSE = 'C:/Users/flori/AppData/Local/Programs/muse/muse.exe';
const KEYFILE = 'C:/Users/flori/OneDrive/Key_muse.md';
const ALLOWED = new Set(['muse-spark-1.3-contributor', 'muse-wonder-1.0']);

const [model, promptFile, rawOut, errOut] = process.argv.slice(2);
if (!model || !promptFile || !rawOut || !errOut) {
  console.error('Aufruf: node scripts/_gen-compare.mjs <model> <promptFile> <rawOut> <errOut>');
  process.exit(2);
}
if (!ALLOWED.has(model)) {
  console.error(`GEN-COMPARE: Modell nicht belegt (nur ${[...ALLOWED].join(', ')} laut https://dev.meta.ai/docs/models)`);
  process.exit(2);
}

const key = (await readFile(KEYFILE, 'utf8')).trim();
if (key.length < 8 || /\s/.test(key)) {
  console.error('GEN: Key-Format ungueltig (Laenge/Whitespace)');
  process.exit(2);
}

async function once() {
  const start = new Date();
  const res = await new Promise((resolve) => {
    const child = spawn(MUSE, ['exec', '--model', model, '--api-key-stdin', '--prompt-file', promptFile], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => resolve({ out, err: err + `\nSPAWN-FEHLER: ${e.message}`, exit: 127 }));
    child.on('close', (code) => resolve({ out, err, exit: code ?? 1 }));
    child.stdin.write(key);
    child.stdin.end();
  });
  const ende = new Date();
  await writeFile(rawOut, res.out);
  await writeFile(errOut, res.err);
  return {
    model,
    promptFile,
    rawOut,
    startUtc: start.toISOString(),
    endeUtc: ende.toISOString(),
    dauerS: Math.round((ende - start) / 1000),
    outputBytes: Buffer.byteLength(res.out, 'utf8'),
    exit: res.exit,
    errHead: res.err.slice(0, 200),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let attempt = 0;
let info = null;
for (;;) {
  attempt += 1;
  info = await once();
  info.attempt = attempt;
  const rate = /429|rate.limit|rate_limit|too many requests/i.test(info.errHead);
  if (info.exit === 0 && info.outputBytes > 0) break;
  if (attempt >= 3) break;
  if (rate) {
    info.waitedS = 60;
    await sleep(60000);
  } else {
    info.waitedS = 10;
    await sleep(10000);
  }
}
console.log(JSON.stringify({ ...info }));
if (!(info.exit === 0 && info.outputBytes > 0)) process.exit(1);
