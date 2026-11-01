/**
 * Standalone builder v42 (FR-Portierung ins Standalone-Release, GitHub-Pages-faehig):
 * Baut auf dem v41-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Stand: FR existiert nur in der Dev-Shell (src/shell/i18n/fr.json, Modelle fr,
 * Prompt 4-sprachig); das Standalone-Artefakt kennt nur DE/EN/ES.
 *
 * Umsetzung (nur Standalone-Artefakt; Kette nie umschreiben):
 * F1  FR-Button in der Kopfzeile (DE/EN/ES + FR) + I18N.fr-Dict (135 Keys,
 *     Wortlaut analog de/en/es, Tutoiement wie fr.json).
 * F2  LABS fr-Modellinhalte je gebuendeltem Modell (6x arch/si-1/chemie-koffein/
 *     free-handbohrmaschine/gpu-example/demo-2d-chart): title/objectives/labels/
 *     explanations/measurements.text/tasks.prompt+hint/quiz aus
 *     src/models/manifests/*.json i18n.fr (Single Source of Truth, Build liest).
 * F3  META fr: const meta_i18n_<id> (5x, aus src/models/*.js) + makeFreeLab
 *     (titleFr/partsFr/expFr/measTextFr + fr-Member) + FR-Anreicherung (FR-Map +
 *     fr-Fallbacks, analog V9-ES-Block). __SOURCES-Quelltexte bleiben unberuehrt
 *     (verbatim Source-Spiegel, wie en/es dort auch stale sein koennen).
 * F4  Standalone-Prompt 4-sprachig (buildFreePrompt 3D + buildFreePrompt2D):
 *     loc-Gate fr, meta_i18n-Vertrag en/es/fr, explanations-Vertrag en/es/fr.
 * F5  UI-Fallbacks fr: localStorage-Lang-Gate, Suche (filteredLabs),
 *     Empty-Lab, diagText/teleBlock FR-Zweige.
 * F6  Stempel v42 + Invarianten (Alt-Zaehler mit fr-+1) + Syntax-Gate.
 *
 * Aufruf: node scripts/build-standalone-v42.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v42-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v42: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}
function repAll(s, oldStr, newStr, want, label) {
  must(cnt(s, oldStr) === want, label + ': ' + cnt(s, oldStr) + ' statt ' + want);
  return s.split(oldStr).join(newStr);
}
/** Klammer-Matching ab Index von '{' (string-sicher: '...' "..." `...`, \-Escapes). */
function braceMatch(src, openIdx) {
  must(src[openIdx] === '{', 'braceMatch: kein { bei ' + openIdx);
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
  must(depth === 0, 'braceMatch: kein schliessendes } gefunden');
  return i - 1;
}
/** Eckige-Klammer-Matching ab Index von '[' (string-sicher). */
function bracketMatch(src, openIdx) {
  must(src[openIdx] === '[', 'bracketMatch: kein [ bei ' + openIdx);
  let i = openIdx + 1; let depth = 1; let q = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null;
    } else if (c === "'" || c === '"' || c === '`') { q = c; }
    else if (c === '[') depth += 1;
    else if (c === ']') depth -= 1;
    i += 1;
  }
  must(depth === 0, 'bracketMatch: kein schliessendes ] gefunden');
  return i - 1;
}

/** Syntax-Gate wie v26-v41 (iterativ, kein Split wegen <script in Regex-Literalen). */
function assertInlineScriptsParse(s) {
  const dir = mkdtempSync(join(tmpdir(), 'v42-syn-'));
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
          console.error('build-v42: Syntax-Detail ' + detail.slice(-500));
          try { copyFileSync(f, join(tmpdir(), 'v42-inline-' + n + '.js')); } catch {}
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

// ---------- FR-Daten (UILabels: Wortlaut analog de/en/es, Tutoiement) ----------
const FR = {
  searchPlaceholder: 'Rechercher des modèles …',
  labs: 'Modèles',
  noResults: 'Aucun modèle trouvé. Ajuste ta recherche.',
  emptyLibrary: 'Aucun modèle enregistré, utilise le générateur.',
  viewportTitle: 'Vue 3D',
  viewLabel: 'Vue',
  viewOverview: "Vue d'ensemble",
  viewDetail: 'Détail',
  viewFront: 'Face',
  viewTop: 'Dessus',
  mode2d: 'Mode 2D',
  mode3d: 'Mode 3D',
  diagramNote: 'Diagramme 2D actif – 3D disponible en option.',
  is3dReason: 'Diagrammes/tableaux/processus → 2D, sinon 3D.',
  showLabels: 'Étiquettes',
  showMeasures: 'Cotes',
  saveModel: 'Enregistrer',
  saveGlb: 'GLB (modèle 3D)',
  savePng: 'PNG (vue actuelle)',
  saveSvg: 'SVG (vecteur)',
  saveOk: '{f} enregistré.',
  saveErr: "Échec de l'enregistrement : {f}",
  saveNone: 'Aucun modèle chargé.',
  saveNoSvg: 'Pas de SVG pour cette vue.',
  webglFallback: 'WebGL indisponible – repli 2D actif (vérifié auto, avec limitation).',
  understood: 'Compris',
  onboarding: 'Bienvenue sur ModelMuse ! Choisis un modèle à gauche ou génère ton propre modèle.',
  dark: 'Sombre',
  light: 'Clair',
  themeLabel: 'Thème',
  languageLabel: 'Langue',
  resetSearch: 'Réinitialiser la recherche',
  appTitle: 'Générateur ModelMuse',
  viewerBadge: 'Modèles v13-standalone',
  generatorTitle: 'Générateur',
  generatorHint: 'Choisis le fournisseur et le modèle, saisis ta clé et crée un nouveau modèle.',
  genPromptLabel: 'Description',
  genPromptPlaceholder: 'p. ex. perceuse vue à trois mètres …',
  providerLabel: 'Fournisseur',
  modelLabel: 'Modèle',
  proxyUrlLabel: 'URL du proxy',
  keyLabel: 'Clé API',
  keyConsent: 'Garder la clé pour cette session seulement (sessionStorage)',
  proxyHint: 'Pas de proxy. La requête va directement à Baseten.',
  museHint: 'Pas de muse.exe dans ce flux.',
  generateBtn: 'Générer',
  copyPromptBtn: 'Copier le prompt',
  promptCopied: 'Prompt copié dans le presse-papiers.',
  copyDiagBtn: 'Copier le diagnostic',
  diagCopied: 'Diagnostic copié (sans clé).',
  museNoPrompt: "Saisis d'abord une description.",
  termTooShort: 'Terme trop court. Saisis au moins 2 caractères.',
  loadedFree: 'Labo libre chargé : ',
  sourceOmitted: 'Source trop volumineuse, non enregistrée. Le modèle reste chargé.',
  proxyOffline: 'Hors ligne. Vérifie ton réseau.',
  badSource: 'Source invalide ou inutilisable.',
  overlayTitle: 'Calques',
  partsTitle: 'Composants',
  partNote: 'Le commutateur affiche ou masque les composants et les étiquettes.',
  collapse: 'Réduire',
  expand: 'Déplier',
  exampleLoad: "Charger l'exemple",
  genDetails: 'Détails',
  footerNote: 'Standalone · Client seul.',
  footerAttrib: 'Attribution : three.js 0.186.1 (MIT) · Vue 3 (MIT) · Tailwind CSS (MIT) · Inter Font (SIL OFL 1.1). Textes de licence complets et provenance : docs/LIZENZEN.md',
  directHintMeta: 'Appel direct à Meta Muse dans ton navigateur (compatible OpenAI). Sans proxy. Ta clé ne vit en sessionStorage que si tu y consens.',
  keyFormatMeta: 'La clé Meta commence par LLM_... (tableau de bord : dev.meta.ai).',
  keyFormatOpenrouter: 'Clé OpenRouter (openrouter.ai/keys) — cette session seulement.',
  keyMissing: 'Clé Baseten manquante. Colle ta clé ci-dessus.',
  keyStoredSession: 'Clé gardée pour cette session seulement (sessionStorage).',
  keyStoredLocal: 'Clé enregistrée durablement (localStorage).',
  keyMissingOpenrouter: 'Clé OpenRouter manquante. Récupère ta clé ci-dessus (openrouter.ai/keys).',
  keyMissingMeta: 'Clé Meta (LLM_...) manquante. Colle ta clé ci-dessus (dev.meta.ai).',
  keyInvalid: 'Clé erronée (401). Vérifie ta clé Baseten.',
  keyInvalidOpenrouter: 'Clé erronée (401). Vérifie ta clé OpenRouter (openrouter.ai/keys).',
  keyInvalidMeta: 'Clé erronée (401). Vérifie ta clé Meta (LLM_... de dev.meta.ai).',
  apiTimeout: 'Délai dépassé (120 s). Réessaie.',
  emptyResponse: 'Réponse vide. Réessaie.',
  networkError: 'Erreur réseau. Vérifie ta connexion.',
  providerFixed: 'Baseten',
  reasoningLabel: 'Profondeur de réflexion',
  reasoningStd: 'Standard',
  reasoningMax: 'Max (1.3/wonder seulement)',
  reasoningHigh: 'Haute (xhigh)',
  genRunning: 'Génération en cours …',
  genStop: 'Arrêter',
  genReady: 'Modèle prêt',
  genSelect: 'Choisir',
  genClose: 'Fermer',
  modifyTitle: 'Retoucher le modèle',
  genEta: 'env. 1 minute · encore {s} s',
  genPatient: 'Les modèles complexes prennent parfois un peu plus de temps. Patiente encore un moment.',
  modEta: 'env. 1 minute · encore {s} s',
  modPatient: 'Les modèles complexes prennent parfois un peu plus de temps. Patiente encore un moment.',
  genJobsTitle: 'Tâches',
  genStopped: 'Arrêté.',
  jobWaiting: 'en attente',
  jobRunning: 'en cours',
  jobDone: 'prêt',
  jobError: 'erreur',
  genOver: 'plus lent que prévu · +{s} s',
  modOver: 'plus lent que prévu · +{s} s',
  genTotal: 'prêt après {s} s',
  modTotal: 'prêt après {s} s',
  jobGen: 'Nouveau',
  jobMod: 'Retoucher',
  genEtaLong: 'env. 4 minutes · encore {s} s',
  modEtaLong: 'env. 4 minutes · encore {s} s',
  genEstimate: 'env. {d} s · ~{p} (estimation par télémétrie)',
  modifyHint: 'Modifier le modèle généré actuel via LLM : le labo est présélectionné, décris le changement, le résultat se recharge.',
  modDescPh: 'p. ex. carter rouge, deux fois plus grand',
  modifyBtn: 'Retoucher le modèle',
  modTooShort: 'Saisis le changement souhaité (2 caractères min).',
  modNoSource: 'Réservé aux labos générés (avec source) — les labos soignés sont la référence.',
  modDone: 'Retouche chargée.',
  modifyOpen: 'Retoucher',
  deleteLab: 'Supprimer',
  deleteConfirm: 'Vraiment supprimer ce modèle ?',
  partInfoTitle: 'Info composant',
  partInfoAbout: 'À propos du composant',
  partInfoMissing: "Pas encore d'explication pour ce composant.",
  teleTitle: 'Partager la télémétrie (volontaire)',
  teleAsk: 'Génération réussie ! Partager la télémétrie ? Modèle, fournisseur, raisonnement, prompt, codes usage/HTTP et durée – sans clé.',
  teleYes: 'Oui, partager',
  teleNo: 'Non',
  teleRate: 'Que vaut ce modèle ? Choisis des étoiles, ajoute un commentaire, copie le bloc.',
  teleCommentPh: 'Commentaire (facultatif, 500 caractères max)',
  teleCopy: 'Copier la télémétrie',
  teleCopied: 'Copié (sans clé).',
  teleThanks: 'Merci pour ta contribution !',
  teleCopyFail: 'Copie impossible.',
  teleIssue: 'Ensuite, signale-le comme issue :',
  teleIssueLink: 'Ouvrir une issue sur GitHub',
  jobQueue: 'Place {n}',
  jobDoneHint: 'Terminé avec succès – voir la bibliothèque.',
};

/** ASCII-sicheres Escaping (Stil I18N.es-Dict): " bleibt, non-ASCII -> \uXXXX. */
function escA(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '"';
}
/** LABS-Escaping (Stil LABS-Eintraege): raw UTF-8, nur \ und " escapen. */
function escL(v) {
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
}
const escArr = (arr, esc) => '[' + arr.map(esc).join(',') + ']';

const HINTS_FR = {
  zuordnung: ['Trouve la pièce dans la vue.', 'Utilise la liste des composants.', 'Zoome sur la pièce.'],
  messwert: ['Trouve la ligne de cote.', "Lis le nombre et l'unité.", 'Vérifie mm/cm/m.'],
  profi: ['Pense à la fonction principale.', 'Relie forme et tâche.', 'Explique en une phrase.'],
};
const hintsFrFor = (type) => (type === 'messwert' ? HINTS_FR.messwert : type === 'zuordnung' ? HINTS_FR.zuordnung : HINTS_FR.profi);

function checkInvariants(s) {
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1],
    ['standalone-build v15a', 1], ['standalone-build v16', 1], ['standalone-build v17', 1],
    ['standalone-build v18', 1], ['standalone-build v19', 1], ['standalone-build v20', 1],
    ['standalone-build v21', 1], ['standalone-build v22', 1], ['standalone-build v23', 1],
    ['standalone-build v24', 1], ['standalone-build v25', 1], ['standalone-build v26', 1],
    ['standalone-build v27', 1], ['standalone-build v28', 1], ['standalone-build v29', 1],
    ['standalone-build v30', 1], ['standalone-build v31', 1], ['standalone-build v32', 1],
    ['standalone-build v33', 1], ['standalone-build v34', 1], ['standalone-build v35', 1],
    ['standalone-build v36', 1], ['standalone-build v37', 1], ['standalone-build v38', 1],
    ['standalone-build v39', 1], ['standalone-build v40', 1], ['standalone-build v41', 1],
    ['standalone-build v42', 1],
    // F1: FR-Button + fr-Dict.
    ['>FR</button>', 1], ["setLang('fr')", 1], ['I18N.fr={', 1],
    // F4: Prompt 4-sprachig.
    ["(locale==='en'||locale==='es'||locale==='fr')?locale:'de'", 1],
    ['(locale==="en"||locale==="es"||locale==="fr")?locale:"de"', 1],
    ['fr: { title, parts: [...] }', 2],
    ['en.explanations + es.explanations + fr.explanations als', 2],
    // F2/F3: LABS/META fr (6 Modelle je Feld, 5 meta_i18n-Konstanten).
    ['titleFr', 6], ['partsFr', 12], ['expFr', 2], ['measTextFr', 3],
    ['const meta_i18n_arch_brandenburger_tor = {', 1], ['const meta_i18n_si_1 = {', 1],
    ['const meta_i18n_chemie_koffein = {', 1], ['const meta_i18n_free_handbohrmaschine = {', 1],
    ['const meta_i18n_gpu_example = {', 1],
    // E: I18N-Keys je Sprache genau 4x (de/en/es/fr).
    ['saveModel:', 4], ['saveGlb:', 4], ['savePng:', 4], ['saveSvg:', 4],
    ['saveOk:', 4], ['saveErr:', 4], ['saveNone:', 4], ['saveNoSvg:', 4],
    // E: FR-Anreicherung + Fallbacks.
    ['var FR={', 1], ['title.fr', 4], ['labels.fr', 3],
    // O: OpenRouter-Kette intakt (v38-Nachfolger).
    ['id:"openrouter"', 1], ['https://openrouter.ai/api/v1', 1],
    ['openai/gpt-6.1-sol', 1], ['meta/muse-spark-1.3', 1], ['anthropic/claude-opus-5.5', 1],
    // Alt-Gates: Zaehler mit fr-+1.
    ['reasoningAllowed', 7], ['xhighAllowed', 6], ['reasoningDefault', 6],
    ['reasoning_effort', 10],
    ['reasoning_effort="xhigh"', 2],
    ['genReasoning:"xhigh"', 1],
    ['this.genModel==="muse-spark-1.3"||this.genModel==="muse-wonder-1.0"', 1],
    ['||this.genProvider==="openrouter"', 2],
    ['this.genProvider==="openrouter"?"xhigh":"max"', 1],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('reasoningHigh'), 'reasoningHigh fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v42 FR-Portierung + Alt-Zaehler)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v42: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v41-export',
    standalone: 'v42',
    befund: [
      'FR existiert nur in der Dev-Shell (fr.json, Modelle fr, Prompt 4-sprachig); Standalone-Artefakt kennt nur DE/EN/ES.',
      'Standalone-UI (flache I18N-Keys), LABS-Eintraege, META (meta_i18n + makeFreeLab) und Inline-Prompts (3D+2D) je Sprache hartverdrahtet.',
    ],
    fixes: [
      'F1 FR-Button (Kopfzeile) + I18N.fr-Dict (135 Keys, Tutoiement)',
      'F2 LABS fr je Modell (title/objectives/labels/explanations/measurements/tasks/quiz aus Manifest-i18n.fr)',
      'F3 META fr (meta_i18n-Konstanten + makeFreeLab + FR-Anreicherung mit fr-Fallbacks)',
      'F4 Prompts 4-sprachig (loc-Gate fr, meta_i18n- + explanations-Vertrag en/es/fr)',
      'F5 UI-Fallbacks fr (Lang-Gate, Suche, Empty-Lab, diagText/teleBlock)',
      'F6 Stempel v42 + Invarianten + Syntax-Gate',
    ],
    counts: { zeichen: s.length },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log('build-v42: Basis ' + s.length + ' Zeichen');
must(s.includes('standalone-build v41'), 'kein v41-Stempel (falsche Basis)');
if (s.includes('standalone-build v42')) {
  assertInlineScriptsParse(s);
  checkInvariants(s);
  console.log('build-v42: bereits v42 - ok (idempotent, exit 0)');
  process.exit(0);
}

// ---------- F1: FR-Button in der Kopfzeile ----------
{
  const anchor = '<button type="button" @click="setLang(\'es\')"'
    + ' :class="lang===\'es\'?\'bg-indigo-600 text-white\':\'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100\'"'
    + ' class="px-4 rounded-xl font-semibold min-h-[44px] min-w-[44px] transition-all hover:opacity-90">ES</button>';
  const frBtn = '<button type="button" @click="setLang(\'fr\')"'
    + ' :class="lang===\'fr\'?\'bg-indigo-600 text-white\':\'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100\'"'
    + ' class="px-4 rounded-xl font-semibold min-h-[44px] min-w-[44px] transition-all hover:opacity-90">FR</button>';
  s = rep1(s, anchor, anchor + '\r\n' + frBtn, 'F1 FR-Button');
  console.log('  F1: FR-Button nach ES-Button');
}

// ---------- F1: I18N.fr-Dict nach dem es-Dict ----------
{
  const tail = 'jobDoneHint:"Completado con éxito – ver biblioteca."};\r\nif(typeof Vue===\'undefined\')';
  const frKeys = Object.keys(FR);
  must(frKeys.length === 135, 'FR-Dict unvollstaendig: ' + frKeys.length);
  const frDict = '\r\nI18N.fr={' + frKeys.map((k) => k + ':' + escA(FR[k])).join(',') + '};';
  s = rep1(s, tail, 'jobDoneHint:"Completado con éxito – ver biblioteca."};' + frDict + '\r\nif(typeof Vue===\'undefined\')', 'F1 I18N.fr-Dict');
  console.log('  F1: I18N.fr-Dict (' + frKeys.length + ' Keys)');
}

// ---------- F5: UI-Fallbacks fr ----------
s = rep1(s,
  'if(lng==="de"||lng==="en"||lng==="es"){this.lang=lng;}',
  'if(lng==="de"||lng==="en"||lng==="es"||lng==="fr"){this.lang=lng;}',
  'F5 Lang-Gate localStorage');
s = rep1(s,
  '(l.title.de+" "+l.title.en+" "+(l.title.es||"")+" "+l.id+" "+l.track)',
  '(l.title.de+" "+l.title.en+" "+(l.title.es||"")+" "+(l.title.fr||"")+" "+l.id+" "+l.track)',
  'F5 Suche filteredLabs');
s = rep1(s,
  'title:{de:"Keine Modelle",en:"No models",es:"Sin modelos"}',
  'title:{de:"Keine Modelle",en:"No models",es:"Sin modelos",fr:"Aucun modèle"}',
  'F5 Empty-Lab Titel');
s = rep1(s,
  'title:{de:"Keine Modelle",en:"No models",es:"Sin modelos",fr:"Aucun modèle"},objectives:{de:[],en:[],es:[]}',
  'title:{de:"Keine Modelle",en:"No models",es:"Sin modelos",fr:"Aucun modèle"},objectives:{de:[],en:[],es:[],fr:[]}',
  'F5 Empty-Lab objectives');
s = rep1(s,
  'measurements:[],labels:{de:[],en:[],es:[]}',
  'measurements:[],labels:{de:[],en:[],es:[],fr:[]}',
  'F5 Empty-Lab labels');
s = rep1(s,
  '(L==="es")?"ModelMuse diagnostico (editado, sin clave).":((L==="en")?"ModelMuse diagnostics (redacted, no key).":"ModelMuse Diagnose (redigiert, ohne Key).")',
  '(L==="fr")?"ModelMuse diagnostic (édité, sans clé).":((L==="es")?"ModelMuse diagnostico (editado, sin clave).":((L==="en")?"ModelMuse diagnostics (redacted, no key).":"ModelMuse Diagnose (redigiert, ohne Key)."))',
  'F5 diagText head');
s = rep1(s,
  '}else if(L==="es"){nl="(no enviado)";nn="(ninguno)";nt="(ninguna)";yy="s\\u00ed";nn2="no";}',
  '}else if(L==="es"){nl="(no enviado)";nn="(ninguno)";nt="(ninguna)";yy="s\\u00ed";nn2="no";}else if(L==="fr"){nl="(non envoyé)";nn="(aucun)";nt="(aucune)";yy="oui";nn2="non";}',
  'F5 diagText nl-Zweig');
s = rep1(s,
  'var head=L==="en"?"ModelMuse telemetry (voluntary, no key).":(L==="es"?"ModelMuse telemetría (voluntaria, sin clave).":"ModelMuse Telemetrie (freiwillig, ohne Key).");',
  'var head=L==="fr"?"ModelMuse télémétrie (volontaire, sans clé).":(L==="en"?"ModelMuse telemetry (voluntary, no key).":(L==="es"?"ModelMuse telemetría (voluntaria, sin clave).":"ModelMuse Telemetrie (freiwillig, ohne Key)."));',
  'F5 teleBlock head');
console.log('  F5: UI-Fallbacks (Lang-Gate, Suche, Empty-Lab, diagText, teleBlock)');

// ---------- F4: Prompts 4-sprachig ----------
s = rep1(s,
  "buildFreePrompt2D:function(term,locale,dk){var loc=(locale==='en'||locale==='es')?locale:'de';",
  "buildFreePrompt2D:function(term,locale,dk){var loc=(locale==='en'||locale==='es'||locale==='fr')?locale:'de';",
  'F4 loc-Gate 2D');
s = rep1(s,
  'var loc=(locale==="en"||locale==="es")?locale:"de";',
  'var loc=(locale==="en"||locale==="es"||locale==="fr")?locale:"de";',
  'F4 loc-Gate 3D');
s = repAll(s,
  '{ en: { title, parts: [...] }, es: { title, parts: [...] } } mit fachgerechten',
  '{ en: { title, parts: [...] }, es: { title, parts: [...] }, fr: { title, parts: [...] } } mit fachgerechten',
  2, 'F4 meta_i18n-Vertrag 3D+2D');
s = repAll(s,
  'en.explanations + es.explanations als',
  'en.explanations + es.explanations + fr.explanations als',
  2, 'F4 explanations-Vertrag 3D+2D');
console.log('  F4: Prompts 4-sprachig (loc-Gates, meta_i18n- + explanations-Vertrag)');

// ---------- F2: LABS fr je Modell (aus Manifest-i18n.fr) ----------
const IDS = ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example', 'demo-2d-chart'];
function entryOf(src, id) {
  const st = src.indexOf('{id:"' + id + '",track');
  must(st >= 0, 'LABS-Eintrag fehlt: ' + id);
  const end = braceMatch(src, st);
  return { start: st, end, text: src.slice(st, end + 1) };
}
/** Haengt fr-Literal an eine {de:..,en:..,es:..}-Map an (Quoting-Stil auto). */
function injectFrMap(entryText, mapKey, frLiteral, scopeFrom = 0) {
  const key = mapKey + ':{';
  const at = entryText.indexOf(key, scopeFrom);
  must(at >= 0, 'LABS-Map fehlt: ' + mapKey);
  must(entryText.indexOf(key, at + 1) < 0, 'LABS-Map mehrdeutig: ' + mapKey);
  const open = entryText.indexOf('{', at + mapKey.length + 1);
  const end = braceMatch(entryText, open);
  const quoted = entryText[open + 1] === '"';
  const ins = ',' + (quoted ? '"fr":' : 'fr:') + frLiteral;
  return entryText.slice(0, end) + ins + entryText.slice(end);
}
function injectFrMapAfter(entryText, fromIdx, mapKey, frLiteral) {
  const key = mapKey + ':{';
  const at = entryText.indexOf(key, fromIdx);
  must(at >= 0, 'LABS-Map fehlt ab Offset: ' + mapKey);
  const open = entryText.indexOf('{', at + mapKey.length + 1);
  const end = braceMatch(entryText, open);
  const quoted = entryText[open + 1] === '"';
  const ins = ',' + (quoted ? '"fr":' : 'fr:') + frLiteral;
  return entryText.slice(0, end) + ins + entryText.slice(end);
}
for (const id of IDS) {
  const man = JSON.parse(await readFile('src/models/manifests/' + id + '.json', 'utf8'));
  const fr = man.i18n && man.i18n.fr;
  must(fr && fr.title && Array.isArray(fr.labels) && Array.isArray(fr.explanations)
    && Array.isArray(fr.objectives) && Array.isArray(fr.measurements) && Array.isArray(fr.tasks),
  'Manifest-i18n.fr unvollstaendig: ' + id);
  let e = entryOf(s, id).text;
  e = injectFrMap(e, 'title', escL(fr.title));
  e = injectFrMap(e, 'objectives', escArr(fr.objectives, escL));
  e = injectFrMap(e, 'labels', escArr(fr.labels, escL));
  e = injectFrMap(e, 'explanations', escArr(fr.explanations, escL));
  for (const mm of fr.measurements) {
    const at = e.indexOf('{id:"' + mm.id + '",text:{');
    must(at >= 0, 'Measurement fehlt: ' + id + '/' + mm.id);
    const open = e.indexOf('{', at + ('{id:"' + mm.id + '",text:').length);
    const end = braceMatch(e, open);
    const quoted = e[open + 1] === '"';
    e = e.slice(0, end) + ',' + (quoted ? '"fr":' : 'fr:') + escL(mm.text) + e.slice(end);
  }
  for (const t of fr.tasks) {
    const at = e.indexOf('{id:"' + t.id + '",');
    must(at >= 0, 'Task fehlt: ' + id + '/' + t.id);
    const typeM = /type:"([a-z]+)"/.exec(e.slice(at, at + 200));
    const type = typeM ? typeM[1] : 'zuordnung';
    e = injectFrMapAfter(e, at, 'prompt', escL(t.prompt));
    const hat = e.indexOf('hints:{', at);
    must(hat >= 0, 'Hints fehlt: ' + id + '/' + t.id);
    const hopen = e.indexOf('{', hat + 6);
    const hend = braceMatch(e, hopen);
    const hquoted = e[hopen + 1] === '"';
    e = e.slice(0, hend) + ',' + (hquoted ? '"fr":' : 'fr:') + escArr(hintsFrFor(type), escL) + e.slice(hend);
  }
  // Quiz fr aus Titel/Parts ableiten (Muster wie es: erste 3 Parts + Rest-Option).
  const qIdx = e.indexOf('quiz:{q:{');
  if (qIdx >= 0) {
    const qq = 'Quel composant appartient à ' + fr.title + ' ?';
    const qo = [fr.labels[0], fr.labels[1] || fr.labels[0], fr.labels[2] || fr.labels[0], 'Aucun de ceux-ci'];
    const qr = fr.labels[0] + ' figure dans la liste.';
    e = injectFrMapAfter(e, qIdx, 'q', escL(qq));
    e = injectFrMapAfter(e, qIdx, 'options', escArr(qo, escL));
    e = injectFrMapAfter(e, qIdx, 'rationale', escL(qr));
  }
  const { start, end } = entryOf(s, id);
  s = s.slice(0, start) + e + s.slice(end + 1);
  console.log('  F2: LABS fr: ' + id);
}

// ---------- F3a: const meta_i18n_<id> fr (aus src/models/*.js) ----------
for (const id of ['arch-brandenburger-tor', 'si-1', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example']) {
  const src = await readFile('src/models/' + id + '.js', 'utf8');
  const at = src.indexOf('fr: {');
  must(at >= 0, 'meta_i18n fr fehlt in src: ' + id);
  const open = src.indexOf('{', at + 3);
  const end = (() => {
    let i = open + 1; let depth = 1; let q = null;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (q) { if (c === '\\') { i += 2; continue; } if (c === q) q = null; }
      else if (c === "'" || c === '"' || c === '`') q = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      i += 1;
    }
    must(depth === 0, 'fr-Objekt unausgeglichen: ' + id);
    return i - 1;
  })();
  const frLit = src.slice(at, end + 1);
  const anchor = 'const meta_i18n_' + id.replaceAll('-', '_') + ' = {';
  const bt = s.indexOf(anchor);
  must(bt >= 0, 'Bundle-Konstante fehlt: ' + anchor);
  const bopen = s.indexOf('{', bt + anchor.length - 1);
  const bend = braceMatch(s, bopen);
  s = s.slice(0, bend) + ', ' + frLit + s.slice(bend);
  console.log('  F3: meta_i18n fr: ' + id);
}

// ---------- F3b: makeFreeLab fr ----------
s = rep1(s,
  'var titleEs=(metaI18n&&metaI18n.es&&metaI18n.es.title)?metaI18n.es.title:titleEn;',
  'var titleEs=(metaI18n&&metaI18n.es&&metaI18n.es.title)?metaI18n.es.title:titleEn;'
    + 'var titleFr=(metaI18n&&metaI18n.fr&&metaI18n.fr.title)?metaI18n.fr.title:titleEn;',
  'F3 makeFreeLab titleFr');
s = rep1(s,
  'var partsEs=(metaI18n&&metaI18n.es&&Array.isArray(metaI18n.es.parts)&&metaI18n.es.parts.length===parts.length)?metaI18n.es.parts.slice():partsEn.slice();',
  'var partsEs=(metaI18n&&metaI18n.es&&Array.isArray(metaI18n.es.parts)&&metaI18n.es.parts.length===parts.length)?metaI18n.es.parts.slice():partsEn.slice();'
    + 'var partsFr=(metaI18n&&metaI18n.fr&&Array.isArray(metaI18n.fr.parts)&&metaI18n.fr.parts.length===parts.length)?metaI18n.fr.parts.slice():partsEn.slice();',
  'F3 makeFreeLab partsFr');
s = rep1(s,
  'var expEs=this.normExp(metaI18n&&metaI18n.es&&metaI18n.es.explanations,parts.length,expDe);',
  'var expEs=this.normExp(metaI18n&&metaI18n.es&&metaI18n.es.explanations,parts.length,expDe);'
    + 'var expFr=this.normExp(metaI18n&&metaI18n.fr&&metaI18n.fr.explanations,parts.length,expDe);',
  'F3 makeFreeLab expFr');
s = rep1(s,
  'var measTextEn=mm?mm.text:(partsEn[0]+": 10 "+(mm?mm.unit:"cm"));',
  'var measTextEn=mm?mm.text:(partsEn[0]+": 10 "+(mm?mm.unit:"cm"));'
    + 'var measTextFr=mm?mm.text:(partsFr[0]+": 10 "+(mm?mm.unit:"cm"));',
  'F3 makeFreeLab measTextFr');
s = rep1(s,
  'title:{de:titleDe,en:titleEn,es:titleEs}',
  'title:{de:titleDe,en:titleEn,es:titleEs,fr:titleFr}',
  'F3 makeFreeLab title');
s = rep1(s,
  'es:["Nombra las piezas de "+titleEs+".","Lee las medidas en el modelo "+titleEs+"."]}',
  'es:["Nombra las piezas de "+titleEs+".","Lee las medidas en el modelo "+titleEs+"."],'
    + 'fr:["Nomme les composants de "+titleFr+".","Lis les mesures sur le modèle "+titleFr+"."]}',
  'F3 makeFreeLab objectives');
s = rep1(s,
  'text:{de:measTextDe,en:measTextEn,es:measTextEn}',
  'text:{de:measTextDe,en:measTextEn,es:measTextEn,fr:measTextFr}',
  'F3 makeFreeLab measurements');
s = rep1(s,
  'labels:{de:parts,en:partsEn,es:partsEs}',
  'labels:{de:parts,en:partsEn,es:partsEs,fr:partsFr}',
  'F3 makeFreeLab labels');
s = rep1(s,
  'explanations:{de:expDe||[],en:expEn||[],es:expEs||[]}',
  'explanations:{de:expDe||[],en:expEn||[],es:expEs||[],fr:expFr||[]}',
  'F3 makeFreeLab explanations');
s = rep1(s,
  'es:"Localiza "+partsEs[0]+" en el modelo."}',
  'es:"Localiza "+partsEs[0]+" en el modelo.",fr:"Localise "+partsFr[0]+" sur le modèle."}',
  'F3 makeFreeLab task-zuordnung prompt');
s = rep1(s,
  'es:["Busca "+partsEs[0]+" en la vista.","Usa la lista de componentes.","Acercate a la pieza."]}',
  'es:["Busca "+partsEs[0]+" en la vista.","Usa la lista de componentes.","Acercate a la pieza."],'
    + 'fr:["Trouve "+partsFr[0]+" dans la vue.","Utilise la liste des composants.","Zoome sur la pièce."]}',
  'F3 makeFreeLab task-zuordnung hints');
s = rep1(s,
  'es:"Lee la medida: "+measTextEn}',
  'es:"Lee la medida: "+measTextEn,fr:"Lis la mesure : "+measTextFr}',
  'F3 makeFreeLab task-messwert prompt');
// Hints/Quiz enthalten \u-Escapes: strukturell (de-Anker + Klammer-Matching) statt Volltext,
// gescopet auf makeFreeLab (kuratierte LABS-Eintraege teilen sich die de-Hints).
{
  const mStart = s.indexOf('makeFreeLab:function');
  must(mStart >= 0, 'F3 makeFreeLab fehlt');
  const mEndMarker = 'generate:async function';
  const mEnd = s.indexOf(mEndMarker, mStart);
  must(mEnd > mStart, 'F3 makeFreeLab-Ende fehlt');
  let m = s.slice(mStart, mEnd);
  const mc = (sub) => m.split(sub).length - 1;
  const mrep = (oldStr, newStr, label) => {
    must(mc(oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + mc(oldStr));
    m = m.replace(oldStr, newStr);
  };
  const mstruct = (mapKey, afterKey, frInsert, label) => {
    const key = mapKey + ':{' + afterKey;
    must(mc(key) === 1, label + ': Anker fehlt/mehrdeutig x' + mc(key));
    const at = m.indexOf(key);
    const open = m.indexOf('{', at);
    const end = braceMatch(m, open);
    m = m.slice(0, end) + frInsert + m.slice(end);
  };
  mstruct('hints', 'de:["Suche die Messlinie."', ',fr:["Trouve la ligne de cote.","Lis le nombre et l\\u2019unit\\u00e9.","V\\u00e9rifie mm/cm/m."]', 'F3 messwert-hints');
  mstruct('prompt', 'de:"Wozu dient "', ',fr:"\\u00c0 quoi sert "+partsFr[0]+" sur "+titleFr+" ?"', 'F3 transfer-prompt');
  mstruct('hints', 'de:["Denke an die Hauptfunktion."', ',fr:["Pense \\u00e0 la fonction principale.","Relie forme et t\\u00e2che.","Explique en une phrase."]', 'F3 transfer-hints');
  mstruct('q', 'de:"Welches Bauteil gehoert zu "', ',fr:"Quel composant appartient \\u00e0 "+titleFr+" ?"', 'F3 quiz q');
  mstruct('options', 'de:[parts[0]', ',fr:[partsFr[0],partsFr[1]||partsFr[0],partsFr[2]||partsFr[0],"Aucun de ceux-ci"]', 'F3 quiz options');
  mstruct('rationale', 'de:parts[0]', ',fr:partsFr[0]+" figure dans la liste."', 'F3 quiz rationale');
  s = s.slice(0, mStart) + m + s.slice(mEnd);
}
console.log('  F3: makeFreeLab fr (Titel/Parts/Exp/Messwerte/Tasks/Quiz)');

// ---------- F3c: FR-Anreicherung (FR-Map + fr-Fallbacks, analog V9-ES-Block) ----------
{
  const frMap = {};
  for (const id of IDS) {
    const man = JSON.parse(await readFile('src/models/manifests/' + id + '.json', 'utf8'));
    frMap[id] = { title: man.i18n.fr.title, parts: man.i18n.fr.labels };
  }
  const lit = (v) => escA(v);
  const mapLit = Object.entries(frMap)
    .map(([id, m]) => '"' + id + '":{title:' + lit(m.title) + ',parts:' + escArr(m.parts, lit) + '}')
    .join(',');
  const block = '\r\n// V42: FR-Anreicherung (Titel/Labels aus Manifest-i18n.fr, Rest aus EN abgeleitet, Du-Form im UI-Dict)\r\n'
    + '(function(){var FR={' + mapLit + '};\r\n'
    + 'for(var li=0;li<LABS.length;li++){var L=LABS[li];var E=FR[L.id];\r\n'
    + 'if(E){L.title.fr=E.title;L.labels.fr=E.parts.slice();}\r\n'
    + 'if(!L.title.fr){L.title.fr=L.title.en||L.title.de;}\r\n'
    + 'if(!L.labels.fr){L.labels.fr=((L.labels.en||L.labels.de)||[]).slice();}\r\n'
    + 'if(L.objectives&&!L.objectives.fr){L.objectives.fr=(L.objectives.en||L.objectives.de||[]).slice();}\r\n'
    + 'if(L.measurements){for(var mi=0;mi<L.measurements.length;mi++){var mm=L.measurements[mi];if(mm.text&&!mm.text.fr){mm.text.fr=mm.text.en||mm.text.de;}}}\r\n'
    + 'if(L.tasks){for(var ti=0;ti<L.tasks.length;ti++){var tt=L.tasks[ti];if(tt.prompt&&!tt.prompt.fr){tt.prompt.fr=tt.prompt.en||tt.prompt.de;}if(tt.hints&&!tt.hints.fr){tt.hints.fr=(tt.hints.en||tt.hints.de||[]).slice();}}}\r\n'
    + 'if(L.quiz){if(L.quiz.q&&!L.quiz.q.fr){L.quiz.q.fr=L.quiz.q.en||L.quiz.q.de;}if(L.quiz.options&&!L.quiz.options.fr){L.quiz.options.fr=(L.quiz.options.en||L.quiz.options.de||[]).slice();}if(L.quiz.rationale&&!L.quiz.rationale.fr){L.quiz.rationale.fr=L.quiz.rationale.en||L.quiz.rationale.de;}}\r\n'
    + '}})();';
  s = rep1(s,
    'if(L.quiz){if(L.quiz.q&&!L.quiz.q.es){L.quiz.q.es=L.quiz.q.en||L.quiz.q.de;}if(L.quiz.options&&!L.quiz.options.es){L.quiz.options.es=(L.quiz.options.en||L.quiz.options.de||[]).slice();}if(L.quiz.rationale&&!L.quiz.rationale.es){L.quiz.rationale.es=L.quiz.rationale.en||L.quiz.rationale.de;}}\r\n}})();',
    'if(L.quiz){if(L.quiz.q&&!L.quiz.q.es){L.quiz.q.es=L.quiz.q.en||L.quiz.q.de;}if(L.quiz.options&&!L.quiz.options.es){L.quiz.options.es=(L.quiz.options.en||L.quiz.options.de||[]).slice();}if(L.quiz.rationale&&!L.quiz.rationale.es){L.quiz.rationale.es=L.quiz.rationale.en||L.quiz.rationale.de;}}\r\n}})();' + block,
    'F3 FR-Anreicherung');
  console.log('  F3: FR-Anreicherung (Map + fr-Fallbacks)');
}

// ---------- F6: Stempel v42 + Invarianten + Syntax-Gate ----------
const stamp = '<!-- standalone-build v41 (Export-Menue unten links im Viewer: GLB/PNG/SVG je Modus + I18N de/en/es, via scripts/build-standalone-v41.mjs) -->';
must(cnt(s, stamp) === 1, 'v41-Stempel fehlt/mehrdeutig');
s = s.replace(stamp, stamp + ' <!-- standalone-build v42 (FR-Portierung: FR-Button + I18N.fr + LABS/META fr + Prompts 4-sprachig, via scripts/build-standalone-v42.mjs) -->');
assertInlineScriptsParse(s);
checkInvariants(s);
await writeReport(s);
await writeFile(FILE, s);
console.log('build-v42: OK v42 (FR-Portierung ins Standalone-Release)');
