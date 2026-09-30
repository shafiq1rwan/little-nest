// Committed room state: serializable item records and the occupancy derived from them.
// Records are { id, type, gx, gz, rot, color }. Meshes live elsewhere, keyed by id.
// No Three.js and no DOM.

import { cellKey } from './placement.js';

export function newItemId() {
  return 'i' + Math.random().toString(36).slice(2, 10);
}

export function createRoomState({ placement }) {
  const items = [];
  const occupancy = new Set();
  const byId = new Map();

  function occupy(record, on) {
    if (!placement.occupies(record.type)) return;
    for (const c of placement.cellsOf(record.type, record.gx, record.gz, record.rot).cells) {
      if (on) occupancy.add(c); else occupancy.delete(c);
    }
  }

  function ownCells(record) {
    if (!placement.occupies(record.type)) return null;
    return new Set(placement.cellsOf(record.type, record.gx, record.gz, record.rot).cells);
  }

  function get(id) {
    return byId.get(id) || null;
  }

  /** True when the footprint fits, ignoring the cells of `ignoreId` (an item being moved). */
  function canPlace(type, gx, gz, rot, ignoreId = null) {
    const own = ignoreId ? ownCells(byId.get(ignoreId)) : null;
    return placement.isFree(occupancy, type, gx, gz, rot, own);
  }

  /** Adds a record. Returns it, or null when the position is not free. */
  function add({ type, gx, gz, rot = 0, color = null, id = null }) {
    if (!canPlace(type, gx, gz, rot)) return null;
    let key = id;
    while (!key || byId.has(key)) key = newItemId();
    const record = { id: key, type, gx, gz, rot, color };
    items.push(record);
    byId.set(key, record);
    occupy(record, true);
    return record;
  }

  function remove(id) {
    const record = byId.get(id);
    if (!record) return false;
    occupy(record, false);
    items.splice(items.indexOf(record), 1);
    byId.delete(id);
    return true;
  }

  /** Moves an item if the target is free. Returns true on success. */
  function move(id, gx, gz) {
    const record = byId.get(id);
    if (!record || !canPlace(record.type, gx, gz, record.rot, id)) return false;
    occupy(record, false);
    record.gx = gx; record.gz = gz;
    occupy(record, true);
    return true;
  }

  /** Rotates a quarter turn in place if it still fits. Returns true on success. */
  function rotate(id) {
    const record = byId.get(id);
    if (!record) return false;
    const next = (record.rot + 1) % 4;
    if (!canPlace(record.type, record.gx, record.gz, next, id)) return false;
    occupy(record, false);
    record.rot = next;
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
  }

  /** Plain copies of every record, safe to JSON.stringify. */
  function serialize() {
    return items.map(({ id, type, gx, gz, rot, color }) => ({ id, type, gx, gz, rot, color }));
  }

  return { items, occupancy, get, canPlace, add, remove, move, rotate, setColor, clear, serialize, cellKey };
}
