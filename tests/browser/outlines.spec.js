import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test.use({ viewport: { width: 1280, height: 800 } });

/** Draws one frame (with or without outlines) and returns the share of dark-ink pixels and the mean brightness. */
const frameStats = (page, on) => page.evaluate(async (on) => {
  const s = window.__sim;
  s.outlines.setEnabled(on);
  s.outlines.render();
  const url = s.renderer.domElement.toDataURL('image/png');
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = url; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
  return sum / (data.length / 4) / 3;
}, on);

test('outlines darken edges, can be switched off in Settings, and the choice is remembered', async ({ page }) => {
  const errors = await openGame(page);
  expect(await page.evaluate(() => window.__sim.outlines.enabled)).toBe(true);
  const withLines = await frameStats(page, true);
  const without = await frameStats(page, false);
  expect(withLines).toBeLessThan(without - 0.5);   // ink lines only ever darken the frame

  // Settings switch, remembered across a reload.
  await page.evaluate(() => window.__sim.outlines.setEnabled(true));
  await page.locator('#main-menu-toggle').click();
  await page.locator('#menu-settings').click();
  await expect(page.locator('#settings-outlines')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#settings-outlines').click();
  await expect(page.locator('#settings-outlines')).toHaveText('Off');
  expect(await page.evaluate(() => [window.__sim.outlines.enabled, localStorage.getItem('home-deco-sim:outlines')])).toEqual([false, 'off']);
  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  expect(await page.evaluate(() => window.__sim.outlines.enabled)).toBe(false);
  expect(errors).toEqual([]);
});

test('helpers, ghosts and soft-outline models keep their materials after the edge pass', async ({ page }) => {
  const errors = await openGame(page);
  const result = await page.evaluate(() => {
    const s = window.__sim;
    const plant = s.items.find((i) => i.type === 'snakePlant');
    const before = [];
    s.scene.traverse((o) => { if (o.isMesh) before.push([o, o.material]); });
    s.outlines.render();
    const changed = before.filter(([o, m]) => o.material !== m).length;
    let soft = 0;
    plant.mesh.traverse((o) => { if (o.isMesh && o.userData.softOutline) soft++; });
    return { changed, soft, overrideMaterial: s.scene.overrideMaterial, background: !!s.scene.background };
  });
  expect(result).toEqual({ changed: 0, soft: expect.any(Number), overrideMaterial: null, background: true });
  expect(result.soft).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
