/**
 * Standalone builder v33 (G Mesh-Text raus + H Erklaerungs-Haertung):
 * Baut auf dem v32-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Befunde:
 * G) Text 'x von y Meshes zugeordnet' im Bestandteile-Overlay ersatzlos
 *    entfernen (de/en/es): Anzeige-Zeile + mappingText-Methode + alle drei
 *    I18N-Keys (mappingNote de/en/es) entfallen.
 * H) Generierte Modelle (z. B. Fussballfeld) zeigen wieder keine
 *    Bauteil-Erklaerungen. Diagnose: Prompt-Forderung existiert
 *    ('Bestandteil-Erklaerungen (Pflicht ... gleiche Anzahl/Reihenfolge
 *    wie parts)'), Guard (registerFree) verwirft nichts — aber
 *    makeFreeLab dropt ALLE Erklaerungen bei Laengen-Mismatch
 *    (expDe=null -> de:[] -> jede Part-Info faellt auf partInfoMissing
 *    zurueck). Lange Antworten (4-Min-Generation) verlieren den
 *    Erklaerungs-Schwanz -> Mismatch -> Totalausfall.
 *    Haertung: Teilerklaerungen tolerant pro Index zuordnen
 *    (normExp-Helper), fehlende als "" markieren (Template zeigt dann
 *    partInfoMissing nur fuer diesen Index).
 *
 * Umsetzung datenseitig (keine Request-/Prompt-Aenderung):
 * G1  Template-Zeile '{{t('mappingNote')}}: {{mappingText()}}' entfernen.
 * G2  mappingText-Methode entfernen.
 * G3  I18N-Keys mappingNote (de/en/es) entfernen.
 * H1  normExp-Helper (tolerant, pro Index, Fallback-Kette en/es->de).
 * H2  expDe/expEn/expEs ueber normExp statt Alles-oder-Nichts.
 * H3  Stempel v33 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v33.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v33-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v33: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v32 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v33-syn-'));
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
    ['standalone-build v31', 1], ['standalone-build v32', 1],
    ['standalone-build v33', 1],
    ['showcase: 5 Modelle', 1],
    // G: Mesh-Text ersatzlos raus (Anzeige + Methode + alle Locales).
    ['mappingNote', 0], ['mappingText', 0], ['Meshes zugeordnet', 0],
    ['Bauteil-Zuordnung', 0], ['Part mapping', 0],
    // H: tolerante Erklaerungs-Zuordnung.
    ['normExp:function', 1], ['this.normExp(', 3],
    ['explanations:{de:expDe||[],en:expEn||[],es:expEs||[]}', 1],
    // v32-Vertrag bleibt.
    ['länger als erwartet', 2], ['fertig nach {s} s', 2],
    ['etaSeconds:function', 1], ['*1000+120000', 2],
    // v31-Vertrag bleibt.
    ['Hab noch einen Moment Geduld.', 2],
    // v31-Vertrag bleibt (v35: zwei Einreihungen teilen eine Pumpe).
    ['enqueueGenerate', 2], ['pumpGenQueue', 3],
    ['{{genEtaText}}', 1], ['{{modEtaText}}', 1],
    ['partExplanations', 2], ['partInfoMissing', 4],
    ['role="dialog"', 2],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v33 Mesh-Text raus + Erklaerungs-Haertung)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v33: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v32-overtime-gesamtzeit-eta-tabelle',
    standalone: 'v33',
    befund: [
      'Eigentuemer: 1) Text "x von y Meshes zugeordnet" im Bestandteile-Overlay ersatzlos entfernen (de/en/es). 2) Fussballfeld ohne Bauteil-Erklaerungen: Prompt-Forderung existiert, Guard verwirft nichts, makeFreeLab dropt alles bei Laengen-Mismatch (lange Antworten) -> tolerant haerten.',
    ],
    fixes: [
      'G1-G3 Anzeige-Zeile + mappingText-Methode + mappingNote-Keys (de/en/es) entfernt',
      'H1-H2 normExp-Helper: Teilerklaerungen pro Index, fehlende als "" (Fallback-Kette en/es->de)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v33: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v32'), 'kein v32-Stempel (falsche Basis)');
if (s.includes('standalone-build v33')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v33: bereits v33 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- G1: Anzeige-Zeile entfernen ----------
s = rep1(s,
  '<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{t(\'mappingNote\')}}: {{mappingText()}}</p>',
  '',
  'G1 Anzeige-Zeile');
console.log('  G1: Anzeige-Zeile entfernt');

// ---------- G2: mappingText-Methode entfernen ----------
s = rep1(s,
  'mappingText:function(){try{var m=window.__viewer&&window.__viewer._mappingInfo;if(!m||!m.total){return "–";}return m.assigned+" von "+m.total+" Meshes zugeordnet";}catch(e){return "–";}},\r\nisPartHidden',
  'isPartHidden',
  'G2 Methode');
console.log('  G2: mappingText-Methode entfernt');

// ---------- G3: I18N-Keys entfernen (de/en/es) ----------
s = rep1(s, 'I18N.de.mappingNote="Bauteil-Zuordnung";', '', 'G3 de-Key');
s = rep1(s, 'I18N.en.mappingNote="Part mapping";', '', 'G3 en-Key');
s = rep1(s, 'mappingNote:"Asignaci\\u00f3n de piezas",', '', 'G3 es-Key');
console.log('  G3: mappingNote-Keys (de/en/es) entfernt');

// ---------- H1: normExp-Helper vor persistFree ----------
s = rep1(s,
  'persistFree:function(){',
  'normExp:function(arr,n,fb){var o=[];try{var m=(typeof n==="number"&&n>0)?n:0;for(var k=0;k<m;k++){var v="";try{if(arr&&typeof arr.length==="number"&&k<arr.length&&arr[k]!=null){v=String(arr[k]).trim();}}catch(eV){v="";}if(!v&&fb&&typeof fb.length==="number"&&k<fb.length&&fb[k]!=null){try{v=String(fb[k]);}catch(eF){v="";}}o.push(v);}}catch(e){}return o;},' +
  'persistFree:function(){',
  'H1 normExp');
console.log('  H1: normExp-Helper');

// ---------- H2: tolerante Zuordnung statt Alles-oder-Nichts ----------
s = rep1(s,
  'var expDe=(meta&&Array.isArray(meta.explanations)&&meta.explanations.length===parts.length)?meta.explanations.slice():null;' +
  'var expEn=(metaI18n&&metaI18n.en&&Array.isArray(metaI18n.en.explanations)&&metaI18n.en.explanations.length===parts.length)?metaI18n.en.explanations.slice():(expDe||[]).slice();' +
  'var expEs=(metaI18n&&metaI18n.es&&Array.isArray(metaI18n.es.explanations)&&metaI18n.es.explanations.length===parts.length)?metaI18n.es.explanations.slice():(expDe||[]).slice();',
  'var expDe=this.normExp(meta&&meta.explanations,parts.length,null);' +
  'var expEn=this.normExp(metaI18n&&metaI18n.en&&metaI18n.en.explanations,parts.length,expDe);' +
  'var expEs=this.normExp(metaI18n&&metaI18n.es&&metaI18n.es.explanations,parts.length,expDe);',
  'H2 Zuordnung');
console.log('  H2: tolerante Erklaerungs-Zuordnung');

// ---------- H3: Stempel ----------
{
  const stamp = '<!-- standalone-build v32 (Overtime + Gesamtzeit + ETA-Tabelle, via scripts/build-standalone-v32.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v33 (Mesh-Text raus + Erklaerungs-Haertung, via scripts/build-standalone-v33.mjs) -->');
  console.log('  Stempel: v33');
}

checkInvariants(s);
assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v33: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v33: OK v33 (Mesh-Text raus + Erklaerungs-Haertung)');
