/**
 * Teil 1 — Anbieter-/Modellauswahl-UI (DOM-Bindung, Logik in runtime/providers.js).
 * Keys: Meta-Pfad braucht kein Key-Feld (muse.exe); Baseten-Pfad nimmt
 * Proxy-URL + Key, OpenRouter-Pfad nur Key (Direkt-Call) — jeweils NUR
 * laufzeitsseitig (Speicher, Session-Storage je Anbieter mit Zustimmung).
 * Nie Logs, nie Dateien.
 */
import {
  getProvider, getModel, recommendModel, privacyNotice, generationTarget, didaktikHinweis,
} from '../runtime/providers.js';
import { configureLiveGen, setLiveApiKey, clearLiveApiKey, liveKeySessionKey } from '../runtime/livegen.js';
import { tt } from './i18n.js';

/**
 * @param {{ registry: unknown }} reg
 */
export function providerOptions(reg) {
  return (reg?.providers ?? []).map((p) => ({ id: p.id, label: p.label, status: p?.generation?.status ?? '?' }));
}

/**
 * @param {{ registry: unknown, providerSel: HTMLSelectElement, modelSel: HTMLSelectElement, badgeBox: HTMLElement, privacyBox: HTMLElement, cmdBox: HTMLElement, proxyRow?: HTMLElement, proxyInput?: HTMLInputElement, keyInput?: HTMLInputElement, consentInput?: HTMLInputElement, docsBox?: HTMLElement, statusBox?: HTMLElement }} els
 */
export function mountProviders(els) {
  const reg = els.registry;
  const providers = reg?.providers ?? [];
  const state = {
    providerId: reg?.defaultProvider ?? providers[0]?.id,
    modelId: reg?.defaultModel ?? providers[0]?.models?.[0]?.id,
  };

  function paintDocs(p) {
    if (!els.docsBox) return;
    els.docsBox.innerHTML = '';
    for (const d of p?.docs ?? []) {
      const a = document.createElement('a');
      a.href = d.url;
      a.textContent = d.label;
      a.target = '_blank';
      a.rel = 'noopener';
      els.docsBox.appendChild(a);
      els.docsBox.appendChild(document.createTextNode(' '));
    }
  }

  function paint() {
    const p = getProvider(reg, state.providerId);
    els.modelSel.innerHTML = '';
    for (const m of p?.models ?? []) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${m.label}${(m.tags ?? []).length ? ` [${m.tags.join('/')}]` : ''}`;
      els.modelSel.appendChild(o);
    }
    if (!getModel(reg, state.providerId, state.modelId)) state.modelId = p?.models?.[0]?.id;
    els.modelSel.value = state.modelId;
    const m = getModel(reg, state.providerId, state.modelId);
    els.badgeBox.innerHTML = '';
    for (const b of m?.badges ?? []) {
      const s = document.createElement('span');
      s.className = `prov-badge prov-${b.achse}`;
      s.textContent = b.text;
      els.badgeBox.appendChild(s);
    }
    els.privacyBox.textContent = privacyNotice(reg, state.providerId, state.modelId);
    const g = generationTarget(reg, state.providerId, state.modelId);
    els.cmdBox.textContent = g.ready ? tt('anbieter.generierung', { detail: g.text }) : g.text;
    const needProxy = p?.generation?.kind === 'proxy';
    if (els.proxyRow) els.proxyRow.hidden = !needProxy;
    paintDocs(p);
    if (els.statusBox) {
      const rec = [
        recommendModel(reg, 'geometrie'),
        recommendModel(reg, 'aesthetik'),
        recommendModel(reg, 'allround'),
      ];
      els.statusBox.textContent = tt('anbieter.empfehlung', {
        geo: rec[0].modelId, aes: rec[1].modelId, all: rec[2].modelId, didaktik: didaktikHinweis(reg),
      });
    }
  }

  els.providerSel.innerHTML = '';
  for (const p of providers) {
    const o = document.createElement('option');
    o.value = p.id;
    const suffix = p?.generation?.status === 'aktiv' ? ''
      : p?.generation?.kind === 'direct' ? tt('anbieter.byokNoetig')
      : tt('anbieter.proxyNoetig');
    o.textContent = `${p.label}${suffix}`;
    els.providerSel.appendChild(o);
  }
  els.providerSel.value = state.providerId;
  // Key je Anbieter: beim Wechsel alten Feld-Key unter altem Anbieter-Key
  // parken, neuen Anbieter-Key ins Feld laden (Speicher folgt dem Feld).
  const stashFieldKey = (providerId) => {
    try {
      const cur = els.keyInput?.value.trim() ?? '';
      if (cur.length >= 8) {
        try { setLiveApiKey(cur); } catch { /* Feld prueft spaeter */ }
        try {
          const box = els.consentInput;
          if (box?.checked) sessionStorage.setItem(liveKeySessionKey(providerId), cur);
        } catch { /* Speicher blockiert */ }
      }
    } catch { /* kein Key-Feld verdrahtet */ }
  };
  const restoreFieldKey = (providerId) => {
    try {
      const saved = sessionStorage.getItem(liveKeySessionKey(providerId))
        ?? sessionStorage.getItem('modelmuse-live-key');
      if (els.keyInput) els.keyInput.value = (typeof saved === 'string' && saved.length >= 8) ? saved : '';
      if (els.keyInput?.value) {
        try { setLiveApiKey(els.keyInput.value); } catch { /* Feld prueft spaeter */ }
      } else {
        clearLiveApiKey();
      }
    } catch { clearLiveApiKey(); }
  };
  els.providerSel.addEventListener('change', () => {
    stashFieldKey(state.providerId);
    state.providerId = els.providerSel.value;
    const p = getProvider(reg, state.providerId);
    state.modelId = p?.models?.[0]?.id;
    restoreFieldKey(state.providerId);
    paint();
  });
  els.modelSel.addEventListener('change', () => {
    state.modelId = els.modelSel.value;
    paint();
  });
  paint();
  return {
    state,
    /** Panel neu rendern (z. B. nach Sprachumschaltung). */
    repaint: paint,
    /** Proxy-Pfad laufzeitsseitig scharf schalten (Keys nur im Speicher). */
    armProxy() {
      const url = els.proxyInput?.value.trim() ?? '';
      const key = els.keyInput?.value.trim() ?? '';
      if (!url || !key) throw Object.assign(new Error('E-GEN-CONFIG: Proxy-URL und Key eintragen'), { code: 'E-GEN-CONFIG' });
      configureLiveGen({ proxyUrl: url, timeoutMs: 300000 }); // E2E-Befund 2026-10-27: Streams > 90 s
      setLiveApiKey(key);
      try {
        if (els.consentInput?.checked) sessionStorage.setItem('modelmuse-proxy', url);
        else sessionStorage.removeItem('modelmuse-proxy');
      } catch { /* Speicher blockiert */ }
      return true;
    },
  };
}
