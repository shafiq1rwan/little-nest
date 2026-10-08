// The garden island the house sits on: a grass plot with soil edges, trees, bushes, flower beds, a stone path
// and a picket fence, built from Kenney Nature Kit models (CC0, www.kenney.nl) in public/models/garden. Where
// things go is decided by src/game/garden.js; this module loads the models, recolours them from Kenney's mint
// palette to the game's warm one (PALETTE, by material name), merges everything low into a few meshes, and
// keeps trees separate so they can step aside. The lawn fills most of the screen, so the garden uses cheap
// Lambert materials, and only trees cast shadows: syncView() hides a tree while it stands between the camera
// and the room, the way the outer walls drop to stubs.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODELS_VERSION } from '../config/game.js';
import { compactModel } from './geometry.js';

const PALETTE = {
  grass: 0x7b9f52, leafsGreen: 0x86a95b, leafsDark: 0x5f8f5a,
  woodBark: 0x8a5b3d, woodBarkDark: 0x6f4a36, woodInner: 0xe2bf8f,
  dirt: 0xb9ad9b, dirtDark: 0x9a8f80,   // only the rocks use these: grey stone, not soil stone: 0xe2d8c8, stoneDark: 0xc2b5a2,
  wood: 0xf1e2c8, woodDark: 0xd9c3a2,
  colorRed: 0xe0796b, colorYellow: 0xf4cd5e, colorPurple: 0xb8a0dc, colorTan: 0xe8c69b, _defaultMat: 0xf4ecdc,
};
const LAWN = 0x9cb86a;
const ISLAND_TOP = -0.33;     // just under the room's plinth
const ISLAND_DEPTH = 0.7;

const materials = new Map();   // material name -> shared MeshStandardMaterial
function paletteMaterial(name) {
  if (!materials.has(name)) materials.set(name, new THREE.MeshLambertMaterial({ color: PALETTE[name] ?? 0xd9c9b0 }));
  return materials.get(name);
}
const templates = new Map();   // key -> Group centred on x and z, standing on y = 0
let loading = null;

/** Loads the garden models. Resolves true when ready; a model that fails is left out of the garden. */
export function loadGarden(keys) {
  loading ??= Promise.all(keys.map((key) => new GLTFLoader().loadAsync('models/garden/' + key + '.glb?v=' + MODELS_VERSION).then((gltf) => {
    gltf.scene.traverse((o) => { if (o.isMesh) { o.material = paletteMaterial(o.material.name); o.castShadow = o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(gltf.scene), centre = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    gltf.scene.position.set(-centre.x, -box.min.y, -centre.z);
    holder.add(gltf.scene);
    holder.userData.height = box.max.y - box.min.y;
    templates.set(key, holder);
  }).catch((error) => console.warn('Little Nest: garden model ' + key + ' did not load.', error)))).then(() => true);
  return loading;
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const v = 226 + Math.floor(rnd() * 30);
    g.fillStyle = 'rgb(' + v + ',' + (v + 6) + ',' + (v - 14) + ')';
    g.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 9, 2 + rnd() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Builds the garden for a plan from planGarden(). Returns { root, trees, syncView, dispose }. */
export function createGarden(scene, plan) {
  const root = new THREE.Group(); root.name = 'garden';
  scene.add(root);
  const owned = [];   // geometries, materials and textures this garden made
  // The island: grass on top, soil on the four sides.
  const tex = grassTexture(); tex.repeat.set(plan.half.x / 2, plan.half.z / 2);
  const top = new THREE.MeshLambertMaterial({ color: LAWN, map: tex });
  const soil = new THREE.MeshLambertMaterial({ color: 0x9b6b48 });
  const islandGeometry = new THREE.BoxGeometry(plan.half.x * 2, ISLAND_DEPTH, plan.half.z * 2);
  owned.push(tex, top, soil, islandGeometry);
  const island = new THREE.Mesh(islandGeometry, [soil, soil, top, soil, soil, soil]);
  island.position.y = ISLAND_TOP - ISLAND_DEPTH / 2; island.receiveShadow = true; island.name = 'island';
  root.add(island);

  // Low things are merged into a few meshes; trees stay separate so they can hide.
  const low = new THREE.Group();
  const trees = [];
  for (const p of plan.props) {
    const template = templates.get(p.key);
    if (!template) continue;
    const prop = template.clone(true);
    prop.position.set(p.x, ISLAND_TOP, p.z); prop.rotation.y = p.rot; prop.scale.setScalar(p.scale);
    if (p.tall) { prop.userData.garden = { x: p.x, z: p.z, height: template.userData.height * p.scale, radius: 0.35 * p.scale }; trees.push(prop); root.add(prop); }
    else {
      prop.traverse((o) => { if (o.isMesh) o.geometry = o.geometry.clone(); });   // merged copies; the template keeps its own
      low.add(prop);
    }
  }
  compactModel(low);
  low.traverse((o) => { if (o.isMesh && o !== low) { owned.push(o.geometry); o.castShadow = false; } });   // flowers, tufts and posts: too small to need one
  root.add(low);

  const hw = plan.room.x, hd = plan.room.z;
  return {
    root, trees,
    /**
     * Hides the trees that would be drawn over the room. `dir` is the view offset (camera - target). Seen from
     * the camera, a tree covers the ground behind it out to its height over the tangent of the view's elevation,
     * as wide as its crown: when that strip reaches the room (and its plinth), the tree steps aside.
     */
    syncView(dir) {
      const flat = Math.hypot(dir.x, dir.z) || 1e-6;
      const vx = dir.x / flat, vz = dir.z / flat, slope = Math.max(dir.y / flat, 0.05);
      let hidden = 0;
      for (const t of trees) {
        const { x, z, height, radius } = t.userData.garden;
        const reach = height / slope, rx = hw + 0.3 + radius, rz = hd + 0.3 + radius;
        let block = false;
        for (let s = 0; s <= reach && !block; s += 0.4) block = Math.abs(x - vx * s) < rx && Math.abs(z - vz * s) < rz;
        t.visible = !block;
        if (block) hidden++;
      }
      return hidden;
    },
    dispose() {
      root.removeFromParent();
      for (const o of owned) o.dispose();
    },
  };
}
