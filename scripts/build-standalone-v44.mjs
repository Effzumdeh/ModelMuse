/**
 * Standalone builder v44 (Historien-UI straffen, GitHub-Pages-faehig):
 * Baut auf dem v43-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Stand: v43 brachte Versionshistorie (V1..VX, Wiederherstellen-Buttons je
 * Version PLUS separater Zurueck-Button, de/en/es/fr) ins Standalone-Release.
 * Der Zurueck-Button ist redundant zur V-Liste; die aktive Version war nicht
 * erkennbar.
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * S1  Zurueck-Button aus dem Modify-Overlay entfernen (Listeneintraege
 *     decken Restore voll ab); der dadurch tote Handler backHistory wird
 *     mit entfernt (H2-Invariante).
 * S2  Aktive Version markieren: neuer Helper histIsActive(h) (angezeigte
 *     Quelle lab._source == Snapshot-Quelle) + Label-Helper histBtnText(h).
 *     Aktiver Eintrag zeigt t('histSelected') statt t('histRestore'),
 *     emerald-Hintergrund statt slate, disabled (kein Klick). Nur die aktive
 *     Version unterscheidet sich.
 * S3  I18N-Key histSelected je Sprache (Wortlaut = Dev-Shell
 *     src/shell/i18n/*.json): de/en als I18N.de|en-Zeilen, es/fr als
 *     Dict-Paare. histBack-Keys bleiben als ungenutzte Strings erhalten
 *     (H1-Ketten-Invarianten v43).
 * S4  Stempel v44 + Invarianten (Alt-Zaehler unveraendert, 600-KB-Toleranz)
 *     + Syntax-Gate.
 *
 * Hinweis: scripts/build-standalone-v43.mjs checkInvariants() kennt den
 * v44-Nachfolger (H3/H2-Zaehler werden v44-bedingt 0) — Transformpfad von
 * v43 ist unveraendert, nur der Idempotenz-Check toleriert v44.
 *
 * Aufruf: node scripts/build-standalone-v44.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v44-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v44: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v43 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v44-syn-'));
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
          console.error('build-v44: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v44-inline-' + n + '.js')); } catch {}
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

// ---------- S3: histSelected-Keys (Wortlaut = Dev-Shell src/shell/i18n/*.json) ----------
const HIST_SEL_DE = 'I18N.de.histSelected="Ausgewählt";';
const HIST_SEL_EN = 'I18N.en.histSelected="Selected";';
const HIST_SEL_ES = ',histSelected:"Seleccionada"';
const HIST_SEL_FR = ',histSelected:"Sélectionnée"';

// ---------- S2: Aktiv-Erkennung + Button-Label (Vue-Methoden, roh-JS) ----------
const HIST_ACTIVE_METHODS = ''
  + 'histIsActive:function(h){try{return !!(this.activeLab&&h&&this.activeLab._source===h.source);}catch(eI){return false;}},'
  + 'histBtnText:function(h){try{if(this.histIsActive(h)){return this.t(\'histSelected\');}}catch(eB){}try{return this.t(\'histRestore\');}catch(eR){return \'Wiederherstellen\';}},';

// ---------- S1/S2: Listen-Button neu (aktiv: Ausgewaehlt + emerald + disabled) ----------
const HIST_BTN_OLD = '<button type="button" @click="restoreHistoryVersion(h.v)" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-3 min-h-[44px] text-xs font-semibold">{{t(\'histRestore\')}}</button>';
const HIST_BTN_NEW = '<button type="button" @click="restoreHistoryVersion(h.v)" :disabled="histIsActive(h)" :class="histIsActive(h)?\'inline-flex items-center justify-center rounded-xl px-3 min-h-[44px] text-xs font-semibold bg-emerald-600 text-white\':\'inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-3 min-h-[44px] text-xs font-semibold\'">{{histBtnText(h)}}</button>';

// ---------- S1: Zurueck-Button + toter Handler raus ----------
const HIST_BACK_BUTTON = '\r\n<button type="button" @click="backHistory" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t(\'histBack\')}}</button>';
const HIST_BACK_METHOD = 'backHistory:function(){var vers=[];try{vers=this.histLoad();}catch(eB2){}if(!vers.length){this.modStatus=this.t(\'histEmpty\');this.modStatusBad=true;return;}if(vers.length<2){this.modStatus=this.t(\'histNoPrev\');this.modStatusBad=true;return;}try{this.restoreHistoryVersion(vers[vers.length-2].v);}catch(eBH){}},';

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
    ['standalone-build v42', 1], ['standalone-build v43', 1],
    ['standalone-build v44', 1],
    // F1 (v42): FR-Button + fr-Dict + 4-sprachige Prompts.
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
    // H2/H4 (v43): Tick-State + Bumps (Data + openModify + append + restore).
    ['modHistTick:0,', 1], ['this.modHistTick=(this.modHistTick||0)+1;', 3],
    // S1 (v44): Zurueck-Button raus, Restore-Klick bleibt.
    ['@click="backHistory"', 0], ['@click="restoreHistoryVersion(h.v)"', 1],
    ['v-for="h in histList()"', 1],
    ["{{t('histBack')}}", 0], ["{{t('histTitle')}}", 1],
    ["{{t('histRestore')}}", 0], ["{{t('histEmpty')}}", 1],
    // S2 (v44): Ausgewaehlt-Button (disabled + emerald + Label-Helper).
    ['{{histBtnText(h)}}', 1], [':disabled="histIsActive(h)"', 1],
    ["histIsActive(h)?'inline-flex", 1],
    // H4 (v43): Record-Hook im Modify-Erfolg genau 1x.
    ['this.histRecord(src,', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  // H1 (v43) + S3 (v44): 8 History-Keys je Sprache (de/en-Zeilen, es/fr-Dict-Paare).
  for (const k of ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored', 'histSelected']) {
    must(cnt(s, 'I18N.de.' + k + '=') === 1, 'de-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, 'I18N.en.' + k + '=') === 1, 'en-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, k + ':"') === 2, 'es/fr-Paar fehlt/mehrdeutig: ' + k + ' x' + cnt(s, k + ':"'));
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v44 History gestrafft + Alt-Zaehler)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v44: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v43-history',
    standalone: 'v44',
    befund: [
      'v43-Historien-UI mit redundantem Zurueck-Button neben der V-Liste; aktive Version nicht erkennbar (alle Buttons "Wiederherstellen").',
    ],
    fixes: [
      'S1 Zurueck-Button + toter backHistory-Handler entfernt (Restore via V-Liste)',
      'S2 Aktive Version: histIsActive/histBtnText, Ausgewaehlt-Label + emerald + disabled',
      'S3 I18N-Key histSelected x de/en/es/fr (Wortlaut Dev-Shell)',
      'S4 Stempel v44 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v44: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v43'), 'kein v43-Stempel (falsche Basis)');
if (s.includes('standalone-build v44')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v44: bereits v44 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- S3: histSelected-Keys de/en (Zeilen) + es/fr (Dict-Paare) ----------
s = rep1(s,
  'I18N.de.histRestored="„{titel}“ (V{nr}) wiederhergestellt.";',
  'I18N.de.histRestored="„{titel}“ (V{nr}) wiederhergestellt.";' + HIST_SEL_DE,
  'S3 de-histSelected');
s = rep1(s,
  'I18N.en.histRestored="“{titel}” (V{nr}) restored.";',
  'I18N.en.histRestored="“{titel}” (V{nr}) restored.";' + HIST_SEL_EN,
  'S3 en-histSelected');
s = rep1(s,
  'histRestored:"«{titel}» (V{nr}) restaurado."}',
  'histRestored:"«{titel}» (V{nr}) restaurado."' + HIST_SEL_ES + '}',
  'S3 es-histSelected');
s = rep1(s,
  'histRestored:"« {titel} » (V{nr}) restauré."}',
  'histRestored:"« {titel} » (V{nr}) restauré."' + HIST_SEL_FR + '}',
  'S3 fr-histSelected');
console.log('  S3: histSelected-Keys (de/en/es/fr)');

// ---------- S1: Zurueck-Button + toter Handler entfernen ----------
s = rep1(s, HIST_BACK_BUTTON, '', 'S1 Zurueck-Button entfernen');
s = rep1(s, HIST_BACK_METHOD, '', 'S1 backHistory-Handler entfernen');
console.log('  S1: Zurueck-Button + backHistory-Handler entfernt');

// ---------- S2: Aktiv-Helper + Listen-Button mit Ausgewaehlt-Markierung ----------
s = rep1(s,
  'modify:async function(jobWish,jobLabId){',
  HIST_ACTIVE_METHODS + 'modify:async function(jobWish,jobLabId){',
  'S2 Aktiv-Helper (histIsActive/histBtnText)');
s = rep1(s, HIST_BTN_OLD, HIST_BTN_NEW, 'S2 Listen-Button mit Ausgewaehlt-Markierung');
console.log('  S2: Aktiv-Helper + Ausgewaehlt-Button (emerald, disabled)');

// ---------- S4: Stempel v44 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v43 (Versionshistorie: History-Logik + V1..VX-UI + de/en/es/fr, via scripts/build-standalone-v43.mjs) -->';
must(cnt(s, stamp) === 1, 'v43-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v44 (Historie gestrafft: Zurueck-Button raus, aktive Version Ausgewaehlt-Markierung, de/en/es/fr, via scripts/build-standalone-v44.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v44: OK v44 (Historien-UI gestrafft)');
