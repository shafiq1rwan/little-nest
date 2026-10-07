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
  expect(store.rooms[0].room).toMatchObject({ version: 11, residents: 3 });

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
    for (const id of ['livingRoom', 'studio', 'bedroom', 'balcony', 'readingNook', 'apartment', 'house']) {
      s.startPreset(id);
      const d = s.residents.world.door();
      out[id] = d ? s.isFree('pouf', d.gx, d.gz, 0) && !!s.door : null;
    }
    return out;
  });
  expect(doors).toEqual({ livingRoom: true, studio: true, bedroom: true, balcony: null, readingNook: true, apartment: true, house: true });
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

test('in the studio the TV, desk screen and stove come on for the people using them, with bubbles, and go off after', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.evaluate(() => { const s = window.__sim; s.startPreset('studio'); s.commands.setFinish('petPresent', false); s.commands.setFinish('residents', 3); });
  const typeOf = (page, kind) => page.evaluate((kind) => window.__sim.items.find((i) => i.type === kind)?.id, kind);
  const [tv, screen, stove] = [await typeOf(page, 'kitTelevisionModern'), await typeOf(page, 'kitComputerScreen'), await typeOf(page, 'kitKitchenStoveElectric')];

  // Everyone stands up somewhere neutral first, then each goes to one thing and stays there.
  const sent = await page.evaluate(([tv, screen, stove]) => {
    const s = window.__sim, w = s.residents.world, b = s.residents.brain;
    const owner = (key) => s.items.find((i) => key.startsWith(i.id + ':'))?.type;
    const sofa = w.seats().find((q) => owner(q.key) === 'kitLoungeSofa');
    const desk = w.seats().find((q) => owner(q.key) === 'kitChairDesk');
    const cook = w.spots().find((q) => q.key === 'spot:' + stove);
    for (let i = 0; i < 3; i++) b.person(i).claim = null;   // wherever they started, these three places are theirs now
    return [b.send(0, { kind: 'seat', target: sofa }), b.send(1, { kind: 'seat', target: desk }), b.send(2, { kind: 'spot', target: cook })];
  }, [tv, screen, stove]);
  expect(sent).toEqual([true, true, true]);
  // Pin each person the moment they reach their own place, so nobody wanders off while the others arrive.
  const settled = await page.evaluate((stove) => new Promise((resolve) => {
    const s = window.__sim, b = s.residents.brain, owner = (key) => s.items.find((i) => key?.startsWith(i.id + ':'))?.type;
    const there = [(p) => owner(p.seat) === 'kitLoungeSofa', (p) => owner(p.seat) === 'kitChairDesk', (p) => p.action === 'interact' && p.spot === 'spot:' + stove];
    const done = [false, false, false], started = performance.now();
    (function check() {
      s.residents.poses.forEach((p, i) => { if (!done[i] && !p.settling && there[i](p)) { done[i] = true; b.person(i).timer = 999; } });
      if (done.every(Boolean) || performance.now() - started > 60000) resolve(done); else requestAnimationFrame(check);
    })();
  }), stove);
  expect(settled).toEqual([true, true, true]);
  await page.waitForFunction((ids) => ids.every((id) => window.__sim.activities.isLit(id)), [tv, screen, stove], { timeout: 10000 });
  expect(await page.evaluate((id) => window.__sim.activities.hasSteam(id), stove)).toBe(true);

  // A bubble pops over a head and goes away by itself.
  await page.evaluate(() => { const s = window.__sim; s.activities.showBubble(s.residents.bodies[0], 'heart'); });
  expect(await page.evaluate(() => window.__sim.activities.bubbleOf(window.__sim.residents.bodies[0]))).toBe('heart');
  await page.waitForFunction(() => window.__sim.activities.bubbleOf(window.__sim.residents.bodies[0]) === null, null, { timeout: 15000 });

  // Nobody home: every appliance fades off and the steam stops.
  await page.evaluate(() => window.__sim.commands.setFinish('residents', 0));
  await page.waitForFunction((ids) => ids.every((id) => !window.__sim.activities.isLit(id) && !window.__sim.activities.hasSteam(id)), [tv, screen, stove], { timeout: 10000 });
  expect(errors).toEqual([]);
});

test('at night people sleep in the bedroom bed under a blanket, and get up when the lighting changes', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.evaluate(() => { const s = window.__sim; s.startPreset('bedroom'); s.commands.setFinish('residents', 2); s.commands.setFinish('lighting', 'evening'); });
  const sent = await page.evaluate(() => {
    const r = window.__sim.residents, b = r.brain, beds = r.world.beds();
    for (let i = 0; i < 2; i++) b.person(i).claim = null;
    return [beds.length, b.send(0, { kind: 'bed', target: beds[0] }), b.send(1, { kind: 'bed', target: beds[1] })];
  });
  expect(sent).toEqual([2, true, true]);   // the double bed sleeps two
  await page.waitForFunction(() => window.__sim.residents.poses.every((p) => p.action === 'sleep' && p.seat && !p.settling), null, { timeout: 60000 });
  expect(await page.evaluate(() => window.__sim.residents.bodies.map((b) => b.getObjectByName('blanket').visible))).toEqual([true, true]);
  await page.evaluate(() => window.__sim.commands.setFinish('lighting', 'morning'));
  await page.waitForFunction(() => window.__sim.residents.poses.every((p) => p.action !== 'sleep' && !p.seat?.startsWith('bed')), null, { timeout: 20000 });
  expect(await page.evaluate(() => window.__sim.residents.bodies.map((b) => b.getObjectByName('blanket').visible))).toEqual([false, false]);
  expect(errors).toEqual([]);
});

test('ringing the doorbell brings a guest in through the door, who leaves again; the balcony has no visitors', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.locator('#deselect').click();
  await page.locator('#tab-light').click();
  await page.locator('#doorbell').click();
  await expect(page.locator('#toast')).toContainText('Ding-dong');
  expect(await page.evaluate(() => window.__sim.sfx.log.includes('doorbell'))).toBe(true);
  expect(await page.evaluate(() => window.__sim.residents.count)).toBe(2);   // a guest is not a resident
  await page.waitForFunction(() => { const r = window.__sim.residents; return r.guest && !r.guest.outside && r.guestBody?.visible; }, null, { timeout: 30000 });
  await page.locator('#doorbell').click();
  await expect(page.locator('#toast')).toContainText('already visiting');

  // Cut the visit short: they walk back out through the door and their body goes away.
  await page.evaluate(() => { window.__sim.residents.brain.guest().visit = 0.1; });
  await page.waitForFunction(() => !window.__sim.residents.guest && !window.__sim.residents.guestBody, null, { timeout: 60000 });

  await page.evaluate(() => window.__sim.startPreset('balcony'));
  await page.locator('#doorbell').click();
  await expect(page.locator('#toast')).toContainText('no door');
  expect(errors).toEqual([]);
});

test('residents can be renamed and dressed from the Light tab, undone, saved, and show their name on hover', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.locator('#deselect').click();
  await page.locator('#tab-light').click();
  await expect(page.locator('#resident-people .resident-row')).toHaveCount(2);
  expect(await page.evaluate(() => window.__sim.residents.names)).toEqual(['Maya', 'Sam']);

  // Rename the first person (one undo step on commit, not per key).
  const name = page.locator('#resident-people [aria-label="Name of person 1"]');
  await name.fill('Nadia');
  await name.press('Enter');
  await page.waitForFunction(() => window.__sim.residents.names[0] === 'Nadia');

  // Next look for the second person: a look that was not preloaded loads, then the body changes.
  await page.locator('#resident-people [aria-label="Next look for Sam"]').click();
  await page.waitForFunction(() => window.__sim.residents.looks[1] === 'male-b', null, { timeout: 15000 });
  await expect(page.locator('#resident-people .resident-row[data-person="1"] img')).toHaveAttribute('src', /male-b\.png$/);
  await page.locator('#undo-tool').click();
  await page.waitForFunction(() => window.__sim.residents.looks[1] === 'male-a');
  await page.locator('#redo-tool').click();
  await page.waitForFunction(() => window.__sim.residents.looks[1] === 'male-b');

  // Saved with the room.
  await page.locator('#save').click();
  const saved = (await galleryStore(page)).rooms[0].room;
  expect(saved.people.slice(0, 2)).toEqual([{ name: 'Nadia', look: 'female-b' }, { name: 'Sam', look: 'male-b' }]);

  // Hovering a person shows their name tag; moving away hides it.
  await page.evaluate(() => { const r = window.__sim.residents; for (let i = 0; i < r.count; i++) r.brain.person(i).timer = 999; });
  const at = await page.evaluate(() => {
    const s = window.__sim, body = s.residents.bodies[0];
    const p = body.getWorldPosition(body.position.clone()); p.y += 0.6; p.project(s.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.move(at.x, at.y);
  await page.waitForFunction(() => window.__sim.residents.bodies[0].getObjectByName('name-tag').visible);
  await page.mouse.move(5, 300);
  await page.waitForFunction(() => !window.__sim.residents.bodies[0].getObjectByName('name-tag').visible);
  expect(errors).toEqual([]);
});

test('the apartment has a walled bathroom people reach through its door, and a tiled kitchen with an island', async ({ page }) => {
  const errors = await openGame(page, '/');
  const info = await page.evaluate(() => {
    const s = window.__sim;
    s.startPreset('apartment');
    const types = s.items.map((i) => i.type);
    return {
      size: [s.roomConfig.width, s.roomConfig.depth],
      bathroom: ['kitBathtub', 'kitToilet', 'kitBathroomSink', 'kitBathroomMirror', 'kitBathroomCabinetDrawer'].every((t) => types.includes(t)),
      kitchen: ['kitKitchenSink', 'kitKitchenStove', 'kitKitchenFridge', 'kitKitchenBar', 'kitStoolBar'].every((t) => types.includes(t)),
      kitchenSpots: s.residents.world.spots().filter((q) => q.kind === 'kitchen' && q.gz === 1 && q.gx >= 6).length,
      basin: s.residents.world.spots().find((q) => q.key === 'spot:' + s.items.find((i) => i.type === 'kitBathroomSink').id),
      wallThrough: s.placement.passable(3, 1, 4, 1), doorway: s.placement.passable(3, 2, 3, 3),
      straddle: s.isFree('kitTableCoffee', 2, 3, 0) && !s.state.canPlace('kitTableCoffee', 3, 1, 0),
    };
  });
  // Six kitchen spots in the corridor: four at the back counters, two at the island (worked from the kitchen side).
  expect(info).toMatchObject({ size: [10, 8], bathroom: true, kitchen: true, kitchenSpots: 6, wallThrough: false, doorway: true, straddle: true });
  // Someone goes to wash up at the basin: they get there through the doorway.
  await page.evaluate(() => window.__sim.commands.setFinish('residents', 1));
  const sent = await page.evaluate((spot) => { const b = window.__sim.residents.brain; b.person(0).claim = null; return b.send(0, { kind: 'spot', target: spot }); }, info.basin);
  expect(sent).toBe(true);
  await page.waitForFunction((key) => { const p = window.__sim.residents.poses[0]; return p.action === 'interact' && p.spot === key; }, info.basin.key, { timeout: 60000 });
  expect(errors).toEqual([]);
});

test('the house has a bedroom, bathroom, reading room, hall, kitchen and living room, all reachable from the front door', async ({ page }) => {
  const errors = await openGame(page, '/');
  const info = await page.evaluate(() => {
    const s = window.__sim, b = s.residents.brain;
    s.startPreset('house');
    const door = s.residents.world.door();
    const from = { gx: door.gx, gz: door.gz };
    // A free cell in each room, by the plan in src/data/presets.js.
    const rooms = { bedroom: { gx: 3, gz: 3 }, bathroom: { gx: 6, gz: 2 }, reading: { gx: 3, gz: 6 }, hall: { gx: 1, gz: 10 }, kitchen: { gx: 9, gz: 1 }, living: { gx: 8, gz: 9 } };
    const reach = Object.fromEntries(Object.entries(rooms).map(([k, c]) => [k, s.isFree('pouf', c.gx, c.gz, 0) && !!b.findPath(from, c)]));
    const types = new Set(s.items.map((i) => i.type));
    return {
      size: [s.roomConfig.width, s.roomConfig.depth], reach,
      furnished: ['kitBedDouble', 'kitBathtub', 'kitToilet', 'kitKitchenStove', 'kitLoungeChairRelax', 'kitLoungeSofa', 'kitTable', 'kitCoatRackStanding'].every((t) => types.has(t)),
      residents: s.residents.count, cat: !!s.pet,
      throughWall: s.placement.passable(4, 2, 5, 2),
    };
  });
  expect(info).toEqual({ size: [12, 12], reach: { bedroom: true, bathroom: true, reading: true, hall: true, kitchen: true, living: true }, furnished: true, residents: 3, cat: true, throughWall: false });
  expect(errors).toEqual([]);
});

test('in the house, clicking a room turns its walls see-through; open floor turns them solid; placing previews the room', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.evaluate(() => { const s = window.__sim; s.startPreset('house'); s.commands.setFinish('residents', 0); s.commands.setFinish('petPresent', false); });
  await page.locator('#panel-close').click();
  const at = (gx, gz) => page.evaluate(([gx, gz]) => {
    const s = window.__sim, p = new s.camera.position.constructor(gx - 6 + 0.5, 0, gz - 6 + 0.5);
    p.project(s.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  }, [gx, gz]);
  const rooms = () => page.evaluate(() => { const r = window.__sim.rooms; return { focus: r.focus, ghosted: r.ghosted, bathroom: r.roomOf(6, 1), bedroom: r.roomOf(3, 3) }; });
  expect((await rooms()).ghosted).toBe(0);   // solid walls by default

  let p = await at(6, 2);   // the bathroom floor, behind its wall
  await page.mouse.click(p.x, p.y);
  let r = await rooms();
  expect(r.focus).toBe(r.bathroom);
  expect(r.ghosted).toBeGreaterThan(0);

  p = await at(9, 9);       // open living-room floor
  await page.mouse.click(p.x, p.y);
  expect(await rooms()).toMatchObject({ focus: null, ghosted: 0 });

  // Placing a pouf: the room under the pointer goes see-through while aiming, and solid again after.
  await page.locator('#dock-decorate').click();
  await page.locator('#search').fill('pouf');
  await page.locator('.catalog-card[data-type="pouf"]').click();
  p = await at(3, 3);
  await page.mouse.move(p.x, p.y);
  r = await page.evaluate(() => ({ preview: window.__sim.rooms.preview, bedroom: window.__sim.rooms.roomOf(3, 3), ghosted: window.__sim.rooms.ghosted }));
  expect(r.preview).toBe(r.bedroom);
  expect(r.ghosted).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  p = await at(9, 9);
  await page.mouse.move(p.x, p.y);
  expect((await rooms()).ghosted).toBe(0);
  expect(errors).toEqual([]);
});
