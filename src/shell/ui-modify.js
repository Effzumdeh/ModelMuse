/**
 * Slim-Generator: Modell-Modify per LLM (P2-Repair als Modify wiederverwendet).
 * Ablauf: Modell waehlen -> Aenderungswunsch (Prompt) -> P2-Prompt an den
 * Generierungs-Proxy -> Verify (player.load) -> Reload als neue Sitzungs-Revision.
 * Reine Prompt-Bauer sind DOM-/netzfrei und unit-getestet (tests-unit/modify.test.mjs).
 */
import { configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey } from '../runtime/livegen.js';
import { extractMeta, formatP2Protocol } from '../runtime/verify.js';
import { tt } from './i18n.js';

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
  const loc = ['de', 'en', 'es'].includes(args?.locale) ? args.locale : 'de';
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
 * @param {{ promptInput: HTMLInputElement, goButton: HTMLButtonElement, statusBox: HTMLElement, modelBox: HTMLElement, player: { load: (ref: unknown) => Promise<unknown> }, getCurrent: () => ({ id: string, title: string, source: string, manifest: unknown, report: { layers?: unknown[], iteration?: number } | null }) | null, getProxy: () => { url: string, key: string }, getTarget?: () => ({ providerId: string, modelId: string } | null), existsId?: (id: string) => boolean, onReloaded?: (entry: { id: string, title: string, source: string, manifest: unknown }) => void, p2Template?: string, locale?: string }} els
 */
export function mountModify(els) {
  let iteration = 0;
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
          if (box?.checked) sessionStorage.setItem('modelmuse-live-key', key);
        } catch { /* Speicher blockiert */ }
      } catch {
        say(tt('fehler.E-GEN-CONFIG'), true);
        return;
      }
    } else {
      clearLiveApiKey();
    }
    try {
      configureLiveGen({ proxyUrl: url || null, timeoutMs: 300000 });
    } catch {
      say(tt('fehler.E-GEN-CONFIG'), true);
      return;
    }
    const target = typeof els.getTarget === 'function' ? els.getTarget() : null;
    els.goButton.disabled = true;
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
      els.onReloaded?.({ id, title, source: gen.source, manifest: { ...manifest, title } });
      paintModel();
      say(tt('modify.geladen', { titel: title, id }));
    } catch (e) {
      const code = e && typeof e.code === 'string' ? e.code : '';
      const detail = String((e && e.message) || e).slice(0, 200);
      if (code.startsWith('E-GEN-') && tt(`fehler.${code}`) !== `fehler.${code}`) say(tt(`fehler.${code}`), true);
      else if (code.startsWith('E-MODIFY-')) say(tt('modify.fehler', { detail }), true);
      else say(tt('modify.pruefungRot', { detail }), true);
    } finally {
      els.goButton.disabled = false;
    }
  });
  return { repaintModel: paintModel };
}
