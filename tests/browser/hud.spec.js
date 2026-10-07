import { test, expect } from '@playwright/test';
import { openGame, menu, tilePoint, selectedInfo, noHorizontalOverflow, twoFrames } from './helpers.js';

// Baseline viewports from docs/HANDOFF.md. Compact HUD applies at width <= 900 or height <= 600.
const VIEWPORTS = [
  [390, 844],
  [320, 568],
  [768, 1024],
  [844, 390],
  [568, 320],
  [1440, 900],
];
// The action bar and the dock; everything else opens from the More menu or the View popover.
const IMPORTANT_CONTROLS = ['load', 'save', 'more-toggle', 'dock-decorate', 'undo-tool', 'redo-tool', 'grid-tool', 'view-toggle'];

for (const [width, height] of VIEWPORTS) {
  const compact = width <= 900 || height <= 600;
  const landscape = width > height;

  test.describe(width + 'x' + height, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: width < 700 });

    test('controls stay reachable and ' + (compact ? 'the drawer docks selection outside the room' : 'the desktop card floats in the viewport'), async ({ page }) => {
      const errors = await openGame(page);
      expect(await noHorizontalOverflow(page)).toBe(true);
      const dock = await page.locator('.dock').boundingBox();
      expect(dock.x >= 0 && dock.x + dock.width <= width + 0.5 && dock.y + dock.height <= height + 0.5, 'the dock is on screen').toBe(true);
      expect(await page.locator('.mode-pill').isVisible(), 'the placing pill only shows while placing').toBe(false);
      if (compact) {
        expect(await page.locator('.brand h1').evaluate(el => el.scrollWidth <= el.clientWidth), 'full game name fits').toBe(true);
      }

      for (const id of IMPORTANT_CONTROLS) {
        const b = await page.locator('#' + id).boundingBox();
        expect(b, id + ' is rendered').not.toBeNull();
        expect(b.x >= 0 && b.x + b.width <= width + 0.5 && b.y >= 0 && b.y + b.height <= height + 0.5, id + ' on screen').toBe(true);
        if (compact) expect(b.width >= 44 && b.height >= 44, id + ' touch target').toBe(true);
      }

      if (!compact) {
        expect(await page.locator('#selection-card').evaluate((el) => el.parentElement.id)).toBe('viewport');
        // Minimise keeps the header; close folds the card into the dock and gives the room the width.
        await page.locator('#panel-toggle').click();
        await expect(page.locator('#panel-content')).toBeHidden();
        await expect(page.locator('#dock-decorate')).toHaveAttribute('aria-pressed', 'false');
        await page.locator('#panel-toggle').click();
        await expect(page.locator('#tab-furniture')).toBeVisible();
        const before = await page.locator('#scene').boundingBox();
        await page.locator('#panel-close').click();
        await expect(page.locator('#panel')).toBeHidden();
        await twoFrames(page);
        expect((await page.locator('#scene').boundingBox()).width).toBeGreaterThan(before.width);
        await page.locator('#dock-decorate').click();
        await expect(page.locator('#panel')).toBeVisible();
        await expect(page.locator('#dock-decorate')).toHaveAttribute('aria-pressed', 'true');
        expect(errors).toEqual([]);
        return;
      }

      const panel = page.locator('#panel');
      const collapsed = () => panel.evaluate((el) => el.classList.contains('collapsed'));
      expect(await page.locator('#selection-card').isVisible()).toBe(false);
      if (await collapsed()) await page.locator('#dock-decorate').tap();   // the dock always brings the drawer back
      expect(await page.locator('#tab-furniture').isVisible()).toBe(true);
      if (!landscape) expect(await page.locator('#catalog').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

      // Hiding the drawer gives the room more space.
      const before = await page.locator('#scene').boundingBox();
      await page.locator('#panel-toggle').tap();
      const after = await page.locator('#scene').boundingBox();
      expect(landscape ? after.width > before.width : after.height > before.height).toBe(true);
      await page.locator('#dock-decorate').tap();

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
      await page.locator('#dock-decorate').tap();
      await page.locator('#deselect').tap();
      expect(await page.locator('#tab-furniture').isVisible()).toBe(true);

      await page.locator('#tab-walls').tap();
      await page.getByRole('button', { name: 'Clay', exact: true }).tap();
      await page.locator('#tab-furniture').tap();
      await page.locator('#search').fill('plant');
      expect(await page.locator('.catalog-card:visible').count()).toBe(16);   // plus the Modern home potted plant and three little plants; was: seven plants, the succulent, the hanging plant, the planter, the bonsai, and the botanical print
      await page.locator('#save').tap();
      expect(errors).toEqual([]);
    });
  });
}

test('floating decorating box supports keyboard choice and exposes the active furniture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openGame(page);
  const panel = await page.locator('#panel').boundingBox();
  const header = await page.locator('.topbar').boundingBox();
  expect(panel.y).toBeGreaterThan(header.y + header.height);
  expect(panel.x + panel.width).toBeLessThan(1440);
  const card = page.getByRole('button', { name: 'Place Sofa', exact: true });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.catalog-card[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#mode-label')).toContainText('sofa');
  await page.keyboard.press('Escape');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('the More menu, the View tools, Hide HUD and the filters open, close and come back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openGame(page);
  // More: opens under the bar, closes on Escape and after a choice.
  await page.locator('#more-toggle').click();
  await expect(page.locator('#more-menu')).toBeVisible();
  await expect(page.locator('#more-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#item-count')).toContainText('items in room');
  await page.keyboard.press('Escape');
  await expect(page.locator('#more-menu')).toBeHidden();
  await page.locator('#more-toggle').click();
  await page.locator('#help-toggle').click();
  await expect(page.locator('#more-menu')).toBeHidden();
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.locator('#more-toggle').click();
  await page.locator('#help-toggle').click();

  // View: the camera tools stay open for repeated presses and close on a click elsewhere.
  await page.locator('#view-toggle').click();
  await expect(page.locator('#view-menu')).toBeVisible();
  const zoom = () => page.evaluate(() => window.__sim.camera.zoom);
  const z0 = await zoom();
  await page.locator('#zoom-in').click();
  await page.locator('#zoom-in').click();
  expect(await zoom()).toBeGreaterThan(z0);
  await expect(page.locator('#view-menu')).toBeVisible();
  await page.mouse.click(300, 300);
  await expect(page.locator('#view-menu')).toBeHidden();

  // Hide HUD leaves only the room and a way back.
  await menu(page, 'hud-hide-menu');
  for (const sel of ['.save-actions', '#panel', '.dock']) await expect(page.locator(sel)).toBeHidden();
  await expect(page.locator('#show-hud')).toBeVisible();
  await page.locator('#show-hud').click();
  await expect(page.locator('.dock')).toBeVisible();
  await expect(page.locator('#show-hud')).toBeHidden();
  await menu(page, 'hud-hide-menu');
  await page.keyboard.press('Escape');
  await expect(page.locator('.dock')).toBeVisible();

  // Selecting, then hiding: the selection clears. The chevron folds the item card to its name.
  await page.evaluate(() => { const s = window.__sim; s.setSelected(s.state.items.find((i) => i.type === 'armchair')); });
  await page.locator('#selection-collapse').click();
  await expect(page.locator('#move-selected')).toBeHidden();
  await expect(page.locator('#selection-name')).toBeVisible();
  await page.locator('#selection-collapse').click();
  await expect(page.locator('#move-selected')).toBeVisible();
  await menu(page, 'hud-hide-menu');
  expect(await page.evaluate(() => window.__sim.selected)).toBeNull();
  await page.locator('#show-hud').click();

  // The filter button folds the collection and category filters away.
  await page.locator('#filter-toggle').click();
  await expect(page.locator('#categories')).toBeHidden();
  await page.locator('#filter-toggle').click();
  await expect(page.locator('#categories')).toBeVisible();
  expect(errors).toEqual([]);
});
