import { test, expect } from '@playwright/test';
import { openGame, loadCurrentRoom, twoFrames, TERRACOTTA } from './helpers.js';

for (const [label, width, height] of [['desktop', 1440, 900], ['phone', 390, 844], ['tablet', 768, 1024], ['landscape', 844, 390]]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height } });
    test('sofa upholstery recolors independently, undoes, and reloads', async ({ page }, testInfo) => {
      const errors = await openGame(page);
      const colors = () => page.evaluate(() => {
        const sofa = window.__sim.items.find((i) => i.type === 'sofa');
        const fabric = [], fixed = [];
        sofa.mesh.traverse((o) => {   // only the sofa's own parts: pillows are child items with their own itemId
          let owner = o; while (owner && !owner.userData.itemId) owner = owner.parent;
          if (o.isMesh && owner === sofa.mesh) (o.userData.recolor ? fabric : fixed).push(o.material.color.getHex());
        });
        return { fabric, fixed: fixed.sort() };
      });
      const initial = await colors();
      expect(initial.fabric).toEqual(Array(9).fill(0xf3e4d2));
      expect(initial.fixed).toEqual([0xb87946]);   // the pillows are items now
      await page.evaluate(() => window.__sim.setSelected(window.__sim.items.find((i) => i.type === 'sofa')));
      await twoFrames(page);
      await page.screenshot({ path: testInfo.outputPath('sofa-integrated.png') });
      await page.getByRole('button', { name: 'Terracotta', exact: true }).click();
      expect(await colors()).toEqual({ fabric: Array(9).fill(TERRACOTTA), fixed: initial.fixed });
      await page.locator('#undo-tool').click();
      expect(await colors()).toEqual(initial);
      await page.locator('#redo-tool').click();
      await page.locator('#save').click();
      await page.locator('#remove-selected').click();
      await loadCurrentRoom(page);
      expect(await colors()).toEqual({ fabric: Array(9).fill(TERRACOTTA), fixed: initial.fixed });
      expect(errors).toEqual([]);
    });
  });
}
