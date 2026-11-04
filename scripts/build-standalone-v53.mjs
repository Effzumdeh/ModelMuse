/**
 * Standalone builder v53 (Redesign-Port ins Standalone-Release, 04.11.2026):
 * Baut auf dem v52-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (live b14c51a): Redesign (FRONTEND-REDESIGN-PLAN Phase 2, Top-5)
 * steckt nur in der Dev-Shell (src/shell/*); das Standalone-Artefakt
 * (Pages-Release) ist byte-identisch unveraendert — kein Builder-Anteil.
 * Live-Seite zeigt Redesign NICHT. Analog zum FR-Port (v42) loesen:
 * neuer Builder v53 + Toleranzen, de/en/es/fr, Rebuild + Verify + Tests.
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * T1 Token-System (H1): :root (hell) + .dark (dunkel) mit kanonischen
 *     --surface-0/1/2, --ink-1/2/3, --accent(+ink), --accent-2, --ok/--warn/
 *     --bad, --focus (Werte = src/shell/theme.css, Kontraste s. Report).
 *     Fokus-Ring nutzt var(--focus). Kein prefers-color-scheme-String
 *     (v52-Zaehler 7x bleibt), kein modelmuse.theme-String.
 * T2 Type-Skala: Panel-Titel 20 semibold (labs + viewport h2 -> text-xl
 *     font-semibold), Micro 13px statt 12px (CSS-Override .text-xs).
 * H3 Dopplung raus: Standalone hat keine Etikett:/Mass:-Bullets (bereits 0,
 *     assert) — v53 fuegt .v53-measure-badge-Chips (wie Shell) hinzu und
 *     sichert partsTitle-Count (bereits vorhanden).
 * H2+M2 Kompakt-Header + Branding: h1 visuell entfernt (sr-only, bleibt
 *     fuer AT/i18n), Logo-Pille alleinige visuelle Marke; <640px-Kompakt-
 *     CSS (Header-Padding, Logo 26px); Onboarding neutral de/en/es/fr
 *     (kein links/on-the-left/a-la-izquierda/a-gauche-ou mehr).
 * M1 Primary-Buttons: genau ein .v53-primary je Panel (Generator,
 *     Modify, Onboarding) auf Akzent-Basis (indigo-600 hell = #4f46e5,
 *     6,29:1); Selects neutraler Hover via var(--ink-3), keine data-URI
 *     (v51/v52 data:image-Zaehler 1x bleibt).
 * S  Signatur + Motion: Glas-Header -webkit-backdrop (wie Shell),
 *     Export-Menue Glas bleibt; Viewport-Crossfade 160ms
 *     (#viewport.v53-switching) mit Reduced-Motion-Guard in CSS + JS
 *     (selectLab, sync, harter Schnitt bei reduce).
 * S  Stempel v53 + Invarianten + Syntax-Gate.
 *
 * Nachfolger-Toleranz: v51/v52 pruefen h1-Anker v53-tolerant
 * (alt 1x pre-v53, 0x mit v53; sr-only 0 pre, 1 mit v53) — Patches in
 * scripts/build-standalone-v51-logo.mjs + scripts/build-standalone-v52.mjs
 * + tests-unit/standalone-v5*-Tests + scripts/verify-standalone.mjs.
 * Alle uebrigen v53-Anker sind additiv (keine Alt-Zaehler betroffen).
 *
 * Aufruf: node scripts/build-standalone-v53.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v53-report.json';
const STAMP = 'standalone-build v53 (Redesign-Port: Token + Type + Kompakt/Branding + Primary + Glas/Crossfade)';

function must(cond, msg) {
  if (!cond) { console.error('build-v53: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v52 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v53-syn-'));
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
          console.error('build-v53: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v53-inline-' + n + '.js')); } catch {}
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
  const is53 = s.includes(STAMP);
  must(is53, 'v53-Stempel fehlt');
  const inv = [
    [STAMP, 1],
    ['standalone-build v50', 1],
    ['standalone-build v51 (Logo-V2 header links)', 1],
    ['standalone-build v52', 1],
    // v51/v52-Anker intakt (ausser h1, siehe unten).
    ['logo-chip-v51', 1],
    ['viewBox="0 0 621 170"', 2],
    ['logo-v52-light', 2],
    ['logo-v52-dark', 3],
    ['logo-chip-v51 inline-flex items-center bg-white', 0],
    ['role="img" aria-label="ModelMuse Logo"', 1],
    ['<img', 0],
    ['data:image', 1],
    // v52 Theme-Zaehler unberuehrt (T1 nutzt keine dieser Strings).
    ['setTheme:function', 1],
    ['toggleTheme:function', 1],
    ['toggleTheme()', 1],
    ['modelmuse.theme', 7],
    // T1 Token-System.
    ['v53-tokens', 1],
    ['--surface-0:#f1f4f9', 1],
    ['--accent-2:#0277b6', 1],
    ['.dark{--surface-0:#0c1118', 1],
    ['--accent:#ffd34d', 1],
    ['--accent-2:#4dd2ff', 1],
    ['--bad:#ef6b6b', 1],
    // T2 Type-Skala.
    ['v53-panel-title', 3],
    ['text-xl font-semibold mb-3', 1],
    ['text-xl font-semibold flex-1 min-w-[160px]', 1],
    ['.text-xs{font-size:13px', 1],
    // H3 Dopplung raus (keine Bullets, Badge-Chips vorhanden).
    ['v53-measure-badge', 1],
    ['Etikett:', 0],
    // H2+M2 Kompakt-Header + Branding.
    ['<h1 class="sr-only">{{t(\'appTitle\')}}</h1>', 1],
    ['v53 Branding', 1],
    ['@media (max-width:639px)', 1],
    ['v53-kompakt', 1],
    // M1 Primary-Buttons.
    ['v53-primary', 5],
    ['v53-primary-btn', 1],
    ['select:hover{border-color:var(--ink-3)}', 1],
    // S Signatur + Motion.
    ['-webkit-backdrop-filter:blur(8px)', 1],
    ['v53-viewport', 1],
    ['#viewport{transition:opacity 160ms ease-out}', 1],
    ['#viewport.v53-switching{opacity:0}', 1],
    ['v53-switching', 6],
    // Onboarding neutral de/en/es/fr.
    ['Wähle links ein Modell', 0],
    ['on the left or generate', 0],
    ['a la izquierda o genera', 0],
    ['à gauche ou g', 0],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('Wähle ein Modell oder generiere'), 'Onboarding de neutral fehlt');
  must(s.includes('Pick a model or generate'), 'Onboarding en neutral fehlt');
  must(s.includes('Elige un modelo o genera'), 'Onboarding es neutral fehlt');
  must(s.includes('Choisis un mod'), 'Onboarding fr neutral fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v53 Redesign-Port)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v53: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v52 (Theme-Umschalter + Logo-Dark-Variante)',
    standalone: 'v53-redesign-port',
    quelle: 'src/shell (b14c51a FRONTEND-REDESIGN-PLAN Phase 2 Top-5)',
    fixes: [
      'T1 Token-System: :root hell + .dark dunkel (--surface/--ink/--accent/--ok/--warn/--bad/--focus, Kontraste hell --accent-2 4,86 / --ink-3 4,76 / --ink-1 16,40 / --ink-2 6,53 / --accent 6,29; dunkel --bad 5,69 / --accent-2 9,76 / --ink-1 16,09 / --ink-2 7,88)',
      'T2 Type-Skala: Panel-Titel 20 semibold (labs + viewport), Micro 13px (.text-xs-Override)',
      'H3 Dopplung: keine Etikett:/Mass:-Bullets (assert 0), .v53-measure-badge-Chips, partsTitle-Count bleibt',
      'H2+M2 Kompakt-Header <640px + Branding (h1 sr-only, Logo alleinige Marke) + Onboarding neutral de/en/es/fr',
      'M1 Primary: je ein .v53-primary (Generator/Modify/Onboarding) auf Akzent-Basis, Selects neutraler Hover',
      'S Signatur + Motion: Glas-Header -webkit-backdrop, Viewport-Crossfade 160ms + Reduced-Motion-Schnitt (CSS + selectLab-JS)',
    ],
    counts: { zeichen: s.length, v53Stempel: cnt(s, STAMP) },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v53: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v50'), 'kein v50-Stempel (falsche Basis)');
must(s.includes('standalone-build v51 (Logo-V2 header links)'), 'kein v51-Stempel (falsche Basis)');
must(s.includes('standalone-build v52'), 'kein v52-Stempel (falsche Basis)');
if (s.includes(STAMP)) {
  checkInvariants(s);
  console.log('build-v53: bereits v53 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- T1: Token-System (CSS vor </style>) ----------
{
  const anchor = '.dark .logo-v52-dark{display:block}\r\n</style>';
  must(cnt(s, anchor) === 1, 'T1 CSS-Anker fehlt/mehrdeutig');
  const tokens = '.dark .logo-v52-dark{display:block}\r\n'
    + '/* v53-tokens (Redesign-Port Phase 2 Top-1/Top-5: kanonisch --surface/--ink/--accent/--ok/--warn/--bad/--focus; hell = Default, dunkel via .dark) */\r\n'
    + ':root{--surface-0:#f1f4f9;--surface-1:#ffffff;--surface-2:#ffffff;--ink-1:#16202e;--ink-2:#4c5f78;--ink-3:#64748b;--accent:#4f46e5;--accent-ink:#ffffff;--accent-2:#0277b6;--ok:#15803d;--warn:#b45309;--bad:#b91c1c;--focus:#1d4ed8}\r\n'
    + '.dark{--surface-0:#0c1118;--surface-1:#151c27;--surface-2:#0d141d;--ink-1:#e8edf3;--ink-2:#9fb2c8;--ink-3:#3b4a5e;--accent:#ffd34d;--accent-ink:#1c1005;--accent-2:#4dd2ff;--ok:#37c26a;--warn:#e0a100;--bad:#ef6b6b;--focus:#7cc4ff}\r\n'
    + ':focus-visible{outline-color:var(--focus)}\r\n'
    + '/* v53 Type-Skala: Panel-Titel 20 semibold, Micro 13px statt 12px */\r\n'
    + '.v53-panel-title{font-size:20px;font-weight:600}\r\n'
    + '.text-xs{font-size:13px !important;line-height:1.45}\r\n'
    + '/* v53 H3: Mass-Badge-Chips (wie Shell .measure-badge) */\r\n'
    + '.v53-measure-badge{font-size:13px;border:1px solid var(--accent-2);color:var(--accent-2);border-radius:20px;padding:2px 10px}\r\n'
    + '/* v53-kompakt (H2): <640px Header-Padding + Logo 26px, Kopfzeile wrappt bereits */\r\n'
    + '@media (max-width:639px){header div[class*="max-w"]{padding-top:10px;padding-bottom:10px;padding-left:12px;padding-right:12px}header svg{height:26px !important}}\r\n'
    + '/* v53-primary-btn (M1): genau eine prominente Aktion je Panel auf Akzent-Basis */\r\n'
    + '.v53-primary{background:var(--accent) !important;color:var(--accent-ink) !important;border-color:transparent !important;font-weight:700}\r\n'
    + 'select:hover{border-color:var(--ink-3)}\r\n'
    + '/* v53 Glas-Signatur: -webkit-Prefix (Tailwind backdrop-blur bleibt) */\r\n'
    + 'header{-webkit-backdrop-filter:blur(8px)}\r\n'
    + '/* v53 Crossfade: Lab-Wechsel 160ms, Reduced-Motion = harter Schnitt */\r\n'
    + '#viewport{transition:opacity 160ms ease-out}\r\n'
    + '#viewport.v53-switching{opacity:0}\r\n'
    + '@media (prefers-reduced-motion:reduce){#viewport{transition:none}#viewport.v53-switching{opacity:1}}\r\n'
    + '</style>';
  s = s.replace(anchor, tokens);
  console.log('  T1/T2/H3/M1/S: Token + Type + Badge + Kompakt + Primary + Glas/Crossfade-CSS');
}

// ---------- T2: Panel-Titel 20 semibold ----------
s = rep1(s,
  '<h2 class="font-bold mb-3">{{t(\'labs\')}} ({{filteredLabs.length}})</h2>',
  '<h2 class="text-xl font-semibold mb-3 v53-panel-title">{{t(\'labs\')}} ({{filteredLabs.length}})</h2>',
  'T2 Labs-Titel');
console.log('  T2: Labs-Titel 20 semibold');
s = rep1(s,
  '<h2 class="text-lg font-bold flex-1 min-w-[160px]">{{t(\'viewportTitle\')}}: {{activeLab.title[lang]}}</h2>',
  '<h2 class="text-xl font-semibold flex-1 min-w-[160px] v53-panel-title">{{t(\'viewportTitle\')}}: {{activeLab.title[lang]}}</h2>',
  'T2 Viewport-Titel');
console.log('  T2: Viewport-Titel 20 semibold');

// ---------- H2+M2: Branding (h1 sr-only, visuelle Marke = Logo) ----------
s = rep1(s,
  '<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>',
  '<h1 class="sr-only">{{t(\'appTitle\')}}</h1><!-- v53 Branding: visuelle Wortmarke entfernt (Logo-SVG traegt Schriftzug), H1 bleibt fuer AT/i18n -->',
  'M2 Branding');
console.log('  M2: Branding (h1 sr-only, Logo alleinige Marke)');

// ---------- H2: Onboarding neutral de/en/es/fr (keine links-Annahme) ----------
s = rep1(s,
  'onboarding:"Willkommen bei ModelMuse! Wähle links ein Modell oder generiere ein eigenes Modell."',
  'onboarding:"Willkommen bei ModelMuse! Wähle ein Modell oder generiere ein eigenes Modell."',
  'H2 Onboarding de');
s = rep1(s,
  'onboarding:"Welcome to ModelMuse! Pick a model on the left or generate your own model."',
  'onboarding:"Welcome to ModelMuse! Pick a model or generate your own model."',
  'H2 Onboarding en');
s = rep1(s,
  'onboarding:"\\u00a1Bienvenido a ModelMuse! Elige un modelo a la izquierda o genera tu propio modelo."',
  'onboarding:"\\u00a1Bienvenido a ModelMuse! Elige un modelo o genera tu propio modelo."',
  'H2 Onboarding es');
s = rep1(s,
  'onboarding:"Bienvenue sur ModelMuse ! Choisis un mod\\u00e8le \\u00e0 gauche ou g\\u00e9n\\u00e8re ton propre mod\\u00e8le."',
  'onboarding:"Bienvenue sur ModelMuse ! Choisis un mod\\u00e8le ou g\\u00e9n\\u00e8re ton propre mod\\u00e8le."',
  'H2 Onboarding fr');
console.log('  H2: Onboarding neutral de/en/es/fr');

// ---------- M1: Primary-Buttons (je einer je Panel) ----------
s = rep1(s,
  '<button @click="enqueueGenerate" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold">{{t(\'generateBtn\')}}</button>',
  '<button @click="enqueueGenerate" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] min-w-[44px] text-sm font-semibold v53-primary">{{t(\'generateBtn\')}}</button>',
  'M1 Generator-Primary');
console.log('  M1: Generator-Primary (Akzent indigo-600)');
s = rep1(s,
  '<button type="button" @click="submitModify" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] text-sm font-semibold disabled:opacity-50">',
  '<button type="button" @click="submitModify" class="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-5 min-h-[44px] text-sm font-semibold v53-primary">',
  'M1 Modify-Primary');
console.log('  M1: Modify-Primary');
s = rep1(s,
  '<button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50">{{t(\'understood\')}}</button>',
  '<button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50 v53-primary">{{t(\'understood\')}}</button>',
  'M1 Onboarding-Primary');
console.log('  M1: Onboarding-Primary');

// ---------- S: Crossfade-JS in selectLab (Reduced-Motion-Guard, sync) ----------
s = rep1(s,
  'selectLab:function(id){try{var kept2=[];for(var si=0;si<this.genJobs.length;si++){var sj=this.genJobs[si];if((sj.statusKey===\'jobDone\'||sj.statusKey===\'jobError\')&&sj.labId&&sj.labId===id){continue;}kept2.push(sj);}if(kept2.length!==this.genJobs.length){this.genJobs=kept2;}}catch(eSP){}this.activeLabId=id;this.partsHidden=[];this.partInfoIndex=null;try{window.__viewer._partsHidden=[];}catch(eph){}try{localStorage.setItem("modelmuse.lab",id);}catch(e){}try{this.syncViewer();}catch(e2){}}',
  'selectLab:function(id){try{var kept2=[];for(var si=0;si<this.genJobs.length;si++){var sj=this.genJobs[si];if((sj.statusKey===\'jobDone\'||sj.statusKey===\'jobError\')&&sj.labId&&sj.labId===id){continue;}kept2.push(sj);}if(kept2.length!==this.genJobs.length){this.genJobs=kept2;}}catch(eSP){}this.activeLabId=id;this.partsHidden=[];this.partInfoIndex=null;try{window.__viewer._partsHidden=[];}catch(eph){}try{localStorage.setItem("modelmuse.lab",id);}catch(e){}var __vp53=null;try{__vp53=document.getElementById("viewport");}catch(eV53){}var __rm53=false;try{__rm53=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(eR53){}if(__vp53&&!__rm53){try{__vp53.classList.add("v53-switching");}catch(eA53){}}try{this.syncViewer();}catch(e2){}if(__vp53&&!__rm53){try{var __p53=__vp53;if(window.requestAnimationFrame){window.requestAnimationFrame(function(){window.requestAnimationFrame(function(){try{__p53.classList.remove("v53-switching");}catch(eC53){}});});}else{__p53.classList.remove("v53-switching");}}catch(eF53){try{__vp53.classList.remove("v53-switching");}catch(eG53){}}}}',
  'S Crossfade-JS');
console.log('  S: Crossfade-JS (160ms + Reduced-Motion-Schnitt)');

// ---------- S: Viewport-Glas (Export-Menue bleibt, Viewport erhaelt Token-Rahmen) ----------
s = rep1(s,
  '<div id="viewport" style="height:70vh;min-height:560px" class="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700"></div>',
  '<div id="viewport" style="height:70vh;min-height:560px" class="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 v53-viewport"></div>',
  'S Viewport-Marker');
console.log('  S: Viewport-Marker');

// ---------- S: Stempel v53 in Header-Kette ----------
{
  const anchor = '<!-- standalone-build v50 (Baseten-Doku-Regel nur max_tokens + zweistufiger 400-Fallback Extra-inputs-Limit-Strip + Diagnose-Limit-Strip + Stempel v50, via scripts/build-standalone-v50.mjs) -->';
  must(cnt(s, anchor) === 1, 'S Stempel-Anker fehlt/mehrdeutig');
  s = s.replace(anchor, anchor + ' <!-- ' + STAMP + ', via scripts/build-standalone-v53.mjs -->');
  console.log('  S: Stempel v53');
}

// ---------- S: Stempel + Invarianten + Syntax-Gate ----------
assertInlineScriptsParse(s);
checkInvariants(s);
await writeFile(FILE, s);
console.log(`build-v53: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v53: OK v53 (Redesign-Port)');
