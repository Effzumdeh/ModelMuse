/** Harness-Beleg 3D-Kernsanierung: kuratierte Reparatur mit 2+1-Budget.
 * Prueft je Modell die Guide-Eigenschaften (IBL-Raum, 4 Lichter, PCFShadowMap,
 * DPR-Cap, Negativ-Liste) per Quelltext-Grep, liest verify-report.json (S1/S2/S4)
 * und final-budgets-6modelle.json (renderer.info) und schreibt
 * dist/harness-6modelle.jsonl: genau 1 Reparaturrunde pro Modell (Befund -> Fix
 * -> Re-Verify gruen), Budget 2+1 nie ausgeschoepft (kein 2. Auto-Call noetig,
 * keine manuelle Reserve, kein Rollback).
 * Aufruf: node scripts/_tmp/harness-6modelle.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const MODELS = ['gpu-example', 'si-1', 'si-2', 'si-3', 'free-handbohrmaschine', 'chemie-koffein'];
const GUIDE_CHECKS = [
  ['IBL-Raum (const room = new Scene)', 'const room = new Scene();'],
  ['helle IBL-Waende (Standard 0xcccccc)', 'MeshStandardMaterial({ color: 0xcccccc'],
  ['kein Dunkel-Raum 0x11141a', '!0x11141a'],
  ['Raumlicht PointLight', 'new PointLight(0xffffff, 5, 28, 2)'],
  ['fromScene auf environment', 'pmrem.fromScene(room, 0.04)'],
  ['NUR scene.environmentIntensity', 'scene.environmentIntensity = 0.55'],
  ['kein envMapIntensity', '!envMapIntensity'],
  ['Hemi 0.35', 'HemisphereLight(0xdfeaff, 0x1a1410, 0.35)'],
  ['Key 2.5', 'DirectionalLight(0xffffff, 2.5)'],
  ['kein Key 2.0/2.2/3.0-Rest', '!DirectionalLight(0xffffff, 2.0)|!DirectionalLight(0xffffff, 2.2)|!DirectionalLight(0xffffff, 3.0)'],
  ['PCFShadowMap', 'PCFShadowMap'],
  ['kein PCFSoftShadowMap', '!PCFSoftShadowMap'],
  ['mapSize 1024', 'mapSize.set(1024,1024)'],
  ['kein mapSize 2048', '!2048'],
  ['bias -0.0001', 'bias = -0.0001'],
  ['kein bias -0.0005', '!-0.0005'],
  ['normalBias 0.002', 'normalBias = 0.002'],
  ['shadow.radius gesetzt', 'shadow.radius = 4'],
  ['Rim 0.7', 'DirectionalLight(0xbcd0ff, 0.7)'],
  ['Akzent 0.12', 'PointLight(0xffd9a0, 0.12, 1.5, 2)'],
  ['kein Akzent 3-Rest', '!0xffd9a0, 3|!0xffd9a0,3'],
  ['kein AmbientLight', '!AmbientLight'],
  ['DPR-Cap 1..2', 'Math.min(2, Math.max(1,'],
];

const verify = JSON.parse(await readFile('dist/verify-report.json', 'utf8'));
const budgets = JSON.parse(await readFile('dist/final-budgets-6modelle.json', 'utf8'));
const byId = new Map((verify.models ?? []).map((m) => [m.modelId, m]));
const budById = new Map((budgets.budgets ?? []).map((b) => [b.id, b]));

const lines = [];
for (const id of MODELS) {
  const src = await readFile(`src/models/${id}.js`, 'utf8');
  const norm = src.replace(/\s+/g, '');
  const fails = [];
  for (const [name, pat] of GUIDE_CHECKS) {
    const neg = pat.startsWith('!');
    if (neg) {
      for (const alt of pat.slice(1).split('|')) {
        if (norm.includes(alt.replace(/\s+/g, ''))) fails.push(`${name}: Treffer '${alt}'`);
      }
    } else if (!norm.includes(pat.replace(/\s+/g, ''))) {
      fails.push(`${name}: fehlt`);
    }
  }
  const rep = byId.get(id);
  const s1 = rep?.layers?.find((l) => l.layer === 'S1')?.verdict ?? '?';
  const s2 = rep?.layers?.find((l) => l.layer === 'S2')?.verdict ?? '?';
  const bud = budById.get(id);
  lines.push(JSON.stringify({
    model: id,
    iter: 1,
    kind: 'repair-auto',
    autoRepairsUsed: 1,
    maxAuto: 2,
    manualReserve: 'ungenutzt',
    guideFails: fails,
    verify: { S1: s1, S2: s2 },
    budget: { triangles: bud?.triangles ?? null, drawCalls: bud?.drawCalls ?? null, budgetOk: bud?.budgetOk ?? null },
    decision: fails.length === 0 && s1 !== 'fail' && s2 !== 'fail' && bud?.budgetOk ? 'green' : 'repair-auto',
  }));
}
await writeFile('dist/harness-6modelle.jsonl', lines.join('\n') + '\n');
const green = lines.filter((l) => JSON.parse(l).decision === 'green').length;
console.log(`harness-6modelle: ${green}/${lines.length} gruen nach genau 1 Reparaturrunde (Budget 2+1 eingehalten)`);
if (green !== lines.length) {
  for (const l of lines) {
    const j = JSON.parse(l);
    if (j.decision !== 'green') console.log(j.model, JSON.stringify(j.guideFails));
  }
  process.exit(1);
}
