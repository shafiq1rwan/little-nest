import { test, expect } from '@playwright/test';
import { openGame, tilePoint, selectedInfo } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test('every catalog entry belongs to a known collection and the selector combines with categories and search', async ({ page }) => {
  const errors = await openGame(page);
  const visible = () => page.locator('.catalog-card:visible').count();
  const report = await page.evaluate(() => {
    const s = window.__sim;
    const known = Object.keys(s.collections);
    return s.catalogTypes.map((t) => ({ type: t, collection: s.catalogCollection(t), known: known.includes(s.catalogCollection(t)) }));
  });
  expect(report.every((r) => r.known), 'unknown collection on ' + report.filter((r) => !r.known).map((r) => r.type).join(', ')).toBe(true);
  const byCollection = {};
  for (const r of report) byCollection[r.collection] = (byCollection[r.collection] || 0) + 1;
  expect(byCollection.japandi).toBe(4);
  expect(byCollection.cottage).toBe(4);
  expect(byCollection.modern).toBe(118);   // Kenney's Furniture Kit, without its walls, floors, doorways, stairs and ceiling pieces
  expect(byCollection.cozy).toBe(report.length - 8 - 118);

  const select = page.locator('#collection');
  await expect(select.locator('option')).toHaveCount(5);
  const all = await visible();
  await select.selectOption('japandi');
  expect(await visible()).toBe(4);
  await expect(page.locator('.catalog-card[data-type="lowSofa"] small')).toContainText('Japandi');
  await page.locator('[data-category="seating"]').click();
  expect(await visible()).toBe(1);
  await page.locator('#search').fill('lamp');
  expect(await visible()).toBe(0);
  await expect(page.locator('#empty-catalog')).toBeVisible();
  await page.locator('[data-category="all"]').click();
  expect(await visible()).toBe(1);   // the paper lamp
  await page.locator('#search').fill('');
  await select.selectOption('cottage');
  expect(await visible()).toBe(4);
  await select.selectOption('all');
  expect(await visible()).toBe(all);

  // Collection pieces place and sit like any other: a teapot goes on the low table.
  await page.locator('.catalog-card[data-type="lowTable"]').click();
  const spot = await tilePoint(page, 'lowTable', 6, 2);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  expect((await selectedInfo(page))?.type).toBe('lowTable');
  const table = await page.evaluate(() => window.__sim.selected.id);
  expect(await page.evaluate((id) => !!window.__sim.commands.add({ type: 'teapot', parent: id, slot: 0, rot: 0 }), table)).toBe(true);
  expect(errors).toEqual([]);
});
