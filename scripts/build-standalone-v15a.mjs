/**
 * Standalone builder v15a (Bestandteil-Info Fallback-Text, GitHub-Pages-faehig):
 * Erweitert das v15-Artefakt additiv: Info-Button immer sichtbar, Popup zeigt
 * Fallback-Text wenn keine Erklaerung vorliegt (statt Button zu verstecken).
 * Laeuft NUR auf v15-Basis (Stempel vorhanden) und ist idempotent
 * (Zweitlauf meldet "bereits v15a", exit 0).
 *
 * A1  Info-Button ohne v-if (immer sichtbar, auch ohne Erklaerung).
 * A2  Popup-Text mit Fallback: partExplanations[i] || t('partInfoMissing').
 * A3  I18N-Key partInfoMissing (de/en/es).
 * A4  es genClose "Cerrar" (war Deutsch-Fallback).
 * A5  v15a-Stempel + Invarianten + Report.
 *
 * Aufruf: node scripts/build-standalone-v15a.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v15a-report.json';

function must(cond, msg) {
  if (!cond) { console.error('build-v15a: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

let s = await readFile(FILE, 'utf8');
console.log(`build-v15a: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v15'), 'kein v15-Stempel (falsche Basis)');
if (s.includes('standalone-build v15a')) {
  console.log('build-v15a: bereits v15a — nichts zu tun (idempotent, exit 0)');
  process.exit(0);
}

// ---------- A1: Button immer sichtbar ----------
{
  const a = `@click="openPartInfo(i)" v-if="partExplanations[i]"`;
  must(cnt(s, a) === 1, 'A1 Button-Anker fehlt/mehrdeutig');
  s = s.replace(a, '@click="openPartInfo(i)"');
  console.log('  A1: Info-Button ohne v-if');
}

// ---------- A2: Popup-Text mit Fallback ----------
{
  const a = `<p class="text-sm text-slate-700 dark:text-slate-200">{{partExplanations[partInfoIndex]}}</p>`;
  must(cnt(s, a) === 1, 'A2 Popup-Anker fehlt/mehrdeutig');
  s = s.replace(a, `<p class="text-sm text-slate-700 dark:text-slate-200">{{partExplanations[partInfoIndex] || t('partInfoMissing')}}</p>`);
  console.log('  A2: Fallback-Text im Popup');
}

// ---------- A3: I18N-Key partInfoMissing ----------
{
  const t = [
    ['I18N.de.partInfoAbout="Info zum Bestandteil";', 'I18N.de.partInfoAbout="Info zum Bestandteil";I18N.de.partInfoMissing="Noch keine Erläuterung für diesen Bestandteil.";'],
    ['I18N.en.partInfoAbout="About this component";', 'I18N.en.partInfoAbout="About this component";I18N.en.partInfoMissing="No explanation for this component yet.";'],
    ['partInfoAbout:"Acerca de este componente"', 'partInfoAbout:"Acerca de este componente",partInfoMissing:"Aún no hay explicación para este componente."'],
  ];
  for (const [a, b] of t) {
    must(cnt(s, a) === 1, `A3 Anker fehlt: ${a.slice(0, 40)}`);
    s = s.replace(a, b);
  }
  console.log('  A3: partInfoMissing (de/en/es)');
}

// ---------- A4: es genClose ----------
{
  const a = 'genSelect:"Seleccionar",modifyTitle:';
  must(cnt(s, a) === 1, 'A4 ES-Anker fehlt/mehrdeutig');
  s = s.replace(a, 'genSelect:"Seleccionar",genClose:"Cerrar",modifyTitle:');
  console.log('  A4: es genClose "Cerrar"');
}

// ---------- A5: Stempel + Invarianten ----------
{
  const stamp = '<!-- standalone-build v15 (Bestandteil-Info: Info-Kreis-i-Button je Listeneintrag + Overlay-Popup + explanations de/en/es, via scripts/build-standalone-v15.mjs) -->';
  must(cnt(s, stamp) === 1, 'A5 Stempel-Anker fehlt');
  s = s.replace(stamp, `${stamp}
<!-- standalone-build v15a (Bestandteil-Info Fallback-Text + es genClose, via scripts/build-standalone-v15a.mjs) -->`);
  console.log('  A5: v15a-Stempel');
}
{
  const inv = [
    ['standalone-build v13', 1], ['standalone-build v14', 1], ['standalone-build v15 (', 1], ['standalone-build v15a', 1],
    ['PointLight(0xffffff, 900', 0], ['openrouter', 0], ['OpenRouter', 0],
    ['explanations:{de:[', 10],
    ['openPartInfo', 2], ['closePartInfo', 2], ['partInfoIndex', 7],
    ['partInfoTitle', 5], ['partInfoAbout', 5], ['partExplanations', 2],
    ['partInfoMissing', 4],
    ['v-if="partInfoIndex!==null"', 1],
    ['genClose:"Cerrar"', 1],
    ['role="dialog"', 2],
  ];
  for (const [sub, want] of inv) must(cnt(s, sub) === want, `Invariante ${sub}: ${cnt(s, sub)}, erwartet ${want}`);
  must(s.length < 600000, `Datei zu gross: ${s.length}`);
  console.log('  Invarianten ok');
}

await writeFile(FILE, s);
console.log(`build-v15a: geschrieben (${s.length} Zeichen)`);
if (REPORT) {
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v15-showcase',
    standalone: 'v15a',
    fixes: ['A1 Info-Button ohne v-if', 'A2 Popup-Fallback partInfoMissing', 'A3 I18N-Key de/en/es', 'A4 es genClose Cerrar', 'A5 Stempel + Invarianten'],
    counts: { zeichen: s.length },
  };
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('build-v15a: OK v15a');
} else {
  console.log('build-v15a: DRY-RUN ok (kein Report geschrieben)');
}
