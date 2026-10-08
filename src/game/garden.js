// The garden around the house: where each tree, bush, flower, stone and fence post goes. Pure data in world
// units (the room is centred on the origin, one unit per cell), no Three.js, so tests/unit can check it. The
// scene builds it from Kenney Nature Kit models (src/scene/garden.js).
//
// planGarden({ width, depth, door }) -> { half: { x, z }, room: { x, z }, props: [{ key, x, z, rot, scale, tall }] }
//   half   the island's half size: the room plus a margin that grows with the room; room: the room's half size
//   door   presetDoor(preset) ({ wall: 'left' | 'back', at }) or null; a stone path leads from it to a gap in the fence
//   tall   trees, which the scene hides while they stand between the camera and the room
// The same room size and door always give the same garden.

export const GARDEN_MARGIN = 6;   // island cells beyond an 8 x 8 room, on every side
const TREES = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_tall', 'tree_simple'];
const FLOWERS = ['flower_purpleA', 'flower_redA', 'flower_yellowA', 'flower_yellowB'];
const BUSHES = ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall'];
const SCATTER = ['grass', 'grass_large', 'grass_leafs', 'grass', 'rock_smallA', 'rock_smallB', 'mushroom_red', 'mushroom_tanGroup', 'flower_yellowB', 'flower_purpleA'];
/** Every model a garden can use (public/models/garden; tools/copy-nature.mjs copies them from the pack). */
export const GARDEN_KEYS = [...new Set([...TREES, ...FLOWERS, ...BUSHES, ...SCATTER, 'stump_round', 'path_stone', 'fence_simple'])];
const FENCE = 1.6;   // fence_simple is one unit long; this scale makes each section 1.6

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
}

export function planGarden({ width, depth, door = null }) {
  const rng = seeded(width * 7919 + depth * 104729 + (door ? (door.wall === 'back' ? 3 : 5) * 31 + Math.round(door.at * 10) : 0));
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const hw = width / 2, hd = depth / 2;
  const margin = Math.round(GARDEN_MARGIN * Math.max(1, Math.max(width, depth) / 8));
  const half = { x: hw + margin, z: hd + margin };
  const props = [];
  const add = (key, x, z, scale, extra = {}) => props.push({ key, x, z, rot: extra.rot ?? rng() * Math.PI * 2, scale, tall: !!extra.tall });

  // The path: stepping stones from the door straight out to the fence, where the fence leaves a gap.
  const path = [];
  if (door) {
    const along = door.wall === 'back' ? 'z' : 'x', start = (along === 'x' ? -hw : -hd) - 0.9, end = -(along === 'x' ? half.x : half.z) + 0.8;
    for (let t = start; t > end; t -= 1.05) {
      const p = along === 'x' ? { x: t, z: door.at } : { x: door.at, z: t };
      path.push(p);
      add('path_stone', p.x, p.z, 1.25, { rot: (along === 'x' ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.3 });
    }
  }
  const nearPath = (x, z, r) => path.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  // Distance from the room's footprint (its plinth reaches 0.24 past the walls).
  const fromRoom = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, Math.abs(z) - hd));
  const inside = (x, z, inset) => Math.abs(x) < half.x - inset && Math.abs(z) < half.z - inset;

  // A low picket fence round the plot, one section at a time, open where the path meets it.
  for (const [axis, sign] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
    const edge = (axis === 'x' ? half.x : half.z) - 0.5, run = (axis === 'x' ? half.z : half.x) - 0.5;
    const n = Math.floor((run * 2) / FENCE), first = -(n * FENCE) / 2 + FENCE / 2;
    for (let i = 0; i < n; i++) {
      const s = first + i * FENCE;
      const x = axis === 'x' ? sign * edge : s, z = axis === 'x' ? s : sign * edge;
      if (nearPath(x, z, 1.3)) continue;
      add('fence_simple', x, z, FENCE, { rot: axis === 'x' ? Math.PI / 2 : 0 });
    }
  }

  // Flower beds and bushes hugging the outside of the walls, the open front sides brightest.
  for (let x = -hw + 0.5; x < hw; x += 0.75) {
    const z = hd + 0.75;
    if (!nearPath(x, z, 0.9)) add(rng() < 0.75 ? pick(FLOWERS) : pick(BUSHES), x + (rng() - 0.5) * 0.2, z + (rng() - 0.5) * 0.25, 2.2);
    if (!nearPath(x, -hd - 0.8, 0.9) && rng() < 0.6) add(pick(BUSHES), x, -hd - 0.8, 2.4);
  }
  for (let z = -hd + 0.5; z < hd; z += 0.75) {
    const x = hw + 0.75;
    if (!nearPath(x, z, 0.9)) add(rng() < 0.75 ? pick(FLOWERS) : pick(BUSHES), x + (rng() - 0.5) * 0.25, z + (rng() - 0.5) * 0.2, 2.2);
    if (!nearPath(-hw - 0.8, z, 1.2) && rng() < 0.6) add(pick(BUSHES), -hw - 0.8, z, 2.4);
  }

  // Trees on a loose grid in the band between the beds and the fence, never on the path.
  const trees = [];
  for (let x = -half.x + 1.6; x < half.x - 1.4; x += 2.3) {
    for (let z = -half.z + 1.6; z < half.z - 1.4; z += 2.3) {
      const tx = x + (rng() - 0.5) * 1.2, tz = z + (rng() - 0.5) * 1.2;
      if (fromRoom(tx, tz) < 2.2 || nearPath(tx, tz, 1.8) || !inside(tx, tz, 1.4) || rng() > 0.42) continue;
      trees.push({ x: tx, z: tz });
      add(pick(TREES), tx, tz, 2.4 + rng() * 0.9, { tall: true });
      if (rng() < 0.35) add(rng() < 0.5 ? 'mushroom_tanGroup' : 'stump_round', tx + 0.7, tz + 0.5, 2);
    }
  }
  // Grass tufts, small rocks and wild flowers scattered over the rest of the lawn.
  for (let x = -half.x + 0.8; x < half.x - 0.8; x += 0.95) {
    for (let z = -half.z + 0.8; z < half.z - 0.8; z += 0.95) {
      const sx = x + (rng() - 0.5) * 0.7, sz = z + (rng() - 0.5) * 0.7;
      if (rng() > 0.3 || fromRoom(sx, sz) < 1.3 || nearPath(sx, sz, 0.9) || !inside(sx, sz, 1.1) || trees.some((t) => Math.hypot(t.x - sx, t.z - sz) < 1)) continue;
      add(pick(SCATTER), sx, sz, 1.8 + rng() * 0.6);
    }
  }
  return { half, room: { x: hw, z: hd }, props };
}
