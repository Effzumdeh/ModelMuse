/**
 * scripts/usage-tagesstand.mjs — Tages-Zaehler abrechenbarer Calls (Backlog A-11).
 *
 * Aufruf: npm run usage:tagesstand  (node scripts/usage-tagesstand.mjs)
 * Quelle: dist/generation-log.json (calls[]: startUtc/endeUtc-Datum, quelle-Feld).
 * Fehlende quelle => meta-cli (CLI-Generierung via muse.exe).
 * Reine Konsolen-Ausgabe, schreibt NICHTS.
 */
import { readFile } from 'node:fs/promises';

const QUELLEN = ['meta-cli', 'browser-e2e', 'chemie-meta'];
const HINWEIS = 'Key-Modus: muse usage meldet kein Kontingent (erwartet); Verbrauch im Schluessel-Portal; Ledger = Beleg je Call';

const log = JSON.parse(await readFile(new URL('../dist/generation-log.json', import.meta.url), 'utf8'));
const calls = Array.isArray(log.calls) ? log.calls : [];

const tage = new Map();
for (const c of calls) {
  const datum = String(c.startUtc ?? c.endeUtc ?? 'ohne-Datum').slice(0, 10);
  const q = QUELLEN.includes(c.quelle) ? c.quelle : 'meta-cli';
  if (!tage.has(datum)) tage.set(datum, { gesamt: 0, quellen: { 'meta-cli': 0, 'browser-e2e': 0, 'chemie-meta': 0 } });
  const t = tage.get(datum);
  t.gesamt += 1;
  t.quellen[q] += 1;
}

console.log('| Tag | Calls gesamt | meta-cli | browser-e2e | chemie-meta |');
console.log('|---|---|---|---|---|');
for (const [tag, t] of [...tage.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
  console.log(`| ${tag} | ${t.gesamt} | ${t.quellen['meta-cli']} | ${t.quellen['browser-e2e']} | ${t.quellen['chemie-meta']} |`);
}
console.log(`\nHinweis: ${HINWEIS}`);
