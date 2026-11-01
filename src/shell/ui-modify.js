/**
 * Slim-Generator: Modell-Modify per LLM (P2-Repair als Modify wiederverwendet).
 * Ablauf: Modell waehlen -> Aenderungswunsch (Prompt) -> P2-Prompt an den
 * Generierungs-Proxy -> Verify (player.load) -> Reload als neue Sitzungs-Revision.
 * Reine Prompt-Bauer sind DOM-/netzfrei und unit-getestet (tests-unit/modify.test.mjs).
 */
import { configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey, errorDiagnose, liveKeySessionKey } from '../runtime/livegen.js';
import { germanMessageWithHint } from './ui-livegen.js';
import { extractMeta, formatP2Protocol } from '../runtime/verify.js';
import { baseLabId, loadHistory, recordModify, getVersion } from '../runtime/model-history.js';
import { tt } from './i18n.js';
import { wireDiagnoseCopy, showDiagnoseButton, hideDiagnoseButton } from './ui-diagnose.js';

/** Max. automatische Modify-Iterationen (P2-Regel: max 2, Iteration 3 nur manuell). */
export const MODIFY_MAX_ITERATION = 2;

/**
 * Eindeutige Modify-ID zum Basismodell (rein, ohne DOM/Netz).
 * @param {string} baseId Original-Modell-ID (ein evtl. vorhandenes -modN-Suffix wird gestrippt)
 * @param {(id: string) => boolean} exists Prueffunktion fuer bereits vergebene IDs
 */
export function modifyModelId(baseId, exists) {
  const base = String(baseId ?? '').replace(/-mod\d+$/, '').slice(0, 20) || 'modell';
  for (let n = 1; n < 100; n += 1) {
    const id = `${base}-mod${n}`;
    if (!exists(id)) return id;
  }
  throw Object.assign(new Error('E-MODIFY-ID: keine freie Modify-ID'), { code: 'E-MODIFY-ID' });
}

/**
 * Manifest nach Modify fortfuehren: Titel/Labels aus neuer Meta uebernehmen,
 * Messungen/Aufgaben (Verify-relevant, S5) bleiben erhalten.
 * @param {unknown} orig Original-Manifest (kann null sein)
 * @param {{ title?: unknown, parts?: unknown }} newMeta frisch extrahierte Meta
 */
export function mergeManifest(orig, newMeta) {
  const m = orig && typeof orig === 'object'
    ? JSON.parse(JSON.stringify(orig))
    : { schemaVersion: 1.0, title: 'Modify', labels: [], measurements: [], tasks: [] };
  if (typeof newMeta?.title === 'string' && newMeta.title.trim().length >= 3) {
    m.title = newMeta.title.trim().slice(0, 80);
  }
  if (Array.isArray(newMeta?.parts) && newMeta.parts.length >= 3) {
    m.labels = newMeta.parts.map(String).slice(0, 64);
  }
  return m;
}

/**
 * P2-Modify-Prompt bauen (P2-Template = Vertrag, danach der konkrete Auftrag).
 * @param {{ modelId: string, title: string, source: string, userPrompt: string, protocolText?: string, p2Template?: string, locale?: string }} args
 */
export function buildModifyPrompt(args) {
  const template = String(args?.p2Template ?? '').trim();
  if (template.length < 64) {
    throw Object.assign(new Error('E-MODIFY-CONFIG: P2-Vorlage fehlt'), { code: 'E-MODIFY-CONFIG' });
  }
  const source = String(args?.source ?? '');
  if (!source.includes('export const meta') || !source.includes('export function init')) {
    throw Object.assign(new Error('E-MODIFY-SOURCE: kein gueltiges Modul'), { code: 'E-MODIFY-SOURCE' });
  }
  const wish = String(args?.userPrompt ?? '').trim();
  if (wish.length < 2) {
    throw Object.assign(new Error('E-MODIFY-400: Aenderungswunsch zu kurz'), { code: 'E-MODIFY-400' });
  }
  const loc = ['de', 'en', 'es', 'fr'].includes(args?.locale) ? args.locale : 'de';
  const proto = String(args?.protocolText ?? '').trim()
    || '[keine] Alle Schichten pass — nur den Aenderungswunsch umsetzen.';
  return [
    template,
    '',
    `P2-MODIFY-AUFTRAG (Modell ${args.modelId} „${args.title}“, max. Iteration ${MODIFY_MAX_ITERATION}).`,
    `Aenderungswunsch: ${wish.slice(0, 500)}`,
    'ORIGINALQUELLE (genau dieses Modul aendern, keine neue Datei erfinden):',
    source.slice(0, 60000),
    'FEHLERPROTOKOLL (zusaetzlich zum Wunsch zu reparieren):',
    proto,
    `AUFTRAG: Setze GENAU den Aenderungswunsch um; repariere zusaetzlich alle protokollierten FAIL-Kriterien; bestandene Schichten unveraendert lassen. Labels im Code in Sprache (${loc}). Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences. Kein Nachdenken, keine Einleitung — antworte direkt mit dem Modulcode.`,
  ].join('\n');
}

/**
 * Bindet das Modify-Formular. Proxy/Key kommen aus dem Generieren-Panel
 * (getProxy), Keys bleiben nur im Speicher (livegen-Modul), nie in Logs.
 * @param {{ promptInput: HTMLInputElement, goButton: HTMLButtonElement, statusBox: HTMLElement, modelBox: HTMLElement, player: { load: (ref: unknown) => Promise<unknown> }, getCurrent: () => ({ id: string, title: string, source: string, manifest: unknown, report: { layers?: unknown[], iteration?: number } | null }) | null, getProxy: () => { url: string, key: string }, getTarget?: () => ({ providerId: string, modelId: string } | null), existsId?: (id: string) => boolean, onReloaded?: (entry: { id: string, title: string, source: string, manifest: unknown }) => void, onRestored?: (entry: { id: string, title: string, source: string, manifest: unknown }) => void, historyBox?: HTMLElement | null, historyStorage?: { getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void } | null, p2Template?: string, locale?: string }} els
 */
export function mountModify(els) {
  let iteration = 0;
  /** Verlauf-Storage: explizit injiziert oder Browser-localStorage, sonst Gedächtnis. */
  const histStore = els.historyStorage ?? (() => {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') return localStorage;
    } catch { /* blockiert */ }
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
  })();
  /** Aktuelle Familien-ID (ohne -modN) für die Historie. */
  const histLabId = () => {
    try {
      const cur = els.getCurrent?.();
      return baseLabId(cur?.id ?? 'modell');
    } catch {
      return 'modell';
    }
  };
  const paintModel = () => {
    try {
      const cur = els.getCurrent?.();
      els.modelBox.textContent = cur ? `${cur.id} — ${cur.title}` : tt('modify.keinModell');
    } catch {
      els.modelBox.textContent = tt('modify.keinModell');
    }
  };
  paintModel();
  /** @param {string} msg @param {boolean} [bad] */
  const say = (msg, bad) => {
    els.statusBox.textContent = msg;
    els.statusBox.dataset.state = bad ? 'fehler' : 'ok';
  };
  /**
   * Historienliste (V1..VX) ins Overlay malen. Rein lesend aus localStorage.
   */
  const paintHistory = () => {
    const box = els.historyBox;
    if (!box || typeof document === 'undefined') return;
    try {
      box.innerHTML = '';
      const versions = loadHistory(histStore, histLabId());
      if (versions.length === 0) {
        const li = document.createElement('li');
        li.className = 'hist-empty';
        li.textContent = tt('modify.keineHistorie');
        box.appendChild(li);
        return;
      }
      const loc = els.locale ?? 'de';
      let curSrc = null;
      try {
        curSrc = els.getCurrent?.()?.source ?? null;
      } catch { curSrc = null; }
      for (const snap of [...versions].reverse()) {
        const li = document.createElement('li');
        li.className = 'hist-row';
        let datum = snap.ts;
        try {
          datum = new Date(snap.ts).toLocaleString(loc);
        } catch { /* ISO bleibt */ }
        const label = document.createElement('span');
        label.textContent = tt('modify.versionEintrag', { nr: snap.v, datum, titel: snap.title || snap.ts });
        li.appendChild(label);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lab-btn hist-btn';
        btn.dataset.version = String(snap.v);
        // Aktive Version (angezeigte Quelle == Snapshot): "Ausgewaehlt",
        // andere Buttonfarbe (CSS .is-active), kein Klick. Nur sie unterscheidet sich.
        const isActive = typeof curSrc === 'string' && curSrc.length > 0 && snap.source === curSrc;
        if (isActive) {
          btn.classList.add('is-active');
          btn.textContent = tt('modify.ausgewaehlt');
          btn.disabled = true;
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.textContent = tt('modify.wiederherstellen');
          btn.addEventListener('click', () => { void restoreVersion(snap.v); });
        }
        li.appendChild(btn);
        box.appendChild(li);
      }
    } catch { /* Verlauf ist Best-effort, Modify bleibt nutzbar */ }
  };
  /**
   * Version V als aktuelle Ansicht laden (in-place, Historie bleibt erhalten).
   * @param {number} v
   */
  const restoreVersion = async (v) => {
    const cur = els.getCurrent?.();
    if (!cur) {
      say(tt('modify.keinModell'), true);
      return;
    }
    const snap = getVersion(loadHistory(histStore, histLabId()), v);
    if (!snap) {
      say(tt('modify.keinZurueck'), true);
      return;
    }
    say(tt('modify.generiere', { id: cur.id }));
    try {
      const manifest = mergeManifest(cur.manifest, extractMeta(snap.source) ?? { title: snap.title, parts: [] });
      await els.player.load({ id: cur.id, kind: 'session', source: snap.source, manifest });
      els.onRestored?.({ id: cur.id, title: snap.title || cur.title, source: snap.source, manifest });
      paintModel();
      paintHistory();
      say(tt('modify.wiederhergestellt', { titel: snap.title || cur.title, nr: snap.v }));
    } catch (e) {
      say(tt('modify.pruefungRot', { detail: String((e && e.message) || e).slice(0, 200) }), true);
    }
  };
  // Diagnose-Export (v22): wie Freimodus — nur im Fehlerzustand sichtbar.
  let lastDiagnose = null;
  const copyBtn = typeof document !== 'undefined' ? document.getElementById('modify-diagnose-copy') : null;
  wireDiagnoseCopy(copyBtn, () => lastDiagnose);
  paintHistory();
  els.goButton.addEventListener('click', async () => {
    const wish = els.promptInput.value.trim();
    if (wish.length < 2) {
      say(tt('modify.promptZuKurz'), true);
      return;
    }
    const cur = els.getCurrent?.();
    if (!cur) {
      say(tt('modify.keinModell'), true);
      return;
    }
    if (iteration >= MODIFY_MAX_ITERATION) {
      say(tt('modify.reserve', { id: cur.id }), true);
      return;
    }
    const { url, key } = els.getProxy?.() ?? { url: '', key: '' };
    const earlyTarget = typeof els.getTarget === 'function' ? els.getTarget() : null;
    const earlyProvider = earlyTarget?.providerId ?? undefined;
    // Direkt-Call braucht keinen Proxy: Key allein genuegt (BYOK, Browser -> Upstream).
    if (!url && !key) {
      say(tt('fehler.E-GEN-OFFLINE'), true);
      return;
    }
    if (key) {
      try {
        setLiveApiKey(key);
        try {
          const box = /** @type {HTMLInputElement | null} */ (document.getElementById('live-consent'));
          if (box?.checked) sessionStorage.setItem(liveKeySessionKey(earlyProvider), key);
        } catch { /* Speicher blockiert */ }
      } catch {
        say(germanMessageWithHint({ code: 'E-GEN-CONFIG' }, earlyProvider), true);
        return;
      }
    } else {
      clearLiveApiKey();
    }
    try {
      configureLiveGen({ proxyUrl: url || null, timeoutMs: 300000 });
    } catch {
      say(germanMessageWithHint({ code: 'E-GEN-CONFIG' }, earlyProvider), true);
      return;
    }
    const target = typeof els.getTarget === 'function' ? els.getTarget() : null;
    els.goButton.disabled = true;
    lastDiagnose = null;
    hideDiagnoseButton(copyBtn);
    say(tt('modify.generiere', { id: cur.id }));
    try {
      const proto = formatP2Protocol(cur.report?.layers ?? [], { iteration: (cur.report?.iteration ?? 1) + 1 });
      const prompt = buildModifyPrompt({
        modelId: cur.id,
        title: cur.title,
        source: cur.source,
        userPrompt: wish,
        protocolText: proto,
        p2Template: els.p2Template,
        locale: els.locale ?? 'de',
      });
      const gen = await generateLive(prompt, {
        seed: 7,
        provider: target?.providerId ?? undefined,
        model: target?.modelId ?? undefined,
      });
      const meta = extractMeta(gen.source) ?? { title: cur.title, parts: [] };
      const manifest = mergeManifest(cur.manifest, meta);
      const id = modifyModelId(cur.id, (x) => (els.existsId?.(x) ?? false));
      const title = `${manifest.title ?? cur.title} (Modify)`;
      await els.player.load({ id, kind: 'session', source: gen.source, manifest: { ...manifest, title } });
      iteration += 1;
      try {
        recordModify(histStore, {
          labId: baseLabId(cur.id),
          prevSource: cur.source,
          prevTitle: cur.title,
          nextSource: gen.source,
          nextTitle: title,
        });
      } catch { /* Verlauf ist Best-effort: Modify-Ergebnis bleibt geladen */ }
      els.onReloaded?.({ id, title, source: gen.source, manifest: { ...manifest, title } });
      paintModel();
      paintHistory();
      say(tt('modify.geladen', { titel: title, id }));
    } catch (e) {
      lastDiagnose = errorDiagnose(e);
      showDiagnoseButton(copyBtn);
      const code = e && typeof e.code === 'string' ? e.code : '';
      const detail = String((e && e.message) || e).slice(0, 200);
      if (code.startsWith('E-GEN-') && tt(`fehler.${code}`) !== `fehler.${code}`) say(germanMessageWithHint(e, target?.providerId ?? undefined), true);
      else if (code.startsWith('E-MODIFY-')) say(tt('modify.fehler', { detail }), true);
      else say(tt('modify.pruefungRot', { detail }), true);
    } finally {
      els.goButton.disabled = false;
    }
  });
  return { repaintModel: () => { paintModel(); paintHistory(); }, repaintHistory: paintHistory, restoreVersion };
}
