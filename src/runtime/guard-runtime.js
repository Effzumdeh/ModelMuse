/**
 * S2-Laufzeitwache (Host-Seite): Konsolenwaechter, Fehlerfaenger,
 * First-Frame-Timeout, Probe-Auslese. Arbeitet auf postMessage-Kanal,
 * daher browser- und testfaehig ohne Playwright-Abhaengigkeit.
 * Bauplan Abschnitt 4 (guard-runtime) und Abschnitt 6 (S2).
 */

/** @typedef {{ triangles: number, calls: number, meshes: number, geometries: number, textures: number, programs: number, frames: number, firstFrameAt: number | null }} ProbeSnapshot */

export const FIRST_FRAME_TIMEOUT_MS = 8000;
export const MAX_THREE_WARNINGS = 5;

/**
 * @param {number} [timeoutMs]
 */
export function createErrorCollector(timeoutMs = FIRST_FRAME_TIMEOUT_MS) {
  /** @type {Array<{ type: string, text: string, at: number }>} */
  const consoleErrors = [];
  /** @type {Array<{ type: string, text: string, at: number }>} */
  const pageErrors = [];
  let threeWarnings = 0;
  /** @type {Array<{ code: string, message: string }>} */
  const modelErrors = [];
  const t0 = Date.now();

  return {
    /** postMessage- oder Konsoleneintrag einspeisen. */
    pushConsole(type, text) {
      const entry = { type: String(type), text: String(text).slice(0, 500), at: Date.now() - t0 };
      if (type === 'error') consoleErrors.push(entry);
      else if (type === 'warn' && /THREE/i.test(entry.text)) threeWarnings += 1;
    },
    pushPageError(text) {
      pageErrors.push({ type: 'pageerror', text: String(text).slice(0, 500), at: Date.now() - t0 });
    },
    pushModelError(code, message) {
      modelErrors.push({ code: String(code), message: String(message).slice(0, 500) });
    },
    snapshot() {
      return { consoleErrors: [...consoleErrors], pageErrors: [...pageErrors], threeWarnings, modelErrors: [...modelErrors] };
    },
    /** S2-Urteil: 0 error-Eintraege, hoechstens 5 THREE-Warnungen. */
    verdict() {
      const errors = consoleErrors.length + pageErrors.length;
      const helperHits = modelErrors.filter((e) => e.code === 'E-S2-HELPERS').length;
      const fail =
        errors > 0 ? 'E-S2-CONSOLE' : threeWarnings > MAX_THREE_WARNINGS ? 'E-S2-CONSOLE' : helperHits > 0 ? 'E-S2-HELPERS' : null;
      return { ok: fail === null && modelErrors.length === 0, code: modelErrors.length > 0 ? modelErrors[0].code : fail };
    },
  };
}

/**
 * Wartet auf model-ready mit firstFrameAt <= timeoutMs.
 * @param {{ onReady: (cb: (info: { firstFrameAt: number }) => void) => void, onError: (cb: (e: { code: string, message: string }) => void) => void }} channel
 * @param {number} [timeoutMs]
 * @returns {Promise<{ firstFrameAt: number }>} E-S2-TIMEOUT bei Ueberschreitung
 */
export function waitFirstFrame(channel, timeoutMs = FIRST_FRAME_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`E-S2-TIMEOUT: kein erster Frame in ${timeoutMs} ms`), { code: 'E-S2-TIMEOUT' }));
    }, timeoutMs);
    channel.onReady((info) => {
      clearTimeout(timer);
      const t = typeof info?.firstFrameAt === 'number' ? info.firstFrameAt : timeoutMs + 1;
      if (t > timeoutMs) {
        reject(Object.assign(new Error(`E-S2-TIMEOUT: firstFrameAt ${t} ms`), { code: 'E-S2-TIMEOUT' }));
      } else {
        resolve({ firstFrameAt: t });
      }
    });
    channel.onError((e) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`${e?.code ?? 'E-S2-BOOT'}: ${e?.message ?? ''}`), { code: e?.code ?? 'E-S2-BOOT' }));
    });
  });
}

/**
 * Prueft einen ProbeSnapshot auf Vollstaendigkeit.
 * @param {unknown} snap
 * @returns {ProbeSnapshot} wirft E-S2-PROBE
 */
export function assertProbe(snap) {
  const s = /** @type {Record<string, unknown>} */ (snap ?? {});
  const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const out = {
    triangles: num(s.triangles) ?? -1,
    calls: num(s.calls) ?? -1,
    meshes: num(s.meshes) ?? num(s.geometries) ?? -1,
    geometries: num(s.geometries) ?? -1,
    textures: num(s.textures) ?? -1,
    programs: num(s.programs) ?? 0,
    frames: num(s.frames) ?? 0,
    firstFrameAt: s.firstFrameAt === null ? null : num(s.firstFrameAt),
  };
  if (out.frames < 0 || out.firstFrameAt === null) {
    throw Object.assign(new Error('E-S2-PROBE: keine Instrumentierung'), { code: 'E-S2-PROBE' });
  }
  return out;
}
