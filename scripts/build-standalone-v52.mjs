/**
 * Standalone builder v52 (Theme-Umschalter + Logo-Dark-Variante, 03.11.2026):
 * Baut auf dem v51-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * 1) Logo-Dark-Variante: docs/assets/logo-header-dark.svg (helle Version der
 *    V2-Kopfzeile: Model #141419 -> #F8FAFC, Kontur #141415 -> #E8EDF3,
 *    Indigo #4535C8 -> #A5B4FC) wird zusaetzlich inline eingebettet; hell und
 *    dunkel wechseln automatisch mit dem Farbschema (.dark-Klasse, gesetzt per
 *    Head-Init noch vor dem ersten Paint). Der weisse Chip (bg-white) entfaellt
 *    (transparent), da beide Varianten eigenkontrastreich sind.
 *    Quellen (Single Source): docs/assets/logo-header.svg + logo-header-dark.svg.
 * 2) Theme-Umschalter zurueck (v46 hatte ihn entfernt): Default folgt dem System
 *    (prefers-color-scheme + live per change-Listener), manueller Toggle
 *    ueberschreibt und wird in localStorage (modelmuse.theme) persistiert.
 *    Labels de/en/es/fr aus den bestehenden I18N-Keys dark/light/themeLabel.
 *    Head-Init: gespeicherte Wahl gewinnt, sonst System; Live-Listener nur ohne
 *    Override. Data-Default + Mounted-Restore analog (stored wins, sonst System).
 *
 * Nachfolger-Toleranz: keine aelteren Anker ausser den unten ersetzten;
 * aeltere Builder (v13..v51) laufen vorher in der Kette (package.json
 * build:standalone) und pruefen nur ihre eigenen Anker — v51 wurde
 * v52-tolerant gemacht (viewBox 2x bei v52-Stempel), alle uebrigen v51/v46-
 * Anker bleiben intakt bis auf die dokumentiert abgeloesten T-Anker.
 *
 * Aufruf: node scripts/build-standalone-v52.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v52-report.json';
const STAMP = 'standalone-build v52 (Theme-Umschalter + Logo-Dark-Variante)';
const LIGHT_ASSET = 'docs/assets/logo-header.svg';
const DARK_ASSET = 'docs/assets/logo-header-dark.svg';

function must(cond, msg) {
  if (!cond) { console.error('build-v52: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v51 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v52-syn-'));
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
          console.error('build-v52: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v52-inline-' + n + '.js')); } catch {}
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
    [STAMP, 1],
    ['standalone-build v50', 1],
    ['standalone-build v51 (Logo-V2 header links)', 1],
    // L1: duale Logo-Varianten (hell + dunkel), genau je 1x, vor dem App-Titel.
    ['logo-chip-v51', 1],
    ['viewBox="0 0 621 170"', 2],
    ['logo-v52-light', 2],
    ['logo-v52-dark', 3],
    ['logo-chip-v51 inline-flex items-center bg-white', 0],
    ['#F8FAFC', 1],
    ['#E8EDF3', 2],
    ['#A5B4FC', 2],
    ['<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>', s.includes('standalone-build v53') ? 0 : 1],
    ['<h1 class="sr-only">{{t(\'appTitle\')}}</h1>', s.includes('standalone-build v53') ? 1 : 0],
    ['<img', 0],
    // L2-L4: Umschalter zurueck (System-Default + live, Override persistiert).
    ['setTheme:function', 1],
    ['toggleTheme:function', 1],
    ['toggleTheme()', 1],
    [':aria-label="t(\'themeLabel\')"', 1],
    ["{{theme==='dark'?t('light'):t('dark')}}", 1],
    ['modelmuse.theme', 7],
    ['__sysDark', 0],
    ['prefers-color-scheme', 7], // Head 3 (Kommentar + Init + Listener) + Data 1 + Apply 1 + Mounted 2
    ['theme:"dark"', 0],
    ['<html lang="de" class="dark">', 0],
    ['<html lang="de">', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('role="img" aria-label="ModelMuse Logo"'), 'SVG-a11y fehlt');
  must(cnt(s, 'style="height:28px;width:auto;display:block"') === 2, 'SVG-Kopfzeilen-Stil je Variante fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v52 Theme-Umschalter + Logo-Dark-Variante)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v52: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v51 (Logo-V2-Header)',
    standalone: 'v52-theme-logo',
    assets: [
      { datei: LIGHT_ASSET, zweck: 'Kopfzeilen-Logo hell (Bestand)' },
      { datei: DARK_ASSET, zweck: 'Kopfzeilen-Logo dunkel (neu, helle Version)' },
    ],
    fixes: [
      'Logo-Chip: transparent statt bg-white, hell+dunkel je 1x, Wechsel via .dark-Klasse',
      'Theme-Umschalter: System-Default (prefers-color-scheme + live ohne Override), Toggle persistiert modelmuse.theme, Labels dark/light/themeLabel de/en/es/fr',
      'Head-Init/Data/Mounted: gespeicherte Wahl gewinnt, sonst System',
    ],
    counts: { zeichen: s.length, logoSvg: cnt(s, 'viewBox="0 0 621 170"') },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v52: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v50'), 'kein v50-Stempel (falsche Basis)');
must(s.includes('standalone-build v51 (Logo-V2 header links)'), 'kein v51-Stempel (falsche Basis)');
if (s.includes(STAMP)) {
  checkInvariants(s);
  console.log('build-v52: bereits v52 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- L0: Assets laden (Single Source) ----------
let lightSvg = (await readFile(LIGHT_ASSET, 'utf8')).trim();
let darkSvg = (await readFile(DARK_ASSET, 'utf8')).trim();
for (const [name, svg] of [['light', lightSvg], ['dark', darkSvg]]) {
  must(svg.startsWith('<svg ') && !svg.includes('</script'), `Logo-Asset ${name} ungueltig`);
  must(svg.includes('viewBox="0 0 621 170"'), `Logo-Asset ${name}: falsche viewBox`);
}
must(lightSvg.includes(' role="img" aria-label="ModelMuse Logo"'), 'Light-Asset: a11y fehlt');
must(darkSvg.includes(' role="img" aria-label="ModelMuse Logo"'), 'Dark-Asset: a11y fehlt');
must(cnt(lightSvg, '#141419') === 1 && cnt(darkSvg, '#F8FAFC') === 1, 'Dark-Variante: Model-Text nicht invertiert');
must(cnt(darkSvg, '#E8EDF3') === 2, 'Dark-Variante: Kontur nicht invertiert');
must(cnt(darkSvg, '#A5B4FC') === 2, 'Dark-Variante: Indigo nicht aufgehellt');
const stripA11y = (svg) => svg.replace(
  ' role="img" aria-label="ModelMuse Logo"', ' aria-hidden="true" focusable="false"',
);
lightSvg = lightSvg.replace('<svg ', '<svg style="height:28px;width:auto;display:block" ');
darkSvg = darkSvg.replace('<svg ', '<svg style="height:28px;width:auto;display:block" ');
must(lightSvg.includes('style="height:28px'), 'Light-Stil-Anker fehlt');
must(darkSvg.includes('style="height:28px'), 'Dark-Stil-Anker fehlt');

// ---------- L1: Dual-Chip (hell + dunkel, Wechsel via .dark-Klasse) ----------
{
  const OLD_CHIP = '<span class="logo-chip-v51 inline-flex items-center bg-white rounded-lg px-2 py-1 leading-none" title="ModelMuse"><!-- standalone-build v51 (Logo-V2 header links): Quelle docs/assets/logo-header.svg -->' + lightSvg + '</span>';
  must(cnt(s, OLD_CHIP) === 1, 'L1 v51-Chip-Anker fehlt/mehrdeutig x' + cnt(s, OLD_CHIP));
  const NEW_CHIP = '<span class="logo-chip-v51 inline-flex items-center rounded-lg px-2 py-1 leading-none" title="ModelMuse" role="img" aria-label="ModelMuse Logo"><!-- ' + 'standalone-build v51 (Logo-V2 header links): ' + STAMP + ': Quellen ' + LIGHT_ASSET + ' + ' + DARK_ASSET + ', automatischer Wechsel mit Farbschema -->'
    + '<span class="logo-v52-light">' + stripA11y(lightSvg) + '</span>'
    + '<span class="logo-v52-dark">' + stripA11y(darkSvg) + '</span></span>';
  s = s.replace(OLD_CHIP, NEW_CHIP);
  console.log('  L1: Dual-Logo-Chip (hell + dunkel, transparent)');
}

// ---------- L2: Logo-Varianten-CSS (.dark-Klasse, Pre-Paint gesetzt) ----------
s = rep1(s,
  '.win-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:600}\r\n</style>',
  '.win-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:600}\r\n/* v52 Logo hell/dunkel (automatischer Wechsel mit Farbschema, .dark-Klasse) */\r\n.logo-v52-dark{display:none}\r\n.dark .logo-v52-light{display:none}\r\n.dark .logo-v52-dark{display:block}\r\n</style>',
  'L2 Logo-CSS');
console.log('  L2: Logo-Varianten-CSS');

// ---------- L3: Head-Init (System-Default, gespeicherte Wahl gewinnt, live ohne Override) ----------
{
  const START = '<script>\r\n/*ModelMuse Theme: ausschliesslich System';
  must(cnt(s, START) === 1, 'L3 Head-Anker fehlt/mehrdeutig x' + cnt(s, START));
  const from = s.indexOf(START);
  const endMark = '\r\n</script>';
  const end = s.indexOf(endMark, from);
  must(end > from, 'L3 Head-Ende fehlt');
  const OLD_HEAD = s.slice(from, end + endMark.length);
  const NEW_HEAD = '<script>\r\n/*ModelMuse Theme v52: System (prefers-color-scheme) als Default, gespeicherte Wahl gewinnt (Toggle); live bei Systemwechsel ohne Override.*/\r\ntry{var __apply52=function(t){try{if(t==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(eA52){}};var __ss52=null;try{__ss52=localStorage.getItem("modelmuse.theme");}catch(eSS52){}if(__ss52!=="light"&&__ss52!=="dark"){try{__ss52=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}catch(eM52){__ss52="dark";}}__apply52(__ss52);try{var __mq52=window.matchMedia("(prefers-color-scheme: light)");if(__mq52){var __on52=function(){try{var __cur52=null;try{__cur52=localStorage.getItem("modelmuse.theme");}catch(eC52){}if(__cur52==="light"||__cur52==="dark")return;__apply52(__mq52.matches?"light":"dark");}catch(x52){}};if(__mq52.addEventListener){__mq52.addEventListener("change",__on52);}else if(__mq52.addListener){__mq52.addListener(__on52);}}}catch(eL52){}}catch(eSS252){}\r\n</script>';
  s = s.replace(OLD_HEAD, NEW_HEAD);
  console.log('  L3: Head-Init (System-Default + Override + live)');
}

// ---------- L4: Umschalter-Button im Header (nach der Sprachgruppe) ----------
s = rep1(s,
  '>FR</button>\r\n</div>\r\n</div>\r\n</header>',
  '>FR</button>\r\n</div>\r\n<div class="flex items-center gap-1" role="group" :aria-label="t(\'themeLabel\')">\r\n<button type="button" @click="toggleTheme()" :class="theme===\'dark\'?\'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950\':\'bg-amber-400 text-slate-900\'" class="px-4 rounded-xl font-semibold min-h-[44px] transition-all hover:opacity-90">{{theme===\'dark\'?t(\'light\'):t(\'dark\')}}</button>\r\n</div>\r\n</div>\r\n</header>',
  'L4 Toggle-Button');
console.log('  L4: Toggle-Button (dark/light/themeLabel de/en/es/fr)');

// ---------- L5: setTheme + toggleTheme-Methoden (nach setLang) ----------
s = rep1(s,
  'localStorage.setItem("modelmuse.lang",l);}catch(e){}},\r\n\r\ndismissOnboarding',
  'localStorage.setItem("modelmuse.lang",l);}catch(e){}},\r\nsetTheme:function(x){this.theme=x;try{if(x==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}try{localStorage.setItem("modelmuse.theme",x);}catch(e){}},\r\ntoggleTheme:function(){this.setTheme(this.theme==="dark"?"light":"dark");},\r\n\r\ndismissOnboarding',
  'L5 setTheme/toggleTheme');
console.log('  L5: setTheme + toggleTheme (persistiert modelmuse.theme)');

// ---------- L6: Data-Default (gespeicherte Wahl gewinnt, sonst System) ----------
s = rep1(s,
  'theme:(function(){try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";return "dark";}catch(eT2){return "dark";}})()',
  'theme:(function(){try{var __t=null;try{__t=localStorage.getItem("modelmuse.theme");}catch(eT){}if(__t==="light"||__t==="dark")return __t;if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)return "light";return "dark";}catch(eT2){return "dark";}})()',
  'L6 Data-Default');
console.log('  L6: Data-Default (stored wins, sonst System)');

// ---------- L7: Theme-Apply mit Override (stored wins, sonst System) ----------
s = rep1(s,
  'try{document.documentElement.lang=this.lang;}catch(e2){}try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";document.documentElement.classList.remove("dark");}else{this.theme="dark";document.documentElement.classList.add("dark");}}catch(e3){}',
  'try{document.documentElement.lang=this.lang;}catch(e2){}try{var __t52a=null;try{__t52a=localStorage.getItem("modelmuse.theme");}catch(eTA){}if(__t52a!=="light"&&__t52a!=="dark"){try{__t52a=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}catch(eM52a){__t52a="dark";}}this.theme=__t52a;try{if(this.theme==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(eAA){}}catch(e3){}',
  'L7 Theme-Apply');
console.log('  L7: Theme-Apply (stored wins, sonst System)');

// ---------- L8: Mounted-Restore (stored wins, sonst System) + Live-Listener ----------
s = rep1(s,
  'try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";}else{this.theme="dark";}}catch(eTh){}',
  'try{var __th52=null;try{__th52=localStorage.getItem("modelmuse.theme");}catch(eS52){}if(__th52==="light"||__th52==="dark"){this.theme=__th52;}else{try{if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){this.theme="light";}else{this.theme="dark";}}catch(eTM52){}}try{var __mq52=window.matchMedia("(prefers-color-scheme: light)");if(__mq52){var __self52=this;var __on52=function(){try{var __cur52b=null;try{__cur52b=localStorage.getItem("modelmuse.theme");}catch(eC52b){}if(__cur52b==="light"||__cur52b==="dark")return;if(__mq52.matches){__self52.theme="light";}else{__self52.theme="dark";}}catch(eU52){}};if(__mq52.addEventListener){__mq52.addEventListener("change",__on52);}else if(__mq52.addListener){__mq52.addListener(__on52);}}}catch(eL52){}}catch(eTh){}',
  'L8 Mounted-Restore');
console.log('  L8: Mounted-Restore (stored wins + live ohne Override)');

// ---------- S: Stempel v52 + Invarianten + Syntax-Gate ----------
assertInlineScriptsParse(s);
checkInvariants(s);
await writeFile(FILE, s);
console.log(`build-v52: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v52: OK v52 (Theme-Umschalter + Logo-Dark-Variante)');
