/** Baut Hyper-Prompts v6-BUDGET400 aus v5real (bzw. si-1-v2):
 * - Budget 400/300, Modul 34000, Tris 60000
 * - Import-Allowlist auf Hyper-Superset (inkl. Line fuer DuP/AE)
 * - HYPER-UPGRADE-Block (Extrude/DataTexture/InstancedMesh, S1-sicher)
 * Kein Key-Kontakt, nur Prompt-Texte.
 */
import { readFile, writeFile } from 'node:fs/promises';

const HYPER_IMPORTS = `Erlaubte Imports aus three (ABSCHLIESSEND, exakt diese Namen, keine anderen):
Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial,
ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry,
TorusGeometry, ExtrudeGeometry, Shape, DataTexture, AmbientLight, DirectionalLight, HemisphereLight, PointLight,
Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping,
PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator.
Zusaetzlich genau ein Addon-Import erlaubt:
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
Erlaubte Imports aus wrapper-helpers (ABSCHLIESSEND):
import { addLabel, addMeasurement } from 'wrapper-helpers';
Farben nur als Hexzahlen (kein Color-Import). Keine weiteren Imports, keine URLs, kein dynamischer Import.`;

const HYPER_UPGRADE = `HYPER-UPGRADE (verbindlich, im Budget 400, aus .claude/skills threejs-materials/lighting/geometry/textures):
- Sichtbare Szene NUR MeshStandardMaterial (PBR metalness/roughness je Werkstoff, KEIN MeshBasicMaterial an sichtbaren Meshes). MeshBasicMaterial NUR in der verworfenen PMREM-Raumszene.
- Kanten mit Fase wo sinnvoll: Gehaeuse/Boxen/Tafeln als ExtrudeGeometry mit bevel (abgerundetes Rechteck-Shape, bevelThickness/bevelSize klein, 1 Segment) statt scharfer Box, wo es die Bauteilform hergibt.
- Prozedurale Feintexturen NUR via DataTexture (rohe Uint8-Pixel, KEIN document/canvas — document ist S1-verboten); klein (max 128x128), LinearFilter, als map wo sinnvoll (z.B. Leiterbahnen, Aetzung, Buerstmetall, Typenschilder); Farb-Maps mit colorSpace SRGBColorSpace und magFilter LinearFilter.
- Wiederholteile als EIN InstancedMesh je Teilefamilie (Schrauben, Ports, LEDs, Lamellen, Pins, Pads); Platzierung via Matrix4/Quaternion/Vector3 direkt mit setMatrixAt (KEIN Object3D-Dummy, KEIN setColorAt ohne Color-Import); danach instanceMatrix.needsUpdate = true, computeBoundingSphere().
- KEIN Postprocessing (Budget/Determinismus SwiftShader-Baselines S3).
- VERBOTENE Bezeichner (S1, Wortgrenzen): nutze niemals document, window, parent, top, fetch, eval, Function, navigator, localStorage, sessionStorage, indexedDB, sendBeacon, WebSocket, XMLHttpRequest als Variablen/Properties/Strings. Also KEIN obj.parent, KEIN .top, KEIN stop-Flag mit diesem Namen (nutze running/active), KEIN desktop/ontop. Nur container und renderer.domElement anfassen. Frustum-Grenzen per Schleife ueber String-Literale (z.B. const frustumKeys = ['left','right','top','bottom']).`;

const BASE = {
  'si-1': 'prompts/gen-si-1-v2.txt',
  'si-2': 'prompts/gen-si-2-v5real.txt',
  'si-3': 'prompts/gen-si-3-v5real.txt',
  'dup-1': 'prompts/gen-dup-1-v5real.txt',
  'dup-2': 'prompts/gen-dup-2-v5real.txt',
  'dup-3': 'prompts/gen-dup-3-v5real.txt',
  'ae-1': 'prompts/gen-ae-1-v5real.txt',
  'ae-2': 'prompts/gen-ae-2-v5real.txt',
  'ae-3': 'prompts/gen-ae-3-v5real.txt',
};

for (const [id, basePath] of Object.entries(BASE)) {
  let text = await readFile(basePath, 'utf8');
  // Header -> v6
  text = text.replace(/P1 GENERIERUNGSPROMPT \(verbindlich, Version [^\)]+\)[^\n]*/, 'P1 GENERIERUNGSPROMPT (verbindlich, Version 6.0-HYPER-BUDGET400) + HYPERREALISMUS-Block');
  // Budget-Zeilen (beide Varianten)
  text = text.replace(/Du h[aä]ltst Dreiecke unter 150000 \(grün bis 120000\) und Draw-Calls unter 120 \(grün bis 90\)\./, 'Du haeltst Dreiecke unter 60000 und Draw-Calls unter 350 (gruen bis 300, NACHTRAG 2026-10-27, hart 400) exklusive Helper-Handles.');
  text = text.replace(/Du h[aä]ltst Dreiecke unter 150000 und Draw-Calls unter 120\./, 'Du haeltst Dreiecke unter 60000 und Draw-Calls unter 350 (gruen bis 300, NACHTRAG 2026-10-27, hart 400) exklusive Helper-Handles.');
  text = text.replace(/Du haeltst Dreiecke unter 60000 und Draw-Calls \(Meshes\) unter 65 exklusive Helper-Handles\./, 'Du haeltst Dreiecke unter 60000 und Draw-Calls unter 350 (gruen bis 300, NACHTRAG 2026-10-27, hart 400) exklusive Helper-Handles.');
  text = text.replace(/Du haeltst Dreiecke unter 60000 und Draw-Calls \(Meshes \+ InstancedMesh\) unter 65 exklusive Helper-Handles\./, 'Du haeltst Dreiecke unter 60000 und Draw-Calls unter 350 (gruen bis 300, NACHTRAG 2026-10-27, hart 400) exklusive Helper-Handles.');
  // Modulgroesse -> 34000 Hyper-Maximum
  text = text.replace(/Du h[aä]ltst die Modulgr[öo][ßs]e unter 1,5 MB Komfort und niemals über 2,0 MB hart\./, 'Du haeltst die Moduldatei unter 34000 Bytes (hart, Hyper-Maximum je Lab).');
  text = text.replace(/Du haeltst die Moduldatei unter 30000 Bytes\./, 'Du haeltst die Moduldatei unter 34000 Bytes (hart, Hyper-Maximum je Lab).');
  // Imports ersetzen: von "Erlaubte Imports aus three" bis "kein dynamischer Import."
  const impRe = /Erlaubte Imports aus three[\s\S]*?kein dynamischer Import\./;
  if (!impRe.test(text)) { console.error(id + ': Import-Anker fehlt'); process.exit(1); }
  text = text.replace(impRe, HYPER_IMPORTS);
  // HYPER-UPGRADE nach REALISMUS-Zeile bzw. nach Modulgrößen-Zeile einfuegen (einmalig)
  if (!text.includes('HYPER-UPGRADE')) {
    const anchor = 'Du haeltst die Moduldatei unter 34000 Bytes (hart, Hyper-Maximum je Lab).';
    if (!text.includes(anchor)) { console.error(id + ': Modul-Anker fehlt'); process.exit(1); }
    text = text.replace(anchor, anchor + '\n' + HYPER_UPGRADE);
  }
  // Modell-ID-Zeile auf contributor vereinheitlichen (falls v3 ohne suffix)
  if (!text.includes('muse-spark-1.3-contributor')) text += '\nModell-ID: muse-spark-1.3-contributor.';
  const out = `prompts/gen-${id}-v6hyper400.txt`;
  await writeFile(out, text);
  console.log(id + ': ' + out + ' ' + Buffer.byteLength(text, 'utf8') + ' bytes');
}
