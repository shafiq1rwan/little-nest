import * as THREE from 'three';

function texture(draw, size = 1024) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function woodTexture(floor = false) {
  return texture((c, s) => {
    c.fillStyle = '#c39872'; c.fillRect(0, 0, s, s);
    if (floor) {
      // Basket-weave parquet: alternating blocks of narrow wood strips.
      const block = 128;
      for (let x = 0; x < s; x += block) for (let y = 0; y < s; y += block) {
        c.save(); c.translate(x + block / 2, y + block / 2);
        if ((x / block + y / block) % 2) c.rotate(Math.PI / 2);
        for (let i = 0; i < 4; i++) {
          const tone = 155 + ((x * 17 + y * 7 + i * 13) % 36);
          c.fillStyle = 'rgb(' + (tone + 32) + ',' + (tone - 8) + ',' + (tone - 43) + ')';
          c.fillRect(-64, -64 + i * 32, 128, 32);
          c.strokeStyle = '#79523666'; c.lineWidth = 1.5; c.strokeRect(-64, -64 + i * 32, 128, 32);
          c.strokeStyle = '#f2d0a522'; c.lineWidth = 1;
          for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(-62, -61 + i * 32 + j * 6); c.bezierCurveTo(-20, -62 + i * 32 + j * 6, 15, -56 + i * 32 + j * 6, 62, -60 + i * 32 + j * 6); c.stroke(); }
        }
        c.restore();
      }
    } else {
      c.fillStyle = '#b5947b'; c.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 64) {
        c.fillStyle = y % 128 ? '#ffffff08' : '#34201308'; c.fillRect(0, y, s, 64);
        c.strokeStyle = '#51341f55'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke();
        c.strokeStyle = '#e6c5a722'; c.lineWidth = 1;
        for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(0, y + 8 + j * 8); c.bezierCurveTo(300, y + 3 + j * 8, 700, y + 15 + j * 8, s, y + 8 + j * 8); c.stroke(); }
      }
    }
  });
}
function viewTexture() {
  return texture((c, s) => {
    const grad = c.createLinearGradient(0, 0, 0, s); grad.addColorStop(0, '#d6e7be'); grad.addColorStop(.6, '#c3cf93'); grad.addColorStop(1, '#7d995b');
    c.fillStyle = grad; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      const x = (i * 137.5) % s, y = (i * 69.3) % s;
      c.fillStyle = ['#88a05d55', '#bdce8955', '#f2e8af88', '#5d844755'][i % 4];
      c.beginPath(); c.ellipse(x, y, 20 + i % 35, 30 + i % 45, i, 0, Math.PI * 2); c.fill();
    }
  }, 512);
}
export function artTexture(botanical) {
  return texture((c, s) => {
    c.fillStyle = botanical ? '#f0dfc5' : '#eed1a0'; c.fillRect(0, 0, s, s);
    if (botanical) {
      c.strokeStyle = '#5c6b42'; c.lineWidth = 6; c.beginPath(); c.moveTo(s * .5, s * .88); c.bezierCurveTo(s * .4, s * .5, s * .6, s * .5, s * .5, s * .15); c.stroke();
      for (let i = 0; i < 8; i++) { const side = i % 2 ? -1 : 1; c.fillStyle = i % 3 ? '#6e8055' : '#9ca177'; c.beginPath(); c.ellipse(s * .5 + side * s * .12, s * .23 + i * s * .07, s * .16, s * .065, side * -.5, 0, Math.PI * 2); c.fill(); }
    } else {
      c.fillStyle = '#b6874d';
      for (const [x, y, rx, ry, r] of [[.25,.39,.18,.12,-.3],[.35,.58,.07,.18,-.3],[.53,.4,.07,.05,0],[.57,.55,.08,.16,-.2],[.73,.4,.2,.13,.1],[.82,.69,.09,.05,.3]]) {
        c.beginPath(); c.ellipse(x*s,y*s,rx*s,ry*s,r,0,Math.PI*2); c.fill();
      }
      c.fillStyle = '#6d4b2c'; c.textAlign = 'center'; c.font = '40px Georgia'; c.fillText('WORLD MAP', s / 2, s * .18);
      c.font = '20px Georgia'; c.fillText('a world of possibility', s / 2, s * .88);
    }
  }, 512);
}

// Textures are shared across rebuilds; only the shell geometry is recreated per preset.
let sharedTextures = null;
function plankTexture() {
  return texture((c, s) => {
    c.fillStyle = '#c39872'; c.fillRect(0, 0, s, s);
    const rowH = 128;   // two planks per cell, staggered joints
    for (let y = 0, row = 0; y < s; y += rowH, row++) {
      const offset = (row * 389) % 512;
      for (let x = -offset; x < s; x += 512) {
        const tone = 160 + ((row * 23 + x * 3) % 30);
        c.fillStyle = 'rgb(' + (tone + 30) + ',' + (tone - 6) + ',' + (tone - 40) + ')';
        c.fillRect(x, y, 512, rowH);
        c.strokeStyle = '#7952366e'; c.lineWidth = 2; c.strokeRect(x, y, 512, rowH);
        c.strokeStyle = '#f2d0a520'; c.lineWidth = 1;
        for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(x + 4, y + 10 + j * 16); c.bezierCurveTo(x + 170, y + 4 + j * 16, x + 340, y + 20 + j * 16, x + 508, y + 10 + j * 16); c.stroke(); }
      }
    }
  });
}
function tileTexture() {
  return texture((c, s) => {
    c.fillStyle = '#d8cfc4'; c.fillRect(0, 0, s, s);   // grout
    const t = 256, gap = 6;   // one tile per room cell
    for (let x = 0; x < s; x += t) for (let y = 0; y < s; y += t) {
      const tone = 236 + ((x * 7 + y * 13) % 12);
      c.fillStyle = 'rgb(' + tone + ',' + (tone - 4) + ',' + (tone - 10) + ')';
      c.fillRect(x + gap / 2, y + gap / 2, t - gap, t - gap);
      c.fillStyle = '#ffffff22'; c.fillRect(x + gap / 2, y + gap / 2, t - gap, 10);
    }
  });
}
function textures() {
  if (!sharedTextures) sharedTextures = { floor: woodTexture(true), planks: plankTexture(), tile: tileTexture(), wall: woodTexture(false), view: viewTexture() };
  return sharedTextures;
}
/** Texture key for a floor style; unknown styles fall back to parquet. */
const FLOOR_TEXTURE = { parquet: 'floor', planks: 'planks', tile: 'tile' };

/**
 * Builds the room shell for a preset: floor, two walls, trim, windows, optional bulb string, and the
 * ground plane. `preset` is { width, depth, windows: [{ wall, at, width }], lights }.
 * Returns the materials the finishes recolor, the wall panels used for raycasting, the fixture
 * rectangles that block wall cells, and dispose() for rebuilding with another preset.
 */
export function createRoom(scene, preset, wallHeight = 4, { wallColor = 0x92725c, wallLeftColor = wallColor, floorColor = 0xe3a372, floorStyle = 'parquet' } = {}) {
  const { width, depth } = preset;
  const halfW = width / 2, halfD = depth / 2;
  const tex = textures();
  const root = new THREE.Group(); scene.add(root);
  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, map: tex[FLOOR_TEXTURE[floorStyle] || 'floor'], roughness: .85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, map: tex.wall, roughness: .93 });
  const wallLeftMat = new THREE.MeshStandardMaterial({ color: wallLeftColor, map: tex.wall, roughness: .93 });
  /** Swaps the floor pattern in place; textures are shared, so nothing is disposed. */
  function setFloorStyle(style) { floorMat.map = tex[FLOOR_TEXTURE[style] || 'floor']; floorMat.roughness = style === 'tile' ? .6 : .85; floorMat.needsUpdate = true; }
  setFloorStyle(floorStyle);
  const walls = new THREE.Group(); root.add(walls);
  const wood = new THREE.MeshStandardMaterial({ color: 0x9b623d, roughness: .8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xe7ca9f, roughness: .9 });
  const owned = [floorMat, wallMat, wallLeftMat, wood, trim];
  const bulbs = [];   // string-light bulb materials, one each (they twinkle in the evening)
  function block(w, h, d, mat, x, y, z, parent = walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.receiveShadow = m.castShadow = true; parent.add(m); return m;
  }
  block(width + .48, .23, depth + .48, trim, 0, -.2, 0, root);
  block(width, .15, depth, floorMat, 0, -.075, 0, root);
  block(width, .15, .15, trim, 0, -.05, halfD + .07, root);
  block(.15, .15, depth, trim, halfW + .07, -.05, 0, root);
  let backPanel, leftPanel;
  // Each outer wall keeps its panel, trim, windows, door and bulbs in its own group, beside a low stub of the same
  // wall. When the camera swings round behind a wall, setCutaway() swaps the wall for its stub (main.js).
  const outer = { back: new THREE.Group(), left: new THREE.Group() };
  const stub = { back: new THREE.Group(), left: new THREE.Group() };
  for (const k of ['back', 'left']) { walls.add(outer[k], stub[k]); stub[k].visible = false; }
  if (preset.walls === 'railing') {
    // Open air: low railings with posts every unit. The top rails stand in for the wall panels so
    // raycasts still resolve, but the wall grid has no rows, so nothing can be mounted on them.
    const railH = 1.0;
    function railing(along, wall) {
      const g = new THREE.Group(); walls.add(g);
      const place = (x, y, z, w, h, d, mat) => (wall === 'back' ? block(w, h, d, mat, x, y, -halfD - .1 + z, g) : block(d, h, w, mat, -halfW - .1 + z, y, x, g));
      for (let i = 0; i <= along; i++) place(-along / 2 + i, railH / 2, 0, .08, railH, .08, wood);
      place(0, railH - .04, 0, along + .08, .08, .12, wood);
      place(0, .55, 0, along, .05, .05, wood);
      place(0, .15, 0, along, .05, .05, wood);
      return g.children[g.children.length - 3];
    }
    backPanel = railing(width, 'back'); backPanel.userData.wall = 'back';
    leftPanel = railing(depth, 'left'); leftPanel.userData.wall = 'left';
  } else {
    // The two wall panels double as raycast targets for wall-mounted decorations.
    backPanel = block(width, wallHeight, .2, wallMat, 0, wallHeight / 2, -halfD - .1, outer.back); backPanel.userData.wall = 'back';
    leftPanel = block(.2, wallHeight, depth + .2, wallLeftMat, -halfW - .1, wallHeight / 2, -.1, outer.left); leftPanel.userData.wall = 'left';
    block(width + .25, .1, .3, trim, 0, wallHeight, -halfD - .1, outer.back);
    block(.3, .1, depth + .25, trim, -halfW - .1, wallHeight, -.1, outer.left);
    block(width, .16, .09, wood, 0, .09, -halfD + .06, outer.back);
    block(.09, .16, depth, wood, -halfW + .06, .09, 0, outer.left);
    // The stubs: knee-high wall with a trim cap, open where the door is.
    const STUB = .45, doorway = preset.doorway;
    for (const wall of ['back', 'left']) {
      const from = wall === 'back' ? -halfW : -halfD - .2, to = wall === 'back' ? halfW : halfD;
      const runs = doorway?.wall === wall ? [[from, doorway.at - doorway.width / 2 - .1], [doorway.at + doorway.width / 2 + .1, to]] : [[from, to]];
      for (const [a, b] of runs) {
        if (b - a < .01) continue;
        const len = b - a, mid = (a + b) / 2;
        if (wall === 'back') {
          block(len, STUB, .2, wallMat, mid, STUB / 2, -halfD - .1, stub.back);
          block(len + .05, .1, .3, trim, mid, STUB, -halfD - .1, stub.back);
        } else {
          block(.2, STUB, len, wallLeftMat, -halfW - .1, STUB / 2, mid, stub.left);
          block(.3, .1, len + .05, trim, -halfW - .1, STUB, mid, stub.left);
        }
      }
    }
  }
  /** Swaps an outer wall for its low stub while the camera is behind it: `cut` is { back, left }. */
  function setCutaway(cut) {
    if (preset.walls === 'railing') return;   // railings are low already
    for (const k of ['back', 'left']) { outer[k].visible = !cut[k]; stub[k].visible = !!cut[k]; }
  }

  const viewMat = new THREE.MeshStandardMaterial({ map: tex.view, emissive: 0xc9d498, emissiveIntensity: .2, roughness: 1 });
  const cord = new THREE.MeshStandardMaterial({ color: 0xe6ccad });
  owned.push(viewMat, cord);
  function windowAt(x, z, rotation, w, parent) {
    const g = new THREE.Group(); g.position.set(x, 2.22, z); g.rotation.y = rotation; parent.add(g);
    block(w + .18, 2.25, .13, wood, 0, 0, 0, g);
    block(w, 2.06, .025, viewMat, 0, 0, .08, g);
    for (const xx of [-w / 2, 0, w / 2]) block(.055, 2.15, .07, trim, xx, 0, .11, g);
    block(w, .055, .07, trim, 0, -.45, .11, g);
    block(w + .28, .07, .35, wood, 0, -1.13, .12, g);
    for (let i = 0; i < 10; i++) block(w + .1, .065, .12, wood, 0, 1.09 - i * .073, .2, g);
    for (const xx of [-w * .32, w * .32]) block(.012, .73, .015, cord, xx, .78, .27, g);
  }
  // The door: a frame, a dark doorway, and a leaf hinged on one side that swings into the room.
  let door = null;
  if (preset.doorway) {
    const d = preset.doorway;
    const g = new THREE.Group(); outer[d.wall].add(g);
    if (d.wall === 'back') { g.position.set(d.at, 0, -halfD + .05); } else { g.position.set(-halfW + .05, 0, d.at); g.rotation.y = Math.PI / 2; }
    const hall = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xb98556, roughness: .8 });
    const knob = new THREE.MeshStandardMaterial({ color: 0xbb9451, roughness: .4, metalness: .3 });
    owned.push(hall, leafMat, knob);
    block(d.width, d.height, .02, hall, 0, d.height / 2, .06, g);                       // the dark hallway beyond
    block(d.width + .2, .14, .1, trim, 0, d.height + .07, .08, g);                      // lintel
    for (const s of [-1, 1]) block(.1, d.height, .1, trim, s * (d.width / 2 + .05), d.height / 2, .08, g);   // jambs
    const pivot = new THREE.Group(); pivot.position.set(-d.width / 2, 0, .1); g.add(pivot);
    const leaf = block(d.width - .02, d.height - .04, .06, leafMat, d.width / 2, d.height / 2, 0, pivot);
    for (const [y, h] of [[.55, .7], [1.45, .7]]) block(d.width - .25, h, .02, leafMat, d.width / 2, y, .04, pivot);   // panels
    block(.05, .05, .08, knob, d.width - .12, 1.05, .06, pivot);
    leaf.userData.door = true;
    door = { group: g, pivot, wall: d.wall, at: d.at, width: d.width, height: d.height, open: 0,
      /** Opening from 0 (shut) to 1 (wide open, swung into the room). */
      setOpen(t) { this.open = t; pivot.rotation.y = -t * 1.45; } };
  }
  // Interior partitions: room-height plaster walls on grid lines, with a skirting board, a trim cap, and door
  // frames (posts, header, an open door) in doorway gaps. They are built one cell at a time, and each piece knows
  // the two cells it separates, so setGhostCells() can turn the walls round a room see-through: pale plaster
  // between the solid skirting and trim, no shadow. The game ghosts the room you click (main.js).
  // Floor zones lay their own finish (a tiled bathroom or kitchen) just above the main floor.
  const ghostable = [];   // { mesh, a, b, cx, cz, solid }: the 'gx,gz' keys either side and the piece's floor centre
  if (preset.partitions?.length) {
    const plaster = new THREE.MeshStandardMaterial({ color: 0xeee2cf, roughness: .92 });
    const ghost = new THREE.MeshStandardMaterial({ color: 0xf4eadb, roughness: .9, transparent: true, opacity: .2, depthWrite: false });
    const doorWood = new THREE.MeshStandardMaterial({ color: 0xc4955f, roughness: .8 });
    const skirting = new THREE.MeshStandardMaterial({ color: 0xd9c3a2, roughness: .85 });
    owned.push(plaster, ghost, doorWood, skirting);
    const T = .12, DOOR = 2.3;
    const piece = (p, a, b, y0, y1, mat, thick = T) => {
      const len = b - a, mid = (a + b) / 2, h = y1 - y0;
      return p.axis === 'z' ? block(thick, h, len, mat, -halfW + p.line, y0 + h / 2, -halfD + mid) : block(len, h, thick, mat, -halfW + mid, y0 + h / 2, -halfD + p.line);
    };
    const sides = (p, i) => (p.axis === 'z' ? [(p.line - 1) + ',' + i, p.line + ',' + i] : [i + ',' + (p.line - 1), i + ',' + p.line]);
    const track = (mesh, p, i, solid) => {
      const [a, b] = sides(p, i);
      const cx = p.axis === 'z' ? -halfW + p.line : -halfW + i + .5, cz = p.axis === 'z' ? -halfD + i + .5 : -halfD + p.line;
      ghostable.push({ mesh, a, b, cx, cz, solid });
    };
    for (const p of preset.partitions) {
      const H = p.height ?? 2.6;
      for (let i = p.from; i < p.to; i++) {
        if (p.gaps?.includes(i)) {
          // A doorway: two posts and a header, plaster above it, the door standing open.
          piece(p, i, i + .08, 0, DOOR, trim, T + .08);
          piece(p, i + .92, i + 1, 0, DOOR, trim, T + .08);
          piece(p, i, i + 1, DOOR, DOOR + .1, trim, T + .08);
          track(piece(p, i, i + 1, DOOR + .1, H, plaster), p, i, plaster);
          const hinge = new THREE.Group();
          if (p.axis === 'z') { hinge.position.set(-halfW + p.line, 0, -halfD + i + .08); hinge.rotation.y = -Math.PI * .6; }
          else { hinge.position.set(-halfW + i + .08, 0, -halfD + p.line); hinge.rotation.y = Math.PI * .6; }
          walls.add(hinge);
          track(block(.84, DOOR - .04, .05, doorWood, .42, (DOOR - .04) / 2, 0, hinge), p, i, doorWood);
          block(.05, .05, .1, trim, .74, 1.05, 0, hinge);   // the handle
        } else {
          track(piece(p, i, i + 1, .1, H, plaster), p, i, plaster);
          piece(p, i, i + 1, 0, .1, skirting, T + .02);
        }
        piece(p, i - .01, i + 1.01, H, H + .06, trim, T + .06);
      }
    }
    // `see(piece)` decides which pieces go see-through; a piece is { a, b, cx, cz } (see `ghostable`).
    var setGhost = (test) => {
      let n = 0;
      for (const g of ghostable) {
        const see = test(g);
        g.mesh.material = see ? ghost : g.solid;
        g.mesh.castShadow = !see;
        g.mesh.renderOrder = see ? 1 : 0;
        if (see) n++;
      }
      return n;
    };
  }
  for (const zone of preset.zones ?? []) {
    const [x0, z0] = zone.from, [x1, z1] = zone.to;
    const map = tex[FLOOR_TEXTURE[zone.floor] || 'tile'].clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set((x1 - x0) / 4, (z1 - z0) / 4);   // four tiles to a texture, one tile per cell
    map.needsUpdate = true;
    const zoneMat = new THREE.MeshStandardMaterial({ map, color: 0xf3ece2, roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 });
    owned.push(zoneMat, map);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), zoneMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(-halfW + (x0 + x1) / 2, .002, -halfD + (z0 + z1) / 2);
    plane.receiveShadow = true;
    root.add(plane);
  }
  for (const win of preset.windows) {
    if (win.wall === 'back') windowAt(win.at, -halfD + .05, 0, win.width, outer.back);
    else windowAt(-halfW + .05, win.at, Math.PI / 2, win.width, outer.left);
  }
  if (preset.lights) {
    // A short string of warm bulbs high on the back wall, near its right end.
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x5d4938 });
    owned.push(wireMat);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(halfW - 1.1, 3.6, -halfD + .18), new THREE.Vector3(halfW - .65, 3.25, -halfD + .18), new THREE.Vector3(halfW - .2, 3.6, -halfD + .18)]);
    outer.back.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .008, 5, false), wireMat));
    for (const t of [.12, .4, .7, .92]) {
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe2a4, emissive: 0xffc76b, emissiveIntensity: 2 });
      owned.push(bulbMat); bulbs.push(bulbMat);
      const p = curve.getPoint(t), bulb = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), bulbMat); bulb.position.copy(p); outer.back.add(bulb);
    }
  }
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xdf9d80, toneMapped: false });
  const shadowMat = new THREE.ShadowMaterial({ opacity: .18 });
  owned.push(groundMat, shadowMat);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.34; root.add(ground);
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), shadowMat);
  groundShadow.rotation.x = -Math.PI / 2; groundShadow.position.y = -.335; groundShadow.receiveShadow = true; root.add(groundShadow);

  function dispose() {
    scene.remove(root);
    root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of owned) m.dispose();
  }
  return { root, door, setCutaway, setGhost: setGhost ?? (() => 0), ghostedPieces: () => ghostable.filter((g) => g.mesh.material.transparent).length, bulbs, floorMat, wallMat, wallLeftMat, setFloorStyle, viewMat, groundMat, walls, wallPanels: { back: backPanel, left: leftPanel }, dispose };
}
