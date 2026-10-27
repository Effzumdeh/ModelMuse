/** Ohr-Härtetest: S1+S5-Verifikation, Manifest-Bau. Kein Key-Kontakt. */
import { readFile, writeFile } from 'node:fs/promises';
import { verifyStaticLayer, verifyDidacticsLayer, buildVerifyReport, extractMeta } from '../src/runtime/verify.js';
import { buildFreeManifest } from '../src/shell/ui-livegen.js';

const source = await readFile('dist/ohr-test.js', 'utf8');
const meta = extractMeta(source);
const { layer: s1 } = verifyStaticLayer(source, meta, { comfort: 1500000, hard: 2000000 });
const manifest = buildFreeManifest('Menschliches Außenohr (Hörmuschel)', meta ?? {}, source);
const { layer: s5, report } = verifyDidacticsLayer(manifest, source);
const rep = buildVerifyReport({ modelId: 'ohr-test', iteration: 1, layers: [s1, s5], buildHash: 'ohr-haertetest' });

await writeFile('dist/ohr-test.manifest.json', JSON.stringify(manifest, null, 2));
await writeFile('dist/ohr-test.verify.json', JSON.stringify(rep, null, 2));

console.log(`meta: ${JSON.stringify(meta)}`);
console.log(`S1: ${s1.verdict} [${s1.criteria.map((c) => `${c.id}=${c.verdict}`).join(', ')}]`);
console.log(`S5: ${s5.verdict} [${s5.criteria.map((c) => `${c.id}=${c.verdict}`).join(', ')}]`);
console.log(`manifest: labels=${manifest.labels.length} mess=${manifest.measurements.length} tasks=${manifest.tasks.map((t) => t.level[0]).join('')}`);
console.log(`GESAMT: ${rep.verdict} failed=[${rep.failed.join(', ') || 'keine'}]`);
if (rep.verdict === 'rot') process.exit(1);
