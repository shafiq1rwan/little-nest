// Committed room state: serializable item records and the occupancy derived from them.
// Records are { id, type, gx, gz, rot, color, parent, slot, wall, col, row, lit }.
//   lit is true/false for lamps (catalog `lamp: true`) and toggles such as curtains (`toggle`), null for everything else.
//   floor items:   gx/gz on the grid; parent/slot/wall/col/row null
//   surface items: parent = supporting item id, slot = index on its surface; gx/gz/wall null
//   wall items:    wall = 'back' | 'left', col/row on that wall's grid; gx/gz/parent null; rot is 0
// Meshes live elsewhere, keyed by id. No Three.js and no DOM.

import { cellKey } from './placement.js';

export function newItemId() {
  return 'i' + Math.random().toString(36).slice(2, 10);
}

const EMPTY = { gx: null, gz: null, parent: null, slot: null, wall: null, col: null, row: null };
/** Lamps start lit; everything else has no light state. */
function defaultLit(placement, type) {
  return placement.hasSwitch(type) ? true : null;
}

export function createRoomState({ placement, wallBlocked = new Set(), wallWindows = new Set() }) {
  const items = [];
  const occupancy = new Set();          // floor cells in use
  const wallOccupancy = new Set();      // wall cells in use
  const slotsUsed = new Map();          // parent id -> Set of slot indexes in use
  const byId = new Map();

  function occupy(record, on) {
    if (record.parent) {
      if (!slotsUsed.has(record.parent)) slotsUsed.set(record.parent, new Set());
      const set = slotsUsed.get(record.parent);
      if (on) set.add(record.slot); else set.delete(record.slot);
      return;
    }
    if (record.wall) {
      const { w, h } = placement.wallSize(record.type);
      for (const c of placement.wallCellsOf(record.wall, record.col, record.row, w, h)) {
        if (on) wallOccupancy.add(c); else wallOccupancy.delete(c);
      }
      return;
    }
    if (!placement.occupies(record.type)) return;
    for (const c of placement.cellsOf(record.type, record.gx, record.gz, record.rot).cells) {
      if (on) occupancy.add(c); else occupancy.delete(c);
    }
  }

  function ownCells(record) {
    if (!record || record.parent) return null;
    if (record.wall) {
      const { w, h } = placement.wallSize(record.type);
      return new Set(placement.wallCellsOf(record.wall, record.col, record.row, w, h));
    }
    if (!placement.occupies(record.type)) return null;
    return new Set(placement.cellsOf(record.type, record.gx, record.gz, record.rot).cells);
  }

  function get(id) {
    return byId.get(id) || null;
  }
  function childrenOf(id) {
    return items.filter((r) => r.parent === id);
  }

  /** True when a floor footprint fits, ignoring the cells of `ignoreId` (an item being moved). */
  function canPlace(type, gx, gz, rot, ignoreId = null) {
    if (placement.isSurfaceItem(type) || placement.isWallItem(type)) return false;
    const own = ignoreId ? ownCells(byId.get(ignoreId)) : null;
    return placement.isFree(occupancy, type, gx, gz, rot, own);
  }
  /** True when a surface item can sit in `slot` of `parentId`, ignoring `ignoreId` (the item itself while moving). */
  function canPlaceOn(type, parentId, slot, ignoreId = null) {
    const parent = byId.get(parentId);
    if (!parent || !placement.acceptsOn(type, parent.type) || parent.parent) return false;
    if (!placement.slotLocal(parent.type, slot)) return false;
    const used = slotsUsed.get(parentId);
    if (!used || !used.has(slot)) return true;
    const occupant = items.find((r) => r.parent === parentId && r.slot === slot);
    return !!occupant && occupant.id === ignoreId;
  }
  /** True when a wall item fits at wall/col/row, ignoring `ignoreId`'s own cells. */
  function canMount(type, wall, col, row, ignoreId = null) {
    const own = ignoreId ? ownCells(byId.get(ignoreId)) : null;
    return placement.wallFree(wallOccupancy, wallBlocked, type, wall, col, row, own, wallWindows);
  }

  /** Adds a record. Returns it, or null when the position is not free. */
  function add({ type, gx = null, gz = null, rot = 0, color = null, id = null, parent = null, slot = null, wall = null, col = null, row = null, lit = undefined }) {
    let record;
    const litValue = placement.hasSwitch(type) ? (lit == null ? true : !!lit) : null;
    if (parent) {
      if (!canPlaceOn(type, parent, slot)) return null;
      record = { type, rot, color, lit: litValue, ...EMPTY, parent, slot };
    } else if (wall) {
      if (!canMount(type, wall, col, row)) return null;
      record = { type, rot: 0, color, lit: litValue, ...EMPTY, wall, col, row };
    } else {
      if (!canPlace(type, gx, gz, rot)) return null;
      record = { type, rot, color, lit: litValue, ...EMPTY, gx, gz };
    }
    let key = id;
    while (!key || byId.has(key)) key = newItemId();
    record = { id: key, ...record };
    items.push(record);
    byId.set(key, record);
    occupy(record, true);
    return record;
  }

  /** Removes a record and anything sitting on it. Returns the removed records, children first, or null. */
  function remove(id) {
    const record = byId.get(id);
    if (!record) return null;
    const removed = [];
    for (const child of childrenOf(id)) removed.push(...remove(child.id));
    occupy(record, false);
    items.splice(items.indexOf(record), 1);
    byId.delete(id);
    slotsUsed.delete(id);
    removed.push(record);
    return removed;
  }

  /** Moves a floor item if the target is free. Children follow because they are relative. */
  function move(id, gx, gz) {
    const record = byId.get(id);
    if (!record || record.parent || record.wall || !canPlace(record.type, gx, gz, record.rot, id)) return false;
    occupy(record, false);
    record.gx = gx; record.gz = gz;
    occupy(record, true);
    return true;
  }

  /** Rotates a quarter turn in place if it still fits. Wall items do not rotate. */
  function rotate(id) {
    const record = byId.get(id);
    if (!record || record.wall) return false;
    return transform(id, { rot: (record.rot + 1) % 4 });
  }

  /** Sets any of gx, gz, rot at once if the result fits. Surface items only rotate; wall items refuse. */
  function transform(id, { gx, gz, rot }) {
    const record = byId.get(id);
    if (!record || record.wall) return false;
    if (record.parent) {
      if (gx != null || gz != null) return false;
      record.rot = rot ?? record.rot;
      return true;
    }
    const next = { gx: gx ?? record.gx, gz: gz ?? record.gz, rot: rot ?? record.rot };
    if (!canPlace(record.type, next.gx, next.gz, next.rot, id)) return false;
    occupy(record, false);
    Object.assign(record, next);
    occupy(record, true);
    return true;
  }

  /** Moves a surface item to another slot or supporter. Returns true on success. */
  function place(id, parentId, slot) {
    const record = byId.get(id);
    if (!record || !record.parent || parentId === id) return false;
    if (!canPlaceOn(record.type, parentId, slot, id)) return false;
    occupy(record, false);
    record.parent = parentId; record.slot = slot;
    occupy(record, true);
    return true;
  }

  /** Moves a wall item to another spot on either wall. Returns true on success. */
  function mount(id, wall, col, row) {
    const record = byId.get(id);
    if (!record || !record.wall || !canMount(record.type, wall, col, row, id)) return false;
    occupy(record, false);
    record.wall = wall; record.col = col; record.row = row;
    occupy(record, true);
    return true;
  }

  /**
   * Placement data for a copy of `id` in the nearest free spot of the same kind:
   * { gx, gz } for floor items, { parent, slot } for surface items, { wall, col, row } for wall items.
   * Returns null when nothing nearby is free.
   */
  function findFreeNear(id) {
    const record = byId.get(id);
    if (!record) return null;
    if (record.parent) {
      const count = placement.slotCount(byId.get(record.parent).type);
      for (let d = 1; d < count; d++) {
        for (const slot of [record.slot + d, record.slot - d]) {
          if (slot >= 0 && slot < count && canPlaceOn(record.type, record.parent, slot)) return { parent: record.parent, slot };
        }
      }
      return null;
    }
    if (record.wall) {
      // Try beside first, then rows above and below, nearest first.
      for (let d = 1; d <= placement.room + placement.wallRows; d++) {
        for (let dc = -d; dc <= d; dc++) {
          const dr = d - Math.abs(dc);
          for (const [col, row] of [[record.col + dc, record.row + dr], [record.col + dc, record.row - dr]]) {
            if (canMount(record.type, record.wall, col, row)) return { wall: record.wall, col, row };
          }
        }
      }
      return null;
    }
    for (let d = 1; d <= placement.room * 2; d++) {
      for (let dx = -d; dx <= d; dx++) {
        const dz = d - Math.abs(dx);
        for (const [gx, gz] of [[record.gx + dx, record.gz + dz], [record.gx + dx, record.gz - dz]]) {
          if (canPlace(record.type, gx, gz, record.rot)) return { gx, gz };
        }
      }
    }
    return null;
  }

  /** Switches a lamp on or off. Returns false for non-lamps. */
  function setLit(id, on) {
    const record = byId.get(id);
    if (!record || record.lit === null) return false;
    record.lit = !!on;
    return true;
  }

  function setColor(id, color) {
    const record = byId.get(id);
    if (!record) return false;
    record.color = color;
    return true;
  }

  function clear() {
    items.length = 0;
    byId.clear();
    occupancy.clear();
    wallOccupancy.clear();
    slotsUsed.clear();
  }

  /** Plain copies of every record, parents before their children, safe to JSON.stringify. */
  function serialize() {
    const copy = ({ id, type, gx, gz, rot, color, parent, slot, wall, col, row, lit }) => ({ id, type, gx, gz, rot, color, parent, slot, wall, col, row, lit });
    return [...items.filter((r) => !r.parent), ...items.filter((r) => r.parent)].map(copy);
  }

  return { items, occupancy, wallOccupancy, slotsUsed, get, childrenOf, canPlace, canPlaceOn, canMount, findFreeNear, add, remove, move, rotate, transform, place, mount, setColor, setLit, clear, serialize, cellKey };
}
