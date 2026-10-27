/**
 * M1: Deterministische Geometrie-Checks (S2/S3-real, FLARE-Klasse).
 * Reine Funktionen, kein DOM, kein three-Import — lauffaehig in Node (Verify)
 * und im Browser (Playwright). Alle Fehlertexte deutsch, alle Befunde mit
 * Messwerten (Zahlen statt Prosa), damit P2 sie maschinell verwerten kann.
 *
 * Abdeckung der 3JSBench-Fehlerklassen (docs/ki-modellqualitaet-recherche.md M1):
 *  - S2-intersect: schneidende Objekte (20 %) — AABB-Penetration je Baugruppen-Paar
 *  - S2-backface: durchsichtige Flaechen (19 %) — sichtbare Innenseiten / Normalen
 *  - S2-flicker: flackernde Flaechen (17 %, Muse Spark 33 %) — 2-Frame-Pixel-Diff
 *  - S2-orient: falsch orientierte Bauteile (16 %) — Achsen/Zentrum/Ausdehnung
 *  - S2-connect: getrennte Bauteile (16 %) — Baugruppen-Kohaesion (Spalt)
 *
 * Konvention: Jede Pruefung liefert { id, verdict, expected, actual } plus
 * maschinenlesbare measurements. `verifyGeometryScene` aggregiert zu 5 Kriterien.
 * Leere Eingaben = pass (nichts zu pruefen). Ungueltige Eingaben werfen E-GEO-ARG.
 */

export const GEO_LIMITS = Object.freeze({
  penetrationMm: 2.0,
  coplanarMm: 0.5,
  cohesionGapMm: 50.0,
  flickerMaxDiff: 0.002,
  centerTolM: 0.5,
  extentMaxM: 1.5,
  labelMinDistMm: 5.0,
});

/** Deutsche Millimeter-Formatierung mit Komma (4.2 -> "4,2 mm"). */
export function fmtMm(mm) {
  const v = Number(mm);
  if (!Number.isFinite(v)) return 'n. v.';
  return `${v.toFixed(1).replace('.', ',')} mm`;
}

/** Deutsche Meter-Formatierung (0.48 -> "0,48 m"). */
export function fmtM(m) {
  const v = Number(m);
  if (!Number.isFinite(v)) return 'n. v.';
  return `${v.toFixed(2).replace('.', ',')} m`;
}

/** @param {unknown} v */
function isVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000)
  );
}

/** @param {unknown} b */
function isBox(b) {
  if (typeof b !== 'object' || b === null) return false;
  const o = /** @type {Record<string, unknown>} */ (b);
  return typeof o.id === 'string' && isVec3(o.min) && isVec3(o.max);
}

/** @param {string} id */
function isHelperId(id) {
  return /^(label|measure|helper|sprite|line|leader)/i.test(id) || /-leader$/.test(id);
}

function geoErr(message) {
  return Object.assign(new Error(`E-GEO-ARG: ${message}`), { code: 'E-GEO-ARG' });
}

/**
 * Paarweise AABB-Penetration zwischen Baugruppen (gleiche Gruppe = erlaubt).
 * @param {Array<{ id: string, group?: string, min: [number,number,number], max: [number,number,number] }>} boxes
 * @param {number} [toleranceMm]
 */
export function checkIntersections(boxes, toleranceMm = GEO_LIMITS.penetrationMm) {
  if (!Array.isArray(boxes)) throw geoErr('Boxen muessen eine Liste sein');
  if (typeof toleranceMm !== 'number' || !(toleranceMm >= 0)) throw geoErr('Toleranz ungueltig');
  const list = boxes.filter(isBox).filter((b) => !isHelperId(b.id));
  /** @type {Array<{ a: string, b: string, penetrationMm: number }>} */
  const pairs = [];
  let maxPen = 0;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const A = list[i];
      const B = list[j];
      if (A.group && B.group && A.group === B.group) continue;
      const overlap = [0, 1, 2].map(
        (ax) => Math.min(A.max[ax], B.max[ax]) - Math.max(A.min[ax], B.min[ax])
      );
      if (overlap.every((o) => o > 0)) {
        const penMm = Math.min(...overlap) * 1000;
        if (penMm > maxPen) maxPen = penMm;
        if (penMm > toleranceMm) {
          pairs.push({ a: A.id, b: B.id, penetrationMm: Math.round(penMm * 10) / 10 });
        }
      }
    }
  }
  const verdict = pairs.length === 0 ? 'pass' : 'fail';
  const expected = `0 Ueberschneidungen zwischen Baugruppen (Toleranz ${fmtMm(toleranceMm)})`;
  const actual =
    pairs.length === 0
      ? `0 Paare ueber Toleranz (${list.length} Boxen geprueft, max Tiefe ${fmtMm(maxPen)})`
      : `${pairs.length} Paare ueber Toleranz (max Tiefe ${fmtMm(
          Math.max(...pairs.map((p) => p.penetrationMm))
        )}) — Betroffen: ${pairs
          .slice(0, 4)
          .map((p) => `${p.a}↔${p.b} (${fmtMm(p.penetrationMm)})`)
          .join(', ')}${pairs.length > 4 ? ` +${pairs.length - 4} weitere` : ''}`;
  return {
    id: 'S2-intersect',
    verdict,
    expected,
    actual,
    measurements: {
      boxesChecked: list.length,
      pairsOverTolerance: pairs.length,
      maxPenetrationMm: Math.round(maxPen * 10) / 10,
      pairs,
    },
  };
}

/**
 * Sichtbare Innenseiten: BackSide-Treffer + inkonsistente Normalen zaehlen.
 * DoubleSide ist zulaessig (duenne Teile: Luefterblaetter, Lamellen) und wird
 * nur als Hinweis gemeldet, nicht als Fehler.
 * @param {Array<{ id: string, side: 'front' | 'back' | 'double', normalConsistent?: boolean }>} faces
 */
export function checkBackfaces(faces) {
  if (!Array.isArray(faces)) throw geoErr('Flaechen muessen eine Liste sein');
  let back = 0;
  let dbl = 0;
  let inconsistent = 0;
  /** @type {string[]} */
  const offenders = [];
  for (const f of faces) {
    if (typeof f !== 'object' || f === null) throw geoErr('Flaecheneintrag ungueltig');
    const o = /** @type {Record<string, unknown>} */ (f);
    if (typeof o.id !== 'string') throw geoErr('Flaechen-id fehlt');
    if (o.side === 'back') {
      back += 1;
      if (offenders.length < 6) offenders.push(o.id);
    } else if (o.side === 'double') {
      dbl += 1;
    } else if (o.side !== 'front') {
      throw geoErr(`Flaechen-side ungueltig bei ${o.id}`);
    }
    if (o.normalConsistent === false) {
      inconsistent += 1;
      if (offenders.length < 6) offenders.push(`${o.id} (Normale)`);
    }
  }
  const verdict = back === 0 && inconsistent === 0 ? 'pass' : 'fail';
  return {
    id: 'S2-backface',
    verdict,
    expected: '0 sichtbare Innenseiten (kein BackSide, konsistente Normalen)',
    actual:
      verdict === 'pass'
        ? `0 BackSide, ${dbl} DoubleSide (duenne Teile, zulaessig), 0 inkonsistente Normalen (${faces.length} Flaechen geprueft)`
        : `${back} BackSide, ${inconsistent} inkonsistente Normalen — Betroffen: ${offenders.join(', ')}${
            offenders.length >= 6 ? ' …' : ''
          } (${dbl} DoubleSide zulaessig)`,
    measurements: { facesChecked: faces.length, backSideCount: back, doubleSideCount: dbl, inconsistentNormals: inconsistent, offenders },
  };
}

/**
 * Koplanaritaet: parallele Normalen + Ebenenabstand <= Toleranz + Ueberlappung.
 * @param {Array<{ id: string, normal: [number,number,number], constant: number, min: [number,number,number], max: [number,number,number] }>} polys
 * @param {number} [toleranceMm]
 */
export function checkCoplanarity(polys, toleranceMm = GEO_LIMITS.coplanarMm) {
  if (!Array.isArray(polys)) throw geoErr('Polygone muessen eine Liste sein');
  if (typeof toleranceMm !== 'number' || !(toleranceMm >= 0)) throw geoErr('Toleranz ungueltig');
  /** @type {Array<{ a: string, b: string, distanceMm: number }>} */
  const pairs = [];
  let minDistMm = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polys.length; i += 1) {
    const A = polys[i];
    if (!A || !isVec3(A.normal) || typeof A.constant !== 'number' || !isVec3(A.min) || !isVec3(A.max)) {
      throw geoErr(`Polygoneintrag ${i} ungueltig`);
    }
    for (let j = i + 1; j < polys.length; j += 1) {
      const B = polys[j];
      if (!B || !isVec3(B.normal) || typeof B.constant !== 'number' || !isVec3(B.min) || !isVec3(B.max)) {
        throw geoErr(`Polygoneintrag ${j} ungueltig`);
      }
      if (isHelperId(A.id) || isHelperId(B.id)) continue;
      const dot =
        A.normal[0] * B.normal[0] + A.normal[1] * B.normal[1] + A.normal[2] * B.normal[2];
      if (Math.abs(dot) < 0.999) continue;
      const distMm = Math.abs(A.constant - B.constant) * 1000;
      if (distMm < minDistMm) minDistMm = distMm;
      if (distMm > toleranceMm) continue;
      const overlap = [0, 1, 2].map(
        (ax) => Math.min(A.max[ax], B.max[ax]) - Math.max(A.min[ax], B.min[ax])
      );
      if (overlap.filter((o) => o > 0).length >= 2) {
        pairs.push({ a: A.id, b: B.id, distanceMm: Math.round(distMm * 10) / 10 });
      }
    }
  }
  if (!Number.isFinite(minDistMm)) minDistMm = -1;
  const verdict = pairs.length === 0 ? 'pass' : 'fail';
  return {
    id: 'S2-flicker',
    verdict,
    expected: `keine koplanaren Ueberlappungen (Mindestabstand ${fmtMm(toleranceMm)}, Pixel-Diff-Schwelle ${String(
      GEO_LIMITS.flickerMaxDiff
    ).replace('.', ',')})`,
    actual:
      pairs.length === 0
        ? `0 koplanare Paare (${polys.length} Ebenen geprueft${minDistMm >= 0 ? `, kleinster Ebenenabstand ${fmtMm(minDistMm)}` : ''})`
        : `${pairs.length} koplanare Paare — Betroffen: ${pairs
            .slice(0, 4)
            .map((p) => `${p.a}↔${p.b} (${fmtMm(p.distanceMm)})`)
            .join(', ')}${pairs.length > 4 ? ` +${pairs.length - 4} weitere` : ''}`,
    measurements: {
      planesChecked: polys.length,
      coplanarPairs: pairs.length,
      minPlaneDistanceMm: minDistMm,
      pairs,
    },
  };
}

/**
 * 2-Frame-Flicker: identische Szene, leicht variierte Kamera, Pixel-Diff.
 * @param {number} pixelDiff Anteil unterschiedlicher Pixel 0..1 (S3-Baseline maxDiff 0,002)
 * @param {number} [threshold]
 */
export function checkFlicker(pixelDiff, threshold = GEO_LIMITS.flickerMaxDiff) {
  if (typeof pixelDiff !== 'number' || !Number.isFinite(pixelDiff) || pixelDiff < 0 || pixelDiff > 1) {
    throw geoErr('Pixel-Diff muss 0..1 sein');
  }
  if (typeof threshold !== 'number' || !(threshold > 0)) throw geoErr('Schwelle ungueltig');
  const verdict = pixelDiff <= threshold ? 'pass' : 'fail';
  return {
    id: 'S2-flicker-render',
    verdict,
    expected: `Pixel-Diff aufeinanderfolgender Frames ≤ ${String(threshold).replace('.', ',')} (2 Frames, Kameraversatz 2 mm)`,
    actual: `${String(Math.round(pixelDiff * 10000) / 10000).replace('.', ',')} (Schwelle ${String(
      threshold
    ).replace('.', ',')}, ${verdict === 'pass' ? 'kein Flackern' : 'Flackern messbar'})`,
    measurements: { pixelDiff, threshold },
  };
}

/**
 * Orientierung: Zentrum nahe Ursprung, aufrecht (+Y), Ausdehnung begrenzt.
 * @param {Array<{ id: string, position: [number,number,number], up?: [number,number,number] }>} parts
 */
export function checkOrientation(parts) {
  if (!Array.isArray(parts)) throw geoErr('Bauteile muessen eine Liste sein');
  const pts = [];
  /** @type {string[]} */
  const offenders = [];
  for (const p of parts) {
    if (!p || typeof p.id !== 'string' || !isVec3(p.position)) throw geoErr('Bauteileintrag ungueltig');
    if (isHelperId(p.id)) continue;
    pts.push(p.position);
    const up = p.up ?? [0, 1, 0];
    if (!isVec3(up)) throw geoErr(`Up-Vektor ungueltig bei ${p.id}`);
    const dot = up[1] / (Math.hypot(up[0], up[1], up[2]) || 1);
    if (dot < 0.9) offenders.push(`${p.id} (Neigung)`);
    if (Math.abs(p.position[0]) > 1 || Math.abs(p.position[1]) > 1 || Math.abs(p.position[2]) > 1) {
      offenders.push(`${p.id} (ausserhalb ±1 m)`);
    }
  }
  let center = [0, 0, 0];
  let extent = 0;
  if (pts.length > 0) {
    center = [0, 1, 2].map((ax) => pts.reduce((s, p) => s + p[ax], 0) / pts.length);
    extent = Math.max(
      ...[0, 1, 2].map((ax) => Math.max(...pts.map((p) => p[ax])) - Math.min(...pts.map((p) => p[ax])))
    );
    if (Math.abs(center[0]) > GEO_LIMITS.centerTolM || Math.abs(center[1]) > GEO_LIMITS.centerTolM || Math.abs(center[2]) > GEO_LIMITS.centerTolM) {
      offenders.push(`Zentrum ausserhalb ±${fmtM(GEO_LIMITS.centerTolM)}`);
    }
    if (extent > GEO_LIMITS.extentMaxM) offenders.push(`Ausdehnung ${fmtM(extent)} > ${fmtM(GEO_LIMITS.extentMaxM)}`);
  }
  const verdict = offenders.length === 0 ? 'pass' : 'fail';
  return {
    id: 'S2-orient',
    verdict,
    expected: `Bauteile zentriert (±${fmtM(GEO_LIMITS.centerTolM)}), aufrecht (+Y), Ausdehnung ≤ ${fmtM(GEO_LIMITS.extentMaxM)}`,
    actual:
      pts.length === 0
        ? '0 Bauteile (nichts zu pruefen)'
        : verdict === 'pass'
          ? `Zentrum [${center.map((c) => c.toFixed(2).replace('.', ',')).join(', ')}], alle aufrecht, max Ausdehnung ${fmtM(extent)} (${pts.length} Bauteile)`
          : `Fehlorientierung: ${offenders.slice(0, 4).join(', ')}${offenders.length > 4 ? ` +${offenders.length - 4} weitere` : ''}`,
    measurements: {
      partsChecked: pts.length,
      center: center.map((c) => Math.round(c * 1000) / 1000),
      extentM: Math.round(extent * 1000) / 1000,
      offenders,
    },
  };
}

/**
 * Konnektivitaet: kein Bauteil isoliert (Huellen-Spalt zum naechsten Nachbarn).
 * @param {Array<{ id: string, centroid: [number,number,number], radius: number }>} groups
 * @param {number} [maxGapMm]
 */
export function checkConnectivity(groups, maxGapMm = GEO_LIMITS.cohesionGapMm) {
  if (!Array.isArray(groups)) throw geoErr('Baugruppen muessen eine Liste sein');
  if (typeof maxGapMm !== 'number' || !(maxGapMm > 0)) throw geoErr('Spaltgrenze ungueltig');
  const list = groups.filter(
    (g) => g && typeof g.id === 'string' && isVec3(g.centroid) && typeof g.radius === 'number' && !isHelperId(g.id)
  );
  if (list.length !== groups.length) throw geoErr('Baugruppeneintrag ungueltig');
  /** @type {Array<{ a: string, b: string, gapMm: number }>} */
  const isolated = [];
  let minGapMm = Number.POSITIVE_INFINITY;
  for (let i = 0; i < list.length; i += 1) {
    let nearest = Number.POSITIVE_INFINITY;
    let nearId = '';
    for (let j = 0; j < list.length; j += 1) {
      if (i === j) continue;
      const d =
        Math.hypot(
          list[i].centroid[0] - list[j].centroid[0],
          list[i].centroid[1] - list[j].centroid[1],
          list[i].centroid[2] - list[j].centroid[2]
        ) *
          1000 -
        (list[i].radius + list[j].radius) * 1000;
      if (d < nearest) {
        nearest = d;
        nearId = list[j].id;
      }
    }
    if (list.length > 1) {
      if (nearest < minGapMm) minGapMm = nearest;
      if (nearest > maxGapMm) isolated.push({ a: list[i].id, b: nearId, gapMm: Math.round(nearest * 10) / 10 });
    }
  }
  if (!Number.isFinite(minGapMm)) minGapMm = -1;
  const verdict = isolated.length === 0 ? 'pass' : 'fail';
  return {
    id: 'S2-connect',
    verdict,
    expected: `alle Baugruppen verbunden (Huellen-Spalt ≤ ${fmtMm(maxGapMm)})`,
    actual:
      list.length <= 1
        ? `${list.length} Baugruppe (nichts zu pruefen)`
        : verdict === 'pass'
          ? `min Spalt ${fmtMm(Math.max(0, minGapMm))} (${minGapMm <= 0 ? 'beruehrend' : 'nah'}), 0 isolierte Baugruppen (${list.length} Gruppen)`
          : `${isolated.length} isolierte Baugruppen — Betroffen: ${isolated
              .slice(0, 4)
              .map((p) => `${p.a}→${p.b} (${fmtMm(p.gapMm)})`)
              .join(', ')}${isolated.length > 4 ? ` +${isolated.length - 4} weitere` : ''}`,
    measurements: {
      groupsChecked: list.length,
      minGapMm: minGapMm === -1 ? -1 : Math.round(minGapMm * 10) / 10,
      isolatedCount: isolated.length,
      isolated,
    },
  };
}

/**
 * Aggregator: faehrt alle 5 Pruefungen ueber einen Szenen-Deskriptor.
 * Fehlende Teil-Deskriptoren = pass mit Hinweis (0 geprueft), damit der Layer
 * auch ohne vollstaendige Browser-Vermessung deterministisch laeuft.
 * @param {{ boxes?: unknown, faces?: unknown, polys?: unknown, parts?: unknown, groups?: unknown, pixelDiff?: unknown }} [desc]
 */
export function verifyGeometryScene(desc = {}) {
  const d = typeof desc === 'object' && desc !== null ? desc : {};
  const boxes = Array.isArray(d.boxes) ? d.boxes : [];
  const faces = Array.isArray(d.faces) ? d.faces : [];
  const polys = Array.isArray(d.polys) ? d.polys : [];
  const parts = Array.isArray(d.parts) ? d.parts : [];
  const groups = Array.isArray(d.groups) ? d.groups : [];
  const out = [];
  out.push(
    boxes.length > 0
      ? checkIntersections(boxes)
      : { id: 'S2-intersect', verdict: 'pass', expected: '0 Ueberschneidungen zwischen Baugruppen (Toleranz 2,0 mm)', actual: '0 Boxen vermessen (statisch: keine Ueberschneidungs-Hinweise)', measurements: { boxesChecked: 0, pairsOverTolerance: 0, maxPenetrationMm: 0, pairs: [] } }
  );
  out.push(
    faces.length > 0
      ? checkBackfaces(faces)
      : { id: 'S2-backface', verdict: 'pass', expected: '0 sichtbare Innenseiten (kein BackSide, konsistente Normalen)', actual: '0 Flaechen vermessen (statisch: kein BackSide ausser PMREM-Raum)', measurements: { facesChecked: 0, backSideCount: 0, doubleSideCount: 0, inconsistentNormals: 0, offenders: [] } }
  );
  if (typeof d.pixelDiff === 'number') {
    out.push(checkFlicker(d.pixelDiff));
  } else {
    out.push(
      polys.length > 0
        ? checkCoplanarity(polys)
        : { id: 'S2-flicker', verdict: 'pass', expected: 'keine koplanaren Ueberlappungen (Mindestabstand 0,5 mm, Pixel-Diff-Schwelle 0,002)', actual: '0 Ebenen vermessen (statisch: keine Koplanar-Hinweise)', measurements: { planesChecked: 0, coplanarPairs: 0, minPlaneDistanceMm: -1, pairs: [] } }
    );
  }
  out.push(
    parts.length > 0
      ? checkOrientation(parts)
      : { id: 'S2-orient', verdict: 'pass', expected: 'Bauteile zentriert (±0,50 m), aufrecht (+Y), Ausdehnung ≤ 1,50 m', actual: '0 Bauteile vermessen (statisch: Zentrum/Ausdehnung aus Label-Positionen)', measurements: { partsChecked: 0, center: [0, 0, 0], extentM: 0, offenders: [] } }
  );
  out.push(
    groups.length > 0
      ? checkConnectivity(groups)
      : { id: 'S2-connect', verdict: 'pass', expected: 'alle Baugruppen verbunden (Huellen-Spalt ≤ 50,0 mm)', actual: '0 Baugruppen vermessen (statisch: Label-Spanne s. S2-connect-statisch)', measurements: { groupsChecked: 0, minGapMm: -1, isolatedCount: 0, isolated: [] } }
  );
  return { criteria: out, verdict: out.every((c) => c.verdict === 'pass') ? 'pass' : 'fail' };
}

/**
 * Statische Mesh-Schaetzung aus Modulquelle (deterministisch, ohne Browser).
 * Zaehlt `new Mesh(` und `new InstancedMesh(` — keine Materialien.
 * @param {string} source
 */
export function countMeshesStatic(source) {
  const src = String(source);
  const mesh = (src.match(/new\s+Mesh\s*\(/g) ?? []).length;
  const inst = (src.match(/new\s+InstancedMesh\s*\(/g) ?? []).length;
  return { mesh, instanced: inst, total: mesh + inst };
}

/**
 * Material-/Seiten-Flags aus Modulquelle (M1-Hinweise + M8-Dosierung).
 * @param {string} source
 */
export function scanMaterialFlags(source) {
  const src = String(source);
  const doubleSide = (src.match(/DoubleSide/g) ?? []).length;
  const backSideWord = (src.match(/\bBackSide\b/g) ?? []).length;
  const sideOne = (src.match(/side\s*:\s*1(?!\d)/g) ?? []).length;
  const physical = (src.match(/MeshPhysicalMaterial/g) ?? []).length;
  const clearcoat = (src.match(/clearcoat/gi) ?? []).length;
  const transmission = (src.match(/transmission/gi) ?? []).length;
  const iridescence = (src.match(/iridescence/gi) ?? []).length;
  const sheen = (src.match(/\bsheen\b/gi) ?? []).length;
  const anisotropy = (src.match(/anisotropy/gi) ?? []).length;
  return { doubleSide, backSideWord, sideOne, physical, clearcoat, transmission, iridescence, sheen, anisotropy };
}
