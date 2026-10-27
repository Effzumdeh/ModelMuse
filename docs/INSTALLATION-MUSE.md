# Installation: Muse-CLI (Stand 27.10.2026)

Pfad: `C:/Users/flori/AppData/Local/Programs/muse/muse.exe` (419 MB)
Version: 1.4.13 (Beleg: `dist/generation-log.json`, Kopf-Feld `cli`)
Modell-Pin pro Call: `--model muse-spark-1.3-contributor`
(Beleg: `generation-log.json` Felder `modellFlag`/`modellId`)

Auth NUR via `--api-key-stdin` (Key aus `Key_muse.md` per stdin).
Key nie als Argument, nie in Logs/Chat/Prozessliste.
(Beleg: `scripts/_gen-one.mjs`, spawn-Args + `stdin.write(key)`)

Abrechnung Key-Modus: Verbrauch im Schluessel-Portal des Providers.
`muse usage` meldet `No subscription allowance (api_key)` —
kein Kontingent, erwartet, kein Fehler.
(Beleg: `generation-log.json`, Feld `creditsLog`)

NICHT MACHBAR: `creditsRemaining` pro Call — `muse usage`
liefert im Key-Modus keine abfragbare Zahl (ehrlich, nicht erfunden).

Beleg je Call: `dist/ledger-muse-calls.md` + Tagesstand
`npm run usage:tagesstand` (`scripts/usage-tagesstand.mjs`).
