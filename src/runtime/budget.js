/**
 * S4-Budgetwaechter: Dreiecke, Draw-Calls, FPS, Heap, Erster Frame.
 * Ringpuffer (300 Frames), onBreach feuert einmal je Metrik und Lauf.
 * Bauplan Abschnitt 4 (Budget-Waechter) und Abschnitt 6 (S4).
 * NACHTRAG 2026-10-27 (Budget 400): Draw-Calls-Limit 120 -> 400, Ampel
 * gruen bis 300 / gelb bis 400 (75-%-Staffel wie zuvor 90/120). Details in
 * dist/BUDGET-NACHTRAG-2026-10-27.md; Bauplan-Original unveraendert.
 */

/** @typedef {{ triangles: number, drawCalls: number, meshCount: number, minFps: number, firstFrameMs: number, heapMb: number, moduleBytes: number }} BudgetLimits */
/** @typedef {{ metric: 'triangles' | 'drawCalls' | 'meshCount' | 'fps' | 'heap' | 'firstFrame', actual: number, limit: number }} BudgetBreach */
/** @typedef {{ triangles: number, drawCalls: number, meshCount: number, fpsP05: number, frameTimeP95Ms: number, heapMb: number, firstFrameMs: number, frames: number, verdict: 'pass' | 'fail', breaches: BudgetBreach[] }} BudgetReport */

export const DEFAULT_BUDGET_LIMITS = Object.freeze({
  triangles: 150000,
  drawCalls: 400,
  meshCount: 250,
  minFps: 30,
  firstFrameMs: 8000,
  heapMb: 256,
  moduleBytes: 1500000,
});

export const HARD_BUDGET_BYTES = 2000000;

/** Ampel-Schwellen je Metrik: [gruenBis, gelbBis].
 * NACHTRAG 2026-10-27: drawCalls [90,120] -> [300,400] (75 % Gruen-Anteil bleibt).
 * UMSETZUNG M2 (2026-10-27): meshCount [120,250] — gruen bis 120 (Struktur-Ziel
 * Richtung Astra-Niveau ~45), gelb bis 250 (hart). Quelle: 3JSBench [20]. */
export const TRAFFIC = Object.freeze({
  triangles: [120000, 150000],
  drawCalls: [300, 400],
  meshCount: [120, 250],
  frameTimeP95Ms: [20, 33.3],
  firstFrameMs: [3000, 8000],
  heapMb: [180, 256],
});

/**
 * @param {'green' | 'yellow' | 'red'} current
 * @param {number} value
 * @param {[number, number]} bands
 */
function bandFor(value, bands) {
  if (value <= bands[0]) return 'green';
  if (value <= bands[1]) return 'yellow';
  return 'red';
}

/**
 * @param {Partial<BudgetLimits>} [limits]
 */
export function createBudgetWatcher(limits = {}) {
  const merged = { ...DEFAULT_BUDGET_LIMITS, ...limits };
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value !== 'number' || !(value > 0)) {
      throw Object.assign(new Error(`E-BUDGET-OPTS: ungueltiges Limit ${key}`), { code: 'E-BUDGET-OPTS' });
    }
  }
  /** @type {number[]} */
  const frameTimes = [];
  /** @type {Set<string>} bereits gemeldete Metriken */
  const fired = new Set();
  /** @type {Set<function(BudgetBreach): void>} */
  const listeners = new Set();
  let started = false;
  let lastTriangles = 0;
  let lastDrawCalls = 0;
  let lastMeshCount = 0;
  let lastHeapMb = 0;
  let firstFrameMs = -1;

  /** @param {BudgetBreach} breach */
  function emit(breach) {
    if (fired.has(breach.metric)) return;
    fired.add(breach.metric);
    for (const cb of listeners) {
      try {
        cb(breach);
      } catch {
        /* Listener werfen nie in den Wächter */
      }
    }
  }

  return {
    begin() {
      if (started) {
        throw Object.assign(new Error('E-BUDGET-STATE: bereits gestartet'), { code: 'E-BUDGET-STATE' });
      }
      started = true;
      frameTimes.length = 0;
      fired.clear();
      firstFrameMs = -1;
    },
    /**
     * @param {number} frameTimeMs
     * @param {{ triangles?: number, calls?: number, meshCount?: number, meshes?: number, heapMb?: number, firstFrameAt?: number | null }} snapshot
     */
    sample(frameTimeMs, snapshot = {}) {
      if (!started) {
        throw Object.assign(new Error('E-BUDGET-STATE: nicht gestartet'), { code: 'E-BUDGET-STATE' });
      }
      if (typeof frameTimeMs !== 'number' || Number.isNaN(frameTimeMs)) {
        throw Object.assign(new Error('E-BUDGET-ARG: frameTimeMs NaN'), { code: 'E-BUDGET-ARG' });
      }
      frameTimes.push(frameTimeMs);
      if (frameTimes.length > 300) frameTimes.shift();
      if (typeof snapshot.triangles === 'number') lastTriangles = snapshot.triangles;
      if (typeof snapshot.calls === 'number') lastDrawCalls = snapshot.calls;
      if (typeof snapshot.meshCount === 'number') lastMeshCount = snapshot.meshCount;
      else if (typeof snapshot.meshes === 'number') lastMeshCount = snapshot.meshes;
      if (typeof snapshot.heapMb === 'number') lastHeapMb = snapshot.heapMb;
      if (typeof snapshot.firstFrameAt === 'number' && firstFrameMs < 0) {
        firstFrameMs = snapshot.firstFrameAt;
      }
      if (lastTriangles > merged.triangles) {
        emit({ metric: 'triangles', actual: lastTriangles, limit: merged.triangles });
      }
      if (lastDrawCalls > merged.drawCalls) {
        emit({ metric: 'drawCalls', actual: lastDrawCalls, limit: merged.drawCalls });
      }
      if (lastMeshCount > merged.meshCount) {
        emit({ metric: 'meshCount', actual: lastMeshCount, limit: merged.meshCount });
      }
      const rep = this.snapshot();
      if (rep.frames >= 30 && rep.fpsP05 < merged.minFps) {
        emit({ metric: 'fps', actual: rep.fpsP05, limit: merged.minFps });
      }
      if (lastHeapMb > merged.heapMb) emit({ metric: 'heap', actual: lastHeapMb, limit: merged.heapMb });
      if (firstFrameMs >= 0 && firstFrameMs > merged.firstFrameMs) {
        emit({ metric: 'firstFrame', actual: firstFrameMs, limit: merged.firstFrameMs });
      }
    },
    /** @returns {BudgetReport} */
    snapshot() {
      if (!started) {
        throw Object.assign(new Error('E-BUDGET-STATE: nicht gestartet'), { code: 'E-BUDGET-STATE' });
      }
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const n = sorted.length;
      const p95 = n === 0 ? 0 : sorted[Math.min(n - 1, Math.floor(0.95 * n))];
      const fpsP05 = p95 > 0 ? 1000 / p95 : (n === 0 ? Number.POSITIVE_INFINITY : 1000 / sorted[n - 1]);
      /** @type {BudgetBreach[]} */
      const breaches = [];
      if (lastTriangles > merged.triangles) {
        breaches.push({ metric: 'triangles', actual: lastTriangles, limit: merged.triangles });
      }
      if (lastDrawCalls > merged.drawCalls) {
        breaches.push({ metric: 'drawCalls', actual: lastDrawCalls, limit: merged.drawCalls });
      }
      if (lastMeshCount > merged.meshCount) {
        breaches.push({ metric: 'meshCount', actual: lastMeshCount, limit: merged.meshCount });
      }
      if (n >= 30 && fpsP05 < merged.minFps) {
        breaches.push({ metric: 'fps', actual: Math.round(fpsP05 * 10) / 10, limit: merged.minFps });
      }
      if (lastHeapMb > merged.heapMb) {
        breaches.push({ metric: 'heap', actual: lastHeapMb, limit: merged.heapMb });
      }
      if (firstFrameMs >= 0 && firstFrameMs > merged.firstFrameMs) {
        breaches.push({ metric: 'firstFrame', actual: firstFrameMs, limit: merged.firstFrameMs });
      }
      return {
        triangles: lastTriangles,
        drawCalls: lastDrawCalls,
        meshCount: lastMeshCount,
        fpsP05: fpsP05 === Number.POSITIVE_INFINITY ? 0 : Math.round(fpsP05 * 10) / 10,
        frameTimeP95Ms: Math.round(p95 * 100) / 100,
        heapMb: lastHeapMb,
        firstFrameMs,
        frames: n,
        verdict: breaches.length === 0 ? 'pass' : 'fail',
        breaches,
      };
    },
    /**
     * @param {function(BudgetBreach): void} cb
     * @returns {function(): void} Abmeldefunktion
     */
    onBreach(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    stop() {
      started = false;
    },
    /** Ampel je Metrik fuer den Report. */
    traffic() {
      const rep = this.snapshot();
      return {
        triangles: bandFor(rep.triangles, TRAFFIC.triangles),
        drawCalls: bandFor(rep.drawCalls, TRAFFIC.drawCalls),
        meshCount: bandFor(rep.meshCount, TRAFFIC.meshCount),
        frameTimeP95Ms: bandFor(rep.frameTimeP95Ms, TRAFFIC.frameTimeP95Ms),
        firstFrameMs: rep.firstFrameMs < 0 ? 'red' : bandFor(rep.firstFrameMs, TRAFFIC.firstFrameMs),
        heapMb: bandFor(rep.heapMb, TRAFFIC.heapMb),
      };
    },
  };
}
