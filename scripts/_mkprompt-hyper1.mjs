import { readFile, writeFile } from 'node:fs/promises';
const head = await readFile('dist/repair-gpu-hyper-01.head.txt', 'utf8');
const mod = await readFile('dist/gpu-v3hyper.js', 'utf8');
await writeFile('dist/repair-gpu-hyper-01.prompt.txt', head + mod + '\n');
console.log('prompt bytes: ' + Buffer.byteLength(head + mod, 'utf8'));
