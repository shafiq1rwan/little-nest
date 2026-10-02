import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

const sample = (page) => page.evaluate(() => {
  const s = window.__sim;
  const lamp = s.items.find((i) => i.type === 'floorLamp');
  let light = null; lamp.mesh.traverse((o) => { if (o.isPointLight) light = { now: o.intensity, rest: o.userData.lampValue.intensity }; });
  const plant = s.items.find((i) => i.type === 'rubberTree');
  const foliage = plant.mesh.children.find((c) => c.isMesh && !c.userData.recolor);
  const e = foliage.matrix.elements;
  return { light, tilt: +Math.hypot(e[4], e[6]).toFixed(5), renders: s.perf.renders };
});

test('lamps breathe, plants sway, string lights twinkle at night, and turning motion off restores exact values', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  expect(await page.evaluate(() => window.__sim.motion.isEnabled())).toBe(true);
  expect(await page.evaluate(() => window.__sim.motion.counts())).toMatchObject({ lamps: 1, bulbs: 4 });
  expect((await page.evaluate(() => window.__sim.motion.counts())).plants).toBeGreaterThanOrEqual(4);

  // Over half a second the lamp and the plant move while the room keeps drawing frames.
  const a = await sample(page);
  await page.waitForTimeout(600);
  const b = await sample(page);
  expect(b.renders - a.renders).toBeGreaterThan(5);
  expect(b.light.now).not.toBe(a.light.now);
  expect(Math.abs(b.light.now / b.light.rest - 1)).toBeLessThan(0.05);   // a gentle breath, not a flicker
  expect(b.tilt).not.toBe(a.tilt);

  // Evening twinkles the bulbs; morning does not.
  await page.locator('#tab-light').click();
  await page.getByRole('button', { name: /Evening/ }).click();
  const bulbs = () => page.evaluate(() => window.__sim.scene.getObjectsByProperty('isMesh', true).filter((m) => m.material?.emissive?.getHex() === 0xffc76b).map((m) => +m.material.emissiveIntensity.toFixed(4)));
  const b1 = await bulbs(); await page.waitForTimeout(400); const b2 = await bulbs();
  expect(b1).not.toEqual(b2);

  // Off: everything returns to rest and the room goes idle again.
  await page.locator('#main-menu-toggle').click();
  await page.locator('#menu-settings').click();
  await expect(page.locator('#settings-motion')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#settings-motion').click();
  await expect(page.locator('#settings-motion')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#settings-done').click();
  await page.locator('#menu-start').click();
  const rest = await sample(page);
  expect(rest.light.now).toBe(rest.light.rest);
  expect(rest.tilt).toBe(0);
  expect(new Set(await bulbs()).size).toBe(1);
  await page.waitForTimeout(400);
  expect((await sample(page)).renders - rest.renders).toBeLessThan(3);

  // The choice is remembered.
  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  expect(await page.evaluate(() => [window.__sim.ambient.isOn(), window.__sim.motion.isEnabled()])).toEqual([false, false]);
  expect(errors).toEqual([]);
});

test('reduced motion keeps ambient motion off even when the setting is on', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  const errors = await openGame(page);
  expect(await page.evaluate(() => [window.__sim.ambient.isOn(), window.__sim.motion.isEnabled(), window.__sim.motion.active()])).toEqual([true, false, false]);
  expect(errors).toEqual([]);
  await context.close();
});
