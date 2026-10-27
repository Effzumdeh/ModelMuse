import { readFile, writeFile } from 'node:fs/promises';
const p = 'dist/generation-log.json';
const log = JSON.parse(await readFile(p, 'utf8'));
console.log('calls=' + log.calls.length);
console.log('keys=' + Object.keys(log).join(','));
