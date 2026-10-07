import { test, expect } from '@playwright/test';
import { createResidentsBrain, MAX_RESIDENTS } from '../../src/game/residents.js';
import { presetDoor, presetFixtures, ROOM_PRESETS } from '../../src/data/presets.js';

// A seeded random source so runs are repeatable.
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
/** An 8 x 8 room (cells centred at -3.5 .. 3.5) with a door on the left wall at the front. */
function room({ blocked = [], seats = [], spots = [], door = true } = {}) {
  const set = new Set(blocked.map(([x, z]) => x + ',' + z));
  return {
    blocked: set, seatList: seats, spotList: spots,
    dims: () => ({ width: 8, depth: 8, cell: 1 }),
    isFree: (gx, gz) => !set.has(gx + ',' + gz),
    seats() { return this.seatList; },
    spots() { return this.spotList; },
    door: () => (door ? { gx: 0, gz: 7, x: -3.95, z: 3.5, outX: -4.6, outZ: 3.5 } : null),
  };
}
const SOFA = [{ key: 's:0', x: -0.9, y: 0.54, z: -3.1, heading: 0 }, { key: 's:1', x: 0, y: 0.54, z: -3.1, heading: 0 }];
const KITCHEN = [{ key: 'spot:k', kind: 'kitchen', gx: 6, gz: 2, heading: Math.PI / 2 }];
const run = (brain, seconds, each = () => {}) => { for (let i = 0; i < seconds * 30; i++) { brain.update(1 / 30); each(i); } };

test('everyone starts inside on their own seat, spot, or cell, and the count is capped at three', () => {
  const brain = createResidentsBrain(room({ seats: SOFA.slice(0, 1), spots: KITCHEN }), { rng: seeded(3) });
  brain.setCount(5);
  expect(brain.count).toBe(MAX_RESIDENTS);
  const poses = brain.poses();
  expect(poses.every((p) => !p.outside && p.action !== 'away')).toBe(true);
  expect(poses.filter((p) => p.seat === 's:0')).toHaveLength(1);   // one seat, one sitter
  const cells = poses.filter((p) => !p.seat).map((p) => Math.floor(p.x + 4) + ',' + Math.floor(p.z + 4));
  expect(new Set(cells).size).toBe(cells.length);                   // nobody shares a cell
  brain.setCount(1);
  expect(brain.count).toBe(1);
});

test('over five simulated minutes people sit, cook, wander, and never rest on furniture', () => {
  const w = room({ blocked: [[2, 2], [2, 3], [5, 5], [6, 5], [7, 2]], seats: SOFA, spots: KITCHEN });
  const brain = createResidentsBrain(w, { rng: seeded(11) });
  brain.setCount(3);
  const actions = new Set(), sittersPerSeat = [];
  run(brain, 300, (i) => {
    if (i % 900 === 450) {   // every 30 s someone gets furniture dropped on their cell
      const c = brain.cellOf(i % 3);
      if (c) w.blocked.add(c.gx + ',' + c.gz);
      if (w.blocked.size > 12) w.blocked = new Set([...w.blocked].slice(-6));
    }
    const poses = brain.poses();
    for (const p of poses) actions.add(p.action);
    for (let k = 0; k < poses.length; k++) {
      const p = poses[k], person = brain.person(k);
      if (p.action !== 'walk' && !p.seat && !person.transit && !p.outside) {
        const c = brain.cellOf(k);
        if (c && i % 900 !== 450) expect(w.isFree(c.gx, c.gz), 'resting on furniture at ' + JSON.stringify(c)).toBe(true);
      }
    }
    const seated = poses.filter((p) => p.seat).map((p) => p.seat);
    sittersPerSeat.push(seated.length === new Set(seated).size);
  });
  expect(sittersPerSeat.every(Boolean)).toBe(true);
  for (const a of ['walk', 'sit', 'interact', 'idle']) expect(actions.has(a), a).toBe(true);
});

test('people leave through the door, the door opens for them, and they come back', () => {
  const brain = createResidentsBrain(room({ seats: SOFA }), { rng: seeded(5) });
  brain.setCount(2);
  expect(brain.send(1, { kind: 'leave' })).toBe(true);
  let opened = false, gone = false;
  for (let i = 0; i < 30 * 30 && !gone; i++) { brain.update(1 / 30); opened ||= brain.doorWanted() === 1; gone = brain.pose(1).action === 'away'; }
  expect(opened).toBe(true);
  expect(gone).toBe(true);
  expect(brain.pose(1).outside).toBe(true);
  brain.person(1).timer = 0;
  let back = false;
  for (let i = 0; i < 10 * 30 && !back; i++) { brain.update(1 / 30); back = !brain.pose(1).outside && brain.pose(1).action !== 'away'; }
  expect(back).toBe(true);
  expect(brain.cellOf(1)).toEqual({ gx: 0, gz: 7 });   // just inside the door
});

test('nobody leaves when the door is blocked, and the last person home stays', () => {
  const w = room({ blocked: [[0, 7]] });
  const brain = createResidentsBrain(w, { rng: seeded(9) });
  brain.setCount(1);
  expect(brain.send(0, { kind: 'leave' })).toBe(false);
  run(brain, 120);
  expect(brain.pose(0).action).not.toBe('away');
});

test('a seat that disappears stands its sitter up; reduced motion holds everyone still', () => {
  const w = room({ seats: [...SOFA] });
  const brain = createResidentsBrain(w, { rng: seeded(2) });
  brain.setCount(1);
  expect(brain.pose(0).seat).toBe('s:0');
  // Standing up steps forward, not into the gap behind the sofa.
  brain.person(0).timer = 0;
  brain.update(1 / 30);
  run(brain, 1);
  expect(brain.cellOf(0) ?? brain.person(0).pos).not.toMatchObject({ gz: 0 });
  expect(brain.person(0).pos.z).toBeGreaterThan(-3);
  brain.send(0, { kind: 'seat', target: SOFA[0] });
  run(brain, 8);
  expect(brain.pose(0).seat).toBe('s:0');
  w.seatList = [];
  run(brain, 2);
  expect(brain.pose(0).seat).toBeNull();
  expect(brain.pose(0).y).toBe(0);
  brain.setCalm(true);
  const before = brain.pose(0);
  run(brain, 60);
  expect(brain.pose(0)).toEqual(before);
});

test('the cat\'s seat is left alone, and people tell the cat which seats are theirs', () => {
  const brain = createResidentsBrain(room({ seats: SOFA }), { rng: seeded(4) });
  brain.setAvoid(() => 's:0');
  brain.setCount(1);
  expect(brain.pose(0).seat).toBe('s:1');
  expect([...brain.claimedSeats()]).toEqual(['s:1']);
});

test('presets put the door on a wall away from windows, never on the balcony', () => {
  expect(presetDoor(ROOM_PRESETS.livingRoom)).toMatchObject({ wall: 'left', at: 3.5 });
  expect(presetDoor(ROOM_PRESETS.balcony)).toBeNull();
  for (const preset of Object.values(ROOM_PRESETS)) {
    const fixtures = presetFixtures(preset);
    const door = fixtures.find((f) => f.kind === 'door');
    if (!door) continue;
    for (const f of fixtures.filter((f) => f.wall === door.wall && f.kind === 'window')) expect(door.to <= f.from || door.from >= f.to).toBe(true);
  }
  // A studio shrunk to 4 deep has no room beside its window, so the door moves to the back wall.
  expect(presetDoor({ ...ROOM_PRESETS.studio, depth: 4 })).toMatchObject({ wall: 'back', at: ROOM_PRESETS.studio.width / 2 - 0.5 });
  expect(presetDoor({ ...ROOM_PRESETS.bedroom, depth: 6 })).toMatchObject({ wall: 'left', at: -2.5 });
});

test('version 10 saves how many people live here; older saves have nobody; bad counts are refused', async () => {
  const { parseRoom, serializeRoom, migrateRoom, SaveError } = await import('../../src/persistence/schema.js');
  const { createPlacement } = await import('../../src/game/placement.js');
  const opts = { catalog: { chair: { w: 1, d: 1 } }, placement: createPlacement({ catalog: { chair: { w: 1, d: 1 } }, room: 8 }), newId: () => 'x' };
  const saved = serializeRoom({ wall: 1, floor: 2, residents: 2, items: [] });
  expect(saved).toMatchObject({ version: 11, residents: 2 });
  expect(parseRoom(saved, opts).residents).toBe(2);
  expect(migrateRoom({ version: 9, wall: 1, floor: 2, items: [] }).residents).toBe(0);
  for (const bad of [-1, 4, 1.5, '2']) expect(() => parseRoom({ ...saved, residents: bad }, opts)).toThrow(SaveError);
});

test('in the evening people go to bed and lie down, and get up when the evening ends', () => {
  const w = room({ seats: SOFA });
  w.night = true;
  w.beds = () => [{ key: 'bed:0', x: 2.5, y: 0.45, z: -2.2, heading: 0 }];
  w.evening = () => w.night;
  const brain = createResidentsBrain(w, { rng: seeded(21) });
  brain.setCount(1);
  let asleep = false;
  run(brain, 120, () => { asleep ||= brain.pose(0).action === 'sleep' && brain.pose(0).seat === 'bed:0'; });
  expect(asleep).toBe(true);
  expect([...brain.claimedSeats()]).toContain('bed:0');   // the cat keeps off an occupied bed
  w.night = false;
  run(brain, 3);
  expect(brain.pose(0).seat).not.toBe('bed:0');
  expect(brain.pose(0).y).toBe(0);
  // Without beds or evenings the world behaves exactly as before: nobody sleeps.
  const day = createResidentsBrain(room({ seats: SOFA }), { rng: seeded(21) });
  day.setCount(2);
  run(day, 120, () => { for (const p of day.poses()) expect(p.action).not.toBe('sleep'); });
});

test('people walk over to a resting cat and stroke it, facing it', () => {
  const w = room();
  w.cat = () => ({ x: 0.5, z: 0.5 });   // resting on cell 4,4
  const brain = createResidentsBrain(w, { rng: seeded(8) });
  brain.setCount(1);
  expect(brain.send(0, { kind: 'pet', target: { gx: 5, gz: 4 } })).toBe(true);
  let petting = null;
  for (let i = 0; i < 300 && !petting; i++) { brain.update(1 / 30); if (brain.pose(0).action === 'pet') petting = brain.pose(0); }
  expect(petting).toMatchObject({ x: 1.5, z: 0.5 });
  expect(petting.heading).toBeCloseTo(-Math.PI / 2, 5);   // looking at the cat to the west
});

test('a guest rings, walks in through the door, visits, leaves, and is never counted as a resident', () => {
  const w = room({ seats: SOFA, spots: KITCHEN });
  const brain = createResidentsBrain(w, { rng: seeded(13) });
  brain.setCount(2);
  expect(brain.ringDoorbell({ visit: 20 })).toBe(true);
  expect(brain.ringDoorbell()).toBe(false);                      // one visitor at a time
  expect(brain.count).toBe(2);
  expect(brain.poses()).toHaveLength(2);
  expect(brain.guestPose()).toMatchObject({ action: 'away', outside: true });
  let inside = false, opened = false;
  run(brain, 12, () => { inside ||= !brain.guestPose()?.outside; opened ||= brain.doorWanted() === 1; });
  expect(inside).toBe(true);
  expect(opened).toBe(true);
  run(brain, 60);                                                 // the visit ends and they walk out
  expect(brain.hasGuest).toBe(false);
  expect(brain.count).toBe(2);
  // Changing the household while a guest visits leaves the guest alone; a room reset sends them home.
  brain.ringDoorbell({ visit: 30 });
  run(brain, 6);
  brain.setCount(3);
  expect([brain.count, brain.hasGuest]).toEqual([3, true]);
  brain.reset();
  expect(brain.hasGuest).toBe(false);
  // No door, or reduced motion: nobody comes.
  expect(createResidentsBrain(room({ door: false })).ringDoorbell()).toBe(false);
  const calm = createResidentsBrain(w); calm.setCalm(true);
  expect(calm.ringDoorbell()).toBe(false);
});

test('someone coming in steps clear of the door, turns to shut it, and the door never closes on anyone in the doorway', () => {
  for (const blocked of [[], [[1, 7]]]) {   // a step straight in; and with that cell taken, the nearest clear cell
    const w = room({ seats: SOFA, spots: KITCHEN, blocked });
    const brain = createResidentsBrain(w, { rng: seeded(5) });
    brain.setCount(1);
    brain.ringDoorbell({ visit: 60 });
    const doorway = (q) => Math.floor(q.x + 4) === 0 && Math.floor(q.z + 4) === 7;
    let closing = null, smacked = false;
    run(brain, 12, () => {
      const g = brain.guestPose();
      if (g && !g.outside && doorway(g) && brain.doorWanted() === 0) smacked = true;
      if (!closing && g?.action === 'close') closing = { ...g, open: brain.doorWanted() };
    });
    expect(smacked).toBe(false);
    expect(closing).not.toBeNull();
    expect(doorway(closing)).toBe(false);
    expect(Math.hypot(closing.x + 3.95, closing.z - 3.5)).toBeGreaterThan(1.2);   // out of the leaf's swing
    expect(closing.open).toBe(0);                                                 // so the door can close
    const facing = Math.atan2(-3.95 - closing.x, 3.5 - closing.z);
    expect(Math.abs(Math.atan2(Math.sin(facing - closing.heading), Math.cos(facing - closing.heading)))).toBeLessThan(0.01);
    if (blocked.length) expect([Math.floor(closing.x + 4), Math.floor(closing.z + 4)]).not.toEqual([1, 7]);
  }
});

test('version 11 saves a name and a look for each resident slot; older saves get the defaults; bad ones are refused', async () => {
  const { parseRoom, serializeRoom, migrateRoom, SaveError } = await import('../../src/persistence/schema.js');
  const { DEFAULT_PEOPLE, RESIDENT_LOOKS } = await import('../../src/data/people.js');
  const { createPlacement } = await import('../../src/game/placement.js');
  const opts = { catalog: { chair: { w: 1, d: 1 } }, placement: createPlacement({ catalog: { chair: { w: 1, d: 1 } }, room: 8 }), newId: () => 'x' };
  const people = [{ name: 'Nadia', look: 'female-d' }, { name: ' Omar ', look: 'male-c' }, { name: 'Lu', look: 'male-f' }];
  const saved = serializeRoom({ wall: 1, floor: 2, residents: 2, people, items: [] });
  expect(saved.version).toBe(11);
  expect(parseRoom(saved, opts).people).toEqual([{ name: 'Nadia', look: 'female-d' }, { name: 'Omar', look: 'male-c' }, { name: 'Lu', look: 'male-f' }]);
  expect(migrateRoom({ version: 10, wall: 1, floor: 2, residents: 1, items: [] }).people).toEqual(DEFAULT_PEOPLE);
  expect(RESIDENT_LOOKS).toHaveLength(12);
  for (const bad of [people.slice(0, 2), [...people.slice(0, 2), { name: '', look: 'male-a' }], [...people.slice(0, 2), { name: 'x'.repeat(21), look: 'male-a' }], [...people.slice(0, 2), { name: 'Pat', look: 'robot' }], 'Maya']) {
    expect(() => parseRoom({ ...saved, people: bad }, opts)).toThrow(SaveError);
  }
});

test('people walk the last step onto a dining chair from beside it, never sliding across the table in a sitting pose', () => {
  // A 2 x 1 table on cells 5,3 and 6,3 with four chairs facing it, like the living room's dining corner.
  const blocked = [[5, 3], [6, 3], [5, 2], [6, 2], [5, 4], [6, 4]];
  const at = (gx, gz) => ({ x: -4 + gx + 0.5, z: -4 + gz + 0.5 });
  const chairs = [[5, 2, 0], [6, 2, 0], [5, 4, Math.PI], [6, 4, Math.PI]].map(([gx, gz, heading], i) => ({ key: 'chair:' + i, ...at(gx, gz), y: 0.46, heading }));
  const brain = createResidentsBrain(room({ blocked, seats: chairs }), { rng: seeded(3) });
  brain.setCount(3);
  let longest = 0, sitting = 0;
  run(brain, 300, () => {
    for (let k = 0; k < 3; k++) {
      const p = brain.person(k), pose = brain.pose(k);
      if (p.transit?.walk) {
        const t = p.transit;
        longest = Math.max(longest, Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z));
        expect(Math.abs(t.to.x - t.from.x) < 1e-6 || Math.abs(t.to.z - t.from.z) < 1e-6, 'a straight step, not diagonal past a corner').toBe(true);
        expect(pose.action, 'on foot while stepping').toBe('walk');
        expect(pose.y).toBe(0);
      }
      if (pose.seat) {
        sitting++;
        const chair = chairs.find((c) => c.key === pose.seat);
        expect(pose).toMatchObject({ action: 'sit', x: chair.x, z: chair.z, heading: chair.heading });
      }
    }
  });
  expect(sitting).toBeGreaterThan(0);
  expect(longest).toBeLessThanOrEqual(1 + 1e-9);
});

test('people walk around interior walls and in through the doorway, never through a partition', async () => {
  const { presetPartitionEdges, edgeKey } = await import('../../src/data/presets.js');
  // An 8 x 8 room with a 3 x 3 bathroom in the back-left corner and its doorway at column 2.
  const edges = presetPartitionEdges({ partitions: [{ axis: 'z', line: 3, from: 0, to: 3 }, { axis: 'x', line: 3, from: 0, to: 3, gaps: [2] }] });
  const w = room();
  w.passable = (ax, az, bx, bz) => !edges.has(edgeKey(ax, az, bx, bz));
  const brain = createResidentsBrain(w, { rng: seeded(6) });
  const path = brain.findPath({ gx: 5, gz: 1 }, { gx: 1, gz: 1 });
  expect(path.some((c) => c.gx === 2 && c.gz === 2) && path.some((c) => c.gx === 2 && c.gz === 3), 'through the doorway').toBe(true);
  let prev = { gx: 5, gz: 1 };
  for (const c of path) {
    const dx = c.gx - prev.gx, dz = c.gz - prev.gz;
    const steps = dx && dz ? [[prev, { gx: prev.gx + dx, gz: prev.gz }], [{ gx: prev.gx + dx, gz: prev.gz }, c], [prev, { gx: prev.gx, gz: prev.gz + dz }], [{ gx: prev.gx, gz: prev.gz + dz }, c]] : [[prev, c]];
    for (const [a, b] of steps) expect(w.passable(a.gx, a.gz, b.gx, b.gz), JSON.stringify([a, b])).toBe(true);
    prev = c;
  }
  // The cat too.
  const { createPetBrain } = await import('../../src/game/pet.js');
  const cat = createPetBrain({ ...w, seats: () => [], favourites: () => ({ rug: [], sun: [] }) });
  expect(cat.findPath({ gx: 3, gz: 0 }, { gx: 2, gz: 0 }).length).toBeGreaterThan(2);   // around, not through
});
