import { readFileSync } from 'node:fs';
const f = process.argv[2];
const b = readFileSync(f, 'utf8');
console.log('lines=' + b.split('\n').length + ' bytes=' + b.length);
console.log('TAIL>>>');
console.log(b.slice(-400));
console.log('<<<TAIL');
