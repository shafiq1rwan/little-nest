# Little Nest style guide

Status: current visual baseline, 30 September 2026. Keep this file and its reference images with the project when changing computers.

## Identity

Little Nest is a calm room-decorating sandbox: warm, personal, tactile, and easy to experiment with. The room is the main attraction; the HUD supports decorating without dominating the scene.

Use Little Nest consistently in the page title, desktop/phone headers, manifest, and player-facing text. The current storage key retains the old name solely for save compatibility.

Icon source: [little-nest-icon.png](../public/icons/little-nest-icon.png). It depicts a terracotta-roofed dollhouse with a cream sofa and greenery. Use the existing artwork; do not regenerate a different icon during routine edits.

## Reference order

1. This guide specifies the design intent and layout rules.
2. The current game images below show the implemented baseline.
3. [Original HUD concept](design-reference/hud-concept.png) shows the art direction.
4. [Room inspiration 1](../reference-1.jpg) and [room inspiration 2](../reference-2.jpg) supply the original cozy isometric references.

The generated HUD concept is more detailed than the live procedural room. Match the game's established visual language when extending it; do not substitute a flat image for editable models.

| Current state | Reference |
| --- | --- |
| Desktop, 1440 × 900 | [desktop.png](design-reference/desktop.png) |
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

Use the tokens in src/styles/tokens.css: --cream, --sage, --sage-deep, --line, --ink, --muted, --card, --card-hover, --card-active, --drawer-button, --hover, --backdrop, --shadow. Muted text is --muted (#8c725f) everywhere; the former #8b715e was folded into it.

Selectable finishes can vary within the established warm/soft palette. Baseline wall color is #92725c, floor multiplier #e3a372, upholstery cream #f3e4d2, and upholstery sage #81936a. Scene material colors are affected by textures, lights, and tone mapping, so their rendered pixels differ from these source values.

## Typography, spacing, and controls

- Brand and prominent headings: Georgia, then bundled Gelasio, serif. Body and controls: Segoe UI, then bundled Source Sans 3, system-ui, sans-serif. Use the tokens --font-heading and --font-body.
- Desktop brand size: 27px; the narrower desktop override is 21px. Compact brand is 19px and becomes 16px at <= 370px width.
- Small-screen search text is 16px to avoid input zoom in common mobile browsers.
- Keep control labels readable, normally 12–13px on compact screens. Footprint metadata is secondary.
- Use thin warm-brown line icons with consistent strokes. Do not mix emoji, filled clip-art, and line icons as controls.
- Common corners: roughly 10–15px; compact drawer corners: 22px. Use quiet shadows and warm dividers.
- Use consistent spacing from existing 4/8/12/16/24px families.
- New primary touch actions should have a target at least 44 × 44px. Current category chips are 40px high and Clear is 40px; enlarge them if a future layout permits.
- Keep focus indicators, accessible button names, active/pressed states, and reduced-motion support.

Windows renders with Segoe UI and Georgia exactly as before. Other operating systems use the bundled OFL fonts in public/fonts, chosen for matching metrics (Gelasio is metric-compatible with Georgia).

## HUD layout and behavior

### Desktop

A cream top bar contains brand, room label, Load, Save room, and help. The room viewport takes the remaining width beside a right decoration panel. The panel has Furniture/Walls/Floor tabs, search, categories, two-column thumbnail cards, and a small footer.

Editing tools sit at the left of the viewport; camera buttons sit at the bottom right. The selected-item card is at the bottom left. Keep controls aligned at the viewport edges and avoid expanding them over the center of the room.

### Compact screens

Activate the compact system when width <= 900px OR height <= 600px. JavaScript and CSS use the same condition.

Portrait uses a rounded bottom drawer. Browse/Hide changes its size. Furniture cards form a horizontally swipeable row. Important top-bar actions remain available; Load and very narrow Save may show icons with accessible names.

Choosing catalog furniture collapses the drawer for placement. Selecting an item opens its heading, actions, and optional color swatches in the drawer and hides catalog content until deselected. Move can hide the drawer again.

On short portrait screens, the drawer starts collapsed. On compact screens, no item is selected by default. Selection controls must not float over the room.

### Landscape

Use a 290px side drawer when landscape height <= 600px, or landscape width is 700–900px. Collapsed width is 64px. The side catalog uses two columns and vertical scrolling.

Keep the main camera actions available even with the drawer open. Use dynamic viewport height and safe-area insets; do not use a fixed device height.

### Interaction

Do not change canvas dimensions while a drag or pinch is active. One finger decorates; two fingers operate the camera. Mouse users drag objects, right-drag to orbit, and scroll to zoom. Touch help must explain touch gestures rather than only desktop keyboard shortcuts.

## Room and object art

- Stylized, rounded procedural 3D with simple, readable silhouettes.
- Orthographic isometric cutaway with two back walls and a visible complete floor.
- Paneled warm wood walls, parquet floor, cream edge trim, corner windows, wood blinds, simple framed art.
- Cream cushioned seating, honey-wood cabinets/tables, sage or earth-tone accents.
- Lush but readable greenery; each plant species should have a distinct shape and pot.
- Use small decorative details sparingly. Keep the room coherent and leave usable placement space.
- Standard materials are rough rather than glossy; furniture casts and receives shadows. Preserve warm ambient and directional light.
- Current renderer: ACES filmic tone mapping, exposure 1.25, pixel ratio capped at 2. The ground backdrop bypasses tone mapping to maintain the peach color.
- Keep thumbnails generated from the actual model with the existing light/camera treatment. Do not introduce unrelated stock thumbnails.

No cold neon palette, hard black UI panels, realistic photographic textures beside simplified furniture, or unrelated decorative controls. A user-requested new theme can be added intentionally while keeping this baseline available.

## Checking a visual change

Compare the relevant baseline state at the same viewport size. Check brand/icon, complete room framing, panel proportions, text, touch targets, selection placement, and drawer transitions. Check portrait and landscape if changing shared HUD styles.

Capture replacement baseline images only after the design change is intentional and verified. Update this guide with changed tokens or behavior; do not silently overwrite the baseline to hide a regression.
