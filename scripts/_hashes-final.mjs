import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['dist/lab-player.html','dist/build-report.json','dist/verify-report.json','dist/attestation.json','dist/generation-log.json','dist/final-budgets.json','dist/livegen-keytest.json','dist/BUDGET-NACHTRAG-2026-10-27.md','src/models/gpu-example.js','src/models/si-1.js','src/models/si-2.js','src/models/si-3.js','src/models/dup-1.js','src/models/dup-2.js','src/models/dup-3.js','src/models/ae-1.js','src/models/ae-2.js','src/models/ae-3.js','src/runtime/budget.js','prompts/p1-generate.txt','prompts/p1-generate.v5-budget400.txt'];
for (const f of files) {
  try { const b = await readFile(f); console.log(createHash('sha256').update(b).digest('hex') + '  ' + f + '  (' + b.length + ' B)'); }
  catch { console.log('FEHLT  ' + f); }
}
