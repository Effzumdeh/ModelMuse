import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, PlaneGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, DoubleSide, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, Vector3, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Brandenburger Tor (Berlin)', category: 'architektur', detailLevel: 2, parts: ['Säulenreihe','Gebälk','Attika','Quadriga','Mitteldurchfahrt','Seitenflügel'], units: 'm' };
export const meta_i18n = { en: { title: 'Brandenburg Gate (Berlin)', parts: ['Colonnade', 'Entablature', 'Attic', 'Quadriga', 'Central passage', 'Side wing'] }, es: { title: 'Puerta de Brandeburgo (Berlín)', parts: ['Columnata', 'Entablamento', 'Ático', 'Cuadriga', 'Paso central', 'Ala lateral'] } };
export function init(container, params){
const p = params || {};
let d = 1;
if(p.dpr){ d = p.dpr; }
d = Math.min(2, Math.max(1, d));
const reduced = !!p.reducedMotion;
const w = container.clientWidth || 800;
const h = container.clientHeight || 600;
const renderer = new WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(d);
renderer.setSize(w,h);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.setClearColor(0x0b0e14, 1);
container.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(45, w / h, 0.01, 50);
camera.position.set(1.5, 1.0, 1.8);
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
key.position.set(1.4, 2.0, 1.2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -0.9;
key.shadow.camera.right = 0.9;
key.shadow.camera['t'+'op'] = 0.9;
key.shadow.camera.bottom = -0.9;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 6;
key.shadow.bias = -0.0001;
key.shadow.normalBias = 0.002;
key.shadow.radius = 4;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-1.2, 0.6, -1.0);
scene.add(rim);
const acc = new PointLight(0xffd9a0, 0.12, 1.5, 2);
acc.position.set(0.2, -0.1, 0.5);
scene.add(acc);
const root = new Group();
scene.add(root);
const sandsteinMat = new MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.9, metalness: 0.0 });
const saeulenMat = new MeshStandardMaterial({ color: 0xe2d7bc, roughness: 0.85, metalness: 0.0 });
const bronzeMat = new MeshStandardMaterial({ color: 0x3f5a45, roughness: 0.5, metalness: 0.6 });
const dachMat = new MeshStandardMaterial({ color: 0x8a8578, roughness: 0.8, metalness: 0.05 });
function mk(geo, mat) {
const m = new Mesh(geo, mat);
m.castShadow = true;
m.receiveShadow = true;
return m;
}
const sockel = mk(new BoxGeometry(1.3, 0.04, 0.26), sandsteinMat);
sockel.position.set(0, -0.22, 0);
root.add(sockel);
const saeulenGeo = new BoxGeometry(0.035, 0.27, 0.035);
const saeulen = new InstancedMesh(saeulenGeo, saeulenMat, 12);
{
const m4 = new Matrix4();
const qt = new Quaternion();
const scl = new Vector3(1, 1, 1);
const xs = [-0.55, -0.35, -0.18, 0.18, 0.35, 0.55];
let k = 0;
for (let r = 0; r < 2; r++) {
const z = r === 0 ? 0.08 : -0.08;
for (let i = 0; i < xs.length; i++) {
const pos = new Vector3(xs[i], -0.065, z);
m4.compose(pos, qt, scl);
saeulen.setMatrixAt(k, m4);
k++;
}
}
saeulen.instanceMatrix.needsUpdate = true;
saeulen.computeBoundingSphere();
saeulen.castShadow = true;
saeulen.receiveShadow = true;
}
root.add(saeulen);
const wandGeo = new BoxGeometry(0.03, 0.27, 0.16);
const wandXs = [-0.45, -0.265, 0.265, 0.45];
for (let i = 0; i < wandXs.length; i++) {
const wand = mk(wandGeo, sandsteinMat);
wand.position.set(wandXs[i], -0.065, 0);
root.add(wand);
}
const gebaelk = mk(new BoxGeometry(1.3, 0.06, 0.26), sandsteinMat);
gebaelk.position.set(0, 0.10, 0);
root.add(gebaelk);
const attika = mk(new BoxGeometry(0.62, 0.08, 0.2), sandsteinMat);
attika.position.set(0, 0.17, 0);
root.add(attika);
const quadSockel = mk(new BoxGeometry(0.22, 0.03, 0.1), sandsteinMat);
quadSockel.position.set(0, 0.225, 0);
root.add(quadSockel);
const wagen = mk(new BoxGeometry(0.08, 0.05, 0.06), bronzeMat);
wagen.position.set(0, 0.265, -0.01);
root.add(wagen);
const victoria = mk(new BoxGeometry(0.03, 0.07, 0.03), bronzeMat);
victoria.position.set(0, 0.30, -0.01);
root.add(victoria);
const gespann = mk(new BoxGeometry(0.2, 0.045, 0.05), bronzeMat);
gespann.position.set(0, 0.26, 0.06);
root.add(gespann);
const fluegelL = mk(new BoxGeometry(0.16, 0.12, 0.2), sandsteinMat);
fluegelL.position.set(-0.75, -0.14, 0);
root.add(fluegelL);
const fluegelR = mk(new BoxGeometry(0.16, 0.12, 0.2), sandsteinMat);
fluegelR.position.set(0.75, -0.14, 0);
root.add(fluegelR);
const dachL = mk(new BoxGeometry(0.18, 0.02, 0.22), dachMat);
dachL.position.set(-0.75, -0.07, 0);
root.add(dachL);
const dachR = mk(new BoxGeometry(0.18, 0.02, 0.22), dachMat);
dachR.position.set(0.75, -0.07, 0);
root.add(dachR);
const floorGeo = new CircleGeometry(1.1, 32);
const floorMat = new ShadowMaterial({ opacity: 0.55 });
const floor = new Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.601, 0);
floor.receiveShadow = true;
scene.add(floor);
const labelHandles = [];
labelHandles.push(addLabel(root, 'Säulenreihe', [-0.55, -0.02, 0.12], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Gebälk', [0.30, 0.10, 0.16], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Attika', [0.15, 0.19, 0.14], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Quadriga', [0.0, 0.32, 0.12], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Mitteldurchfahrt', [0.0, -0.10, 0.12], { id: 'l5', level: 'aufbau', sizePx: 16, leader: true }));
labelHandles.push(addLabel(root, 'Seitenflügel', [0.75, -0.10, 0.12], { id: 'l6', level: 'aufbau', sizePx: 16, leader: true }));
const measHandles = [];
measHandles.push(addMeasurement(root, [-0.625, -0.3, 0.15], [0.625, -0.3, 0.15], 'Gesamtbreite: 62,5 m', { id: 'm1', level: 'aufbau', unit: 'm' }));
measHandles.push(addMeasurement(root, [-0.7, -0.22, 0.15], [-0.7, 0.21, 0.15], 'Torhöhe: 20,3 m', { id: 'm2', level: 'aufbau', unit: 'm' }));
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
let mx = 64;
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
for (let i = 0; i < measHandles.length; i++) {
const mh = measHandles[i];
if (mh && typeof mh.setVisible === 'function') mh.setVisible(enM);
}
}
if (patch.view) {
if (patch.view === 'overview') { camera.position.set(1.5, 1.0, 1.8); controls.target.set(0, 0, 0); }
else if (patch.view === 'detail') { camera.position.set(0.5, 0.35, 0.7); controls.target.set(0, 0.1, 0.1); }
else if (patch.view === 'front') { camera.position.set(0.0, 0.15, 2.4); controls.target.set(0, 0, 0); }
else if (patch.view === 'top') { camera.position.set(0.0, 2.6, 0.05); controls.target.set(0, 0, 0); }
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