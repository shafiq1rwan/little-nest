import { test, expect } from '@playwright/test';
import { openGame, roomState, selectedInfo, loadCurrentRoom, twoFrames, STARTER_ITEM_COUNT } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

/** Screen point of a world position. */
function screenOf(page, x, y, z) {
  return page.evaluate(([x, y, z]) => {
    const s = window.__sim;
    const p = new s.camera.position.constructor(x, y, z).project(s.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  }, [x, y, z]);
}
const wallItems = (page) => page.evaluate(() => window.__sim.items.filter((i) => i.wall).map((i) => ({ type: i.type, wall: i.wall, col: i.col, row: i.row, pos: i.mesh.position.toArray().map((v) => +v.toFixed(2)) })));

test('wall decorations snap to walls, avoid windows, drag between walls, refuse rotation, and save', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  expect((await wallItems(page)).map((w) => w.type).sort()).toEqual(['botanicalPrint', 'worldMap']);   // the old baked prints are items now

  // Choose the clock; the floor refuses it, the window refuses it, a clear wall spot takes it.
  await page.locator('[data-category="wall"]').click();
  expect(await page.locator('.catalog-card:visible').count()).toBe(6);
  await page.locator('.catalog-card[data-type="clock"]').click();
  await expect(page.locator('#mode-label')).toContainText('on a wall');
  const floorPoint = await screenOf(page, 3, 0, 3);
  await page.mouse.move(floorPoint.x, floorPoint.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(false);
  await page.mouse.click(floorPoint.x, floorPoint.y);
  await expect(page.locator('#toast')).toContainText('two walls');

  const windowPoint = await screenOf(page, -2, 2.2, -4);   // middle of the back window
  await page.mouse.move(windowPoint.x, windowPoint.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(true);
  await page.mouse.click(windowPoint.x, windowPoint.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  await expect(page.locator('#toast')).toContainText('taken');

  const clear = await screenOf(page, 1.5, 3.25, -4);   // back wall, col 5, row 6: above the map, beside the lights
  await page.mouse.move(clear.x, clear.y);
  await page.mouse.click(clear.x, clear.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await selectedInfo(page)).toMatchObject({ type: 'clock' });
  expect(await page.locator('#selection-size').textContent()).toBe('On the wall');
  const clock = (await wallItems(page)).find((w) => w.type === 'clock');
  expect(clock).toMatchObject({ wall: 'back', col: 5, row: 6 });
  expect(clock.pos).toEqual([1.5, 3, -4]);

  // Rotation is refused for wall items.
  await page.locator('#rotate-selected').click();
  await expect(page.locator('#toast')).toContainText('face the room');

  // Drag the clock to the left wall, then undo.
  await twoFrames(page);
  const from = await screenOf(page, 1.5, 3.25, -3.95);
  const to = await screenOf(page, -4, 3.25, 3.5);   // left wall, col 7, row 6
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  expect((await wallItems(page)).find((w) => w.type === 'clock')).toMatchObject({ wall: 'left', col: 7, row: 6 });
  await page.keyboard.press('Control+z');
  expect((await wallItems(page)).find((w) => w.type === 'clock')).toMatchObject({ wall: 'back', col: 5, row: 6 });

  // A spot hidden behind furniture cannot be used: the bookshelf stands in front of the back wall there.
  await page.locator('.catalog-card[data-type="clock"]').click();
  const hidden = await screenOf(page, 3.5, 0.75, -4);
  await page.mouse.move(hidden.x, hidden.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(false);
  await page.keyboard.press('Escape');

  // A wall shelf holds a small item that follows it.
  await page.locator('.catalog-card[data-type="wallShelf"]').click();
  const shelfSpot = await screenOf(page, -3, 3.75, -4);   // back wall, cols 0-1, row 7: above the window
  await page.mouse.move(shelfSpot.x, shelfSpot.y);
  await page.mouse.click(shelfSpot.x, shelfSpot.y);
  const shelf = await page.evaluate(() => { const s = window.__sim.items.find((i) => i.type === 'wallShelf'); return s && { id: s.id, col: s.col, row: s.row }; });
  expect(shelf).toMatchObject({ col: 0, row: 7 });
  await page.evaluate((id) => window.__sim.commands.add({ type: 'mug', parent: id, slot: 0, rot: 0 }), shelf.id);
  const shelfMug = (id) => page.evaluate((id) => { const m = window.__sim.items.find((i) => i.type === 'mug' && i.parent === id); return m.mesh.getWorldPosition(new m.mesh.position.constructor()).toArray(); }, id);
  const mugBefore = await shelfMug(shelf.id);
  await page.evaluate((id) => window.__sim.commands.mount(id, 'back', 2, 7), shelf.id);
  const mugAfter = await shelfMug(shelf.id);
  expect(mugAfter[0] - mugBefore[0]).toBeCloseTo(2, 3);   // two columns along the wall
  expect(mugAfter[2]).toBeGreaterThan(-4);                 // sits in front of the wall face

  // Save and load keep wall items; the store is version 5.
  await page.locator('#save').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("home-deco-sim:rooms")).rooms[0].room.version)).toBeGreaterThanOrEqual(5);
  await page.locator('#clear').click();
  await loadCurrentRoom(page);
  expect((await wallItems(page)).map((w) => w.type).sort()).toEqual(['botanicalPrint', 'clock', 'wallShelf', 'worldMap']);
  expect(await page.evaluate(() => window.__sim.items.filter((i) => i.parent).map((i) => i.type).sort())).toEqual(['frame', 'mug', 'mug']);
  expect(errors).toEqual([]);
});
