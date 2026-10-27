/** Baut prompts/gen-<id>-v5real.txt: P1 v4.0 + REALISMUS-V5 (PMREM-Inline-Env, 4-Punkt-Licht,
 * 2048-Schatten, PBR, Bodenfaenger) + bestehender Aufgaben-Anhang (v4 bzw. v3->v4-hochgestuft).
 * Anker werden strikt geprueft; fehlt ein Anker -> Abbruch mit Dateiname.
 * Kein Key-Kontakt, keine Generierung — nur Prompt-Texte.
 */
import { readFile, writeFile } from 'node:fs/promises';

const FULL_IMPORTS = `Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial,
ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry,
TorusGeometry, AmbientLight, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial,
DoubleSide, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry,
PMREMGenerator.`;

// V3-Anker (si-2/si-3 Altdateien) -> V4-Licht (falls noch nicht hochgestuft)
const V3_LIGHT = 'AmbientLight plus DirectionalLight,';
const V4_LIGHT_SHORT =
  "AmbientLight(0xffffff, 0,55) plus Key-DirectionalLight(0xffffff, 1,6, castShadow, shadow.mapSize 1024, Schattenkamera +-1 m) plus Fill-DirectionalLight(0xdfe8ff, 0,5) ohne Schatten,";
const V3_RENDERER =
  'WebGLRenderer({antialias:true, preserveDrawingBuffer:true}), setPixelRatio vor setSize, dpr aus params gedeckelt 1..2,';
const V4_RENDERER =
  'WebGLRenderer({antialias:true, preserveDrawingBuffer:true}), danach shadowMap.enabled true, shadowMap.type 2 (PCFSoft), toneMapping 4 (ACES), toneMappingExposure 1,1, setPixelRatio vor setSize, dpr aus params gedeckelt 1..2, Studio-Boden als duenne Box unter dem Modell (dunkel matt, roughness 0,95, receiveShadow), jedes Mesh castShadow und receiveShadow true (Linien ausgenommen),';

// V5-Init-Ersatz (behaelt die modell-spezifische Kamera aus dem Anhang, ersetzt Licht/Renderer/Umgebung)
const V5_RENDER =
  'WebGLRenderer({antialias:true, preserveDrawingBuffer:true}) mit toneMapping ACESFilmicToneMapping, toneMappingExposure 1,1, outputColorSpace SRGB, shadowMap.enabled true, shadowMap.type PCFSoftShadowMap, klarer Farbe 0x0b0e14, setPixelRatio vor setSize, dpr aus params gedeckelt 1..2. ' +
  'Inline-Environment (Pflicht): PMREMGenerator(renderer) plus Mini-Raumszene aus 1 grossen Box (MeshBasicMaterial 0x11141a, Rueckseite) plus 2 hellen Softbox-Ebenen (MeshBasicMaterial 0xffffff und 0xcfe0ff, beidseitig); pmrem.fromScene(room, 0.04).texture auf scene.environment; scene.environmentIntensity falls verfuegbar 0.55, sonst envMapIntensity 0.55 je Standardmaterial; pmrem.dispose nach Erzeugung, envRT in dispose() freigeben. ' +
  'Lichter (genau 4): HemisphereLight(0xdfeaff, 0x1a1410, 0.35); Key-DirectionalLight(0xffffff, 2.0) diagonal von oben, castShadow true, shadow.mapSize 2048, Schattenkamera +-1 m, near 0.1 far 4, bias -0.0005, normalBias 0.002; Rim-DirectionalLight(0xbcd0ff, 0.7) von hinten ohne Schatten; PointLight(0xffd9a0, 3, 1.5, 2) als warmer Akzent im Vordergrund. ' +
  'Bodenschattenfaenger: EINE duenne Kreisflaeche (CircleGeometry r=0.55) unter dem Modell mit ShadowMaterial opacity 0.35, nur receiveShadow, sonst unsichtbar. ' +
  'Jedes Mesh castShadow und receiveShadow true (Linien und Bodenfaenger ausgenommen). Identische Bauteile teilen dieselbe Geometrie- und Materialinstanz. PBR materialgerecht (Metall metalness 0.8-1.0/roughness 0.25-0.4, Kunststoff metalness 0.0-0.2/roughness 0.5-0.8). ';

const VERBOT_V5 = `VERBOTENE Bezeichner (S1-Verbotsliste, Wortgrenzen): nutze niemals die Woerter document, window,
parent, top, fetch, eval, Function, navigator, localStorage, sessionStorage, indexedDB, sendBeacon,
WebSocket, XMLHttpRequest als Variablen, Properties oder Strings im Code. Also KEIN obj.parent,
KEIN .top, KEIN stop-Flag mit diesem Namen (nutze running/active). Nur
container (Parameter) und renderer.domElement anfassen.`;

const SI_DETAILS = {
  'si-2':
    'Kleindetails (zusaetzlich, im Budget): je Switch-Port 1 LED-Box (0,008 m), je Geraet 4 Schrauben (SphereGeometry Radius 0,006 m), Kabelstecker als kleine Boxen an beiden Kabelenden.',
  'si-3':
    'Kleindetails (zusaetzlich, im Budget): je Festplatteneinschub 1 LED-Box und 1 Griffleiste, je Geraet 4 Schrauben (SphereGeometry Radius 0,007 m), Lueftungsschlitze als 3 duenne Boxen am Server.',
};

const TARGETS = ['ae-1', 'ae-2', 'ae-3', 'dup-1', 'dup-2', 'dup-3', 'si-2', 'si-3'];

for (const id of TARGETS) {
  const v4path = `prompts/gen-${id}-v4.txt`;
  let text = null;
  try {
    text = await readFile(v4path, 'utf8');
    console.log(`${id}: Basis ${v4path}`);
  } catch {
    const v3 = await readFile(`prompts/gen-${id}.txt`, 'utf8');
    console.log(`${id}: Basis prompts/gen-${id}.txt (v3 -> v4-Hochstufung noetig)`);
    if (!v3.includes(V3_LIGHT) || !v3.includes(V3_RENDERER)) {
      console.error(`${id}: V3-Anker fehlen`);
      process.exit(1);
    }
    text = v3
      .replace(V3_LIGHT, V4_LIGHT_SHORT)
      .replace(V3_RENDERER, V4_RENDERER);
    if (SI_DETAILS[id]) {
      const imp = 'Erlaubte Imports aus three';
      if (!text.includes(imp)) {
        console.error(`${id}: Import-Anker fehlt`);
        process.exit(1);
      }
      text = text.replace(imp, `${SI_DETAILS[id]}\n${imp}`);
    }
    const p1v4 = (await readFile('prompts/p1-generate.txt', 'utf8')).trim();
    const idx = text.indexOf('AUFGABEN-ANHANG');
    if (idx < 0) {
      console.error(`${id}: kein AUFGABEN-ANHANG`);
      process.exit(1);
    }
    text = `${p1v4}\n\n${text.slice(idx)}`;
  }

  // 1. Importliste -> Vollliste (exakt ein Vorkommen pruefen)
  const oldImp =
    'Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial,';
  if (!text.includes(oldImp)) {
    console.error(`${id}: Import-Anker fehlt`);
    process.exit(1);
  }
  // Die zwei Folgezeilen der alten Liste ebenfalls ersetzen (Box..BufferGeometry.)
  const oldImpFull =
    /Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial,\nBoxGeometry, CylinderGeometry, SphereGeometry, AmbientLight, DirectionalLight, Line, LineBasicMaterial,\nDoubleSide, SRGBColorSpace, Vector3, BufferGeometry\./;
  if (!oldImpFull.test(text)) {
    console.error(`${id}: alte Importliste weicht ab`);
    process.exit(1);
  }
  text = text.replace(oldImpFull, FULL_IMPORTS);

  // 2. Licht+Renderer-Satz -> V5 (Kamera bleibt, da sie davor steht)
  if (!text.includes(V4_LIGHT_SHORT) || !text.includes(V4_RENDERER)) {
    console.error(`${id}: V4-Licht/Renderer-Anker fehlen`);
    process.exit(1);
  }
  text = text.replace(V4_LIGHT_SHORT, 'V5-Licht/Renderer/Umgebung siehe REALISMUS-V5 unten,');
  text = text.replace(V4_RENDERER, V5_RENDER);

  // 3. Altes Verboten-Kurzformat -> V5-Verbotsliste (falls vorhanden), sonst einfuegen
  const oldVerbRe =
    /Verboten im Modul: fetch, XMLHttpRequest, WebSocket, document, window, parent, top, localStorage, sessionStorage,\nindexedDB, sendBeacon, navigator, eval, Function, import\(, setTimeout\/setInterval mit String\.\nNur container \(Parameter\) und renderer\.domElement anfassen\. Kein Zugriff auf parent\/top\/opener\./;
  if (oldVerbRe.test(text)) {
    text = text.replace(oldVerbRe, VERBOT_V5);
  } else if (!text.includes('VERBOTENE Bezeichner')) {
    console.error(`${id}: Verbots-Anker fehlt`);
    process.exit(1);
  }

  // 3b. V4-REALISMUS-Absatz im Kopf -> V5-Zusammenfassung (kein Widerspruch zum Anhang)
  const v4RealRe =
    /REALISMUS \(verbindlich, v4\): .*?\{id,level,unit\}\)\.\n/;
  const v5Real =
    'REALISMUS-V5 (verbindlich, fotorealistisch, im Budget): 4-Punkt-Licht (Hemisphere plus Key mit PCFSoft-Schatten 2048 plus Rim plus warmer Point-Akzent), ACES-ToneMapping, SRGB, Antialiasing, PMREM-Inline-Environment aus Mini-Raumszene, PBR-Materialien, geteilte Geometrien, weiche Schatten auf Bodenkreis, je Bauteil 1-3 Kleindetails. Helper NUR positional: addLabel(scene,\'Text\',[x,y,z],{id,level,sizePx,leader}), addMeasurement(scene,[a],[b],\'Text: NN Einheit\',{id,level,unit}). Details siehe AUFGABEN-ANHANG.\n';
  if (!v4RealRe.test(text)) {
    console.error(`${id}: V4-REALISMUS-Anker fehlt`);
    process.exit(1);
  }
  text = text.replace(v4RealRe, v5Real);

  // 4. dispose-Satz um envRT erweitern
  text = text.replace(
    'dispose(): Animationsschleife stoppen, Geometrien/Materialien/Texturen traversieren und disposen, renderer.dispose,',
    'dispose(): Animationsschleife stoppen (running-Flag plus cancelAnimationFrame), controls.dispose, Szene traversieren: geometry.dispose, material.dispose (plus map falls vorhanden), envRT freigeben, renderer.dispose,'
  );

  // 5. Kopf: Versionshinweis
  text = text.replace(
    'P1 GENERIERUNGSPROMPT (verbindlich, Version 4.0)',
    'P1 GENERIERUNGSPROMPT (verbindlich, Version 4.0) + REALISMUS-V5 (fotorealistisch, verbindlich)'
  );

  await writeFile(`prompts/gen-${id}-v5real.txt`, text);
  console.log(`gen-${id}-v5real.txt: ${Buffer.byteLength(text, 'utf8')} bytes`);
}
console.log('V5-Prompts: alle 8 geschrieben');
