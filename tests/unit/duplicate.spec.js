import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';

const catalog = {
  sofa: { w: 3, d: 1 },
  table: { w: 2, d: 1, surface: { y: 0.5, slots: [{ x: -0.5, z: 0 }, { x: 0, z: 0 }, { x: 0.5, z: 0 }] } },
  mug: { w: 1, d: 1, layer: 'surface' },
  clock: { w: 1, d: 1, layer: 'wall', wall: { w: 1, h: 1 } },
};
const placement = createPlacement({ catalog, room: 4, wallRows: 2 });

function setup() {
  const state = createRoomState({ placement });
  const commands = createCommands({ state, finishes: { wall: 0, floor: 0 } });
  return { state, commands };
}

test('floor copies land on the nearest free tile and keep rotation and color', () => {
  const { state } = setup();
  const sofa = state.add({ type: 'sofa', gx: 0, gz: 0, rot: 0, color: 7 });
  expect(state.findFreeNear(sofa.id)).toEqual({ gx: 0, gz: 1 });   // directly in front
  state.add({ type: 'sofa', gx: 0, gz: 1 });
  expect(state.findFreeNear(sofa.id)).toEqual({ gx: 0, gz: 2 });
  state.add({ type: 'sofa', gx: 0, gz: 2 });
  state.add({ type: 'sofa', gx: 0, gz: 3 });
  expect(state.findFreeNear(sofa.id)).toBeNull();                  // a 4-wide room holds no fifth sofa beside these
});

test('surface and wall copies use the next free slot or wall cell', () => {
  const { state } = setup();
  const table = state.add({ type: 'table', gx: 0, gz: 0 });
  const mug = state.add({ type: 'mug', parent: table.id, slot: 1 });
  expect(state.findFreeNear(mug.id)).toEqual({ parent: table.id, slot: 2 });
  state.add({ type: 'mug', parent: table.id, slot: 2 });
  expect(state.findFreeNear(mug.id)).toEqual({ parent: table.id, slot: 0 });
  state.add({ type: 'mug', parent: table.id, slot: 0 });
  expect(state.findFreeNear(mug.id)).toBeNull();

  const clock = state.add({ type: 'clock', wall: 'back', col: 1, row: 0 });
  expect(state.findFreeNear(clock.id)).toEqual({ wall: 'back', col: 0, row: 0 });   // beside first
  state.add({ type: 'clock', wall: 'back', col: 0, row: 0 });
  state.add({ type: 'clock', wall: 'back', col: 2, row: 0 });
  expect(state.findFreeNear(clock.id)).toEqual({ wall: 'back', col: 1, row: 1 });   // then the row above
});

test('duplicate is one undoable entry and brings children along', () => {
  const { state, commands } = setup();
  const table = commands.add({ type: 'table', gx: 0, gz: 0 });
  commands.add({ type: 'mug', parent: table.id, slot: 0, color: 3 });
  const copy = commands.duplicate(table.id);
  expect(copy).toMatchObject({ type: 'table', gx: 0, gz: 1 });
  expect(copy.id).not.toBe(table.id);
  expect(state.childrenOf(copy.id)).toEqual([expect.objectContaining({ type: 'mug', slot: 0, color: 3 })]);
  expect(state.items).toHaveLength(4);
  commands.undo();
  expect(state.items).toHaveLength(2);
  commands.redo();
  expect(state.items).toHaveLength(4);
  expect(state.childrenOf(copy.id)).toHaveLength(1);

  // No room: nothing is added and nothing goes on the history.
  const sofa = commands.add({ type: 'sofa', gx: 0, gz: 2 });
  commands.add({ type: 'sofa', gx: 0, gz: 3 });
  const before = state.items.length;
  expect(commands.duplicate(sofa.id)).toBeNull();
  expect(state.items).toHaveLength(before);
  expect(commands.duplicate('nope')).toBeNull();
});
