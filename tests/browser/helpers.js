// Shared helpers for the browser checks. They talk to the game through window.__sim,
// the development hook exposed at the end of src/main.js.

/** Open the game and wait until the scene hook exists. Returns the collected page errors array. */
export async function openGame(page, path = '/', { enter = true } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await page.waitForFunction(() => !!window.__sim);
  await page.waitForFunction(() => document.body.dataset.screen === 'menu');
  await page.waitForFunction(() => document.getElementById('loading-screen').hidden);   // the fade-out has finished
  if (enter) await enterFromMenu(page);
  return errors;
}

export async function enterFromMenu(page) {
  await page.locator('#menu-start').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'game');
  await twoFrames(page);
}

/** Serializable snapshot of the committed furniture, floor items first, then surface items (the save order). */
export function roomState(page) {
  return page.evaluate(() => {
    const pick = ({ type, gx, gz, rot, color }) => ({ type, gx, gz, rot, color });
    const items = window.__sim.items;
    return [...items.filter((i) => !i.parent), ...items.filter((i) => i.parent)].map(pick);
  });
}

/** Screen coordinates of the floor centre of a footprint, for clicking or tapping a tile. */
export function tilePoint(page, type, gx, gz, rot = 0) {
  return page.evaluate(([type, gx, gz, rot]) => {
    const p = window.__sim.worldPos(type, gx, gz, rot).project(window.__sim.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  }, [type, gx, gz, rot]);
}

/** Screen coordinates of an existing item, slightly above the floor so the raycast hits its mesh. */
export function itemPoint(page, type, lift = 0.6) {
  return page.evaluate(([type, lift]) => {
    const it = window.__sim.items.find((x) => x.type === type);
    const a = it.mesh.position.clone(); a.y = lift; a.project(window.__sim.camera);
    const r = document.getElementById('scene').getBoundingClientRect();
    return { x: r.x + (a.x + 1) * r.width / 2, y: r.y + (1 - a.y) * r.height / 2 };
  }, [type, lift]);
}

export function selectedInfo(page) {
  return page.evaluate(() => {
    const s = window.__sim.selected;
    return s ? { type: s.type, gx: s.gx, gz: s.gz, rot: s.rot, color: s.color } : null;
  });
}

export function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}

export function twoFrames(page) {
  return page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** Opens the rooms dialog and loads the entry the open design belongs to. */
export async function loadCurrentRoom(page) {
  await page.locator('#load').click();
  await page.locator('#gallery .room-entry.current .primary').click();
}

/** Reads the raw gallery store. */
export function galleryStore(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('home-deco-sim:rooms') || 'null'));
}

export const STARTER_ITEM_COUNT = 22;   // 16 floor items, two on tables, two pillows on the sofa, two on walls
export const TERRACOTTA = 0xb96949;
