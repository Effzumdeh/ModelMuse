# Architektur-Pfade: Vorabgenerierung vs. Browser-Freimodus (27.10.2026)

Entscheidung: Abweichung ist Architektur, kein Mangel. Kein Umbau.

## Pfad 1 — Vorabgenerierung (Muse-CLI)
- Ablauf: `muse.exe exec` via `scripts/_gen-one.mjs` (MODEL fix,
  Key aus Key-Datei NUR via `--api-key-stdin`, nie Logs/Chat/Prozessliste).
- Belegt: 30 Calls, Prompts `prompts/gen-*`, Protokoll `dist/generation-log.json`.
- M3-Wahl per Env: `MUSE_MODEL` (Default `muse-spark-1.3-contributor`),
  `MUSE_EFFORT` (Default `high`, als `--reasoning-effort` durchgereicht).

## Pfad 2 — Browser-Freimodus (direkte Meta-API)
- Ablauf: `src/runtime/livegen.js` via `scripts/proxy.mjs` direkt gegen
  `https://api.meta.ai/v1` (lokaler Proxy, BYOK nur Sitzung).
- Darf NICHT ueber die CLI laufen: im Browser ist kein CLI-Prozess moeglich
  (technisch zwingend, kein Provisorium, kein Umbau).

## M3-Wahl (konsistent: Registry + UI + _gen-one-Env)
- `muse-spark-1.3-contributor`: Hackathon-Tarif, Trainingsnutzung (Default).
- `muse-spark-1.3`: Standard, datenschutzfreundlich, reasoning max.
- Nur diese zwei IDs sind belegt (`src/data/providers.json`); Default unveraendert.

## Auslieferung (Stand 29.10.2026, v13)
- **Einzige Auslieferung:** `dist-standalone/modelmuse-standalone.html`
  (GitHub-Pages-faehig, kein Backend, keine Build-Pflicht). Builder
  `scripts/build-standalone-v13.mjs` (idempotent), Verify
  `scripts/verify-standalone.mjs`, Browser-Suite
  `tests/standalone.spec.mjs`.
- **Stillgelegt:** `dist/lab-player.html` (996 KB Alt-Build, geloescht).
  `scripts/build.mjs`, `scripts/render-single-file.mjs`,
  `scripts/double-build.mjs`, `scripts/verify-dist.mjs` bleiben als
  Dev-Werkzeuge lauffaehig, sind aber kein Auslieferungspfad mehr
  (kein toter Code: Aufrufbarkeit erhalten, Referenzen in README/Verify
  auf das Standalone umgestellt; `verify-all` gate-t neu auf das
  Standalone-Artefakt).
- **Laufzeit-Generierung/Modify im Standalone:** direkter Browser-fetch an
  `https://inference.baseten.co/v1/chat/completions`
  (`meta-models/muse-spark-open-1026`, BYOK/sessionStorage). Kein
  Proxy-Port (optionaler Fallback `scripts/proxy.mjs` wird nie
  automatisch gestartet).
