/**
 * Standalone builder v28 (2D-Klassifizierer: Bindestrich-Woerter als Ganzwoerter):
 * Baut auf dem v27-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Test 31.10.2026): 'pq-Formel' bleibt 3D — hasW sucht ' formel '
 * mit Leerzeichen, im Bindestrich-Kompositum steht davor '-'.
 * Fix: Padding trennt zusaetzlich an '-' (split/join, kein Regex).
 * hasS-Compounds ('use-case', 'erd-diagramm') arbeiten weiter auf dem
 * Originalterm mit Bindestrich. Regel bleibt: falsch-3D ist sicherer
 * Fallback als falsch-2D.
 *
 * Aufruf: node scripts/build-standalone-v28.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v28-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v28: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26/v27 (iterativ). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v28-syn-'));
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

const OLD_PAD = "diagramKind:function(term){var t=String(term||'').toLowerCase();var pad=' '+t+' ';";
const NEW_PAD = "diagramKind:function(term){var t=String(term||'').toLowerCase();var pad=(' '+t+' ').split('-').join(' ');";

function checkInvariants(s) {
  const inv = [
    ['standalone-build v27', 1],
    ['standalone-build v28', 1],
    ["var pad=(' '+t+' ').split('-').join(' ');", 1],
    ["var pad=' '+t+' ';", 0],
    ['},,', 0],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v28 Bindestrich-Padding)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v28: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v27-klassifizierer-feinschliff',
    standalone: 'v28',
    befund: ['pq-Formel bleibt 3D: hasW findet Ganzwoerter nur an Leerzeichen, nicht an Bindestrichen.'],
    fixes: ['R1 Padding trennt zusaetzlich an Bindestrichen (split/join); Compounds weiter auf Originalterm'],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v28: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v27'), 'kein v27-Stempel (falsche Basis)');
if (s.includes('standalone-build v28')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v28: bereits v28 - ok (idempotent, exit 0)');
  process.exit(0);
}

s = rep1(s, OLD_PAD, NEW_PAD, 'Bindestrich-Padding');
console.log('  R1: Padding trennt an Bindestrichen');

{
  const stamp = '<!-- standalone-build v27 (2D-Klassifizierer-Feinschliff, via scripts/build-standalone-v27.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v28 (2D-Klassifizierer Bindestrich-Padding, via scripts/build-standalone-v28.mjs) -->');
  console.log('  Stempel: v28');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v28: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v28: OK v28 (Bindestrich-Padding)');
