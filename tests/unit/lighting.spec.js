import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';
import { parseRoom, serializeRoom, migrateRoom, SaveError, CURRENT_VERSION } from '../../src/persistence/schema.js';
import { LIGHTING, DEFAULT_LIGHTING } from '../../src/data/lighting.js';

const catalog = { chair: { w: 1, d: 1 }, lamp: { w: 1, d: 1, lamp: true }, candle: { w: 1, d: 1, layer: 'surface', lamp: true }, table: { w: 1, d: 1, surface: { y: 1, slots: [{ x: 0, z: 0 }] } } };
const placement = createPlacement({ catalog, room: 8 });
let n = 0;
const opts = { catalog, placement, maxItems: 10, newId: () => 'n' + n++, lightings: LIGHTING };

test('lamps carry a lit flag that other items do not', () => {
  const state = createRoomState({ placement });
  const chair = state.add({ type: 'chair', gx: 0, gz: 0 });
  const lamp = state.add({ type: 'lamp', gx: 1, gz: 0 });
  const dark = state.add({ type: 'lamp', gx: 2, gz: 0, lit: false });
  expect(chair.lit).toBeNull();
  expect(lamp.lit).toBe(true);
  expect(dark.lit).toBe(false);
  expect(state.setLit(chair.id, false)).toBe(false);
  expect(state.setLit(lamp.id, false)).toBe(true);
  expect(state.serialize().map((r) => r.lit)).toEqual([null, false, false]);
});

test('setLit and the lighting finish are undoable and emit events', () => {
  const state = createRoomState({ placement });
  const finishes = { wall: 0, floor: 0, lighting: DEFAULT_LIGHTING };
  const commands = createCommands({ state, finishes });
  const events = [];
  commands.subscribe((k, p) => events.push(k + (p?.key ? ':' + p.key : '')));
  const lamp = commands.add({ type: 'lamp', gx: 0, gz: 0 });
  const chair = commands.add({ type: 'chair', gx: 1, gz: 0 });
  events.length = 0;
  expect(commands.setLit(lamp.id, true)).toBe(false);    // already on: no entry
  expect(commands.setLit(chair.id, false)).toBe(false);  // not a lamp
  expect(commands.setLit(lamp.id, false)).toBe(true);
  expect(events).toEqual(['lit', 'history']);
  commands.undo();
  expect(state.get(lamp.id).lit).toBe(true);
  expect(commands.setFinish('lighting', 'evening')).toBe(true);
  expect(finishes.lighting).toBe('evening');
  expect(events.at(-2)).toBe('finish:lighting');
  commands.undo();
  expect(finishes.lighting).toBe(DEFAULT_LIGHTING);

  // replaceRoom carries the mood and restores the old one on undo.
  commands.replaceRoom({ wall: 1, floor: 2, lighting: 'sunset', items: [] });
  expect(finishes.lighting).toBe('sunset');
  commands.undo();
  expect(finishes.lighting).toBe(DEFAULT_LIGHTING);
});

test('schema version 7 stores lighting and lamp state, migrates, and validates', () => {
  const out = serializeRoom({ wall: 1, floor: 2, lighting: 'evening', items: [{ id: 'l', type: 'lamp', gx: 0, gz: 0, rot: 0, lit: false }] });
  expect(out.version).toBe(CURRENT_VERSION);
  expect(out.lighting).toBe('evening');
  expect(out.items[0].lit).toBe(false);
  expect(serializeRoom({ wall: 1, floor: 2, items: [] }).lighting).toBe(DEFAULT_LIGHTING);

  const v6 = { version: 6, room: { preset: 'livingRoom', width: 8, depth: 8 }, wall: 1, floor: 2, items: [{ id: 'l', type: 'lamp', gx: 0, gz: 0, rot: 0, color: null, parent: null, slot: null, wall: null, col: null, row: null }, { id: 'c', type: 'chair', gx: 1, gz: 0, rot: 0, color: null, parent: null, slot: null, wall: null, col: null, row: null }] };
  expect(migrateRoom(v6).lighting).toBe(DEFAULT_LIGHTING);
  const parsed = parseRoom(v6, opts);
  expect(parsed.lighting).toBe(DEFAULT_LIGHTING);
  expect(parsed.items.map((i) => i.lit)).toEqual([true, null]);   // lamps from old saves start lit

  const v7 = { ...v6, version: 7, lighting: 'sunset', items: [{ ...v6.items[0], lit: false }] };
  expect(parseRoom(v7, opts).items[0].lit).toBe(false);
  expect(() => parseRoom({ ...v7, lighting: 'noon' }, opts)).toThrow('Unknown lighting');
  expect(() => parseRoom({ ...v7, lighting: 4 }, opts)).toThrow('Invalid lighting');
  expect(() => parseRoom({ ...v7, items: [{ ...v6.items[0], lit: 'yes' }] }, opts)).toThrow(SaveError);
  // A lit flag on a non-lamp is dropped rather than refused.
  expect(parseRoom({ ...v7, items: [{ ...v6.items[1], lit: true }] }, opts).items[0].lit).toBeNull();
});
