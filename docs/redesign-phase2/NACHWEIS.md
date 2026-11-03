# Redesign Phase 2 — Umsetzungsnachweis (04.11.2026)

Quelle: `docs/FRONTEND-REDESIGN-PLAN.md` (§7 Top-5). Stand: live `44b6ad9` + diese Kette, uncommitted.

## Top-5 — umgesetzt

1. **Token-Fix H1** (`src/shell/theme.css`): Micro-Typografie 12→13px
   (`.prov-badge`, `.lab-detail`, `.part-btn`); `--accent2` hell `#0284c7`;
   `--bad` dunkel `#ef6b6b`; Rahmen hell `--ink-3` `#64748b`.
   Kanonische Tokens `--surface-0/1/2`, `--ink-1/2/3`, `--accent(+ink)`,
   `--accent-2`, `--ok/--warn/--bad`, `--focus`; Alt-Namen als Aliase.
2. **Dopplung gestrichen (H3)** (`src/shell/ui-annotations.js`, `main.js`,
   `index.html`): `Etikett:`-/`Maß:`-Bullets entfernt; Maße als
   `.measure-badge`-Chips; Panel-Titel → `Beschriftungen & Maße (n)`
   (`#annotation-count`, wie Labs-Zähler).
3. **Kompakt-Header + Branding (H2+M2)** (`index.html`, `theme.css`):
   HTML-Wortmarke `ModelMuse Lab-Player` entfernt (Logo-Pille mit
   `aria-label` bleibt, inkl. hell/dunkel-Varianten); `.lab-top` wrappt,
   `@media (max-width:639px)`-Kompaktform; Onboarding-Strings neutral
   (alle 4 Locales, keine `links/`-Annahme mehr).
4. **1 Primary-Button je Panel (M1)** (`theme.css` + `index.html`):
   `.lab-btn--primary` (Akzent-Füllung, `--accent-ink`-Text);
   genau je einer in Banner (`onboard-ok`), Freimodus (`live-go`),
   Bibliothek (`lib-adopt`), Modify (`modify-go`); Selects mit eigenem
   Chevron + neutralem Hover, Toolbar-Hover neutral.
5. **Signatur + Motion** (`theme.css`, `main.js`): Glastoolbar
   (`blur(8px)`, `rgba(16,21,30,.9)` / hell `rgba(255,255,255,.92)`,
   Akzent nur am aktiven Segment); Lab-Wechsel 160ms-Crossfade
   (`.lab-mount.is-switching`), `prefers-reduced-motion` = harter Schnitt
   (CSS + JS-`matchMedia`-Guard).

Nicht in Top-5 (bewusst offen): M3 Segment-Schalter, M4 Vorschlagsliste.

## Belege

- Kontraste (Rechner, alle ≥ 4,5:1 Text / ≥ 3:1 UI): hell `--accent-2` 4,86 /
  `--ink-3` 4,76 / `--ink-1` 16,40 / `--ink-2` 6,53 / `--accent` 6,29;
  dunkel `--bad` 5,69 / `--accent-2` 9,76 / `--ink-1` 16,09 /
  `--ink-2` 7,88 / `--accent` 11,96.
- Screenshots: `before/` vs `after/` (`hell-1440`, `dunkel-1440`, `hell-390`,
  via `shots.mjs`, `node scripts/serve.mjs 8091`). 390px-hScroll: 119px → 0px.
- Budgets: `index.html` 20647/22000, `main.js` 22510/23000,
  `theme.css` 13567/20000, `ui-annotations.js` 2637/7000.
- `npm run build` OK (hash `465abe1e…`) + `render-single-file.mjs` OK
  (1199511 Bytes); `verify:all` OK (23 Modelle, alle gelb);
  `verify:dist` ALLE CHECKS GRUEN; `test:unit` 395/395.
- Playwright grün: layout, static, i18n-ui, guard, owner, partinfo,
  fallback, coldstart, slim, standalone (25), didactics, geometry,
  determinism, sandbox, perf, labs.matrix, visual (Baselines neu,
  Diff = nur gewollte UI-Änderung, Screenshot geprüft), visual-matrix (24).
- Hinweis (außerhalb Scope): Verify-Tabelle clippt bei 390px intern
  (kein Page-Scroll); 200-%-Text/i18n-Längen bleiben Prüfaufträge (§6).
