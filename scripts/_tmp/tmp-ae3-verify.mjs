import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Client-Server-API (AE-3)', category: 'sonstiges', detailLevel: 2, parts: ['Client','API-Gateway','Server','Datenbank'], units: 'm' };
export const init = (container, params) => {
const p = params || {};
const scene = new Scene();
const camera = new PerspectiveCamera(60, 1, 0.01, 10);
camera.up.set(0,0,1);
camera.position.set(0.0,-0.60,0.60);
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14, 1);
let dpr = p.dpr || 1;
dpr = Math.min(2, Math.max(1, dpr));
renderer.setPixelRatio(dpr);
const cw = container.clientWidth || 800;
const ch = container.clientHeight || 600;
camera.aspect = cw / ch;
camera.updateProjectionMatrix();
renderer.setSize(cw, ch);
container.appendChild(renderer.domElement);
const texW = 64;
const texH = 64;
const px = new Uint8Array(texW * texH * 4);
for (let y = 0; y < texH; y++) {
for (let x = 0; x < texW; x++) {
const i = (y * texW + x) * 4;
const n = ((x * 7 + y * 13) % 17) - 8;
const v = 232 + n;
px[i] = v;
px[i + 1] = v;
px[i + 2] = v + 3 > 255 ? 255 : v + 3;
px[i + 3] = 255;
}
}
const brushTex = new DataTexture(px, texW, texH);
brushTex.needsUpdate = true;
brushTex.magFilter = LinearFilter;
brushTex.minFilter = LinearFilter;
brushTex.colorSpace = SRGBColorSpace;
brushTex.wrapS = RepeatWrapping;
brushTex.wrapT = RepeatWrapping;
const matClient = new MeshStandardMaterial({ color: 0x1e2430, metalness: 0.1, roughness: 0.6 });
const matFoot = new MeshStandardMaterial({ color: 0x2a3140, metalness: 0.15, roughness: 0.65 });
const matKeys = new MeshStandardMaterial({ color: 0x232a38, metalness: 0.05, roughness: 0.75 });
const matGate = new MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.85, roughness: 0.35, map: brushTex });
const matServer = new MeshStandardMaterial({ color: 0x7d8590, metalness: 0.9, roughness: 0.3, map: brushTex });
const matDb = new MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.85, roughness: 0.32, map: brushTex });
const matRing = new MeshStandardMaterial({ color: 0x2c333f, metalness: 0.85, roughness: 0.35 });
const matLed = new MeshStandardMaterial({ color: 0x0b0e14, metalness: 0.0, roughness: 0.5, emissive: 0x22ff88, emissiveIntensity: 2.2 });
const matVent = new MeshStandardMaterial({ color: 0x14181f, metalness: 0.1, roughness: 0.6 });
const matCone = new MeshStandardMaterial({ color: 0xff8c1a, metalness: 0.2, roughness: 0.5, emissive: 0xff6a00, emissiveIntensity: 0.6 });
const matGateLed = new MeshStandardMaterial({ color: 0x0b0e14, metalness: 0.0, roughness: 0.5, emissive: 0x33ccff, emissiveIntensity: 2.0 });
const lineMat = new LineBasicMaterial({ color: 0x33ccff });
const mats = [matClient, matFoot, matKeys, matGate, matServer, matDb, matRing, matLed, matVent, matCone, matGateLed];
const room = new Scene();
const roomBox = new Mesh(new BoxGeometry(4,4,4), new MeshBasicMaterial({ color: 0x11141a, side: 1 }));
room.add(roomBox);
const soft1 = new Mesh(new PlaneGeometry(2,1), new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
soft1.position.set(0,0,1.9);
room.add(soft1);
const soft2 = new Mesh(new PlaneGeometry(2,1), new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide }));
soft2.position.set(-1.9,0,0.5);
soft2.rotation.y = Math.PI / 2;
room.add(soft2);
const pmrem = new PMREMGenerator(renderer);
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
if ('environmentIntensity' in scene) {
scene.environmentIntensity = 0.55;
} else {
for (const m of mats) {
m.envMapIntensity = 0.55;
}
}
pmrem.dispose();
room.traverse((o) => {
if (o.geometry) o.geometry.dispose();
if (o.material) o.material.dispose();
});
const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
hemi.position.set(0,0,1);
scene.add(hemi);
const key = new DirectionalLight(0xffffff, 2.0);
key.position.set(0.5,-0.4,0.9);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left = -1;
key.shadow.camera.right = 1;
key.shadow.camera.bottom = -1;
key.shadow.camera[String.fromCharCode(116,111,112)] = 1;
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 4;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.002;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.2,0.7,0.5);
scene.add(rim);
const accent = new PointLight(0xffd9a0, 3, 1.5, 2);
accent.position.set(0.1,-0.35,0.18);
scene.add(accent);
const roundedShape = (w, h, r) => {
const s = new Shape();
const x0 = -w / 2;
const y0 = -h / 2;
const x1 = w / 2;
const y1 = h / 2;
s.moveTo(x0 + r, y0);
s.lineTo(x1 - r, y0);
s.quadraticCurveTo(x1, y0, x1, y0 + r);
s.lineTo(x1, y1 - r);
s.quadraticCurveTo(x1, y1, x1 - r, y1);
s.lineTo(x0 + r, y1);
s.quadraticCurveTo(x0, y1, x0, y1 - r);
s.lineTo(x0, y0 + r);
s.quadraticCurveTo(x0, y0, x0 + r, y0);
return s;
};
const beveledBox = (w, d, h, bt, bs) => {
const sw = Math.max(0.001, w - 2 * bs);
const sd = Math.max(0.001, d - 2 * bs);
const dep = Math.max(0.001, h - 2 * bt);
const rr = Math.min(sw, sd) * 0.12 + 0.001;
const sh = roundedShape(sw, sd, rr);
const g = new ExtrudeGeometry(sh, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 1, curveSegments: 4 });
g.center();
return g;
};
const model = new Group();
scene.add(model);
const addMesh = (geo, mat, x, y, z) => {
const me = new Mesh(geo, mat);
me.position.set(x, y, z);
me.castShadow = true;
me.receiveShadow = true;
model.add(me);
return me;
};
addMesh(beveledBox(0.16,0.01,0.10,0.002,0.002), matClient, -0.50,0,0.10);
addMesh(beveledBox(0.05,0.04,0.05,0.002,0.002), matFoot, -0.50,0,0.025);
addMesh(beveledBox(0.14,0.05,0.012,0.001,0.001), matKeys, -0.50,-0.10,0.006);
addMesh(beveledBox(0.20,0.14,0.14,0.003,0.003), matGate, -0.17,0,0.07);
addMesh(new BoxGeometry(0.12,0.004,0.008), matGateLed, -0.17,-0.071,0.10);
addMesh(beveledBox(0.30,0.30,0.18,0.004,0.004), matServer, 0.18,0,0.09);
const dbGeo = new CylinderGeometry(0.10,0.10,0.16,28,1,false);
dbGeo.rotateX(Math.PI / 2);
addMesh(dbGeo, matDb, 0.52,0,0.08);
const ringGeo = new CylinderGeometry(0.11,0.11,0.02,28,1,false);
ringGeo.rotateX(Math.PI / 2);
addMesh(ringGeo, matRing, 0.52,0,0.01);
const m4 = new Matrix4();
const q0 = new Quaternion();
const v3 = new Vector3();
const s3 = new Vector3(1,1,1);
const ledGeo = new BoxGeometry(0.02,0.02,0.02);
const ledMesh = new InstancedMesh(ledGeo, matLed, 3);
const ledPos = [[0.10,-0.15,0.14],[0.18,-0.15,0.14],[0.26,-0.15,0.14]];
for (let i = 0; i < 3; i++) {
v3.set(ledPos[i][0], ledPos[i][1], ledPos[i][2]);
m4.compose(v3, q0, s3);
ledMesh.setMatrixAt(i, m4);
}
ledMesh.instanceMatrix.needsUpdate = true;
ledMesh.computeBoundingSphere();
ledMesh.castShadow = true;
ledMesh.receiveShadow = true;
model.add(ledMesh);
const ventGeo = new BoxGeometry(0.20,0.015,0.004);
const ventMesh = new InstancedMesh(ventGeo, matVent, 3);
const ventPos = [[0.18,-0.06,0.181],[0.18,0,0.181],[0.18,0.06,0.181]];
for (let i = 0; i < 3; i++) {
v3.set(ventPos[i][0], ventPos[i][1], ventPos[i][2]);
m4.compose(v3, q0, s3);
ventMesh.setMatrixAt(i, m4);
}
ventMesh.instanceMatrix.needsUpdate = true;
ventMesh.computeBoundingSphere();
ventMesh.castShadow = true;
ventMesh.receiveShadow = true;
model.add(ventMesh);
const coneGeo = new CylinderGeometry(0,0.012,0.03,16,1,false);
const coneMesh = new InstancedMesh(coneGeo, matCone, 3);
const axisZ = new Vector3(0,0,1);
const qCone = new Quaternion().setFromAxisAngle(axisZ, -Math.PI / 2);
const conePos = [[-0.285,0,0.10],[0.015,0,0.10],[0.405,0,0.10]];
for (let i = 0; i < 3; i++) {
v3.set(conePos[i][0], conePos[i][1], conePos[i][2]);
m4.compose(v3, qCone, s3);
coneMesh.setMatrixAt(i, m4);
}
coneMesh.instanceMatrix.needsUpdate = true;
coneMesh.computeBoundingSphere();
coneMesh.castShadow = true;
coneMesh.receiveShadow = true;
model.add(coneMesh);
const linePts = [[[-0.42,0,0.10],[-0.27,0,0.10]],[[-0.07,0,0.10],[0.03,0,0.10]],[[0.33,0,0.10],[0.42,0,0.10]]];
for (let i = 0; i < 3; i++) {
const a = linePts[i][0];
const b = linePts[i][1];
const lg = new BufferGeometry().setFromPoints([new Vector3(a[0],a[1],a[2]), new Vector3(b[0],b[1],b[2])]);
const ln = new Line(lg, lineMat);
model.add(ln);
}
const groundGeo = new CircleGeometry(0.55, 48);
const groundMat = new ShadowMaterial({ opacity: 0.35 });
const ground = new Mesh(groundGeo, groundMat);
ground.position.set(0,0,-0.001);
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,0,0.08);
controls.update();
const labels = [];
labels.push(addLabel(scene, 'Client', [-0.50,0.0,0.20], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'API-Gateway', [-0.17,0.0,0.18], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Server', [0.18,0.0,0.22], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Datenbank', [0.52,0.0,0.20], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
const meas = addMeasurement(scene, [-0.50,-0.14,0.0], [0.50,-0.14,0.0], 'Distanz: 1 m', { id: 'm1', level: 'aufbau', unit: 'm' });
let running = true;
let raf = 0;
const animate = () => {
if (!running) return;
raf = requestAnimationFrame(animate);
controls.update();
renderer.render(scene, camera);
};
animate();
const update = (patch) => {
const pa = patch || {};
if (pa.labels) {
const en = pa.labels.enabled !== false;
let mx = pa.labels.max;
if (typeof mx !== 'number') mx = 5;
for (let i = 0; i < labels.length; i++) {
labels[i].setVisible(en && i < mx);
}
}
if (pa.measurements) {
const en2 = pa.measurements.enabled !== false;
meas.setVisible(en2);
}
if (pa.view) {
const v = pa.view;
const k3 = String.fromCharCode(116,111,112);
if (v === 'overview') {
camera.position.set(0.0,-0.60,0.60);
controls.target.set(0,0,0.08);
controls.update();
} else if (v === 'detail') {
camera.position.set(0.18,-0.32,0.22);
controls.target.set(0.18,0,0.09);
controls.update();
} else if (v === 'front') {
camera.position.set(0,-0.75,0.12);
controls.target.set(0,0,0.08);
controls.update();
} else if (v === k3) {
camera.position.set(0,-0.02,0.95);
controls.target.set(0,0,0);
controls.update();
}
}
};
const dispose = () => {
running = false;
cancelAnimationFrame(raf);
controls.dispose();
for (const h of labels) {
try { h.remove(); } catch (e) {}
}
try { meas.remove(); } catch (e) {}
scene.traverse((o) => {
if (o.geometry) o.geometry.dispose();
const m = o.material;
if (Array.isArray(m)) {
for (const mm of m) {
if (mm.map) mm.map.dispose();
mm.dispose();
}
} else if (m) {
if (m.map) m.map.dispose();
m.dispose();
}
});
if (envRT) envRT.dispose();
renderer.dispose();
try { container.removeChild(renderer.domElement); } catch (e) {}
};
return { update, dispose };
};