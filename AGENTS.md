# Little Nest — instructions for future coding sessions

This file travels with the project. Read it before editing this repository; do not rely on the history of a previous chat or on a previous computer's paths.

## Read first

1. [README.md](README.md) — how to run the game and where to start. ([CLAUDE.md](CLAUDE.md) holds Claude-specific working notes and defers to this file.)
2. [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) — visual identity, room art, and HUD behavior.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current structure, contracts, and planned module boundaries.
4. [docs/ROADMAP.md](docs/ROADMAP.md) — phased work and completion criteria.
   - [docs/PROP_BRIEFS.md](docs/PROP_BRIEFS.md) — per-prop descriptions for concept art and external 3D modelling; keep in sync with the catalog.
5. [docs/HANDOFF.md](docs/HANDOFF.md) — moving computers, validation, and current project status.

The user's latest explicit instructions take precedence over these guidelines. These files preserve the baseline; they are not a reason to ask for approval for routine work. When the user deliberately changes the design or scope, implement that request and update the relevant documentation.

## Product and visual baseline

- The product name is Little Nest. Keep title, header, icons, and manifest consistent.
- Preserve the cozy isometric room: warm wood, cream upholstery, sage plants, terracotta accents, soft lighting, rounded furniture, and readable silhouettes.
- Keep the current room editable in 3D. A mockup or background image is not a replacement for playable geometry.
- Use the actual game screenshots in docs/design-reference as the current visual baseline. hud-concept.png is the original artistic direction, not an exact description of the current renderer.
- Extend existing native geometry, icons, and CSS where practical. Keep new furniture visually compatible with existing pieces.
- Preserve desktop and compact HUD behavior. Compact means width <= 900px OR height <= 600px; see STYLE_GUIDE for orientation rules.
- Keep selected-item controls outside the room on compact screens. Do not resize the canvas in the middle of a drag or pinch.
- Keep important touch actions at least 44px in each dimension. Existing 40px category chips are a baseline exception, not a target for new controls.
- Avoid adding timers, currency, daily rewards, accounts, or monetization unless requested.

## Implementation

- The app uses vanilla JavaScript ES modules, Three.js, and Vite. Do not introduce a framework or replace the build system as incidental cleanup. The entry point is src/boot.js; main.js exports initializeGame() and must stay importable after the loading screen has painted.
- Materials: get shared ones from sharedMaterial() in src/scene/geometry.js and never dispose them; give a mesh its own material only through ownMaterial() so disposeModel() can release it. Models are merged per material by compactModel() when placed: flag parts that must stay separate with userData.recolor or an owned material.
- Rendering is on demand: anything that changes what the scene looks like outside the commands/input/camera paths must call invalidate() in main.js, or the change will not be drawn until the next interaction.
- Before performance work, run `npm run bench` and record before/after numbers in HANDOFF.
- Styles: add colors and fonts as tokens in src/styles/tokens.css; desktop rules go in layout.css and compact/landscape overrides in responsive.css. Keep COMPACT_QUERY in src/ui/responsive.js equal to the compact media query.
- main.js is still the prototype coordinator. Phase 1 extracts responsibilities in small steps. So far src/config (game and theme constants) and src/data (starter room) exist; the other proposed folders do not yet.
- Put new constants in src/config and new preset layouts in src/data rather than inline in main.js.
- Placement rules, room state, and the saved-room schema live in src/game and src/persistence. Keep those modules free of Three.js and DOM so tests/unit can run them in Node. Change saved data only by adding a version and a migration in schema.js.
- Put new plant models in src/plants.js and other furniture in src/props.js until the catalog split is implemented. A catalog entry may name a `model` glb in public/models; its build() must still return synchronously, falling back to procedural geometry (see docs/PROP_BRIEFS.md). Bump MODELS_VERSION in src/config/game.js when a model file changes.
- Keep catalog keys stable: they are stored in saved rooms. Add migrations before renaming or removing keys. Surface slot indexes are stored too: append new slots rather than reordering existing ones. Wall fixtures (windows, lights) are declared in room.js; changing them changes which wall cells are blocked, so check saved rooms still load.
- Keep localStorage keys home-deco-sim:room (legacy single save, imported once) and home-deco-sim:rooms (gallery) for compatibility. The brand name is different intentionally.
- Validate imported/saved room data before replacing the current scene.
- Keep one source of truth for committed placement state; derive occupancy and mesh transforms from it. Mutate the room only through src/game/commands.js so every change is undoable; add a command there rather than calling state directly from the HUD or input.
- Dispose geometry and individually owned materials when removing models. Do not dispose cached materials shared by live objects.
- Use project-relative asset paths. Do not embed a computer's user directory or Codex cache path in production code, setup, or future portable tests.
- Preserve package-lock.json. Dependency upgrades are separate, intentional changes.

## Validation and finishing

For gameplay or visual changes, run npm run build and npm test (Playwright, project-local; run npm run test:install once per machine). Add or extend a spec under tests/browser when you add a scenario. For documentation-only changes, check links, paths, and factual consistency; a gameplay test run is not required.

Check relevant desktop, phone, tablet, and landscape states. Capture images when a visual change needs review. The scripts in output/checks are historical, machine-specific originals superseded by tests/browser.

Update docs when an implementation changes a documented contract, design rule, or phase status. Record what changed, what was checked, and what remains in HANDOFF. Only mark a roadmap phase complete when its completion criteria are met.
