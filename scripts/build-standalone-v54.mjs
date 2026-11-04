/**
 * Standalone builder v54 (Erklaervideo-Popup + TEMP-DEAKTIVIERT OpenRouter/Ollama, 04.11.2026):
 * Baut auf dem v53-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * V1 Erklaervideo-Popup im Welcome-Dialog (Paritaet src/shell):
 *     Onboarding-Button {{t('videoBtn')}}, schliessbares Popup (v-if videoOpen)
 *     mit <video> (controls, preload none), Quelle je UI-Sprache
 *     (../docs/erklaervideo-{de,en,es,fr}-180.mp4, Dist liegt in dist-standalone/),
 *     Close-Button + Backdrop (@click.self) + Escape (onEsc), Video-Stopp beim
 *     Schliessen; I18N-Keys videoBtn/videoTitle/videoClose/videoMissing de/en/es/fr.
 * D1 TEMP-DEAKTIVIERT (Eigentuemer 04.11.2026, Revert: Kommentar entfernen):
 *     OpenRouter- + Ollama-Eintraege in genProviders AUSKOMMENTIERT
 *     (Blockkommentar, Text bleibt — keine Auswahl, keine Loeschung).
 *     Alle v38/v46-Zaehler bleiben gruen (Text erhalten).
 * S  Stempel v54 + Invarianten + Syntax-Gate.
 *
 * Nachfolger-Toleranz: tests-unit/standalone-v42.test.mjs (fr-Dict 149 -> 153)
 * wird mitgezogen (4 Video-Keys je Lokale, Paritaet fr==es bleibt).
 *
 * Aufruf: node scripts/build-standalone-v54.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v54-report.json';
const STAMP = 'standalone-build v54 (Erklaervideo-Popup + TEMP-DEAKTIVIERT 2 Provider)';

function must(cond, msg) {
  if (!cond) { console.error('build-v54: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v53 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v54-syn-'));
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
          console.error('build-v54: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v54-inline-' + n + '.js')); } catch {}
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
  const is54 = s.includes(STAMP);
  must(is54, 'v54-Stempel fehlt');
  const inv = [
    [STAMP, 1],
    ['standalone-build v50', 1],
    ['standalone-build v51 (Logo-V2 header links)', 1],
    ['standalone-build v52', 1],
    ['standalone-build v53', 1],
    // V1 Erklaervideo-Popup.
    ['v54-video-popup', 2, 'Popup-Marker (CSS + Template)'],
    ['v54-video-panel', 3, 'Panel-Marker (CSS-Regel + .dark + Template)'],
    ['v54-video{', 1, 'Video-CSS'],
    ['videoOpen:false', 1, 'Video-State'],
    ['v-if="videoOpen"', 1, 'Popup-Template'],
    ['@click="openVideo"', 1, 'Video-Button'],
    ['@click.self="closeVideo"', 1, 'Backdrop-Close'],
    ['@click="closeVideo"', 1, 'Close-Button'],
    ['openVideo:function', 1, 'Open-Methode'],
    ['closeVideo:function', 1, 'Close-Methode'],
    ['videoSrc:function', 1, 'Video-Quelle'],
    ['../docs/erklaervideo-', 2, 'Video-Pfad je UI-Sprache (CSS-Kommentar + Methode)'],
    ['id="erklaervideo54"', 1, 'Video-Element'],
    ['videoBtn:', 4, 'I18N videoBtn de/en/es/fr'],
    ['videoTitle:', 4, 'I18N videoTitle de/en/es/fr'],
    ['videoClose:', 4, 'I18N videoClose de/en/es/fr'],
    ['videoMissing:', 4, 'I18N videoMissing de/en/es/fr'],
    // D1 TEMP-DEAKTIVIERT: Text bleibt (alte Zaehler gruen), aber auskommentiert.
    ['TEMP-DEAKTIVIERT-v54', 1, 'Deaktivierungs-Kommentar'],
    ['id:"openrouter"', 1, 'v38 OpenRouter-ID bleibt (Kommentar)'],
    ['id:"ollama"', 1, 'v46 Ollama-ID bleibt (Kommentar)'],
    ['https://openrouter.ai/api/v1', 1, 'v38 Basis bleibt (Kommentar)'],
    ['http://localhost:11434/v1', 1, 'v46 Basis bleibt (Kommentar)'],
    ['openai/gpt-6.1-sol', 1, 'v38 Slug bleibt (Kommentar)'],
    // Kette intakt.
    ['v53-primary', 5, 'v53 Primary-Marker unberuehrt'],
    ["{{t('understood')}}", 1, 'Onboarding-Button bleibt'],
  ];
  for (const [sub, want, label] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + label + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('Wähle ein Modell oder generiere'), 'Onboarding de neutral fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v54 Erklaervideo + TEMP-DEAKTIVIERT)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v54: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v53 (Redesign-Port)',
    standalone: 'v54-erklaervideo-temp-deaktiviert',
    quelle: 'Eigentuemer 04.11.2026 (Welcome-Dialog + Provider TEMP aus)',
    fixes: [
      'V1 Erklaervideo-Popup: Button + Dialog + Video je UI-Sprache (../docs/erklaervideo-{de,en,es,fr}-180.mp4), Close/Esc/Backdrop, I18N de/en/es/fr',
      'D1 TEMP-DEAKTIVIERT: genProviders OpenRouter/Ollama auskommentiert (Text bleibt, v38/v46-Zaehler gruen)',
    ],
    counts: { zeichen: s.length, v54Stempel: cnt(s, STAMP) },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v54: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v50'), 'kein v50-Stempel (falsche Basis)');
must(s.includes('standalone-build v51 (Logo-V2 header links)'), 'kein v51-Stempel (falsche Basis)');
must(s.includes('standalone-build v52'), 'kein v52-Stempel (falsche Basis)');
must(s.includes('standalone-build v53'), 'kein v53-Stempel (falsche Basis)');
if (s.includes(STAMP)) {
  checkInvariants(s);
  console.log('build-v54: bereits v54 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- V1a: Video-Button im Onboarding ----------
s = rep1(s,
  '<button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50 v53-primary">{{t(\'understood\')}}</button>',
  '<button type="button" @click="openVideo" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50">{{t(\'videoBtn\')}}</button><button type="button" @click="dismissOnboarding" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50 v53-primary">{{t(\'understood\')}}</button>',
  'V1a Video-Button');
console.log('  V1a: Video-Button im Onboarding');

// ---------- V1b: Popup hinter dem Onboarding-Banner ----------
s = rep1(s,
  "{{t('understood')}}</button>\r\n</div>\r\n</div>\r\n" + '<div class="max-w-[1920px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 p-4">',
  "{{t('understood')}}</button>\r\n</div>\r\n" + '<div v-if="videoOpen" class="v54-video-popup" @click.self="closeVideo">\r\n' + '<div class="v54-video-panel" role="dialog" aria-modal="true" :aria-label="t(\'videoTitle\')">\r\n' + '<h2 class="text-xl font-semibold">{{t(\'videoTitle\')}}</h2>\r\n' + '<video id="erklaervideo54" :src="videoSrc()" controls preload="none" playsinline class="v54-video"></video>\r\n' + '<p class="text-xs">{{t(\'videoMissing\')}}</p>\r\n' + '<button type="button" @click="closeVideo" class="px-5 rounded-xl bg-white text-indigo-700 font-bold min-h-[44px] transition-all hover:bg-indigo-50">{{t(\'videoClose\')}}</button>\r\n' + '</div>\r\n</div>\r\n</div>\r\n' + '<div class="max-w-[1920px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 p-4">',
  'V1b Video-Popup');
console.log('  V1b: Video-Popup (schliessbar, Quelle je UI-Sprache)');

// ---------- V1c: I18N-Keys de/en/es/fr ----------
s = rep1(s,
  'understood:"Verstanden"',
  'understood:"Verstanden",videoBtn:"Erklärvideo",videoTitle:"Erklärvideo",videoClose:"Schließen",videoMissing:"Video fehlt? Lege docs/erklaervideo-{sprache}-180.mp4 ab (de/en/es/fr)."',
  'V1c I18N de');
s = rep1(s,
  'understood:"Got it"',
  'understood:"Got it",videoBtn:"Explainer video",videoTitle:"Explainer video",videoClose:"Close",videoMissing:"Video missing? Add docs/erklaervideo-{sprache}-180.mp4 (de/en/es/fr)."',
  'V1c I18N en');
s = rep1(s,
  'understood:"Entendido"',
  'understood:"Entendido",videoBtn:"Vídeo explicativo",videoTitle:"Vídeo explicativo",videoClose:"Cerrar",videoMissing:"¿Falta el vídeo? Añade docs/erklaervideo-{sprache}-180.mp4 (de/en/es/fr)."',
  'V1c I18N es');
s = rep1(s,
  'understood:"Compris"',
  'understood:"Compris",videoBtn:"Vidéo explicative",videoTitle:"Vidéo explicative",videoClose:"Fermer",videoMissing:"Vidéo manquante ? Ajoute docs/erklaervideo-{sprache}-180.mp4 (de/en/es/fr)."',
  'V1c I18N fr');
console.log('  V1c: I18N-Keys de/en/es/fr');

// ---------- V1d: State + Methoden + Esc ----------
s = rep1(s,
  'search:"",showOnboarding:true,overlayOpen:true',
  'search:"",showOnboarding:true,videoOpen:false,overlayOpen:true',
  'V1d Video-State');
console.log('  V1d: Video-State');
s = rep1(s,
  'dismissOnboarding:function(){this.showOnboarding=false;try{localStorage.setItem("modelmuse.onboarded","1");}catch(e){}},',
  'dismissOnboarding:function(){this.showOnboarding=false;try{localStorage.setItem("modelmuse.onboarded","1");}catch(e){}},openVideo:function(){try{this.videoOpen=true;}catch(eV54){this.videoOpen=true;}},closeVideo:function(){try{var v=document.getElementById("erklaervideo54");if(v){try{v.pause();}catch(eP54){}try{v.removeAttribute("src");v.load();}catch(eL54){}}}catch(eV54b){}try{this.videoOpen=false;}catch(eV54c){}},videoSrc:function(){try{var l=this.lang||"de";}catch(eL54){var l="de";}if(l!=="de"&&l!=="en"&&l!=="es"&&l!=="fr"){l="de";}return "../docs/erklaervideo-"+l+"-180.mp4";},',
  'V1d Video-Methoden');
console.log('  V1d: Video-Methoden (Open/Close/Stopp/Quelle)');
s = rep1(s,
  'onEsc:function(e){if(e&&e.key==="Escape"){this.showOnboarding=false;this.dismissOnboarding();}},',
  'onEsc:function(e){if(e&&e.key==="Escape"){if(this.videoOpen){this.closeVideo();return;}this.showOnboarding=false;this.dismissOnboarding();}},',
  'V1d Escape-Close');
console.log('  V1d: Escape schliesst Video zuerst');

// ---------- D1: genProviders OpenRouter/Ollama auskommentieren (Text bleibt) ----------
s = rep1(s,
  'genProviders:[{id:"baseten-direct",label:"Baseten",kind:"direct",base:"https://inference.baseten.co/v1",models:["meta-models/muse-spark-open-1026"]},{id:"openrouter",label:"OpenRouter",kind:"direct",base:"https://openrouter.ai/api/v1",models:["openai/gpt-6.1-sol","meta/muse-spark-1.3","anthropic/claude-opus-5.5"]},{id:"ollama",label:"Ollama (lokal)",kind:"direct",base:"http://localhost:11434/v1",models:[]},{id:"meta-muse",label:"Meta Muse",kind:"direct",base:"https://api.meta.ai/v1",models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]}]',
  'genProviders:[{id:"baseten-direct",label:"Baseten",kind:"direct",base:"https://inference.baseten.co/v1",models:["meta-models/muse-spark-open-1026"]}/* TEMP-DEAKTIVIERT-v54 (04.11.2026, Revert: Kommentar entfernen — Daten bleiben, keine Auswahl): ,{id:"openrouter",label:"OpenRouter",kind:"direct",base:"https://openrouter.ai/api/v1",models:["openai/gpt-6.1-sol","meta/muse-spark-1.3","anthropic/claude-opus-5.5"]},{id:"ollama",label:"Ollama (lokal)",kind:"direct",base:"http://localhost:11434/v1",models:[]} */,{id:"meta-muse",label:"Meta Muse",kind:"direct",base:"https://api.meta.ai/v1",models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]}]',
  'D1 Provider auskommentiert');
console.log('  D1: OpenRouter/Ollama auskommentiert (keine Auswahl, Daten bleiben)');

// ---------- V1e: Popup-CSS vor </style> ----------
s = rep1(s,
  '@media (prefers-reduced-motion:reduce){#viewport{transition:none}#viewport.v53-switching{opacity:1}}\r\n</style>',
  '@media (prefers-reduced-motion:reduce){#viewport{transition:none}#viewport.v53-switching{opacity:1}}\r\n' + '/* v54-video (Erklaervideo-Popup 04.11.2026: schliessbar, Quelle je UI-Sprache ../docs/erklaervideo-{de,en,es,fr}-180.mp4) */\r\n' + '.v54-video-popup{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6)}\r\n' + '.v54-video-panel{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;color:#16202e;border-radius:14px;padding:16px;display:grid;gap:12px}\r\n' + '.dark .v54-video-panel{background:#151c27;color:#e8edf3}\r\n' + '.v54-video{width:100%;max-height:60vh;border-radius:10px;background:#000}\r\n' + '</style>',
  'V1e Video-CSS');
console.log('  V1e: Video-CSS');

// ---------- S: Stempel v54 in Header-Kette ----------
{
  const anchor = '<!-- standalone-build v53 (Redesign-Port: Token + Type + Kompakt/Branding + Primary + Glas/Crossfade), via scripts/build-standalone-v53.mjs -->';
  must(cnt(s, anchor) === 1, 'S Stempel-Anker fehlt/mehrdeutig');
  s = s.replace(anchor, anchor + ' <!-- ' + STAMP + ', via scripts/build-standalone-v54.mjs -->');
  console.log('  S: Stempel v54');
}

// ---------- S: Stempel + Invarianten + Syntax-Gate ----------
assertInlineScriptsParse(s);
checkInvariants(s);
await writeFile(FILE, s);
console.log(`build-v54: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v54: OK v54 (Erklaervideo + TEMP-DEAKTIVIERT)');
