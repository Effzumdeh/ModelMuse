/**
 * Router-Beispiel-Log: uebt den ECHTEN P0-Pfad (routeGeneration + Prompt-Template
 * + HTTP-Transport + parse + Fail-closed) gegen einen lokalen Stub-Proxy und
 * schreibt dist-2d/router-2d-log.json. Kein Key, kein Netz, kein LLM.
 * Aufruf: node scripts/router-2d-log.mjs
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { configureLiveGen, routeGeneration, truncateFachtext } from '../src/runtime/livegen.js';

const ROOT = process.cwd();
const OUT = `${ROOT}/dist-2d`;
await mkdir(OUT, { recursive: true });

const p0template = await readFile(`${ROOT}/prompts/p0-router.txt`, 'utf8');

const STUB = {
  motor: '{"mode":"3d","typ":"baugruppe","begruendung":"Mehrere Bauteile mit Lage- und Bewegungsbezug, Orbit bringt Mehrwert."}',
  tiefpass: '{"mode":"2d","typ":"schaltplan","begruendung":"Schaltungstopologie und Signalfluss, keine raeumliche Anordnung noetig."}',
  photosynthese: '{"mode":"2d","typ":"flussdiagramm","begruendung":"Prozess mit Reihenfolge und Verzweigung, kein Raumbezug."}',
  wirkungsgrad: '{"mode":"2d","typ":"diagramm","begruendung":"Kennlinienvergleich auf Achsen, raeumliches Modell ohne Mehrwert."}',
  vokabeln: '{"mode":"2d","typ":"tabelle","begruendung":"Begriffe und Taxonomie ohne Lage, Struktur statt Raum."}',
};

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let prompt = '';
    try {
      prompt = JSON.parse(body).prompt ?? '';
    } catch { /* leer */ }
    if (prompt.includes('STOERUNG-500')) {
      res.writeHead(500);
      res.end('stub-error');
      return;
    }
    let answer = STUB.vokabeln;
    const fach = (prompt.split('<FACHTEXT>')[1] ?? '').split('</FACHTEXT>')[0];
    if (fach.includes('Viertaktmotor')) answer = STUB.motor;
    else if (fach.includes('RC-Tiefpass')) answer = STUB.tiefpass;
    else if (fach.includes('Photosynthese')) answer = STUB.photosynthese;
    else if (fach.includes('Wirkungsgrad')) answer = STUB.wirkungsgrad;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: `Klassifikation: ${answer}` }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
configureLiveGen({ proxyUrl: `http://127.0.0.1:${port}/route`, timeoutMs: 8000 });

const fachtexte = {
  motor3d: 'Viertaktmotor: Kolben, Pleuel, Kurbelwelle, Ventile im Zylinderkopf, Nockenwelle und Zahnriemen im Motorblock verbaut.',
  tiefpass2d: 'RC-Tiefpass: Widerstand, Kondensator, Bode-Diagramm der Grenzfrequenz und Phasenverschiebung im Signalpfad.',
  prozess2d: 'Photosynthese-Ablauf: Lichtreaktion, Calvin-Zyklus, Entscheidungspunkte bei Wassermangel in der Pflanze.',
  kennlinie2d: 'Messreihe Wirkungsgrad ueber Drehzahl, drei Motorvarianten im Vergleich auf Achsen mit Fehlerbalken.',
  begriffe2d: 'Vokabeln Datenbanken: Tabelle, Schluessel, Index, Transaktion — Definitionen und Abgrenzung ohne Bauteile.',
  stoerung500: 'STOERUNG-500: dieser Text provoziert HTTP 500 am Stub (Fail-closed-Nachweis).',
  kappung: 'Kappungs-Probe: ' + 'Wort '.repeat(2000),
};

const log = { createdAt: new Date().toISOString(), proxy: 'stub-lokal (kein LLM, kein Key)', template: 'prompts/p0-router.txt', faelle: [] };
for (const [name, text] of Object.entries(fachtexte)) {
  const t0 = Date.now();
  const decision = await routeGeneration(text, { promptTemplate: p0template });
  const sentLen = p0template.split('{FACHTEXT}').join(truncateFachtext(text)).length;
  log.faelle.push({
    name, fachtextLen: text.length, promptLen: sentLen, gekappt: text.length > 4000,
    route: decision, ms: Date.now() - t0,
  });
  console.log(`${name}: mode=${decision.mode} typ=${decision.typ} fallback=${decision.fallback} (${Date.now() - t0} ms)`);
}
server.close();
await writeFile(`${OUT}/router-2d-log.json`, JSON.stringify(log, null, 2));
const fallbackFaelle = log.faelle.filter((f) => f.route.fallback);
if (fallbackFaelle.length !== 1 || fallbackFaelle[0].name !== 'stoerung500') {
  console.error('router-2d-log: Fail-closed-Erwartung verletzt (genau 1 Fallback: stoerung500)');
  process.exit(1);
}
console.log('router-2d-log: OK (5 klassifiziert, 1 Fail-closed 3D)');
