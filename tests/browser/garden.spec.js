import { test, expect } from '@playwright/test';
import { openGame, twoFrames } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

/** Visible trees whose crown is drawn over the room's floor, in screen space. */
const treesOverFloor = (page) => page.evaluate(() => {
  const s = window.__sim, V = s.camera.position.constructor, w = s.roomConfig.width / 2, d = s.roomConfig.depth / 2;
  const screen = (x, y, z) => { const p = new V(x, y, z).project(s.camera); return { x: p.x, y: p.y }; };
  const floor = [screen(-w, 0, -d), screen(w, 0, -d), screen(w, 0, d), screen(-w, 0, d)];
  const inside = (p) => {   // point in convex quad
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = floor[i], b = floor[(i + 1) % 4], c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
    }
    return true;
  };
  return s.garden.trees.filter((t) => t.visible).filter((t) => {
    const g = t.userData.garden;
    return inside(screen(g.x, g.height * 0.6, g.z));
  }).length;
});

test('the house stands in a garden whose trees step aside wherever the camera turns; the balcony has none', async ({ page }) => {
  const errors = await openGame(page, '/');
  await twoFrames(page);
  const garden = await page.evaluate(() => ({ trees: window.__sim.garden.trees.length, island: !!window.__sim.garden.root.getObjectByName('island') }));
  expect(garden.island).toBe(true);
  expect(garden.trees).toBeGreaterThan(6);
  expect(await treesOverFloor(page)).toBe(0);
  for (let turn = 0; turn < 4; turn++) {
    await page.evaluate(() => window.__sim.orbitBy(Math.PI / 2));
    await twoFrames(page);
    expect(await treesOverFloor(page), 'quarter turn ' + (turn + 1)).toBe(0);
    expect(await page.evaluate(() => window.__sim.garden.trees.some((t) => t.visible))).toBe(true);
  }
  await page.evaluate(() => window.__sim.startPreset('house'));
  await twoFrames(page);
  expect(await treesOverFloor(page)).toBe(0);
  // Without stepping aside, some of the house's trees would cover its floor (the check above means something).
  await page.evaluate(() => window.__sim.garden.trees.forEach((t) => { t.visible = true; }));
  expect(await treesOverFloor(page)).toBeGreaterThan(0);
  await page.evaluate(() => window.__sim.startPreset('balcony'));
  expect(await page.evaluate(() => window.__sim.garden)).toBeNull();
  expect(errors).toEqual([]);
});
