/**
 * Standalone builder v40 (R Modell-spezifische Reasoning-Stufen je
 * OpenRouter-Modell): baut auf dem v39-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Befund: Die Reasoning-Auswahl bot fuer OpenRouter-Modelle faktisch nur
 * Standard + Hoch (xhigh) — max war per reasoningAllowed-Gate auf
 * meta-muse 1.3/wonder beschraenkt. Live-Beleg (GET
 * https://openrouter.ai/api/v1/models, 31.10.2026, 452 Modelle — plus
 * Reasoning-Doku, siehe docs/OPENROUTER-PROVIDER.md):
 * - openai/gpt-6.1-sol: max/xhigh/high/medium/low, Default medium, mandatory
 * - meta/muse-spark-1.3: max/xhigh/high/medium/low/minimal, Default medium, mandatory
 * - anthropic/claude-opus-5.5: max/xhigh/high/medium/low, Default high, mandatory
 * max ist damit fuer alle 3 OpenRouter-Slugs BELEGT (supported_efforts) und
 * wird durchgereicht; reasoning.max_tokens wird nie gesendet
 * (supports_max_tokens fehlt ueberall, Budgets werden nicht weitergeleitet);
 * none nirgends (mandatory -> 400). Meta-/Baseten-Pfade unveraendert
 * (1.3/wonder max, contributor/baseten xhigh — max dort rejected).
 *
 * Umsetzung (keine Request-/Prompt-Aenderung ausser belegtem max):
 * R1  reasoningAllowed (max-Gate) += openrouter — max-Option je Modell nur
 *     enabled wo belegt (openrouter alle 3 + 1.3/wonder); contributor/baseten
 *     bleiben bei Std + xhigh. 400-Fallback unveraendert generisch.
 * R2  reasoningDefault: openrouter bleibt konservativ xhigh (belegter
 *     Default seit v26/v38; max explizit waehlbar) — kein stilles Upgrade.
 * R3  Stempel v40 + Invarianten (alle Alt-Zaehler unveraendert) + Syntax-Gate.
 * ETA/Schaetzung folgen der Stufe reaktiv (etaSeconds liest
 * genReasoning||reasoningDefault, estimateText liest etaSeconds; alle
 * Thinking-Stufen konservativ 240 s bis Messwerte — keine legitimen
 * Laeufe killen, v38-Begruendung).
 *
 * Aufruf: node scripts/build-standalone-v40.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v40-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v40: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v39 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v40-syn-'));
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
          console.error('build-v40: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v40-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v37', 1], ['standalone-build v38', 1],
    ['standalone-build v39', 1], ['standalone-build v40', 1],
    // O: OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    ['directHeaders:function', 1], ['headers:this.directHeaders()', 6],
    // E: ETA-Tabelle robust + reaktiv (unveraendert).
    ['etaSeconds:function', 1],
    ['var hi=(r==="xhigh"||r==="max");', 1],
    ['if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}', 1],
    // K: Kosten-/Dauer-Schaetzung intakt (v39-Nachfolger).
    ['id="gen-estimate"', 1], ['{{estimateText}}', 1],
    ['estimatePrice:function', 1], ['estimateText:function', 1],
    ['genEstimate', 5],
    // Alt-Gates: alle Zaehler unveraendert (nur Gate-Bodies geaendert, keine Literale).
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 6],
    ['reasoning_effort', 10],
    ['reasoning_effort="xhigh"', 2],
    ['genReasoning:"xhigh"', 1],
    ['this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 1],
    // R: max je Modell nur wo belegt (neu; xhighAllowed enthaelt die Form seit v38 O3).
    ['||this.genProvider==="openrouter"', 2],
    ['this.genProvider==="openrouter"?"xhigh":"max"', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v40 max je Modell belegt + Alt-Zaehler unveraendert)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v40: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v39-schaetzung',
    standalone: 'v40',
    befund: [
      'Belegte Reasoning-Stufen je OpenRouter-Modell (live GET /models 31.10.2026, 452 Modelle): gpt-6.1-sol max/xhigh/high/medium/low (Default medium), muse-spark-1.3 +minimal (Default medium), opus-5.5 max/xhigh/high/medium/low (Default high); alle mandatory (kein none), kein supports_max_tokens (kein Budget-Param).',
      'Dropdown: max-Option je Modell nur enabled wo belegt (openrouter alle 3 + meta-muse 1.3/wonder); contributor/baseten bleiben Std + xhigh (max dort rejected); UI-Default weiter xhigh (kein stilles Upgrade); ETA/Schaetzung folgen der Stufe reaktiv; 400-Fallback bleibt.',
    ],
    fixes: [
      'R1 reasoningAllowed-Gate += openrouter (max belegt, supported_efforts 31.10.2026)',
      'R2 reasoningDefault openrouter -> xhigh (konservativ, max explizit)',
      'R3 Stempel v40 + Invarianten (Alt-Zaehler unveraendert) + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v40: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v39'), 'kein v39-Stempel (falsche Basis)');
if (s.includes('standalone-build v40')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v40: bereits v40 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- R1: max-Gate += openrouter (max dort belegt) ----------
s = rep1(s,
  'reasoningAllowed:function(){return this.genProvider==="meta-muse"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0");},',
  'reasoningAllowed:function(){return (this.genProvider==="meta-muse"&&(this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"))||this.genProvider==="openrouter";},',
  'R1 max-Gate');
console.log('  R1: max je Modell nur wo belegt (openrouter alle 3 + 1.3/wonder)');

// ---------- R2: UI-Default openrouter weiter xhigh ----------
s = rep1(s,
  'reasoningDefault:function(){if(this.reasoningAllowed){return "max";}if(this.xhighAllowed){return "xhigh";}return "";},',
  'reasoningDefault:function(){if(this.reasoningAllowed){return this.genProvider==="openrouter"?"xhigh":"max";}if(this.xhighAllowed){return "xhigh";}return "";},',
  'R2 Default');
console.log('  R2: Default openrouter xhigh (kein stilles max-Upgrade)');

// ---------- R3: Stempel v40 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v39 (Kosten/Dauer-Schaetzung unter Modellauswahl: ETA-Dauer + Telemetrie-Preis de/en/es, via scripts/build-standalone-v39.mjs) -->';
must(cnt(s, stamp) === 1, 'v39-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v40 (Modell-spezifische Reasoning-Stufen je OpenRouter-Modell: max nur wo belegt, via scripts/build-standalone-v40.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v40: OK v40 (max je Modell belegt)');
