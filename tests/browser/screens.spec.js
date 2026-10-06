import { test, expect } from '@playwright/test';
import { openGame, enterFromMenu, roomState, twoFrames, STARTER_ITEM_COUNT } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('loading leads to the menu; the menu starts, returns, opens rooms and settings', async ({ page }) => {
      const errors = await openGame(page, undefined, { enter: false });
      const screenName = () => page.evaluate(() => document.body.dataset.screen);

      // The loading screen has faded; the menu shows over a live, non-interactive room.
      expect(await screenName()).toBe('menu');
      await expect(page.locator('#loading-screen')).toBeHidden();
      await expect(page.locator('#main-menu')).toBeVisible();
      await expect(page.locator('#menu-start')).toContainText('Start decorating');
      expect(await page.locator('#app').evaluate((el) => el.inert)).toBe(true);
      await expect(page.locator('#loading-tip')).toContainText('Tip: ');
      expect(await page.locator('.loading-art').getAttribute('src')).toMatch(/\.webp$/);
      // Credits name the maker, the music source, and the font licences.
      await page.locator('#menu-credits').click();
      await expect(page.locator('#credits')).toBeVisible();
      await expect(page.locator('#credits')).toContainText('Saiss');
      await expect(page.locator('#credits')).toContainText('Pixabay');
      await expect(page.locator('#credits')).toContainText('SIL Open Font License');
      for (const link of await page.locator('#credits a').all()) expect(await link.getAttribute('rel')).toBe('noopener');
      await page.locator('#credits-done').click();
      await expect(page.locator('#credits')).toBeHidden();

      for (const id of ['menu-start', 'menu-rooms', 'menu-settings', 'menu-credits']) {
        const b = await page.locator('#' + id).boundingBox();
        expect(b.width >= 44 && b.height >= 44, id + ' touch target').toBe(true);
        expect(b.x >= 0 && b.x + b.width <= width && b.y >= 0 && b.y + b.height <= height, id + ' on screen').toBe(true);
      }

      // Settings toggles music and stays in sync with the HUD button.
      await page.locator('#menu-settings').click();
      await expect(page.locator('#settings')).toBeVisible();
      await expect(page.locator('#settings-music')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#settings-music').click();
      await expect(page.locator('#settings-music')).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => window.__sim.musicOn)).toBe(false);
      await page.locator('#settings-done').click();
      await expect(page.locator('#settings')).toBeHidden();

      // Start decorating: the HUD appears, editing works, and the room was untouched by the menu.
      await enterFromMenu(page);
      expect(await screenName()).toBe('game');
      expect(await page.locator('#app').evaluate((el) => el.inert)).toBe(false);
      await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
      await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'armchair')));
      await page.keyboard.press('Delete');
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT - 1);

      // Back to the menu with the visible Menu button: keys no longer edit, and the label reads Resume.
      await page.locator('#main-menu-toggle').click();
      expect(await screenName()).toBe('menu');
      await expect(page.locator('#menu-start')).toContainText('Resume decorating');
      await page.keyboard.press('Control+z');
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT - 1);   // undo is ignored while the menu is up
      await twoFrames(page);

      // My rooms opens the gallery without the save form; starting a preset enters the game.
      await page.locator('#menu-rooms').click();
      await expect(page.locator('#gallery')).toBeVisible();
      await expect(page.locator('#gallery-save')).toBeHidden();
      await page.getByRole('button', { name: 'Start a new studio', exact: true }).click();
      await page.waitForFunction(() => document.body.dataset.screen === 'game');
      await twoFrames(page);
      expect(await page.evaluate(() => window.__sim.roomConfig.preset)).toBe('studio');
      expect(await page.locator('#room-name').textContent()).toBe('Unsaved room');

      // The in-game Rooms dialog still offers the save form.
      await page.locator('#load').click();
      await expect(page.locator('#gallery-save')).toBeVisible();
      await page.keyboard.press('Escape');
      expect(errors).toEqual([]);
    });
  });
}
