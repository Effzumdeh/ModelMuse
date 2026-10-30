/**
 * Host-Fassade: createPlayer. Idempotentes load, Patch-Update, Dispose,
 * Snapshot ueber Frame-Capture, Verify-Report, 2D-Fallback bei F3.
 * Bauplan Abschnitt 4 (Host-Fassade, Dispose-Muster).
 */
import { staticGate, repairThreeImports, isTwoDSource } from './guard-static.js';
import { renderTwoDSource } from './render-2d.js';
import { createBudgetWatcher, DEFAULT_BUDGET_LIMITS } from './budget.js';
import { createGuestSession, loadModule, readProbe, captureFrame, disposeSession } from './sandbox-host.js';
import { buildLevelPatch } from './didactics.js';
import { verifyStaticLayer, verifyGeometryLayer, verifyDidacticsLayer, verifySvgLayer, sollFromMatrixEntry, skipLayer, buildVerifyReport } from './verify.js';
import { extractMeta } from './verify.js';
import { renderFallback2D } from './fallback2d.js';

function err(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

/**
 * @param {{ mount: HTMLElement, budget?: Partial<import('./budget.js').BudgetLimits>, onBreach?: (b: unknown) => void, onReport?: (r: unknown) => void, assets: { threeText: string, helpersText: string } }} options
 */
export function createPlayer(options) {
  if (!options?.mount || typeof options.mount.appendChild !== 'function') {
    throw err('E-PLAYER-OPTS', 'mount fehlt');
  }
  if (!options?.assets?.threeText || !options?.assets?.helpersText) {
    throw err('E-PLAYER-OPTS', 'assets (three/helpers) fehlen');
  }
  const limits = { ...DEFAULT_BUDGET_LIMITS, ...(options.budget ?? {}) };
  const watcher = createBudgetWatcher(limits);
  /** @type {ReturnType<createGuestSession> | null} */
  let session = null;
  /** @type {Record<string, unknown> | null} */
  let lastReport = null;
  /** @type {string | null} */
  let currentId = null;
  /** @type {{ update: (p: unknown) => void, setView: (v: string) => void } | null} */
  let guest = null;
  /** @type {unknown} */
  let lastManifest = null;

  /** @type {HTMLElement} */
  const stage = document.createElement('div');
  stage.className = 'lab-stage';
  stage.style.cssText = 'position:relative;width:100%;height:100%;min-height:360px;';
  options.mount.appendChild(stage);

  async function disposeSessionOnly() {
    if (session) {
      try {
        await disposeSession(session);
      } catch {
        /* E-API-DISPOSE nur loggen */
      }
      session = null;
      guest = null;
    }
  }

  return {
    /**
     * @param {{ id: string, kind?: string, source: string, meta?: unknown, manifest?: unknown }} ref
     * @param {{ levels?: string[], captureViews?: string[], skipS3?: boolean, timeoutMs?: number }} [opts]
     */
    async load(ref, opts = {}) {
      if (!ref?.id || !/^[a-z0-9-]{2,24}$/.test(ref.id)) throw err('E-PLAYER-OPTS', 'ref.id ungueltig');
      if (typeof ref.source !== 'string') throw err('E-S1-SHAPE', 'ref.source fehlt');
      // E-S2-BOOT-Repair: fehlende benannte Imports vor S1+Boot ergaenzen.
      ref = { ...ref, source: repairThreeImports(ref.source) };
      // Bauplan: load ruft vorher dispose der Vorsitzung auf (Idempotenz je id).
      // Fix 2026-10-26: vorher nur bei gleicher id disposed -> Frame-Leak + GPU-Konkurrenz
      // beim Modellwechsel (S2-Timeouts unter SwiftShader). Jetzt immer erst disposen.
      if (session) await disposeSessionOnly();
      currentId = ref.id;
      lastManifest = ref.manifest ?? null;
      const timeoutMs = opts.timeoutMs ?? 8000;
      const layers = [];
      const t0 = Date.now();
      // S1
      const meta = ref.meta ?? extractMeta(ref.source);
      const s1 = verifyStaticLayer(ref.source, meta, { comfort: 1500000, hard: 2000000 });
      s1.layer.durationMs = Date.now() - t0;
      layers.push(s1.layer);
      if (s1.layer.verdict === 'fail') {
        const codes = s1.layer.criteria.filter((c) => c.verdict === 'fail').map((c) => c.id);
        lastReport = buildVerifyReport({ modelId: ref.id, layers });
        if (options.onReport) options.onReport(lastReport);
        throw err(codes[0].includes('forbidden') ? 'E-S1-FORBIDDEN' : codes[0].includes('size') ? 'E-S1-SIZE' : codes[0].includes('imports') ? 'E-S1-IMPORT' : 'E-S1-SHAPE', codes.join(','));
      }
      // 2D-Route (SVG nativ, hostseitig): kein Guest-Frame, kein WebGL.
      // S1 (Allowlist 2d-*) ist oben bereits geprueft; hier S2-light
      // (parse+pixel+Typ) echt rendern, S3/S4 als 2D-skip, S5 unveraendert.
      if (isTwoDSource(ref.source)) {
        const t2d = Date.now();
        stage.innerHTML = '';
        const host = document.createElement('div');
        host.className = 'lab-2d';
        host.style.cssText = 'position:absolute;inset:0;';
        stage.appendChild(host);
        let shapes = 0;
        let variant = 'svg';
        try {
          const info = renderTwoDSource(host, ref.source);
          shapes = info.shapes;
          variant = info.variant ?? 'svg';
        } catch (e) {
          layers.push({ layer: 'S2', verdict: 'fail', criteria: [{ id: 'E-2D-RENDER', verdict: 'fail', expected: 'SVG rendert', actual: String((e && e.message) || e).slice(0, 200) }], durationMs: Date.now() - t2d });
          layers.push(skipLayer('S3', '2D-Render fehlgeschlagen'));
          layers.push(skipLayer('S4', '2D-Render fehlgeschlagen'));
          layers.push(lastManifest ? validateLayer(lastManifest, ref.source, ref.id) : skipLayer('S5', 'kein Manifest'));
          lastReport = buildVerifyReport({ modelId: ref.id, layers });
          if (options.onReport) options.onReport(lastReport);
          throw e;
        }
        guest = {
          update() {},
          setView() {},
        };
        const s2 = verifySvgLayer(ref.source);
        layers.push(s2.layer);
        layers.push(skipLayer('S3', '2D-Route (SVG nativ): kein WebGL-Screenshot'));
        layers.push({
          layer: 'S4',
          verdict: 'pass',
          criteria: [
            { id: 'S4-2d-nodes', verdict: shapes <= 800 ? 'pass' : 'fail', expected: '<= 800 SVG-Knoten (S4-light)', actual: `${shapes} Shapes` },
            { id: 'S4-2d-module', verdict: new TextEncoder().encode(ref.source).length <= 34000 ? 'pass' : 'fail', expected: '<= 34000 Bytes', actual: `${new TextEncoder().encode(ref.source).length} Bytes` },
          ],
          durationMs: 0,
        });
        layers.push(lastManifest ? validateLayer(lastManifest, ref.source, ref.id) : skipLayer('S5', 'kein Manifest'));
        lastReport = buildVerifyReport({ modelId: ref.id, layers });
        lastReport.route = { mode: '2d', reason: `2d-${variant} Datenpfad` };
        if (options.onReport) options.onReport(lastReport);
        return { sessionId: null, report: lastReport, mode: '2d' };
      }
      // S2: Ausfuehrung im Frame
      const t2 = Date.now();
      session = createGuestSession(stage, options.assets);
      try {
        watcher.begin();
      } catch {
        watcher.stop();
        watcher.begin();
      }
      try {
        guest = await loadModule(session, ref, { ...options.assets, timeoutMs, initParams: { level: 'aufbau', labels: { enabled: true, max: 64 }, measurements: { enabled: true }, dpr: 1, reducedMotion: true, seed: 1, units: 'm', locale: 'de-DE' } });
      } catch (e) {
        const code = (e && e.code) || 'E-S2-BOOT';
        layers.push({ layer: 'S2', verdict: 'fail', criteria: [{ id: code, verdict: 'fail', expected: 'erster Frame', actual: String((e && e.message) || e).slice(0, 200) }], durationMs: Date.now() - t2 });
        layers.push(skipLayer('S3', 'S2 fehlgeschlagen'));
        layers.push(skipLayer('S4', 'S2 fehlgeschlagen'));
        layers.push(lastManifest ? validateLayer(lastManifest, ref.source, ref.id) : skipLayer('S5', 'kein Manifest'));
        lastReport = buildVerifyReport({ modelId: ref.id, layers });
        if (options.onReport) options.onReport(lastReport);
        await disposeSessionOnly();
        throw e;
      }
      let probe = null;
      try {
        probe = await readProbe(session, timeoutMs);
        // Zweite Probe nach Settle: erster Tick meldet ggf. noch 0 Dreiecke.
        await new Promise((r) => setTimeout(r, 600));
        try {
          const probe2 = await readProbe(session, timeoutMs);
          probe = {
            ...probe2,
            triangles: Math.max(probe.triangles, probe2.triangles),
            calls: Math.max(probe.calls, probe2.calls),
          };
        } catch {
          /* erste Probe bleibt gueltig */
        }
        watcher.sample(16.7, { triangles: probe.triangles, calls: probe.calls, meshCount: probe.meshes ?? probe.geometries ?? 0, firstFrameAt: probe.firstFrameAt ?? undefined });
      } catch (e) {
        layers.push({ layer: 'S2', verdict: 'fail', criteria: [{ id: 'E-S2-PROBE', verdict: 'fail', expected: 'Probe lesbar', actual: String((e && e.message) || e).slice(0, 200) }], durationMs: Date.now() - t2 });
        layers.push(skipLayer('S3', 'S2 fehlgeschlagen'));
        layers.push(skipLayer('S4', 'S2 fehlgeschlagen'));
        layers.push(lastManifest ? validateLayer(lastManifest, ref.source, ref.id) : skipLayer('S5', 'kein Manifest'));
        lastReport = buildVerifyReport({ modelId: ref.id, layers });
        if (options.onReport) options.onReport(lastReport);
        throw e;
      }
      const collector = session.collector.snapshot();
      const s2ok = collector.consoleErrors.length === 0 && collector.pageErrors.length === 0 && collector.modelErrors.length === 0;
      // HARNESS (M1/M2): deterministische Geometrie-Checks als echte S2-Kriterien
      // (sechs Fehlerklassen, deutsche Meldungen + FLARE-Messwerte) — dadurch
      // misst JEDER Browser-Report die Klassen, nicht nur der Node-Verify-Lauf.
      const sceneStats = probe && typeof probe === 'object' ? {
        boxes: Array.isArray(probe.boxes) ? probe.boxes : undefined,
        backfaceHits: typeof probe.backfaceHits === 'number' ? probe.backfaceHits : undefined,
      } : undefined;
      const geo = verifyGeometryLayer(ref.source, sceneStats);
      layers.push({
        layer: 'S2',
        verdict: s2ok && geo.layer.verdict === 'pass' ? 'pass' : 'fail',
        criteria: [
          { id: 'S2-first-frame', verdict: (probe.firstFrameAt ?? 1e9) <= 8000 ? 'pass' : 'fail', expected: '<= 8000 ms', actual: `${probe.firstFrameAt} ms` },
          { id: 'S2-console', verdict: collector.consoleErrors.length + collector.pageErrors.length === 0 ? 'pass' : 'fail', expected: '0 errors', actual: `${collector.consoleErrors.length + collector.pageErrors.length} errors` },
          { id: 'S2-api', verdict: collector.modelErrors.length === 0 ? 'pass' : 'fail', expected: 'update/dispose verfuegbar', actual: collector.modelErrors.map((m) => m.code).join(',') || 'ok' },
          ...geo.layer.criteria.map((c) => ({ id: c.id, verdict: c.verdict, expected: c.expected, actual: c.actual })),
        ],
        durationMs: Date.now() - t2,
      });
      layers.push(skipLayer('S3', 'Messung in Visual-Suite'));
      const brep = watcher.snapshot();
      layers.push({
        layer: 'S4',
        verdict: brep.verdict === 'pass' ? 'pass' : 'fail',
        criteria: [
          { id: 'S4-triangles', verdict: brep.triangles <= limits.triangles ? 'pass' : 'fail', expected: `<= ${limits.triangles}`, actual: `${brep.triangles}` },
          { id: 'S4-drawcalls', verdict: brep.drawCalls <= limits.drawCalls ? 'pass' : 'fail', expected: `<= ${limits.drawCalls}`, actual: `${brep.drawCalls}` },
          { id: 'S4-meshcount', verdict: brep.meshCount <= limits.meshCount ? 'pass' : 'fail', expected: `<= ${limits.meshCount} (gruen bis 120, Ziel ~45)`, actual: `${brep.meshCount}` },
        ],
        durationMs: 0,
      });
      layers.push(lastManifest ? validateLayer(lastManifest, ref.source, ref.id) : skipLayer('S5', 'kein Manifest'));
      lastReport = buildVerifyReport({ modelId: ref.id, layers });
      if (options.onReport) options.onReport(lastReport);
      const mode = '3d';
      return { sessionId: session.sessionId, report: lastReport, mode };
    },

    /** @param {string} level */
    setLevel(level) {
      if (!guest || !session) throw err('E-API-UPDATE', 'kein Modell geladen');
      try {
        const patch = buildLevelPatch(level);
        guest.update(patch);
      } catch (e) {
        throw err('E-API-UPDATE', String((e && e.message) || e));
      }
    },

    /** @param {{ labels?: boolean, maxLabels?: number, measurements?: boolean }} cfg */
    setAnnotations(cfg = {}) {
      if (!guest || !session) throw err('E-API-UPDATE', 'kein Modell geladen');
      try {
        guest.update({
          labels: { enabled: cfg.labels ?? true, max: cfg.maxLabels ?? 64 },
          measurements: { enabled: cfg.measurements ?? true },
        });
      } catch (e) {
        throw err('E-API-UPDATE', String((e && e.message) || e));
      }
    },

    /** Bauteil-Sichtbarkeit je Index (labels.hidden + parts.hidden, graceful). */
    setParts(hidden = [], max = 64) {
      if (!guest || !session) throw err('E-API-UPDATE', 'kein Modell geladen');
      try {
        guest.update({
          labels: { enabled: true, max, hidden: [...hidden] },
          parts: { hidden: [...hidden] },
        });
      } catch (e) {
        throw err('E-API-UPDATE', String((e && e.message) || e));
      }
    },

    /** @param {string} preset */
    setView(preset) {
      if (!guest || !session) throw err('E-API-UPDATE', 'kein Modell geladen');
      try {
        guest.setView(preset);
      } catch (e) {
        throw err('E-API-UPDATE', String((e && e.message) || e));
      }
    },

    /** @param {string} [preset] */
    async snapshot(preset = 'overview') {
      if (!guest) throw err('E-S3-EMPTY', 'kein Modell geladen');
      if (!session) {
        // 2D-Route: SVG aus dem Stage-DOM serialisieren (kein Frame-Capture).
        const el = stage.querySelector('svg');
        if (!el) throw err('E-S3-EMPTY', 'kein 2D-SVG');
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(el.outerHTML)}`;
      }
      try {
        guest.setView(preset);
        await new Promise((r) => setTimeout(r, 300));
        const url = await captureFrame(session, 5000);
        if (!url) throw err('E-S3-EMPTY', 'leeres Bild');
        return url;
      } catch (e) {
        if (e && e.code) throw e;
        throw err('E-S3-EMPTY', String((e && e.message) || e));
      }
    },

    report() {
      if (!lastReport) throw err('E-REPORT-MISSING', 'noch kein Lauf');
      return lastReport;
    },

    async dispose() {
      try {
        watcher.stop();
      } catch {
        /* nur loggen */
      }
      await disposeSessionOnly();
      currentId = null;
    },

    /** F3: 2D-Ersatzansicht im Stage. */
    fallback2D(level = 'aufbau') {
      stage.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvas.style.cssText = 'width:100%;height:auto;';
      stage.appendChild(canvas);
      renderFallback2D(canvas, lastManifest ?? { title: currentId ?? 'Modell', labels: [], measurements: [] }, level);
      return '2d';
    },
  };
}

/**
 * O-10: S5 als volle Didaktik-Schicht (wie verify-all.mjs) plus S5-soll exakt.
 * Matrix kommt aus window.__MODELLMATRIX__ (render-single-file.mjs bettet
 * src/data/modellmatrix.json ein); fehlt sie (free-Modell/Roh-Dev), laeuft
 * S5-soll graceful (Mindestpruefung bleibt gueltig).
 */
function matrixSoll(modelId) {
  const reg = (typeof window !== 'undefined' && window.__MODELLMATRIX__) || null;
  return sollFromMatrixEntry(reg?.[modelId]);
}

function validateLayer(manifest, source, modelId) {
  return verifyDidacticsLayer(manifest, source, matrixSoll(modelId)).layer;
}
