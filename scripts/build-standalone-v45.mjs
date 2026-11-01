/**
 * Standalone builder v45 (Hilfe-Link in der Fusszeile, GitHub-Pages-faehig):
 * Baut auf dem v44-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Stand: Die Fusszeile des Standalone-Artefakts zeigt nur footerNote/footerAttrib;
 * es gibt keinen Weg zur mehrsprachigen Anwenderdoku docs/help/{de,en,es,fr}.html
 * (Eigentuer-Vorgabe 2026-11-01: Live-Docs via GitHub, verlinkt aus der
 * App-Fusszeile, lokalisiert "Brauchst du Hilfe?").
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * H1  I18N-Key footerHelp je Sprache (Wortlaut = Dev-Shell src/shell/i18n/*.json
 *     fuss.hilfe): de/en/es/fr als Dict-Paare footerHelp:"..." je einmal.
 * H2  Sichtbarer Hilfe-Link in der Fusszeile neben footerNote:
 *     <a :href="'help/'+lang+'.html">{{t('footerHelp')}}</a> — sprachabhaengiges
 *     Ziel (help/de|en|es|fr.html, Pages-Artefakt _site/help/), lokalisierter Text.
 * H3  Stempel v45 + Invarianten (Alt-Zaehler unveraendert, 600-KB-Toleranz)
 *     + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v45.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v45-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v45: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v44 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v45-syn-'));
  try {
    let pos = 0, n = 0, checked = 0;
    for (;;) {
      const open = s.indexOf('<script', pos);
      if (open < 0) break;
      const gt = s.indexOf('>', open);
      if (gt < 0) { must(false, 'Inline-Script: kein Ende des Tags'); }
      const attrs = s.slice(open + 7, gt);
      const low = attrs.toLowerCase();
      const end = s.indexOf('</script>', gt);
      if (end < 0) { must(false, 'Inline-Script: kein Ende'); }
      pos = end + 9;
      if (low.indexOf('src=') >= 0 || low.indexOf('src =') >= 0) continue;
      if (low.indexOf('importmap') >= 0 || low.indexOf('application/json') >= 0) continue;
      n += 1;
      const isMod = low.indexOf('module') >= 0;
      const f = join(dir, 'inline-' + n + (isMod ? '.mjs' : '.js'));
      writeFileSync(f, s.slice(gt + 1, end));
      try {
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        checked += 1;
      } catch (e) {
        try {
          const detail = String((e.stderr || e.stdout || e.message) || e);
          console.error('build-v45: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v45-inline-' + n + '.js')); } catch {}
        } catch {}
        must(false, 'Inline-Script ' + n + ' parst nicht');
      }
    }
    must(n >= 5, 'zu wenige Inline-Scripts gefunden: ' + n);
    console.log('  Syntax-Gate ok (' + checked + ' Inline-Scripts parsen)');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// ---------- H1: footerHelp-Texte (Wortlaut = Dev-Shell src/shell/i18n/*.json fuss.hilfe) ----------
const HELP = {
  de: 'Brauchst du Hilfe?',
  en: 'Need help?',
  es: '¿Necesitas ayuda?',
  fr: "Besoin d'aide ?",
};

// ---------- H2: Hilfe-Link in der Fusszeile (Vue-Scope: lang + t() verfuegbar) ----------
const FOOT_OLD = `<p class="text-sm text-slate-500 dark:text-slate-400">{{t('footerNote')}}</p>`;
const FOOT_NEW = `<p class="text-sm text-slate-500 dark:text-slate-400">{{t('footerNote')}} <a :href="'help/'+lang+'.html'">{{t('footerHelp')}}</a></p>`;

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1], ['standalone-build v31', 1], ['standalone-build v32', 1],
    ['standalone-build v33', 1], ['standalone-build v34', 1], ['standalone-build v35', 1],
    ['standalone-build v36', 1], ['standalone-build v37', 1], ['standalone-build v38', 1],
    ['standalone-build v39', 1], ['standalone-build v40', 1], ['standalone-build v41', 1],
    ['standalone-build v42', 1], ['standalone-build v43', 1], ['standalone-build v44', 1],
    ['standalone-build v45', 1],
    // F1 (v42): FR-Button + fr-Dict.
    ['>FR</button>', 1], ["setLang('fr')", 1], ['I18N.fr={', 1],
    // E (v41): I18N-Keys je Sprache genau 4x (de/en/es/fr).
    ['saveModel:', 4], ['saveGlb:', 4], ['savePng:', 4], ['saveSvg:', 4],
    ['saveOk:', 4], ['saveErr:', 4], ['saveNone:', 4], ['saveNoSvg:', 4],
    // O (v38): OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    // H2 (v43, erweitert v44): History-Helper, backHistory seit v44 entfernt.
    ['histBaseId:function', 1], ['histKey:function', 1], ['histLoad:function', 1],
    ['histSave:function', 1], ['histAppend:function', 1], ['histRecord:function', 1],
    ['histList:function', 1], ['histEntryText:function', 1],
    ['restoreHistoryVersion:async function', 1], ['backHistory:function', 0],
    // S2 (v44): Aktiv-Erkennung + Button-Label genau 1x.
    ['histIsActive:function', 1], ['histBtnText:function', 1],
    ['@click="backHistory"', 0], ['@click="restoreHistoryVersion(h.v)"', 1],
    ['v-for="h in histList()"', 1],
    ["{{t('histBack')}}", 0], ["{{t('histTitle')}}", 1],
    ["{{t('histRestore')}}", 0], ["{{t('histEmpty')}}", 1],
    ['{{histBtnText(h)}}', 1], [':disabled="histIsActive(h)"', 1],
    ["histIsActive(h)?'inline-flex", 1],
    ['this.histRecord(src,', 1],
    // H1/H2 (v45): Hilfe-Link — 4 Dict-Paare, 1x Template, 1x dynamischer Href.
    ['footerHelp:', 4],
    ["{{t('footerHelp')}}", 1],
    ["'help/'+lang+'.html'", 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  // H1 (v45): 8 History-Keys (v43/v44) + footerHelp je Sprache (de/en-Zeilen, es/fr-Paare).
  for (const k of ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored', 'histSelected']) {
    must(cnt(s, 'I18N.de.' + k + '=') === 1, 'de-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, 'I18N.en.' + k + '=') === 1, 'en-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, k + ':"') === 2, 'es/fr-Paar fehlt/mehrdeutig: ' + k + ' x' + cnt(s, k + ':"'));
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v45 Hilfe-Link + Alt-Zaehler)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v45: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v44-history-gestrafft',
    standalone: 'v45',
    befund: [
      'Standalone-Fusszeile ohne Weg zur mehrsprachigen Anwenderdoku docs/help/{de,en,es,fr}.html (Eigentuer-Vorgabe 2026-11-01).',
    ],
    fixes: [
      'H1 I18N-Key footerHelp x de/en/es/fr (Wortlaut Dev-Shell fuss.hilfe)',
      'H2 Sichtbarer Hilfe-Link in der Fusszeile (Href sprachabhaengig: help/de|en|es|fr.html)',
      'H3 Stempel v45 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v45: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v44'), 'kein v44-Stempel (falsche Basis)');
if (s.includes('standalone-build v45')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v45: bereits v45 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- H1: footerHelp-Paare je Sprache (Anker je Dict einmalig) ----------
s = rep1(s,
  'exampleLoad:"Beispiel laden",genDetails:"Details",footerNote:"Standalone · Client-only."',
  'exampleLoad:"Beispiel laden",genDetails:"Details",footerNote:"Standalone · Client-only.",footerHelp:"' + HELP.de + '"',
  'H1 de-footerHelp');
s = rep1(s,
  'exampleLoad:"Load example",genDetails:"Details",footerNote:"Standalone · Client-only."',
  'exampleLoad:"Load example",genDetails:"Details",footerNote:"Standalone · Client-only.",footerHelp:"' + HELP.en + '"',
  'H1 en-footerHelp');
s = rep1(s,
  'exampleLoad:"Cargar ejemplo",genDetails:"Detalles",footerNote:"Standalone \\u00b7 Solo cliente."',
  'exampleLoad:"Cargar ejemplo",genDetails:"Detalles",footerNote:"Standalone \\u00b7 Solo cliente.",footerHelp:"' + HELP.es + '"',
  'H1 es-footerHelp');
s = rep1(s,
  'genDetails:"D\\u00e9tails",footerNote:"Standalone \\u00b7 Client seul."',
  'genDetails:"D\\u00e9tails",footerNote:"Standalone \\u00b7 Client seul.",footerHelp:"' + HELP.fr + '"',
  'H1 fr-footerHelp');
console.log('  H1: footerHelp-Keys (de/en/es/fr)');

// ---------- H2: Hilfe-Link in die Fusszeile ----------
s = rep1(s, FOOT_OLD, FOOT_NEW, 'H2 Fusszeilen-Link');
console.log('  H2: Hilfe-Link in der Fusszeile');

// ---------- H3: Stempel v45 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v44 (Historie gestrafft: Zurueck-Button raus, aktive Version Ausgewaehlt-Markierung, de/en/es/fr, via scripts/build-standalone-v44.mjs) -->';
must(cnt(s, stamp) === 1, 'v44-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v45 (Hilfe-Link: footerHelp de/en/es/fr + sprachabhaengiger Fusszeilen-Link auf help/, via scripts/build-standalone-v45.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v45: OK v45 (Hilfe-Link)');
