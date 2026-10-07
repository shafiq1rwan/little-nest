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

- Browse furniture by category, by collection (Nest classics, Japandi, Cottage), or search. Choose an item and click a free tile to place it; hold Shift to place several. Small items (the Small category) go on tables and shelves: point at the surface and a preview snaps to a free spot. They move and rotate with the furniture they sit on. Wall decorations (the Wall category) hang on the two walls: point at a clear stretch of wall and they snap to it; windows and spots behind furniture are refused. The wall shelf holds small items too.
- Drag furniture to move it. R rotates; Delete removes; Copy or Ctrl+D duplicates into the nearest free spot; Escape cancels. Undo and redo with the toolbar arrows or Ctrl+Z and Ctrl+Shift+Z.
- Change colors on upholstery, rugs, and the marked parts of plant pots.
- Use Walls and Floor tabs to choose finishes, and the Light tab to pick Morning, Sunset, or Evening. Lamps have an On/Off switch on their card and glow brighter as the light fades.
- Toggle grid/walls with the left toolbar; use the camera buttons to zoom or reset. The camera button opens photo mode: the controls hide, you frame the view, and Save photo downloads a PNG.
- Right-drag to orbit and scroll to zoom.
- The HUD is a few quiet pieces around the room: a top-right bar (Rooms, Save, a More menu, Hide HUD), a floating Decorate card, and a bottom dock (Decorate, Undo, Redo, grid, View with the camera tools). On phones the Decorate card is a bottom sheet with the dock along its foot; choosing furniture lowers it for placement and selecting an item shows its actions there. Landscape phones use a side drawer.
- One finger moves furniture; two fingers orbit/pinch.
- Save room keeps the open room in this browser (the first save is named "Living room"). Rooms also offers "Start fresh" presets: living room, studio, reading nook, bedroom, an open-air balcony, and a 10 × 8 apartment with its own walled, tiled bathroom, each with its own size, windows, and furniture; starting one is undoable. Rooms opens your saved designs to load, rename, duplicate, export, or delete them, to import a room file, and to save the current room under a new name. Clear removes furniture.
- The game opens on a main menu over the live room: Start decorating, My rooms, and Settings. The Menu button in the top-right capsule returns to it.
- Lo-fi background music starts after the first click or tap. The music button in the top bar, or Settings on the menu, turns it off or on, and the choice is remembered in this browser.
- The help button explains controls. Keyboard shortcuts are inactive while typing in search.

## Credits

Little Nest is made by Saiss. Sound effects are from Kenney's CC0 audio packs (see public/audio/sfx/SOURCES.md), the Modern home collection is Kenney's CC0 Furniture Kit, recoloured, and the residents are Kenney's CC0 Mini Characters. Music: "Lofi Dreams" (lofi jazz music) from Pixabay under the Pixabay Content License. Fonts: Fredoka, Gelasio, and Source Sans 3 under the SIL Open Font License 1.1 (see public/fonts). Built with Three.js and Vite (MIT). The in-game Credits screen is reachable from the main menu.

## Design and assets

The style uses warm paneled walls, corner windows and blinds, parquet, cream seating, wood furniture, greenery, artwork, and warm lighting.

The current screenshots and original HUD concept are in [docs/design-reference](docs/design-reference). Follow the [style guide](docs/STYLE_GUIDE.md) when extending the game. The [48-prop concept sheet](art-source/prop-sheet.png) is the target look for modelled props.

[Prop briefs](docs/PROP_BRIEFS.md) describe every catalog model and the pipeline from concept sheet to game-ready glb. Twelve catalog items preload GLB models with procedural fallbacks; the sofa uses the [authored v2 model](art-source/models-v2/sofa/README.md) with separate upholstery, pillow, and leg materials.

The header uses a text-only Little Nest wordmark in bundled Fredoka Semibold. [Icon artwork](public/icons/little-nest-icon.png) supplies the browser tab and web app manifest icons.

## Current source

| File | Responsibility |
| --- | --- |
| src/boot.js, src/ui/screens.js | Loading screen, main menu, and settings; boot.js is the entry point |
| src/main.js | initializeGame(): scene setup, mesh ownership, placing flow, save/load, render loop |
| src/game/input.js | Pointer, keyboard, and touch handling |
| src/ui/hud.js, responsive.js, music.js, icons.js, gallery.js | HUD rendering, compact drawer behaviour, background music, SVG icons, rooms dialog |
| src/scene/create-scene.js, geometry.js, thumbnails.js | Renderer and camera setup, material ownership, catalog previews |
| src/config/game.js | Room size, camera limits, renderer, music, and storage constants |
| src/config/theme.js | Scene palette, selectable wall/floor finishes, item colors |
| src/data/presets.js | Room presets: size, windows, door, interior partitions and floor zones, and the starter layout for each |
| src/data/collections.js | Furniture collections (Nest classics, Japandi, Cottage) |
| src/data/lighting.js | Lighting moods (Morning, Sunset, Evening) |
| src/game/placement.js, state.js, commands.js | Pure placement rules, committed item records with stable ids, and undoable commands |
| src/persistence/schema.js, storage.js, gallery.js, transfer.js | Saved-room format, validation, migrations, guarded localStorage, named room gallery, room file export/import |
| tests/unit | Node unit tests for placement, state, and schema |
| tests/browser | Playwright browser checks (`npm test` runs unit and browser projects) |
| src/props.js | Furniture models, catalog, footprints, recoloring |
| src/plants.js | Snake plant, areca palm, flowering cactus, rubber tree, monstera, Boston fern |
| src/props.js (SMALL_CATALOG) | Mug, candle, book stack, succulent, photo frame, vase, lantern |
| src/props.js (WALL_CATALOG) | World map, botanical print, wall shelf, round mirror, wall clock, hanging plant |
| src/room.js | Room shell, textures, windows, blinds, artwork, ground shadows |
| src/styles/ | tokens, components, layout, responsive stylesheets |
| index.html | HUD markup and accessibility labels |
| public/ | Branding, manifest, background music, and bundled OFL fonts |

See [Architecture](docs/ARCHITECTURE.md) for the Phase 1 target structure.

## Validation and moving computers

Run the browser checks on any machine (and `npm run bench` for the opt-in performance numbers):

    npm run test:install   # once per machine: downloads Playwright Chromium
    npm test

The checks start the Vite dev server themselves, cover placement, drag, rotation, recoloring, save/load, search, finishes, camera, music, six baseline viewports, touch gestures, and branding, and fail on any page error. Set LITTLE_NEST_BROWSER=msedge or chrome to run against a system browser instead. The scripts in output/checks are the historical, machine-specific originals and are superseded.

Use [HANDOFF](docs/HANDOFF.md) for the manual checks, test viewport sizes, and transfer checklist. Copy docs and public assets with the source. Saved rooms live in the browser; use Rooms → Export and Import to move them between machines.
