// HUD rendering and wiring that does not need to know about placement rules.
// Each helper takes the elements it touches and calls back into the game for decisions.

export function createToast(el, duration = 3000) {
  let timer;
  return (message) => {
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('visible'), duration);
  };
}

const hex = (color) => '#' + color.toString(16).padStart(6, '0');

/** Renders a card per catalog entry. `onChoose(type)` runs when a card is pressed. */
export function buildCatalog({ container, catalog, thumbnails, onChoose }) {
  for (const [key, def] of Object.entries(catalog)) {
    const b = document.createElement('button');
    b.className = 'catalog-card';
    b.dataset.type = key;
    const img = document.createElement('img');
    img.alt = '';
    img.src = thumbnails[key];
    const name = document.createElement('strong');
    name.textContent = def.label;
    const size = document.createElement('small');
    size.textContent = def.layer === 'surface' ? 'Tabletop' : def.layer === 'wall' ? 'Wall' : def.w + ' × ' + def.d + ' tiles';
    b.append(img, name, size);
    b.setAttribute('aria-label', 'Place ' + def.label);
    b.onclick = () => onChoose(key);
    container.append(b);
  }
}

export function setCatalogActive(container, type) {
  container.querySelectorAll('.catalog-card').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
}

/** Search box and category chips filter the catalog cards in place. */
export function bindCatalogFilter({ container, catalog, search, categoryButtons, emptyEl }) {
  let category = 'all';
  function apply() {
    const query = search.value.trim().toLowerCase();
    let count = 0;
    container.querySelectorAll('.catalog-card').forEach((b) => {
      const def = catalog[b.dataset.type];
      const inCategory = category === 'all' || def.category === category;
      const matches = [def.label, ...(def.tags || [])].join(' ').toLowerCase().includes(query);
      b.hidden = !(inCategory && matches);
      if (!b.hidden) count++;
    });
    emptyEl.hidden = !!count;
  }
  search.oninput = apply;
  categoryButtons.forEach((b) => {
    b.onclick = () => {
      category = b.dataset.category;
      categoryButtons.forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      apply();
    };
  });
}

/** Furniture / Walls / Floor tabs. `onChange(tab)` runs before the panes switch. */
export function bindTabs({ buttons, onChange }) {
  buttons.forEach((b) => {
    b.onclick = () => {
      onChange(b.dataset.tab);
      buttons.forEach((x) => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', String(x === b));
        document.getElementById(x.dataset.tab + '-pane').hidden = x !== b;
      });
    };
  });
}

/**
 * Wall and floor finish swatches. Each group gives `current()` (the active hex) and `onPick(color)`.
 * Returns a sync function that marks the active swatch; call it whenever a finish changes.
 */
export function buildFinishSwatches(groups) {
  function sync() {
    for (const { el, current } of groups) {
      el.querySelectorAll('button').forEach((b) => {
        const active = Number(b.dataset.color) === current();
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    }
  }
  for (const { el, finishes, onPick } of groups) {
    finishes.forEach(({ name, color }) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.color = color;
      b.style.backgroundColor = hex(color);
      b.title = name;
      b.setAttribute('aria-label', name);
      b.onclick = () => onPick(color);
      el.append(b);
    });
  }
  sync();
  return sync;
}

/** Fills the selection card. `item` is null to hide it. */
export function renderSelectionCard({ card, item, def, thumbnail, sizeText, canRecolor, colors, activeColor, onColor }) {
  card.hidden = !item;
  if (!item) return;
  card.querySelector('#selection-image').src = thumbnail;
  card.querySelector('#selection-name').textContent = def.label;
  card.querySelector('#selection-size').textContent = sizeText;
  const swatches = card.querySelector('#item-swatches');
  swatches.replaceChildren();
  swatches.hidden = !canRecolor;
  if (!canRecolor) return;
  for (const { name, color } of colors) {
    const b = document.createElement('button');
    b.className = 'swatch' + (activeColor === color ? ' active' : '');
    b.style.backgroundColor = hex(color);
    b.title = name;
    b.setAttribute('aria-label', name);
    b.setAttribute('aria-pressed', String(activeColor === color));
    b.onclick = () => onColor(color);
    swatches.append(b);
  }
}

export function setPressed(button, on) {
  button.classList.toggle('active', on);
  button.setAttribute('aria-pressed', String(on));
}
