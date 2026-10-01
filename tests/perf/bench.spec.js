// Opt-in benchmark. Prints startup, thumbnail, per-frame draw and triangle counts, and frame time
// for the starter room and a stress room. Numbers from headless software WebGL are only useful
// relative to each other; run twice and compare before and after a change.
//   PERF=1 npx playwright test --project perf

import { test, expect } from '@playwright/test';
import { enterFromMenu } from '../browser/helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

async function measure(page, label, frames = 90) {
  const r = await page.evaluate(async (frames) => {
    const s = window.__sim;
    const times = [];
    let last = performance.now();
    const rendersBefore = s.perf.renders;
    await new Promise((resolve) => {
      let n = 0;
      const tick = () => {
        const now = performance.now();
        times.push(now - last);
        last = now;
        if (++n >= frames) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    s.controls.target.x += 0.001; s.controls.update();   // force one render so the draw counts below are current
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const info = s.renderer.info;
    s.perf.rendersPerFrame = +((s.perf.renders - rendersBefore) / frames).toFixed(2);
    let lights = 0;
    s.scene.traverse((o) => { if (o.isPointLight) lights++; });
    return {
      items: s.items.length, lights,
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs.length,
      frameMedianMs: +times[Math.floor(times.length / 2)].toFixed(2), frameP90Ms: +times[Math.floor(times.length * 0.9)].toFixed(2),
      rendersPerFrame: s.perf.rendersPerFrame ?? null,
    };
  }, frames);
  console.log(label, JSON.stringify(r));
  return r;
}

test('startup and frame cost for the starter room and a stress room', async ({ page }) => {
  const t0 = Date.now();
  await page.goto('/');
  await page.waitForFunction(() => !!window.__sim);
  await enterFromMenu(page);
  const startup = await page.evaluate(() => ({ readyMs: +window.__sim.perf.readyMs.toFixed(0), thumbnailsMs: +window.__sim.perf.thumbnailsMs.toFixed(0), thumbnailsCached: window.__sim.perf.thumbnailsCached ?? null }));
  console.log('startup', JSON.stringify({ ...startup, wallMs: Date.now() - t0 }));

  const idle = await measure(page, 'starter room, idle');
  // Orbit a little so the camera is moving during the sample.
  const moving = await page.evaluate(async () => {
    const s = window.__sim;
    const times = [];
    let last = performance.now();
    await new Promise((resolve) => {
      let n = 0;
      const tick = () => {
        s.controls.target.x += (n % 2 ? 0.01 : -0.01);
        s.controls.update();
        const now = performance.now(); times.push(now - last); last = now;
        if (++n >= 60) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    return { frameMedianMs: +times[30].toFixed(2) };
  });
  console.log('starter room, orbiting', JSON.stringify(moving));

  // Stress: fill the living room with furniture, small items, wall items, and several lamps.
  await page.evaluate(() => {
    const s = window.__sim;
    s.commands.clear();
    const floor = ['armchair', 'plant', 'floorLamp', 'pouf', 'basket', 'fern', 'paperLamp', 'chair'];
    let i = 0;
    for (let gx = 0; gx < 8; gx++) for (let gz = 0; gz < 8; gz++) {
      if ((gx + gz) % 3 === 0) continue;
      s.commands.add({ type: floor[i++ % floor.length], gx, gz, rot: i % 4 });
    }
    for (let col = 0; col < 8; col++) { s.commands.add({ type: 'clock', wall: 'back', col, row: 7 }); s.commands.add({ type: 'clock', wall: 'left', col, row: 7 }); }
    const tables = [];
    for (let gx = 0; gx < 8; gx++) for (let gz = 0; gz < 8; gz++) if ((gx + gz) % 3 === 0 && gx < 7) { const t = s.commands.add({ type: 'sideTable', gx, gz, rot: 0 }); if (t) tables.push(t); }
    for (const t of tables) s.commands.add({ type: 'lantern', parent: t.id, slot: 0, rot: 0 });
    s.setSelected(null);
  });
  const stress = await measure(page, 'stress room, idle');
  expect(stress.items).toBeGreaterThan(60);
  expect(idle.calls).toBeGreaterThan(0);

  // Second visit in the same browser profile: thumbnails come from the cache.
  await page.reload();
  await page.waitForFunction(() => !!window.__sim);
  const second = await page.evaluate(() => ({ readyMs: +window.__sim.perf.readyMs.toFixed(0), thumbnailsMs: +window.__sim.perf.thumbnailsMs.toFixed(0), thumbnailsCached: window.__sim.perf.thumbnailsCached }));
  console.log('startup, second visit', JSON.stringify(second));
  expect(second.thumbnailsCached).toBe(true);
  expect(second.thumbnailsMs).toBeLessThan(startup.thumbnailsMs / 4);
});
