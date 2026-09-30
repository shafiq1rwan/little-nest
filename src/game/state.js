// Committed room state: serializable item records and the occupancy derived from them.
// Records are { id, type, gx, gz, rot, color, parent, slot }.
//   floor items:   parent null, slot null, gx/gz on the grid
//   surface items: parent = supporting item id, slot = index on its surface, gx/gz null
// Meshes live elsewhere, keyed by id. No Three.js and no DOM.

import { cellKey } from './placement.js';

export function newItemId() {
  return 'i' + Math.random().toString(36).slice(2, 10);
}

export function createRoomState({ placement }) {
  const items = [];
  const occupancy = new Set();          // floor cells in use
  const slotsUsed = new Map();          // parent id -> Set of slot indexes in use
  const byId = new Map();

  function occupy(record, on) {
    if (record.parent) {
      if (!slotsUsed.has(record.parent)) slotsUsed.set(record.parent, new Set());
      const set = slotsUsed.get(record.parent);
      if (on) set.add(record.slot); else set.delete(record.slot);
      return;
    }
    if (!placement.occupies(record.type)) return;
    for (const c of placement.cellsOf(record.type, record.gx, record.gz, record.rot).cells) {
      if (on) occupancy.add(c); else occupancy.delete(c);
    }
  }

  function ownCells(record) {
    if (record.parent || !placement.occupies(record.type)) return null;
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
    if (placement.isSurfaceItem(type)) return false;
    const own = ignoreId ? ownCells(byId.get(ignoreId)) : null;
    return placement.isFree(occupancy, type, gx, gz, rot, own);
  }
  /** True when a surface item can sit in `slot` of `parentId`, ignoring `ignoreId` (the item itself while moving). */
  function canPlaceOn(type, parentId, slot, ignoreId = null) {
    const parent = byId.get(parentId);
    if (!parent || !placement.isSurfaceItem(type) || parent.parent) return false;
    if (!placement.slotLocal(parent.type, slot)) return false;
    const used = slotsUsed.get(parentId);
    if (!used || !used.has(slot)) return true;
    const occupant = items.find((r) => r.parent === parentId && r.slot === slot);
    return !!occupant && occupant.id === ignoreId;
  }

  /** Adds a record. Returns it, or null when the position is not free. */
  function add({ type, gx = null, gz = null, rot = 0, color = null, id = null, parent = null, slot = null }) {
    if (parent ? !canPlaceOn(type, parent, slot) : !canPlace(type, gx, gz, rot)) return null;
    let key = id;
    while (!key || byId.has(key)) key = newItemId();
    const record = parent
      ? { id: key, type, gx: null, gz: null, rot, color, parent, slot }
      : { id: key, type, gx, gz, rot, color, parent: null, slot: null };
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
    if (!record || record.parent || !canPlace(record.type, gx, gz, record.rot, id)) return false;
    occupy(record, false);
    record.gx = gx; record.gz = gz;
    occupy(record, true);
    return true;
  }

  /** Rotates a quarter turn in place if it still fits. Returns true on success. */
  function rotate(id) {
    const record = byId.get(id);
    if (!record) return false;
    return transform(id, { rot: (record.rot + 1) % 4 });
  }

  /** Sets any of gx, gz, rot at once if the result fits. Surface items only rotate. */
  function transform(id, { gx, gz, rot }) {
    const record = byId.get(id);
    if (!record) return false;
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
    slotsUsed.clear();
  }

  /** Plain copies of every record, parents before their children, safe to JSON.stringify. */
  function serialize() {
    const copy = ({ id, type, gx, gz, rot, color, parent, slot }) => ({ id, type, gx, gz, rot, color, parent, slot });
    return [...items.filter((r) => !r.parent), ...items.filter((r) => r.parent)].map(copy);
  }

  return { items, occupancy, slotsUsed, get, childrenOf, canPlace, canPlaceOn, add, remove, move, rotate, transform, place, setColor, clear, serialize, cellKey };
}
