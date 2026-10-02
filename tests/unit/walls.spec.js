import { test, expect } from '@playwright/test';
import { createPlacement, wallKey } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';
import { parseRoom, serializeRoom, migrateRoom, SaveError, CURRENT_VERSION } from '../../src/persistence/schema.js';

const catalog = {
  chair: { w: 1, d: 1 },
  mug: { w: 1, d: 1, layer: 'surface' },
  clock: { w: 1, d: 1, layer: 'wall', wall: { w: 1, h: 1 } },
  print: { w: 2, d: 1, layer: 'wall', wall: { w: 2, h: 3 } },
  shelf: { w: 2, d: 1, layer: 'wall', wall: { w: 2, h: 1 }, surface: { y: 0.4, slots: [{ x: -0.5, z: 0.15 }] } },
  curtain: { w: 2, d: 1, layer: 'wall', overWindow: true, toggle: {}, wall: { w: 2, h: 5 } },
};
const placement = createPlacement({ catalog, room: 8, wallRows: 8, wallRow: 0.5 });
// A window across the left half of the back wall between 1.0 and 3.4 units up.
const blocked = placement.blockedWallCells([{ wall: 'back', from: -4, to: 0, bottom: 1.05, top: 3.4 }]);

test('wall geometry: sizes, bounds, cells, world placement, snapping, and blocked cells', () => {
  expect(placement.isWallItem('clock')).toBe(true);
  expect(placement.occupies('clock')).toBe(false);
  expect(placement.wallSize('print')).toEqual({ w: 2, h: 3 });
  expect(placement.wallSize('chair')).toBeNull();
  expect(placement.wallInBounds(7, 7, 1, 1)).toBe(true);
  expect(placement.wallInBounds(7, 7, 2, 1)).toBe(false);
  expect(placement.wallInBounds(0, 6, 1, 3)).toBe(false);
  expect(placement.wallCellsOf('left', 2, 1, 2, 2)).toEqual(['left:2,1', 'left:2,2', 'left:3,1', 'left:3,2']);

  // Back wall: col 0 starts at x = -4; left wall: col 0 starts at z = -4 and faces +x.
  expect(placement.wallWorld('clock', 'back', 0, 2)).toEqual({ x: -3.5, y: 1, z: -4, rotY: 0 });
  expect(placement.wallWorld('print', 'left', 5, 4)).toEqual({ x: -4, y: 2, z: 2, rotY: Math.PI / 2 });
  expect(placement.wallSnap('clock', 'back', { x: -3.4, y: 1.2, z: -4 })).toEqual({ col: 0, row: 2 });
  expect(placement.wallSnap('print', 'left', { x: -4, y: 2.7, z: 2.1 })).toEqual({ col: 5, row: 4 });

  // Blocked: cols 0-3, rows 2-6 (row 2 is 1.0-1.5 and overlaps 1.05; row 6 is 3.0-3.5 and overlaps 3.4).
  expect(blocked.has(wallKey('back', 0, 2))).toBe(true);
  expect(blocked.has(wallKey('back', 3, 6))).toBe(true);
  expect(blocked.has(wallKey('back', 3, 7))).toBe(false);
  expect(blocked.has(wallKey('back', 0, 1))).toBe(false);
  expect(blocked.has(wallKey('back', 4, 3))).toBe(false);
  expect(blocked.size).toBe(4 * 5);
  expect(placement.wallFree(new Set(), blocked, 'clock', 'back', 1, 3)).toBe(false);
  expect(placement.wallFree(new Set(), blocked, 'clock', 'back', 1, 1)).toBe(true);
  expect(placement.wallFree(new Set(), blocked, 'clock', 'up', 1, 1)).toBe(false);
  expect(placement.wallFree(new Set(), blocked, 'chair', 'back', 1, 1)).toBe(false);
});

test('state mounts wall items, tracks wall occupancy, refuses floor and rotation, and lets shelves carry small items', () => {
  const state = createRoomState({ placement, wallBlocked: blocked });
  expect(state.add({ type: 'clock', gx: 1, gz: 1 })).toBeNull();                       // wall items never go on the floor
  expect(state.add({ type: 'chair', wall: 'back', col: 5, row: 1 })).toBeNull();        // furniture never goes on a wall
  expect(state.add({ type: 'clock', wall: 'back', col: 1, row: 3 })).toBeNull();        // window
  const clock = state.add({ type: 'clock', wall: 'back', col: 5, row: 2, rot: 3 });
  expect(clock).toMatchObject({ wall: 'back', col: 5, row: 2, rot: 0, gx: null, gz: null });   // rot is forced to 0
  expect(state.wallOccupancy.has('back:5,2')).toBe(true);
  expect(state.occupancy.size).toBe(0);
  expect(state.add({ type: 'print', wall: 'back', col: 4, row: 1 })).toBeNull();        // overlaps the clock
  expect(state.add({ type: 'print', wall: 'back', col: 6, row: 7 })).toBeNull();        // off the top
  const print = state.add({ type: 'print', wall: 'back', col: 6, row: 0 });
  expect(state.wallOccupancy.size).toBe(1 + 6);

  expect(state.rotate(clock.id)).toBe(false);
  expect(state.move(clock.id, 2, 2)).toBe(false);
  expect(state.mount(clock.id, 'back', 6, 1)).toBe(false);                             // into the print
  expect(state.mount(clock.id, 'back', 5, 3)).toBe(true);                              // sliding over its own old cell is fine
  expect(state.mount(clock.id, 'left', 0, 0)).toBe(true);
  expect(state.wallOccupancy.has('left:0,0')).toBe(true);
  expect(state.wallOccupancy.has('back:5,3')).toBe(false);

  const shelf = state.add({ type: 'shelf', wall: 'left', col: 3, row: 4 });
  const mug = state.add({ type: 'mug', parent: shelf.id, slot: 0 });
  expect(mug).toBeTruthy();
  expect(state.mount(shelf.id, 'left', 4, 4)).toBe(true);                              // the mug rides along
  expect(state.remove(shelf.id).map((r) => r.type)).toEqual(['mug', 'shelf']);
  state.remove(print.id);
  expect(state.wallOccupancy.size).toBe(1);
  expect(state.serialize()[0]).toMatchObject({ wall: 'left', col: 0, row: 0, parent: null, slot: null });
});

test('mount is an undoable command and emits a transform', () => {
  const state = createRoomState({ placement, wallBlocked: blocked });
  const commands = createCommands({ state, finishes: { wall: 0, floor: 0 } });
  const events = [];
  commands.subscribe((k) => events.push(k));
  const clock = commands.add({ type: 'clock', wall: 'back', col: 5, row: 2 });
  events.length = 0;
  expect(commands.mount(clock.id, 'back', 5, 2)).toBe(false);          // no-op
  expect(commands.mount(clock.id, 'back', 1, 3)).toBe(false);          // window
  expect(commands.mount(clock.id, 'left', 2, 2)).toBe(true);
  expect(events).toEqual(['transform', 'history']);
  commands.undo();
  expect(state.get(clock.id)).toMatchObject({ wall: 'back', col: 5, row: 2 });
  commands.redo();
  expect(state.get(clock.id)).toMatchObject({ wall: 'left', col: 2, row: 2 });
  commands.remove(clock.id);
  commands.undo();
  expect(state.get(clock.id)).toMatchObject({ wall: 'left', col: 2, row: 2 });
});

test('schema version 5 validates wall items and migrates every older version', () => {
  let n = 0;
  const opts = { catalog, placement, maxItems: 10, newId: () => 'n' + n++, wallBlocked: blocked };
  const wallItem = (extra) => ({ id: 'w', type: 'clock', gx: null, gz: null, rot: 0, color: null, parent: null, slot: null, wall: 'back', col: 5, row: 2, ...extra });
  const parsed = parseRoom({ version: 5, wall: 1, floor: 2, items: [wallItem({ rot: 2 })] }, opts);
  expect(parsed.items[0]).toMatchObject({ wall: 'back', col: 5, row: 2, rot: 0 });
  expect(serializeRoom({ wall: 1, floor: 2, items: parsed.items }).version).toBe(CURRENT_VERSION);

  for (const version of [2, 3, 4]) {
    const old = { version, wall: 1, floor: 2, items: [{ id: version > 2 ? 'c' : undefined, type: 'chair', gx: 0, gz: 0, rot: 0 }] };
    expect(migrateRoom(old).version).toBe(CURRENT_VERSION);
    expect(parseRoom(old, opts).items[0]).toMatchObject({ wall: null, col: null, row: null, parent: null, slot: null });
  }
  expect(migrateRoom({ items: [] }).items).toEqual([]);   // unversioned counts as version 2

  const cases = [
    [[wallItem({ wall: 'roof' })], 'Unknown wall'],
    [[wallItem({ col: 1, row: 3 })], 'Wall spot not free'],                                     // window
    [[wallItem({ col: 7, row: 7, type: 'print' })], 'Wall spot not free'],                     // out of bounds
    [[wallItem({}), wallItem({ id: 'v' })], 'Wall spot not free'],                             // overlap
    [[wallItem({ col: 'a' })], 'Invalid position'],
    [[wallItem({ type: 'chair' })], 'Only wall decorations go on walls'],
    [[wallItem({ wall: null, gx: 1, gz: 1 })], 'Unknown wall'],                                 // wall item on the floor
  ];
  for (const [items, message] of cases) {
    expect(() => parseRoom({ version: 5, wall: 1, floor: 2, items }, opts), message).toThrow(SaveError);
    expect(() => parseRoom({ version: 5, wall: 1, floor: 2, items }, opts)).toThrow(message);
  }
});

test('curtains hang only on window cells, start open, and save their state', () => {
  const fixtures = [{ kind: 'window', wall: 'back', from: -4, to: 0, bottom: 1.05, top: 3.4 }, { kind: 'light', wall: 'back', from: 2.9, to: 3.8, bottom: 3.2, top: 3.65 }];
  const windows = placement.windowWallCells(fixtures);
  const all = placement.blockedWallCells(fixtures);
  expect(windows.size).toBeLessThan(all.size);   // the light string blocks cells but is not a window
  const state = createRoomState({ placement, wallBlocked: all, wallWindows: windows });
  expect(state.canMount('curtain', 'back', 0, 2)).toBe(true);
  expect(state.canMount('curtain', 'back', 3, 2)).toBe(false);   // half over the wall
  expect(state.canMount('curtain', 'back', 0, 1)).toBe(false);   // below the sill
  expect(state.canMount('clock', 'back', 0, 3)).toBe(false);     // decorations still avoid windows
  const c = state.add({ type: 'curtain', wall: 'back', col: 0, row: 2 });
  expect(c.lit).toBe(true);
  expect(state.canMount('curtain', 'back', 1, 2)).toBe(false);   // overlaps the first pair
  state.setLit(c.id, false);
  const saved = serializeRoom({ items: state.serialize(), wall: 0, floor: 0, room: { preset: 'livingRoom', width: 8, depth: 8 }, lighting: 'morning' });
  const parsed = parseRoom(saved, { catalog, placement, newId: () => 'x', wallBlocked: all, wallWindowsFor: () => windows });
  expect(parsed.items.find((i) => i.type === 'curtain')).toMatchObject({ lit: false, col: 0, row: 2 });
  expect(() => parseRoom(saved, { catalog, placement, newId: () => 'x', wallBlocked: all })).toThrow(SaveError);   // without window cells the spot is invalid
});
