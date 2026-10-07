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
export function buildCatalog({ container, catalog, thumbnails, onChoose, collectionLabel = null }) {
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
    const label = collectionLabel?.(def);
    size.textContent = (def.layer === 'surface' ? (def.surfaceKind === 'seat' ? 'On a seat' : 'Tabletop') : def.layer === 'wall' ? 'Wall' : def.w + ' × ' + def.d + ' tiles') + (label ? ' · ' + label : '');
    b.append(img, name, size);
    b.setAttribute('aria-label', 'Place ' + def.label);
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => onChoose(key);
    container.append(b);
  }
}

export function setCatalogActive(container, type) {
  container.querySelectorAll('.catalog-card').forEach((b) => {
    const active = b.dataset.type === type;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

/** Search box, category chips, and the collection selector filter the catalog cards in place. */
export function bindCatalogFilter({ container, catalog, search, categoryButtons, emptyEl, collectionSelect = null, collections = {} }) {
  let category = 'all';
  if (collectionSelect) {
    for (const [key, c] of Object.entries(collections)) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = c.name;
      collectionSelect.append(o);
    }
    collectionSelect.onchange = apply;
  }
  function apply() {
    const query = search.value.trim().toLowerCase();
    const collection = collectionSelect?.value ?? 'all';
    let count = 0;
    container.querySelectorAll('.catalog-card').forEach((b) => {
      const def = catalog[b.dataset.type];
      const inCategory = category === 'all' || def.category === category;
      const inCollection = collection === 'all' || def.collection === collection;
      const matches = [def.label, ...(def.tags || [])].join(' ').toLowerCase().includes(query);
      b.hidden = !(inCategory && inCollection && matches);
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
export function renderSelectionCard({ card, item, def, thumbnail, sizeText, canRecolor, colors, activeColor, onColor, onLight = null }) {
  card.hidden = !item;
  if (!item) return;
  card.querySelector('#selection-name').textContent = def.label;
  card.querySelector('#selection-size').textContent = sizeText;
  const light = card.querySelector('#light-selected');
  if (light) {
    const isLamp = item.lit !== null && item.lit !== undefined;
    light.hidden = !isLamp;
    if (isLamp) {
      const t = def.toggle || { on: 'On', off: 'Off', labelOn: 'Light on. Switch off', labelOff: 'Light off. Switch on', titleOn: 'Switch the light off', titleOff: 'Switch the light on', icon: 'bulb' };
      light.setAttribute('aria-pressed', String(item.lit));
      light.setAttribute('aria-label', item.lit ? t.labelOn : t.labelOff);
      light.title = item.lit ? t.titleOn : t.titleOff;
      light.lastChild.textContent = item.lit ? t.on : t.off;
      light.onclick = () => onLight?.(!item.lit);
    }
  }
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

/** Lighting mood buttons. `current()` is the active key; `onPick(key)` applies one. Returns a sync function. */
export function buildLightingOptions({ container, moods, icons = {}, current, onPick }) {
  const buttons = [];
  for (const [key, mood] of Object.entries(moods)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lighting-option';
    b.dataset.lighting = key;
    const icon = document.createElement('span');
    icon.dataset.icon = icons[key] || 'sun';
    const name = document.createElement('strong');
    name.textContent = mood.name;
    const blurb = document.createElement('small');
    blurb.textContent = mood.blurb;
    b.append(icon, name, blurb);
    b.setAttribute('aria-label', mood.name + ' light');
    b.onclick = () => onPick(key);
    container.append(b);
    buttons.push(b);
  }
  function sync() {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.lighting === current()));
  }
  sync();
  return sync;
}

export function setPressed(button, on) {
  button.classList.toggle('active', on);
  button.setAttribute('aria-pressed', String(on));
}
