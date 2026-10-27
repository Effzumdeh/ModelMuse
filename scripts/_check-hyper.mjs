import { readFile } from 'node:fs/promises';
const b = JSON.parse(await readFile('dist/build-report.json', 'utf8'));
console.log('build verdict=' + b.verdict + ' hash=' + b.buildHash + ' bytes=' + b.totalBytes);
const v = JSON.parse(await readFile('dist/verify-report.json', 'utf8'));
const reps = v.models ?? v.reports;
for (const r of reps) {
  const layers = (r.layers ?? []).map((l) => l.layer + '=' + l.verdict).join(' ');
  console.log(r.modelId + ' -> ' + layers);
}
