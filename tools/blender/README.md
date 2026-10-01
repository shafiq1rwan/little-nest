# Blender prop library

Build all 48 props described in [PROP_BRIEFS](../../docs/PROP_BRIEFS.md) without an image-to-3D service. This first library reconstructs the existing procedural catalog as editable Blender mesh parts; it is a compatible starting point for art refinement, not a newly sculpted redesign of each prop.

## Rebuild

Run from the repository root after `npm ci` and `npm run test:install`:

```sh
node tools/blender/export-catalog.mjs
blender --background --python tools/blender/build-library.py -- --output output/blender --render
node tools/blender/check-exports.mjs
python tools/blender/contact-sheet.py
```

Resolve the installed Blender executable locally if `blender` is not on PATH. The last step requires Pillow (`python -m pip install Pillow`); Blender renders do not require it. Omit `--render` to skip previews. All scripts accept an output directory (the Blender script uses `--output`). Generated files stay in `output/blender`, outside the production game assets.

## Files

- `little-nest-props.blend`: full library, one named collection and root per catalog key, separate editable parts and materials. Models are arranged in eight columns at their real sizes.
- `glb/<key>.glb`: individual, origin-zero, Y-up exports with non-destructive decimation applied. No textures, cameras, or preview lights.
- `previews/<key>.png`, `contact-sheet.jpg`: individually framed Blender Workbench previews of the export modifiers; models are not shown to scale on the sheet.
- `catalog-source.json`: captured mesh geometry and catalog contracts.
- `build-report.json`, `validation.json`: source/export triangle counts and Three.js re-import checks.

## Reference refinement (1 October 2026)

The revised library is [output/blender-reference/little-nest-props.blend](../../output/blender-reference/little-nest-props.blend), with all 48 editable props, individual GLBs and renders. The original library in `output/blender` is retained. Compare the [actual Blender contact sheet](../../output/blender-reference/contact-sheet.jpg) with the [48-prop concept sample](../../output/imagegen/little-nest-48-props-sample.png).

Reproduce the refinement from the current catalog:

```sh
node tools/blender/export-catalog.mjs output/blender-reference
blender --background --python tools/blender/build-library.py -- --output output/blender-reference --reference --render
node tools/blender/check-exports.mjs output/blender-reference
blender --background output/blender-reference/little-nest-props.blend --python tools/blender/check-library.py
python tools/blender/contact-sheet.py output/blender-reference
```

`refine-reference.py` supplies native mesh edits: split monstera outlines, rosette succulent leaves, tiered bonsai foliage, leafy flowering planter clumps, hanging cords/vines, rounded vase, flared table pedestal, basket weave/draped blanket, book covers/pages, TV-console drawers, pouf seams, ottoman piping and caramel color, and cabinet/cardboard reveals. All 48 receive planar topology cleanup and angle-aware normals; qualifying wooden parts receive small secondary bevels. Established furniture silhouettes are retained where they already fit the concept.

Reference previews use Cycles, soft area lights, AgX and a shadow catcher. PNGs have transparency; the contact sheet composites them over cream. Preview objects are excluded from GLBs. Triangle budgets still apply to the actual exported geometry. The checker also compares exported root contracts to the captured catalog and limits expansion beyond the original bounds to less than 0.06 units.

The concept is art guidance rather than an exact replacement specification: the nightstand retains its one-drawer design, the dresser has four cream drawer fronts, and framed canvases remain blank for future game artwork. Surface slot coordinates/order, wall footprints, catalog keys, material roles, and origins are retained. This revision updates Blender deliverables; runtime GLB integration remains a separate task.

## Edit and export

Blender is Z-up: game `(x,y,z)` becomes Blender `(x,-z,y)`. Front is Blender **-Y**. One metre equals one game cell. Library root offsets are for browsing only: set the chosen root's location to `(0,0,0)` before exporting. Select the root and all children, then export GLB with Selected Objects, +Y Up, Apply Modifiers, and Custom Properties enabled.

Recolorable objects retain `recolor = true`; materials are isolated per prop and named `<key>.recolor.<hex>`. Keep those separate from fixed decoration. `glow` and `canvas` materials are named separately. Framed-print canvases are blank as requested in the briefs. Preview materials are flat colors, with no generated textures.

Each root's `contract` property records stable catalog key, footprint, surface slot order, wall size, and lamp status. Surface coordinates in that JSON remain in **game coordinates**. Decimation modifiers preserve source geometry: turn them off while refining, and check the exported silhouette when enabling them again.

## Integration status

The game still uses `src/props.js` and `src/plants.js`. The generated GLBs are asset deliverables, not a runtime replacement. Integration needs a loading/cache path, application of game print textures to the blank canvases, restoration of lamp point lights and switching behavior, material disposal ownership, and catalog thumbnail invalidation. The `recolor` extras are preserved for that future importer. Do not replace `build()` with asynchronous loading without updating its synchronous contract.

Blender API references: [glTF export options](https://docs.blender.org/api/main/bpy.ops.export_scene.html), [mesh cleanup operations](https://docs.blender.org/api/5.1/bmesh.ops.html).
