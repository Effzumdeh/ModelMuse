/**
 * Freimodus-UI: eigener Muse-API-Key der Lehrkraft plus freier Begriff.
 * Key-Haltung: nur im Speicher (livegen-Modul); Session-Storage NUR mit
 * ausdruecklicher Zustimmung per Checkbox, nie localStorage, nie Logs/Dateien.
 * Nach der Generierung: Labels kommen aus dem Modell (P1: addLabel je
 * Hauptbauteil), Manifest mit Aufgaben je Niveau wird automatisch gebaut.
 * Bauplan Abschnitt 4 (generateLive) und 9 (E-GEN-*).
 */
import { configureLiveGen, generateLive, setLiveApiKey, clearLiveApiKey } from '../runtime/livegen.js';
import { extractMeta } from '../runtime/verify.js';
import { STRINGS, tt, getLocale } from './i18n.js';

/**
 * Deutsche Fehlermeldungen je Code (kanonisch, aus der Sprachdatei — keine
 * Hartkodierung; UI nutzt germanMessage in der gewaehlten Lokale).
 */
export const E_GEN_DE = { ...STRINGS.de.fehler };

/** @param {unknown} e Meldung in aktueller UI-Lokale (Fallback E-GEN-5XX). */
export function germanMessage(e) {
  const code = e && typeof e.code === 'string' ? e.code : 'E-GEN-5XX';
  const key = `fehler.${code}`;
  const msg = tt(key);
  return msg === key ? tt('fehler.E-GEN-5XX') : msg;
}

/** Lokaler Generierungs-Proxy (scripts/proxy.mjs): vorbelegt, BYOK optional. */
export const PROXY_DEFAULT = 'http://127.0.0.1:8787/generate';

function slug(term) {
  const s = String(term).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || 'frei').slice(0, 19);
}

/** @param {string} term */
export function freeModelId(term) {
  return `free-${slug(term)}`;
}

/**
 * P1-kompakter Freimodus-Prompt zu einem freien Begriff.
 * @param {string} term
 * @param {string} [locale] Antwortsprache-Label (de/en/es); das Modul bleibt
 * sprachneutral (Strings als Daten), zusaetzlich meta_i18n mit EN/ES-Uebersetzungen.
 */
export function buildFreePrompt(term, locale = 'de') {
  const t = String(term).trim().slice(0, 80);
  const loc = ['de', 'en', 'es'].includes(locale) ? locale : 'de';
  return [
    'P1 FREIMODUS (Three.js r186, Single-Page-Wrapper, Modell muse-spark-1.3-contributor).',
    `Begriff: ${t}. Baue das benannte Objekt/Web als 3D-Modell, zentriert am Ursprung, Bounding-Box in 3 m Wuerfel, reale Proportionen in Metern.`,
    'Vertrag: export const meta = { title, category, detailLevel: 2, parts: [3-8 Hauptbauteile], units: "m" }. ' +
    'category MUSS exakt einer dieser Werte sein: hardware, architektur, auto, pflanze, sonstiges (nimm den passendsten, sonst "sonstiges"). ' +
    'Beispiel: export const meta = { title: "Handbohrmaschine", category: "hardware", detailLevel: 2, parts: ["Gehaeuse","Motor","Bohrfutter"], units: "m" }. ' +
    'export function init(container, params) synchron mit Rueckgabe { update, dispose }.',
    'Imports NUR: benannte Imports aus three plus OrbitControls-Addon plus { addLabel, addMeasurement } aus wrapper-helpers. Keine weiteren Module, URLs, dynamischen Imports. ' +
    'Import-Vorlage (EXAKT dieses Muster: ALLE Vorlagen-Namen behalten, NIEMALS kuergen, nur bei Bedarf weitere aus three ergaenzen): import { Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, MeshStandardMaterial, BoxGeometry, CylinderGeometry, SphereGeometry, HemisphereLight, DirectionalLight, Vector3 } from \'three\'; import { OrbitControls } from \'three/addons/controls/OrbitControls.js\'; import { addLabel, addMeasurement } from \'wrapper-helpers\'; Nutze die Namen DIREKT (new Scene()), NIEMALS THREE.xxx (kein Namespace-Import, kein globales THREE). Jeder direkt genutzte Name MUSS in der Importliste stehen — fehlender Import = Startfehler "X is not defined".',
    'VERBOTENE Bezeichner (S1-Wortgrenzen, Modul wird sonst abgelehnt): nutze NIEMALS document, window, parent, top, fetch, eval, Function, navigator, localStorage, sessionStorage, indexedDB, sendBeacon, WebSocket, XMLHttpRequest als Variablen, Properties oder Strings. Nur container und renderer.domElement anfassen (kein window-Resize-Listener).',
    'Pflicht: JEDES Hauptbauteil aus parts mit addLabel(root, text, [x,y,z], {id, level:"aufbau", sizePx:16, leader:true}) beschriften (positional). Mindestens EINE Messung mit addMeasurement(root, from, to, "Name: Zahl Einheit", {id, level:"aufbau", unit}) mit Einheit (mm/cm/m).',
    'Optik: ACES-ToneMapping, SRGB, Antialiasing, Hemisphere- plus Key-Licht (PCFSoft-Schatten) plus Fuell-Licht, PBR-Materialien, jedes Mesh castShadow/receiveShadow (Linien ausgenommen).',
    `Antwortsprache (locale): ${loc}. Labels im Code (addLabel-Texte) in dieser Sprache; KEINE Sprachlogik (kein if/locale-Verzweigen) im 3D-Code — Strings sind Daten.`,
    'Zusaetzlich meta_i18n liefern: export const meta_i18n = { en: { title, parts: [...] }, es: { title, parts: [...] } } ' +
    'mit fachgerechten Uebersetzungen von Titel + parts (gleiche Anzahl/Reihenfolge wie meta.parts). Keine weiteren Sprachen, kein Code, nur Daten.',
    'update(patch): nur Sichtbarkeit (labels max, measurements) und Kamera (overview/detail/front/top) schalten, nie neues Modell. dispose(): Schleife stoppen, Geometrien/Materialien/Renderer freigeben, Element entfernen.',
    'Liefere AUSSCHLIESSLICH den Modulcode, keine Erklaerung, keine Fences.',
  ].join('\n');
}

const MEASURE_RE =
  /addMeasurement\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*(\[[^\]]*\])\s*,\s*(\[[^\]]*\])\s*,\s*(['"`])((?:\\\3|(?!\3).)*)\3\s*,?\s*(\{[^}]*\})?\s*\)/g;
const NUM_RE = /-?\d+(?:[.,]\d+)?/;
const UNIT_RE = /\b(mm|cm|m|HE|kB|MB)\b/;

function parseVec(s) {
  try {
    const v = new Function(`return (${s});`)();
    if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) return v;
  } catch { /* kein Vec3 */ }
  return null;
}

/**
 * Mess-Hinweise aus generierter Quelle lesen (fuer Manifest-Bau).
 * @param {string} source
 */
export function extractMeasureHints(source) {
  const out = [];
  MEASURE_RE.lastIndex = 0;
  let m;
  let n = 0;
  for (;;) {
    m = MEASURE_RE.exec(String(source));
    if (!m) break;
    n += 1;
    const from = parseVec(m[1]);
    const to = parseVec(m[2]);
    const text = m[4];
    const unit = (UNIT_RE.exec(text) ?? [])[1] ?? ((m[5] ?? '').includes('unit') ? 'm' : null);
    if (from && to && typeof text === 'string' && unit) {
      out.push({ id: `frei-m${n}`, from, to, text, unit });
    }
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Didaktik-Manifest zum Freimodus-Modell: Labels je Hauptbauteil aus meta.parts,
 * Aufgaben je Niveau (0 Basis / 2 Aufbau / 1 Profi-Transfer).
 * Mehrsprachig (Teil 5): i18n-Segment aus meta_i18n (Modell liefert EN/ES als
 * Daten); fehlende Uebersetzungen fallen ehrlich auf Deutsch zurueck.
 * @param {string} term
 * @param {{ title?: string, parts?: string[] }} meta
 * @param {string} source
 * @param {{ en?: { title?: string, parts?: string[] }, es?: { title?: string, parts?: string[] } }} [i18nHints]
 */
export function buildFreeManifest(term, meta, source, i18nHints) {
  const parts = Array.isArray(meta?.parts) && meta.parts.length >= 3 ? meta.parts.slice(0, 8).map(String) : ['Bauteil A', 'Bauteil B', 'Bauteil C'];
  const hints = extractMeasureHints(source);
  const measurements = hints.length > 0 ? hints : [{ id: 'frei-m1', from: [-0.2, -0.2, 0], to: [0.2, -0.2, 0], text: 'Breite: 40 cm', unit: 'cm' }];
  const firstNum = (NUM_RE.exec(measurements[0].text) ?? ['?'])[0];
  const title = typeof meta?.title === 'string' && meta.title.length >= 3 ? meta.title : `Freimodell ${String(term).slice(0, 40)}`;
  const i18n = {};
  for (const loc of ['en', 'es']) {
    const h = i18nHints?.[loc];
    if (h && typeof h.title === 'string' && Array.isArray(h.parts) && h.parts.length === parts.length) {
      i18n[loc] = {
        title: h.title,
        objectives: loc === 'en'
          ? [`Trainees correctly name the main parts of ${h.title} (${h.parts.slice(0, 3).join(', ')}).`, `Trainees read the dimension “${measurements[0].text}” and assign it to the part.`]
          : [`El alumnado nombra correctamente los componentes principales de ${h.title} (${h.parts.slice(0, 3).join(', ')}).`, `El alumnado lee la medida “${measurements[0].text}” y la asigna al componente.`],
        labels: h.parts.map(String),
        measurements: measurements.map((m) => ({ id: m.id, text: m.text })),
        tasks: [
          { id: 'frei-aufbau-1', prompt: loc === 'en' ? `Match: Which part carries the main function of ${h.title}?` : `Relacione: ¿qué componente tiene la función principal de ${h.title}?`, expected: h.parts[0] },
          { id: 'frei-aufbau-2', prompt: loc === 'en' ? `Read the dimension (“${measurements[0].text}”) and name the number.` : `Lea la medida (“${measurements[0].text}”) e indique el número.`, expected: String(firstNum) },
          { id: 'frei-profi-1', prompt: loc === 'en' ? `${h.title} shows a fault (one part fails): name two checkable causes and one remedy each.` : `${h.title} muestra un fallo (falla un componente): indique dos causas comprobables y una solución para cada una.`, expected: loc === 'en' ? `Check ${h.parts[0]} and secure the part connection` : `Comprobar ${h.parts[0]} y asegurar la conexión` },
        ],
      };
    }
  }
  return {
    schemaVersion: 1.0,
    title,
    track: 'free',
    objectives: [
      `Die Auszubildenden benennen die Hauptbauteile von ${title} (${parts.slice(0, 3).join(', ')}) korrekt.`,
      `Die Auszubildenden lesen die Bemaßung „${measurements[0].text}“ ab und ordnen sie dem Bauteil zu.`,
    ],
    labels: parts,
    measurements,
    tasks: [
      { id: 'frei-aufbau-1', level: 'aufbau', type: 'zuordnung', prompt: `Ordne zu: Welches Bauteil traegt die Hauptfunktion von ${title}?`, expected: parts[0], tolerance: 0 },
      { id: 'frei-aufbau-2', level: 'aufbau', type: 'messwert', prompt: `Lies die Bemaßung aus („${measurements[0].text}“) und nenne den Zahlenwert.`, expected: String(firstNum), tolerance: 1 },
      { id: 'frei-profi-1', level: 'profi', type: 'transfer', prompt: `${title} zeigt einen Fehler (ein Bauteil faellt aus): Nenne zwei pruefbare Ursachen und je eine Abhilfemassnahme.`, expected: `${parts[0]} pruefen und Bauteilverbindung sicherstellen`, tolerance: 0 },
    ],
    ...(Object.keys(i18n).length > 0 ? { i18n } : {}),
  };
}

/**
 * meta_i18n-Export aus generierter Quelle lesen (Daten, kein Code):
 * export const meta_i18n = { en: {...}, es: {...} }. Nur gueltig bei
 * passender parts-Laenge (Pruefung in buildFreeManifest).
 * @param {string} source
 */
export function extractMetaI18n(source) {
  const m = /export\s+const\s+meta_i18n\s*=\s*\{/.exec(String(source));
  if (!m) return null;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  let inStr = null;
  for (; i < source.length; i += 1) {
    const c = source[i];
    if (inStr) {
      if (c === '\\') { i += 1; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${source.slice(m.index + m[0].length - 1, i + 1)});`);
    const v = fn();
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

/** Teil 5 (User-Entscheidung): Keys AUSSCHLIESSLICH Sitzungseingabe im Browser.
 * Keine Persistenz mehr (weder sessionStorage noch localStorage), nie Logs.
 * Speicherhaltung laeuft ueber das livegen-Modul (nur Speicher). */

/** Aus Kompatibilitaet erhalten: liefert immer null (kein gespeicherter Key). */
export function loadStoredKey() {
  return null;
}

/**
 * Aus Kompatibilitaet erhalten: No-Op (Key bleibt nur im Speicher).
 * @param {string} _key @param {boolean} _consent
 */
export function storeKey(_key, _consent) {
  /* Teil 5: keine Key-Persistenz — nur Sitzungs-Speicher via livegen-Modul */
}

/** Vergisst den Sitzungs-Key (nur Speicher). */
export function forgetStoredKey() {
  clearLiveApiKey();
}

/**
 * Bindet das Freimodus-Formular. Key gelangt nie in Logs/Reports.
 * @param {{ proxyInput: HTMLInputElement, keyInput: HTMLInputElement, consentInput: HTMLInputElement, termInput: HTMLInputElement, goButton: HTMLButtonElement, statusBox: HTMLElement, player: { load: (ref: unknown) => Promise<unknown> }, onRegistry: (entry: { id: string, title: string, source: string, manifest: unknown }) => void, getTarget?: () => ({ providerId: string, modelId: string } | null) }} els
 */
export function mountLivegen(els) {
  if (!els.proxyInput.value) els.proxyInput.value = PROXY_DEFAULT;
  // Teil 5: kein gespeicherter Key (nur Sitzungseingabe, nie Storage).
  if (els.consentInput) {
    els.consentInput.disabled = true;
    els.consentInput.title = 'Entfernt (Teil 5): Keys nur Sitzungseingabe, keine Speicherung.';
  }
  /** @param {string} msg @param {boolean} [bad] */
  const say = (msg, bad) => {
    els.statusBox.textContent = msg;
    els.statusBox.dataset.state = bad ? 'fehler' : 'ok';
  };
  els.goButton.addEventListener('click', async () => {
    const term = els.termInput.value.trim();
    if (term.length < 2) {
      say(tt('freimodus.begriffZuKurz'), true);
      return;
    }
    const proxyUrl = els.proxyInput.value.trim();
    if (!proxyUrl) {
      say(germanMessage({ code: 'E-GEN-OFFLINE' }));
      return;
    }
    // Key optional (BYOK, nur Sitzung): leer = Server-Key des lokalen Proxys.
    const key = els.keyInput.value.trim();
    delete els.keyInput.dataset.hasStored;
    if (key) {
      try {
        setLiveApiKey(key);
      } catch {
        say(germanMessage({ code: 'E-GEN-CONFIG' }), true);
        return;
      }
    } else {
      clearLiveApiKey();
    }
    try {
      configureLiveGen({ proxyUrl, timeoutMs: 300000 }); // E2E-Befund 2026-10-27: Streams > 90 s
    } catch {
      say(germanMessage({ code: 'E-GEN-CONFIG' }), true);
      return;
    }
    els.goButton.disabled = true;
    // Zielpfad: Anbieter-/Modellauswahl (M3) oder Meta-Default. OpenRouter-Pfad
    // braucht den User-Key (BYOK, nur Sitzung) — ohne Key: E-GEN-CONFIG.
    const target = typeof els.getTarget === 'function' ? els.getTarget() : null;
    const provider = target?.providerId ?? undefined;
    const model = target?.modelId ?? undefined;
    const modelLabel = model ?? 'muse-spark-1.3-contributor';
    say(tt('freimodus.generiere', { term, modell: modelLabel }));
    try {
      const gen = await generateLive(buildFreePrompt(term, getLocale()), { seed: 7, provider, model });
      const meta = extractMeta(gen.source) ?? { title: term, parts: [] };
      const manifest = buildFreeManifest(term, meta, gen.source, extractMetaI18n(gen.source));
      const id = freeModelId(term);
      els.onRegistry({ id, title: manifest.title, source: gen.source, manifest });
      await els.player.load({ id, kind: 'free', source: gen.source, manifest });
      say(tt('freimodus.geladen', { titel: manifest.title, labels: manifest.labels.length, messungen: manifest.measurements.length, aufgaben: manifest.tasks.length }));
    } catch (e) {
      // E-GEN-*: gemappte UI-Meldung; Harness-Fehler (E-S1-*, E-S2-*, rot-Bericht)
      // zeigen die echte Ursache statt generischem 5XX-Text (E2E-Befund 27.10.2026).
      const code = e && typeof e.code === 'string' ? e.code : '';
      say(code.startsWith('E-GEN-') ? germanMessage(e) : tt('freimodus.pruefungRot', { detail: String((e && e.message) || e).slice(0, 200) }), true);
    } finally {
      els.goButton.disabled = false;
    }
  });
}
