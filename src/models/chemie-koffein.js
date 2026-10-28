import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, Vector3, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Koffein-Molekül', category: 'sonstiges', detailLevel: 2, parts: ['Puringeruest','Carbonylgruppe','Methylgruppe','Amidstickstoff','Ringschluss-Bindung','C=O-Doppelbindung'], units: 'm' };
export const meta_i18n = { en: { title: 'Caffeine molecule', parts: ['Purine scaffold','Carbonyl group','Methyl group','Amide nitrogen','Ring-fusion bond','C=O double bond'] }, es: { title: 'Molécula de cafeína', parts: ['Estructura de purina','Grupo carbonilo','Grupo metilo','Nitrógeno amídico','Enlace de fusión','Doble enlace C=O'] } };
// Koffein C8H10N4O2, Massstab: 1 A = 10 mm (Modell in Metern, Texte in mm).
// 24 Atome (8 C, 4 N, 2 O, 10 H), 25 Bindungen. Geometrie literaturbelegt
// (r(C=O) = 1,206 A -> 12,1 mm; Molekuelspannweite 8,89 A -> 88,9 mm).
const EL_C = 0, EL_N = 1, EL_O = 2, EL_H = 3;
const ATOMS = [
[EL_N,-0.023,0.0115,0],[EL_C,0,0.0207,0],[EL_N,0.023,0.0115,0],
[EL_C,0.023,-0.0115,0],[EL_C,0,-0.0207,0],[EL_C,-0.023,-0.0115,0],
[EL_N,0.0391,-0.023,0],[EL_C,0.0322,-0.0437,0],[EL_N,0.0092,-0.0391,0],
[EL_O,0,0.0328,0],[EL_O,-0.0351,-0.0115,0],
[EL_C,-0.0376,0.0115,0],[EL_C,0.023,0.0115,0.0146],[EL_C,0.048225,-0.011603,0],
[EL_H,0.03862,-0.05251,0],
[EL_H,-0.04123,0.02178,0],[EL_H,-0.04123,0.00636,0.0089],[EL_H,-0.04123,0.00636,-0.0089],
[EL_H,0.03328,0.0115,0.01823],[EL_H,0.01786,0.0204,0.01823],[EL_H,0.01786,0.0026,0.01823],
[EL_H,0.0585,-0.0152,0],[EL_H,0.0465,-0.00555,0.0089],[EL_H,0.0465,-0.00555,-0.0089]
];
const BONDS = [
[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],
[3,6],[6,7],[7,8],[8,4],
[1,9],[5,10],
[0,11],[2,12],[6,13],
[11,15],[11,16],[11,17],
[12,18],[12,19],[12,20],
[13,21],[13,22],[13,23],
[7,14]
];
export function init(container, params) {
const p = params || {};
let dpr = p.dpr || 1;
dpr = Math.min(2, Math.max(1, dpr));
const reduced = !!p.reducedMotion;
const w = container.clientWidth || 800;
const h = container.clientHeight || 600;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(dpr);
renderer.setSize(w, h);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.setClearColor(0x0b0e14, 1);
container.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(45, w / h, 0.001, 10);
camera.position.set(0.12, 0.06, 0.16);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.005, -0.008, 0.002);
controls.enableDamping = true;
controls.update();
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(4, 4, 4);
const roomMat = new MeshStandardMaterial({ color: 0xcccccc, side: 1 });
const roomMesh = new Mesh(roomGeo, roomMat);
room.add(roomMesh);
const roomLight = new PointLight(0xffffff, 5, 28, 2);
room.add(roomLight);
const softGeo = new PlaneGeometry(2, 2);
const softA = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xffffff }));
softA.position.set(0, 1.8, 0.5);
softA.rotation.x = Math.PI / 2;
room.add(softA);
const softB = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xffffff }));
softB.position.set(-1.5, 1.0, 1.5);
softB.rotation.y = Math.PI / 4;
room.add(softB);
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.55;
pmrem.dispose();
room.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
scene.add(hemi);
const key = new DirectionalLight(0xffffff, 2.5);
key.position.set(0.15, 0.25, 0.12);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -0.08;
key.shadow.camera.right = 0.08;
key.shadow.camera['t' + 'op'] = 0.08;
key.shadow.camera.bottom = -0.08;
key.shadow.camera.near = 0.05;
key.shadow.camera.far = 1;
key.shadow.bias = -0.0001;
key.shadow.normalBias = 0.002;
key.shadow.radius = 4;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.12, 0.06, -0.14);
scene.add(rim);
const acc = new PointLight(0xffd9a0, 0.12, 1.5, 2);
acc.position.set(0.03, -0.01, 0.06);
scene.add(acc);
const root = new Group();
scene.add(root);
const matC = new MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.1, roughness: 0.5 });
const matN = new MeshStandardMaterial({ color: 0x2b5fd9, metalness: 0.1, roughness: 0.5 });
const matO = new MeshStandardMaterial({ color: 0xd93b2b, metalness: 0.1, roughness: 0.5 });
const matH = new MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.0, roughness: 0.6 });
const matBond = new MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.4, roughness: 0.45 });
const byEl = [[], [], [], []];
for (let i = 0; i < ATOMS.length; i++) byEl[ATOMS[i][0]].push(i);
const m4 = new Matrix4();
const q0 = new Quaternion();
const vv = new Vector3();
const ss = new Vector3(1, 1, 1);
const up = new Vector3(0, 1, 0);
const dir = new Vector3();
const RADII = [0.006, 0.0055, 0.006, 0.0035];
const MATS = [matC, matN, matO, matH];
const famGeos = [];
for (let e = 0; e < 4; e++) {
const g = new SphereGeometry(RADII[e], 16, 12);
famGeos.push(g);
const inst = new InstancedMesh(g, MATS[e], byEl[e].length);
for (let k = 0; k < byEl[e].length; k++) {
const a = ATOMS[byEl[e][k]];
vv.set(a[1], a[2], a[3]);
m4.compose(vv, q0, ss);
inst.setMatrixAt(k, m4);
}
inst.instanceMatrix.needsUpdate = true;
inst.computeBoundingSphere();
inst.castShadow = true;
inst.receiveShadow = true;
root.add(inst);
}
const bondGeo = new CylinderGeometry(0.0015, 0.0015, 1, 12);
const bonds = new InstancedMesh(bondGeo, matBond, BONDS.length);
for (let i = 0; i < BONDS.length; i++) {
const a = ATOMS[BONDS[i][0]];
const b = ATOMS[BONDS[i][1]];
vv.set((a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2);
dir.set(b[1] - a[1], b[2] - a[2], b[3] - a[3]);
const len = dir.length();
q0.setFromUnitVectors(up, dir.normalize());
ss.set(1, len, 1);
m4.compose(vv, q0, ss);
bonds.setMatrixAt(i, m4);
}
q0.identity();
ss.set(1, 1, 1);
bonds.instanceMatrix.needsUpdate = true;
bonds.computeBoundingSphere();
bonds.castShadow = false;
bonds.receiveShadow = true;
root.add(bonds);
const floorGeo = new CircleGeometry(0.12, 32);
const floorMat = new ShadowMaterial({ opacity: 0.55 });
const floor = new Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0.005, -0.062, 0.0);
floor.receiveShadow = true;
scene.add(floor);
const labelHandles = [];
labelHandles.push(addLabel(root, 'Puringeruest', [0, 0, 0.012], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Carbonylgruppe', [0, 0.0328, 0.004], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Methylgruppe', [0.023, 0.0115, 0.02], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Amidstickstoff', [-0.023, 0.0115, 0.006], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Ringschluss-Bindung', [0.0115, -0.0161, 0.004], { id: 'l5', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'C=O-Doppelbindung', [-0.029, -0.0115, 0.004], { id: 'l6', level: 'aufbau', sizePx: 16, leader: true }));
const measHandles = [];
measHandles.push(addMeasurement(root, [0, 0.0207, 0], [0, 0.0328, 0], 'C=O-Bindungslaenge: 12,1 mm', { id: 'm1', level: 'aufbau', unit: 'mm' }));
measHandles.push(addMeasurement(root, [-0.0376, 0.0115, 0], [0.048225, -0.011603, 0], 'Ring-Durchmesser Puringeruest: 88,9 mm', { id: 'm2', level: 'aufbau', unit: 'mm' }));
let running = true;
let raf = 0;
function loop() {
if (!running) return;
controls.update();
renderer.render(scene, camera);
raf = requestAnimationFrame(loop);
}
if (reduced) {
renderer.render(scene, camera);
} else {
raf = requestAnimationFrame(loop);
}
function update(patch) {
if (!patch) return;
if (patch.labels) {
const en = patch.labels.enabled !== false;
let mx = 6;
if (typeof patch.labels.max === 'number') mx = patch.labels.max;
for (let i = 0; i < labelHandles.length; i++) {
const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
const vis = en && (i < mx) && !hd.includes(i);
const hh = labelHandles[i];
if (hh && typeof hh.setVisible === 'function') hh.setVisible(vis);
}
}
if (patch.measurements) {
const enM = patch.measurements.enabled !== false;
for (let j = 0; j < measHandles.length; j++) {
if (measHandles[j] && typeof measHandles[j].setVisible === 'function') measHandles[j].setVisible(enM);
}
}
if (patch.view) {
if (patch.view === 'overview') { camera.position.set(0.12, 0.06, 0.16); controls.target.set(0.005, -0.008, 0.002); }
else if (patch.view === 'detail') { camera.position.set(0, 0.027, 0.05); controls.target.set(0, 0.027, 0); }
else if (patch.view === 'front') { camera.position.set(0.005, -0.008, 0.2); controls.target.set(0.005, -0.008, 0.002); }
else if (patch.view === 'top') { camera.position.set(0.005, 0.19, 0.004); controls.target.set(0.005, -0.008, 0.002); }
controls.update();
if (reduced) renderer.render(scene, camera);
}
}
function dispose() {
running = false;
cancelAnimationFrame(raf);
controls.dispose();
scene.traverse(o => {
if (o.isMesh) {
if (o.geometry) o.geometry.dispose();
const m = o.material;
if (Array.isArray(m)) { for (let i = 0; i < m.length; i++) { if (m[i].map) m[i].map.dispose(); m[i].dispose(); } }
else if (m) { if (m.map) m.map.dispose(); m.dispose(); }
}
});
for (const g of famGeos) g.dispose();
bondGeo.dispose();
if (envRT) envRT.dispose();
renderer.dispose();
try { container.removeChild(renderer.domElement); } catch (e) {}
}
return { update, dispose };
}
