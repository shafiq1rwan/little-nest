// Re-import Blender GLBs with the game's Three.js version; validate actual artifacts.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = resolve(process.argv[2] || 'output/blender');
const report = JSON.parse(await readFile(resolve(output, 'build-report.json'), 'utf8'));
const catalog = JSON.parse(await readFile(resolve(output, 'catalog-source.json'), 'utf8')).catalog;
const loader = new GLTFLoader();
const checks = [];
for (const source of report) {
  const buffer = await readFile(resolve(output, 'glb', `${source.key}.glb`));
  const gltf = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  let triangles = 0, recolorParts = 0, textures = 0;
  gltf.scene.traverse((part) => {
    if (!part.isMesh) return;
    triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
    if (part.userData.recolor) recolorParts++;
    if (part.material.map) textures++;
  });
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const difference = Math.max(...bounds.min.toArray().map((v, i) => Math.abs(v - source.bounds.min[i])),
    ...bounds.max.toArray().map((v, i) => Math.abs(v - source.bounds.max[i])));
  const def = catalog.find(p => p.key === source.key);
  let contract;
  gltf.scene.traverse(part => { if (part.userData.catalogKey === source.key) contract = JSON.parse(part.userData.contract); });
  const stableContract = !!contract && ['key','layer','w','d','wall','surface','lamp'].every(k => JSON.stringify(contract[k]) === JSON.stringify(def[k]));
  const envelope = Math.max(0, ...bounds.min.toArray().map((v,i) => def.bounds.min[i]-v),
    ...bounds.max.toArray().map((v,i) => v-def.bounds.max[i]));
  const check = { key: source.key, triangles, recolorParts, boundsDifference: difference, textures, stableContract, envelopeExpansion: envelope,
    pass: triangles > 0 && triangles <= source.budget && recolorParts === source.recolorParts && textures === 0 && difference < 0.06 && stableContract && envelope < 0.06 };
  checks.push(check);
}
await writeFile(resolve(output, 'validation.json'), JSON.stringify(checks, null, 2));
console.log(`${checks.filter(c => c.pass).length}/${checks.length} GLBs pass re-import, triangles, recolor, texture, and bounds checks.`);
for (const check of checks.filter(c => !c.pass)) console.log(check);
if (checks.some(c => !c.pass)) process.exitCode = 1;
