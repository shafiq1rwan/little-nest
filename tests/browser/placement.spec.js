import { test, expect } from '@playwright/test';
import { openGame, roomState, tilePoint, twoFrames, STARTER_ITEM_COUNT } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('the mode pill offers Keep placing and Cancel while holding an item', async ({ page }) => {
      const errors = await openGame(page);
      const keep = page.locator('#keep-placing'), cancel = page.locator('#cancel-placing');
      await expect(keep).toBeHidden();
      await expect(cancel).toBeHidden();

      await page.evaluate(() => window.__sim.startPlacing('pouf'));
      await expect(keep).toBeVisible();
      await expect(cancel).toBeVisible();
      for (const b of [await keep.boundingBox(), await cancel.boundingBox()]) {
        expect(b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height, 'on screen').toBe(true);
        if (width <= 900) expect(b.width >= 44 && b.height >= 44, 'touch target').toBe(true);
      }
      await twoFrames(page);

      // Keep placing: two drops stay in placing mode; the ghost survives.
      await keep.click();
      await expect(keep).toHaveAttribute('aria-pressed', 'true');
      const free = await page.evaluate(() => { const s = window.__sim, out = []; for (let gz = 7; gz >= 0 && out.length < 2; gz--) for (let gx = 7; gx >= 0 && out.length < 2; gx--) if (s.isFree('pouf', gx, gz, 0)) out.push([gx, gz]); return out; });
      for (const [gx, gz] of free) {
        const p = await tilePoint(page, 'pouf', gx, gz);
        await page.mouse.click(p.x, p.y);
      }
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 2);
      expect(await page.evaluate(() => !!window.__sim.ghost && window.__sim.selectedType === 'pouf')).toBe(true);

      // Cancel ends placing and restores the label; the switch is remembered for the next item.
      await cancel.click();
      await expect(page.locator('#mode-label')).toHaveText('Decorate mode');
      expect(await page.evaluate(() => window.__sim.ghost)).toBeNull();
      await expect(keep).toBeHidden();
      expect(await page.evaluate(() => window.__sim.keepPlacing)).toBe(true);
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 2);
      expect(errors).toEqual([]);
    });

    test('the orbit buttons turn the room within the camera limits', async ({ page }) => {
      test.skip(width < 640, 'narrow phones orbit with two fingers');
      const errors = await openGame(page);
      const azimuth = () => page.evaluate(() => window.__sim.controls.getAzimuthalAngle());
      const limits = await page.evaluate(() => ({ min: window.__sim.controls.minAzimuthAngle, max: window.__sim.controls.maxAzimuthAngle }));
      const start = await azimuth();
      await page.locator('#orbit-left').click();
      expect(await azimuth()).toBeGreaterThan(start);
      for (let i = 0; i < 12; i++) await page.locator('#orbit-left').click();
      expect(await azimuth()).toBeLessThanOrEqual(limits.max + 1e-6);
      for (let i = 0; i < 20; i++) await page.locator('#orbit-right').click();
      expect(await azimuth()).toBeGreaterThanOrEqual(limits.min - 1e-6);
      await page.locator('#reset-view').click();
      expect(Math.abs((await azimuth()) - start)).toBeLessThan(1e-6);
      expect(errors).toEqual([]);
    });
  });
}
