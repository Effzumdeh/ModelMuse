/**
 * npm run verify:standalone — static release verification for the
 * standalone artifact (the only release artifact; GitHub Pages-ready; no backend).
 * Checks the BUILT artifact at dist-standalone/modelmuse-standalone.html:
 *  - v13 stamp, title/badges, 12 LABS and 12 META/INIT entries (6 3D, 6 2D metadata)
 *  - no obsolete lighting patterns (900/2048/PCFSoft/envMap/dark room)
 *  - no removed UI elements (objectives/level/learning mode/track/curriculum)
 * - direct endpoints/models for both providers (Baseten + Meta/Muse);
 *   no OpenRouter or local proxy port
 *  - size limit (under 600 KB for GitHub Pages)
 * Exit 0 means every check passed; exit 1 means at least one check failed.
 */
import { readFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const failures = [];
const ok = (message) => console.log(`verify-standalone: OK ${message}`);
const fail = (message) => { failures.push(message); console.error(`verify-standalone: FAIL ${message}`); };

let s = '';
try {
  s = await readFile(FILE, 'utf8');
  ok(`File readable (${s.length} characters)`);
} catch {
  fail('Artifact not found; run npm run build:standalone first.');
  process.exit(1);
}
const cnt = (sub) => s.split(sub).length - 1;
const artifactBytes = Buffer.byteLength(s, 'utf8');
const IDS_ALL = ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine'];
const IDS_V15 = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example',
  'demo-2d-svg', 'demo-2d-mermaid', 'demo-2d-chart', 'demo-2d-d3', 'demo-2d-katex'];

/**
 * v15 Bestandteil-Info: je gebuendeltem LABS-Eintrag explanations de/en/es
 * (Laengen-Deckung zu labels, je Text 8-500 Zeichen), Info-Button/Popup-Marker,
 * Umbenennungen Bestandteil/Component/Componente.
 */
function v15PartInfo(s, fail, ok) {
  const brace = (src, openIdx) => {
    let i = openIdx + 1; let depth = 1; let str = null;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (str) {
        if (c === '\\') { i += 2; continue; }
        if (c === str) str = null;
      } else if (c === "'" || c === '"' || c === '`') { str = c; }
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      i += 1;
    }
    return depth === 0 ? i - 1 : -1;
  };
  const jsonArr = (entry, key) => {
    // Sucht key:[...] (erster Treffer, Keys ggf. gequotet wie "de:") und
    // parst das Array-Literal als JSON.
    let at = entry.indexOf(`${key}[`);
    let adj = key.length;
    if (at < 0) {
      const bare = key.endsWith(':') ? key.slice(0, -1) : key;
      at = entry.indexOf(`"${bare}":[`);
      adj = bare.length + 3;
    }
    if (at < 0) return null;
    let i = at + adj; let depth = 0; let str = null;
    for (; i < entry.length; i += 1) {
      const c = entry[i];
      if (str) {
        if (c === '\\') { i += 1; continue; }
        if (c === str) str = null;
      } else if (c === '"' || c === "'") { str = c; }
      else if (c === '[') depth += 1;
      else if (c === ']') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) return null;
    try {
      const raw = entry.slice(at + adj, i + 1);
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    } catch { return null; }
  };
  for (const id of IDS_V15) {
    const start = s.indexOf(`{id:"${id}",track`);
    if (start < 0) { fail(`v15 LABS entry missing: ${id}`); continue; }
    const end = brace(s, start);
    if (end < 0) { fail(`v15 LABS entry unbalanced: ${id}`); continue; }
    const entry = s.slice(start, end + 1);
    const eOpen = entry.indexOf('explanations:{');
    if (eOpen < 0) { fail(`v15 explanations missing: ${id}`); continue; }
    const eEnd = brace(entry, entry.indexOf('{', eOpen));
    const expBlock = entry.slice(eOpen, eEnd + 1);
    const lOpen = entry.indexOf('labels:{');
    const lEnd = lOpen >= 0 ? brace(entry, entry.indexOf('{', lOpen)) : -1;
    const labBlock = lOpen >= 0 && lEnd >= 0 ? entry.slice(lOpen, lEnd + 1) : '';
    const labels = jsonArr(labBlock, 'de:');
    // labels:{de:[...]}: Laengen-Deckung zu diesem Array.
    const n = Array.isArray(labels) ? labels.length : -1;
    let entryOk = true;
    for (const loc of ['de', 'en', 'es']) {
      const arr = jsonArr(expBlock, `${loc}:`);
      const good = Array.isArray(arr) && arr.length === n && n >= 3
        && arr.every((x) => typeof x === 'string' && x.length >= 8 && x.length <= 500);
      if (!good) { fail(`v15 explanations ${loc} misaligned: ${id} (labels=${n})`); entryOk = false; }
    }
    if (entryOk) ok(`v15 explanations de/en/es: ${id} (${n} je Lokale)`);
  }
  const eqV = (sub, want, label) => {
    const n = s.split(sub).length - 1;
    if (n === want) ok(`${label} = ${n}`);
    else fail(`${label}: ${n}; expected ${want}`);
  };
  eqV('openPartInfo', 2, 'v15 openPartInfo (Template + Methode)');
  eqV('closePartInfo', 2, 'v15 closePartInfo (Template + Methode)');
  eqV('partInfoIndex', 7, 'v15 partInfoIndex (data/reset/open/close/3x Template)');
  eqV('partInfoTitle', 5, 'v15 partInfoTitle (3 I18N + aria + h3)');
  eqV('partInfoAbout', 5, 'v15 partInfoAbout (3 I18N + aria + title)');
  eqV('partExplanations', 2, 'v15a partExplanations (computed + text)');
  eqV('partInfoMissing', 4, 'v15a partInfoMissing (3 I18N + Popup-Fallback)');
  eqV('explanations:{de:[', 10, 'v15 LABS mit explanations');
  eqV('v-if="partInfoIndex!==null"', 1, 'v15 Info-Popup v-if');
  eqV('ⓘ', 1, 'v15 Info-Kreis-i-Button');
  eqV('this.partsHidden=[];this.partInfoIndex=null;', 1, 'v15 selectLab-Reset');
  eqV('partsTitle:"Bestandteile"', 1, 'v15 de-Titel Bestandteil');
  eqV('partsTitle:"Components"', 1, 'v15 en-Titel Component');
  eqV('partsTitle:"Componentes"', 1, 'v15 es-Titel Componente');
  eqV('partsTitle:"Bauteile"', 0, 'v15 kein Bauteil-Titel (de)');
  eqV('partsTitle:"Parts"', 0, 'v15 kein Parts-Titel (en)');
  eqV('partsTitle:"Piezas"', 0, 'v15 kein Piezas-Titel (es)');
  eqV('Nutze die Bauteilliste.', 0, 'v15 keine Bauteilliste-Hints (de)');
  eqV('Use the parts list.', 0, 'v15 keine parts-list-Hints (en)');
  eqV('Usa la lista de piezas.', 0, 'v15 keine piezas-Hints (es)');
  eqV('role="dialog"', 2, 'v15 Dialoge (Modify + Bestandteil-Info)');
}
const labsHits = IDS_ALL.reduce((n, id) => n + cnt(`{id:"${id}"`), 0);
const initHits = IDS_ALL.reduce((n, id) => n + cnt(`INIT['${id}'] = `), 0);
const metaHits = IDS_ALL.reduce((n, id) => n + cnt(`META['${id}']`), 0);
const isEmptyStand = s.includes('const LABS=[];') && s.includes('window.__SOURCES = {};') && labsHits === 0 && initHits === 0;

if (isEmptyStand) {
  // Empty-stand release: no bundled models; BYOK generation remains available.
  console.log('verify-standalone: Empty standalone detected (0 bundled models)');
  const eqE = (sub, want, label) => {
    const n = cnt(sub);
    if (n === want) ok(`${label} = ${n}`);
    else fail(`${label}: ${n}; expected ${want}`);
  };
  eqE('standalone-build v13', 1, 'Build stamp');
  eqE('<title>ModelMuse Modelle v13-standalone (GitHub-Pages)</title>', 1, 'Title');
  eqE('viewerBadge:\"Modelle v13-standalone\"', 1, 'German badge');
  eqE('viewerBadge:\"Models v13-standalone\"', 1, 'English badge');
  eqE('viewerBadge:\"Modelos v13-standalone\"', 1, 'Spanish badge');
  eqE('const LABS=[];', 1, 'Empty LABS array');
  eqE('window.__SOURCES = {};', 1, 'Empty source registry');
  if (metaHits !== 0) fail(`Unexpected META entries: ${metaHits}; expected 0`);
  else ok('META entries = 0');
  eqE('PointLight(0xffffff, 900', 0, 'Room-light intensity 900');
  eqE('0x11141a', 0, 'Dark-room color');
  eqE('envMapIntensity', 0, 'envMapIntensity');
  eqE('mapSize.set(2048', 0, 'Shadow-map size 2048');
  eqE('openrouter', 0, 'OpenRouter lowercase');
  eqE('OpenRouter', 0, 'OpenRouter uppercase');
  eqE('https://inference.baseten.co/v1/chat/completions', 3, 'Baseten endpoint');
  if (cnt('meta-models/muse-spark-open-1026') < 3) fail('Baseten model is missing.');
  else ok('Baseten model: muse-spark-open-1026');
  eqE('openrouter-direct', 0, 'OpenRouter provider ID');
  eqE('modelmuse-proxy-key', 5, 'sessionStorage key name');
  if (s.includes('127.0.0.1:8787') || s.includes('localhost:8787')) fail('Standalone references the local proxy port.');
  else ok('No local proxy port referenced.');
  // M8 UI fixes: system theme default, top-right progress bar gone, pencil next to name.
  if (cnt('prefers-color-scheme') < 3) fail('System theme default (prefers-color-scheme) is missing.');
  else ok(`System theme default: ${cnt('prefers-color-scheme')} references (head init + data + mounted)`);
  eqE('<html lang="de" class="dark">', 0, 'Hardcoded dark html class');
  eqE('<html lang="de">', 1, 'Language html tag without forced theme');
  eqE('theme:"dark"', 0, 'Hardcoded dark data default');
  eqE('min-w-[220px]', 0, 'Top-right progress shell');
  eqE('saveProgress', 0, 'Progress persistence method');
  eqE('modelmuse.progress', 0, 'Progress storage key');
  eqE('gen-progress', 0, 'Progress overlay id/comment');
  eqE('id="gen-status"', 1, 'Generator status overlay');
  eqE('Fortschritt', 0, 'Fortschritt remnants');
  eqE('fortschritt', 0, 'fortschritt remnants (lowercase)');
  eqE('mt-2 w-full inline-flex', 0, 'Pencil button below name');
  eqE('shrink-0 inline-flex items-center justify-center rounded-xl border', 1, 'Pencil button next to name (template)');
  if (artifactBytes > 600000) fail(`Artifact is too large: ${artifactBytes} bytes.`);
  else ok(`Artifact size ${artifactBytes} bytes (under 600 KB for GitHub Pages).`);
  if (!s.includes('empty-stand: 0 Modelle')) fail('Empty-stand marker is missing.');
  else ok('Empty-stand marker is present');
  if (failures.length > 0) {
    console.error(`verify-standalone: ABORT (empty artifact: ${failures.length} failures)`);
    process.exit(1);
  }
  console.log('verify-standalone: OK (empty standalone verified; BYOK generation is available)');
  process.exit(0);
}
const IDS_SHOWCASE = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example'];
const isShowcase = !isEmptyStand && IDS_SHOWCASE.every((id) => cnt(`{id:"${id}"`) >= 1) && cnt(`INIT['arch-brandenburger-tor'] = `) === 1;

if (isShowcase) {
  // Showcase release: 5 3D-Erststart-Defaults (je Domaene 1, Harness-gruen).
  console.log('verify-standalone: Showcase detected (5 3D-Erststart-Defaults)');
  const eqS = (sub, want, label) => {
    const n = cnt(sub);
    if (n === want) ok(`${label} = ${n}`);
    else fail(`${label}: ${n}; expected ${want}`);
  };
  eqS('standalone-build v13', 1, 'Build stamp');
  eqS('<title>ModelMuse Modelle v13-standalone (GitHub-Pages)</title>', 1, 'Title');
  eqS('viewerBadge:"Modelle v13-standalone"', 1, 'German badge');
  eqS('viewerBadge:"Models v13-standalone"', 1, 'English badge');
  eqS('viewerBadge:"Modelos v13-standalone"', 1, 'Spanish badge');
  for (const id of IDS_SHOWCASE) {
    if (cnt(`{id:"${id}"`) < 1) fail(`LABS entry missing: ${id}`);
    if (cnt(`META['${id}']`) < 1) fail(`META entry missing: ${id}`);
    if (cnt(`INIT['${id}'] = `) !== 1) fail(`3D init missing/ambiguous: ${id}`);
  }
  ok('5 LABS + 5 META + 5 3D-INIT entries found');
  for (const id of ['si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3']) {
    if (cnt(`INIT['${id}'] = `) !== 0) fail(`Non-showcase init present: ${id}`);
  }
  ok('INIT entries: 5 3D-Showcase, keine Fremd-INITs');
  eqS('PointLight(0xffffff, 900', 0, 'Room-light intensity 900');
  eqS('0x11141a', 0, 'Dark-room color');
  eqS('envMapIntensity', 0, 'envMapIntensity');
  eqS('mapSize.set(2048', 0, 'Shadow-map size 2048');
  eqS('PCFSoftShadowMap', 5, 'PCFSoftShadowMap references (prologue/allowlist)');
  if (cnt('PointLight(0xffffff, 5, 28, 2)') < 6) fail('Too few room-light intensity 5 references');
  else ok(`Room-light intensity 5: ${cnt('PointLight(0xffffff, 5, 28, 2)')} occurrences (code, sources, prompt)`);
  if (cnt('scene.environmentIntensity') < 6) fail('Too few environmentIntensity references');
  else ok(`scene.environmentIntensity: ${cnt('scene.environmentIntensity')} occurrences`);
  for (const [sub, label] of [
    ['{{lab.track}}', 'list track badge'], ['{{activeLab.track}}', 'title track badge'],
    ['curriculum_ref.badge}}</span>', 'curriculum badge pills'], ['curriculum_ref.lf', 'curriculum field text'],
    ["{{t(\"learnMode\")}}", 'learning mode'], ["{{t('level')}}", 'level label'],
    ['openrouter', 'OpenRouter lowercase'], ['OpenRouter', 'OpenRouter uppercase'],
  ]) eqS(sub, 0, `must be absent: ${label}`);
  eqS('https://inference.baseten.co/v1/chat/completions', 1, 'Baseten endpoint (Provider-Fallback, kein POST-Detailblock)');
  eqS('https://api.meta.ai/v1', 1, 'Meta base (Provider, kein POST-Detailblock)');
  eqS('https://api.meta.ai/v1/chat/completions', 0, 'kein Meta-POST-Detailblock');
  if (cnt('meta-models/muse-spark-open-1026') < 2) fail('Baseten model is missing.');
  else ok('Baseten model: muse-spark-open-1026');
  eqS('openrouter-direct', 0, 'OpenRouter provider ID');
  eqS('modelmuse-key-baseten-direct', 3, 'BYOK key name (Baseten)');
  eqS('modelmuse-key-meta-muse', 3, 'BYOK key name (Meta)');
  eqS('modelmuse-proxy-key', 1, 'Legacy key fallback (Baseten-Migration)');
  if (s.includes('127.0.0.1:8787') || s.includes('localhost:8787')) fail('Standalone references the local proxy port.');
  else ok('No local proxy port referenced.');
  if (cnt('prefers-color-scheme') < 3) fail('System theme default (prefers-color-scheme) is missing.');
  else ok(`System theme default: ${cnt('prefers-color-scheme')} references (head init + data + mounted)`);
  eqS('<html lang="de" class="dark">', 0, 'Hardcoded dark html class');
  eqS('<html lang="de">', 1, 'Language html tag without forced theme');
  eqS('min-w-[220px]', 0, 'Top-right progress shell');
  eqS('saveProgress', 0, 'Progress persistence method');
  eqS('modelmuse.progress', 0, 'Progress storage key');
  eqS('gen-progress', 0, 'Progress overlay id/comment');
  eqS('id="gen-status"', 1, 'Generator status overlay');
  eqS('Fortschritt', 0, 'Fortschritt remnants');
  eqS('fortschritt', 0, 'fortschritt remnants (lowercase)');
  eqS('@click="openModify', 1, 'Per-model revise button');
  eqS('shrink-0 inline-flex items-center justify-center rounded-xl border', 1, 'Pencil button next to name (template)');
  // v16 (UI-Stromlinien): Modify-Hauptblock raus (Stift-Overlay bleibt),
  // Loeschen universell im Overlay (jede Lab-ID, kein free-*-Sonderfall),
  // Referenzbericht + Details raus, Banner oben.
  if (!s.includes('standalone-build v16')) fail('v16 stamp is missing (standalone-build v16).');
  else ok('v16 stamp present (UI-Stromlinien)');
  eqS('aria-label="modify"', 0, 'v16 modify main section');
  eqS('id="mod-desc"', 0, 'v16 main modify textarea');
  eqS('id="mod-desc2"', 1, 'v16 overlay modify textarea');
  eqS('@click="modify"', 0, 'v16 main modify button');
  eqS('modify:async function', 1, 'v16 modify logic kept');
  eqS('deleteLab', 6, 'v16 delete affordance (template + method + 3 locales)');
  eqS('deleteConfirm', 4, 'v16 delete confirm (call + 3 locales)');
  eqS('@click="deleteLab"', 1, 'v16 universal delete button');
  eqS("v-if=\"activeLab.id&&activeLab.id.indexOf('free-')===0\"", 0, 'v16 no free-* gate in overlay');
  eqS('lab.id.indexOf("free-")!==0){return;}', 0, 'v16 no free-* guard in deleteLab');
  eqS('this.activeLabId=null;try{this.syncViewer();}', 1, 'v16 empty-state viewer sync');
  // v17 (Provider-Umschalter): Baseten-Label ohne (direkt), Provider-Select
  // mit genau 2 Optionen, Meta-Modelle exakt 3, Streaming-SSE, Keys je
  // Provider, reasoning_effort max nur 1.3/wonder, 401-Texte je Provider.
  if (!s.includes('standalone-build v17')) fail('v17 stamp is missing (standalone-build v17).');
  else ok('v17 stamp present (Provider-Umschalter)');
  eqS('Baseten (direkt)', 0, 'v17 no parenthesized Baseten label (de)');
  eqS('Baseten (direct)', 0, 'v17 no parenthesized Baseten label (en)');
  eqS('Baseten (directo)', 0, 'v17 no parenthesized Baseten label (es)');
  eqS('I18N.de.providerFixed="Baseten";', 1, 'v17 provider label (de)');
  eqS('I18N.en.providerFixed="Baseten";', 1, 'v17 provider label (en)');
  eqS('providerFixed:"Baseten"', 1, 'v17 provider label (es)');
  eqS("{{t('providerFixed')}}", 0, 'v17 no static provider badge (dynamic label)');
  eqS('id="gen-provider"', 1, 'v17 provider select');
  eqS('id:"baseten-direct"', 1, 'v17 Baseten provider ID');
  eqS('id:"meta-muse"', 1, 'v17 Meta provider ID');
  eqS('label:"Baseten"', 1, 'v17 Baseten label');
  eqS('label:"Meta Muse"', 1, 'v17 Meta label');
  eqS('models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]', 1, 'v17 Meta models (exactly 3)');
  eqS('id="gen-reasoning"', 1, 'v17 reasoning select');
  eqS('reasoningAllowed', 5, 'v17 reasoning gate (computed + selects + resets)');
  eqS('text/event-stream', 3, 'v17 SSE streaming (generate + modify + reader)');
  eqS('stream:true', 3, 'v17 stream flag (bodies + SSE decoder)');
  eqS('max_output_tokens', 0, 'v17 no legacy token field');
  { const n = cnt('temperature:0.2,max_completion_tokens'); if (n !== 0) fail(`v23 no limit in Erst-Body: ${n}; expected 0`); else ok('v23 no max_completion_tokens in Erst-Body = 0'); }
  eqS('max_completion_tokens:65536', 0, 'v23 kein 65536-Erst-Budget (generate + modify)');
  eqS('max_completion_tokens=131072', 0, 'v23 kein 131072-Retry-Budget (generate + modify)');
  eqS('max_tokens=65536', 0, 'v23 kein max_tokens-Mirror (generate + modify)');
  eqS('max_tokens=131072', 0, 'v23 kein max_tokens-Retry-Mirror (generate + modify)');
  eqS('delete gbody.max_tokens', 0, 'v23 kein Limit-Strip mehr noetig (gen)');
  eqS('delete mbody.max_tokens', 0, 'v23 kein Limit-Strip mehr noetig (mod)');
  eqS('budgetRetryable', 3, 'v19 retry gate (helper + generate + modify)');
  eqS('standalone-build v19', 1, 'v19 stamp (Budget + Retry)');
  eqS('standalone-build v20', 1, 'v20 stamp (Budget hoch)');
  eqS('standalone-build v21', 1, 'v21 stamp (Thinking-Reduktion + Fallback)');
  eqS('standalone-build v22', 1, 'v22 stamp (Diagnose-Export + Thinking-Budget low)');
  eqS('standalone-build v23', 1, 'v23 stamp (kein Limit + Request-Echo + Prompt-Slim)');
  eqS('reasoning_effort', 10, 'v23 reasoning param (2 Gates + 2 low + 4 Echo-Snapshots + 2 Echo-Labels)');
  eqS('reasoning_effort="low"', 2, 'v23 belegtes Thinking-Minimum (nur baseten-direct)');
  eqS('reasoning_effort="none"', 0, 'v23 kein unbelegtes none (Doku: rejected/gemapped)');
  eqS('stream_options', 4, 'v21 stream usage (2 Bodies + 2 Fallback-Strips)');
  eqS('req_max_completion_tokens: ', 1, 'v23 Request-Echo Limit (generate-Diag)');
  eqS('req_max_tokens: ', 1, 'v23 Request-Echo Mirror (generate-Diag)');
  eqS('req_reasoning_effort: ', 1, 'v23 Request-Echo Thinking (generate-Diag)');
  eqS('req_400_fallback: ', 1, 'v23 Request-Echo Fallback (generate-Diag)');
  eqS('req_retry_reasoning_effort: ', 1, 'v23 Request-Echo Retry (generate-Diag)');
  eqS('Build v23', 1, 'v23 build stamp in diagnosis');
  eqS('Build v22', 0, 'v22 build stamp ersetzt');
  eqS('Strg+F5', 1, 'v21 stale-build hint');
  eqS('diagText:function', 1, 'v22 diagnose text (redigiert, ohne Key)');
  eqS('copyDiag:function', 1, 'v22 diagnose copy (Clipboard + Fallback)');
  eqS('copyDiagBtn', 4, 'v22 copy button (3 locales + template)');
  eqS('@click="copyDiag"', 1, 'v22 copy button im Fehlerzustand');
  eqS('this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 3, 'v17 reasoning gate+guards (never -contributor)');
  eqS('logit_bias', 0, 'v17 no forbidden logits field');
  eqS('web_search_options', 0, 'v17 no forbidden search field');
  eqS('logprobs', 0, 'v17 no forbidden logprobs field');
  eqS('modalities', 0, 'v17 no forbidden modalities field');
  eqS('"stop"', 0, 'v17 no forbidden stop field');
  eqS('dev.meta.ai', 10, 'v17 dashboard links (Meta hints + placeholder)');
  eqS('keyMissingMeta', 4, 'v17 Meta key-missing text (3 locales + selector)');
  eqS('keyInvalidMeta', 4, 'v17 Meta 401 text (3 locales + selector)');
  eqS('keyFormatMeta', 4, 'v17 Meta LLM_ hint (3 locales + template)');
  eqS('genProviderChanged', 2, 'v17 provider switch (binding + method)');
  eqS('genModelChanged', 2, 'v17 model switch (binding + method)');
  eqS('verifyBadges', 0, 'v16 reference report computed');
  eqS('verifyTitle', 0, 'v16 reference report title keys');
  eqS('detailsTitle', 0, 'v16 details title keys');
  eqS('measurementsTitle', 0, 'v16 measurements title keys');
  eqS('labelsTitle', 0, 'v16 labels title keys');
  eqS('v-if="showOnboarding"', 1, 'v16 onboarding banner');
  {
    const iB = s.indexOf('v-if="showOnboarding"');
    const iA = s.indexOf('<aside');
    const iV = s.indexOf('id="viewport"');
    if (!(iB > 0 && iB < iA && iA < iV)) fail('v16 banner must sit below header, above list + viewer');
    else ok('v16 banner below header, above list + viewer');
  }
  eqS('empty-stand: 0 Modelle', 0, 'Stale empty-stand marker');
  if (!s.includes('showcase: 5 Modelle')) fail('Showcase marker is missing.');
  else ok('Showcase marker is present');
  // v14 (2D-Alle-Varianten): 5 Demo-Modelle + Vendor-IIFE + Dispatch + Payloads.
  if (!s.includes('standalone-build v14')) fail('v14 stamp is missing (standalone-build v14).');
  else ok('v14 stamp present (2D-Alle-Varianten)');
  for (const id of ['demo-2d-svg', 'demo-2d-mermaid', 'demo-2d-chart', 'demo-2d-d3', 'demo-2d-katex']) {
    if (cnt(`{id:"${id}"`) < 1) fail(`v14 LABS entry missing: ${id}`);
    if (cnt(`META['${id}']`) < 1) fail(`v14 META entry missing: ${id}`);
    if (cnt(`INIT['${id}'] = `) !== 0) fail(`v14 2D must not have 3D-INIT: ${id}`);
  }
  ok('5 v14 LABS + 5 v14 META entries found (is3d:false, keine INITs)');
  for (const v of ['__V14SVG', '__V14MERMAID', '__V14CHART', '__V14D3', '__V14KATEX', '__renderVariant2D']) {
    if (cnt(v) < 3) fail(`v14 vendor/dispatcher missing: ${v}`);
  }
  ok('5 v14 Vendor-IIFE + __renderVariant2D vorhanden');
  if (cnt('diagram2d:{"variant"') !== 5) fail(`v14 LABS diagram2d-Payloads: ${cnt('diagram2d:{"variant"')}, erwartet 5`);
  else ok('v14 diagram2d-Payloads: 5 LABS + 5 META');
  eqS('"2d-svg","2d-mermaid","2d-chart","2d-d3","2d-katex"', 1, 'registerFree 2d-Allowlist');
  // v15 (Bestandteil-Info): Stempel, explanations je LABS, Info-Button/Popup, Umbenennungen.
  if (!s.includes('standalone-build v15')) fail('v15 stamp is missing (standalone-build v15).');
  else ok('v15 stamp present (Bestandteil-Info)');
  v15PartInfo(s, fail, ok);
  if (artifactBytes > 600000) fail(`Artifact is too large: ${artifactBytes} bytes.`);
  else ok(`Artifact size ${artifactBytes} bytes (under 600 KB for GitHub Pages).`);
  if (failures.length > 0) {
    console.error(`verify-standalone: ABORT (showcase: ${failures.length} failures)`);
    process.exit(1);
  }
  console.log('verify-standalone: OK (showcase verified: 5 3D-Erststart-Defaults + 5 2D-Demos v14, Baseten-Direkt BYOK)');
  process.exit(0);
}
const eq = (sub, want, label) => {
  const n = cnt(sub);
  if (n === want) ok(`${label} = ${n}`);
  else fail(`${label}: ${n}; expected ${want}`);
};

// Verify v13 artifact identity.
eq('standalone-build v13', 1, 'Build stamp');
eq('<title>ModelMuse Modelle v13-standalone (GitHub-Pages)</title>', 1, 'Title');
eq('viewerBadge:"Modelle v13-standalone"', 1, 'German badge');
eq('viewerBadge:"Models v13-standalone"', 1, 'English badge');
eq('viewerBadge:"Modelos v13-standalone"', 1, 'Spanish badge');

// Verify the 12 model entries.
const IDS = ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine'];
for (const id of IDS) {
  if (cnt(`{id:"${id}"`) < 1) fail(`LABS entry missing: ${id}`);
  if (cnt(`META['${id}']`) < 1) fail(`META entry missing: ${id}`);
}
ok('12 LABS + 12 META entries found');
for (const id of ['si-1', 'si-2', 'si-3', 'chemie-koffein', 'gpu-example', 'free-handbohrmaschine']) {
  if (cnt(`INIT['${id}'] = `) !== 1) fail(`3D init missing: ${id}`);
}
for (const id of ['dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3']) {
  if (cnt(`INIT['${id}'] = `) !== 0) fail(`Obsolete 3D init remains: ${id}`);
}
ok('INIT entries: 6 3D, 6 2D metadata');

// Check for obsolete lighting patterns.
eq('PointLight(0xffffff, 900', 0, 'Room-light intensity 900');
eq('0x11141a', 0, 'Dark-room color');
eq('envMapIntensity', 0, 'envMapIntensity');
eq('mapSize.set(2048', 0, 'Shadow-map size 2048');
eq('PCFSoftShadowMap', 5, 'PCFSoftShadowMap references (prologue/allowlist)');
if (cnt('PointLight(0xffffff, 5, 28, 2)') < 6) fail('Too few room-light intensity 5 references');
else ok(`Room-light intensity 5: ${cnt('PointLight(0xffffff, 5, 28, 2)')} occurrences (code, sources, prompt)`);
if (cnt('scene.environmentIntensity') < 6) fail('Too few environmentIntensity references');
else ok(`scene.environmentIntensity: ${cnt('scene.environmentIntensity')} occurrences`);

// Check that removed UI elements are absent.
for (const [sub, label] of [
  ['{{lab.track}}', 'list track badge'], ['{{activeLab.track}}', 'title track badge'],
  ['curriculum_ref.badge}}</span>', 'curriculum badge pills'], ['curriculum_ref.lf', 'curriculum field text'],
  ["{{t(\"learnMode\")}}", 'learning mode'], ["{{t('level')}}", 'level label'],
  ['openrouter', 'OpenRouter lowercase'], ['OpenRouter', 'OpenRouter uppercase'],
]) eq(sub, 0, `must be absent: ${label}`);
if (!s.includes('standalone-build v13')) fail('Build stamp is missing.');

// Verify direct Baseten configuration.
eq('https://inference.baseten.co/v1/chat/completions', 3, 'Baseten endpoint');
if (cnt('meta-models/muse-spark-open-1026') < 3) fail('Baseten model is missing.');
else ok('Baseten model: muse-spark-open-1026');
eq('openrouter-direct', 0, 'OpenRouter provider ID');
eq('modelmuse-proxy-key', 5, 'sessionStorage key name');
if (s.includes('127.0.0.1:8787') || s.includes('localhost:8787')) fail('Standalone references the local proxy port.');
else ok('No local proxy port referenced.');
// M8 UI fixes: system theme default, top-right progress bar gone, pencil next to name.
if (cnt('prefers-color-scheme') < 3) fail('System theme default (prefers-color-scheme) is missing.');
else ok(`System theme default: ${cnt('prefers-color-scheme')} references (head init + data + mounted)`);
eq('<html lang="de" class="dark">', 0, 'Hardcoded dark html class');
eq('<html lang="de">', 1, 'Language html tag without forced theme');
eq('theme:"dark"', 0, 'Hardcoded dark data default');
eq('min-w-[220px]', 0, 'Top-right progress shell');
eq('saveProgress', 0, 'Progress persistence method');
eq('modelmuse.progress', 0, 'Progress storage key');
eq('gen-progress', 0, 'Progress overlay id/comment');
eq('id="gen-status"', 1, 'Generator status overlay');
eq('Fortschritt', 0, 'Fortschritt remnants');
eq('fortschritt', 0, 'fortschritt remnants (lowercase)');
eq('mt-2 w-full inline-flex', 0, 'Pencil button below name');
eq('@click="openModify', 1, 'Per-model revise button');
eq('shrink-0 inline-flex items-center justify-center rounded-xl border', 1, 'Pencil button next to name (template)');
eq('modifyOpen', 6, 'Revise affordance (template + de/en/es)');

// Enforce the artifact size limit.
if (artifactBytes > 600000) fail(`Artifact is too large: ${artifactBytes} bytes.`);
else ok(`Artifact size ${artifactBytes} bytes (under 600 KB for GitHub Pages).`);

if (failures.length > 0) {
  console.error(`verify-standalone: ABORT (${failures.length} failures)`);
  process.exit(1);
}
console.log('verify-standalone: OK (v13 release artifact verified)');
