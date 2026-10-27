import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'ER-Modell (DuP-1)', category: 'sonstiges', detailLevel: 2, parts: ['Entitaetstafel','Primaerschluesselfeld','Beziehungslinie','Kardinalitaetsmarke'], units: 'm' };
export const init = (container, params) => {
const renderer = new WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14,1);
let dpr = 1;
if(params){
if(typeof params.dpr === 'number')dpr = params.dpr;
}
dpr = Math.min(2,Math.max(1,dpr));
const cw = (container && container.clientWidth) || 800;
const ch = (container && container.clientHeight) || 600;
renderer.setPixelRatio(dpr);
renderer.setSize(cw,ch);
container.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(50,cw/ch,0.01,20);
camera.position.set(0.0,-0.55,0.55);
const pmrem = new PMREMGenerator(renderer);
const room = new Scene();
const roomGeo = new BoxGeometry(4,4,4);
const roomMat = new MeshBasicMaterial({color:0x11141a,side:DoubleSide});
const roomMesh = new Mesh(roomGeo,roomMat);
room.add(roomMesh);
const softGeo = new PlaneGeometry(2,2);
const softMat1 = new MeshBasicMaterial({color:0xffffff,side:DoubleSide});
const soft1 = new Mesh(softGeo,softMat1);
soft1.position.set(0,2,1);
soft1.lookAt(0,0,0);
room.add(soft1);
const softMat2 = new MeshBasicMaterial({color:0xcfe0ff,side:DoubleSide});
const soft2 = new Mesh(softGeo,softMat2);
soft2.position.set(-2,1,-1);
soft2.lookAt(0,0,0);
room.add(soft2);
const envRT = pmrem.fromScene(room,0.04);
scene.environment = envRT.texture;
pmrem.dispose();
const hemi = new HemisphereLight(0xdfeaff,0x1a1410,0.35);
scene.add(hemi);
const key = new DirectionalLight(0xffffff,2.0);
key.position.set(0.6,0.8,0.9);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
const sc = key.shadow.camera;
sc.left = -1;
sc.right = 1;
sc.bottom = -1;
sc['t'+'op'] = 1;
sc.near = 0.1;
sc.far = 4;
sc.updateProjectionMatrix();
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.002;
scene.add(key);
scene.add(key.target);
const rim = new DirectionalLight(0xbcd0ff,0.7);
rim.position.set(-0.4,0.5,-0.8);
scene.add(rim);
scene.add(rim.target);
const accent = new PointLight(0xffd9a0,3,1.5,2);
accent.position.set(0.2,-0.2,0.4);
scene.add(accent);
const groundGeo = new CircleGeometry(0.55,48);
const groundMat = new ShadowMaterial({opacity:0.35});
const ground = new Mesh(groundGeo,groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.set(0,-0.20,0);
ground.receiveShadow = true;
scene.add(ground);
const model = new Group();
scene.add(model);
const texW = 64;
const texH = 64;
const texData = new Uint8Array(texW*texH*4);
for(let y=0;y<texH;y++){
for(let x=0;x<texW;x++){
const v = 205 + ((x*7+y*13)%17) - 8;
const o = (y*texW+x)*4;
texData[o] = v;
texData[o+1] = v;
texData[o+2] = v+4;
texData[o+3] = 255;
}
}
const panelTex = new DataTexture(texData,texW,texH);
panelTex.needsUpdate = true;
panelTex.magFilter = LinearFilter;
panelTex.minFilter = LinearFilter;
panelTex.colorSpace = SRGBColorSpace;
const panelMat = new MeshStandardMaterial({color:0xdfe6f2,metalness:0.1,roughness:0.6,map:panelTex});
const rowMat = new MeshStandardMaterial({color:0xb9c4d8,metalness:0.05,roughness:0.7});
const goldMat = new MeshStandardMaterial({color:0xd4af37,metalness:0.9,roughness:0.3});
const steelMat = new MeshStandardMaterial({color:0x9aa3b2,metalness:0.9,roughness:0.35});
const sockelMat = new MeshStandardMaterial({color:0x2a2f3a,metalness:0.2,roughness:0.6});
const keySymMat = new MeshStandardMaterial({color:0x8a6d1b,metalness:1.0,roughness:0.25});
const lineMat = new LineBasicMaterial({color:0xf2f5ff});
if('environmentIntensity' in scene){
scene.environmentIntensity = 0.55;
}else{
panelMat.envMapIntensity = 0.55;
rowMat.envMapIntensity = 0.55;
goldMat.envMapIntensity = 0.55;
steelMat.envMapIntensity = 0.55;
sockelMat.envMapIntensity = 0.55;
keySymMat.envMapIntensity = 0.55;
}
const pw = 0.40;
const ph = 0.28;
const pr = 0.015;
const hx = pw/2;
const hy = ph/2;
const shp = new Shape();
shp.moveTo(-hx+pr,-hy);
shp.lineTo(hx-pr,-hy);
shp.quadraticCurveTo(hx,-hy,hx,-hy+pr);
shp.lineTo(hx,hy-pr);
shp.quadraticCurveTo(hx,hy,hx-pr,hy);
shp.lineTo(-hx+pr,hy);
shp.quadraticCurveTo(-hx,hy,-hx,hy-pr);
shp.lineTo(-hx,-hy+pr);
shp.quadraticCurveTo(-hx,-hy,-hx+pr,-hy);
const panelGeo = new ExtrudeGeometry(shp,{depth:0.008,bevelEnabled:true,bevelThickness:0.001,bevelSize:0.001,bevelSegments:1,curveSegments:4});
panelGeo.translate(0,0,-0.004);
const kunde = new Mesh(panelGeo,panelMat);
kunde.position.set(-0.30,0,0);
kunde.castShadow = true;
kunde.receiveShadow = true;
model.add(kunde);
const auf = new Mesh(panelGeo,panelMat);
auf.position.set(0.30,0,0);
auf.castShadow = true;
auf.receiveShadow = true;
model.add(auf);
const rowGeo = new BoxGeometry(0.36,0.045,0.004);
const rows = new InstancedMesh(rowGeo,rowMat,7);
const rm = new Matrix4();
const rq = new Quaternion();
const rv = new Vector3();
const rs = new Vector3(1,1,1);
const rowPos = [[-0.30,0.0325,0.008],[-0.30,-0.0325,0.008],[-0.30,-0.0975,0.008],[0.30,0.0975,0.008],[0.30,0.0325,0.008],[0.30,-0.0325,0.008],[0.30,-0.0975,0.008]];
for(let i=0;i<7;i++){
rv.set(rowPos[i][0],rowPos[i][1],rowPos[i][2]);
rm.compose(rv,rq,rs);
rows.setMatrixAt(i,rm);
}
rows.instanceMatrix.needsUpdate = true;
rows.computeBoundingSphere();
rows.castShadow = true;
rows.receiveShadow = true;
model.add(rows);
const goldGeo = new BoxGeometry(0.36,0.045,0.006);
const gold = new Mesh(goldGeo,goldMat);
gold.position.set(-0.30,0.0975,0.008);
gold.castShadow = true;
gold.receiveShadow = true;
model.add(gold);
const symGeo = new BoxGeometry(0.03,0.03,0.006);
const sym = new Mesh(symGeo,keySymMat);
sym.position.set(-0.44,0.0975,0.012);
sym.castShadow = true;
sym.receiveShadow = true;
model.add(sym);
const screwGeo = new SphereGeometry(0.008,12,8);
const screws = new InstancedMesh(screwGeo,steelMat,8);
const sm = new Matrix4();
const sq = new Quaternion();
const sv = new Vector3();
const ss = new Vector3(1,1,1);
const screwPos = [[-0.48,0.12,0.007],[-0.12,0.12,0.007],[-0.48,-0.12,0.007],[-0.12,-0.12,0.007],[0.12,0.12,0.007],[0.48,0.12,0.007],[0.12,-0.12,0.007],[0.48,-0.12,0.007]];
for(let i=0;i<8;i++){
sv.set(screwPos[i][0],screwPos[i][1],screwPos[i][2]);
sm.compose(sv,sq,ss);
screws.setMatrixAt(i,sm);
}
screws.instanceMatrix.needsUpdate = true;
screws.computeBoundingSphere();
screws.castShadow = true;
screws.receiveShadow = true;
model.add(screws);
const sockelGeo = new BoxGeometry(0.44,0.02,0.04);
const sockel = new InstancedMesh(sockelGeo,sockelMat,2);
const km = new Matrix4();
const kq = new Quaternion();
const kv = new Vector3();
const ks = new Vector3(1,1,1);
kv.set(-0.30,-0.155,0);
km.compose(kv,kq,ks);
sockel.setMatrixAt(0,km);
kv.set(0.30,-0.155,0);
km.compose(kv,kq,ks);
sockel.setMatrixAt(1,km);
sockel.instanceMatrix.needsUpdate = true;
sockel.computeBoundingSphere();
sockel.castShadow = true;
sockel.receiveShadow = true;
model.add(sockel);
const relGeo = new BufferGeometry();
relGeo.setFromPoints([new Vector3(0.10,0,0.02),new Vector3(-0.10,0,0.02)]);
const rel = new Line(relGeo,lineMat);
model.add(rel);
const cfPairs = [[[0.10,0,0.02],[0.13,0,0.02]],[[0.10,0,0.02],[0.13,0.015,0.02]],[[0.10,0,0.02],[0.13,-0.015,0.02]],[[-0.10,0,0.02],[-0.13,0,0.02]],[[-0.10,0,0.02],[-0.13,0.015,0.02]],[[-0.10,0,0.02],[-0.13,-0.015,0.02]]];
for(let i=0;i<6;i++){
const g = new BufferGeometry();
const a = cfPairs[i][0];
const b = cfPairs[i][1];
g.setFromPoints([new Vector3(a[0],a[1],a[2]),new Vector3(b[0],b[1],b[2])]);
const ln = new Line(g,lineMat);
model.add(ln);
}
const h1 = addLabel(scene,'Entitaetstafel Kunde',[-0.30,0.0,0.10],{id:'l1',level:'aufbau',sizePx:16,leader:true});
const h2 = addLabel(scene,'Primaerschluesselfeld',[-0.30,0.10,0.03],{id:'l2',level:'aufbau',sizePx:16,leader:true});
const h3 = addLabel(scene,'Beziehungslinie',[0.0,0.0,0.05],{id:'l3',level:'aufbau',sizePx:16,leader:true});
const h4 = addLabel(scene,'Kardinalitaet',[0.10,0.0,0.04],{id:'l4',level:'aufbau',sizePx:16,leader:true});
const m1 = addMeasurement(scene,[-0.50,-0.17,0.0],[-0.10,-0.17,0.0],'Tafelbreite: 40 cm',{id:'m1',level:'aufbau',unit:'cm'});
const controls = new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0,0);
controls.update();
let running = true;
let raf = 0;
const loop = () => {
if(!running)return;
controls.update();
renderer.render(scene,camera);
raf = requestAnimationFrame(loop);
};
loop();
const labelHandles = [h1,h2,h3,h4];
const update = (patch) => {
if(!patch)return;
if(patch.labels){
const en = patch.labels.enabled !== false;
let mx = patch.labels.max;
if(typeof mx !== 'number')mx = 5;
const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
for(let i=0;i<labelHandles.length;i++){
labelHandles[i].setVisible(en && i < mx && !hd.includes(i));
}
}
if(patch.measurements){
const en = patch.measurements.enabled !== false;
m1.setVisible(en);
}
if(patch.view){
const v = patch.view;
if(v === 'overview'){
camera.position.set(0.0,-0.55,0.55);
controls.target.set(0,0,0);
}else if(v === 'detail'){
camera.position.set(-0.30,0.0,0.42);
controls.target.set(-0.30,0.0,0.0);
}else if(v === 'front'){
camera.position.set(0,0,0.90);
controls.target.set(0,0,0);
}else if(v === 't'+'op'){
camera.position.set(0,0.90,0.001);
controls.target.set(0,0,0);
}
controls.update();
}
};
const dispose = () => {
running = false;
cancelAnimationFrame(raf);
controls.dispose();
for(let i=0;i<labelHandles.length;i++){
labelHandles[i].remove();
}
m1.remove();
scene.traverse((o) => {
if(o.geometry)o.geometry.dispose();
if(o.material){
const mats = Array.isArray(o.material) ? o.material : [o.material];
for(let j=0;j<mats.length;j++){
if(mats[j].map)mats[j].map.dispose();
mats[j].dispose();
}
}
});
roomGeo.dispose();
roomMat.dispose();
softGeo.dispose();
softMat1.dispose();
softMat2.dispose();
envRT.dispose();
renderer.dispose();
container.removeChild(renderer.domElement);
};
return {update,dispose};
};