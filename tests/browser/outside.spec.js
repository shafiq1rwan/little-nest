import { test, expect } from '@playwright/test';
import { openGame, roomState, STARTER_ITEM_COUNT } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

// Bounding boxes of every outside mesh in world space, and whether any intrudes into the room above the floor.
const intrusions = (page) => page.evaluate(() => {
  const s = window.__sim; const o = s.outside;
  const halfW = s.roomConfig.width / 2, halfD = s.roomConfig.depth / 2;
  const out = [];
  o.group.updateMatrixWorld(true);
  o.trees.forEach((t, i) => t.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if (b.max.x > -halfW - 0.2 && b.max.z > -halfD - 0.2 && b.min.y < 4) out.push('tree ' + i + ' ' + m.name);
  }));
  return out;
});

test('the room sits on a garden island; trees stay behind the walls; particles follow the mood; the balcony gets a ledge', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  const counts = await page.evaluate(() => window.__sim.outside.counts());
  expect(counts.trees).toBe(3);
  expect(counts.meshes).toBeLessThan(30);   // merged per colour
  expect(await intrusions(page)).toEqual([]);

  // Nothing outside is pickable: clicking the lawn in front of the room selects nothing.
  const lawn = await page.evaluate(() => {
    const s = window.__sim; const v = s.scene.position.clone().set(2, -0.15, s.roomConfig.depth / 2 + 0.7).project(s.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (v.x + 1) * r.width / 2, y: r.y + (1 - v.y) * r.height / 2 };
  });
  await page.mouse.click(lawn.x, lawn.y);
  expect(await page.evaluate(() => window.__sim.selected)).toBeNull();
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);

  // Leaves by day, fireflies at night; both stop when ambient motion is off.
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__sim.outside.particles)).toEqual({ leaves: true, fireflies: false });
  await page.locator('#tab-light').click();
  await page.getByRole('button', { name: /Evening/ }).click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__sim.outside.particles)).toEqual({ leaves: false, fireflies: true });
  await page.evaluate(() => window.__sim.ambient.setOn(false));
  expect(await page.evaluate(() => window.__sim.outside.particles)).toEqual({ leaves: false, fireflies: false });
  await page.evaluate(() => window.__sim.ambient.setOn(true));

  // Presets rebuild the surroundings: the balcony has a stone ledge and no trees, in any size.
  await page.evaluate(() => window.__sim.startPreset('balcony'));
  expect(await page.evaluate(() => window.__sim.outside.counts())).toMatchObject({ trees: 0, leaves: 0 });
  await page.evaluate(() => window.__sim.startPreset('readingNook'));
  expect(await page.evaluate(() => window.__sim.outside.counts().trees)).toBe(3);
  expect(await intrusions(page)).toEqual([]);
  expect(errors).toEqual([]);
});
