# Architecture review

Baseline: 30 September 2026. This describes the files that exist now. The proposed structure is a plan, not an implemented refactor.

## Assessment

The separation is sensible for a small playable prototype. Art is already split into room, furniture, and plant modules. The project does not need a new framework to grow.

It is not yet a fully separated foundation for a larger game. src/main.js is approximately 485 lines and combines renderer setup, state, collision rules, pointer input, HUD logic, storage, the starter layout, and the frame loop. Phase 1 should untangle those responsibilities before adding substantial new systems.

## Current files

| File | Current responsibility |
| --- | --- |
| index.html | HUD markup and accessibility labels |
| src/main.js | Startup, scene/camera/lighting, placement state, input, HUD wiring, save/load, render loop |
| src/room.js | Room shell, procedural textures, windows, blinds, artwork, shadow receiver |
| src/props.js | Furniture models, catalog registry, material cache, furniture recoloring |
| src/plants.js | Four additional plant models, pot materials, plant catalog entries |
| src/ui.js | Small SVG icon registry and offscreen rendering of catalog thumbnails |
| src/style.css | Shared visual rules, desktop layout, compact drawers, orientation overrides |
| public/icons | Original Little Nest artwork and exported icon sizes |
| public/manifest.webmanifest | Game name, display mode, theme, and application icons |
| package-lock.json | Exact installed dependency graph |
| output/checks | Historical checks and screenshots; scripts contain this PC's runtime/browser paths |

There is no backend, account system, cloud sync, permanent object ID, undo history, automated npm test command, or multi-room save gallery today. The manifest supplies application metadata; there is no service worker or offline-cache implementation.

## What is already working

- Catalog search/categories and model-generated thumbnails.
- Grid placement, occupancy checks, dragging, quarter-turn rotation, deletion.
- Floor-layer rugs that can overlap furniture without occupying its cells.
- Wall/floor finishes and colors on marked furniture or plant-pot parts.
- Browser-local save/load with validation before clearing the live room.
- Orthographic room view, orbit/zoom, grid/wall visibility.
- Responsive selection controls and one-finger decoration / two-finger camera gestures.

## Main cleanup needs

1. Separate DOM updates from placement rules; placement should not know button IDs.
2. Move constants, palette values, and the starter room into named configuration/data modules.
3. Extract save validation and storage access from click handlers.
4. Separate UI icon helpers from thumbnail rendering; they have different dependencies and lifecycles.
5. Establish common geometry/material ownership helpers for props and plants. Review cloned lamp materials and thumbnail cleanup.
6. Organize CSS into tokens, common components, and clearly grouped responsive rules; remove obsolete brand SVG rules as a separate checked cleanup.
7. Turn the existing browser scenarios into a locally installed, portable test harness.
8. Confirm support policy for historical 10 × 10 saves. The current room is 8 × 8 and validates against its current bounds; out-of-bounds historical layouts are rejected, not migrated.

## Proposed structure after Phase 1

Introduce these incrementally, while keeping a working game after every extraction:

    src/
      main.js                    composition and startup only
      config/
        game.js                  room dimensions, camera, and lighting defaults
        theme.js                 scene palette and selectable finishes
      scene/
        create-scene.js          renderer, scene, camera, controls
        room.js                  existing room builder
        thumbnails.js            catalog previews
        geometry.js              common geometry/material ownership helpers
      catalog/
        index.js                 stable catalog registry
        furniture.js             existing furniture builders
        plants.js                existing plant builders
      game/
        state.js                 committed items and selection state
        placement.js             pure bounds, footprint, snap, occupancy rules
        commands.js              mutation boundary; history added in Phase 2
        input.js                 pointer, keyboard, touch lifecycle
      persistence/
        schema.js                validation and migration rules
        storage.js               browser storage adapter
      ui/
        hud.js                   event wiring and rendering
        responsive.js            panel state and selection docking
        icons.js                 inline SVG helpers
      data/
        starter-room.js
      styles/
        tokens.css
        components.css
        layout.css
        responsive.css
    tests/
      placement/
      persistence/
      browser/

Avoid creating empty folders before their responsibilities have been extracted. main.js should compose modules instead of becoming another collection of forwarded globals. The state/placement layer should work without Three.js or a browser DOM where possible.

## Contracts to preserve

### Catalog and model contract

Catalog entries are keyed by a stable saved type and define label, category, w, d, and build(). Optional fields are layer, tags, and defaultColor. Existing category names are seating, tables, and decor.

build() returns a THREE.Group with its origin at the center of its footprint on the floor, +Y up, and default rotation zero. Sofa fronts face +Z. Footprints are grid-cell counts; rotation swaps width/depth on odd quarter-turns.

Use userData.recolor only on intended changeable parts. Recoloring pots must not recolor soil, stems, or leaves. Do not use a visual bounding box as the collision footprint. Keep silhouettes within the footprint or deliberately define a larger footprint.

### Placement contract

Committed items currently contain type, mesh, gx, gz, rot, and color. A transient pending position is used while dragging. rot is an integer 0–3; each step is 90 degrees.

Ordinary furniture cannot overlap occupied cells or exceed room bounds. Floor-layer items can overlap ordinary furniture. Temporarily free the dragged item's own cells, then either commit a valid new position or restore its old transform. Finish a move once, even if capture is lost or an interaction is canceled.

Future state should store serializable item data separately from mesh references. Add stable item IDs when introducing history, relationships, and surface placement.

### Save contract

Storage key: home-deco-sim:room. Current writer:

    {
      "version": 2,
      "wall": 9597532,
      "floor": 14918514,
      "items": [
        { "type": "armchair", "gx": 6, "gz": 3, "rot": 3, "color": 8491882 }
      ]
    }

The example shows the shape; colors are numeric 24-bit RGB values. There are no room names, room dimensions, parent IDs, or save-slot IDs in this format.

The current loader accepts matching legacy-shaped data without a version field and does not dispatch validation by schema version. Phase 1 should make version handling explicit without losing valid existing saves. Current checks include known types, integer coordinates/rotation, bounds, collisions, optional color ranges, and at most 200 items.

Browser storage belongs to a browser profile and origin. The project directory does not contain these saves.

### Input and responsive contract

One finger moves furniture. Two fingers orbit/pinch; a second pointer ends the pending drag and suppresses object movement. Selection-panel changes are deferred until gestures finish.

Pointer capture, cancellation, keyboard focus, and browser resize must preserve valid committed state. Search input must not trigger R/Delete shortcuts. Keep the JavaScript compact-screen query and CSS breakpoints synchronized.
