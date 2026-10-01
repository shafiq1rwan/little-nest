// Saved-room format, validation, and migrations. No Three.js and no DOM.
//
// Version history
//   (none) / 2  { wall, floor, items: [{ type, gx, gz, rot, color? }] }
//   3           { version: 3, wall, floor, items: [{ id, type, gx, gz, rot, color }] }
//   4           items gain parent (supporting item id or null) and slot (surface slot index or null)
//   5           items gain wall ('back' | 'left' | null), col, row for wall-mounted decorations
//   6           { room: { preset, width, depth } } describes the shell; older saves are the 8 x 8 living room
//
// Older versions are migrated on read; the writer always emits the current version.

import { WALLS } from '../game/placement.js';

export const CURRENT_VERSION = 6;
export const LEGACY_ROOM = { preset: 'livingRoom', width: 8, depth: 8 };

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

export function serializeRoom({ room = LEGACY_ROOM, wall, floor, items }) {
  const ordered = [...items.filter((i) => !i.parent), ...items.filter((i) => i.parent)];
  return { version: CURRENT_VERSION, room: { preset: room.preset, width: room.width, depth: room.depth }, wall, floor, items: ordered.map(record) };
}

function isColor(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffff;
}

/** Migrates any known version to the current shape without validating contents. */
export function migrateRoom(data) {
  if (!data || typeof data !== 'object') fail('Not a saved room');
  const version = data.version ?? 2;
  if (![2, 3, 4, 5, 6].includes(version)) fail('Unsupported save version ' + version);
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
  const room = version < 6 ? { ...LEGACY_ROOM } : data.room;
  return { ...data, version: CURRENT_VERSION, room, items };
}

/**
 * Validates a (possibly older) saved room against the catalog, presets, and placement rules.
 * Returns { room, wall, floor, items } with every item carrying an id and parents listed before
 * children, or throws SaveError. Items without an id (migrated saves) get one from `newId`.
 *
 * Options:
 *   placement        rules for the live room (used when no placementFor is given)
 *   placementFor     (room) => placement configured for that room's size; preferred
 *   wallBlocked      blocked wall cells for the live room (used when no wallBlockedFor is given)
 *   wallBlockedFor   (room) => blocked wall cells for that room's preset; preferred
 *   presets          { [id]: { width, depth } }; when given, the room's preset must exist
 */
export function parseRoom(raw, { catalog, placement, placementFor, maxItems = 200, newId, wallBlocked = new Set(), wallBlockedFor, presets, sizeRange = [4, 12] }) {
  const data = migrateRoom(raw);
  if (!Array.isArray(data.items)) fail('Missing items');
  if (data.items.length > maxItems) fail('Too many items');
  if (!isColor(data.wall) || !isColor(data.floor)) fail('Invalid finishes');

  const room = data.room;
  if (!room || typeof room !== 'object' || typeof room.preset !== 'string') fail('Invalid room');
  if (presets && !Object.hasOwn(presets, room.preset)) fail('Unknown room preset ' + room.preset);
  if (![room.width, room.depth].every((n) => Number.isInteger(n) && n >= sizeRange[0] && n <= sizeRange[1])) fail('Invalid room size');
  const roomOut = { preset: room.preset, width: room.width, depth: room.depth };
  const rules = placementFor ? placementFor(roomOut) : placement;
  const blocked = wallBlockedFor ? wallBlockedFor(roomOut) : wallBlocked;

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
    const surface = rules.isSurfaceItem(it.type);
    const wallItem = rules.isWallItem(it.type);
    if (it.parent != null) {
      if (!surface) fail('Only small items can sit on furniture');
      const parent = byId.get(it.parent);
      if (!parent || parent.parent != null) fail('Missing supporter');
      if (!rules.slotLocal(parent.type, it.slot)) fail('Invalid slot');
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
      if (!rules.wallFree(wallOccupied, blocked, it.type, it.wall, it.col, it.row)) fail('Wall spot not free');
      const { w, h } = rules.wallSize(it.type);
      rules.wallCellsOf(it.wall, it.col, it.row, w, h).forEach((c) => wallOccupied.add(c));
      floorItems.push(record({ ...it, gx: null, gz: null, rot: 0, parent: null, slot: null }));
      continue;
    }
    if (![it.gx, it.gz].every(Number.isInteger)) fail('Invalid position');
    const { cells, w, d } = rules.cellsOf(it.type, it.gx, it.gz, it.rot);
    if (!rules.inBounds(it.gx, it.gz, w, d)) fail('Out of bounds');
    if (rules.occupies(it.type)) {
      if (cells.some((c) => occupied.has(c))) fail('Overlapping furniture');
      cells.forEach((c) => occupied.add(c));
    }
    floorItems.push(record({ ...it, parent: null, slot: null, wall: null, col: null, row: null }));
  }
  return { room: roomOut, wall: data.wall, floor: data.floor, items: [...floorItems, ...surfaceItems] };
}
