import { test, expect } from '@playwright/test';
import { openGame, loadCurrentRoom, galleryStore, roomState, STARTER_ITEM_COUNT } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

const residents = (page) => page.evaluate(() => {
  const r = window.__sim.residents;
  return { count: r.count, poses: r.poses, cells: r.cells, clips: r.clips, visible: r.bodies.map((b) => b.visible) };
});

test('two people live in the starter room, sit and stand on free floor, walk out of the door and back in', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  const start = await residents(page);
  expect(start.count).toBe(2);
  expect(start.visible).toEqual([true, true]);
  expect(start.clips.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => !!window.__sim.door)).toBe(true);

  // Whenever someone stands on the floor, their cell is free and inside the room.
  const samples = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const r = window.__sim.residents;
      for (const c of r.cells) if (c) out.push(c.gx >= 0 && c.gz >= 0 && c.gx < 8 && c.gz < 8 && window.__sim.isFree('pouf', c.gx, c.gz, 0));
    }
    return out;
  });
  expect(samples.every(Boolean)).toBe(true);

  // Send the second person out: the door swings open, they vanish beyond it, and they come home again.
  expect(await page.evaluate(() => window.__sim.residents.brain.send(1, { kind: 'leave' }))).toBe(true);
  await page.waitForFunction(() => window.__sim.door.open > 0.9, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__sim.residents.poses[1].action === 'away', null, { timeout: 30000 });
  expect((await residents(page)).visible[1]).toBe(false);
  await page.waitForFunction(() => window.__sim.door.open === 0, null, { timeout: 10000 });
  await page.evaluate(() => { window.__sim.residents.brain.person(1).timer = 0; });
  await page.waitForFunction(() => { const p = window.__sim.residents.poses[1]; return p.action !== 'away' && !p.outside; }, null, { timeout: 30000 });
  expect((await residents(page)).visible[1]).toBe(true);

  // A stove gives a kitchen spot in front of it; someone sent there faces it and gets busy.
  const spot = await page.evaluate(() => {
    const s = window.__sim, b = s.residents.brain, me = b.person(0);
    const from = b.nearestFree(me.pos.x + Math.sin(me.heading) * 0.75, me.pos.z + Math.cos(me.heading) * 0.75);   // where a sitter steps out
    for (let gz = 0; gz < 7; gz++) for (let gx = 1; gx < 8; gx++) {
      const reachable = () => { const path = b.findPath(from, { gx, gz: gz + 1 }); return path && !path.some((c) => c.gx === gx && c.gz === gz); };
      if (s.isFree('kitKitchenStove', gx, gz, 0) && s.isFree('pouf', gx, gz + 1, 0) && reachable() && s.addItem('kitKitchenStove', gx, gz, 0)) {
        return { stove: { gx, gz }, spot: s.residents.world.spots().find((q) => q.kind === 'kitchen') };
      }
    }
    return null;
  });
  expect(spot.spot).toMatchObject({ gx: spot.stove.gx, gz: spot.stove.gz + 1, heading: Math.PI });
  expect(await page.evaluate((target) => window.__sim.residents.brain.send(0, { kind: 'spot', target }), spot.spot)).toBe(true);
  await page.waitForFunction(() => window.__sim.residents.poses[0].action === 'interact', null, { timeout: 30000 });
  expect((await residents(page)).clips[0]).toBe('interact-right');
  expect(errors).toEqual([]);
});

test('the people picker is undoable and saved; the door refuses wall decorations but an older save keeps one there', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  await page.locator('#tab-light').click();
  await expect(page.locator('#resident-count [data-residents="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#resident-count [data-residents="3"]').click();
  expect((await residents(page)).count).toBe(3);
  await page.locator('#resident-count [data-residents="0"]').click();
  expect((await residents(page)).count).toBe(0);
  await page.locator('#undo-tool').click();
  expect((await residents(page)).count).toBe(3);
  await expect(page.locator('#resident-count [data-residents="3"]')).toHaveAttribute('aria-pressed', 'true');

  // The door's wall cells: nothing new may hang there, elsewhere on the wall is fine.
  const mount = await page.evaluate(() => {
    const s = window.__sim;
    return { door: s.wallDoors.has('left:7,1'), onDoor: s.state.canMount('mirror', 'left', 7, 1), beside: s.state.canMount('mirror', 'left', 5, 1) };
  });
  expect(mount).toEqual({ door: true, onDoor: false, beside: true });

  await page.locator('#save').click();
  const store = await galleryStore(page);
  expect(store.rooms[0].room).toMatchObject({ version: 10, residents: 3 });

  // An older (version 9) save with a mirror where the door now is loads intact, with nobody home.
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('home-deco-sim:rooms'));
    const room = store.rooms[0].room;
    room.version = 9; delete room.residents;
    room.items.push({ id: 'oldmirror', type: 'mirror', gx: null, gz: null, rot: 0, color: null, parent: null, slot: null, wall: 'left', col: 7, row: 1, lit: null });
    localStorage.setItem('home-deco-sim:rooms', JSON.stringify(store));
  });
  await loadCurrentRoom(page);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await page.evaluate(() => window.__sim.items.some((i) => i.type === 'mirror' && i.wall === 'left' && i.col === 7))).toBe(true);
  expect((await residents(page)).count).toBe(0);
  await expect(page.locator('#resident-count [data-residents="0"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('every room preset with walls has a door with clear floor inside it', async ({ page }) => {
  const errors = await openGame(page);
  const doors = await page.evaluate(() => {
    const s = window.__sim, out = {};
    for (const id of ['livingRoom', 'studio', 'bedroom', 'balcony', 'readingNook']) {
      s.startPreset(id);
      const d = s.residents.world.door();
      out[id] = d ? s.isFree('pouf', d.gx, d.gz, 0) && !!s.door : null;
    }
    return out;
  });
  expect(doors).toEqual({ livingRoom: true, studio: true, bedroom: true, balcony: null, readingNook: true });
  expect(errors).toEqual([]);
});

test('the shipped room presets are furnished from the Modern home collection', async ({ page }) => {
  const errors = await openGame(page, '/');
  const room = await page.evaluate(() => {
    const s = window.__sim;
    const d = s.residents.world.door();
    return {
      count: s.items.length,
      modern: s.items.filter((i) => s.catalogCollection(i.type) === 'modern').length,
      kitchen: s.residents.world.spots().filter((q) => q.kind === 'kitchen').length,
      seats: s.residents.world.seats().length,
      doorClear: s.isFree('pouf', d.gx, d.gz, 0),
      residents: s.residents.count, cat: !!s.pet,
    };
  });
  // 38 Modern home pieces plus a fern, snake plant, monstera, vase and botanical print.
  expect(room).toEqual({ count: 43, modern: 38, kitchen: 4, seats: 9, doorClear: true, residents: 2, cat: true });

  // The other presets are furnished from the Modern home collection too, with somewhere to sit and a clear doorway.
  const others = await page.evaluate(() => {
    const s = window.__sim, out = {};
    for (const id of ['studio', 'bedroom', 'readingNook', 'balcony']) {
      s.startPreset(id);
      const w = s.residents.world, d = w.door();
      out[id] = { count: s.items.length, modern: s.items.filter((i) => s.catalogCollection(i.type) === 'modern').length, seats: w.seats().length, kitchen: w.spots().filter((q) => q.kind === 'kitchen').length, door: d ? s.isFree('pouf', d.gx, d.gz, 0) : null };
    }
    return out;
  });
  expect(others).toEqual({
    studio: { count: 28, modern: 26, seats: 3, kitchen: 3, door: true },
    bedroom: { count: 25, modern: 22, seats: 4, kitchen: 0, door: true },
    readingNook: { count: 17, modern: 13, seats: 2, kitchen: 0, door: true },
    balcony: { count: 13, modern: 8, seats: 3, kitchen: 0, door: null },
  });
  expect(errors).toEqual([]);
});
