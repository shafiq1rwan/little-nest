// Shared helpers for the browser checks. They talk to the game through window.__sim,
// the development hook exposed at the end of src/main.js.

/** Open the game and wait until the scene hook exists. Returns the collected page errors array. */
export async function openGame(page, path = '/') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await page.waitForFunction(() => !!window.__sim);
  return errors;
}

/** Serializable snapshot of the committed furniture. */
export function roomState(page) {
  return page.evaluate(() => window.__sim.items.map(({ type, gx, gz, rot, color }) => ({ type, gx, gz, rot, color })));
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

export const STARTER_ITEM_COUNT = 16;
export const TERRACOTTA = 0xb96949;
