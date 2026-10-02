import { test, expect } from '@playwright/test';
import { openGame, itemPoint, tilePoint, twoFrames } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

test('mouse hover outlines an item, floor ghosts cast a shadow, and a placed item settles back to its own scale', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  const sim = (fn) => page.evaluate(fn);

  // Hover: the sofa under the mouse gets the soft outline; leaving the canvas clears it.
  const chair = await itemPoint(page, 'sofa', 0.65);
  await page.mouse.move(chair.x, chair.y);
  await twoFrames(page);
  expect(await sim(() => window.__sim.items.find((i) => i.id === window.__sim.hoverId)?.type)).toBe('sofa');
  expect(await sim(() => window.__sim.hoverVisible)).toBe(true);
  // The selected item shows its own outline, not the hover one.
  await page.mouse.click(chair.x, chair.y);
  await twoFrames(page);
  expect(await sim(() => window.__sim.hoverVisible)).toBe(false);
  await page.locator('#deselect').click();
  await page.mouse.move(5, 450);   // over the HUD edge, off the room
  await page.locator('#scene').dispatchEvent('pointerleave');
  await twoFrames(page);
  expect(await sim(() => window.__sim.hoverVisible)).toBe(false);

  // Ghost shadow follows a floor ghost and disappears with it; tabletop ghosts have none.
  await sim(() => window.__sim.startPlacing('pouf'));
  const free = await sim(() => { const s = window.__sim; for (let gz = 7; gz >= 0; gz--) for (let gx = 7; gx >= 0; gx--) if (s.isFree('pouf', gx, gz, 0)) return [gx, gz]; return null; });
  const spot = await tilePoint(page, 'pouf', free[0], free[1]);
  await page.mouse.move(spot.x, spot.y);
  expect(await sim(() => window.__sim.ghostShadowVisible)).toBe(true);
  const baseScale = await sim(() => window.__sim.ghost.scale.toArray());

  // Placing bounces the new item, then restores its exact scale; no hover while placing.
  await page.mouse.click(spot.x, spot.y);
  expect(await sim(() => window.__sim.ghostShadowVisible)).toBe(false);
  expect(await sim(() => window.__sim.bouncing)).toBe(true);
  await page.waitForFunction(() => !window.__sim.bouncing);
  const pouf = await sim(() => window.__sim.items.filter((i) => i.type === 'pouf').pop().mesh.scale.toArray());
  expect(pouf).toEqual(baseScale);
  await sim(() => window.__sim.startPlacing('mug'));
  await page.mouse.move(spot.x, spot.y - 40);
  expect(await sim(() => window.__sim.ghostShadowVisible)).toBe(false);
  expect(errors).toEqual([]);
});

test('reduced motion skips the settle bounce', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  await page.evaluate(() => window.__sim.startPlacing('pouf'));
  const free = await page.evaluate(() => { const s = window.__sim; for (let gz = 7; gz >= 0; gz--) for (let gx = 7; gx >= 0; gx--) if (s.isFree('pouf', gx, gz, 0)) return [gx, gz]; return null; });
  const spot = await tilePoint(page, 'pouf', free[0], free[1]);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  expect(await page.evaluate(() => window.__sim.bouncing)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});
