# Erklärvideos — Nachweise (DE/EN/ES/FR)

Stand: 04.11.2026 · Alle Angaben per `ffprobe` / `ebur128` gemessen, nicht geschätzt.
Revision: -180-Finalschnitt (184 s, je Sprache verifiziert `fail: 0`); Eigentümer-Vorgaben A–D + „serverless“-Korrektur (nichts zu installieren, nur gültiger Key eines LLM-Anbieters nötig).

## Deliverables

| Datei | Dauer | Auflösung | Größe | Finalmix (ebur128 am MP4) | True Peak |
|---|---|---|---|---|---|
| `docs/erklaervideo-de-180.mp4` | **184,00 s** | 1920×1080, h264 + aac 192k/48kHz | **23,4 MB** (24.513.076 B) | **−12,1 LUFS** | −1,7 dBFS |
| `docs/erklaervideo-en-180.mp4` | **184,00 s** | 1920×1080, h264 + aac 192k/48kHz | **23,5 MB** (24.681.277 B) | **−12,1 LUFS** | −1,7 dBFS |
| `docs/erklaervideo-es-180.mp4` | **184,00 s** | 1920×1080, h264 + aac 192k/48kHz | **23,4 MB** (24.509.447 B) | **−12,0 LUFS** | −1,7 dBFS |
| `docs/erklaervideo-fr-180.mp4` | **184,00 s** | 1920×1080, h264 + aac 192k/48kHz | **23,6 MB** (24.704.285 B) | **−12,1 LUFS** | −1,7 dBFS |

Alle Dauern 184 s (Ziel ~180 s). `docs/erklaervideo-test.mp4` (Smoke) existiert **nicht**.
Abnahme-Skripte: `docs/.erklaervideo-work/verify-{de,en,es,fr}180.json` — je Sprache **fail: 0** (Datei, Dauer, 1920×1080, h264, Audio, −12 ±0,3 LUFS, TP ≤ −1,0; plus Smoke-Abwesenheit und Belegdateien).

## Voiceover (ElevenLabs, `eleven_multilingual_v2`, speed 1.0, kein Chipmunk)

| Sprache | Wörter | Voiceover netto | Video gesamt | Stimme (per `/v1/voices` verifiziert, Primary, kein Fallback nötig) |
|---|---|---|---|---|
| DE | ~312 | 158,78 s | 184,00 s | German Narration / Lennard (`TUKJhQmz3RPYBNAgC5A1`) |
| EN | ~350 | 142,90 s | 184,00 s | Tyler / Claire (`xS4rWdm7XjmSzwmzOl3j`) |
| ES | ~370 | 154,74 s | 184,00 s | Salva / Diego (`hyKxCTlAqtnW188CgltM`) |
| FR | ~390 | 143,13 s | 184,00 s | Guillaume / Adam (`ohItIVrXTBI80RrUECOD`), verifiziert als „Premium Male teacher, E-learning, Informative" (cat=professional) |

6 Blöcke/Sprache einzelsynthetisiert, `<break time="0.9s"/>` pro Satz, Pausen (Head 1,0 s, Gaps 0,45 s, Tail ≥ 3,0 s) als Stille — keine Zeitdehnung.
Aussprache (Eigentümer B): TTS-Input phonetisch per PHON-Abbildung in `tools/tts-v2.mjs` — Muse→Mjus, Baseten→Baejsten, Queue→Kju (identisch in allen 4 Sprachen); Skripte, Anzeige und Captions behalten die korrekte Schreibweise.
Kosten: reine API-Nutzung, **≈ 0,80 $** (9.952 Zeichen inkl. Break-Tags; im Creator-Kontingent $0,00), **keine Cloud-Käufe**.

## Musik (eigene Synthese, Loop)

`docs/.erklaervideo-work/music-loop.wav` — 32,0 s, 48 kHz Stereo (unverändert wiederverwendet, keine Neukosten).

## Pegel-Kette (ffmpeg, gemessen)

- Stimme → **−14 LUFS** (fixer Gain + sanfte 3:1-Kompression, verifiziert −14,12/−14,36/−14,02/−14,02)
- Musik → **−36 LUFS** (Gain −24,56 dB) → Summe → linearer Gain auf **−12 LUFS** + oversampelter True-Peak-Limiter (−2,0 dBFS)
- Final-WAV (ebur128): DE −12,10 / EN −12,20 / ES −12,00 / FR −12,00, TP jeweils −2,00 — nach AAC: siehe Tabelle oben.
- Mux-Guard (neu, `tools/mux.mjs`): AAC kann Peaks anheben (EN: +2,1 dBFS) — Korrektur jetzt in −1-dB-Schritten ab −2,0 dBFS statt −2-dB-Schritten (EN: eine Runde −2,0 dB → −12,20 LUFS/TP −1,0, Guard erfüllt).

## Video (Hyperframes, 1920×1080, 30 fps, T = 184 s)

- Eine Komposition (`hf-all`) + `render --batch` (Rows de-en / es-fr): **9 Szenen** aus den Storyboards
  (`docs/erklaervideo-skript[.en|.es|.fr].md`), wiederverwendete Szenenbilder (keine Neukosten),
  GSAP-Timing auf den Voiceover-Blöcken, Scribble-Transitions an Blockgrenzen, Caption-Clip-Wipe, kein Jump Cut.
- Niveau-Pills (Basis/Aufbau/Profi) **entfernt** (Feature existiert nicht): Szene-3-Akzent leer, Variablen `lvl1–3` aus Komposition/Rows gestrichen.
- Neue Texte: Titel t2 „Nur Key nötig" + t4 Beispielmodelle + final1 ohne Modellzahl; Overlays unverändert blank (Schilder) bzw. HTML-Pills.
- Standbild-Kontrolle (DE t = 130 Szene 7, FR t = 60 Szene 5): Layout, Figuren, Titel-Chips, Overlays und Captions lesbar, neue Begrifflichkeiten belegt (Versionen/Historie, PNG/GLB); FR-Chip bei t = 60,0 s mitten in Wort-Stagger-Animation (kein Defekt).
- Illustrationen sichtgeprüft (scene4/6/7 + DE/FR-Frames): kein lesbarer Text in Bildern, nicht überladen → **keine Neumotive** (Kosten im Blick).
- Seedance-Zwischenclips: OpenRouter-Modellliste geprüft (451 Modelle, 0 Seedance-Treffer, keine Text/Bild→Video-Modelle) → **nicht verfügbar, ohne Clips produziert**.
- App-Fakten nur aus belegten Quellen (Beispiel-Bibliothek ohne Aufzählung, Anbieter Meta Muse/Baseten, Muse Spark 1.3, Session-Key, Reasoning Standard/vertieft, Queue, Historie max. 10, Export PNG/GLB, Überarbeiten-Feld — **kein Stift-Icon**, Bestandteile-Overlay, 2D-Modus, Single-File, nur Key nötig — **kein Server-Begriff**).

## Reproduktion

`docs/.erklaervideo-work/tools/`: `tts-v2.mjs` (Key aus Profil-`.env` selbst geparst, nur als HTTP-Header, nie geloggt; inkl. PHON-Abbildung),
`build-html-v3.mjs`, `mix-v2.mjs`, `mux.mjs`, `verify.mjs` · Belege: `tts-summary.json`, `voices.json`, `mix-report.json`, `grid.json`.
Skripte: `docs/erklaervideo-skript.md` (+`.en`/`.es`/`.fr.md`, FR neu angelegt).

## Player-Pfad live (Fix v55, 04.11.2026)

- Befund: Player (v54) fragte `../docs/erklaervideo-{lang}-180.mp4` — auf Pages
  (Projektseite, App unter `/ModelMuse/`) loest das zu `/docs/...` auf → **404**,
  Video startet nicht. Dateien selbst ok: `/ModelMuse/docs/*.mp4` → 200 video/mp4.
- Fix: `videoBase()` waehlt je Kontext (`dist-standalone/`-Vorschau → `../docs/`,
  Pages → `docs/`, relativ/subpfad-unabhaengig); `@error`-Fallback versucht einmalig
  die Alternativbasis (`videoAlt`, Markierung `data-v55-alt`, Cleanup bei Close).
- Belege: `npm run build:standalone` (Kette idempotent) + `verify:standalone` gruen,
  `test:unit` 414/414, `dist-standalone/build-standalone-v55-report.json`.
