import { test, expect } from '@playwright/test';
import { openGame, tilePoint, selectedInfo, noHorizontalOverflow, twoFrames } from './helpers.js';

// Baseline viewports from docs/HANDOFF.md. Compact HUD applies at width <= 900 or height <= 600.
const VIEWPORTS = [
  [390, 844],
  [320, 568],
  [768, 1024],
  [844, 390],
  [568, 320],
  [1440, 900],
];
const IMPORTANT_CONTROLS = ['save', 'load', 'help-toggle', 'music-toggle', 'grid-tool', 'walls-tool', 'zoom-in'];

for (const [width, height] of VIEWPORTS) {
  const compact = width <= 900 || height <= 600;
  const landscape = width > height;

  test.describe(width + 'x' + height, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: width < 700 });

    test('controls stay reachable and ' + (compact ? 'the drawer docks selection outside the room' : 'the desktop card floats in the viewport'), async ({ page }) => {
      const errors = await openGame(page);
      expect(await noHorizontalOverflow(page)).toBe(true);

      for (const id of IMPORTANT_CONTROLS) {
        const b = await page.locator('#' + id).boundingBox();
        expect(b, id + ' is rendered').not.toBeNull();
        expect(b.x >= 0 && b.x + b.width <= width + 0.5 && b.y >= 0 && b.y + b.height <= height + 0.5, id + ' on screen').toBe(true);
        if (compact) expect(b.width >= 44 && b.height >= 44, id + ' touch target').toBe(true);
      }

      if (!compact) {
        expect(await page.locator('#panel-toggle').isVisible()).toBe(false);
        expect(await page.locator('#selection-card').evaluate((el) => el.parentElement.id)).toBe('viewport');
        expect(errors).toEqual([]);
        return;
      }

      const panel = page.locator('#panel');
      const collapsed = () => panel.evaluate((el) => el.classList.contains('collapsed'));
      expect(await page.locator('#selection-card').isVisible()).toBe(false);
      if (await collapsed()) await page.locator('#panel-toggle').tap();
      expect(await page.locator('#tab-furniture').isVisible()).toBe(true);
      if (!landscape) expect(await page.locator('#catalog').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

      // Hiding the drawer gives the room more space.
      const before = await page.locator('#scene').boundingBox();
      await page.locator('#panel-toggle').tap();
      const after = await page.locator('#scene').boundingBox();
      expect(landscape ? after.width > before.width : after.height > before.height).toBe(true);
      await page.locator('#panel-toggle').tap();

      // Choosing furniture collapses the drawer; tapping a tile places it and docks the controls.
      await page.locator('.catalog-card[data-type="armchair"]').tap();
      expect(await collapsed()).toBe(true);
      expect(await page.evaluate(() => window.__sim.selectedType)).toBe('armchair');
      // Collapsing the drawer resizes the canvas; let the render loop update the projection before projecting a tile.
      await twoFrames(page);
      const point = await tilePoint(page, 'armchair', 7, 3);
      await page.touchscreen.tap(point.x, point.y);
      expect((await selectedInfo(page)).type).toBe('armchair');
      expect(await page.locator('#selection-card').evaluate((el) => el.parentElement.id)).toBe('panel-content');
      const scene = await page.locator('#scene').boundingBox();
      const card = await page.locator('#selection-card').boundingBox();
      expect(landscape ? card.x >= scene.x + scene.width - 0.5 : card.y >= scene.y + scene.height - 0.5, 'selection card does not overlap the room').toBe(true);

      await page.locator('#rotate-selected').tap();
      expect((await selectedInfo(page)).rot).toBe(1);
      await page.getByRole('button', { name: 'Sage', exact: true }).tap();
      await page.locator('#move-selected').tap();
      expect(await collapsed()).toBe(true);
      await page.locator('#panel-toggle').tap();
      await page.locator('#deselect').tap();
      expect(await page.locator('#tab-furniture').isVisible()).toBe(true);

      await page.locator('#tab-walls').tap();
      await page.getByRole('button', { name: 'Clay', exact: true }).tap();
      await page.locator('#tab-furniture').tap();
      await page.locator('#search').fill('plant');
      expect(await page.locator('.catalog-card:visible').count()).toBe(5);
      await page.locator('#save').tap();
      expect(errors).toEqual([]);
    });
  });
}
