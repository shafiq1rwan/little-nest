import { test, expect } from '@playwright/test';
import { openGame, view, twoFrames } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

const cameraState = (page) => page.evaluate(() => {
  const s = window.__sim, w = s.roomConfig.width, d = s.roomConfig.depth;
  const r = document.getElementById('scene').getBoundingClientRect();
  // The four floor corners on screen.
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([x, z]) => {
    const p = new s.camera.position.constructor(x, 0, z).project(s.camera);
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  });
  return { polar: s.controls.getPolarAngle(), zoom: s.camera.zoom, corners, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
});

test('Top view looks straight down at the whole house and comes back to the angle and zoom you had', async ({ page }) => {
  const errors = await openGame(page, '/');
  await page.evaluate(() => window.__sim.startPreset('house'));
  await page.locator('#panel-close').click();
  await twoFrames(page);
  const before = await cameraState(page);
  expect(before.polar).toBeGreaterThan(0.8);

  await view(page, 'top-view');
  await expect(page.locator('#top-view')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => window.__sim.controls.getPolarAngle() < 0.05);
  await twoFrames(page);
  const top = await cameraState(page);
  for (const c of top.corners) {
    expect(c.x >= top.rect.x && c.x <= top.rect.x + top.rect.w && c.y >= top.rect.y && c.y <= top.rect.y + top.rect.h, 'corner on screen ' + JSON.stringify(c)).toBe(true);
  }

  await page.locator('#top-view').click();
  await expect(page.locator('#top-view')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForFunction((phi) => Math.abs(window.__sim.controls.getPolarAngle() - phi) < 0.01, before.polar);
  const back = await cameraState(page);
  expect(back.zoom).toBeCloseTo(before.zoom, 5);

  // Right-dragging up tilts the view toward the top as well (no longer stopped at ~29 degrees).
  expect(await page.evaluate(() => window.__sim.controls.minPolarAngle)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});
