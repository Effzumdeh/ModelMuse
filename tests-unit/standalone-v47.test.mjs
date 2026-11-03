/**
 * v47-Regression (Diagnose-Stempel nachgezogen, 03.11.2026):
 * Laufzeit-Diagnose meldete build: v26 bei Builder-Stand v46
 * (v27..v46 zogen den Stempel nie mit); GEN_BUILD war v23.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html.
 * Nachfolger-Toleranz (v48, Eigentuemer-Alternative 03.11.2026: explizites
 * Limit 131072 statt v23-kein-Limit): mit v48-Stempel gelten v48-Stempel
 * und die v48-Limit-Regel (geprueft in standalone-v48.test.mjs); ohne
 * v48-Stempel gilt der v47-Stand unten.
 *  D1) Laufzeit-Stempel v47 (ohne v48) bzw. v48 (mit v48-Stempel).
 *  D2) v47: kein Limit-Rest (ohne v48) bzw. explizites Limit (mit v48).
 *  S)  Stempel-Kette intakt (v13..v47 je 1x), Groesse < 600 KB.
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

test('v47-Stempel und Kette intakt', async () => {
  const s = await html();
  for (const v of ['v44', 'v45', 'v46', 'v47']) {
    assert.equal(cnt(s, 'standalone-build ' + v), 1, `Stempel fehlt/mehrdeutig: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('D1: Laufzeit-Diagnose-Stempel v47 (5 Stellen), v26 raus (v48-tolerant)', async () => {
  const s = await html();
  const is48 = s.includes('standalone-build v48');
  const want = is48 ? 'v48' : 'v47';
  assert.equal(cnt(s, `bits.push("Build ${want}")`), 1, 'emptyDetail-Stempel');
  assert.equal(cnt(s, 'bits.push("Build v26")'), 0, 'Alt-Stempel emptyDetail raus');
  assert.equal(cnt(s, `var bld="${want}";try{bld=this.buildTag();}`), 1, 'diagText-Default');
  assert.equal(cnt(s, 'var bld="v26";try{bld=this.buildTag();}'), 0, 'Alt-Default raus');
  assert.equal(cnt(s, `buildTag:function(){return "${want}";},`), 1, 'buildTag');
  assert.equal(cnt(s, 'buildTag:function(){return "v26";},'), 0, 'Alt-buildTag raus');
  // staleHint: v47 nutzt mine=47 (Nachfolger v48 nutzt mine=48).
  if (!is48) {
    assert.equal(cnt(s, 'var mine=47;'), 1, 'staleHint-mine');
    assert.equal(cnt(s, 'var mine=26;'), 0, 'Alt-mine raus');
    assert.equal(cnt(s, ',10)||47;'), 1, 'staleHint-Fallback');
    assert.equal(cnt(s, ',10)||26;'), 0, 'Alt-Fallback raus');
  } else {
    assert.equal(cnt(s, 'var mine=48;'), 1, 'staleHint-mine (v48)');
    assert.equal(cnt(s, ',10)||48;'), 1, 'staleHint-Fallback (v48)');
  }
});

test('D2: Limit-Regel (v47: kein Rest; v48: explizites Maximum 131072)', async () => {
  const s = await html();
  const is48 = s.includes('standalone-build v48');
  if (!is48) {
    assert.equal(cnt(s, 'temperature:0.2,max_completion_tokens'), 0, 'kein Limit im Erst-Body');
    assert.equal(cnt(s, 'temperature:0.2,max_tokens'), 0, 'kein Mirror im Erst-Body');
    assert.equal(cnt(s, 'max_completion_tokens=131072'), 0, 'kein Retry-Budget');
    assert.equal(cnt(s, 'max_completion_tokens:65536'), 0, 'kein Erst-Budget');
    assert.equal(cnt(s, 'max_tokens=65536'), 0, 'kein max_tokens-Mirror');
    assert.equal(cnt(s, 'max_tokens=131072'), 0, 'kein Retry-Mirror');
    assert.equal(cnt(s, 'delete gbody.max_tokens'), 0, 'kein Mirror-Strip noetig (generate)');
    assert.equal(cnt(s, 'delete mbody.max_tokens'), 0, 'kein Mirror-Strip noetig (modify)');
  } else {
    assert.equal(cnt(s, 'temperature:0.2,max_completion_tokens:131072,max_tokens:131072'), 2, 'Limit in beiden Erst-Bodies (v48)');
    assert.equal(cnt(s, 'delete gbody.max_tokens'), 0, 'kein Limit-Strip (v48, generate)');
    assert.equal(cnt(s, 'delete mbody.max_tokens'), 0, 'kein Limit-Strip (v48, modify)');
  }
  // Beleg-Zeilen (Echo + Usage) bleiben — v47 ohne gesendetes Limit, v48 mit Werten.
  assert.equal(cnt(s, 'req_max_completion_tokens: '), 1, 'Echo-Label generate-Diag');
  assert.equal(cnt(s, 'req_max_tokens: '), 1, 'Echo-Label Mirror-Diag');
  assert.equal(cnt(s, 'usage_completion_tokens: '), 2, 'Usage-Anzeige generate-Diag + Tele-Text');
});
