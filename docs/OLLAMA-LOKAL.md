# Ollama als lokaler Provider — Stand Final-Sprint (03.11.2026)

Recherche-Stand (nicht erfunden, Quellen unten): Ollama läuft lokal auf
`http://localhost:11434` (Bind `127.0.0.1:11434` per Default).

## Endpunkte (beide belegt)

- Nativ: `POST http://localhost:11434/api/chat`
  (`{"model": ..., "messages": [...]}` — Antwort: `message.content`).
- OpenAI-kompatibel: `POST http://localhost:11434/v1/chat/completions`
  (gleiches OpenAI-Format, `base_url=http://localhost:11434/v1`).
  Die App nutzt den OpenAI-kompatiblen Pfad (ein Code-Pfad für alle
  Direkt-Provider).

Quellen:

- <https://ollama.com/blog/openai-compatibility> (OpenAI-Kompatibilität,
  `http://localhost:11434/v1/chat/completions`, `api_key='ollama'` wird
  ignoriert)
- <https://docs.ollama.com/api/openai-compatibility> (`/v1/chat/completions`,
  lokaler Server ohne Key)
- <https://docs.ollama.com/api/introduction> (lokal `/api` vs. `/v1`,
  lokale Requests brauchen keinen Key)
- <https://docs.ollama.com/faq> (`OLLAMA_HOST`, `OLLAMA_ORIGINS`,
  `/api/chat`-Preload)

## CORS / OLLAMA_ORIGINS

Ollama erlaubt Cross-Origin-Requests von `127.0.0.1` und `0.0.0.0` per
Default. Wird die App von einer anderen Origin served (z. B. Pages-URL,
LAN-IP), den Serve laufen lassen mit:

```sh
OLLAMA_ORIGINS=https://<deine-app-origin> ollama serve
```

(Platzhalter anpassen; mehrere Origins per Komma trennen.)

## BYOK entfällt — kein Key-Feld

Lokale Requests brauchen **keinen** Key (`Authorization` wird ignoriert).
Deshalb blendet die App bei Provider `ollama` das Key-Feld aus
(kein BYOK, keine Session-Ablage, kein Proxy).

## Modell als Freitext (Feld bleibt leer)

Ollama-Tags sind lokal beliebig (`ollama pull <tag>` lädt sie).
Die App zeigt deshalb **kein Dropdown**, sondern ein Freitextfeld, das
**bewusst leer bleibt** (Eigentümer-Vorgabe 03.11.2026 — kein
vorausgefüllter Vorschlag); der Platzhalter nennt `llama3.1:8b` als
Beispiel. Ohne eingetragenen Modellnamen bricht die App ehrlich mit
`ollamaModelEmpty` ab (de/en/es/fr).

```sh
ollama pull llama3.1:8b
ollama serve
```

## Fehlertexte mit localhost-Hinweis

Schlägt der Direkt-Call fehl (Ollama nicht gestartet, Modell nicht
geladen, CORS blockiert), hängt die App an Netz-/Timeout-Fehler den
localhost-Hinweis an (`ollamaHint` je Sprache, de/en/es/fr):

- de: sinngemäß „Ollama muss auf http://localhost:11434 laufen
  (ollama serve; ggf. OLLAMA_ORIGINS; Modell per ollama pull laden) —
  kein Key nötig.“

## ETA

Wie alle Modelle gilt bis zu Messungen **ETA 240 s** (Abort folgt
ETA + 120 s). Reasoning-Param wird für `ollama` nicht gesendet
(lokale Modelle, unverifizierte Params = 400-Risiko).
