# three.js r186 API-Pin (modelMuse)

Stand: 28.10.2026. Quelle: `docs/implementation-guide-3d-qualitaet.md` (F6).
Ziel-API: three.js r186 (npm `three@0.186.1`).
Regel: Generierter Code darf nur APIs verwenden, die in r186 existieren.
Bei Widerspruch zwischen Prompt und dieser Datei gilt die Schnittmenge.

## 1. Erlaubte three-Namen (Schnittmenge P1-Importliste ∩ Vendor-Bundle)

36 Namen — exakt die P1-Importliste (`prompts/p1-generate.v6-standard.txt`,
`prompts/p1-generate.txt`), alle im Vendor-Bundle (`src/vendor/three.entry.js`)
und in `THREE_KNOWN_EXPORTS` (`src/runtime/guard-static.js`) enthalten:

```
Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, InstancedMesh,
MeshStandardMaterial, MeshBasicMaterial, MeshPhysicalMaterial, ShadowMaterial,
BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry,
TorusGeometry, ExtrudeGeometry, Shape, DataTexture, AmbientLight,
DirectionalLight, HemisphereLight, PointLight, Line, LineBasicMaterial,
DoubleSide, LinearFilter, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping,
PCFShadowMap, VSMShadowMap, Vector3, BufferGeometry, Matrix4, Quaternion,
PMREMGenerator
```

Plus genau ein Addon-Import (`OrbitControls` aus
`three/addons/controls/OrbitControls.js`) und `addLabel, addMeasurement` aus
`wrapper-helpers`.

## 2. Bundle-nur-Namen (Kompatibilitaet, NICHT fuer neuen Code)

Im Vendor-Bundle und in `THREE_KNOWN_EXPORTS` enthalten, aber nicht in der
P1-Importliste — Bestandsschutz fuer alte Module und `annotate.js`:

| Name | Grund |
|---|---|
| `PCFSoftShadowMap` | In r186 deprecated (warnt, faellt auf `PCFShadowMap` zurueck). Jede Warnung frisst vom Budget `MAX_THREE_WARNINGS`. Neuer Code: `PCFShadowMap`. |
| `CanvasTexture` | Nur fuer `annotate.js` (Label-Billboards). Module nutzen `DataTexture`. |
| `Sprite`, `SpriteMaterial` | Nur fuer `annotate.js` (Label-Billboards). |
| `Color` | P1 schreibt Hexzahlen vor (kein `Color`-Import). |
| `EdgesGeometry` | Reserve, derzeit ungenutzt. |

## 3. Verbotene Namen (nicht im Bundle — Import bricht den Boot ab)

`BackSide`, `FrontSide` (numerisch schreiben: `side: 1` nur im PMREM-Raum),
`outputEncoding` (heisst `outputColorSpace`), `Clock` (deprecated, `Timer`),
`RGBELoader` (heisst `HDRLoader`), `RectAreaLight`, `SpotLight`,
`MeshPhongMaterial`, `MeshLambertMaterial`, `CubeTextureLoader` und alle
weiteren nicht in Abschnitt 1 gelisteten three-Exporte.

## 4. Bekannte 186→187-Drift (Migration einplanen)

Aus dem Migrations-Guide 186→187 (Guide-Risiko 2):

- `CubeUVReflectionMapping` entfernt — nicht verwenden.
- `PMREMGenerator` auf Cube-Render-Targets umgestellt — `fromScene`-Pfad nach
  Migration erneut gegen die Raum-Rezeptur (P1 Inline-Environment) testen.
- `Object3D.dispose`-Pflicht — `dispose()`-Vertrag (P1) pruefen und um
  explizite Top-Level-Disposal ergaenzen, sobald r187 Ziel-API wird.

Bis zur Migration bleibt r186 gepinnt; diese Datei ist dann neu zu schneiden.
