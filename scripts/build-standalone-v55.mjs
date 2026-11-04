/**
 * Standalone builder v55 (Erklaervideo-Pfad Pages-fix, 04.11.2026):
 * Baut auf dem v54-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * P1 Player-Pfad live: v54 setzt starr "../docs/erklaervideo-{lang}-180.mp4".
 *     Auf GitHub Pages (Projektseite, App unter /ModelMuse/) loest der Browser
 *     das zu /docs/... auf (ausserhalb des Repo-Pfads) -> 404, Video startet
 *     nicht. Lokal (file://.../dist-standalone/modelmuse-standalone.html) ist
 *     ../docs/ dagegen korrekt. Beleg: /ModelMuse/docs/*.mp4 -> 200 video/mp4,
 *     /docs/*.mp4 -> 404 (curl, 04.11.2026).
 * P2 videoBase(): Kontext-sensitiver Basispfad — dist-standalone-Vorschau
 *     (Pfad enthaelt dist-standalone/ oder modelmuse-standalone) -> ../docs/,
 *     sonst (Pages: _site/index.html + _site/docs/) -> docs/. Relativ, daher
 *     unabhaengig vom Pages-Subpfad (/ModelMuse/) und Custom-Domains.
 * P3 onVideoError-Fallback (@error="onVideoError"): schlaegt die Primaerquelle
 *     in einem unvorhergesehenen Layout fehl, wird einmalig die Alternativbasis
 *     versucht (videoAlt tauscht ../docs/ <-> docs/); data-v55-alt markiert
 *     den Alternativversuch, closeVideo raeumt die Markierung ab.
 * S  Stempel v55 + Invarianten + Syntax-Gate. v54-Invarianten bleiben
 *     erhalten (CSS-Kommentar + ../docs-Fallback-Literal: '../docs/erklaervideo-'
 *     weiter 2x), Kette v50-v54 intakt.
 *
 * Aufruf: node scripts/build-standalone-v55.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v55-report.json';
const STAMP = 'standalone-build v55 (Erklaervideo-Pfad Pages-fix: videoBase + onVideoError-Fallback)';

function must(cond, msg) {
  if (!cond) { console.error('build-v55: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v54 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v55-syn-'));
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
          console.error('build-v55: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v55-inline-' + n + '.js')); } catch {}
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
  const is55 = s.includes(STAMP);
  must(is55, 'v55-Stempel fehlt');
  const inv = [
    [STAMP, 1, 'v55-Stempel'],
    ['standalone-build v50', 1, 'Kette v50'],
    ['standalone-build v51 (Logo-V2 header links)', 1, 'Kette v51'],
    ['standalone-build v52', 1, 'Kette v52'],
    ['standalone-build v53', 1, 'Kette v53'],
    ['standalone-build v54', 1, 'Kette v54'],
    // P2/P3 neue Pfadlogik.
    ['videoBase:function', 1, 'videoBase-Methode'],
    ['videoFile:function', 1, 'videoFile-Methode'],
    ['videoAlt:function', 1, 'videoAlt-Methode'],
    ['onVideoError:function', 1, 'onVideoError-Methode'],
    ['@error="onVideoError"', 1, 'Video-Error-Fallback im Template'],
    ['data-v55-alt', 3, 'Alternativ-Markierung (Get + Set + Close-Cleanup)'],
    ['return "docs/";', 1, 'Pages-Basis docs/'],
    ['return "../docs/";', 1, 'Lokal-Basis ../docs/'],
    ['"docs/"+v.slice(8)', 1, 'Alternativweg ../docs/ -> docs/'],
    ['"../"+v', 1, 'Alternativweg docs/ -> ../docs/'],
    // v54-Invarianten bleiben (Dual-Pfad absichtlich dokumentiert).
    ['../docs/erklaervideo-', 2, 'Video-Pfad (CSS-Kommentar + Fallback-Literal)'],
    ['videoSrc:function', 1, 'Video-Quelle'],
    ['id="erklaervideo54"', 1, 'Video-Element'],
    ['v54-video-popup', 2, 'v54 Popup-Marker (CSS + Template)'],
    ['v-if="videoOpen"', 1, 'Popup-Template'],
    ['videoBtn:', 4, 'I18N videoBtn de/en/es/fr'],
    ['TEMP-DEAKTIVIERT-v54', 1, 'Deaktivierungs-Kommentar'],
    ['v53-primary', 5, 'v53 Primary-Marker unberuehrt'],
  ];
  for (const [sub, want, label] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + label + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('"../docs/erklaervideo-"+l+"-180.mp4"'), 'Fallback-Literal fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v55 Pfad-fix + Kette v50-v54)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v55: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v54 (Erklaervideo-Popup + TEMP-DEAKTIVIERT)',
    standalone: 'v55-erklaervideo-pfad-pages-fix',
    quelle: 'Live-Diagnose 04.11.2026 (Player fragte /docs/ statt /ModelMuse/docs/ -> 404)',
    fixes: [
      'P2 videoBase(): dist-standalone-Vorschau -> ../docs/, Pages (_site) -> docs/ (relativ, subpfad-unabhaengig)',
      'P3 onVideoError-Fallback: einmaliger Alternativversuch ../docs/ <-> docs/ bei Video-Error',
    ],
    counts: { zeichen: s.length, v55Stempel: cnt(s, STAMP) },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v55: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v50'), 'kein v50-Stempel (falsche Basis)');
must(s.includes('standalone-build v54'), 'kein v54-Stempel (falsche Basis)');
if (s.includes(STAMP)) {
  checkInvariants(s);
  console.log('build-v55: bereits v55 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- P3a: Error-Fallback im Video-Template ----------
s = rep1(s,
  '<video id="erklaervideo54" :src="videoSrc()" controls preload="none" playsinline class="v54-video">',
  '<video id="erklaervideo54" :src="videoSrc()" @error="onVideoError" controls preload="none" playsinline class="v54-video">',
  'P3a Video-Error-Fallback');
console.log('  P3a: @error-Fallback im Video-Template');

// ---------- P2/P3b: Kontext-Basis + Alternativquelle statt starrer ../docs/-Quelle ----------
s = rep1(s,
  'videoSrc:function(){try{var l=this.lang||"de";}catch(eL54){var l="de";}if(l!=="de"&&l!=="en"&&l!=="es"&&l!=="fr"){l="de";}return "../docs/erklaervideo-"+l+"-180.mp4";},',
  'videoBase:function(){try{var p=String((location&&location.pathname)||"");if(p.indexOf("dist-standalone/")>=0||p.indexOf("modelmuse-standalone")>=0){return "../docs/";}}catch(eB55){}return "docs/";},videoFile:function(l){if(l!=="de"&&l!=="en"&&l!=="es"&&l!=="fr"){l="de";}return "erklaervideo-"+l+"-180.mp4";},videoSrc:function(){try{var l=this.lang||"de";}catch(eL54){var l="de";}if(l!=="de"&&l!=="en"&&l!=="es"&&l!=="fr"){l="de";}try{return this.videoBase()+this.videoFile(l);}catch(eS55){return "../docs/erklaervideo-"+l+"-180.mp4";}},videoAlt:function(src){try{var v=String(src||"");if(v.indexOf("../docs/")==0){return "docs/"+v.slice(8);}if(v.indexOf("docs/")==0){return "../"+v;}}catch(eA55){}return "";},onVideoError:function(e){try{var t=(e&&e.target)||document.getElementById("erklaervideo54");if(!t||t.getAttribute("data-v55-alt")){return;}var c=t.getAttribute("src")||"";var a=this.videoAlt(c);if(a){t.setAttribute("data-v55-alt","1");t.src=a;}}catch(eE55){}},',
  'P2 Pfadlogik (videoBase/videoFile/videoSrc/videoAlt/onVideoError)');
console.log('  P2: videoBase je Kontext (dist-standalone ../docs/, Pages docs/) + Fallback');

// ---------- P3c: Alternativ-Markierung beim Schliessen raeumen ----------
s = rep1(s,
  'closeVideo:function(){try{var v=document.getElementById("erklaervideo54");if(v){try{v.pause();}catch(eP54){}try{v.removeAttribute("src");v.load();}catch(eL54){}}}catch(eV54b){}try{this.videoOpen=false;}catch(eV54c){}},',
  'closeVideo:function(){try{var v=document.getElementById("erklaervideo54");if(v){try{v.pause();}catch(eP54){}try{v.removeAttribute("src");v.load();}catch(eL54){}try{v.removeAttribute("data-v55-alt");}catch(eD55){}}}catch(eV54b){}try{this.videoOpen=false;}catch(eV54c){}},',
  'P3c Close-Cleanup');
console.log('  P3c: Close raeumt Alternativ-Markierung ab');

// ---------- S: Stempel v55 in Header-Kette ----------
{
  const anchor = '<!-- standalone-build v54 (Erklaervideo-Popup + TEMP-DEAKTIVIERT 2 Provider), via scripts/build-standalone-v54.mjs -->';
  must(cnt(s, anchor) === 1, 'S Stempel-Anker fehlt/mehrdeutig');
  s = s.replace(anchor, anchor + ' <!-- ' + STAMP + ', via scripts/build-standalone-v55.mjs -->');
  console.log('  S: Stempel v55');
}

// ---------- S: Stempel + Invarianten + Syntax-Gate ----------
assertInlineScriptsParse(s);
checkInvariants(s);
await writeFile(FILE, s);
console.log(`build-v55: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v55: OK v55 (Erklaervideo-Pfad Pages-fix)');
