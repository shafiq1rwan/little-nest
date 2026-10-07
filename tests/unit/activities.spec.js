import { test, expect } from '@playwright/test';
import { activeAppliances, bubbleFor, APPLIANCE_KINDS } from '../../src/game/activities.js';
import { createResidentsBrain } from '../../src/game/residents.js';

// A TV on the back wall at z = -3 facing the room (+z), a laptop at the origin facing +z, and a stove.
const TV = { id: 'tv', kind: 'tv', x: 0, z: -3, facing: 0 };
const LAPTOP = { id: 'lap', kind: 'screen', x: 0, z: 0, facing: 0 };
const STOVE = { id: 'stove', kind: 'stove', x: 3, z: -3, facing: 0 };
const sitter = (x, z, heading) => ({ x, z, heading, action: 'sit', seat: 's:0', spot: null });

test('a TV is on while someone sits facing it, within range, in front of the screen', () => {
  expect(activeAppliances([sitter(0, 1, Math.PI)], [TV])).toEqual(new Set(['tv']));          // facing the TV
  expect(activeAppliances([sitter(0, 1, 0)], [TV]).size).toBe(0);                           // back to the TV
  expect(activeAppliances([{ ...sitter(0, 1, Math.PI), action: 'idle', seat: null }], [TV]).size).toBe(0);   // standing
  expect(activeAppliances([sitter(0, 4, Math.PI)], [TV]).size).toBe(0);                     // seven units away
  expect(activeAppliances([sitter(0, -5, 0)], [TV]).size).toBe(0);                          // behind the wall it faces away from
  expect(activeAppliances([sitter(2, 0, Math.PI)], [TV])).toEqual(new Set(['tv']));         // off to one side, still in view
});

test('a desk screen lights for the person sitting at it; a stove only for the cook at its own spot', () => {
  expect(activeAppliances([sitter(0, 0.9, Math.PI)], [LAPTOP])).toEqual(new Set(['lap']));
  expect(activeAppliances([sitter(0, -0.9, 0)], [LAPTOP]).size).toBe(0);                   // behind the lid
  expect(activeAppliances([sitter(0, 2.5, Math.PI)], [LAPTOP]).size).toBe(0);              // across the room
  const cook = { x: 3, z: -2, heading: Math.PI, action: 'interact', seat: null, spot: 'spot:stove' };
  expect(activeAppliances([cook], [STOVE, TV])).toEqual(new Set(['stove']));
  expect(activeAppliances([{ ...cook, spot: 'spot:fridge' }], [STOVE]).size).toBe(0);
  expect(activeAppliances([{ ...cook, action: 'idle' }], [STOVE]).size).toBe(0);
  for (const kind of Object.values(APPLIANCE_KINDS)) expect(['tv', 'screen', 'stove']).toContain(kind);
});

test('bubbles: hearts near the cat, humming at the stove, coffee at counters, sleepy evenings, none while walking', () => {
  const always = () => 0, never = () => 0.99;
  expect(bubbleFor({ action: 'sit', catNear: true }, never)).toBe('heart');
  expect(bubbleFor({ action: 'interact', place: 'stove' }, never)).toBe('note');
  expect(bubbleFor({ action: 'interact', place: 'kitchen' }, always)).toBe('cup');
  expect(bubbleFor({ action: 'interact', place: 'kitchen' }, never)).toBeNull();
  expect(bubbleFor({ action: 'sit', evening: true }, always)).toBe('sleep');
  expect(bubbleFor({ action: 'sit' }, always)).toBe('heart');
  expect(bubbleFor({ action: 'sit', place: 'tv' }, always)).toBe('note');
  expect(bubbleFor({ action: 'walk', catNear: true }, always)).toBeNull();
});

test('a resident busy at a spot reports it in their pose, and settling is flagged while stepping onto a seat', () => {
  const world = {
    dims: () => ({ width: 6, depth: 6, cell: 1 }), isFree: () => true, door: () => null,
    seats: () => [{ key: 's:0', x: 0.5, y: 0.5, z: -2.5, heading: 0 }],
    spots: () => [{ key: 'spot:stove', kind: 'kitchen', gx: 5, gz: 1, heading: Math.PI }],
  };
  const brain = createResidentsBrain(world, { rng: () => 0.9 });
  brain.setCount(1);
  expect(brain.send(0, { kind: 'spot', target: world.spots()[0] })).toBe(true);
  let busy = null;
  for (let i = 0; i < 300 && !busy; i++) { brain.update(1 / 30); if (brain.pose(0).action === 'interact') busy = brain.pose(0); }
  expect(busy).toMatchObject({ action: 'interact', spot: 'spot:stove', settling: false });
  expect(brain.send(0, { kind: 'seat', target: world.seats()[0] })).toBe(true);
  let settling = false;
  for (let i = 0; i < 300 && !brain.pose(0).seat; i++) { brain.update(1 / 30); settling ||= brain.pose(0).settling; }
  expect(settling).toBe(true);
  expect(brain.pose(0)).toMatchObject({ action: 'sit', seat: 's:0', settling: false, spot: null });
});
