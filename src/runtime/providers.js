/**
 * Teil 1 — Multi-Provider-Registry (reine Funktionen, kein DOM, kein Key).
 * Quelle: src/data/providers.json. Alle Benchmark-Aussagen stammen aus
 * docs/ki-modellqualitaet-recherche.md (M1, Stand 27.10.2026); Provider-APIs
 * werden NICHT halluziniert — Proxy-/Direkt-Pfade (Baseten/OpenRouter)
 * brauchen laufzeitsseitig einen User-Key (BYOK, nur Sitzung, nie
 * Logs/Dateien). OpenRouter-Slugs verifiziert via
 * https://openrouter.ai/models (31.10.2026, siehe docs/OPENROUTER-PROVIDER.md).
 */

/** @typedef {{ id: string, label: string, tags?: string[], privacy?: string, badges?: Array<{ achse: string, text: string }>, empfehlung?: string }} ProviderModel */
/** @typedef {{ id: string, label: string, generation?: { kind: string, status: string }, models?: ProviderModel[] }} Provider */

/**
 * @param {unknown} reg
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProviders(reg) {
  const errors = [];
  if (typeof reg !== 'object' || reg === null) return { ok: false, errors: ['Registry fehlt'] };
  const r = /** @type {Record<string, unknown>} */ (reg);
  if (!Array.isArray(r.providers) || r.providers.length === 0) errors.push('keine Anbieter');
  const ids = new Set();
  for (const p of r.providers ?? []) {
    if (typeof p?.id !== 'string' || p.id.length < 2) errors.push('Anbieter ohne id');
    else if (ids.has(p.id)) errors.push(`doppelte Anbieter-id ${p.id}`);
    else ids.add(p.id);
    if (!Array.isArray(p?.models) || p.models.length === 0) errors.push(`${p?.id ?? '?'}: keine Modelle`);
    for (const m of p?.models ?? []) {
      if (typeof m?.id !== 'string' || m.id.length < 2) errors.push(`${p?.id ?? '?'}: Modell ohne id`);
      if (!Array.isArray(m?.badges)) errors.push(`${p?.id ?? '?'}/${m?.id ?? '?'}: keine Badges`);
    }
    const g = p?.generation;
    if (!g || (g.kind !== 'muse-cli' && g.kind !== 'proxy' && g.kind !== 'direct')) errors.push(`${p?.id ?? '?'}: generation.kind fehlt/ungueltig`);
  }
  if (typeof r.defaultProvider !== 'string' || !ids.has(r.defaultProvider)) errors.push('defaultProvider ungueltig');
  return { ok: errors.length === 0, errors };
}

/**
 * @param {{ providers?: Provider[] }} reg
 * @param {string} providerId
 */
export function getProvider(reg, providerId) {
  return (reg?.providers ?? []).find((p) => p.id === providerId) ?? null;
}

/**
 * @param {{ providers?: Provider[] }} reg
 * @param {string} providerId
 * @param {string} modelId
 */
export function getModel(reg, providerId, modelId) {
  const p = getProvider(reg, providerId);
  return p?.models?.find((m) => m.id === modelId) ?? null;
}

/** @param {{ providers?: Provider[] }} reg */
export function listModels(reg) {
  const out = [];
  for (const p of reg?.providers ?? []) {
    for (const m of p?.models ?? []) out.push({ providerId: p.id, providerLabel: p.label, ...m });
  }
  return out;
}

/**
 * Empfehlungskennzeichen je Domaene (M1-Achsen + Datenschutz).
 * @param {{ providers?: Provider[] }} reg
 * @param {'geometrie' | 'aesthetik' | 'praeferenz' | 'allround' | 'datenschutz'} domain
 */
export function recommendModel(reg, domain) {
  const table = {
    geometrie: { providerId: 'meta-muse', modelId: 'muse-spark-1.3', grund: 'Geometrie: kein Baseten-Zweitmodell verifiziert — Fallback Standard mit reasoning_effort max (M3)' },
    aesthetik: { providerId: 'meta-muse', modelId: 'muse-spark-1.3', grund: 'Aesthetik: threejseval/benchmark.ai-Top-Modelle nicht auf Baseten verifiziert — Fallback Standard mit max-Reasoning (M3)' },
    praeferenz: { providerId: 'meta-muse', modelId: 'muse-spark-1.3', grund: 'Praeferenz: kein Baseten-Zweitmodell verifiziert — Fallback Standard mit max-Reasoning (M3)' },
    allround: { providerId: 'meta-muse', modelId: 'muse-spark-1.3-contributor', grund: 'Allround/Preis: Hackathon-Tarif, kuratierte Bibliothek damit erzeugt' },
    datenschutz: { providerId: 'meta-muse', modelId: 'muse-spark-1.3', grund: 'Standard-Vertrag ohne Trainingsnutzung + reasoning_effort max' },
  };
  const rec = table[domain] ?? table.allround;
  return { domain, ...rec };
}

/**
 * Datenschutzhinweis zur Modellwahl (M3 benutzersteuerbar statt Zwangsumstellung).
 * @param {{ providers?: Provider[] }} reg
 * @param {string} providerId
 * @param {string} modelId
 */
export function privacyNotice(reg, providerId, modelId) {
  const m = getModel(reg, providerId, modelId);
  if (m?.privacy) return m.privacy;
  const p = getProvider(reg, providerId);
  return p ? `${p.label}: Hinweis der Schulleitung beachten.` : 'Anbieter unbekannt.';
}

/**
 * Generierungsbefehl je Pfad. muse-cli = echte, belegte Kommandozeile
 * (scripts/_gen-one.mjs); proxy/direkt = braucht laufzeitsseitig einen User-Key
 * (BYOK, nur Sitzung): Direkt-Call im Browser zuerst, lokaler Proxy nur als
 * Fallback bei Netz/CORS-Problemen (OpenRouter: NUR Direkt-Call, kein Proxy-Pfad).
 * @param {{ providers?: Provider[] }} reg
 * @param {string} providerId
 * @param {string} modelId
 * @param {string} [promptFile]
 */
export function generationTarget(reg, providerId, modelId, promptFile = '<PROMPTDATEI>') {
  const p = getProvider(reg, providerId);
  if (!p) return { kind: 'unbekannt', ready: false, text: 'Anbieter unbekannt.' };
  if (p.generation?.kind === 'muse-cli') {
    return {
      kind: 'muse-cli',
      ready: true,
      text: `muse.exe exec --model ${modelId} --api-key-stdin --prompt-file ${promptFile}`,
    };
  }
  if (p.generation?.kind === 'direct') {
    return {
      kind: 'direct',
      ready: false,
      text: `BYOK noetig: Direkt-Call im Browser (Modell ${modelId}, Key nur Sitzung, nie Logs/Dateien) — ohne Proxy, mit HTTP-Referer + X-Title.`,
    };
  }
  return {
    kind: 'proxy',
    ready: false,
    text: `BYOK noetig: Direkt-Call im Browser (Modell ${modelId}, Key nur Sitzung, nie Logs/Dateien) — lokaler Proxy (scripts/proxy.mjs, leitet an die Baseten Model APIs weiter) nur als Fallback bei Netz/CORS-Problemen.`,
  };
}

/** @param {{ didaktikHinweis?: string }} reg */
export function didaktikHinweis(reg) {
  return (
    reg?.didaktikHinweis ??
    'Kein Benchmark misst Didaktik — S5 misst nur der ModelMuse-Harness.'
  );
}
