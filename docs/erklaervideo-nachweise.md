# Erklärvideos — Nachweise (DE/EN/ES)

Stand: 30.10.2026 · Alle Angaben per `ffprobe` / `ebur128` / Hyperframes-Lint gemessen, nicht geschätzt.

## Deliverables

| Datei | Dauer | Auflösung | Größe | Finalmix (ebur128 am MP4) | True Peak |
|---|---|---|---|---|---|
| `docs/erklaervideo-de.mp4` | **170,00 s** | 1920×1080, h264 + aac 192k/48kHz | **19,5 MB** (20.486.077 B) | **−12,0 LUFS** | −1,8 dBFS |
| `docs/erklaervideo-en.mp4` | **174,00 s** | 1920×1080, h264 + aac 192k/48kHz | **19,5 MB** (20.440.881 B) | **−12,1 LUFS** | −1,7 dBFS |
| `docs/erklaervideo-es.mp4` | **170,00 s** | 1920×1080, h264 + aac 192k/48kHz | **19,2 MB** (20.184.223 B) | **−12,1 LUFS** | −1,4 dBFS |

Alle Dauern im Zielkorridor 160–180 s. `docs/erklaervideo-test.mp4` (Smoke, 169 KB) ist **gelöscht**.
Abnahme-Skript: `docs/.erklaervideo-work/tools/verify.mjs` — 24/24 Prüfungen bestanden.

## Voiceover (ElevenLabs, `eleven_flash_v2_5`, speed 1.0, kein Chipmunk)

| Sprache | Wörter | Voiceover netto | Video gesamt | Stimme (alle `use_case=informative_educational`, per `/v1/voices` gewählt + per ID verifiziert) |
|---|---|---|---|---|
| DE | 300 (gekürzt von 419, Fakten unverändert) | 161,43 s | 170,00 s | **Daniel – Steady Broadcaster** (`onwK4e9ZLuTAKqWW03F9`), male/middle-aged, verifiziert `en\|de\|tr`. „A strong voice perfect for delivering a professional broadcast“ — warm, klar, moderierend. **Lennart wurde auf Eigentümer-Weisung NICHT verwendet.** |
| EN | 409 | 162,91 s | 174,00 s | **Alice – Clear, Engaging Educator** (`Xb7hH8MSUJpSbSDYk0k2`), female/middle-aged, verifiziert `en\|it\|fr\|ar\|ja\|pl\|hi`. „Suitable for e-learning“ — warm, klar, Tutorial-Ton. |
| ES | 342 (gekürzt von 418, Fakten unverändert) | 159,43 s | 170,00 s | **Matilda – Knowledgable, Professional** (`XrExE9yKIg1WjnnlVkGX`), female/middle-aged, verifiziert `en\|it\|fr\|de\|ar\|es`. „Pleasing alto pitch“ — ruhig, professionell. |

Auswahlregel (deterministisch): `premade` + `narration|educational`-Use-Case zuerst, dann Name. 6 Blöcke/Sprache einzelsynthetisiert, Pausen (Head 1,0 s, Gaps 0,5–0,6 s, Tail 2,6–7,6 s) als Stille — keine Zeitdehnung.
Kosten: reine API-Nutzung, ca. **< 1 $** (≈ 12k Zeichen × 0,04 $/1k), **keine Cloud-Käufe**.

## Musik (eigene Synthese, Loop)

`docs/.erklaervideo-work/music-loop.wav` — 32,0 s, 48 kHz Stereo, Peak −3 dBFS, generiert per NumPy
(`tools/music.py`): Pad Am–F–C–G (je 8 s, Sinus + weiche Oktave, Raised-Cosine-Blenden),
Sub-Bass, Pentatonik-Plucks alle 2 s (deterministisches Pattern). Alle Frequenzen auf 1/32-Hz-Raster
quantisiert → **perfekter Seamless-Loop**. Auf **−36 LUFS** normalisiert (Gain ≈ −24,5 dB), geloopt.

## Pegel-Kette (ffmpeg, gemessen)

- Stimme → **−14 LUFS** (fixer Gain + sanfte 3:1-Kompression, verifiziert −14,06/−14,18/−14,18)
- Musik → **−36 LUFS** → Summe → linearer Gain auf **−12 LUFS** + oversampelter True-Peak-Limiter (−2,0 dBFS)
- Final-WAV (ebur128): DE −12,00 / EN −12,00 / ES −12,00, TP −2,00 — nach AAC: siehe Tabelle oben.

## Video (Hyperframes, high quality, 1920×1080, 30 fps)

- Komposition je Sprache aus dem Storyboard (`docs/erklaervideo-skript[.en|.es].md`): **9 Szenen**,
  selbst gezeichnete 2D-SVG-Figuren (Muse-Glühbirne mit Mimik-Varianten wink/happy/wow/grin,
  Lina mit Dutt/Brille/Zeigestock, Finn mit Kappe), GSAP-Timing auf den Voiceover-Blöcken
  (Szenen-Splits an Satzgrenzen), Push-Slide-Übergänge + Iris-Auftakt, kein Jump Cut.
- `npx hyperframes lint`: **0 Errors** · `validate` (WCAG AA): **bestanden, 0 Kontrast-Warnungen** ·
  `inspect`: **0 Layout-Issues** · Render: Screenshot-Capture, ~2 min/Video.
- Standbild-Kontrolle (t = 5/30/90/160 DE, t = 100 EN, t = 60 ES): Layout, Figuren, Texte lesbar, keine Defekte.
- App-Fakten nur aus belegten Quellen (10 Modelle 5×3D/5×2D, Anbieter Meta Muse/Baseten,
  Muse Spark 1.3, Session-Key, Überarbeiten-Feld — **kein Stift-Icon**, Bestandteile-Overlay, 2D-Modus, Single-File).

## Reproduktion

`docs/.erklaervideo-work/tools/`: `tts.mjs` (Key aus Root-`.env` selbst geparst, nie geloggt),
`music.py`, `build-html.mjs`, `mix.mjs`, `verify.mjs` · Belege: `tts-summary.json`, `voices.json`, `mix-report.json`.
