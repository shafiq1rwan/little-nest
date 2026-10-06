// Ambient idle motion: lamps breathe, candles and lanterns flicker, string lights twinkle in the
// evening, and plants sway a little. One clock drives everything at a capped rate so the on-demand
// renderer only draws extra frames while something animated is in the room.
//
// Lamps: applyLamp() in main.js stores the mood- and switch-dependent value on each light and glow
// material as userData.lampValue; motion multiplies that value, so turning motion off (or a lamp
// off) always lands on the exact authoritative value. Plants: foliage parts (everything except the
// recolourable pot) rotate around the item's base; their resting matrix is kept and restored.

import * as THREE from 'three';

const swayAxis = new THREE.Vector3();
const swayQuat = new THREE.Quaternion();
const swayMatrix = new THREE.Matrix4();

export function createMotion({ fps = 24, amplitude = THREE.MathUtils.degToRad(1.4) } = {}) {
  let enabled = true;
  let last = 0;
  const plants = new Map();   // id -> { parts: [{ mesh, base: Matrix4 }], phase }
  const lamps = new Map();    // id -> { targets: [{ o, key }], phase, flicker, isLit }
  let bulbs = [];             // [{ material, base, phase }]
  let twinkle = false;

  function hash(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0) % 1000 / 1000 * Math.PI * 2; }

  /** Registers an item's mesh. kind: 'plant', 'lamp', 'flame' (flickering lamp), or null to ignore. */
  function track(id, mesh, kind, { isLit = () => true } = {}) {
    forget(id);
    if (kind === 'plant') {
      const parts = [];
      for (const child of mesh.children) {
        if (!child.isMesh || child.userData.recolor) continue;   // the pot stays put
        child.updateMatrix();
        parts.push({ mesh: child, base: child.matrix.clone() });
        child.matrixAutoUpdate = false;
      }
      if (parts.length) plants.set(id, { parts, phase: hash(id) });
    } else if (kind === 'lamp' || kind === 'flame') {
      const targets = [];
      mesh.traverse((o) => {
        if (o.isPointLight) targets.push({ o, key: 'intensity' });
        else if (o.isMesh && o.material?.emissive && o.userData.ownedMaterial === o.material) targets.push({ o: o.material, key: 'emissiveIntensity', owner: o });
      });
      if (targets.length) lamps.set(id, { targets, phase: hash(id), flicker: kind === 'flame', isLit });
    }
  }
  function forget(id) {
    const p = plants.get(id);
    if (p) for (const { mesh, base } of p.parts) { mesh.matrix.copy(base); mesh.matrixAutoUpdate = true; mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); }
    plants.delete(id);
    lamps.delete(id);
  }
  function clear() { for (const id of [...plants.keys(), ...lamps.keys()]) forget(id); }
  /** String-light bulbs of the current shell; each needs its own material. */
  function setBulbs(materials) {
    bulbs = materials.map((material, i) => ({ material, base: material.emissiveIntensity, phase: i * 1.7 }));
  }
  function setTwinkle(on) { twinkle = on; if (!on) for (const b of bulbs) b.material.emissiveIntensity = b.base; }

  function lampValue(target) {
    const holder = target.owner ?? target.o;
    return holder.userData.lampValue?.[target.key] ?? target.o[target.key];
  }
  /** Puts everything back at rest: lamps at their exact values, plants at their resting matrices. */
  function rest() {
    for (const p of plants.values()) for (const { mesh, base } of p.parts) mesh.matrix.copy(base);
    for (const l of lamps.values()) for (const t of l.targets) t.o[t.key] = lampValue(t);
    for (const b of bulbs) b.material.emissiveIntensity = b.base;
  }
  function active() {
    return enabled && (plants.size > 0 || [...lamps.values()].some((l) => l.isLit()) || (twinkle && bulbs.length > 0));
  }
  /** Advances the clock. Returns true when something changed and a frame should be drawn. */
  function step(now) {
    if (!active()) return false;
    if (now >= last && now - last < 1000 / fps) return false;   // a clock that jumped backwards just restarts
    last = now;
    const t = now / 1000;
    for (const { parts, phase } of plants.values()) {
      const a = amplitude * Math.sin(t * 0.9 + phase), b = amplitude * 0.6 * Math.sin(t * 1.3 + phase * 1.7);
      swayAxis.set(b, 0, a);
      const angle = swayAxis.length();
      if (angle > 0) swayQuat.setFromAxisAngle(swayAxis.normalize(), angle); else swayQuat.identity();
      swayMatrix.makeRotationFromQuaternion(swayQuat);
      for (const { mesh, base } of parts) mesh.matrix.multiplyMatrices(swayMatrix, base);
    }
    for (const l of lamps.values()) {
      if (!l.isLit()) { for (const tg of l.targets) tg.o[tg.key] = lampValue(tg); continue; }
      const f = l.flicker
        ? 1 + 0.07 * Math.sin(t * 9.1 + l.phase) + 0.05 * Math.sin(t * 14.3 + l.phase * 2.3)
        : 1 + 0.035 * Math.sin(t * 1.1 + l.phase);
      for (const tg of l.targets) tg.o[tg.key] = lampValue(tg) * f;
    }
    if (twinkle) for (const b of bulbs) b.material.emissiveIntensity = b.base * (0.8 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2 + b.phase)));
    return true;
  }
  function setEnabled(on) { enabled = !!on; if (!enabled) rest(); }
  return { track, forget, clear, setBulbs, setTwinkle, step, rest, active, setEnabled, isEnabled: () => enabled, counts: () => ({ plants: plants.size, lamps: lamps.size, bulbs: bulbs.length }) };
}
