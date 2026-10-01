import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLANT_CATALOG } from './plants.js';
import { sharedMaterial, ownMaterial, recolorModel } from './scene/geometry.js';
import { artTexture } from './room.js';
import { DEFAULT_COLLECTION } from './data/collections.js';
import { modelInstance } from './scene/models.js';

const C = { cream: 0xf3e4d2, wood: 0xb87946, dark: 0x694b35, sage: 0x81936a, green: 0x4d7639, pot: 0xeee0ca, black: 0x393932, brass: 0xbb9451 };
const material = (color) => sharedMaterial(color, .85);
function mesh(geometry, color, x, y, z) {
  const m = new THREE.Mesh(geometry, material(color));
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
}
function box(w, h, d, color, x = 0, y = 0, z = 0, radius = .025) {
  return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), color, x, y + h / 2, z);
}
function cyl(top, bottom, h, color, x = 0, y = 0, z = 0) {
  return mesh(new THREE.CylinderGeometry(top, bottom, h, 20), color, x, y + h / 2, z);
}
function cushion(w, h, d, color, x, y, z) {
  const m = box(w, h, d, color, x, y, z, .12); m.userData.recolor = true; return m;
}
function legs(g, w, d, h, color = C.wood) {
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(cyl(.035, .045, h, color, x, 0, z));
}
function smallPlant(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(.23, .17, .38, C.pot), cyl(.205, .205, .02, 0x5b4030, 0, .37, 0));
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.399, height = .65 + (i % 4) * .19, reach = .24 + (i % 3) * .09;
    const end = new THREE.Vector3(Math.cos(angle) * reach, height, Math.sin(angle) * reach);
    const start = new THREE.Vector3(0, .35, 0);
    const stem = mesh(new THREE.CylinderGeometry(.012, .015, start.distanceTo(end), 5), C.green, 0, 0, 0);
    stem.position.copy(start.clone().add(end).multiplyScalar(.5));
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const leaf = mesh(new THREE.SphereGeometry(1, 10, 7), i % 3 ? C.green : 0x739249, end.x, end.y, end.z);
    leaf.scale.set(.15, .045, .31); leaf.rotation.set(.3 + (i % 3) * .2, -angle + Math.PI / 2, .25);
    g.add(stem, leaf);
  }
  g.scale.setScalar(scale); return g;
}
function books(g, y, start, count) {
  const colors = [0xdfc8a0, 0x8a9a79, 0x9d6450, 0xe6ded0, 0x675c4b];
  for (let i = 0; i < count; i++) {
    const h = .22 + (i % 3) * .045;
    g.add(box(.085, h, .22, colors[i % colors.length], start + i * .105, y, .03, .008));
  }
}
function seating(sofa) {
  const g = new THREE.Group(), w = sofa ? 2.8 : .88;
  legs(g, w - .25, .65, .17);
  g.add(cushion(w, .25, .88, C.cream, 0, .16, 0));
  const n = sofa ? 3 : 1, seatW = (w - .25) / n;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * seatW;
    g.add(cushion(seatW - .015, .17, .72, C.cream, x, .4, .06));
    const back = cushion(seatW - .01, .61, .23, C.cream, x, .42, -.32); back.rotation.x = -.1; g.add(back);
  }
  for (const x of [-w / 2 + .06, w / 2 - .06]) {
    if (sofa) g.add(cushion(.23, .48, .9, C.cream, x, .28, 0));
    else { g.add(box(.075, .075, .86, C.wood, x, .66, 0)); g.add(box(.06, .5, .06, C.wood, x, .15, .32)); }
  }
  const pillow = box(sofa ? .42 : .36, .39, .14, sofa ? 0xbf895c : C.sage, sofa ? -.85 : 0, .6, -.14, .075);
  pillow.rotation.z = -.13; pillow.rotation.x = -.15; pillow.userData.recolor = !sofa; g.add(pillow);
  if (sofa) { const p = box(.4, .37, .14, C.sage, .86, .61, -.12, .07); p.rotation.z = .13; g.add(p); }
  return g;
}
// Small objects that sit in a surface slot on tables and shelves. Origin at the base centre; keep
// each within roughly a 0.3-unit footprint so they fit between the baked decoration.
const SMALL_CATALOG = {
  mug: { label: 'Mug', category: 'small', layer: 'surface', tags: ['cup', 'coffee', 'tea'], w: 1, d: 1, defaultColor: C.cream, build() {
    const g = new THREE.Group();
    const body = cyl(.075, .065, .13, C.cream); body.userData.recolor = true; g.add(body);
    const handle = mesh(new THREE.TorusGeometry(.04, .012, 6, 12), C.cream, .095, .07, 0); handle.userData.recolor = true; g.add(handle);
    g.add(cyl(.062, .062, .012, 0x5b3d2a, 0, .125, 0)); return g;
  }},
  candle: { label: 'Candle', category: 'small', layer: 'surface', lamp: true, tags: ['light', 'cozy'], w: 1, d: 1, defaultColor: C.cream, build() {
    const g = new THREE.Group(); g.add(cyl(.09, .1, .03, C.brass));
    const wax = cyl(.06, .06, .16, C.cream, 0, .03, 0); wax.userData.recolor = true; g.add(wax);
    g.add(cyl(.006, .006, .03, C.black, 0, .19, 0));
    const flame = mesh(new THREE.ConeGeometry(.018, .05, 8), 0xffc76b, 0, .245, 0);
    flame.material = material(0xffc76b).clone(); flame.material.emissive.setHex(0xffb347); flame.material.emissiveIntensity = 1.2; flame.userData.ownedMaterial = flame.material; g.add(flame);
    return g;
  }},
  bookStack: { label: 'Book stack', category: 'small', layer: 'surface', tags: ['books', 'reading'], w: 1, d: 1, defaultColor: 0x9d6450, build() {
    const g = new THREE.Group();
    const top = box(.2, .035, .27, 0x9d6450, 0, .075, 0, .006); top.userData.recolor = true;
    g.add(box(.24, .04, .3, 0x8a9a79, 0, 0, 0, .006), box(.22, .035, .28, 0xdfc8a0, .01, .04, -.01, .006), top);
    return g;
  }},
  succulent: { label: 'Succulent', category: 'small', layer: 'surface', tags: ['plant', 'pot'], w: 1, d: 1, defaultColor: C.pot, build() {
    const g = new THREE.Group();
    const pot = cyl(.075, .06, .1, C.pot); pot.userData.recolor = true; g.add(pot);
    g.add(cyl(.068, .068, .01, 0x5b4030, 0, .095, 0));
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i < 4 ? .045 : .02, h = i < 4 ? .06 : .09;
      const leaf = mesh(new THREE.SphereGeometry(1, 8, 6), i % 2 ? 0x8daa6a : 0x6f965a, Math.cos(a) * r, .105 + h / 2, Math.sin(a) * r);
      leaf.scale.set(.022, h / 2, .035); leaf.rotation.y = -a; g.add(leaf);
    }
    return g;
  }},
  frame: { label: 'Photo frame', category: 'small', layer: 'surface', tags: ['picture', 'photo'], w: 1, d: 1, defaultColor: C.wood, build() {
    const g = new THREE.Group();
    const f = box(.22, .26, .02, C.wood, 0, 0, 0, .004); f.rotation.x = -.15; f.userData.recolor = true; g.add(f);
    const pic = box(.17, .2, .006, 0xc3d6a8, 0, .03, .012, .002); pic.rotation.x = -.15; g.add(pic);
    g.add(box(.02, .2, .1, C.wood, 0, 0, -.06, .003).rotateX(.35));
    return g;
  }},
  lantern: { label: 'Lantern', category: 'small', layer: 'surface', lamp: true, tags: ['light', 'candle', 'cozy'], w: 1, d: 1, defaultColor: C.black, build() {
    const g = new THREE.Group();
    const base = cyl(.085, .09, .02, C.black); base.userData.recolor = true; g.add(base);
    const cage = mesh(new THREE.CylinderGeometry(.07, .07, .18, 6, 1, true), C.black, 0, .11, 0);
    cage.material = material(C.black).clone(); cage.material.transparent = true; cage.material.opacity = .35; cage.material.side = THREE.DoubleSide; cage.userData.ownedMaterial = cage.material; g.add(cage);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const bar = cyl(.006, .006, .18, C.black, Math.cos(a) * .07, .02, Math.sin(a) * .07); bar.userData.recolor = true; g.add(bar); }
    const roof = mesh(new THREE.ConeGeometry(.1, .06, 6), C.black, 0, .23, 0); roof.userData.recolor = true; g.add(roof);
    g.add(mesh(new THREE.TorusGeometry(.03, .006, 6, 12), C.brass, 0, .275, 0));
    const glow = mesh(new THREE.SphereGeometry(.035, 8, 6), 0xffd58a, 0, .1, 0);
    glow.material = material(0xffd58a).clone(); glow.material.emissive.setHex(0xffb347); glow.material.emissiveIntensity = 1.5; glow.userData.ownedMaterial = glow.material; g.add(glow);
    return g;
  }},
  vase: { label: 'Vase', category: 'small', layer: 'surface', tags: ['flowers', 'decor'], w: 1, d: 1, defaultColor: C.sage, build() {
    const g = new THREE.Group();
    const body = mesh(new THREE.LatheGeometry([new THREE.Vector2(.04, 0), new THREE.Vector2(.075, .06), new THREE.Vector2(.05, .16), new THREE.Vector2(.045, .2)], 16), C.sage, 0, 0, 0);
    body.userData.recolor = true; g.add(body);
    for (const [x, z, h] of [[0, 0, .3], [.03, -.02, .25], [-.03, .02, .27]]) {
      g.add(cyl(.004, .004, h - .18, 0x62804b, x, .18, z));
      g.add(mesh(new THREE.SphereGeometry(.028, 8, 6), x === 0 ? 0xe9bd6c : 0xd79c9c, x * 1.5, h + .02, z * 1.5));
    }
    return g;
  }},
};

// Wall-mounted decorations. Origin at the bottom-centre of the back face, extending +z into the room.
// `wall: { w, h }` is the footprint in wall columns (1 unit) and rows (0.5 unit).
function framedPrint(width, height, botanical) {
  const g = new THREE.Group();
  const frame = box(width + .16, height + .16, .08, C.wood, 0, 0, 0, .01); frame.position.y = height / 2 + .08; frame.position.z = .04; frame.userData.recolor = true; g.add(frame);
  const art = new THREE.Mesh(new THREE.BoxGeometry(width, height, .02), new THREE.MeshStandardMaterial({ map: artTexture(botanical), roughness: 1 }));
  art.position.set(0, height / 2 + .08, .085); art.castShadow = art.receiveShadow = true; art.userData.ownedMaterial = art.material; g.add(art);
  return g;
}
const WALL_CATALOG = {
  worldMap: { label: 'World map', category: 'wall', layer: 'wall', tags: ['art', 'picture', 'poster'], w: 2, d: 1, wall: { w: 2, h: 3 }, defaultColor: C.wood, build: () => framedPrint(1.55, 1.2, false) },
  botanicalPrint: { label: 'Botanical print', category: 'wall', layer: 'wall', tags: ['art', 'picture', 'plant'], w: 2, d: 1, wall: { w: 2, h: 3 }, defaultColor: C.wood, build: () => framedPrint(1.05, 1.3, true) },
  wallShelf: { label: 'Wall shelf', category: 'wall', layer: 'wall', tags: ['shelf', 'storage'], w: 2, d: 1, wall: { w: 2, h: 1 }, defaultColor: C.wood,
    surface: { y: .42, slots: [{ x: -.5, z: .17 }, { x: .5, z: .17 }] }, build() {
    const g = new THREE.Group();
    const board = box(1.9, .05, .32, C.wood, 0, .37, .16, .008); board.userData.recolor = true; g.add(board);
    for (const x of [-.7, .7]) { g.add(box(.05, .3, .05, C.dark, x, .07, .03, .004), box(.05, .05, .26, C.dark, x, .32, .14, .004)); }
    return g;
  }},
  mirror: { label: 'Round mirror', category: 'wall', layer: 'wall', tags: ['glass', 'reflection'], w: 1, d: 1, wall: { w: 1, h: 2 }, defaultColor: C.brass, build() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(.4, .035, 8, 32), C.brass, 0, .5, .05); ring.userData.recolor = true; g.add(ring);
    const glass = mesh(new THREE.CylinderGeometry(.38, .38, .02, 32), 0xd8e6e4, 0, .5, .04); glass.rotation.x = Math.PI / 2;
    glass.material = material(0xd8e6e4).clone(); glass.material.roughness = .15; glass.material.metalness = .3; glass.userData.ownedMaterial = glass.material; g.add(glass);
    return g;
  }},
  macrame: { label: 'Hanging plant', category: 'wall', layer: 'wall', tags: ['plant', 'macrame', 'boho'], w: 1, d: 1, wall: { w: 1, h: 3 }, defaultColor: C.pot, build() {
    // Origin at the bottom of the footprint; the hook sits near the top row and the pot hangs below it.
    const g = new THREE.Group();
    g.add(box(.08, .05, .06, C.dark, 0, 1.42, .03, .01));
    const cord = 0xe6ccad;
    for (const a of [0, 2.1, 4.2]) g.add(cyl(.006, .006, .72, cord, Math.cos(a) * .07, .7, .12 + Math.sin(a) * .07));
    g.add(mesh(new THREE.TorusGeometry(.12, .008, 6, 16), cord, 0, .72, .12).rotateX(Math.PI / 2));
    const pot = cyl(.13, .1, .22, C.pot, 0, .52, .12); pot.userData.recolor = true; g.add(pot);
    g.add(cyl(.12, .12, .01, 0x5b4030, 0, .735, .12));
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, r = .1 + (i % 2) * .04;
      const vine = mesh(new THREE.SphereGeometry(1, 8, 6), i % 2 ? 0x6d8f50 : 0x4d7639, Math.cos(a) * r, .62 - (i % 3) * .14, .12 + Math.sin(a) * r);
      vine.scale.set(.05, .16, .05); vine.rotation.z = Math.cos(a) * .4; vine.rotation.x = -Math.sin(a) * .4; g.add(vine);
      const leaf = mesh(new THREE.SphereGeometry(1, 8, 6), 0x7fa05c, Math.cos(a) * (r + .06), .78, .12 + Math.sin(a) * (r + .06));
      leaf.scale.set(.07, .025, .11); leaf.rotation.y = -a; g.add(leaf);
    }
    return g;
  }},
  clock: { label: 'Wall clock', category: 'wall', layer: 'wall', tags: ['time'], w: 1, d: 1, wall: { w: 1, h: 1 }, defaultColor: C.dark, build() {
    const g = new THREE.Group();
    const rim = mesh(new THREE.CylinderGeometry(.23, .23, .05, 32), C.dark, 0, .25, .03); rim.rotation.x = Math.PI / 2; rim.userData.recolor = true; g.add(rim);
    const face = mesh(new THREE.CylinderGeometry(.2, .2, .01, 32), C.cream, 0, .25, .06); face.rotation.x = Math.PI / 2; g.add(face);
    g.add(box(.02, .12, .01, C.black, 0, .25, .07, .002), box(.09, .02, .01, C.black, .04, .24, .07, .002));
    return g;
  }},
};

// Japandi: low platforms, pale ash, charcoal upholstery, paper light.
const J = { ash: 0xd9c7a7, charcoal: 0x3f3d3a, paper: 0xfff1dc, moss: 0x5f7a4a };
const JAPANDI_CATALOG = {
  lowSofa: { label: 'Low sofa', category: 'seating', collection: 'japandi', tags: ['japandi', 'platform', 'couch'], w: 3, d: 1, defaultColor: J.charcoal, build() {
    const g = new THREE.Group();
    g.add(box(2.9, .16, .96, J.ash, 0, .06, 0, .02), box(2.9, .06, .06, J.ash, 0, 0, .45, .01));
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * .93;
      g.add(cushion(.88, .2, .78, J.charcoal, x, .22, .04));
      const back = cushion(.88, .42, .2, J.charcoal, x, .42, -.33); back.rotation.x = -.12; g.add(back);
    }
    g.add(box(.5, .3, .12, J.ash, -.9, .44, -.2, .06).rotateX(-.2));
    return g;
  }},
  lowTable: { label: 'Low table', category: 'tables', collection: 'japandi', tags: ['japandi', 'coffee table'], w: 2, d: 1, surface: { y: .4, slots: [{ x: -.5, z: 0 }, { x: .5, z: 0 }] }, build() {
    const g = new THREE.Group();
    g.add(box(1.8, .08, .8, J.ash, 0, .32, 0, .015));
    for (const x of [-.7, .7]) g.add(box(.1, .32, .7, J.ash, x, 0, 0, .01));
    return g;
  }},
  paperLamp: { label: 'Paper lamp', category: 'decor', collection: 'japandi', lamp: true, tags: ['japandi', 'light', 'lantern'], w: 1, d: 1, build() {
    const g = new THREE.Group();
    g.add(cyl(.2, .2, .03, J.charcoal), cyl(.02, .02, .55, J.charcoal, 0, .03, 0));
    const shade = cyl(.26, .26, .6, J.paper, 0, .55, 0);
    shade.material = material(J.paper).clone(); shade.material.emissive.setHex(0xffcf94); shade.material.emissiveIntensity = .3; shade.userData.ownedMaterial = shade.material; g.add(shade);
    for (const y of [.7, .85, 1.0]) g.add(mesh(new THREE.TorusGeometry(.265, .006, 4, 24), J.charcoal, 0, y, 0).rotateX(Math.PI / 2));
    const light = new THREE.PointLight(0xffd3a0, 2.2, 3.5, 2); light.position.set(0, .85, 0); g.add(light);
    return g;
  }},
  bonsai: { label: 'Bonsai', category: 'small', collection: 'japandi', layer: 'surface', tags: ['japandi', 'plant', 'tree'], w: 1, d: 1, defaultColor: J.charcoal, build() {
    const g = new THREE.Group();
    const pot = box(.28, .07, .18, J.charcoal, 0, 0, 0, .01); pot.userData.recolor = true; g.add(pot);
    g.add(box(.25, .01, .15, 0x5b4030, 0, .07, 0, .003));
    g.add(cyl(.012, .02, .12, 0x6b4a2e, -.02, .07, 0).rotateZ(.25), cyl(.008, .012, .1, 0x6b4a2e, .05, .14, 0).rotateZ(-.6));
    for (const [x, y, z, s] of [[-.07, .2, 0, .08], [.06, .17, .02, .06], [.11, .22, -.02, .05]]) {
      const pad = mesh(new THREE.SphereGeometry(1, 8, 6), J.moss, x, y, z); pad.scale.set(s, s * .45, s * .8); g.add(pad);
    }
    return g;
  }},
};

// Cottage: painted wood, rose and sage, soft rounded shapes.
const K = { paint: 0xa7b98e, rose: 0xd9a3a3, cream: 0xf6efe2, oak: 0xb4885a };
const COTTAGE_CATALOG = {
  floralArmchair: { label: 'Cottage armchair', category: 'seating', collection: 'cottage', tags: ['cottage', 'floral', 'chair'], w: 1, d: 1, defaultColor: K.rose, build() {
    const g = new THREE.Group(); legs(g, .6, .6, .14, K.oak);
    const seat = cushion(.9, .34, .9, K.rose, 0, .14, 0); g.add(seat);
    const back = cushion(.9, .5, .24, K.rose, 0, .46, -.33); back.rotation.x = -.1; g.add(back);
    for (const x of [-.38, .38]) g.add(cushion(.14, .28, .8, K.rose, x, .46, .02));
    g.add(box(.5, .18, .1, K.cream, 0, .5, -.16, .04).rotateX(-.2));
    return g;
  }},
  dresser: { label: 'Painted dresser', category: 'tables', collection: 'cottage', tags: ['cottage', 'drawers', 'storage'], w: 2, d: 1, defaultColor: K.paint, surface: { y: .92, slots: [{ x: -.55, z: 0 }, { x: .55, z: 0 }] }, build() {
    const g = new THREE.Group(); legs(g, 1.5, .45, .1, K.oak);
    const body = box(1.85, .8, .6, K.paint, 0, .1, 0, .02); body.userData.recolor = true; g.add(body);
    g.add(box(1.9, .04, .64, K.oak, 0, .9, 0, .01));
    for (const x of [-.46, .46]) for (const y of [.2, .55]) { g.add(box(.8, .26, .025, K.cream, x, y, .3, .01), cyl(.025, .025, .04, C.brass, x, y + .13, .33).rotateX(Math.PI / 2)); }
    return g;
  }},
  rockingChair: { label: 'Rocking chair', category: 'seating', collection: 'cottage', tags: ['cottage', 'porch', 'chair'], w: 1, d: 1, build() {
    const g = new THREE.Group();
    for (const x of [-.32, .32]) {
      // An arc of a torus, centred below its pivot so the lowest point rests on the floor, turned to run along z.
      const rocker = new THREE.Mesh(new THREE.TorusGeometry(.62, .025, 6, 24, 1.1, -Math.PI / 2 - .55), material(K.oak));
      rocker.position.set(x, .62, 0); rocker.rotation.y = Math.PI / 2; rocker.castShadow = rocker.receiveShadow = true; g.add(rocker);
      g.add(cyl(.025, .03, .34, K.oak, x, .1, .28), cyl(.025, .03, .34, K.oak, x, .1, -.28));
    }
    g.add(box(.72, .05, .66, K.oak, 0, .44, 0, .01));
    for (let i = 0; i < 5; i++) g.add(box(.05, .6, .05, K.oak, -.3 + i * .15, .49, -.3, .01).rotateX(-.15));
    g.add(box(.72, .05, .05, K.oak, 0, 1.0, -.38, .01));
    const pad = cushion(.62, .07, .56, K.rose, 0, .49, .02); g.add(pad);
    return g;
  }},
  teapot: { label: 'Teapot', category: 'small', collection: 'cottage', layer: 'surface', tags: ['cottage', 'tea', 'kitchen'], w: 1, d: 1, defaultColor: K.cream, build() {
    const g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(.1, 12, 8), K.cream, 0, .1, 0); body.scale.y = .85; body.userData.recolor = true; g.add(body);
    g.add(cyl(.04, .04, .01, K.cream, 0, 0, 0));
    g.add(cyl(.012, .02, .11, K.cream, .11, .1, 0).rotateZ(-.9));
    const handle = mesh(new THREE.TorusGeometry(.05, .01, 6, 12), K.cream, -.1, .1, 0); handle.userData.recolor = true; g.add(handle);
    g.add(cyl(.045, .05, .015, K.paint, 0, .18, 0), mesh(new THREE.SphereGeometry(.015, 6, 4), K.paint, 0, .205, 0));
    return g;
  }},
};

export const CATALOG = {
  // `model` names a game-ready glb (see docs/PROP_BRIEFS.md); build() falls back to the procedural shape if it did not load.
  sofa: { label: 'Sofa', category: 'seating', w: 3, d: 1, model: 'models/sofa.glb', build: () => modelInstance('sofa') || seating(true) },
  armchair: { label: 'Armchair', category: 'seating', w: 1, d: 1, build: () => seating(false) },
  coffeeTable: { label: 'Coffee table', category: 'tables', w: 2, d: 1, surface: { y: .56, slots: [{ x: -.62, z: .25 }, { x: .02, z: -.32 }] }, build() {
    const g = new THREE.Group(); legs(g, 1.25, .52, .47);
    const top = cyl(.5, .5, .09, C.wood, 0, .47, 0); top.scale.x = 1.7; g.add(top);
    g.add(box(.4, .04, .3, 0xe4d2b6, .25, .56, .03), box(.36, .035, .27, 0x8d9b79, .23, .6, .03));
    const plant = smallPlant(.25); plant.position.set(-.3, .56, -.04); g.add(plant);
    g.add(cyl(.08, .065, .1, C.cream, .44, .635, .03)); return g;
  }},
  bookshelf: { label: 'Bookshelf', category: 'decor', w: 2, d: 1, surface: { y: .815, slots: [{ x: .45, z: .02 }, { x: -.26, z: .02, y: 1.335 }, { x: .1, z: .02, y: 1.865 }] }, build() {
    const g = new THREE.Group(); legs(g, 1.7, .45, .12);
    g.add(box(1.86, .65, .65, C.wood, 0, .1, 0), box(1.7, 1.55, .04, C.dark, 0, .76, -.29));
    for (const x of [-.9, .9]) g.add(box(.075, 1.66, .6, C.wood, x, .74, 0));
    for (const y of [.75, 1.27, 1.8, 2.32]) g.add(box(1.85, .065, .62, C.wood, 0, y, 0));
    for (const x of [-.46, .46]) { g.add(box(.85, .5, .025, 0xad7448, x, .19, .34), box(.22, .025, .04, C.brass, x, .56, .365)); }
    books(g, .82, -.72, 6); books(g, 1.34, -.05, 7); books(g, 1.87, -.72, 5);
    const plant = smallPlant(.36); plant.position.set(.55, 1.86, 0); g.add(plant);
    g.add(cyl(.12, .09, .23, C.cream, -.55, 1.34, 0)); return g;
  }},
  plant: { label: 'Plant', category: 'decor', w: 1, d: 1, build: () => smallPlant(1.3) },
  floorLamp: { label: 'Floor lamp', category: 'decor', lamp: true, w: 1, d: 1, build() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, leg = cyl(.025, .035, 1.36, C.wood);
      leg.position.set(Math.cos(a) * .12, .69, Math.sin(a) * .12); leg.rotation.z = Math.sin(a) * .16; leg.rotation.x = Math.cos(a) * .16; g.add(leg);
    }
    const shade = cyl(.24, .36, .42, 0xffebc4, 0, 1.3, 0);
    // The glowing shade is the one furniture part with its own material, so it is owned and disposed with the lamp.
    const glow = ownMaterial(shade, material(0xffebc4).clone()); glow.emissive.setHex(0xffcc85); glow.emissiveIntensity = .22; g.add(shade);
    const light = new THREE.PointLight(0xffbd73, 3, 4, 2); light.position.set(0, 1.45, 0); g.add(light); return g;
  }},
  rug: { label: 'Rug', category: 'decor', w: 4, d: 3, layer: 'floor', build() {
    const g = new THREE.Group(), rug = box(3.85, .028, 2.85, 0xf1ddbd, 0, .012, 0, .025); rug.castShadow = false; rug.userData.recolor = true; g.add(rug);
    for (let i = 0; i < 38; i++) for (const z of [-1.48, 1.48]) g.add(box(.028, .015, .14, 0xe6ceaa, -1.8 + i * .097, .012, z, .005));
    for (const z of [-1.28, 1.28]) g.add(box(3.62, .006, .018, 0xd5ba96, 0, .043, z, .003)); return g;
  }},
  desk: { label: 'Desk', category: 'tables', w: 2, d: 1, surface: { y: .875, slots: [{ x: .7, z: -.25 }, { x: .7, z: .25 }, { x: -.65, z: .25 }] }, build() {
    const g = new THREE.Group(); g.add(box(1.9, .095, .86, C.wood, 0, .78, 0));
    g.add(box(.47, .76, .75, C.wood, .65, .02, 0));
    for (const y of [.08, .33, .58]) { g.add(box(.43, .21, .025, 0xc38a56, .65, y, .39), box(.13, .02, .025, C.brass, .65, y + .16, .415)); }
    for (const z of [-.32, .32]) g.add(box(.06, .78, .06, C.wood, -.8, 0, z));
    g.add(box(.1, .13, .1, C.cream, -.2, .875, -.17), box(.63, .39, .035, C.cream, -.2, 1, -.19), box(.57, .32, .012, 0x9ea6a0, -.2, 1.035, -.166), box(.48, .025, .17, 0xe6ded1, -.2, .88, .12));
    const plant = smallPlant(.3); plant.position.set(-.7, .88, -.13); g.add(plant); return g;
  }},
  chair: { label: 'Office chair', category: 'seating', w: 1, d: 1, build() {
    const g = new THREE.Group(); g.add(cyl(.27, .3, .04, C.black), cyl(.035, .035, .43, C.black, 0, .04, 0));
    g.add(cushion(.55, .12, .55, C.dark, 0, .47, 0), cushion(.55, .57, .12, C.dark, 0, .55, -.23)); return g;
  }},
  ottoman: { label: 'Ottoman', category: 'seating', w: 1, d: 1, build() {
    const g = new THREE.Group(); legs(g, .65, .65, .1); g.add(cushion(.87, .36, .87, 0x976444, 0, .1, 0)); return g;
  }},
  sideboard: { label: 'Sideboard', category: 'tables', w: 2, d: 1, surface: { y: .85, slots: [{ x: -.15, z: -.18 }, { x: -.15, z: .2 }] }, build() {
    const g = new THREE.Group(); legs(g, 1.6, .5, .2); g.add(box(1.85, .65, .65, C.wood, 0, .2, 0));
    for (const x of [-.6, 0, .6]) { g.add(box(.56, .53, .03, 0xc58a5c, x, .26, .34), cyl(.025, .025, .03, C.brass, x, .65, .37).rotateX(Math.PI / 2)); }
    const plant = smallPlant(.45); plant.position.set(-.58, .85, 0); g.add(plant); books(g, .85, .15, 5); return g;
  }},
  tvStand: { label: 'TV stand', category: 'tables', w: 2, d: 1, surface: { y: .57, slots: [{ x: -.65, z: .15 }, { x: .65, z: .15 }] }, build() {
    const g = new THREE.Group(); legs(g, 1.6, .5, .15); g.add(box(1.85, .42, .65, C.wood, 0, .15, 0));
    g.add(box(.08, .12, .08, C.black, 0, .57, 0), box(1.35, .78, .055, C.black, 0, .66, -.12), box(1.26, .69, .01, 0x4b5d58, 0, .705, -.085)); return g;
  }},
  boxes: { label: 'Moving box', category: 'decor', w: 1, d: 1, build() {
    const g = new THREE.Group(); g.add(box(.7, .6, .7, 0xc89b68), box(.71, .012, .12, 0xe6c397, 0, .6, 0)); return g;
  }},
  bed: { label: 'Bed', category: 'seating', tags: ['bedroom', 'sleep', 'double'], w: 2, d: 3, defaultColor: C.cream, build() {
    const g = new THREE.Group(); legs(g, 1.7, 2.7, .18, C.dark);
    g.add(box(1.92, .22, 2.92, C.wood, 0, .18, 0, .03));                          // frame
    const mattress = cushion(1.8, .26, 2.7, C.cream, 0, .4, .05); g.add(mattress);
    g.add(box(1.92, .9, .12, C.wood, 0, .18, -1.4, .03));                           // headboard
    for (const x of [-.45, .45]) { const p = cushion(.72, .16, .44, C.cream, x, .66, -1.05); p.rotation.x = -.12; g.add(p); }
    const blanket = cushion(1.84, .12, 1.5, C.sage, 0, .64, .62); g.add(blanket);
    const fold = cushion(1.84, .1, .3, C.sage, 0, .74, -.08); g.add(fold);
    return g;
  }},
  nightstand: { label: 'Nightstand', category: 'tables', tags: ['bedroom', 'bedside', 'drawer'], w: 1, d: 1, surface: { y: .58, slots: [{ x: 0, z: -.02 }] }, build() {
    const g = new THREE.Group(); legs(g, .44, .36, .12);
    g.add(box(.6, .46, .5, C.wood, 0, .12, 0, .02));
    g.add(box(.5, .18, .025, 0xc38a56, 0, .32, .25, .006), box(.12, .02, .025, C.brass, 0, .4, .262));
    return g;
  }},
  wardrobe: { label: 'Wardrobe', category: 'decor', tags: ['bedroom', 'storage', 'closet'], w: 2, d: 1, build() {
    const g = new THREE.Group();
    g.add(box(1.85, 2.15, .62, C.wood, 0, .05, 0, .02), box(1.9, .05, .66, C.wood, 0, 2.2, 0, .01), box(1.85, .05, .62, C.dark, 0, 0, 0, .01));
    for (const x of [-.46, .46]) {
      g.add(box(.84, 1.95, .03, 0xc38a56, x, .12, .31, .01));
      g.add(cyl(.025, .025, .04, C.brass, x - Math.sign(x) * .36, 1.05, .33).rotateX(Math.PI / 2));
    }
    return g;
  }},
  planter: { label: 'Planter box', category: 'decor', tags: ['plant', 'flowers', 'balcony', 'garden'], w: 2, d: 1, defaultColor: C.wood, build() {
    const g = new THREE.Group();
    const boxMesh = box(1.8, .5, .6, C.wood, 0, 0, 0, .02); boxMesh.userData.recolor = true; g.add(boxMesh);
    g.add(box(1.66, .04, .46, 0x5b4030, 0, .48, 0, .01));
    for (let i = 0; i < 6; i++) {
      const x = -.7 + i * .28, z = (i % 2 ? .12 : -.12);
      g.add(mesh(new THREE.SphereGeometry(.14, 8, 6), i % 2 ? 0x6f965a : 0x8daa6a, x, .6, z));
      g.add(mesh(new THREE.SphereGeometry(.06, 8, 6), [0xd79c9c, 0xe9bd6c, 0xf3e4d2][i % 3], x + .04, .76, z - .02));
    }
    return g;
  }},
  bench: { label: 'Bench', category: 'seating', tags: ['seat', 'wood'], w: 2, d: 1, defaultColor: C.sage, build() {
    const g = new THREE.Group(); legs(g, 1.6, .5, .4, C.dark);
    g.add(box(1.85, .07, .6, C.wood, 0, .4, 0, .02));
    g.add(cushion(1.7, .12, .5, C.sage, 0, .47, 0));
    g.add(box(.06, .06, .5, C.dark, -.86, .2, 0, .01), box(.06, .06, .5, C.dark, .86, .2, 0, .01));
    return g;
  }},
  sideTable: { label: 'Side table', category: 'tables', tags: ['round', 'small table'], w: 1, d: 1, surface: { y: .55, slots: [{ x: 0, z: 0 }] }, build() {
    const g = new THREE.Group();
    g.add(cyl(.34, .34, .06, C.wood, 0, .49, 0), cyl(.04, .05, .49, C.dark, 0, 0, 0), cyl(.2, .22, .03, C.dark, 0, 0, 0));
    return g;
  }},
  pouf: { label: 'Pouf', category: 'seating', tags: ['cushion', 'floor', 'soft'], w: 1, d: 1, defaultColor: C.cream, build() {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(.36, .4, .36, 16), C.cream, 0, .18, 0); body.userData.recolor = true; g.add(body);
    const top = mesh(new THREE.SphereGeometry(.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.cream, 0, .34, 0); top.scale.y = .25; top.userData.recolor = true; g.add(top);
    g.add(mesh(new THREE.TorusGeometry(.36, .018, 6, 24), 0xd9b48f, 0, .36, 0).rotateX(Math.PI / 2));
    return g;
  }},
  basket: { label: 'Woven basket', category: 'decor', tags: ['storage', 'blanket', 'rattan'], w: 1, d: 1, defaultColor: C.sage, build() {
    const g = new THREE.Group();
    g.add(cyl(.3, .25, .42, 0xc8a06c, 0, 0, 0));
    for (let i = 1; i < 6; i++) g.add(mesh(new THREE.TorusGeometry(.26 + i * .008, .012, 5, 20), 0xb98b58, 0, i * .07, 0).rotateX(Math.PI / 2));
    const blanket = mesh(new THREE.SphereGeometry(.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.sage, 0, .4, 0); blanket.scale.y = .45; blanket.userData.recolor = true; g.add(blanket);
    const fold = mesh(new THREE.TorusGeometry(.17, .05, 6, 16), C.sage, .05, .47, -.04); fold.rotation.x = Math.PI / 2; fold.scale.z = .6; fold.userData.recolor = true; g.add(fold);
    return g;
  }},
  ...PLANT_CATALOG,
  ...SMALL_CATALOG,
  ...WALL_CATALOG,
  ...JAPANDI_CATALOG,
  ...COTTAGE_CATALOG,
};
// Entries that name no collection belong to the default Nest classics set.
for (const def of Object.values(CATALOG)) def.collection ??= DEFAULT_COLLECTION;

export const recolor = recolorModel;
