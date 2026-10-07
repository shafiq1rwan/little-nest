import { test, expect } from '@playwright/test';
import { openGame, roomState, tilePoint, selectedInfo, loadCurrentRoom, galleryStore, twoFrames, STARTER_ITEM_COUNT } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('a new room preset rebuilds the shell, bounds, walls, and framing; saves carry the preset; undo restores', async ({ page }) => {
      const errors = await openGame(page);
      const roomInfo = () => page.evaluate(() => {
        const s = window.__sim;
        const wall = s.wallPanels.back.geometry.parameters;
        const grid = s.grid.geometry.getAttribute('position');
        return { ...s.roomConfig, placementW: s.placement.width, placementD: s.placement.depth, backWallWidth: wall.width, gridPoints: grid.count, blocked: s.wallBlocked.size, zoomSpan: s.camera.right - s.camera.left };
      });
      const living = await roomInfo();
      expect(living).toMatchObject({ preset: 'livingRoom', width: 8, depth: 8, placementW: 8, backWallWidth: 8 });

      // Start a studio from the Rooms dialog.
      await page.locator('#load').click();
      await expect(page.locator('#gallery-presets .preset-card')).toHaveCount(7);
      await page.getByRole('button', { name: 'Start a new studio', exact: true }).click();
      await expect(page.locator('#gallery')).toBeHidden();
      await twoFrames(page);
      const studio = await roomInfo();
      expect(studio).toMatchObject({ preset: 'studio', width: 6, depth: 6, placementW: 6, placementD: 6, backWallWidth: 6 });
      expect(studio.gridPoints).toBeLessThan(living.gridPoints);
      expect(studio.blocked).not.toBe(living.blocked);
      expect(await page.locator('#room-name').textContent()).toBe('Unsaved room');
      const studioItems = await roomState(page);
      expect(studioItems.length).toBe(14);
      expect(studioItems.every((i) => i.gx === null || (i.gx < 6 && i.gz < 6))).toBe(true);
      if (width >= 700) expect((await selectedInfo(page))?.type).toBe('chair');

      // Bounds follow the new size: the far corner tile is 5,5, and 7,7 is outside the room.
      if (await page.locator('#deselect').isVisible()) await page.locator('#deselect').click();
      expect(await page.evaluate(() => window.__sim.isFree('plant', 7, 7, 0))).toBe(false);
      expect(await page.evaluate(() => window.__sim.state.canMount('clock', 'left', 4, 0))).toBe(true);
      expect(await page.evaluate(() => window.__sim.state.canMount('clock', 'left', 5, 0))).toBe(false);   // the studio's door
      expect(await page.evaluate(() => window.__sim.state.canMount('clock', 'left', 6, 0))).toBe(false);

      // Save: the store records the preset; the gallery row names it.
      await page.locator('#save').click();
      const store = await galleryStore(page);
      expect(store.rooms[0].room.version).toBe(12);
      expect(store.rooms[0].room.room).toEqual({ preset: 'studio', width: 6, depth: 6 });
      await page.locator('#load').click();
      await expect(page.locator('#gallery .room-head p').first()).toContainText('Studio');
      await page.keyboard.press('Escape');

      // Undo the preset switch: the living room and its 20 items come back with the 8-wide wall.
      await page.keyboard.press('Control+z');   // undo the implicit... (save is not undoable) -> undoes the new room
      await twoFrames(page);
      expect(await roomInfo()).toMatchObject({ preset: 'livingRoom', width: 8, backWallWidth: 8 });
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
      await page.keyboard.press('Control+Shift+z');
      await twoFrames(page);
      expect(await roomInfo()).toMatchObject({ preset: 'studio', width: 6 });

      // Loading the saved studio from a living room rebuilds the shell again, and the reading nook frames smaller.
      await page.keyboard.press('Control+z');
      await loadCurrentRoom(page);
      await twoFrames(page);
      expect(await roomInfo()).toMatchObject({ preset: 'studio', width: 6 });
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Start a new reading nook', exact: true }).click();
      await twoFrames(page);
      const nook = await roomInfo();
      expect(nook).toMatchObject({ preset: 'readingNook', width: 5, depth: 5 });
      expect(nook.zoomSpan).toBeCloseTo(living.zoomSpan, 3);   // small rooms keep the baseline framing

      // The balcony has railings instead of walls: no wall items can be hung, and the wall tab's items refuse.
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Start a new balcony', exact: true }).click();
      await twoFrames(page);
      expect(await roomInfo()).toMatchObject({ preset: 'balcony', width: 6, depth: 4 });
      expect(await page.evaluate(() => window.__sim.placement.wallRows)).toBe(0);
      expect(await page.evaluate(() => window.__sim.state.canMount('clock', 'back', 0, 0))).toBe(false);
      expect(await page.evaluate(() => window.__sim.items.filter((i) => i.wall).length)).toBe(0);
      expect(await page.evaluate(() => window.__sim.wallPanels.back.geometry.parameters.height)).toBeLessThan(0.2);   // a rail, not a wall

      // The bedroom's bed is a 2 x 3 footprint, one cell in from the door, and its lantern sits on the nightstand.
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Start a new bedroom', exact: true }).click();
      await twoFrames(page);
      expect(await roomInfo()).toMatchObject({ preset: 'bedroom', width: 7, depth: 7 });
      expect(await page.evaluate(() => window.__sim.occupancy.has('2,2') && !window.__sim.occupancy.has('3,2') && !window.__sim.occupancy.has('0,0'))).toBe(true);
      expect(await page.evaluate(() => { const n = window.__sim.items.find((i) => i.type === 'nightstand'); return window.__sim.items.filter((i) => i.parent === n.id).map((i) => i.type); })).toEqual(['lantern']);
      expect(errors).toEqual([]);
    });
  });
}
