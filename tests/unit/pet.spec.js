import { test, expect } from '@playwright/test';
import { createPetBrain } from '../../src/game/pet.js';

// A seeded random source so runs are repeatable.
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function room({ width = 8, depth = 8, blocked = [], rug = [], sun = [], seats = [] } = {}) {
  const set = new Set(blocked.map(([x, z]) => x + ',' + z));
  return {
    blocked: set, seatList: seats,
    dims: () => ({ width, depth, cell: 1 }),
    isFree: (gx, gz) => !set.has(gx + ',' + gz),
    seats() { return this.seatList; },
    favourites: () => ({ rug: rug.map(([gx, gz]) => ({ gx, gz })), sun: sun.map(([gx, gz]) => ({ gx, gz })) }),
  };
}
const cellOf = (p) => ({ gx: Math.floor(p.x + 4), gz: Math.floor(p.z + 4) });

test('paths avoid furniture and never cut a blocked corner', () => {
  const w = room({ blocked: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]] });   // a wall with a gap at the bottom
  const brain = createPetBrain(w, { rng: seeded(1) });
  const path = brain.findPath({ gx: 0, gz: 0 }, { gx: 6, gz: 0 });
  expect(path.at(-1)).toEqual({ gx: 6, gz: 0 });
  expect(path.some((c) => c.gx === 3 && c.gz === 7)).toBe(true);   // through the gap
  expect(path.every((c) => w.isFree(c.gx, c.gz))).toBe(true);
  const corner = room({ blocked: [[1, 0], [0, 1]] });
  expect(createPetBrain(corner).findPath({ gx: 0, gz: 0 }, { gx: 1, gz: 1 })).toBeNull();   // diagonal squeeze refused
  expect(brain.findPath({ gx: 0, gz: 0 }, { gx: 3, gz: 3 })).toBeNull();                 // target occupied
});

test('over five simulated minutes the cat only ever stands on free cells, even as furniture moves', () => {
  const w = room({ blocked: [[2, 2], [2, 3], [5, 5], [6, 5]], rug: [[3, 4], [4, 4], [3, 5]], sun: [[0, 0], [1, 0]] });
  const brain = createPetBrain(w, { rng: seeded(7) });
  brain.reset();
  const actions = new Set();
  for (let i = 0; i < 300 * 30; i++) {
    if (i % 900 === 450) {   // every 30 s, drop furniture on the cat's cell and on a random cell
      const c = brain.cell();
      if (c) w.blocked.add(c.gx + ',' + c.gz);
      w.blocked.add(((i / 900) % 8 | 0) + ',' + ((i / 450) % 8 | 0));
      if (w.blocked.size > 14) w.blocked = new Set([...w.blocked].slice(-8));
    }
    const p = brain.update(1 / 30);
    actions.add(p.action);
    const c = brain.cell();
    // Allowed a single tick to react (it hops away on the next update), then never on a blocked cell.
    if (c && brain.action !== 'hop' && i % 900 !== 450 && i % 900 !== 451) expect(w.isFree(c.gx, c.gz), 'tick ' + i).toBe(true);
    expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.heading)).toBe(true);
  }
  expect([...actions].sort()).toEqual(expect.arrayContaining(['curl', 'hop', 'sit', 'walk']));
});

test('the cat hops onto a free seat, curls there, and hops down when the seat goes away', () => {
  const seat = { key: 'sofa:1', x: 0.5, y: 0.54, z: -2.5 };
  const w = room({ seats: [seat] });
  const brain = createPetBrain(w, { rng: () => 0.1 });   // always chooses the seat first
  brain.reset();
  let onSeat = false;
  for (let i = 0; i < 30 * 60 && !onSeat; i++) { brain.update(1 / 30); onSeat = !!brain.onSeat; }
  expect(onSeat).toBe(true);
  expect(brain.pose()).toMatchObject({ x: 0.5, y: 0.54, z: -2.5 });
  w.seatList = [];   // a pillow was placed in that slot
  for (let i = 0; i < 30; i++) brain.update(1 / 30);
  expect(brain.onSeat).toBeNull();
  expect(brain.pose().y).toBeCloseTo(0, 5);
  const c = brain.cell();
  expect(w.isFree(c.gx, c.gz)).toBe(true);
});

test('looking at a nearby point turns the head while resting, within limits', () => {
  const brain = createPetBrain(room({ rug: [[4, 4]] }), { rng: () => 0.99 });
  brain.reset();
  brain.lookAt({ x: 3, z: 0.5 });
  let p; for (let i = 0; i < 40; i++) p = brain.update(1 / 30);
  expect(Math.abs(p.look)).toBeGreaterThan(0.05);
  expect(Math.abs(p.look)).toBeLessThanOrEqual(1.2);
  brain.lookAt(null);
  for (let i = 0; i < 60; i++) p = brain.update(1 / 30);
  expect(Math.abs(p.look)).toBeLessThan(0.01);
});

test('version 9 saves the cat; older saves have none; bad pets are refused', async () => {
  const { parseRoom, serializeRoom, migrateRoom, SaveError, PET_COLOR_KEYS } = await import('../../src/persistence/schema.js');
  const { PET_COLORS } = await import('../../src/config/theme.js');
  const { createPlacement } = await import('../../src/game/placement.js');
  expect(PET_COLORS.map((c) => c.key)).toEqual(PET_COLOR_KEYS);
  const opts = { catalog: { chair: { w: 1, d: 1 } }, placement: createPlacement({ catalog: { chair: { w: 1, d: 1 } }, room: 8 }), newId: () => 'x' };
  const saved = serializeRoom({ wall: 1, floor: 2, pet: { present: true, color: 'black' }, items: [] });
  expect(saved.pet).toEqual({ present: true, color: 'black' });
  expect(parseRoom(saved, opts).pet).toEqual({ present: true, color: 'black' });
  expect(migrateRoom({ version: 8, wall: 1, floor: 2, items: [] }).pet).toEqual({ present: false, color: 'ginger' });
  expect(() => parseRoom({ ...saved, pet: { present: 'yes', color: 'black' } }, opts)).toThrow(SaveError);
  expect(() => parseRoom({ ...saved, pet: { present: true, color: 'tabby' } }, opts)).toThrow(SaveError);
});
