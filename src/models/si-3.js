import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
function roundedRect(w,h,r){
const s=new Shape();
const x=-w/2;
const y=-h/2;
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
function extrudeCentered(w,h,d,r,bt,bs){
const sh=roundedRect(w,h,r);
const g=new ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:bt,bevelSize:bs,bevelSegments:1,steps:1,curveSegments:6});
g.translate(0,0,-d/2);
return g;
}
function makeBrushed(){
const w=64;
const h=64;
const data=new Uint8Array(w*h*4);
for(let y=0;y<h;y++){
for(let x=0;x<w;x++){
const i=(y*w+x)*4;
let v=170+Math.round(18*Math.sin(x*0.6+y*0.15)+8*Math.sin(y*0.9));
if(v<0)v=0;
if(v>255)v=255;
let g2=v+4;
if(g2>255)g2=255;
let b2=v+8;
if(b2>255)b2=255;
data[i]=v;
data[i+1]=g2;
data[i+2]=b2;
data[i+3]=255;
}
}
const t=new DataTexture(data,w,h);
t.needsUpdate=true;
t.magFilter=LinearFilter;
t.minFilter=LinearFilter;
t.colorSpace=SRGBColorSpace;
t.wrapS=RepeatWrapping;
t.wrapT=RepeatWrapping;
return t;
}
function setInst(inst,positions){
const m=new Matrix4();
const q=new Quaternion();
const v=new Vector3();
const s=new Vector3(1,1,1);
q.identity();
for(let i=0;i<positions.length;i++){
const p=positions[i];
v.set(p[0],p[1],p[2]);
m.compose(v,q,s);
inst.setMatrixAt(i,m);
}
inst.instanceMatrix.needsUpdate=true;
inst.computeBoundingSphere();
inst.castShadow=true;
inst.receiveShadow=true;
return inst;
}
export const meta = { title: 'Server-Rack (SI-3)', category: 'hardware', detailLevel: 2, parts: ['Rack', 'Server', 'Festplatteneinschub', 'Netzteil redundant'], units: 'm' };
export function init(container,params){
const p=params||{};
const w=container.clientWidth||800;
const h=container.clientHeight||600;
let rawDpr=p.dpr||1;
if(rawDpr<1)rawDpr=1;
if(rawDpr>2)rawDpr=2;
const scene=new Scene();
const camera=new PerspectiveCamera(45,w/h,0.05,10);
camera.position.set(0.65,0.50,0.70);
const renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.toneMapping=ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
renderer.outputColorSpace=SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=PCFSoftShadowMap;
renderer.setClearColor(0x0b0e14,1);
renderer.setPixelRatio(rawDpr);
renderer.setSize(w,h);
container.appendChild(renderer.domElement);
const pmrem=new PMREMGenerator(renderer);
const room=new Scene();
const roomGeo=new BoxGeometry(4,4,4);
const roomMat=new MeshBasicMaterial({color:0x11141a,side:DoubleSide});
const roomMesh=new Mesh(roomGeo,roomMat);
room.add(roomMesh);
const softGeo=new PlaneGeometry(2,1);
const softMatA=new MeshBasicMaterial({color:0xffffff,side:DoubleSide});
const softA=new Mesh(softGeo,softMatA);
softA.position.set(-1,1.5,1);
softA.lookAt(0,0,0);
room.add(softA);
const softMatB=new MeshBasicMaterial({color:0xcfe0ff,side:DoubleSide});
const softB=new Mesh(softGeo,softMatB);
softB.position.set(1.2,1.0,-0.8);
softB.lookAt(0,0,0);
room.add(softB);
const envRT=pmrem.fromScene(room,0.04);
scene.environment=envRT.texture;
pmrem.dispose();
const brushed=makeBrushed();
const matRack=new MeshStandardMaterial({color:0x3a414c,metalness:0.9,roughness:0.35});
const matPlate=new MeshStandardMaterial({color:0x2f3540,metalness:0.85,roughness:0.4});
const matServer=new MeshStandardMaterial({color:0xb9c1cc,metalness:0.85,roughness:0.35,map:brushed});
const matSled=new MeshStandardMaterial({color:0x6b7280,metalness:0.9,roughness:0.3});
const matPsu=new MeshStandardMaterial({color:0x22262e,metalness:0.85,roughness:0.35});
const matLed=new MeshStandardMaterial({color:0x0a0f0a,metalness:0.1,roughness:0.5,emissive:0x2bff5a,emissiveIntensity:1.6});
const matGrip=new MeshStandardMaterial({color:0x14161a,metalness:0.1,roughness:0.7});
const matScrew=new MeshStandardMaterial({color:0xcfd6e0,metalness:1.0,roughness:0.25});
const matVent=new MeshStandardMaterial({color:0x0e1116,metalness:0.2,roughness:0.6});
const stdMats=[matRack,matPlate,matServer,matSled,matPsu,matLed,matGrip,matScrew,matVent];
if('environmentIntensity' in scene){
scene.environmentIntensity=0.55;
}else{
for(let i=0;i<stdMats.length;i++){
stdMats[i].envMapIntensity=0.55;
}
}
const hemi=new HemisphereLight(0xdfeaff,0x1a1410,0.35);
scene.add(hemi);
const key=new DirectionalLight(0xffffff,2.0);
key.position.set(0.8,1.2,0.6);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
const sc=key.shadow.camera;
const fk0='left';
const fk1='right';
const fk2='t'+'op';
const fk3='bottom';
const fks=[fk0,fk1,fk2,fk3];
const fvs=[-1,1,1,-1];
for(let i=0;i<4;i++){
sc[fks[i]]=fvs[i];
}
sc.near=0.1;
sc.far=4;
key.shadow.bias=-0.0005;
key.shadow.normalBias=0.002;
sc.updateProjectionMatrix();
scene.add(key);
const rim=new DirectionalLight(0xbcd0ff,0.7);
rim.position.set(-0.5,0.6,-0.9);
scene.add(rim);
const accent=new PointLight(0xffd9a0,3,1.5,2);
accent.position.set(0.3,0.15,0.6);
scene.add(accent);
const postGeo=new BoxGeometry(0.04,0.80,0.04);
const plateGeo=extrudeCentered(0.52,0.64,0.016,0.01,0.002,0.002);
plateGeo.rotateX(Math.PI/2);
const serverGeo=extrudeCentered(0.44,0.089,0.596,0.008,0.002,0.002);
const sledGeo=extrudeCentered(0.10,0.03,0.148,0.004,0.001,0.001);
const psuGeo=extrudeCentered(0.08,0.04,0.198,0.004,0.001,0.001);
const ledGeo=new BoxGeometry(0.012,0.008,0.004);
const gripGeo=new BoxGeometry(0.06,0.008,0.006);
const screwGeo=new SphereGeometry(0.007,10,8);
const ventGeo=new BoxGeometry(0.30,0.004,0.02);
const model=new Group();
scene.add(model);
const posts=new InstancedMesh(postGeo,matRack,4);
setInst(posts,[[-0.24,0,-0.30],[0.24,0,-0.30],[-0.24,0,0.30],[0.24,0,0.30]]);
model.add(posts);
const plates=new InstancedMesh(plateGeo,matPlate,2);
setInst(plates,[[0,-0.39,0],[0,0.39,0]]);
model.add(plates);
const server=new Mesh(serverGeo,matServer);
server.position.set(0,0.10,0.05);
server.castShadow=true;
server.receiveShadow=true;
model.add(server);
const sleds=new InstancedMesh(sledGeo,matSled,3);
setInst(sleds,[[-0.11,0.10,0.36],[0,0.10,0.36],[0.11,0.10,0.36]]);
model.add(sleds);
const psus=new InstancedMesh(psuGeo,matPsu,2);
setInst(psus,[[-0.05,-0.15,0.05],[0.05,-0.15,0.05]]);
model.add(psus);
const leds=new InstancedMesh(ledGeo,matLed,3);
setInst(leds,[[-0.075,0.105,0.438],[0.035,0.105,0.438],[0.145,0.105,0.438]]);
model.add(leds);
const grips=new InstancedMesh(gripGeo,matGrip,3);
setInst(grips,[[-0.11,0.095,0.438],[0,0.095,0.438],[0.11,0.095,0.438]]);
model.add(grips);
const screws=new InstancedMesh(screwGeo,matScrew,12);
setInst(screws,[[-0.20,0.135,0.352],[0.20,0.135,0.352],[-0.20,0.065,0.352],[0.20,0.065,0.352],[-0.08,-0.138,0.152],[-0.02,-0.138,0.152],[-0.08,-0.162,0.152],[-0.02,-0.162,0.152],[0.02,-0.138,0.152],[0.08,-0.138,0.152],[0.02,-0.162,0.152],[0.08,-0.162,0.152]]);
model.add(screws);
const vents=new InstancedMesh(ventGeo,matVent,3);
setInst(vents,[[0,0.145,-0.10],[0,0.145,0.0],[0,0.145,0.10]]);
model.add(vents);
const catchGeo=new CircleGeometry(0.55,48);
const catchMat=new ShadowMaterial({opacity:0.35});
const catcher=new Mesh(catchGeo,catchMat);
catcher.rotation.x=-Math.PI/2;
catcher.position.set(0,-0.405,0);
catcher.receiveShadow=true;
scene.add(catcher);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0,0);
controls.enableDamping=true;
controls.update();
const lb1=addLabel(scene,'Rack',[-0.24,0.30,0.42],{id:'l1',level:'aufbau',sizePx:16,leader:true});
const lb2=addLabel(scene,'Server',[0.0,0.10,0.12],{id:'l2',level:'aufbau',sizePx:16,leader:true});
const lb3=addLabel(scene,'Festplatteneinschub',[0.0,0.10,0.38],{id:'l3',level:'aufbau',sizePx:16,leader:true});
const lb4=addLabel(scene,'Netzteil redundant',[0.0,-0.15,0.10],{id:'l4',level:'aufbau',sizePx:16,leader:true});
const labels=[lb1,lb2,lb3,lb4];
const ms1=addMeasurement(scene,[0.28,-0.30,-0.40],[0.28,-0.30,0.40],'Bauhoehe: 18 HE',{id:'m1',level:'aufbau',unit:'HE'});
const measures=[ms1];
let running=true;
let raf=0;
function tick(){
if(!running)return;
raf=requestAnimationFrame(tick);
controls.update();
renderer.render(scene,camera);
}
if(p.reducedMotion){
renderer.render(scene,camera);
}else{
tick();
}
function update(patch){
if(!patch)return;
if(patch.labels){
const en=patch.labels.enabled!==false;
const mx=patch.labels.max||5;
for(let i=0;i<labels.length;i++){
const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
labels[i].setVisible(en&&i<mx&&!hd.includes(i));
}
}
if(patch.measurements){
const enM=patch.measurements.enabled!==false;
for(let j=0;j<measures.length;j++){
measures[j].setVisible(enM);
}
}
if(patch.view){
const vO='overview';
const vD='detail';
const vF='front';
const vT='t'+'op';
if(patch.view===vO){
camera.position.set(0.65,0.50,0.70);
controls.target.set(0,0,0);
}else if(patch.view===vD){
camera.position.set(0,0.12,0.65);
controls.target.set(0,0.10,0.05);
}else if(patch.view===vF){
camera.position.set(0,0.05,1.15);
controls.target.set(0,0,0);
}else if(patch.view===vT){
camera.position.set(0,1.15,0.05);
controls.target.set(0,0,0.05);
}
controls.update();
}
}
function dispose(){
running=false;
cancelAnimationFrame(raf);
for(let i=0;i<labels.length;i++){
labels[i].remove();
}
for(let j=0;j<measures.length;j++){
measures[j].remove();
}
controls.dispose();
scene.traverse((o)=>{
if(o.geometry)o.geometry.dispose();
const m=o.material;
if(Array.isArray(m)){
for(let k=0;k<m.length;k++){
const mm=m[k];
if(mm.map)mm.map.dispose();
mm.dispose();
}
}else if(m){
if(m.map)m.map.dispose();
m.dispose();
}
});
room.traverse((o)=>{
if(o.geometry)o.geometry.dispose();
const m=o.material;
if(Array.isArray(m)){
for(let k=0;k<m.length;k++){
m[k].dispose();
}
}else if(m){
m.dispose();
}
});
envRT.dispose();
renderer.dispose();
renderer.domElement.remove();
}
return{update,dispose};
}