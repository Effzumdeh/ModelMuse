/**
 * v38-Regression: OpenRouter-Drittprovider + ETA-Robustheit/Entkopplung +
 * Telemetrie-UX + OrthographicCamera. Prueft das GEBAUTE Artefakt
 * dist-standalone/modelmuse-standalone.html:
 *  O) OpenRouter-Eintrag (direkt, 3 verifizierte Slugs), Referer/Title nur
 *     OpenRouter, Keys je Anbieter, Fehlertexte mit openrouter.ai/keys.
 *  E1) ETA robust: Varianten (Case/Prefix/Suffix, contributor=>240),
 *      openrouter->240, unbekannt-mit-Thinking->240.
 *  E2) Queue entdoppelt: fertig ohne Zeit, wartend nur Position.
 *  T) Sterne aktiv, keine Vorschau, Danke->Issue.
 *  F) OrthographicCamera (Allowlist + Prolog + Prompt).
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

test('v38-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v38'), 1, 'v38-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v37'), 1, 'v37-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('O: OpenRouter-Provider (direkt, 3 verifizierte Slugs)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'id:"openrouter"'), 1, 'Provider-ID genau 1x');
  assert.equal(cnt(s, 'https://openrouter.ai/api/v1'), 1, 'OpenRouter-Basis genau 1x');
  for (const slug of ['openai/gpt-6.1-sol', 'meta/muse-spark-1.3', 'anthropic/claude-opus-5.5']) {
    assert.ok(s.includes(slug), `Slug ${slug} im Artefakt`);
  }
  // Keine erfundenen Slugs (gegen Altlast gemma/free pruefen).
  assert.ok(!s.includes('gemma'), 'kein erfundener gemma-Slug');
  assert.ok(!s.includes(':free'), 'kein erfundener :free-Slug');
  assert.equal(cnt(s, 'openrouter-direct'), 0, 'keine alte Provider-ID');
});

test('O: Referer/Title nur OpenRouter, Bearer immer', async () => {
  const s = await html();
  assert.equal(cnt(s, 'directHeaders:function'), 1, 'Header-Methode genau 1x');
  assert.equal(cnt(s, 'headers:this.directHeaders()'), 6, 'alle 6 Direkt-Fetches (gen/mod x Erst/Slim)');
  assert.equal(cnt(s, 'HTTP-Referer'), 1, 'Referer genau 1x (nur openrouter-Zweig)');
  assert.equal(cnt(s, 'X-Title'), 1, 'X-Title genau 1x (nur openrouter-Zweig)');
  assert.ok(s.includes('https://github.com/Effzumdeh/ModelMuse'), 'Referer ist App-Kennung (kein Key)');
});

test('O: Keys je Anbieter + Fehlertexte mit Key-Hinweis', async () => {
  const s = await html();
  assert.equal(cnt(s, 'modelmuse-key-openrouter'), 3, 'eigener OpenRouter-Key (load/location/save)');
  assert.ok(!s.includes('modelmuse-key-openrouter Baseten'), 'keine Key-Vermischung');
  for (const k of ['keyMissingOpenrouter', 'keyInvalidOpenrouter', 'keyFormatOpenrouter']) {
    assert.equal(cnt(s, k), 5, `${k} de/en/es/fr + Auswahl`);
  }
  assert.ok(s.includes('openrouter.ai/keys'), 'Key-Hinweis zeigt auf openrouter.ai/keys');
  assert.ok(s.includes("genProvider===\"openrouter\"?\"OpenRouter-Key (openrouter.ai/keys)\""), 'Placeholder je Anbieter');
});

test('E1: ETA robust (Modellstring-Varianten, contributor=>240)', async () => {
  const s = await html();
  assert.ok(s.includes('if(pv&&hi&&(low===""||low==="auto"||low==="standard")){return 240;}return 60;}'), 'konservative 240-s-Regel');
  assert.ok(s.includes('if(p==="openrouter"&&pv){return 240;}'), 'OpenRouter immer 240 s (unvermessene Modelle)');
  assert.ok(s.includes('low.indexOf("contributor")>=0'), 'contributor-Variante immer gross');
  assert.ok(s.includes('low.lastIndexOf("/")'), 'Vendor-Prefix wird gestrippt');
});

test('E2: Queue entdoppelt (aktiv mit Zeit, Rest ohne)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'if(st==="jobDone"){return "";}'), 1, 'fertig ohne eigene Zeit');
  assert.ok(s.includes('I18N.de.jobQueue="Platz {n}";'), 'wartend de: nur Position');
  assert.ok(s.includes('I18N.en.jobQueue="Slot {n}";'), 'wartend en: nur Position');
  assert.ok(s.includes('jobQueue:"Puesto {n}"'), 'wartend es: nur Position');
  assert.ok(!s.includes('wartet ({s} s)'), 'kein wartend-{s} mehr');
  assert.ok(s.includes('jobTimeText(job,queueNow)'), 'laufender Auftrag weiter mit Zeit');
});

test('T: Danke-Animation + Issue-Button (Vorschau raus)', async () => {
  const s = await html();
  assert.equal(cnt(s, '{{teleBlock()}}'), 0, 'keine Vorschau im Template');
  assert.ok(s.includes('teleBlock:function'), 'Block bleibt Kopierquelle');
  assert.ok(s.includes("{{t('teleThanks')}}"), 'Danke im selben Fenster');
  assert.ok(s.includes('2500'), 'Danke-Phase 2,5 s');
  assert.ok(s.includes('teleCopied&&teleIssueShow'), 'Issue-Button erst nach Danke');
});

test('F: OrthographicCamera (Live-Fall Wonder/A380)', async () => {
  const s = await html();
  assert.ok(s.includes('"OctahedronGeometry","OrthographicCamera","PCFShadowMap"'), 'Guard-Allowlist');
  assert.equal(cnt(s, 'OctahedronGeometry,OrthographicCamera,PCFShadowMap'), 2, 'Classic-Prolog x2 (gen + mod)');
  assert.ok(s.includes('PerspectiveCamera, OrthographicCamera, WebGLRenderer'), 'Prompt-Importvorlage');
  assert.ok(s.includes('oder OrthographicCamera (technische/planartige Ansichten'), 'Kamera-Verwendungsklausel');
});
