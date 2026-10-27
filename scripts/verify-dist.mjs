/**
 * scripts/verify-dist.mjs — Auslieferungs-Nachweis: prueft das GEBAUTE Artefakt dist/lab-player.html.
 *
 * Aufruf: npm run verify:dist  (node scripts/verify-dist.mjs)
 * Exit 0: alle Checks gruen. Exit 1: ein Check rot (Grund auf stderr).
 *
 * Checks:
 * a) dist/lab-player.html existiert + Inhalt stimmt mit dist/lab-player.html.sha256 ueberein
 *    (sha256 nachgerechnet; Schreiber: scripts/render-single-file.mjs Z.109-111).
 * b) Kein CDN (T0-3/T0-4 = LADEZEIT-Netzfreiheit): Fail NUR bei LOAD-Referenzen —
 *    <script src="http...">, <link href="http...">, url(http...), fetch('http...'),
 *    new WebSocket('http...'), import('http...')/import "...http..." (inkl. from
 *    "http..."), .src = 'http...'. Alle uebrigen http(s)-Strings sind MENTION
 *    (z. B. XML-Namespace, Kommentar-URLs, Doku-Anzeigetexte): werden WARN-gelistet
 *    (gekuerzt, max. 80 Zeichen), blockieren Exit 0 NICHT. Hosts 127.0.0.1/localhost
 *    sind in beiden Klassen erlaubt.
 *    Kein Key (unveraendert): Fail NUR bei Schluessel-MUSTERN MIT WERT (sk-<Typ>-<Wert>,
 *    generisches sk-<20+ Zeichen>, 'Bearer <Wert>', 'api-key[:=]<Wert>'). Nackte Woerter
 *    ("Key", "api-key" ohne Wert, Doku-Texte) sind KEIN Fail. Trefferstellen werden
 *    NUR als Mustername + Anzahl protokolliert, NIEMALS der Treffertext (kein Key-Leak).
 * c) build-report.json: existiert, enthaelt gueltigen buildHash (64-hex, QUELLEN-Hash,
 *    scripts/build.mjs Z.143-156, bleibt wie er ist) + artefaktSha256 (ARTEFAKT-Hash).
 *    Abgleich gegen .sha256: GENAU report.artefaktSha256 vs .sha256-Datei.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const HTML = `${ROOT}/dist/lab-player.html`;
const SHA = `${HTML}.sha256`;
const REPORT = `${ROOT}/dist/build-report.json`;

const fehler = [];
const ok = (m) => console.log(`verify-dist: OK ${m}`);
const fail = (m) => { fehler.push(m); console.error(`verify-dist: FAIL ${m}`); };

// a) Existenz + sha256-Nachrechnung.
if (!existsSync(HTML)) {
  fail('dist/lab-player.html fehlt — zuerst npm run render');
} else {
  const html = await readFile(HTML, 'utf8');
  const aktuell = createHash('sha256').update(html, 'utf8').digest('hex');
  if (!existsSync(SHA)) {
    fail('dist/lab-player.html.sha256 fehlt');
  } else {
    const eingetragen = (await readFile(SHA, 'utf8')).trim().split(/\s+/)[0] ?? '';
    if (eingetragen === aktuell) ok(`sha256 stimmt (${aktuell.slice(0, 16)}…)`);
    else fail(`sha256-Drift: Datei=${eingetragen.slice(0, 16)}… vs nachgerechnet=${aktuell.slice(0, 16)}…`);
  }

  // b) Kein CDN (T0-3/T0-4 = Ladezeit-Netzfreiheit): nur LOAD faellt, MENTION warnt.
  const ERLAUBT = new Set(['localhost', '127.0.0.1']);
  const LOAD_RE = [
    /<script\b[^>]*\bsrc\s*=\s*["']?https?:\/\//i,
    /<link\b[^>]*\bhref\s*=\s*["']?https?:\/\//i,
    /\burl\s*\(\s*["']?https?:\/\//i,
    /\bfetch\s*\(\s*["']?https?:\/\//i,
    /\bnew\s+WebSocket\s*\(\s*["']?https?:\/\//i,
    /\bimport\s*\(\s*["']?https?:\/\//i,
    /\bfrom\s+["']https?:\/\//i,
    /\.src\s*=\s*["']?https?:\/\//i,
  ];
  const IMPORT_URL_RE = /\bimport\b[^;"']*["']https?:\/\/[^"']*["']/i;
  let urlFails = 0;
  let mentionWarns = 0;
  for (const m of html.matchAll(/https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[^\s"'<>]*)?/g)) {
    const host = m[0].replace(/^https?:\/\//, '').split(/[/:]/)[0];
    if (ERLAUBT.has(host)) continue;
    const ausschnitt = html.slice(Math.max(0, m.index - 300), m.index + m[0].length + 10);
    const isLoad = LOAD_RE.some((re) => re.test(ausschnitt)) || IMPORT_URL_RE.test(ausschnitt);
    if (isLoad) {
      urlFails++;
      console.error(`verify-dist: FAIL externe LOAD-URL ${m[0].slice(0, 80)}`);
    } else {
      mentionWarns++;
      console.warn(`verify-dist: WARN MENTION-URL ${m[0].slice(0, 80)}`);
    }
  }
  if (urlFails === 0) ok(`keine externen LOAD-URLs${mentionWarns > 0 ? ` (${mentionWarns} MENTION-Warnung(en))` : ''}`);
  else fehler.push(`${urlFails} externe LOAD-URL(s) im Artefakt`);

  // b) Kein Key: nur Muster MIT Wert (Treffertext NIEMALS drucken).
  const MUSTER = [
    ['sk-Typ+Wert', /sk-(?:ant|live|proj|test)-[A-Za-z0-9_-]{8,}/g],
    ['sk-generisch+Wert', /\bsk-[A-Za-z0-9]{20,}/g],
    ['Bearer+Wert', /Bearer\s+[A-Za-z0-9._~+/-]{8,}/g],
    ['api-key+Wert', /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9._-]{8,}/gi],
  ];
  let keyFails = 0;
  for (const [name, re] of MUSTER) {
    const anzahl = (html.match(re) ?? []).length;
    if (anzahl > 0) {
      keyFails += anzahl;
      console.error(`verify-dist: FAIL Schluessel-MUSTER [${name}] x${anzahl} (Werte nicht abgedruckt)`);
    }
  }
  if (keyFails === 0) ok('keine Schluessel-Muster mit Wert');
  else fehler.push(`${keyFails} Schluessel-Muster mit Wert`);
}

// c) buildHash-Abgleich.
if (!existsSync(REPORT)) {
  fail('dist/build-report.json fehlt — zuerst npm run build');
} else {
  let report = null;
  try {
    report = JSON.parse(await readFile(REPORT, 'utf8'));
  } catch {
    fail('build-report.json ungueltig (kein JSON)');
  }
  if (report) {
    if (!/^[0-9a-f]{64}$/.test(report.buildHash ?? '')) {
      fail('buildHash fehlt/ungueltig in build-report.json');
    }
    if (!/^[0-9a-f]{64}$/.test(report.artefaktSha256 ?? '')) {
      fail('artefaktSha256 fehlt/ungueltig in build-report.json — zuerst npm run build (nach render)');
    } else if (existsSync(HTML) && existsSync(SHA)) {
      const artefakt = (await readFile(SHA, 'utf8')).trim().split(/\s+/)[0] ?? '';
      if (artefakt === report.artefaktSha256) ok('artefaktSha256 == Artefakt-sha256 (gleicher Stand)');
      else fail(`artefaktSha256 (${String(report.artefaktSha256).slice(0, 16)}…) != Artefakt-sha256 (${artefakt.slice(0, 16)}…)`);
    }
  }
}

if (fehler.length > 0) {
  console.error(`verify-dist: ${fehler.length} Befund(e): ${fehler.join('; ')}`);
  process.exit(1);
}
console.log('verify-dist: ALLE CHECKS GRUEN');
