import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'Bubblesort-Vergleich (AE-2)', category: 'sonstiges', detailLevel: 2, parts: ['Balkenfeld', 'Vergleichsmarker', 'Tauschpfeil'], units: 'm' };
export function init(container, params) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.01, 10);
  camera.position.set(0, -0.45, 0.55);
  let dpr = 1;
  if (params && params.dpr) dpr = params.dpr;
  dpr = Math.min(2, Math.max(1, dpr));
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x0b0e14, 1);
  renderer.setPixelRatio(dpr);
  const cw = container.clientWidth || 640;
  const ch = container.clientHeight || 480;
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
  renderer.setSize(cw, ch);
  container.appendChild(renderer.domElement);
  const room = new Scene();
  const roomMesh = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial({ color: 0x11141a, side: 1 }));
  room.add(roomMesh);
  const sbGeo = new PlaneGeometry(2, 2);
  const sb1 = new Mesh(sbGeo, new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
  sb1.position.set(0, 1.95, 0.4);
  sb1.rotation.x = Math.PI / 2;
  room.add(sb1);
  const sb2 = new Mesh(sbGeo, new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide }));
  sb2.position.set(-1.9, 0.4, 0.3);
  sb2.rotation.y = Math.PI / 2;
  room.add(sb2);
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  room.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  const hemi = new HemisphereLight(0xdfeaff, 0x1a1410, 0.35);
  scene.add(hemi);
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(0.6, 0.9, 0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.002;
  const fk = ['left', 'right', 't' + 'op', 'bottom'];
  const fvv = [-1, 1, 1, -1];
  for (let i = 0; i < fk.length; i++) key.shadow.camera[fk[i]] = fvv[i];
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  scene.add(key.target);
  const rim = new DirectionalLight(0xbcd0ff, 0.7);
  rim.position.set(-0.3, 0.4, -0.8);
  scene.add(rim);
  const acc = new PointLight(0xffd9a0, 3, 1.5, 2);
  acc.position.set(0.3, 0.1, 0.45);
  scene.add(acc);
  const tw = 64;
  const th = 64;
  const pix = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const n = (y * tw + x) * 4;
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const f = h - Math.floor(h);
      let v = 226 + Math.floor(18 * f) + Math.floor(6 * Math.sin(x * 0.7));
      if (v > 255) v = 255;
      pix[n] = v;
      pix[n + 1] = v;
      pix[n + 2] = v;
      pix[n + 3] = 255;
    }
  }
  const brush = new DataTexture(pix, tw, th);
  brush.colorSpace = SRGBColorSpace;
  brush.magFilter = LinearFilter;
  brush.minFilter = LinearFilter;
  brush.wrapS = RepeatWrapping;
  brush.wrapT = RepeatWrapping;
  brush.needsUpdate = true;
  const barMat = new MeshStandardMaterial({ color: 0x35708f, metalness: 0.85, roughness: 0.32 });
  const cmpMat = new MeshStandardMaterial({ color: 0xff7a1a, metalness: 0.25, roughness: 0.5 });
  const capMat = new MeshStandardMaterial({ color: 0x1c2128, metalness: 0.1, roughness: 0.6 });
  const plateMat = new MeshStandardMaterial({ color: 0xb9c0c7, metalness: 0.9, roughness: 0.38, map: brush });
  const markMat = new MeshStandardMaterial({ color: 0x66d9ff, metalness: 0.0, roughness: 0.15, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide });
  const coneMat = new MeshStandardMaterial({ color: 0xffa726, metalness: 0.4, roughness: 0.4 });
  const swapMat = new LineBasicMaterial({ color: 0xffd166 });
  const axisMat = new LineBasicMaterial({ color: 0x8a93a3 });
  const xs = [-0.25, -0.15, -0.05, 0.05, 0.15, 0.25];
  const hs = [0.10, 0.16, 0.30, 0.22, 0.13, 0.07];
  const baseY = -0.15;
  const barGeo = new BoxGeometry(0.08, 1, 0.02);
  barGeo.translate(0, 0.5, 0);
  const m4 = new Matrix4();
  const q0 = new Quaternion();
  const vP = new Vector3();
  const vS = new Vector3();
  const bars = new InstancedMesh(barGeo, barMat, 4);
  const normIdx = [0, 1, 4, 5];
  for (let k = 0; k < 4; k++) {
    const j = normIdx[k];
    vP.set(xs[j], baseY, 0);
    vS.set(1, hs[j], 1);
    m4.compose(vP, q0, vS);
    bars.setMatrixAt(k, m4);
  }
  bars.instanceMatrix.needsUpdate = true;
  bars.computeBoundingSphere();
  bars.castShadow = true;
  bars.receiveShadow = true;
  scene.add(bars);
  const cmps = new InstancedMesh(barGeo, cmpMat, 2);
  const cmpIdx = [2, 3];
  for (let k = 0; k < 2; k++) {
    const j = cmpIdx[k];
    vP.set(xs[j], baseY, 0);
    vS.set(1, hs[j], 1);
    m4.compose(vP, q0, vS);
    cmps.setMatrixAt(k, m4);
  }
  cmps.instanceMatrix.needsUpdate = true;
  cmps.computeBoundingSphere();
  cmps.castShadow = true;
  cmps.receiveShadow = true;
  scene.add(cmps);
  const capGeo = new BoxGeometry(0.084, 0.008, 0.024);
  const caps = new InstancedMesh(capGeo, capMat, 6);
  for (let i = 0; i < 6; i++) {
    m4.makeTranslation(xs[i], baseY + hs[i] + 0.004, 0);
    caps.setMatrixAt(i, m4);
  }
  caps.instanceMatrix.needsUpdate = true;
  caps.computeBoundingSphere();
  caps.castShadow = true;
  caps.receiveShadow = true;
  scene.add(caps);
  const plateShape = new Shape();
  const pw = 0.62;
  const pd = 0.10;
  const pr = 0.012;
  const px0 = -pw / 2;
  const py0 = -pd / 2;
  plateShape.moveTo(px0 + pr, py0);
  plateShape.lineTo(px0 + pw - pr, py0);
  plateShape.absarc(px0 + pw - pr, py0 + pr, pr, -Math.PI / 2, 0, false);
  plateShape.lineTo(px0 + pw, py0 + pd - pr);
  plateShape.absarc(px0 + pw - pr, py0 + pd - pr, pr, 0, Math.PI / 2, false);
  plateShape.lineTo(px0 + pr, py0 + pd);
  plateShape.absarc(px0 + pr, py0 + pd - pr, pr, Math.PI / 2, Math.PI, false);
  plateShape.lineTo(px0, py0 + pr);
  plateShape.absarc(px0 + pr, py0 + pr, pr, Math.PI, Math.PI * 1.5, false);
  const plateGeo = new ExtrudeGeometry(plateShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 8 });
  plateGeo.rotateX(-Math.PI / 2);
  const plate = new Mesh(plateGeo, plateMat);
  plate.position.set(0, -0.167, 0);
  plate.castShadow = true;
  plate.receiveShadow = true;
  scene.add(plate);
  const markGeo = new BoxGeometry(0.10, 0.32, 0.04);
  const mk1 = new Mesh(markGeo, markMat);
  mk1.position.set(-0.05, 0.01, 0);
  mk1.castShadow = true;
  mk1.receiveShadow = true;
  scene.add(mk1);
  const mk2 = new Mesh(markGeo, markMat);
  mk2.position.set(0.05, 0.01, 0);
  mk2.castShadow = true;
  mk2.receiveShadow = true;
  scene.add(mk2);
  const swapGeo = new BufferGeometry().setFromPoints([new Vector3(-0.05, 0.22, 0), new Vector3(0.05, 0.22, 0)]);
  const sw1 = new Line(swapGeo, swapMat);
  sw1.position.z = 0.012;
  scene.add(sw1);
  const sw2 = new Line(swapGeo, swapMat);
  sw2.position.z = -0.012;
  scene.add(sw2);
  const coneGeo = new CylinderGeometry(0, 0.015, 0.035, 24);
  const cones = new InstancedMesh(coneGeo, coneMat, 2);
  const axisZ = new Vector3(0, 0, 1);
  const qA = new Quaternion().setFromAxisAngle(axisZ, -Math.PI / 2);
  vP.set(0.0325, 0.22, 0.012);
  vS.set(1, 1, 1);
  m4.compose(vP, qA, vS);
  cones.setMatrixAt(0, m4);
  const qB = new Quaternion().setFromAxisAngle(axisZ, Math.PI / 2);
  vP.set(-0.0325, 0.22, -0.012);
  m4.compose(vP, qB, vS);
  cones.setMatrixAt(1, m4);
  cones.instanceMatrix.needsUpdate = true;
  cones.computeBoundingSphere();
  cones.castShadow = true;
  cones.receiveShadow = true;
  scene.add(cones);
  const axisGeo = new BufferGeometry().setFromPoints([new Vector3(-0.30, -0.148, 0.035), new Vector3(0.30, -0.148, 0.035)]);
  const axis = new Line(axisGeo, axisMat);
  scene.add(axis);
  const gGeo = new CircleGeometry(0.55, 48);
  gGeo.rotateX(-Math.PI / 2);
  const ground = new Mesh(gGeo, new ShadowMaterial({ opacity: 0.35 }));
  ground.position.set(0, -0.172, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  if (scene.environmentIntensity === undefined) {
    scene.traverse((o) => {
      if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.55;
    });
  } else {
    scene.environmentIntensity = 0.55;
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.1;
  controls.maxDistance = 3;
  controls.update();
  const h1 = addLabel(scene, 'Balkenfeld', [-0.25, -0.15, 0.05], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true });
  const h2 = addLabel(scene, 'Vergleichsmarker', [0, 0.10, 0.08], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true });
  const h3 = addLabel(scene, 'Tauschpfeil', [0, 0.22, 0.05], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true });
  const labelHandles = [h1, h2, h3];
  const m1 = addMeasurement(scene, [-0.09, -0.15, 0.03], [-0.09, 0.15, 0.03], 'Balkenhoehe: 30 cm', { id: 'm1', level: 'aufbau', unit: 'cm' });
  const measureHandles = [m1];
  const wUp = 't' + 'op';
  function setView(v) {
    if (v === 'overview') {
      camera.position.set(0, -0.45, 0.55);
      controls.target.set(0, 0, 0);
    } else if (v === 'detail') {
      camera.position.set(0, 0.01, 0.40);
      controls.target.set(0, 0.01, 0);
    } else if (v === 'front') {
      camera.position.set(0, 0.02, 0.80);
      controls.target.set(0, 0, 0);
    } else if (v === wUp) {
      camera.position.set(0, 0.85, 0.002);
      controls.target.set(0, 0, 0);
    } else {
      return;
    }
    controls.update();
  }
  function update(patch) {
    if (!patch) return;
    if (patch.labels) {
      const en = patch.labels.enabled !== false;
      let mx = patch.labels.max;
      if (mx === undefined || mx === null) mx = 5;
      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
      for (let i = 0; i < labelHandles.length; i++) labelHandles[i].setVisible(en && i < mx && !hd.includes(i));
    }
    if (patch.measurements) {
      const men = patch.measurements.enabled !== false;
      for (let i = 0; i < measureHandles.length; i++) measureHandles[i].setVisible(men);
    }
    if (patch.view !== undefined && patch.view !== null) setView(patch.view);
  }
  let running = true;
  let raf = 0;
  function loop() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    controls.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) {
        for (let i = 0; i < m.length; i++) {
          if (m[i].map) m[i].map.dispose();
          m[i].dispose();
        }
      } else if (m) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    if (envRT) envRT.dispose();
    renderer.dispose();
    try {
      container.removeChild(renderer.domElement);
    } catch (e) {
    }
  }
  return { update, dispose };
}