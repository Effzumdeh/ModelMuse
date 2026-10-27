/**
 * Einmal-Codemod (mechanisch, kein LLM): Bauteil-Sichtbarkeit per
 * patch.labels.hidden (Index-Array) + setVisible-Fix in si-1.
 * Pro Datei exakt EINE Ersetzung, sonst Abbruch. Danach S1-Gate je Datei.
 * Aufruf: node scripts/_parts-codemod.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { staticGate } from '../src/runtime/guard-static.js';

const HD = 'const hd = Array.isArray(lbH.hidden) ? lbH.hidden : [];';
const HD_PATCH = 'const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];';

const JOBS = [
  {
    file: 'src/models/ae-1.js',
    old: 'const en = lb.enabled !== false;\nlet mx = 5;\nif (lb.max !== undefined) mx = lb.max;\nfor (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && (i < mx));',
    neu: 'const en = lb.enabled !== false;\nlet mx = 5;\nif (lb.max !== undefined) mx = lb.max;\nconst lbH = lb || {};\nconst hd = Array.isArray(lbH.hidden) ? lbH.hidden : [];\nfor (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && (i < mx) && !hd.includes(i));',
  },
  {
    file: 'src/models/ae-2.js',
    old: 'const en = patch.labels.enabled !== false;\n      let mx = patch.labels.max;\n      if (mx === undefined || mx === null) mx = 5;\n      for (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && i < mx);',
    neu: 'const en = patch.labels.enabled !== false;\n      let mx = patch.labels.max;\n      if (mx === undefined || mx === null) mx = 5;\n      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\n      for (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && i < mx && !hd.includes(i));',
  },
  {
    file: 'src/models/ae-3.js',
    old: '      for (let i = 0; i < labels.length; i++) {\n        const vis = en && i < mx;',
    neu: '      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\n      for (let i = 0; i < labels.length; i++) {\n        const vis = en && i < mx && !hd.includes(i);',
  },
  {
    file: 'src/models/dup-1.js',
    old: 'let mx = patch.labels.max;\nif(typeof mx !== \'number\')mx = 5;\nfor(let i=0;i<labelHandles.length;i++){\nlabelHandles[i].setVisible(en && i < mx);\n}',
    neu: 'let mx = patch.labels.max;\nif(typeof mx !== \'number\')mx = 5;\nconst hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\nfor(let i=0;i<labelHandles.length;i++){\nlabelHandles[i].setVisible(en && i < mx && !hd.includes(i));\n}',
  },
  {
    file: 'src/models/dup-2.js',
    old: 'const mx = patch.labels.max || 5;\n      const hs = [l1, l2, l3, l4];\n      for (let i = 0; i < hs.length; i++) {\n        if (hs[i] && hs[i].setVisible) hs[i].setVisible(en && i < mx);\n      }',
    neu: 'const mx = patch.labels.max || 5;\n      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\n      const hs = [l1, l2, l3, l4];\n      for (let i = 0; i < hs.length; i++) {\n        if (hs[i] && hs[i].setVisible) hs[i].setVisible(en && i < mx && !hd.includes(i));\n      }',
  },
  {
    file: 'src/models/dup-3.js',
    old: '      let lim = 5;\n      if (typeof patch.labels.max === \'number\') {\n        lim = patch.labels.max;\n      }\n      for (let i = 0; i < labels.length; i++) {\n        labels[i].setVisible(en && i < lim);\n      }',
    neu: '      let lim = 5;\n      if (typeof patch.labels.max === \'number\') {\n        lim = patch.labels.max;\n      }\n      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\n      for (let i = 0; i < labels.length; i++) {\n        labels[i].setVisible(en && i < lim && !hd.includes(i));\n      }',
  },
  {
    file: 'src/models/si-1.js',
    old: 'const vis = en && (i<mx);\nif(hh && (\'visible\' in hh)){ hh.visible = vis; }',
    neu: 'const lbH = patch.labels || {};\nconst hd = Array.isArray(lbH.hidden) ? lbH.hidden : [];\nconst vis = en && (i<mx) && !hd.includes(i);\nif(hh && typeof hh.setVisible === \'function\'){ hh.setVisible(vis); }',
  },
  {
    file: 'src/models/si-1.js',
    old: 'if(measHandle && (\'visible\' in measHandle)){ measHandle.visible = enM; }',
    neu: 'if(measHandle && typeof measHandle.setVisible === \'function\'){ measHandle.setVisible(enM); }',
  },
  {
    file: 'src/models/si-2.js',
    old: 'const vis = en && (i < mx);',
    neu: 'const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\nconst vis = en && (i < mx) && !hd.includes(i);',
  },
  {
    file: 'src/models/si-3.js',
    old: 'labels[i].setVisible(en&&i<mx);',
    neu: 'const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\nlabels[i].setVisible(en&&i<mx&&!hd.includes(i));',
  },
  {
    file: 'src/models/gpu-example.js',
    old: 'const vis = en && i < mx;',
    neu: 'const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];\nconst vis = en && i < mx && !hd.includes(i);',
  },
];

let changed = 0;
for (const job of JOBS) {
  const src = await readFile(job.file, 'utf8');
  const count = src.split(job.old).length - 1;
  if (count !== 1) {
    console.error(`CODEMOD-STOP ${job.file}: ${count} Treffer (erwartet 1)`);
    process.exit(1);
  }
  const next = src.replace(job.old, job.neu);
  await writeFile(job.file, next);
  changed += 1;
  console.log(`codemod: ${job.file}`);
  const gate = staticGate(next, { comfort: 1500000, hard: 2000000 });
  console.log(`  S1: hits=${gate.hits.length} size=${gate.size.tier} imports=${gate.imports.ok ? 'ok' : 'FREMD'}`);
  if (gate.hits.length > 0 || !gate.imports.ok || gate.size.tier === 'reject') {
    console.error(`CODEMOD-STOP ${job.file}: S1 rot nach Umbau`);
    process.exit(1);
  }
  if (Buffer.byteLength(next, 'utf8') > 34000) {
    console.error(`CODEMOD-STOP ${job.file}: > 34000 Bytes`);
    process.exit(1);
  }
}
console.log(`codemod: OK (${changed} Ersetzungen, alle S1 gruen)`);
void HD;
void HD_PATCH;
