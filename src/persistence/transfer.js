// Export and import of a single room as a JSON file. No Three.js and no DOM.
//
// File envelope (format 1):
//   { "app": "little-nest", "format": 1, "exportedAt": ISO string, "name": string, "room": <saved room> }
// A bare saved room (an object with an `items` array) is also accepted on import for convenience.

import { parseRoom, SaveError } from './schema.js';
import { cleanName } from './gallery.js';

export const EXPORT_APP = 'little-nest';
export const EXPORT_FORMAT = 1;
export const FILE_SUFFIX = '.littlenest.json';
export const MAX_IMPORT_BYTES = 1_000_000;

export function exportFilename(name) {
  const slug = cleanName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';
  return slug + FILE_SUFFIX;
}

/** Builds the file text for a room. */
export function exportRoom({ name, room, now = () => new Date().toISOString() }) {
  const envelope = { app: EXPORT_APP, format: EXPORT_FORMAT, exportedAt: now(), name: cleanName(name), room };
  return { filename: exportFilename(name), text: JSON.stringify(envelope, null, 2) };
}

/**
 * Parses file text into { name, room } with a validated, migrated room, or throws SaveError.
 * `fallbackName` is used when the file carries no name (for example a bare room).
 */
export function parseImport(text, { catalog, placement, maxItems, newId, wallBlocked = new Set(), fallbackName = 'Imported room' }) {
  if (typeof text !== 'string') throw new SaveError('Not a file');
  if (text.length > MAX_IMPORT_BYTES) throw new SaveError('File too large');
  let data;
  try { data = JSON.parse(text); } catch { throw new SaveError('Not JSON'); }
  if (!data || typeof data !== 'object') throw new SaveError('Not a room file');

  let name = fallbackName;
  let raw = data;
  if ('app' in data || 'format' in data) {
    if (data.app !== EXPORT_APP) throw new SaveError('Not a Little Nest file');
    if (data.format !== EXPORT_FORMAT) throw new SaveError('Unsupported file format ' + data.format);
    if (!data.room || typeof data.room !== 'object') throw new SaveError('Missing room');
    if (typeof data.name === 'string') name = data.name;
    raw = data.room;
  } else if (!Array.isArray(data.items)) {
    throw new SaveError('Not a room file');
  }
  const room = parseRoom(raw, { catalog, placement, maxItems, newId, wallBlocked });
  return { name: cleanName(name, fallbackName), room };
}
