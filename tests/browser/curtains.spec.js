import { test, expect } from '@playwright/test';
import { openGame, roomState, twoFrames, loadCurrentRoom, galleryStore, STARTER_ITEM_COUNT } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

const curtain = (page) => page.evaluate(() => {
  const s = window.__sim; const c = s.items.find((i) => i.type === 'curtain');
  if (!c) return null;
  const panels = []; c.mesh.traverse((o) => { if (o.userData.panel) panels.push(+o.scale.x.toFixed(3)); });
  return { lit: c.lit, wall: c.wall, col: c.col, row: c.row, panels, sun: s.sun.intensity };
});
const settle = async (page) => { await page.waitForFunction(() => !window.__sim.tweening); await twoFrames(page); };

test('curtains hang only over windows, open and close with a tween, dim the sun, and save closed', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  const sunBefore = await page.evaluate(() => window.__sim.sun.intensity);

  // Only window cells accept the curtain: the starter back window spans columns 0 to 4, rows 2 to 6.
  const can = (wall, col, row) => page.evaluate(([w, c, r]) => window.__sim.state.canMount('curtain', w, c, r), [wall, col, row]);
  expect(await can('back', 1, 2)).toBe(true);
  expect(await can('back', 5, 2)).toBe(false);   // column 6 is wall, not window
  expect(await can('back', 1, 1)).toBe(false);   // below the sill
  expect(await can('back', 5, 6)).toBe(false);   // clear wall, no window
  expect(await page.evaluate(() => window.__sim.state.canMount('clock', 'back', 1, 3))).toBe(false);   // ordinary decorations still avoid windows

  await page.evaluate(() => window.__sim.addItem('curtain', null, null, 0, null, null, null, null, 'back', 1, 2));
  await twoFrames(page);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  let c = await curtain(page);
  expect(c).toMatchObject({ lit: true, wall: 'back', col: 1, row: 2 });
  expect(c.panels.every((x) => x < 0.4)).toBe(true);   // open: bunched at the edges
  expect(c.sun).toBeCloseTo(sunBefore, 5);

  // The selection card shows the toggle with curtain wording; closing animates and dims the sun.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'curtain')));
  const toggle = page.locator('#light-selected');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('Open');
  await toggle.click();
  await expect(toggle).toContainText('Closed');
  expect(await page.evaluate(() => window.__sim.tweening)).toBe(true);
  await settle(page);
  c = await curtain(page);
  expect(c.lit).toBe(false);
  expect(c.panels.every((x) => x > 0.99)).toBe(true);   // closed: panels meet
  expect(c.sun).toBeCloseTo(sunBefore * 0.88, 5);

  // Undo reopens them and restores the sun; redo closes again.
  await page.keyboard.press('Control+z');
  await settle(page);
  expect((await curtain(page)).lit).toBe(true);
  expect((await curtain(page)).sun).toBeCloseTo(sunBefore, 5);
  await page.keyboard.press('Control+Shift+z');
  await settle(page);

  // Saved closed, loads closed without a tween, and the sun is dim straight away.
  await page.locator('#save').click();
  expect(galleryStore(page) && (await galleryStore(page)).rooms[0].room.items.find((i) => i.type === 'curtain').lit).toBe(false);
  await page.locator('#clear').click();
  expect(await page.evaluate(() => window.__sim.sun.intensity)).toBeCloseTo(sunBefore, 5);
  await loadCurrentRoom(page);
  await twoFrames(page);
  c = await curtain(page);
  expect(c.lit).toBe(false);
  expect(c.panels.every((x) => x > 0.99)).toBe(true);
  expect(c.sun).toBeCloseTo(sunBefore * 0.88, 5);
  expect(await page.evaluate(() => window.__sim.tweening)).toBe(false);
  expect(errors).toEqual([]);
});
