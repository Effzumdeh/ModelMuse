/**
 * Standalone builder v34 (I Overlay-Stapelung + Minimieren + Schliessen):
 * Baut auf dem v33-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Befund: Overlays (Generieren, Auftragsqueue (= Gen-Overlay),
 * Bestandteil-Info, Ueberarbeiten) ueberlappen sich (alle unten rechts).
 * Gewuenscht: Stapeln wie Windows-Benachrichtigungen rechts (aeltere
 * rutschen nach oben, uebereinander), je Fenster Minimieren-zu-Bubble
 * und Schliessen-Button.
 *
 * Umsetzung datenseitig (keine Request-/Prompt-Aenderung):
 * I1  Dock-CSS (.win-bar/.win-min/.win-title) in den Head-<style>.
 * I2  Data: winMin {gen,mod,part} (Minimiert-Zustand je Fenster).
 * I3  Methode toggleWinMin(id) vor persistFree.
 * I4  Gen-Fenster: win-min-Klasse + Win-Leiste (Titel/Min/Close).
 *     Close = Stopp + Notiz-Schliessen (cancelGenerate + dismissGenNotice).
 * I5  Mod-Fenster: win-min-Klasse + Win-Leiste (Close = closeModify).
 * I6  Part-Dialog: id + win-min-Klasse + Win-Leiste (Close = closePartInfo).
 * I7  Win-Dock-Skript vor </body>: misst sichtbare Fenster und stapelt
 *     sie rechts (16 px + Luecke), neueste unten, aeltere oben.
 * I8  Stempel v34 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v34.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v34-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v34: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v33 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v34-syn-'));
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
    ['standalone-build v32', 1], ['standalone-build v33', 1],
    ['standalone-build v34', 1],
    ['showcase: 5 Modelle', (s.includes('standalone-build v56') ? 0 : 1)], ['showcase: 4 Modelle', (s.includes('standalone-build v56') ? 1 : 0)],
    // I: Dock-Mechanik.
    // v37-Nachfolger (Tele-Fenster): 3->4, 5->6, 4->5.
    ['toggleWinMin(', 4], ['win-bar', 6], ['win-min', 5],
    ['id="part-info"', 1], ['win-dock v34', 1], ['data-win-first', 4],
    ['cancelGenerate', 3], ['dismissGenNotice', 5],
    ['closePartInfo', 3], ['closeModify', 3],
    ['partInfoTitle', (s.includes('standalone-build v42') ? 7 : 6)],
    // v33-Vertrag bleibt.
    ['mappingNote', 0], ['normExp:function', 1], ['this.normExp(', (s.includes('standalone-build v42') ? 4 : 3)],
    // v32-Vertrag bleibt.
    ['länger als erwartet', 2], ['fertig nach {s} s', 2],
    ['etaSeconds:function', 1],
    // v31-Vertrag bleibt.
    ['enqueueGenerate', 2], ['role="dialog"', (s.includes('standalone-build v54') ? 4 : 3)],
    ['{{genEtaText}}', 1], ['{{modEtaText}}', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v34 Overlay-Stapelung + Minimieren + Schliessen)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v34: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v33-mesh-raus-erklaerungs-haertung',
    standalone: 'v34',
    befund: [
      'Eigentuemer: Overlays (Generieren/Queue, Ueberarbeiten, Bestandteil-Info) ueberlappen (alle unten rechts). Gewuenscht: stapeln wie Windows-Benachrichtigungen, je Fenster Minimieren-zu-Bubble + Schliessen.',
    ],
    fixes: [
      'I1-I3 Dock-CSS + winMin-State + toggleWinMin-Methode',
      'I4-I6 Win-Leisten (Titel/Min/Close) in Gen/Mod/Part-Fenstern',
      'I7 Win-Dock: stapelt sichtbare Fenster rechts (neueste unten)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v34: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v33'), 'kein v33-Stempel (falsche Basis)');
if (s.includes('standalone-build v34')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v34: bereits v34 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- I1: Dock-CSS ----------
s = rep1(s,
  ':focus-visible{outline:3px solid #22d3ee !important;outline-offset:2px;border-radius:8px}',
  ':focus-visible{outline:3px solid #22d3ee !important;outline-offset:2px;border-radius:8px}' +
  '.win-bar{display:flex;align-items:center;gap:.5rem;margin:-.25rem -.25rem .5rem;padding:.15rem .25rem}' +
  '.win-min>:not(.win-bar){display:none!important}' +
  '.win-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:600}',
  'I1 Dock-CSS');
console.log('  I1: Dock-CSS');

// ---------- I2: Data ----------
s = rep1(s,
  'modTotal:0,',
  'modTotal:0,winMin:{gen:false,mod:false,part:false},',
  'I2 Data');
console.log('  I2: Data (winMin)');

// ---------- I3: toggleWinMin vor persistFree ----------
s = rep1(s,
  'persistFree:function(){',
  'toggleWinMin:function(id){try{if(id==="gen"){this.winMin.gen=!this.winMin.gen;}else if(id==="mod"){this.winMin.mod=!this.winMin.mod;}else if(id==="part"){this.winMin.part=!this.winMin.part;}}catch(e){}},' +
  'persistFree:function(){',
  'I3 Methode');
console.log('  I3: toggleWinMin-Methode');

// ---------- I4: Gen-Fenster ----------
s = rep1(s,
  '<div id="gen-status" v-if="genBusy||genNotice"',
  '<div id="gen-status" v-if="genBusy||genNotice" :class="{\'win-min\':winMin.gen}"',
  'I4 Gen-Klasse');
s = rep1(s,
  'aria-live="polite">',
  'aria-live="polite">' +
  '<div class="win-bar"><span class="win-title">{{t(\'generateBtn\')}}</span>' +
  '<button type="button" @click="toggleWinMin(\'gen\')" class="ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">–</button>' +
  '<button type="button" @click="cancelGenerate();dismissGenNotice();" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm">×</button></div>',
  'I4 Gen-Leiste');
console.log('  I4: Gen-Fenster (Leiste + Minimieren + Schliessen)');

// ---------- I5: Mod-Fenster ----------
s = rep1(s,
  'v-if="modOverlay" id="mod-status"',
  'v-if="modOverlay" id="mod-status" :class="{\'win-min\':winMin.mod}"',
  'I5 Mod-Klasse');
s = rep1(s,
  ':aria-label="t(\'modifyTitle\')">',
  ':aria-label="t(\'modifyTitle\')">' +
  '<div class="win-bar"><span class="win-title">{{t(\'modifyTitle\')}}</span>' +
  '<button type="button" @click="toggleWinMin(\'mod\')" class="ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">–</button>' +
  '<button type="button" @click="closeModify" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm">×</button></div>',
  'I5 Mod-Leiste');
console.log('  I5: Mod-Fenster (Leiste + Minimieren + Schliessen)');

// ---------- I6: Part-Dialog ----------
s = rep1(s,
  'v-if="partInfoIndex!==null"',
  'v-if="partInfoIndex!==null" id="part-info" :class="{\'win-min\':winMin.part}"',
  'I6 Part-ID/Klasse');
s = rep1(s,
  ':aria-label="t(\'partInfoTitle\')">',
  ':aria-label="t(\'partInfoTitle\')">' +
  '<div class="win-bar"><span class="win-title">{{t(\'partInfoTitle\')}}</span>' +
  '<button type="button" @click="toggleWinMin(\'part\')" class="ml-auto inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm font-bold">–</button>' +
  '<button type="button" @click="closePartInfo" class="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 min-h-[44px] min-w-[44px] text-sm">×</button></div>',
  'I6 Part-Leiste');
console.log('  I6: Part-Dialog (Leiste + Minimieren + Schliessen)');

// ---------- I7: Win-Dock-Skript ----------
s = rep1(s,
  '</body>',
  '<script>/* win-dock v34: stapelt Gen/Mod/Part-Fenster rechts, neueste unten */setInterval(function(){try{var ids=["gen-status","mod-status","part-info"];var now=Date.now();var ws=[];for(var k=0;k<ids.length;k++){var el=document.getElementById(ids[k]);if(!el)continue;var r=el.getBoundingClientRect();if(r.width===0&&r.height===0)continue;if(!el.getAttribute("data-win-first"))el.setAttribute("data-win-first",String(now+k));ws.push(el);}ws.sort(function(a,b){return Number(b.getAttribute("data-win-first"))-Number(a.getAttribute("data-win-first"));});var y=16,gap=12;for(var w=0;w<ws.length;w++){ws[w].style.bottom=y+"px";try{y+=ws[w].offsetHeight+gap;}catch(eH){y+=160;}}}catch(e){}},400);</script></body>',
  'I7 Dock');
console.log('  I7: Win-Dock-Skript');

// ---------- I8: Stempel ----------
{
  const stamp = '<!-- standalone-build v33 (Mesh-Text raus + Erklaerungs-Haertung, via scripts/build-standalone-v33.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v34 (Overlay-Stapelung + Minimieren + Schliessen, via scripts/build-standalone-v34.mjs) -->');
  console.log('  Stempel: v34');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v34: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v34: OK v34 (Overlay-Stapelung + Minimieren + Schliessen)');
