/**
 * v50-Regression (Baseten-Doku-Regel + zweistufiger 400-Fallback, 03.11.2026):
 * Live-400 (Baseten): "Invalid request: max_completion_tokens (131072):
 * Extra inputs are not permitted" — die Baseten-Chat-Completions-Referenz
 * (live geprueft) listet ausschliesslich max_tokens. Deshalb sendet der
 * Baseten-Erst-Body nur max_tokens; Stufe 1 strippt weiter Extras, Stufe 2
 * strippt bei Extra-inputs-400 die Limit-Felder (gen+mod+Retry, alle
 * Provider). Diagnose weist den Limit-Strip aus (ls-Flag, eigene Zeilen).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  D1) Laufzeit-Stempel v50 an allen 5 Stellen, Alt-Stempel raus.
 *  D2) Doku-Regel + Stufe-2-Strip + Echo-Snapshots (ls) + Limit-Strip-Zeilen.
 *  S)  Stempel-Kette intakt (v13..v50 je 1x), Groesse < 600 KB.
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

test('v50-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v44', 'v45', 'v46', 'v47', 'v48', 'v49', 'v50']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('D1: Laufzeit-Diagnose-Stempel v50 (5 Stellen), v49/v48 raus', async () => {
  const s = await html();
  assert.equal(cnt(s, 'bits.push("Build v50")'), 1, 'emptyDetail-Stempel');
  assert.equal(cnt(s, 'bits.push("Build v49")'), 0, 'Alt-Stempel emptyDetail raus');
  assert.equal(cnt(s, 'bits.push("Build v48")'), 0, 'Alt-Stempel emptyDetail raus (v48)');
  assert.equal(cnt(s, 'var bld="v50";try{bld=this.buildTag();}'), 1, 'diagText-Default');
  assert.equal(cnt(s, 'var bld="v49";try{bld=this.buildTag();}'), 0, 'Alt-Default raus');
  assert.equal(cnt(s, 'buildTag:function(){return "v50";},'), 1, 'buildTag');
  assert.equal(cnt(s, 'buildTag:function(){return "v49";},'), 0, 'Alt-buildTag raus');
  assert.equal(cnt(s, 'var mine=50;'), 1, 'staleHint-mine');
  assert.equal(cnt(s, 'var mine=49;'), 0, 'Alt-mine raus');
  assert.equal(cnt(s, ',10)||50;'), 1, 'staleHint-Fallback');
  assert.equal(cnt(s, ',10)||49;'), 0, 'Alt-Fallback raus');
});

test('D2: Doku-Regel + Stufe-2-Strip + Echo-ls + Limit-Strip-Zeilen', async () => {
  const s = await html();
  assert.equal(cnt(s, 'temperature:0.2,max_completion_tokens:131072,max_tokens:131072'), 2, 'Limit in beiden Erst-Bodies (gen+mod)');
  assert.equal(cnt(s, 'max_completion_tokens:131072'), 2, 'Erst-Bodies gen+mod');
  assert.equal(cnt(s, 'max_tokens:131072'), 2, 'Mirror gen+mod');
  assert.equal(cnt(s, 'max_completion_tokens=131072'), 0, 'kein Retry-Literal (Body wird geteilt)');
  assert.equal(cnt(s, 'max_completion_tokens:65536'), 0, 'kein Erst-Budget (alt)');
  assert.equal(cnt(s, 'max_tokens=65536'), 0, 'kein max_tokens-Mirror (alt)');
  assert.equal(cnt(s, 'max_tokens=131072'), 0, 'kein Retry-Mirror (alt, =Form)');
  // D0: Baseten-Doku-Regel — nur max_tokens, max_completion_tokens faellt.
  assert.equal(cnt(s, 'delete gbody.max_completion_tokens'), 2, 'Doku-Regel generate');
  assert.equal(cnt(s, 'delete mbody.max_completion_tokens'), 2, 'Doku-Regel modify');
  // F3/F4: Stufe 2 — Extra-inputs-400 -> beide Limit-Felder raus, einmal neu.
  assert.equal(cnt(s, 'delete gbody.max_tokens'), 1, 'Stufe-2-Strip generate');
  assert.equal(cnt(s, 'delete mbody.max_tokens'), 1, 'Stufe-2-Strip modify');
  assert.equal(cnt(s, '/extra inputs/i'), 2, 'Stufe-2-Erkennung gen+mod');
  // Stufe 1 bleibt: nur Extras.
  assert.equal(cnt(s, 'delete gbody.stream_options'), 1, 'Stufe 1 strippt weiter Extras (gen)');
  assert.equal(cnt(s, 'delete mbody.stream_options'), 1, 'Stufe 1 strippt weiter Extras (mod)');
  // Echo-Snapshots lesen Limit aus dem Body (je gen/mod: Erst + Fallback + Retry + Stufe 2).
  assert.equal(cnt(s, 'mc:gbody.max_completion_tokens'), 4, 'Echo-Snapshots gen');
  assert.equal(cnt(s, 'mc:mbody.max_completion_tokens'), 4, 'Echo-Snapshots mod');
  assert.equal(cnt(s, 'mt:gbody.max_tokens'), 4, 'Echo-Snapshots gen (Mirror)');
  assert.equal(cnt(s, 'mt:mbody.max_tokens'), 4, 'Echo-Snapshots mod (Mirror)');
  assert.equal(cnt(s, ',ls:0'), 4, 'ls-Flag Erst/Fallback (kein Strip)');
  assert.equal(cnt(s, ',ls:1'), 2, 'ls-Flag Stufe 2 (gen+mod)');
  // Diagnose-Labels (Erst + Retry) bleiben, dazu Limit-Strip-Nachweis.
  assert.equal(cnt(s, 'req_max_completion_tokens: '), 1, 'Echo-Label generate-Diag');
  assert.equal(cnt(s, 'req_max_tokens: '), 1, 'Echo-Label Mirror-Diag');
  assert.equal(cnt(s, 'req_400_limit_strip: '), 1, 'Echo-Label Limit-Strip-Diag');
  assert.equal(cnt(s, 'req_retry_max_completion_tokens: '), 1, 'Echo-Label Retry-Diag');
  assert.equal(cnt(s, 'req_retry_max_tokens: '), 1, 'Echo-Label Retry-Mirror-Diag');
  assert.equal(cnt(s, 'req_retry_400_limit_strip: '), 1, 'Echo-Label Retry-Limit-Strip-Diag');
  assert.equal(cnt(s, 'usage_completion_tokens: '), 2, 'Usage-Anzeige generate-Diag + Tele-Text');
});
