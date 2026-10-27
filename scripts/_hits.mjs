import { readFile } from 'node:fs/promises';
import { scanForbidden, stripComments } from '../src/runtime/guard-static.js';
const src = await readFile(process.argv[2] ?? 'src/models/gpu-example.js', 'utf8');
const code = stripComments(src);
for (const h of scanForbidden(src)) {
  const i = code.indexOf(h.token === 'import(' ? 'import(' : h.token, Math.max(0, h.offset - 2));
  console.log(`HIT rule=${h.rule} token=${JSON.stringify(h.token)} offset=${h.offset}`);
  console.log(`  ctx: ${h.context}`);
  console.log(`  src: ...${src.slice(Math.max(0, h.offset - 120), h.offset + 120).replace(/\n/g, '↵')}...`);
}
