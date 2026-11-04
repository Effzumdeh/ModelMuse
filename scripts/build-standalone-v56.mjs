/**
 * Standalone builder v56 (Modelliste 6->4, Eigentuemer-Vorgabe):
 * Baut auf dem v55-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Vorgabe Eigentuemer: kuratierte Liste 6 -> 4 Modelle.
 * - RAUS (je inkl. aller Sprachvarianten de/en/es/fr: LABS-Titel/Labels/Tasks/
 *   Quiz, ES-/FR-Anreicherung, MEAS, __SOURCES, META-Block):
 *   si-1 (PC-Arbeitsplatz, 3D) inkl. INIT-Block + meta_i18n_si_1-Konstante,
 *   demo-2d-chart (Wirkungsgradvergleich, 2D-Demo) inkl. diagram2d-Payload.
 *   Behalten: arch-brandenburger-tor, chemie-koffein, free-handbohrmaschine,
 *   gpu-example (4x 3D).
 * - Vendor-IIFE (svg/mermaid/chart/d3/katex) + Dispatcher + 2D-Freemodus
 *   bleiben (generierte 2D-Modelle brauchen sie; Allowlist unveraendert).
 * - force2D-Fallback: Default 'si-1' -> 'gpu-example' (muss kuratiert sein).
 * - Showcase-Marker: 'showcase: 5 Modelle' -> 'showcase: 4 Modelle'.
 *
 * Umsetzung datenseitig (subtraktiv, kein Neuaufbau, Muster v29):
 * R1  Je entfernter ID: LABS-Eintrag (Klammer-Matching), META-Block
 *     ({var meta_<sid>...} bzw. {const meta_<sid>...} inkl. INIT/meta_i18n),
 *     ES-Eintrag (Region var ES bis var FR), FR-Eintrag (ab var FR),
 *     MEAS-Eintrag, SOURCES-Eintrag (Komma-Regel: Folgekomma inkl.
 *     Zeilenumbruch weg, sonst Vorkomma).
 * R2  force2D-Default auf gpu-example (Anzahl geprueft).
 * R3  Showcase-Marker 5 -> 4 (Anzahl geprueft).
 * R4  v56-Stempel + Invarianten (4 LABS mit explanations, kein diagram2d,
 *     Vendor-IIFE bleiben) + Syntax-Gate.
 *
 * Bekannt/toet: Spezialfall `id === "si-1"` im SVG-Export-Code (SI-Track-
 * Abzweig, escaped in String-Literal) bleibt — toter Zweig, kein Modelldatum.
 *
 * Aufruf: node scripts/build-standalone-v56.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v56-report.json';

const REMOVE = ['si-1', 'demo-2d-chart'];
const KEEP = ['arch-brandenburger-tor', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example'];

function must(cond, msg) {
  if (!cond) { console.error('build-v56: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

/** Syntax-Gate wie v26-v29 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v56-syn-'));
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

/** String-sicheres Klammer-Matching ab Index von '{' (wie v15/v29). */
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
 * weg, sonst Vorkomma inkl. Zeilenumbruch) — fuer LABS/ES/FR/MEAS/SOURCES.
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

/** "id":{...}-Eintrag in Region [lo, hi) finden (ES-/FR-Maps teilen Keys). */
function findMapEntry(s, id, lo, hi, label) {
  const key = '"' + id + '":{';
  const hits = [];
  let search = lo;
  for (;;) {
    const at = s.indexOf(key, search);
    if (at < 0 || at >= hi) break;
    hits.push(at);
    search = at + 1;
  }
  must(hits.length === 1, label + '-Eintrag Treffer in Region: ' + hits.length + ', erwartet 1 (' + id + ')');
  const at = hits[0];
  const open = at + key.length - 1;
  const end = braceEnd(s, open);
  must(end < hi, label + '-Eintrag ragt aus Region: ' + id);
  return [at, end];
}

function checkInvariants(s) {
  const v56 = s.includes('standalone-build v56');
  must(v56, 'v56-Stempel fehlt');
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1], ['standalone-build v31', 1], ['standalone-build v32', 1],
    ['standalone-build v33', 1], ['standalone-build v34', 1], ['standalone-build v35', 1],
    ['standalone-build v36', 1], ['standalone-build v56', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', (s.includes('standalone-build v46') ? 29 : (s.includes('standalone-build v42') ? 31 : (s.includes('standalone-build v40') ? 28 : 26)))], ['OpenRouter', (s.includes('standalone-build v42') ? 16 : (s.includes('standalone-build v40') ? 13 : 12))],
    ['text/event-stream', 2], ['stream:true', 3],
    ['__FREE_GUARD_V18__', 1], ['__FREE_FENCE_V25__', 1],
    ['showcase: 4 Modelle', 1], ['showcase: 5 Modelle', 0],
    // Kuratierte Liste: 4x 3D (si-1 + chart raus).
    ['{id:"arch-brandenburger-tor",track', 1], ['{id:"chemie-koffein",track', 1],
    ['{id:"free-handbohrmaschine",track', 1], ['{id:"gpu-example",track', 1],
    ['{id:"si-1",track', 0], ['{id:"demo-2d-chart",track', 0],
    ['{id:"si-1"', 0], ['{id:"demo-2d-chart"', 0],
    ['{id:"demo-2d-svg"', 0], ['{id:"demo-2d-mermaid"', 0],
    ['{id:"demo-2d-d3"', 0], ['{id:"demo-2d-katex"', 0],
    ["META['si-1']", 0], ["META['demo-2d-chart']", 0],
    ["META['demo-2d-svg']", 0], ["META['demo-2d-mermaid']", 0],
    ["META['demo-2d-d3']", 0], ["META['demo-2d-katex']", 0],
    ["INIT['si-1'] = ", 0],
    ['meta_si_1', 0], ['meta_demo_2d_chart', 0],
    ['meta_demo_2d_svg', 0], ['meta_demo_2d_mermaid', 0],
    ['meta_demo_2d_d3', 0], ['meta_demo_2d_katex', 0],
    ['const meta_i18n_si_1 = {', 0],
    ['const meta_i18n_arch_brandenburger_tor = {', 1],
    ['const meta_i18n_chemie_koffein = {', 1],
    ['const meta_i18n_free_handbohrmaschine = {', 1],
    ['const meta_i18n_gpu_example = {', 1],
    ['"si-1":{title', 0], ['"demo-2d-chart":{title', 0],
    ['"demo-2d-svg":{title', 0], ['"demo-2d-mermaid":{title', 0],
    ['"demo-2d-d3":{title', 0], ['"demo-2d-katex":{title', 0],
    ['"si-1":"', 0], ['"demo-2d-chart":"', 0],
    ['"demo-2d-svg":"', 0], ['"demo-2d-mermaid":"', 0],
    ['"demo-2d-d3":"', 0], ['"demo-2d-katex":"', 0],
    ['explanations:{de:[', 4],
    ['diagram2d:{"variant"', 0], ['.diagram2d = {"variant"', 0],
    [',fr:"Poste PC (SI-1)"}', 0], ['"fr":"Comparaison de rendement"}', 0],
    [',fr:"Porte de Brandebourg (Berlin)"}', 1],
    [',fr:"Mol\u00e9cule de caf\u00e9ine"}', 1],
    [',fr:"Perceuse manuelle"}', 1], [',fr:"Carte graphique"}', 1],
    ['Quel composant appartient \u00e0', 4],
    ['Aucun de ceux-ci', 5], ['figure dans la liste.', 5],
    [', fr: { title:', 4],
    // Umbenennungen aus v29 bleiben belegt (gpu-DE-Titel, keine Suffixe).
    ['PC-Arbeitsplatz (SI-1)', 0], ['PC workstation (SI-1)', 0], ['Puesto de PC (SI-1)', 0],
    ['Graphics Card', 0],
    ['title:{de:"PC-Arbeitsplatz",en:"PC-Arbeitsplatz",es:"PC-Arbeitsplatz",fr:"Poste PC (SI-1)"}', 0],
    ['de:"Grafikkarte"', 1],
    // R2/R3: force2D-Default kuratiert, Showcase-Marker 4.
    ["self._currentId || 'gpu-example'", 1],
    ["self._currentId || 'si-1'", 0],
    // Vendor-IIFE + Freemodus bleiben (generierte 2D-Modelle).
    ['__V14SVG', 3], ['__V14MERMAID', 3], ['__V14CHART', 3], ['__V14D3', 3], ['__V14KATEX', 3],
    ['__renderVariant2D', 3],
    ['"2d-svg","2d-mermaid","2d-chart","2d-d3","2d-katex"', 1],
    // v26-v28 Spotchecks (unveraendert).
    ['diagramKind:function', 1], ['buildFreePrompt2D:function', 1], ['FREIMODUS-2D', 1],
    ['genReasoning:"xhigh"', 1], ['xhighAllowed', 6],
    ['Aufbau wie Standard-Modelle', 2],
    ['Build v25', 0],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, 'Invariante ' + sub + ': ' + cnt(s, sub) + ', erwartet ' + want);
  // Beleuchtung: Room-Light/Environment bleiben (Schwelle, SOURCES-Anteil raus).
  must(cnt(s, 'PointLight(0xffffff, 5, 28, 2)') >= 6, 'Room-Light 5: ' + cnt(s, 'PointLight(0xffffff, 5, 28, 2)') + ', erwartet >= 6');
  must(cnt(s, 'scene.environmentIntensity') >= 6, 'environmentIntensity: ' + cnt(s, 'scene.environmentIntensity') + ', erwartet >= 6');
  // Toet, aber dokumentiert: SI-Spezialfall im SVG-Export (escaped String-Literal, kein Modelldatum).
  // Toet, aber dokumentiert: SI-Spezialfall im SVG-Export (RAW-Code, kein Modelldatum).
  must(cnt(s, 'id === "si-1" || id === "si-2" || id === "si-3" || track === "SI"') === 1, 'SI-Spezialfall fehlt');
  must(cnt(s, "'si-1'") === 0, "Rest-'si-1': " + cnt(s, "'si-1'") + ', erwartet 0');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v56 Modelliste 4)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v56: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v55-erklaervideo-pfad',
    standalone: 'v56',
    befund: [
      'Eigentuemer: kuratierte Liste 6 -> 4 (si-1 + demo-2d-chart raus).',
    ],
    fixes: [
      'R1 si-1 + demo-2d-chart entfernt (LABS + META/INIT + ES + FR + MEAS + SOURCES, je inkl. de/en/es/fr)',
      'R2 force2D-Default si-1 -> gpu-example',
      'R3 Showcase-Marker 5 -> 4 Modelle',
      'R4 Stempel + Invarianten (4 LABS mit explanations, kein diagram2d, Vendor-IIFE bleiben)',
    ],
    kuratiert: KEEP,
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v56: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v55'), 'kein v55-Stempel (falsche Basis)');
if (s.includes('standalone-build v56')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v56: bereits v56 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- R1: si-1 + demo-2d-chart aus Kuratierten entfernen ----------
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
  // META-Block: {var meta_<sid> = ...} (2D) bzw. {const meta_<sid> = ...}
  // (3D, inkl. meta_i18n-Konstante + INIT-Funktion + INIT/META-Zuweisungen).
  {
    const sid = id.replace(/-/g, '_');
    const cands = ['{var meta_' + sid + ' = ', '{\r\nconst meta_' + sid + ' = ', '{\nconst meta_' + sid + ' = '];
    const found = cands.map((a) => [a, s.indexOf(a)]).filter(([, at]) => at >= 0);
    must(found.length === 1, 'META-Block Anker Treffer: ' + found.length + ', erwartet 1 (' + id + ')');
    const [anchor, start] = found[0];
    must(cnt(s, anchor) === 1, 'META-Block mehrdeutig: ' + id);
    const end = braceEnd(s, start);
    let j = end + 1;
    if (s[j] === '\r') j += 1;
    if (s[j] === '\n') j += 1;
    s = s.slice(0, start) + s.slice(j);
    console.log('  R1 META raus: ' + id);
  }
  // ES-Eintrag "id":{...} (Region var ES bis var FR; Anker frisch,
  // da vorausgehende Cuts Offsets verschieben).
  {
    const esStart = s.indexOf('var ES={');
    must(esStart >= 0, 'ES-Anker fehlt');
    const frStart = s.indexOf('var FR={');
    must(frStart > esStart, 'FR-Anker fehlt/hinter ES');
    const [from, to] = findMapEntry(s, id, esStart, frStart, 'ES');
    s = cutEntry(s, from, to, 'ES ' + id);
    console.log('  R1 ES raus: ' + id);
  }
  // FR-Eintrag "id":{...} (ab var FR, frisch; Region auf 64k begrenzt, Treffer 1x).
  {
    const frStart = s.indexOf('var FR={');
    must(frStart >= 0, 'FR-Anker fehlt');
    const [from, to] = findMapEntry(s, id, frStart, frStart + 64000, 'FR');
    s = cutEntry(s, from, to, 'FR ' + id);
    console.log('  R1 FR raus: ' + id);
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

// ---------- R2: force2D-Default auf kuratiertes Modell ----------
{
  must(cnt(s, "'si-1'") === 1, 'force2D-Default Anker: ' + cnt(s, "'si-1'") + ', erwartet 1');
  must(s.includes("self._currentId || 'si-1'"), 'force2D-Default Kontext fehlt');
  s = s.split("self._currentId || 'si-1'").join("self._currentId || 'gpu-example'");
  console.log('  R2: force2D-Default si-1 -> gpu-example');
}

// ---------- R3: Showcase-Marker 5 -> 4 ----------
{
  must(cnt(s, 'showcase: 5 Modelle') === 1, 'Showcase-Marker: ' + cnt(s, 'showcase: 5 Modelle') + ', erwartet 1');
  s = s.split('showcase: 5 Modelle').join('showcase: 4 Modelle');
  console.log('  R3: Showcase-Marker 5 -> 4 Modelle');
}

// ---------- R4: Stempel + Invarianten + Syntax-Gate ----------
{
  const stamp = '<!-- standalone-build v55 (Erklaervideo-Pfad Pages-fix: videoBase + onVideoError-Fallback), via scripts/build-standalone-v55.mjs -->';
  must(cnt(s, stamp) === 1, 'Stempel-Anker fehlt');
  s = s.replace(stamp, stamp + ' <!-- standalone-build v56 (Modelliste 6->4: si-1 + demo-2d-chart raus, via scripts/build-standalone-v56.mjs) -->');
  console.log('  Stempel: v56');
}
checkInvariants(s);

assertInlineScriptsParse(s);

await writeFile(FILE, s);
console.log('build-v56: geschrieben (' + s.length + ' Zeichen)');
await writeReport(s);
console.log('build-v56: OK v56 (Modelliste 6->4)');
