/**
 * Standalone builder v30 (R0-Call-Reparatur: Computed-Properties als
 * Properties lesen, GitHub-Pages-faehig):
 * Baut auf dem v29-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund (Playwright-Boot 31.10.2026, v29-Artefakt): App mountet nicht,
 * [Vue warn] render <App> + Watchdog 'Kein Start nach 9 s'. Ursache:
 * v26-R0 rief Computed-Properties wie Methoden auf —
 * this.reasoningAllowed(), this.xhighAllowed(), this.reasoningDefault()
 * (alle drei leben im computed-Block: xhighAllowed/reasoningDefault wurden
 * von R0 direkt vor reasoningAllowed in computed eingefuegt). Aufruf eines
 * Computed-Werts (Boolean/String) wirft TypeError; xhighAllowed wird im
 * Template gelesen -> fatal beim ersten Render.
 *
 * Fix (datenseitig, 11 Stellen): Klammern weg — Computed als Properties:
 * F1  this.reasoningAllowed() -> this.reasoningAllowed (x4).
 * F2  this.xhighAllowed() -> this.xhighAllowed (x3).
 * F3  this.reasoningDefault() -> this.reasoningDefault (x4).
 * Template-Bindings (reasoningAllowed||xhighAllowed, :disabled) waren und
 * bleiben Property-Lesungen und stimmen danach mit computed ueberein.
 * Zaehler reasoningAllowed/xhighAllowed/reasoningDefault unveraendert
 * (Substring-Bilanz gleich).
 *
 * Aufruf: node scripts/build-standalone-v30.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v30-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v30: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

/** Syntax-Gate wie v26-v29 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v30-syn-'));
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
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1],
    ['showcase: 5 Modelle', 1], ['__FREE_GUARD_V18__', 1],
    // R0-Calls weg (Computed als Properties), Bilanz unveraendert.
    ['this.reasoningAllowed()', 0], ['this.xhighAllowed()', 0], ['this.reasoningDefault()', 0],
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 5],
    ['genReasoning:"xhigh"', 1],
    // v29-Modelliste unveraendert.
    ['{id:"demo-2d-chart",track', 1], ['{id:"demo-2d-svg"', 0], ['{id:"demo-2d-katex"', 0],
    ['explanations:{de:[', 6], ['diagram2d:{"variant"', 1],
    ['PC-Arbeitsplatz (SI-1)', 0], ['Graphics Card', 0],
    ['de:"Grafikkarte"', 1],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v30 R0-Calls repariert, Modelliste 6)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v30: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v29-modelliste',
    standalone: 'v30',
    befund: [
      'Playwright-Boot: App mountet nicht (TypeError this.reasoningAllowed is not a function im Render via xhighAllowed). v26-R0 rief Computed-Properties wie Methoden auf.',
    ],
    fixes: [
      'F1 this.reasoningAllowed() -> this.reasoningAllowed (x4)',
      'F2 this.xhighAllowed() -> this.xhighAllowed (x3)',
      'F3 this.reasoningDefault() -> this.reasoningDefault (x4)',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v30: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v29'), 'kein v29-Stempel (falsche Basis)');
if (s.includes('standalone-build v30')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v30: bereits v30 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F1-F3: Computed-Calls -> Property-Lesungen ----------
{
  const reps = [
    ['this.reasoningAllowed()', 'this.reasoningAllowed', 4],
    ['this.xhighAllowed()', 'this.xhighAllowed', 3],
    ['this.reasoningDefault()', 'this.reasoningDefault', 4],
  ];
  for (const [oldStr, newStr, want] of reps) {
    must(cnt(s, oldStr) === want, 'Call-Anker ' + oldStr + ': ' + cnt(s, oldStr) + ', erwartet ' + want);
    s = s.split(oldStr).join(newStr);
    console.log('  R0-Fix: ' + oldStr + ' -> ' + newStr + ' (x' + want + ')');
  }
}

{
  const stamp = '<!-- standalone-build v29 (Modelliste 10->6 + Umbenennungen si-1/gpu, via scripts/build-standalone-v29.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v30 (R0-Call-Reparatur: Computed als Properties, via scripts/build-standalone-v30.mjs) -->');
  console.log('  Stempel: v30');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v30: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v30: OK v30 (R0-Calls repariert)');
