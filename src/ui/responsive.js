// Compact-screen behaviour: the decorating drawer and where the selection card docks.
// The media query must stay in step with the breakpoints in style.css.

export const COMPACT_QUERY = '(max-width: 900px), (max-height: 600px)';

export function createResponsiveHUD({ panel, panelContent, selectionCard, viewport, toggle, hasSelection }) {
  const compact = window.matchMedia(COMPACT_QUERY);
  // Short portrait phones start with the drawer hidden so the room is visible first.
  let expanded = !(window.innerHeight < 650 && window.innerWidth < window.innerHeight);

  function setExpanded(next) {
    expanded = next;
    panel.classList.toggle('collapsed', compact.matches && !expanded);
    toggle.setAttribute('aria-expanded', String(!compact.matches || expanded));
    toggle.setAttribute('aria-label', expanded ? 'Hide decorating panel' : 'Browse decorations');
    toggle.querySelector('.toggle-label').textContent = expanded ? 'Hide' : 'Browse';
  }
  function markSelection() {
    panel.dataset.hasSelection = String(hasSelection());
  }
  function arrange() {
    // Compact screens dock the selection card in the drawer so it never floats over the room.
    if (compact.matches) panelContent.prepend(selectionCard);
    else viewport.append(selectionCard);
    markSelection();
    setExpanded(expanded);
  }

  toggle.onclick = () => setExpanded(!expanded);
  compact.addEventListener('change', arrange);
  arrange();

  return { isCompact: () => compact.matches, isExpanded: () => expanded, setExpanded, markSelection };
}
