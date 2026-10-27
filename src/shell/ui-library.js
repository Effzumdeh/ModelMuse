/**
 * Teil 2 — Modellbibliothek-UI (DOM-Bindung, Logik in runtime/session-library.js).
 * Aktionen: Ansehen, Ueberarbeiten (P2-Lauf mit Messwert-Feedback),
 * Loeschen, Export/Import als .js. P2-Notfallpfad: formatP2Protocol erzeugt
 * das Fehlerprotokoll; der muse.exe-Befehl wird angezeigt (Generierung
 * laeuft ausserhalb des Browsers, Key nie in der UI).
 */
import { formatP2Protocol } from '../runtime/verify.js';
import {
  addEntry, getEntry, listEntries, removeEntry, touchEntryStatus,
  exportEntry, parseImportedSource,
} from '../runtime/session-library.js';
import { tt, getLocale, localizeManifest } from './i18n.js';

/** @param {BlobPart} text */
function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/**
 * @param {{ lib: { entries: Array<Record<string, unknown>>, consent?: boolean }, listBox: HTMLElement, detailBox: HTMLElement, statusBox: HTMLElement, onView: (entry: Record<string, unknown>) => Promise<unknown>, onScores: (id: string) => unknown, onChange?: () => void }} els
 */
export function mountLibrary(els) {
  const say = (msg, bad) => {
    els.statusBox.textContent = msg;
    els.statusBox.dataset.state = bad ? 'fehler' : 'ok';
  };

  /** @param {Record<string, unknown>} [report] */
  function paint(report) {
    els.listBox.innerHTML = '';
    const entries = listEntries(els.lib);
    if (entries.length === 0) {
      els.listBox.textContent = tt('bibliothek.leer');
    }
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'lib-row';
      li.dataset.id = String(e.id);
      const head = document.createElement('span');
      const scores = /** @type {{ punkte?: number } | null} */ (e.scores);
      const view = localizeManifest(e.manifest, getLocale());
      head.textContent = `${view?.title ?? e.title} [${e.id} r${e.rev}, ${e.kind}, ${e.providerId}/${e.modelId}, Ampel ${e.ampel}${typeof scores?.punkte === 'number' ? `, ${scores.punkte} P` : ''}]`;
      li.appendChild(head);
      const mk = (label, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lab-btn lib-btn';
        b.textContent = label;
        b.addEventListener('click', () => fn(e));
        li.appendChild(b);
        return b;
      };
      mk(tt('bibliothek.ansehen'), async (entry) => {
        try {
          await els.onView(entry);
          say(tt('bibliothek.geladen', { titel: entry.title }));
        } catch (err) {
          say(tt('bibliothek.ladefehler', { detail: String((err && err.message) || err).slice(0, 160) }), true);
        }
      });
      mk(tt('bibliothek.ueberarbeiten'), (entry) => {
        const rep = els.onScores(String(entry.id));
        const proto = formatP2Protocol(rep?.layers ?? [], { iteration: (rep?.iteration ?? 1) + 1 });
        const cmd = `muse.exe exec --model ${entry.modelId} --api-key-stdin --prompt-file p2-${entry.id}-r${Number(entry.rev) + 1}.txt`;
        els.detailBox.textContent =
          tt('bibliothek.p2Titel', { id: entry.id, rev: entry.rev, next: Number(entry.rev) + 1 }) + `\n${proto}\n\n` +
          tt('bibliothek.p2Schritt', { id: entry.id, next: Number(entry.rev) + 1, cmd });
        say(tt('bibliothek.p2Bereit', { id: entry.id }));
      });
      mk(tt('bibliothek.export'), (entry) => {
        const { filename, text } = exportEntry(els.lib, String(entry.id));
        downloadFile(filename, text);
        say(tt('bibliothek.exportiert', { datei: filename }));
      });
      if (e.kind !== 'kuratiert') {
        mk(tt('bibliothek.loeschen'), (entry) => {
          removeEntry(els.lib, String(entry.id));
          paint();
          if (typeof els.onChange === 'function') els.onChange();
          say(tt('bibliothek.geloescht', { id: entry.id }));
        });
      }
      els.listBox.appendChild(li);
    }
    if (report) {
      const last = listEntries(els.lib).find((e) => e.id === report.modelId);
      if (last) touchEntryStatus(els.lib, String(last.id), { ampel: report.verdict, scores: { punkte: null } });
    }
  }

  return {
    paint,
    say,
    /** Kuratiertes Modell als Referenz in die Sitzung spiegeln (Referenz bleibt unberuehrt). */
    mirrorCurated(ref) {
      try {
        addEntry(els.lib, { id: ref.id, title: ref.title, source: ref.source, manifest: ref.manifest, providerId: 'meta-muse', modelId: 'muse-spark-1.3-contributor', kind: 'kuratiert' });
      } catch (e) {
        if (!e || e.code !== 'E-LIB-DUP') throw e;
      }
      paint();
    },
    /** Aktuell geladenes Modell als Sitzungseintrag uebernehmen. */
    adoptCurrent(ref, providerId, modelId) {
      const base = `frei-${String(ref.id).slice(0, 20)}`;
      let id = base;
      for (let n = 2; getEntry(els.lib, id); n += 1) id = `${base}-${n}`;
      addEntry(els.lib, { id, title: `${ref.title} (Sitzung)`, source: ref.source, manifest: ref.manifest, providerId, modelId, parentId: ref.id });
      paint();
      say(tt('bibliothek.uebernommen', { id }));
      return id;
    },
    /** .js-Datei importieren (neue Sitzung oder neue Revision). */
    async importFile(file) {
      const text = await file.text();
      const { source } = parseImportedSource(text);
      const m = /export\s+const\s+meta\s*=\s*\{[^}]*title\s*:\s*["']([^"']+)["']/.exec(source);
      const base = String(file.name).replace(/\.js$/i, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 28) || 'import';
      let id = base;
      let parentId = null;
      const existing = getEntry(els.lib, base);
      if (existing) {
        parentId = base;
        for (let n = Number(existing.rev) + 1; getEntry(els.lib, `${base}-r${n}`); n += 1) { /* frei */ }
        id = `${base}-r${Number(existing.rev) + 1}`;
      }
      addEntry(els.lib, { id, title: m?.[1] ?? id, source, manifest: null, parentId });
      paint();
      if (typeof els.onChange === 'function') els.onChange();
      say(tt('bibliothek.importiert', { id, rev: parentId ? tt('bibliothek.importiertRev', { parent: parentId }) : '' }));
      return id;
    },
  };
}
