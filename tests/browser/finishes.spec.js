import { test, expect } from '@playwright/test';
import { openGame, loadCurrentRoom, galleryStore, menu } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('walls can be painted together or one at a time, the floor pattern changes, and both save', async ({ page }) => {
      const errors = await openGame(page);
      const colors = () => page.evaluate(() => ({ back: window.__sim.wallMat.color.getHex(), left: window.__sim.wallLeftMat.color.getHex(), map: window.__sim.floorMat.map.uuid }));
      const tap = (locator) => (width < 700 ? locator.tap() : locator.click());
      if (width < 700 && (await page.locator('#panel-toggle').getAttribute('aria-expanded')) === 'false') await page.locator('#panel-toggle').tap();
      if (width >= 700 && await page.locator('#deselect').isVisible()) await page.locator('#deselect').click();   // the selection card has its own Sage swatch
      await tap(page.locator('#tab-walls'));

      // Both walls is the default target.
      await expect(page.locator('#wall-target [data-target="both"]')).toHaveAttribute('aria-pressed', 'true');
      await tap(page.locator('#wall-swatches').getByRole('button', { name: 'Sage', exact: true }));
      expect(await colors()).toMatchObject({ back: 0x9ba58c, left: 0x9ba58c });

      // An accent on the left wall only; the swatch row now reflects the left wall.
      await tap(page.locator('#wall-target [data-target="left"]'));
      await tap(page.locator('#wall-swatches').getByRole('button', { name: 'Clay', exact: true }));
      expect(await colors()).toMatchObject({ back: 0x9ba58c, left: 0xb77d66 });
      await expect(page.locator('#wall-swatches').getByRole('button', { name: 'Clay', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await tap(page.locator('#wall-target [data-target="both"]'));
      expect(await page.locator('#wall-swatches .swatch[aria-pressed="true"]').count()).toBe(0);   // walls differ: no single swatch is "both"
      for (const b of await page.locator('#wall-target button').all()) {
        const box = await b.boundingBox();
        if (width <= 900) expect(box.height >= 44, 'touch target').toBe(true);
      }

      // Floor pattern.
      await tap(page.locator('#tab-floor'));
      const parquet = (await colors()).map;
      await expect(page.locator('#floor-styles [data-style="parquet"]')).toHaveAttribute('aria-pressed', 'true');
      await tap(page.locator('#floor-styles [data-style="tile"]'));
      expect((await colors()).map).not.toBe(parquet);
      await expect(page.locator('#floor-styles [data-style="tile"]')).toHaveAttribute('aria-pressed', 'true');

      // Undo the pattern, redo it, then save and reload.
      await tap(page.locator('#undo-tool'));
      expect((await colors()).map).toBe(parquet);
      await tap(page.locator('#redo-tool'));
      await tap(page.locator('#save'));
      expect((await galleryStore(page)).rooms[0].room).toMatchObject({ version: 12, wall: 0x9ba58c, wallLeft: 0xb77d66, floorStyle: 'tile' });
      await menu(page, 'clear', { tap: width < 700 });
      await loadCurrentRoom(page);
      expect(await colors()).toMatchObject({ back: 0x9ba58c, left: 0xb77d66 });
      expect(await page.evaluate(() => window.__sim.finishes.floorStyle)).toBe('tile');
      expect(errors).toEqual([]);
    });
  });
}
