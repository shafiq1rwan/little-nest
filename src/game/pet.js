// The cat's behaviour: where it goes and what it does. Pure logic in world units, no Three.js and
// no DOM, so tests/unit can drive it. The scene turns each pose into joint angles (src/scene/cat.js).
//
// world: {
//   dims()       -> { width, depth, cell }        room size in cells
//   isFree(gx,gz) -> boolean                      floor cell clear of furniture
//   seats()      -> [{ key, x, y, z }]            free seat slots the cat may hop onto (world position)
//   favourites() -> { rug: [{gx,gz}], sun: [{gx,gz}] }   cells it likes to rest on
// }
// update(dt) returns { x, y, z, heading, action, hop, look }. action: 'walk' | 'sit' | 'curl' | 'hop'.
// The cat never stands on a cell that is not free: each update it checks its cell and its path,
// hops to the nearest free cell when furniture lands on it, and replans when the path is blocked.

export const PET_ACTIONS = ['walk', 'sit', 'curl', 'hop'];

export function createPetBrain(world, { rng = Math.random, speed = 0.85, hopTime = 0.45 } = {}) {
  let pos = { x: 0, y: 0, z: 0 };
  let heading = 0;
  let action = 'sit';
  let timer = 0;
  let path = [];               // remaining waypoints [{ gx, gz }]
  let goal = null;             // { kind: 'cell'|'seat', gx?, gz?, seatKey?, rest: 'sit'|'curl' }
  let seat = null;             // seat key while sitting on furniture
  let hop = null;              // { from, to, t, then, seatKey }
  let look = null;             // { x, z } point of interest, or null
  let lookYaw = 0;
  let calm = false;            // reduced motion: rest in place, only hop away from furniture

  const dims = () => world.dims();
  const center = (gx, gz) => { const { width, depth, cell } = dims(); return { x: -width * cell / 2 + (gx + 0.5) * cell, z: -depth * cell / 2 + (gz + 0.5) * cell }; };
  const cellOf = (x, z) => { const { width, depth, cell } = dims(); return { gx: Math.floor((x + width * cell / 2) / cell), gz: Math.floor((z + depth * cell / 2) / cell) }; };
  const inRoom = (gx, gz) => { const { width, depth } = dims(); return gx >= 0 && gz >= 0 && gx < width && gz < depth; };
  const free = (gx, gz) => inRoom(gx, gz) && world.isFree(gx, gz);
  const between = (a, b) => a + rng() * (b - a);

  /** Nearest free cell to a point, searching outward ring by ring, or null in a full room. */
  function nearestFree(x, z) {
    const { width, depth } = dims();
    const c = cellOf(x, z);
    let best = null, bestD = Infinity;
    for (let gx = 0; gx < width; gx++) for (let gz = 0; gz < depth; gz++) {
      if (!free(gx, gz)) continue;
      const p = center(gx, gz), d = (p.x - x) ** 2 + (p.z - z) ** 2 + (gx === c.gx && gz === c.gz ? -1e-6 : 0);
      if (d < bestD) { bestD = d; best = { gx, gz }; }
    }
    return best;
  }
  /** A* over free cells with eight neighbours; diagonals may not cut a blocked corner. */
  function findPath(from, to) {
    if (!free(to.gx, to.gz)) return null;
    const key = (c) => c.gx + ',' + c.gz;
    const open = [{ ...from, g: 0, f: 0 }];
    const came = new Map([[key(from), null]]);
    const cost = new Map([[key(from), 0]]);
    const h = (c) => Math.hypot(c.gx - to.gx, c.gz - to.gz);
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.gx === to.gx && cur.gz === to.gz) {
        const out = []; let k = key(cur), c = { gx: cur.gx, gz: cur.gz };
        while (c) { out.unshift(c); c = came.get(k); k = c ? key(c) : null; }
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
        open.push({ ...n, g, f: g + h(n) });
      }
    }
    return null;
  }

  function startHop(to, then, seatKey = null) {
    hop = { from: { ...pos }, to: { ...to }, t: 0, then, seatKey };
    action = 'hop';
    heading = Math.atan2(to.x - pos.x, to.z - pos.z);
  }
  function rest(kind) {
    action = kind;
    timer = kind === 'curl' ? between(7, 14) : between(2.5, 5);
    path = []; goal = null;
  }
  /** Places the cat on a free cell, preferring a rug. Call after the room changes. */
  function reset() {
    const fav = world.favourites();
    const spots = [...fav.rug, ...fav.sun].filter((c) => free(c.gx, c.gz));
    const start = spots.length ? spots[Math.floor(rng() * spots.length)] : nearestFree(0, 0);
    seat = null; hop = null; path = []; goal = null;
    if (!start) { pos = { x: 0, y: 0, z: 0 }; action = 'sit'; timer = 3; return; }
    const p = center(start.gx, start.gz);
    pos = { x: p.x, y: 0, z: p.z };
    heading = rng() * Math.PI * 2;
    rest('curl');
  }
  /** Chooses where to go next: rugs, sunny cells, seats, or anywhere free. */
  function chooseGoal() {
    const fav = world.favourites();
    const seats = world.seats();
    const roll = rng();
    const pick = (list) => list[Math.floor(rng() * list.length)];
    const here = cellOf(pos.x, pos.z);
    const freeCells = (list) => list.filter((c) => free(c.gx, c.gz) && !(c.gx === here.gx && c.gz === here.gz));
    if (roll < 0.25 && seats.length) { const s = pick(seats); return { kind: 'seat', seatKey: s.key, rest: 'curl' }; }
    if (roll < 0.6 && freeCells(fav.rug).length) return { kind: 'cell', ...pick(freeCells(fav.rug)), rest: rng() < 0.6 ? 'curl' : 'sit' };
    if (roll < 0.85 && freeCells(fav.sun).length) return { kind: 'cell', ...pick(freeCells(fav.sun)), rest: rng() < 0.7 ? 'curl' : 'sit' };
    const { width, depth } = dims();
    for (let i = 0; i < 12; i++) { const c = { gx: Math.floor(rng() * width), gz: Math.floor(rng() * depth) }; if (free(c.gx, c.gz)) return { kind: 'cell', ...c, rest: 'sit' }; }
    return null;
  }
  function planTo(g) {
    const here = cellOf(pos.x, pos.z);
    let target = g;
    if (g.kind === 'seat') {
      const s = world.seats().find((q) => q.key === g.seatKey);
      if (!s) return false;
      target = nearestFree(s.x, s.z);
      if (!target) return false;
      g = { ...g, approach: target };
    }
    const p = target.gx === here.gx && target.gz === here.gz ? [] : findPath(here, target);
    if (!p) return false;
    path = p; goal = g; action = 'walk';
    return true;
  }

  function update(dt) {
    dt = Math.min(dt, 0.1);
    // Hops run to completion, then hand over to what was planned.
    if (hop) {
      hop.t = Math.min(1, hop.t + dt / hopTime);
      const k = hop.t;
      pos = { x: hop.from.x + (hop.to.x - hop.from.x) * k, y: hop.from.y + (hop.to.y - hop.from.y) * k + Math.sin(k * Math.PI) * 0.35, z: hop.from.z + (hop.to.z - hop.from.z) * k };
      if (k >= 1) { const { then, seatKey, to } = hop; pos = { ...to }; seat = seatKey; hop = null; then(); }
      return pose();
    }
    // On a seat: stay while the seat is still there and free.
    if (seat) {
      const s = world.seats().find((q) => q.key === seat);
      if (!s) { hopDown(); return pose(); }
      pos = { x: s.x, y: s.y, z: s.z };
      if (!calm) timer -= dt;
      if (timer <= 0) hopDown();
      return pose();
    }
    // On the floor: never stay on an occupied cell.
    const here = cellOf(pos.x, pos.z);
    if (!free(here.gx, here.gz)) {
      const to = nearestFree(pos.x, pos.z);
      if (to) { const c = center(to.gx, to.gz); startHop({ x: c.x, y: 0, z: c.z }, () => rest('sit')); }
      return pose();
    }
    if (action === 'walk') {
      if (path.length && !free(path[0].gx, path[0].gz)) { if (!goal || !planTo(goal)) rest('sit'); return pose(); }
      if (!path.length) { arrive(); return pose(); }
      const c = center(path[0].gx, path[0].gz);
      const dx = c.x - pos.x, dz = c.z - pos.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      heading += wrap(want - heading) * Math.min(1, dt * 8);
      const step = speed * dt;
      if (dist <= step) { pos = { x: c.x, y: 0, z: c.z }; path.shift(); }
      else pos = { x: pos.x + dx / dist * step, y: 0, z: pos.z + dz / dist * step };
      return pose();
    }
    if (calm) return pose();
    timer -= dt;
    if (timer <= 0) { const g = chooseGoal(); if (!g || !planTo(g)) rest('sit'); }
    return pose();
  }
  function arrive() {
    if (goal?.kind === 'seat') {
      const s = world.seats().find((q) => q.key === goal.seatKey);
      const g = goal;
      if (s) { startHop({ x: s.x, y: s.y, z: s.z }, () => { rest(g.rest); }, s.key); return; }
    }
    rest(goal?.rest ?? 'sit');
  }
  function hopDown() {
    const to = nearestFree(pos.x, pos.z);
    seat = null;
    if (!to) { pos.y = 0; rest('sit'); return; }
    const c = center(to.gx, to.gz);
    startHop({ x: c.x, y: 0, z: c.z }, () => rest('sit'));
  }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function pose() {
    // Head turns toward a point of interest within reach while resting, never more than ~70 degrees.
    let want = 0;
    if (look && (action === 'sit' || action === 'curl')) {
      const d = Math.hypot(look.x - pos.x, look.z - pos.z);
      if (d < 3.5) want = Math.max(-1.2, Math.min(1.2, wrap(Math.atan2(look.x - pos.x, look.z - pos.z) - heading)));
    }
    lookYaw += (want - lookYaw) * 0.2;
    return { x: pos.x, y: pos.y, z: pos.z, heading, action, hop: hop ? hop.t : 0, look: lookYaw, seat };
  }

  return {
    reset, update, pose,
    setCalm(on) { calm = !!on; if (calm && action === 'walk') rest('curl'); },
    lookAt(point) { look = point ? { x: point.x, z: point.z } : null; },
    /** Debug and tests: the floor cell the cat is on, or null while on a seat or mid-hop. */
    cell: () => (seat || hop ? null : cellOf(pos.x, pos.z)),
    get action() { return action; },
    get onSeat() { return seat; },
    findPath, nearestFree,
  };
}
