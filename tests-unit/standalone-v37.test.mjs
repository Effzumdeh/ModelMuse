/**
 * v37-Regression: Min-Zustand + ETA wonder + Telemetrie-Opt-in + Queue-Feedback + Hygiene.
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  M) Min-Buttons zustandsabhaengig (+/-), Dock kennt tele-status.
 *  E) ETA-Tabelle: 1.3 ODER wonder mit xhigh/max -> 240 s.
 *  T) Telemetrie-Opt-in: Fenster, Ja/Nein, Sterne, Freitext, Copy-Block
 *     (Modell/Provider/Reasoning/Prompt/Usage/HTTP/Dauer, Keys redigiert),
 *     Issue-Link; Hooks in gen + mod.
 *  Q) Je Auftrag eigener Countdown/Overtime + Erfolgs-Feedback;
 *     Hygiene: fertig nach 30 s oder beim Modell-Oeffnen raus.
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

test('v37-Stempel und Kette intakt', async () => {
  const s = await html();
  assert.equal(cnt(s, 'standalone-build v37'), 1, 'v37-Stempel genau 1x');
  assert.equal(cnt(s, 'standalone-build v36'), 1, 'v36-Stempel bleibt');
  assert.ok(s.length < 600000, 'Artefakt unter 600 KB');
});

test('M: Min-Buttons zustandsabhaengig (gen/mod/part/tele)', async () => {
  const s = await html();
  assert.equal(cnt(s, "winMin.gen?'+':'–'"), 1, 'gen-Min zeigt + minimiert');
  assert.equal(cnt(s, "winMin.mod?'+':'–'"), 1, 'mod-Min zeigt + minimiert');
  assert.equal(cnt(s, "winMin.part?'+':'–'"), 1, 'part-Min zeigt + minimiert');
  assert.equal(cnt(s, "toggleWinMin('tele')"), 1, 'tele-Min-Button');
  assert.ok(s.includes('winMin:{gen:false,mod:false,part:false,tele:false}'), 'winMin kennt tele');
  assert.ok(s.includes('id==="tele"){this.winMin.tele'), 'toggleWinMin-Zweig tele');
  assert.ok(s.includes('"tele-status"'), 'Dock stapelt tele-status');
});

test('E: ETA-Tabelle je Modell+Reasoning (wonder wie 1.3)', async () => {
  const s = await html();
  assert.ok(s.includes('m.indexOf("wonder")'), 'wonder in Tabelle');
  assert.ok(s.includes('if(isBig&&hi&&pv){return 240;}return 60;}'), '240 s nur mit xhigh/max');
  assert.equal(cnt(s, 'if(is13&&hi&&pv)'), 0, 'alte is13-Bedingung ersetzt');
});

test('T: Telemetrie-Fenster (Ask/Rate/Copy/Issue-Link)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'id="tele-status"'), 1, 'Tele-Fenster genau 1x');
  assert.ok(s.includes("teleStep==='ask'"), 'Ja/Nein-Schritt');
  assert.ok(s.includes("teleStep==='rate'"), 'Sterne/Freitext-Schritt');
  assert.ok(s.includes('v-for="n in 5"'), '5 Sterne-Buttons');
  assert.ok(s.includes('v-model="teleComment"'), 'Freitextfeld');
  assert.ok(s.includes('{{teleBlock()}}'), 'Block-Vorschau');
  assert.ok(s.includes('https://github.com/Effzumdeh/ModelMuse/issues'), 'Issue-Link');
  assert.ok(s.includes("openTele('gen'"), 'Hook nach Generierung');
  assert.ok(s.includes("openTele('mod'"), 'Hook nach Ueberarbeiten');
});

test('T: Block-Felder + Key-Redaktion', async () => {
  const s = await html();
  for (const f of ['modell: ', 'provider: ', 'reasoning: ', 'http: ', 'usage: ',
    'usage_reasoning_tokens: ', 'usage_completion_tokens: ',
    'prompt_4k: ', 'dauer_s: ', 'bewertung: ', 'kommentar: ']) {
    assert.ok(s.includes(f), 'Feld ' + f.trim() + ' im Block');
  }
  assert.ok(s.includes('sk-'), 'sk-Redaktion vorhanden');
  assert.ok(s.includes('LLM_'), 'LLM_-Redaktion vorhanden');
  assert.ok(s.includes('Bearer [REDACTED]'), 'Bearer-Redaktion vorhanden');
  assert.ok(s.includes('.slice(0,4000)'), 'Prompt gekappt');
  assert.ok(s.includes('.slice(0,500)'), 'Kommentar gekappt');
});

test('T: i18n de/en/es vollstaendig', async () => {
  const s = await html();
  for (const k of ['teleTitle', 'teleAsk', 'teleYes', 'teleNo', 'teleRate',
    'teleCommentPh', 'teleCopy', 'teleCopied', 'teleCopyFail',
    'teleIssue', 'teleIssueLink']) {
    assert.ok(s.includes('I18N.de.' + k + '='), 'de.' + k);
    assert.ok(s.includes('I18N.en.' + k + '='), 'en.' + k);
    assert.ok(s.includes(k + ':') || s.includes(k + ':"'), 'es.' + k);
  }
});

test('Q: Countdown je Auftrag + Erfolgs-Feedback', async () => {
  const s = await html();
  assert.ok(s.includes('jobTimeText(job,queueNow)'), 'Zeile nutzt Auftragszeit');
  assert.equal(cnt(s, 'queuedAt:Date.now()'), 2, 'gen+mod mit Wartestempel');
  assert.ok(s.includes('job.startedAt=Date.now()'), 'Start-Stempel je Auftrag');
  assert.ok(s.includes('job.eta=this.etaSeconds()'), 'Tabellenwert je Auftrag');
  assert.ok(s.includes("{{t('jobDoneHint')}}"), 'Erfolgs-Hinweis in Queue');
  assert.ok(s.includes('border:2px solid #059669'), 'Erfolg auffallend markiert');
  assert.ok(s.includes('I18N.de.jobQueue='), 'Warte-Text de');
  assert.ok(s.includes('I18N.en.jobQueue='), 'Warte-Text en');
  assert.ok(s.includes('jobQueue:"'), 'Warte-Text es');
  assert.ok(s.includes('I18N.de.jobDoneHint='), 'Erfolgs-Hinweis de');
});

test('Q: Hygiene (30 s + Modell-Oeffnen)', async () => {
  const s = await html();
  assert.ok(s.includes('job.doneAt=Date.now()'), 'Fertig-Stempel');
  assert.ok(s.includes('Date.now()-30000'), '30-s-Fenster');
  assert.ok(s.includes('sj.labId===id'), 'Prune beim Modell-Oeffnen');
  assert.ok(s.includes('jj.labId=labId'), 'Auftrag kennt Modell');
});

test('Q/T: Alt-Vertraege bleiben (Queue, Dock, Timer, Diagnose)', async () => {
  const s = await html();
  assert.equal(cnt(s, 'toggleWinMin('), 4, 'Dock: gen + mod + part + tele');
  assert.equal(cnt(s, 'etaSeconds:function'), 1, 'ETA-Tabelle bleibt eine');
  assert.equal(cnt(s, 'pumpGenQueue'), 3, 'eine Pumpe bleibt');
  assert.equal(cnt(s, 'diagText:function'), 1, 'Diagnose bleibt');
});
