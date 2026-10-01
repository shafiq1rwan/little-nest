import { test, expect } from '@playwright/test';
import { openGame, galleryStore, twoFrames } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('lighting moods change the scene, lamps switch individually, and both save, load, and undo', async ({ page }) => {
      const errors = await openGame(page);
      const compact = width <= 900 || height <= 600;
      const sceneInfo = () => page.evaluate(() => {
        const s = window.__sim;
        const lamp = s.items.find((i) => i.type === 'floorLamp');
        let point = null;
        lamp.mesh.traverse((o) => { if (o.isPointLight) point = o.intensity; });
        return { lighting: s.finishes.lighting, background: s.scene.background.getHex(), sunIntensity: s.sun.intensity, exposure: s.renderer.toneMappingExposure, lampLight: point, lampLit: lamp.lit };
      });
      const morning = await sceneInfo();
      expect(morning).toMatchObject({ lighting: 'morning', lampLit: true });
      expect(morning.lampLight).toBeGreaterThan(0);

      // Pick Evening from the Light tab.
      if (compact && await page.locator('#panel').evaluate((el) => el.classList.contains('collapsed'))) await page.locator('#panel-toggle').click();
      await page.locator('#tab-light').click();
      await expect(page.locator('#lighting-options button')).toHaveCount(3);
      await page.getByRole('button', { name: 'Evening light', exact: true }).click();
      await twoFrames(page);
      const evening = await sceneInfo();
      expect(evening.lighting).toBe('evening');
      expect(evening.background).not.toBe(morning.background);
      expect(evening.sunIntensity).toBeLessThan(morning.sunIntensity);
      expect(evening.lampLight).toBeGreaterThan(morning.lampLight);   // lamps carry the room at night
      await expect(page.locator('#lighting-options button[aria-pressed="true"]')).toHaveAttribute('data-lighting', 'evening');

      // Switch the floor lamp off from its card, then on again with undo.
      await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'floorLamp')));
      await expect(page.locator('#light-selected')).toBeVisible();
      await expect(page.locator('#light-selected')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#light-selected').click();
      expect((await sceneInfo()).lampLight).toBe(0);
      await expect(page.locator('#light-selected')).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Control+z');
      expect((await sceneInfo()).lampLight).toBeGreaterThan(0);
      await page.keyboard.press('Control+Shift+z');
      expect((await sceneInfo()).lampLit).toBe(false);

      // Non-lamps have no light toggle.
      await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'sofa')));
      await expect(page.locator('#light-selected')).toBeHidden();

      // Save and reload keep the mood and the switched-off lamp; undoing the load restores morning.
      await page.locator('#save').click();
      const store = await galleryStore(page);
      expect(store.rooms[0].room.version).toBe(7);
      expect(store.rooms[0].room.lighting).toBe('evening');
      expect(store.rooms[0].room.items.find((i) => i.type === 'floorLamp').lit).toBe(false);
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Start a new reading nook', exact: true }).click();
      await twoFrames(page);
      expect((await sceneInfo()).lighting).toBe('morning');   // fresh rooms start in the morning
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Load Living room', exact: true }).click();
      await twoFrames(page);
      expect(await sceneInfo()).toMatchObject({ lighting: 'evening', lampLit: false, lampLight: 0 });
      await page.keyboard.press('Control+z');
      await twoFrames(page);
      expect((await sceneInfo()).lighting).toBe('morning');
      expect(errors).toEqual([]);
    });
  });
}
