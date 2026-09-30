import { test, expect } from '@playwright/test';
import { openGame, tilePoint, itemPoint, twoFrames } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('one finger moves furniture, two fingers pinch the camera, selection survives resizing', async ({ page, context }) => {
  await openGame(page);
  await page.locator('#panel-toggle').tap();
  await twoFrames(page);

  const cameraBefore = await page.evaluate(() => window.__sim.camera.position.toArray());
  const a = await itemPoint(page, 'armchair');
  const b = await tilePoint(page, 'armchair', 5, 3);

  const cdp = await context.newCDPSession(page);
  const dispatch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, i) => ({ ...p, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })),
  });

  await dispatch('touchStart', [a]);
  await dispatch('touchMove', [b]);
  await dispatch('touchEnd', []);
  expect(await page.evaluate(() => window.__sim.items.find((i) => i.type === 'armchair').gx)).toBe(5);
  const cameraAfter = await page.evaluate(() => window.__sim.camera.position.toArray());
  cameraBefore.forEach((x, i) => expect(Math.abs(x - cameraAfter[i]), 'single finger must not orbit').toBeLessThan(0.001));
  expect(await page.locator('#selection-card').isVisible()).toBe(true);

  await twoFrames(page);
  const zoom = await page.evaluate(() => window.__sim.camera.zoom);
  await dispatch('touchStart', [{ x: 150, y: 250 }, { x: 240, y: 250 }]);
  await dispatch('touchMove', [{ x: 120, y: 250 }, { x: 270, y: 250 }]);
  await dispatch('touchEnd', []);
  expect(await page.evaluate((z) => window.__sim.camera.zoom > z, zoom), 'pinch zooms').toBe(true);

  // Changing screen size moves the same selection controls into the right surface.
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'armchair')));
  await page.setViewportSize({ width: 1440, height: 900 });
  // The compact media query fires asynchronously after a resize, so wait for the re-dock rather than asserting immediately.
  await page.waitForFunction(() => document.getElementById('selection-card').parentElement.id === 'viewport');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.getElementById('selection-card').parentElement.id === 'panel-content');
});
