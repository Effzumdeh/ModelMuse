# Freimodus: 5500-Token-Antwort scheiterte in registerFree (Befund 31.10.2026)

## Live-Meldung (Eigentümer)
- Quelle: `baseten-direct`, Modell `meta-models/muse-spark-open-1026`, HTTP 200,
  `finish_reason: stop` (nicht length!), `usage ≈ 5500 completion tokens`,
  Reasoning-Anteil klein, Retry 0/1, Build v23.
- UI-Status: `Quelle ungültig oder nicht nutzbar. Cannot use import statement
  outside a module.`
- `raw_snippet` (`Need to produce Three.js module code per spec. Fußballfeld...
  Provide code only.`) liest sich wie ein Reasoning-/Prompt-Auszug, **nicht**
  wie Content-Anfang (`import ...` / `export const meta`).

## Einordnung: Reader vs. Guard vs. Ausführung
- **Reader sammelte**: `finish=stop` + 5500 Completion-Tokens belegen
  Content-Ankunft. `collectChatText`/`readSseText` (Fence-Erstblock + Shape-Check
  `export const meta` / `export function init`) liessen die Antwort passieren —
  sonst wäre `badSource` ohne Engine-Text gekommen.
- **Guard verwarf nicht**: kein `E-FREE-FORBID`/`E-FREE-IMPORT`/`E-FREE-META`.
- **Verwerfer = Ausführung**: `window.__viewer.registerFree` → Fix3-Import-Strip
  war zeilenverankert (`/^\s*import.../gm`). Jeder statische Import **nicht** am
  Zeilenanfang (zweite Import-Anweisung in derselben Zeile, `;import` nach Code,
  Side-effect-Import mitten in der Zeile — typischer `Provide code only`-Output)
  überlebte den Strip. `new Function` ist Classic-Script (kein Modul) und warf
  `SyntaxError: Cannot use import statement outside a module`, der unklassifiziert
  an die Statuszeile gehängt wurde. Repro am Artefakt bestätigt (vor Fix).
- Zum `raw_snippet`: `readSse*` nutzt `full || reasonSample || Roh-Rest` — der
  Reasoning-artige Snippet stammt aus dem `reasonSample`-Fallback (Thinking-Fall
  bzw. früherer Versuchszustand), nicht aus dem verworfenen Modul-Content.

## Fix (v24, `scripts/build-standalone-v24.mjs`)
- F0 Import-Strip positionsunabhängig: Treffer auf der offset-gleichen Maske
  `clean` (Kommentare/Strings geblankt) per globalem Regex suchen (statisch mit/
  ohne `from` + Side-effect; `import()` und `.import`-Property ausgenommen),
  Bereiche in `code` **und** `clean` mit Leerzeichen blanken (Umbrüche erhalten).
- F1 Nachvalidierung: verbliebenes `import` (z. B. `import.meta`) →
  `E-FREE-SHAPE: import verblieben`; dynamisches `import()` →
  `E-FREE-FORBID: import(`. Kein Engine-SyntaxError mehr an der UI.
- F2 Epilog-Sicherung (Zweitbefund aus eigenem Repro): genau ein `\n` am
  Code-Ende — ein Trailing-`//`-Kommentar ohne Umbruch kommentierte sonst den
  angehängten `;return {...}`-Epilog aus (`fn` → `undefined` → TypeError).
- F3 Status-Metriken (generate + modify): `[<len>Z,fence:ja/nein]` vor der
  Fehlermeldung — Content-Länge, Fence-ja/nein und Validierungsfehler
  (`E-FREE-*`) stehen künftig getrennt in der Statuszeile.
- F4 Build-Stempel v24.

## Nachweis
- `tests-unit/standalone-free-imports.test.mjs` (11 Tests, neu): Repro-Fälle
  (gleiche-Zeile, `;import`, Side-effect-mid-line), Regression (Zeilenanfang,
  mehrzeilig, CRLF, Tabs), kein Über-Strip (String/Kommentar mit import-Wortlaut),
  klassifizierte Reste (`import()`, `import.meta`), Fail-closed (falscher
  Specifier), simuliertes 5500-Token-Modul mit `finish stop`-Pfad (Fence + Shape
  + registerFree + INIT-Aufruf).
- `npm run test:unit`: 234/234 grün. `node scripts/verify-standalone.mjs`: OK
  (inkl. neuer v24-Zeilen). Syntax-Gate: alle Inline-Scripts parsen.
