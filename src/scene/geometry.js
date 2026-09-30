// Shared material and geometry ownership helpers for every model builder.
//
// Ownership rules:
// - sharedMaterial() returns cached materials shared by many live meshes. Never dispose them.
// - ownMaterial() gives one mesh a material it exclusively owns (a clone or a recolor). It is
//   recorded in userData.ownedMaterial and disposed with the model.
// - Temporary tint materials are recorded in userData.tintMaterial and disposed with the model.
// - disposeModel() releases geometry and the two owned material kinds above, nothing else.

import * as THREE from 'three';

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

/** Recolors every mesh flagged userData.recolor by giving it an owned clone of its material. */
export function recolorModel(group, color) {
  group.traverse((o) => {
    if (!o.isMesh || !o.userData.recolor) return;
    const next = (o.userData.base || o.material).clone();
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

/** Axis-aligned size of a model in world units. */
export function measureModel(model) {
  const s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  return { w: s.x, d: s.z, h: s.y };
}
