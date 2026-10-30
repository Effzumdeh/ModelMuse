# Neubau- & UI-Check (Tag `nachts-final`, Commit `292494e`)

Stand: 29.10.2026. Geprüft aus Code/Artefakten, kein Umbau.
User-Vergleichsbild: `…/native-inputs/1c886a5e…/img_034db42717ef.jpg`
(zeigt `dist-standalone/modelmuse-standalone.html#v10`, Titel „ModelMuse Generator 3D-Viewer v10“).

## 1) Sind die 6 3D-Modelle + Koffein neu nach Guide gebaut? — JA

Guide: `docs/implementation-guide-3d-qualitaet.md` (F1–F6 alle als umgesetzt markiert, Stand 28.10.2026).
Kernsanierung: Commit `341bcf5` „3D-Kernsanierung 6 Modelle: Guide-Konformitaet + chemie-koffein neu“.
Betroffen: `src/models/{gpu-example,si-1,si-2,si-3,free-handbohrmaschine,chemie-koffein}.js`
(`chemie-koffein.js` neu, 231 Zeilen; `free-handbohrmaschine.js` aus Standalone-Embed kuratiert).

| Nachweis | Datei | Befund |
|---|---|---|
| Hashes (aktuell) | `sha256sum src/models/*.js` | gpu `b5ec6e…`, si-1 `9b7899…`, si-2 `2abcab…`, si-3 `1b4c1c…`, free `45b172…`, koffein `694777…` |
| Timestamps | `ls --full-iso src/models/` | si-1 28.10. 23:40, si-2 23:42, gpu 23:44, free 23:46, koffein 23:50, si-3 29.10. 00:00 — alle Nacht 28.→29.10. |
| IBL-Raum (F1/F4) | `grep environmentIntensity src/models/*.js` | alle 6: `scene.environmentIntensity = 0.55`, `const room = new Scene()` + PMREM |
| PCF (F2) | `grep PCFShadowMap` | alle 6: `renderer.shadowMap.type = PCFShadowMap`, `mapSize 1024`, `bias -0.0001`, `shadow.radius = 4`; kein `PCFSoftShadowMap`, kein `envMapIntensity` in Modellen (0 Treffer je Datei) |
| DPR-Cap | `grep setPixelRatio` | alle 6: `Math.min(2, Math.max(1, …))` vor `setSize` |
| Harness 6/6 grün | `dist/harness-6modelle.jsonl` (29.10. 00:03) | je Modell 1 Reparaturrunde, `guideFails: []`, S1+S2 pass, Budgets ok (koffein: 18144 Tris / 30 Calls) |
| Budgets | `dist/final-budgets-6modelle.json` | 6/6 `budgetOk: true` |
| Screenshots | `dist-standalone/proof-*.png` (29.10. 00:04; v12-Shots 00:34) | 12× overview+detail + `proof-6modelle.json` (`ok: true`, nonBgRatio ≥ 0,91) |
| Guide-Unit-Test | `tests-unit/guide-3d-qualitaet.test.mjs` | 14/14 pass (30.10. erneut verifiziert) |
| verify:all | `dist/verify-report.json` (29.10. 00:18) | 12 Modelle gelb (= max, kein grün ohne Lehrkraft-Freigabe), S1–S5 pass; `dist/attestation.json` listet alle 12 als „auto-geprüft (Lehrkraft-Freigabe ausstehend)“ |

Einschränkungen (ehrlich):
- `prompts/gen-*-v5real.txt` / `v6hyper400` enthalten noch alten P1-Text mit `PCFSoftShadowMap` + `envMapIntensity`-Fallback — nur Alt-Promptdateien, nicht mehr im Buildpfad wirksam (Modelle + `P1`-Freiprompt in `src/shell/ui-livegen.js` sind bereinigt).
- `build-standalone-report.json` vermerkt: Free-Modell (Handbohrmaschine) ohne IBL-Nachrüstung („Optik-Identität“) — dokumentierte Ausnahme.
- `dist/final-budgets.json` (alt) kennt koffein/free nicht — maßgeblich ist `final-budgets-6modelle.json`.

## 2) Welche UI ist wo? — `dist/lab-player.html` ≠ `dist-standalone/v12-guide`

| Merkmal | `dist/lab-player.html` (996 825 B, 29.10. 01:07, sha `097d0474…`) | `dist-standalone/modelmuse-standalone.html` (280 318 B, 29.10. 01:02) |
|---|---|---|
| Titel | „ModelMuse Lab-Player“ (kein v-Tag) | „ModelMuse Generator 3D-Viewer v12-guide“ |
| Basis | `scripts/build.mjs` aus `src/shell/*` (theme.css 00:48, main.js 00:49) | v11-Basis (`scripts/_tmp/standalone-v11-basis.html`, Titel v10) + Patch `scripts/build-standalone.mjs` (R1–R19, Stempel `standalone-build v12-guide`) |
| Labs | 12/12 (11 Matrix + Graphics Card) | 10 (si-1..3, dup-1..3, ae-1..3, free-handbohrmaschine) |
| Generator | rechts: Proxy-Fallback + eigener Muse-Key (Session), „Modell generieren“ | OpenRouter-Direkt (Key Session), Beispiel-laden, Modify/Revise-Panel (Nacht-Commit) |
| Umfang | Verify-Bericht S1–S5, Quiz, Fortschritt, i18n de/en/es, 2D-Router | Slim: Quiz/Fortschritt/Hinweise entfernt (`scripts/_slim-standalone.mjs`), Modify drin |
| Beleg-Screenshots (aktuell) | `dist/screenshots/{labs,generieren,modify,sprache}.png` (29.10. 01:08) | `dist-standalone/proof-{si-1,ae-2,free-handbohrmaschine,dup-1}-v12.png` (28.10. 23:34) + `proof-slim-modify.png` (29.10. 01:02) |

CSS/Builder-Datum: `src/shell/theme.css` 29.10. 00:48 (Lab-Player-Dunkel-Theme, gelb/cyan-Akzente);
Standalone-CSS = Tailwind-CDN + Vue (Offline-Risiko P0, dokumentiert in Ledger #16).
Builder: `build.mjs`/`build-standalone.mjs`/`_slim-standalone.mjs` alle Commit `292494e`.

## 3) User-Vergleich (v10-Screenshot) vs. Ist-Stand

- **Fußball-Modell: existiert im Repo NICHT als kuratiertes Lab.** Kein Treffer für `fussball|fußball|football` in `src/`, `prompts/`, `tests/`, `docs/`, HTML-Artefakten. Einzige Treffer: `dist-standalone/ledger-muse-calls.md` #22/#25 — dort ist „Fussball-Icosahedron“ nur ein **Test-Snippet für `registerFree`** (Geometrie-Allowlist v9-Fix2/v10-Fix4), kein Lab.
- **Herkunft im User-Bild:** `modelmuse-standalone.html#v10` zeigt 11 Labs (Badge-Zählung „Labs (11)“), darunter „Free | Free — Fußball, Fortschritt 3/4“, Gesamt „7 % 3/44“. v11-Basis und v12 enthalten nur 10 Labs (davon 1× free: Handbohrmaschine). → Der Fußball war ein **vom User per Generator erzeugtes Free-Lab** (Browser-localStorage, nicht versioniert), kein kuratiertes Modell. Nachvollziehbar: v10 hatte Generator + Free-Reload-Fix (Ledger #23/24).
- **Aktuelle Modelle sind trotzdem neu:** Nachweis s. Abschnitt 1 (Hashes/Timestamps/Harness/Proofs der 6 3D-Modelle aus Nacht 28.→29.10.).
- **UI-Diff v10 (User-Bild) vs. aktuell:**
  - v10 (Bild): „ModelMuse Generator 3D-Viewer v10“, Labs (11), Gesamt-Fortschritt 7 % 3/44, Ebenen-Panel mit Bauteilen (5) + „68 von 68 Meshes zugeordnet“, Ansicht Übersicht/Detail, 2D-/3D-Modus, Labels/Maße-Checkboxen.
  - v12-standalone: Titel/Badge `v12-guide`, gleiche Layout-DNA (Labs-Suche, DE/EN/ES, Dunkel/Hell, Ebenen-Overlay, 2D/3D), aber **Quiz/Fortschrittsbalken entfernt (Slim)**, Modify/Revise-Panel + OpenRouter-Direkt dazu, ae-1..3/dup-1..3 als 2D (`is3d:false`, R18), Attributions-Footer (R19). Fußball-Lab fehlt (war User-lokal).
  - `dist/lab-player.html`: **andere App** (kein v-Tag, „Lab-Player“, 12 Labs inkl. Graphics Card + Koffein, Verify-Bericht S1–S5, Anbieter/Modell M3-Auswahl, Proxy-Fallback) — nicht mit v10 zu verwechseln.

## 4) Diskrepanzen / offene Punkte

1. User-Eindruck „Modelle wirken nicht neu gebaut“: widerlegt für die 6 3D-Modelle (Abschnitt 1); aber **ae-1..3/dup-1..3 sind seit `7f483de` 2D-SVG-Datenmodule** (~1,2 KB) — wer 3D-Modelle für alle Labs erwartet, sieht „alte/keine“ 3D-Modelle. Beleg: `dist/verify-report.json` (S2-2D-Gates), `dist-2d/*.png`.
2. User-Eindruck „UI wirkt alt“: v12-standalone ist bewusst Slim (Quiz/Fortschritt raus); wer v10 mit Fortschritt 7 % erwartet, vermisst Features. `dist/lab-player.html` hat Quiz/Fortschritt noch — ggf. falsche Datei geöffnet.
3. Fußball-Lab ist nicht reproduzierbar (User-localStorage, nie committet). Falls gewünscht: per Generator neu erzeugen und als `free-fussball` kuratieren.
4. `dist/lab-player.html` (996 KB) vs. Standalone (280 KB): unterschiedliche Builder — nicht gegenseitig als „neu/alt“ vergleichbar.
5. Attestierung: alle 12 Labs Ampel **gelb** („Lehrkraft-Freigabe ausstehend“) — kein grüner Freigabe-Status, korrekt so.
