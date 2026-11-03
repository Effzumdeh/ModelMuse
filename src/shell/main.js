/** Bootstrap: Player erzeugen, Labs-Nav + Modellliste binden. */
import Alpine from '../vendor/alpine.module.esm.min.js';
import { createLabStore } from './store.js';
import { setModels } from './ui-model-picker.js';
import { renderAnnotations } from './ui-annotations.js';
import { renderReport } from './ui-report.js';
import { showFallback, hideFallback, fallbackMessage } from './ui-fallback2d.js';
import { createPlayer } from '../runtime/player.js';
import { getModel } from '../runtime/providers.js';
import { setLocale, getLocale, detectLocale, tt, applyLocale, localizeManifest } from './i18n.js';
import { mountLivegen } from './ui-livegen.js';
import { mountProviders } from './ui-providers.js';
import { mountLibrary } from './ui-library.js';
import { mountModify } from './ui-modify.js';
import { createLibrary, setConsent, serializeForSession, restoreFromSession, addEntry, getEntry } from '../runtime/session-library.js';
import { toggleHidden } from '../runtime/parts.js';

const MODEL_IDS = ['gpu-example', 'si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'free-handbohrmaschine', 'chemie-koffein'];

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

/** P2-Vorlage fuer Modify: Build Inline, Dev Fetch (Single Source prompts/). */
async function loadP2Template() {
  const inline = /** @type {unknown} */ (window.__P2_TEMPLATE__);
  if (typeof inline === 'string' && inline.length > 64) return inline;
  const r = await fetch('./prompts/p2-repair.v6-harness.txt');
  if (!r.ok) throw new Error('p2-repair.v6-harness.txt fehlt');
  return r.text();
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} fehlt`);
  return el;
}

async function boot() {
  // Teil 5: Standard = Systemsprache des Users, umschaltbar (de/en/es/fr).
  setLocale(detectLocale());
  applyLocale(getLocale());
  const langSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('lang-select'));
  if (langSel) langSel.value = getLocale();
  const helpLinkInit = /** @type {HTMLAnchorElement | null} */ (document.getElementById('help-link'));
  if (helpLinkInit) helpLinkInit.setAttribute('href', `docs/help/${getLocale()}.html`);
  createLabStore(Alpine);
  const store = Alpine.store('lab');
  const webgl2 = hasWebGL2();
  const mount = $('lab-mount');
  const labsList = $('labs-list');
  const annotationList = $('annotation-list');
  const reportBox = $('verify-report');
  const fallbackPanel = $('fallback-panel');
  const fallbackText = $('fallback-text');

  // v52: Theme Hell/Dunkel — Default folgt dem System (prefers-color-scheme,
  // live bei Systemwechsel), manueller Toggle ueberschreibt und wird persistiert.
  const THEME_KEY = 'modelmuse-theme';
  const themeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('theme-toggle'));
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    if (themeBtn) themeBtn.dataset.theme = theme === 'light' ? 'light' : 'dark';
  };
  const systemTheme = () => (
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  );
  const storedTheme = () => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return t === 'light' || t === 'dark' ? t : null;
    } catch {
      return null;
    }
  };
  const paintThemeBtn = () => {
    if (!themeBtn) return;
    const light = document.documentElement.dataset.theme === 'light';
    themeBtn.textContent = light ? tt('theme.dunkel') : tt('theme.hell');
  };
  applyTheme(storedTheme() ?? systemTheme());
  try {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onSystem = () => {
      if (storedTheme()) return; // Manuelle Wahl gewinnt, kein Live-Override.
      applyTheme(systemTheme());
      paintThemeBtn();
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystem);
    else if (mq.addListener) mq.addListener(onSystem);
  } catch { /* kein MatchMedia: Default bleibt */ }
  themeBtn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* Speicher blockiert */ }
    applyTheme(next);
    paintThemeBtn();
  });
  paintThemeBtn();

  // Teil 6 (Standalone-Maßstab): Onboarding-Banner (einmalig, localStorage).
  const onboard = document.getElementById('onboard');
  let onboardSeen = false;
  try {
    onboardSeen = localStorage.getItem('modelmuse.onboarded') === 'ja';
  } catch { /* Speicher blockiert: Banner zeigen */ }
  if (onboard && !onboardSeen) onboard.hidden = false;
  document.getElementById('onboard-ok')?.addEventListener('click', () => {
    try {
      localStorage.setItem('modelmuse.onboarded', 'ja');
    } catch { /* Speicher blockiert */ }
    if (onboard) onboard.hidden = true;
  });

  // Teil 6 (Standalone-Maßstab): Labs-Suche filtert die Nav-Liste.
  const labsSearch = /** @type {HTMLInputElement | null} */ (document.getElementById('labs-search'));
  const labsCount = document.getElementById('labs-count');
  const labFilter = () => (labsSearch?.value ?? '').trim().toLowerCase();
  labsSearch?.addEventListener('input', () => renderLabs());

  let player = null;
  let registry = [];
  let modifyCtl = null;
  // O-12: nur fuer Levelwechsel-Test, keine Steuerfunktion (rein lesend).
  const labDebugState = { sessionId: null, meshes: null };
  window.__labDebug = {
    sessionId: () => labDebugState.sessionId,
    meshes: () => labDebugState.meshes,
  };
  /** Letzte bekannte Mesh-Anzahl aus dem Bericht (S4-meshcount aus der Probe). @param {unknown} r */
  const noteMeshCount = (r) => {
    try {
      const layers = /** @type {Array<{ layer?: string, criteria?: Array<{ id?: string, actual?: unknown }> }>} */ (/** @type {{ layers?: unknown }} */ (r)?.layers ?? []);
      const s4 = layers.find((l) => l?.layer === 'S4');
      const crit = s4?.criteria?.find((c) => c?.id === 'S4-meshcount');
      const n = parseInt(String(crit?.actual ?? ''), 10);
      if (Number.isFinite(n)) labDebugState.meshes = n;
    } catch { /* Debug-Stand bleibt erhalten */ }
  };
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
  const LIB_KEY = 'modelmuse-lib';
  const LIB_CONSENT = 'modelmuse-lib-consent';
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

  /** Labs-Nav links: ein Button je Modell, aktiv markiert (Suche filtert). */
  const renderLabs = () => {
    labsList.innerHTML = '';
    const q = labFilter();
    let shown = 0;
    for (const m of registry) {
      const title = m.title ?? m.id;
      if (q && !`${title} ${m.id}`.toLowerCase().includes(q)) continue;
      shown += 1;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lab-btn lab-lab-btn';
      btn.dataset.lab = m.id;
      btn.textContent = title;
      btn.setAttribute('aria-current', m.id === store.modelId ? 'true' : 'false');
      btn.addEventListener('click', () => loadModelById(m.id));
      li.appendChild(btn);
      labsList.appendChild(li);
    }
    if (labsCount) labsCount.textContent = `(${shown}/${registry.length})`;
  };

  const paint = () => {
    const current = curModel();
    // Teil 5: Ansicht in gewaehlter Lokale (kanonisches Deutsch bleibt Pruefbasis).
    const manifest = localizeManifest(current?.manifest ?? { labels: [], measurements: [], tasks: [] }, getLocale());
    renderAnnotations(annotationList, manifest, store.level, { labels: store.labels, measurements: store.measurements },
      { hidden: store.partsHidden ?? [], onToggle: partToggle });
    // Phase 2 (H3): Panel-Titel trägt die Bauteil-Anzahl (wie Labs-Zähler).
    try {
      const nAnno = annotationList.querySelectorAll('.part-row').length;
      document.getElementById('annotation-count').textContent = nAnno > 0 ? `(${nAnno})` : '';
    } catch { /* Zähler optional */ }
    document.body.dataset.ampel = store.ampel;
    renderLabs();
    try { modifyCtl?.repaintModel(); } catch { /* Modify-Panel noch nicht gemountet */ }
  };

  /** Vollstaendiges Neu-Rendern nach Sprachumschaltung (alle sichtbaren Strings). */
  const repaintAll = () => {
    applyLocale(getLocale());
    if (langSel) langSel.value = getLocale();
    const helpLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('help-link'));
    if (helpLink) helpLink.setAttribute('href', `docs/help/${getLocale()}.html`);
    paintThemeBtn();
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

  /** Eintrag (Bibliothek oder Registry) in den Viewer laden. */
  const viewEntry = async (entry) => {
    if (!player) throw new Error(tt('bibliothek.keinModell'));
    await player.load({ id: String(entry.id).slice(0, 24), kind: 'session', source: entry.source, manifest: entry.manifest });
    if (!registry.some((m) => m.id === entry.id)) {
      registry.push({ id: entry.id, title: entry.title, source: entry.source, manifest: entry.manifest });
      setModels(store, registry);
    }
    store.modelId = entry.id;
    paint();
  };

  const library = mountLibrary({
    lib,
    listBox: $('lib-list'),
    statusBox: $('lib-status'),
    onView: viewEntry,
    onModify: async (entry) => {
      await viewEntry(entry);
      library.say(tt('bibliothek.inModify', { id: entry.id }));
      /** @type {HTMLTextAreaElement} */ ($('modify-prompt')).focus();
    },
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
          noteMeshCount(r);
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

  /** Modell per ID laden (Labs-Nav + Programm). Phase 2 §4: 160ms-Crossfade, Reduced-Motion = Schnitt. */
  async function loadModelById(id) {
    if (!player) return;
    hideFallback(fallbackPanel);
    let fading = false;
    try {
      const current = registry.find((m) => m.id === id);
      if (!current) return;
      store.modelId = current.id;
      try {
        fading = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      } catch { fading = false; }
      if (fading) {
        mount.classList.add('is-switching');
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      const loaded = await player.load({ id: current.id, kind: 'lab', source: current.source, manifest: current.manifest });
      if (loaded?.sessionId) labDebugState.sessionId = loaded.sessionId;
      paint();
    } catch (e) {
      try {
        renderReport(reportBox, player.report());
      } catch {
        reportBox.textContent = tt('player.ladefehler', { detail: e.message });
      }
      store.ampel = 'rot';
      paint();
    } finally {
      if (fading) mount.classList.remove('is-switching');
    }
  }

  Alpine.data('labShell', () => ({
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
    let p2Template = '';
    try {
      p2Template = await loadP2Template();
    } catch {
      p2Template = '';
    }
    // Zielpfad aus der Anbieterwahl (M3): Upstream-Slug aus providerModellId,
    // wenn verifiziert (enthaelt '/'); sonst Registry-Id (Proxy meldet ehrlich E-GEN-404).
    const getTarget = () => {
      const st = providerCtl?.state;
      if (!st || !providersReg) return null;
      const m = getModel(providersReg, st.providerId, st.modelId);
      const slug = typeof m?.providerModellId === 'string' && m.providerModellId.includes('/') && !/\s/.test(m.providerModellId)
        ? m.providerModellId
        : st.modelId;
      return { providerId: st.providerId, modelId: slug };
    };
    modifyCtl = mountModify({
      promptInput: /** @type {HTMLInputElement} */ ($('modify-prompt')),
      goButton: /** @type {HTMLButtonElement} */ ($('modify-go')),
      statusBox: $('modify-status'),
      modelBox: $('modify-model'),
      historyBox: $('modify-history'),
      player,
      getCurrent: () => {
        const c = curModel();
        if (!c) return null;
        return { id: c.id, title: c.title, source: c.source, manifest: c.manifest, report: reportsById.get(c.id) ?? null };
      },
      getProxy: () => ({
        url: /** @type {HTMLInputElement} */ ($('live-proxy')).value.trim(),
        key: /** @type {HTMLInputElement} */ ($('live-key')).value.trim(),
      }),
      getTarget,
      existsId: (id) => registry.some((m) => m.id === id) || getEntry(lib, id) !== null,
      onReloaded: (entry) => {
        const parentId = store.modelId;
        registry.push({ id: entry.id, title: entry.title, source: entry.source, manifest: entry.manifest });
        setModels(store, registry);
        store.modelId = entry.id;
        try {
          addEntry(lib, { id: entry.id, title: entry.title, source: entry.source, manifest: entry.manifest, providerId: providerCtl?.state?.providerId ?? 'meta-muse', modelId: providerCtl?.state?.modelId ?? 'muse-spark-1.3-contributor', parentId });
        } catch { /* Duplikat beim Reload: ok */ }
        library.paint();
        persistLib();
        paint();
      },
      onRestored: (entry) => {
        const slot = registry.find((m) => m.id === entry.id);
        if (slot) {
          slot.source = entry.source;
          slot.manifest = entry.manifest;
          slot.title = entry.title;
          setModels(store, registry);
        }
        paint();
      },
      p2Template,
      locale: getLocale(),
    });
    mountLivegen({
      proxyInput: /** @type {HTMLInputElement} */ ($('live-proxy')),
      keyInput: /** @type {HTMLInputElement} */ ($('live-key')),
      consentInput: /** @type {HTMLInputElement} */ ($('live-consent')),
      termInput: /** @type {HTMLInputElement} */ ($('live-term')),
      goButton: /** @type {HTMLButtonElement} */ ($('live-go')),
      statusBox: $('live-status'),
      player,
      getTarget,
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
      if (current) {
        const first = await player.load({ id: current.id, kind: 'lab', source: current.source, manifest: current.manifest });
        if (first?.sessionId) labDebugState.sessionId = first.sessionId;
      }
    } catch {
      /* Startfehler steht im Bericht */
    }
    paint();
  }
}

boot();
