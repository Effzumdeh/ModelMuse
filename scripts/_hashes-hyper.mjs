import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [
  'dist/lab-player.html',
  'dist/build-report.json',
  'dist/verify-report.json',
  'dist/attestation.json',
  'dist/generation-log.json',
  'dist/baselines/overview.png',
  'dist/baselines/detail.png',
  'dist/modelmuse-hyper-v3.png',
  'dist/modelmuse-hyper-v3-canvas.png',
  'dist/preview-hyper-v3.png',
  'src/models/gpu-example.js',
  'src/vendor/three.entry.js',
  'prompts/gen-gpu-v3hyper.txt',
];
for (const f of files) {
  try {
    const b = await readFile(f);
    console.log(createHash('sha256').update(b).digest('hex') + '  ' + f + '  (' + b.length + ' B)');
  } catch (e) {
    console.log('FEHLT  ' + f);
  }
}
