// Where the Decorate card, the selection card and the dock live, and whether the card is open.
// The media queries must stay in step with src/styles/responsive.css.
//
// Wide screens: the Decorate card floats on the right and can be open, minimised (header only, the −
// button) or closed (the × button); the dock's Decorate button opens and closes it.
// Compact portrait screens: the card is a bottom sheet with the dock along its foot, and the selection
// card docks at the top of the sheet. Collapsing the sheet leaves just the dock.
// Compact landscape screens: a side drawer that opens and closes, with the dock floating over the room.

export const COMPACT_QUERY = '(max-width: 900px), (max-height: 600px)';
export const SIDE_DRAWER_QUERY = '(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (min-width: 700px) and (max-width: 900px)';

export function createResponsiveHUD({ panel, panelContent, selectionCard, viewport, dock, toggle, close, decorate, collapseSelection, hasSelection }) {
  const compact = window.matchMedia(COMPACT_QUERY);
  const side = window.matchMedia(SIDE_DRAWER_QUERY);
  // Short portrait phones start with the sheet down so the room is visible first.
  let expanded = !(window.innerHeight < 650 && window.innerWidth < window.innerHeight);
  let minimized = false;   // wide screens only: the card shows just its header

  const isSheet = () => compact.matches && !side.matches;
  function sync() {
    const open = expanded && !(minimized && !compact.matches);
    panel.classList.toggle('collapsed', compact.matches && !expanded);
    panel.classList.toggle('closed', !compact.matches && !expanded);
    panel.classList.toggle('minimized', !compact.matches && expanded && minimized);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide decorating panel' : 'Browse decorations');
    toggle.title = compact.matches ? 'Collapse' : minimized ? 'Restore' : 'Minimise';
    decorate.setAttribute('aria-pressed', String(open));
    decorate.title = open ? 'Close the Decorate panel' : 'Open the Decorate panel';
  }
  function setExpanded(next) {
    expanded = !!next;
    if (expanded) minimized = false;
    sync();
  }
  function markSelection() {
    panel.dataset.hasSelection = String(hasSelection());
    if (!hasSelection()) { selectionCard.classList.remove('folded'); collapseSelection.setAttribute('aria-expanded', 'true'); }
  }
  function arrange() {
    // Compact screens dock the selection card in the drawer so it never floats over the room;
    // the portrait sheet also carries the dock along its foot.
    if (compact.matches) panelContent.prepend(selectionCard);
    else viewport.append(selectionCard);
    if (isSheet()) panel.append(dock);
    else viewport.append(dock);
    markSelection();
    sync();
  }

  // − minimises the card to its header (wide) or lowers the sheet into the dock (compact).
  toggle.onclick = () => {
    if (compact.matches) setExpanded(!expanded);
    else { minimized = !minimized; expanded = true; sync(); }
  };
  close.onclick = () => { setExpanded(false); decorate.focus({ preventScroll: true }); };   // focus returns to the launcher
  decorate.onclick = () => setExpanded(!(expanded && !minimized));
  // The selection card's chevron: on wide screens it folds the card to its name (still selected); on compact
  // screens it lowers the sheet into the dock.
  collapseSelection.onclick = () => {
    if (compact.matches) { setExpanded(false); return; }
    const folded = selectionCard.classList.toggle('folded');
    collapseSelection.setAttribute('aria-expanded', String(!folded));
  };
  compact.addEventListener('change', arrange);
  side.addEventListener('change', arrange);
  arrange();

  return {
    isCompact: () => compact.matches,
    isSheet,
    isExpanded: () => expanded && !minimized,
    setExpanded,
    markSelection,
    /** Photo mode lifts the dock out of the sheet so its View tools stay reachable. */
    setPhoto(on) { if (on) viewport.append(dock); else arrange(); },
  };
}
