/**
 * npm run verify:standalone — static release verification for the
 * standalone artifact (the only release artifact; GitHub Pages-ready; no backend).
 * Checks the BUILT artifact at dist-standalone/modelmuse-standalone.html:
 *  - v13 stamp, title/badges, 12 LABS and 12 META/INIT entries (6 3D, 6 2D metadata)
 *  - no obsolete lighting patterns (900/2048/PCFSoft/envMap/dark room)
 *  - no removed UI elements (objectives/level/learning mode/track/curriculum)
 * - direct endpoints/models for all three providers (Baseten + Meta/Muse + OpenRouter);
 *   no local proxy port
 *  - size limit (under 600 KB for GitHub Pages)
 * Exit 0 means every check passed; exit 1 means at least one check failed.
 */
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'demo-2d-chart'];

// v45: lokalisierter Hilfe-Link in der Fusszeile + koexistierende Docs-Ablage.
// Steht vor der Empty-/Showcase-/Standard-Verzweigung, gilt also fuer jede Variante.
{
  const eq45 = (sub, want, label) => {
    const n = cnt(sub);
    if (n === want) ok(`${label} = ${n}`);
    else fail(`${label}: ${n}; expected ${want}`);
  };
  eq45('footerHelp:', 4, 'Hilfe-Link-Texte footerHelp (de/en/es/fr)');
  eq45("{{t('footerHelp')}}", 1, 'Hilfe-Link-Template in der Fusszeile');
  eq45("'help/'+lang+'.html'", 1, 'Sprachabhaengiges Hilfe-Ziel (help/de|en|es|fr.html)');
  for (const [code, text] of [
    ['de', 'Brauchst du Hilfe?'], ['en', 'Need help?'],
    ['es', '¿Necesitas ayuda?'], ['fr', "Besoin d'aide ?"],
  ]) {
    if (!s.includes(`footerHelp:"${text}"`)) fail(`footerHelp-Text fehlt: ${code}`);
    else ok(`footerHelp-Text vorhanden: ${code}`);
  }
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sections = {
    de: ['Generator', 'Provider', 'Export', 'Telemetrie'],
    en: ['Generating', 'Providers', 'Exporting', 'Telemetry'],
    es: ['Generar', 'Proveedor', 'Exportar', 'Telemetría'],
    fr: ['Générer', 'Fournisseur', 'Exporter', 'Télémétrie'],
  };
  for (const code of ['de', 'en', 'es', 'fr']) {
    const p = join(repoRoot, 'docs', 'help', `${code}.html`);
    if (!existsSync(p)) { fail(`Docs-Ablage fehlt: docs/help/${code}.html`); continue; }
    const doc = readFileSync(p, 'utf8');
    let docOk = true;
    for (const section of sections[code]) {
      if (!doc.includes(section)) { fail(`docs/help/${code}.html: Abschnitt fehlt: ${section}`); docOk = false; }
    }
    if (!doc.includes(`shots/app-${code}.png`)) { fail(`docs/help/${code}.html: Screenshot-Einbindung fehlt`); docOk = false; }
    if (doc.includes('href="/"')) { fail(`docs/help/${code}.html: absoluter App-Ruecklink (Pages-Projektseite: ../ statt /)`); docOk = false; }
    if (doc.split('href="../"').length - 1 !== 2) { fail(`docs/help/${code}.html: App-Ruecklink fehlt (Header + Footer, relativ ../)`); docOk = false; }
    if (docOk) ok(`Docs-Ablage vorhanden: docs/help/${code}.html`);
  }
}

/**
 * v15 Bestandteil-Info: je gebuendeltem LABS-Eintrag explanations de/en/es/fr
 * (Laengen-Deckung zu labels, je Text 8-500 Zeichen), Info-Button/Popup-Marker,
 * Umbenennungen Bestandteil/Component/Componente/Composant.
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
    for (const loc of ['de', 'en', 'es', 'fr']) {
      const arr = jsonArr(expBlock, `${loc}:`);
      const good = Array.isArray(arr) && arr.length === n && n >= 3
        && arr.every((x) => typeof x === 'string' && x.length >= 8 && x.length <= 500);
      if (!good) { fail(`v15 explanations ${loc} misaligned: ${id} (labels=${n})`); entryOk = false; }
    }
    if (entryOk) ok(`v15+v42 explanations de/en/es/fr: ${id} (${n} je Lokale)`);
  }
  const eqV = (sub, want, label) => {
    const n = s.split(sub).length - 1;
    if (n === want) ok(`${label} = ${n}`);
    else fail(`${label}: ${n}; expected ${want}`);
  };
  eqV('openPartInfo', 2, 'v15 openPartInfo (Template + Methode)');
  eqV('closePartInfo', 3, 'v15+v34 closePartInfo (2x Template + Methode)');
  eqV('partInfoIndex', 7, 'v15 partInfoIndex (data/reset/open/close/3x Template)');
  eqV('partInfoTitle', 7, 'v15+v34+v42 partInfoTitle (4 I18N + aria + h3 + Win-Leiste)');
  eqV('partInfoAbout', 6, 'v15+v42 partInfoAbout (4 I18N + aria + title)');
  eqV('partExplanations', 2, 'v15a partExplanations (computed + text)');
  eqV('partInfoMissing', 5, 'v15a+v42 partInfoMissing (4 I18N + Popup-Fallback)');
  eqV('explanations:{de:[', 6, 'v15 LABS mit explanations');
  eqV('v-if="partInfoIndex!==null"', 1, 'v15 Info-Popup v-if');
  eqV('ⓘ', 1, 'v15 Info-Kreis-i-Button');
  eqV('this.partsHidden=[];this.partInfoIndex=null;', 1, 'v15 selectLab-Reset');
  eqV('partsTitle:"Bestandteile"', 1, 'v15 de-Titel Bestandteil');
  eqV('partsTitle:"Components"', 1, 'v15 en-Titel Component');
  eqV('partsTitle:"Componentes"', 1, 'v15 es-Titel Componente');
  eqV('partsTitle:"Composants"', 1, 'v42 fr-Titel Composant');
  eqV('partsTitle:"Bauteile"', 0, 'v15 kein Bauteil-Titel (de)');
  eqV('partsTitle:"Parts"', 0, 'v15 kein Parts-Titel (en)');
  eqV('partsTitle:"Piezas"', 0, 'v15 kein Piezas-Titel (es)');
  eqV('Nutze die Bauteilliste.', 0, 'v15 keine Bauteilliste-Hints (de)');
  eqV('Use the parts list.', 0, 'v15 keine parts-list-Hints (en)');
  eqV('Usa la lista de piezas.', 0, 'v15 keine piezas-Hints (es)');
  eqV('role="dialog"', 3, 'v15+v37 Dialoge (Tele + Modify + Bestandteil-Info)');
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
  ]) eqS(sub, 0, `must be absent: ${label}`);
  eqS('https://inference.baseten.co/v1/chat/completions', 1, 'Baseten endpoint (Provider-Fallback, kein POST-Detailblock)');
  eqS('https://api.meta.ai/v1', 1, 'Meta base (Provider, kein POST-Detailblock)');
  eqS('https://api.meta.ai/v1/chat/completions', 0, 'kein Meta-POST-Detailblock');
  eqS('https://openrouter.ai/api/v1', 1, 'v38 OpenRouter base (Direkt-Call, kein POST-Detailblock)');
  for (const slug of ['openai/gpt-6.1-sol', 'meta/muse-spark-1.3', 'anthropic/claude-opus-5.5']) {
    if (cnt(slug) < 1) fail(`v38 OpenRouter slug missing: ${slug}`);
  }
  ok('v38 OpenRouter slugs: 3 verifizierte Slugs');
  eqS('id:"openrouter"', 1, 'v38 OpenRouter provider ID');
  eqS('openrouter-direct', 0, 'v38 keine alte OpenRouter-ID');
  eqS('modelmuse-key-baseten-direct', 3, 'BYOK key name (Baseten)');
  eqS('modelmuse-key-meta-muse', 3, 'BYOK key name (Meta)');
  eqS('modelmuse-key-openrouter', 3, 'v38 BYOK key name (OpenRouter)');
  eqS('modelmuse-proxy-key', 1, 'Legacy key fallback (Baseten-Migration)');
  eqS('HTTP-Referer', 1, 'v38 OpenRouter-Attribution (nur OpenRouter)');
  eqS('X-Title', 1, 'v38 OpenRouter-Titel (nur OpenRouter)');
  eqS('directHeaders:function', 1, 'v38 Header-Methode');
  eqS('keyMissingOpenrouter', 5, 'v38 Key-Hinweis de/en/es/fr + Auswahl');
  eqS('keyInvalidOpenrouter', 5, 'v38 401-Hinweis de/en/es/fr + Auswahl');
  eqS('keyFormatOpenrouter', 5, 'v38 Format-Hinweis de/en/es/fr + Template');
  if (cnt('meta-models/muse-spark-open-1026') < 2) fail('Baseten model is missing.');
  else ok('Baseten model: muse-spark-open-1026');
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
  eqS('deleteLab', 7, 'v16 delete affordance (template + method + 4 locales)');
  eqS('deleteConfirm', 5, 'v16 delete confirm (call + 4 locales)');
  eqS('@click="deleteLab"', 1, 'v16 universal delete button');
  eqS("v-if=\"activeLab.id&&activeLab.id.indexOf('free-')===0\"", 0, 'v16 no free-* gate in overlay');
  eqS('lab.id.indexOf("free-")!==0){return;}', 0, 'v16 no free-* guard in deleteLab');
  eqS('this.activeLabId=null;try{localStorage.removeItem("modelmuse.lab");}catch(eDL){}try{this.syncViewer();}', 1, 'v16+v36 empty-state viewer sync (Auswahl geraeumt)');
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
  eqS('providerFixed:"Baseten"', 2, 'v17+v42 provider label (es + fr)');
  eqS("{{t('providerFixed')}}", 0, 'v17 no static provider badge (dynamic label)');
  eqS('id="gen-provider"', 1, 'v17 provider select');
  eqS('id:"baseten-direct"', 1, 'v17 Baseten provider ID');
  eqS('id:"meta-muse"', 1, 'v17 Meta provider ID');
  eqS('label:"Baseten"', 1, 'v17 Baseten label');
  eqS('label:"Meta Muse"', 1, 'v17 Meta label');
  eqS('models:["muse-spark-1.3-contributor","muse-spark-1.3","muse-wonder-1.0"]', 1, 'v17 Meta models (exactly 3)');
  eqS('id="gen-reasoning"', 1, 'v17 reasoning select');
  eqS('reasoningAllowed', 7, 'v26 max-Gate (computed + selects + defaults + bodies)');
  eqS('text/event-stream', 2, 'v17 SSE streaming (directHeaders + Reader)');
  eqS('stream:true', 3, 'v17 stream flag (bodies + SSE decoder)');
  eqS('max_output_tokens', 0, 'v17 no legacy token field');
  { const n = cnt('temperature:0.2,max_completion_tokens:131072,max_tokens:131072'); if (n !== 2) fail(`v48 Limit in Erst-Bodies: ${n}; expected 2`); else ok('v48 max_completion_tokens:131072,max_tokens:131072 in Erst-Bodies = 2'); }
  eqS('max_completion_tokens:65536', 0, 'v48 kein 65536-Erst-Budget (generate + modify)');
  eqS('max_completion_tokens=131072', 0, 'v48 kein Retry-Literal (Body wird geteilt)');
  eqS('max_tokens=65536', 0, 'v48 kein max_tokens-Mirror (alt)');
  eqS('max_tokens=131072', 0, 'v48 kein Retry-Mirror (alt, =Form)');
  eqS('delete gbody.max_tokens', 0, 'v48 kein Limit-Strip (gen, Limit ueberlebt Fallback)');
  eqS('delete mbody.max_tokens', 0, 'v48 kein Limit-Strip (mod, Limit ueberlebt Fallback)');
  eqS('delete gbody.stream_options', 1, 'v48 400-Fallback strippt weiter Extras (gen)');
  eqS('delete mbody.stream_options', 1, 'v48 400-Fallback strippt weiter Extras (mod)');
  eqS('mc:gbody.max_completion_tokens', 3, 'v48 Echo-Snapshots gen lesen Limit aus Body');
  eqS('mc:mbody.max_completion_tokens', 3, 'v48 Echo-Snapshots mod lesen Limit aus Body');
  eqS('budgetRetryable', 3, 'v19 retry gate (helper + generate + modify)');
  eqS('standalone-build v19', 1, 'v19 stamp (Budget + Retry)');
  eqS('standalone-build v20', 1, 'v20 stamp (Budget hoch)');
  eqS('standalone-build v21', 1, 'v21 stamp (Thinking-Reduktion + Fallback)');
  eqS('standalone-build v22', 1, 'v22 stamp (Diagnose-Export + Thinking-Budget low)');
  eqS('standalone-build v23', 1, 'v23 stamp (kein Limit + Request-Echo + Prompt-Slim)');
  eqS('reasoning_effort', 10, 'v26 reasoning param (2 Gates + 2 xhigh + 4 Echo-Snapshots + 2 Echo-Labels)');
  eqS('reasoning_effort="xhigh"', 2, 'v26 belegtes Maximum (Contributor + Baseten, nie max)');
  eqS('reasoning_effort="low"', 0, 'v26 kein low mehr (xhigh)');
  eqS('reasoning_effort="none"', 0, 'v26 kein unbelegtes none (Doku: rejected/gemapped)');
  eqS('xhighAllowed', 6, 'v26 xhigh-Leitplanken (Methode + selects + defaults + bodies)');
  eqS('reasoningDefault', 5, 'v26+v46 UI-Default (Methode + resets + bodies + Schaetzung; ETA flat ohne Tabelle)');
  eqS('genReasoning:"xhigh"', 1, 'v26 UI-Default xhigh (Baseten-Startprovider)');
  eqS('reasoningHigh', 5, 'v26+v42 xhigh-Option (4 Locales + Template)');
  eqS('stream_options', 4, 'v21 stream usage (2 Bodies + 2 Fallback-Strips)');
  eqS('req_max_completion_tokens: ', 1, 'v48 Request-Echo Limit (generate-Diag)');
  eqS('req_max_tokens: ', 1, 'v48 Request-Echo Mirror (generate-Diag)');
  eqS('req_retry_max_completion_tokens: ', 1, 'v48 Request-Echo Retry-Limit (generate-Diag)');
  eqS('req_retry_max_tokens: ', 1, 'v48 Request-Echo Retry-Mirror (generate-Diag)');
  eqS('req_reasoning_effort: ', 1, 'v23 Request-Echo Thinking (generate-Diag)');
  eqS('req_400_fallback: ', 1, 'v23 Request-Echo Fallback (generate-Diag)');
  eqS('req_retry_reasoning_effort: ', 1, 'v23 Request-Echo Retry (generate-Diag)');
  eqS('Build v48', 1, 'v48 build stamp in diagnosis (explizites Limit 131072)');
  eqS('Build v47', 0, 'v47 build stamp ersetzt');
  eqS('Build v26', 0, 'v26 build stamp ersetzt');
  eqS('Build v25', 0, 'v25 build stamp ersetzt');
  eqS('Build v24', 0, 'v24 build stamp ersetzt');
  eqS('Build v23', 0, 'v23 build stamp ersetzt');
  eqS('Build v22', 0, 'v22 build stamp ersetzt');
  eqS('standalone-build v30', 1, 'v30 stamp (R0-Call-Reparatur Computed-Properties)');
  eqS('standalone-build v31', 1, 'v31 stamp (Eck-Overlay + ETA-Countdown + Auftrags-Queue)');
  // v31 (Eigentuemer A/B/C): Ueberarbeiten als Eck-Overlay wie Generieren,
  // ETA-Countdown mit Geduld-Hinweis de/en/es, Auftrags-Queue.
  eqS('position:fixed;bottom:16px;right:16px', 3, 'v31+v37 Overlays unten in der Ecke (gen + mod + tele)');
  eqS('id="mod-status"', 1, 'v31 Mod-Overlay mit eigener ID');
  eqS('@click="generate"', 0, 'v31 kein blockierender Generate-Handler mehr');
  eqS('@click="enqueueGenerate"', 1, 'v31 Queue-Einstieg am Generieren-Button');
  eqS('enqueueGenerate', 2, 'v31 enqueue-Methode (Template + Definition)');
  eqS('pumpGenQueue', 3, 'v31+v35 Queue-Pumpe (2 Einreihungen + Definition)');
  eqS('id="gen-jobs"', 1, 'v31 Auftragsliste im Gen-Overlay');
  eqS('genJobsTitle', 5, 'v31 Auftragstitel (4 Locales + Template)');
  eqS('genJobs:[]', 1, 'v31 Queue-State im Data-Block');
  eqS('jobWaiting', 11, 'v31+v35+v37+v42 Auftragsstatus wartend (4 Locales + 2x enqueue + Pumpe + Stopp + Tick + Zeittext x2)');
  eqS('jobRunning', 8, 'v31+v37+v42 Auftragsstatus laeuft (4 Locales + Pumpe + Tick + Zeittext + Stempel)');
  eqS('jobDone', 15, 'v31+v37+v42 Auftragsstatus fertig (4 Locales + Pumpe + Template x3 + Zeittext + Tick + Stempel + Hinweis x4 + Hint-Key)');
  eqS('jobError', 10, 'v31+v37+v42 Auftragsstatus Fehler (4 Locales + Pumpe x2 + Stopp + Zeittext + Tick + Prune)');
  eqS('genStopped', 5, 'v31 Stopp-Hinweis (4 Locales + Stopp-Methode)');
  eqS('genEtaText', 2, 'v31 Gen-Countdown (Computed + Template)');
  eqS('modEtaText', 2, 'v31 Mod-Countdown (Computed + Template)');
  eqS('genPatient', 9, 'v31 Gen-Geduld (4 Locales + State + Timer + Template x2)');
  eqS('modPatient', 9, 'v31 Mod-Geduld (4 Locales + State + Timer + Template x2)');
  eqS('Hab noch einen Moment Geduld.', 2, 'v31 Geduld-Hinweis de (gen + mod)');
  eqS('standalone-build v32', 1, 'v32 stamp (Overtime + Gesamtzeit + ETA-Tabelle)');
  // v32 (D/E/F): Overtime de/en/es, Gesamtzeit de/en/es, 4-Min-Texte,
  // Tabelle + dynamischer Abort.
  eqS('länger als erwartet', 2, 'v32 Overtime de (gen + mod)');
  eqS('longer than expected', 2, 'v32 Overtime en (gen + mod)');
  eqS('lento de lo esperado', 2, 'v32 Overtime es (gen + mod)');
  eqS('fertig nach {s} s', 2, 'v32 Gesamtzeit de (gen + mod)');
  eqS('done after {s} s', 2, 'v32 Gesamtzeit en (gen + mod)');
  eqS('listo tras {s} s', 2, 'v32 Gesamtzeit es (gen + mod)');
  eqS('ca. 4 Minuten', 4, 'v46 ETA-Countdown de (kurz + lang, gen + mod)');
  eqS('about 4 minutes', 4, 'v46 ETA-Countdown en (kurz + lang, gen + mod)');
  eqS('aprox. 4 minutos', 4, 'v46 ETA-Countdown es (kurz + lang, gen + mod)');
  eqS('etaSeconds:function', 1, 'v46 ETA flat (Methode ohne Tabelle)');
  eqS('etaSeconds:function(){return 240;}', 1, 'v46 ETA flat 240 s (keine Modell/Reasoning-Tabelle)');
  eqS('ca. 1 Minute', 0, 'v46 kein 1-Min-Kurztext mehr (de)');
  eqS('about 1 minute', 0, 'v46 kein 1-Min-Kurztext mehr (en)');
  eqS('aprox. 1 minuto', 0, 'v46 kein 1-Min-Kurztext mehr (es)');
  eqS('env. 1 minute', 0, 'v46 kein 1-Min-Kurztext mehr (fr)');
  eqS('*1000+120000', 2, 'v32 Abort folgt Tabelle (gen + mod)');
  eqS('},120000);', 0, 'v32 kein fixer 120-s-Abort mehr');
  eqS('standalone-build v33', 1, 'v33 stamp (Mesh-Text raus + Erklaerungs-Haertung)');
  // v33 (G/H): kein Mesh-Text, tolerante Erklaerungen.
  eqS('mappingNote', 0, 'v33 Mesh-Text-Key entfernt');
  eqS('mappingText', 0, 'v33 Mesh-Text-Methode entfernt');
  eqS('Meshes zugeordnet', 0, 'v33 Mesh-Text entfernt');
  eqS('normExp:function', 1, 'v33 Toleranz-Helper');
  eqS('standalone-build v34', 1, 'v34 stamp (Stapelung + Minimieren + Schliessen)');
  // v34 (I): Win-Dock, drei Leisten, Min/Close.
  eqS('toggleWinMin(', 4, 'v34+v37 Minimieren (gen + mod + part + tele)');
  eqS('id="part-info"', 1, 'v34 Part-Dialog adressierbar');
  eqS('win-dock v34', 1, 'v34 Stapel-Skript');
  eqS('cancelGenerate', 3, 'v34 Gen-Close (Stopp + Methode + Leiste)');
  eqS('dismissGenNotice', 5, 'v34 Gen-Notizen (Methode + Aufrufe)');
  eqS('closeModify', 3, 'v34 Mod-Close (Methode + Button + Leiste)');
  eqS('standalone-build v35', 1, 'v35 stamp (Modify in derselben Queue)');
  // v35 (J): einheitliche Queue gen+mod.
  eqS('enqueueModify', 2, 'v35 Mod-Einreihung (Call + Methode)');
  eqS("kind:'mod'", 1, 'v35 Mod-Auftraege markiert');
  eqS('job.kindKey', 1, 'v35 Art-Badge im Template');
  eqS(':disabled="modBusy"', 0, 'v35 Mod-Button nie disabled');
  eqS('genBusy||genNotice||genPumping', 1, 'v35 Fenster bei Pumpe sichtbar');
  eqS('standalone-build v36', 1, 'v36 stamp (Startauswahl + Fallback + Geister-Modell)');
  // v36 (K): Startaufloesung + Modus.
  eqS('modelmuse.mode', 5, 'v36 Modus (4x persist + 1x restore)');
  eqS('localStorage.removeItem("modelmuse.lab")', 2, 'v36 stale Auswahl geraeumt');
  eqS('standalone-build v37', 1, 'v37 stamp (Min-Zustand + ETA wonder + Telemetrie + Queue)');
  // v37 (M/E/T/Q): zustandsabhaengige Min-Buttons, wonder-ETA, Telemetrie-Opt-in,
  // Countdown je Auftrag, Erfolgs-Feedback, 30-s-/Modell-Oeffnen-Hygiene.
  eqS("winMin.gen?'+':'–'", 1, 'v37 gen-Min zustandsabhaengig');
  eqS('indexOf("wonder")', 0, 'v46 flat (keine wonder-Sondertabelle)');
  eqS('id="tele-status"', 1, 'v37 Telemetrie-Fenster');
  eqS('openTele:function', 1, 'v37 Telemetrie-Snapshot');
  eqS('teleBlock:function', 1, 'v37 Telemetrie-Block (redigiert)');
  eqS('https://github.com/Effzumdeh/ModelMuse/issues', 1, 'v37 Issue-Link');
  eqS('jobTimeText(job,queueNow)', 1, 'v37 Countdown je Auftrag');
  eqS("{{t('jobDoneHint')}}", 1, 'v37 Erfolgs-Hinweis in Queue');
  eqS('Date.now()-30000', 1, 'v37 30-s-Hygiene');
  eqS('sj.labId===id', 1, 'v37 Prune beim Modell-Oeffnen');
  eqS('standalone-build v38', 1, 'v38 stamp (OpenRouter + ETA robust/Entkopplung + Telemetrie-UX + OrthographicCamera)');
  // v38 (O/E/T/F): OpenRouter-Drittprovider, robuste ETA + entdoppelte Queue,
  // Telemetrie-UX (Sterne/Danke/Issue), OrthographicCamera.
  eqS('{{teleBlock()}}', 0, 'v38 Vorschau entfernt (Block bleibt Kopierquelle)');
  eqS('teleStars>=n', 1, 'v38 Sterne-Auswahl sichtbar (Farbwechsel)');
  eqS("{{t('teleThanks')}}", 1, 'v38 Danke-Text im Fenster');
  eqS('teleIssueShow', 6, 'v38 Issue erst nach Danke (Data/Reset/Close/Copy/Template)');
  eqS('if(st==="jobDone"){return "";}', 1, 'v38 Queue: fertig ohne eigene Zeit');
  eqS('if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}', 0, 'v46 alte ETA-Tabelle ersetzt (flat)');
  eqS('standalone-build v46', 1, 'v46 Stempel (Final-Sprint: ETA flat + Modus-Auto + Footer + LICENSES + Ollama)');
  eqS('standalone-build v47', 1, 'v47 Stempel (Diagnose-Stempel v26->v47)');
  eqS('standalone-build v48', 1, 'v48 Stempel (explizites Limit 131072 + Diagnose-Echo-Werte)');
  // v46 (E/M/F/L/O/T): ETA flat 240, Modus-Auto, Funktions-Footer,
  // LICENSES-Link, Ollama lokal, System-Theme ohne Toggle.
  eqS('@click="force2D"', 0, 'v46 Modus-Buttons raus (force2D)');
  eqS('@click="to3D"', 0, 'v46 Modus-Buttons raus (to3D)');
  eqS("{{t('mode2d')}}", 0, 'v46 Modus-Buttons raus (Template)');
  eqS("{{t('mode3d')}}", 0, 'v46 Modus-Buttons raus (Template)');
  eqS('Baue 3D-Modelle mit deinem LLM', 1, 'v46 Funktions-Footer de');
  eqS('Build 3D models with your LLM', 1, 'v46 Funktions-Footer en');
  eqS('Crea modelos 3D con tu LLM', 1, 'v46 Funktions-Footer es');
  eqS('avec ton LLM', 1, 'v46 Funktions-Footer fr');
  eqS('docs/LIZENZEN.md', 0, 'v46 alte Lizenzablage weg');
  eqS('href="docs/LICENSES.md"', 1, 'v46 Lizenz-Link in der Fusszeile');
  eqS('id:"ollama"', 1, 'v46 Ollama-Provider');
  eqS('http://localhost:11434/v1', 1, 'v46 Ollama-Basis (OpenAI-kompatibel)');
  eqS('setTheme', 0, 'v46 kein Theme-Umschalter (Methode + Buttons raus)');
  eqS('modelmuse.theme', 0, 'v46 kein Theme-Override (nur System)');
  eqS('standalone-build v40', 1, 'v40 Stempel (Reasoning-Stufen je Modell: max nur wo belegt)');
  eqS('||this.genProvider==="openrouter";},', 1, 'v40 max-Gate += openrouter (reasoningAllowed, max dort belegt)');
  eqS('this.genProvider==="openrouter"?"xhigh":"max"', 1, 'v40 Default openrouter xhigh (kein stilles max-Upgrade)');
  eqS('standalone-build v41', 1, 'v41 Stempel (Export-Menue unten links: GLB/PNG/SVG je Modus)');
  // v41 (E): Export-Menue unten links + Host-Exportlogik + I18N de/en/es.
  eqS('id="export-menu"', 1, 'v41 Export-Menue unten links (Template)');
  eqS('toggleExportMenu:function', 1, 'v41 Menue-Methode');
  eqS('exportGLB:async function', 1, 'v41 GLB-Methode');
  eqS('exportPNG:async function', 1, 'v41 PNG-Methode');
  eqS('exportSVG:async function', 1, 'v41 SVG-Methode');
  eqS('window.__viewer.exportSceneGLB = async function', 1, 'v41 GLB hostseitig');
  eqS('three/addons/exporters/GLTFExporter.js', 1, 'v41 GLTF-Importmap (0 Bytes)');
  eqS('onlyVisible: true', 1, 'v41 Part-Ausblendung wirkt');
  eqS('userData.labelText', 2, 'v41 Labels als GLB-extras (Guard + Stempel)');
  eqS('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"', 5, 'v41 xmlns in allen 5 Inline-Tags');
  eqS('saveModel:', 4, 'v41+v42 I18N saveModel de/en/es/fr');
  eqS('saveGlb:', 4, 'v41+v42 I18N saveGlb de/en/es/fr');
  eqS('savePng:', 4, 'v41+v42 I18N savePng de/en/es/fr');
  eqS('saveSvg:', 4, 'v41+v42 I18N saveSvg de/en/es/fr');
  eqS('standalone-build v42', 1, 'v42 stamp (FR-Portierung: Button + I18N.fr + LABS/META fr + Prompts 4-sprachig)');
  // v42 (F): FR-Button + fr-Dict + UI-Fallbacks + Prompts + LABS/META fr.
  eqS('>FR</button>', 1, 'v42 FR-Button in der Kopfzeile');
  eqS("setLang('fr')", 1, 'v42 FR-Umschaltung');
  eqS('I18N.fr={', 1, 'v42 fr-Dict (135 Keys)');
  eqS('viewerBadge:"Mod\\u00e8les v13-standalone"', 1, 'v42 fr-Badge');
  eqS('partsTitle:"Composants"', 1, 'v42 fr-Bestandteil-Titel');
  eqS('(locale==="en"||locale==="es"||locale==="fr")?locale:"de"', 1, 'v42 3D-Prompt loc-Gate fr');
  eqS("locale==='fr')?locale:'de'", 1, 'v42 2D-Prompt loc-Gate fr');
  eqS('fr: { title, parts: [...] }', 2, 'v42 meta_i18n-Vertrag en/es/fr (3D + 2D)');
  eqS('en.explanations + es.explanations + fr.explanations als', 2, 'v42 explanations-Vertrag en/es/fr');
  eqS('var titleFr=', 1, 'v42 makeFreeLab titleFr');
  eqS('var partsFr=', 1, 'v42 makeFreeLab partsFr');
  eqS('var expFr=', 1, 'v42 makeFreeLab expFr');
  eqS('var measTextFr=', 1, 'v42 makeFreeLab measTextFr');
  eqS('var FR={', 1, 'v42 FR-Anreicherung (Map + fr-Fallbacks)');
  eqS('plus lent que pr\\u00e9vu', 2, 'v42 Overtime fr (gen + mod)');
  eqS('pr\\u00eat apr\\u00e8s {s} s', 2, 'v42 Gesamtzeit fr (gen + mod)');
  eqS('env. 4 minutes', 4, 'v46 ETA-Countdown fr (kurz + lang, gen + mod)');
  eqS('Patiente encore un moment.', 2, 'v42 Geduld-Hinweis fr (gen + mod)');
  eqS('ModelMuse diagnostic (édité, sans clé).', 1, 'v42 diagText fr');
  eqS('ModelMuse télémétrie (volontaire, sans clé).', 1, 'v42 teleBlock fr');
  for (const [frTitle, label] of [
    [',fr:"Porte de Brandebourg (Berlin)"}', 'arch'],
    [',fr:"Poste PC (SI-1)"}', 'si-1'],
    [',fr:"Molécule de caféine"}', 'koffein'],
    [',fr:"Perceuse manuelle"}', 'bohrmaschine'],
    [',fr:"Carte graphique"}', 'gpu'],
    ['"fr":"Comparaison de rendement"}', 'chart'],
  ]) eqS(frTitle, 1, `v42 LABS-Titel fr (${label})`);
  eqS('Quel composant appartient à', 6, 'v42 LABS-Quiz fr (6 kuratierte)');
  eqS('Aucun de ceux-ci', 7, 'v42 Quiz-Option fr (6 kuratierte + makeFreeLab)');
  eqS('figure dans la liste.', 7, 'v42 Quiz-Rationale fr (6 kuratierte + makeFreeLab)');
  eqS(', fr: { title:', 5, 'v42 meta_i18n-Konstanten fr (5 Modelle)');
  eqS('OctahedronGeometry, OrthographicCamera, PCFShadowMap', 1, 'v41 E8 Destructure-Luecke (registerFree funktionsfaehig)');
  eqS('"OctahedronGeometry","OrthographicCamera","PCFShadowMap"', 1, 'v38 OrthographicCamera-Allowlist');
  eqS('OctahedronGeometry,OrthographicCamera,PCFShadowMap', 2, 'v38 OrthographicCamera-Prolog x2');
  eqS('standalone-build v29', 1, 'v29 stamp (Modelliste 10->6 + Umbenennungen)');
  eqS('standalone-build v28', 1, 'v28 stamp (2D-Klassifizierer Bindestrich-Padding)');
  eqS('standalone-build v27', 1, 'v27 stamp (2D-Klassifizierer-Feinschliff)');
  eqS('standalone-build v26', 1, 'v26 stamp (E0 Erklaerungen + D0 Disclaimer-raus + M0 Parts + T0 2D + R0 Reasoning)');
  eqS('standalone-build v25', 1, 'v25 stamp (Fence-Pflicht + tolerante Extraktion + Guard-nur-Code)');
  eqS('standalone-build v24', 1, 'v24 stamp (Import-Strip positionsunabhaengig + Validierung)');
  eqS('Fix3 Import-Strip v24', 1, 'v24 positionsunabhaengiger Import-Strip');
  eqS('import verblieben', 1, 'v24 Rest-Import-Validierung (klassifiziert)');
  eqS('Z,fence:', 2, 'v24 Status-Metriken (Content-Laenge + Fence, generate + modify)');
  eqS('__FREE_FENCE_V25__', 1, 'v25 Guard-nur-Code-Marker (Prosa nie scannen)');
  eqS('```js-Codeblock', 3, 'v25+v26 Fence-Pflicht im Prompt (generate + modify + 2D)');
  eqS('keine Erklaerung, keine Fences', 0, 'v25 altes Fence-Verbot entfernt');
  eqS('var __m25=', 4, 'v25 tolerante Extraktion (generate + modify + Retry + Guard)');
  eqS('var __i25=', 4, 'v25 Import-Erhalt in Extraktion/Guard');
  eqS('var __t25=', 4, 'v25 Nachlauf-Prosa kappen (Extraktion + Guard)');
  eqS('init/meta fehlt (Antwort ohne', 1, 'v25 fruehes E-FREE-SHAPE statt Prosa-FORBID');
  eqS('Aufbau wie Standard-Modelle', 2, 'v26 Erklaerungs-Vertrag de/en/es (generate 3D + 2D)');
  eqS('Kein Proxy, kein muse.exe. Dein Key lebt nur mit deiner Zustimmung im sessionStorage.', 0, 'v26 Disclaimer de raus (Meta-Variante bleibt)');
  eqS('No proxy, no muse.exe. Your key lives only in sessionStorage with your consent.', 0, 'v26 Disclaimer en raus');
  eqS('Sin proxy, sin muse.exe. Tu clave solo vive en sessionStorage con tu permiso.', 0, 'v26 Disclaimer es raus');
  eqS('directHintMsg', 0, 'v26 Disclaimer-Computed/Template raus');
  eqS("this.t('directHint')", 0, 'v26 kein Verweis auf entfernten Key');
  eqS("this.t('promptCopied')", 1, 'v26 copyPrompt-Status zeigt promptCopied');
  eqS('E-FREE-META: parts (n=', 1, 'v26 Parts-Count mit Validierungsdetail');
  eqS('Label fehlt: ', 1, 'v26 Parts-Labelabgleich mit Detail');
  eqS('meta.parts=__parts;', 1, 'v26 Parts-Normalisierung');
  eqS('for(var ki=0;ki<meta.parts.length;ki++)', 0, 'v26 alte strikte Parts-Schleife ersetzt');
  eqS('diagramKind:function', 1, 'v26 2D-Auto-Klassifizierer');
  eqS('buildFreePrompt2D:function', 1, 'v26 2D-Vertrag im Prompt');
  eqS('FREIMODUS-2D', 1, 'v26 2D-Prompt');
  eqS('is3d: false', 1, 'v26 2D-Vertrag ohne 3D-Platzhalter');
  eqS('Strg+F5', 1, 'v21 stale-build hint');
  eqS('diagText:function', 1, 'v22 diagnose text (redigiert, ohne Key)');
  eqS('copyDiag:function', 1, 'v22 diagnose copy (Clipboard + Fallback)');
  eqS('copyDiagBtn', 5, 'v22 copy button (4 locales + template)');
  eqS('@click="copyDiag"', 1, 'v22 copy button im Fehlerzustand');
  eqS('this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 1, 'v26 max-Gate zentral in reasoningAllowed (nie -contributor)');
  eqS('logit_bias', 0, 'v17 no forbidden logits field');
  eqS('web_search_options', 0, 'v17 no forbidden search field');
  eqS('logprobs', 0, 'v17 no forbidden logprobs field');
  eqS('modalities', 0, 'v17 no forbidden modalities field');
  eqS('"stop"', 0, 'v17 no forbidden stop field');
  eqS('dev.meta.ai', 13, 'v17+v42 dashboard links (Meta hints + placeholder, 4x keyFormat + 4x keyMissing + 4x keyInvalid + Template)');
  eqS('keyMissingMeta', 5, 'v17 Meta key-missing text (4 locales + selector)');
  eqS('keyInvalidMeta', 5, 'v17 Meta 401 text (4 locales + selector)');
  eqS('keyFormatMeta', 5, 'v17 Meta LLM_ hint (4 locales + template)');
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
  // v14 (2D-Demo): 1 Demo-Modell + Vendor-IIFE + Dispatch + Payloads (seit v29 nur chart).
  if (!s.includes('standalone-build v14')) fail('v14 stamp is missing (standalone-build v14).');
  else ok('v14 stamp present (2D-Demo chart)');
  for (const id of ['demo-2d-chart']) {
    if (cnt(`{id:"${id}"`) < 1) fail(`v14 LABS entry missing: ${id}`);
    if (cnt(`META['${id}']`) < 1) fail(`v14 META entry missing: ${id}`);
    if (cnt(`INIT['${id}'] = `) !== 0) fail(`v14 2D must not have 3D-INIT: ${id}`);
  }
  ok('1 v14 LABS + 1 v14 META entry found (is3d:false, keine INITs)');
  for (const v of ['__V14SVG', '__V14MERMAID', '__V14CHART', '__V14D3', '__V14KATEX', '__renderVariant2D']) {
    if (cnt(v) < 3) fail(`v14 vendor/dispatcher missing: ${v}`);
  }
  ok('5 v14 Vendor-IIFE + __renderVariant2D vorhanden (fuer chart-Demo + 2D-Freimodus)');
  if (cnt('diagram2d:{"variant"') !== 1) fail(`v14 LABS diagram2d-Payload: ${cnt('diagram2d:{"variant"')}, erwartet 1`);
  else ok('v14 diagram2d-Payload: 1 LABS + 1 META');
  eqS('"2d-svg","2d-mermaid","2d-chart","2d-d3","2d-katex"', 1, 'registerFree 2d-Allowlist');
  // v15 (Bestandteil-Info): Stempel, explanations je LABS, Info-Button/Popup, Umbenennungen.
  if (!s.includes('standalone-build v15')) fail('v15 stamp is missing (standalone-build v15).');
  else ok('v15 stamp present (Bestandteil-Info)');
  v15PartInfo(s, fail, ok);
  // v29 (Modelliste): 5x 3D + 1x 2D-chart kuratiert, Umbenennungen si-1/gpu.
  eqS('PC-Arbeitsplatz (SI-1)', 0, 'v29 si-1 DE-Suffix weg');
  eqS('PC workstation (SI-1)', 0, 'v29 si-1 EN-Suffix weg');
  eqS('Puesto de PC (SI-1)', 0, 'v29 si-1 ES-Suffix weg');
  eqS('Graphics Card', 0, 'v29 gpu DE-Titel ersetzt');
  eqS('title:{de:"PC-Arbeitsplatz",en:"PC-Arbeitsplatz",es:"PC-Arbeitsplatz",fr:"Poste PC (SI-1)"}', 1, 'v29+v42 si-1 Titel de/en/es/fr');
  eqS('de:"Grafikkarte"', 1, 'v29 gpu DE-Titel Grafikkarte');
  eqS('{id:"demo-2d-svg"', 0, 'v29 Wasserkocher-Demo raus');
  eqS('{id:"demo-2d-mermaid"', 0, 'v29 Photosynthese-Demo raus');
  eqS('{id:"demo-2d-d3"', 0, 'v29 Rechnernetz-Demo raus');
  eqS('{id:"demo-2d-katex"', 0, 'v29 pq-Formel-Demo raus');
  if (artifactBytes > 600000) fail(`Artifact is too large: ${artifactBytes} bytes.`);
  else ok(`Artifact size ${artifactBytes} bytes (under 600 KB for GitHub Pages).`);
  if (failures.length > 0) {
    console.error(`verify-standalone: ABORT (showcase: ${failures.length} failures)`);
    process.exit(1);
  }
  console.log('verify-standalone: OK (showcase verified: 5 3D-Erststart-Defaults + 1 2D-Demo v14 (chart), Baseten-Direkt BYOK)');
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
