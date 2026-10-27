# 3JSBench-Briefs — Herkunft und Lizenz (27.10.2026)

- Quelle: https://github.com/GeneralContext/3jsbench (Stand 27.10.2026, flacher Klon).
- Lizenz: MIT (`LICENSE-MIT-upstream`, Copyright 2026 General Context).
  100 Aufgaben-Texte unter `eval/3jsbench/<id>/prompt.md` VERBATIM uebernommen,
  nichts gekuerzt oder veraendert.
- Grader-Quellcode im Upstream NICHT enthalten ("coming soon", Stand Okt 2026) —
  als Grader misst der EIGENE SkillSpark-Verify-Loop (S1/S4/S5).
- Verwendung: Geometrie-Regression fremder Briefs durch die eigene Pipeline
  (P1 + Guard + Verify), siehe `scripts/regression-3jsbench.mjs --tag <name>`.
  Voll-Lauf (100 Generierungen) nur auf ausdruecklichen Auftrag.
