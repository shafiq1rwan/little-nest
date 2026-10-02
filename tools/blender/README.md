# Blender tools

Everything here serves the prop pipeline in [docs/PROP_BRIEFS.md](../../docs/PROP_BRIEFS.md). Blender 5.x runs headless; set `BLENDER` to the executable if it is not at the default Windows install path.

| File | Purpose |
| --- | --- |
| `clean-generated.py` | Turns a raw image-to-3D mesh (`art-source/generated/<key>.glb`) into a game-ready glb: plate removal, scale, origin, colour parts by rule, split, decimate per part, export with `recolor` extras. |
| `models.json` | One entry per modelled prop: size, triangle budget, extra flags, or `source` for an authored export. |
| `build-models.py` | Runs the manifest (all keys or the ones given), installs into `public/models`, writes `output/models-preview/_contact.png`. |
| `build-sofa-v2.py`, `build-plants-v2.py`, `build-cactus-v2.py` | Rebuild the authored models in `art-source/models-v2` from scratch. |
| `check-plants-v2.mjs`, `check-cactus-v2.mjs` | Re-import the authored exports with the game's Three.js and check triangles, materials, recolour flags and sizes. |

Framed-art images come from `tools/comfy/generate-prints.py` (ComfyUI), not Blender. After changing any file in `public/models`, bump `MODELS_VERSION` in `src/config/game.js`.
