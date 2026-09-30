import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';

// A tiny catalog proves the rules do not depend on Three.js models.
const catalog = {
  sofa: { w: 3, d: 1 },
  plant: { w: 1, d: 1 },
  rug: { w: 4, d: 3, layer: 'floor' },
};
const placement = createPlacement({ catalog, room: 8, cell: 1 });

test('footprint swaps width and depth on odd quarter turns', () => {
  expect(placement.footprint('sofa', 0)).toEqual({ w: 3, d: 1 });
  expect(placement.footprint('sofa', 1)).toEqual({ w: 1, d: 3 });
  expect(placement.footprint('sofa', 2)).toEqual({ w: 3, d: 1 });
});

test('bounds reject footprints that hang over the room edge', () => {
  expect(placement.isFree(new Set(), 'sofa', 5, 0, 0)).toBe(true);
  expect(placement.isFree(new Set(), 'sofa', 6, 0, 0)).toBe(false);
  expect(placement.isFree(new Set(), 'sofa', 7, 5, 1)).toBe(true);
  expect(placement.isFree(new Set(), 'sofa', 7, 6, 1)).toBe(false);
  expect(placement.isFree(new Set(), 'plant', -1, 0, 0)).toBe(false);
});

test('world position and snap round-trip through the grid', () => {
  const p = placement.worldPos('sofa', 2, 1, 0);
  expect(p).toEqual({ x: -0.5, y: 0, z: -2.5 });
  expect(placement.snap(p, 'sofa', 0)).toEqual({ gx: 2, gz: 1 });
  expect(placement.snap({ x: 3.9, z: 3.9 }, 'plant', 0)).toEqual({ gx: 7, gz: 7 });
});

test('room state keeps occupancy in step with add, move, rotate, remove, and clear', () => {
  const state = createRoomState({ placement });
  const sofa = state.add({ type: 'sofa', gx: 2, gz: 1 });
  expect(sofa.id).toMatch(/^i[a-z0-9]+$/);
  expect(state.occupancy.size).toBe(3);

  // Rugs overlap furniture and never occupy cells.
  const rug = state.add({ type: 'rug', gx: 1, gz: 0 });
  expect(rug).not.toBeNull();
  expect(state.occupancy.size).toBe(3);

  // Overlap is refused; the caller gets null and nothing changes.
  expect(state.add({ type: 'plant', gx: 3, gz: 1 })).toBeNull();
  expect(state.items).toHaveLength(2);

  // Moving one cell sideways overlaps its own old cells, which must not count as blocked.
  expect(state.move(sofa.id, 3, 1)).toBe(true);
  expect(state.occupancy.has('5,1')).toBe(true);
  expect(state.occupancy.has('2,1')).toBe(false);

  // Rotation in place is refused when a neighbour blocks it, and occupancy is untouched.
  state.add({ type: 'plant', gx: 3, gz: 2 });
  expect(state.rotate(sofa.id)).toBe(false);
  expect(sofa.rot).toBe(0);
  expect(state.occupancy.size).toBe(4);

  expect(state.remove(sofa.id)).toBe(true);
  expect(state.occupancy.size).toBe(1);
  expect(state.serialize()).toEqual([
    { id: rug.id, type: 'rug', gx: 1, gz: 0, rot: 0, color: null },
    { id: expect.any(String), type: 'plant', gx: 3, gz: 2, rot: 0, color: null },
  ]);
  state.clear();
  expect(state.items).toHaveLength(0);
  expect(state.occupancy.size).toBe(0);
});

test('explicit ids are kept and duplicates are replaced', () => {
  const state = createRoomState({ placement });
  const a = state.add({ type: 'plant', gx: 0, gz: 0, id: 'keep-me' });
  const b = state.add({ type: 'plant', gx: 1, gz: 0, id: 'keep-me' });
  expect(a.id).toBe('keep-me');
  expect(b.id).not.toBe('keep-me');
});
