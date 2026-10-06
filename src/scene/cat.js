// The cat model: bevelled, faceted Kenney-style parts on pivot joints, posed from the brain's state
// (src/game/pet.js). Joint angles ease toward each action's target so changes never snap.
// Materials come from sharedMaterial(); disposeCat() frees geometry only.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sharedMaterial } from './geometry.js';

import { PET_COLORS, DEFAULT_PET_COLOR, CAT_FACE } from '../config/theme.js';
export { PET_COLORS, DEFAULT_PET_COLOR };

function part(geometry, color, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, sharedMaterial(color, 0.9));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const rbox = (w, h, d, r = 0.012) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
// Flat triangular prisms keep the ears recognisably feline at the game's normal zoom.
function triangle(w, h, depth, tip = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(tip, h); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Builds a cat. Returns { root, setPose(pose, dt, time) }. Origin at the floor between the paws. */
export function createCat(colorKey = DEFAULT_PET_COLOR) {
  const { fur, belly } = PET_COLORS.find((c) => c.key === colorKey) ?? PET_COLORS[0];
  const root = new THREE.Group(); root.name = 'cat';
  const rig = joint(root, 0, 0, 0); rig.scale.setScalar(1.15);   // compact enough for a floor cell, including the tail
  const body = joint(rig, 0, 0.2, 0);                       // pitches for sit, lowers for curl
  part(rbox(0.235, 0.205, 0.34, 0.028), fur, body, 0, 0, 0).name = 'cat-body';
  part(rbox(0.16, 0.065, 0.23), belly, body, 0, -0.07, 0.015);
  part(rbox(0.14, 0.12, 0.025), belly, body, 0, -0.015, 0.163); // cream chest
  const neck = joint(body, 0, 0.06, 0.16);
  const head = joint(neck, 0, 0.06, 0.04);
  part(rbox(0.245, 0.185, 0.185, 0.023), fur, head, 0, 0, 0.035).name = 'cat-head';
  // Two pale cheeks and an understated triangular nose, rather than a spherical snout.
  for (const side of [-1, 1]) part(rbox(0.068, 0.05, 0.035), belly, head, side * 0.032, -0.041, 0.132);
  const nose = part(triangle(0.025, 0.018, 0.008), CAT_FACE.nose, head, 0, -0.022, 0.155);
  nose.rotation.z = Math.PI;
  const eyes = [];
  for (const s of [-1, 1]) {
    part(triangle(0.095, 0.105, 0.065, s * 0.012), fur, head, s * 0.077, 0.073, 0.035).name = 'cat-ear';
    part(triangle(0.054, 0.062, 0.007, s * 0.007), CAT_FACE.innerEar, head, s * 0.077, 0.085, 0.071);
    const open = part(rbox(0.023, 0.031, 0.013, 0.003), CAT_FACE.eye, head, s * 0.062, 0.005, 0.131);
    open.name = 'cat-eye';
    const closed = part(rbox(0.028, 0.007, 0.013, 0.002), CAT_FACE.eye, head, s * 0.062, 0.005, 0.131);
    closed.visible = false;
    eyes.push({ open, closed });
  }
  const legs = [];
  for (const [x, z, front] of [[-0.07, 0.12, true], [0.07, 0.12, true], [-0.07, -0.12, false], [0.07, -0.12, false]]) {
    const hip = joint(body, x, -0.035, z);
    part(rbox(0.063, 0.15, 0.068), fur, hip, 0, -0.07, 0);
    part(rbox(0.077, 0.045, 0.09), belly, hip, 0, -0.14, 0.015).name = 'cat-paw';
    legs.push({ hip, front, side: x < 0 ? -1 : 1 });
  }
  const tail = [];
  let attach = joint(body, 0, 0.04, -0.17);
  for (let i = 0; i < 4; i++) {
    const seg = joint(attach, 0, 0, i === 0 ? 0 : -0.075);
    part(rbox(0.052, 0.052, 0.085, 0.01), i === 3 ? belly : fur, seg, 0, 0, -0.04).name = 'cat-tail';
    tail.push(seg); attach = seg;
  }

  // Joint targets per action; current values ease toward them.
  const current = { bodyY: 0.2, pitch: 0, lean: 0, turn: 0, neckPitch: 0, neckTurn: 0, headTilt: 0, frontLeg: 0, backLeg: 0, legFold: 0, frontFold: 0, tailUp: 0.5, tailCurl: 0.2 };
  const TARGET = {
    walk: { bodyY: 0.2, pitch: 0, lean: 0, turn: 0, neckPitch: -0.05, neckTurn: 0, headTilt: 0, frontLeg: 0, backLeg: 0, legFold: 0, frontFold: 0, tailUp: 0.7, tailCurl: 0.25 },
    hop: { bodyY: 0.22, pitch: -0.25, lean: 0, turn: 0, neckPitch: 0.15, neckTurn: 0, headTilt: 0, frontLeg: -0.6, backLeg: 0.7, legFold: 0, frontFold: 0, tailUp: 0.4, tailCurl: 0.1 },
    // Sitting: rear down, chest up, front legs straight, tail wrapped forward along the floor.
    sit: { bodyY: 0.17, pitch: -0.7, lean: 0, turn: 0, neckPitch: 0.62, neckTurn: 0, headTilt: 0, frontLeg: 0.68, backLeg: -0.2, legFold: 0.75, frontFold: 0, tailUp: 0.6, tailCurl: 0.9 },   // the pitched body lowers the tail base; lift it back to the floor
    // Sleeping loaf: tucked paws, relaxed head and a wrapped tail. Keep the enlarged head above the floor.
    curl: { bodyY: 0.11, pitch: 0, lean: 0.1, turn: 0, neckPitch: 0.15, neckTurn: 0.6, headTilt: 0.05, frontLeg: 1.35, backLeg: -1.35, legFold: 0.6, frontFold: 0.6, tailUp: 0.02, tailCurl: 1.6 },
  };
  let walkPhase = 0;

  function setPose(p, dt, time) {
    root.position.set(p.x, p.y, p.z);
    root.rotation.y = p.heading;
    const target = TARGET[p.action] ?? TARGET.sit;
    const k = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(current)) current[key] += (target[key] - current[key]) * k;
    const walking = p.action === 'walk' ? 1 : 0;
    walkPhase += dt * 9 * walking;
    const breathe = Math.sin(time * 2.2) * 0.008;

    body.position.y = current.bodyY + walking * Math.abs(Math.sin(walkPhase)) * 0.012 + breathe * (p.action === 'curl' ? 1 : 0.3);
    body.rotation.x = current.pitch;
    body.rotation.z = current.lean;
    neck.rotation.set(current.neckPitch, current.neckTurn + p.look * 0.8, 0);
    head.rotation.set(0, p.look * 0.25, current.headTilt);
    for (const eye of eyes) { eye.open.visible = p.action !== 'curl'; eye.closed.visible = p.action === 'curl'; }
    for (const leg of legs) {
      const swing = walking * Math.sin(walkPhase + (leg.front === (leg.side > 0) ? 0 : Math.PI)) * 0.55;
      leg.hip.rotation.x = (leg.front ? current.frontLeg : current.backLeg) + swing;
      leg.hip.scale.y = 1 - (leg.front ? current.frontFold : current.legFold) * 0.45;
    }
    const flick = Math.sin(time * 1.7) * 0.15 + (walking ? Math.sin(walkPhase * 0.5) * 0.12 : 0);
    tail.forEach((seg, i) => {
      seg.rotation.x = i === 0 ? current.tailUp : -current.tailCurl * 0.04;   // positive lifts the tail
      seg.rotation.y = current.tailCurl * (0.45 + i * 0.1) + flick * (i + 1) * 0.3;
    });
  }
  return { root, setPose };
}

export function disposeCat(cat) {
  cat.root.removeFromParent();
  cat.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}
