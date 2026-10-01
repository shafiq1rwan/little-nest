// Capture the actual catalog in a browser (the two prints use CanvasTexture).
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] || 'output/blender');
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const catalog = await page.evaluate(async () => {
    const { CATALOG } = await import('/src/props.js');
    const THREE = await import('/node_modules/three/build/three.module.js');
    return Object.entries(CATALOG).map(([key, def]) => {
      const group = def.build();
      group.updateMatrixWorld(true);
      const parts = [];
      group.traverse((part) => {
        if (!part.isMesh) return;
        const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
        const m = part.material;
        const color = m.color.clone().convertLinearToSRGB();
        parts.push({
          positions: Array.from(geometry.attributes.position.array),
          indices: geometry.index ? Array.from(geometry.index.array) : null,
          color: color.toArray(), roughness: m.roughness, metalness: m.metalness,
          opacity: m.opacity, doubleSided: m.side === THREE.DoubleSide,
          emissive: m.emissive.toArray(), emissiveIntensity: m.emissiveIntensity,
          recolor: !!part.userData.recolor, canvas: !!m.map,
        });
        geometry.dispose();
      });
      const box = new THREE.Box3().setFromObject(group);
      return { key, label: def.label, collection: def.collection, layer: def.layer || 'floor',
        w: def.w, d: def.d, wall: def.wall || null, surface: def.surface || null,
        lamp: !!def.lamp, plant: def.tags?.includes('plant') || key === 'plant',
        bounds: { min: box.min.toArray(), max: box.max.toArray() }, parts };
    });
  });
  await writeFile(resolve(output, 'catalog-source.json'), JSON.stringify({ version: 1, catalog }));
  console.log(`Captured ${catalog.length} props to ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
