import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh, MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, TorusGeometry, ExtrudeGeometry, Shape, DataTexture, DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial, DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion, PMREMGenerator } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { addLabel, addMeasurement } from 'wrapper-helpers';
export const meta = { title: 'ETL-Pipeline (DuP-3)', category: 'sonstiges', detailLevel: 2, parts: ['Quelle', 'ETL-Stufe', 'Speicher', 'Zielsystem'], units: 'm' };
export const meta_i18n = { en: { title: 'ETL pipeline (DuP-3)', parts: ['Source', 'ETL stage', 'Storage', 'Target system'] }, es: { title: 'Pipeline ETL (DuP-3)', parts: ['Fuente', 'Etapa ETL', 'Almacenamiento', 'Sistema destino'] } };
export function init(container, params) {
  const p = params || {};
  const dprRaw = p.dpr || 1;
  const dpr = Math.min(2, Math.max(1, dprRaw));
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x0b0e14, 1);
  renderer.setPixelRatio(dpr);
  const cw = container.clientWidth || 800;
  const ch = container.clientHeight || 600;
  renderer.setSize(cw, ch);
  container.appendChild(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(60, cw / ch, 0.01, 10);
  camera.position.set(0.0, -0.55, 0.60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.02, 0, 0.08);
  controls.update();
  function bevelBox(w, d, h) {
    const bt = Math.min(0.004, h * 0.2);
    const bs = Math.min(0.004, Math.min(w, d) * 0.15);
    const sw = w - 2 * bs;
    const sd = d - 2 * bs;
    const sr = Math.min(0.012, sw * 0.5, sd * 0.5);
    const s = new Shape();
    const x0 = -sw * 0.5;
    const y0 = -sd * 0.5;
    s.moveTo(x0 + sr, y0);
    s.lineTo(x0 + sw - sr, y0);
    s.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + sr);
    s.lineTo(x0 + sw, y0 + sd - sr);
    s.quadraticCurveTo(x0 + sw, y0 + sd, x0 + sw - sr, y0 + sd);
    s.lineTo(x0 + sr, y0 + sd);
    s.quadraticCurveTo(x0, y0 + sd, x0, y0 + sd - sr);
    s.lineTo(x0, y0 + sr);
    s.quadraticCurveTo(x0, y0, x0 + sr, y0);
    const dep = h - 2 * bt;
    const g = new ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -dep * 0.5);
    return g;
  }
  const tw = 64;
  const th = 64;
  const px = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const idx = (y * tw + x) * 4;
      const lane = (x % 16 < 2 || y % 16 < 2) ? 24 : 0;
      const brush = (x * 7 + y * 13) % 16;
      px[idx] = 44 + lane + brush;
      px[idx + 1] = 102 + lane + brush;
      px[idx + 2] = 196 + lane;
      px[idx + 3] = 255;
    }
  }
  const traceTex = new DataTexture(px, tw, th);
  traceTex.needsUpdate = true;
  traceTex.magFilter = LinearFilter;
  traceTex.minFilter = LinearFilter;
  traceTex.wrapS = RepeatWrapping;
  traceTex.wrapT = RepeatWrapping;
  traceTex.colorSpace = SRGBColorSpace;
  const matSource = new MeshStandardMaterial({ color: 0x8a94a6, metalness: 0.9, roughness: 0.3 });
  const matETL = new MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.6, map: traceTex });
  const matStore = new MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.85, roughness: 0.35 });
  const matTarget = new MeshStandardMaterial({ color: 0x4caf6d, metalness: 0.1, roughness: 0.65 });
  const matGear = new MeshStandardMaterial({ color: 0x6b7280, metalness: 0.9, roughness: 0.3 });
  const matScrew = new MeshStandardMaterial({ color: 0xd7dce3, metalness: 1.0, roughness: 0.25 });
  const matCable = new MeshStandardMaterial({ color: 0x22262c, metalness: 0.0, roughness: 0.7 });
  const matArrow = new MeshStandardMaterial({ color: 0xff8c1a, metalness: 0.2, roughness: 0.5 });
  const matCap = new MeshStandardMaterial({ color: 0xb0b7c3, metalness: 0.9, roughness: 0.3 });
  const matStrip = new MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.3 });
  const matLine = new LineBasicMaterial({ color: 0x35d0ff });
  const stdMats = [matSource, matETL, matStore, matTarget, matGear, matScrew, matCable, matArrow, matCap, matStrip];
  const pmrem = new PMREMGenerator(renderer);
  const room = new Scene();
  const roomMesh = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial({ color: 0x11141a, side: 1 }));
  room.add(roomMesh);
  const softGeo = new PlaneGeometry(2, 2);
  const softA = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }));
  softA.position.set(0, 0, 2);
  room.add(softA);
  const softB = new Mesh(softGeo, new MeshBasicMaterial({ color: 0xcfe0ff, side: DoubleSide }));
  softB.position.set(-2, 0, 0);
  softB.rotation.y = Math.PI * 0.5;
  room.add(softB);
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  room.traverse((r) => {
    if (r.geometry) {
      r.geometry.dispose();
    }
    if (r.material) {
      r.material.dispose();
    }
  });
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
  key.position.set(0.6, -0.4, 1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.002;
  const frustumKeys = ['left', 'right', 'top', 'bottom'];
  const frustumVals = [-1, 1, 1, -1];
  for (let i = 0; i < 4; i++) {
    key.shadow.camera[frustumKeys[i]] = frustumVals[i];
  }
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const rim = new DirectionalLight(0xbcd0ff, 0.7);
  rim.position.set(-0.4, 0.6, 0.5);
  scene.add(rim);
  const accent = new PointLight(0xffd9a0, 3, 1.5, 2);
  accent.position.set(0.2, -0.35, 0.25);
  scene.add(accent);
  const ground = new Mesh(new CircleGeometry(0.55, 48), new ShadowMaterial({ opacity: 0.35 }));
  ground.position.set(0, 0, -0.001);
  ground.receiveShadow = true;
  scene.add(ground);
  const model = new Group();
  scene.add(model);
  const geoSource = new CylinderGeometry(0.09, 0.09, 0.12, 32);
  const geoCap = new CylinderGeometry(0.05, 0.05, 0.06, 24);
  const geoArrow = new CylinderGeometry(0.0, 0.012, 0.03, 16);
  const geoCable = new CylinderGeometry(0.006, 0.006, 0.12, 10);
  const geoScrew = new SphereGeometry(0.007, 12, 10);
  const geoRing = new TorusGeometry(0.065, 0.005, 8, 40);
  const geoETL = bevelBox(0.22, 0.14, 0.14);
  const geoStore = bevelBox(0.30, 0.20, 0.20);
  const geoTarget = bevelBox(0.16, 0.12, 0.12);
  const geoGear = bevelBox(0.05, 0.05, 0.05);
  const geoStrip = bevelBox(0.10, 0.03, 0.008);
  const src = new Mesh(geoSource, matSource);
  src.position.set(-0.45, 0, 0.06);
  src.rotation.x = Math.PI * 0.5;
  src.castShadow = true;
  src.receiveShadow = true;
  model.add(src);
  const ring = new Mesh(geoRing, matCap);
  ring.position.set(-0.45, 0, 0.121);
  ring.castShadow = true;
  ring.receiveShadow = true;
  model.add(ring);
  const etl = new Mesh(geoETL, matETL);
  etl.position.set(-0.15, 0, 0.07);
  etl.castShadow = true;
  etl.receiveShadow = true;
  model.add(etl);
  const sto = new Mesh(geoStore, matStore);
  sto.position.set(0.18, 0, 0.10);
  sto.castShadow = true;
  sto.receiveShadow = true;
  model.add(sto);
  const tgt = new Mesh(geoTarget, matTarget);
  tgt.position.set(0.48, 0, 0.06);
  tgt.castShadow = true;
  tgt.receiveShadow = true;
  model.add(tgt);
  const capMesh = new Mesh(geoCap, matCap);
  capMesh.position.set(0.48, 0, 0.15);
  capMesh.rotation.x = Math.PI * 0.5;
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  model.add(capMesh);
  const im = new Matrix4();
  const iq = new Quaternion();
  const iv = new Vector3();
  const ivs = new Vector3(1, 1, 1);
  const zAxis = new Vector3(0, 0, 1);
  const gears = new InstancedMesh(geoGear, matGear, 2);
  iq.set(0, 0, 0, 1);
  iv.set(-0.19, 0.03, 0.165);
  im.compose(iv, iq, ivs);
  gears.setMatrixAt(0, im);
  iv.set(-0.11, -0.03, 0.165);
  im.compose(iv, iq, ivs);
  gears.setMatrixAt(1, im);
  gears.instanceMatrix.needsUpdate = true;
  gears.computeBoundingSphere();
  gears.castShadow = true;
  gears.receiveShadow = true;
  model.add(gears);
  const strips = new InstancedMesh(geoStrip, matStrip, 3);
  iq.set(0, 0, 0, 1);
  iv.set(-0.15, 0, 0.144);
  im.compose(iv, iq, ivs);
  strips.setMatrixAt(0, im);
  iv.set(0.18, 0, 0.204);
  im.compose(iv, iq, ivs);
  strips.setMatrixAt(1, im);
  iv.set(0.48, 0.045, 0.124);
  im.compose(iv, iq, ivs);
  strips.setMatrixAt(2, im);
  strips.instanceMatrix.needsUpdate = true;
  strips.computeBoundingSphere();
  strips.castShadow = true;
  strips.receiveShadow = true;
  model.add(strips);
  const screws = new InstancedMesh(geoScrew, matScrew, 6);
  iq.set(0, 0, 0, 1);
  iv.set(-0.19, 0, 0.149);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(0, im);
  iv.set(-0.11, 0, 0.149);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(1, im);
  iv.set(0.14, 0, 0.209);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(2, im);
  iv.set(0.22, 0, 0.209);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(3, im);
  iv.set(0.44, 0.045, 0.129);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(4, im);
  iv.set(0.52, 0.045, 0.129);
  im.compose(iv, iq, ivs);
  screws.setMatrixAt(5, im);
  screws.instanceMatrix.needsUpdate = true;
  screws.computeBoundingSphere();
  screws.castShadow = true;
  screws.receiveShadow = true;
  model.add(screws);
  const cables = new InstancedMesh(geoCable, matCable, 3);
  iq.setFromAxisAngle(zAxis, -Math.PI * 0.5);
  iv.set(-0.30, 0.05, 0.03);
  im.compose(iv, iq, ivs);
  cables.setMatrixAt(0, im);
  iv.set(0.015, 0.05, 0.03);
  im.compose(iv, iq, ivs);
  cables.setMatrixAt(1, im);
  iv.set(0.33, 0.05, 0.03);
  im.compose(iv, iq, ivs);
  cables.setMatrixAt(2, im);
  cables.instanceMatrix.needsUpdate = true;
  cables.computeBoundingSphere();
  cables.castShadow = true;
  cables.receiveShadow = true;
  model.add(cables);
  const arrows = new InstancedMesh(geoArrow, matArrow, 3);
  iq.setFromAxisAngle(zAxis, -Math.PI * 0.5);
  iv.set(-0.275, 0, 0.07);
  im.compose(iv, iq, ivs);
  arrows.setMatrixAt(0, im);
  iv.set(0.015, 0, 0.07);
  im.compose(iv, iq, ivs);
  arrows.setMatrixAt(1, im);
  iv.set(0.385, 0, 0.07);
  im.compose(iv, iq, ivs);
  arrows.setMatrixAt(2, im);
  arrows.instanceMatrix.needsUpdate = true;
  arrows.computeBoundingSphere();
  arrows.castShadow = true;
  arrows.receiveShadow = true;
  model.add(arrows);
  const lg1 = new BufferGeometry().setFromPoints([new Vector3(-0.36, 0, 0.07), new Vector3(-0.26, 0, 0.07)]);
  const ln1 = new Line(lg1, matLine);
  model.add(ln1);
  const lg2 = new BufferGeometry().setFromPoints([new Vector3(-0.04, 0, 0.07), new Vector3(0.03, 0, 0.07)]);
  const ln2 = new Line(lg2, matLine);
  model.add(ln2);
  const lg3 = new BufferGeometry().setFromPoints([new Vector3(0.33, 0, 0.07), new Vector3(0.40, 0, 0.07)]);
  const ln3 = new Line(lg3, matLine);
  model.add(ln3);
  const labels = [];
  labels.push(addLabel(scene, 'Quelle', [-0.45, 0.0, 0.16], { id: 'l1', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'ETL-Stufe', [-0.15, 0.0, 0.18], { id: 'l2', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'Speicher', [0.18, 0.0, 0.24], { id: 'l3', level: 'aufbau', sizePx: 16, leader: true }));
  labels.push(addLabel(scene, 'Zielsystem', [0.48, 0.0, 0.17], { id: 'l4', level: 'aufbau', sizePx: 16, leader: true }));
  const measures = [];
  measures.push(addMeasurement(scene, [-0.40, -0.16, 0.0], [0.10, -0.16, 0.0], 'Stufenabstand: 50 cm', { id: 'm1', level: 'aufbau', unit: 'cm' }));
  let running = true;
  let raf = 0;
  const reduced = p.reducedMotion ? true : false;
  function loop() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    if (!reduced && running) {
      raf = requestAnimationFrame(loop);
    }
  }
  if (reduced) {
    controls.update();
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(loop);
  }
  function update(patch) {
    if (!patch) return;
    if (patch.labels) {
      const en = patch.labels.enabled !== false;
      let lim = 5;
      if (typeof patch.labels.max === 'number') {
        lim = patch.labels.max;
      }
      const hd = Array.isArray(patch.labels.hidden) ? patch.labels.hidden : [];
      for (let i = 0; i < labels.length; i++) {
        labels[i].setVisible(en && i < lim && !hd.includes(i));
      }
    }
    if (patch.measurements) {
      const men = patch.measurements.enabled !== false;
      for (let i = 0; i < measures.length; i++) {
        measures[i].setVisible(men);
      }
    }
    if (patch.view) {
      const v = patch.view;
      if (v === 'overview') {
        camera.position.set(0.0, -0.55, 0.60);
        controls.target.set(0.02, 0, 0.08);
      } else if (v === 'detail') {
        camera.position.set(-0.15, -0.24, 0.10);
        controls.target.set(-0.15, 0, 0.08);
      } else if (v === 'front') {
        camera.position.set(0.0, -0.75, 0.14);
        controls.target.set(0.02, 0, 0.08);
      } else if (v === 'top') {
        camera.position.set(0.0, -0.01, 1.0);
        controls.target.set(0.02, 0, 0.0);
      }
      controls.update();
      renderer.render(scene, camera);
    }
  }
  function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    for (let i = 0; i < labels.length; i++) {
      labels[i].remove();
    }
    for (let i = 0; i < measures.length; i++) {
      measures[i].remove();
    }
    controls.dispose();
    scene.traverse((n) => {
      const g = n.geometry;
      if (g) {
        g.dispose();
      }
      const mm = n.material;
      if (mm) {
        if (Array.isArray(mm)) {
          for (let j = 0; j < mm.length; j++) {
            const qm = mm[j];
            if (qm.map) {
              qm.map.dispose();
            }
            qm.dispose();
          }
        } else {
          if (mm.map) {
            mm.map.dispose();
          }
          mm.dispose();
        }
      }
    });
    envRT.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }
  return { update, dispose };
}