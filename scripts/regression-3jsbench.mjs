/**
 * O-11/2b: Geometrie-Regression fremder 3jsbench-Briefs durch die eigene Pipeline.
 * Briefs: eval/3jsbench/<id>/prompt.md (verbatim, NICHT anfassen). Je Brief: P1-Text
 * + Brief als Promptdatei bauen, EIN Call via scripts/_gen-one.mjs als Kindprozess
 * (Key-Handling + 429-Retry bleiben dort), Modul durch S1 (verifyStaticLayer) +
 * S2 statisch (verifyGeometryLayer) + S5 (verifyDidacticsLayer; Vergleichs-Manifest
 * aus dem generierten Code nach scripts/_verify-compare.mjs: Labels/Messungen aus
 * addLabel-/addMeasurement-Aufrufen, Rest Template).
 * Aufruf: node scripts/regression-3jsbench.mjs --tag <name> [--limit N] [--prompt <datei>] [--all]
 * Default: --limit 3, --prompt prompts/p1-generate.txt (= A/B-Haken).
 * Kosten-Schranke (hart): ohne --all max. 3 Briefs; --all warnt "100 Calls!".
 * Report: dist/regression-3jsbench-<tag>.json. Exit 0 nur bei 100 % S1+S5-pass.
 * Kein Key-Kontakt, keine neuen Dependencies.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { verifyStaticLayer, verifyGeometryLayer, verifyDidacticsLayer, extractMeta } from '../src/runtime/verify.js';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const tag = opt('--tag', null);
const promptDatei = opt('--prompt', 'prompts/p1-generate.txt');
const all = args.includes('--all');
const limit = Number(opt('--limit', '3'));
if (!tag) {
  console.error('Aufruf: node scripts/regression-3jsbench.mjs --tag <name> [--limit N] [--prompt <datei>] [--all]');
  process.exit(2);
}
if (!Number.isInteger(limit) || limit < 1) {
  console.error('regression-3jsbench: --limit muss eine ganze Zahl >= 1 sein');
  process.exit(2);
}
if (!all && limit > 3) {
  console.error('regression-3jsbench: Kosten-Schranke max. 3 Briefs ohne --all');
  process.exit(2);
}

let buildHash = 'dev';
try {
  buildHash = JSON.parse(await readFile(`${ROOT}/dist/build-report.json`, 'utf8')).buildHash ?? 'dev';
} catch { /* Build-Report fehlt: Hash dev */ }

const p1 = await readFile(`${ROOT}/${promptDatei}`, 'utf8');
const ids = [];
for (const e of (await readdir(`${ROOT}/eval/3jsbench`, { withFileTypes: true })).filter((x) => x.isDirectory()).map((x) => x.name).sort()) {
  try {
    await readFile(`${ROOT}/eval/3jsbench/${e}/prompt.md`, 'utf8');
    ids.push(e);
  } catch { /* Verzeichnis ohne prompt.md: ueberspringen */ }
}
const auswahl = all ? ids : ids.slice(0, limit);
if (all) console.warn(`regression-3jsbench: WARNUNG --all: ${auswahl.length} Calls (100 Calls!)`);
await mkdir(`${ROOT}/dist`, { recursive: true });

/** Markdown-Fences entfernen (P1 verlangt reinen Modulcode, Modelle liefern teils Fences). */
function entzaunen(raw) {
  const m = /```(?:js|javascript)?\s*\n([\s\S]*?)\n```/.exec(String(raw));
  return (m ? m[1] : String(raw)).trim();
}

const ergebnisse = [];
for (const id of auswahl) {
  const brief = await readFile(`${ROOT}/eval/3jsbench/${id}/prompt.md`, 'utf8');
  const promptPfad = `${ROOT}/dist/regression-3jsbench-${tag}-${id}.prompt.txt`;
  const rawPfad = `${ROOT}/dist/regression-3jsbench-${tag}-${id}.raw.txt`;
  const errPfad = `${ROOT}/dist/regression-3jsbench-${tag}-${id}.err.txt`;
  await writeFile(promptPfad, `${p1.trim()}\n\nFREMD-BRIEF (3jsbench, verbatim, Geometrie-Anforderung statt Verfahren):\n${brief}`);
  const t0 = Date.now();
  let genOk = true;
  try {
    execFileSync('node', ['scripts/_gen-one.mjs', promptPfad, rawPfad, errPfad], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    genOk = false;
  }
  const dauerS = Math.round((Date.now() - t0) / 1000);
  let raw = '';
  try {
    raw = await readFile(rawPfad, 'utf8');
  } catch { /* kein Output: fail unten */ }
  const source = entzaunen(raw);
  const bytes = Buffer.byteLength(source, 'utf8');
  const meta = extractMeta(source);
  const { layer: s1 } = verifyStaticLayer(source, meta, { comfort: 1500000, hard: 2000000 });
  const { layer: s2 } = verifyGeometryLayer(source);
  // S5-Vergleichs-Manifest aus generiertem Code (Muster scripts/_verify-compare.mjs).
  const labels = [...new Set([...source.matchAll(/addLabel\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((t) => t.length >= 2))];
  if (Array.isArray(meta?.parts)) for (const p of meta.parts) if (typeof p === 'string' && !labels.includes(p)) labels.push(p);
  while (labels.length < 3) labels.push(`Bauteil ${labels.length + 1}`);
  const measurements = [];
  const mre = /addMeasurement\s*\(\s*[^,]+,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*,\s*['"]([^'"]+)['"]/g;
  let mm;
  while ((mm = mre.exec(source)) !== null && measurements.length < 9) {
    const vec = (s) => s.split(',').map((x) => Number(x.trim()));
    const from = vec(mm[1]);
    const to = vec(mm[2]);
    if (from.length === 3 && to.length === 3 && [...from, ...to].every(Number.isFinite) && /\d/.test(mm[3])) {
      measurements.push({ id: `m${measurements.length + 1}`, from, to, text: mm[3].slice(0, 80) });
    }
  }
  if (measurements.length === 0) measurements.push({ id: 'm1', from: [-0.12, 0.145, 0.002], to: [0.12, 0.145, 0.002], text: 'Vergleichs-Bemaßung: 24 cm' });
  const title = typeof meta?.title === 'string' && meta.title.length >= 3 ? meta.title.slice(0, 80) : `3jsbench ${id}`;
  const manifest = {
    schemaVersion: 1,
    title,
    track: 'free',
    objectives: [
      `Die Auszubildenden benennen die ${labels.length} Hauptbauteile (${labels.join(', ')}) korrekt.`,
      'Die Auszubildenden lesen die Bemaßung ab und ordnen sie dem richtigen Bauteil zu.',
    ],
    labels: [...labels],
    measurements,
    tasks: [
      { id: 'reg-aufbau-1', level: 'aufbau', type: 'zuordnung', prompt: `Ordne zu: Welches Bauteil traegt die Hauptstruktur des ${title}?`, expected: labels[0], tolerance: 0 },
      { id: 'reg-aufbau-2', level: 'aufbau', type: 'messwert', prompt: 'Lies die Bemaßung aus und nenne den Zahlenwert mit Einheit.', expected: measurements[0].text, tolerance: 0 },
      { id: 'reg-profi-1', level: 'profi', type: 'transfer', prompt: `${title} zeigt einen Fehler (ein Bauteil faellt aus): Nenne zwei pruefbare Ursachen und je eine Abhilfemassnahme.`, expected: `${labels[0]} pruefen und Bauteilverbindung sicherstellen`, tolerance: 0 },
    ],
  };
  const { layer: s5 } = verifyDidacticsLayer(manifest, source);
  const verdict = genOk && source.length > 0 && s1.verdict === 'pass' && s2.verdict === 'pass' && s5.verdict === 'pass' ? 'pass' : 'fail';
  const fails = [...(genOk ? [] : ['gen']), ...(source.length > 0 ? [] : ['leer']),
    ...s1.criteria.filter((c) => c.verdict === 'fail').map((c) => `S1:${c.id}`),
    ...s2.criteria.filter((c) => c.verdict === 'fail').map((c) => `S2:${c.id}`),
    ...s5.criteria.filter((c) => c.verdict === 'fail').map((c) => `S5:${c.id}`)];
  ergebnisse.push({ id, verdict, s1: s1.verdict, s2: s2.verdict, s5: s5.verdict, dauerS, bytes });
  console.log(`${id}: ${verdict} [s1=${s1.verdict} s2=${s2.verdict} s5=${s5.verdict}${fails.length > 0 ? ` | ${fails.join(', ')}` : ''}]`);
}

const passCount = ergebnisse.filter((r) => r.verdict === 'pass').length;
const report = {
  tag,
  promptDatei,
  limit: all ? auswahl.length : limit,
  buildHash,
  passRate: ergebnisse.length === 0 ? 0 : passCount / ergebnisse.length,
  ergebnisse,
  kostenHinweis: `${auswahl.length} Generierungs-Call(s) via scripts/_gen-one.mjs (Contributor); Voll-Lauf nur mit --all (100 Calls!).`,
};
await writeFile(`${ROOT}/dist/regression-3jsbench-${tag}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`regression-3jsbench [${tag}]: ${passCount}/${ergebnisse.length} pass (Rate ${report.passRate})`);
const s1s5ok = ergebnisse.length > 0 && ergebnisse.every((r) => r.s1 === 'pass' && r.s5 === 'pass');
if (!s1s5ok || passCount !== ergebnisse.length) {
  console.error('regression-3jsbench: ABBRUCH (kein 100-%-pass)');
  process.exit(1);
}
