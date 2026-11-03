/**
 * v48-Regression (explizites Limit 131072, 03.11.2026):
 * Weglassen != unbegrenzt — Upstream defaultet ohne Limit-Param auf 32768
 * (Eisbecher-Fall, belegt). Deshalb senden alle Request-Pfade explizit das
 * Maximum (131072, belegt wirksam): generate/modify-Erstversuch (direkt),
 * Retry + 400-Fallback teilen sich dasselbe Body-Objekt (alle Provider),
 * Proxy-Upstream ebenso (livegen + proxy + Artefakt).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  D1) Laufzeit-Stempel v48 an allen 5 Stellen, Alt-Stempel raus.
 *  D2) Explizites Limit 131072 in beiden Erst-Bodies (gen+mod) + Echo zeigt Werte.
 *  S)  Stempel-Kette intakt (v13..v48 je 1x), Groesse < 600 KB.
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

test('v48-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v44', 'v45', 'v46', 'v47', 'v48']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('D1: Laufzeit-Diagnose-Stempel v48 (5 Stellen), v47 raus', async () => {
  const s = await html();
  assert.equal(cnt(s, 'bits.push("Build v48")'), 1, 'emptyDetail-Stempel');
  assert.equal(cnt(s, 'bits.push("Build v47")'), 0, 'Alt-Stempel emptyDetail raus');
  assert.equal(cnt(s, 'var bld="v48";try{bld=this.buildTag();}'), 1, 'diagText-Default');
  assert.equal(cnt(s, 'var bld="v47";try{bld=this.buildTag();}'), 0, 'Alt-Default raus');
  assert.equal(cnt(s, 'buildTag:function(){return "v48";},'), 1, 'buildTag');
  assert.equal(cnt(s, 'buildTag:function(){return "v47";},'), 0, 'Alt-buildTag raus');
  assert.equal(cnt(s, 'var mine=48;'), 1, 'staleHint-mine');
  assert.equal(cnt(s, 'var mine=47;'), 0, 'Alt-mine raus');
  assert.equal(cnt(s, ',10)||48;'), 1, 'staleHint-Fallback');
  assert.equal(cnt(s, ',10)||47;'), 0, 'Alt-Fallback raus');
});

test('D2: explizites Limit 131072 in beiden Erst-Bodies (gen+mod), Echo zeigt Werte', async () => {
  const s = await html();
  assert.equal(cnt(s, 'temperature:0.2,max_completion_tokens:131072,max_tokens:131072'), 2, 'Limit in beiden Erst-Bodies');
  assert.equal(cnt(s, 'max_completion_tokens:131072'), 2, 'Erst-Bodies gen+mod');
  assert.equal(cnt(s, 'max_tokens:131072'), 2, 'Mirror gen+mod');
  assert.equal(cnt(s, 'max_completion_tokens=131072'), 0, 'kein Retry-Literal (Body wird geteilt)');
  assert.equal(cnt(s, 'max_completion_tokens:65536'), 0, 'kein Erst-Budget (alt)');
  assert.equal(cnt(s, 'max_tokens=65536'), 0, 'kein max_tokens-Mirror (alt)');
  assert.equal(cnt(s, 'max_tokens=131072'), 0, 'kein Retry-Mirror (alt, =Form)');
  assert.equal(cnt(s, 'delete gbody.max_tokens'), 0, 'kein Limit-Strip (generate)');
  assert.equal(cnt(s, 'delete mbody.max_tokens'), 0, 'kein Limit-Strip (modify)');
  assert.equal(cnt(s, 'delete gbody.stream_options'), 1, '400-Fallback strippt weiter Extras (gen)');
  assert.equal(cnt(s, 'delete mbody.stream_options'), 1, '400-Fallback strippt weiter Extras (mod)');
  // Echo-Snapshots lesen Limit aus dem Body (je gen/mod: Erst + Fallback + Retry).
  assert.equal(cnt(s, 'mc:gbody.max_completion_tokens'), 3, 'Echo-Snapshots gen');
  assert.equal(cnt(s, 'mc:mbody.max_completion_tokens'), 3, 'Echo-Snapshots mod');
  assert.equal(cnt(s, 'mt:gbody.max_tokens'), 3, 'Echo-Snapshots gen (Mirror)');
  assert.equal(cnt(s, 'mt:mbody.max_tokens'), 3, 'Echo-Snapshots mod (Mirror)');
  // Diagnose-Labels (Erst + Retry) bleiben — zeigen jetzt 131072 statt "(nicht gesendet)".
  assert.equal(cnt(s, 'req_max_completion_tokens: '), 1, 'Echo-Label generate-Diag');
  assert.equal(cnt(s, 'req_max_tokens: '), 1, 'Echo-Label Mirror-Diag');
  assert.equal(cnt(s, 'req_retry_max_completion_tokens: '), 1, 'Echo-Label Retry-Diag');
  assert.equal(cnt(s, 'req_retry_max_tokens: '), 1, 'Echo-Label Retry-Mirror-Diag');
  assert.equal(cnt(s, 'usage_completion_tokens: '), 2, 'Usage-Anzeige generate-Diag + Tele-Text');
});
