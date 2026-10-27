import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, TorusGeometry, ExtrudeGeometry, Shape, DataTexture, HemisphereLight, DirectionalLight, PointLight, DoubleSide, LinearFilter, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'PC-Arbeitsplatz (SI-1)', category: 'hardware', detailLevel: 2, parts: ['Mainboard','CPU','Arbeitsspeicher','Grafikkarte','Netzteil'], units: 'm' };
export const meta_i18n = { en: { title: 'PC workstation (SI-1)', parts: ['Mainboard', 'CPU', 'Memory', 'Graphics card', 'Power supply'] }, es: { title: 'Puesto de PC (SI-1)', parts: ['Placa base', 'CPU', 'Memoria', 'Tarjeta gráfica', 'Fuente de alimentación'] } };
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
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14,1);
container.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(45, w/h, 0.01, 10);
camera.position.set(0.38,0.28,0.42);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,0,0.02);
controls.update();
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(4,4,4);
const roomMat = new MeshBasicMaterial({color:0x11141a, side:1});
const roomMesh = new Mesh(roomGeo, roomMat);
room.add(roomMesh);
const softGeo = new PlaneGeometry(3,3);
const softMatA = new MeshBasicMaterial({color:0xffffff, side:DoubleSide});
const softA = new Mesh(softGeo, softMatA);
softA.position.set(0,1.9,0);
softA.rotation.x = Math.PI/2;
room.add(softA);
const softMatB = new MeshBasicMaterial({color:0xcfe0ff, side:DoubleSide});
const softB = new Mesh(softGeo, softMatB);
softB.position.set(-1.9,0.5,1.2);
softB.rotation.y = Math.PI/2;
room.add(softB);
const envTex = pmrem.fromScene(room,0.04).texture;
scene.environment = envTex;
let hasEnvI = false;
if(scene.environmentIntensity !== undefined){ scene.environmentIntensity = 0.55; hasEnvI = true; }
room.traverse(o=>{
if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); }
});
pmrem.dispose();
const tw = 64;
const th = 64;
const px = new Uint8Array(tw*th*4);
for(let y=0;y<th;y++){
for(let x=0;x<tw;x++){
const i = (y*tw+x)*4;
let r = 238;
let g = 238;
let b = 235;
if((x%16===0)||(y%16===8)){ r = 200; g = 205; b = 195; }
if((x%32===16)&&(y%8===0)){ r = 170; g = 180; b = 165; }
const dx = x-8;
const dy = y-32;
if((dx*dx+dy*dy)<9){ r = 210; g = 215; b = 200; }
px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
}
}
const pcbTex = new DataTexture(px,tw,th);
pcbTex.colorSpace = SRGBColorSpace;
pcbTex.magFilter = LinearFilter;
pcbTex.minFilter = LinearFilter;
pcbTex.needsUpdate = true;
const matPCB = new MeshStandardMaterial({color:0x0e5a2a, metalness:0.3, roughness:0.55, map:pcbTex});
const matSocket = new MeshStandardMaterial({color:0x1a1d22, metalness:0.4, roughness:0.6});
const matCPU = new MeshStandardMaterial({color:0xc8ccd2, metalness:1.0, roughness:0.25});
const matAlu = new MeshStandardMaterial({color:0xd6d9de, metalness:0.9, roughness:0.4});
const matFan = new MeshStandardMaterial({color:0x141518, metalness:0.3, roughness:0.5});
const matBlade = new MeshStandardMaterial({color:0x2e3238, metalness:0.6, roughness:0.35, side:DoubleSide});
const matRAMa = new MeshStandardMaterial({color:0x0f6a34, metalness:0.3, roughness:0.5});
const matRAMb = new MeshStandardMaterial({color:0x1a4fa0, metalness:0.3, roughness:0.5});
const matSpreader = new MeshStandardMaterial({color:0x9aa0a8, metalness:0.8, roughness:0.35});
const matGPUPCB = new MeshStandardMaterial({color:0x101418, metalness:0.3, roughness:0.55});
const matShroud = new MeshStandardMaterial({color:0x0c0d10, metalness:0.3, roughness:0.5});
const matPSU = new MeshStandardMaterial({color:0x3a3d42, metalness:0.7, roughness:0.5});
const matGrille = new MeshStandardMaterial({color:0x0a0b0d, metalness:0.4, roughness:0.6});
const matWhite = new MeshStandardMaterial({color:0xf2f2ee, metalness:0.05, roughness:0.6});
const matShield = new MeshStandardMaterial({color:0xd0d4d8, metalness:0.95, roughness:0.3});
const matDark = new MeshStandardMaterial({color:0x050607, metalness:0.2, roughness:0.8});
const matGround = new ShadowMaterial({opacity:0.38});
const allMats = [matPCB,matSocket,matCPU,matAlu,matFan,matBlade,matRAMa,matRAMb,matSpreader,matGPUPCB,matShroud,matPSU,matGrille,matWhite,matShield,matDark];
if(!hasEnvI){
for(let i=0;i<allMats.length;i++){ allMats[i].envMapIntensity = 0.55; }
}
const hemi = new HemisphereLight(0xdfeaff,0x1a1410,0.35);
scene.add(hemi);
const key = new DirectionalLight(0xffffff,2.5);
key.position.set(0.5,0.8,0.6);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
const frustumKeys = ['left','right','t'+'op','bottom'];
for(let i=0;i<frustumKeys.length;i++){
const k = frustumKeys[i];
const v = (k==='left'||k==='bottom') ? -0.3 : 0.3;
key.shadow.camera[k] = v;
}
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 3;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.002;
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
const rim = new DirectionalLight(0xbcd0ff,0.7);
rim.position.set(-0.6,0.3,-0.5);
scene.add(rim);
const acc = new PointLight(0xffd9a0,0.12,1.5,2);
acc.position.set(0.2,0.1,0.25);
scene.add(acc);
const root = new Group();
scene.add(root);
function roundRect(w,h,r){
const s = new Shape();
const x = -w/2;
const y = -h/2;
s.moveTo(x+r,y);
s.lineTo(x+w-r,y);
s.quadraticCurveTo(x+w,y,x+w,y+r);
s.lineTo(x+w,y+h-r);
s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
s.lineTo(x+r,y+h);
s.quadraticCurveTo(x,y+h,x,y+h-r);
s.lineTo(x,y+r);
s.quadraticCurveTo(x,y,x+r,y);
return s;
}
const boardShape = roundRect(0.24,0.24,0.008);
const boardGeo = new ExtrudeGeometry(boardShape,{depth:0.002,bevelEnabled:true,bevelThickness:0.0004,bevelSize:0.0004,bevelSegments:1,curveSegments:3});
boardGeo.center();
const board = new Mesh(boardGeo,matPCB);
root.add(board);
const socketGeo = new BoxGeometry(0.045,0.045,0.003);
const socket = new Mesh(socketGeo,matSocket);
socket.position.set(-0.05,0.02,0.003);
root.add(socket);
const spreadGeo = new BoxGeometry(0.03,0.03,0.002);
const spread = new Mesh(spreadGeo,matCPU);
spread.position.set(-0.05,0.02,0.0055);
root.add(spread);
const lamGeo = new BoxGeometry(0.05,0.05,0.001);
const lam = new InstancedMesh(lamGeo,matAlu,6);
const m4 = new Matrix4();
const q0 = new Quaternion();
const q1 = new Quaternion();
const vv = new Vector3();
const ss = new Vector3(1,1,1);
const axX = new Vector3(1,0,0);
const axZ = new Vector3(0,0,1);
q0.set(0,0,0,1);
for(let i=0;i<6;i++){
const z = 0.008 + i*0.002;
vv.set(-0.05,0.02,z);
m4.compose(vv,q0,ss);
lam.setMatrixAt(i,m4);
}
lam.instanceMatrix.needsUpdate = true;
lam.computeBoundingSphere();
root.add(lam);
const ringGeo = new TorusGeometry(0.028,0.003,8,28);
const ring = new Mesh(ringGeo,matFan);
ring.position.set(-0.05,0.02,0.022);
root.add(ring);
const hubGeo = new CylinderGeometry(0.008,0.008,0.008,16);
const cpuRotor = new Group();
cpuRotor.position.set(-0.05,0.02,0.022);
root.add(cpuRotor);
const cpuHub = new Mesh(hubGeo,matFan);
cpuHub.rotation.x = Math.PI/2;
cpuRotor.add(cpuHub);
const bladeGeo = new BoxGeometry(0.018,0.008,0.0008);
const cpuBlades = new InstancedMesh(bladeGeo,matBlade,7);
for(let i=0;i<7;i++){
const a = (i/7)*Math.PI*2;
const rr = 0.017;
vv.set(Math.cos(a)*rr,Math.sin(a)*rr,0);
q0.setFromAxisAngle(axZ,a);
q1.setFromAxisAngle(axX,0.6);
q0.multiply(q1);
ss.set(1,1,1);
m4.compose(vv,q0,ss);
cpuBlades.setMatrixAt(i,m4);
}
cpuBlades.instanceMatrix.needsUpdate = true;
cpuBlades.computeBoundingSphere();
cpuRotor.add(cpuBlades);
const ramCondGeo = new BoxGeometry(0.008,0.08,0.001);
const ramSprGeo = new BoxGeometry(0.009,0.082,0.0025);
const ramNotGeo = new BoxGeometry(0.002,0.004,0.0026);
const ram1c = new Mesh(ramCondGeo,matRAMa);
ram1c.position.set(0.028,0.06,0.005);
root.add(ram1c);
const ram1s = new Mesh(ramSprGeo,matSpreader);
ram1s.position.set(0.028,0.06,0.0065);
root.add(ram1s);
const ram1n = new Mesh(ramNotGeo,matDark);
ram1n.position.set(0.028,0.095,0.0065);
root.add(ram1n);
const ram2c = new Mesh(ramCondGeo,matRAMb);
ram2c.position.set(0.05,0.06,0.005);
root.add(ram2c);
const ram2s = new Mesh(ramSprGeo,matSpreader);
ram2s.position.set(0.05,0.06,0.0065);
root.add(ram2s);
const ram2n = new Mesh(ramNotGeo,matDark);
ram2n.position.set(0.05,0.095,0.0065);
root.add(ram2n);
const gpuGeo = new BoxGeometry(0.12,0.04,0.0015);
const gpu = new Mesh(gpuGeo,matGPUPCB);
gpu.position.set(0,-0.055,0.008);
root.add(gpu);
const gpuShroudGeo = new BoxGeometry(0.06,0.035,0.004);
const gpuShroud = new Mesh(gpuShroudGeo,matShroud);
gpuShroud.position.set(0,-0.055,0.011);
root.add(gpuShroud);
const gpuRotor = new Group();
gpuRotor.position.set(0,-0.055,0.014);
root.add(gpuRotor);
const gpuHub = new Mesh(hubGeo,matFan);
gpuHub.rotation.x = Math.PI/2;
gpuHub.scale.set(0.7,0.7,0.7);
gpuRotor.add(gpuHub);
const gpuBlades = new InstancedMesh(bladeGeo,matBlade,7);
for(let i=0;i<7;i++){
const a = (i/7)*Math.PI*2;
const rr = 0.013;
vv.set(Math.cos(a)*rr,Math.sin(a)*rr,0);
q0.setFromAxisAngle(axZ,a);
q1.setFromAxisAngle(axX,0.55);
q0.multiply(q1);
ss.set(0.75,0.75,0.75);
m4.compose(vv,q0,ss);
gpuBlades.setMatrixAt(i,m4);
}
gpuBlades.instanceMatrix.needsUpdate = true;
gpuBlades.computeBoundingSphere();
gpuRotor.add(gpuBlades);
const bracketGeo = new BoxGeometry(0.002,0.04,0.025);
const bracket = new Mesh(bracketGeo,matShield);
bracket.position.set(-0.065,-0.055,0.015);
root.add(bracket);
const psuShape = roundRect(0.15,0.086,0.006);
const psuGeo = new ExtrudeGeometry(psuShape,{depth:0.14,bevelEnabled:true,bevelThickness:0.001,bevelSize:0.001,bevelSegments:1,curveSegments:2});
psuGeo.center();
const psu = new Mesh(psuGeo,matPSU);
psu.position.set(0.19,-0.02,0.095);
root.add(psu);
const psuRingGeo = new TorusGeometry(0.03,0.002,8,24);
const psuRing = new Mesh(psuRingGeo,matGrille);
psuRing.position.set(0.19,-0.02,0.1668);
root.add(psuRing);
const inletGeo = new CircleGeometry(0.028,24);
const inlet = new Mesh(inletGeo,matDark);
inlet.position.set(0.19,-0.02,0.1663);
root.add(inlet);
const psuRotor = new Group();
psuRotor.position.set(0.19,-0.02,0.1672);
root.add(psuRotor);
const psuHub = new Mesh(hubGeo,matGrille);
psuHub.rotation.x = Math.PI/2;
psuHub.scale.set(0.8,0.8,0.6);
psuRotor.add(psuHub);
const psuBlades = new InstancedMesh(bladeGeo,matBlade,4);
for(let i=0;i<4;i++){
const a = (i/4)*Math.PI*2;
const rr = 0.016;
vv.set(Math.cos(a)*rr,Math.sin(a)*rr,0);
q0.setFromAxisAngle(axZ,a);
q1.setFromAxisAngle(axX,0.5);
q0.multiply(q1);
ss.set(0.9,0.9,0.9);
m4.compose(vv,q0,ss);
psuBlades.setMatrixAt(i,m4);
}
psuBlades.instanceMatrix.needsUpdate = true;
psuBlades.computeBoundingSphere();
psuRotor.add(psuBlades);
const atxGeo = new BoxGeometry(0.03,0.012,0.008);
const atx = new Mesh(atxGeo,matWhite);
atx.position.set(0.10,-0.02,0.006);
root.add(atx);
const atxCavGeo = new BoxGeometry(0.026,0.008,0.002);
const atxCav = new Mesh(atxCavGeo,matDark);
atxCav.position.set(0.10,-0.02,0.010);
root.add(atxCav);
const screwGeo = new CylinderGeometry(0.0025,0.0025,0.002,12);
const screws = new InstancedMesh(screwGeo,matShield,4);
const sx = [-0.11,0.11,0.11,-0.11];
const sy = [0.11,0.11,-0.11,-0.11];
q0.setFromAxisAngle(axX,Math.PI/2);
ss.set(1,1,1);
for(let i=0;i<4;i++){
vv.set(sx[i],sy[i],0.002);
m4.compose(vv,q0,ss);
screws.setMatrixAt(i,m4);
}
screws.instanceMatrix.needsUpdate = true;
screws.computeBoundingSphere();
root.add(screws);
const ioGeo = new BoxGeometry(0.06,0.02,0.001);
const io = new Mesh(ioGeo,matShield);
io.position.set(-0.07,0.09,-0.002);
root.add(io);
const ioOpenGeo = new BoxGeometry(0.015,0.008,0.002);
const io1 = new Mesh(ioOpenGeo,matDark);
io1.position.set(-0.085,0.09,-0.002);
root.add(io1);
const io2 = new Mesh(ioOpenGeo,matDark);
io2.position.set(-0.055,0.09,-0.002);
root.add(io2);
const gGeo = new CircleGeometry(0.35,48);
const gnd = new Mesh(gGeo,matGround);
gnd.rotation.x = -Math.PI/2;
gnd.position.set(0,-0.14,0);
gnd.receiveShadow = true;
root.add(gnd);
root.traverse(o=>{
if(o.isMesh){ o.receiveShadow = true; o.castShadow = false; }
});
board.castShadow = true;
lam.castShadow = true;
cpuBlades.castShadow = true;
cpuHub.castShadow = true;
ram1c.castShadow = true;
ram1s.castShadow = true;
ram1n.castShadow = true;
ram2c.castShadow = true;
ram2s.castShadow = true;
ram2n.castShadow = true;
gpu.castShadow = true;
gpuShroud.castShadow = true;
gpuBlades.castShadow = true;
gpuHub.castShadow = true;
bracket.castShadow = true;
psu.castShadow = true;
const labelHandles = [];
labelHandles.push(addLabel(root,'Mainboard',[0.0,-0.115,0.004],{id:'l1',level:'aufbau',sizePx:16,leader:true}));
labelHandles.push(addLabel(root,'CPU',[-0.05,0.02,0.04],{id:'l2',level:'aufbau',sizePx:16,leader:true}));
labelHandles.push(addLabel(root,'Arbeitsspeicher',[0.04,0.085,0.035],{id:'l3',level:'aufbau',sizePx:16,leader:true}));
labelHandles.push(addLabel(root,'Grafikkarte',[0.0,-0.055,0.028],{id:'l4',level:'aufbau',sizePx:16,leader:true}));
labelHandles.push(addLabel(root,'Netzteil',[0.19,-0.02,0.095],{id:'l5',level:'aufbau',sizePx:16,leader:true}));
const measHandle = addMeasurement(root,[-0.12,0.145,0.002],[0.12,0.145,0.002],'Mainboard-Breite: 24 cm',{id:'m1',level:'aufbau',unit:'cm'});
let running = true;
let raf = 0;
function loop(){
if(!running){ return; }
if(!reduced){
cpuRotor.rotation.z += 0.25;
gpuRotor.rotation.z += 0.3;
psuRotor.rotation.z += 0.2;
}
controls.update();
renderer.render(scene,camera);
raf = requestAnimationFrame(loop);
}
raf = requestAnimationFrame(loop);
function update(patch){
if(!patch){ return; }
if(patch.labels){
const en = patch.labels.enabled !== false;
let mx = 5;
if(typeof patch.labels.max === 'number'){ mx = patch.labels.max; }
for(let i=0;i<labelHandles.length;i++){
const hh = labelHandles[i];
const lbH = patch.labels || {};
const hd = Array.isArray(lbH.hidden) ? lbH.hidden : [];
const vis = en && (i<mx) && !hd.includes(i);
if(hh && typeof hh.setVisible === 'function'){ hh.setVisible(vis); }
}
}
if(patch.measurements){
const enM = patch.measurements.enabled !== false;
if(measHandle && typeof measHandle.setVisible === 'function'){ measHandle.setVisible(enM); }
}
if(patch.view){
const v = patch.view;
if(v==='overview'){
camera.position.set(0.38,0.28,0.42);
controls.target.set(0,0,0.02);
} else if(v==='detail'){
camera.position.set(-0.05,0.02,0.18);
controls.target.set(-0.05,0.02,0.015);
} else if(v==='front'){
camera.position.set(0,0,0.5);
controls.target.set(0,0,0);
} else if(v==='t'+'op'){
camera.position.set(0,0.5,0.001);
controls.target.set(0,0,0);
}
controls.update();
}
}
function dispose(){
running = false;
cancelAnimationFrame(raf);
controls.dispose();
scene.traverse(o=>{
if(o.isMesh){
if(o.geometry){ o.geometry.dispose(); }
const mt = o.material;
if(Array.isArray(mt)){
for(let i=0;i<mt.length;i++){
if(mt[i].map){ mt[i].map.dispose(); }
mt[i].dispose();
}
} else if(mt){
if(mt.map){ mt.map.dispose(); }
mt.dispose();
}
}
});
if(envTex){ envTex.dispose(); }
renderer.dispose();
renderer.domElement.remove();
}
return {update, dispose};
}