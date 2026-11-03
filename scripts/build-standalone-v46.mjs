/**
 * Standalone builder v46 (Final-Sprint 03.11.2026, GitHub-Pages-faehig):
 * Baut auf dem v45-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Vorgaben (Final-Sprint):
 * E) ETA flat 240 s fuer ALLE Modelle/Reasoning-Stufen bis Messungen kommen:
 *    etaSeconds-Tabelle durch flat return 240 ersetzt; Kurz-Texte
 *    (genEta/modEta) je Sprache auf "ca. 4 Minuten"-Wortlaut gehoben
 *    (de/en/es/fr), Lang-Texte unveraendert; Fallback-60er (Start/Abort/
 *    Schaetzung) auf 240 angehoben.
 * M) 2D/3D-Modus-Buttons raus: kein manuelles Umschalten mehr — 3D bei
 *    3D-Modellen, 2D nur als Fallback-Anzeige fuer 2D-generierte
 *    (is3dReason-Hinweis bleibt); Auto-Aufloesung via loadLab/syncViewer
 *    unveraendert.
 * F) Footer statt "Standalone · Client-only.": Funktions-Satz je Sprache
 *    ("Baue 3D-Modelle mit deinem LLM ..."); Lizenzanzeige verlinkt auf
 *    docs/LICENSES.md (neuer footerLic-Key + Template-Link).
 * L) docs/licenses.md -> docs/LICENSES.md (Datei-Rename per git mv);
 *    alle 4 footerAttrib-Texte referenzieren docs/LICENSES.md.
 * O) Neuer Provider Ollama (lokal, ohne Key): genProviders += ollama
 *    (Basis http://localhost:11434/v1, OpenAI-kompatibel
 *    /v1/chat/completions, nativ /api/chat siehe docs/OLLAMA-LOKAL.md);
 *    Modell als Freitextfeld (Vorschlag llama3.1:8b vorausgefuellt);
 *    Key-Block bei ollama ausgeblendet, Key-Guards bypassed, keine
 *    Authorization gesendet; Fehlertexte mit localhost-Hinweis
 *    (ollamaHint/keyMissingOllama de/en/es/fr); CORS-Hinweis OLLAMA_ORIGINS;
 *    ETA 240 s via flat default.
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * E1 etaSeconds flat 240; E2 Kurz-Texte 4 Minuten x de/en/es/fr;
 *    E3 Start/Abort/Schaetz-Fallbacks 60->240.
 * M1 Modus-Buttons (force2D/to3D) aus dem Template entfernt.
 * F1 footerNote-Funktions-Saetze x de/en/es/fr; F2 LIZENZEN->LICENSES x4;
 *    F3 footerLic-Keys x de/en/es/fr; F4 Template-Link docs/LICENSES.md.
 * O1 genProviders ollama; O2 Modell-Freitext (select nur non-ollama);
 *    O3 Key-Block v-if non-ollama; O4 ollamaHint-Template-Zeile;
 *    O5 Key-Guards bypass; O6 directHeaders ohne Auth bei ollama;
 *    O7 keyMissing/keyInvalid ollama-Zweig; O8 Netz/Timeout + ollamaHint;
 *    O9 i18n ollamaHint/keyMissingOllama/ollamaModelPh x de/en/es/fr;
 *    O10 Key-Namen ollama (3 Stellen).
 * S  Stempel v46 + Invarianten (Alt-Zaehler unveraendert, < 600 KB)
 *    + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v46.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v46-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v46: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}
function repN(s, oldStr, newStr, label, want) {
  must(cnt(s, oldStr) === want, label + ': Anker x' + cnt(s, oldStr) + ' statt ' + want);
  return s.split(oldStr).join(newStr);
}

/** Syntax-Gate wie v26-v45 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v46-syn-'));
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
          console.error('build-v46: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v46-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v46', 1],
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
    // E (v46): ETA flat 240 — Tabelle ersetzt, Kurz-Texte 4 Minuten x4.
    ['etaSeconds:function(){return 240;}', 1],
    ['etaSeconds:function(){var m=', 0],
    ['ca. 1 Minute', 0], ['about 1 minute', 0], ['aprox. 1 minuto', 0], ['env. 1 minute', 0],
    ['ca. 4 Minuten', 4], ['about 4 minutes', 4], ['aprox. 4 minutos', 4], ['env. 4 minutes', 4],
    // M (v46): Modus-Buttons raus, Fallback-Hinweis bleibt.
    ['@click="force2D"', 0], ['@click="to3D"', 0],
    ["{{t('mode2d')}}", 0], ["{{t('mode3d')}}", 0],
    ["{{t('is3dReason')}}", 1],
    // F/L (v46): Funktions-Footer + Lizenz-Link.
    ['Standalone · Client-only.', 0], ['Standalone \\u00b7 Solo cliente.', 0], ['Standalone \\u00b7 Client seul.', 0],
    ['docs/LIZENZEN.md', 0], ['docs/LICENSES.md', 6],
    ['footerLic:', 4], ["{{t('footerLic')}}", 1],
    // O (v46): Ollama lokal ohne Key, Modellfeld leer.
    ['id:"ollama"', 1], ['http://localhost:11434/v1', 1],
    ['models:[]', 1], ['llama3.1:8b', 8],
    ["v-if=\"genProvider!=='ollama'\"", 2], ["v-if=\"genProvider==='ollama'\"", 1],
    ['v-model="genModel"', 2],
    ['modelmuse-key-ollama', 3],
    ['I18N.de.ollamaHint=', 1], ['I18N.en.ollamaHint=', 1], ['ollamaHint:"', 2],
    ["{{t('ollamaHint')}}", 1], ["this.t('ollamaHint')", 3],
    ['I18N.de.keyMissingOllama=', 1], ['I18N.en.keyMissingOllama=', 1], ['keyMissingOllama:"', 2],
    ["this.t('keyMissingOllama')", 2],
    ['ollamaModelPh', 5],
    ['I18N.de.ollamaModelEmpty=', 1], ['I18N.en.ollamaModelEmpty=', 1], ['ollamaModelEmpty:"', 2],
    ["this.t('ollamaModelEmpty')", 3],
    ["if(this.genProvider==='ollama'){this.genModel='';}", 1],
    // T (v46): kein Umschalter — Farbschema ausschliesslich System, live.
    ['setTheme', 0], ['modelmuse.theme', 0],
    ["{{t('dark')}}", 0], ["{{t('light')}}", 0],
    [':aria-label="t(\'themeLabel\')"', 0],
    ['__sysDark', 3], ['addEventListener("change",__apply)', 1],
    ['prefers-color-scheme', 6],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  // H1 (v43/v44): 8 History-Keys je Sprache (de/en-Zeilen, es/fr-Paare).
  for (const k of ['histBack', 'histTitle', 'histRestore', 'histEntry', 'histEmpty', 'histNoPrev', 'histRestored', 'histSelected']) {
    must(cnt(s, 'I18N.de.' + k + '=') === 1, 'de-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, 'I18N.en.' + k + '=') === 1, 'en-Key fehlt/mehrdeutig: ' + k);
    must(cnt(s, k + ':"') === 2, 'es/fr-Paar fehlt/mehrdeutig: ' + k + ' x' + cnt(s, k + ':"'));
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v46 Final-Sprint: ETA flat + Modus-Auto + Footer + LICENSES + Ollama)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v46: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v45-hilfe-link',
    standalone: 'v46',
    befund: [
      'Final-Sprint Eigentuemer-Vorgaben 03.11.2026: ETA flat 240 s, Modus-Buttons raus, Funktions-Footer, LICENSES-Rename, Ollama-Provider.',
    ],
    fixes: [
      'E1 ETA-Tabelle flat (etaSeconds return 240); E2 Kurz-Texte ca. 4 Minuten x de/en/es/fr; E3 Fallbacks 60->240',
      'M1 2D/3D-Modus-Buttons entfernt (Auto: 3D bei 3D-Modell, 2D nur Fallback-Hinweis)',
      'F1 Funktions-Footer x de/en/es/fr; F2+F4 Lizenzanzeige verlinkt docs/LICENSES.md (footerLic)',
      'L docs/licenses.md -> docs/LICENSES.md, alte Verweise bereinigt',
      'O1-O10 Ollama lokal (localhost:11434, OpenAI-kompatibel, kein Key, Freitext-Modell, localhost-Fehlertexte)',
      'S Stempel v46 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v46: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v45'), 'kein v45-Stempel (falsche Basis)');
if (s.includes('standalone-build v46')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v46: bereits v46 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- E1: ETA-Tabelle flat 240 (Tabelle ersetzen) ----------
s = rep1(s,
  'etaSeconds:function(){var m="";try{m=String(this.genModel||"");}catch(eM){}var p="";try{p=String(this.genProvider||"");}catch(eP){}var r="";try{r=String(this.genReasoning||this.reasoningDefault||"");}catch(eR){}var low="";try{low=String(m||"").toLowerCase();}catch(eL){low="";}low=low.replace(/^\\s+|\\s+$/g,"");var sl=low.lastIndexOf("/");if(sl>=0){low=low.slice(sl+1);}var co=low.indexOf(":");if(co>=0){low=low.slice(0,co);}var isBig=(low.indexOf("1.3")>=0||low.indexOf("wonder")>=0||low.indexOf("spark")>=0||low.indexOf("opus")>=0||low.indexOf("gpt")>=0||low.indexOf("sol")>=0||low.indexOf("6.1")>=0||low.indexOf("contributor")>=0);var hi=(r==="xhigh"||r==="max");var pv=(p==="baseten-direct"||p==="meta-muse"||p==="openrouter");if(p==="openrouter"&&pv){return 240;}if(isBig&&hi&&pv){return 240;}if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}',
  'etaSeconds:function(){return 240;}',
  'E1 ETA flat');
console.log('  E1: ETA-Tabelle flat 240 s');

// ---------- E2: Kurz-Texte "ca. 4 Minuten" x de/en/es/fr ----------
s = rep1(s, 'I18N.de.genEta="ca. 1 Minute · noch {s} s";', 'I18N.de.genEta="ca. 4 Minuten · noch {s} s";', 'E2 de-genEta');
s = rep1(s, 'I18N.de.modEta="ca. 1 Minute · noch {s} s";', 'I18N.de.modEta="ca. 4 Minuten · noch {s} s";', 'E2 de-modEta');
s = rep1(s, 'I18N.en.genEta="about 1 minute · {s} s left";', 'I18N.en.genEta="about 4 minutes · {s} s left";', 'E2 en-genEta');
s = rep1(s, 'I18N.en.modEta="about 1 minute · {s} s left";', 'I18N.en.modEta="about 4 minutes · {s} s left";', 'E2 en-modEta');
s = rep1(s, 'genEta:"aprox. 1 minuto · quedan {s} s"', 'genEta:"aprox. 4 minutos · quedan {s} s"', 'E2 es-genEta');
s = rep1(s, 'modEta:"aprox. 1 minuto · quedan {s} s"', 'modEta:"aprox. 4 minutos · quedan {s} s"', 'E2 es-modEta');
s = rep1(s, 'genEta:"env. 1 minute \\u00b7 encore {s} s"', 'genEta:"env. 4 minutes \\u00b7 encore {s} s"', 'E2 fr-genEta');
s = rep1(s, 'modEta:"env. 1 minute \\u00b7 encore {s} s"', 'modEta:"env. 4 minutes \\u00b7 encore {s} s"', 'E2 fr-modEta');
console.log('  E2: Kurz-Texte ca. 4 Minuten (de/en/es/fr)');

// ---------- E3: Fallback-60er -> 240 ----------
s = rep1(s, 'try{this.genEta=this.etaSeconds();}catch(eB){this.genEta=60;}', 'try{this.genEta=this.etaSeconds();}catch(eB){this.genEta=240;}', 'E3 gen-Fallback');
s = rep1(s, 'try{this.modEta=this.etaSeconds();}catch(eB){this.modEta=60;}', 'try{this.modEta=this.etaSeconds();}catch(eB){this.modEta=240;}', 'E3 mod-Fallback');
s = repN(s, '(function(s0){try{var e0=(s0&&s0.etaSeconds)?s0.etaSeconds():60;return e0*1000+120000;}catch(x0){return 360000;}})(this)', '(function(s0){try{var e0=(s0&&s0.etaSeconds)?s0.etaSeconds():240;return e0*1000+120000;}catch(x0){return 360000;}})(this)', 'E3 Abort-Tabelle', 2);
s = rep1(s, 'estimateText:function(){var d=60;try{d=this.etaSeconds();}catch(e){d=60;}', 'estimateText:function(){var d=240;try{d=this.etaSeconds();}catch(e){d=240;}', 'E3 Schaetz-Fallback');
console.log('  E3: Fallbacks 60->240 (Start/Abort/Schaetzung)');

// ---------- M1: 2D/3D-Modus-Buttons raus (Auto: 3D bzw. 2D-Fallback) ----------
s = rep1(s,
  '<button type="button" @click="force2D" class="px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold min-h-[44px] transition-all hover:bg-slate-300 dark:hover:bg-slate-700">{{t(\'mode2d\')}}</button>\r\n<button v-if="activeLab.is3d" type="button" @click="to3D" class="px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold min-h-[44px] transition-all hover:bg-slate-300 dark:hover:bg-slate-700">{{t(\'mode3d\')}}</button>\r\n',
  '',
  'M1 Modus-Buttons');
console.log('  M1: Modus-Buttons entfernt (Auto-Modus)');

// ---------- F1: Funktions-Footer x de/en/es/fr ----------
s = rep1(s,
  'exampleLoad:"Beispiel laden",genDetails:"Details",footerNote:"Standalone · Client-only."',
  'exampleLoad:"Beispiel laden",genDetails:"Details",footerNote:"Baue 3D-Modelle mit deinem LLM — direkt im Browser, mit Verlauf und Export."',
  'F1 de-footerNote');
s = rep1(s,
  'exampleLoad:"Load example",genDetails:"Details",footerNote:"Standalone · Client-only."',
  'exampleLoad:"Load example",genDetails:"Details",footerNote:"Build 3D models with your LLM — right in the browser, with history and export."',
  'F1 en-footerNote');
s = rep1(s,
  'genDetails:"Detalles",footerNote:"Standalone \\u00b7 Solo cliente."',
  'genDetails:"Detalles",footerNote:"Crea modelos 3D con tu LLM — directamente en el navegador, con historial y exportación."',
  'F1 es-footerNote');
s = rep1(s,
  'genDetails:"D\\u00e9tails",footerNote:"Standalone \\u00b7 Client seul."',
  'genDetails:"D\\u00e9tails",footerNote:"Crée des modèles 3D avec ton LLM — directement dans le navigateur, avec historique et export."',
  'F1 fr-footerNote');
console.log('  F1: Funktions-Footer (de/en/es/fr)');

// ---------- F2: Lizenzverweis docs/LIZENZEN.md -> docs/LICENSES.md ----------
s = repN(s, 'docs/LIZENZEN.md', 'docs/LICENSES.md', 'F2 Lizenzverweis', 4);
console.log('  F2: Lizenzverweis docs/LICENSES.md (4x)');

// ---------- F3: footerLic-Keys x de/en/es/fr ----------
s = rep1(s, 'footerHelp:"Brauchst du Hilfe?"', 'footerHelp:"Brauchst du Hilfe?",footerLic:"Lizenzen"', 'F3 de-footerLic');
s = rep1(s, 'footerHelp:"Need help?"', 'footerHelp:"Need help?",footerLic:"Licenses"', 'F3 en-footerLic');
s = rep1(s, 'footerHelp:"¿Necesitas ayuda?"', 'footerHelp:"¿Necesitas ayuda?",footerLic:"Licencias"', 'F3 es-footerLic');
s = rep1(s, 'footerHelp:"Besoin d\'aide ?"', 'footerHelp:"Besoin d\'aide ?",footerLic:"Licences"', 'F3 fr-footerLic');
console.log('  F3: footerLic-Keys (de/en/es/fr)');

// ---------- F4: Template-Link auf docs/LICENSES.md ----------
s = rep1(s,
  '<p class="text-sm text-slate-500 dark:text-slate-400">{{t(\'footerNote\')}} <a :href="\'help/\'+lang+\'.html\'">{{t(\'footerHelp\')}}</a></p>',
  '<p class="text-sm text-slate-500 dark:text-slate-400">{{t(\'footerNote\')}} <a :href="\'help/\'+lang+\'.html\'">{{t(\'footerHelp\')}}</a> · <a href="docs/LICENSES.md">{{t(\'footerLic\')}}</a></p>',
  'F4 Lizenz-Link');
console.log('  F4: Lizenz-Link in der Fusszeile');

// ---------- O1: genProviders += ollama ----------
s = rep1(s,
  '{id:"openrouter",label:"OpenRouter",kind:"direct",base:"https://openrouter.ai/api/v1",models:["openai/gpt-6.1-sol","meta/muse-spark-1.3","anthropic/claude-opus-5.5"]}',
  '{id:"openrouter",label:"OpenRouter",kind:"direct",base:"https://openrouter.ai/api/v1",models:["openai/gpt-6.1-sol","meta/muse-spark-1.3","anthropic/claude-opus-5.5"]},{id:"ollama",label:"Ollama (lokal)",kind:"direct",base:"http://localhost:11434/v1",models:[]}',
  'O1 Provider');
console.log('  O1: genProviders (ollama, localhost:11434/v1, Modellfeld leer)');

// ---------- O2: Modell als Freitextfeld bei ollama ----------
s = rep1(s,
  '<select id="gen-model" v-model="genModel" @change="genModelChanged" class="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm">\r\n<option v-for="m in genModels" :key="m" :value="m">{{m}}</option>\r\n</select>',
  '<select v-if="genProvider!==\'ollama\'" id="gen-model" v-model="genModel" @change="genModelChanged" class="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm">\r\n<option v-for="m in genModels" :key="m" :value="m">{{m}}</option>\r\n</select><input v-else id="gen-model" v-model="genModel" :placeholder="t(\'ollamaModelPh\')" class="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm" />',
  'O2 Modell-Freitext');
console.log('  O2: Modell-Freitextfeld (ollama, Feld leer, Beispiel als Platzhalter)');

// ---------- O2b: Modellfeld bei ollama leeren (kein vorausgefuellter Vorschlag) ----------
s = rep1(s,
  'genProviderChanged:function(){var old=this.prevProvider||"baseten-direct";try{if(this.genKeyCache){this.genKeyCache[old]=this.genKey;}}catch(e0){}var ms=this.genModels;if(ms&&ms.length){this.genModel=ms[0];}',
  'genProviderChanged:function(){var old=this.prevProvider||"baseten-direct";try{if(this.genKeyCache){this.genKeyCache[old]=this.genKey;}}catch(e0){}var ms=this.genModels;if(ms&&ms.length){this.genModel=ms[0];}if(this.genProvider===\'ollama\'){this.genModel=\'\';}',
  'O2b Modellfeld leer');
console.log('  O2b: Modellfeld bei ollama geleert');

// ---------- O3: Key-Block bei ollama ausblenden (BYOK entfaellt) ----------
s = rep1(s,
  '<div class="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">\r\n<label for="gen-key"',
  '<div v-if="genProvider!==\'ollama\'" class="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">\r\n<label for="gen-key"',
  'O3 Key-Block');
console.log('  O3: Key-Block nur non-ollama');

// ---------- O4: ollamaHint-Template-Zeile ----------
s = rep1(s,
  '<p v-if="genProvider===\'openrouter\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatOpenrouter\')}}</p>',
  '<p v-if="genProvider===\'openrouter\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'keyFormatOpenrouter\')}}</p><p v-if="genProvider===\'ollama\'" class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{t(\'ollamaHint\')}}</p>',
  'O4 Template-Hinweis');
console.log('  O4: ollamaHint-Template-Zeile');

// ---------- O5: Key-Guards bypass bei ollama ----------
s = rep1(s, 'if(!this.genKey){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var job={id:', 'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var job={id:', 'O5 enqueue-Guard');
s = rep1(s, 'if(!this.genKey){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}try{this.genDesc="";}', 'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}try{this.genDesc="";}', 'O5 generate-Guard');
s = repN(s, 'if(!this.genKey){this.modStatus=this.keyMissingMsg;', 'if(!this.genKey&&this.genProvider!==\'ollama\'){this.modStatus=this.keyMissingMsg;', 'O5 mod-Guards (submit/enqueue/modify)', 3);
console.log('  O5: Key-Guards bypass (ollama braucht keinen Key)');

// ---------- O6: directHeaders ohne Auth bei ollama ----------
s = rep1(s,
  'var h={Authorization:"Bearer "+this.genKey,"Content-Type":"application/json",Accept:"text/event-stream"};try{if(this.genProvider==="openrouter")',
  'var h={"Content-Type":"application/json",Accept:"text/event-stream"};try{if(this.genProvider!=="ollama"){h.Authorization="Bearer "+this.genKey;}if(this.genProvider==="openrouter")',
  'O6 Header');
console.log('  O6: directHeaders (kein Auth bei ollama)');

// ---------- O7: keyMissing/keyInvalid mit ollama-Zweig ----------
s = rep1(s,
  'keyMissingMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyMissingMeta\'):(this.genProvider==="openrouter"?this.t(\'keyMissingOpenrouter\'):this.t(\'keyMissing\'));}',
  'keyMissingMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyMissingMeta\'):(this.genProvider==="openrouter"?this.t(\'keyMissingOpenrouter\'):(this.genProvider==="ollama"?this.t(\'keyMissingOllama\'):this.t(\'keyMissing\')));}',
  'O7 Missing-Auswahl');
s = rep1(s,
  'keyInvalidMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyInvalidMeta\'):(this.genProvider==="openrouter"?this.t(\'keyInvalidOpenrouter\'):this.t(\'keyInvalid\'));}',
  'keyInvalidMsg:function(){return this.genProvider==="meta-muse"?this.t(\'keyInvalidMeta\'):(this.genProvider==="openrouter"?this.t(\'keyInvalidOpenrouter\'):(this.genProvider==="ollama"?this.t(\'keyMissingOllama\'):this.t(\'keyInvalid\')));}',
  'O7 Invalid-Auswahl');
console.log('  O7: Fehlermeldungen mit ollama-Zweig');

// ---------- O8: Netz/Timeout mit localhost-Hinweis bei ollama ----------
s = rep1(s,
  '}catch(e){if(e&&e.name==="AbortError"){this.genStatus=this.t(\'apiTimeout\');}else{this.genStatus=this.t(\'networkError\');}',
  '}catch(e){if(e&&e.name==="AbortError"){this.genStatus=this.t(\'apiTimeout\')+(this.genProvider===\'ollama\'?\' \'+this.t(\'ollamaHint\'):\'\');}else{this.genStatus=this.t(\'networkError\')+(this.genProvider===\'ollama\'?\' \'+this.t(\'ollamaHint\'):\'\');}',
  'O8 gen-Netz');
s = rep1(s,
  '}catch(e){this.modStatus=this.t(\'networkError\');this.modStatusBad=true;return;}',
  '}catch(e){this.modStatus=this.t(\'networkError\')+(this.genProvider===\'ollama\'?\' \'+this.t(\'ollamaHint\'):\'\');this.modStatusBad=true;return;}',
  'O8 mod-Netz');
console.log('  O8: Netz/Timeout mit localhost-Hinweis');

// ---------- O9: i18n ollamaHint/keyMissingOllama/ollamaModelPh x de/en/es/fr ----------
s = rep1(s,
  'I18N.de.keyFormatOpenrouter="OpenRouter-Key (openrouter.ai/keys) — nur diese Sitzung.";',
  'I18N.de.keyFormatOpenrouter="OpenRouter-Key (openrouter.ai/keys) — nur diese Sitzung.";I18N.de.ollamaHint="Lokal: Ollama muss auf http://localhost:11434 laufen (ollama serve; Seite ggf. via OLLAMA_ORIGINS freigeben, Modell vorab per ollama pull laden) — kein Key nötig.";I18N.de.keyMissingOllama="Kein Key nötig — aber Ollama antwortet nicht auf http://localhost:11434 (ollama serve starten, Modell mit ollama pull laden).";I18N.de.ollamaModelPh="Modellname, z. B. llama3.1:8b";',
  'O9 I18N de');
s = rep1(s,
  'I18N.en.keyFormatOpenrouter="OpenRouter key (openrouter.ai/keys) — this session only.";',
  'I18N.en.keyFormatOpenrouter="OpenRouter key (openrouter.ai/keys) — this session only.";I18N.en.ollamaHint="Local: Ollama must run on http://localhost:11434 (ollama serve; allow this page via OLLAMA_ORIGINS if blocked, preload the model with ollama pull) — no key needed.";I18N.en.keyMissingOllama="No key needed — but Ollama does not answer on http://localhost:11434 (start ollama serve, pull the model with ollama pull).";I18N.en.ollamaModelPh="Model name, e.g. llama3.1:8b";',
  'O9 I18N en');
s = rep1(s,
  'keyFormatOpenrouter:"Clave OpenRouter (openrouter.ai/keys) — solo esta sesion.",',
  'keyFormatOpenrouter:"Clave OpenRouter (openrouter.ai/keys) — solo esta sesion.",ollamaHint:"Local: Ollama debe ejecutarse en http://localhost:11434 (ollama serve; permite esta página con OLLAMA_ORIGINS si se bloquea, precarga el modelo con ollama pull) — sin clave.",keyMissingOllama:"Sin clave — pero Ollama no responde en http://localhost:11434 (inicia ollama serve, descarga el modelo con ollama pull).",ollamaModelPh:"Nombre del modelo, p. ej. llama3.1:8b",',
  'O9 I18N es');
s = rep1(s,
  'keyFormatOpenrouter:"Cl\\u00e9 OpenRouter (openrouter.ai/keys) \\u2014 cette session seulement.",',
  'keyFormatOpenrouter:"Cl\\u00e9 OpenRouter (openrouter.ai/keys) \\u2014 cette session seulement.",ollamaHint:"Local : Ollama doit tourner sur http://localhost:11434 (ollama serve ; autorise cette page via OLLAMA_ORIGINS si bloqué, précharge le modèle avec ollama pull) — aucune clé requise.",keyMissingOllama:"Aucune clé requise — mais Ollama ne répond pas sur http://localhost:11434 (lance ollama serve, télécharge le modèle avec ollama pull).",ollamaModelPh:"Nom du modèle, p. ex. llama3.1:8b",',
  'O9 I18N fr');
console.log('  O9: i18n-Texte (de/en/es/fr)');

// ---------- O11: leeres Modellfeld bei ollama abfangen (ollamaModelEmpty) ----------
s = rep1(s,
  'I18N.de.ollamaModelPh="Modellname, z. B. llama3.1:8b";',
  'I18N.de.ollamaModelPh="Modellname, z. B. llama3.1:8b";I18N.de.ollamaModelEmpty="Bitte Modellnamen eintragen (z. B. llama3.1:8b) — das Feld bleibt absichtlich leer.";',
  'O11 I18N de');
s = rep1(s,
  'I18N.en.ollamaModelPh="Model name, e.g. llama3.1:8b";',
  'I18N.en.ollamaModelPh="Model name, e.g. llama3.1:8b";I18N.en.ollamaModelEmpty="Please enter a model name (e.g. llama3.1:8b) — the field stays empty on purpose.";',
  'O11 I18N en');
s = rep1(s,
  'ollamaModelPh:"Nombre del modelo, p. ej. llama3.1:8b",',
  'ollamaModelPh:"Nombre del modelo, p. ej. llama3.1:8b",ollamaModelEmpty:"Escribe el nombre del modelo (p. ej. llama3.1:8b) — el campo queda vacío a propósito.",',
  'O11 I18N es');
s = rep1(s,
  'ollamaModelPh:"Nom du modèle, p. ex. llama3.1:8b",',
  'ollamaModelPh:"Nom du modèle, p. ex. llama3.1:8b",ollamaModelEmpty:"Saisis le nom du modèle (p. ex. llama3.1:8b) — le champ reste vide exprès.",',
  'O11 I18N fr');
s = rep1(s,
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var job={id:',
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}if(this.genProvider===\'ollama\'&&!String(this.genModel||\'\').trim()){this.genStatus=this.t(\'ollamaModelEmpty\');this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}var job={id:',
  'O11 enqueue-Guard');
s = rep1(s,
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}try{this.genDesc="";}',
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.genStatus=this.keyMissingMsg;this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}if(this.genProvider===\'ollama\'&&!String(this.genModel||\'\').trim()){this.genStatus=this.t(\'ollamaModelEmpty\');this.genStatusBad=true;try{this.setGenError(this.genStatus);}catch(eGE){}return;}try{this.genDesc="";}',
  'O11 generate-Guard');
s = rep1(s,
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.modStatus=this.keyMissingMsg;this.modStatusBad=true;return;}var lab=null;',
  'if(!this.genKey&&this.genProvider!==\'ollama\'){this.modStatus=this.keyMissingMsg;this.modStatusBad=true;return;}if(this.genProvider===\'ollama\'&&!String(this.genModel||\'\').trim()){this.modStatus=this.t(\'ollamaModelEmpty\');this.modStatusBad=true;return;}var lab=null;',
  'O11 modify-Guard');
console.log('  O11: Leer-Guard (ollamaModelEmpty, enqueue/generate/modify)');

// ---------- O10: Key-Namen je Anbieter (ollama-eigen, ungenutzt) ----------
s = repN(s,
  'id==="meta-muse"?"modelmuse-key-meta-muse":(id==="openrouter"?"modelmuse-key-openrouter":"modelmuse-key-baseten-direct")',
  'id==="meta-muse"?"modelmuse-key-meta-muse":(id==="openrouter"?"modelmuse-key-openrouter":(id==="ollama"?"modelmuse-key-ollama":"modelmuse-key-baseten-direct"))',
  'O10 Key-Namen', 3);
console.log('  O10: Key-Namen (ollama-eigen, 3 Stellen)');

// ---------- T1: Head-Init system-only + Live-Wechsel (kein Toggle, kein localStorage) ----------
s = rep1(s,
  '<script>\r\n/*ModelMuse Theme-Init: Systemeinstellung (prefers-color-scheme) als Default, gespeicherte Wahl gewinnt (Toggle bleibt).*/\r\ntry{var __ssTheme=null;try{__ssTheme=localStorage.getItem("modelmuse.theme");}catch(eSS){}if(__ssTheme!=="light"&&__ssTheme!=="dark"){__ssTheme=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}if(__ssTheme==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(eSS2){}\r\n</script>',
  '<script>\r\n/*ModelMuse Theme: ausschliesslich System (prefers-color-scheme), live bei Systemwechsel — kein Umschalter.*/\r\ntry{var __sysDark=function(){try{return !(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches);}catch(e){return true;}};if(__sysDark()){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}try{var __mq=window.matchMedia("(prefers-color-scheme: light)");if(__mq){var __apply=function(){try{if(__sysDark()){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(x){}};if(__mq.addEventListener){__mq.addEventListener("change",__apply);}else if(__mq.addListener){__mq.addListener(__apply);}}}catch(eL){}}catch(eSS2){}\r\n</script>',
  'T1 Head-Init');
console.log('  T1: Head-Init system-only + Live-Listener');

// ---------- T2: Dunkel/Hell-Umschalter aus dem Header entfernen ----------
s = rep1(s,
  '\r\n<div class="flex items-center gap-1" role="group" :aria-label="t(\'themeLabel\')">\r\n<button type="button" @click="setTheme(\'dark\')" :class="theme===\'dark\'?\'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950\':\'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100\'" class="px-4 rounded-xl font-semibold min-h-[44px] transition-all hover:opacity-90">{{t(\'dark\')}}</button>\r\n<button type="button" @click="setTheme(\'light\')" :class="theme===\'light\'?\'bg-amber-400 text-slate-900\':\'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100\'" class="px-4 rounded-xl font-semibold min-h-[44px] transition-all hover:opacity-90">{{t(\'light\')}}</button>\r\n</div>',
  '',
  'T2 Toggle-Gruppe');
console.log('  T2: Umschalter entfernt');

// ---------- T3: setTheme-Methode entfernen (kein Override mehr) ----------
s = rep1(s,
  'setTheme:function(x){this.theme=x;try{if(x==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}try{localStorage.setItem("modelmuse.theme",x);}catch(e){}},',
  '',
  'T3 setTheme');
console.log('  T3: setTheme-Methode entfernt');

// ---------- T4: Mounted-Theme nur nach System ----------
s = rep1(s,
  'try{if(this.theme==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e3){}',
  'try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";document.documentElement.classList.remove("dark");}else{this.theme="dark";document.documentElement.classList.add("dark");}}catch(e3){}',
  'T4 Mounted-Apply');
console.log('  T4: Mounted-Apply system-only');

// ---------- T5: Data-Theme ohne localStorage (System-Default) ----------
s = rep1(s,
  'theme:(function(){try{var __t=null;try{__t=localStorage.getItem("modelmuse.theme");}catch(eT){}if(__t==="light"||__t==="dark")return __t;if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";return "dark";}catch(eT2){return "dark";}})()',
  'theme:(function(){try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";return "dark";}catch(eT2){return "dark";}})()',
  'T5 Data-Default');
console.log('  T5: Data-Default system-only');

// ---------- T6: Mounted-Restore ohne localStorage ----------
s = rep1(s,
  'var th=localStorage.getItem("modelmuse.theme");if(th==="light"||th==="dark"){this.theme=th;}else{try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";}else{this.theme="dark";}}catch(eTh){}}',
  'try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";}else{this.theme="dark";}}catch(eTh){}',
  'T6 Mounted-Restore');
console.log('  T6: Mounted-Restore system-only');

// ---------- S: Stempel v46 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v45 (Hilfe-Link: footerHelp de/en/es/fr + sprachabhaengiger Fusszeilen-Link auf help/, via scripts/build-standalone-v45.mjs) -->';
must(cnt(s, stamp) === 1, 'v45-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v46 (Final-Sprint: ETA flat 240 s + Modus-Auto + Funktions-Footer + docs/LICENSES.md + Ollama lokal, via scripts/build-standalone-v46.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v46: OK v46 (Final-Sprint)');
