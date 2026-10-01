// Shared material and geometry ownership helpers for every model builder.
//
// Ownership rules:
// - sharedMaterial() returns cached materials shared by many live meshes. Never dispose them.
// - ownMaterial() gives one mesh a material it exclusively owns (a clone or a recolor). It is
//   recorded in userData.ownedMaterial and disposed with the model.
// - Temporary tint materials are recorded in userData.tintMaterial and disposed with the model.
// - disposeModel() releases geometry and the two owned material kinds above, nothing else.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();

/** A cached MeshStandardMaterial shared across meshes. Do not mutate or dispose it. */
export function sharedMaterial(color, roughness = 0.85) {
  const key = color + ':' + roughness;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return cache.get(key);
}

/** Assigns a material this mesh owns exclusively, disposing any previous owned one. */
export function ownMaterial(mesh, material) {
  if (mesh.userData.ownedMaterial && mesh.userData.ownedMaterial !== material) mesh.userData.ownedMaterial.dispose();
  mesh.material = material;
  mesh.userData.ownedMaterial = material;
  if (mesh.userData.base) mesh.userData.base = material;
  return material;
}

/**
 * Recolors every mesh flagged userData.recolor by giving it an owned clone of its material.
 * A null color restores the original shared material (used when a recolor is undone).
 */
export function recolorModel(group, color) {
  group.traverse((o) => {
    if (!o.isMesh || !o.userData.recolor) return;
    if (!o.userData.original) o.userData.original = o.userData.base || o.material;
    if (color == null) {
      if (o.userData.ownedMaterial) o.userData.ownedMaterial.dispose();
      o.userData.ownedMaterial = null;
      o.material = o.userData.original;
      if (o.userData.base) o.userData.base = o.userData.original;
      return;
    }
    const next = o.userData.original.clone();
    next.color.setHex(color);
    ownMaterial(o, next);
  });
}

/** Swaps every mesh to a translucent tint, or back to its base material when color is null. */
export function tintModel(group, color) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.base) o.userData.base = o.material;
    if (color) {
      if (!o.userData.tintMaterial) o.userData.tintMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55 });
      o.userData.tintMaterial.color.setHex(color);
      o.material = o.userData.tintMaterial;
    } else {
      o.material = o.userData.base;
    }
  });
}

/** Releases geometry and owned materials. Shared cached materials are left alone. */
export function disposeModel(model) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (o.userData.tintMaterial) o.userData.tintMaterial.dispose();
    if (o.userData.ownedMaterial) o.userData.ownedMaterial.dispose();
  });
}

/**
 * Merges a model's static meshes into one mesh per shared material, cutting draw calls several-fold.
 * Parts that must stay separate keep their own mesh: recolorable parts, parts with owned materials
 * (glows, art), and anything that is not a plain mesh (lights). Nested group transforms are baked in.
 * Call on a freshly built model before placing it.
 */
export function compactModel(group) {
  group.updateMatrixWorld(true);
  // Bake each part relative to the root, so a scaled or rotated root (plants scale their group) is not applied twice.
  const rootInverse = group.matrixWorld.clone().invert();
  const relative = new THREE.Matrix4();
  const buckets = new Map();   // material + attribute signature -> { material, geometries, meshes }
  group.traverse((o) => {
    if (!o.isMesh || o === group) return;
    if (o.userData.recolor || o.userData.ownedMaterial || o.material.transparent || Array.isArray(o.material)) return;
    const signature = Object.keys(o.geometry.attributes).sort().join(',');
    const key = o.material.uuid + '|' + signature;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, geometries: [], meshes: [] });
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geometry.applyMatrix4(relative.multiplyMatrices(rootInverse, o.matrixWorld));
    buckets.get(key).geometries.push(geometry);
    buckets.get(key).meshes.push(o);
  });
  for (const { material, geometries, meshes } of buckets.values()) {
    if (meshes.length < 2) { geometries.forEach((g) => g.dispose()); continue; }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/** Axis-aligned size of a model in world units. */
export function measureModel(model) {
  const s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return { w: s.x, d: s.z, h: s.y };
}
