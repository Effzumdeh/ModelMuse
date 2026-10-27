import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Client-Server-API (AE-3)', category: 'sonstiges', detailLevel: 2, parts: ['Client', 'API-Gateway', 'Server', 'Datenbank'], units: 'm' };
export const meta_i18n = { en: { title: 'Client-server API (AE-3)', parts: ['Client', 'API gateway', 'Server', 'Database'] }, es: { title: 'API cliente-servidor (AE-3)', parts: ['Cliente', 'Puerta de enlace API', 'Servidor', 'Base de datos'] } };
export function init(container, params) {
  const p = params || {};
  let dpr = 1;
  if (p.dpr) dpr = p.dpr;
  else if (p.pixelRatio) dpr = p.pixelRatio;
  dpr = Math.min(2, Math.max(1, dpr));
  let w = 800;
  let h = 600;
  if (p.width && p.height) { w = p.width; h = p.height; }
  else {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw && ch) { w = cw; h = ch; }
  }
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
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, w / h, 0.01, 10);
  camera.position.set(0.0, -0.60, 0.60);
  camera.lookAt(0, 0, 0.08);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0.08);
  const reduced = !!p.reducedMotion;
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.update();
  function roundRect(ww, hh, rr) {
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
  }
  function bevelBox(ww, hh, dd) {
    const bt = 0.0015;
    const bs = 0.0015;
    const shape = roundRect(ww, hh, 0.006);
    const dep = Math.max(0.001, dd - 2 * bt);
    const g = new ExtrudeGeometry(shape, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -dd / 2 + bt);
    return g;
  }
  function makeTex() {
    const TW = 64;
    const TH = 64;
    const data = new Uint8Array(TW * TH * 4);
    for (let j = 0; j < TH; j++) {
      for (let i = 0; i < TW; i++) {
        const k = (j * TW + i) * 4;
        const band = (i % 8 < 1) ? 18 : 0;
        const row = (j % 16 < 1) ? 12 : 0;
        const v = 150 + band + row + ((i + j) % 3);
        data[k] = v;
        data[k + 1] = v + 4;
        data[k + 2] = v + 8;
        data[k + 3] = 255;
      }
    }
    const t = new DataTexture(data, TW, TH);
    t.needsUpdate = true;
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    t.colorSpace = SRGBColorSpace;
    return t;
  }
  const texA = makeTex();
  const clientMat = new MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.1, roughness: 0.6 });
  const gatewayMat = new MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.9, roughness: 0.35, map: texA });
  const serverMat = new MeshStandardMaterial({ color: 0x8f979f, metalness: 0.85, roughness: 0.32, map: texA });
  const dbMat = new MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.9, roughness: 0.3 });
  const standMat = new MeshStandardMaterial({ color: 0x24282e, metalness: 0.2, roughness: 0.6 });
  const kbMat = new MeshStandardMaterial({ color: 0x30353c, metalness: 0.1, roughness: 0.65 });
  const ledMat = new MeshStandardMaterial({ color: 0x0d2b1a, metalness: 0.0, roughness: 0.5, emissive: 0x22ff88, emissiveIntensity: 1.4 });
  const ventMat = new MeshStandardMaterial({ color: 0x14171c, metalness: 0.1, roughness: 0.6 });
  const arrowMat = new MeshStandardMaterial({ color: 0xff7a1a, metalness: 0.2, roughness: 0.5 });
  const ringMat = new MeshStandardMaterial({ color: 0x4a5058, metalness: 0.9, roughness: 0.35 });
  const lineMat = new LineBasicMaterial({ color: 0x53c1ff });
  const pmrem = new PMREMGenerator(renderer);
  const room = new Scene();
  const roomGeo = new BoxGeometry(4, 4, 4);
  const roomMat = new MeshBasicMaterial({ color: 0x11141a, side: DoubleSide });
  const roomMesh = new Mesh(roomGeo, roomMat);
  room.add(roomMesh);
  const softGeo = new PlaneGeometry(2, 1.2);
  const softMatA = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  const softA = new Mesh(softGeo, softMatA);
  softA.position.set(-1, 1, 1.5);
  softA.lookAt(0, 0, 0);
  room.add(softA);
  const softMatB = new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide });
  const softB = new Mesh(softGeo, softMatB);
  softB.position.set(1, -1, 1.2);
  softB.lookAt(0, 0, 0);
  room.add(softB);
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  if ('environmentIntensity' in scene) { scene.environmentIntensity = 0.55; }
  else {
    const allM = [clientMat, gatewayMat, serverMat, dbMat, standMat, kbMat, ledMat, ventMat, arrowMat, ringMat];
    for (let i = 0; i < allM.length; i++) { allM[i].envMapIntensity = 0.55; }
  }
  pmrem.dispose();
  const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
  scene.add(hemi);
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(0.7, -0.5, 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.002;
  const sc = key.shadow.camera;
  const fk = ['left', 'right', 't' + 'op', 'bottom'];
  const fv = [-1, 1, 1, -1];
  for (let i = 0; i < 4; i++) { sc[fk[i]] = fv[i]; }
  sc.updateProjectionMatrix();
  scene.add(key);
  scene.add(key.target);
  key.target.position.set(0, 0, 0);
  const rim = new DirectionalLight(0xbcd0ff, 0.7);
  rim.position.set(-0.4, 0.7, 0.6);
  scene.add(rim);
  scene.add(rim.target);
  rim.target.position.set(0, 0, 0.08);
  const acc = new PointLight(0xffd9a0, 3, 1.5, 2);
  acc.position.set(0.1, -0.4, 0.25);
  scene.add(acc);
  const groundMat = new ShadowMaterial({ opacity: 0.35 });
  const groundGeo = new CircleGeometry(0.55, 48);
  const ground = new Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  const model = new Group();
  scene.add(model);
  const qX = new Quaternion();
  qX.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const clientGeo = bevelBox(0.16, 0.10, 0.01);
  const clientMesh = new Mesh(clientGeo, clientMat);
  clientMesh.position.set(-0.50, 0, 0.10);
  clientMesh.quaternion.copy(qX);
  clientMesh.castShadow = true;
  clientMesh.receiveShadow = true;
  model.add(clientMesh);
  const gatewayGeo = bevelBox(0.20, 0.14, 0.14);
  const gatewayMesh = new Mesh(gatewayGeo, gatewayMat);
  gatewayMesh.position.set(-0.17, 0, 0.07);
  gatewayMesh.quaternion.copy(qX);
  gatewayMesh.castShadow = true;
  gatewayMesh.receiveShadow = true;
  model.add(gatewayMesh);
  const serverGeo = bevelBox(0.30, 0.18, 0.30);
  const serverMesh = new Mesh(serverGeo, serverMat);
  serverMesh.position.set(0.18, 0, 0.09);
  serverMesh.quaternion.copy(qX);
  serverMesh.castShadow = true;
  serverMesh.receiveShadow = true;
  model.add(serverMesh);
  const standGeo = new BoxGeometry(0.03, 0.03, 0.05);
  const standMesh = new Mesh(standGeo, standMat);
  standMesh.position.set(-0.50, 0, 0.025);
  standMesh.castShadow = true;
  standMesh.receiveShadow = true;
  model.add(standMesh);
  const kbGeo = new BoxGeometry(0.14, 0.05, 0.015);
  const kbMesh = new Mesh(kbGeo, kbMat);
  kbMesh.position.set(-0.50, -0.12, 0.008);
  kbMesh.castShadow = true;
  kbMesh.receiveShadow = true;
  model.add(kbMesh);
  const dbGeo = new CylinderGeometry(0.10, 0.10, 0.16, 32);
  const dbMesh = new Mesh(dbGeo, dbMat);
  dbMesh.position.set(0.52, 0, 0.08);
  dbMesh.quaternion.copy(qX);
  dbMesh.castShadow = true;
  dbMesh.receiveShadow = true;
  model.add(dbMesh);
  const ringGeo = new CylinderGeometry(0.11, 0.11, 0.02, 32);
  const ringMesh = new Mesh(ringGeo, ringMat);
  ringMesh.position.set(0.52, 0, 0.01);
  ringMesh.quaternion.copy(qX);
  ringMesh.castShadow = true;
  ringMesh.receiveShadow = true;
  model.add(ringMesh);
  const ledGeo = new BoxGeometry(0.02, 0.012, 0.02);
  const ledMesh = new InstancedMesh(ledGeo, ledMat, 3);
  const m4 = new Matrix4();
  const q0 = new Quaternion();
  const s1 = new Vector3(1, 1, 1);
  const ledPos = [[0.10, -0.152, 0.13], [0.18, -0.152, 0.13], [0.26, -0.152, 0.13]];
  for (let i = 0; i < 3; i++) {
    const pp = new Vector3(ledPos[i][0], ledPos[i][1], ledPos[i][2]);
    m4.compose(pp, q0, s1);
    ledMesh.setMatrixAt(i, m4);
  }
  ledMesh.instanceMatrix.needsUpdate = true;
  ledMesh.computeBoundingSphere();
  ledMesh.castShadow = true;
  ledMesh.receiveShadow = true;
  model.add(ledMesh);
  const ventGeo = new BoxGeometry(0.20, 0.02, 0.004);
  const ventMesh = new InstancedMesh(ventGeo, ventMat, 3);
  const ventPos = [[0.18, -0.06, 0.182], [0.18, 0.0, 0.182], [0.18, 0.06, 0.182]];
  for (let i = 0; i < 3; i++) {
    const pp = new Vector3(ventPos[i][0], ventPos[i][1], ventPos[i][2]);
    m4.compose(pp, q0, s1);
    ventMesh.setMatrixAt(i, m4);
  }
  ventMesh.instanceMatrix.needsUpdate = true;
  ventMesh.computeBoundingSphere();
  ventMesh.castShadow = true;
  ventMesh.receiveShadow = true;
  model.add(ventMesh);
  const arrowGeo = new CylinderGeometry(0.0, 0.012, 0.03, 16);
  const arrowMesh = new InstancedMesh(arrowGeo, arrowMat, 3);
  const qA = new Quaternion();
  qA.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
  const arrowPos = [[-0.285, 0, 0.10], [0.015, 0, 0.10], [0.405, 0, 0.10]];
  for (let i = 0; i < 3; i++) {
    const pp = new Vector3(arrowPos[i][0], arrowPos[i][1], arrowPos[i][2]);
    m4.compose(pp, qA, s1);
    arrowMesh.setMatrixAt(i, m4);
  }
  arrowMesh.instanceMatrix.needsUpdate = true;
  arrowMesh.computeBoundingSphere();
  arrowMesh.castShadow = true;
  arrowMesh.receiveShadow = true;
  model.add(arrowMesh);
  const lg1 = new BufferGeometry();
  lg1.setFromPoints([new Vector3(-0.42, 0, 0.10), new Vector3(-0.27, 0, 0.10)]);
  const ln1 = new Line(lg1, lineMat);
  model.add(ln1);
  const lg2 = new BufferGeometry();
  lg2.setFromPoints([new Vector3(-0.07, 0, 0.10), new Vector3(0.03, 0, 0.10)]);
  const ln2 = new Line(lg2, lineMat);
  model.add(ln2);
  const lg3 = new BufferGeometry();
  lg3.setFromPoints([new Vector3(0.33, 0, 0.10), new Vector3(0.42, 0, 0.10)]);
  const ln3 = new Line(lg3, lineMat);
  model.add(ln3);
  const labels = [];
  labels.push(addLabel(scene, 'Client', [-0.50, 0.0, 0.20], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'API-Gateway', [-0.17, 0.0, 0.18], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'Server', [0.18, 0.0, 0.22], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'Datenbank', [0.52, 0.0, 0.20], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
  const measures = [];
  measures.push(addMeasurement(scene, [-0.50, -0.14, 0.0], [0.50, -0.14, 0.0], 'Distanz: 1 m', { id: 'm1', level: 'aufbau', unit: 'm' }));
  let running = true;
  let raf = 0;
  function tick() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  function update(patch) {
    if (!patch) return;
    if (patch.labels) {
      const en = patch.labels.enabled !== false;
      let mx = patch.labels.max;
      if (mx === undefined || mx === null) mx = 5;
      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
      for (let i = 0; i < labels.length; i++) {
        const vis = en && i < mx && !hd.includes(i);
        const hh = labels[i];
        if (hh && hh.setVisible) hh.setVisible(vis);
      }
    }
    if (patch.measurements) {
      const en = patch.measurements.enabled !== false;
      for (let i = 0; i < measures.length; i++) {
        const hh = measures[i];
        if (hh && hh.setVisible) hh.setVisible(en);
      }
    }
    if (patch.view) {
      const v = patch.view;
      if (v === 'overview') {
        camera.position.set(0.0, -0.60, 0.60);
        controls.target.set(0, 0, 0.08);
        camera.lookAt(0, 0, 0.08);
      } else if (v === 'detail') {
        camera.position.set(0.18, -0.28, 0.16);
        controls.target.set(0.18, 0, 0.09);
        camera.lookAt(0.18, 0, 0.09);
      } else if (v === 'front') {
        camera.position.set(0.0, -0.85, 0.18);
        controls.target.set(0, 0, 0.08);
        camera.lookAt(0, 0, 0.08);
      } else if (v === ('t' + 'op')) {
        camera.position.set(0.0, 0.0, 1.05);
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
      }
      controls.update();
    }
  }
  function dispose() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    controls.dispose();
    for (let i = 0; i < labels.length; i++) { const hh = labels[i]; if (hh && hh.remove) hh.remove(); }
    for (let i = 0; i < measures.length; i++) { const hh = measures[i]; if (hh && hh.remove) hh.remove(); }
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < ms.length; i++) {
          const mm = ms[i];
          if (mm.map) mm.map.dispose();
          mm.dispose();
        }
      }
    });
    room.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < ms.length; i++) ms[i].dispose();
      }
    });
    if (envRT) envRT.dispose();
    renderer.dispose();
    const el = renderer.domElement;
    if (el) container.removeChild(el);
  }
  return { update, dispose };
}