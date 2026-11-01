/**
 * v45-Regression: Hilfe-Link in der Standalone-Fusszeile (lokalisiert).
 * Prueft das GEBAUTE Artefakt dist-standalone/modelmuse-standalone.html:
 *  H1 footerHelp-Keys x de/en/es/fr (Wortlaut Dev-Shell fuss.hilfe),
 *  H2 sichtbarer Hilfe-Link mit sprachabhaengigem Href (help/de|en|es|fr.html),
 *  H3 Kette intakt (Stempel v13..v45, 600-KB-Toleranz),
 *  H4 Docs-Ablage vorhanden (docs/help/{de,en,es,fr}.html + index, mit
 *      Kernabschnitten Features/Generator/Provider/Queue/Export/Telemetrie).
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

const HELP_TEXT = {
  de: 'Brauchst du Hilfe?',
  en: 'Need help?',
  es: '¿Necesitas ayuda?',
  fr: "Besoin d'aide ?",
};

test('H1: footerHelp-Keys x de/en/es/fr im Bundle', async () => {
  const s = await html();
  assert.equal(cnt(s, 'footerHelp:'), 4);
  for (const [, text] of Object.entries(HELP_TEXT)) {
    assert.ok(s.includes(`footerHelp:"${text}"`), `footerHelp-Text fehlt: ${text}`);
  }
});

test('H2: Hilfe-Link mit sprachabhaengigem Href in der Fusszeile', async () => {
  const s = await html();
  assert.equal(cnt(s, "{{t('footerHelp')}}"), 1);
  assert.equal(cnt(s, "'help/'+lang+'.html'"), 1);
  assert.ok(s.includes("{{t('footerNote')}}"), 'footerNote-Anker fehlt');
});

test('H3: Kette intakt (Stempel v13..v45, Groessen-Toleranz)', async () => {
  const s = await html();
  for (const v of ['v13', 'v14', 'v15 (', 'v15a', 'v16', 'v42', 'v43', 'v44', 'v45']) {
    assert.ok(s.includes('standalone-build ' + v), `Stempel fehlt: ${v}`);
  }
  assert.ok(s.length < 600000, `Artefakt zu gross: ${s.length}`);
});

test('H4: Docs-Ablage docs/help/{de,en,es,fr}.html vorhanden mit Kernabschnitten', async () => {
  const sections = {
    de: ['Generator', 'Provider', 'Export', 'Telemetrie'],
    en: ['Generating', 'Providers', 'Exporting', 'Telemetry'],
    es: ['Generar', 'Proveedor', 'Exportar', 'Telemetría'],
    fr: ['Générer', 'Fournisseur', 'Exporter', 'Télémétrie'],
  };
  const langs = { de: 'de', en: 'en', es: 'es', fr: 'fr' };
  for (const [code] of Object.entries(langs)) {
    const url = new URL(`../docs/help/${code}.html`, import.meta.url);
    const doc = await readFile(url, 'utf8');
    assert.ok(doc.includes(`<html lang="${code}">`), `${code}: lang-Attribut fehlt`);
    for (const section of sections[code]) {
      assert.ok(doc.includes(section), `${code}: Abschnitt fehlt: ${section}`);
    }
    assert.ok(doc.includes(`shots/app-${code}.png`), `${code}: Screenshot-Einbindung fehlt`);
    assert.ok(!doc.includes('href="/"'), `${code}: absoluter App-Ruecklink (Pages-Projektseite!)`);
    assert.equal(doc.split('href="../"').length - 1, 2, `${code}: App-Ruecklink (Header + Footer, relativ ../)`);
  }
  const index = await readFile(new URL('../docs/help/index.html', import.meta.url), 'utf8');
  for (const code of ['de', 'en', 'es', 'fr']) {
    assert.ok(index.includes(`${code}.html`), `index: ${code}-Link fehlt`);
  }
});
