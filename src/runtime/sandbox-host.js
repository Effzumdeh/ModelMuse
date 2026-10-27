/**
 * Sandbox-Host: Frame-Erzeugung, Specifier-Rewrite (via frame-bootstrap),
 * Nachrichtenkanal mit source/origin-Pruefung, Probe- und Ladevertrag.
 * Bauplan Abschnitt 4 (Sandbox- und Ladevertrag).
 */
import { buildFrameDocument } from './frame-bootstrap.js';
import { createErrorCollector, waitFirstFrame, assertProbe, FIRST_FRAME_TIMEOUT_MS } from './guard-runtime.js';

/** @typedef {{ id: string, frame: HTMLIFrameElement, container: HTMLElement, collector: ReturnType<createErrorCollector>, sessionId: string, disposed: boolean }} GuestSession */
/** @typedef {{ ok: boolean }} SyntaxVerdict */

let sessionCounter = 0;

function err(code, message) {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

/**
 * @param {HTMLElement} container
 * @param {{ threeText: string, helpersText: string }} assets
 * @returns {GuestSession}
 */
export function createGuestSession(container, assets) {
  if (!container || !assets?.threeText || !assets?.helpersText) {
    throw err('E-BOOT-OPTS', 'Container oder Assets fehlen');
  }
  sessionCounter += 1;
  const sessionId = `s${Date.now().toString(36)}-${sessionCounter}`;
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('title', 'SkillSpark 3D-Modell');
  frame.style.cssText = 'border:0;width:100%;height:100%;display:block;';
  container.appendChild(frame);
  /** @type {GuestSession} */
  const session = { id: sessionId, frame, container, collector: createErrorCollector(), sessionId, disposed: false };
  window.addEventListener('message', (ev) => {
    if (ev.source !== frame.contentWindow) return;
    if (ev.origin !== 'null' && ev.origin !== window.location.origin) return;
    const d = ev.data;
    if (!d || d.sessionId !== sessionId) return;
    if (d.type === 'model-error') session.collector.pushModelError(d.code, d.message);
    if (d.type === 'lab-probe' && session._probeResolve && d.reqId === session._probeReq) {
      session._probeResolve(d.snapshot);
      session._probeResolve = null;
    }
    if (d.type === 'lab-capture' && session._capResolve && d.reqId === session._capReq) {
      session._capResolve(d.dataUrl);
      session._capResolve = null;
    }
    if (d.type === 'model-ready' && session._readyResolve) {
      session._readyResolve({ firstFrameAt: d.firstFrameAt, snapshot: d.snapshot });
      session._readyResolve = null;
      session._readyReject = null;
    }
    if (d.type === 'lab-disposed' && session._dispResolve) {
      session._dispResolve();
      session._dispResolve = null;
    }
  });
  return session;
}

/**
 * @param {GuestSession} session
 * @param {string} moduleText
 * @param {Record<string, unknown>} [assets]
 */
function armFrame(session, moduleText, assets) {
  const srcdoc = buildFrameDocument({
    sessionId: session.sessionId,
    threeText: assets.threeText,
    helpersText: assets.helpersText,
    moduleText,
    initParams: assets.initParams ?? {},
  });
  session.frame.srcdoc = srcdoc;
}

/**
 * Syntaxpruefung via Wegwerf-Probe-Frame: Modul wird importiert, aber init nie aufgerufen.
 * @param {GuestSession} session
 * @param {string} source
 * @param {{ threeText: string, helpersText: string }} assets
 * @returns {Promise<SyntaxVerdict>} E-S1-SYNTAX bei Parse-Fehler, E-S2-TIMEOUT bei Zeitueberschreitung
 */
export function probeSyntax(session, source, assets) {
  return new Promise((resolve, reject) => {
    const probe = document.createElement('iframe');
    probe.setAttribute('sandbox', 'allow-scripts');
    probe.style.cssText = 'border:0;width:1px;height:1px;position:absolute;left:-9999px;';
    document.body.appendChild(probe);
    const pid = `${session.sessionId}-probe`;
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      probe.remove();
      reject(err('E-S2-TIMEOUT', 'Probe-Frame meldet sich nicht'));
    }, FIRST_FRAME_TIMEOUT_MS);
    const onMsg = (/** @type {MessageEvent} */ ev) => {
      if (ev.source !== probe.contentWindow) return;
      const d = ev.data;
      if (!d || d.sessionId !== pid) return;
      if (d.type === 'model-error') {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        probe.remove();
        const code = /SyntaxError|Unexpected token|import/i.test(d.message) ? 'E-S1-SYNTAX' : 'E-S2-BOOT';
        reject(err(code, d.message));
      }
      if (d.type === 'model-ready' || d.type === 'lab-probe') {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        probe.remove();
        resolve({ ok: true });
      }
    };
    window.addEventListener('message', onMsg);
    // Probe-Frame: Vollstaendige Instanziierung (Import + init) im Wegwerf-Frame.
    // Ein SyntaxError bricht beim Import ab und wird als E-S1-SYNTAX gemeldet.
    const srcdoc = buildFrameDocument({
      sessionId: pid,
      threeText: assets.threeText,
      helpersText: assets.helpersText,
      moduleText: source,
      initParams: { probeOnly: true },
    });
    probe.srcdoc = srcdoc;
  });
}

/**
 * Laedt das Modul in die Session: wartet auf model-ready (erster Frame).
 * @param {GuestSession} session
 * @param {{ id: string, source: string }} ref
 * @param {{ threeText: string, helpersText: string, initParams?: Record<string, unknown>, timeoutMs?: number }} assets
 */
export async function loadModule(session, ref, assets) {
  if (session.disposed) throw err('E-S2-BOOT', 'Session verworfen');
  const timeoutMs = assets.timeoutMs ?? FIRST_FRAME_TIMEOUT_MS;
  armFrame(session, ref.source, assets);
  const outcome = await new Promise((resolve) => {
    session._readyResolve = (info) => resolve({ ready: info });
    session._readyReject = (e) => resolve({ failed: e });
    const poll = setInterval(() => {
      const snap = session.collector.snapshot();
      if (snap.modelErrors.length > 0 && session._readyReject) {
        const first = snap.modelErrors[0];
        const rej = session._readyReject;
        session._readyResolve = null;
        session._readyReject = null;
        clearInterval(poll);
        clearTimeout(timer);
        rej(Object.assign(new Error(`${first.code}: ${first.message}`), { code: first.code }));
      }
    }, 50);
    const timer = setTimeout(() => {
      clearInterval(poll);
      if (session._readyResolve) {
        session._readyResolve = null;
        session._readyReject = null;
        resolve({ timeout: true });
      }
    }, timeoutMs);
  });
  if (outcome.timeout) throw err('E-S2-TIMEOUT', `kein erster Frame in ${timeoutMs} ms`);
  if (outcome.failed) throw outcome.failed;
  return {
    /** @param {Record<string, unknown>} patch */
    update(patch) {
      if (session.disposed) throw err('E-API-UPDATE', 'Session verworfen');
      session.frame.contentWindow?.postMessage({ cmd: 'lab-update', sessionId: session.sessionId, patch }, '*');
    },
    /** @param {string} preset */
    setView(preset) {
      if (session.disposed) throw err('E-API-UPDATE', 'Session verworfen');
      session.frame.contentWindow?.postMessage({ cmd: 'lab-snapshot-view', sessionId: session.sessionId, preset }, '*');
    },
  };
}

/**
 * @param {GuestSession} session
 * @param {number} [timeoutMs]
 */
export function readProbe(session, timeoutMs = FIRST_FRAME_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (session.disposed) {
      reject(err('E-S2-PROBE', 'Session verworfen'));
      return;
    }
    const reqId = `probe-${Date.now().toString(36)}`;
    session._probeReq = reqId;
    const timer = setTimeout(() => {
      session._probeResolve = null;
      reject(err('E-S2-PROBE', 'keine Instrumentierungsantwort'));
    }, Math.min(timeoutMs, 5000));
    session._probeResolve = (snap) => {
      clearTimeout(timer);
      try {
        resolve(assertProbe(snap));
      } catch (e) {
        reject(e);
      }
    };
    session.frame.contentWindow?.postMessage({ cmd: 'lab-get-probe', sessionId: session.sessionId, reqId }, '*');
  });
}

/**
 * @param {GuestSession} session
 * @param {number} [timeoutMs]
 */
export function captureFrame(session, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (session.disposed) {
      reject(err('E-S3-EMPTY', 'Session verworfen'));
      return;
    }
    const reqId = `cap-${Date.now().toString(36)}`;
    session._capReq = reqId;
    const timer = setTimeout(() => {
      session._capResolve = null;
      reject(err('E-S3-EMPTY', 'kein Bild vom Frame'));
    }, timeoutMs);
    session._capResolve = (dataUrl) => {
      clearTimeout(timer);
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) {
        reject(err('E-S3-EMPTY', 'leeres Bild'));
        return;
      }
      resolve(dataUrl);
    };
    session.frame.contentWindow?.postMessage({ cmd: 'lab-capture', sessionId: session.sessionId, reqId }, '*');
  });
}

/**
 * Gibt Geometrien/Materialien/Renderer/Loop frei und entfernt den Frame. Fehler nur loggen.
 * @param {GuestSession} session
 */
export async function disposeSession(session) {
  if (session.disposed) return;
  session.disposed = true;
  try {
    session.frame.contentWindow?.postMessage({ cmd: 'lab-dispose', sessionId: session.sessionId }, '*');
    await new Promise((resolve) => {
      session._dispResolve = resolve;
      setTimeout(resolve, 500);
    });
  } catch {
    /* nur loggen */
  }
  try {
    session.frame.remove();
  } catch {
    /* nur loggen */
  }
}
