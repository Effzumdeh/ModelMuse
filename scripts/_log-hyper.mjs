import { readFile, writeFile } from 'node:fs/promises';
const p = 'dist/generation-log.json';
const log = JSON.parse(await readFile(p, 'utf8'));
const MUSE = 'C:/Users/flori/AppData/Local/Programs/muse/muse.exe';
const calls = [
  {
    zweck: 'P1-HYPER gpu-example v3 (Iteration 1 von max 3, HYPERREALISMUS-V3: Extrude-Bevel, 4 DataTextures, 17 InstancedMesh, Skills threejs-materials/lighting/geometry/textures/postprocessing aus CloudAI-X/threejs-skills)',
    befehl: MUSE + ' exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file prompts/gen-gpu-v3hyper.txt (via scripts/_gen-one.mjs)',
    promptBytes: 10942,
    startUtc: '2026-10-26T22:37:15.786Z',
    endeUtc: '2026-10-26T22:43:59.288Z',
    dauerS: 404,
    output: 'dist/gpu-v3hyper.raw.txt',
    outputBytes: 20599,
    exit: 0,
    befund: 'vollstaendiges Hyper-Modul (20598 Bytes, S1-vorab hits=0): Extrude-PCB/Backplate mit Bevel, 4 DataTextures (PCB-Traces, Die-Aetzung, Naben-Ringe, Buerstmetall), 17 InstancedMesh (72 VRAM-Pins, 24 Finnen, 22 PCIe-Pads, Schrauben), 2x9 Rotorblaetter mit Pitch; KRITISCH: addMeasurement-Signatur vertauscht (Text an 2. Stelle) -> S2-wirksam, P2 noetig',
  },
  {
    zweck: 'P2-Repair gpu-example HYPER (Iteration 2 von max 3)',
    befehl: MUSE + ' exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file dist/repair-gpu-hyper-01.prompt.txt (via scripts/_gen-one.mjs)',
    promptBytes: 23342,
    startUtc: '2026-10-26T22:45:15.892Z',
    endeUtc: '2026-10-26T22:47:35.616Z',
    dauerS: 140,
    output: 'dist/gpu-v3hyper-r1.raw.txt',
    outputBytes: 20772,
    exit: 0,
    befund: 'chirurgisch: 2x addMeasurement-Reihenfolge korrigiert, RepeatWrapping-Import + 4 Wraps, shadow-camera.top ergaenzt; NEU: 1 S1-Hit (Token top in .top-Zugriff)',
  },
  {
    zweck: 'P2-Repair gpu-example HYPER (Iteration 3 von max 3)',
    befehl: MUSE + ' exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file dist/repair-gpu-hyper-02.prompt.txt (via scripts/_gen-one.mjs)',
    promptBytes: 22146,
    startUtc: '2026-10-26T22:47:59.790Z',
    endeUtc: '2026-10-26T22:49:02.360Z',
    dauerS: 63,
    output: 'dist/gpu-v3hyper-r2.raw.txt',
    outputBytes: 20837,
    exit: 0,
    befund: 'chirurgisch: Frustum-Schleife ueber String-Literale (S1-sicher), Rest byteidentisch (diff-geprueft); S1: hits=0 green ok; eingebaut als src/models/gpu-example.js (20836 Bytes); Player-E-S2-BOOT: DataTexture fehlt in vendor-entry -> Infra-Fix A-3 (kein Modell-Call)',
  },
  {
    zweck: 'P2-Repair gpu-example HYPER (3. Fix-Iteration, Aufgabenlimit max 3 Fix-Iterationen damit ausgeschoepft)',
    befehl: MUSE + ' exec --model muse-spark-1.3-contributor --api-key-stdin --prompt-file dist/repair-gpu-hyper-03.prompt.txt (via scripts/_gen-one.mjs)',
    promptBytes: 22891,
    startUtc: '2026-10-26T22:55:17.747Z',
    endeUtc: '2026-10-26T22:56:48.447Z',
    dauerS: 91,
    output: 'dist/gpu-v3hyper-r3.raw.txt',
    outputBytes: 20893,
    exit: 0,
    befund: 'chirurgisch (diff: exakt 4 Zeilen): Textur-Repeat (pcb 12,6 / brush 10,10), Bodenschatten 0.55, Key 3.0, Exposure 1.25; S1: hits=0 green ok; eingebaut (20892 Bytes); Screenshot-Urteil: kein Flat-Look, aber stilisiert/CAD-artig, NICHT fotonah -> STOPP, kein Rollout',
  },
];
for (const c of calls) log.calls.push(c);
log.hyperV3 = 'gpu-example HYPER (Teil 2, 2026-10-27): P1 + 3 P2-Fixes (alle muse-spark-1.3-contributor, exit 0, kein 429; Aufgabenlimit max 3 Fix-Iterationen ausgeschoepft). Modul 20892 Bytes, S1+S5 pass, S2 pass (gelb), Budgets tri 10144/calls 117 (calls nahe 120!). Urteil: sichtbarer Realismus-Level ueber v2, aber NICHT fotonah (SwiftShader/720p/Uebersicht loesen Sub-mm-Details nicht auf) -> STOPP nach Schritt 2, kein si-1-Rollout.';
log.abweichungA3 = 'A-3 (2026-10-27, Hyperrealismus Teil 2): three.entry.js max 560->700 (8 weitere benannte three-Imports: InstancedMesh, ExtrudeGeometry, Shape, DataTexture, LinearFilter, RepeatWrapping, Matrix4, Quaternion; S2-BOOT-Fix). Vendor-Bundle 574043->606219, Artefakt 884105 < 1500000 Komfort. Entscheidung im Teil-2-Report offengelegt.';
await writeFile(p, JSON.stringify(log, null, 2) + '\n');
console.log('calls: ' + log.calls.length);
