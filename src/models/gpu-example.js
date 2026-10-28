import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, TorusGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, Vector3, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Graphics Card', category: 'hardware', detailLevel: 2, parts: ['PCB','GPU-Die','VRAM 1','VRAM 2','Luefter 1','Luefter 2','Heatpipe','Backplate','PCIe-x16-Stecker','Stromanschluss','Slotblende'], units: 'm' };
export const meta_i18n = { en: { title: 'Graphics card', parts: ['GPU die', 'VRAM 1', 'VRAM 2', 'Fan 1', 'Fan 2', 'Heat pipe', 'Backplate', 'PCIe x16 connector', 'Power connector', 'Slot bracket with display ports'] }, es: { title: 'Tarjeta gráfica', parts: ['GPU', 'VRAM 1', 'VRAM 2', 'Ventilador 1', 'Ventilador 2', 'Tubo de calor', 'Placa trasera', 'Conector PCIe x16', 'Conector de alimentación', 'Chapa del slot con puertos de pantalla'] } };
export function init(container, params) {
params = params || {};
let dpr = params.dpr || 1;
dpr = Math.min(2, Math.max(1, dpr));
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
const camera = new PerspectiveCamera(40, w / h, 0.01, 10);
camera.position.set(0.34, 0.26, 0.38);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, -0.005, 0);
controls.enableDamping = true;
controls.update();
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(2, 2, 2);
const roomMat = new MeshStandardMaterial({ color: 0xcccccc, side: 1 });
const roomMesh = new Mesh(roomGeo, roomMat);
room.add(roomMesh);
const roomLight = new PointLight(0xffffff, 5, 28, 2); // auf 2-m-Raum skaliert (Referenz-Bestrahlungsstaerke wie RoomEnvironment; 900 gilt nur im 30-m-Raum)
room.add(roomLight);
const softGeo = new PlaneGeometry(1, 0.5);
const soft1 = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
soft1.position.set(0, 0.9, 0.2);
soft1.rotation.x = 1.5708;
room.add(soft1);
const soft2 = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide }));
soft2.position.set(-0.6, 0.4, -0.5);
soft2.rotation.y = 0.6;
room.add(soft2);
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.55;
pmrem.dispose();
roomGeo.dispose();
softGeo.dispose();
roomMat.dispose();
soft1.material.dispose();
soft2.material.dispose();
const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
scene.add(hemi);
const key = new DirectionalLight(0xffffff, 2.5);
key.position.set(0.5, 0.8, 0.6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
const frustumKeys = ['left', 'right', 'top', 'bottom'];
const frustumVals = [-0.3, 0.3, 0.3, -0.3];
for (let fi = 0; fi < 4; fi++) { key.shadow.camera[frustumKeys[fi]] = frustumVals[fi]; }
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 3;
key.shadow.bias = -0.0001;
key.shadow.normalBias = 0.002;
key.shadow.radius = 4;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff, 0.7);
rim.position.set(-0.6, 0.3, -0.5);
scene.add(rim);
const acc = new PointLight(0xffd9a0, 0.12, 1.5, 2);
acc.position.set(0.1, -0.05, 0.25);
scene.add(acc);
function makeTex(ww, hh, fn) {
const d = new Uint8Array(ww * hh * 4);
for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) {
const i = (y * ww + x) * 4;
const c = fn(x, y);
d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2]; d[i+3] = 255;
}
const t = new DataTexture(d, ww, hh);
t.needsUpdate = true;
t.colorSpace = SRGBColorSpace;
t.magFilter = LinearFilter;
t.minFilter = LinearFilter;
return t;
}
const pcbTex = makeTex(128, 64, (x, y) => {
if (x % 32 < 3 && y % 24 < 3) return [180, 200, 220];
if (x % 16 === 0 || y % 12 === 0) return [70, 110, 150];
if ((x + y) % 32 === 0) return [50, 80, 120];
return [20, 34, 62];
});
const dieTex = makeTex(64, 64, (x, y) => {
if ((x > 8 && x < 56 && y > 8 && y < 11) || (x > 8 && x < 56 && y > 20 && y < 23)) return [170, 180, 190];
if ((x > 8 && x < 11 && y > 8 && y < 23) || (x > 53 && x < 56 && y > 8 && y < 23)) return [170, 180, 190];
if (y >= 44 && y < 48 && x > 10 && x < 54 && x % 4 < 2) return [150, 160, 170];
return [18, 20, 26];
});
const fanTex = makeTex(64, 64, (x, y) => {
const dx = x - 32, dy = y - 32;
const r = Math.sqrt(dx * dx + dy * dy);
if (r > 30) return [20, 22, 26];
if (x > 22 && x < 42 && y > 28 && y < 36) return [0, 150, 220];
if (Math.floor(r) % 6 === 0) return [200, 205, 215];
if (r < 8) return [240, 242, 246];
return [30, 34, 40];
});
const brushTex = makeTex(128, 128, (x, y) => {
const v = y % 4 === 0 ? 185 : 150 + (x + y) % 7;
return [v, v + 3, v + 6];
});
pcbTex.wrapS = RepeatWrapping; pcbTex.wrapT = RepeatWrapping; brushTex.wrapS = RepeatWrapping; brushTex.wrapT = RepeatWrapping;
brushTex.colorSpace = SRGBColorSpace;
pcbTex.repeat.set(12, 6); brushTex.repeat.set(10, 10);
function M(o) { return new MeshStandardMaterial(o); }
const pcbMat = M({ map: pcbTex, metalness: 0.15, roughness: 0.65 });
const capMat = M({ color: 0x1a1d22, metalness: 0.5, roughness: 0.4 });
const coilMat = M({ color: 0x2a2d33, metalness: 0.6, roughness: 0.4 });
const subMat = M({ color: 0x0d5c2e, metalness: 0.1, roughness: 0.6 });
const dieMat = M({ map: dieTex, metalness: 1.0, roughness: 0.15 });
const goldMat = M({ color: 0xd4af37, metalness: 1.0, roughness: 0.3 });
const vramMat = M({ color: 0x0a0c10, metalness: 0.4, roughness: 0.45 });
const markMat = M({ color: 0xe8ecf2, metalness: 0.2, roughness: 0.5 });
const silvMat = M({ color: 0xc0c6d0, metalness: 1.0, roughness: 0.3 });
const fanFrmMat = M({ color: 0x14161a, metalness: 0.3, roughness: 0.5 });
const bladeMat = M({ color: 0x2e3238, metalness: 0.6, roughness: 0.35, side: DoubleSide });
const fanLabMat = M({ map: fanTex, metalness: 0.2, roughness: 0.5 });
const screwMat = M({ color: 0x9aa2ad, metalness: 1.0, roughness: 0.3 });
const copMat = M({ color: 0xb87333, metalness: 1.0, roughness: 0.28 });
const nickMat = M({ color: 0xd8dee6, metalness: 1.0, roughness: 0.2 });
const aluMat = M({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.4 });
const backMat = M({ map: brushTex, metalness: 0.85, roughness: 0.38 });
const stripeMat = M({ color: 0x1a73e8, metalness: 0.6, roughness: 0.4 });
const darkMat = M({ color: 0x0a0c10, metalness: 0.2, roughness: 0.7 });
const whiteMat = M({ color: 0xf2f4f6, metalness: 0.05, roughness: 0.6 });
const steelMat = M({ color: 0xb8bec6, metalness: 0.95, roughness: 0.3 });
const frameMat = M({ color: 0xd0d6de, metalness: 1.0, roughness: 0.25 });
const _m = new Matrix4(), _q = new Quaternion(), _q2 = new Quaternion(), _v = new Vector3(), _s = new Vector3(1, 1, 1), _ax = new Vector3(0, 0, 1), _axX = new Vector3(1, 0, 0);
function setP(im, i, x, y, z, ax, ang) {
if (ax === 1) _q.setFromAxisAngle(_axX, ang);
else if (ax === 3) _q.setFromAxisAngle(_ax, ang);
else _q.identity();
_v.set(x, y, z);
_s.set(1, 1, 1);
_m.compose(_v, _q, _s);
im.setMatrixAt(i, _m);
}
function setS(im, i, x, y, z, sx, sy, sz) {
_q.identity();
_v.set(x, y, z);
_s.set(sx, sy, sz);
_m.compose(_v, _q, _s);
im.setMatrixAt(i, _m);
_s.set(1, 1, 1);
}
const card = new Group();
scene.add(card);
function rr(w2, h2, r) {
const s = new Shape();
const x0 = -w2 / 2, y0 = -h2 / 2;
s.moveTo(x0 + r, y0);
s.lineTo(x0 + w2 - r, y0);
s.absarc(x0 + w2 - r, y0 + r, r, -Math.PI / 2, 0, false);
s.lineTo(x0 + w2, y0 + h2 - r);
s.absarc(x0 + w2 - r, y0 + h2 - r, r, 0, Math.PI / 2, false);
s.lineTo(x0 + r, y0 + h2);
s.absarc(x0 + r, y0 + h2 - r, r, Math.PI / 2, Math.PI, false);
s.lineTo(x0, y0 + r);
s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
return s;
}
function mesh(geo, mat, x, y, z) {
const o = new Mesh(geo, mat);
o.position.set(x, y, z);
card.add(o);
return o;
}
const pcbGeo = new ExtrudeGeometry(rr(0.267, 0.11, 0.004), { depth: 0.0016, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 1, curveSegments: 4 });
pcbGeo.translate(0, 0, -0.0008);
mesh(pcbGeo, pcbMat, 0, 0, 0);
const capGeo = new CylinderGeometry(0.0015, 0.0015, 0.003, 10);
const caps = new InstancedMesh(capGeo, capMat, 4);
setP(caps, 0, 0.06, 0.04, 0.003, 1, Math.PI / 2);
setP(caps, 1, 0.07, 0.04, 0.003, 1, Math.PI / 2);
setP(caps, 2, 0.09, 0.04, 0.003, 1, Math.PI / 2);
setP(caps, 3, 0.10, 0.04, 0.003, 1, Math.PI / 2);
caps.instanceMatrix.needsUpdate = true;
caps.computeBoundingSphere();
card.add(caps);
mesh(new BoxGeometry(0.004, 0.004, 0.003), coilMat, 0.095, 0.032, 0.0028);
mesh(new BoxGeometry(0.036, 0.036, 0.0012), subMat, -0.02, -0.01, 0.0022);
mesh(new BoxGeometry(0.02, 0.02, 0.0008), dieMat, -0.02, -0.01, 0.0032);
const goldGeo = new BoxGeometry(0.022, 0.001, 0.0004);
const goldF = new InstancedMesh(goldGeo, goldMat, 4);
setP(goldF, 0, -0.02, 0.0005, 0.003, 0, 0);
setP(goldF, 1, -0.02, -0.0205, 0.003, 0, 0);
setP(goldF, 2, -0.0095, -0.01, 0.003, 3, Math.PI / 2);
setP(goldF, 3, -0.0305, -0.01, 0.003, 3, Math.PI / 2);
goldF.instanceMatrix.needsUpdate = true;
goldF.computeBoundingSphere();
card.add(goldF);
const vx = [-0.045, -0.045, -0.045, 0.005, 0.005, 0.005];
const vy = [-0.028, -0.008, 0.012, -0.028, -0.008, 0.012];
const vramInst = new InstancedMesh(new BoxGeometry(0.012, 0.012, 0.001), vramMat, 6);
const markInst = new InstancedMesh(new BoxGeometry(0.0012, 0.0012, 0.0002), markMat, 6);
for (let i = 0; i < 6; i++) {
setP(vramInst, i, vx[i], vy[i], 0.002, 0, 0);
setP(markInst, i, vx[i] - 0.004, vy[i] + 0.004, 0.0026, 0, 0);
}
vramInst.instanceMatrix.needsUpdate = true;
vramInst.computeBoundingSphere();
markInst.instanceMatrix.needsUpdate = true;
markInst.computeBoundingSphere();
card.add(vramInst);
card.add(markInst);
const pinInst = new InstancedMesh(new BoxGeometry(0.0012, 0.0006, 0.0004), silvMat, 72);
let pi = 0;
for (let c = 0; c < 6; c++) for (let sd = 0; sd < 2; sd++) for (let k = 0; k < 6; k++) {
const px = vx[c] - 0.005 + k * 0.002;
const py = vy[c] + (sd ? 0.007 : -0.007);
setP(pinInst, pi++, px, py, 0.0017, 0, 0);
}
pinInst.instanceMatrix.needsUpdate = true;
pinInst.computeBoundingSphere();
card.add(pinInst);
const ringGeo = new TorusGeometry(0.042, 0.0025, 8, 32);
mesh(ringGeo, fanFrmMat, -0.065, 0, 0.028);
mesh(ringGeo, fanFrmMat, 0.065, 0, 0.028);
const strutInst = new InstancedMesh(new BoxGeometry(0.04, 0.004, 0.002), fanFrmMat, 8);
let si = 0;
for (let f = 0; f < 2; f++) {
const cx = f ? 0.065 : -0.065;
for (let k = 0; k < 4; k++) {
const a = Math.PI / 4 + k * Math.PI / 2;
setP(strutInst, si++, cx + Math.cos(a) * 0.022, Math.sin(a) * 0.022, 0.028, 3, a);
}
}
strutInst.instanceMatrix.needsUpdate = true;
strutInst.computeBoundingSphere();
card.add(strutInst);
const hubGeo = new CylinderGeometry(0.012, 0.012, 0.008, 16);
const hub1 = mesh(hubGeo, fanFrmMat, -0.065, 0, 0.026);
hub1.rotation.x = Math.PI / 2;
const hub2 = mesh(hubGeo, fanFrmMat, 0.065, 0, 0.026);
hub2.rotation.x = Math.PI / 2;
const labGeo = new CircleGeometry(0.009, 20);
mesh(labGeo, fanLabMat, -0.065, 0, 0.0302);
mesh(labGeo, fanLabMat, 0.065, 0, 0.0302);
const bladeGeo = new BoxGeometry(0.018, 0.008, 0.001);
const rotor1 = new Group();
rotor1.position.set(-0.065, 0, 0.026);
card.add(rotor1);
const blades1 = new InstancedMesh(bladeGeo, bladeMat, 9);
for (let i = 0; i < 9; i++) {
const a = i / 9 * Math.PI * 2;
_q.setFromAxisAngle(_axX, 0.55);
_q2.setFromAxisAngle(_ax, a);
_q2.multiply(_q);
_v.set(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0);
_s.set(1, 1, 1);
_m.compose(_v, _q2, _s);
blades1.setMatrixAt(i, _m);
}
blades1.instanceMatrix.needsUpdate = true;
blades1.computeBoundingSphere();
rotor1.add(blades1);
const rotor2 = new Group();
rotor2.position.set(0.065, 0, 0.026);
card.add(rotor2);
const blades2 = new InstancedMesh(bladeGeo, bladeMat, 9);
for (let i = 0; i < 9; i++) {
const a = i / 9 * Math.PI * 2;
_q.setFromAxisAngle(_axX, 0.55);
_q2.setFromAxisAngle(_ax, a);
_q2.multiply(_q);
_v.set(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0);
_s.set(1, 1, 1);
_m.compose(_v, _q2, _s);
blades2.setMatrixAt(i, _m);
}
blades2.instanceMatrix.needsUpdate = true;
blades2.computeBoundingSphere();
rotor2.add(blades2);
const fanScrew = new InstancedMesh(new CylinderGeometry(0.002, 0.002, 0.002, 6), screwMat, 4);
setP(fanScrew, 0, -0.103, 0.038, 0.028, 1, Math.PI / 2);
setP(fanScrew, 1, -0.027, -0.038, 0.028, 1, Math.PI / 2);
setP(fanScrew, 2, 0.027, 0.038, 0.028, 1, Math.PI / 2);
setP(fanScrew, 3, 0.103, -0.038, 0.028, 1, Math.PI / 2);
fanScrew.instanceMatrix.needsUpdate = true;
fanScrew.computeBoundingSphere();
card.add(fanScrew);
const pipeGeo = new CylinderGeometry(0.003, 0.003, 0.18, 12);
const pipe1 = mesh(pipeGeo, copMat, 0, 0.026, 0.012);
pipe1.rotation.z = Math.PI / 2;
const pipe2 = mesh(pipeGeo, copMat, 0, 0.038, 0.012);
pipe2.rotation.z = Math.PI / 2;
const ubend = mesh(new TorusGeometry(0.006, 0.003, 8, 16, Math.PI), copMat, 0.09, 0.032, 0.012);
ubend.rotation.z = -Math.PI / 2;
mesh(new BoxGeometry(0.03, 0.03, 0.0015), nickMat, -0.02, -0.01, 0.008);
const finInst = new InstancedMesh(new BoxGeometry(0.0015, 0.09, 0.014), aluMat, 24);
for (let i = 0; i < 24; i++) setP(finInst, i, -0.046 + i * 0.004, 0, 0.012, 0, 0);
finInst.instanceMatrix.needsUpdate = true;
finInst.computeBoundingSphere();
card.add(finInst);
const railGeo = new BoxGeometry(0.10, 0.003, 0.015);
mesh(railGeo, aluMat, 0, 0.045, 0.012);
mesh(railGeo, aluMat, 0, -0.045, 0.012);
const backGeo = new ExtrudeGeometry(rr(0.26, 0.105, 0.004), { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelSegments: 1, curveSegments: 4 });
backGeo.translate(0, 0, -0.0006);
mesh(backGeo, backMat, 0, 0, -0.0028);
mesh(new BoxGeometry(0.20, 0.008, 0.0005), stripeMat, 0, 0, -0.004);
const backScrew = new InstancedMesh(new CylinderGeometry(0.002, 0.002, 0.0015, 6), screwMat, 6);
const bsx = [-0.12, 0, 0.12, -0.12, 0, 0.12];
const bsy = [0.045, 0.045, 0.045, -0.045, -0.045, -0.045];
for (let i = 0; i < 6; i++) setP(backScrew, i, bsx[i], bsy[i], -0.0035, 1, Math.PI / 2);
backScrew.instanceMatrix.needsUpdate = true;
backScrew.computeBoundingSphere();
card.add(backScrew);
mesh(new BoxGeometry(0.05, 0.02, 0.0005), darkMat, -0.065, 0, -0.004);
mesh(new BoxGeometry(0.05, 0.02, 0.0005), darkMat, 0.065, 0, -0.004);
mesh(new BoxGeometry(0.022, 0.008, 0.0015), goldMat, -0.06, -0.059, 0);
mesh(new BoxGeometry(0.06, 0.008, 0.0015), goldMat, -0.01, -0.059, 0);
const padInst = new InstancedMesh(new BoxGeometry(0.002, 0.006, 0.0003), goldMat, 22);
for (let k = 0; k < 11; k++) {
setP(padInst, k, -0.07 + k * 0.002, -0.059, 0.0009, 0, 0);
setP(padInst, 11 + k, -0.035 + k * 0.005, -0.059, 0.0009, 0, 0);
}
padInst.instanceMatrix.needsUpdate = true;
padInst.computeBoundingSphere();
card.add(padInst);
mesh(new BoxGeometry(0.004, 0.002, 0.002), goldMat, -0.0445, -0.062, 0);
mesh(new BoxGeometry(0.021, 0.010, 0.008), whiteMat, 0.08, 0.057, 0.006);
const cavInst = new InstancedMesh(new BoxGeometry(0.003, 0.002, 0.003), darkMat, 8);
let ci = 0;
for (let kx = 0; kx < 4; kx++) for (let kz = 0; kz < 2; kz++) setP(cavInst, ci++, 0.0725 + kx * 0.005, 0.062, 0.004 + kz * 0.004, 0, 0);
cavInst.instanceMatrix.needsUpdate = true;
cavInst.computeBoundingSphere();
card.add(cavInst);
mesh(new BoxGeometry(0.012, 0.001, 0.002), whiteMat, 0.08, 0.058, 0.0105);
mesh(new BoxGeometry(0.002, 0.11, 0.04), steelMat, -0.135, 0, 0);
mesh(new BoxGeometry(0.02, 0.002, 0.04), steelMat, -0.126, 0.054, 0);
const dpY = [-0.01, 0.012, 0.034];
const dpInst = new InstancedMesh(new BoxGeometry(0.0015, 0.007, 0.015), darkMat, 3);
for (let i = 0; i < 3; i++) setP(dpInst, i, -0.1362, dpY[i], 0, 0, 0);
dpInst.instanceMatrix.needsUpdate = true;
dpInst.computeBoundingSphere();
card.add(dpInst);
const dpFrame = new InstancedMesh(new BoxGeometry(0.001, 0.001, 0.001), frameMat, 12);
let fi = 0;
for (let i = 0; i < 3; i++) {
const yy = dpY[i];
setS(dpFrame, fi++, -0.1362, yy + 0.004, 0, 1, 1, 17);
setS(dpFrame, fi++, -0.1362, yy - 0.004, 0, 1, 1, 17);
setS(dpFrame, fi++, -0.1362, yy, -0.008, 1, 9, 1);
setS(dpFrame, fi++, -0.1362, yy, 0.008, 1, 9, 1);
}
dpFrame.instanceMatrix.needsUpdate = true;
dpFrame.computeBoundingSphere();
card.add(dpFrame);
const slotInst = new InstancedMesh(new BoxGeometry(0.0015, 0.002, 0.012), darkMat, 8);
let sli = 0;
for (let ry = 0; ry < 4; ry++) for (let rz = 0; rz < 2; rz++) setP(slotInst, sli++, -0.1362, -0.045 + ry * 0.005, -0.01 + rz * 0.02, 0, 0);
slotInst.instanceMatrix.needsUpdate = true;
slotInst.computeBoundingSphere();
card.add(slotInst);
const brkScrew = new InstancedMesh(new CylinderGeometry(0.002, 0.002, 0.002, 6), screwMat, 2);
setP(brkScrew, 0, -0.1365, 0.05, -0.015, 3, Math.PI / 2);
setP(brkScrew, 1, -0.1365, 0.05, 0.015, 3, Math.PI / 2);
brkScrew.instanceMatrix.needsUpdate = true;
brkScrew.computeBoundingSphere();
card.add(brkScrew);
const floorMat = new ShadowMaterial({ opacity: 0.55 });
const floorM = new Mesh(new CircleGeometry(0.35, 32), floorMat);
floorM.rotation.x = -Math.PI / 2;
floorM.position.set(0, -0.072, 0);
floorM.receiveShadow = true;
scene.add(floorM);
card.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// Negativ-Liste (Guide §2): Schatten nur auf Hauptbauteilen — Kleinteile
// (Pins, Pads, Markierungen, Cavities, Slots, DP-Rahmen, Schrauben) werfen keinen Schatten.
for (const tiny of [pinInst, padInst, markInst, cavInst, slotInst, dpInst, dpFrame, fanScrew, backScrew, brkScrew, goldF]) { tiny.castShadow = false; }
const labels = [];
labels.push(addLabel(scene, 'GPU-Die', [-0.02, -0.01, 0.004], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'VRAM 1', [-0.032, 0.008, 0.003], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'VRAM 2', [0.012, -0.028, 0.003], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Luefter 1', [-0.065, 0, 0.032], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Luefter 2', [0.065, 0, 0.032], { id: 'l5', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Heatpipe', [0, 0.032, 0.012], { id: 'l6', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Backplate', [0.06, -0.02, -0.006], { id: 'l7', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'PCIe-x16-Stecker', [-0.03, -0.061, 0.002], { id: 'l8', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Stromanschluss', [0.08, 0.06, 0.008], { id: 'l9', level: 'aufbau', sizePx: 16, leader: true }));
labels.push(addLabel(scene, 'Slotblende', [-0.135, 0, 0.01], { id: 'l10', level: 'aufbau', sizePx: 16, leader: true }));
const meas = [];
meas.push(addMeasurement(scene, [-0.1335, -0.075, 0], [0.1335, -0.075, 0], 'Kartenlaenge: 267 mm', { id: 'm1', level: 'aufbau', unit: 'mm' }));
meas.push(addMeasurement(scene, [-0.136, 0.055, -0.02], [-0.136, 0.055, 0.02], 'Slotbreite: 40 mm', { id: 'm2', level: 'aufbau', unit: 'mm' }));
let running = true;
let raf = 0;
const reduced = params.reducedMotion === true;
function loop() {
if (!running) return;
if (!reduced) { rotor1.rotation.z += 0.08; rotor2.rotation.z -= 0.08; }
controls.update();
renderer.render(scene, camera);
raf = requestAnimationFrame(loop);
}
raf = requestAnimationFrame(loop);
function update(patch) {
patch = patch || {};
if (patch.labels) {
const en = patch.labels.enabled !== false;
let mx = patch.labels.max;
if (mx === undefined) mx = 5;
for (let i = 0; i < labels.length; i++) {
const hh = labels[i];
const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
const vis = en && i < mx && !hd.includes(i);
if (!hh) continue;
if ('visible' in hh) hh.visible = vis;
if (hh.object) hh.object.visible = vis;
if (hh.group) hh.group.visible = vis;
if (typeof hh.setVisible === 'function') hh.setVisible(vis);
}
}
if (patch.measurements) {
const en2 = patch.measurements.enabled !== false;
for (let i = 0; i < meas.length; i++) {
const hh = meas[i];
if (!hh) continue;
if ('visible' in hh) hh.visible = en2;
if (hh.object) hh.object.visible = en2;
if (hh.group) hh.group.visible = en2;
if (typeof hh.setVisible === 'function') hh.setVisible(en2);
}
}
if (patch.view) {
const vw = patch.view;
if (vw === 'overview') { camera.position.set(0.34, 0.26, 0.38); controls.target.set(0, -0.005, 0); }
else if (vw === 'detail') { camera.position.set(-0.02, -0.01, 0.14); controls.target.set(-0.02, -0.01, 0.003); }
else if (vw === 'front') { camera.position.set(0, 0, 0.45); controls.target.set(0, 0, 0); }
else if (vw === 't' + 'op') { camera.position.set(0, 0.45, 0.01); controls.target.set(0, 0, 0); }
controls.update();
}
}
function dispose() {
running = false;
cancelAnimationFrame(raf);
controls.dispose();
scene.traverse(o => {
if (o.geometry) o.geometry.dispose();
if (o.material) {
const mt = o.material;
if (Array.isArray(mt)) for (let i = 0; i < mt.length; i++) { if (mt[i].map) mt[i].map.dispose(); if (mt[i].bumpMap) mt[i].bumpMap.dispose(); mt[i].dispose(); }
else { if (mt.map) mt.map.dispose(); if (mt.bumpMap) mt.bumpMap.dispose(); mt.dispose(); }
}
});
envRT.dispose();
renderer.dispose();
try { container.removeChild(renderer.domElement); } catch (e) {}
}
return { update, dispose };
}