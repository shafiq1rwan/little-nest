import { test, expect } from '@playwright/test';
import { openGame, enterFromMenu, roomState, galleryStore, STARTER_ITEM_COUNT } from './helpers.js';

for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700 });

    test('save as, list, load, rename, duplicate, delete, and persistence across reloads', async ({ page }) => {
      const errors = await openGame(page);
      const dialog = page.locator('#gallery');
      const entries = () => page.locator('#gallery .room-entry');
      const names = () => page.locator('#gallery .room-head h3').allTextContents();

      expect(await page.locator('#room-name').textContent()).toBe('Unsaved room');

      // Save the starter design under a name.
      await page.locator('#load').click();
      await expect(dialog).toBeVisible();
      await expect(page.locator('#gallery-empty')).toBeVisible();
      await page.locator('#gallery-name').fill('  Sunny   corner ');
      await page.locator('#gallery-save button[type="submit"]').click();
      expect(await names()).toEqual(['Sunny corner']);
      await expect(entries().first()).toHaveClass(/current/);
      expect(await page.locator('#room-name').textContent()).toBe('Sunny corner');
      const store = await galleryStore(page);
      expect(store.rooms[0].room.items).toHaveLength(STARTER_ITEM_COUNT);
      expect(store.rooms[0].room.version).toBe(7);

      // Change the room, save a second design, then load the first back.
      await page.locator('#gallery-close').click();
      await expect(dialog).toBeHidden();
      await page.locator('#clear').click();
      expect(await roomState(page)).toHaveLength(0);
      await page.locator('#load').click();
      await page.locator('#gallery-name').fill('Empty');
      await page.locator('#gallery-save button[type="submit"]').click();
      expect(await names()).toEqual(['Empty', 'Sunny corner']);   // newest first
      await page.getByRole('button', { name: 'Load Sunny corner', exact: true }).click();
      await expect(dialog).toBeHidden();
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);
      expect(await page.locator('#room-name').textContent()).toBe('Sunny corner');
      await page.keyboard.press('Control+z');   // a load is undoable
      expect(await roomState(page)).toHaveLength(0);
      await page.keyboard.press('Control+Shift+z');

      // Save keeps overwriting the open room.
      await page.evaluate(() => window.__sim.commands.remove(window.__sim.items[0].id));
      await page.locator('#save').click();
      expect((await galleryStore(page)).rooms.find((r) => r.name === 'Sunny corner').room.items).toHaveLength(STARTER_ITEM_COUNT - 1);
      expect((await galleryStore(page)).rooms).toHaveLength(2);

      // Rename, duplicate, delete with confirmation.
      await page.locator('#load').click();
      await page.getByRole('button', { name: 'Rename Sunny corner', exact: true }).click();
      await page.locator('#gallery .room-rename input').fill('Reading nook');
      await page.locator('#gallery .room-rename button[type="submit"]').click();
      expect(await names()).toContain('Reading nook');
      expect(await page.locator('#room-name').textContent()).toBe('Reading nook');
      await page.getByRole('button', { name: 'Duplicate Reading nook', exact: true }).click();
      expect(await names()).toContain('Reading nook copy');
      await page.getByRole('button', { name: 'Delete Reading nook copy', exact: true }).click();
      await page.getByRole('button', { name: 'Keep', exact: true }).click();
      expect(await names()).toContain('Reading nook copy');
      await page.getByRole('button', { name: 'Delete Reading nook copy', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm delete Reading nook copy', exact: true }).click();
      expect(await names()).toEqual(['Reading nook', 'Empty']);   // the overwrite made it the newest
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // Everything survives a reload; the open room is unsaved again until loaded.
      await page.reload();
      await page.waitForFunction(() => !!window.__sim);
      await enterFromMenu(page);
      expect(await page.locator('#room-name').textContent()).toBe('Unsaved room');
      await page.locator('#load').click();
      expect(await names()).toEqual(['Reading nook', 'Empty']);   // the overwrite made it the newest
      const box = await page.locator('#gallery').boundingBox();
      expect(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height, 'dialog fits the viewport').toBe(true);
      if (width < 700) {
        for (const b of await page.locator('#gallery .room-actions button').all()) {
          const bb = await b.boundingBox();
          expect(bb.height >= 44, 'touch target').toBe(true);
        }
      }
      expect(errors).toEqual([]);
    });

    test('export downloads a room file and import adds it back; bad files change nothing', async ({ page }) => {
      await openGame(page);
      const names = () => page.locator('#gallery .room-head h3').allTextContents();
      await page.locator('#load').click();
      await page.locator('#gallery-name').fill('Travel room');
      await page.locator('#gallery-save button[type="submit"]').click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export Travel room', exact: true }).click(),
      ]);
      expect(download.suggestedFilename()).toBe('travel-room.littlenest.json');
      const path = await download.path();
      const text = (await import('node:fs')).readFileSync(path, 'utf8');
      const file = JSON.parse(text);
      expect(file).toMatchObject({ app: 'little-nest', format: 1, name: 'Travel room' });
      expect(file.room.items).toHaveLength(STARTER_ITEM_COUNT);

      // Import the exported file: a new entry with the file's name appears.
      await page.locator('#gallery-import-file').setInputFiles({ name: 'travel-room.littlenest.json', mimeType: 'application/json', buffer: Buffer.from(text) });
      await expect(page.locator('#gallery .room-head h3')).toHaveCount(2);
      expect(await names()).toEqual(['Travel room', 'Travel room']);
      const store = await galleryStore(page);
      expect(store.rooms[1].room.items.map((i) => i.id)).toEqual(store.rooms[0].room.items.map((i) => i.id));   // ids preserved

      // A bare room without the envelope is named after the file.
      await page.locator('#gallery-import-file').setInputFiles({ name: 'cozy-loft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file.room)) });
      await expect(page.locator('#gallery .room-head h3')).toHaveCount(3);
      expect(await names()).toContain('cozy-loft');

      // Junk and foreign files are refused with a toast and no new entry.
      for (const buffer of ['{not json', JSON.stringify({ app: 'other', format: 1, room: file.room }), JSON.stringify({ app: 'little-nest', format: 1, name: 'x', room: { items: null } })]) {
        await page.locator('#gallery-import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(buffer) });
        await expect(page.locator('#toast')).toContainText('not a Little Nest room');
      }
      expect(await names()).toHaveLength(3);
      expect(await roomState(page)).toHaveLength(STARTER_ITEM_COUNT);   // live room untouched throughout
    });
  });
}
