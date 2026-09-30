import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';
import { parseRoom, serializeRoom, SaveError } from '../../src/persistence/schema.js';

const catalog = {
  table: { w: 2, d: 1, surface: { y: 0.5, slots: [{ x: -0.5, z: 0 }, { x: 0.5, z: 0 }] } },
  shelf: { w: 2, d: 1, surface: { y: 0.8, slots: [{ x: 0, z: 0 }, { x: 0, z: 0, y: 1.3 }] } },
  chair: { w: 1, d: 1 },
  mug: { w: 1, d: 1, layer: 'surface' },
  vase: { w: 1, d: 1, layer: 'surface' },
};
const placement = createPlacement({ catalog, room: 8 });

test('placement exposes slots and finds the nearest one', () => {
  expect(placement.isSurfaceItem('mug')).toBe(true);
  expect(placement.isSurfaceItem('table')).toBe(false);
  expect(placement.occupies('mug')).toBe(false);
  expect(placement.slotCount('table')).toBe(2);
  expect(placement.slotCount('chair')).toBe(0);
  expect(placement.slotLocal('table', 1)).toEqual({ x: 0.5, y: 0.5, z: 0 });
  expect(placement.slotLocal('shelf', 1)).toEqual({ x: 0, y: 1.3, z: 0 });   // per-slot height override
  expect(placement.slotLocal('table', 2)).toBeNull();
  expect(placement.nearestSlot('table', { x: 0.3, z: 0.1 })).toBe(1);
  expect(placement.nearestSlot('chair', { x: 0, z: 0 })).toBe(-1);
});

test('state places small items in slots, refuses the floor, and cascades removal', () => {
  const state = createRoomState({ placement });
  const table = state.add({ type: 'table', gx: 1, gz: 1 });
  expect(state.add({ type: 'mug', gx: 4, gz: 4 })).toBeNull();                  // small items never sit on the floor
  expect(state.add({ type: 'mug', parent: table.id, slot: 5 })).toBeNull();     // no such slot
  expect(state.add({ type: 'chair', parent: table.id, slot: 0 })).toBeNull();   // furniture cannot sit on a table
  const mug = state.add({ type: 'mug', parent: table.id, slot: 0 });
  expect(mug).toMatchObject({ gx: null, gz: null, parent: table.id, slot: 0 });
  expect(state.occupancy.size).toBe(2);                                          // the mug takes no floor cells
  expect(state.add({ type: 'vase', parent: table.id, slot: 0 })).toBeNull();    // slot taken
  const vase = state.add({ type: 'vase', parent: table.id, slot: 1 });
  expect(state.add({ type: 'mug', parent: mug.id, slot: 0 })).toBeNull();       // nothing stacks on a mug

  expect(state.move(mug.id, 3, 3)).toBe(false);                                  // surface items move with place()
  expect(state.place(mug.id, table.id, 1)).toBe(false);                          // occupied by the vase
  expect(state.place(vase.id, table.id, 1)).toBe(true);                          // same slot is fine here; commands.place filters no-ops
  state.remove(vase.id);
  expect(state.place(mug.id, table.id, 1)).toBe(true);
  expect(state.rotate(mug.id)).toBe(true);

  expect(state.move(table.id, 4, 4)).toBe(true);                                 // children stay attached
  expect(state.childrenOf(table.id).map((c) => c.id)).toEqual([mug.id]);
  const removed = state.remove(table.id);
  expect(removed.map((r) => r.id)).toEqual([mug.id, table.id]);                  // children first
  expect(state.items).toHaveLength(0);
  expect(state.slotsUsed.size).toBe(0);
});

test('commands cascade removal into one entry and undo restores parent and child', () => {
  const state = createRoomState({ placement });
  const commands = createCommands({ state, finishes: { wall: 0, floor: 0 } });
  const events = [];
  commands.subscribe((k, p) => events.push(k + ':' + (p?.id ?? '')));
  const table = commands.add({ type: 'table', gx: 1, gz: 1 });
  const mug = commands.add({ type: 'mug', parent: table.id, slot: 0 });
  events.length = 0;
  expect(commands.remove(table.id)).toBe(true);
  expect(events.filter((e) => e.startsWith('remove'))).toEqual(['remove:' + mug.id, 'remove:' + table.id]);
  expect(state.items).toHaveLength(0);
  commands.undo();
  expect(state.get(table.id)).toBeTruthy();
  expect(state.get(mug.id)).toMatchObject({ parent: table.id, slot: 0 });
  commands.redo();
  expect(state.items).toHaveLength(0);
  commands.undo();

  // Moving a small item between slots is undoable and emits a transform.
  events.length = 0;
  expect(commands.place(mug.id, table.id, 1)).toBe(true);
  expect(events[0]).toBe('transform:' + mug.id);
  commands.undo();
  expect(state.get(mug.id).slot).toBe(0);
  expect(commands.place(mug.id, table.id, 0)).toBe(false);   // no-op adds no history

  // Clear and replaceRoom keep parent/child order intact.
  commands.clear();
  commands.undo();
  expect(state.serialize().map((r) => r.type)).toEqual(['table', 'mug']);
  commands.replaceRoom({ wall: 0, floor: 0, items: [{ id: 'm', type: 'mug', parent: 't', slot: 1, rot: 0 }, { id: 't', type: 'table', gx: 0, gz: 0, rot: 0 }] });
  expect(state.get('m')).toMatchObject({ parent: 't', slot: 1 });
});

test('schema version 4 validates supporters and slots, and migrates older saves', () => {
  let n = 0;
  const opts = { catalog, placement, maxItems: 10, newId: () => 'n' + n++ };
  const good = { version: 4, wall: 1, floor: 2, items: [
    { id: 'm', type: 'mug', gx: null, gz: null, rot: 1, color: null, parent: 't', slot: 0 },   // child listed first is fine
    { id: 't', type: 'table', gx: 0, gz: 0, rot: 0, color: null, parent: null, slot: null },
  ] };
  const parsed = parseRoom(good, opts);
  expect(parsed.items.map((i) => i.id)).toEqual(['t', 'm']);                  // parents first on the way out
  expect(serializeRoom({ wall: 1, floor: 2, items: parsed.items }).version).toBe(4);

  const v3 = { version: 3, wall: 1, floor: 2, items: [{ id: 'c', type: 'chair', gx: 0, gz: 0, rot: 0, color: null }] };
  expect(parseRoom(v3, opts).items[0]).toMatchObject({ parent: null, slot: null });

  const item = (extra) => ({ id: 'x', type: 'mug', gx: null, gz: null, rot: 0, color: null, ...extra });
  const table = { id: 't', type: 'table', gx: 0, gz: 0, rot: 0, color: null, parent: null, slot: null };
  const cases = [
    [[item({ parent: null, slot: null, gx: 1, gz: 1 })], 'Small items need a supporter'],
    [[table, item({ parent: 'nope', slot: 0 })], 'Missing supporter'],
    [[table, item({ parent: 't', slot: 9 })], 'Invalid slot'],
    [[table, item({ parent: 't', slot: 0 }), { ...item({ parent: 't', slot: 0 }), id: 'y' }], 'Slot already taken'],
    [[table, { ...table, id: 'c', type: 'chair', gx: 5, gz: 5, parent: 't', slot: 0 }], 'Only small items can sit on furniture'],
    [[table, item({ parent: 't', slot: 0 }), { ...item({ parent: 'x', slot: 0 }), id: 'z' }], 'Missing supporter'],   // nothing stacks on a mug
  ];
  for (const [items, message] of cases) {
    expect(() => parseRoom({ version: 4, wall: 1, floor: 2, items }, opts), message).toThrow(SaveError);
    expect(() => parseRoom({ version: 4, wall: 1, floor: 2, items }, opts)).toThrow(message);
  }
});
