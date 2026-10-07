// The room reacting to its residents: screens that light up, an oven that glows and steams, and
// small mood bubbles over people's heads. src/game/activities.js decides what is on; this module
// draws it. Everything here is transparent or a sprite, so the ink outlines leave it alone.

import * as THREE from 'three';

// Where each appliance's lit surface is, in the model's own units (measured from its parts).
// rx tilts the panel back (the laptop lid). Colours are what the glow tends toward when fully on.
const GLOWS = {
  kitTelevisionModern: [{ x: 0, y: 0.5245, z: 0.176, w: 1.29, h: 0.7, color: 0xcfe4ff, flicker: true }],
  kitTelevisionVintage: [{ x: 0.0075, y: 0.2635, z: 0.256, w: 0.66, h: 0.39, color: 0xd6ecff, flicker: true }],
  kitLaptop: [{ x: 0, y: 0.113, z: -0.093, w: 0.28, h: 0.155, rx: -0.42, color: 0xe2f1ff }],
  kitComputerScreen: [{ x: 0, y: 0.148, z: 0.02, w: 0.31, h: 0.19, color: 0xe2f1ff }],
  kitKitchenStove: [{ x: -0.004, y: 0.416, z: 0.374, w: 0.56, h: 0.3, color: 0xffb35c }],
  kitKitchenStoveElectric: [{ x: -0.004, y: 0.416, z: 0.374, w: 0.56, h: 0.3, color: 0xffb35c },
    { x: 0, y: 0.853, z: -0.05, w: 0.5, h: 0.42, rx: -Math.PI / 2, color: 0xff7a3d, opacity: 0.45 }],
};
const STEAM_FROM = { kitKitchenStove: [0, 0.9, -0.05], kitKitchenStoveElectric: [0, 0.88, -0.05] };

function canvasTexture(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let puffTexture = null, bubbleTextures = null;
function puff() {
  return puffTexture ??= canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,250,242,0.95)'); grad.addColorStop(0.6, 'rgba(255,250,242,0.45)'); grad.addColorStop(1, 'rgba(255,250,242,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  });
}
/** Cream speech bubbles with a brown edge, one per mood. */
function bubbles() {
  if (bubbleTextures) return bubbleTextures;
  const ink = '#6b4a35';
  const shape = (g) => {
    g.fillStyle = '#fff8ea'; g.strokeStyle = ink; g.lineWidth = 6;
    g.beginPath(); g.roundRect(14, 10, 100, 84, 30); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(52, 92); g.lineTo(64, 116); g.lineTo(76, 92); g.closePath(); g.fill(); g.stroke();
    g.fillRect(50, 86, 28, 9);   // hide the bubble's edge where the tail joins
  };
  const icons = {
    heart(g) { g.fillStyle = '#d4705f'; g.beginPath(); g.moveTo(64, 78); g.bezierCurveTo(30, 56, 36, 26, 56, 32); g.bezierCurveTo(62, 34, 64, 40, 64, 42); g.bezierCurveTo(64, 40, 66, 34, 72, 32); g.bezierCurveTo(92, 26, 98, 56, 64, 78); g.fill(); },
    note(g) { g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.ellipse(50, 70, 11, 8, -0.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(80, 62, 11, 8, -0.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(59, 68); g.lineTo(59, 28); g.lineTo(89, 22); g.lineTo(89, 60); g.stroke(); },
    cup(g) { g.fillStyle = '#c8925e'; g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.roundRect(40, 42, 40, 36, 8); g.fill(); g.stroke(); g.beginPath(); g.arc(84, 58, 9, -Math.PI / 2, Math.PI / 2); g.stroke(); g.lineWidth = 4; for (const x of [52, 66]) { g.beginPath(); g.moveTo(x, 36); g.quadraticCurveTo(x - 6, 28, x, 20); g.stroke(); } },
    sleep(g) { g.fillStyle = ink; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.fillText('z', 52, 76); g.font = 'bold 30px Georgia, serif'; g.fillText('z', 78, 50); },
  };
  bubbleTextures = {};
  for (const [key, draw] of Object.entries(icons)) bubbleTextures[key] = canvasTexture(128, (g) => { shape(g); draw(g); });
  return bubbleTextures;
}

export function createActivityView(scene) {
  const lit = new Map();     // item id -> { parts: [{ mesh, spec }], level, mesh, type }
  const steams = new Map();  // item id -> { group, puffs: [{ sprite, phase }] }
  const shown = new Map();   // resident body root -> { sprite, t }
  const v = new THREE.Vector3();

  function glowFor(id, type, mesh) {
    let entry = lit.get(id);
    if (entry && entry.mesh === mesh) return entry;
    if (entry) for (const p of entry.parts) p.mesh.removeFromParent();
    const parts = GLOWS[type].map((spec) => {
      const material = new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), material);
      m.position.set(spec.x, spec.y, spec.z); m.rotation.x = spec.rx ?? 0;
      m.userData.ownedMaterial = material;   // disposeModel frees it with the item
      m.userData.noOutline = true; m.visible = false; m.renderOrder = 2;
      mesh.add(m);
      return { mesh: m, spec };
    });
    entry = { parts, level: 0, mesh, type };
    lit.set(id, entry);
    return entry;
  }
  function steamFor(id) {
    let s = steams.get(id);
    if (s) return s;
    const group = new THREE.Group(); scene.add(group);
    const puffs = [0, 0.2, 0.4, 0.6, 0.8].map((phase) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff(), transparent: true, opacity: 0, depthWrite: false }));
      group.add(sprite); return { sprite, phase };
    });
    s = { group, puffs };
    steams.set(id, s);
    return s;
  }
  function dropSteam(id) { const s = steams.get(id); if (!s) return; for (const p of s.puffs) p.sprite.material.dispose(); s.group.removeFromParent(); steams.delete(id); }

  return {
    /**
     * Fades glows toward on or off and runs the steam. `appliances` are [{ id, type, mesh }] in the room,
     * `active` the ids in use. Returns true while anything is still changing (draw another frame).
     */
    update(appliances, active, dt, time, animate) {
      let busy = false;
      const present = new Set(appliances.map((a) => a.id));
      for (const id of lit.keys()) if (!present.has(id)) lit.delete(id);
      for (const id of steams.keys()) if (!present.has(id) || !active.has(id) || !animate) dropSteam(id);
      for (const a of appliances) {
        if (!GLOWS[a.type]) continue;
        const want = active.has(a.id) ? 1 : 0;
        const entry = lit.get(a.id)?.mesh === a.mesh ? lit.get(a.id) : (want ? glowFor(a.id, a.type, a.mesh) : null);
        if (!entry) continue;
        entry.level = animate ? THREE.MathUtils.clamp(entry.level + Math.sign(want - entry.level) * dt * 2.5, 0, 1) : want;
        if (entry.level !== want) busy = true;
        for (const { mesh, spec } of entry.parts) {
          const flicker = spec.flicker && animate ? 0.88 + 0.12 * Math.sin(time * 7.3) * Math.sin(time * 2.1 + 1) : 1;
          mesh.material.opacity = entry.level * (spec.opacity ?? 0.85) * flicker;
          mesh.visible = entry.level > 0.01;
          if (spec.flicker && mesh.visible && animate) busy = true;
        }
        if (want && animate && STEAM_FROM[a.type]) {
          const s = steamFor(a.id);
          a.mesh.localToWorld(v.set(...STEAM_FROM[a.type]));
          s.group.position.copy(v);
          for (const p of s.puffs) {
            const t = (time * 0.45 + p.phase) % 1;
            p.sprite.position.set(Math.sin((t + p.phase) * 6) * 0.05, t * 0.75, Math.cos((t + p.phase) * 5) * 0.04);
            p.sprite.scale.setScalar(0.12 + t * 0.26);
            p.sprite.material.opacity = Math.sin(t * Math.PI) * 0.55 * entry.level;
          }
          busy = true;
        }
      }
      return busy;
    },
    /** Pops a mood bubble over a resident's head for a few seconds. */
    showBubble(root, icon) {
      let b = shown.get(root);
      if (!b) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
        sprite.renderOrder = 10; sprite.name = 'bubble';
        root.add(sprite);
        b = { sprite, t: 0, icon: null };
        shown.set(root, b);
      }
      b.sprite.material.map = bubbles()[icon]; b.sprite.material.needsUpdate = true;
      b.t = 0; b.icon = icon; b.sprite.visible = true;
    },
    /** Advances bubbles. `heights` maps root -> bubble height. Returns true while one is showing. */
    stepBubbles(dt, heights, animate) {
      let busy = false;
      for (const [root, b] of shown) {
        if (!root.parent) { b.sprite.material.dispose(); shown.delete(root); continue; }
        if (!b.sprite.visible) continue;
        b.t += dt;
        const life = 2.8;
        const pop = animate ? Math.min(1, b.t / 0.18) : 1;
        const fade = animate ? Math.min(1, (life - b.t) / 0.45) : 1;
        b.sprite.position.set(0, (heights.get(root) ?? 1.45) + (animate ? Math.sin(b.t * 3) * 0.02 : 0), 0);
        b.sprite.scale.setScalar(0.48 * (0.6 + 0.4 * pop));
        b.sprite.material.opacity = Math.max(0, fade);
        if (b.t >= life) { b.sprite.visible = false; b.icon = null; }
        busy = true;
      }
      return busy;
    },
    /** True while any appliance still glows (so the room keeps updating with nobody home). */
    anyLit() { for (const e of lit.values()) if (e.level > 0) return true; return false; },
    bubbleOf(root) { const b = shown.get(root); return b?.sprite.visible ? b.icon : null; },
    isLit(id) { return (lit.get(id)?.level ?? 0) > 0; },
    hasSteam(id) { return steams.has(id); },
  };
}
