# CLAUDE.md — Little Nest

Little Nest is a cozy isometric room-decorating game (vanilla JS, Three.js, Vite) that is being prepared for sale, desktop first via Electron, then itch.io and later Steam. Both Claude and Codex work in this repository.

## Read first

[AGENTS.md](AGENTS.md) is the shared contract for every coding assistant and takes precedence over this file. It links the docs in reading order: README, STYLE_GUIDE, ARCHITECTURE, ROADMAP, HANDOFF. Read HANDOFF's "Current handoff" list before starting work; it says what was done last and what is next.

## Commands

    npm run dev          # Vite dev server
    npm run build        # production build (a bundle-size advisory is expected, not a failure)
    npm test             # Playwright: unit project (Node) + browser project (headless Chromium, software WebGL)
    npm run test:install # once per machine: downloads Playwright's Chromium
    npm run bench        # opt-in performance numbers; compare before/after, never absolute

Run `npm run build` and `npm test` before every commit that touches src/. Documentation-only changes need a link and fact check, not a test run.

## How the code is organised

- `src/boot.js` is the entry point: loading screen → imports `src/main.js` (exports `initializeGame`) → hands the API to `src/ui/screens.js` (menu, settings, credits).
- `src/main.js` is composition. Game rules live in `src/game/` (placement, state, commands, input) and persistence in `src/persistence/` (schema, storage, gallery, transfer); those stay free of Three.js and DOM so `tests/unit` runs them in Node.
- Every room mutation goes through `src/game/commands.js` so it is undoable. Never call `state` directly from the HUD or input.
- Rendering is on demand. Any change to what the scene looks like that does not go through commands, input, or the camera must call `invalidate()` in main.js or it will not be drawn.
- Models are merged per material by `compactModel()` when placed. Parts that must stay separate carry `userData.recolor` or an owned material.
- Data lives in `src/data/` (presets, collections, lighting) and constants in `src/config/`.
- Saved rooms are versioned (currently 7). Change the shape only by adding a version and a migration in `src/persistence/schema.js`, and keep catalog keys, surface slot order, and preset keys stable.

## Working conventions learned here

- Catalog counts in tests: searching "plant" matches tags, and category chips count entries, so adding a tagged item changes expectations in `game.spec`, `hud.spec`, `plants.spec`, `surfaces.spec`, `walls.spec`, and `collections.spec`. Update them deliberately.
- Browser tests enter the game through `openGame()` in `tests/browser/helpers.js`, which clicks the menu's Start button and waits for the loading fade. Use `openGame(page, '/', { enter: false })` to test the menu itself.
- Playwright clears `tests/output` at the start of each run. Capture screenshots after tests, or into the scratchpad, not before a run you still need.
- Ad hoc screenshot scripts must live inside the project (Playwright resolves from the script's location) and use a port other than 5173. Delete them afterwards and stop any Vite server they started.
- Playwright contexts start with empty storage, so caches (thumbnails) only show on a reload inside one test.
- When editing `src/main.js` from a shell, never put `$('id')` inside a double-quoted string; bash expands it. Use the Edit tool or single quotes.
- `buildShell()` runs before `state` exists at startup; anything it calls must guard with `lampsReady`.
- A surface slot or wall spot the default camera cannot see is unusable, because placement raycasts what is under the pointer. Keep slots in visible places.
- Compact screens (width ≤ 900px or height ≤ 600px) keep 44px touch targets. Desktop controls are deliberately smaller; see STYLE_GUIDE.
- Modelled props: `art-source/generated/<key>.glb` is raw image-to-3D output (ignored), `public/models/<key>.glb` is game-ready (tracked). `tools/blender/clean-generated.py` converts one to the other; the catalog entry gets `model:` plus a `modelInstance(key) || procedural` build. Bump `MODELS_VERSION` after re-exporting a file. Blender 5.2 is at `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe` on this machine. Three.js strips dots from glTF node names, so part objects use underscores.
- The author credit is "Saiss". The music is "Lofi Dreams" from Pixabay; fonts are OFL and bundled in `public/fonts` with their licences.

## Commits

Small, verified increments on `main`, one feature or fix per commit, with a body that lists what changed and the test count. End commit messages with the attribution line the session provides. Update HANDOFF with a dated entry whenever a documented contract, design rule, or phase status changes.

## What is next

See the "Next recommended work" line at the end of HANDOFF's status section. Phases 7–12 are planned in docs/ROADMAP-2.md; Phase 7 (finish the core loop) starts with the mode-pill placement controls, then pillows as items and curtains.
