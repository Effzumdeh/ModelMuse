/** Bootstrap: Player erzeugen, Modellliste binden. */
import Alpine from '../vendor/alpine.module.esm.min.js';
import { createLabStore, ampelLabel } from './store.js';
import { setModels } from './ui-model-picker.js';
import { renderAnnotations } from './ui-annotations.js';
import { renderTasks } from './ui-tasks.js';
import { renderReport } from './ui-report.js';
import { showFallback, hideFallback, fallbackMessage } from './ui-fallback2d.js';
import { createPlayer } from '../runtime/player.js';
import { getModel } from '../runtime/providers.js';
import { setLocale, getLocale, detectLocale, tt, applyLocale, localizeManifest } from './i18n.js';
import { mountLivegen } from './ui-livegen.js';
import { mountProviders } from './ui-providers.js';
import { mountLibrary } from './ui-library.js';
import { renderScoreboard, renderSoll } from './ui-scoreboard.js';
import { createLibrary, setConsent, serializeForSession, restoreFromSession, addEntry } from '../runtime/session-library.js';
import { toggleHidden, checkPart, checkAllParts } from '../runtime/parts.js';

const MODEL_IDS = ['gpu-example', 'si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3'];

/** @returns {boolean} WebGL2 verfuegbar */
export function hasWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_lose_context');
      if (dbg) dbg.loseContext();
    }
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Modell-Registry: Build Inline, Dev Fetch. */
async function loadRegistry() {
  const inlineModels = /** @type {unknown} */ (window.__LAB_MODELS__);
  if (Array.isArray(inlineModels) && inlineModels.length > 0) return inlineModels;
  const out = [];
  for (const id of MODEL_IDS) {
    const [src, man] = await Promise.all([
      fetch(`./src/models/${id}.js`).then((r) => {
        if (!r.ok) throw new Error(`Modell ${id} fehlt`);
        return r.text();
      }),
      fetch(`./src/models/manifests/${id}.json`).then((r) => (r.ok ? r.json() : null)),
    ]);
    out.push({ id, title: man?.title ?? id, source: src, manifest: man });
  }
  return out;
}

/** Assets: Build Inline, Dev Bundle-Fetch. */
async function loadAssets() {
  const inlineAssets = /** @type {unknown} */ (window.__LAB_ASSETS__);
  if (inlineAssets?.threeText && inlineAssets?.helpersText) return inlineAssets;
  const threeText = await fetch('./dist/vendor-three.bundle.js').then((r) => {
    if (!r.ok) throw new Error('vendor-three.bundle.js fehlt — zuerst npm run build');
    return r.text();
  });
  const helpersText = await fetch('./src/runtime/annotate.js').then((r) => {
    if (!r.ok) throw new Error('annotate.js fehlt');
    return r.text();
  });
  return { threeText, helpersText };
}

/** Anbieter-Registry: Build Inline, Dev Fetch. */
async function loadProviders() {
  const inline = /** @type {unknown} */ (window.__PROVIDERS__);
  if (inline && typeof inline === 'object' && Array.isArray(inline.providers)) return inline;
  const r = await fetch('./src/data/providers.json');
  if (!r.ok) throw new Error('providers.json fehlt');
  return r.json();
}

/** M7-Status. */
async function loadM7Status() {
  const inline = /** @type {unknown} */ (window.__LAB_MODELS__);
  const url = Array.isArray(inline) && inline.length > 0 ? './eval-harness.json' : './dist/eval-harness.json';
  try {
    const r = await fetch(url);
    if (r.ok) return await r.json();
  } catch { /* kein Lauf: Hinweis anzeigen */ }
  return null;
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt`);
  return el;
}

async function boot() {
  // Teil 5: Standard = Systemsprache des Users, umschaltbar (de/en/es).
  setLocale(detectLocale());
  applyLocale(getLocale());
  const langSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('lang-select'));
  if (langSel) langSel.value = getLocale();
  createLabStore(Alpine);
  const store = Alpine.store('lab');
  const webgl2 = hasWebGL2();
  const mount = $('lab-mount');
  const taskList = $('task-list');
  const annotationList = $('annotation-list');
  const reportBox = $('verify-report');
  const fallbackPanel = $('fallback-panel');
  const fallbackText = $('fallback-text');

  let player = null;
  let registry = [];
  try {
    registry = await loadRegistry();
  } catch (e) {
    reportBox.textContent = tt('player.registryFehler', { detail: e.message });
    registry = [];
  }
  setModels(store, registry);

  let providerCtl = null;
  let providersReg = null;
  try {
    providersReg = await loadProviders();
    providerCtl = mountProviders({
      registry: providersReg,
      providerSel: /** @type {HTMLSelectElement} */ ($('prov-provider')),
      modelSel: /** @type {HTMLSelectElement} */ ($('prov-model')),
      badgeBox: $('prov-badges'),
      privacyBox: $('prov-privacy'),
      cmdBox: $('prov-cmd'),
      docsBox: $('prov-docs'),
      proxyRow: /** @type {HTMLElement} */ ($('prov-proxy-wrap')),
      proxyInput: /** @type {HTMLInputElement} */ ($('prov-proxy')),
      keyInput: /** @type {HTMLInputElement} */ ($('live-key')),
      consentInput: /** @type {HTMLInputElement} */ ($('live-consent')),
      statusBox: $('prov-status'),
    });
  } catch (e) {
    $('prov-status').textContent = tt('anbieter.offline', { detail: e.message });
  }

  const lib = createLibrary();
  // Teil 5 (User-Vorgabe): Bibliothek DAUERHAFT im Browser (localStorage,
  // Consent-gated). Keys dagegen NIE persistiert (nur Sitzungseingabe).
  const LIB_KEY = 'skillspark-lib';
  const LIB_CONSENT = 'skillspark-lib-consent';
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* blockiert */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignorieren */ } },
  };
  try {
    if (storage.get(LIB_CONSENT) === 'ja') {
      const raw = storage.get(LIB_KEY);
      if (raw) lib.entries = restoreFromSession(raw).entries;
      setConsent(lib, true);
      /** @type {HTMLInputElement} */ ($('lib-consent')).checked = true;
    }
  } catch { /* Speicher blockiert: reine Sitzungs-Bibliothek */ }
  const persistLib = () => {
    try {
      if (lib.consent) {
        storage.set(LIB_CONSENT, 'ja');
        storage.set(LIB_KEY, serializeForSession(lib));
      } else {
        storage.del(LIB_CONSENT);
        storage.del(LIB_KEY);
      }
    } catch { /* Speicher blockiert */ }
  };

  /** Reports je Modell-id. @type {Map<string, unknown>} */
  const reportsById = new Map();

  const curModel = () => registry.find((m) => m.id === store.modelId);
  const partMax = () => (store.level === 'basis' ? 5 : 64);
  const partToggle = (i) => {
    store.partsHidden = toggleHidden(store.partsHidden ?? [], i);
    try { player?.setParts(store.partsHidden, partMax()); } catch {}
    paint();
  };
  const partTest = (i) => {
    const c = curModel();
    if (!c) return;
    store.partResults = { ...store.partResults, [String(i)]: checkPart(c.source, c.manifest ?? { labels: [] }, i).verdict };
    paint();
  };
  const partTestAll = () => {
    const c = curModel();
    if (!c) return;
    const r = {};
    for (const p of checkAllParts(c.source, c.manifest ?? { labels: [] }).parts) r[p.index] = p.verdict;
    store.partResults = r;
    paint();
  };

  const paint = () => {
    const current = curModel();
    // Teil 5: Ansicht in gewaehlter Lokale (kanonisches Deutsch bleibt Pruefbasis).
    const manifest = localizeManifest(current?.manifest ?? { labels: [], measurements: [], tasks: [] }, getLocale());
    renderAnnotations(annotationList, manifest, store.level, { labels: store.labels, measurements: store.measurements },
      { hidden: store.partsHidden ?? [], results: store.partResults ?? {}, onToggle: partToggle, onTest: partTest, onTestAll: partTestAll });
    renderTasks(taskList, manifest, store.level, store.tasksDone, (id, ok) => {
      store.tasksDone = { ...store.tasksDone, [id]: ok };
    });
    renderSoll($('harness-soll'), manifest);
    document.body.dataset.ampel = store.ampel;
  };

  /** Vollstaendiges Neu-Rendern nach Sprachumschaltung (alle sichtbaren Strings). */
  const repaintAll = () => {
    applyLocale(getLocale());
    if (langSel) langSel.value = getLocale();
    try { providerCtl?.repaint?.(); } catch { /* Panel bleibt */ }
    const last = reportsById.get(curModel()?.id ?? store.modelId);
    if (last) renderReport(reportBox, last);
    else renderReport(reportBox, null);
    library.paint();
    paint();
  };
  if (langSel) {
    langSel.addEventListener('change', () => {
      setLocale(langSel.value);
      repaintAll();
    });
  }

  const library = mountLibrary({
    lib,
    listBox: $('lib-list'),
    detailBox: /** @type {HTMLElement} */ ($('lib-detail')),
    statusBox: $('lib-status'),
    onView: async (entry) => {
      if (!player) throw new Error(tt('harness.fehlerKeinPlayer'));
      await player.load({ id: String(entry.id).slice(0, 24), kind: 'session', source: entry.source, manifest: entry.manifest });
      paint();
    },
    onScores: (id) => reportsById.get(id) ?? { modelId: id, iteration: 1, layers: [] },
    onChange: persistLib,
  });
  /** @type {HTMLInputElement} */ ($('lib-consent')).addEventListener('change', (ev) => {
    setConsent(lib, /** @type {HTMLInputElement} */ (ev.target).checked);
    persistLib();
    library.say(lib.consent ? tt('bibliothek.sitzungMerkt') : tt('bibliothek.nurSpeicher'));
  });

  if (webgl2) {
    try {
      const assets = await loadAssets();
      player = createPlayer({
        mount,
        assets,
        onReport: (r) => {
          store.ampel = r.verdict === 'rot' ? 'rot' : 'gelb';
          reportsById.set(r.modelId, r);
          renderReport(reportBox, r);
          paint();
        },
      });
    } catch (e) {
      reportBox.textContent = tt('player.playerFehler', { detail: e.message });
    }
  } else {
    showFallback(fallbackPanel, fallbackText, fallbackMessage(store.level, 'no-webgl2'));
  }

  $('harness-one').addEventListener('click', async () => {
    const st = $('harness-status');
    try {
      if (!player) throw new Error(tt('harness.fehlerKeinPlayer'));
      const r = player.report();
      reportsById.set(r.modelId, r);
      renderScoreboard($('harness-board'), [r]);
      st.textContent = tt('harness.geprueft', { id: r.modelId, ampel: r.verdict });
    } catch (e) {
      st.textContent = tt('harness.fehler', { detail: e.message });
    }
  });
  $('harness-all').addEventListener('click', async () => {
    const st = $('harness-status');
    if (!player) {
      st.textContent = tt('harness.fehlerKeinPlayer');
      return;
    }
    const collected = [];
    for (const m of registry) {
      try {
        await player.load({ id: m.id, kind: 'lab', source: m.source, manifest: m.manifest });
        collected.push(player.report());
      } catch (e) {
        st.textContent = tt('harness.abgebrochen', { id: m.id, detail: e.message });
        break;
      }
    }
    reportsById.clear();
    for (const r of collected) reportsById.set(r.modelId, r);
    renderScoreboard($('harness-board'), collected);
    library.paint();
    persistLib();
    st.textContent = tt('harness.alleGeprueft', { n: collected.length, gesamt: registry.length });
  });

  loadM7Status().then((m7) => {
    $('harness-m7').textContent = m7
      ? tt('harness.m7Lauf', { n: m7.count ?? '?', datum: String(m7.createdAt ?? '').slice(0, 10) })
      : tt('harness.m7KeinLauf');
  });

  Alpine.data('labShell', () => ({
    async loadModel() {
      if (!player) return;
      hideFallback(fallbackPanel);
      try {
        const current = registry.find((m) => m.id === store.modelId);
        if (!current) return;
        await player.load({ id: current.id, kind: 'lab', source: current.source, manifest: current.manifest });
        paint();
      } catch (e) {
        try {
          renderReport(reportBox, player.report());
        } catch {
          reportBox.textContent = tt('player.ladefehler', { detail: e.message });
        }
        store.ampel = 'rot';
        paint();
      }
    },
    setLevel() {
      try {
        player?.setLevel(store.level);
      } catch {
        /* E-API-UPDATE: Level bleibt, Bericht zeigt Stand */
      }
      paint();
    },
    setAnnotations() {
      try {
        player?.setAnnotations({ labels: store.labels, measurements: store.measurements, maxLabels: store.level === 'basis' ? 5 : 64 });
      } catch {
        /* E-API-UPDATE */
      }
      paint();
    },
    setView(preset) {
      try {
        player?.setView(preset);
      } catch {
        /* E-API-UPDATE */
      }
    },
    useFallback2D() {
      try {
        player?.fallback2D(store.level);
        showFallback(fallbackPanel, fallbackText, fallbackMessage(store.level, 'manual'));
      } catch (e) {
        showFallback(fallbackPanel, fallbackText, `F4: ${e.message}`);
      }
    },
  }));

  Alpine.start();
  paint();
  if (player) {
    mountLivegen({
      proxyInput: /** @type {HTMLInputElement} */ ($('live-proxy')),
      keyInput: /** @type {HTMLInputElement} */ ($('live-key')),
      consentInput: /** @type {HTMLInputElement} */ ($('live-consent')),
      termInput: /** @type {HTMLInputElement} */ ($('live-term')),
      goButton: /** @type {HTMLButtonElement} */ ($('live-go')),
      statusBox: $('live-status'),
      player,
      // Zielpfad aus der Anbieterwahl (M3): Upstream-Slug aus providerModellId,
      // wenn verifiziert (enthaelt '/'); sonst Registry-Id (Proxy meldet ehrlich E-GEN-404).
      getTarget: () => {
        const st = providerCtl?.state;
        if (!st || !providersReg) return null;
        const m = getModel(providersReg, st.providerId, st.modelId);
        const slug = typeof m?.providerModellId === 'string' && m.providerModellId.includes('/') && !/\s/.test(m.providerModellId)
          ? m.providerModellId
          : st.modelId;
        return { providerId: st.providerId, modelId: slug };
      },
      onRegistry: (entry) => {
        registry.push(entry);
        setModels(store, registry);
        store.modelId = entry.id;
      },
    });
    for (const m of registry) {
      try {
        addEntry(lib, { id: m.id, title: m.title, source: m.source, manifest: m.manifest, providerId: 'meta-muse', modelId: providerCtl?.state?.modelId ?? 'muse-spark-1.3-contributor', kind: 'kuratiert' });
      } catch { /* Duplikat beim Reload: ok */ }
    }
    library.paint();
  }
  $('lib-adopt').addEventListener('click', () => {
    try {
      const current = registry.find((m) => m.id === store.modelId);
      if (!current) throw new Error(tt('bibliothek.keinModell'));
      library.adoptCurrent(current, providerCtl?.state?.providerId ?? 'meta-muse', providerCtl?.state?.modelId ?? 'muse-spark-1.3-contributor');
      persistLib();
    } catch (e) {
      $('lib-status').textContent = tt('bibliothek.uebernahmeFehler', { detail: e.message });
    }
  });
  /** @type {HTMLInputElement} */ ($('lib-import')).addEventListener('change', async (ev) => {
    const f = /** @type {HTMLInputElement} */ (ev.target).files?.[0];
    if (!f) return;
    try {
      await library.importFile(f);
      persistLib();
    } catch (e) {
      $('lib-status').textContent = tt('bibliothek.importFehler', { detail: e.message });
    }
    /** @type {HTMLInputElement} */ (ev.target).value = '';
  });
  if (player && store.modelId) {
    try {
      const current = registry.find((m) => m.id === store.modelId);
      if (current) await player.load({ id: current.id, kind: 'lab', source: current.source, manifest: current.manifest });
    } catch {
      /* Startfehler steht im Bericht */
    }
    paint();
  }
}

boot();
