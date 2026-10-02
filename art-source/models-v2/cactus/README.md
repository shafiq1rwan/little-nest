# Cactus — Blender matching sample

Native Blender model guided by cactus cell 26 in `art-source/prop-sheet-low-poly-v2.png`. This is a standalone review asset. It has not been integrated into the game, and the remaining collection is on hold pending the user's assessment of this sample.

- `cactus-v2.glb`: 1,774 triangles, nine mesh parts, five flat materials; 0.55 wide × 0.55 deep × 0.847 high, Y up, origin at ground center.
- `cactus-v2.blend`: editable parts, materials, and reference-view studio camera.
- `cactus-preview.png`: 512 px studio render with transparency, not an AI-generated preview.
- `build-report.json` and `validation.json`: source information and Three.js GLB re-import checks.

Matching choices: tapered terracotta pot with a thick raised lip, visible soil, ten broad geometric barrel ribs, five cupped pink petals and a yellow flower center. The newer sheet takes priority over the older brief's taller proportions, pale rib stripes, and small spines. Only the pot recolors; plant, soil and flower retain separate fixed materials. No texture maps or generated geometry are used.

Validation: GLB re-import in the game's Three.js version; finite positions, normals, triangle budget, dimensions, floor origin, five exact material colors, absence of textures, and pot-only recoloring. Two small studio renders were inspected: the first led to a shorter, darker barrel; the second was the final visual check. No compact-screen checks or game integration were performed.

From the project root:

```text
blender --background --python tools/blender/build-cactus-v2.py -- --out-dir art-source/models-v2/cactus
node tools/blender/check-cactus-v2.mjs
```
