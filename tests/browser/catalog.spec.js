import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 } });

test('every catalog model builds, has a rendered thumbnail, and fits its footprint', async ({ page }) => {
  const errors = await openGame(page);
  const report = await page.evaluate(() => {
    const s = window.__sim;
    return s.catalogTypes.map((type) => {
      const def = s.placement.wallSize(type) ? 'wall' : s.placement.isSurfaceItem(type) ? 'surface' : 'floor';
      const size = s.measureType(type);
      const card = document.querySelector('.catalog-card[data-type="' + type + '"] img');
      const wall = s.placement.wallSize(type);
      const footprint = def === 'floor' ? s.placement.footprint(type, 0) : null;
      const tags = s.catalogTags(type);
      return { type, kind: def, size, thumb: !!card && card.complete && card.naturalWidth > 0, footprint, wall, foliage: tags.includes('plant') || type === 'plant', rug: def === 'floor' && !s.placement.occupies(type) };
    });
  });
  expect(report.length).toBeGreaterThanOrEqual(36);
  const problems = [];
  const check = (ok, message) => { if (!ok) problems.push(message); };
  const f = (n) => n.toFixed(2);
  for (const r of report) {
    check(r.thumb, r.type + ': no thumbnail');
    check(r.rug || r.size.h > 0.05, r.type + ': flat model');
    if (r.kind === 'floor') {
      // Foliage may spread past its tile above knee height; rug tassels overhang a little; everything else stays within a small margin.
      const slack = r.foliage ? 0.8 : r.rug ? 0.15 : 0.05;
      check(r.size.w <= r.footprint.w + slack, r.type + ': width ' + f(r.size.w) + ' for a ' + r.footprint.w + '-tile footprint');
      check(r.size.d <= r.footprint.d + slack, r.type + ': depth ' + f(r.size.d) + ' for a ' + r.footprint.d + '-tile footprint');
      check(r.size.h <= 2.6, r.type + ': height ' + f(r.size.h));
    } else if (r.kind === 'surface') {
      check(Math.max(r.size.w, r.size.d) <= 0.36, r.type + ': tabletop footprint ' + f(Math.max(r.size.w, r.size.d)));
      check(r.size.h <= 0.4, r.type + ': tabletop height ' + f(r.size.h));
    } else {
      check(r.size.w <= r.wall.w + 0.05, r.type + ': wall width ' + f(r.size.w) + ' for ' + r.wall.w + ' columns');
      check(r.size.h <= r.wall.h * 0.5 + 0.05, r.type + ': wall height ' + f(r.size.h) + ' for ' + r.wall.h + ' rows');
      check(r.size.d <= 0.6, r.type + ': wall depth ' + f(r.size.d));   // hanging pots and shelves stand off the wall
    }
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
});

test('glb props load, replace their procedural shape, and keep the recolour part separate', async ({ page }) => {
  const errors = await openGame(page);
  const info = await page.evaluate(() => {
    const sofa = window.__sim.items.find((i) => i.type === 'sofa');
    const parts = [];
    sofa.mesh.traverse((o) => { if (o.isMesh) parts.push({ name: o.name, recolor: !!o.userData.recolor, color: o.material.color.getHex() }); });
    return { keys: window.__sim.modelKeys, parts, size: window.__sim.measure(sofa.mesh) };
  });
  expect(info.keys).toContain('sofa');
  expect(info.parts.filter((p) => p.recolor)).toHaveLength(9);
  expect(info.parts.filter((p) => p.recolor).every((p) => p.color === 0xf3e4d2)).toBe(true);
  expect(info.parts.filter((p) => !p.recolor).map((p) => p.color).sort()).toEqual([0xb87946, 0xbf895c, 0x81936a].sort());
  expect(info.size.w).toBeGreaterThan(2.7);
  expect(info.size.h).toBeGreaterThan(0.8);
  expect(errors).toEqual([]);
});
