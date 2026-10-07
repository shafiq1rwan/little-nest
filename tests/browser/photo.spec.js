import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, itemPoint, selectedInfo, twoFrames, view } from './helpers.js';

function pngSize(buffer) {
  // PNG signature then IHDR: width and height are big-endian at bytes 16 and 20.
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('photo mode hides the HUD, blocks editing, saves a PNG, and restores everything', async ({ page }) => {
      const errors = await openGame(page);
      const compact = width <= 900 || height <= 600;
      await page.locator('#grid-tool').click();   // grid on, so we can check it comes back
      expect(await page.evaluate(() => window.__sim.grid.visible)).toBe(true);
      const canvasBefore = await page.locator('#scene').boundingBox();

      await view(page, 'photo-tool');
      expect(await page.evaluate(() => window.__sim.photoMode)).toBe(true);
      await expect(page.locator('#photo-bar')).toBeVisible();
      await expect(page.locator('#panel')).toBeHidden();
      await expect(page.locator('#dock-decorate')).toBeHidden();   // only the View tools stay
      await expect(page.locator('#selection-card')).toBeHidden();
      expect(await page.evaluate(() => window.__sim.grid.visible)).toBe(false);
      expect(await selectedInfo(page)).toBeNull();
      await twoFrames(page);
      const canvasPhoto = await page.locator('#scene').boundingBox();
      expect(canvasPhoto.height, 'the room gets the space the HUD gave up').toBeGreaterThanOrEqual(canvasBefore.height);
      const bar = await page.locator('#photo-bar').boundingBox();
      expect(bar.x >= 0 && bar.x + bar.width <= width && bar.y >= 0 && bar.y + bar.height <= height, 'photo bar on screen').toBe(true);

      // Clicking furniture does nothing in photo mode.
      const sofa = await itemPoint(page, 'sofa', 0.65);
      await page.mouse.click(sofa.x, sofa.y);
      expect(await selectedInfo(page)).toBeNull();

      // Saving downloads a PNG at least as large as the canvas, and the renderer is restored afterwards.
      const ratioBefore = await page.evaluate(() => window.__sim.scene && document.getElementById('scene').width);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#photo-save').click()]);
      expect(download.suggestedFilename()).toBe('little-nest-photo.png');
      const png = readFileSync(await download.path());
      const size = pngSize(png);
      expect(size.width).toBeGreaterThanOrEqual(Math.floor(canvasPhoto.width));
      expect(size.height).toBeGreaterThanOrEqual(Math.floor(canvasPhoto.height));
      expect(size.width / canvasPhoto.width).toBeCloseTo(size.height / canvasPhoto.height, 1);
      await twoFrames(page);
      expect(await page.evaluate(() => document.getElementById('scene').width)).toBe(ratioBefore);

      // The photo is named after the open room once it has one.
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => window.__sim.photoMode)).toBe(false);
      await expect(page.locator('#photo-bar')).toBeHidden();
      await expect(page.locator('#dock-decorate')).toBeVisible();
      expect(await page.evaluate(() => window.__sim.grid.visible)).toBe(true);
      if (!compact) await expect(page.locator('#panel')).toBeVisible();
      await page.locator('#save').click();
      await view(page, 'photo-tool');
      const [named] = await Promise.all([page.waitForEvent('download'), page.locator('#photo-save').click()]);
      expect(named.suggestedFilename()).toBe('living-room-photo.png');
      await page.locator('#photo-exit').click();
      expect(await page.evaluate(() => window.__sim.photoMode)).toBe(false);

      // Editing works again afterwards. The HUD coming back resizes the canvas, so re-project the sofa.
      await twoFrames(page);
      const sofaAgain = await itemPoint(page, 'sofa', 0.65);
      await page.mouse.click(sofaAgain.x, sofaAgain.y);
      expect((await selectedInfo(page))?.type).toBe('sofa');
      expect(errors).toEqual([]);
    });
  });
}
