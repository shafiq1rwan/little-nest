// Saved-room format, validation, and migrations. No Three.js and no DOM.
//
// Version history
//   (none) / 2  { wall, floor, items: [{ type, gx, gz, rot, color? }] }
//   3           { version: 3, wall, floor, items: [{ id, type, gx, gz, rot, color }] }
//   4           items gain parent (supporting item id or null) and slot (surface slot index or null)
//
// Older versions are migrated on read; the writer always emits the current version.

export const CURRENT_VERSION = 4;

export class SaveError extends Error {}

function fail(message) {
  throw new SaveError(message);
}

export function serializeRoom({ wall, floor, items }) {
  const ordered = [...items.filter((i) => !i.parent), ...items.filter((i) => i.parent)];
  return {
    version: CURRENT_VERSION,
    wall,
    floor,
    items: ordered.map(({ id, type, gx, gz, rot, color, parent, slot }) => ({
      id, type, gx: gx ?? null, gz: gz ?? null, rot, color: color ?? null, parent: parent ?? null, slot: slot ?? null,
    })),
  };
}

function isColor(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/** Migrates any known version to the current shape without validating contents. */
export function migrateRoom(data) {
  if (!data || typeof data !== 'object') fail('Not a saved room');
  let out = data;
  let version = data.version ?? 2;
  if (version === 2) {
    out = { ...out, version: 3, items: Array.isArray(out.items) ? out.items.map((it) => (it && typeof it === 'object' ? { id: null, ...it } : it)) : out.items };
    version = 3;
  }
  if (version === 3) {
    out = { ...out, version: 4, items: Array.isArray(out.items) ? out.items.map((it) => (it && typeof it === 'object' ? { parent: null, slot: null, ...it } : it)) : out.items };
    version = 4;
  }
  if (version !== CURRENT_VERSION) fail('Unsupported save version ' + version);
  return out;
}

/**
 * Validates a (possibly older) saved room against the catalog and placement rules.
 * Returns { wall, floor, items } with every item carrying an id and parents listed before
 * children, or throws SaveError. Items without an id (migrated saves) get one from `newId`.
 */
export function parseRoom(raw, { catalog, placement, maxItems = 200, newId }) {
  const data = migrateRoom(raw);
  if (!Array.isArray(data.items)) fail('Missing items');
  if (data.items.length > maxItems) fail('Too many items');
  if (!isColor(data.wall) || !isColor(data.floor)) fail('Invalid finishes');

  const ids = new Set();
  const withIds = data.items.map((it) => {
    if (!it || typeof it !== 'object') fail('Invalid item');
    if (!Object.hasOwn(catalog, it.type)) fail('Unknown furniture ' + it.type);
    let id = it.id;
    if (id != null && (typeof id !== 'string' || !id)) fail('Invalid id');
    while (!id || ids.has(id)) id = newId();
    ids.add(id);
    return { ...it, id };
  });
  const byId = new Map(withIds.map((it) => [it.id, it]));

  const floorItems = [];
  const surfaceItems = [];
  const occupied = new Set();
  const slotsUsed = new Set();
  for (const it of withIds) {
    if (!Number.isInteger(it.rot) || it.rot < 0 || it.rot > 3) fail('Invalid position');
    if (it.color != null && !isColor(it.color)) fail('Invalid color');
    const surface = placement.isSurfaceItem(it.type);
    if (it.parent != null) {
      if (!surface) fail('Only small items can sit on furniture');
      const parent = byId.get(it.parent);
      if (!parent || parent.parent != null) fail('Missing supporter');
      if (!placement.slotLocal(parent.type, it.slot)) fail('Invalid slot');
      const key = it.parent + ':' + it.slot;
      if (slotsUsed.has(key)) fail('Slot already taken');
      slotsUsed.add(key);
      surfaceItems.push({ id: it.id, type: it.type, gx: null, gz: null, rot: it.rot, color: it.color ?? null, parent: it.parent, slot: it.slot });
      continue;
    }
    if (surface) fail('Small items need a supporter');
    if (![it.gx, it.gz].every(Number.isInteger)) fail('Invalid position');
    const { cells, w, d } = placement.cellsOf(it.type, it.gx, it.gz, it.rot);
    if (!placement.inBounds(it.gx, it.gz, w, d)) fail('Out of bounds');
    if (placement.occupies(it.type)) {
      if (cells.some((c) => occupied.has(c))) fail('Overlapping furniture');
      cells.forEach((c) => occupied.add(c));
    }
    floorItems.push({ id: it.id, type: it.type, gx: it.gx, gz: it.gz, rot: it.rot, color: it.color ?? null, parent: null, slot: null });
  }
  return { wall: data.wall, floor: data.floor, items: [...floorItems, ...surfaceItems] };
}
