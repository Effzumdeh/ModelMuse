/**
 * Standalone builder v27 (2D-Klassifizierer-Feinschliff):
 * Baut auf dem v26-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Smoke-Test 31.10.2026, v26-Artefakt): diagramKind ordnet
 * 'Prozessor' (CPU, 3D) f alsch als mermaid/fluss ein (Substring 'prozess'),
 * 'ERD'/'Erde'-Konflikt ('erd' in 'Erde'), 'Sequenzdiagramm' faellt auf
 * fluss statt sequenz zurueck, Liniendiagramm landet auf Balken statt Linie.
 * Regel: falsch-3D ist sicherer Fallback als falsch-2D (Modell entscheidet
 * dann selbst via is3d) — generische Woerter nur als Ganzwort, Compounds
 * als Substring.
 *
 * R1  Klassifizierer schaerfen (clientseitig, kein LLM-Call):
 *     prozess/fluss/erd/sequenz/linie als Ganzwort- bzw. Compound-Regeln,
 *     Chart-Kind linie/balken je Begriff, ER nur bei ER-Kontext.
 *
 * Aufruf: node scripts/build-standalone-v27.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v27-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v27: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v27-syn-'));
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

const OLD_ER = "if(hasS(['erd','entity','beziehung','kardinalitaet','use-case','anwendungsfall'])||hasW(['er'])){return {v:'mermaid',kind:'er',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";
const NEW_ER = "if(hasS(['erd-diagramm','entity','beziehung','kardinalitaet','use-case','anwendungsfall'])||hasW(['er','erd'])){return {v:'mermaid',kind:'er',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";
const OLD_CHART = "if(hasS(['kennlinie','balkendiagramm','kuchendiagramm','tortendiagramm'])||hasW(['balken','saeule','säule','kuchen','torte','statistik','verlauf'])){return {v:'chart',kind:'balken',exp:'chart',render:'renderChart2D',imp:'2d-chart'};}";
const NEW_CHART = "if(hasS(['kennlinie','balkendiagramm','kuchendiagramm','tortendiagramm','saeulendiagramm','säulendiagramm','liniendiagramm'])||hasW(['balken','saeule','säule','kuchen','torte','statistik','verlauf','linie'])){return {v:'chart',kind:(hasS(['kennlinie','linie','verlauf'])?'linie':'balken'),exp:'chart',render:'renderChart2D',imp:'2d-chart'};}";
const OLD_SEQ = "if(hasW(['sequenz'])){return {v:'mermaid',kind:'sequenz',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";
const NEW_SEQ = "if(hasS(['sequenzdiagramm'])||hasW(['sequenz'])){return {v:'mermaid',kind:'sequenz',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";
const OLD_FLUSS = "if(hasS(['diagramm','fluss','ablauf','aktivit','prozess','zustand','entscheidung','mindmap'])){return {v:'mermaid',kind:'fluss',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";
const NEW_FLUSS = "if(hasS(['diagramm','flussdiagramm','ablauf','aktivit','zustand','entscheidung','mindmap'])||hasW(['fluss','prozess'])){return {v:'mermaid',kind:'fluss',exp:'mermaid',render:'renderMermaid2D',imp:'2d-mermaid'};}";

function checkInvariants(s) {
  const inv = [
    ['standalone-build v26', 1],
    ['standalone-build v27', 1],
    ["hasW(['fluss','prozess'])", 1],
    ["hasS(['diagramm','flussdiagramm','ablauf','aktivit','zustand','entscheidung','mindmap'])", 1],
    ["'linie':'balken'", 1],
    ["hasS(['erd-diagramm'", 1],
    ["hasS(['sequenzdiagramm'])||hasW(['sequenz'])", 1],
    ["if(hasS(['diagramm','fluss','ablauf','aktivit','prozess','zustand','entscheidung','mindmap']))", 0],
    ["if(hasS(['erd','entity'", 0],
    ['},,', 0],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v27 Klassifizierer-Feinschliff)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v27: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v26-e0d0m0t0r0b0',
    standalone: 'v27',
    befund: [
      'Smoke-Test v26: Prozessor -> 2D (falsch), ERD/Erde-Konflikt, Sequenzdiagramm -> fluss, Liniendiagramm -> balken.',
      'Regel: falsch-3D ist sicherer Fallback als falsch-2D (Modell entscheidet dann selbst via is3d).',
    ],
    fixes: ['R1 Klassifizierer schaerfen: prozess/fluss/erd/sequenz als Ganzwort- bzw. Compound-Regeln, Chart-Kind linie/balken, ER nur bei ER-Kontext'],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v27: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v26'), 'kein v26-Stempel (falsche Basis)');
if (s.includes('standalone-build v27')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v27: bereits v27 - ok (idempotent, exit 0)');
  process.exit(0);
}

s = rep1(s, OLD_ER, NEW_ER, 'ER-Regel');
s = rep1(s, OLD_CHART, NEW_CHART, 'Chart-Regel');
s = rep1(s, OLD_SEQ, NEW_SEQ, 'Sequenz-Regel');
s = rep1(s, OLD_FLUSS, NEW_FLUSS, 'Fluss-Regel');
console.log('  R1: Klassifizierer geschaerft (Ganzwort/Compound, Chart-Kind, ER-Kontext)');

{
  const stamp = '<!-- standalone-build v26 (E0 Erklaerungen-Prompt + D0 Disclaimer-raus + M0 tolerante Parts + T0 2D-Auto + R0 Reasoning + B0 Stempel, via scripts/build-standalone-v26.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v27 (2D-Klassifizierer-Feinschliff, via scripts/build-standalone-v27.mjs) -->');
  console.log('  Stempel: v27');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v27: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v27: OK v27 (Klassifizierer-Feinschliff)');
