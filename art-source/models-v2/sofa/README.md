# Sofa reference model v2

Deliverables: `sofa-low-poly-v2.glb`, editable `sofa-low-poly-v2.blend`, and isometric/front/back PNG previews.

Built in Blender from the new sheet with explicit separate parts, after the Hunyuan3D shape-only trial still produced patchy pillow segmentation. The final model is a native geometry rebuild, not the automatic Hunyuan output. The raw trial is retained in `../../generated/sofa-low-poly-v2.glb`; its rejected cleanup is `../../generated/sofa-low-poly-v2-cleanup-draft.glb`.

- 1,364 triangles, 15 meshes, four flat materials, no textures.
- Cream upholstery `#f3e4d2`, honey wood `#b87946`, caramel pillow `#bf895c`, sage pillow `#81936a`.
- Nine cream parts carry `recolor: true`; legs and pillows have independent materials.
- Catalog key `sofa`; Y-up GLB, front +Z, origin at floor center; nominal size 2.9 wide by 0.9 deep by 1.0 high.
- GLB structure checked for triangle budget, material count, absence of textures, and recolor flags. Isometric, front, and back previews reviewed for material separation.
- Integrated into `public/models/sofa.glb` on 2 October 2026 with model cache version 4. The catalog key, footprint, and procedural fallback are preserved. `tools/blender/models.json` installs this authored source when the model batch is run, avoiding the rejected automatic segmentation.

Rebuild from the project root with your installed Blender executable:

```text
blender --background --python tools/blender/build-sofa-v2.py -- --out-dir art-source/models-v2/sofa
python tools/blender/build-models.py sofa
```

Isolated source image: `../../sofa-low-poly-v2-reference.png`, generated using the built-in image tool. Prompt: extract only the first sofa from the v2 sheet; preserve three cream seat/back cushions, cream arms, honey-wood feet, caramel left pillow and sage right pillow; orthographic front-left view on white, neutral light, solid matte colors, no labels, textures, ground shadow, or neighboring objects.
