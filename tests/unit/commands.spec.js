import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';

const catalog = { sofa: { w: 3, d: 1 }, plant: { w: 1, d: 1 }, rug: { w: 4, d: 3, layer: 'floor' } };

function setup() {
  const placement = createPlacement({ catalog, room: 8 });
  const state = createRoomState({ placement });
  const finishes = { wall: 0x111111, floor: 0x222222 };
  const commands = createCommands({ state, finishes });
  const events = [];
  commands.subscribe((kind, payload) => events.push([kind, payload && payload.id !== undefined ? payload.id : payload]));
  return { state, finishes, commands, events };
}

test('add, remove, move, rotate, recolor each undo and redo with occupancy intact', () => {
  const { state, commands } = setup();
  const sofa = commands.add({ type: 'sofa', gx: 2, gz: 1, rot: 0 });
  expect(state.occupancy.size).toBe(3);
  commands.undo();
  expect(state.items).toHaveLength(0);
  expect(state.occupancy.size).toBe(0);
  commands.redo();
  expect(state.get(sofa.id)).toMatchObject({ type: 'sofa', gx: 2, gz: 1 });
  expect(state.occupancy.size).toBe(3);

  expect(commands.move(sofa.id, 3, 1)).toBe(true);
  expect(commands.rotate(sofa.id)).toBe(true);
  expect(state.get(sofa.id)).toMatchObject({ gx: 3, gz: 1, rot: 1 });
  commands.undo();
  expect(state.get(sofa.id).rot).toBe(0);
  commands.undo();
  expect(state.get(sofa.id)).toMatchObject({ gx: 2, gz: 1, rot: 0 });
  expect(state.occupancy.has('2,1')).toBe(true);
  expect(state.occupancy.has('5,1')).toBe(false);

  expect(commands.recolor(sofa.id, 0xabcdef)).toBe(true);
  commands.undo();
  expect(state.get(sofa.id).color).toBeNull();

  expect(commands.remove(sofa.id)).toBe(true);
  expect(state.items).toHaveLength(0);
  commands.undo();
  // The same id comes back so anything that referenced it stays valid.
  expect(state.get(sofa.id)).toMatchObject({ type: 'sofa', gx: 2, gz: 1 });
});

test('no-op commands do not create history entries', () => {
  const { state, commands } = setup();
  const plant = commands.add({ type: 'plant', gx: 0, gz: 0 });
  commands.add({ type: 'plant', gx: 1, gz: 0 });
  expect(commands.move(plant.id, 0, 0)).toBe(false);          // same tile
  expect(commands.move(plant.id, 1, 0)).toBe(false);          // blocked
  expect(commands.recolor(plant.id, null)).toBe(false);       // unchanged color
  expect(commands.setFinish('wall', 0x111111)).toBe(false);   // unchanged finish
  expect(commands.setFinish('ceiling', 1)).toBe(false);       // unknown key
  expect(commands.add({ type: 'plant', gx: 0, gz: 0 })).toBeNull();
  commands.undo(); commands.undo();
  expect(state.items).toHaveLength(0);
  expect(commands.canUndo()).toBe(false);
});

test('a new command after undo discards the redo branch', () => {
  const { commands } = setup();
  commands.add({ type: 'plant', gx: 0, gz: 0 });
  commands.add({ type: 'plant', gx: 1, gz: 0 });
  commands.undo();
  expect(commands.canRedo()).toBe(true);
  commands.add({ type: 'plant', gx: 2, gz: 0 });
  expect(commands.canRedo()).toBe(false);
  expect(commands.redo()).toBe(false);
});

test('finishes, clear, and replaceRoom are single undoable entries', () => {
  const { state, finishes, commands } = setup();
  commands.add({ type: 'sofa', gx: 0, gz: 0 });
  commands.add({ type: 'rug', gx: 0, gz: 0 });
  commands.setFinish('wall', 0xaaaaaa);
  expect(finishes.wall).toBe(0xaaaaaa);
  commands.undo();
  expect(finishes.wall).toBe(0x111111);
  commands.redo();

  expect(commands.clear()).toBe(true);
  expect(state.items).toHaveLength(0);
  expect(commands.clear()).toBe(false);
  commands.undo();
  expect(state.items.map((i) => i.type)).toEqual(['sofa', 'rug']);
  expect(state.occupancy.size).toBe(3);

  commands.replaceRoom({ wall: 1, floor: 2, items: [{ id: 'p', type: 'plant', gx: 7, gz: 7, rot: 0, color: 5 }] });
  expect(state.serialize()).toEqual([{ id: 'p', type: 'plant', gx: 7, gz: 7, rot: 0, color: 5 }]);
  expect(finishes).toEqual({ wall: 1, floor: 2 });
  commands.undo();
  expect(state.items.map((i) => i.type)).toEqual(['sofa', 'rug']);
  expect(finishes).toEqual({ wall: 0xaaaaaa, floor: 0x222222 });
  commands.redo();
  expect(state.items.map((i) => i.id)).toEqual(['p']);
});

test('events mirror every mutation and history changes', () => {
  const { commands, events } = setup();
  const plant = commands.add({ type: 'plant', gx: 0, gz: 0 });
  commands.move(plant.id, 1, 1);
  commands.recolor(plant.id, 7);
  commands.setFinish('floor', 9);
  commands.remove(plant.id);
  commands.undo();
  const kinds = events.map(([k]) => k);
  expect(kinds).toEqual(['add', 'history', 'transform', 'history', 'color', 'history', 'finish', 'history', 'remove', 'history', 'add', 'history']);
  expect(events.at(-1)[1]).toEqual({ canUndo: true, canRedo: true });
  commands.clearHistory();
  expect(events.at(-1)[1]).toEqual({ canUndo: false, canRedo: false });
});

test('history is capped', () => {
  const { commands } = setup();
  const cmds = createCommands({ state: createRoomState({ placement: createPlacement({ catalog, room: 8 }) }), finishes: { wall: 0, floor: 0 }, limit: 3 });
  for (let i = 0; i < 5; i++) cmds.setFinish('wall', i + 1);
  let undone = 0;
  while (cmds.undo()) undone++;
  expect(undone).toBe(3);
  expect(commands.canUndo()).toBe(false);
});
