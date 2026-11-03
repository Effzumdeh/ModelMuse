/**
 * Standalone builder v51 (Logo-V2-Header oben links, 03.11.2026):
 * Bettet docs/assets/logo-header.svg inline in die Standalone-Kopfzeile
 * ein (vor den App-Titel) — kein Netz, kein CDN, CSP-neutral (Inline-SVG,
 * keine img/data-URI). Weisser Chip als Traeger, damit das
 * Hell-Hintergrund-Logo in Light- UND Dark-Mode lesbar bleibt.
 * Baut auf dem v50-Artefakt auf und ist idempotent
 * (Zweitlauf prueft nur Invarianten, exit 0).
 *
 * Quelle (Single Source): docs/assets/logo-header.svg
 * (freigegeben 03.11.2026, Logo V2; Shell nutzt dieselbe Datei inline
 * in src/shell/index.html, rendert via scripts/render-single-file.mjs).
 *
 * Nachfolger-Toleranz: enthaelt keine aelteren Anker; aeltere Builder
 * (v13..v50) laufen vorher in der Kette (package.json build:standalone)
 * und pruefen nur ihre eigenen Anker — keine Anpassung noetig.
 *
 * Aufruf: node scripts/build-standalone-v51-logo.mjs [htmlDatei]
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-v51-report.json';
const STAMP = 'standalone-build v51 (Logo-V2 header links)';
const ASSET = 'docs/assets/logo-header.svg';

function must(cond, msg) {
  if (!cond) { console.error('build-v51: FEHLER ' + msg); process.exit(1); }
}
const cnt = (s, sub) => s.split(sub).length - 1;
function rep1(s, oldStr, newStr, label) {
  must(cnt(s, oldStr) === 1, label + ': Anker fehlt/mehrdeutig x' + cnt(s, oldStr));
  return s.replace(oldStr, newStr);
}

function checkInvariants(s) {
  const inv = [
    [STAMP, 1],
    ['standalone-build v50', 1],
    // Logo genau 1x, direkt vor dem App-Titel, mit weissem Chip + Stil.
    ['viewBox="0 0 621 170"', 1],
    ['logo-chip-v51', 1],
    ['<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>', 1],
    // Kein externes Bild, keine Daten-URI (reines Inline-SVG).
    ['<img', 0],
  ];
  for (const [sub, want] of inv) {
    must(cnt(s, sub) === want, 'Invariante "' + sub + '": ' + cnt(s, sub) + ' statt ' + want);
  }
  must(s.includes('role="img" aria-label="ModelMuse Logo"'), 'SVG-a11y fehlt');
  must(s.length < 600000, 'Datei zu gross: ' + s.length);
  console.log('  Invarianten ok (v51 Logo-V2-Header)');
}

function writeReport(s) {
  if (!REPORT) { console.log('build-v51: DRY-RUN ok (kein Report geschrieben)'); return; }
  const report = {
    createdAt: new Date().toISOString(),
    basis: 'v50 (Baseten-Doku-Regel + zweistufiger 400-Fallback)',
    standalone: 'v51-logo',
    asset: { datei: ASSET, zweck: 'Kopfzeilen-Logo oben links (Inline-SVG, kein Netz)' },
    fixes: [
      'H1-Anker: Logo-Chip (weiss, rounded) + Inline-SVG viewBox 621x170 vor {{t(appTitle)}}',
      'Stempel + Invarianten (Logo 1x, kein <img, a11y role/aria-label, <600 KB)',
    ],
    counts: { zeichen: s.length, logoSvg: cnt(s, 'viewBox="0 0 621 170"') },
  };
  return writeFile(REPORT, JSON.stringify(report, null, 2));
}

let s = await readFile(FILE, 'utf8');
console.log(`build-v51: Basis ${s.length} Zeichen`);
must(s.includes('standalone-build v50'), 'kein v50-Stempel (falsche Basis)');
if (s.includes(STAMP)) {
  checkInvariants(s);
  console.log('build-v51: bereits v51 - ok (idempotent, exit 0)');
  process.exit(0);
}

// L1: Logo-SVG aus Single Source lesen, Stil fuer Kopfzeile setzen.
let svg = (await readFile(ASSET, 'utf8')).trim();
must(svg.startsWith('<svg') && !svg.includes('</script'), 'Logo-Asset ungueltig');
must(svg.includes('viewBox="0 0 621 170"'), 'Logo-Asset: falsche viewBox');
svg = svg.replace('<svg ', '<svg style="height:28px;width:auto;display:block" ');
must(svg.includes('style="height:28px'), 'SVG-Stil-Anker fehlt');

// L2: Chip vor den App-Titel setzen (H1-Anker 1x).
const H1 = '<h1 class="text-xl font-bold tracking-tight">{{t(\'appTitle\')}}</h1>';
const CHIP = `<span class="logo-chip-v51 inline-flex items-center bg-white rounded-lg px-2 py-1 leading-none" title="ModelMuse"><!-- ${STAMP}: Quelle ${ASSET} -->${svg}</span>`;
s = rep1(s, H1, `${CHIP}\n${H1}`, 'L2 Logo-Chip vor App-Titel');

checkInvariants(s);
await writeFile(FILE, s);
console.log(`build-v51: geschrieben (${s.length} Zeichen)`);
await writeReport(s);
console.log('build-v51: OK v51-logo');
