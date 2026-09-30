import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLANT_CATALOG } from './plants.js';

const C = { cream: 0xf3e4d2, wood: 0xb87946, dark: 0x694b35, sage: 0x81936a, green: 0x4d7639, pot: 0xeee0ca, black: 0x393932, brass: 0xbb9451 };
const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 }));
  return materials.get(color);
}
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
export const CATALOG = {
  sofa: { label: 'Sofa', category: 'seating', w: 3, d: 1, build: () => seating(true) },
  armchair: { label: 'Armchair', category: 'seating', w: 1, d: 1, build: () => seating(false) },
  coffeeTable: { label: 'Coffee table', category: 'tables', w: 2, d: 1, build() {
    const g = new THREE.Group(); legs(g, 1.25, .52, .47);
    const top = cyl(.5, .5, .09, C.wood, 0, .47, 0); top.scale.x = 1.7; g.add(top);
    g.add(box(.4, .04, .3, 0xe4d2b6, .25, .56, .03), box(.36, .035, .27, 0x8d9b79, .23, .6, .03));
    const plant = smallPlant(.25); plant.position.set(-.3, .56, -.04); g.add(plant);
    g.add(cyl(.08, .065, .1, C.cream, .44, .635, .03)); return g;
  }},
  bookshelf: { label: 'Bookshelf', category: 'decor', w: 2, d: 1, build() {
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
  floorLamp: { label: 'Floor lamp', category: 'decor', w: 1, d: 1, build() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, leg = cyl(.025, .035, 1.36, C.wood);
      leg.position.set(Math.cos(a) * .12, .69, Math.sin(a) * .12); leg.rotation.z = Math.sin(a) * .16; leg.rotation.x = Math.cos(a) * .16; g.add(leg);
    }
    const shade = cyl(.24, .36, .42, 0xffebc4, 0, 1.3, 0);
    shade.material = material(0xffebc4).clone(); shade.material.emissive.setHex(0xffcc85); shade.material.emissiveIntensity = .22; g.add(shade);
    const light = new THREE.PointLight(0xffbd73, 3, 4, 2); light.position.set(0, 1.45, 0); g.add(light); return g;
  }},
  rug: { label: 'Rug', category: 'decor', w: 4, d: 3, layer: 'floor', build() {
    const g = new THREE.Group(), rug = box(3.85, .028, 2.85, 0xf1ddbd, 0, .012, 0, .025); rug.castShadow = false; rug.userData.recolor = true; g.add(rug);
    for (let i = 0; i < 38; i++) for (const z of [-1.48, 1.48]) g.add(box(.028, .015, .14, 0xe6ceaa, -1.8 + i * .097, .012, z, .005));
    for (const z of [-1.28, 1.28]) g.add(box(3.62, .006, .018, 0xd5ba96, 0, .043, z, .003)); return g;
  }},
  desk: { label: 'Desk', category: 'tables', w: 2, d: 1, build() {
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
  sideboard: { label: 'Sideboard', category: 'tables', w: 2, d: 1, build() {
    const g = new THREE.Group(); legs(g, 1.6, .5, .2); g.add(box(1.85, .65, .65, C.wood, 0, .2, 0));
    for (const x of [-.6, 0, .6]) { g.add(box(.56, .53, .03, 0xc58a5c, x, .26, .34), cyl(.025, .025, .03, C.brass, x, .65, .37).rotateX(Math.PI / 2)); }
    const plant = smallPlant(.45); plant.position.set(-.58, .85, 0); g.add(plant); books(g, .85, .15, 5); return g;
  }},
  tvStand: { label: 'TV stand', category: 'tables', w: 2, d: 1, build() {
    const g = new THREE.Group(); legs(g, 1.6, .5, .15); g.add(box(1.85, .42, .65, C.wood, 0, .15, 0));
    g.add(box(.08, .12, .08, C.black, 0, .57, 0), box(1.35, .78, .055, C.black, 0, .66, -.12), box(1.26, .69, .01, 0x4b5d58, 0, .705, -.085)); return g;
  }},
  boxes: { label: 'Moving box', category: 'decor', w: 1, d: 1, build() {
    const g = new THREE.Group(); g.add(box(.7, .6, .7, 0xc89b68), box(.71, .012, .12, 0xe6c397, 0, .6, 0)); return g;
  }},
  ...PLANT_CATALOG,
};

export function recolor(group, color) {
  group.traverse(o => { if (o.isMesh && o.userData.recolor) {
    const next = o.material.clone(); next.color.setHex(color);
    if (o.userData.ownedMaterial) o.userData.ownedMaterial.dispose();
    o.material = next; o.userData.ownedMaterial = next;
    if (o.userData.base) o.userData.base = next;
  } });
}
