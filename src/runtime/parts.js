/**
 * Bauteil-Toggles (rein, DOM-frei): Teileliste aus Manifest, Hidden-State,
 * Harness-Check pro Teil (Meta-Eintrag, addLabel-Quelle, Manifest-Label).
 * Bauplan-Erw.: Teil 3 Bauteil-Checkboxen + Harness-Test pro Teil.
 * Vertrags-Absatz (A-06, Option b): player.setParts sendet
 * {labels:{hidden}, parts:{hidden}} an den Gast. Ausgewertet wird nur
 * labels.hidden. parts.hidden ist optional — kuratierte Gaeste ignorieren
 * es graceful (kein Geometrie-Umbau, Provenienz bleibt); Gaeste DUERFEN
 * es kuenftig auswerten.
 *
 * Bauteil-Mesh-Zuordnung (kanonisch, seit Freimodus-Befund Fussballfeld
 * 31.10.2026): Label->Mesh laeuft ueber normalizePartName +
 * assignPartMeshes (Normalisierung de/en/es, Teil-Matching statt Exakt,
 * laengster Treffer gewinnt). Meshes ohne Treffer landen in der
 * Standard-Gruppe (Index labels.length, bleibt sichtbar) und werden als
 * Warnung ausgewiesen; Labels ohne Treffer meldet der Selbst-Check
 * (checkPartMeshCoverage) als WARNUNG in der Diagnose statt still.
 * Gast-Seite: registerPartGroups/applyPartVisibility in wrapper-helpers
 * (src/runtime/annotate.js) spiegeln diese Regeln (kein Import moeglich —
 * Frame-Blob; bei Aenderung hier dort synchronisieren, Paritaetstest unten).
 */

/**
 * @param {{ labels?: unknown[], parts?: unknown[] }} manifest
 * @returns {Array<{ index: number, name: string }>}
 */
export function partEntries(manifest) {
  const labels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  const parts = Array.isArray(manifest?.parts) ? manifest.parts : labels;
  const names = labels.length > 0 ? labels : parts;
  return names.map((n, i) => ({ index: i, name: String(n) }));
}

/**
 * @param {number[]} hidden
 * @param {number} index
 * @returns {number[]} neuer Hidden-State (sortiert, ohne Duplikate)
 */
export function toggleHidden(hidden, index) {
  const set = new Set(Array.isArray(hidden) ? hidden : []);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  return [...set].sort((a, b) => a - b);
}

/**
 * Bestandteil-Erklaerungen zur Ansicht (lokalisiert, mit Fallback de->en):
 * je Eintrag ein Text in Reihenfolge der partEntries; fehlt die Lokale,
 * faellt die Ansicht auf Deutsch (dann Englisch) zurueck, fehlende
 * Einzeltexte auf '' (Button blendet sich dann aus).
 * @param {{ labels?: unknown[], parts?: unknown[], explanations?: unknown, i18n?: unknown }} [manifest]
 * @param {string} [locale]
 * @returns {string[]}
 */
export function partExplanations(manifest, locale = 'de') {
  const entries = partEntries(manifest);
  if (entries.length === 0) return [];
  const loc = locale === 'en' || locale === 'es' ? locale : 'de';
  const base = Array.isArray(manifest?.explanations) ? manifest.explanations.map(String) : [];
  const seg = manifest?.i18n && typeof manifest.i18n === 'object' ? manifest.i18n[loc] : null;
  const locArr = seg && typeof seg === 'object' && Array.isArray(seg.explanations) ? seg.explanations.map(String) : [];
  // de-Ansicht: kanonisch; en/es: Lokale, sonst kanonisch.
  if (loc === 'de') return entries.map((e) => (typeof base[e.index] === 'string' ? base[e.index] : ''));
  return entries.map((e) => locArr[e.index] ?? base[e.index] ?? '');
}

/**
 * addLabel-Aufruf mit EXAKTEM Text in der Quelle (positional oder Objektform).
 * @param {string} source
 * @param {string} name
 */
export function hasLabelCall(source, name) {
  const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`addLabel\\s*\\([^)]*['"\`]${esc}['"\`]`, 's');
  return re.test(String(source));
}

/**
 * Harness-Test fuer EIN Bauteil (ohne Browser/Netz/Key).
 * @param {string} source Modulquelle
 * @param {{ labels?: string[] }} manifest
 * @param {number} index
 */
export function checkPart(source, manifest, index) {
  const entries = partEntries(manifest);
  const entry = entries[index];
  const name = entry ? entry.name : `Teil ${index}`;
  const criteria = [];
  if (!entry) {
    criteria.push({ id: 'part-index', verdict: 'fail', expected: `Index < ${entries.length}`, actual: `${index}` });
    return { index, name, verdict: 'fail', criteria };
  }
  criteria.push({
    id: 'part-meta',
    verdict: entry.name.length >= 2 ? 'pass' : 'fail',
    expected: 'Bauteilname >= 2 Zeichen',
    actual: entry.name,
  });
  criteria.push({
    id: 'part-label-quelle',
    verdict: hasLabelCall(source, entry.name) ? 'pass' : 'fail',
    expected: `addLabel mit Text „${entry.name}“`,
    actual: hasLabelCall(source, entry.name) ? 'gefunden' : 'fehlt',
  });
  const inManifest = Array.isArray(manifest?.labels) && manifest.labels.includes(entry.name);
  criteria.push({
    id: 'part-manifest',
    verdict: inManifest ? 'pass' : 'fail',
    expected: 'Label im Manifest',
    actual: inManifest ? 'enthalten' : 'fehlt',
  });
  return {
    index,
    name,
    verdict: criteria.every((c) => c.verdict === 'pass') ? 'pass' : 'fail',
    criteria,
  };
}

/**
 * Harness-Test fuer ALLE Bauteile eines Modells.
 * @param {string} source
 * @param {{ labels?: string[] }} manifest
 */
export function checkAllParts(source, manifest) {
  const entries = partEntries(manifest);
  const parts = entries.map((e) => checkPart(source, manifest, e.index));
  return {
    count: parts.length,
    passed: parts.filter((p) => p.verdict === 'pass').length,
    verdict: parts.length > 0 && parts.every((p) => p.verdict === 'pass') ? 'pass' : 'fail',
    parts,
  };
}

/**
 * Kanonische Namens-Normalisierung de/en/es fuer die Bauteil-Mesh-
 * Zuordnung: klein, trimmen, Umlaut-Faltung (ä→a, ö→o, ü→u, ß→ss),
 * diakritische Zeichen via NFKD (é→e, ñ→n, á→a), Rest nicht-alphanumerisch
 * weg. «Eckfahne» == «eckfahne» == «ECK-FAHNE»; «línea» == «linea».
 * @param {unknown} name
 * @returns {string} normalisierter Token (ggf. '')
 */
export function normalizePartName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Varianten-Menge eines Part-Labels (kanonisch + Uebersetzungen).
 * @param {unknown} label
 * @param {string[]} [translations] en/es-Varianten aus meta_i18n/Manifest-i18n
 * @returns {string[]} normalisierte Varianten, Laenge >= 2, entdupliziert
 */
export function partNameVariants(label, translations = []) {
  const out = [];
  const seen = new Set();
  for (const v of [label, ...(Array.isArray(translations) ? translations : [])]) {
    const n = normalizePartName(v);
    if (n.length >= 2 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Stemmt deutsche/englische/spanische Plurale grob (Komposita wie
 * „Seitenlinie“ treffen so das Label „Linien“): laengstes Suffix aus
 * nen/en/es/n/s/e kappen, Stamm >= 4 Zeichen, sonst Original. Kurze
 * Woerter (Tor, Rad, Mast) werden nie gestemmt.
 * @param {string} token normalisierter Token
 * @returns {string} Stammform
 */
export function stemPartToken(token) {
  const t = String(token ?? '');
  if (t.length <= 4) return t;
  for (const suf of ['nen', 'en', 'es', 'n', 's', 'e']) {
    if (t.endsWith(suf)) {
      const s = t.slice(0, -suf.length);
      if (s.length >= 4) return s;
    }
  }
  return t;
}

/**
 * Ordnet Mesh-Namen (oder Material-Namen) Part-Labels zu — Teil-Matching
 * statt Exakt, beide Richtungen (Label⊆Mesh oder Mesh⊆Label, ersatzweise
 * Stammformen), laengster Treffer gewinnt, Gleichstand an das erste Label.
 * Meshes ohne Treffer landen in der Standard-Gruppe (Index labels.length,
 * bleibt sichtbar).
 * @param {unknown[]} labels Part-Labels in Manifest-Reihenfolge
 * @param {unknown[]} meshNames Mesh-/Material-Namen (gleiche Ordnung = Gruppen-Index)
 * @param {{ translations?: Array<string[] | undefined | null> }} [opts] je Label en/es-Varianten
 * @returns {{ groups: string[][], unassigned: string[], warnings: Array<{ type: 'label-ohne-mesh' | 'mesh-ohne-treffer', label?: string, mesh?: string }> }}
 */
export function assignPartMeshes(labels, meshNames = [], opts = {}) {
  const labs = Array.isArray(labels) ? labels.map(String) : [];
  const names = Array.isArray(meshNames) ? meshNames.map(String) : [];
  const trans = Array.isArray(opts?.translations) ? opts.translations : [];
  const variants = labs.map((l, i) => partNameVariants(l, trans[i]));
  const groups = labs.map(() => []);
  const defaultGroup = [];
  const hitCount = labs.map(() => 0);
  const warnings = [];
  for (const raw of names) {
    const nm = normalizePartName(raw);
    const stemN = stemPartToken(nm);
    let best = -1;
    let bestLen = 0;
    if (nm.length >= 2) {
      for (let i = 0; i < variants.length; i += 1) {
        for (const v of variants[i]) {
          let hit = 0;
          if (nm === v) hit = v.length + 1000;
          else if (nm.includes(v) || v.includes(nm)) hit = Math.min(nm.length, v.length);
          else {
            const stemV = stemPartToken(v);
            if (stemN.length >= 4 && stemV.length >= 4 && (stemN.includes(stemV) || stemV.includes(stemN))) {
              hit = Math.min(stemN.length, stemV.length);
            }
          }
          if (hit > bestLen) {
            bestLen = hit;
            best = i;
          }
        }
      }
    }
    if (best >= 0) {
      groups[best].push(raw);
      hitCount[best] += 1;
    } else {
      defaultGroup.push(raw);
      warnings.push({ type: 'mesh-ohne-treffer', mesh: raw });
    }
  }
  groups.push(defaultGroup);
  const unassigned = [...defaultGroup];
  labs.forEach((label, i) => {
    if (hitCount[i] === 0) warnings.push({ type: 'label-ohne-mesh', label });
  });
  // Sortierung: erst alle Mesh-Warnungen (Registrierungs-Reihenfolge),
  // dann Label-Warnungen (Manifest-Reihenfolge) — stabil fuers Gate.
  warnings.sort((a, b) => (a.type === b.type ? 0 : a.type === 'mesh-ohne-treffer' ? -1 : 1));
  return { groups, unassigned, warnings };
}

/**
 * Diagnose-Zeilen zu Zuordnungs-Warnungen (de/en/es, ohne Secrets).
 * @param {Array<{ type: string, label?: string, mesh?: string }>} warnings
 * @param {string} [locale]
 * @returns {string[]}
 */
export function formatPartWarnings(warnings, locale = 'de') {
  const loc = ['de', 'en', 'es'].includes(locale) ? locale : 'de';
  const list = Array.isArray(warnings) ? warnings : [];
  return list.map((w) => {
    if (w && w.type === 'label-ohne-mesh') {
      if (loc === 'en') return `WARNING: part label "${w.label}" matches 0 meshes (toggle hides label only)`;
      if (loc === 'es') return `AVISO: la etiqueta "${w.label}" no corresponde a ninguna malla (el interruptor solo oculta la etiqueta)`;
      return `WARNUNG: Part-Label „${w.label}“ trifft 0 Meshes (Toggle blendet nur Label aus)`;
    }
    if (loc === 'en') return `NOTE: mesh "${w?.mesh}" without match assigned to default group (stays visible)`;
    if (loc === 'es') return `NOTA: malla "${w?.mesh}" sin coincidencia asignada al grupo estándar (permanece visible)`;
    return `Hinweis: Mesh „${w?.mesh}“ ohne Treffer der Standard-Gruppe zugeordnet (bleibt sichtbar)`;
  });
}

/**
 * Mesh-Identifikatoren statisch aus Modulquelle lesen (Heuristik, ehrlich
 * benannt): `new Mesh|InstancedMesh|Group`-Variablennamen + `.name = '…'`.
 * @param {string} source
 * @returns {string[]} entduplizierte Kandidaten (max. 256)
 */
export function extractMeshIdentifiers(source) {
  const src = String(source ?? '');
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const s = String(v ?? '').slice(0, 80);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  let m;
  const varRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+(?:Mesh|InstancedMesh|Group)\s*\(/g;
  while ((m = varRe.exec(src)) !== null) push(m[1]);
  const nameRe = /\.\s*name\s*=\s*['"`]([^'"`]{1,80})['"`]/g;
  while ((m = nameRe.exec(src)) !== null) push(m[1]);
  return out.slice(0, 256);
}

/**
 * Selbst-Check nach Registrierung (statisch, Gate-sicher): Ruft die Quelle
 * registerPartGroups auf, wird die Abdeckung je Part-Label geprueft —
 * jedes Label muss >= 1 Mesh treffen. Ergebnis ist IMMER pass (Warnung
 * statt Rot); Trefferlosigkeit steht als WARNUNG im Kriterium (Diagnose)
 * statt still. Ohne Registrierung: neutraler Hinweis (labels-only, graceful).
 * @param {string} source Modulquelle
 * @param {unknown[]} labels Part-Labels
 * @param {{ translations?: Array<string[] | undefined | null>, locale?: string }} [opts]
 */
export function checkPartMeshCoverage(source, labels, opts = {}) {
  const src = String(source ?? '');
  const labs = Array.isArray(labels) ? labels.map(String) : [];
  const registered = /registerPartGroups\s*\(/.test(src);
  if (!registered || labs.length === 0) {
    return {
      registered,
      groups: [],
      warnings: [],
      criterion: {
        id: 'S5-parts-coverage',
        verdict: 'pass',
        expected: 'jedes Part-Label trifft >= 1 Mesh (sonst WARNUNG)',
        actual: registered
          ? '0 Part-Labels (nichts zu pruefen)'
          : 'keine Bauteil-Registrierung (nur Labels, graceful — parts.hidden ungenutzt)',
      },
    };
  }
  const trans = Array.isArray(opts?.translations) ? opts.translations : [];
  const ids = extractMeshIdentifiers(src);
  const { groups, warnings } = assignPartMeshes(labs, ids, { translations: trans });
  const lines = formatPartWarnings(warnings, opts?.locale);
  const covered = labs.filter((_, i) => groups[i].length > 0).length;
  return {
    registered: true,
    groups,
    warnings,
    criterion: {
      id: 'S5-parts-coverage',
      verdict: 'pass',
      expected: 'jedes Part-Label trifft >= 1 Mesh (sonst WARNUNG)',
      actual: warnings.length === 0
        ? `alle ${labs.length} Part-Labels treffen >= 1 Mesh (${ids.length} Identifikatoren)`
        : `WARNUNG: ${covered}/${labs.length} Labels abgedeckt (${ids.length} Identifikatoren) — ${lines.join(' | ').slice(0, 320)}`,
    },
  };
}
