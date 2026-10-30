# Abweichungsblatt ModelMuse — 2026-10-27

Aenderungen der Bauplan-Originalwerte mit datierter Begruendung.
Verweis: `dist/BUDGET-NACHTRAG-2026-10-27.md` (Draw-Call-Erweiterung 120 → 400).
Alle Groessen in Bytes (Quelldatei, kein Bundle).

| Datei | Plan-alt | Ist (27.10.) | Neu-Max | Begruendung |
|---|---|---|---|---|
| `src/runtime/guard-static.js` | 9000 | 12902 | 13500 | E-S2-BOOT-Fix: `repairThreeImports` + Kommentar-Stripping + String-Maskierung + Import-Allowlist (E-07/E-08) |
| `src/runtime/livegen.js` | 9000 (E2E-Befund: 7500 → 9000) | 9023 | 9500 | Repair-Verdrahtung (+23 B): `repairThreeImports(extractModuleSource(...))` vor Boot |
| `src/shell/ui-livegen.js` | 15500 (Teil 1+2+5: 13000 → 15500) | 15585 | 16000 | Repair-Anbindung Freimodus-UI (+85 B) |
| `src/vendor/three.entry.js` | 700 (A-3: 560 → 700) | ~707 | 700 belassen, Istoleranz im Bundle | Color-Re-Export (+7 B, E-S2-BOOT `Color`-Fix); Bundle 606231 < Abbruchschwelle 743075, Artefakt-Budget gruen |
| `src/vendor/three.entry.js` | 700 | ~723 | 700 BLEIBT, Istoleranz im Bundle | EdgesGeometry-Re-Export (+16 B, NaCl-E-S2-BOOT-Fix 27.10.); Bundle 606231 < Abbruchschwelle 743075; bei naechstem Fix Max nachziehen |

Budget-Folge: keine. Alle Erhoehungen liegen im Artefakt-Komfort (Build verdict pass,
`lab-player.html` < 1 500 000 B). Kein CDN, keine externen Dateien, keine Key-Aenderung.

| `src/data/modellmatrix.json` | gpu-example labelsMin 9 | 10 | 10 | O-10-Nachtrag: Hyper-V3-Modell hat 10 echte Labels (GPU-Die, VRAM 1/2, Luefter 1/2, Heatpipe, Backplate, PCIe-x16, Strom, Slotblende); Matrix-Minimum 9 war veraltet — S5-soll schlug rot, nach Korrektur 10/10 gelb |
