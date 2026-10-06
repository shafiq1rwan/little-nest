// The "Modern home" collection: Kenney's Furniture Kit (CC0, www.kenney.nl), imported by
// tools/blender/import-kenney.py into public/models/kit*.glb and src/data/kenney-catalog.json.
// This module turns that data into catalog entries. Keys start with "kit" and are stored in saved
// rooms: never rename them. Regenerate the data with the importer, not by hand.

import * as THREE from 'three';
import data from './data/kenney-catalog.json';
import { sharedMaterial } from './scene/geometry.js';
import { modelInstance } from './scene/models.js';

/** A plain box of the item's size, used only if its model file failed to load. */
function placeholder({ size: [w, d, h], layer }) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sharedMaterial(0xc8925e));
  m.position.set(0, h / 2, layer === 'wall' ? d / 2 : 0);
  m.castShadow = m.receiveShadow = true; g.add(m);
  return g;
}

/** Catalog entries for the kit. `withLight` and `withGlow` come from props.js. */
export function kenneyCatalog({ withLight, withGlow }) {
  const out = {};
  for (const e of data) {
    const def = {
      label: e.label, category: e.category, collection: 'modern', tags: ['modern', ...e.tags], w: e.w, d: e.d,
      model: 'models/' + e.key + '.glb',
    };
    if (e.layer) def.layer = e.layer;
    if (e.wall) def.wall = e.wall;
    if (e.surface) def.surface = e.surface;
    if (e.surfaceKind) def.surfaceKind = e.surfaceKind;
    if (e.defaultColor !== undefined) def.defaultColor = e.defaultColor;
    if (e.lamp) def.lamp = true;
    const h = e.size[2];
    def.build = () => {
      let g = modelInstance(e.key);
      if (g && e.lamp === 'lamp') g = withLight(g, { color: 0xffcf94, intensity: 2.4, distance: 3.5, y: h * 0.85, emissive: 0xffcc85, glow: .3 });
      else if (g && e.lamp) g = withGlow(g, { emissive: 0xffcf94, intensity: .6 });
      return g || placeholder(e);
    };
    out[e.key] = def;
  }
  return out;
}

export const KENNEY_KEYS = data.map((e) => e.key);
