/** Baut prompts/gen-<id>-v4.txt: P1 v4.0 + angepasster Aufgaben-Anhang. */
import { readFile, writeFile } from 'node:fs/promises';

const P1V4 = (await readFile('prompts/p1-generate.txt', 'utf8')).trim();

const DETAILS = {
  'dup-1': 'Kleindetails (zusaetzlich, im Budget): je Tafel 4 Schrauben (SphereGeometry Radius 0,008 m) an den Ecken plus Sockelleiste (Box) unter jeder Tafel.',
  'dup-2': 'Kleindetails (zusaetzlich, im Budget): Sockelplatte (Box 0,12 m x 0,02 m x 0,12 m) unter jedem Symbol plus je 2 Schrauben (SphereGeometry Radius 0,006 m).',
  'dup-3': 'Kleindetails (zusaetzlich, im Budget): Deckelleiste auf jeder Box-Stufe, je 2 Schrauben (SphereGeometry Radius 0,007 m), Kabel als duenne Cylinder (Radius 0,006 m) zwischen den Stufen.',
  'ae-1': 'Kleindetails (zusaetzlich, im Budget): Rahmenleiste um die Tafel, 4 Schrauben (SphereGeometry Radius 0,008 m) an den Ecken, Sockelfuss (Box) unter der Tafel.',
  'ae-2': 'Kleindetails (zusaetzlich, im Budget): Grundplatte (Box) unter den Balken, Deckkappe auf jedem Balken, Achsenlinie an der Basis.',
  'ae-3': 'Kleindetails (zusaetzlich, im Budget): Standfuss plus Tastatur-Box beim Client, 3 Lueftungsschlitze (duenne Boxen) am Server, Sockelring (Cylinder) unter der Datenbank.',
};

const HELPER = "Helper-Syntax EXAKT positional (kein Objekt-Stil): addLabel(scene, 'Text', [x,y,z], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }) und addMeasurement(scene, [x0,y0,z0], [x1,y1,z1], 'Text: NN Einheit', { id: 'm1', level: 'aufbau', unit: 'cm' }).";

for (const id of Object.keys(DETAILS)) {
  const src = await readFile(`prompts/gen-${id}.txt`, 'utf8');
  const idx = src.indexOf('AUFGABEN-ANHANG');
  if (idx < 0) { console.error(`${id}: kein AUFGABEN-ANHANG gefunden`); process.exit(1); }
  let anhang = src.slice(idx);
  const rep1 = 'AmbientLight plus DirectionalLight,';
  if (!anhang.includes(rep1)) { console.error(`${id}: Licht-Anker fehlt`); process.exit(1); }
  anhang = anhang.replace(rep1, 'AmbientLight(0xffffff, 0,55) plus Key-DirectionalLight(0xffffff, 1,6, castShadow, shadow.mapSize 1024, Schattenkamera +-1 m) plus Fill-DirectionalLight(0xdfe8ff, 0,5) ohne Schatten,');
  const rep2 = 'WebGLRenderer({antialias:true, preserveDrawingBuffer:true}), setPixelRatio vor setSize, dpr aus params gedeckelt 1..2,';
  if (!anhang.includes(rep2)) { console.error(`${id}: Renderer-Anker fehlt`); process.exit(1); }
  anhang = anhang.replace(rep2, 'WebGLRenderer({antialias:true, preserveDrawingBuffer:true}), danach shadowMap.enabled true, shadowMap.type 2 (PCFSoft), toneMapping 4 (ACES), toneMappingExposure 1,1, setPixelRatio vor setSize, dpr aus params gedeckelt 1..2, Studio-Boden als duenne Box unter dem Modell (dunkel matt, roughness 0,95, receiveShadow), jedes Mesh castShadow und receiveShadow true (Linien ausgenommen),');
  const imp = 'Erlaubte Imports aus three';
  anhang = anhang.replace(imp, `${DETAILS[id]}\n${imp}`);
  const liefere = 'Liefere AUSSCHLIESSLICH';
  anhang = anhang.replace(liefere, `${HELPER}\n${liefere}`);
  const out = `${P1V4}\n\n${anhang}`;
  await writeFile(`prompts/gen-${id}-v4.txt`, out);
  console.log(`gen-${id}-v4.txt: ${Buffer.byteLength(out, 'utf8')} bytes`);
}
