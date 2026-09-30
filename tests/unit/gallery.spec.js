import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createGallery, cleanName, DEFAULT_ROOM_NAME } from '../../src/persistence/gallery.js';
import { SaveError } from '../../src/persistence/schema.js';

// In-memory stand-in for browser storage so the module runs in Node.
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

const catalog = { sofa: { w: 3, d: 1 }, plant: { w: 1, d: 1 } };
const placement = createPlacement({ catalog, room: 8 });
const room = (n = 1) => ({ version: 3, wall: 1, floor: 2, items: Array.from({ length: n }, (_, i) => ({ id: 'i' + i, type: 'plant', gx: i, gz: 0, rot: 0, color: null })) });

let clock = 0;
function setup(opts = {}) {
  globalThis.localStorage = fakeStorage();
  clock = 0;
  return createGallery({ key: 'rooms', legacyKey: 'legacy', catalog, placement, maxItems: 10, newId: () => 'n' + clock++, now: () => '2026-09-30T00:00:0' + clock++ + 'Z', ...opts });
}

test('names are trimmed, collapsed, capped, and defaulted', () => {
  expect(cleanName('  Cosy   nook  ')).toBe('Cosy nook');
  expect(cleanName('')).toBe(DEFAULT_ROOM_NAME);
  expect(cleanName(null, 'x')).toBe('x');
  expect(cleanName('a'.repeat(60))).toHaveLength(40);
});

test('save, list, load, rename, duplicate, remove', () => {
  const g = setup();
  expect(g.list()).toEqual([]);
  const a = g.save(null, 'First', room(2));
  const b = g.save(null, '', room(1));
  expect(b.name).toBe(DEFAULT_ROOM_NAME);
  expect(g.list().map((e) => e.name)).toEqual([DEFAULT_ROOM_NAME, 'First']);   // newest first
  expect(g.list()[1]).toMatchObject({ id: a.id, itemCount: 2 });

  const loaded = g.load(a.id);
  expect(loaded.name).toBe('First');
  expect(loaded.room.items.map((i) => i.id)).toEqual(['i0', 'i1']);

  expect(g.save(a.id, undefined, room(3)).itemCount).toBe(3);   // overwrite keeps the name
  expect(g.load(a.id).name).toBe('First');
  expect(g.rename(a.id, ' Renamed ').name).toBe('Renamed');
  expect(g.rename('nope', 'x')).toBeNull();

  const copy = g.duplicate(a.id);
  expect(copy.name).toBe('Renamed copy');
  expect(copy.id).not.toBe(a.id);
  expect(g.load(copy.id).room.items).toHaveLength(3);

  expect(g.remove(a.id)).toBe(true);
  expect(g.remove(a.id)).toBe(false);
  expect(g.has(a.id)).toBe(false);
  expect(() => g.load(a.id)).toThrow(SaveError);
  expect(g.list()).toHaveLength(2);
});

test('a corrupt entry fails to load but does not hide the others', () => {
  const g = setup();
  const ok = g.save(null, 'Good', room(1));
  const raw = JSON.parse(localStorage.getItem('rooms'));
  raw.rooms.push({ id: 'bad', name: 'Bad', updatedAt: 'z', room: { items: null } });
  raw.rooms.push(null);
  raw.rooms.push({ id: 7, room: {} });
  localStorage.setItem('rooms', JSON.stringify(raw));
  expect(g.list().map((e) => e.id)).toEqual(['bad', ok.id]);
  expect(() => g.load('bad')).toThrow(SaveError);
  expect(g.load(ok.id).name).toBe('Good');
});

test('unknown store versions and garbage are treated as empty', () => {
  const g = setup();
  localStorage.setItem('rooms', '{"version":99,"rooms":[{"id":"x","room":{}}]}');
  expect(g.list()).toEqual([]);
  localStorage.setItem('rooms', 'not json');
  expect(g.list()).toEqual([]);
});

test('the legacy single save is imported once, and only into an empty gallery', () => {
  const g = setup();
  expect(g.migrateLegacy()).toBeNull();
  localStorage.setItem('legacy', JSON.stringify({ version: 2, wall: 1, floor: 2, items: [{ type: 'sofa', gx: 0, gz: 0, rot: 0 }] }));
  const imported = g.migrateLegacy();
  expect(imported).toMatchObject({ name: DEFAULT_ROOM_NAME, itemCount: 1 });
  expect(g.load(imported.id).room.items[0].id).toMatch(/^n/);
  expect(g.migrateLegacy()).toBeNull();                  // gallery is no longer empty
  expect(localStorage.getItem('legacy')).not.toBeNull(); // legacy key is kept
  g.remove(imported.id);
  localStorage.setItem('legacy', '{"items":null}');
  expect(g.migrateLegacy()).toBeNull();                  // invalid legacy data is ignored
});

test('room cap and storage failures return null instead of throwing', () => {
  const g = setup({ maxRooms: 2 });
  g.save(null, 'a', room());
  const b = g.save(null, 'b', room());
  expect(g.save(null, 'c', room())).toBeNull();
  expect(g.duplicate(b.id)).toBeNull();
  expect(g.save(b.id, 'b2', room(2))).not.toBeNull();   // overwriting is always allowed
  localStorage.setItem = () => { throw new Error('quota'); };
  expect(g.save(b.id, 'b3', room())).toBeNull();
  expect(g.rename(b.id, 'x')).toBeNull();
  expect(g.remove(b.id)).toBe(false);
});
