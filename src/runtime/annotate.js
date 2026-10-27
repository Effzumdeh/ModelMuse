/**
 * wrapper-helpers als Guest-Modul: addLabel, addMeasurement, clearAnnotations.
 * Genau drei Exporte. Billboard-Labels via CanvasTexture (keine externe Font-Datei).
 * Verstoesse: E-HELPER-ARG, E-HELPER-LIMIT, E-HELPER-UNIT. S2 wertet sie als E-S2-HELPERS.
 * Bauplan Abschnitt 4 (Helpers). Synchrone Handles (AnnotationHandle), THREE statisch
 * importiert (Specifier-Rewrite im Frame loest 'three' auf Blob-URL auf).
 */
import { BufferGeometry, CanvasTexture, Group, Line, LineBasicMaterial, Sprite, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three';

const MAX_LABELS_PER_SCENE = 65;

/** @type {WeakMap<object, { labels: Set<object>, measurements: Set<object> }>} */
const registry = new WeakMap();

function bucket(root) {
  let b = registry.get(root);
  if (!b) {
    b = { labels: new Set(), measurements: new Set() };
    registry.set(root, b);
  }
  return b;
}

function err(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

/** @param {unknown} v */
function isVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
  );
}

/**
 * Zeichnet Text auf ein Canvas und liefert Canvas + Seitenverhaeltnis.
 * @param {string} text
 * @param {{ sizePx?: number, color?: string }} [style]
 */
function textCanvas(text, style = {}) {
  const sizePx = style.sizePx ?? 16;
  const font = `${sizePx * 4}px system-ui, sans-serif`;
  const meas = document.createElement('canvas').getContext('2d');
  if (!meas) throw err('E-HELPER-ARG', 'kein 2d-Kontext');
  meas.font = font;
  const w = Math.ceil(meas.measureText(text).width) + sizePx * 2;
  const h = sizePx * 4 + sizePx * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw err('E-HELPER-ARG', 'kein 2d-Kontext');
  ctx.font = font;
  ctx.fillStyle = 'rgba(8,12,20,0.82)';
  ctx.strokeStyle = style.color ?? '#ffd34d';
  ctx.lineWidth = Math.max(2, sizePx / 4);
  const r = sizePx;
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5f7fa';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, sizePx, h / 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return { tex, aspect: w / h };
}

/**
 * @param {object} root
 * @param {string} text
 * @param {unknown} position
 * @param {{ id?: string, level?: string, anchor?: string, sizePx?: number, color?: string, leader?: boolean }} [opts]
 */
export function addLabel(root, text, position, opts = {}) {
  if (!root || typeof root.add !== 'function') throw err('E-HELPER-ARG', 'root ohne add');
  if (typeof text !== 'string' || text.length === 0) throw err('E-HELPER-ARG', 'leerer text');
  if (!isVec3(position)) throw err('E-HELPER-ARG', 'ungueltiges Vec3');
  const sizePx = opts.sizePx ?? 16;
  if (!Number.isFinite(sizePx) || sizePx < 12 || sizePx > 32) throw err('E-HELPER-ARG', 'sizePx 12..32');
  const b = bucket(root);
  if (b.labels.size >= MAX_LABELS_PER_SCENE) throw err('E-HELPER-LIMIT', 'ab 65 Labels');
  const { tex, aspect } = textCanvas(text, { sizePx, color: opts.color });
  const heightM = sizePx * 0.0009;
  const mat = new SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new Sprite(mat);
  sprite.scale.set(heightM * aspect, heightM, 1);
  const anchor = opts.anchor ?? 'top';
  const lift = anchor === 'bottom' ? -heightM : anchor === 'center' ? 0 : heightM;
  sprite.position.set(position[0], position[1] + lift, position[2]);
  sprite.renderOrder = 999;
  const id = opts.id ?? `label-${b.labels.size + 1}`;
  sprite.userData.helperId = id;
  sprite.userData.helperLevel = opts.level ?? 'aufbau';
  if (opts.leader !== false) {
    const geo = new BufferGeometry().setFromPoints([
      new Vector3(position[0], position[1], position[2]),
      new Vector3(position[0], position[1] + lift * 0.85, position[2]),
    ]);
    const line = new Line(geo, new LineBasicMaterial({ color: opts.color ?? 0xffd34d, depthTest: false }));
    line.renderOrder = 998;
    line.userData.helperId = `${id}-leader`;
    root.add(line);
    b.measurements.add(line);
  }
  root.add(sprite);
  b.labels.add(sprite);
  let visible = true;
  return {
    id,
    setVisible(v) {
      visible = Boolean(v);
      sprite.visible = visible;
    },
    remove() {
      root.remove(sprite);
      mat.map?.dispose();
      mat.dispose();
      b.labels.delete(sprite);
    },
  };
}

/**
 * @param {object} root
 * @param {unknown} from
 * @param {unknown} to
 * @param {string} label
 * @param {{ id?: string, level?: string, unit?: string, precision?: number, color?: string, axis?: string }} [opts]
 */
export function addMeasurement(root, from, to, label, opts = {}) {
  if (!root || typeof root.add !== 'function') throw err('E-HELPER-ARG', 'root ohne add');
  if (!isVec3(from) || !isVec3(to)) throw err('E-HELPER-ARG', 'ungueltiges Vec3');
  if (from[0] === to[0] && from[1] === to[1] && from[2] === to[2]) {
    throw err('E-HELPER-ARG', 'identische Endpunkte');
  }
  if (typeof label !== 'string' || label.length === 0) throw err('E-HELPER-ARG', 'leerer label');
  if (opts.unit !== undefined && !/\d/.test(label)) throw err('E-HELPER-UNIT', 'label ohne Zahl');
  const color = opts.color ?? '#4dd2ff';
  const group = new Group();
  const a = new Vector3(from[0], from[1], from[2]);
  const c = new Vector3(to[0], to[1], to[2]);
  group.add(new Line(new BufferGeometry().setFromPoints([a, c]), new LineBasicMaterial({ color, depthTest: false })));
  const tickLen = 0.008;
  for (const p of [a, c]) {
    const tick = new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(p.x, p.y - tickLen, p.z),
        new Vector3(p.x, p.y + tickLen, p.z),
      ]),
      new LineBasicMaterial({ color, depthTest: false })
    );
    group.add(tick);
  }
  const mid = a.clone().add(c).multiplyScalar(0.5);
  const { tex, aspect } = textCanvas(label, { sizePx: 14, color });
  const h = 0.0126;
  const tag = new Sprite(new SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  tag.scale.set(h * aspect, h, 1);
  tag.position.copy(mid).add(new Vector3(0, 0.014, 0));
  tag.renderOrder = 999;
  group.add(tag);
  const id = opts.id ?? `measure-${bucket(root).measurements.size + 1}`;
  group.userData.helperId = id;
  group.userData.helperLevel = opts.level ?? 'aufbau';
  root.add(group);
  bucket(root).measurements.add(group);
  return {
    id,
    setVisible(v) {
      group.visible = Boolean(v);
    },
    remove() {
      root.remove(group);
      group.traverse((o) => {
        const mesh = /** @type {{ material?: { map?: { dispose(): void }, dispose(): void } }} */ (o);
        if (mesh.material) {
          mesh.material.map?.dispose();
          mesh.material.dispose();
        }
        const geo = /** @type {{ geometry?: { dispose(): void } }} */ (o);
        geo.geometry?.dispose();
      });
      bucket(root).measurements.delete(group);
    },
  };
}

/**
 * @param {object} root
 * @param {'labels' | 'measurements' | 'all'} [scope]
 * @returns {number} Anzahl entfernter Annotationen
 */
export function clearAnnotations(root, scope = 'all') {
  if (!root || typeof root.remove !== 'function') throw err('E-HELPER-ARG', 'root ohne remove');
  if (!['labels', 'measurements', 'all'].includes(scope)) throw err('E-HELPER-ARG', 'unbekannter scope');
  const b = registry.get(root);
  if (!b) return 0;
  let n = 0;
  const drop = (set) => {
    for (const o of [...set]) {
      root.remove(o);
      set.delete(o);
      n += 1;
    }
  };
  if (scope === 'labels' || scope === 'all') drop(b.labels);
  if (scope === 'measurements' || scope === 'all') drop(b.measurements);
  return n;
}
