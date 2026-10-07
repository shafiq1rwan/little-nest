# Compact HUD proposal

Design proposal, 7 October 2026. **Implemented the same day from the v3 board** (see the HUD sections of the [style guide](STYLE_GUIDE.md), which is now the source of truth). Differences from this text: categories and the collection select both sit under the filter button and start visible (as on the v3 board); short landscape closes the side drawer completely and keeps the floating dock instead of a slim rail; there are no separate Tools trays (Undo, Redo and the grid sit in the dock, Move and Rotate on the selection card).

[Mockup board](design-reference/hud-compact-v2.png) · [Full generation prompt](design-reference/hud-compact-v2-prompt.txt). Generated using the built-in image generation tool with the existing desktop and phone screenshots as references.

The room gets most of the screen. Replace permanently expanded trays with small, labelled launchers and show the catalog or item actions only when needed. Preserve cream, sage, brown line icons, and the text-only Little Nest wordmark.

## Revision 3: flat controls

The user disliked the previous button design. The latest [v3 mockup](design-reference/hud-compact-v3.png) replaces raised edges and individually boxed buttons with flat shared toolbars, unboxed line icons, underlined tabs, and borderless furniture thumbnails. Save retains a flat sage fill; circular color swatches use a thin selection ring. Modest panel corners and a faint panel shadow separate controls from the room. Keep generous touch hit areas even when the visible icons are small.

The desktop tool launchers consolidate into one bottom dock; the phone dock sits below the selection actions. Collapsed panels reopen from that dock. Dismissal and Show HUD behavior below still apply. This revision supersedes v2's button styling; v2 remains available for comparison. Generated with the built-in image tool; [full v3 prompt](design-reference/hud-compact-v3-prompt.txt). The board illustrates appearance, not measured browser layout.

## Panel behavior

| Control | Proposed behavior | How to restore |
| --- | --- | --- |
| Collapse chevron / minus | Fold a panel into a small labelled chip; preserve its tab, search, and scroll position | Tap its chip |
| Close / X | Dismiss the panel | Open Decorate, Tools, or View from its launcher |
| Hide HUD | Hide decorating panels, header, and tool trays; keep a small Show HUD button | Tap Show HUD; Escape also restores it |
| Close selected-item card | Deselect the object, matching the existing behavior | Select an object again |

Hide HUD is a viewing state. Entering it cancels a pending placement and clears selection without changing committed room contents; camera gestures remain available, and object editing resumes after restoring the HUD. Photo mode keeps its existing save-photo workflow.

## Desktop

- Keep the wordmark and room name small at the top left. Keep Rooms, Save, overflow, and Hide HUD at the top right. Move music, help, and the main-menu shortcut into overflow.
- Start with a Decorate launcher and collapsed Tools/View trays. Keep Undo and Redo reachable beside Tools.
- Open a roughly 260–280px catalog on the right. Retain Furniture, Walls, Floor, Light, search, all existing categories, and collection filtering. Show categories as one scrollable row; put the collection selector behind a small filter control. The mockup shows only representative catalog entries.
- Remove the permanent eyebrow, tutorial strip, tile footprint metadata, and item-count footer from the main browsing view. Keep footprint information available on selection; put Clear room in an explicit secondary action menu.
- Reserve space beside the room when the catalog expands. Resize only after any active drag or pinch finishes; retain the camera framing rather than resetting it.
- Selection opens a smaller contextual card with Move, Rotate, Copy, Remove, applicable toggles, and colors. Allow that card to fold to an item-name chip without deselecting.

## Phone, tablet, and landscape

- Keep the existing compact condition: width <= 900px OR height <= 600px.
- Portrait starts with a small bottom Decorate strip. Browse opens a short bottom drawer with a horizontally swipeable catalog. The expanded-browse mockup shows this temporary state.
- Choosing an item collapses browsing for placement. Selecting an object replaces the catalog with item actions and swatches in the drawer, outside the room. Fold the selected card to an item-name strip; closing it deselects.
- Keep Tools and View as expandable edge controls. Touch targets are at least 44px; phone search text is at least 16px. Allow selection actions to wrap on narrow phones.
- Landscape retains the existing side-drawer orientation, collapsing to a slim restore rail. Tablet follows the existing breakpoint rather than acquiring a separate interaction system.
- Keep safe-area spacing, visible focus, accessible button names and expanded states, and reduced-motion support. Hidden controls must leave the tab order. Preserve focus on the appropriate launcher when dismissing a panel.

## Review and implementation

The generated board illustrates desktop browsing, desktop collapsed, phone browsing, and phone selection. It is a design reference, not pixel-accurate browser output. The room remains editable Three.js geometry when implemented.

Implementation should extend `src/ui/responsive.js`, HUD markup, and existing styles. Validate collapsed/expanded/dismissed states, restoring the HUD, selection docking, pending-placement cancellation, keyboard focus, and resize deferral across desktop, phone, tablet, and short landscape. Run `npm run build` and `npm test` for that implementation and update the style guide only once shipped.
