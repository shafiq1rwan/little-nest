import { test, expect } from '@playwright/test';
import { openGame, enterFromMenu, roomState, tilePoint, itemPoint, selectedInfo, noHorizontalOverflow, loadCurrentRoom, galleryStore, STARTER_ITEM_COUNT, TERRACOTTA, menu, view } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test('desktop decorating flow: rotate, recolor, save/load, search, finishes, camera, placement, drag, delete', async ({ page }) => {
  const errors = await openGame(page);

  const initial = await roomState(page);
  expect(initial).toHaveLength(STARTER_ITEM_COUNT);
  expect(initial.every((it) => it.gx === null || (it.gx >= 0 && it.gz >= 0 && it.gx < 8 && it.gz < 8))).toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('.catalog-card img')].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);

  // The starter armchair is selected on desktop and sits against furniture, so rotation is rejected.
  expect((await selectedInfo(page)).type).toBe('armchair');
  await page.locator('#rotate-selected').click();
  expect((await selectedInfo(page)).rot).toBe(0);

  await page.getByRole('button', { name: 'Terracotta', exact: true }).click();
  expect((await selectedInfo(page)).color).toBe(TERRACOTTA);

  const saved = await roomState(page);
  await page.locator('#save').click();
  expect(await page.locator('#room-name').textContent()).toBe('Living room');
  await page.locator('#remove-selected').click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT - 1);
  await loadCurrentRoom(page);
  expect(await roomState(page)).toEqual(saved);

  await page.locator('#search').fill('plant');
  expect(await page.locator('.catalog-card:visible').count()).toBe(16);   // plus the Modern home potted plant and three little plants; was: seven plants, the succulent, the hanging plant, the planter, the bonsai, and the botanical print
  await page.locator('#search').fill('rug');
  expect(await page.locator('.catalog-card:visible').count()).toBe(6);   // the classic rug and five Modern home rugs
  await page.locator('#search').fill('');
  await page.locator('[data-category="seating"]').click();
  expect(await page.locator('.catalog-card:visible').count()).toBe(33);   // ten classics and 23 Modern home seats
  await page.locator('[data-category="all"]').click();

  await page.locator('#tab-walls').click();
  await page.getByRole('button', { name: 'Sage', exact: true }).click();
  expect(await page.evaluate(() => window.__sim.wallMat.color.getHex())).toBe(0x9ba58c);
  await page.locator('#tab-floor').click();
  await page.getByRole('button', { name: 'Pale oak', exact: true }).click();
  expect(await page.evaluate(() => window.__sim.floorMat.color.getHex())).toBe(0xf6d9b0);

  await page.locator('#grid-tool').click();
  expect(await page.evaluate(() => window.__sim.grid.visible)).toBe(true);
  await view(page, 'walls-tool');
  expect(await page.evaluate(() => window.__sim.walls.visible)).toBe(false);
  await view(page, 'walls-tool');

  const zoom = await page.evaluate(() => window.__sim.camera.zoom);
  await view(page, 'zoom-in');
  expect(await page.evaluate((z) => window.__sim.camera.zoom > z, zoom)).toBe(true);
  await view(page, 'reset-view');
  expect(await page.evaluate(() => window.__sim.camera.zoom)).toBe(1);

  // Place a plant on a free tile, then delete it with the keyboard.
  await page.locator('#tab-furniture').click();
  await page.locator('.catalog-card[data-type="plant"]').click();
  expect(await page.evaluate(() => window.__sim.selectedType)).toBe('plant');
  const point = await tilePoint(page, 'plant', 7, 3);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await selectedInfo(page)).toMatchObject({ type: 'plant', gx: 7, gz: 3 });
  await page.keyboard.press('Delete');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);

  // Real pointer drag against the collision rules.
  const from = await itemPoint(page, 'sofa', 0.65);
  const to = await tilePoint(page, 'sofa', 1, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__sim.items.find((x) => x.type === 'sofa').gx)).toBe(1);

  // Invalid saved data must leave the current design intact.
  const beforeInvalid = await roomState(page);
  await page.evaluate(() => localStorage.setItem('home-deco-sim:rooms', JSON.stringify({ version: 1, rooms: [{ id: 'bad', name: 'Broken', updatedAt: '2026-01-01T00:00:00Z', room: { items: null } }] })));
  await page.locator('#load').click();
  await page.getByRole('button', { name: 'Load Broken', exact: true }).click();
  expect(await roomState(page)).toEqual(beforeInvalid);

  await menu(page, 'clear');
  expect(await roomState(page)).toHaveLength(0);
  expect(await page.evaluate(() => window.__sim.occupancy.size)).toBe(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('saves carry stable ids and a legacy version 2 save is imported into the gallery', async ({ page }) => {
  await openGame(page);
  await page.locator('#save').click();
  const store = await galleryStore(page);
  expect(store.rooms).toHaveLength(1);
  const saved = store.rooms[0].room;
  expect(saved.version).toBe(12);
  expect(saved.items).toHaveLength(STARTER_ITEM_COUNT);
  expect(new Set(saved.items.map((i) => i.id)).size).toBe(STARTER_ITEM_COUNT);
  const liveIds = await page.evaluate(() => window.__sim.items.map((i) => i.id).sort());
  expect(saved.items.map((i) => i.id).sort()).toEqual(liveIds);

  // Ids survive a round trip, so undo and export can refer to items reliably.
  await menu(page, 'clear');
  await loadCurrentRoom(page);
  expect(await page.evaluate(() => window.__sim.items.map((i) => i.id).sort())).toEqual(liveIds);

  // A pre-gallery save (version 2, as written before 30 September 2026) is imported as "Living room" on the next start.
  await page.evaluate(() => localStorage.removeItem('home-deco-sim:rooms'));
  await page.evaluate(() => localStorage.setItem('home-deco-sim:room', JSON.stringify({
    version: 2, wall: 0x92725c, floor: 0xe3a372,
    items: [{ type: 'sofa', gx: 2, gz: 1, rot: 0 }, { type: 'rug', gx: 2, gz: 3, rot: 0 }, { type: 'armchair', gx: 6, gz: 3, rot: 3, color: 0x81936a }],   // the legacy sample room has no pillows
  })));
  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  await enterFromMenu(page);
  expect((await galleryStore(page)).rooms.map((r) => r.name)).toEqual(['Living room']);
  await page.locator('#load').click();
  await page.getByRole('button', { name: 'Load Living room', exact: true }).click();
  const migrated = await roomState(page);
  expect(migrated).toEqual([
    { type: 'sofa', gx: 2, gz: 1, rot: 0, color: null },
    { type: 'rug', gx: 2, gz: 3, rot: 0, color: null },
    { type: 'armchair', gx: 6, gz: 3, rot: 3, color: 0x81936a },
  ]);
  expect(await page.evaluate(() => window.__sim.items.every((i) => i.parent === null && i.slot === null))).toBe(true);
  expect(await page.evaluate(() => window.__sim.items.every((i) => typeof i.id === 'string' && i.id))).toBe(true);
});

test('undo and redo cover placement, drag, rotate, recolor, finishes, clear, and load', async ({ page }) => {
  await openGame(page);
  const undoBtn = page.locator('#undo-tool');
  const redoBtn = page.locator('#redo-tool');
  await expect(undoBtn).toBeDisabled();   // the starter room is not undoable
  await expect(redoBtn).toBeDisabled();

  // Place, then undo with the keyboard and redo with the button.
  await page.locator('.catalog-card[data-type="plant"]').click();
  const point = await tilePoint(page, 'plant', 7, 3);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  await expect(undoBtn).toBeEnabled();
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  expect(await selectedInfo(page)).toBeNull();   // the undone item was selected; selection clears
  await expect(redoBtn).toBeEnabled();
  await redoBtn.click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await page.evaluate(() => window.__sim.items.filter((i) => i.type === 'plant' && i.gx === 7).length)).toBe(1);
  await page.keyboard.press('Control+z');

  // A completed drag is one entry.
  const from = await itemPoint(page, 'sofa', 0.65);
  const to = await tilePoint(page, 'sofa', 1, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const sofaAt = () => page.evaluate(() => { const s = window.__sim.items.find((i) => i.type === 'sofa'); return { gx: s.gx, gz: s.gz, x: s.mesh.position.x }; });
  expect((await sofaAt()).gx).toBe(1);
  await page.keyboard.press('Control+z');
  expect(await sofaAt()).toMatchObject({ gx: 2, gz: 1 });
  expect((await sofaAt()).x).toBeCloseTo(-0.5, 5);   // the mesh followed the record back
  expect(await page.evaluate(() => window.__sim.occupancy.has('1,1'))).toBe(false);

  // Rotate and recolor a free-standing item, then undo both and check the mesh material too.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'snakePlant')));
  await page.locator('#rotate-selected').click();
  await page.getByRole('button', { name: 'Terracotta', exact: true }).click();
  expect(await selectedInfo(page)).toMatchObject({ rot: 1, color: TERRACOTTA });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await selectedInfo(page)).toMatchObject({ rot: 0, color: null });
  expect(await page.evaluate((c) => { let any = false; window.__sim.selected.mesh.traverse((o) => { if (o.userData.recolor && o.material.color.getHex() === c) any = true; }); return any; }, TERRACOTTA)).toBe(false);

  // Finishes.
  await page.locator('#tab-walls').click();
  const wallBefore = await page.evaluate(() => window.__sim.wallMat.color.getHex());
  await page.locator('#wall-swatches').getByRole('button', { name: 'Sage', exact: true }).click();
  expect(await page.evaluate(() => window.__sim.wallMat.color.getHex())).toBe(0x9ba58c);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.__sim.wallMat.color.getHex())).toBe(wallBefore);
  expect(await page.locator('#wall-swatches button[aria-pressed="true"]').getAttribute('data-color')).toBe(String(wallBefore));

  // Clear is one entry and restores occupancy.
  await menu(page, 'clear');
  expect(await roomState(page)).toHaveLength(0);
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  expect(await page.evaluate(() => window.__sim.occupancy.size)).toBeGreaterThan(0);
  await page.keyboard.press('Control+Shift+z');
  expect(await roomState(page)).toHaveLength(0);
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);

  // Load is one entry.
  await page.locator('#save').click();
  await menu(page, 'clear');
  await loadCurrentRoom(page);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(0);

  // Ctrl+R must not rotate anything.
  await page.keyboard.press('Control+z');
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'snakePlant')));
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, cancelable: true })));
  expect((await selectedInfo(page)).rot).toBe(0);
});

test('Copy duplicates the selected item nearby, selects the copy, and is undoable', async ({ page }) => {
  await openGame(page);
  const armchair = await selectedInfo(page);
  expect(armchair.type).toBe('armchair');
  await page.locator('#duplicate-selected').click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  const copy = await selectedInfo(page);
  expect(copy).toMatchObject({ type: 'armchair', rot: armchair.rot, color: armchair.color });
  expect(copy.gx === armchair.gx && copy.gz === armchair.gz).toBe(false);
  expect(Math.abs(copy.gx - armchair.gx) + Math.abs(copy.gz - armchair.gz)).toBe(1);

  // Ctrl+D copies a table together with the mug on it.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'coffeeTable')));
  await page.keyboard.press('Control+d');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 3);
  const tables = await page.evaluate(() => window.__sim.items.filter((i) => i.type === 'coffeeTable').map((t) => window.__sim.items.filter((i) => i.parent === t.id).map((i) => i.type)));
  expect(tables).toEqual([['mug'], ['mug']]);
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  await expect(page.locator('#undo-tool')).toBeDisabled();
});

test('keyboard shortcuts stay inactive while typing in search', async ({ page }) => {
  await openGame(page);
  const before = await roomState(page);
  await page.locator('#search').click();
  await page.keyboard.type('r');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  expect(await roomState(page)).toEqual(before);
});

test('background music waits for a gesture and remembers the mute choice', async ({ page }) => {
  await openGame(page, undefined, { enter: false });
  const music = () => page.evaluate(() => ({
    on: window.__sim.musicOn,
    paused: window.__sim.bgm.paused,
    pressed: document.getElementById('music-toggle').getAttribute('aria-pressed'),
    pref: localStorage.getItem('home-deco-sim:music'),
  }));
  expect(await music()).toMatchObject({ on: true, paused: true, pressed: 'true', pref: null });
  expect(await page.evaluate(() => window.__sim.bgm.currentSrc.endsWith('/audio/lofidreams-bgm.mp3'))).toBe(true);

  await enterFromMenu(page);
  await menu(page, 'music-toggle');
  expect(await music()).toMatchObject({ on: false, paused: true, pressed: 'false', pref: 'off' });
  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  expect(await music()).toMatchObject({ on: false, pressed: 'false', pref: 'off' });
  await enterFromMenu(page);
  await menu(page, 'music-toggle');
  expect(await music()).toMatchObject({ on: true, pressed: 'true', pref: 'on' });
});
