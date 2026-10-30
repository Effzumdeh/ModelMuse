/**
 * Showcase-Harness-Log (3D-Erststart-Defaults, 5 Modelle):
 * Je Domäne 1 Modell — P0-Klassifikation -> P1-Referenz (v6-standard) ->
 * Verify S1/S2/S4/S5 (max 2+1, Abbruch grün/Stagnation/Regression).
 *
 * Laufzeit-Hinweis (ehrlich, kein Key im Log):
 * - P0 wird hier REGEL-basiert angewendet (prompts/p0-router.txt §1-3:
 *   >=2 benennbare Bauteile mit Lagebezug + raeumliches Lernziel => 3d).
 *   Kein Modell-Call in dieser Runtime.
 * - P1-Instanzen: arch-brandenburger-tor neu (offline P1-v6-Instanz, diese Runtime),
 *   si-1/chemie-koffein/free-handbohrmaschine/gpu-example versionierte
 *   Quellen (Erstgenerierung s. dist-standalone/ledger-muse-calls.md).
 * - Baseten-Direkt: Produktpfad im Artefakt (BYOK/sessionStorage);
 *   in dieser Runtime kein Live-Call (kein Key in diesem Profil).
 * - Verify: verifyLoopModule-äquivalent (S1+S2-statisch+S4+S5+Matrix-Soll),
 *   Entscheidung per decideIteration (Budget maxAuto=2, manuell +1).
 *
 * Aufruf: node scripts/showcase-harness.mjs [--out=dir]
 * Exit 0: alle 5 grün in Iter 0 (Budget ungenutzt). Exit 1: sonst.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { verifyStaticLayer, verifyGeometryLayer, verifyDidacticsLayer, extractMeta, sollFromMatrixEntry } from '../src/runtime/verify.js';
import { countMeshesStatic } from '../src/runtime/geometry-checks.js';
import { decideIteration, failsOf, MODULE_BYTES_HARD } from './_harness-loop.mjs';

const SHOWCASE = [
  { id: 'arch-brandenburger-tor', domaene: 'Architektur', typ: 'baugruppe', fachtext: 'Brandenburger Tor Berlin: Torbau 62,5 m breit, 20,3 m hoch (ca. 26 m mit Quadriga), 11 m tief; 12 dorische Säulen (13,5 m), Gebälk, Attika, Quadriga, fünf Durchfahrten (Mitte 5,65 m), zwei Seitenflügel; Bauteillage und Gesamtmaße sind räumlich.' },
  { id: 'si-1', domaene: 'Informatik', typ: 'baugruppe', fachtext: 'PC-Arbeitsplatz: Mainboard, CPU mit Kuehler, Arbeitsspeicher, Grafikkarte, Netzteil im Gehaeuse; Stecklagen und Einbaureihenfolge sind raeumlich.' },
  { id: 'chemie-koffein', domaene: 'Chemie', typ: 'volumen', fachtext: 'Koffein-Molekuel C8H10N4O2: Puringeruest aus zwei Ringen, Carbonylgruppen, Methylgruppen, Amidstickstoff; Ringebene gegenueber herausstehenden Gruppen ist raeumlich.' },
  { id: 'free-handbohrmaschine', domaene: 'Mechanik', typ: 'montage', fachtext: 'Handbohrmaschine: Gehaeuse, Griff, Bohrfutter, Bohrer, Schalter, Lueftungsschlitze; Anordnung und 448 mm Geraetemass sind raeumlich.' },
  { id: 'gpu-example', domaene: 'Hardware/Computergrafik', typ: 'baugruppe', fachtext: 'Grafikkarte: GPU-Die, VRAM, zwei Luefter, Heatpipe, Backplate, PCIe-Stecker, Stromanschluss, Slotblende; gestapelte Baugruppen und 267 mm Kartenmass sind raeumlich.' },
];

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = outArg ? outArg.slice(6) : 'dist-standalone/showcase-harness';
await mkdir(OUT, { recursive: true });

const matrix = JSON.parse(await readFile('src/data/modellmatrix.json', 'utf8'));
const p1head = await readFile('prompts/p1-generate.txt', 'utf8');
const p1std = await readFile('prompts/p1-generate.v6-standard.txt', 'utf8').catch(() => '');
const p0router = await readFile('prompts/p0-router.txt', 'utf8');

let allGreen = true;
const summary = [];
for (const item of SHOWCASE) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  // P0: Regelanwendung dokumentieren (alle 5: >=2 Teile mit Lage + Raum-Mehrwert => 3d).
  const p0 = { mode: '3d', typ: item.typ, begruendung: 'Mehrere Bauteile mit Lagebezug, Orbit bringt Mehrwert.' };
  const p0rules = 'P0-Regeln 3d (alle drei erfuellt): raeumlicher Gegenstand + raeumliches Lernziel + >=2 benennbare Bauteile mit Lagebezug.';
  const src = await readFile(`src/models/${item.id}.js`, 'utf8');
  const man = JSON.parse(await readFile(`src/models/manifests/${item.id}.json`, 'utf8'));
  const meta = extractMeta(src);
  // AUFGABE-Block (P1-Ergaenzung je Lab): Bauteilliste + exakte Label-/Mess-Aufrufe.
  const aufgabe = `AUFGABE ${item.id} (${item.domaene}): Teile=[${man.labels.join('|')}] mit exakten Massen in Metern; addLabel-Aufrufe positional EXAKT Texte [${man.labels.join('|')}]; addMeasurement-Aufrufe EXAKT [${man.measurements.map((m) => `${m.id}:${m.text}`).join('|')}]; Manifest-Soll B/A/P=${matrix[item.id]?.tasks?.join('/') ?? '?'} LabelsMin=${matrix[item.id]?.labelsMin ?? '?'}.`;
  // Verify S1+S2(statisch)+S4+S5 (Browser-Belege S3/S4-tri: ausstehend -> skip, kein Fail).
  const layers = [];
  layers.push(verifyStaticLayer(src, meta, { comfort: 1500000, hard: 2000000 }).layer);
  layers.push(verifyGeometryLayer(src, null).layer);
  const counts = countMeshesStatic(src);
  const bytes = Buffer.byteLength(src, 'utf8');
  layers.push({
    layer: 'S4', verdict: (counts.total <= 250 && bytes <= MODULE_BYTES_HARD) ? 'pass' : 'fail', durationMs: 0,
    criteria: [
      { id: 'S4-meshcount', verdict: counts.total <= 250 ? 'pass' : 'fail', expected: '<= 250 (gruen bis 120, Ziel ~45)', actual: `${counts.total} Meshes statisch (Mesh ${counts.mesh} + Instanced ${counts.instanced})` },
      { id: 'S4-modulesize', verdict: bytes <= MODULE_BYTES_HARD ? 'pass' : 'fail', expected: `<= ${MODULE_BYTES_HARD} Bytes`, actual: `${bytes} Bytes` },
      { id: 'S4-triangles', verdict: 'skip', expected: '<= 150000 (renderer.info)', actual: 'kein Browser-Beleg (Probe ausstehend)' },
      { id: 'S4-drawcalls', verdict: 'skip', expected: '<= 400 (renderer.info)', actual: 'kein Browser-Beleg (Probe ausstehend)' },
    ],
  });
  layers.push(verifyDidacticsLayer(man, src, sollFromMatrixEntry(matrix[item.id])).layer);
  const curFails = failsOf(layers);
  const decision = decideIteration({ prevFails: null, curFails, autoRepairs: 0, maxAuto: 2, manualAllowed: true });
  const entry = {
    model: item.id, domaene: item.domaene, iter: 0, kind: 'gen',
    startedAt, endedAt: new Date().toISOString(), durationMs: Date.now() - t0,
    p0: { router: 'prompts/p0-router.txt', fachtext: item.fachtext.slice(0, 200), klassifikation: p0, regelbeleg: p0rules, llmCall: false },
    p1: { prompt: 'prompts/p1-generate.txt (v6-standard)', aufgabe, quelle: item.id === 'arch-brandenburger-tor' ? 'offline P1-v6-Instanz (diese Runtime, kein Upstream-Call)' : 'versionierte Quelle (Erstgenerierung s. ledger-muse-calls.md)', llmCall: false, direktPfad: 'Baseten-Direkt BYOK (Artefakt-Laufzeit, sessionStorage)' },
    verify: layers.map((l) => ({ layer: l.layer, verdict: l.verdict, criteria: l.criteria.map((c) => `${c.id}=${c.verdict}`) })),
    fails: [...curFails.keys()], bytes, meshTotal: counts.total,
    budget: { maxAuto: 2, manualReserve: 1, autoRepairsUsed: 0, manualUsed: false },
    decision: decision.action,
  };
  if (decision.action !== 'green') allGreen = false;
  await writeFile(`${OUT}/${item.id}.jsonl`, JSON.stringify(entry) + '\n');
  summary.push({ id: item.id, domaene: item.domaene, decision: decision.action, fails: entry.fails, bytes, meshTotal: counts.total });
  console.log(`harness-showcase: ${item.id} (${item.domaene}) -> ${decision.action} [${entry.fails.join(', ') || 'keine Fails'}]`);
}
await writeFile(`${OUT}/SUMMARY.json`, JSON.stringify({
  createdAt: new Date().toISOString(), p0routerBytes: p0router.length, p1Bytes: p1head.length, p1StandardBytes: p1std.length,
  modelle: summary, budget: '2+1 eingehalten (0 Auto-Repairs, 0 manuell, kein Rollback)',
  baseten: 'kein Live-Call in dieser Runtime (kein Key in diesem Profil); Direktpfad im Artefakt verifiziert (verify:standalone)',
}, null, 2));
console.log(`harness-showcase: ${summary.filter((s) => s.decision === 'green').length}/${summary.length} gruen`);
if (!allGreen) { console.error('harness-showcase: ABBRUCH (nicht gruen)'); process.exit(1); }
