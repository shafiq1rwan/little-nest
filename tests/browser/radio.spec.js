import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

test('the radio is an on/off item that starts and stops the music, floats notes while playing, and never dims the sun', async ({ page }) => {
  const errors = await openGame(page, '/');   // the shipped living room has a radio on the reading table
  const radio = await page.evaluate(() => window.__sim.items.find((i) => i.type === 'kitRadio')?.id);
  expect(radio).toBeTruthy();
  const state = () => page.evaluate((id) => {
    const s = window.__sim;
    return { lit: s.state.get(id).lit, music: s.musicOn, notes: s.activities.hasNotes(id), sun: +s.sun.intensity.toFixed(4) };
  }, radio);

  // Start from silence with the radio switched off.
  if (await page.evaluate(() => window.__sim.musicOn)) await page.locator('#music-toggle').click();
  await page.evaluate((id) => { const s = window.__sim; s.setSelected(s.state.get(id)); }, radio);
  const button = page.locator('#light-selected');
  await expect(button).toBeVisible();
  if ((await state()).lit) await button.click();
  const off = await state();
  expect(off).toMatchObject({ lit: false, music: false, notes: false });

  // On: the music starts, notes rise, and the sunlight is exactly what it was.
  await button.click();
  await expect(button).toHaveAttribute('aria-label', 'Radio playing. Switch off');
  await page.waitForFunction((id) => window.__sim.activities.hasNotes(id), radio);
  expect(await state()).toMatchObject({ lit: true, music: true, notes: true, sun: off.sun });

  // Off again: the last radio stops the music and the notes go.
  await button.click();
  await page.waitForFunction((id) => !window.__sim.activities.hasNotes(id), radio);
  expect(await state()).toMatchObject({ lit: false, music: false, notes: false, sun: off.sun });

  // Undo brings the radio's switch back (the music is the player's to keep or stop).
  await page.locator('#undo-tool').click();
  expect((await state()).lit).toBe(true);
  expect(errors).toEqual([]);
});
