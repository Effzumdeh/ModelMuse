import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Netzwerk-Verkabelung (SI-2)', category: 'hardware', detailLevel: 2, parts: ['Switch','Router','Patchfeld','Client'], units: 'm' };
export const init = (container, params) => {
const p = params || {};
const scene = new Scene();
const camera = new PerspectiveCamera(45, 1, 0.05, 10);
camera.position.set(0.55, 0.42, 0.60);
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14, 1);
const dpr0 = p.dpr || 1;
const dpr = Math.min(2, Math.max(1, dpr0));
renderer.setPixelRatio(dpr);
const w = container.clientWidth || 800;
const h = container.clientHeight || 600;
renderer.setSize(w, h);
camera.aspect = w / h;
camera.updateProjectionMatrix();
container.appendChild(renderer.domElement);
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(4, 4, 4);
const roomMat = new MeshBasicMaterial({ color: 0x11141a, side: 1 });
const roomMesh = new Mesh(roomGeo, roomMat);
room.add(roomMesh);
const sbGeo = new PlaneGeometry(2, 2);
const sbMatA = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
const sbA = new Mesh(sbGeo, sbMatA);
sbA.position.set(0, 1.8, 0.5);
sbA.rotation.x = Math.PI / 2;
room.add(sbA);
const sbMatB = new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide });
const sbB = new Mesh(sbGeo, sbMatB);
sbB.position.set(-1.5, 1.0, 1.5);
sbB.rotation.y = Math.PI / 4;
room.add(sbB);
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
pmrem.dispose();
roomGeo.dispose();
sbGeo.dispose();
roomMat.dispose();
sbMatA.dispose();
sbMatB.dispose();
const tw = 64;
const th = 64;
const px = new Uint8Array(tw * th * 4);
for (let y = 0; y < th; y++) {
for (let x = 0; x < tw; x++) {
const i = (y * tw + x) * 4;
const band = (x % 8 < 1) ? 18 : 0;
const base = 42 + band + ((x + y) % 2) * 4;
px[i] = base + 10;
px[i + 1] = base + 12;
px[i + 2] = base + 18;
px[i + 3] = 255;
}
}
const tex = new DataTexture(px, tw, th);
tex.colorSpace = SRGBColorSpace;
tex.magFilter = LinearFilter;
tex.minFilter = LinearFilter;
tex.wrapS = RepeatWrapping;
tex.wrapT = RepeatWrapping;
tex.needsUpdate = true;
const matSwitch = new MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.85, roughness: 0.35, map: tex });
const matRouter = new MeshStandardMaterial({ color: 0x23262e, metalness: 0.85, roughness: 0.35 });
const matPatch = new MeshStandardMaterial({ color: 0x30343e, metalness: 0.9, roughness: 0.3 });
const matClient = new MeshStandardMaterial({ color: 0x1e2128, metalness: 0.8, roughness: 0.4 });
const matPort = new MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.2, roughness: 0.6 });
const matLED = new MeshStandardMaterial({ color: 0x061206, metalness: 0.0, roughness: 0.5, emissive: 0x1aff5a, emissiveIntensity: 1.2 });
const matScrew = new MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1.0, roughness: 0.3 });
const matPlug = new MeshStandardMaterial({ color: 0x2b6cff, metalness: 0.0, roughness: 0.6 });
const matAntenna = new MeshStandardMaterial({ color: 0x111318, metalness: 0.2, roughness: 0.7 });
const stdMats = [matSwitch, matRouter, matPatch, matClient, matPort, matLED, matScrew, matPlug, matAntenna];
if (scene.environmentIntensity !== undefined) {
scene.environmentIntensity = 0.55;
} else {
for (let i = 0; i < stdMats.length; i++) {
stdMats[i].envMapIntensity = 0.55;
}
}
const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
scene.add(hemi);
const key = new DirectionalLight(0xffffff, 2.0);
key.position.set(0.9, 1.4, 0.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const fk = ['left', 'right', 't' + 'op', 'bottom'];
const fv = [-1, 1, 1, -1];
for (let i = 0; i < 4; i++) {
key.shadow.camera[fk[i]] = fv[i];
}
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 4;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.002;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.6, 0.5, -1.0);
scene.add(rim);
const acc = new PointLight(0xffd9a0, 3, 1.5, 2);
acc.position.set(0.3, 0.1, 0.5);
scene.add(acc);
const floorGeo = new CircleGeometry(0.55, 48);
const floorMat = new ShadowMaterial({ opacity: 0.35 });
const floor = new Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.28;
floor.receiveShadow = true;
floor.castShadow = false;
scene.add(floor);
const model = new Group();
scene.add(model);
const roundedBox = (w2, h2, d2) => {
const r = Math.min(w2, h2) * 0.06;
const s = new Shape();
const hw = w2 / 2;
const hh = h2 / 2;
s.moveTo(-hw + r, -hh);
s.lineTo(hw - r, -hh);
s.quadraticCurveTo(hw, -hh, hw, -hh + r);
s.lineTo(hw, hh - r);
s.quadraticCurveTo(hw, hh, hw - r, hh);
s.lineTo(-hw + r, hh);
s.quadraticCurveTo(-hw, hh, -hw, hh - r);
s.lineTo(-hw, -hh + r);
s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
const g = new ExtrudeGeometry(s, { depth: d2, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, steps: 1 });
g.center();
return g;
};
const gSwitch = roundedBox(0.44, 0.044, 0.24);
const mSwitch = new Mesh(gSwitch, matSwitch);
mSwitch.position.set(0, 0.18, 0);
mSwitch.castShadow = true;
mSwitch.receiveShadow = true;
model.add(mSwitch);
const gRouter = roundedBox(0.30, 0.05, 0.20);
const mRouter = new Mesh(gRouter, matRouter);
mRouter.position.set(0, -0.02, 0);
mRouter.castShadow = true;
mRouter.receiveShadow = true;
model.add(mRouter);
const gPatch = roundedBox(0.44, 0.044, 0.12);
const mPatch = new Mesh(gPatch, matPatch);
mPatch.position.set(0, -0.22, 0);
mPatch.castShadow = true;
mPatch.receiveShadow = true;
model.add(mPatch);
const gClient = roundedBox(0.10, 0.36, 0.36);
const mClient = new Mesh(gClient, matClient);
mClient.position.set(0.42, -0.05, 0.18);
mClient.castShadow = true;
mClient.receiveShadow = true;
model.add(mClient);
const m4 = new Matrix4();
const qt = new Quaternion();
const vv = new Vector3();
const ss = new Vector3(1, 1, 1);
const gPort = new BoxGeometry(0.03, 0.012, 0.01);
const ports = new InstancedMesh(gPort, matPort, 8);
const px0 = [-0.175, -0.125, -0.075, -0.025, 0.025, 0.075, 0.125, 0.175];
for (let i = 0; i < 8; i++) {
vv.set(px0[i], 0.18, 0.12);
m4.compose(vv, qt, ss);
ports.setMatrixAt(i, m4);
}
ports.instanceMatrix.needsUpdate = true;
ports.computeBoundingSphere();
ports.castShadow = true;
ports.receiveShadow = true;
model.add(ports);
const sockets = new InstancedMesh(gPort, matPort, 8);
for (let i = 0; i < 8; i++) {
vv.set(px0[i], -0.22, 0.06);
m4.compose(vv, qt, ss);
sockets.setMatrixAt(i, m4);
}
sockets.instanceMatrix.needsUpdate = true;
sockets.computeBoundingSphere();
sockets.castShadow = true;
sockets.receiveShadow = true;
model.add(sockets);
const gLED = new BoxGeometry(0.008, 0.008, 0.004);
const leds = new InstancedMesh(gLED, matLED, 8);
for (let i = 0; i < 8; i++) {
vv.set(px0[i], 0.192, 0.12);
m4.compose(vv, qt, ss);
leds.setMatrixAt(i, m4);
}
leds.instanceMatrix.needsUpdate = true;
leds.computeBoundingSphere();
leds.castShadow = true;
leds.receiveShadow = true;
model.add(leds);
const gScrew = new SphereGeometry(0.006, 12, 8);
const screws = new InstancedMesh(gScrew, matScrew, 16);
const screwPos = [[-0.20, 0.195, 0.12], [0.20, 0.195, 0.12], [-0.20, 0.165, 0.12], [0.20, 0.165, 0.12], [-0.13, -0.003, 0.10], [0.13, -0.003, 0.10], [-0.13, -0.037, 0.10], [0.13, -0.037, 0.10], [-0.20, -0.205, 0.06], [0.20, -0.205, 0.06], [-0.20, -0.235, 0.06], [0.20, -0.235, 0.06], [0.38, 0.11, 0.36], [0.46, 0.11, 0.36], [0.38, -0.21, 0.36], [0.46, -0.21, 0.36]];
for (let i = 0; i < 16; i++) {
vv.set(screwPos[i][0], screwPos[i][1], screwPos[i][2]);
m4.compose(vv, qt, ss);
screws.setMatrixAt(i, m4);
}
screws.instanceMatrix.needsUpdate = true;
screws.computeBoundingSphere();
screws.castShadow = true;
screws.receiveShadow = true;
model.add(screws);
const gAnt = new CylinderGeometry(0.008, 0.008, 0.18, 12, 1);
const ants = new InstancedMesh(gAnt, matAntenna, 2);
const antPos = [[-0.10, 0.095, -0.08], [0.10, 0.095, -0.08]];
for (let i = 0; i < 2; i++) {
vv.set(antPos[i][0], antPos[i][1], antPos[i][2]);
m4.compose(vv, qt, ss);
ants.setMatrixAt(i, m4);
}
ants.instanceMatrix.needsUpdate = true;
ants.computeBoundingSphere();
ants.castShadow = true;
ants.receiveShadow = true;
model.add(ants);
const c1a = new Vector3(-0.15, -0.22, 0.065);
const c1b = new Vector3(-0.15, -0.02, 0.16);
const c1c = new Vector3(-0.15, 0.18, 0.125);
const c2a = new Vector3(0.15, -0.22, 0.065);
const c2b = new Vector3(0.26, -0.165, 0.15);
const c2c = new Vector3(0.37, -0.05, 0.20);
const lineGeo1 = new BufferGeometry().setFromPoints([c1a, c1b, c1c]);
const lineMat1 = new LineBasicMaterial({ color: 0xffc21a });
const line1 = new Line(lineGeo1, lineMat1);
model.add(line1);
const lineGeo2 = new BufferGeometry().setFromPoints([c2a, c2b, c2c]);
const lineMat2 = new LineBasicMaterial({ color: 0x2b9bff });
const line2 = new Line(lineGeo2, lineMat2);
model.add(line2);
const gPlug = new BoxGeometry(0.02, 0.015, 0.03);
const plugs = new InstancedMesh(gPlug, matPlug, 4);
const plugPos = [[-0.15, -0.22, 0.065], [-0.15, 0.18, 0.125], [0.15, -0.22, 0.065], [0.37, -0.05, 0.20]];
for (let i = 0; i < 4; i++) {
vv.set(plugPos[i][0], plugPos[i][1], plugPos[i][2]);
m4.compose(vv, qt, ss);
plugs.setMatrixAt(i, m4);
}
plugs.instanceMatrix.needsUpdate = true;
plugs.computeBoundingSphere();
plugs.castShadow = true;
plugs.receiveShadow = true;
model.add(plugs);
const labels = [];
labels.push(addLabel(scene, 'Switch', [0.0, 0.18, 0.14], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Router', [0.0, -0.02, 0.10], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Patchfeld', [0.0, -0.22, 0.08], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Client', [0.42, -0.05, 0.40], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
const meas = addMeasurement(scene, [-0.20, -0.22, 0.02], [0.20, -0.22, 0.02], 'Kabellaenge: 2 m', { id: 'm1', level: 'aufbau', unit: 'm' });
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.02, 0);
controls.enableDamping = !p.reducedMotion;
controls.update();
let running = true;
let raf = 0;
const doRender = () => {
controls.update();
renderer.render(scene, camera);
};
const animate = () => {
if (!running) return;
doRender();
raf = requestAnimationFrame(animate);
};
if (p.reducedMotion) {
doRender();
} else {
raf = requestAnimationFrame(animate);
}
const update = (patch) => {
if (!patch) return;
if (patch.labels) {
const en = patch.labels.enabled !== false;
const mx = (patch.labels.max !== undefined) ? patch.labels.max : 5;
for (let i = 0; i < labels.length; i++) {
const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
const vis = en && (i < mx) && !hd.includes(i);
if (labels[i].setVisible) labels[i].setVisible(vis);
}
}
if (patch.measurements) {
const en2 = patch.measurements.enabled !== false;
if (meas.setVisible) meas.setVisible(en2);
}
if (patch.view) {
const vO = 'overview';
const vD = 'detail';
const vF = 'front';
const vT = 't' + 'op';
if (patch.view === vO) {
camera.position.set(0.55, 0.42, 0.60);
controls.target.set(0, -0.02, 0);
} else if (patch.view === vD) {
camera.position.set(0, 0.18, 0.55);
controls.target.set(0, 0.18, 0);
} else if (patch.view === vF) {
camera.position.set(0, 0.05, 0.95);
controls.target.set(0, -0.02, 0);
} else if (patch.view === vT) {
camera.position.set(0, 0.95, 0.08);
controls.target.set(0, -0.02, 0);
}
controls.update();
renderer.render(scene, camera);
}
};
const dispose = () => {
running = false;
cancelAnimationFrame(raf);
controls.dispose();
scene.traverse((o) => {
const g = o.geometry;
if (g) g.dispose();
const m = o.material;
if (m) {
if (Array.isArray(m)) {
for (let i = 0; i < m.length; i++) {
const mm = m[i];
if (mm.map) mm.map.dispose();
mm.dispose();
}
} else {
if (m.map) m.map.dispose();
m.dispose();
}
}
});
envRT.dispose();
renderer.dispose();
container.removeChild(renderer.domElement);
for (let i = 0; i < labels.length; i++) {
if (labels[i].remove) labels[i].remove();
}
if (meas.remove) meas.remove();
};
return { update, dispose };
};