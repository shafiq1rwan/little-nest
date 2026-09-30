# Phased development roadmap

Baseline: 30 September 2026. Phase 0 exists today. Phases 1–6 below are planned and have not been implemented by writing this roadmap.

Keep the Little Nest style guide and existing saves intact through every phase. Work in small, reviewable increments and stop adding scope when that phase's completion criteria are met.

| Phase | Focus | Status | Dependency |
| --- | --- | --- | --- |
| 0 | Playable visual baseline | Implemented; documented | None |
| 1 | Structure and portable development | Complete 30 September 2026 | Phase 0 |
| 2 | Safe creative workflow | In progress: undo/redo and named saves done 30 September 2026 | Phase 1 |
| 3 | Richer decorating | Planned | Phase 2 |
| 4 | More rooms and furniture collections | Planned | Phase 3 |
| 5 | Lighting and atmosphere | Planned | Phase 4 |
| 6 | Optional challenges and sharing | Optional backlog | Stable earlier phases |

## Phase 0 — preserve the current game

Delivered: Little Nest branding/icon; furnished isometric room; furniture and five plant choices; finish/recolor controls; grid placement/drag/rotate/delete; save/load; desktop and compact HUD; touch controls.

Documentation delivered: root AGENTS.md, architecture review, style guide with current screenshots, this roadmap, and computer handoff guide.

Limits: one saved room in one browser origin; no undo, room gallery, export/import UI, photo mode, surface stacking, editable wall decorations, or portable test runner.

## Phase 1 — structure and portable development

Goal: make the code easier to extend on any computer without changing the game's appearance or gameplay.

Small steps:

1. Done: portable browser-check harness in tests/browser with @playwright/test as a devDependency, `npm test`, and `npm run test:install`. All Codex scenarios were ported and pass.
2. Done: src/config/game.js, src/config/theme.js, and src/data/starter-room.js.
3. Done: src/game/placement.js and src/game/state.js are pure and unit-tested; items carry stable ids and version 2 saves migrate on load.
4. Done: src/game/input.js owns the gesture lifecycle and raycasting; main.js keeps the pending-selection decision.
5. Done: src/persistence for saves (legacy key kept); src/ui/hud.js, responsive.js, and music.js for the HUD.
6. Done: src/scene/thumbnails.js and src/scene/geometry.js; scene setup also moved to src/scene/create-scene.js.
7. Done: src/styles/{tokens,components,layout,responsive}.css; breakpoints unchanged.
8. Done: package.json engines and .nvmrc pin Node 20.19+ (23 recorded); Gelasio and Source Sans 3 (OFL) are bundled as fallbacks behind Georgia and Segoe UI, so Windows rendering is unchanged and other systems get matching metrics.

Completion criteria:

- main.js composes well-defined modules; game rules are independent of DOM updates.
- The fresh-clone setup and test instructions work without this PC's paths.
- Stable catalog IDs and existing valid version-2 saves still load.
- Placement, dragging, rotation, recoloring, save/load, keyboard focus, drawer behavior, and touch gestures pass.
- Desktop, phone, tablet, and landscape screenshots retain the established identity.
- Geometry and material ownership is explicit, with no disposal of shared live materials.
- ARCHITECTURE and HANDOFF describe the new implemented structure.

Scope: cleanup and preservation. New gameplay features belong to subsequent phases.

## Phase 2 — safe creative workflow

Goal: let players experiment, keep several designs, and move their creations between computers.

Deliver:

- Done (30 September 2026): undo/redo for placement, move, rotate, recolor, finish changes, deletion, clear, and load, with toolbar buttons and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
- Done (30 September 2026): named room saves in a "Your rooms" dialog with load, rename, duplicate, and two-step delete; the pre-gallery save is imported once.
- JSON export/import with schema validation and version migrations.
- Photo mode: hide the HUD, choose a view, export an image, then restore normal controls.
- Visible save/export feedback, including quota or invalid-import failures.

Dependencies: stable item IDs, explicit commands/state, and portable validation from Phase 1. Treat a completed drag as one history entry; do not record every pointer move.

Completion criteria:

- A saved room exports from one browser and imports into another with the same layout, finishes, and colors.
- Current single-room saves migrate without being silently erased.
- Undo/redo restores collision occupancy as well as visuals.
- Invalid imports leave the live room and stored rooms unchanged.
- Photo export restores the HUD/camera state after completion or failure.
- Gallery, history, and photo controls work with the compact drawer and touch.

This is the first feature milestone worth prioritizing after cleanup.

## Phase 3 — richer decorating

Goal: make detailed room composition possible.

Deliver:

- Surface placement for plants, books, and small objects on supported tables/shelves.
- Wall-mounted pictures, shelves, and other decorations.
- Item duplicate and optional finer placement/snapping.
- More distinctive plant and decor models using the current palette.
- Parent/surface relationships represented in saved data.

Completion criteria:

- Moving or deleting a supporting object handles its children predictably.
- Placement validates the correct surface or wall, not only the floor grid.
- Undo, save/load, and export/import preserve surface and wall relationships.
- Decorations remain pickable and controllable on small screens.
- New models use valid footprints and compatible thumbnails.

## Phase 4 — room presets and furniture collections

Goal: offer more creative settings without turning the interface into a list of unrelated features.

Deliver:

- Bedroom, studio, reading corner, and balcony presets.
- Configurable room dimensions, walls, and window layouts.
- Cohesive furniture collections such as Japandi, cottage, and modern.
- Useful catalog filtering as content grows.

Completion criteria:

- Each room preset has its own valid starter layout and camera framing.
- Room dimensions and preset identity are saved and migrated.
- UI text, thumbnails, lighting, and controls remain consistent between presets.
- Every collection is distinct but still belongs to the Little Nest visual language.

## Phase 5 — atmosphere

Goal: give finished rooms different moods.

Deliver:

- Morning, sunset, and evening light presets.
- Individual lamp toggles.
- Optional ambient audio with mute and retained preferences. (Background music with a remembered mute toggle was added early, on 30 September 2026; per-lamp audio or sound effects remain here.)
- Performance improvements based on measured scene cost.

Completion criteria:

- Saved room lighting restores reliably.
- Each lighting preset remains readable with the cream/sage HUD and on small screens.
- Increased content does not make catalog previews or interaction unresponsive.
- Any quality settings preserve the cozy style instead of removing all detail.

## Phase 6 — optional goals and sharing

Goal: provide gentle reasons to revisit, if this fits the desired direction.

Possible work:

- Optional decorating briefs: a tiny studio, a plant-filled reading nook, a cozy guest room.
- Progress/unlocks that leave free decorating available.
- Shareable designs or a curated community gallery.

Accounts, backend storage, moderation, and online sharing need a separate scope and technical plan. They are not assumed requirements of earlier phases. Timers, daily rewards, currencies, and monetization remain outside the baseline unless requested.

## How to start a phase

Give a future coding session the phase name and a concrete first increment, for example:

> Read AGENTS.md and the project docs. Begin Phase 1 by making the existing browser scenarios portable. Preserve the Little Nest style, compact HUD behavior, and current room saves. Record what changed and what remains in HANDOFF.

Update phase status only after its completion criteria are met. Finishing one increment does not mean the entire phase is complete.
