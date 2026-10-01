// Loads game-ready glTF props (public/models/<key>.glb, made by tools/blender/clean-generated.py)
// and hands out instances that follow the same ownership rules as the procedural builders:
// every mesh gets a sharedMaterial() for its flat colour, and meshes the file marks with the
// `recolor` extra keep userData.recolor so recolorModel() can give them an owned clone.
//
// Loading is asynchronous, so preloadModels() runs during the loading screen; catalog build()
// functions stay synchronous by calling modelInstance() and falling back to procedural geometry
// when a file did not load (offline, missing, or corrupt).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sharedMaterial } from './geometry.js';
import { MODELS_VERSION } from '../config/game.js';

const templates = new Map();   // catalog key -> prepared THREE.Group template (never added to a scene)

/** Loads every catalog entry that names a `model` file. Failures are logged and skipped. */
export async function preloadModels(catalog, { onProgress = () => {} } = {}) {
  const loader = new GLTFLoader();
  const entries = Object.entries(catalog).filter(([, def]) => def.model);
  let done = 0;
  await Promise.all(entries.map(async ([key, def]) => {
    try {
      const gltf = await loader.loadAsync(def.model + '?v=' + MODELS_VERSION);
      templates.set(key, prepare(gltf.scene));
    } catch (error) {
      console.warn('Little Nest: model for ' + key + ' did not load, using the built-in shape.', error);
    }
    onProgress(++done, entries.length);
  }));
  return [...templates.keys()];
}

/** Replaces file materials with shared flat ones and strips anything that is not a mesh. */
function prepare(scene) {
  const group = new THREE.Group();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const color = o.material.color.getHex();
    const mesh = new THREE.Mesh(o.geometry, sharedMaterial(color, o.material.roughness ?? 0.85));
    mesh.applyMatrix4(o.matrixWorld);
    mesh.castShadow = mesh.receiveShadow = true;
    if (o.userData.recolor) mesh.userData.recolor = true;
    mesh.name = o.name;
    group.add(mesh);
  });
  return group;
}

export function hasModel(key) { return templates.has(key); }
export function loadedModelKeys() { return [...templates.keys()]; }

/** A fresh instance sharing geometry with the template, or null when no file loaded for the key. */
export function modelInstance(key) {
  const template = templates.get(key);
  if (!template) return null;
  const group = new THREE.Group();
  for (const part of template.children) {
    const mesh = new THREE.Mesh(part.geometry.clone(), part.material);
    mesh.position.copy(part.position); mesh.quaternion.copy(part.quaternion); mesh.scale.copy(part.scale);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.recolor = !!part.userData.recolor;
    mesh.name = part.name;
    group.add(mesh);
  }
  return group;
}
