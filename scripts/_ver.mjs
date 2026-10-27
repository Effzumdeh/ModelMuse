import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const pj = JSON.parse(readFileSync('package.json', 'utf8'));
console.log('three', JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version);
console.log('playwright', JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')).version);
console.log('alpine-dist-files:', readFileSync
  ? (await import('node:fs/promises').then(m => m.readdir('node_modules/alpinejs/dist')).catch(e => e.message))
  : 'n/a');
for (const f of ['src/vendor/alpine.module.esm.min.js', 'src/vendor/three.entry.js']) {
  const b = readFileSync(f);
  console.log(f, b.length, 'bytes', 'sha256=' + createHash('sha256').update(b).digest('hex').slice(0, 16));
}
console.log('node', process.version);
