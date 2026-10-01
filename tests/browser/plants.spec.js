import { test, expect } from '@playwright/test';
import { openGame, tilePoint, selectedInfo, loadCurrentRoom, TERRACOTTA } from './helpers.js';

const PLANTS = ['snakePlant', 'palm', 'cactus', 'rubberTree'];

test.use({ viewport: { width: 1440, height: 1000 } });

test('plant species fit one tile, render thumbnails, and survive place/rotate/recolor/save/load', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  await page.locator('#search').fill('plant');
  expect(await page.locator('.catalog-card:visible').count()).toBe(11);   // seven plants, the succulent, the hanging plant, the planter, and the botanical print
  expect(await page.locator('.catalog-card:visible img').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0))).toBe(true);

  const bounds = await page.evaluate((types) => window.__sim.items.filter((i) => types.includes(i.type)).map((i) => ({ type: i.type, ...window.__sim.measure(i.mesh) })), PLANTS);
  expect(bounds).toHaveLength(PLANTS.length);
  for (const b of bounds) {
    expect(b.w, b.type + ' width').toBeLessThanOrEqual(1.05);
    expect(b.d, b.type + ' depth').toBeLessThanOrEqual(1.05);
    expect(b.h, b.type + ' height').toBeGreaterThan(0.6);
  }

  for (const type of PLANTS) {
    await page.locator('.catalog-card[data-type="' + type + '"]').click();
    const point = await tilePoint(page, 'plant', 7, 3);
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);
    expect((await selectedInfo(page)).type).toBe(type);
    await page.locator('#rotate-selected').click();
    expect((await selectedInfo(page)).rot).toBe(1);
    await page.getByRole('button', { name: 'Terracotta', exact: true }).click();
    expect((await selectedInfo(page)).color).toBe(TERRACOTTA);
    // Only parts flagged for recoloring change; soil, stems and leaves keep their colors.
    expect(await page.evaluate((c) => {
      let valid = true;
      window.__sim.selected.mesh.traverse((o) => { if (o.userData.recolor && o.material.color.getHex() !== c) valid = false; });
      return valid;
    }, TERRACOTTA)).toBe(true);

    await page.locator('#save').click();
    await page.locator('#remove-selected').click();
    await loadCurrentRoom(page);
    const restored = await page.evaluate((type) => {
      const i = window.__sim.items.find((x) => x.type === type && x.gx === 7 && x.gz === 3);
      return i && { color: i.color, rot: i.rot };
    }, type);
    expect(restored).toEqual({ color: TERRACOTTA, rot: 1 });
    await page.evaluate((type) => window.__sim.setSelected(window.__sim.items.find((x) => x.type === type && x.gx === 7 && x.gz === 3)), type);
    await page.locator('#remove-selected').click();
  }
  expect(errors).toEqual([]);
});
