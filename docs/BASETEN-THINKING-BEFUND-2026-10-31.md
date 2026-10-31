# Baseten Thinking-/Reasoning-Befund (31.10.2026, nur belegte Fakten)

Anlass: `(baseten-direct/meta-models/muse-spark-open-1026, HTTP 200,
finish=length, nur Reasoning, kein Content, 65536 Tokens, Retry 1/1)` —
auch der Retry mit 131072 lieferte nur Reasoning. Kein Baseten-Test-Key
verfuegbar (BYOK-only), daher Doku statt Echt-Call.

## 1. Muse Spark Open denkt immer — kein Abschalter

- Baseten Reasoning-Doku: Muse Spark Open = **"Always on / Control None"**,
  Supported-Werte **low, medium, high, xhigh (default)**; `none`/`minimal`
  laufen auf **low**. "Beam and Muse Spark Open always reason."
  <https://docs.baseten.co/inference/model-apis/reasoning>
- Meta Prompting-Doku: nur **low/medium/high/xhigh** zulaessig,
  **"Reasoning can't be turned off. Any value other than these four,
  such as `none` or `max`, is rejected."**
  <https://dev.meta.ai/docs/muse-spark-open/prompting>
- Meta Deploy-Doku (Fireworks-Abschnitt): **"Thinking cannot be turned off,
  so `reasoning_effort=\"none\"` is rejected."**
  <https://dev.meta.ai/docs/muse-spark-open/deploy>
- Meta Settings: low=8, medium=32, high=256, **xhigh=512 (default)**.
  <https://dev.meta.ai/docs/muse-spark-open/settings>

## 2. Gateway-Verhalten bei unbekannten/ignorierten Parametern

- Chat-Completions-Referenz: Gateway akzeptiert
  `none, minimal, low, medium, high, xhigh, max`; **Modelle ohne
  Reasoning-Support ignorieren den Parameter**.
  <https://docs.baseten.co/reference/inference-api/chat-completions>

## 3. Budget-Mechanik (erklaert das Fehlerbild)

- Meta Reasoning-Doku: Reasoning-Tokens zaehlen gegen Output-Limit
  (`max_tokens` / `max_output_tokens`) und Billing
  (`completion_tokens_details.reasoning_tokens`). Zu kleines Budget wird
  komplett von Reasoning verbraucht → leeres `content` + `finish=length`.
  <https://dev.meta.ai/docs/reasoning>
- Self-host-Beleg (TensorRT-LLM, gleiche Modellfamilie): "Too small a budget
  is spent entirely on reasoning and returns an empty `content` with
  `\"finish_reason\": \"length\"`."
  <https://dev.meta.ai/docs/muse-spark-open/deploy>

## 4. Modell-Limits muse-spark-open-1026 (Slug-Variante von muse-spark-open)

- 1.048.576 Tokens Kontext (alle Anbieter gleich).
  <https://dev.meta.ai/docs/muse-spark-open/deploy>
  (Hosted-Tabelle),
  <https://www.baseten.co/blog/muse-spark-open-launch/>
  (1M-Kontext, 816B total / 42,7B aktiv, NVFP4, reasoning output).
- Meta empfiehlt, genug Output-Tokens fuer Reasoning **plus** Antwort zu
  lassen; xhigh (512) erzeugt lange Reasoning-Spuren → `stream: true`.
  <https://dev.meta.ai/docs/muse-spark-open/settings>

## 5. Konsequenz fuer ModelMuse (v22, umgesetzt)

- `reasoning_effort: 'none'` war **unbelegt** (wird rejected bzw. auf low
  gemappt) → ersetzt durch **`'low'`** = kleinstes BELEGTES Thinking-Budget,
  nur Baseten-Pfad, Meta-Pfad unveraendert, 400-Fallback (exakt v20-Body)
  bleibt.
- Diagnose-Export per Copy-Button (redigiert, ohne Key) liefert dem User
  die Rohdaten: Provider/Modell/HTTP/finish/Usage-Zahlen
  (reasoning+completion)/Retry/Build + Rohantwort ~2KB.
