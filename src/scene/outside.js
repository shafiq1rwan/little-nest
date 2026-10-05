// The world around the room: a rounded island base under the floor (a lawn over a slice of soil,
// or a stone ledge for the balcony), a small seeded garden, and ambient particles (leaves drifting
// down by day, fireflies at night). Tall things stand only behind the two walls; the open front
// sides stay low so they never block the camera or the pointer. Static parts are merged per colour.
// Nothing here is pickable: item raycasts only look at furniture meshes.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLORS = {
  lawn: 0xa3b37c, lawnEdge: 0x8fa36b, soil: 0x9a6f4f, rock: 0x7d6555,
  stone: 0xd8cdbf, stoneSide: 0xb3a596, stoneBase: 0x948778,
  trunk: 0x7a5a3e, leafA: 0x6f8f55, leafB: 0x89a564, leafC: 0x5d7a48,
  path: 0xe2d6c3, fence: 0xf0e2c8, pot: 0xc27a52,
  flowerA: 0xe7a3a3, flowerB: 0xf0cf74, flowerC: 0xf6efe2,
};
const FIREFLY = 0xfff1a8;

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/** Soft radial vignette for the ground plane: white in the middle, darker at the edges. The mood colour multiplies it. */
export function vignetteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  // The plane is 200 units wide, so 1 px is about 0.4 units: light pools within ~8 units, darkening by ~30.
  const grad = g.createRadialGradient(256, 256, 14, 256, 256, 80);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.45, '#ece5e0'); grad.addColorStop(1, '#bfb1a9');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Builds the surroundings under `parent`. style: 'garden' or 'ledge'. Returns
 * { group, trees: [Group], ticker: { step(t, dt), rest() }, setMood(key), dispose() }.
 */
export function createOutside(parent, { width, depth, style = 'garden', seed = 7 }) {
  const group = new THREE.Group(); group.name = 'outside'; parent.add(group);
  const rng = seeded(seed + width * 31 + depth * 17);
  const halfW = width / 2, halfD = depth / 2;
  const ring = style === 'ledge' ? 0.6 : 1.15;
  const materials = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...opts }));
    return materials.get(key);
  };
  const pieces = new Map();   // colour -> [geometry already moved into place]
  function add(geometry, color, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(m);
    if (!pieces.has(color)) pieces.set(color, []);
    pieces.get(color).push(g);
    geometry.dispose();
  }

  // ---- the island: three stacked rounded slabs read as a cut slice of ground ----
  const W = width + ring * 2, D = depth + ring * 2;
  const top = style === 'ledge' ? COLORS.stone : COLORS.lawn;
  const side = style === 'ledge' ? COLORS.stoneSide : COLORS.soil;
  const base = style === 'ledge' ? COLORS.stoneBase : COLORS.rock;
  add(new RoundedBoxGeometry(W, 0.14, D, 3, 0.07), top, 0, -0.23, 0);
  add(new RoundedBoxGeometry(W - 0.08, 0.42, D - 0.08, 3, 0.12), side, 0, -0.5, 0);
  add(new RoundedBoxGeometry(W - 0.3, 0.16, D - 0.3, 3, 0.07), base, 0, -0.77, 0);

  const trees = [];
  const low = [];   // positions taken by low dressing, to keep things apart
  const outsideRoom = (x, z) => x > halfW + 0.15 || z > halfD + 0.15 || x < -halfW - 0.25 || z < -halfD - 0.25;
  const near = (x, z, r) => low.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);

  function shrub(x, z, size, colors = [COLORS.leafA, COLORS.leafB]) {
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2, r = size * 0.35 * rng();
      add(new THREE.IcosahedronGeometry(size * (0.55 + rng() * 0.3), 0), colors[i % colors.length], x + Math.cos(a) * r, -0.16 + size * 0.45, z + Math.sin(a) * r, rng(), rng(), rng());
    }
    low.push({ x, z });
  }
  function flowers(x, z) {
    add(new THREE.IcosahedronGeometry(0.11, 0), COLORS.leafC, x, -0.12, z);
    const c = [COLORS.flowerA, COLORS.flowerB, COLORS.flowerC][Math.floor(rng() * 3)];
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + rng(); add(new THREE.IcosahedronGeometry(0.035, 0), c, x + Math.cos(a) * 0.08, -0.03 + rng() * 0.05, z + Math.sin(a) * 0.08); }
    low.push({ x, z });
  }
  /** A tree behind a wall. `behind` names the wall planes the canopy must stay outside: { left, back }. */
  function tree(x, z, height, behind = { left: false, back: false }) {
    const t = new THREE.Group(); t.position.set(x, -0.16, z); group.add(t);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, height * 0.55, 6), mat(COLORS.trunk));
    trunk.position.y = height * 0.275; trunk.castShadow = true; t.add(trunk);
    const canopy = [];
    for (let i = 0; i < 4; i++) {
      const r = height * (0.17 + rng() * 0.06);
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate((rng() - 0.5) * height * 0.22, height * (0.62 + i * 0.09), (rng() - 0.5) * height * 0.22);
      canopy.push(g);
    }
    const merged = mergeGeometries(canopy.map((g) => g.toNonIndexed()));
    canopy.forEach((g) => g.dispose());
    // Keep the canopy behind the wall's outer face so it never pokes into the room; it may overhang the island instead.
    merged.computeBoundingBox();
    const bb = merged.boundingBox, margin = 0.08;
    const dx = behind.left ? Math.min(0, (-halfW - 0.2 - margin) - (x + bb.max.x)) : 0;
    const dz = behind.back ? Math.min(0, (-halfD - 0.2 - margin) - (z + bb.max.z)) : 0;
    merged.translate(dx, 0, dz);
    const leaves = new THREE.Mesh(merged, mat(rng() < 0.5 ? COLORS.leafA : COLORS.leafC));
    leaves.castShadow = true; t.add(leaves);
    trees.push(t);
  }

  if (style === 'garden') {
    // Behind the walls: trees whose tops peek over, and fuller shrubs.
    tree(-halfW - ring * 0.55, -halfD - ring * 0.55, 4.6, { left: true, back: true });
    tree(halfW - 1.2, -halfD - ring * 0.6, 4.4, { back: true });
    tree(-halfW - ring * 0.6, halfD - 1.6, 4.0, { left: true });
    shrub(halfW + ring * 0.45, -halfD - ring * 0.45, 0.45);
    shrub(-halfW - ring * 0.5, halfD + ring * 0.5, 0.38, [COLORS.leafB, COLORS.leafC]);
    // The open sides stay low: a stepping-stone path, a short picket fence, flowers and tufts.
    for (let i = 0; i < 5; i++) {
      const px = halfW + 0.65, pz = halfD - 0.6 - i * 0.75;
      add(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 7), COLORS.path, px + (i % 2 ? 0.12 : -0.08), -0.15, pz, 0, rng(), 0);
      low.push({ x: px, z: pz });
    }
    const fenceZ = halfD + ring * 0.62;
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.06, 0.34, 0.04), COLORS.fence, -halfW + 0.6 + i * 0.32, 0.01, fenceZ);
    add(new THREE.BoxGeometry(1.75, 0.04, 0.03), COLORS.fence, -halfW + 0.6 + 0.8, 0.08, fenceZ);
    for (let i = 0; i < 14; i++) {
      const front = rng() < 0.5;
      const x = front ? -halfW + rng() * width : halfW + 0.3 + rng() * (ring - 0.45);
      const z = front ? halfD + 0.3 + rng() * (ring - 0.45) : -halfD + rng() * depth;
      if (!outsideRoom(x, z) || near(x, z, 0.4)) continue;
      flowers(x, z);
    }
    for (let i = 0; i < 18; i++) {
      const x = -halfW - ring + rng() * (W), z = -halfD - ring + rng() * D;
      if (!outsideRoom(x, z) || near(x, z, 0.25) || Math.abs(x) > W / 2 - 0.15 || Math.abs(z) > D / 2 - 0.15) continue;
      add(new THREE.ConeGeometry(0.05, 0.14, 4), COLORS.lawnEdge, x, -0.09, z, 0, rng(), 0);
    }
  } else {
    // Balcony ledge: terracotta planters with shrubs at the open corners.
    for (const [x, z] of [[halfW + 0.3, halfD + 0.3], [halfW + 0.3, -halfD + 0.4], [-halfW + 0.5, halfD + 0.3]]) {
      add(new THREE.CylinderGeometry(0.18, 0.14, 0.26, 8), COLORS.pot, x, -0.03, z);
      shrub(x, z + 0.0, 0.26);
    }
  }

  for (const [color, list] of pieces) {
    const mesh = new THREE.Mesh(mergeGeometries(list), mat(color));
    list.forEach((g) => g.dispose());
    mesh.receiveShadow = true; mesh.castShadow = color !== COLORS.lawn && color !== COLORS.stone;
    group.add(mesh);
  }

  // ---- ambient particles ----
  const leafCount = style === 'garden' ? 10 : 0, flyCount = 14;
  const leafMesh = leafCount ? new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.05), mat(COLORS.leafB, { side: THREE.DoubleSide, flatShading: false }), leafCount) : null;
  const flyMat = new THREE.MeshBasicMaterial({ color: FIREFLY, toneMapped: false, transparent: true, opacity: 0.95 });
  const flyMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 6, 4), flyMat, flyCount);
  for (const m of [leafMesh, flyMesh]) if (m) { m.visible = false; m.frustumCulled = false; group.add(m); }
  const leaves = Array.from({ length: leafCount }, (_, i) => ({ tree: trees[i % trees.length], phase: rng() * 10, speed: 0.12 + rng() * 0.1 }));
  const flies = Array.from({ length: flyCount }, () => {
    const front = rng() < 0.6;
    return { x: front ? -halfW + rng() * width : halfW + 0.2 + rng() * (ring - 0.3), z: front ? halfD + 0.2 + rng() * (ring - 0.3) : -halfD + rng() * depth, y: 0.25 + rng() * 1.1, phase: rng() * 10 };
  });
  const dummy = new THREE.Object3D();
  let moodKey = 'morning';

  const ticker = {
    step(t) {
      const night = moodKey === 'evening';
      flyMesh.visible = night;
      if (leafMesh) leafMesh.visible = !night && leaves.length > 0;
      if (night) {
        flies.forEach((f, i) => {
          dummy.position.set(f.x + Math.sin(t * 0.5 + f.phase) * 0.3, f.y + Math.sin(t * 0.9 + f.phase * 2) * 0.15, f.z + Math.cos(t * 0.4 + f.phase) * 0.3);
          const blink = Math.max(0, Math.sin(t * 1.6 + f.phase * 3));
          dummy.scale.setScalar(0.4 + blink);
          dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); flyMesh.setMatrixAt(i, dummy.matrix);
        });
        flyMesh.instanceMatrix.needsUpdate = true;
      } else if (leafMesh) {
        leaves.forEach((l, i) => {
          const tr = l.tree; const h = 4.2;
          const k = ((t * l.speed + l.phase) % 1 + 1) % 1;   // 0 at the canopy, 1 at the lawn
          dummy.position.set(tr.position.x + Math.sin(t * 0.8 + l.phase) * 0.6 + k * 0.8, tr.position.y + h * (1 - k) - 0.1 * k, tr.position.z + Math.cos(t * 0.6 + l.phase) * 0.5 + k * 0.5);
          dummy.rotation.set(t * 1.3 + l.phase, t * 0.7 + l.phase, t + l.phase);
          dummy.scale.setScalar(k > 0.97 ? 0.001 : 1);
          dummy.updateMatrix(); leafMesh.setMatrixAt(i, dummy.matrix);
        });
        leafMesh.instanceMatrix.needsUpdate = true;
      }
    },
    rest() { flyMesh.visible = false; if (leafMesh) leafMesh.visible = false; },
  };

  return {
    group, trees, ticker, size: { width: W, depth: D },
    setMood(key) { moodKey = key; },
    counts: () => ({ meshes: group.children.length, trees: trees.length, leaves: leafCount, fireflies: flyCount }),
    get particles() { return { leaves: !!leafMesh?.visible, fireflies: flyMesh.visible }; },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const m of materials.values()) m.dispose();
      flyMat.dispose();
    },
  };
}
