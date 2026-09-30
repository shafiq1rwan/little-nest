// Saved-room format, validation, and migrations. No Three.js and no DOM.
//
// Version history
//   (none) / 2  { wall, floor, items: [{ type, gx, gz, rot, color? }] }
//   3           { version: 3, wall, floor, items: [{ id, type, gx, gz, rot, color }] }
//
// Older versions are migrated on read; the writer always emits the current version.

export const CURRENT_VERSION = 3;

export class SaveError extends Error {}

function fail(message) {
  throw new SaveError(message);
}

export function serializeRoom({ wall, floor, items }) {
  return {
    version: CURRENT_VERSION,
    wall,
    floor,
    items: items.map(({ id, type, gx, gz, rot, color }) => ({ id, type, gx, gz, rot, color: color ?? null })),
  };
}

function isColor(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/** Migrates any known version to the current shape without validating contents. */
export function migrateRoom(data) {
  if (!data || typeof data !== 'object') fail('Not a saved room');
  const version = data.version ?? 2;
  if (version === 2) {
    return { ...data, version: 3, items: Array.isArray(data.items) ? data.items.map((it) => (it && typeof it === 'object' ? { id: null, ...it } : it)) : data.items };
  }
  if (version === CURRENT_VERSION) return data;
  fail('Unsupported save version ' + version);
}

/**
 * Validates a (possibly older) saved room against the catalog and placement rules.
 * Returns { wall, floor, items } with every item carrying an id, or throws SaveError.
 * Items without an id (migrated saves) get one from `newId`.
 */
export function parseRoom(raw, { catalog, placement, maxItems = 200, newId }) {
  const data = migrateRoom(raw);
  if (!Array.isArray(data.items)) fail('Missing items');
  if (data.items.length > maxItems) fail('Too many items');
  if (!isColor(data.wall) || !isColor(data.floor)) fail('Invalid finishes');

  const items = [];
  const occupied = new Set();
  const ids = new Set();
  for (const it of data.items) {
    if (!it || typeof it !== 'object') fail('Invalid item');
    if (!Object.hasOwn(catalog, it.type)) fail('Unknown furniture ' + it.type);
    if (![it.gx, it.gz, it.rot].every(Number.isInteger) || it.rot < 0 || it.rot > 3) fail('Invalid position');
    const { cells, w, d } = placement.cellsOf(it.type, it.gx, it.gz, it.rot);
    if (!placement.inBounds(it.gx, it.gz, w, d)) fail('Out of bounds');
    if (placement.occupies(it.type)) {
      if (cells.some((c) => occupied.has(c))) fail('Overlapping furniture');
      cells.forEach((c) => occupied.add(c));
    }
    if (it.color != null && !isColor(it.color)) fail('Invalid color');
    let id = it.id;
    if (id != null && (typeof id !== 'string' || !id)) fail('Invalid id');
    while (!id || ids.has(id)) id = newId();
    ids.add(id);
    items.push({ id, type: it.type, gx: it.gx, gz: it.gz, rot: it.rot, color: it.color ?? null });
  }
  return { wall: data.wall, floor: data.floor, items };
}
