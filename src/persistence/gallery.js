// Named room saves. Entries are stored together under one key:
//   { version: 1, rooms: [{ id, name, updatedAt, room }] }
// where `room` is the saved-room shape from schema.js. Rooms are validated on read, never on
// list, so one corrupt entry cannot hide the others. No Three.js and no DOM.

import { readJSON, writeJSON, readString } from './storage.js';
import { parseRoom, SaveError } from './schema.js';

export const GALLERY_VERSION = 1;
export const MAX_NAME_LENGTH = 40;
export const DEFAULT_ROOM_NAME = 'Living room';

export function cleanName(name, fallback = DEFAULT_ROOM_NAME) {
  const trimmed = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
}

export function createGallery({ key, legacyKey = null, catalog, placement, placementFor, presets, maxItems, newId, wallBlocked = new Set(), wallWindowsFor = null, wallBlockedFor, now = () => new Date().toISOString(), maxRooms = 50 }) {
  const parseOptions = { catalog, placement, placementFor, presets, maxItems, newId, wallBlocked, wallBlockedFor, wallWindowsFor };
  function readAll() {
    const data = readJSON(key);
    if (!data || data.version !== GALLERY_VERSION || !Array.isArray(data.rooms)) return [];
    return data.rooms.filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && e.room && typeof e.room === 'object');
  }
  function writeAll(rooms) {
    return writeJSON(key, { version: GALLERY_VERSION, rooms });
  }
  function entryId() {
    return 'r' + Math.random().toString(36).slice(2, 10);
  }
  function summary(e) {
    return { id: e.id, name: cleanName(e.name), updatedAt: e.updatedAt ?? null, itemCount: Array.isArray(e.room.items) ? e.room.items.length : 0, preset: e.room.room?.preset ?? 'livingRoom' };
  }

  /** Newest first. */
  function list() {
    return readAll().map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  function has(id) {
    return readAll().some((e) => e.id === id);
  }
  /** Validated room for an entry, or throws SaveError. */
  function load(id) {
    const entry = readAll().find((e) => e.id === id);
    if (!entry) throw new SaveError('No such room');
    return { ...summary(entry), room: parseRoom(entry.room, parseOptions) };
  }
  /** Creates (id null) or overwrites an entry. Returns its summary, or null when storage refused. */
  function save(id, name, room) {
    const rooms = readAll();
    const existing = id ? rooms.find((e) => e.id === id) : null;
    if (!existing && rooms.length >= maxRooms) return null;
    const entry = existing || { id: entryId() };
    entry.name = cleanName(name ?? existing?.name);
    entry.room = room;
    entry.updatedAt = now();
    if (!existing) rooms.push(entry);
    return writeAll(rooms) ? summary(entry) : null;
  }
  function rename(id, name) {
    const rooms = readAll();
    const entry = rooms.find((e) => e.id === id);
    if (!entry) return null;
    entry.name = cleanName(name, entry.name);
    return writeAll(rooms) ? summary(entry) : null;
  }
  function duplicate(id) {
    const rooms = readAll();
    const source = rooms.find((e) => e.id === id);
    if (!source || rooms.length >= maxRooms) return null;
    const copy = { id: entryId(), name: cleanName(source.name + ' copy'), updatedAt: now(), room: JSON.parse(JSON.stringify(source.room)) };
    rooms.push(copy);
    return writeAll(rooms) ? summary(copy) : null;
  }
  function remove(id) {
    const rooms = readAll();
    const next = rooms.filter((e) => e.id !== id);
    if (next.length === rooms.length) return false;
    return writeAll(next);
  }
  /**
   * Imports the pre-gallery single save (if any) as an entry the first time the gallery is empty.
   * The legacy key is left untouched so older builds keep working. Returns the new summary or null.
   */
  function migrateLegacy() {
    if (!legacyKey || readAll().length || readString(legacyKey) === null) return null;
    const raw = readJSON(legacyKey);
    try { parseRoom(raw, parseOptions); } catch { return null; }
    return save(null, DEFAULT_ROOM_NAME, raw);
  }

  return { list, has, load, save, rename, duplicate, remove, migrateLegacy };
}
