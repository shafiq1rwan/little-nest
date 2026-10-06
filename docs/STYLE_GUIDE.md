# Little Nest style guide

Status: current visual baseline, 1 October 2026. Keep this file and its reference images with the project when changing computers.

## Identity

Little Nest is a calm room-decorating sandbox: warm, personal, tactile, and easy to experiment with. The room is the main attraction; the HUD supports decorating without dominating the scene.

Use Little Nest consistently in the page title, desktop/phone headers, manifest, and player-facing text. The current storage key retains the old name solely for save compatibility.

The HUD brand is a text-only Little Nest wordmark in bundled Fredoka Semibold. It has no image logo. The existing [little-nest-icon.png](../public/icons/little-nest-icon.png) supplies browser-tab and installed-app icons.

## Reference order

1. This guide specifies the design intent and layout rules.
2. The current game images below show the implemented baseline.
3. [Original HUD concept](design-reference/hud-concept.png) shows the art direction.
4. [Room inspiration 1](../reference-1.jpg) and [room inspiration 2](../reference-2.jpg) supply the original cozy isometric references.

The generated HUD concept is more detailed than the live procedural room. Match the game's established visual language when extending it; do not substitute a flat image for editable models.

| Current state | Reference |
| --- | --- |
| Desktop, 1440 × 900 | [desktop.png](design-reference/desktop.png) |
| Main menu, 1440 × 900 | [main-menu.png](design-reference/main-menu.png) |
| Loading screen, 1440 × 900 | [loading.png](design-reference/loading.png) |
| Phone browsing, 390 × 844 | [phone-browse.png](design-reference/phone-browse.png) |
| Phone selection, 390 × 844 | [phone-selected.png](design-reference/phone-selected.png) |
| Small phone with drawer hidden, 320 × 568 | [phone-room.png](design-reference/phone-room.png) |
| Landscape browsing, 844 × 390 | [landscape.png](design-reference/landscape.png) |

These are baseline images, not a requirement for identical pixels across browsers and GPUs. Preserve proportions, hierarchy, palette, and interaction behavior.

## HUD palette

| Role | Current value |
| --- | --- |
| Cream panel/background | #fff8ed |
| Main sage action | #718d61 |
| Primary text | #563425 |
| Borders/dividers | #ead5bd |
| Muted text | #8c725f |
| Catalog card background | #f4ebdd |
| Drawer button background | #f1e7d9 |
| Scene peach backdrop | #df9d80 |
| Scene selection outline | #91ad79 |

Use the tokens in src/styles/tokens.css. Tactile HUD tokens include --panel-edge (#d5b997), --button-bottom (#c5aa87), --sage-bottom (#4d653f), --panel-shadow, --paper-glow (#fffdf5), and --plinth (#e6d7be). Muted text is --muted (#8c725f) everywhere.

Selectable finishes can vary within the established warm/soft palette. Baseline wall color is #92725c, floor multiplier #e3a372, upholstery cream #f3e4d2, and upholstery sage #81936a. Scene material colors are affected by textures, lights, and tone mapping, so their rendered pixels differ from these source values.

## Typography, spacing, and controls

- Brand: bundled Fredoka Semibold via --font-brand. Other prominent headings: Georgia, then bundled Gelasio, serif. Body and controls: Segoe UI, then bundled Source Sans 3, system-ui, sans-serif. Use the tokens --font-heading and --font-body.
- Desktop brand size: 30px; the narrower desktop override is 26px. Compact brand is 23px and becomes 19px, wrapping to two lines, at <= 370px width. The title is cream text directly on the backdrop with no capsule or image logo. The current room name sits underneath in smaller, spaced lettering (hidden at <= 370px); long names truncate. Save uses an icon at <= 440px.
- Small-screen search text is 16px to avoid input zoom in common mobile browsers.
- Keep control labels readable, normally 12–13px on compact screens. Footprint metadata is secondary.
- Use thin warm-brown line icons with consistent strokes. Do not mix emoji, filled clip-art, and line icons as controls.
- Buttons use 12–13px corners and a shallow bottom edge; furniture tiles use 18px corners, and floating panels use 20–26px corners. Use warm outlines, soft shadows, and inset highlights to feel like tactile game pieces. Furniture thumbnails sit directly on the card, with no plinth or shadow.
- Use consistent spacing from existing 4/8/12/16/24px families.
- On compact screens, primary touch actions, camera controls, selection controls, category chips, and Clear have targets at least 44 × 44px. Desktop pointer controls are deliberately smaller and calmer: 38px icon buttons in the top-right capsule, tool tray, and camera tray; 36px selection actions; 30px category chips; 34px colour swatches.
- Keep focus indicators, accessible button names, active/pressed states, and reduced-motion support.

The wordmark uses bundled Fredoka on every platform. Body text and other headings use Segoe UI and Georgia when available, with bundled Source Sans 3 and Gelasio as fallbacks. All three fonts include OFL licences in public/fonts.

## HUD layout and behavior

### Desktop

The top-left title and room subtitle are cream text directly on the backdrop, matching the generated compact HUD concept. Rooms/Save/music/help actions share a floating cream capsule. There is no full-width header background; the canvas extends behind the top controls. A rounded Decorating box floats at the right with space above, below, and to its right. Its width is reserved beside the canvas so it does not cover playable tiles. It has icon-led Furniture/Walls/Floor tabs, search, categories, two-column thumbnail tiles, and a small footer.

Editing tools sit in a tactile tray at the left of the viewport; camera buttons sit at the bottom right. The selected-item card is at the bottom left. Active furniture tiles have a sage border and a plus badge; their aria-pressed state matches the choice or selection. Keep controls aligned at the viewport edges and avoid expanding them over the center of the room.

### Compact screens

Activate the compact system when width <= 900px OR height <= 600px. JavaScript and CSS use the same condition.

Portrait uses a rounded bottom drawer with the same Decorating box styling. Browse/Hide changes its size. Furniture cards form a horizontally swipeable row. Important header actions remain available; Rooms and narrow-screen Save show icons with accessible names. The compact header reserves its own height to keep controls outside the room.

Choosing catalog furniture collapses the drawer for placement. Selecting an item opens its heading, actions, and optional color swatches in the drawer and hides catalog content until deselected. Move can hide the drawer again.

On short portrait screens, the drawer starts collapsed. On compact screens, no item is selected by default. Selection controls must not float over the room.

### Landscape

Use a 290px side drawer when landscape height <= 600px, or landscape width is 700–900px. Collapsed width is 64px. The side catalog uses two columns and vertical scrolling.

Keep the main camera actions available even with the drawer open. At landscape widths <= 700px and heights <= 600px, the tool tray uses three columns and two rows so it stays inside the room and above the camera controls. Use dynamic viewport height and safe-area insets; do not use a fixed device height.

### Loading screen and main menu

The loading screen is the backdrop colour with soft dappled light, the cream Fredoka wordmark (28–42px), the nook illustration at about 250px, a status line, a slim cream progress bar with a sage fill, and one random tip. Everything is sized to feel quiet rather than splashy. It fades out when the menu is ready. The main menu floats over the live room: wordmark (30–48px), then Start or Resume decorating (sage primary), My rooms, Settings, and Credits as 52px tactile buttons with 15–18px Fredoka labels in a column no wider than 340px. Desktop keeps the menu in the left third with the room to the right; portrait phones stack title, room, and buttons; short landscape keeps the side layout. The editor is inert behind the menu, and the Menu button in the HUD action capsule returns to it.

### Interaction

Do not change canvas dimensions while a drag or pinch is active. One finger decorates; two fingers operate the camera. Mouse users drag objects, right-drag to orbit, and scroll to zoom. Touch help must explain touch gestures rather than only desktop keyboard shortcuts.

## Motion

Motion is small and optional. Hover shows a soft cream outline (desktop mouse only). A floor ghost casts a soft footprint shadow. Items settle with a 260 ms squash when they land; curtains slide over 450 ms. Ambient motion is subtle: lamps breathe by a few percent, candles flicker, string lights twinkle only in the Evening mood, and plants sway about a degree and a half, with pots still. It can be switched off in Settings. Decorative motion is skipped when the system asks for reduced motion.

## The cat

A compact cat matching Kenney's Furniture Kit: bevelled box forms, a broad squared head, triangular prism ears, block eyes, paired cream cheeks and paws, and a segmented tail with a pale tip. Four fur colours (ginger, grey, cream, black) remain available. It walks, sits, rests in a sleeping loaf with closed eyes, hops onto rugs and seats, and turns its head toward the cursor. The body is about half a cell long; the complete posed silhouette, including its tail, fits within a floor cell. It never stands inside furniture.

## Finish options

The Walls and Floor tabs put a row of option buttons above the swatches: the wall target (Both walls, Back, Left) and the floor pattern (Parquet, Planks, Tile). Active options use the sage primary style; 32px on desktop and 44px on compact.

## Mode pill

The pill names the current mode. While placing it also holds two pill buttons, Keep placing (toggle, pressed state shown inset) and Cancel: cream on sage, 26px tall on desktop and 44px on compact, where the pill may wrap to two lines. The View tray holds photo, orbit left/right, zoom and reset; orbit buttons are hidden below 640px wide.

## Room and object art

The [48-prop concept sheet](../art-source/prop-sheet.png) is the target look for modelled props; see [PROP_BRIEFS](PROP_BRIEFS.md). It is not yet in the live renderer, so current game screenshots remain the runtime baseline.

- Stylized, rounded procedural 3D with simple, readable silhouettes.
- Orthographic isometric cutaway with two back walls and a visible complete floor.
- Paneled warm wood walls, parquet floor, cream edge trim, corner windows, wood blinds, simple framed art.
- Cream cushioned seating, honey-wood cabinets/tables, sage or earth-tone accents.
- Lush but readable greenery; each plant species should have a distinct shape and pot.
- Use small decorative details sparingly. Keep the room coherent and leave usable placement space.
- Standard materials are rough rather than glossy; furniture casts and receives shadows. Preserve warm ambient and directional light.
- Current renderer: ACES filmic tone mapping, exposure 1.25, pixel ratio capped at 2. The ground backdrop bypasses tone mapping to maintain the peach color.
- Ink outlines (src/scene/outline.js, on by default, Settings > Outlines): soft warm-brown lines along silhouettes and creases, multiplied into the frame so each line is a darker shade of what it sits on, never black. Flat surfaces (floor, walls, rugs) stay clean. A model whose generated surface is bumpy enough to speckle gets `outline: 'soft'` in its catalog entry (silhouette only); the snake plant is the first. Tune `OUTLINE` (ink, strength, thresholds, width) rather than adding per-item colours. Catalog thumbnails are not outlined yet.
- Keep thumbnails generated from the actual model with the existing light/camera treatment. Do not introduce unrelated stock thumbnails.

No cold neon palette, hard black UI panels, realistic photographic textures beside simplified furniture, or unrelated decorative controls. A user-requested new theme can be added intentionally while keeping this baseline available.

## Checking a visual change

Compare the relevant baseline state at the same viewport size. Check brand/icon, complete room framing, panel proportions, text, touch targets, selection placement, and drawer transitions. Check portrait and landscape if changing shared HUD styles.

Capture replacement baseline images only after the design change is intentional and verified. Update this guide with changed tokens or behavior; do not silently overwrite the baseline to hide a regression.
