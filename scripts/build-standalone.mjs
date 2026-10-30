/**
 * Standalone-Builder (versioniert): dist-standalone/modelmuse-standalone.html
 * auf Guide-Stand (docs/implementation-guide-3d-qualitaet.md Abschnitt 2-3) heben.
 *
 * Builder-Weg (Abgrenzung zu scripts/build.mjs):
 * - scripts/build.mjs baut dist/lab-player.html aus src/ (Shell/Runtime/Models/Vendor).
 * - DIESES Skript patcht dist-standalone/modelmuse-standalone.html deterministisch
 *   (muse-generierte Single-Page, Builder-Kette designer-scratch/assemble-v4..v11,
 *   Stand v11, Titel v10). designer-scratch/ ist unversioniert und wurde am
 *   28.10.2026 (Parallel-Cleanup) entfernt; dieses Skript ersetzt die Kette als
 *   versionierter Builder. Keine Designer-Backups werden angefasst/erzeugt.
 *
 * Fixes (Guide F2/F3, IBL-T1, 4-Lichter, DPR-Cap, Negativ-Liste):
 *  R1-R4  PCFSoftShadowMap -> PCFShadowMap (Shadow-Typ; Destruktor/Allowlist/T-Map behalten, +PCFShadowMap)
 *  R5     shadow.mapSize 2048 -> 1024 (Negativ-Liste)
 *  R6/R7  shadow.bias -0.0005 -> -0.0001, shadow.radius = 4 ergaenzt (Lichtblock)
 *  R8/R9  Key 2.0 -> 2.5, Akzent-PointLight 3 -> 0.12 (4-Lichter-Rezept)
 *  R10    Dunkel-Raum 0x11141a (Basic) -> 0xcccccc (Standard, side: 1) (IBL-Raum)
 *  R11    PointLight(0xffffff, 900, 28, 2) in den Raum (IBL-Raum)
 *  R12    si-3 DPR-Clamp (DPR-Cap 1..2)
 *  R13/R14 Free-Modell: PCFShadowMap + bias/normalBias/radius + DPR-Clamp + preserveDrawingBuffer
 *  R15    buildFreePrompt: Optik-Zeile + Import-Vorlage auf Guide-Rezept
 *  R16    envMapIntensity-Tode beseitigen, NUR scene.environmentIntensity = 0.55 (F3)
 *  R17    Titel/Badges v10 -> v12-guide + Build-Stempel
 *
 * Aufruf: node scripts/build-standalone.mjs
 * Idempotenz: Zweitlauf bricht ab (Erwartungszaehlungen greifen nur auf v11-Basis).
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILE = process.argv[2] ?? 'dist-standalone/modelmuse-standalone.html';
const REPORT = process.argv[2] ? null : 'dist-standalone/build-standalone-report.json';
const EXPECT_BASIS_BYTES = 281090;

function must(cond, msg) {
  if (!cond) { console.error('build-standalone: FEHLER ' + msg); process.exit(1); }
}
function replaceCount(src, re, rep, label) {
  let n = 0;
  let out;
  if (typeof rep === 'function') {
    out = src.replace(re, (...a) => { n += 1; return rep(...a); });
  } else {
    out = src.replace(re, (...a) => { n += 1; return rep.replace(/\$(\d+)/g, (_, d) => a[Number(d)] ?? ''); });
  }
  return { out, n, label };
}
function expectCount(res, want) {
  must(res.n === want, `${res.label}: ${res.n} Treffer, erwartet ${want} — Datei weicht von v11-Basis ab, Abbruch ohne Schreiben`);
  console.log(`  ${res.label}: ${res.n} ok`);
  return res.out;
}
/** Klammer-Matching ab Index von '{' (string-sicher: '...' "..." `...`). */
function matchBrace(src, openIdx) {
  must(src[openIdx] === '{', 'matchBrace: kein {');
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
  must(depth === 0, 'matchBrace: kein schliessendes } gefunden');
  return i - 1;
}

let s = await readFile(FILE, 'utf8');
console.log(`build-standalone: Basis ${s.length} Zeichen`);
// Basis-Guards (laufen NUR auf v11-Stand; Zweitlauf bricht hier ab).
must(s.includes('<title>ModelMuse Generator 3D-Viewer v10</title>'), 'Basis-Titel v10 fehlt (bereits gebaut oder fremde Basis)');
must(s.includes('__frameScene'), 'v11-Framing fehlt (falsche Basis)');
must(!s.includes('standalone-build v12-guide'), 'v12-guide bereits appliziert (Zweitlauf) — Abbruch');
must(s.split('PCFSoftShadowMap').length - 1 === 15, 'PCFSoft-Basiszaehlung != 15');
must(!s.includes('PCFShadowMap;') || true, 'noop');

// R1: Destruktor um PCFShadowMap erweitern (1x, unquotiert).
s = expectCount(replaceCount(s, /OctahedronGeometry, PCFSoftShadowMap, PMREMGenerator/, 'OctahedronGeometry, PCFShadowMap, PCFSoftShadowMap, PMREMGenerator', 'R1 Destruktor'), 1);
// R1b: Prolog-Destruktor aus __C.T (ohne Leerzeichen, 1x).
s = expectCount(replaceCount(s, /OctahedronGeometry,PCFSoftShadowMap,PMREMGenerator/, 'OctahedronGeometry,PCFShadowMap,PCFSoftShadowMap,PMREMGenerator', 'R1b Prolog-Destruktor'), 1);
// R2: Allowliste (quotiert, 1x).
s = expectCount(replaceCount(s, /"PCFSoftShadowMap"/g, '"PCFShadowMap","PCFSoftShadowMap"', 'R2 Allowlist'), 1);
// R3: T-Map (1 Zeile, enthaelt Key+Value).
s = expectCount(replaceCount(s, /PCFSoftShadowMap:PCFSoftShadowMap/g, 'PCFShadowMap:PCFShadowMap,PCFSoftShadowMap:PCFSoftShadowMap', 'R3 T-Map'), 1);
// R4: Shadow-Typ in allen 10 Inits.
s = expectCount(replaceCount(s, /\.shadowMap\.type\s*=\s*PCFSoftShadowMap/g, '.shadowMap.type = PCFShadowMap', 'R4 Shadow-Typ'), 10);
// R5: mapSize 2048 -> 1024 (9 kuratierte Modelle; free hat bereits 1024).
s = expectCount(replaceCount(s, /\.mapSize\.set\(\s*2048\s*,\s*2048\s*\)/g, '.mapSize.set(1024,1024)', 'R5 mapSize'), 9);
// R6: bias -0.0005 -> -0.0001 (9x key.shadow.bias; Funktions-Rep, da Helper $1 nicht expandiert).
s = expectCount(replaceCount(s, /(key\.shadow\.bias\s*=\s*)-0\.0005/g, (m, p1) => `${p1}-0.0001`, 'R6 bias'), 9);
// R7: shadow.radius = 4 nach normalBias (9x; free separat in R13).
{
  const variants = [
    { re: /key\.shadow\.normalBias = 0\.002;/g, add: '\nkey.shadow.radius = 4;' },
    { re: /key\.shadow\.normalBias=0\.002;/g, add: '\nkey.shadow.radius=4;' },
  ];
  let total = 0;
  for (const v of variants) {
    const r = replaceCount(s, v.re, (m) => { total += 1; return m + v.add; }, 'R7 radius');
    s = r.out;
  }
  must(total === 9, `R7 radius: ${total} Treffer, erwartet 9`);
  console.log(`  R7 radius: ${total} ok`);
}
// R8: Key-Intensitaet 2.0 -> 2.5 (8 kuratierte, ohne si-1/free).
s = expectCount(replaceCount(s, /new DirectionalLight\(0xffffff\s*,\s*2\.0\)/g, 'new DirectionalLight(0xffffff, 2.5)', 'R8 Key'), 8);
// R9: Akzent-PointLight 3 -> 0.12 (8 kuratierte, ohne si-1/free-fill).
s = expectCount(replaceCount(s, /new PointLight\(0xffd9a0\s*,\s*3\s*,\s*1\.5\s*,\s*2\s*\)/g, 'new PointLight(0xffd9a0, 0.12, 1.5, 2)', 'R9 Akzent'), 8);
// R10: Dunkel-Raum -> heller Standard-Raum (9x).
s = expectCount(replaceCount(
  s,
  /new MeshBasicMaterial\(\{\s*color\s*:\s*0x11141a\s*,\s*side\s*:\s*(?:1|DoubleSide)\s*\}\)/g,
  'new MeshStandardMaterial({ color: 0xcccccc, side: 1 })',
  'R10 IBL-Waende',
), 9);
// R11: Raumlicht nach Wand-Add (9x, Einrueckung erhalten).
must(s.split('PointLight(0xffffff, 900').length - 1 === 0, 'R11: roomLight bereits vorhanden');
must(s.split('roomLight').length - 1 === 0, 'R11: roomLight-Bezeichner bereits vorhanden');
{
  const r = replaceCount(
    s,
    /^([ \t]*)room\.add\((roomMesh|roomBox)\);/gm,
    (m, ind, what) => `${m}\n${ind}const roomLight = new PointLight(0xffffff, 900, 28, 2);\n${ind}room.add(roomLight);`,
    'R11 Raumlicht',
  );
  must(r.n === 9, `R11 Raumlicht: ${r.n} Treffer, erwartet 9`);
  console.log(`  R11 Raumlicht: ${r.n} ok`);
  s = r.out;
}
// R12: si-3 DPR-Clamp.
s = expectCount(replaceCount(s, /let rawDpr=p\.dpr\|\|1;/g, 'let rawDpr=Math.min(2,Math.max(1,p.dpr||1));', 'R12 si-3 DPR'), 1);
// R13: Free-Modell Key-Schatten (mapSize 1024 MIT Leerzeichen = nur free).
s = expectCount(replaceCount(
  s,
  /key\.shadow\.mapSize\.set\(1024, 1024\);/g,
  'key.shadow.mapSize.set(1024, 1024);\nkey.shadow.bias = -0.0001;\nkey.shadow.normalBias = 0.002;\nkey.shadow.radius = 4;',
  'R13 free-Schatten',
), 1);
// R14: Free-Modell Renderer (DPR + preserveDrawingBuffer).
s = expectCount(replaceCount(
  s,
  /const renderer = new WebGLRenderer\(\{ antialias: true \}\);\nrenderer\.setSize\(w, h\);/g,
  'const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });\nconst fdpr = Math.min(2, Math.max(1, (params && params.dpr) || 1));\nrenderer.setPixelRatio(fdpr);\nrenderer.setSize(w, h);',
  'R14 free-Renderer',
), 1);
// R15: buildFreePrompt (Optik-Zeile + Import-Vorlage).
s = expectCount(replaceCount(
  s,
  /"Optik: ACES-ToneMapping, SRGB, Antialiasing, Hemisphere- plus Key-Licht \(PCFSoft-Schatten\) plus Fuell-Licht, PBR-Materialien, jedes Mesh castShadow\/receiveShadow \(Linien ausgenommen\)\."/g,
  '"Licht & IBL (genau 4 Lichter, KEIN AmbientLight): HemisphereLight(0xdfeaff, 0x1a1410, 0.35); Key-DirectionalLight(0xffffff, 2.5) mit Schatten (mapSize 1024x1024, PCFShadowMap, Frustum ums Modell + updateProjectionMatrix, bias -0.0001, normalBias 0.002-0.02, radius gesetzt); Rim-DirectionalLight(0xbcd0ff, 0.7); PointLight(0xffd9a0, 0.12, 1.5, 2) ohne Schatten. Inline-Environment: PMREMGenerator + const room = new Scene(); Waende MeshStandardMaterial 0xcccccc (side: 1) + PointLight(0xffffff, 900, 28, 2) + 2 Softboxen MeshBasicMaterial 0xffffff; pmrem.fromScene(room, 0.04).texture auf scene.environment; NUR scene.environmentIntensity = 0.55. DPR 1..2 (Default 1). Negativ: KEIN transmission/iridescence/sheen, KEIN CanvasTexture/document/canvas, KEIN fetch/TextureLoader/CDN, KEIN mapSize 2048, KEIN DPR>=2-Default, KEIN curveSegments>=12/bevelSegments>=3, KEIN DoubleSide global, KEIN PointLight-Schatten."',
  'R15a Prompt-Optik',
), 1);
s = expectCount(replaceCount(
  s,
  /import \{ Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, HemisphereLight, DirectionalLight, Vector3 \} from 'three';/g,
  "import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, HemisphereLight, DirectionalLight, PointLight, Vector3, PMREMGenerator, ShadowMaterial, PCFShadowMap, DataTexture, ACESFilmicToneMapping, SRGBColorSpace } from 'three';",
  'R15b Prompt-Imports',
), 1);

// R16: envMapIntensity-Tode -> NUR scene.environmentIntensity = 0.55.
// R16a-c: si-1 hasEnvI-Trio.
s = expectCount(replaceCount(s, /^[ \t]*let hasEnvI = false;\r?\n/gm, '', 'R16a hasEnvI-Dekl'), 1);
s = expectCount(replaceCount(
  s,
  /if\(scene\.environmentIntensity !== undefined\)\{ scene\.environmentIntensity = 0\.55; hasEnvI = true; \}/g,
  'scene.environmentIntensity = 0.55;',
  'R16b hasEnvI-Guard',
), 1);
s = expectCount(replaceCount(
  s,
  /^[ \t]*if\(!hasEnvI\)\{\r?\n^[ \t]*for\(let i=0;i<allMats\.length;i\+\+\)\{ allMats\[i\]\.envMapIntensity = 0\.55; \}\r?\n^[ \t]*\}\r?\n/gm,
  '',
  'R16c hasEnvI-Fallback',
), 1);
// R16d: if/else-Guards (si-2, si-3, dup-1, dup-2, dup-3, ae-1, ae-2, ae-3) per Klammer-Parser.
{
  const guardRe = /if\s*\(\s*(scene\.environmentIntensity\s*!==\s*undefined|'environmentIntensity'\s+in\s+scene|scene\.environmentIntensity\s*===\s*undefined)\s*\)\s*\{/g;
  let out = ''; let last = 0; let n = 0; let m;
  while ((m = guardRe.exec(s))) {
    const bodyOpen = m.index + m[0].length - 1;
    const bodyClose = matchBrace(s, bodyOpen);
    const body = s.slice(bodyOpen + 1, bodyClose);
    const elseM = /^\s*else\s*\{/.exec(s.slice(bodyClose + 1));
    must(elseM, `R16d: Guard ohne else bei Index ${m.index} (unerwartete Form)`);
    const elseOpen = bodyClose + 1 + elseM[0].length - 1;
    const elseClose = matchBrace(s, elseOpen);
    const elseBody = s.slice(elseOpen + 1, elseClose);
    const assignInIf = /scene\.environmentIntensity\s*=\s*0\.55/.test(body);
    const envInIf = body.includes('envMapIntensity');
    const assignInElse = /scene\.environmentIntensity\s*=\s*0\.55/.test(elseBody);
    const envInElse = elseBody.includes('envMapIntensity');
    must(
      (assignInIf && envInElse && !envInIf) || (assignInElse && envInIf && !assignInIf),
      `R16d: Guard-Form unerkannt bei Index ${m.index}`,
    );
    out += s.slice(last, m.index) + 'scene.environmentIntensity = 0.55;';
    last = elseClose + 1; n += 1;
    guardRe.lastIndex = last;
  }
  out += s.slice(last);
  must(n === 8, `R16d Guards: ${n} Treffer, erwartet 8`);
  console.log(`  R16d Guards: ${n} ok`);
  s = out;
}

// R17: Titel/Badges + Build-Stempel.
s = expectCount(replaceCount(s, /<title>ModelMuse Generator 3D-Viewer v10<\/title>/g, '<title>ModelMuse Generator 3D-Viewer v12-guide</title>', 'R17a Titel'), 1);
s = expectCount(replaceCount(s, /viewerBadge:"3D-Viewer v10"/g, 'viewerBadge:"3D-Viewer v12-guide"', 'R17b Badge DE'), 1);
s = expectCount(replaceCount(s, /viewerBadge:"3D Viewer v10"/g, 'viewerBadge:"3D Viewer v12-guide"', 'R17c Badge EN'), 1);
s = expectCount(replaceCount(s, /viewerBadge:"Visor 3D v10"/g, 'viewerBadge:"Visor 3D v12-guide"', 'R17d Badge ES'), 1);
s = expectCount(replaceCount(
  s,
  /<meta name="viewport" content="width=device-width, initial-scale=1">/g,
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n<!-- standalone-build v12-guide: Guide Abs. 2-3 (PCFShadowMap, IBL-Raum, 4-Lichter, DPR-Cap, Negativ-Liste) via scripts/build-standalone.mjs -->',
  'R17e Stempel',
), 1);

// Schluss-Invarianten (Guide F2/F3 + Rezept).
const cnt = (sub) => s.split(sub).length - 1;
const inv = [
  ['envMapIntensity', 0], ['0x11141a', 0], ['hasEnvI', 0],
  ['PCFSoftShadowMap', 5], ['mapSize.set(2048', 0], ['-0.0005', 0],
];
for (const [sub, want] of inv) must(cnt(sub) === want, `Invariante ${sub}: ${cnt(sub)}, erwartet ${want}`);
must(cnt('new MeshStandardMaterial({ color: 0xcccccc, side: 1 })') === 9, 'IBL-Waende != 9');
must(cnt('new PointLight(0xffffff, 900, 28, 2)') === 9, 'Raumlicht != 9');
must(cnt('shadow.radius') === 10, `shadow.radius: ${cnt('shadow.radius')}, erwartet 10`);
must(cnt('key.shadow.bias = -0.0001') + cnt('key.shadow.bias=-0.0001') === 10, 'bias-Zielwert != 10 (9 kuratiert + 1 free)');
must(cnt('$1') === 0, 'unexpandierte $1-Reste');
must(cnt('scene.environmentIntensity = 0.55') + cnt('scene.environmentIntensity=0.55') >= 9, 'environmentIntensity-Zuweisungen < 9');
must(cnt('new DirectionalLight(0xffffff,2.0)') + cnt('new DirectionalLight(0xffffff, 2.0)') === 0, 'Key 2.0-Rest');
must(cnt('0xffd9a0,3') + cnt('0xffd9a0, 3') === 0, 'Akzent 3-Rest');
must(cnt('PCFShadowMap') >= 15, 'PCFShadowMap-Ausbau fehlt');
console.log('  Invarianten ok');

// R18: 2D-Portfolio (docs/MODELLPORTFOLIO-VORSCHLAG.md §3.2): ae-1..3 auf
// is3d:false — der renderDiagram2D-Zweig fuer ae existiert bereits
// (Klassenbox, Balkenfeld, Client-Kette), 2D-SVG-Zweige brauchen keinen 3D-Pfad.
s = expectCount(replaceCount(s, /(\{id:"ae-1",track:"AE",)is3d:true/g, '$1is3d:false', 'R18a ae-1 2D'), 1);
s = expectCount(replaceCount(s, /(\{id:"ae-2",track:"AE",)is3d:true/g, '$1is3d:false', 'R18b ae-2 2D'), 1);
s = expectCount(replaceCount(s, /(\{id:"ae-3",track:"AE",)is3d:true/g, '$1is3d:false', 'R18c ae-3 2D'), 1);

// R19: Attributions-Footer (Lizenz-Audit 29.10.2026, docs/LIZENZEN.md).
// Das Standalone BUENDELT keine Fremd-Bibliothek, REFERENZIERT aber vier per
// CDN: three.js 0.186.1 (MIT), Vue 3 (MIT), Tailwind CSS (MIT), Inter (OFL-1.1).
// Beleg der Abgrenzung: kein Alpine-Code (grep -c -i alpine = 0) und kein
// inline three.js-Bibliothekskoerper (kein "REVISION = '...'") im Artefakt.
// Drei Schritte: (1) I18N-Key footerAttrib in de/en/es, (2) sichtbare
// Footer-Zeile mit Versions- und Lizenzangabe, (3) Provenienz-Verweis.
// Anker je 1x vorhanden -> expectCount bricht bei Fremdbasis ab.
const ATTRIB_DE = 'Attribution: three.js 0.186.1 (MIT) \\u00b7 Vue 3 (MIT) \\u00b7 Tailwind CSS (MIT) \\u00b7 Inter Font (SIL OFL 1.1). Vollst\\u00e4ndige Lizenztexte und Herkunftsnachweis: docs/LIZENZEN.md';
const ATTRIB_EN = 'Attribution: three.js 0.186.1 (MIT) \\u00b7 Vue 3 (MIT) \\u00b7 Tailwind CSS (MIT) \\u00b7 Inter Font (SIL OFL 1.1). Full license texts and provenance: docs/LIZENZEN.md';
const ATTRIB_ES = 'Atribuci\\u00f3n: three.js 0.186.1 (MIT) \\u00b7 Vue 3 (MIT) \\u00b7 Tailwind CSS (MIT) \\u00b7 Inter Font (SIL OFL 1.1). Textos de licencia completos y procedencia: docs/LIZENZEN.md';
s = expectCount(replaceCount(s, /(\(LocalStorage\) gespeichert\.",)/, (m, p1) => `${p1}footerAttrib:"${ATTRIB_DE}",`, 'R19a footerAttrib de'), 1);
s = expectCount(replaceCount(s, /(your browser \(LocalStorage\)\.",)/, (m, p1) => `${p1}footerAttrib:"${ATTRIB_EN}",`, 'R19b footerAttrib en'), 1);
s = expectCount(replaceCount(s, /(en tu navegador \(LocalStorage\)\.",)/, (m, p1) => `${p1}footerAttrib:"${ATTRIB_ES}",`, 'R19c footerAttrib es'), 1);
s = expectCount(replaceCount(
  s,
  /(\{\{t\('resetProgress'\)\}\}<\/button>\n<\/div>\n)<\/footer>/,
  (m, p1) => `${p1}<p class="max-w-[1920px] mx-auto px-4 pb-4 text-xs text-slate-500 dark:text-slate-400">{{t('footerAttrib')}}</p>\n</footer>`,
  'R19d Attributions-Footer',
), 1);

await writeFile(FILE, s);
console.log(`build-standalone: geschrieben (${s.length} Zeichen)`);
const report = {
  createdAt: new Date().toISOString(),
  basis: 'v11 (assemble-v11, Titel v10)',
  standalone: 'v12-guide',
  guide: 'docs/implementation-guide-3d-qualitaet.md Abschnitte 2-3',
  fixes: ['R1-R4 PCFShadowMap', 'R5 mapSize 1024', 'R6/R7 bias/radius', 'R8/R9 4-Lichter', 'R10/R11 IBL-Raum', 'R12 si-3 DPR', 'R13/R14 free-Modell', 'R15 Prompt', 'R16 F3 envMapIntensity', 'R17 Titel', 'R18 ae-1..3 is3d:false (2D-Portfolio)', 'R19 Attributions-Footer (docs/LIZENZEN.md)'],
  counts: {
    PCFSoftShadowMap: cnt('PCFSoftShadowMap'), PCFShadowMap: cnt('PCFShadowMap'),
    envMapIntensity: 0, dunkelRaum: 0, helleWaende: 9, raumlicht: 9,
    shadowRadius: cnt('shadow.radius'), map2048: 0, biasAlt: 0,
    footerAttrib: cnt('footerAttrib'), attributionZeile: cnt("{{t('footerAttrib')}}</p>"),
  },
  notes: 'Free-Modell (Nutzer-Artefakt): Lichter/DPR/Schatten guide-konform gepatcht, keine IBL-Nachruestung (Optik-Identitaet). R19 ergaenzt die Attributions-Zeile im Footer (de/en/es) mit den vier CDN-Referenzen des Standalone (three.js, Vue 3, Tailwind CSS, Inter) — das Standalone BUENDELT keine Fremd-Bibliothek.',
};
if (REPORT) {
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('build-standalone: OK v12-guide');
} else {
  console.log('build-standalone: DRY-RUN ok (kein Report geschrieben)');
}
