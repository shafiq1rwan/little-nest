// Saved-room format, validation, and migrations. No Three.js and no DOM.
//
// Version history
//   (none) / 2  { wall, floor, items: [{ type, gx, gz, rot, color? }] }
//   3           { version: 3, wall, floor, items: [{ id, type, gx, gz, rot, color }] }
//   4           items gain parent (supporting item id or null) and slot (surface slot index or null)
//   5           items gain wall ('back' | 'left' | null), col, row for wall-mounted decorations
//
// Older versions are migrated on read; the writer always emits the current version.

import { WALLS } from '../game/placement.js';

export const CURRENT_VERSION = 5;

export class SaveError extends Error {}

function fail(message) {
  throw new SaveError(message);
}

const FIELDS = ['id', 'type', 'gx', 'gz', 'rot', 'color', 'parent', 'slot', 'wall', 'col', 'row'];
function record(it) {
  const out = {};
  for (const f of FIELDS) out[f] = it[f] ?? null;
  return out;
}

export function serializeRoom({ wall, floor, items }) {
  const ordered = [...items.filter((i) => !i.parent), ...items.filter((i) => i.parent)];
  return { version: CURRENT_VERSION, wall, floor, items: ordered.map(record) };
}

function isColor(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/** Migrates any known version to the current shape without validating contents. */
export function migrateRoom(data) {
  if (!data || typeof data !== 'object') fail('Not a saved room');
  const version = data.version ?? 2;
  if (![2, 3, 4, 5].includes(version)) fail('Unsupported save version ' + version);
  const items = Array.isArray(data.items)
    ? data.items.map((it) => {
      if (!it || typeof it !== 'object') return it;
      const out = { ...it };
      if (version < 3) out.id = out.id ?? null;
      if (version < 4) { out.parent = out.parent ?? null; out.slot = out.slot ?? null; }
      if (version < 5) { out.wall = out.wall ?? null; out.col = out.col ?? null; out.row = out.row ?? null; }
      return out;
    })
    : data.items;
  return { ...data, version: CURRENT_VERSION, items };
}

/**
 * Validates a (possibly older) saved room against the catalog and placement rules.
 * Returns { wall, floor, items } with every item carrying an id and parents listed before
 * children, or throws SaveError. Items without an id (migrated saves) get one from `newId`.
 * `wallBlocked` is the Set of wall cells covered by fixtures such as windows.
 */
export function parseRoom(raw, { catalog, placement, maxItems = 200, newId, wallBlocked = new Set() }) {
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
  const wallOccupied = new Set();
  const slotsUsed = new Set();
  for (const it of withIds) {
    if (!Number.isInteger(it.rot) || it.rot < 0 || it.rot > 3) fail('Invalid position');
    if (it.color != null && !isColor(it.color)) fail('Invalid color');
    const surface = placement.isSurfaceItem(it.type);
    const wallItem = placement.isWallItem(it.type);
    if (it.parent != null) {
      if (!surface) fail('Only small items can sit on furniture');
      const parent = byId.get(it.parent);
      if (!parent || parent.parent != null) fail('Missing supporter');
      if (!placement.slotLocal(parent.type, it.slot)) fail('Invalid slot');
      const key = it.parent + ':' + it.slot;
      if (slotsUsed.has(key)) fail('Slot already taken');
      slotsUsed.add(key);
      surfaceItems.push(record({ ...it, gx: null, gz: null, wall: null, col: null, row: null }));
      continue;
    }
    if (surface) fail('Small items need a supporter');
    if (it.wall != null || wallItem) {
      if (!wallItem) fail('Only wall decorations go on walls');
      if (!WALLS.includes(it.wall)) fail('Unknown wall');
      if (![it.col, it.row].every(Number.isInteger)) fail('Invalid position');
      if (!placement.wallFree(wallOccupied, wallBlocked, it.type, it.wall, it.col, it.row)) fail('Wall spot not free');
      const { w, h } = placement.wallSize(it.type);
      placement.wallCellsOf(it.wall, it.col, it.row, w, h).forEach((c) => wallOccupied.add(c));
      floorItems.push(record({ ...it, gx: null, gz: null, rot: 0, parent: null, slot: null }));
      continue;
    }
    if (![it.gx, it.gz].every(Number.isInteger)) fail('Invalid position');
    const { cells, w, d } = placement.cellsOf(it.type, it.gx, it.gz, it.rot);
    if (!placement.inBounds(it.gx, it.gz, w, d)) fail('Out of bounds');
    if (placement.occupies(it.type)) {
      if (cells.some((c) => occupied.has(c))) fail('Overlapping furniture');
      cells.forEach((c) => occupied.add(c));
    }
    floorItems.push(record({ ...it, parent: null, slot: null, wall: null, col: null, row: null }));
  }
  return { wall: data.wall, floor: data.floor, items: [...floorItems, ...surfaceItems] };
}
