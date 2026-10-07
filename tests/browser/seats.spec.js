import { test, expect } from '@playwright/test';
import { openGame, roomState, selectedInfo, twoFrames, loadCurrentRoom, STARTER_ITEM_COUNT, TERRACOTTA, menu } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

const childrenOf = (page, type) => page.evaluate((t) => {
  const s = window.__sim; const host = s.items.find((i) => i.type === t && !i.parent);
  return s.items.filter((i) => i.parent === host.id).map((i) => ({ type: i.type, slot: i.slot, color: i.color }));
}, type);

test('pillows and throws sit on seats only, follow the seat, recolour, and survive save and load', async ({ page }) => {
  const errors = await openGame(page);
  await page.locator('#deselect').click();
  // The starter sofa carries two pillows as items, not baked geometry.
  expect(await childrenOf(page, 'sofa')).toEqual([
    expect.objectContaining({ type: 'pillow', slot: 0, color: 0xbf895c }),
    expect.objectContaining({ type: 'pillow', slot: 2 }),
  ]);
  expect(await page.evaluate(() => { let n = 0; window.__sim.items.find((i) => i.type === 'sofa').mesh.traverse((o) => { if (/pillow/.test(o.name)) n++; }); return n; })).toBe(0);

  // The Soft chip lists the two items; a pillow refuses tables and accepts the free sofa seat.
  await page.locator('[data-category="soft"]').click();
  expect(await page.locator('.catalog-card:visible').count()).toBe(7);   // two classics and five Modern home cushions and toys
  await page.locator('.catalog-card[data-type="pillow"]').click();
  await expect(page.locator('#mode-label')).toContainText('on a seat');
  expect(await page.evaluate(() => { const s = window.__sim; const t = s.items.find((i) => i.type === 'coffeeTable'); return s.state.canPlaceOn('pillow', t.id, 1); })).toBe(false);
  expect(await page.evaluate(() => { const s = window.__sim; const t = s.items.find((i) => i.type === 'sofa'); return s.state.canPlaceOn('pillow', t.id, 1); })).toBe(true);
  expect(await page.evaluate(() => { const s = window.__sim; const t = s.items.find((i) => i.type === 'sofa'); return s.state.canPlaceOn('mug', t.id, 1); })).toBe(false);

  // Pointer placement on the middle seat.
  const seat = await page.evaluate(() => {
    const s = window.__sim; const sofa = s.items.find((i) => i.type === 'sofa');
    const p = s.slotWorld(sofa.id, 1); p.y += 0.12; p.project(s.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.move(seat.x, seat.y);
  expect(await page.evaluate(() => window.__sim.ghost.visible)).toBe(true);
  await page.mouse.click(seat.x, seat.y);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect(await selectedInfo(page)).toMatchObject({ type: 'pillow' });
  expect(await page.locator('#selection-size').textContent()).toBe('Sits on sofas, chairs and beds');
  expect((await childrenOf(page, 'sofa')).map((c) => c.slot).sort()).toEqual([0, 1, 2]);

  // Recolour the new pillow; move the sofa and the pillows follow.
  await page.getByRole('button', { name: 'Terracotta', exact: true }).click();
  expect((await childrenOf(page, 'sofa')).find((c) => c.slot === 1).color).toBe(TERRACOTTA);
  const before = await page.evaluate(() => { const s = window.__sim; return s.items.filter((i) => i.type === 'pillow').map((i) => i.mesh.getWorldPosition(s.scene.position.clone()).x); });
  await page.evaluate(() => { const s = window.__sim; const sofa = s.items.find((i) => i.type === 'sofa'); s.commands.move(sofa.id, 1, 1); });
  await twoFrames(page);
  const after = await page.evaluate(() => { const s = window.__sim; return s.items.filter((i) => i.type === 'pillow').map((i) => i.mesh.getWorldPosition(s.scene.position.clone()).x); });
  expect(after.map((x, i) => +(x - before[i]).toFixed(3))).toEqual([-1, -1, -1]);

  // Save and load keep the pillows on their seats.
  await page.locator('#save').click();
  await menu(page, 'clear');
  await loadCurrentRoom(page);
  expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT + 1);
  expect((await childrenOf(page, 'sofa')).map((c) => c.type + '@' + c.slot).sort()).toEqual(['pillow@0', 'pillow@1', 'pillow@2']);
  expect(errors).toEqual([]);
});
