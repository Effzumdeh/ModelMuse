/**
 * Ein Generierungs-Call via muse.exe (NUR muse-spark-1.3-contributor).
 * Key kommt aus Key_muse.md und wird NUR via stdin (--api-key-stdin)
 * uebergeben — er erscheint nie in Logs, Chat oder der Prozessliste.
 * Aufruf: node scripts/_gen-one.mjs <promptFile> <rawOut> <errOut>
 * Stdout: eine JSON-Zeile mit Zeiten/Bytes/Exit (kein Key, kein Modelltext).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const MUSE = 'C:/Users/flori/AppData/Local/Programs/muse/muse.exe';
const KEYFILE = 'C:/Users/flori/OneDrive/Key_muse.md';
const MODEL = 'muse-spark-1.3-contributor';

const [promptFile, rawOut, errOut] = process.argv.slice(2);
if (!promptFile || !rawOut || !errOut) {
  console.error('Aufruf: node scripts/_gen-one.mjs <promptFile> <rawOut> <errOut>');
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
    const child = spawn(MUSE, ['exec', '--model', MODEL, '--api-key-stdin', '--prompt-file', promptFile], { stdio: ['pipe', 'pipe', 'pipe'] });
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
console.log(JSON.stringify({ promptFile, rawOut, ...info }));
if (!(info.exit === 0 && info.outputBytes > 0)) process.exit(1);
