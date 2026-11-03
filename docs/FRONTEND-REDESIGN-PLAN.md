# ModelMuse Frontend-Redesign-Plan (Phase 1 · Entwurf, kein Code)

Stand: 2026-11-03 · Quelle: Apple-Design-Skill (14 Referenzen, s. §0) · Audit-Artefakte:
`src/shell/index.html`, `src/shell/theme.css` (v52, 195 Zeilen), Live-Render via
`node scripts/serve.mjs` + Playwright-Screenshots (1440px hell/dunkel, 390px, Suche `chem` → 12→1),
Bundle-Analyse (Alpine.js 3.17.5, Three.js 0.186.1, Single-File-Build `dist-standalone/`).

## §0 Design-These, Kontext, Referenzen

- **Plattform/Framework:** Desktop-first Web-App (Single-File-SPA, Vanilla + Alpine.js-Art:
  `x-data`/`x-model`/`@click`, CSS Custom Properties via `html[data-theme]`, kein Komponenten-Framework).
  Übersetzung nach `cross-platform.md › Vocabulary`:
  CSS Custom Properties = semantische Farben, Media Queries (1024/1280px) = Size Classes,
  ARIA/`role=status` = Screenreader-Schicht, `backdrop-filter` = transluzente Funktionsschicht.
  Für Web-Apps gelten Prinzipien + Foundations (Farbe, Typografie, Layout, Writing); native
  Plattform-Konventionen (Menüleiste, Tab-Bar) werden übersetzt, nicht kopiert.
- **These des Screens:** „Ein Schul-Lab wählen, im 3D-Viewer betrachten, per LLM generieren/überarbeiten.“
  Charakteristischstes Element heute: schwebende Glas-Werkzeugleiste über schwarzem Viewport.
- **Geladene Referenzen (14):** `accessibility.md`, `layout.md`, `typography.md`, `color.md`,
  `designing-for-macos.md`, `cross-platform.md` (Always-Load-Set) +
  `lists-and-tables.md`, `buttons.md`, `sheets.md`, `searching.md`, `dark-mode.md`,
  `entering-data.md`, `generative-ai.md`, `branding.md`, `motion.md`.

## §1 Summary

Solide, ehrliche Werkbank: ein Suchort, Tastaturfokus sichtbar, 44px-Ziele, Verlauf mit
Wiederherstellen, kuratierte Bibliothek als Non-AI-Fallback. Größte Probleme: Kleinsttext
unter Plattform-Minimum mit zwei Kontrast-Ausreißern, mobile Kopfzeile ohne Kompaktform,
redundante Etikett-Dopplung in der rechten Spalte. **Rating: Good** — kein Critical-Befund,
drei High-Findings, Rest Medium/Low; Craft-Urteil: noch ohne Signatur (s. §5).

## §2 Was bleibt (bewusst behalten)

1. **Systemschrift + Tokens:** `system-ui`-Stack und semantische Custom Properties
   (`--bg/--text/--muted/--accent/…`, `html[data-theme]`) — Web-Übersetzung von
   `color.md › System colors` („Avoid hard-coding system color values“ löst der Token-Ansatz ein).
2. ** Auswahl = Rahmen + Fett + `aria-current`** (`main.js:280`): Status nie nur per Farbe —
   vorbildlich nach `accessibility.md › Vision` („Convey information with more than color alone“).
3. **Lebende Statuszeilen** (`role=status`: Freimodus, Provider, Bibliothek) — entspricht
   `generative-ai.md › Outputs` („specific, reassuring feedback during generation“).
4. **Verlauf (lokal, max. 10) mit Wiederherstellen** — entspricht
   `generative-ai.md › Outputs` („Make it easy for people to refine or revert generated results“).
5. **Kuratierte 10er-Bibliothek (schreibgeschützt)** — entspricht
   `generative-ai.md › Best practices` („consider offering a non-AI fallback“).
6. **Key nur Sitzung + Consent-Checkbox, Passwortfeld nie vorausgefüllt** — entspricht
   `entering-data.md › Best practices` („Never prepopulate a password“).
7. **Keine Sheets/Modals** (grep: kein `<dialog>`/`showModal`): alles Inline-Panels —
   entspricht `designing-for-macos.md › Best practices`
   („present more content in fewer nested levels and with less need for modality“).
8. **44px-Mindestziele** (`.lab-btn`, Selects, Suche) — erfüllt
   `accessibility.md › Mobility` (44×44 Default mobil, 28×28 Desktop).

## §3 Befunde (High zuerst)

### H1 · Kleinsttext unter Minimum + zwei Kontrast-Ausreißer (High)
- **Was:** `.prov-badge`/`.lab-detail`/`.part-btn` = **12px** — unter
  `typography.md › Ensuring legibility` (Desktop-Minimum 10 pt ≈ 13,3 px; mobil 11 pt ≈ 14,7 px).
  Gemessen (WCAG-Rechner, Hex aus `theme.css`): Hell-`--accent2` `#0284c7` auf Weiß = **4,10:1**
  (< 4,5:1, betrifft 12px-Geometrie-Badges); Dunkel-`--bad` `#e05252` auf Panel = **4,48:1**
  (14px-Fehlertext, knapp unter 4,5:1). Hell-Rahmen `#c9d3e0` auf Weiß = **1,51:1** (UI-Komponente).
- **Warum:** `accessibility.md › Vision` („Strive to meet color contrast minimum standards“,
  bis 17 pt → 4,5:1) + `dark-mode.md › Best practices`
  („for custom foreground and background colors, strive for 7:1, especially in small text“).
- **Fix (§4-Tokens übernehmen):** Badges/Detail/Part-Buttons auf **13px**; `--accent2` hell →
  `#0277b6` (**4,86:1**); `--bad` dunkel → `#ef6b6b` (**5,69:1**); Eingabe-Rahmen hell →
  `#64748b` (**4,76:1**). Alles in `theme.css`, keine Strukturänderung.

### H2 · Kopfzeile bricht bei 390px (High)
- **Was:** 390px-Screenshot: Logo-Pille + Wortmarke + zweizeiliges „Lab-Player“ + `Sprache`/`Deutsch`
  quetschen sich in eine Zeile, rechte Seite läuft aus dem Viewport; Onboarding-Text sagt
  „Links ein Lab wählen“ (falsch ohne Links).
- **Warum:** `layout.md › Adaptability` („Design a layout that adapts gracefully and consistently“)
  + `cross-platform.md` (Breakpoints = Size Classes: < 1024px ist kompakte Breite, eigene Regeln).
- **Fix:** unter 640px Kompakt-Header: nur Logo-Pille (Wortmarke per CSS ausblenden),
  Sprache + Theme in eine zweite, rechtsbündige Zeile umbrechen; Onboarding-String per
  `data-i18n` in kompakter Breite neutral formulieren („Ein Lab wählen …“). Reine CSS-/i18n-Änderung.

### H3 · Rechte Spalte listet dieselben 10 Einträge zweimal (High)
- **Was:** Checkbox-Liste + identische `Etikett:`-Bullets darunter verdoppeln Scroll-Länge;
  Maße erscheinen als 3D-Tag + Bullet. Überschriften-Dopplung „Beschriftungen & Maße“ /
  „Beschriftungen (10)“.
- **Warum:** Design-Prinzip Simplicity („Has every element earned its place?“) +
  `layout.md › Visual hierarchy` („Use progressive disclosure over density“) +
  `lists-and-tables.md › Content` („Keep item text succinct“).
- **Fix:** Bullet-Liste streichen (s. §5 Entfern-Accessoire); Maße nur als Badges am
  Checkbox-Label („Maß“ als Suffix); Panel-Titel → „Beschriftungen & Maße (10)“.

### M1 · Prominente Aktion nicht prominent (Medium)
- **Was:** „Modell generieren“ / „Modell überarbeiten“ sehen aus wie jede `.lab-btn`
  (Border-Buttons); Dropdowns (`Aufbau`, `Übersicht`) optisch nicht von Buttons zu unterscheiden.
- **Warum:** `buttons.md › Style` („use a button that has a prominent visual style for the most
  likely action … Keep the number of prominent buttons to one or two per view“).
- **Fix:** genau **eine** `.lab-btn--primary` pro Panel (Akzent-Füllung + `--accent-ink`-Text,
  Kontraste s. §4); Selects erhalten Chevron + neutrale Füllung ohne Akzent-Hover.

### M2 · Doppel-Branding im Header (Medium, Urteil + Guideline)
- **Was:** Logo-SVG enthält bereits „ModelMuse“-Schriftzug, daneben steht erneut
  „ModelMuse Lab-Player“ als HTML-Text.
- **Warum:** `branding.md › Best practices` („Resist the temptation to display your logo
  throughout … Ensure branding always defers to content“).
- **Fix:** HTML-Wortmarke entfernen, Logo-Pille behalten (hell/dunkel-Varianten v52 bleiben);
  frei werdende Header-Breite hilft H2.

### M3 · App-eigener Theme-Schalter (Medium, Trade-off dokumentiert)
- **Was:** `Hell`/`Dunkel`-Button überschreibt Systemwahl (persistiert in `localStorage`).
- **Warum:** `dark-mode.md › Best practices` („Avoid offering an app-specific appearance setting“).
- **Trade-off + Empfehlung:** Web-App ohne System-Setting-Zugriff; Default folgt bereits
  `prefers-color-scheme`, Schalter zeigt Zielzustand („Dunkel“ im Hell-Modus — korrekt).
  **Behalten**, aber als „Anzeige: System / Hell / Dunkel“-Segment mit System-Default ehrlich machen
  statt binärem Toggle.

### M4 · Suche ohne Vorschläge, Banner lauter als Inhalt (Medium/Low)
- **Was:** Suche filtert gut (12→1), bietet aber keine Vorschläge/letzte Begriffe;
  Onboarding-Banner (Akzent-Rahmen) konkurriert mit selektiertem Lab um Aufmerksamkeit.
- **Warum:** `searching.md › Best practices` („Provide suggestions to make searching easier“);
  `color.md › Liquid Glass color` („Apply color sparingly … reserve it for elements that truly
  benefit from emphasis“ — hier: Akzent = Auswahl, nicht Deko).
- **Fix (Low-Prio):** max. 5 Vorschläge aus Lab-Titeln unter dem Feld (reine `ui-library.js`-Liste,
  `aria-activedescendant` optional); Banner-Rahmen auf `--line`, Akzent nur für Auswahl.

### Kein Critical-Befund
`--text` (16,09:1 dunkel / 16,40:1 hell), `--muted` (7,88 / 6,53), Fokus-Ring, Touch-Ziele,
`aria-current`, Live-Regionen: alles im grünen Bereich der Lens-1-Regeln.

## §4 Token-System + Änderungsliste (Framework-Vokabular der App)

### Farben (jeweils hell / dunkel + gemessener Kontrast auf Einsatzfläche)

| Rolle | Hell | Dunkel | Kontrast | Einsatz |
|---|---|---|---|---|
| `--surface-0` (Seite) | `#f1f4f9` | `#0c1118` | — | `body`-Grund |
| `--surface-1` (Karte) | `#ffffff` | `#151c27` | — | `.lab-panel`, Toolbar-Glas |
| `--surface-2` (Eingabe) | `#ffffff` | `#0d141d` | — | Inputs, Selects, `.lab-detail` |
| `--ink-1` (Text) | `#16202e` | `#e8edf3` | 16,40 / 16,09 | Fließtext (≥ 4,5 ✓) |
| `--ink-2` (sekundär) | `#4c5f78` | `#9fb2c8` | 6,53 / 7,88 | Labels, Notizen (≥ 4,5 ✓) |
| `--ink-3` (Rahmen) | `#64748b` | `#3b4a5e`* | 4,76 / — | Rahmen, Divider (≥ 3:1 ✓) |
| `--accent` (Auswahl/Primär) | `#4f46e5` | `#ffd34d` | 6,29 / 11,96 | Selektion, 1 Primary-Button je Panel |
| `--accent-ink` | `#ffffff` | `#1c1005` | 6,29 / 13,04 | Text auf `--accent`-Füllung |
| `--accent-2` (Info/Geometrie) | `#0277b6` | `#4dd2ff` | 4,86 / 9,76 | Geometrie-Badges, Messungen |
| `--ok` / `--warn` / `--bad` | `#15803d`/`#b45309`/`#b91c1c` | `#37c26a`/`#e0a100`/`#ef6b6b` | ≥ 5,0 / ≥ 5,69 | Ampel, Verify-Kriterien |
| `--focus` | `#1d4ed8` | `#7cc4ff` | 6,70 / — | `:focus-visible`-Ring |

\* `--line` dunkel `#26313f` unverändert (dekorativ, keine Kontrastpflicht).
Akzent-Disziplin nach `branding.md` („Apply your app's accent color judiciously“):
Akzent = Auswahl + max. 1 Primär-Button je Panel + Status; nie großflächig, nie doppelt
(Banner-Rahmen wird `--ink-3`).

### Type (System-Stack bleibt — `cross-platform.md`: Plattformschrift)
`font-family: system-ui, -apple-system, "Segoe UI", sans-serif` (unverändert).
Skala: Display/Panel-Titel **20 semibold** · Panel-Untertitel **15 semibold** · Body **16** ·
Label/Notiz **13 `--ink-2`** (≥ 13,3px-Desktop-Minimum einhalten) · Micro (Badges, Detail,
Part-Buttons) **13 statt 12** · Viewport-Canvas-Beschriftung unverändert (Three.js-Content).
Hierarchie nur über Größe + Gewicht (`typography.md › Conveying hierarchy`), eine Schriftfamilie
(`typography.md`: „Minimize the number of typefaces“).

### Layout (ein Satz + ASCII)
**Ein Satz:** Kompakt = einspaltiger Stapel (Banner → Labs → Viewer → Inspector),
regulär = 3-Spalten-Werkbank mit sticky Viewer und sticky Inspector; Funktion bleibt in allen
Breiten identisch (`layout.md › Adaptability`).

```
REGULÄR ≥1024px (1280: 260 / 3fr / 1fr)      KOMPAKT <1024px
┌────────────────────────────────────┐        ┌────────────┐
│ [Logo]              Sprache [Theme]│        │ [Logo][Sys]│  ← Kompakt-Header
├────────────────────────────────────┤        ├────────────┤
│ Banner (neutral)          [Verst.] │        │ Banner     │
├──────┬────────────────┬────────────┤        ├────────────┤
│ Labs │  VIEWPORT      │ Inspector  │        │ Labs+Suche │
│ Suche│  (sticky)      │ (sticky,   │        ├────────────┤
│ 12×  │ ┌────────────┐ │ 1 Panel:   │        │ VIEWPORT   │
│ Liste│ │ Glas-Tools │ │ Checks+    │        │ ┌────────┐ │
│      │ └────────────┘ │ Maße)      │        │ │Glas-Bar│ │
│      │                │ Verify     │        │ └────────┘ │
│      │                │ Freimodus  │        ├────────────┤
│      │                │ Anbieter   │        │ Inspector  │
└──────┴────────────────┴────────────┘        │ (gestapelt)│
                                              └────────────┘
```

### Signature-Element (die eine Erinnerung)
**Schwebende Bernstein-Werkzeugleiste über schwarzem Viewport** — `backdrop-filter: blur(8px)`,
`rgba(16,21,30,.9)` (dunkel) / `rgba(255,255,255,.92)` (hell), Akzent nur am aktiven Segment.
Gehört zum Produkt (Lehre + 3D), nicht zum Template; alles andere tritt zurück (M2, M4).
Warum kein Template: kein Cream/Serif, kein Acid-Grün, kein Broadsheet-Raster —
aber Gelb-auf-Schwarz + Glas muss sparsam bleiben, sonst kippt es in „Dark-Player-Default“.

### Motion (ein orchestrierter Moment)
Lab-Wechsel: Viewport-Canvas **160ms ease-out Crossfade**, Toolbar-Segmente ohne Bewegung
(`motion.md › Providing feedback`: „Aim for brevity“, „avoid adding motion to UI interactions
that occur frequently“ — Canvas-Wechsel ist selten, Button-Hover bleibt still).
Qualitäts-Floor: `prefers-reduced-motion` → Crossfade wird harter Schnitt; kein Blinken;
nichts Zeitgesteuertes (Banner bleibt bis `Verstanden`).

### Sequenz (Accessibility → Konventionen → Craft → Polish)
1. H1-Tokenfixes (`theme.css` + 13px-Micro) — rein CSS, kein Build-Risiko.
2. H3-Dopplung streichen + Panel-Titel vereinen (`index.html`, `ui-annotations.js`).
3. H2-Kompaktheader + M2-Branding (CSS + 2 i18n-Strings × 4 Sprachen).
4. M1-Primary-Button + Select-Differenzierung (`.lab-btn--primary`, Chevron).
5. M3-Segment (System/Hell/Dunkel), M4-Vorschläge + Banner-Neutralisierung.
6. Motion-Moment + `prefers-reduced-motion`; Full-Pass: 200-%-Text, Tastatur-Only, beide Themes.

## §5 Craft-Kritik

- **Point of View:** Heute „fleißige Werkbank“, kein Standpunkt. Mit §4-Signatur wird sie
  „der ruhige Hörsaal mit Bernstein-Pult“ — Display-Typografie bewusst *nicht* eingeführt
  (Systemschrift trägt Navigation/Steuerung; `branding.md`: „Express your brand with familiar
  components“).
- **Template-Check:** bestanden mit einer Verwarnung — Near-Black + ein Gelb *kann* als
  „Dark-Player-Default“ gelesen werden; Gegenmittel ist die Akzent-Disziplin aus §4, nicht
  eine neue Farbe.
- **Typografie-Persönlichkeit:** neutraler Träger, kein Display — für ein Lehr-Tool richtig;
  Charakter kommt aus Inhalt (Modell-Titel, deutsche Du-Ansprache), nicht aus der Schrift.
- **Struktur kodiert Information:** `Labs (12/12)`-Zähler und Ampel sind echt (wahr über Inhalt);
  `Etikett:`-Präfixe waren es nicht — gestrichen.
- **Boldness an einer Stelle:** Glas-Toolbar + Bernstein-Auswahl. Alles andere: `--ink-3`-Rahmen,
  stille Buttons.
- **Entfern-Accessoire:** die statische `Etikett:`-Bullet-Liste unter den Beschriftungs-Checkboxen
  (H3). Verlust: null — jede Information steckt bereits in Checkbox-Label + 3D-Tag.

## §6 Prüfaufträge (nicht verifizierbar, kein Befund)

Tastatur-Shortcuts (?), Delete-Bestätigung in `ui-library.js:81` (irreversibel → Warnung nach
`generative-ai.md › Inputs`), deterministische vs. gefühlte Ladeanzeige bei Generierung
(`generative-ai.md › Outputs › Latency`), i18n-Textlängen EN/ES/FR im Kompaktheader,
Verhalten bei 200-%-Text (`layout.md › Adaptability`).

## §7 Rating-Begründung + Top-5

**Good:** Kein Verstoß gegen Lens 1 auf Critical-Niveau (Textkontraste ≥ 4,5 bis auf zwei
reparierbare Ausreißer an Kleinsttext; Ziele, Fokus, Live-Regionen vorhanden); drei High-Findings
(H1–H3), Rest Medium/Low; Craft ehrlich, aber noch ohne Signatur — daher kein Excellent.

**Top-5 (Reihenfolge = Sequenz §4):**
1. Token-Fix H1: 13px-Micro + `#0277b6` / `#ef6b6b` / `#64748b` (gemessen 4,86 / 5,69 / 4,76:1).
2. Etikett-Dopplung streichen, Maße als Badge-Suffix (H3 + Entfern-Accessoire).
3. Kompakt-Header < 640px + Doppel-Branding auflösen (H2 + M2).
4. Eine Primary-Aktion je Panel, Selects von Buttons unterscheiden (M1).
5. Glas-Toolbar als Signatur festschreiben + 160ms-Crossfade mit Reduced-Motion-Fallback.
