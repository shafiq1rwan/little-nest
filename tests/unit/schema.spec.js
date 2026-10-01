import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { serializeRoom, parseRoom, migrateRoom, SaveError, CURRENT_VERSION } from '../../src/persistence/schema.js';

const catalog = { sofa: { w: 3, d: 1 }, plant: { w: 1, d: 1 }, rug: { w: 4, d: 3, layer: 'floor' } };
const placement = createPlacement({ catalog, room: 8 });
let counter = 0;
const options = { catalog, placement, maxItems: 5, newId: () => 'gen' + counter++ };

test('writer emits the current version with ids and explicit null colors', () => {
  const out = serializeRoom({ wall: 1, floor: 2, items: [{ id: 'a', type: 'sofa', gx: 0, gz: 0, rot: 0 }] });
  expect(out).toEqual({ version: CURRENT_VERSION, room: { preset: 'livingRoom', width: 8, depth: 8 }, wall: 1, floor: 2, lighting: 'morning', items: [{ id: 'a', type: 'sofa', gx: 0, gz: 0, rot: 0, color: null, parent: null, slot: null, wall: null, col: null, row: null, lit: null }] });
});

test('legacy saves without a version migrate and receive ids', () => {
  const legacy = { wall: 0x92725c, floor: 0xe3a372, items: [{ type: 'sofa', gx: 2, gz: 1, rot: 0 }, { type: 'plant', gx: 0, gz: 0, rot: 1, color: 0xb96949 }] };
  const room = parseRoom(legacy, options);
  expect(room.items.map((i) => i.id)).toEqual(['gen0', 'gen1']);
  expect(room.items[1]).toMatchObject({ type: 'plant', color: 0xb96949, rot: 1 });
});

test('version 2 saves migrate the same way', () => {
  const v2 = { version: 2, wall: 1, floor: 2, items: [{ type: 'rug', gx: 0, gz: 0, rot: 0 }] };
  expect(migrateRoom(v2).version).toBe(CURRENT_VERSION);
  expect(migrateRoom(v2).items[0]).toMatchObject({ id: null, parent: null, slot: null });
  expect(parseRoom(v2, options).items[0].id).toMatch(/^gen/);
});

test('version 3 keeps ids and de-duplicates them', () => {
  const v3 = { version: 3, wall: 1, floor: 2, items: [{ id: 'x', type: 'plant', gx: 0, gz: 0, rot: 0 }, { id: 'x', type: 'plant', gx: 1, gz: 0, rot: 0 }] };
  const ids = parseRoom(v3, options).items.map((i) => i.id);
  expect(ids[0]).toBe('x');
  expect(ids[1]).not.toBe('x');
});

test('invalid saves are rejected with SaveError', () => {
  const base = { version: 3, wall: 1, floor: 2 };
  const cases = [
    [null, 'Not a saved room'],
    [{ ...base, items: null }, 'Missing items'],
    [{ ...base, items: [] , wall: 'red' }, 'Invalid finishes'],
    [{ ...base, items: [{ id: 'a', type: 'lamp', gx: 0, gz: 0, rot: 0 }] }, 'Unknown furniture'],
    [{ ...base, items: [{ id: 'a', type: 'sofa', gx: 6, gz: 0, rot: 0 }] }, 'Out of bounds'],
    [{ ...base, items: [{ id: 'a', type: 'sofa', gx: 0, gz: 0, rot: 0 }, { id: 'b', type: 'plant', gx: 1, gz: 0, rot: 0 }] }, 'Overlapping'],
    [{ ...base, items: [{ id: 'a', type: 'plant', gx: 0, gz: 0, rot: 4 }] }, 'Invalid position'],
    [{ ...base, items: [{ id: 'a', type: 'plant', gx: 0, gz: 0, rot: 0, color: 0x1000000 }] }, 'Invalid color'],
    [{ ...base, items: [{ id: 7, type: 'plant', gx: 0, gz: 0, rot: 0 }] }, 'Invalid id'],
    [{ ...base, items: Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, type: 'plant', gx: i, gz: 0, rot: 0 })) }, 'Too many'],
    [{ version: 99, wall: 1, floor: 2, items: [] }, 'Unsupported'],
  ];
  for (const [data, message] of cases) {
    expect(() => parseRoom(data, options), message).toThrow(SaveError);
    expect(() => parseRoom(data, options)).toThrow(message);
  }
});

test('a rug overlapping furniture is valid', () => {
  const data = { version: 3, wall: 1, floor: 2, items: [{ id: 'a', type: 'sofa', gx: 0, gz: 0, rot: 0 }, { id: 'b', type: 'rug', gx: 0, gz: 0, rot: 0 }] };
  expect(parseRoom(data, options).items).toHaveLength(2);
});
