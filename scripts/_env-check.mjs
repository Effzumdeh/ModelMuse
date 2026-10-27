import { readFileSync, existsSync } from 'node:fs';
const pj = JSON.parse(readFileSync('package.json', 'utf8'));
console.log('deps:', JSON.stringify(pj.devDependencies));
for (const p of ['node_modules/three/build/three.module.js', 'node_modules/alpinejs/dist/cdn.min.js']) {
  try {
    const b = readFileSync(p);
    console.log(p, b.length, 'bytes');
  } catch { console.log(p, 'FEHLT'); }
}
console.log('playwright-browsers:', existsSync('C:/Users/flori/AppData/Local/ms-playwright') ? 'vorhanden' : 'fehlt');
