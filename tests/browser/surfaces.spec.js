import { test, expect } from '@playwright/test';
import { openGame, roomState, tilePoint, itemPoint, selectedInfo, loadCurrentRoom, twoFrames, STARTER_ITEM_COUNT, menu } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

/** Screen point of a slot on a supporter. */
function slotPoint(page, type, slot) {
  return page.evaluate(([type, slot]) => {
    const parent = window.__sim.items.find((i) => i.type === type && !i.parent);
    const p = window.__sim.slotWorld(parent.id, slot).project(window.__sim.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  }, [type, slot]);
}
const childOf = (page, parentType) => page.evaluate((t) => {
  const parent = window.__sim.items.find((i) => i.type === t && !i.parent);
  return window.__sim.items.filter((i) => i.parent === parent.id).map((i) => ({ type: i.type, slot: i.slot, worldX: i.mesh.getWorldPosition(new i.mesh.position.constructor()).x }));
}, parentType);

test('small items sit in slots, follow their supporter, cascade on removal, and survive save/load', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  expect(await childOf(page, 'coffeeTable')).toEqual([expect.objectContaining({ type: 'mug', slot: 0 })]);

  // Place a vase on the free coffee-table slot; the floor refuses it.
  await page.locator('[data-category="small"]').click();
  expect(await page.locator('.catalog-card:visible').count()).toBe(26);   // nine classics and 17 Modern home small items
  await page.locator('.catalog-card[data-type="vase"]').click();
  await expect(page.locator('#mode-label')).toContainText('on a table or shelf');
  const floorPoint = await tilePoint(page, 'plant', 7, 2);   // an empty tile with no furniture in front of it
  await page.mouse.move(floorPoint.x, floorPoint.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(false);
  await page.mouse.click(floorPoint.x, floorPoint.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
  await expect(page.locator('#toast')).toContainText('tables and shelves');

  const slot1 = await slotPoint(page, 'coffeeTable', 1);
  await page.mouse.move(slot1.x, slot1.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(true);
  await page.mouse.click(slot1.x, slot1.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await selectedInfo(page)).toMatchObject({ type: 'vase' });
  expect(await page.locator('#selection-size').textContent()).toBe('Sits on tables and shelves');
  const table = await childOf(page, 'coffeeTable');
  expect(table.map((c) => c.type + '@' + c.slot).sort()).toEqual(['mug@0', 'vase@1']);

  // The occupied slot is refused with a toast.
  await page.locator('.catalog-card[data-type="candle"]').click();
  await page.mouse.move(slot1.x, slot1.y);
  await page.mouse.click(slot1.x, slot1.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  await expect(page.locator('#toast')).toContainText('taken');
  await page.keyboard.press('Escape');

  // Move the table: the mug and vase move with it (world x changes together).
  const before = await childOf(page, 'coffeeTable');
  const from = await itemPoint(page, 'coffeeTable', 0.6);   // through the table top; the loaded model has no dressing at its centre
  const to = await tilePoint(page, 'coffeeTable', 0, 6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__sim.items.find((i) => i.type === 'coffeeTable').gx)).toBe(0);
  const after = await childOf(page, 'coffeeTable');
  expect(after).toHaveLength(2);
  expect(Math.abs(after[0].worldX - before[0].worldX)).toBeGreaterThan(1);
  await page.keyboard.press('Control+z');
  expect((await childOf(page, 'coffeeTable'))[0].worldX).toBeCloseTo(before[0].worldX, 3);

  // Rotate the table: children rotate with it and stay attached.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'coffeeTable')));
  await page.locator('#rotate-selected').click();
  await twoFrames(page);
  expect(await childOf(page, 'coffeeTable')).toHaveLength(2);
  await page.keyboard.press('Control+z');

  // Drag the vase to the desk's free slot.
  await twoFrames(page);
  const vasePoint = await slotPoint(page, 'coffeeTable', 1);
  const deskSlot = await slotPoint(page, 'desk', 1);
  await page.mouse.move(vasePoint.x, vasePoint.y - 8);
  await page.mouse.down();
  await page.mouse.move(deskSlot.x, deskSlot.y, { steps: 10 });
  await page.mouse.up();
  const onDesk = await childOf(page, 'desk');
  expect(onDesk.map((c) => c.type + '@' + c.slot).sort()).toEqual(['frame@0', 'vase@1']);
  await page.keyboard.press('Control+z');
  expect((await childOf(page, 'desk')).map((c) => c.type)).toEqual(['frame']);
  await page.keyboard.press('Control+Shift+z');

  // Removing the desk removes the frame and vase too; undo brings all three back.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'desk')));
  await page.locator('#remove-selected').click();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1 - 3);
  await page.keyboard.press('Control+z');
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect((await childOf(page, 'desk')).map((c) => c.type).sort()).toEqual(['frame', 'vase']);

  // Save and load keep the relationships; the store is version 4.
  await page.locator('#save').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("home-deco-sim:rooms")).rooms[0].room.version)).toBeGreaterThanOrEqual(4);
  await menu(page, 'clear');
  await loadCurrentRoom(page);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect((await childOf(page, 'desk')).map((c) => c.type).sort()).toEqual(['frame', 'vase']);
  expect((await childOf(page, 'coffeeTable')).map((c) => c.type)).toEqual(['mug']);
  expect(errors).toEqual([]);
});
