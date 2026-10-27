import { readFile } from 'node:fs/promises';
const src = await readFile('dist/gpu-v3hyper.js', 'utf8');
const rep = [];
rep.push('bytes=' + Buffer.byteLength(src, 'utf8'));
rep.push('imports=' + JSON.stringify([...src.matchAll(/^import .*$/gm)].map((m) => m[0].slice(0, 110))));
rep.push('meta=' + (src.match(/export const meta = \{[^}]*\}/) ?? ['KEIN META'])[0].slice(0, 400));
rep.push('addLabelCount=' + (src.match(/addLabel\(/g) || []).length);
rep.push('addMeasurementCount=' + (src.match(/addMeasurement\(/g) || []).length);
rep.push('hasUpdate=' + /function update\(patch\)|update\(patch\)|update\s*\(patch/.test(src));
rep.push('hasDispose=' + /function dispose\(\)/.test(src));
rep.push('InstancedMesh=' + (src.match(/new InstancedMesh/g) || []).length);
rep.push('DataTexture=' + (src.match(/new DataTexture/g) || []).length);
rep.push('MeshBasicMaterial(visible?)=' + (src.match(/new MeshBasicMaterial/g) || []).length);
rep.push('ExtrudeGeometry=' + (src.match(/new ExtrudeGeometry/g) || []).length);
rep.push('MeshPhysicalMaterial=' + (src.match(/MeshPhysicalMaterial/g) || []).length);
rep.push('MeshStandardMaterial=' + (src.match(/new MeshStandardMaterial/g) || []).length);
rep.push('setColorAt=' + (src.match(/setColorAt/g) || []).length);
rep.push('new Mesh count=' + (src.match(/new Mesh\(/g) || []).length);
for (const w of ['document', 'window', 'parent', 'top', 'fetch', 'eval', 'Function', 'navigator', 'localStorage', 'sendBeacon', 'WebSocket', 'XMLHttpRequest']) {
  const m = src.match(new RegExp('\\b' + w + '\\b', 'g'));
  if (m) rep.push('WORT-' + w + ': ' + m.length + 'x');
}
rep.push('await addLabel/addMeasurement=' + (src.match(/await (addLabel|addMeasurement)/g) || []).length);
rep.push('init async=' + /export (async )?function init|export async/.test(src));
console.log(rep.join('\n'));
