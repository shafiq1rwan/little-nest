import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';
import { parseRoom, migrateRoom, SaveError, CURRENT_VERSION, LEGACY_ROOM } from '../../src/persistence/schema.js';
import { ROOM_PRESETS, DEFAULT_PRESET, WALL_HEIGHT, MIN_ROOM_SIZE, MAX_ROOM_SIZE, presetFixtures } from '../../src/data/presets.js';

// The real catalog's footprints and surfaces, without Three.js: only the fields the rules read.
const catalog = {
  rug: { w: 4, d: 3, layer: 'floor' }, sofa: { w: 3, d: 1 }, armchair: { w: 1, d: 1 }, bookshelf: { w: 2, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }] } },
  floorLamp: { w: 1, d: 1 }, sideboard: { w: 2, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }, { x: 0, z: 0 }] } }, chair: { w: 1, d: 1 },
  coffeeTable: { w: 2, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }, { x: 0, z: 0 }] } }, desk: { w: 2, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }] } },
  sideTable: { w: 1, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }] } }, pouf: { w: 1, d: 1 }, basket: { w: 1, d: 1 },
  rubberTree: { w: 1, d: 1 }, palm: { w: 1, d: 1 }, snakePlant: { w: 1, d: 1 }, plant: { w: 1, d: 1 }, cactus: { w: 1, d: 1 }, monstera: { w: 1, d: 1 }, fern: { w: 1, d: 1 },
  mug: { w: 1, d: 1, layer: 'surface' }, frame: { w: 1, d: 1, layer: 'surface' }, lantern: { w: 1, d: 1, layer: 'surface' }, candle: { w: 1, d: 1, layer: 'surface' }, succulent: { w: 1, d: 1, layer: 'surface' }, bookStack: { w: 1, d: 1, layer: 'surface' },
  worldMap: { w: 2, d: 1, layer: 'wall', wall: { w: 2, h: 3 } }, botanicalPrint: { w: 2, d: 1, layer: 'wall', wall: { w: 2, h: 3 } }, clock: { w: 1, d: 1, layer: 'wall', wall: { w: 1, h: 1 } },
  wallShelf: { w: 2, d: 1, layer: 'wall', wall: { w: 2, h: 1 }, surface: { y: 0.4, slots: [{ x: 0, z: 0 }, { x: 0, z: 0 }] } }, macrame: { w: 1, d: 1, layer: 'wall', wall: { w: 1, h: 3 } },
};
const placementFor = (room) => createPlacement({ catalog, width: room.width, depth: room.depth, wallRows: WALL_HEIGHT / 0.5 });
const wallBlockedFor = (room) => placementFor(room).blockedWallCells(presetFixtures({ ...ROOM_PRESETS[room.preset], width: room.width, depth: room.depth }));
let n = 0;
const opts = { catalog, placementFor, wallBlockedFor, presets: ROOM_PRESETS, maxItems: 200, newId: () => 'n' + n++, sizeRange: [MIN_ROOM_SIZE, MAX_ROOM_SIZE] };

/** Turns a preset's starter list into saved-room items the way main.js does. */
function layoutOf(presetId) {
  const preset = ROOM_PRESETS[presetId];
  const byKey = new Map();
  const items = preset.items.map((it, i) => {
    const id = 'p' + i;
    if (it.key) byKey.set(it.key, id);
    return { id, type: it.type, rot: it.wall ? 0 : it.rot ?? 0, color: it.color ?? null, gx: it.on || it.wall ? null : it.gx, gz: it.on || it.wall ? null : it.gz, parent: it.on ? byKey.get(it.on) : null, slot: it.on ? it.slot : null, wall: it.wall ?? null, col: it.wall ? it.col : null, row: it.wall ? it.row : null };
  });
  return { version: CURRENT_VERSION, room: { preset: presetId, width: preset.width, depth: preset.depth }, wall: 1, floor: 2, items };
}

test('placement handles rectangular rooms', () => {
  const p = createPlacement({ catalog, width: 6, depth: 4 });
  expect(p.inBounds(5, 3, 1, 1)).toBe(true);
  expect(p.inBounds(5, 4, 1, 1)).toBe(false);
  expect(p.inBounds(6, 3, 1, 1)).toBe(false);
  expect(p.worldPos('armchair', 0, 0, 0)).toEqual({ x: -2.5, y: 0, z: -1.5 });
  expect(p.wallColumns('back')).toBe(6);
  expect(p.wallColumns('left')).toBe(4);
  expect(p.wallInBounds(5, 0, 1, 1, 'back')).toBe(true);
  expect(p.wallInBounds(5, 0, 1, 1, 'left')).toBe(false);
  expect(p.wallWorld('clock', 'left', 3, 2)).toEqual({ x: -3, y: 1, z: 1.5, rotY: Math.PI / 2 });
  p.configure({ width: 8, depth: 8 });
  expect(p.width).toBe(8);
  expect(p.worldPos('armchair', 0, 0, 0)).toEqual({ x: -3.5, y: 0, z: -3.5 });
});

test('every preset is well formed and its starter layout validates in its own room', () => {
  expect(ROOM_PRESETS[DEFAULT_PRESET]).toBeTruthy();
  for (const [id, preset] of Object.entries(ROOM_PRESETS)) {
    expect(preset.name, id).toBeTruthy();
    expect(preset.width, id).toBeGreaterThanOrEqual(MIN_ROOM_SIZE);
    expect(preset.depth, id).toBeLessThanOrEqual(MAX_ROOM_SIZE);
    for (const w of preset.windows) expect(['back', 'left'], id + ' window wall').toContain(w.wall);
    const parsed = parseRoom(layoutOf(id), opts);
    expect(parsed.items.length, id + ' items').toBe(preset.items.length);
    expect(parsed.room).toEqual({ preset: id, width: preset.width, depth: preset.depth });
    expect(preset.items.filter((it) => it.select).length, id + ' has exactly one selected starter item').toBe(1);
  }
  expect(Object.keys(ROOM_PRESETS).length).toBeGreaterThanOrEqual(3);
});

test('older saves migrate to the 8 x 8 living room and bad rooms are refused', () => {
  const old = { version: 5, wall: 1, floor: 2, items: [{ id: 'c', type: 'chair', gx: 7, gz: 7, rot: 0, color: null, parent: null, slot: null, wall: null, col: null, row: null }] };
  expect(migrateRoom(old).room).toEqual(LEGACY_ROOM);
  expect(parseRoom(old, opts).room).toEqual({ preset: 'livingRoom', width: 8, depth: 8 });
  // The same chair at 7,7 does not fit a 6 x 6 studio.
  const studio = { ...old, version: 6, room: { preset: 'studio', width: 6, depth: 6 } };
  expect(() => parseRoom(studio, opts)).toThrow('Out of bounds');
  const cases = [
    [{ ...old, version: 6, room: null }, 'Invalid room'],
    [{ ...old, version: 6, room: { preset: 'attic', width: 8, depth: 8 } }, 'Unknown room preset'],
    [{ ...old, version: 6, room: { preset: 'livingRoom', width: 2, depth: 8 } }, 'Invalid room size'],
    [{ ...old, version: 6, room: { preset: 'livingRoom', width: 8, depth: 40 } }, 'Invalid room size'],
    [{ ...old, version: 7 }, 'Unsupported save version'],
  ];
  for (const [data, message] of cases) {
    expect(() => parseRoom(data, opts), message).toThrow(SaveError);
    expect(() => parseRoom(data, opts)).toThrow(message);
  }
});

test('replaceRoom with a different shell emits room after clearing and undo restores the old shell', () => {
  const placement = placementFor({ width: 8, depth: 8 });
  const state = createRoomState({ placement });
  const room = { preset: 'livingRoom', width: 8, depth: 8 };
  const commands = createCommands({ state, finishes: { wall: 0, floor: 0 }, room });
  const events = [];
  commands.subscribe((k, p) => { events.push(k); if (k === 'room') placement.configure(p); });
  commands.add({ type: 'chair', gx: 7, gz: 7 });
  events.length = 0;
  commands.replaceRoom({ room: { preset: 'studio', width: 6, depth: 6 }, wall: 1, floor: 2, items: [{ id: 's', type: 'chair', gx: 5, gz: 5, rot: 0 }] });
  expect(events.slice(0, 2)).toEqual(['remove', 'room']);   // items leave before the shell changes
  expect(room).toEqual({ preset: 'studio', width: 6, depth: 6 });
  expect(placement.width).toBe(6);
  expect(state.get('s')).toBeTruthy();
  commands.undo();
  expect(room).toEqual({ preset: 'livingRoom', width: 8, depth: 8 });
  expect(placement.width).toBe(8);
  expect(state.items.map((i) => i.gx)).toEqual([7]);
  // Same shell: no room event.
  events.length = 0;
  commands.replaceRoom({ wall: 3, floor: 4, items: [] });
  expect(events).not.toContain('room');
});
