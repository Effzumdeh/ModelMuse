import { readFileSync } from 'node:fs';
const key = readFileSync('C:/Users/flori/OneDrive/Key_muse.md', 'utf8').trim();
const shape = key.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9');
console.log('len', key.length, 'shape', shape);
console.log('segments', key.split(/[^A-Za-z0-9]+/).map(s => s.length));
console.log('has newline', /\n/.test(key), 'has space', /\s/.test(key), 'has quote', /["'`]/.test(key));
