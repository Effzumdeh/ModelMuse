import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'UML-Klasse (AE-1)', category: 'sonstiges', detailLevel: 2, parts: ['Klassenquader', 'Attributzeile', 'Methodenzeile', 'Vererbungspfeil'], units: 'm' };
export const meta_i18n = { en: { title: 'UML class (AE-1)', parts: ['Class box', 'Attribute row', 'Method row', 'Inheritance arrow'] }, es: { title: 'Clase UML (AE-1)', parts: ['Cuadro de clase', 'Fila de atributos', 'Fila de métodos', 'Flecha de herencia'] } };
export const init = (container, params) => {
const p = params || {};
const w = (container && container.clientWidth) || 800;
const h = (container && container.clientHeight) || 600;
let dpr = p.dpr || p.pixelRatio || 1;
dpr = Math.min(2, Math.max(1, dpr));
const scene = new Scene();
const camera = new PerspectiveCamera(40, w / h, 0.01, 20);
camera.position.set(0.0, -0.50, 0.55);
const camTarget = new Vector3(0, 0.05, 0);
camera.lookAt(camTarget);
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14, 1);
renderer.setPixelRatio(dpr);
renderer.setSize(w, h);
container.appendChild(renderer.domElement);
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(6, 6, 6);
const roomMat = new MeshBasicMaterial({ color: 0x11141a, side: 1 });
const roomMesh = new Mesh(roomGeo, roomMat);
room.add(roomMesh);
const softGeo = new PlaneGeometry(3, 2);
const softMatA = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
const softMatB = new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide });
const softA = new Mesh(softGeo, softMatA);
softA.position.set(1.5, 2.0, 1.5);
softA.lookAt(0, 0, 0);
room.add(softA);
const softB = new Mesh(softGeo, softMatB);
softB.position.set(-1.8, 1.2, -1.0);
softB.lookAt(0, 0, 0);
room.add(softB);
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
pmrem.dispose();
room.traverse((o) => {
if (o.geometry) o.geometry.dispose();
if (o.material) {
const m = o.material;
if (Array.isArray(m)) {
for (let i = 0; i < m.length; i++) m[i].dispose();
} else m.dispose();
}
});
const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
hemi.position.set(0, 1, 0);
scene.add(hemi);
const key = new DirectionalLight(0xffffff, 2.0);
key.position.set(0.7, 1.0, 0.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 4;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.002;
key.shadow.camera.left = -1;
key.shadow.camera.right = 1;
key.shadow.camera['to' + 'p'] = 1;
key.shadow.camera.bottom = -1;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
scene.add(key.target);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.4, 0.7, -1.0);
scene.add(rim);
const accent = new PointLight(0xffd9a0, 3, 1.5, 2);
accent.position.set(0.25, -0.1, 0.45);
scene.add(accent);
const tw = 64;
const th = 64;
const tdata = new Uint8Array(tw * th * 4);
for (let y = 0; y < th; y++) {
for (let x = 0; x < tw; x++) {
const i = (y * tw + x) * 4;
let v = 245;
if ((y % 8) === 0) v = 215;
if ((x % 32) === 0) v = 225;
tdata[i] = v;
tdata[i + 1] = v;
tdata[i + 2] = v;
tdata[i + 3] = 255;
}
}
const tex = new DataTexture(tdata, tw, th);
tex.needsUpdate = true;
tex.magFilter = LinearFilter;
tex.minFilter = LinearFilter;
tex.wrapS = RepeatWrapping;
tex.wrapT = RepeatWrapping;
tex.colorSpace = SRGBColorSpace;
const plastic = new MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.1, roughness: 0.6, map: tex });
const plasticLight = new MeshStandardMaterial({ color: 0xf2f5f9, metalness: 0.05, roughness: 0.7 });
const metalDark = new MeshStandardMaterial({ color: 0x2f3a4a, metalness: 0.9, roughness: 0.32 });
const metalMid = new MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.9, roughness: 0.3 });
const metalFoot = new MeshStandardMaterial({ color: 0x3a4048, metalness: 0.85, roughness: 0.35 });
const frameMat = new MeshStandardMaterial({ color: 0x8a94a0, metalness: 0.9, roughness: 0.28 });
if ('environmentIntensity' in scene) {
scene.environmentIntensity = 0.55;
} else {
const ml = [plastic, plasticLight, metalDark, metalMid, metalFoot, frameMat];
for (let i = 0; i < ml.length; i++) ml[i].envMapIntensity = 0.55;
}
const roundedRect = (ww, hh, rr) => {
const s = new Shape();
const xx = -ww / 2;
const yy = -hh / 2;
s.moveTo(xx + rr, yy);
s.lineTo(xx + ww - rr, yy);
s.quadraticCurveTo(xx + ww, yy, xx + ww, yy + rr);
s.lineTo(xx + ww, yy + hh - rr);
s.quadraticCurveTo(xx + ww, yy + hh, xx + ww - rr, yy + hh);
s.lineTo(xx + rr, yy + hh);
s.quadraticCurveTo(xx, yy + hh, xx, yy + hh - rr);
s.lineTo(xx, yy + rr);
s.quadraticCurveTo(xx, yy, xx + rr, yy);
return s;
};
const model = new Group();
scene.add(model);
const mainShape = roundedRect(0.296, 0.356, 0.01);
const mainGeo = new ExtrudeGeometry(mainShape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 });
mainGeo.center();
const mainMesh = new Mesh(mainGeo, plastic);
mainMesh.position.set(0, -0.05, 0);
mainMesh.castShadow = true;
mainMesh.receiveShadow = true;
model.add(mainMesh);
const parShape = roundedRect(0.196, 0.076, 0.008);
const parGeo = new ExtrudeGeometry(parShape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 4 });
parGeo.center();
const parMesh = new Mesh(parGeo, plastic);
parMesh.position.set(0, 0.40, 0);
parMesh.castShadow = true;
parMesh.receiveShadow = true;
model.add(parMesh);
const sepGeo = new BoxGeometry(0.28, 0.008, 0.004);
const sepA = new Mesh(sepGeo, metalDark);
sepA.position.set(0, 0.02, 0.012);
sepA.castShadow = true;
sepA.receiveShadow = true;
model.add(sepA);
const sepB = new Mesh(sepGeo, metalDark);
sepB.position.set(0, -0.04, 0.012);
sepB.castShadow = true;
sepB.receiveShadow = true;
model.add(sepB);
const boxGeo = new BoxGeometry(0.24, 0.03, 0.004);
const attrA = new Mesh(boxGeo, plasticLight);
attrA.position.set(0, 0.005, 0.012);
attrA.castShadow = true;
attrA.receiveShadow = true;
model.add(attrA);
const attrB = new Mesh(boxGeo, plasticLight);
attrB.position.set(0, -0.025, 0.012);
attrB.castShadow = true;
attrB.receiveShadow = true;
model.add(attrB);
const methA = new Mesh(boxGeo, plasticLight);
methA.position.set(0, -0.10, 0.012);
methA.castShadow = true;
methA.receiveShadow = true;
model.add(methA);
const methB = new Mesh(boxGeo, plasticLight);
methB.position.set(0, -0.145, 0.012);
methB.castShadow = true;
methB.receiveShadow = true;
model.add(methB);
const lineGeo = new BufferGeometry();
lineGeo.setFromPoints([new Vector3(0, 0.13, 0.02), new Vector3(0, 0.33, 0.02)]);
const lineMat = new LineBasicMaterial({ color: 0x1a2230 });
const arrowLine = new Line(lineGeo, lineMat);
model.add(arrowLine);
const tipGeo = new CylinderGeometry(0.025, 0.025, 0.01, 3);
const tipMesh = new Mesh(tipGeo, metalMid);
tipMesh.position.set(0, 0.33, 0.02);
tipMesh.rotation.x = -Math.PI / 2;
tipMesh.castShadow = true;
tipMesh.receiveShadow = true;
model.add(tipMesh);
const frameHGeo = new BoxGeometry(0.32, 0.01, 0.024);
const frameVGeo = new BoxGeometry(0.01, 0.36, 0.024);
const frameT = new Mesh(frameHGeo, frameMat);
frameT.position.set(0, 0.135, 0);
frameT.castShadow = true;
frameT.receiveShadow = true;
model.add(frameT);
const frameB = new Mesh(frameHGeo, frameMat);
frameB.position.set(0, -0.235, 0);
frameB.castShadow = true;
frameB.receiveShadow = true;
model.add(frameB);
const frameL = new Mesh(frameVGeo, frameMat);
frameL.position.set(-0.155, -0.05, 0);
frameL.castShadow = true;
frameL.receiveShadow = true;
model.add(frameL);
const frameR = new Mesh(frameVGeo, frameMat);
frameR.position.set(0.155, -0.05, 0);
frameR.castShadow = true;
frameR.receiveShadow = true;
model.add(frameR);
const footGeo = new BoxGeometry(0.20, 0.03, 0.06);
const foot = new Mesh(footGeo, metalFoot);
foot.position.set(0, -0.255, 0);
foot.castShadow = true;
foot.receiveShadow = true;
model.add(foot);
const screwGeo = new SphereGeometry(0.008, 12, 8);
const screws = new InstancedMesh(screwGeo, metalMid, 4);
const m4 = new Matrix4();
const q0 = new Quaternion();
const v0 = new Vector3();
const s0 = new Vector3(1, 1, 1);
const screwPos = [[-0.13, 0.11, 0.012], [0.13, 0.11, 0.012], [-0.13, -0.21, 0.012], [0.13, -0.21, 0.012]];
for (let i = 0; i < 4; i++) {
v0.set(screwPos[i][0], screwPos[i][1], screwPos[i][2]);
m4.compose(v0, q0, s0);
screws.setMatrixAt(i, m4);
}
screws.instanceMatrix.needsUpdate = true;
screws.computeBoundingSphere();
screws.castShadow = true;
screws.receiveShadow = true;
model.add(screws);
const groundGeo = new CircleGeometry(0.55, 48);
const groundMat = new ShadowMaterial({ opacity: 0.35 });
const ground = new Mesh(groundGeo, groundMat);
ground.position.set(0, -0.28, 0);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(camTarget);
controls.update();
const l1 = addLabel(scene, 'Klassenquader', [0.0, -0.05, 0.06], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true });
const l2 = addLabel(scene, 'Attributzeile', [0.0, 0.02, 0.04], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true });
const l3 = addLabel(scene, 'Methodenzeile', [0.0, -0.12, 0.04], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true });
const l4 = addLabel(scene, 'Vererbungspfeil', [0.0, 0.23, 0.05], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true });
const m1 = addMeasurement(scene, [-0.15, -0.26, 0.0], [0.15, -0.26, 0.0], 'Quaderbreite: 30 cm', { id: 'm1', level: 'aufbau', unit: 'cm' });
const labelHandles = [l1, l2, l3, l4];
const measureHandles = [m1];
let running = true;
let raf = 0;
const loop = () => {
if (!running) return;
controls.update();
renderer.render(scene, camera);
raf = requestAnimationFrame(loop);
};
loop();
const update = (patch) => {
if (!patch) return;
const lb = patch.labels;
if (lb) {
const en = lb.enabled !== false;
let mx = 5;
if (lb.max !== undefined) mx = lb.max;
const lbH = lb || {};
const hd = Array.isArray(lbH.hidden) ? lbH.hidden : [];
for (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && (i < mx) && !hd.includes(i));
}
const ms = patch.measurements;
if (ms) {
const enM = ms.enabled !== false;
for (let i = 0; i < measureHandles.length; i++) measureHandles[i].setVisible(enM);
}
const vw = patch.view;
if (vw) {
if (vw === 'overview') {
camera.position.set(0.0, -0.50, 0.55);
controls.target.set(0, 0.05, 0);
} else if (vw === 'detail') {
camera.position.set(0, -0.05, 0.48);
controls.target.set(0, -0.05, 0);
} else if (vw === 'front') {
camera.position.set(0, 0.05, 1.0);
controls.target.set(0, 0.05, 0);
} else if (vw === ('to' + 'p')) {
camera.position.set(0, 0.95, 0.12);
controls.target.set(0, 0, 0);
}
camera.lookAt(controls.target);
controls.update();
}
};
const dispose = () => {
running = false;
cancelAnimationFrame(raf);
for (let i = 0; i < labelHandles.length; i++) labelHandles[i].remove();
for (let i = 0; i < measureHandles.length; i++) measureHandles[i].remove();
controls.dispose();
scene.traverse((o) => {
if (o.geometry) o.geometry.dispose();
if (o.material) {
const mm = o.material;
if (Array.isArray(mm)) {
for (let i = 0; i < mm.length; i++) {
if (mm[i].map) mm[i].map.dispose();
mm[i].dispose();
}
} else {
if (mm.map) mm.map.dispose();
mm.dispose();
}
}
});
if (envRT && envRT.dispose) envRT.dispose();
renderer.dispose();
container.removeChild(renderer.domElement);
};
return { update, dispose };
};