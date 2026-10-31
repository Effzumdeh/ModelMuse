/**
 * Standalone builder v15 (Bestandteil-Info + Erklaerungen, GitHub-Pages-faehig):
 * Erweitert das v14-Showcase-Artefakt additiv um fachliche Erlaeuterungen je
 * Listeneintrag. Laeuft NUR auf v14-Basis (Stempel vorhanden, showcase) und ist
 * idempotent (Zweitlauf meldet "bereits v15", exit 0).
 *
 * E1  LABS: explanations:{de,en,es} je gebuendeltem Modell aus
 *     src/models/manifests/*.json (gleiche Anzahl/Reihenfolge wie labels,
 *     Fallback en->de, es->en->de wie bei labels).
 * T1  Umbenennung: Bauteile->Bestandteile (de), Parts->Components (en),
 *     Piezas->Componentes (es) in I18N-Dikten + Hinweisen (Listentitel,
 *     Notiz, Aufgaben-Hints, Free-Flow-Hints).
 * T2  Info-Kreis-i-Button je Listeneintrag (rechts, v-if=Erklaerung vorhanden).
 * T3  Textbasiertes Overlay-Popup (role=dialog): Bestandtitel + Erklaerung +
 *     Schliessen-Button; oeffnet/schliesst ueber partInfoIndex.
 * T4  I18N-Keys partInfoTitle/partInfoAbout (de/en/es).
 * T5  Vue-Logik: data partInfoIndex, Methoden open/closePartInfo,
 *     Computed partExplanations, selectLab-Reset.
 * T6  makeFreeLab: explanations-Passthrough aus meta/meta_i18n
 *     (KI-Modelle liefern Format aus P1/P2; graceful leere Arrays).
 * V7  v15-Stempel + Invarianten (Groesse < 600 KB, 6 LABS mit explanations,
 *     Marker, Umbenennungen).
 *
 * Aufruf: node scripts/build-standalone-v15.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v15-report.json';
const IDS = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example',
  'demo-2d-chart'];

function must(cond, msg) {
  if (!cond) { console.error('build-v15: FEHLER ' + msg); process.exit(1); }
}
/** Klammer-Matching ab Index von '{' (string-sicher: '...' "..." `...`). */
function braceMatch(src, openIdx) {
  must(src[openIdx] === '{', 'braceMatch: kein {');
  let i = openIdx + 1; let depth = 1; let q = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (q) {
      if (c === String.fromCharCode(92)) { i += 2; continue; }
      if (c === q) q = null;
    } else if (c === "'" || c === '"' || c === '`') { q = c; }
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  must(depth === 0, 'braceMatch: kein schliessendes } gefunden');
  return i - 1;
}
const q = (x) => JSON.stringify(x);
const cnt = (s, sub) => s.split(sub).length - 1;

let s = await readFile(FILE, 'utf8');
console.log(`build-v15: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v14'), 'kein v14-Stempel (falsche Basis)');
if (s.includes('standalone-build v15')) {
  console.log('build-v15: bereits v15 — nichts zu tun (idempotent, exit 0)');
  process.exit(0);
}
for (const id of IDS) must(cnt(s, `{id:"${id}",track`) === 1, `${id}: LABS-Eintrag fehlt/mehrdeutig`);

// ---------- E1: explanations in LABS-Eintraege (je Lokale per Label-Index gemappt) ----------
/** Array-Literal zu Lokale aus einem labels-/explanations-Block lesen (Keys ggf. gequotet). */
function arrOf(block, loc) {
  const m = new RegExp(`"?${loc}"?:\\[`).exec(block);
  must(m, `arrOf: ${loc} fehlt`);
  let d = 0; let qi = null; let k = m.index + m[0].length - 1;
  for (; k < block.length; k += 1) {
    const c = block[k];
    if (qi) {
      if (c === '\\') { k += 1; continue; }
      if (c === qi) qi = null;
    } else if (c === '"' || c === "'") qi = c;
    else if (c === '[') d += 1;
    else if (c === ']') {
      d -= 1;
      if (d === 0) break;
    }
  }
  must(d === 0, `arrOf: ${loc} unbalanced`);
  const v = JSON.parse(block.slice(m.index + m[0].length - 1, k + 1));
  must(Array.isArray(v), `arrOf: ${loc} kein Array`);
  return v;
}
for (const id of IDS) {
  const man = JSON.parse(await readFile(`src/models/manifests/${id}.json`, 'utf8'));
  must(Array.isArray(man.labels) && man.labels.length >= 3, `${id}: Manifest-Labels fehlen`);
  must(Array.isArray(man.explanations) && man.explanations.length === man.labels.length, `${id}: Manifest-explanations fehlen/misaligned`);
  const en = man.i18n?.en ?? {};
  const es = man.i18n?.es ?? {};
  const expEn = Array.isArray(en.explanations) && en.explanations.length === man.labels.length ? en.explanations : man.explanations;
  const expEs = Array.isArray(es.explanations) && es.explanations.length === man.labels.length ? es.explanations : expEn;
  const manLab = { de: man.labels, en: en.labels ?? man.labels, es: es.labels ?? en.labels ?? man.labels };
  const manExp = { de: man.explanations, en: expEn, es: expEs };
  const start = s.indexOf(`{id:"${id}",track`);
  const end = braceMatch(s, start);
  const entry = s.slice(start, end + 1);
  must(!entry.includes('explanations:'), `${id}: explanations schon vorhanden`);
  const li = entry.indexOf('labels:{');
  must(li >= 0, `${id}: labels-Anker fehlt`);
  const lOpen = entry.indexOf('{', li + 'labels:'.length);
  const lEnd = braceMatch(entry, lOpen);
  // Artefakt-Labels je Lokale ueber Manifest-Index mappen (Snapshot darf
  // aelter sein als Manifest — unbekannte Labels brechen den Build ehrlich ab).
  const lab = { de: arrOf(entry.slice(lOpen, lEnd + 1), 'de'), en: arrOf(entry.slice(lOpen, lEnd + 1), 'en'), es: arrOf(entry.slice(lOpen, lEnd + 1), 'es') };
  const mapped = {};
  for (const loc of ['de', 'en', 'es']) {
    must(lab[loc].length >= 3, `${id}: LABS-labels zu kurz (${loc})`);
    mapped[loc] = lab[loc].map((name) => {
      const idx = manLab[loc].indexOf(name);
      must(idx >= 0, `${id}: LABS-Label fehlt im Manifest (${loc}): ${name}`);
      const txt = manExp[loc][idx];
      must(typeof txt === 'string' && txt.length >= 8 && txt.length <= 500, `${id}: Erklaerung fehlt/ungueltig (${loc}): ${name}`);
      return txt;
    });
  }
  const lit = `,explanations:{de:${q(mapped.de)},en:${q(mapped.en)},es:${q(mapped.es)}}`;
  must(!lit.includes('</script'), `${id}: script-Ende in Erklaerungen`);
  // Laengen-Deckung im Eintrag pruefen (LABS-labels vs Manifest).
  const labEntry = entry.slice(0, lEnd + 1) + lit + entry.slice(lEnd + 1);
  s = s.slice(0, start) + labEntry + s.slice(end + 1);
  console.log(`  E1 ${id}: explanations (${mapped.de.length} je Lokale)`);
}

// ---------- T1: Umbenennungen (I18N-Dikte + Hints) ----------
{
  const pairs = [
    ['partsTitle:"Bauteile"', 'partsTitle:"Bestandteile"'],
    ['partNote:"Schalter blendet Bauteile und Beschriftungen aus."', 'partNote:"Schalter blendet Bestandteile und Beschriftungen aus."'],
    ['partsTitle:"Parts"', 'partsTitle:"Components"'],
    ['partNote:"Switch toggles parts and annotations."', 'partNote:"Switch toggles components and annotations."'],
    ['partsTitle:"Piezas"', 'partsTitle:"Componentes"'],
    ['partNote:"El interruptor muestra u oculta piezas y etiquetas."', 'partNote:"El interruptor muestra u oculta componentes y etiquetas."'],
  ];
  for (const [a, b] of pairs) {
    must(cnt(s, a) === 1, `T1 Anker fehlt/mehrdeutig: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  const hints = [
    ['Nutze die Bauteilliste.', 'Nutze die Bestandteilliste.'],
    ['Use the parts list.', 'Use the components list.'],
    ['Usa la lista de piezas.', 'Usa la lista de componentes.'],
  ];
  for (const [a, b] of hints) {
    const n = cnt(s, a);
    must(n >= 10, `T1 Hints ${a}: ${n}, erwartet >=10`);
    s = s.split(a).join(b);
    console.log(`  T1 Hints: ${n}x ${a.slice(0, 30)}...`);
  }
  console.log('  T1: Bestandteil/Component/Componente');
}

// ---------- T2: Info-Button je Listeneintrag ----------
{
  const anchor = `<div v-for="(p,i) in overlayParts" :key="p+i" class="flex items-center gap-2">
<label class="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer"><input type="checkbox" :checked="!isPartHidden(p)" @change="togglePart(p)" class="h-6 w-6 min-h-[44px] min-w-[44px]" /><span>{{p}}</span></label>
</div>`;
  must(cnt(s, anchor) === 1, 'T2 Zeilen-Anker fehlt/mehrdeutig');
  const neu = `<div v-for="(p,i) in overlayParts" :key="p+i" class="flex items-center gap-2">
<label class="flex-1 min-w-0 flex items-center gap-2 text-sm min-h-[44px] cursor-pointer"><input type="checkbox" :checked="!isPartHidden(p)" @change="togglePart(p)" class="h-6 w-6 min-h-[44px] min-w-[44px]" /><span>{{p}}</span></label><button type="button" @click="openPartInfo(i)" v-if="partExplanations[i]" :aria-label="t('partInfoAbout')+': '+p" :title="t('partInfoAbout')+': '+p" class="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-indigo-700 dark:text-indigo-300 w-[44px] h-[44px] min-w-[44px] text-lg font-bold">ⓘ</button>
</div>`;
  s = s.replace(anchor, neu);
  console.log('  T2: Info-Buttons (Kreis-i, rechts)');
}

// ---------- T3: Overlay-Popup (textbasiert, role=dialog) ----------
{
  const anchor = `{{t('mappingNote')}}: {{mappingText()}}</p>
</div>`;
  must(cnt(s, anchor) === 1, 'T3 Popup-Anker fehlt/mehrdeutig');
  const popup = `{{t('mappingNote')}}: {{mappingText()}}</p>
<div v-if="partInfoIndex!==null" class="fixed bottom-4 right-4 z-50 w-[min(92vw,24rem)] rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4" role="dialog" :aria-label="t('partInfoTitle')">
<h3 class="font-bold mb-1">{{t('partInfoTitle')}}: {{overlayParts[partInfoIndex]}}</h3>
<p class="text-sm text-slate-700 dark:text-slate-200">{{partExplanations[partInfoIndex]}}</p>
<div class="mt-3 flex justify-end">
<button type="button" @click="closePartInfo" class="inline-flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 px-4 min-h-[44px] text-sm font-semibold">{{t('genClose')}}</button>
</div>
</div>
</div>`;
  s = s.replace(anchor, popup);
  console.log('  T3: Info-Popup (role=dialog)');
}

// ---------- T4: I18N-Keys ----------
{
  const t = [
    ['I18N.de.modifyOpen="Überarbeiten";', 'I18N.de.modifyOpen="Überarbeiten";I18N.de.partInfoTitle="Bestandteil-Info";I18N.de.partInfoAbout="Info zum Bestandteil";'],
    ['I18N.en.modifyOpen="Revise";', 'I18N.en.modifyOpen="Revise";I18N.en.partInfoTitle="Component info";I18N.en.partInfoAbout="About this component";'],
    ['modifyOpen:"Revisar"', 'modifyOpen:"Revisar",partInfoTitle:"Información del componente",partInfoAbout:"Acerca de este componente"'],
  ];
  for (const [a, b] of t) {
    must(cnt(s, a) === 1, `T4 Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  console.log('  T4: partInfoTitle/partInfoAbout (de/en/es)');
}

// ---------- T5: Vue-Logik ----------
{
  let a = 'selectLab:function(id){this.activeLabId=id;this.partsHidden=[];';
  must(cnt(s, a) === 1, 'T5 selectLab-Anker fehlt');
  s = s.replace(a, 'selectLab:function(id){this.activeLabId=id;this.partsHidden=[];this.partInfoIndex=null;');
  a = '\npartsHidden:[],\n';
  must(cnt(s, a) === 1, 'T5 Data-Anker fehlt');
  s = s.replace(a, '\npartsHidden:[],\npartInfoIndex:null,\n');
  a = 'overlayParts:function(){var a=this.activeLab;if(!a||!a.labels){return[];}var l=a.labels[this.lang]||a.labels.de||a.labels.en||[];return Array.isArray(l)?l.slice():[];},';
  must(cnt(s, a) === 1, 'T5 overlayParts-Anker fehlt');
  s = s.replace(a, a + '\npartExplanations:function(){var a=this.activeLab;if(!a||!a.explanations){return[];}var e=a.explanations[this.lang]||a.explanations.de||a.explanations.en||[];return Array.isArray(e)?e.slice():[];},');
  a = 'isPartHidden:function(name){return this.partsHidden.indexOf(name)!==-1;},';
  must(cnt(s, a) === 1, 'T5 isPartHidden-Anker fehlt');
  s = s.replace(a, a + '\nopenPartInfo:function(i){this.partInfoIndex=i;},\nclosePartInfo:function(){this.partInfoIndex=null;},');
  console.log('  T5: partInfoIndex + open/close + partExplanations + Reset');
}

// ---------- T6: makeFreeLab-Passthrough ----------
{
  const a = 'var partsEs=(metaI18n&&metaI18n.es&&Array.isArray(metaI18n.es.parts)&&metaI18n.es.parts.length===parts.length)?metaI18n.es.parts.slice():partsEn.slice();';
  must(cnt(s, a) === 1, 'T6 makeFreeLab-Anker fehlt');
  s = s.replace(a, a + 'var expDe=(meta&&Array.isArray(meta.explanations)&&meta.explanations.length===parts.length)?meta.explanations.slice():null;var expEn=(metaI18n&&metaI18n.en&&Array.isArray(metaI18n.en.explanations)&&metaI18n.en.explanations.length===parts.length)?metaI18n.en.explanations.slice():(expDe||[]).slice();var expEs=(metaI18n&&metaI18n.es&&Array.isArray(metaI18n.es.explanations)&&metaI18n.es.explanations.length===parts.length)?metaI18n.es.explanations.slice():(expDe||[]).slice();');
  const b = 'labels:{de:parts,en:partsEn,es:partsEs},tasks:';
  must(cnt(s, b) === 1, 'T6 LABS-Anker fehlt');
  s = s.replace(b, 'labels:{de:parts,en:partsEn,es:partsEs},explanations:{de:expDe||[],en:expEn||[],es:expEs||[]},tasks:');
  console.log('  T6: makeFreeLab explanations-Passthrough');
}

// ---------- V7: Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v14 (2D-Variante: chart als Vendor-IIFE + Dispatcher + 1 Demo-Modell Wirkungsgradvergleich, via scripts/build-standalone-v14.mjs) -->';
  must(cnt(s, stamp) === 1, 'V7 Stempel-Anker fehlt');
  s = s.replace(stamp, `${stamp}\n<!-- standalone-build v15 (Bestandteil-Info: Info-Kreis-i-Button je Listeneintrag + Overlay-Popup + explanations de/en/es, via scripts/build-standalone-v15.mjs) -->`);
  console.log('  V7: v15-Stempel');
}
{
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15', 1],
    ['PointLight(0xffffff, 900', 0], ['0x11141a', 0], ['envMapIntensity', 0],
    ['mapSize.set(2048', 0], ['openrouter', 26], ['OpenRouter', 12],
    ['explanations:{de:[', 6], // 6 LABS-Eintraege (5x 3D + 1x 2D-chart, seit v29)
    ['explanations:{de:expDe', 1], // makeFreeLab-Passthrough
    ['openPartInfo', 2], // Template-Click + Methode
    ['closePartInfo', 2], // Template-Click + Methode
    ['partInfoIndex', 7], // data + reset + open + close + template-v-if + titel + text
    ['partInfoTitle', 5], // 3 I18N + aria + h3
    ['partInfoAbout', 5], // 3 I18N + aria + title
    ['partExplanations', 3], // computed + v-if + text
    ['partsTitle:"Bestandteile"', 1], ['partsTitle:"Components"', 1], ['partsTitle:"Componentes"', 1],
    ['partsTitle:"Bauteile"', 0], ['partsTitle:"Parts"', 0], ['partsTitle:"Piezas"', 0],
    ['Nutze die Bauteilliste.', 0], ['Use the parts list.', 0], ['Usa la lista de piezas.', 0],
    ['role="dialog"', 2], // Modify-Overlay + Info-Popup
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, `Invariante ${sub}: ${cnt(s, sub)}, erwartet ${want}`);
  for (const id of IDS) {
    must(cnt(s, `META['${id}']`) >= 1, `META ${id} fehlt`);
  }
  must(s.length < 600000, `Datei zu gross: ${s.length}`);
  console.log('  Invarianten ok');
}

await writeFile(FILE, s);
console.log(`build-v15: geschrieben (${s.length} Zeichen)`);
if (REPORT) {
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v14-showcase',
    standalone: 'v15',
    fixes: ['E1 explanations de/en/es in 6 LABS (aus Manifesten)', 'T1 Bestandteil/Component/Componente (Titel+Notiz+Hints)', 'T2 Info-Kreis-i-Button je Eintrag', 'T3 Overlay-Popup role=dialog', 'T4 I18N-Keys', 'T5 Vue-Logik + selectLab-Reset', 'T6 makeFreeLab-Passthrough', 'V7 Stempel + Invarianten'],
    counts: {
      zeichen: s.length,
      labs: IDS.map((id) => ({ id, labs: cnt(s, `{id:"${id}"`), meta: cnt(s, `META['${id}']`) })),
    },
  };
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('build-v15: OK v15');
} else {
  console.log('build-v15: DRY-RUN ok (kein Report geschrieben)');
}
