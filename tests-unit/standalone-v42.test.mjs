/**
 * v42-Regression: FR-Portierung ins Standalone-Release.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  F1 FR-Button + I18N.fr-Dict (135 Keys, Paritaet zu es),
 *  F2 LABS fr-Modellinhalte je Modell (Titel/Labels/Explanations/Messwerte/Tasks/Quiz),
 *  F3 META fr (meta_i18n-Konstanten + makeFreeLab + FR-Anreicherung),
 *  F4 Standalone-Prompt 4-sprachig (loc-Gates + Vertraege),
 *  F5 UI-Fallbacks fr (Lang-Gate, Suche, diagText/teleBlock).
 * Ablauf: erst bauen (npm run build:standalone), dann Tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const HTML = new URL('../dist-standalone/modelmuse-standalone.html', import.meta.url);

async function html() {
  return readFile(HTML, 'utf8');
}

const cnt = (s, sub) => s.split(sub).length - 1;

function dictKeys(s, marker) {
  const at = s.indexOf(marker);
  assert.ok(at >= 0, marker + ' gefunden');
  let i = at + marker.length; let depth = 1; let str = null;
  for (; i < s.length && depth > 0; i++) {
    const c = s[i];
    if (str) { if (c === '\\') { i += 1; continue; } if (c === str) str = null; }
    else if (c === '"' || c === "'") str = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
  }
  // Flaches Dict: Top-Level-Kommas (string-sicher) trennen, Key = Teil vor ':'.
  const body = s.slice(at + marker.length, i - 1);
  const keys = new Set();
  let cur = ''; let q = null;
  const flush = () => {
    const ci = cur.indexOf(':');
    if (ci > 0) keys.add(cur.slice(0, ci).replace(/^"|"$/g, ''));
    cur = '';
  };
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (q) {
      cur += c;
      if (c === '\\') { cur += body[j + 1] ?? ''; j += 1; }
      else if (c === q) q = null;
    } else if (c === '"' || c === "'") { q = c; cur += c; }
    else if (c === ',') flush();
    else cur += c;
  }
  flush();
  return keys;
}

test('v42-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v42'), 1, 'v42-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v41'), 1, 'v41-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('F1: FR-Button + fr-Dict mit es-Paritaet', async () => {
  const s = await html();
  assert.equal(cnt(s, '>FR</button>'), 1, 'FR-Button genau 1x');
  assert.equal(cnt(s, "setLang('fr')"), 1, 'FR-Umschaltung genau 1x');
  assert.equal(cnt(s, 'I18N.fr={'), 1, 'fr-Dict genau 1x');
  const fr = dictKeys(s, 'I18N.fr={');
  const es = dictKeys(s, 'I18N.es={');
  assert.equal(fr.size, 152, 'fr-Dict hat 152 Keys (149 + 3 Video v54, ohne videoMissing-Fallback)');
  assert.deepEqual([...fr].sort(), [...es].sort(), 'fr-Keymenge == es-Keymenge');
  assert.ok(s.includes('saveModel:"Enregistrer"'), 'fr Enregistrer');
  assert.ok(s.includes('partsTitle:"Composants"'), 'fr Composants');
  assert.ok(s.includes('jobQueue:"Place {n}"'), 'fr Place {n}');
  assert.ok(s.includes('teleThanks:"Merci pour ta contribution !"'), 'fr Merci');
});

test('F2: LABS fr je Modell (Titel/Labels/Explanations/Messwerte/Tasks/Quiz)', async () => {
  const s = await html();
  for (const [mem, label] of [
    [',fr:"Porte de Brandebourg (Berlin)"}', 'arch-Titel'],
    [',fr:"Molécule de caféine"}', 'koffein-Titel'],
    [',fr:"Perceuse manuelle"}', 'bohrmaschine-Titel'],
    [',fr:"Carte graphique"}', 'gpu-Titel'],
  ]) assert.equal(cnt(s, mem), 1, 'LABS-Titel fr: ' + label);
  assert.equal(cnt(s, ',fr:"Poste PC (SI-1)"}'), 0, 'v56 si-1-Titel fr raus');
  assert.equal(cnt(s, '"fr":"Comparaison de rendement"}'), 0, 'v56 chart-Titel fr raus');
  assert.equal(cnt(s, 'Quel composant appartient à'), 4, 'Quiz-Frage fr (4 kuratierte)');
  assert.equal(cnt(s, 'Aucun de ceux-ci'), 5, 'Quiz-Option fr (4 + makeFreeLab)');
  assert.equal(cnt(s, 'figure dans la liste.'), 5, 'Quiz-Rationale fr (4 + makeFreeLab)');
  assert.ok(s.includes('fr:"Largeur totale : 62,5 m"'), 'arch-Messwert fr');
  assert.ok(s.includes('fr:"Longueur : 448 mm"'), 'bohrmaschine-Messwert fr');
  assert.ok(s.includes('fr:"Relie : quel composant porte le quadrige'), 'arch-Task fr');
  assert.ok(s.includes('fr:["Six colonnes doriques'), 'arch-Explanation fr');
  assert.ok(s.includes('fr:["Trouve la pièce dans la vue.","Utilise la liste des composants.","Zoome sur la pièce."]'), 'zuordnung-Hints fr');
  assert.ok(s.includes('fr:["Trouve la ligne de cote.","Lis le nombre et l\'unité.","Vérifie mm/cm/m."]'), 'messwert-Hints fr');
  assert.ok(s.includes('fr:["Pense à la fonction principale.","Relie forme et tâche.","Explique en une phrase."]'), 'profi-Hints fr');
});

test('F3: META fr (Konstanten + makeFreeLab + Anreicherung)', async () => {
  const s = await html();
  for (const id of ['arch-brandenburger-tor', 'chemie-koffein', 'free-handbohrmaschine', 'gpu-example']) {
    assert.ok(s.includes('const meta_i18n_' + id.replaceAll('-', '_') + ' = {'), id + '-Konstante bleibt');
  }
  assert.ok(!s.includes('const meta_i18n_si_1 = {'), 'v56 si-1-Konstante raus');
  assert.equal(cnt(s, ', fr: { title:'), 4, 'meta_i18n-Konstanten fr (4 Modelle)');
  assert.ok(s.includes('var titleFr=(metaI18n&&metaI18n.fr'), 'makeFreeLab titleFr');
  assert.ok(s.includes('var partsFr=(metaI18n&&metaI18n.fr'), 'makeFreeLab partsFr');
  assert.ok(s.includes('var expFr=this.normExp(metaI18n&&metaI18n.fr'), 'makeFreeLab expFr');
  assert.ok(s.includes('var measTextFr=mm?mm.text:(partsFr[0]'), 'makeFreeLab measTextFr');
  assert.equal(cnt(s, 'var FR={'), 1, 'FR-Anreicherung genau 1x');
  assert.ok(s.includes('if(!L.title.fr){L.title.fr=L.title.en||L.title.de;}'), 'FR-Fallback Titel');
  assert.ok(s.includes('if(!L.labels.fr){L.labels.fr='), 'FR-Fallback Labels');
});

test('F4: Standalone-Prompt 4-sprachig (Gates + Vertraege)', async () => {
  const s = await html();
  assert.equal(cnt(s, "(locale==='en'||locale==='es'||locale==='fr')?locale:'de'"), 1, '2D loc-Gate fr');
  assert.equal(cnt(s, '(locale==="en"||locale==="es"||locale==="fr")?locale:"de"'), 1, '3D loc-Gate fr');
  assert.equal(cnt(s, 'fr: { title, parts: [...] }'), 2, 'meta_i18n-Vertrag en/es/fr (3D + 2D)');
  assert.equal(cnt(s, 'en.explanations + es.explanations + fr.explanations als'), 2, 'explanations-Vertrag (3D + 2D)');
  assert.equal(cnt(s, 'Aufbau wie Standard-Modelle'), 2, 'Erklaerungs-Satz bleibt 2x (3D + 2D)');
});

test('F5: UI-Fallbacks fr (Gate, Suche, diagText/teleBlock)', async () => {
  const s = await html();
  assert.ok(s.includes('if(lng==="de"||lng==="en"||lng==="es"||lng==="fr"){this.lang=lng;}'), 'Lang-Gate fr');
  assert.ok(s.includes('(l.title.fr||"")'), 'Suche findet fr-Titel');
  assert.ok(s.includes('fr:"Aucun modèle"'), 'Empty-Lab fr');
  assert.ok(s.includes('ModelMuse diagnostic (édité, sans clé).'), 'diagText-Head fr');
  assert.ok(s.includes('(non envoyé)'), 'diagText nl fr');
  assert.ok(s.includes('ModelMuse télémétrie (volontaire, sans clé).'), 'teleBlock-Head fr');
});
