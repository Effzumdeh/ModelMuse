import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, Vector3, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Handbohrmaschine', category: 'hardware', detailLevel: 2, parts: ['Gehaeuse','Griff','Bohrfutter','Bohrer','Schalter','Lueftungsschlitze'], units: 'm' };
export const meta_i18n = { en: { title: 'Hand drill', parts: ['Housing','Handle','Chuck','Drill bit','Switch','Vents'] }, es: { title: 'Taladro manual', parts: ['Carcasa','Mango','Portabrocas','Broca','Interruptor','Rejillas de ventilación'] }, fr: { title: 'Perceuse manuelle', parts: ['Carter','Poignée','Mandrin','Foret','Interrupteur','Ouïes de ventilation'] } };
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
const camera = new PerspectiveCamera(45, w / h, 0.01, 50);
camera.position.set(0.5, 0.34, 0.58);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
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
key.position.set(0.8, 1.2, 0.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -0.5;
key.shadow.camera.right = 0.5;
key.shadow.camera['t'+'op'] = 0.5;
key.shadow.camera.bottom = -0.5;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 4;
key.shadow.bias = -0.0001;
key.shadow.normalBias = 0.002;
key.shadow.radius = 4;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.7, 0.35, -0.6);
scene.add(rim);
const acc = new PointLight(0xffd9a0, 0.12, 1.5, 2);
acc.position.set(0.1, -0.05, 0.25);
scene.add(acc);
const root = new Group();
scene.add(root);
const housingMat = new MeshStandardMaterial({ color: 0x1f6f4a, roughness: 0.45, metalness: 0.15 });
const darkMat = new MeshStandardMaterial({ color: 0x23262b, roughness: 0.8, metalness: 0.05 });
const rubberMat = new MeshStandardMaterial({ color: 0x15171a, roughness: 0.9, metalness: 0.0 });
const steelMat = new MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.28, metalness: 0.9 });
const chuckMat = new MeshStandardMaterial({ color: 0x6b7078, roughness: 0.35, metalness: 0.85 });
const accentMat = new MeshStandardMaterial({ color: 0xc23b22, roughness: 0.5, metalness: 0.1 });
function mk(geo, mat) {
const m = new Mesh(geo, mat);
m.castShadow = true;
m.receiveShadow = true;
return m;
}
const housing = mk(new CylinderGeometry(0.045, 0.048, 0.2, 32), housingMat);
housing.rotation.z = Math.PI / 2;
housing.position.set(-0.1, 0.06, 0);
root.add(housing);
const rear = mk(new SphereGeometry(0.048, 24, 16), darkMat);
rear.position.set(-0.2, 0.06, 0);
root.add(rear);
const neck = mk(new CylinderGeometry(0.03, 0.038, 0.05, 24), housingMat);
neck.rotation.z = Math.PI / 2;
neck.position.set(0.01, 0.06, 0);
root.add(neck);
const collar = mk(new CylinderGeometry(0.032, 0.032, 0.012, 24), rubberMat);
collar.rotation.z = Math.PI / 2;
collar.position.set(0.035, 0.06, 0);
root.add(collar);
const chuckBody = mk(new CylinderGeometry(0.024, 0.026, 0.035, 24), chuckMat);
chuckBody.rotation.z = Math.PI / 2;
chuckBody.position.set(0.058, 0.06, 0);
root.add(chuckBody);
const chuckNose = mk(new CylinderGeometry(0.015, 0.022, 0.025, 24), steelMat);
chuckNose.rotation.z = Math.PI / 2;
chuckNose.position.set(0.088, 0.06, 0);
root.add(chuckNose);
const bit = mk(new CylinderGeometry(0.004, 0.004, 0.13, 16), steelMat);
bit.rotation.z = Math.PI / 2;
bit.position.set(0.165, 0.06, 0);
root.add(bit);
const tip = mk(new CylinderGeometry(0.0008, 0.004, 0.018, 12), steelMat);
tip.rotation.z = -Math.PI / 2;
tip.position.set(0.239, 0.06, 0);
root.add(tip);
const grip = mk(new BoxGeometry(0.045, 0.14, 0.05), housingMat);
grip.position.set(-0.135, -0.03, 0);
grip.rotation.z = 0.18;
root.add(grip);
const gripPad = mk(new BoxGeometry(0.02, 0.1, 0.052), rubberMat);
gripPad.position.set(-0.152, -0.035, 0);
gripPad.rotation.z = 0.18;
root.add(gripPad);
const foot = mk(new BoxGeometry(0.1, 0.035, 0.065), darkMat);
foot.position.set(-0.155, -0.115, 0);
root.add(foot);
const shoe = mk(new BoxGeometry(0.102, 0.01, 0.067), rubberMat);
shoe.position.set(-0.155, -0.135, 0);
root.add(shoe);
const trigger = mk(new BoxGeometry(0.02, 0.032, 0.02), accentMat);
trigger.position.set(-0.08, 0.005, 0);
trigger.rotation.z = -0.15;
root.add(trigger);
const ventBase = mk(new BoxGeometry(0.07, 0.025, 0.002), rubberMat);
ventBase.position.set(-0.14, 0.075, 0.046);
root.add(ventBase);
const ventBase2 = mk(new BoxGeometry(0.07, 0.025, 0.002), rubberMat);
ventBase2.position.set(-0.14, 0.075, -0.046);
root.add(ventBase2);
const slats = [];
for (let i = 0; i < 4; i++) {
const s1 = mk(new BoxGeometry(0.008, 0.028, 0.004), darkMat);
s1.position.set(-0.165 + i * 0.017, 0.075, 0.046);
root.add(s1);
slats.push(s1);
const s2 = mk(new BoxGeometry(0.008, 0.028, 0.004), darkMat);
s2.position.set(-0.165 + i * 0.017, 0.075, -0.046);
root.add(s2);
slats.push(s2);
}
const brand = mk(new BoxGeometry(0.08, 0.014, 0.001), accentMat);
brand.position.set(-0.1, 0.06, 0.046);
root.add(brand);
// Negativ-Liste (Guide §2): Schatten nur auf Hauptbauteilen — duenne Dekor-/Lueftungsteile werfen keinen Schatten.
for (const tiny of [...slats, brand, ventBase, ventBase2]) { tiny.castShadow = false; }
const floorGeo = new CircleGeometry(0.55, 32);
const floorMat = new ShadowMaterial({ opacity: 0.55 });
const floor = new Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.17;
floor.receiveShadow = true;
scene.add(floor);
const labelHandles = [];
labelHandles.push(addLabel(root, 'Gehaeuse', [-0.1, 0.14, 0], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Griff', [-0.16, -0.03, 0.04], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Bohrfutter', [0.07, 0.12, 0], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Bohrer', [0.18, 0.015, 0], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Schalter', [-0.08, -0.03, 0.03], { id: 'l5', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Lueftungsschlitze', [-0.14, 0.115, 0.05], { id: 'l6', level: 'aufbau', sizePx: 16, leader: true }));
const measHandle = addMeasurement(root, [-0.2, -0.17, 0], [0.248, -0.17, 0], 'Laenge: 448 mm', { id: 'm1', level: 'aufbau', unit: 'mm' });
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
if (measHandle && typeof measHandle.setVisible === 'function') measHandle.setVisible(enM);
}
if (patch.view) {
if (patch.view === 'overview') { camera.position.set(0.5, 0.34, 0.58); controls.target.set(0, 0, 0); }
else if (patch.view === 'detail') { camera.position.set(0.22, 0.14, 0.3); controls.target.set(0.05, 0.06, 0); }
else if (patch.view === 'front') { camera.position.set(0.65, 0.08, 0.02); controls.target.set(0, 0, 0); }
else if (patch.view === 'top') { camera.position.set(0.0, 0.95, 0.02); controls.target.set(0, 0, 0); }
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
if (envRT) envRT.dispose();
renderer.dispose();
try { container.removeChild(renderer.domElement); } catch (e) {}
}
return { update, dispose };
}
