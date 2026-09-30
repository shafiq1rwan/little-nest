// Pure placement rules: footprints, bounds, occupancy, and grid/world conversion.
// No Three.js and no DOM, so these run in Node for unit tests.
//
// catalog: { [type]: { w, d, layer? } }   room: cells per side   cell: world units per cell

export function cellKey(gx, gz) {
  return gx + ',' + gz;
}

export function createPlacement({ catalog, room, cell = 1 }) {
  const half = (room * cell) / 2;

  function footprint(type, rot) {
    const def = catalog[type];
    return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
  }

  function cellsOf(type, gx, gz, rot) {
    const { w, d } = footprint(type, rot);
    const cells = [];
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) cells.push(cellKey(gx + x, gz + z));
    return { cells, w, d };
  }

  function inBounds(gx, gz, w, d) {
    return gx >= 0 && gz >= 0 && gx + w <= room && gz + d <= room;
  }

  /** Floor-layer items (rugs) never occupy cells, so furniture can sit on them. */
  function occupies(type) {
    return catalog[type].layer !== 'floor';
  }

  /**
   * Whether the footprint fits inside the room without overlapping `occupancy`
   * (a Set of cell keys). `ignore` is an optional Set of cell keys to treat as free,
   * used while an item is being moved or rotated in place.
   */
  function isFree(occupancy, type, gx, gz, rot, ignore = null) {
    const { cells, w, d } = cellsOf(type, gx, gz, rot);
    if (!inBounds(gx, gz, w, d)) return false;
    if (!occupies(type)) return true;
    return cells.every((c) => !occupancy.has(c) || (ignore && ignore.has(c)));
  }

  /** World-space floor centre of a footprint as a plain object. */
  function worldPos(type, gx, gz, rot) {
    const { w, d } = footprint(type, rot);
    return { x: -half + (gx + w / 2) * cell, y: 0, z: -half + (gz + d / 2) * cell };
  }

  /** Nearest grid origin for a footprint centred on a world-space point. */
  function snap(point, type, rot) {
    const { w, d } = footprint(type, rot);
    return {
      gx: Math.round((point.x + half) / cell - w / 2),
      gz: Math.round((point.z + half) / cell - d / 2),
    };
  }

  return { room, cell, half, footprint, cellsOf, inBounds, occupies, isFree, worldPos, snap };
}
