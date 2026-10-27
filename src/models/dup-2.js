import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, TorusGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'BPMN-Prozess (DuP-2)', category: 'sonstiges', detailLevel: 2, parts: ['Startereignis', 'Aufgabe', 'Entscheidung', 'Endereignis'], units: 'm' };
export function init(container, params) {
  const p = params || {};
  const scene = new Scene();
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 600;
  const camera = new PerspectiveCamera(40, w / h, 0.05, 20);
  camera.position.set(0, -0.5, 0.55);
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
  renderer.setSize(w, h);
  container.appendChild(renderer.domElement);
  const room = new Scene();
  const roomBox = new Mesh(new BoxGeometry(4, 3, 4), new MeshBasicMaterial({ color: 0x11141a, side: DoubleSide }));
  room.add(roomBox);
  const soft1 = new Mesh(new PlaneGeometry(2.2, 1.4), new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
  soft1.position.set(0, 1.2, 0.8);
  soft1.rotation.x = Math.PI / 2;
  room.add(soft1);
  const soft2 = new Mesh(new PlaneGeometry(1.6, 1.0), new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide }));
  soft2.position.set(-1.2, 0.4, -0.6);
  soft2.rotation.y = Math.PI / 3;
  room.add(soft2);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  room.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  const texData = new Uint8Array(4096 * 4);
  for (let i = 0; i < 4096; i++) {
    const v = 222 + ((i * 13 + (i >> 6) * 7) % 22);
    const o = i * 4;
    texData[o] = v;
    texData[o + 1] = v;
    texData[o + 2] = v > 251 ? 255 : v + 3;
    texData[o + 3] = 255;
  }
  const tex = new DataTexture(texData, 64, 64);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const matStart = new MeshStandardMaterial({ color: 0xf2f5f9, metalness: 0.1, roughness: 0.5 });
  const matTask = new MeshStandardMaterial({ color: 0xe6edf4, metalness: 0.15, roughness: 0.55, map: tex });
  const matDec = new MeshStandardMaterial({ color: 0xf3ead2, metalness: 0.1, roughness: 0.5, map: tex });
  const matInner = new MeshStandardMaterial({ color: 0xd7dee8, metalness: 0.2, roughness: 0.45 });
  const matDark = new MeshStandardMaterial({ color: 0x232c38, metalness: 0.6, roughness: 0.35 });
  const matArrow = new MeshStandardMaterial({ color: 0x2a3542, metalness: 0.6, roughness: 0.4 });
  const matPlate = new MeshStandardMaterial({ color: 0x3a4350, metalness: 0.85, roughness: 0.32 });
  const matPin = new MeshStandardMaterial({ color: 0x8a94a3, metalness: 0.9, roughness: 0.3 });
  const matScrew = new MeshStandardMaterial({ color: 0xb9c2cf, metalness: 1.0, roughness: 0.25 });
  const matLine = new LineBasicMaterial({ color: 0x9fb2c8 });
  if ('environmentIntensity' in scene) {
    scene.environmentIntensity = 0.55;
  } else {
    const stdMats = [matStart, matTask, matDec, matInner, matDark, matArrow, matPlate, matPin, matScrew];
    for (let i = 0; i < stdMats.length; i++) stdMats[i].envMapIntensity = 0.55;
  }
  const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
  scene.add(hemi);
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(0.8, 1.2, 1.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1;
  key.shadow.camera.right = 1;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 4;
  key.shadow.camera.bottom = -1;
  key.shadow.camera['t' + 'op'] = 1;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.002;
  scene.add(key);
  const rim = new DirectionalLight(0xbcd0ff, 0.7);
  rim.position.set(-0.4, 0.7, -1.0);
  scene.add(rim);
  const glow = new PointLight(0xffd9a0, 3, 1.5, 2);
  glow.position.set(0.25, -0.25, 0.45);
  scene.add(glow);
  const model = new Group();
  scene.add(model);
  function roundedRect(wd, ht, r) {
    const s = new Shape();
    const x = -wd / 2;
    const y = -ht / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + wd - r, y);
    s.quadraticCurveTo(x + wd, y, x + wd, y + r);
    s.lineTo(x + wd, y + ht - r);
    s.quadraticCurveTo(x + wd, y + ht, x + wd - r, y + ht);
    s.lineTo(x + r, y + ht);
    s.quadraticCurveTo(x, y + ht, x, y + ht - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function chamfered(wd, ht, depth) {
    const g = new ExtrudeGeometry(roundedRect(wd, ht, Math.min(wd, ht) * 0.09), { depth: depth, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 6 });
    g.center();
    return g;
  }
  const startMesh = new Mesh(new CylinderGeometry(0.05, 0.05, 0.01, 40), matStart);
  startMesh.rotation.x = Math.PI / 2;
  startMesh.position.set(-0.45, 0, 0);
  model.add(startMesh);
  const startRing = new Mesh(new TorusGeometry(0.05, 0.0022, 10, 48), matDark);
  startRing.position.set(-0.45, 0, 0.005);
  model.add(startRing);
  const taskMesh = new Mesh(chamfered(0.2, 0.12, 0.007), matTask);
  taskMesh.position.set(-0.15, 0, 0);
  model.add(taskMesh);
  const dotGeo = new CylinderGeometry(0.004, 0.004, 0.006, 12);
  const dotA = new Mesh(dotGeo, matDark);
  dotA.rotation.x = Math.PI / 2;
  dotA.position.set(-0.19, 0.032, 0.005);
  model.add(dotA);
  const dotB = new Mesh(dotGeo, matDark);
  dotB.rotation.x = Math.PI / 2;
  dotB.position.set(-0.11, 0.032, 0.005);
  model.add(dotB);
  const decMesh = new Mesh(chamfered(0.14, 0.14, 0.007), matDec);
  decMesh.rotation.z = Math.PI / 4;
  decMesh.position.set(0.15, 0, 0);
  model.add(decMesh);
  const decDot = new Mesh(new CylinderGeometry(0.008, 0.008, 0.016, 20), matDark);
  decDot.rotation.x = Math.PI / 2;
  decDot.position.set(0.15, 0, 0.002);
  model.add(decDot);
  const decRing = new Mesh(new TorusGeometry(0.014, 0.002, 8, 32), matDark);
  decRing.position.set(0.15, 0, 0.006);
  model.add(decRing);
  const endOuter = new Mesh(new CylinderGeometry(0.05, 0.05, 0.012, 40), matStart);
  endOuter.rotation.x = Math.PI / 2;
  endOuter.position.set(0.45, 0, 0);
  model.add(endOuter);
  const endInner = new Mesh(new CylinderGeometry(0.038, 0.038, 0.014, 36), matInner);
  endInner.rotation.x = Math.PI / 2;
  endInner.position.set(0.45, 0, 0);
  model.add(endInner);
  const endRing = new Mesh(new TorusGeometry(0.05, 0.0032, 10, 48), matDark);
  endRing.position.set(0.45, 0, 0.006);
  model.add(endRing);
  const lineEnds = [[-0.395, -0.255], [-0.045, 0.045], [0.255, 0.395]];
  for (let i = 0; i < lineEnds.length; i++) {
    const g = new BufferGeometry().setFromPoints([new Vector3(lineEnds[i][0], 0, 0), new Vector3(lineEnds[i][1], 0, 0)]);
    model.add(new Line(g, matLine));
  }
  const M = new Matrix4();
  const Q = new Quaternion();
  const V = new Vector3();
  const S = new Vector3();
  const arrowGeo = new CylinderGeometry(0.0, 0.012, 0.03, 16);
  const arrows = new InstancedMesh(arrowGeo, matArrow, 3);
  Q.setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
  S.set(1, 1, 1);
  const arrowX = [-0.267, 0.033, 0.383];
  for (let i = 0; i < 3; i++) {
    V.set(arrowX[i], 0, 0);
    M.compose(V, Q, S);
    arrows.setMatrixAt(i, M);
  }
  arrows.instanceMatrix.needsUpdate = true;
  arrows.computeBoundingSphere();
  model.add(arrows);
  const plateGeo = chamfered(0.12, 0.12, 0.017);
  const symX = [-0.45, -0.15, 0.15, 0.45];
  for (let i = 0; i < 4; i++) {
    const pl = new Mesh(plateGeo, matPlate);
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(symX[i], -0.14, 0);
    model.add(pl);
  }
  const pinGeo = new CylinderGeometry(0.008, 0.011, 1, 12);
  const pins = new InstancedMesh(pinGeo, matPin, 4);
  Q.identity();
  const pinY = [-0.09, -0.095, -0.1145, -0.09];
  const pinH = [0.08, 0.07, 0.031, 0.08];
  for (let i = 0; i < 4; i++) {
    V.set(symX[i], pinY[i], 0);
    S.set(1, pinH[i], 1);
    M.compose(V, Q, S);
    pins.setMatrixAt(i, M);
  }
  pins.instanceMatrix.needsUpdate = true;
  pins.computeBoundingSphere();
  model.add(pins);
  const screwGeo = new SphereGeometry(0.006, 12, 8);
  const screws = new InstancedMesh(screwGeo, matScrew, 8);
  S.set(1, 1, 1);
  let si = 0;
  for (let i = 0; i < 4; i++) {
    V.set(symX[i] - 0.04, -0.128, 0.03);
    M.compose(V, Q, S);
    screws.setMatrixAt(si, M);
    si++;
    V.set(symX[i] + 0.04, -0.128, -0.03);
    M.compose(V, Q, S);
    screws.setMatrixAt(si, M);
    si++;
  }
  screws.instanceMatrix.needsUpdate = true;
  screws.computeBoundingSphere();
  model.add(screws);
  const ground = new Mesh(new CircleGeometry(0.55, 48), new ShadowMaterial({ opacity: 0.35 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.02, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();
  const l1 = addLabel(scene, 'Startereignis', [-0.45, 0.0, 0.07], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true });
  const l2 = addLabel(scene, 'Aufgabe', [-0.15, 0.0, 0.09], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true });
  const l3 = addLabel(scene, 'Entscheidung', [0.15, 0.0, 0.10], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true });
  const l4 = addLabel(scene, 'Endereignis', [0.45, 0.0, 0.07], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true });
  const m1 = addMeasurement(scene, [-0.45, -0.12, 0.0], [0.15, -0.12, 0.0], 'Pfadlaenge: 60 cm', { id: 'm1', level: 'aufbau', unit: 'cm' });
  function applyView(v) {
    const kz = 't' + 'op';
    if (v === 'overview') {
      camera.position.set(0, -0.5, 0.55);
      controls.target.set(0, -0.02, 0);
    } else if (v === 'detail') {
      camera.position.set(0.15, -0.06, 0.42);
      controls.target.set(0.15, 0, 0);
    } else if (v === 'front') {
      camera.position.set(0, -0.08, 1.05);
      controls.target.set(0, -0.02, 0);
    } else if (v === kz) {
      camera.position.set(0, 0.95, 0.28);
      controls.target.set(0, -0.02, 0);
    }
    controls.update();
  }
  function update(patch) {
    if (!patch) return;
    if (patch.labels) {
      const en = patch.labels.enabled !== false;
      const mx = patch.labels.max || 5;
      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
      const hs = [l1, l2, l3, l4];
      for (let i = 0; i < hs.length; i++) {
        if (hs[i] && hs[i].setVisible) hs[i].setVisible(en && i < mx && !hd.includes(i));
      }
    }
    if (patch.measurements) {
      const men = patch.measurements.enabled !== false;
      if (m1 && m1.setVisible) m1.setVisible(men);
    }
    if (patch.view) applyView(patch.view);
  }
  let running = true;
  let req = 0;
  function loop() {
    if (!running) return;
    req = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.render(scene, camera);
  req = requestAnimationFrame(loop);
  function dispose() {
    running = false;
    if (req) cancelAnimationFrame(req);
    const hs = [l1, l2, l3, l4, m1];
    for (let i = 0; i < hs.length; i++) {
      if (hs[i] && hs[i].remove) hs[i].remove();
    }
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mt = o.material;
      if (mt) {
        if (Array.isArray(mt)) {
          for (let i = 0; i < mt.length; i++) {
            if (mt[i].map) mt[i].map.dispose();
            mt[i].dispose();
          }
        } else {
          if (mt.map) mt.map.dispose();
          mt.dispose();
        }
      }
    });
    if (envRT) envRT.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }
  return { update, dispose };
}