import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { planGarden, GARDEN_KEYS, GARDEN_MARGIN } from '../../src/game/garden.js';
import { ROOM_PRESETS, presetDoor } from '../../src/data/presets.js';

const fromRoom = (p, plan) => Math.hypot(Math.max(0, Math.abs(p.x) - plan.room.x), Math.max(0, Math.abs(p.z) - plan.room.z));

test('every walled preset gets a garden that keeps off the house, the path and the fence line, the same every time', () => {
  for (const [id, preset] of Object.entries(ROOM_PRESETS)) {
    if (preset.walls === 'railing') continue;
    const args = { width: preset.width, depth: preset.depth, door: presetDoor(preset) };
    const plan = planGarden(args);
    expect(planGarden(args)).toEqual(plan);                                            // deterministic
    expect(plan.half.x).toBeGreaterThanOrEqual(preset.width / 2 + GARDEN_MARGIN);
    const trees = plan.props.filter((p) => p.tall);
    expect(trees.length, id).toBeGreaterThan(6);
    for (const p of plan.props) {
      expect(GARDEN_KEYS, p.key).toContain(p.key);
      expect(Math.abs(p.x) <= plan.half.x && Math.abs(p.z) <= plan.half.z, id + ' ' + p.key + ' on the island').toBe(true);
      if (p.key !== 'path_stone') expect(fromRoom(p, plan), id + ' ' + p.key + ' clear of the plinth').toBeGreaterThan(0.4);
    }
    for (const t of trees) expect(fromRoom(t, plan), id + ' tree clear of the walls').toBeGreaterThan(2);
    // The path leads out of the door to a gap in the fence.
    const stones = plan.props.filter((p) => p.key === 'path_stone');
    expect(stones.length, id).toBeGreaterThan(2);
    const door = presetDoor(preset), across = (p) => (door.wall === 'back' ? p.x : p.z);
    for (const s of stones) expect(across(s)).toBeCloseTo(door.at, 5);
    const fence = plan.props.filter((p) => p.key === 'fence_simple');
    const gate = stones.at(-1);
    expect(fence.some((f) => Math.hypot(f.x - gate.x, f.z - gate.z) < 1.3)).toBe(false);
    for (const p of plan.props.filter((q) => q.key !== 'path_stone' && q.key !== 'fence_simple')) {
      expect(stones.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 0.8), id + ' ' + p.key + ' off the path').toBe(false);
    }
  }
});

test('the island grows with the room, and every garden model ships in public/models/garden', () => {
  expect(planGarden({ width: 12, depth: 12 }).half.x).toBeGreaterThan(planGarden({ width: 8, depth: 8 }).half.x + 2);
  for (const key of GARDEN_KEYS) expect(existsSync('public/models/garden/' + key + '.glb'), key).toBe(true);
});
