# Next Steps — Fachkonzept-Abgleich, UX-Plan (Stand 27.10.2026 abends)

## 1. Lage: Fachkonzept vs. Codebasis (ehrlich)

Das FI-Fachkonzept (`meta-hackathon-FACHKONZEPT-FI-final.md`, 9 Labs SI/DuP/AE mit
KMK/ARP-Mapping) ist die geltende Spec — die Codebasis implementiert ihre
Huelle (Player, Guard, Verify S1–S5, Bibliothek, Freimodus, i18n, 20/20-Baselines),
aber NICHT ihren didaktischen Kern:

| Fachkonzept-Forderung | Codebasis-Stand | Luecke |
|---|---|---|
| Curriculum-Mapping im Produkt (LF-Titel, Zeitrichtwert, ARP-Block je Lab, B-14) | Manifeste kennen kein `curriculum_ref`; UI zeigt keines | Daten + Badge fehlen |
| Aufgaben A/B/C mit Sollwert, Einheit, Toleranz + numeric-Pruefung | `messwert`-Tasks werden geprueft (Toleranz %), `zuordnung`-Tasks nur per Klick als erledigt markiert | Selbst-Abhaken ohne Nachweis |
| 3 Hinweisstufen je Aufgabe (B-07) | keine Hint-Daten, keine Anzeige | Daten + UI fehlen |
| Adaptives Stufenregelwerk (Start B, 2x hoch/runter, nie unter A, B-08) | keine Stage-Engine | Engine fehlt |
| Quiz je Lab (4 Optionen + Begruendung je falscher Option, B-09) | kein Quiz-Modell, keine UI, keine Auswertung | alles fehlt |
| Tutor-Texte P3 mit Lernfeld-Anker (B-12) | Freimodus erzeugt Modelle, keine Tutor-Texte | Prompt + UI fehlen |
| Fehlvorstellungen als Interventions-Design | nicht abgebildet | Konzept-Arbeit |
| Physik-Invarianten je Domaene (B-05) | S2-Geometrie generisch, keine Fach-Invarianten (Subnet-Mathe, SQL-Mengen, Sortier-Traces) | je Lab 1 Satz echter Pruefungen |
| Schul-UX-Baseline (44px-Touch, Tastatur, Kontrast 4.5, B-11) | nie auditiert | Audit fehlt |
| Demo-Video + README + Submit (B-15, Abgabe 04.11.) | Demo-Timer-Skript existiert (10 s, fehlerfrei), Rest fehlt | zeitkritisch |

Technik-Seite ist dagegen stark: Build gruen, Verify 10x gelb, 20/20-Baselines stabil,
O-04-Nachweise (Doppel-Build byteidentisch, dist-Pruefung, Coldstarts), F5-Fallback
simuliert bestanden, 35er-Didaktik-Benchmark + 100 3JSBench-Briefs als Regression.

## 2. UX-Befunde (per Screenshot-Sichtung belegt, keine Vermutung)

1. **„1 Messungen"** (Grammatik-Bug, Pluralisierung) — in mehreren Screenshots sichtbar.
2. **Verify-Panel zeigt stabil „Modell gpu-example"**, egal welches Lab geladen ist —
   irrefuehrend; Ampel flippt zwischen Laeufen (rot/gelb).
3. **3D-Labels aus der Distanz unlesbar** (H2O/NaCl: winzige Sprite-Punkte am Bildrand),
   obwohl „5 Labels geladen" gemeldet wird.
4. **Kein Onboarding**: Erststart landet kommentarlos im Default-Lab; Freimodus-Key,
   BYOK-Session, Bibliothek erklaeren sich nicht selbst.
5. **Tastatur-/Touch-Bedienung unauditiert** (Orbit braucht Drag; Plus/Minus-Buttons
   existieren nur in der Overlay-Leiste).
6. **Aufgaben wirken beliebig abhakbar** (nur Messwert-Items pruefen wirklich) —
   Vertrauensschaden beim Lehren-Publikum.
7. **Keine Lernfeld-Sichtbarkeit**: Ein Azubi sieht nie, zu welchem LF/ARP sein Lab gehoert
   (Jury-Kriterium Impact + Educator-Reuse).

## 3. Priorisierte Next Steps (UX-first, Jury-Kriterien, Aufwand ehrlich)

Reihenfolge nach Wirkung pro Stunde, Abhaengigkeiten beachtet:

1. **UX-Bugfix-Bundle** (1 Call, klein, sofort sichtbar): Pluralisierung,
   Panel-Modellname an geladenes Lab binden (oder als „Referenzbericht" labeln),
   Mindest-Labelgroesse/LOD-Regel, Onboarding-Hinweiszeile beim Erststart.
2. **Curriculum-Badges** (1 Call, B-14, Jury-sichtbar): `curriculum_ref`
   (LF-Nummer/Titel/Zeitrichtwert/AJ, ARP-Position/Wochen) in alle 10 Manifeste
   (Werte aus FI-Fachkonzept §4.2–4.10 — belegt, nichts erfinden) + Anzeige als
   Badge je Lab + Bibliotheks-Spalte. S5 prueft Anwesenheit (analog meta_i18n-Muster).
3. **Aufgaben-Nachweis** (1 Call): `zuordnung`-Tasks per Textvergleich pruefen
   (erwartete Antwort aus Manifest, case-insensitiv, statt Selbst-Abhaken) +
   Hinweisstufen-Feld `hints[3]` ins Manifest-Schema (zunaechst Anzeige, ohne Engine).
4. **Quiz v1** (2 Calls): Manifest-Quiz (1 Frage/Lab, 4 Optionen + rationale —
   Texte aus Fachkonzept-Erfolgsnachweisen ableiten), UI + Auswertung mit
   Lernfeld-Anker, S5-Kriterium.
5. **Adaptiv-Engine** (2 Calls): Stage B-Start, 2-hoch/2-runter, Hinweis-Zaehler
   („mit Unterstuetzung"), Fortschrittsanzeige. Regelwerk als reine Funktion +
   Unit-Tests (deterministisch pruefbar, kein Modell noetig).
6. **Schul-UX-Audit** (1 Call + manueller Geraete-Test durch Florian):
   44px-Touch-Ziele messen, Tastaturpfad (Tab-Reihenfolge, Orbit ohne Drag),
   Kontrast-Rechnung, Befund-Tabelle. Fix-Call danach.
7. **Tutor P3 light** (1–2 Calls): Hinweis-/Feedback-Texte aus Spec ableiten
   (regelbasiert, ohne Modell-Call): falsche Antwort → passende Hinweisstufe +
   Fachbegriff; Anzeige im Aufgaben-Panel mit Lernfeld-Anker.
8. **Fach-Invarianten je Lab** (je Lab 1 Call, nur SI-1/DuP-1/AE-2 zuerst als
   Leuchttuerme): echte Pruefungen (Subnet-Mathe, Join-Kardinalitaet,
   Sortier-Permutation) als S2-Kriterien mit gemessen-gegen-erwartet.
9. **README + Demo-Video + Submit** (ab 02.11., zeitkritisch): Demo-Timer belegt
   10 s; Video + Submit gehen vor allen Rest-Polish.

## 4. Bewusst NICHT (Won't, mit Grund)

- **E1/M1/W1-Elektro-Labs** (altes Fachkonzept-final): FI-Track gewaehlt, keine
  Doppelspur vor der Abgabe.
- **OpenRouter-Pfad jenseits Free-Modell**: nur Gratis-Slug, $5-Cap unangetastet
  ($0 bisher — alle 429er kamen vor Generierung).
- **Push auf GitHub**: nur lokale Commits (User-Vorgabe); Submit-Abgabe separat.
- **Live-Generierung im 180-s-Fenster**: physikalisch unmoeglich (92–401 s gemessen);
  Demo faehrt ehrlich den F2-Pfad.
- **A-03**: Pfad + Skripte verifiziert gruene (Key ok, Modell ok), Generierung steht
  auf 429 des Gratis-Tiers — Retry innerhalb der Key-Stunde, danach als
  „ratenlimitiert, $0 verbraucht" dokumentieren.
