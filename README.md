# Little Nest

A cozy isometric decorating game built with Three.js and Vite.

## Project guide

These files travel with the project and let future coding sessions continue without relying on this chat:

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Instructions for future coding assistants |
| [Style guide](docs/STYLE_GUIDE.md) | Palette, art direction, HUD rules, and screenshot references |
| [Architecture](docs/ARCHITECTURE.md) | Honest assessment of the current structure and planned module boundaries |
| [Roadmap](docs/ROADMAP.md) | Development phases and completion criteria |
| [Computer handoff](docs/HANDOFF.md) | Setup on another machine, save transfer, validation, and current status |

The code is suitable for a playable prototype. The next recommended phase separates the responsibilities still combined in src/main.js and makes development checks portable. The proposed architecture is not implemented yet.

## Run

Install Node.js 20.19 or newer (23 recorded in .nvmrc), then open a terminal in the project folder:

    npm ci
    npm run dev

Open the local URL printed by Vite.

    npm run build
    npm run preview

Keep package-lock.json when moving computers. The runtime itself is browser-based and uses project-local art and assets.

## Decorating

- Browse furniture by category or search. Choose an item and click a free tile to place it; hold Shift to place several.
- Drag furniture to move it. R rotates; Delete removes; Escape cancels. Undo and redo with the toolbar arrows or Ctrl+Z and Ctrl+Shift+Z.
- Change colors on upholstery, rugs, and the marked parts of plant pots.
- Use Walls and Floor tabs to choose finishes.
- Toggle grid/walls with the left toolbar; use the camera buttons to zoom or reset.
- Right-drag to orbit and scroll to zoom.
- On phones, Browse/Hide controls the drawer. Choosing furniture hides it for placement; selecting an item opens controls in the drawer. Landscape phones use a side drawer.
- One finger moves furniture; two fingers orbit/pinch.
- Save room stores one design in this browser. Load restores it; Clear removes furniture.
- Lo-fi background music starts after the first click or tap. The music button in the top bar turns it off or on, and the choice is remembered in this browser.
- The help button explains controls. Keyboard shortcuts are inactive while typing in search.

## Design and assets

The style uses warm paneled walls, corner windows and blinds, parquet, cream seating, wood furniture, greenery, artwork, and warm lighting.

The current screenshots and original HUD concept are in [docs/design-reference](docs/design-reference). Follow the [style guide](docs/STYLE_GUIDE.md) when extending the game.

Icon artwork: [little-nest-icon.png](public/icons/little-nest-icon.png). Its exported sizes are used in the header, browser tab, and web app manifest.

## Current source

| File | Responsibility |
| --- | --- |
| src/main.js | Composition: scene setup, mesh ownership, placing flow, save/load, render loop |
| src/game/input.js | Pointer, keyboard, and touch handling |
| src/ui/hud.js, responsive.js, music.js, icons.js | HUD rendering, compact drawer behaviour, background music, SVG icons |
| src/scene/create-scene.js, geometry.js, thumbnails.js | Renderer and camera setup, material ownership, catalog previews |
| src/config/game.js | Room size, camera limits, renderer, music, and storage constants |
| src/config/theme.js | Scene palette, selectable wall/floor finishes, item colors |
| src/data/starter-room.js | The furnished living room shown on first load |
| src/game/placement.js, state.js, commands.js | Pure placement rules, committed item records with stable ids, and undoable commands |
| src/persistence/schema.js, storage.js | Saved-room format, validation, migrations, and guarded localStorage |
| tests/unit | Node unit tests for placement, state, and schema |
| tests/browser | Playwright browser checks (`npm test` runs unit and browser projects) |
| src/props.js | Furniture models, catalog, footprints, recoloring |
| src/plants.js | Snake plant, areca palm, flowering cactus, rubber tree |
| src/room.js | Room shell, textures, windows, blinds, artwork, ground shadows |
| src/styles/ | tokens, components, layout, responsive stylesheets |
| index.html | HUD markup and accessibility labels |
| public/ | Branding, manifest, background music, and bundled OFL fonts |

See [Architecture](docs/ARCHITECTURE.md) for the Phase 1 target structure.

## Validation and moving computers

Run the browser checks on any machine:

    npm run test:install   # once per machine: downloads Playwright Chromium
    npm test

The checks start the Vite dev server themselves, cover placement, drag, rotation, recoloring, save/load, search, finishes, camera, music, six baseline viewports, touch gestures, and branding, and fail on any page error. Set LITTLE_NEST_BROWSER=msedge or chrome to run against a system browser instead. The scripts in output/checks are the historical, machine-specific originals and are superseded.

Use [HANDOFF](docs/HANDOFF.md) for the manual checks, test viewport sizes, and transfer checklist. Copy docs and public assets with the source. Browser-local saved rooms must be backed up separately; exporting/importing rooms through the game UI is planned for Phase 2.
