/**
 * Standalone builder v36 (K Startauswahl + Fallback + Geister-Modell):
 * Baut auf dem v35-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Befund: Nach Loeschen der Standardmodelle startet die App
 * im 2D-Fallback ohne Modelle (obwohl eigene da sind), und PC-Arbeitsplatz
 * scheint als Geist weiter zu existieren.
 * Diagnose: mounted loest modelmuse.lab auf, BEVOR restoreFree die eigenen
 * Modelle einhaengt -> Treffer verfehlt -> activeLabId=null -> syncViewer
 * ruft loadLab(null) -> INIT[null] fehlt -> renderFallback2D ohne Labels
 * ('Modell', keine Bauteile). Persistiertes (ggf. geloeschtes) Lab + der
 * gemergte Listenstand werden nie abgeglichen (Geist); Modus (3D/2D) wird
 * nicht persistiert.
 * Gewuenscht: Startauswahl = zuletzt angesehenes Modell im zuletzt
 * genutzten Modus (3D/2D) persistieren; Fallback bei einem Modell = dieses
 * zeigen; 2D-Fallback nur wenn wirklich kein 3D-Modell existiert;
 * Geister-Modell aus gemergter Kuratiert+Persistenz-Liste entfernen
 * (Loeschungen gewinnen immer).
 *
 * Umsetzung datenseitig (keine Request-/Prompt-Aenderung):
 * K1  mounted: nach restoreFree Liste gegen modelmuse.deleted bereinigen,
 *     Startauswahl aufloesen (persistiert -> gueltig; sonst 1-Modell ->
 *     dieses; sonst erstes 3D-Modell; sonst erstes Modell; sonst null +
 *     persistierte Auswahl raeumen), syncViewer, gespeicherten Modus
 *     wiederherstellen (2d nur ueber force2D auf 3D-faehigem Stand).
 * K2  Modus persistieren in syncViewer/to3D/force2D/toggleAnno.
 * K3  deleteLab (Leerfall): persistierte Auswahl raeumen.
 * K4  Stempel v36 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v36.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v36-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v36: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v35 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v36-syn-'));
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
          console.error('build-v36: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v36-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v34', 1], ['standalone-build v35', 1],
    ['standalone-build v36', 1],
    ['showcase: 5 Modelle', (s.includes('standalone-build v56') ? 0 : 1)], ['showcase: 4 Modelle', (s.includes('standalone-build v56') ? 1 : 0)],
    // K: Startauswahl + Fallback + Modus.
    ['modelmuse.mode', 5],
    ['localStorage.removeItem("modelmuse.lab")', 2],
    ['__pick', 8],
    ['__dd.indexOf(this.labs[__pi].id)', 1],
    ['force2D:function', 1], ['this.force2D();', 1],
    // v35-Vertrag bleibt.
    ['enqueueModify', 2], ['pumpGenQueue', 3],
    // v34-Vertrag bleibt.
    // v37-Nachfolger (Tele-Fenster): 3->4.
    ['toggleWinMin(', 4], ['win-dock v34', 1],
    // v33-Vertrag bleibt.
    ['normExp:function', 1], ['mappingNote', 0],
    // v32-Vertrag bleibt.
    ['etaSeconds:function', 1], ['länger als erwartet', 2],
    // v31-Vertrag bleibt.
    ['enqueueGenerate', 2], ['role="dialog"', (s.includes('standalone-build v54') ? 4 : 3)],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v36 Startauswahl + Fallback + Geister-Modell)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v36: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v35-modify-in-derselben-queue',
    standalone: 'v36',
    befund: [
      'Eigentuemer: Nach Loeschen der Standardmodelle startet die App im 2D-Fallback ohne Modelle (eigene vorhanden), PC-Arbeitsplatz als Geist. Diagnose: lab-Aufloesung vor restoreFree, stale IDs, kein Modus persistiert.',
    ],
    fixes: [
      'K1 Startaufloesung nach restoreFree (Loeschungen gewinnen, 1-Modell/3D-zuerst, stale ID raeumen, Modus-Restore)',
      'K2 Modus persistiert (syncViewer/to3D/force2D/toggleAnno)',
      'K3 deleteLab raeumt persistierte Auswahl im Leerfall',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v36: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v35'), 'kein v35-Stempel (falsche Basis)');
if (s.includes('standalone-build v36')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v36: bereits v36 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- K1: Startaufloesung nach restoreFree ----------
s = rep1(s,
  'try{this.restoreFree();}catch(eFree){}try{if(window.innerWidth<1024){this.overlayOpen=false;}}catch(eOw){}',
  'try{this.restoreFree();}catch(eFree){}try{var __dd=[];try{__dd=JSON.parse(localStorage.getItem("modelmuse.deleted")||"[]");}catch(eDD){__dd=[];}if(Object.prototype.toString.call(__dd)==="[object Array]"&&__dd.length){for(var __pi=this.labs.length-1;__pi>=0;__pi--){if(__dd.indexOf(this.labs[__pi].id)>=0){this.labs.splice(__pi,1);}}}var __ok=false;for(var __ri=0;__ri<this.labs.length;__ri++){if(this.labs[__ri].id===this.activeLabId){__ok=true;break;}}if(!__ok){var __pick=null;if(this.labs.length===1){__pick=this.labs[0];}else{for(var __rj=0;__rj<this.labs.length;__rj++){var __L=this.labs[__rj];var __is2=(__L&&(__L.is3d===false||(__L._meta&&__L._meta.is3d===false)));if(!__is2){__pick=__L;break;}}if(!__pick&&this.labs.length){__pick=this.labs[0];}}if(__pick){this.activeLabId=__pick.id;try{localStorage.setItem("modelmuse.lab",__pick.id);}catch(ePS){}}else{this.activeLabId=null;try{localStorage.removeItem("modelmuse.lab");}catch(ePR){}}}try{this.syncViewer();}catch(eSY){}try{var __svm=localStorage.getItem("modelmuse.mode");if(__svm==="2d"&&this.viewerMode==="3d"){this.force2D();}}catch(eSM){}}catch(eRS){}try{if(window.innerWidth<1024){this.overlayOpen=false;}}catch(eOw){}',
  'K1 Startaufloesung');
console.log('  K1: Startaufloesung (Loeschungen gewinnen, Fallback, Modus)');

// ---------- K2: Modus persistieren ----------
s = rep1(s,
  'syncViewer:function(){try{if(window.__viewer&&window.__viewer.loadLab){this.viewerMode=window.__viewer.loadLab(this.activeLabId,this.level)||"3d";',
  'syncViewer:function(){try{if(window.__viewer&&window.__viewer.loadLab){this.viewerMode=window.__viewer.loadLab(this.activeLabId,this.level)||"3d";try{localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eSM0){}',
  'K2 syncViewer');
s = rep1(s,
  'to3D:function(){try{this.viewerMode=window.__viewer.loadLab(this.activeLabId,this.level)||"3d";}catch(e){}},',
  'to3D:function(){try{this.viewerMode=window.__viewer.loadLab(this.activeLabId,this.level)||"3d";try{localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eTM){}}catch(e){}},',
  'K2 to3D');
s = rep1(s,
  'force2D:function(){try{if(window.__viewer&&window.__viewer.force2D){this.viewerMode=window.__viewer.force2D();}}catch(e){}},',
  'force2D:function(){try{if(window.__viewer&&window.__viewer.force2D){this.viewerMode=window.__viewer.force2D();try{localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eFM){}}}catch(e){}},',
  'K2 force2D');
s = rep1(s,
  'try{this.viewerMode=window.__viewer._mode||this.viewerMode;}catch(e3){}',
  'try{this.viewerMode=window.__viewer._mode||this.viewerMode;try{localStorage.setItem("modelmuse.mode",this.viewerMode);}catch(eAM){}}catch(e3){}',
  'K2 toggleAnno');
console.log('  K2: Modus persistiert (syncViewer/to3D/force2D/toggleAnno)');

// ---------- K3: deleteLab raeumt Auswahl ----------
s = rep1(s,
  '}else{this.activeLabId=null;try{this.syncViewer();}catch(e4){}}',
  '}else{this.activeLabId=null;try{localStorage.removeItem("modelmuse.lab");}catch(eDL){}try{this.syncViewer();}catch(e4){}}',
  'K3 deleteLab');
console.log('  K3: deleteLab raeumt Auswahl');

// ---------- K4: Stempel ----------
{
  const stamp = '<!-- standalone-build v35 (Modify in derselben Queue, via scripts/build-standalone-v35.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v36 (Startauswahl + Fallback + Geister-Modell, via scripts/build-standalone-v36.mjs) -->');
  console.log('  Stempel: v36');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v36: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v36: OK v36 (Startauswahl + Fallback + Geister-Modell)');
