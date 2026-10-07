// The people who live in the room: where each one goes and what they do. Pure logic in world units,
// no Three.js and no DOM, so tests/unit can drive it. The scene turns each pose into an animation
// clip (src/scene/people.js). Built like the cat's brain (src/game/pet.js), but for up to three
// people who share the room: every seat, spot, and resting cell is claimed by one person at a time.
//
// world: {
//   dims()        -> { width, depth, cell }                   room size in cells
//   isFree(gx,gz) -> boolean                                  floor cell clear of furniture
//   seats()       -> [{ key, x, y, z, heading }]              places to sit (world position, facing)
//   spots()       -> [{ key, kind, gx, gz, heading }]         places to stand and do something:
//                                                             kind 'kitchen' (busy hands) or 'window' (gaze)
//   door()        -> { gx, gz, x, z, outX, outZ } | null      the floor cell inside the door, the
//                                                             threshold point, and a point beyond it
//   beds()        -> [{ key, x, y, z, heading }]              optional: where to lie down (the hips' spot)
//   evening()     -> boolean                                  optional: bedtime; sleepers wake when it ends
//   cat()         -> { x, z } | null                          optional: the cat, while it rests on the floor
// }
// pose(i) returns { x, y, z, heading, action, outside, seat, spot, settling } (spot: the claimed spot key while
// busy at it; settling: stepping onto or off a seat). action: 'walk' | 'idle' | 'sit' |
// 'interact' | 'gaze' | 'sleep' (lying in bed; seat is the bed key) | 'pet' (stroking the cat) | 'away'. People never rest on a cell that is not free: when furniture lands on
// them they step to the nearest free cell, and they stand up when their seat is moved or removed.

export const RESIDENT_ACTIONS = ['walk', 'idle', 'sit', 'interact', 'gaze', 'sleep', 'pet', 'away'];
export const MAX_RESIDENTS = 3;

export function createResidentsBrain(world, { rng = Math.random, speed = 1.1, settleTime = 0.45 } = {}) {
  const people = [];
  let calm = false;           // reduced motion: everyone stays where they are
  let avoid = () => null;     // seat key the cat is using, so nobody sits on it

  const dims = () => world.dims();
  const center = (gx, gz) => { const { width, depth, cell } = dims(); return { x: -width * cell / 2 + (gx + 0.5) * cell, z: -depth * cell / 2 + (gz + 0.5) * cell }; };
  const cellOf = (x, z) => { const { width, depth, cell } = dims(); return { gx: Math.floor((x + width * cell / 2) / cell), gz: Math.floor((z + depth * cell / 2) / cell) }; };
  const inRoom = (gx, gz) => { const { width, depth } = dims(); return gx >= 0 && gz >= 0 && gx < width && gz < depth; };
  const free = (gx, gz) => inRoom(gx, gz) && world.isFree(gx, gz);
  const between = (a, b) => a + rng() * (b - a);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const cellKey = (c) => 'cell:' + c.gx + ',' + c.gz;
  const beds = () => world.beds?.() ?? [];
  const evening = () => !!world.evening?.();
  const catAt = () => world.cat?.() ?? null;
  const placesOf = (p) => (p.bed ? beds() : world.seats());

  /** Keys claimed by everyone except `who`: seats, spots, and the cells people rest on or head for. */
  function claimedBy(who) {
    const out = new Set();
    for (const p of people) if (p !== who && p.claim) out.add(p.claim);
    for (const p of people) if (p !== who && !p.away && !p.seat && !p.transit) out.add(cellKey(cellOf(p.pos.x, p.pos.z)));
    const cat = avoid(); if (cat) out.add(cat);
    return out;
  }
  function nearestFree(x, z, taken = new Set()) {
    const { width, depth } = dims();
    let best = null, bestD = Infinity;
    for (let gx = 0; gx < width; gx++) for (let gz = 0; gz < depth; gz++) {
      if (!free(gx, gz) || taken.has(cellKey({ gx, gz }))) continue;
      const p = center(gx, gz), d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) { bestD = d; best = { gx, gz }; }
    }
    return best;
  }
  /** A* over free cells with eight neighbours; diagonals may not cut a blocked corner. */
  function findPath(from, to) {
    if (!free(to.gx, to.gz)) return null;
    if (from.gx === to.gx && from.gz === to.gz) return [];
    const key = (c) => c.gx + ',' + c.gz;
    const open = [{ ...from, f: 0 }];
    const came = new Map([[key(from), null]]);
    const cost = new Map([[key(from), 0]]);
    const h = (c) => Math.hypot(c.gx - to.gx, c.gz - to.gz);
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.gx === to.gx && cur.gz === to.gz) {
        const out = []; let c = { gx: cur.gx, gz: cur.gz };
        while (c) { out.unshift(c); c = came.get(key(c)); }
        return out.slice(1);
      }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const n = { gx: cur.gx + dx, gz: cur.gz + dz };
        if (!free(n.gx, n.gz)) continue;
        if (dx && dz && (!free(cur.gx + dx, cur.gz) || !free(cur.gx, cur.gz + dz))) continue;
        const g = cost.get(key(cur)) + (dx && dz ? Math.SQRT2 : 1);
        if (g >= (cost.get(key(n)) ?? Infinity)) continue;
        cost.set(key(n), g); came.set(key(n), { gx: cur.gx, gz: cur.gz });
        open.push({ ...n, f: g + h(n) });
      }
    }
    return null;
  }
  const points = (cells) => cells.map((c) => ({ ...center(c.gx, c.gz), cell: c }));

  function makePerson(id) {
    return { id, pos: { x: 0, y: 0, z: 0 }, heading: 0, action: 'away', timer: 0, path: [], goal: null, claim: null, seat: null, transit: null, away: true, outside: true };
  }
  /** Rest in place doing `action` for a while. */
  function rest(p, action, time) {
    p.action = action; p.timer = time ?? between(3, 7); p.path = []; p.goal = null;
  }
  /** A short straight move (stepping onto a seat, off it, or out of furniture's way). */
  function slide(p, to, then, time = settleTime) {
    p.transit = { from: { ...p.pos }, to: { ...to }, t: 0, time, then };
  }
  /** Settles onto a seat, or into bed with `action` 'sleep'. */
  function sitDown(p, s, action = 'sit') {
    p.claim = s.key; p.action = action; p.bed = action === 'sleep';
    p.heading = s.heading;
    slide(p, { x: s.x, y: s.y, z: s.z }, () => { p.seat = s.key; rest(p, action, p.bed ? between(40, 80) : between(8, 18)); p.claim = s.key; });
  }
  /** The free cell to step onto from a seat: in front of it, never the gap behind a sofa. */
  const frontOf = (p, taken) => nearestFree(p.pos.x + Math.sin(p.heading) * 0.75, p.pos.z + Math.cos(p.heading) * 0.75, taken);
  function standUp(p, then = () => rest(p, 'idle', between(0.6, 1.4))) {
    const to = frontOf(p, claimedBy(p));
    p.seat = null; p.claim = null; p.bed = false;
    if (!to) { p.pos.y = 0; then(); return; }
    const c = center(to.gx, to.gz);
    p.action = 'idle';
    slide(p, { x: c.x, y: 0, z: c.z }, then);
  }
  /** Walks along `cells`, then calls `then`. Appends world points (the doorway) when given. */
  function walk(p, cells, goal, extra = []) {
    p.path = [...points(cells), ...extra]; p.goal = goal; p.action = 'walk';
  }

  /** Where to go next: a seat, a kitchen counter, a window, anywhere free, or out of the door. */
  function chooseGoal(p) {
    const taken = claimedBy(p);
    const here = cellOf(p.pos.x, p.pos.z);
    const seats = world.seats().filter((s) => !taken.has(s.key));
    const spots = world.spots().filter((s) => !taken.has(s.key) && !taken.has(cellKey(s)) && free(s.gx, s.gz));
    const kitchen = spots.filter((s) => s.kind === 'kitchen'), windows = spots.filter((s) => s.kind === 'window');
    const door = world.door();
    const others = people.filter((q) => q !== p && q.away).length;
    const canLeave = door && free(door.gx, door.gz) && others < people.length - 1;
    const roll = rng();
    if (evening()) {   // bedtime: most people head for a free bed
      const free = beds().filter((b) => !taken.has(b.key));
      if (free.length && roll < 0.6) return { kind: 'bed', target: pick(free) };
    }
    const cat = catAt();
    if (cat && rng() < 0.15) {   // now and then, go and stroke the cat
      const c = cellOf(cat.x, cat.z);
      const beside = nearestFree(cat.x, cat.z, new Set([...taken, cellKey(c)]));
      if (beside && Math.hypot(center(beside.gx, beside.gz).x - cat.x, center(beside.gx, beside.gz).z - cat.z) < 1.6) return { kind: 'pet', target: beside };
    }
    if (roll < 0.36 && seats.length) return { kind: 'seat', target: pick(seats) };
    if (roll < 0.56 && kitchen.length) return { kind: 'spot', target: pick(kitchen) };
    if (roll < 0.7 && windows.length) return { kind: 'spot', target: pick(windows) };
    if (roll < 0.8 && canLeave) return { kind: 'leave' };
    const { width, depth } = dims();
    for (let i = 0; i < 16; i++) {
      const c = { gx: Math.floor(rng() * width), gz: Math.floor(rng() * depth) };
      if (free(c.gx, c.gz) && !taken.has(cellKey(c)) && (c.gx !== here.gx || c.gz !== here.gz)) return { kind: 'cell', target: c };
    }
    return null;
  }
  /** Plans a route to a goal and claims it. Returns false when there is no way there. */
  function planTo(p, goal) {
    const here = cellOf(p.pos.x, p.pos.z);
    const taken = claimedBy(p);
    if (goal.kind === 'seat' || goal.kind === 'bed') {
      const s = (goal.kind === 'bed' ? beds() : world.seats()).find((q) => q.key === goal.target.key);
      if (!s || taken.has(s.key)) return false;
      const reach = goal.kind === 'bed' ? 0 : 0.75;   // a bed is climbed into from the nearest side
      const approach = nearestFree(s.x + Math.sin(s.heading) * reach, s.z + Math.cos(s.heading) * reach, taken);
      const path = approach && findPath(here, approach);
      if (!path) return false;
      p.claim = s.key; walk(p, path, { ...goal, target: s });
      return true;
    }
    if (goal.kind === 'leave') {
      const door = world.door();
      const path = door && findPath(here, door);
      if (!path) return false;
      p.claim = null; walk(p, path, goal, [{ x: door.x, z: door.z }, { x: door.outX, z: door.outZ }]);
      return true;
    }
    const target = goal.target;
    const path = findPath(here, target);
    if (!path) return false;
    p.claim = goal.kind === 'spot' ? target.key : cellKey(target);
    walk(p, path, goal);
    return true;
  }
  function arrive(p) {
    const g = p.goal;
    p.goal = null;
    if (g?.kind === 'seat') {
      const s = world.seats().find((q) => q.key === g.target.key);
      if (s && !(avoid() === s.key)) { sitDown(p, s); return; }
      p.claim = null; rest(p, 'idle', between(1, 2)); return;
    }
    if (g?.kind === 'bed') {
      const s = beds().find((q) => q.key === g.target.key);
      if (s && evening() && avoid() !== s.key) { sitDown(p, s, 'sleep'); return; }
      p.claim = null; rest(p, 'idle', between(1, 2)); return;
    }
    if (g?.kind === 'pet') {
      const cat = catAt();
      if (cat && Math.hypot(cat.x - p.pos.x, cat.z - p.pos.z) < 1.7) {
        p.heading = Math.atan2(cat.x - p.pos.x, cat.z - p.pos.z);
        rest(p, 'pet', between(3, 5));
      } else rest(p, 'idle', between(1, 2));
      p.claim = cellKey(cellOf(p.pos.x, p.pos.z));
      return;
    }
    if (g?.kind === 'leave') { p.away = true; p.outside = true; p.claim = null; rest(p, 'away', between(10, 24)); return; }
    if (g?.kind === 'spot') {
      p.heading = g.target.heading;
      rest(p, g.target.kind === 'kitchen' ? 'interact' : 'gaze', g.target.kind === 'kitchen' ? between(4, 8) : between(4, 9));
      p.claim = g.target.key;
      return;
    }
    rest(p, 'idle', between(1.5, 4));
    p.claim = cellKey(cellOf(p.pos.x, p.pos.z));
  }
  /** Comes home through the door: appears beyond it and walks in. */
  function enter(p) {
    const door = world.door();
    if (!door || !free(door.gx, door.gz)) { p.timer = 3; return; }
    const inside = center(door.gx, door.gz);
    p.away = false; p.seat = null; p.claim = null;
    p.pos = { x: door.outX, y: 0, z: door.outZ };
    p.path = [{ x: door.x, z: door.z }, { ...inside, cell: { gx: door.gx, gz: door.gz } }];
    p.goal = { kind: 'cell', target: { gx: door.gx, gz: door.gz } };
    p.action = 'walk';
  }
  /** Puts a person straight into the room: a free seat for the first, then spots and free cells. */
  function placeInside(p) {
    const taken = claimedBy(p);
    p.away = false; p.outside = false; p.transit = null; p.path = []; p.goal = null; p.seat = null; p.claim = null; p.bed = false;
    const seats = world.seats().filter((s) => !taken.has(s.key));
    if (seats.length && (p.id === 0 || rng() < 0.5)) {
      const s = pick(seats);
      p.pos = { x: s.x, y: s.y, z: s.z }; p.heading = s.heading; p.seat = s.key; p.claim = s.key;
      rest(p, 'sit', between(6, 16));
      return true;
    }
    const spots = world.spots().filter((s) => !taken.has(s.key) && !taken.has(cellKey(s)) && free(s.gx, s.gz));
    const target = spots.length ? pick(spots) : nearestFree(between(-1, 1), between(-1, 1), taken);
    if (!target) return false;
    const c = center(target.gx, target.gz);
    p.pos = { x: c.x, y: 0, z: c.z };
    p.heading = target.heading ?? rng() * Math.PI * 2;
    p.claim = target.key ?? cellKey(target);
    rest(p, target.kind === 'kitchen' ? 'interact' : target.kind === 'window' ? 'gaze' : 'idle', between(2, 6));
    return true;
  }

  function step(p, dt) {
    if (p.transit) {
      const t = p.transit;
      t.t = Math.min(1, t.t + dt / t.time);
      const k = t.t * t.t * (3 - 2 * t.t);
      p.pos = { x: t.from.x + (t.to.x - t.from.x) * k, y: t.from.y + (t.to.y - t.from.y) * k, z: t.from.z + (t.to.z - t.from.z) * k };
      if (t.t >= 1) { p.pos = { ...t.to }; p.transit = null; t.then(); }
      return;
    }
    if (p.away) {
      if (calm) { placeInside(p); return; }
      p.timer -= dt;
      if (p.timer <= 0) enter(p);
      return;
    }
    if (p.seat) {
      const s = placesOf(p).find((q) => q.key === p.seat);
      if (!s) { standUp(p); return; }
      p.pos = { x: s.x, y: s.y, z: s.z }; p.heading = s.heading;
      if (calm) return;
      if (p.bed && !evening()) { standUp(p); return; }   // morning: up and about
      p.timer -= dt;
      if (p.timer <= 0) standUp(p);
      return;
    }
    const door = world.door();
    const here = cellOf(p.pos.x, p.pos.z);
    const inDoorway = p.action === 'walk' && (!inRoom(here.gx, here.gz) || p.path.length && !p.path[0].cell);
    p.outside = !inRoom(here.gx, here.gz) && !!door;
    // Never rest on furniture: step to the nearest free cell when something lands on this one.
    if (!inDoorway && !free(here.gx, here.gz)) {
      const to = nearestFree(p.pos.x, p.pos.z, claimedBy(p));
      p.claim = null; p.path = []; p.goal = null; p.action = 'idle';
      if (to) { const c = center(to.gx, to.gz); slide(p, { x: c.x, y: 0, z: c.z }, () => rest(p, 'idle', between(1, 2)), 0.35); }
      return;
    }
    if (p.action === 'walk') {
      const next = p.path[0];
      if (next?.cell && !free(next.cell.gx, next.cell.gz)) { const g = p.goal; p.claim = null; if (!g || !planTo(p, g)) rest(p, 'idle', 1); return; }
      if (!next) { arrive(p); return; }
      const dx = next.x - p.pos.x, dz = next.z - p.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 1e-4) p.heading += wrap(Math.atan2(dx, dz) - p.heading) * Math.min(1, dt * 9);
      const stepLen = speed * dt;
      if (dist <= stepLen) { p.pos = { x: next.x, y: 0, z: next.z }; p.path.shift(); }
      else p.pos = { x: p.pos.x + dx / dist * stepLen, y: 0, z: p.pos.z + dz / dist * stepLen };
      return;
    }
    if (calm) return;
    p.timer -= dt;
    if (p.timer <= 0) { p.claim = null; const g = chooseGoal(p); if (!g || !planTo(p, g)) rest(p, 'idle', between(1, 3)); }
  }

  function pose(i) {
    const p = people[i];
    if (!p) return null;
    const spot = !p.away && !p.transit && (p.action === 'interact' || p.action === 'gaze') ? p.claim : null;
    return { x: p.pos.x, y: p.pos.y, z: p.pos.z, heading: p.heading, action: p.away ? 'away' : p.action, outside: p.away || p.outside, seat: p.seat, spot, settling: !!p.transit };
  }

  return {
    /** How many people live here (0 to MAX_RESIDENTS). With `viaDoor`, new arrivals walk in through the door. */
    setCount(n, { viaDoor = false } = {}) {
      n = Math.max(0, Math.min(MAX_RESIDENTS, n | 0));
      while (people.length > n) people.pop();
      while (people.length < n) {
        const p = makePerson(people.length);
        people.push(p);
        if (!viaDoor || calm || !world.door() || !free(world.door().gx, world.door().gz)) { if (!placeInside(p)) rest(p, 'away', 2); }
        else enter(p);
      }
    },
    get count() { return people.length; },
    /** Places everyone inside the room again. Call after the room changes. */
    reset() { for (const p of people) { p.claim = null; p.seat = null; } for (const p of people) if (!placeInside(p)) { p.away = true; rest(p, 'away', 2); } },
    update(dt) { dt = Math.min(dt, 0.1); for (const p of people) step(p, dt); return people.map((_, i) => pose(i)); },
    pose,
    poses: () => people.map((_, i) => pose(i)),
    setCalm(on) {
      calm = !!on;
      if (!calm) return;
      for (const p of people) {
        if (p.away) placeInside(p);
        else if (p.action === 'walk' && !p.transit) { const here = cellOf(p.pos.x, p.pos.z); if (inRoom(here.gx, here.gz) && free(here.gx, here.gz)) { const c = center(here.gx, here.gz); p.pos = { x: c.x, y: 0, z: c.z }; p.outside = false; rest(p, 'idle'); } else placeInside(p); }
      }
    },
    /** The seat key the cat is on (or heading to), which nobody may take. */
    setAvoid(fn) { avoid = fn; },
    /** Seat keys people sit on or are heading to, so the cat leaves them alone. */
    claimedSeats() { return new Set(people.map((p) => p.seat || p.claim).filter((k) => k && !k.startsWith('cell:'))); },
    /** How far the door should be open, 0..1: open while someone is within a step of the threshold. */
    doorWanted() {
      const door = world.door();
      if (!door) return 0;
      return people.some((p) => !p.away && Math.hypot(p.pos.x - door.x, p.pos.z - door.z) < 1.25 && (p.action === 'walk' || p.outside)) ? 1 : 0;
    },
    /** Tests and debugging: sends person i somewhere now ({ kind: 'leave' } or { kind: 'seat'|'spot'|'cell', target }). */
    send(i, goal) {
      const p = people[i];
      if (!p || p.away) return false;
      if (p.seat || p.transit) {
        const to = frontOf(p, claimedBy(p));
        if (!to) return false;
        const c = center(to.gx, to.gz);
        p.pos = { x: c.x, y: 0, z: c.z }; p.seat = null; p.transit = null;
      }
      p.claim = null;
      return planTo(p, goal);
    },
    /** Debug and tests. */
    cellOf: (i) => { const p = people[i]; return p && !p.away && !p.seat && !p.transit ? cellOf(p.pos.x, p.pos.z) : null; },
    person: (i) => people[i],
    findPath, nearestFree,
  };
}
