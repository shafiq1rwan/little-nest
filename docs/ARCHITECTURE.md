# Architecture review

Baseline: 30 September 2026. This describes the files that exist now. The proposed structure is a plan, not an implemented refactor.

## Assessment

The separation is sensible for a small playable prototype. Art is already split into room, furniture, and plant modules. The project does not need a new framework to grow.

It is not yet a fully separated foundation for a larger game. src/main.js is approximately 485 lines and combines renderer setup, state, collision rules, pointer input, HUD logic, storage, the starter layout, and the frame loop. Phase 1 should untangle those responsibilities before adding substantial new systems.

## Current files

| File | Current responsibility |
| --- | --- |
| index.html | HUD markup and accessibility labels |
| src/main.js | Composition: scene/camera/lighting setup, mesh ownership, placing/drag/rotate flow, and wiring of the modules below (about 375 lines) |
| src/game/input.js | Pointer, keyboard, and touch lifecycle; raycasting; emits move/down/up/secondTouch/key |
| src/ui/hud.js | Toast, catalog cards and filtering, tabs, finish swatches, selection card rendering |
| src/ui/responsive.js | Compact media query, drawer expand/collapse, selection card docking |
| src/ui/music.js | Background music with gesture unlock and remembered mute |
| src/config/game.js | ROOM, CELL, WALL_H, CAMERA, RENDER, MUSIC, storage keys, save version and item cap |
| src/config/theme.js | Backdrop and highlight colors, WALL_FINISHES, FLOOR_FINISHES, ITEM_COLORS |
| src/data/starter-room.js | STARTER_ROOM item list |
| src/game/placement.js | Pure footprint, bounds, occupancy, snap, and world-position rules (no Three.js, no DOM) |
| src/game/state.js | Committed item records with stable ids; occupancy derived from them (no Three.js, no DOM) |
| src/game/commands.js | Undoable mutations over state and finishes; emits add/remove/transform/color/finish/history events; capped history (no Three.js, no DOM) |
| src/persistence/schema.js | Saved-room format, validation, and version migrations |
| src/persistence/storage.js | Guarded localStorage adapter |
| tests/unit | Node unit tests for placement, state, and schema |
| tests/browser | Playwright specs and helpers; playwright.config.js starts the dev server |
| src/room.js | Room shell, procedural textures, windows, blinds, artwork, shadow receiver |
| src/props.js | Furniture models and catalog registry (materials via scene/geometry.js) |
| src/plants.js | Four additional plant models, pot materials, plant catalog entries |
| src/scene/create-scene.js | Renderer, orthographic camera, orbit controls, lighting, resize, zoom and reset helpers |
| src/scene/geometry.js | Shared material cache, owned-material rule, recolor, tint, dispose, measure |
| src/scene/thumbnails.js | Offscreen catalog previews, disposed through geometry.js |
| src/ui/icons.js | Inline SVG icon registry |
| src/styles/ | index.css imports tokens.css (fonts and colors), components.css, layout.css (desktop), responsive.css (compact and landscape) |
| public/fonts | Bundled OFL fonts (Gelasio, Source Sans 3) with licences; system Segoe UI and Georgia stay first in the stacks |
| public/icons | Original Little Nest artwork and exported icon sizes |
| public/manifest.webmanifest | Game name, display mode, theme, and application icons |
| package-lock.json | Exact installed dependency graph |
| output/checks | Historical Codex checks and screenshots, superseded by tests/browser |

There is no backend, account system, cloud sync, undo history, or multi-room save gallery today. `npm test` runs the portable browser checks. The manifest supplies application metadata; there is no service worker or offline-cache implementation.

## What is already working

- Catalog search/categories and model-generated thumbnails.
- Grid placement, occupancy checks, dragging, quarter-turn rotation, deletion.
- Floor-layer rugs that can overlap furniture without occupying its cells.
- Wall/floor finishes and colors on marked furniture or plant-pot parts.
- Browser-local save/load with validation before clearing the live room.
- Orthographic room view, orbit/zoom, grid/wall visibility.
- Responsive selection controls and one-finger decoration / two-finger camera gestures.

## Main cleanup needs

1. Done (30 September 2026): placement rules and state are pure; input and HUD live in their own modules and call back into main.js for decisions.
2. Done (30 September 2026): constants, palette values, and the starter room live in src/config and src/data.
3. Done (30 September 2026): src/persistence/schema.js and storage.js; click handlers only call them.
4. Done (30 September 2026): src/ui/icons.js and src/scene/thumbnails.js.
5. Done (30 September 2026): src/scene/geometry.js; the lamp shade clone is owned and disposed; thumbnails dispose through the same helper.
6. Done (30 September 2026): src/styles split into tokens, components, layout, responsive. The obsolete .brand svg rules were removed in the same pass and checked against the baseline screenshots.
7. Done (30 September 2026): tests/browser holds the scenarios as Playwright specs with a project-local runner.
8. Confirm support policy for historical 10 × 10 saves. The current room is 8 × 8 and validates against its current bounds; out-of-bounds historical layouts are rejected, not migrated.

## Proposed structure after Phase 1

Introduce these incrementally, while keeping a working game after every extraction. Everything below exists:

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

Committed items are records { id, type, gx, gz, rot, color } owned by src/game/state.js. Meshes are kept in a Map keyed by id in main.js and every mesh carries userData.itemId. Ids are short random strings, assigned on add or preserved from a save. A transient drag target is held in main.js while dragging. rot is an integer 0–3; each step is 90 degrees.

Ordinary furniture cannot overlap occupied cells or exceed room bounds. Floor-layer items can overlap ordinary furniture. All mutations from the HUD and input go through src/game/commands.js (add, remove, move, rotate, recolor, setFinish, clear, replaceRoom), which validates through state, refuses invalid results without touching occupancy, and records one history entry per command. A completed drag is one move command; pointer moves only preview. main.js mirrors command events onto meshes and materials, so undo and redo need no scene-specific code. The starter layout is built through commands and then the history is cleared.

Item ids are the handle undo history uses; a removed item comes back with the same id on undo. Export and parent/surface relationships should use them too.

### Save contract

Storage key: home-deco-sim:room. Current writer (src/persistence/schema.js, version 3):

    {
      "version": 3,
      "wall": 9597532,
      "floor": 14918514,
      "items": [
        { "id": "i4k2x9qz", "type": "armchair", "gx": 6, "gz": 3, "rot": 3, "color": 8491882 }
      ]
    }

The example shows the shape; colors are numeric 24-bit RGB values. There are no room names, room dimensions, parent IDs, or save-slot IDs in this format.

parseRoom migrates by version before validating: saves with no version or version 2 (no ids) are read as version 3 and each item receives a fresh id; unknown versions are rejected. Validation covers known types, integer coordinates/rotation, bounds, collisions, optional color ranges, string ids (duplicates are replaced), and at most 200 items. Add a new version and a migration step in schema.js before changing the shape again.

Browser storage belongs to a browser profile and origin. The project directory does not contain these saves.

### Input and responsive contract

One finger moves furniture. Two fingers orbit/pinch; a second pointer ends the pending drag and suppresses object movement. Selection-panel changes are deferred until gestures finish. src/game/input.js owns pointer counting, capture, and raycasting and emits semantic callbacks; main.js decides what they mean.

Pointer capture, cancellation, keyboard focus, and browser resize must preserve valid committed state. Search input must not trigger R/Delete shortcuts. Keep the JavaScript compact-screen query and CSS breakpoints synchronized.
