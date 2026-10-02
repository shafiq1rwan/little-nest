# Staged Blender plant collection

Eleven native Blender assets based on `art-source/prop-sheet-low-poly-v2.png`: plant, monstera, fern, snakePlant, palm, rubberTree, planter, succulent, bonsai, macrame, and vase. The previously built cactus remains in its sibling folder.

Each subfolder includes an editable `.blend`, a Y-up `.glb`, a small preview, and a build report. `contact-sheet.jpg` shows the complete set. They were integrated into the game on 2 October 2026 (see docs/HANDOFF.md): `tools/blender/models.json` installs them into public/models and the catalog loads them with procedural fallbacks. They use separate flat-color materials, with recoloring limited to containers. There are no painted textures to bleed across material boundaries; lighting still affects visible colors.

Regenerate from the project root using Blender:

```text
blender --background --python-exit-code 1 --python tools/blender/build-plants-v2.py -- --output art-source/models-v2/plants
node tools/blender/check-plants-v2.mjs
```

The validator checks all eleven exports through Three.js: finite geometry and normals, triangle budgets, material colors, recolor/restore behavior, dimensions and floor origins. It also renders front, side and back views in an isolated 1440 x 900 desktop WebGL viewer without screenshots. Results are in `validation.json`. Small tabletop objects stay below 400 triangles; other assets below 2,500.

Compact screens and gameplay integration were intentionally outside this request. Hanging placement should be checked against the game wall when integration is requested. Visual similarity remains subject to user review; these are individually modeled interpretations of the sheet.
