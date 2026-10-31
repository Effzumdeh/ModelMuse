# OpenRouter als 3. Provider (BYOK, Direkt-Call) — Stand 31.10.2026

## Slug-Verifikation (nichts erfunden)

Quelle: `GET https://openrouter.ai/api/v1/models` (31.10.2026, 452 Modelle).
Alle drei Wunsch-Slugs existieren **exakt** — keine Abweichung, keine erfundenen Slugs:

| Wunsch | Verifizierter Slug | Name (OpenRouter) | reasoning_effort |
|---|---|---|---|
| GPT 6.1 Sol | `openai/gpt-6.1-sol` | OpenAI: GPT-6.1 Sol | belegt (max/xhigh/high/medium/low) |
| Muse Spark 1.3 | `meta/muse-spark-1.3` | Meta: Muse Spark 1.3 | belegt (max/xhigh/high/medium/low/minimal) |
| Opus 5.5 | `anthropic/claude-opus-5.5` | Anthropic: Claude Opus 5.5 | belegt (max/xhigh/high/medium/low) |

Alle drei Slugs listen `reasoning_effort` in `supported_parameters` — Default
`reasoning_effort: xhigh` ist damit **belegt** (kein 400-Risiko aus dem Param;
max-Wunsch wird ehrlich auf xhigh begrenzt). Limit-Params
(`max_completion_tokens`/`max_tokens`) werden **nie** gesendet
(Eigentuemer-Vorgabe: keine Token-Caps).

## Pfad (nur Direkt-Call, kein Proxy)

- Browser → `https://openrouter.ai/api/v1/chat/completions` (OpenAI-kompatibel, SSE).
- Header: `Authorization: Bearer <BYOK-Key>` + `HTTP-Referer: https://github.com/Effzumdeh/ModelMuse`
  + `X-Title: ModelMuse` (App-Kennung, nie Key-Material).
- Key AUSSCHLIESSLICH laufzeitsseitig per BYOK (User-Eingabe, nur Sitzung):
  Lab-Shell `modelmuse-live-key-openrouter`, Standalone `modelmuse-key-openrouter`.
  Kein Server-Key-Fallback, nie Logs/Dateien.
- `scripts/proxy.mjs` lehnt `provider=openrouter` mit E-GEN-404 + Direkt-Hinweis
  ab (kein Upstream-Call) — ehrlich statt Halloween-Proxy.
- 400-Fallback bleibt: lehnt ein Gateway die Extras ab, genau 1 Retry ohne Extras.

## Reasoning-Stufen je Modell (belegt, v40, Stand 31.10.2026)

Quelle: `GET https://openrouter.ai/api/v1/models` (live, 452 Modelle) +
[Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
(`Discovering per-model reasoning options`) +
[GPT-6-Migrationsguide](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/gpt-6) +
[Claude-5.5-Migrationsguide](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-5-5).

| Modell (Slug) | `supported_efforts` (absteigend) | Default | `mandatory` | `max_tokens`-Budget |
|---|---|---|---|---|
| `openai/gpt-6.1-sol` | max, xhigh, high, medium, low | medium | true (kein `none`) | nein (`supports_max_tokens` fehlt) — nur `effort` |
| `meta/muse-spark-1.3` | max, xhigh, high, medium, low, minimal | medium | true (kein `none`) | nein — nur `effort` |
| `anthropic/claude-opus-5.5` | max, xhigh, high, medium, low | high (live `/models`; Migrationsguide nennt `medium` als Anthropic-Default ohne Param) | true (`none`/`enabled:false` → 400) | akzeptiert, aber NICHT weitergeleitet (adaptiv ohne Budget) — nur `effort` setzen |

Regeln (UI + Request, Stand v40):
- Dropdown (`#gen-reasoning`, Std/xhigh/max): max ist je Modell nur enabled,
  wo belegt — openrouter alle 3 Slugs + meta-muse 1.3/wonder;
  contributor/baseten bleiben Std + xhigh (max dort rejected).
- UI-Default bleibt `xhigh` (belegt, konservativ); max wird explizit
  gewaehlt und als `reasoning_effort` durchgereicht.
- `reasoning_effort` UND `reasoning` sind bei allen drei Slugs
  `supported_parameters` — gesendet wird `reasoning_effort` (belegt).
- Unbelegte Stufe → kein Param (Modell-Default); 400-Fallback (ohne Extras)
  bleibt als einzige Sicherung.
- Vollsupport-Referenz je Modell: `reasoningEffortsFor` in
  `src/runtime/livegen.js` (niedrigere Stufen laufen ueber Modell-Default).

## ETA-Tabelle

Neue Modelle vorerst **240 s** bis Messwerte kommen (Abort folgt ETA + 120 s —
konservative ETA killt keine legitimen Laeufe). Siehe Standalone `etaSeconds`
(v38: robust normalisiert, contributor=>immer 240 s).

## Fehlertexte je Provider

401/CONFIG erhalten einen Anbieter-Hinweis mit Key-Quelle, OpenRouter:
`https://openrouter.ai/keys` (Lab-Shell `keyHintFor`, Standalone
`keyMissingOpenrouter`/`keyInvalidOpenrouter`, je de/en/es).
