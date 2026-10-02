import { test, expect } from '@playwright/test';
import { openGame, loadCurrentRoom, galleryStore, twoFrames } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

const petState = (page) => page.evaluate(() => {
  const p = window.__sim.pet;
  if (!p) return null;
  const c = p.cell;
  return { action: p.action, cell: c, onSeat: p.onSeat, free: c ? window.__sim.isFree('pouf', c.gx, c.gz, 0) : null, y: p.pose.y };
});

test('the starter room has a cat that keeps to free floor, hops off furniture, and can be invited, recoloured and undone', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  expect(await petState(page)).not.toBeNull();
  await page.locator('#tab-light').click();
  await expect(page.locator('#pet-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pet-colors [data-pet="ginger"]')).toHaveAttribute('aria-pressed', 'true');

  // Sample for three seconds: whenever it stands on the floor, its cell is free and inside the room.
  const samples = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const p = window.__sim.pet; const c = p.cell;
      out.push({ action: p.action, ok: !c || (c.gx >= 0 && c.gz >= 0 && c.gx < 8 && c.gz < 8 && window.__sim.isFree('pouf', c.gx, c.gz, 0)) });
    }
    return out;
  });
  expect(samples.every((s) => s.ok)).toBe(true);

  // Drop a pouf on the cat: within a second it is somewhere free again.
  await page.evaluate(() => { const s = window.__sim; s.pet.brain.setCalm(true); });
  await page.waitForFunction(() => { const p = window.__sim.pet; return p.cell && p.action !== 'hop'; });
  const at = (await petState(page)).cell;
  const dropped = await page.evaluate(([gx, gz]) => !!window.__sim.addItem('pouf', gx, gz, 0), [at.gx, at.gz]);
  expect(dropped).toBe(true);
  await page.waitForFunction(([gx, gz]) => { const p = window.__sim.pet; return p.cell && p.action !== 'hop' && (p.cell.gx !== gx || p.cell.gz !== gz); }, [at.gx, at.gz], { timeout: 3000 });
  const after = await petState(page);
  expect(after.free).toBe(true);
  expect(after.cell).not.toEqual(at);
  await page.evaluate(() => window.__sim.pet.brain.setCalm(false));

  // Recolour, send away, undo, redo.
  await page.locator('#pet-colors [data-pet="grey"]').click();
  await expect(page.locator('#pet-colors [data-pet="grey"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__sim.finishes.petColor)).toBe('grey');
  await page.locator('#pet-toggle').click();
  await expect(page.locator('#pet-toggle')).toHaveText('Invite a cat');
  expect(await petState(page)).toBeNull();
  await page.locator('#undo-tool').click();
  expect(await petState(page)).not.toBeNull();
  await page.locator('#undo-tool').click();
  expect(await page.evaluate(() => window.__sim.finishes.petColor)).toBe('ginger');
  await page.locator('#redo-tool').click();

  // Saved with the room; an older save has no cat.
  await page.locator('#save').click();
  expect((await galleryStore(page)).rooms[0].room).toMatchObject({ version: 9, pet: { present: true, color: 'grey' } });
  await page.locator('#clear').click();
  await loadCurrentRoom(page);
  await twoFrames(page);
  expect(await page.evaluate(() => window.__sim.finishes)).toMatchObject({ petPresent: true, petColor: 'grey' });
  expect(await petState(page)).not.toBeNull();
  expect(errors).toEqual([]);
});

test('reduced motion: the cat rests in place', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  const errors = await openGame(page);
  const actions = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < 25; i++) { await new Promise((r) => setTimeout(r, 100)); seen.add(window.__sim.pet.action); }
    return [...seen];
  });
  expect(actions).not.toContain('walk');
  expect(errors).toEqual([]);
  await context.close();
});
