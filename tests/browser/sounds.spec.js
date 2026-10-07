import { test, expect } from '@playwright/test';
import { openGame, tilePoint, twoFrames, menu } from './helpers.js';
import { SFX } from '../../src/ui/sfx.js';

const SOUND_FILES = Object.values(SFX).reduce((n, s) => n + s.files.length, 0);   // every file in the table must load and decode

test.use({ viewport: { width: 1440, height: 900 } });

const played = (page) => page.evaluate(() => [...window.__sim.sfx.log]);
const clearLog = (page) => page.evaluate(() => { window.__sim.sfx.log.length = 0; });

test('actions play their sounds, every file decodes, and the effects switch and volume are remembered', async ({ page }) => {
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning' && /sound/.test(m.text())) warnings.push(m.text()); });
  const errors = await openGame(page);   // the menu click is the first gesture, which unlocks audio
  await page.waitForFunction((n) => window.__sim.sfx.loaded() === n, SOUND_FILES);
  expect(warnings).toEqual([]);

  // Place a pouf on a free tile, then try an occupied one.
  await page.locator('#deselect').click();
  await clearLog(page);
  await page.evaluate(() => window.__sim.startPlacing('pouf'));
  const free = await page.evaluate(() => { const s = window.__sim; for (let gz = 7; gz >= 0; gz--) for (let gx = 7; gx >= 0; gx--) if (s.isFree('pouf', gx, gz, 0)) return [gx, gz]; return null; });
  let p = await tilePoint(page, 'pouf', ...free);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.press('r');
  await page.mouse.click(p.x, p.y);
  expect(await played(page)).toEqual(['rotate', 'place']);

  await clearLog(page);
  await page.evaluate(() => window.__sim.startPlacing('pouf'));
  const sofa = await page.evaluate(() => { const s = window.__sim.items.find((i) => i.type === 'sofa'); return [s.gx, s.gz]; });
  p = await tilePoint(page, 'pouf', ...sofa);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  expect(await played(page)).toContain('blocked');
  await page.keyboard.press('Escape');

  // Lamp switch, recolour, and remove from the selection card.
  await clearLog(page);
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'floorLamp')));
  await page.locator('#light-selected').click();
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'pouf')));
  await page.locator('#item-swatches').getByRole('button', { name: 'Terracotta', exact: true }).click();
  await page.locator('#remove-selected').click();
  expect(await played(page)).toEqual(['lamp', 'recolor', 'remove']);   // the card buttons do not also tap

  // Settings: effects off is silent and remembered; volume is remembered.
  await menu(page, 'main-menu-toggle');
  await page.locator('#menu-settings').click();
  await expect(page.locator('#settings-sfx')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#settings-sfx-volume').fill('40');
  expect(await page.evaluate(() => window.__sim.sfx.volume())).toBeCloseTo(0.4, 5);
  await page.locator('#settings-sfx').click();
  await expect(page.locator('#settings-sfx')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#settings-sfx-volume')).toBeDisabled();
  await page.locator('#settings-done').click();
  await page.locator('#menu-start').click();
  await clearLog(page);
  await page.keyboard.press('r');
  await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'armchair')));
  await page.keyboard.press('r');
  expect(await played(page)).toEqual([]);

  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  expect(await page.evaluate(() => [window.__sim.sfx.isOn(), window.__sim.sfx.volume()])).toEqual([false, 0.4]);
  await twoFrames(page);
  expect(errors).toEqual([]);
});
