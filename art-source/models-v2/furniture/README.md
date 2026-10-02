# Remaining v2 props — staged Blender models

All 35 remaining catalog props are modeled in native Blender using the v2 concept sheet. This completes the modeled catalog alongside the sofa, cactus, and eleven other plants in sibling folders. This batch is **not integrated** into the game.

Every prop folder contains an editable `.blend`, a Y-up `.glb`, a 384px preview, and a build report. The three contact sheets group seating/bedroom, tables/storage, and decor/lighting. Materials are separate flat colors without painted textures; lighting still changes their visible appearance. Upholstery and other recolorable parts carry `recolor` extras. Lamp shades and flames carry `glow` roles and emissive materials. The lantern glass is transparent, the mirror uses a reflective material, and both wall prints have blank canvases as required by the catalog.

## Rebuild and validate

Run from the project root with Blender, Python/Pillow, and project npm dependencies installed:

```text
blender --background --python-exit-code 1 --python tools/blender/build-furniture-v2.py -- --output art-source/models-v2/furniture
python tools/blender/furniture-contact-sheets.py
node tools/blender/check-furniture-v2.mjs
```

The furniture generator reuses geometry helper definitions from `tools/blender/build-plants-v2.py`; keep both scripts together. Add `--keys armchair floorLamp` after the output argument to rebuild selected assets.

Validation loads all 35 GLBs with Three.js and checks finite positions/normals, dimensions, floor/wall origins, exact source material colors, recolor/restore isolation, emission, glass, and triangle counts. Furniture stays below 1,500 triangles; tabletop props below 400; wall decor below 300. An isolated 1440 x 900 WebGL viewer renders three views per model without taking screenshots. Details are in `validation.json` and `build-report.json`.

Visuals were reviewed using small Blender contact sheets. These are interpretations of the reference, pending user art review. Production integration, surface-slot alignment, lamp toggles, dynamic print artwork, and compact-screen checks remain separate work. Some total bounds include built-in dressing or lamp shades; reports provide the exported measurements.
