/**
 * Standalone builder v29 (Modelliste 10->6 + Umbenennungen, GitHub-Pages-faehig):
 * Baut auf dem v28-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Vorgabe Eigentuemer 31.10.2026: kuratierte Liste 10 -> 6 Modelle.
 * - RAUS (je inkl. aller Sprachvarianten de/en/es: LABS-Titel/Labels/Tasks/Quiz,
 *   ES-Anreicherung, MEAS, __SOURCES, META-Block mit diagram2d):
 *   demo-2d-svg (Wasserkocher Seitenansicht), demo-2d-mermaid (Photosynthese
 *   Ablauf), demo-2d-d3 (Rechnernetz Sterntopologie), demo-2d-katex (pq-Formel
 *   Loesungen). Behalten: demo-2d-chart (Wirkungsgradvergleich) als einzige
 *   2D-Demo (5x 3D + 1x 2D = 6 kuratierte Modelle).
 * - UMBENENNEN: gpu-example DE-Titel "Graphics Card" -> "Grafikkarte"
 *   (nur DE; en/es unveraendert), si-1 Titel in ALLEN 3 Sprachen zu
 *   "PC-Arbeitsplatz" (Suffix "(SI-1)"/"(SI 1)" weg, inkl. Quiz-Fragen,
 *   ES-Anreicherung, META- und SOURCES-Titel).
 * - Vendor-IIFE (svg/mermaid/chart/d3/katex) + Dispatcher + 2D-Freimodus
 *   bleiben ( chart-Demo + generierte 2D-Modelle brauchen sie).
 *
 * Umsetzung datenseitig (subtraktiv, kein Neuaufbau):
 * R1  Je entfernter Demo-ID: LABS-Eintrag (Klammer-Matching), META-Block,
 *     ES-Eintrag, MEAS-Eintrag, SOURCES-Eintrag entfernen (Komma-Regel:
 *     Folgekomma weg, sonst Vorkomma).
 * R2  Titel-Ersetzungen (replace-all, Anzahlen geprueft).
 * R3  v29-Stempel + Invarianten (6 LABS mit explanations, je 1 diagram2d,
 *     Umbenennungen belegt, Groesse < 600 KB) + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v29.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v29-report.json';

const REMOVE = ['demo-2d-svg', 'demo-2d-mermaid', 'demo-2d-d3', 'demo-2d-katex'];
const KEEP2D = 'demo-2d-chart';

function must(cond, msg) {
  if (!cond) { console.error('build-v29: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

/** Syntax-Gate wie v26/v27/v28 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v29-syn-'));
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

/** String-sicheres Klammer-Matching ab Index von '{' (wie v15). */
function braceEnd(src, openIdx) {
  must(src[openIdx] === '{', 'braceEnd: kein {');
  let i = openIdx + 1; let depth = 1; let q = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null;
    } else if (c === "'" || c === '"' || c === '`') { q = c; }
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  must(depth === 0, 'braceEnd: kein schliessendes } gefunden');
  return i - 1;
}

/** String-sicheres Ende eines "..."-Literals ab Index des Oeffnungs-Anfuehrungszeichens. */
function strEnd(src, quoteIdx) {
  must(src[quoteIdx] === '"', 'strEnd: kein "');
  let i = quoteIdx + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"') return i;
    i += 1;
  }
  must(false, 'strEnd: kein Ende');
}

/**
 * Eintrag [from, to) entfernen (Komma-Regel: Folgekomma inkl. Zeilenumbruch
 * weg, sonst Vorkomma inkl. Zeilenumbruch) — fuer LABS/ES/MEAS/SOURCES.
 */
function cutEntry(s, from, to, label) {
  if (s[to + 1] === ',') {
    let j = to + 2;
    if (s[j] === '\r') j += 1;
    if (s[j] === '\n') j += 1;
    return s.slice(0, from) + s.slice(j);
  }
  let j = from - 1;
  while (j >= 0 && (s[j] === '\n' || s[j] === '\r')) j -= 1;
  must(s[j] === ',', label + ': kein Anschlusskomma');
  return s.slice(0, j) + s.slice(to + 1);
}

/**
 * "id":"Wert"-Eintrag finden; MEAS (kurz, ohne Escapes) vs. SOURCES (Quellcode
 * mit \" / \n-Escapes) teilen sich das Praefix — wantEscape disambiguiert.
 */
function findQuotedValue(s, id, wantEscape, label) {
  const key = '"' + id + '":"';
  const hits = [];
  let search = 0;
  for (;;) {
    const cand = s.indexOf(key, search);
    if (cand < 0) break;
    const vs = cand + key.length - 1;
    const end = strEnd(s, vs);
    const hasEsc = s.slice(vs + 1, end).indexOf('\\') >= 0;
    if (hasEsc === wantEscape) hits.push([cand, end]);
    search = cand + 1;
  }
  must(hits.length === 1, label + '-Eintrag Treffer: ' + hits.length + ', erwartet 1 (' + id + ')');
  return hits[0];
}

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 26], ['OpenRouter', 12],
    ['text/event-stream', 2], ['stream:true', 3],
    ['__FREE_GUARD_V18__', 1], ['__FREE_FENCE_V25__', 1],
    ['showcase: 5 Modelle', 1],
    // Kuratierte Liste: 5x 3D + 1x 2D (chart).
    ['{id:"arch-brandenburger-tor",track', 1], ['{id:"si-1",track', 1],
    ['{id:"chemie-koffein",track', 1], ['{id:"free-handbohrmaschine",track', 1],
    ['{id:"gpu-example",track', 1], ['{id:"demo-2d-chart",track', 1],
    ['{id:"demo-2d-svg"', 0], ['{id:"demo-2d-mermaid"', 0],
    ['{id:"demo-2d-d3"', 0], ['{id:"demo-2d-katex"', 0],
    ["META['demo-2d-chart']", 3], ["META['demo-2d-svg']", 0],
    ["META['demo-2d-mermaid']", 0], ["META['demo-2d-d3']", 0], ["META['demo-2d-katex']", 0],
    ['meta_demo_2d_chart', 2], ['meta_demo_2d_svg', 0],
    ['meta_demo_2d_mermaid', 0], ['meta_demo_2d_d3', 0], ['meta_demo_2d_katex', 0],
    ['"demo-2d-chart":{title', 1], ['"demo-2d-svg":{title', 0],
    ['"demo-2d-mermaid":{title', 0], ['"demo-2d-d3":{title', 0], ['"demo-2d-katex":{title', 0],
    ['"demo-2d-chart":"', 2], ['"demo-2d-svg":"', 0],
    ['"demo-2d-mermaid":"', 0], ['"demo-2d-d3":"', 0], ['"demo-2d-katex":"', 0],
    ['explanations:{de:[', 6],
    ['diagram2d:{"variant"', 1], ['.diagram2d = {"variant"', 1],
    // Umbenennungen: alte Titel weg, neue belegt.
    ['PC-Arbeitsplatz (SI-1)', 0], ['PC workstation (SI-1)', 0], ['Puesto de PC (SI-1)', 0],
    ['Graphics Card', 0],
    ['title:{de:"PC-Arbeitsplatz",en:"PC-Arbeitsplatz",es:"PC-Arbeitsplatz"}', 1],
    ['de:"Grafikkarte"', 1],
    // Vendor-IIFE + Freimodus bleiben (chart-Demo + generierte 2D-Modelle).
    ['__V14SVG', 3], ['__V14MERMAID', 3], ['__V14CHART', 3], ['__V14D3', 3], ['__V14KATEX', 3],
    ['__renderVariant2D', 3],
    // v26-v28 Spotchecks (unveraendert).
    ['diagramKind:function', 1], ['buildFreePrompt2D:function', 1], ['FREIMODUS-2D', 1],
    ['genReasoning:"xhigh"', 1], ['xhighAllowed', 6], ['directHintMeta', 3],
    ['Aufbau wie Standard-Modelle', 2],
    ['Build v26', 1], ['Build v25', 0],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v29 Modelliste 6 + Umbenennungen)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v29: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v28-bindestrich-padding',
    standalone: 'v29',
    befund: [
      'Eigentuemer 31.10.2026: kuratierte Liste 10 -> 6 (4x 2D-Demos raus, 2x umbenennen).',
    ],
    fixes: [
      'R1 4 Demos entfernt (LABS + META + ES + MEAS + SOURCES, je inkl. de/en/es): Wasserkocher Seitenansicht, Photosynthese Ablauf, Rechnernetz Sterntopologie, pq-Formel Loesungen; chart-Demo (Wirkungsgradvergleich) bleibt',
      'R2 si-1-Titel in de/en/es zu PC-Arbeitsplatz (Suffix weg), gpu-DE-Titel Graphics Card zu Grafikkarte (en/es unveraendert)',
      'R3 Stempel + Invarianten (6 LABS mit explanations, je 1 diagram2d, Vendor-IIFE bleiben)',
    ],
    kuratiert: ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example', 'demo-2d-chart'],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v29: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v28'), 'kein v28-Stempel (falsche Basis)');
if (s.includes('standalone-build v29')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v29: bereits v29 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- R1: 4 Demos aus Kuratierten entfernen (LABS/META/ES/MEAS/SOURCES) ----------
for (const id of REMOVE) {
  // LABS-Eintrag (Klammer-Matching).
  {
    const start = s.indexOf('{id:"' + id + '",track');
    must(start >= 0, 'LABS-Eintrag fehlt: ' + id);
    must(cnt(s, '{id:"' + id + '",track') === 1, 'LABS-Eintrag mehrdeutig: ' + id);
    const end = braceEnd(s, start);
    s = cutEntry(s, start, end, 'LABS ' + id);
    console.log('  R1 LABS raus: ' + id);
  }
  // META-Block {var meta_<sid> = ...; META[id]...}.
  {
    const sid = id.replace(/-/g, '_');
    const start = s.indexOf('{var meta_' + sid + ' = ');
    must(start >= 0, 'META-Block fehlt: ' + id);
    must(cnt(s, '{var meta_' + sid + ' = ') === 1, 'META-Block mehrdeutig: ' + id);
    const end = braceEnd(s, start);
    let j = end + 1;
    if (s[j] === '\r') j += 1;
    if (s[j] === '\n') j += 1;
    s = s.slice(0, start) + s.slice(j);
    console.log('  R1 META raus: ' + id);
  }
  // ES-Eintrag "id":{title:...,parts:[...]}.
  {
    const key = '"' + id + '":{';
    const at = s.indexOf(key);
    must(at >= 0, 'ES-Eintrag fehlt: ' + id);
    must(cnt(s, key) === 1, 'ES-Eintrag mehrdeutig: ' + id);
    const open = at + key.length - 1;
    const end = braceEnd(s, open);
    s = cutEntry(s, at, end, 'ES ' + id);
    console.log('  R1 ES raus: ' + id);
  }
  // MEAS-Eintrag "id":"Text" (kurz, ohne Escapes — SOURCES hat Escapes).
  {
    const [from, to] = findQuotedValue(s, id, false, 'MEAS');
    s = cutEntry(s, from, to, 'MEAS ' + id);
    console.log('  R1 MEAS raus: ' + id);
  }
  // SOURCES-Eintrag "id":"<escaped Quellcode>".
  {
    const [from, to] = findQuotedValue(s, id, true, 'SOURCES');
    s = cutEntry(s, from, to, 'SOURCES ' + id);
    console.log('  R1 SOURCES raus: ' + id);
  }
}

// ---------- R2: Umbenennungen (Anzahlen geprueft, replace-all) ----------
{
  const reps = [
    ['PC-Arbeitsplatz (SI-1)', 'PC-Arbeitsplatz', 4],
    ['PC workstation (SI-1)', 'PC-Arbeitsplatz', 4],
    ['Puesto de PC (SI-1)', 'PC-Arbeitsplatz', 5],
    ['Graphics Card', 'Grafikkarte', 4],
  ];
  for (const [oldStr, newStr, want] of reps) {
    must(cnt(s, oldStr) === want, 'Titel-Anker ' + oldStr + ': ' + cnt(s, oldStr) + ', erwartet ' + want);
    s = s.split(oldStr).join(newStr);
    console.log('  R2: ' + oldStr + ' -> ' + newStr + ' (x' + want + ')');
  }
}

// ---------- R3: Stempel + Invarianten + Syntax-Gate ----------
{
  const stamp = '<!-- standalone-build v28 (2D-Klassifizierer Bindestrich-Padding, via scripts/build-standalone-v28.mjs) -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v29 (Modelliste 10->6 + Umbenennungen si-1/gpu, via scripts/build-standalone-v29.mjs) -->');
  console.log('  Stempel: v29');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v29: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v29: OK v29 (Modelliste 10->6 + Umbenennungen)');
