/**
 * Standalone builder v39 (K Kosten-/Dauer-Schaetzung unter Modellauswahl):
 * baut auf dem v38-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Eigentuemer-Vorgabe (31.10.2026):
 * 1) Anzeige aktualisiert sich mit Provider-/Modellauswahl: Dauer aus der
 *    ETA-Tabelle (etaSeconds, unveraendert), Preis aus hinterlegten
 *    Telemetrie-Mittelwerten je Modell, Hinweis 'Schaetzung aus Telemetrie'
 *    in de/en/es. Reaktiv: Methode nutzt genModel/genProvider/genReasoning/
 *    lang, Template-Binding {{estimateText}} direkt unter der
 *    Provider-/Modell-Zeile.
 *
 * Telemetrie-Mittelwerte (Eigentuemer, Stand 31.10.2026):
 *  - muse-spark-1.3-contributor: ~0,6 ct
 *  - muse-spark-1.3: ~16,5 ct
 *  - muse-wonder-1.0: ~78 ct
 *  - openai/gpt-6.1-sol: ~39 ct
 *  - anthropic/claude-opus-5.5 + baseten muse-spark-open-1026: unvermessen
 *    (-> Preis '–', Dauer weiter aus ETA-Tabelle = 240 s).
 * Dauer-Spalte der Schaetzung = etaSeconds() (neue Modelle 240 s, v38 robust).
 *
 * Umsetzung (keine Request-/Prompt-Aenderung):
 * K1  I18N genEstimate x de/en/es (Template {d} Dauer-s + {p} Preis).
 * K2  Methoden estimatePrice (Telemetrie-Tabelle, Vendor-Prefix/:suffix
 *     gestrippt, contributor zuerst) + estimateText (etaSeconds + Preis).
 * K3  Template <p id="gen-estimate">{{estimateText}}</p> nach Generieren-
 *     Button (gleiche Zeile, w-full -> eigene Zeile unter Auswahl).
 * K4  Stempel v39 + Invarianten + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v39.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v39-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v39: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

/** Syntax-Gate wie v26-v38 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v39-syn-'));
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
          console.error('build-v39: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v39-inline-' + n + '.js')); } catch {}
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
    ['standalone-build v37', 1], ['standalone-build v38', 1], ['standalone-build v39', 1],
    // O: OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:\"openrouter\"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    ['directHeaders:function', 1], ['headers:this.directHeaders()', 6],
    ['modelmuse-key-openrouter', 3],
    ['keyMissingOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)], ['keyInvalidOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)], ['keyFormatOpenrouter', (s.includes('standalone-build v42') ? 5 : 4)],
    ["{{t('teleThanks')}}", 1], ['teleThanksTimer', 10], ['teleIssueShow', 6],
    // E: ETA-Tabelle robust + Queue entdoppelt (unveraendert).
    ['indexOf(\"wonder\")', 1],
    ['if(pv&&hi&&(low===\"\"||low===\"auto\"||low===\"standard\")){return 240;}return 60;}', 1],
    ['if(st===\"jobDone\"){return \"\";}', 1],
    ['Platz {n}\"', 1], ['Slot {n}\"', 1], ['Puesto {n}\"', 1],
    // T: Telemetrie-UX intakt.
    ['teleStars>=n', 1], ['{{teleBlock()}}', 0],
    // K: Kosten-/Dauer-Schaetzung (neu).
    ['id=\"gen-estimate\"', 1], ['{{estimateText}}', 1],
    ['estimatePrice:function', 1], ['estimateText:function', 1],
    ['genEstimate', (s.includes('standalone-build v42') ? 6 : 5)],
    ['ct=0.6', 1], ['ct=78', 1], ['ct=39', 1], ['ct=16.5', 1],
    ['includes("open")', 1],
    ['this.estimatePrice()', 1], ['I18N[L]&&I18N[L].genEstimate', 1],
    ['p=this.estimatePrice()', 1], ['d=this.etaSeconds()', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante \"' + sub + '\": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('Schätzung aus Telemetrie'), 'I18N de Hinweis fehlt');
  must(s.includes('Estimate from telemetry'), 'I18N en Hinweis fehlt');
  must(s.includes('Estimaci'), 'I18N es Hinweis fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v39 Schaetzung: ETA-Dauer + Telemetrie-Preis de/en/es)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v39: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v38-openrouter-eta-queue-telemetrie',
    standalone: 'v39',
    befund: [
      'Eigentuemer: Kosten-/Dauer-Schaetzung unter Modellauswahl (Dauer aus ETA-Tabelle, Preis aus Telemetrie-Mittelwerten, Hinweis de/en/es).',
      'Telemetrie-Mittelwerte: contributor ~0,6 ct; 1.3 ~16,5 ct; wonder ~78 ct; gpt-6.1-sol ~39 ct; opus-5.5 + spark-open-1026 unvermessen (–). Dauer je Modell aus etaSeconds (Default 240 s).',
    ],
    fixes: [
      'K1 I18N genEstimate de/en/es ({d} s + {p} + Telemetrie-Hinweis)',
      'K2 estimatePrice (Telemetrie-Tabelle) + estimateText (etaSeconds + Preis)',
      'K3 Template #gen-estimate unter Provider-/Modell-Zeile (reaktiv)',
      'K4 Stempel v39 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v39: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v38'), 'kein v38-Stempel (falsche Basis)');
/** K2m: open-Zweig nachziehen (spark-open-1026 unvermessen wie opus-5.5). */
function migrateOpenBranch(html) {
  const oldP = 'else if(m.includes("opus")){ct=null;}else if(m.includes("gpt")';
  const newP = 'else if(m.includes("opus")){ct=null;}else if(m.includes("open")){ct=null;}else if(m.includes("gpt")';
  if (html.indexOf(newP) >= 0) return { s: html, did: false };
  must(html.indexOf(oldP) >= 0, 'K2m: Preis-Anker fehlt/mehrdeutig');
  return { s: html.replace(oldP, newP), did: true };
}

if (s.includes('standalone-build v39')) {
  const mig = migrateOpenBranch(s);
  s = mig.s;
  if (mig.did) {
    await writeFile(FILE, s);
    console.log('  K2m: open-Zweig nachgezogen (spark-open unvermessen -> –)');
  }
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v39: bereits v39 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- K1: I18N genEstimate de/en/es ----------
s = rep1(s,
  'I18N.de.modEtaLong=\"ca. 4 Minuten · noch {s} s\";',
  'I18N.de.modEtaLong=\"ca. 4 Minuten · noch {s} s\";I18N.de.genEstimate=\"ca. {d} s · ~{p} (Schätzung aus Telemetrie)\";',
  'K1 I18N de');
s = rep1(s,
  'I18N.en.modEtaLong=\"about 4 minutes · {s} s left\";',
  'I18N.en.modEtaLong=\"about 4 minutes · {s} s left\";I18N.en.genEstimate=\"approx. {d} s · ~{p} (Estimate from telemetry)\";',
  'K1 I18N en');
s = rep1(s,
  'modEtaLong:\"aprox. 4 minutos \\u00b7 quedan {s} s\"',
  'modEtaLong:\"aprox. 4 minutos \\u00b7 quedan {s} s\",genEstimate:\"aprox. {d} s \\u00b7 ~{p} (Estimaci\\u00f3n de telemetr\\u00eda)\"',
  'K1 I18N es');
console.log('  K1: I18N genEstimate de/en/es');

// ---------- K2: Methoden estimatePrice + estimateText ----------
s = rep1(s,
  '},genEtaText:function',
  '},estimatePrice:function(){var m=\"\";try{m=String(this.genModel||\"\").toLowerCase();}catch(e){m=\"\";}var sl=m.lastIndexOf(\"/\");if(sl>=0){m=m.slice(sl+1);}var co=m.indexOf(\":\");if(co>=0){m=m.slice(0,co);}var ct=null;if(m.includes(\"contributor\")){ct=0.6;}else if(m.includes(\"wonder\")){ct=78;}else if(m.includes(\"opus\")){ct=null;}else if(m.includes(\"open\")){ct=null;}else if(m.includes(\"gpt\")||m.includes(\"sol\")||m.includes(\"6.1\")){ct=39;}else if(m.includes(\"1.3\")||m.includes(\"spark\")){ct=16.5;}else{ct=null;}if(ct==null){return \"–\";}var L=\"de\";try{L=this.lang||\"de\";}catch(eL){}var s=String(ct);if(L===\"en\"){return s+\" ct\";}return s.replace(\".\",\",\")+\" ct\";},estimateText:function(){var d=60;try{d=this.etaSeconds();}catch(e){d=60;}var p=\"–\";try{p=this.estimatePrice();}catch(eP){}var L=\"de\";try{L=this.lang||\"de\";}catch(eL){}var tpl=\"\";try{tpl=(I18N[L]&&I18N[L].genEstimate)||I18N.de.genEstimate||\"\";}catch(eT){}return String(tpl).split(\"{d}\").join(String(d)).split(\"{p}\").join(String(p));},genEtaText:function',
  'K2 Methoden');
console.log('  K2: estimatePrice (Telemetrie) + estimateText (ETA-Dauer + Preis)');

// ---------- K3: Template unter Modellauswahl ----------
s = rep1(s,
  '>{{t(\'generateBtn\')}}</button>',
  '>{{t(\'generateBtn\')}}</button><p id=\"gen-estimate\" class=\"mt-2 w-full text-xs text-slate-500 dark:text-slate-400\">{{estimateText}}</p>',
  'K3 Template');
console.log('  K3: #gen-estimate unter Provider-/Modell-Zeile (reaktiv via genModel/genProvider/lang)');

// ---------- K4: Stempel v39 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v38 (OpenRouter + ETA robust/Entkopplung + Telemetrie-UX + OrthographicCamera, via scripts/build-standalone-v38.mjs) -->';
must(cnt(s, stamp) === 1, 'v38-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v39 (Kosten/Dauer-Schaetzung unter Modellauswahl: ETA-Dauer + Telemetrie-Preis de/en/es, via scripts/build-standalone-v39.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v39: OK v39 (Schaetzung ETA-Dauer + Telemetrie-Preis)');
