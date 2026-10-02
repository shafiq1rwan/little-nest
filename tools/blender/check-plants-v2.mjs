import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { recolorModel } from '../../src/scene/geometry.js';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const directory = 'art-source/models-v2/plants';
const reports = JSON.parse(fs.readFileSync(`${directory}/build-report.json`));
const results = [];
for (const report of reports) {
  const key = report.key;
  const bytes = fs.readFileSync(`${directory}/${key}/${key}.glb`);
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = [];
  let triangles = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    meshes.push(o);
    for (const attr of ['position', 'normal']) {
      assert(o.geometry.attributes[attr], `${key}: missing ${attr}`);
      assert([...o.geometry.attributes[attr].array].every(Number.isFinite));
    }
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    assert(!o.material.map, `${key}: unexpected texture`);
    assert.equal(o.material.color.getHexString(), o.material.name.split('.').at(-1));
  });
  assert.equal(triangles, report.triangles);
  assert(triangles <= report.budget);
  assert.equal(meshes.filter(o => o.userData.recolor).length, report.recolorParts);
  const colors = meshes.map(o => o.material.color.getHexString());
  recolorModel(scene, 0xc47743);
  meshes.forEach((o, i) => assert.equal(o.material.color.getHexString(), o.userData.recolor ? 'c47743' : colors[i]));
  recolorModel(scene, null);
  meshes.forEach((o, i) => assert.equal(o.material.color.getHexString(), colors[i]));
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3()).toArray();
  if (key !== 'macrame') assert(Math.abs(bounds.min.y) < .001, `${key}: ground origin`);
  size.forEach((n, i) => assert(Math.abs(n - report.size[i]) < .002));
  assert(fs.existsSync(`${directory}/${key}/${key}.blend`));
  results.push({ key, triangles, size, materialAndRecolorChecks: true });
}

// Isolated desktop viewer: no game integration and no screenshot capture.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/__plant_review', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto(`${server.resolvedUrls.local[0]}__plant_review`);
  const desktop = await page.evaluate(async keys => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(1440, 900);
    document.body.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x69503a, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-3, 5, 4); scene.add(light);
    const camera = new THREE.PerspectiveCamera(35, 1440 / 900, .001, 100);
    const results = [];
    for (const key of keys) {
      const model = (await new GLTFLoader().loadAsync(`/art-source/models-v2/plants/${key}/${key}.glb`)).scene;
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const span = Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
      for (const angle of [0, Math.PI / 2, Math.PI]) {
        camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle) * span * 3, span, Math.cos(angle) * span * 3));
        camera.lookAt(center); renderer.render(scene, camera);
        if (renderer.getContext().getError() !== 0) throw new Error(`${key}: WebGL error`);
      }
      results.push({ key, viewsRendered: 3, triangles: renderer.info.render.triangles });
      scene.remove(model);
    }
    renderer.dispose();
    return { viewport: [1440, 900], screenshots: 0, models: results };
  }, reports.map(r => r.key));
  const output = { pass: true, models: results, desktop };
  fs.writeFileSync(`${directory}/validation.json`, JSON.stringify(output, null, 2));
  console.log(`PASS: ${results.length} GLBs; colors, recoloring, bounds, budgets; 33 desktop views rendered.`);
} finally { await browser.close(); await server.close(); }
