// Pure placement rules: footprints, bounds, occupancy, surfaces, walls, and grid/world conversion.
// No Three.js and no DOM, so these run in Node for unit tests.
//
// catalog: { [type]: { w, d, layer?, surface?, wall? } }
// The room is `width` cells along x and `depth` cells along z; configure() changes it in place so
// every holder of this placement (state, parsers, the HUD) sees the new size.

export function cellKey(gx, gz) {
  return gx + ',' + gz;
}

export const WALLS = ['back', 'left'];

export function wallKey(wall, col, row) {
  return wall + ':' + col + ',' + row;
}

export function createPlacement({ catalog, room = 8, width = room, depth = room, cell = 1, wallRows = 8, wallRow = 0.5 }) {
  const dims = { width, depth, wallRows };
  const halfW = () => (dims.width * cell) / 2;
  const halfD = () => (dims.depth * cell) / 2;

  /** Changes the room size. Existing records are the caller's responsibility (clear first). */
  function configure({ width: w = dims.width, depth: d = dims.depth, wallRows: r = dims.wallRows }) {
    dims.width = w; dims.depth = d; dims.wallRows = r;
  }

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
    return gx >= 0 && gz >= 0 && gx + w <= dims.width && gz + d <= dims.depth;
  }

  /** Floor-layer items (rugs), surface items, and wall items never occupy floor cells. */
  function occupies(type) {
    const layer = catalog[type].layer;
    return layer !== 'floor' && layer !== 'surface' && layer !== 'wall';
  }
  /** Surface items live on a supporting item's slots rather than the floor grid. */
  /** Lamps can be switched on and off. */
  function isLamp(type) {
    return !!catalog[type].lamp;
  }
  function isSurfaceItem(type) {
    return catalog[type].layer === 'surface';
  }
  /** Surface items and surfaces each have a kind: 'table' (default) or 'seat'. An item only sits on a matching surface. */
  function surfaceKindOf(type) {
    return catalog[type]?.surfaceKind ?? 'table';
  }
  function acceptsOn(type, parentType) {
    const s = surfaceOf(parentType);
    return !!s && isSurfaceItem(type) && (s.kind ?? 'table') === surfaceKindOf(type);
  }
  /** Surface definition { y, slots: [{ x, z, y? }] } in the supporter's local space, or null. */
  function surfaceOf(type) {
    return catalog[type]?.surface ?? null;
  }
  function slotCount(type) {
    return surfaceOf(type)?.slots.length ?? 0;
  }
  /** Local position of a slot on a supporter, or null when the slot does not exist. A slot may override the surface height. */
  function slotLocal(type, slot) {
    const s = surfaceOf(type);
    if (!s || !Number.isInteger(slot) || slot < 0 || slot >= s.slots.length) return null;
    return { x: s.slots[slot].x, y: s.slots[slot].y ?? s.y, z: s.slots[slot].z };
  }
  /** Index of the slot closest to a point in the supporter's local space, or -1 without a surface. */
  function nearestSlot(type, local) {
    const s = surfaceOf(type);
    if (!s) return -1;
    let best = -1, bestD = Infinity;
    s.slots.forEach((p, i) => {
      const d = (p.x - local.x) ** 2 + (p.z - local.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
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
    return { x: -halfW() + (gx + w / 2) * cell, y: 0, z: -halfD() + (gz + d / 2) * cell };
  }

  /** Nearest grid origin for a footprint centred on a world-space point. */
  function snap(point, type, rot) {
    const { w, d } = footprint(type, rot);
    return {
      gx: Math.round((point.x + halfW()) / cell - w / 2) || 0,   // "|| 0" turns -0 into 0
      gz: Math.round((point.z + halfD()) / cell - d / 2) || 0,
    };
  }

  // ----- walls: the back wall has `width` columns, the left wall `depth`; both have `wallRows` rows -----
  function wallColumns(wall) {
    return wall === 'back' ? dims.width : dims.depth;
  }
  function isWallItem(type) {
    return catalog[type].layer === 'wall';
  }
  /** Wall footprint { w, h } in columns and rows, or null for non-wall items. */
  function wallSize(type) {
    return isWallItem(type) ? { w: catalog[type].wall?.w ?? catalog[type].w, h: catalog[type].wall?.h ?? 1 } : null;
  }
  function wallCellsOf(wall, col, row, w, h) {
    const cells = [];
    for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) cells.push(wallKey(wall, col + c, row + r));
    return cells;
  }
  function wallInBounds(col, row, w, h, wall = 'back') {
    return col >= 0 && row >= 0 && col + w <= wallColumns(wall) && row + h <= dims.wallRows;
  }
  /** Whether a wall item fits at col/row without overlapping `occupancy` or `blocked` cell keys. */
  function wallFree(occupancy, blocked, type, wall, col, row, ignore = null) {
    const size = wallSize(type);
    if (!size || !WALLS.includes(wall) || !wallInBounds(col, row, size.w, size.h, wall)) return false;
    return wallCellsOf(wall, col, row, size.w, size.h).every((c) => !blocked.has(c) && (!occupancy.has(c) || (ignore && ignore.has(c))));
  }
  /** World placement of a wall item: position of its bottom-centre on the wall face and its yaw. */
  function wallWorld(type, wall, col, row) {
    const { w } = wallSize(type);
    const y = row * wallRow;
    return wall === 'back'
      ? { x: -halfW() + (col + w / 2) * cell, y, z: -halfD(), rotY: 0 }
      : { x: -halfW(), y, z: -halfD() + (col + w / 2) * cell, rotY: Math.PI / 2 };
  }
  /** Nearest col/row for a wall item centred on a world point that lies on the wall. */
  function wallSnap(type, wall, point) {
    const { w, h } = wallSize(type);
    const along = wall === 'back' ? point.x + halfW() : point.z + halfD();
    return {
      col: Math.round(along / cell - w / 2) || 0,
      row: Math.round(point.y / wallRow - h / 2) || 0,
    };
  }
  /**
   * Wall cells covered by fixtures such as windows. Each fixture is { wall, from, to, bottom, top } in
   * world units along the wall (from/to) and height (bottom/top).
   */
  function blockedWallCells(fixtures) {
    const blocked = new Set();
    for (const f of fixtures) {
      const half = f.wall === 'back' ? halfW() : halfD();
      for (let c = 0; c < wallColumns(f.wall); c++) {
        const a0 = -half + c * cell, a1 = a0 + cell;
        if (a1 <= f.from || a0 >= f.to) continue;
        for (let r = 0; r < dims.wallRows; r++) {
          const y0 = r * wallRow, y1 = y0 + wallRow;
          if (y1 <= f.bottom || y0 >= f.top) continue;
          blocked.add(wallKey(f.wall, c, r));
        }
      }
    }
    return blocked;
  }

  return {
    get room() { return Math.max(dims.width, dims.depth); },
    get width() { return dims.width; },
    get depth() { return dims.depth; },
    get half() { return halfW(); },
    get halfW() { return halfW(); },
    get halfD() { return halfD(); },
    get wallRows() { return dims.wallRows; },
    cell, wallRow, configure,
    footprint, cellsOf, inBounds, occupies, isFree, worldPos, snap,
    isLamp, isSurfaceItem, surfaceKindOf, acceptsOn, surfaceOf, slotCount, slotLocal, nearestSlot,
    isWallItem, wallSize, wallColumns, wallCellsOf, wallInBounds, wallFree, wallWorld, wallSnap, blockedWallCells,
  };
}
