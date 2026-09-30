import { test, expect } from '@playwright/test';
import { openGame, noHorizontalOverflow } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test('Little Nest title, icons, manifest, and music asset are served', async ({ page }) => {
  const errors = await openGame(page);
  expect(await page.title()).toBe('Little Nest');
  expect(await page.getByRole('heading', { name: 'Little Nest', exact: true }).count()).toBe(1);
  expect(await page.locator('.brand-icon').evaluate((i) => i.complete && i.naturalWidth === 192)).toBe(true);

  for (const size of [32, 180, 192, 512]) {
    const response = await page.request.get('/icons/little-nest-' + size + '.png');
    expect(response.status(), 'icon ' + size).toBe(200);
    expect(response.headers()['content-type']).toMatch(/image\/png/);
  }
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Little Nest');
  const audio = await page.request.get('/audio/lofidreams-bgm.mp3');
  expect(audio.status()).toBe(200);
  expect(audio.headers()['content-type']).toMatch(/audio\/mpeg/);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => document.getElementById('selection-card').parentElement.id === 'panel-content');
    if (await page.locator('#deselect').isVisible()) await page.locator('#deselect').click();
    expect(await noHorizontalOverflow(page)).toBe(true);
    const icon = await page.locator('.brand-icon').boundingBox();
    const name = await page.locator('h1').boundingBox();
    const load = await page.locator('#load').boundingBox();
    expect(icon.x >= 0 && name.x + name.width <= load.x, 'brand fits before the actions at ' + width).toBe(true);
  }
  expect(errors).toEqual([]);
});
