import { readFile } from 'node:fs/promises';
import { staticGate, checkMeta } from '../src/runtime/guard-static.js';
import { extractMeta } from '../src/runtime/verify.js';
const T = await import('three');
console.log('CONST:', 'PCFSoft=' + T.PCFSoftShadowMap, 'ACES=' + T.ACESFilmicToneMapping,
  'Hemi=' + typeof T.HemisphereLight, 'ShadowMat=' + typeof T.ShadowMaterial);
for (const f of ['dup-1', 'dup-2', 'dup-3']) {
  const raw = await readFile(`dist/${f}.raw.txt`, 'utf8');
  const mStart = /^\s*(import |export )/m.exec(raw);
  console.log(`--- ${f}: startIndex=${mStart ? mStart.index : 'KEINER'}, len=${raw.length}`);
  console.log('tail:', JSON.stringify(raw.slice(-220)));
  if (mStart) {
    const source = raw.slice(mStart.index).trim();
    const gate = staticGate(source, { comfort: 1500000, hard: 2000000 });
    console.log(`S1: hits=${gate.hits.length} size=${gate.size.tier} imports=${gate.imports.ok ? 'ok' : 'FREMD:' + gate.imports.offending.join(',')}`);
    for (const h of gate.hits.slice(0, 8)) console.log(`  HIT ${h.rule} token=${h.token} ctx=${h.context.slice(0, 80)}`);
    const meta = extractMeta(source);
    console.log('meta:', JSON.stringify(meta));
    const helperCalls = (source.match(/addLabel\s*\(/g) || []).length;
    const measCalls = (source.match(/addMeasurement\s*\(/g) || []).length;
    console.log(`helper: labels=${helperCalls} measurements=${measCalls}`);
  }
}
