/**
 * Freimodus-Pfad mit gueltigem UND ungueltigem Key (Nachtauftrag Ziel 4).
 * Key aus Key_muse.md, ausschliesslich via Authorization-Header an localhost-Proxy
 * bzw. Meta; Key erscheint NIE in Logs, Reports oder Dateien (nur Laenge/Status).
 * Ablauf: lokaler Proxy (forward an api.meta.ai + Mock-Routen), dann:
 *  A) ungueltiger Key -> echtes Meta-401 -> E-GEN-401 + deutsche UI-Meldung
 *  B) gueltiger Key -> echtes Meta-200 (Tiny-Call, Gueltigkeitsbeleg)
 *  C) generateLive via Mock-Ok -> Modul + Manifest (Labels/Aufgaben) valide
 *  D) generateLive ohne Proxy -> E-GEN-OFFLINE (Bibliotheks-Fallback)
 * Bericht: dist/livegen-keytest.json (redaktiert).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey } from '../src/runtime/livegen.js';
import { germanMessage, buildFreePrompt, buildFreeManifest } from '../src/shell/ui-livegen.js';
import { validateManifest } from '../src/runtime/didactics.js';
import { extractMeta } from '../src/runtime/verify.js';

const KEYFILE = 'C:/Users/flori/OneDrive/Key_muse.md';
const META_BASE = 'https://api.meta.ai/v1';
const PORT = 18099;

function redact(s) {
  return String(s).replace(/LLM_[0-9A-Za-z_-]+/g, 'LLM_<redaktiert>');
}

const key = (await readFile(KEYFILE, 'utf8')).trim().replace(/^["'`]|["'`]$/g, '');
if (key.length < 8 || /\s/.test(key)) {
  console.error('KEYTEST: Key-Format ungueltig');
  process.exit(2);
}
console.log(`KEYTEST: Key geladen (len=${key.length}, Format ok, Wert redaktiert)`);

const MOCK_MODULE = 'export const meta = { title: "Keytest-Modell", category: "hardware", detailLevel: 2, parts: ["Mast","Rotor","Gondel"], units: "m" };\nexport function init(c, p) { return { update(patch) {}, dispose() {} }; }\n// Messung: addMeasurement(scene, [0,0,0], [0,1,0], "Nabenhoehe: 80 m", { id: "m1", level: "aufbau", unit: "m" })';

function sseBody(text) {
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
  const fin = JSON.stringify({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] });
  return `data: ${payload}\ndata: ${fin}\ndata: [DONE]\n`;
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => resolve(b));
  });
}

const server = createServer(async (req, res) => {
  await readBody(req);
  if (req.url === '/mock401') {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid key' } }));
    return;
  }
  if (req.url === '/mockOk') {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(sseBody(`Vorlauf\n${MOCK_MODULE}\n`));
    return;
  }
  if (req.url === '/forward') {
    // Echter Tiny-Call an Meta mit dem vom Client gelieferten Key (nie geloggt).
    const auth = req.headers.authorization ?? '';
    let status = 0;
    let snippet = '';
    try {
      const r = await fetch(`${META_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth, accept: 'application/json' },
        body: JSON.stringify({ model: 'muse-spark-1.3', stream: false, max_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit: OK' }] }),
      });
      status = r.status;
      snippet = (await r.text()).slice(0, 120);
    } catch (e) {
      status = -1;
      snippet = String(e.message).slice(0, 120);
    }
    // generateLive-kompatibel antworten: nicht-ok -> Klassifikation; ok -> SSE ohne Modul (PARSE).
    if (status !== 200) {
      res.writeHead(status > 0 ? status : 500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'upstream' } }));
    } else {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(sseBody(`upstream-ok ${snippet.slice(0, 40)}`));
    }
    return;
  }
  res.writeHead(404);
  res.end('nope');
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`KEYTEST: Proxy localhost:${PORT} bereit`);

const results = [];
const base = `http://127.0.0.1:${PORT}`;

// A) ungueltiger Key -> echtes 401 -> E-GEN-401
clearLiveApiKey();
configureLiveGen({ proxyUrl: `${base}/forward`, timeoutMs: 30000 });
setLiveApiKey('LLM_00000000_xxxxxxxxxxxxxxxx');
try {
  await generateLive(buildFreePrompt('Windkraftanlage Test'), { seed: 7 });
  results.push({ name: 'A-ungueltiger-Key', ok: false, detail: 'kein Fehler geworfen' });
} catch (e) {
  const code = e?.code ?? '?';
  results.push({ name: 'A-ungueltiger-Key', ok: code === 'E-GEN-401', code, de: germanMessage(e) });
}
console.log(`A: ${JSON.stringify(results[results.length - 1])}`);

// B) gueltiger Key -> echtes 200 (Tiny-Call direkt, Gueltigkeitsbeleg)
clearLiveApiKey();
let httpValid = 0;
try {
  const r = await fetch(`${META_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model: 'muse-spark-1.3', stream: false, max_tokens: 16, messages: [{ role: 'user', content: 'Antworte nur mit: OK' }] }),
  });
  httpValid = r.status;
  await r.text();
} catch {
  httpValid = -1;
}
results.push({ name: 'B-gueltiger-Key-Tiny', ok: httpValid === 200, httpStatus: httpValid });
console.log(`B: gueltiger Key -> Meta HTTP ${httpValid} (Wert redaktiert)`);

// C) voller Pfad via Mock-Ok: Modul + Labels + Manifest valide
clearLiveApiKey();
configureLiveGen({ proxyUrl: `${base}/mockOk`, timeoutMs: 20000 });
setLiveApiKey('LLM_00000000_xxxxxxxxxxxxxxxx');
try {
  const gen = await generateLive(buildFreePrompt('Windkraftanlage'), { seed: 7 });
  const meta = extractMeta(gen.source);
  const man = buildFreeManifest('Windkraftanlage', meta, MOCK_MODULE);
  const rep = validateManifest(man);
  results.push({
    name: 'C-Vollpfad-Mock', ok: rep.ok && man.labels.length >= 3,
    labels: man.labels.length, mess: man.measurements.length,
    tasks: `B/A/P=${man.tasks.filter((t) => t.level === 'basis').length}/${man.tasks.filter((t) => t.level === 'aufbau').length}/${man.tasks.filter((t) => t.level === 'profi').length}`,
  });
} catch (e) {
  results.push({ name: 'C-Vollpfad-Mock', ok: false, code: e?.code ?? '?' });
}
console.log(`C: ${JSON.stringify(results[results.length - 1])}`);

// D) ohne Proxy -> E-GEN-OFFLINE
clearLiveApiKey();
configureLiveGen({ proxyUrl: null });
try {
  await generateLive(buildFreePrompt('Windkraftanlage Test'), {});
  results.push({ name: 'D-offline', ok: false, detail: 'kein Fehler' });
} catch (e) {
  results.push({ name: 'D-offline', ok: e?.code === 'E-GEN-OFFLINE', code: e?.code, de: germanMessage(e) });
}
console.log(`D: ${JSON.stringify(results[results.length - 1])}`);

server.close();
clearLiveApiKey();
configureLiveGen({ proxyUrl: null });

const report = {
  at: new Date().toISOString(),
  proxy: `localhost:${PORT} (forward+mock)`,
  keyHinweis: `Key len=${key.length}, Wert nie protokolliert`,
  results,
  verdict: results.every((r) => r.ok) ? 'pass' : 'fail',
};
await writeFile('dist/livegen-keytest.json', JSON.stringify(report, null, 2));
console.log(`KEYTEST: ${report.verdict} (${results.filter((r) => r.ok).length}/${results.length}) -> dist/livegen-keytest.json`);
if (report.verdict !== 'pass') process.exit(1);
