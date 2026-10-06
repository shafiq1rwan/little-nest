// Room presets: shell dimensions, window layout, and the starter layout for each.
// Coordinates are grid cells; rot is quarter turns. Small items sit on a supporter: give the
// supporter a `key` and the small item `on: key, slot`. Wall items use wall/col/row.
// Windows are centred `at` world units along their wall (0 is the wall's middle) with a width in units.
// `walls: 'railing'` swaps the two walls for low railings (open air): nothing can be wall-mounted there.
// `door: { wall, end }` puts a door on a wall, at its 'front' (left wall, +z) or 'back'/'right' end; residents come and go
// through it. Door cells refuse new wall decorations but never invalidate a saved room.
// Keys are stored in saved rooms: never rename them; add migrations before removing one.

export const WALL_HEIGHT = 4;
export const MIN_ROOM_SIZE = 4;
export const MAX_ROOM_SIZE = 12;

export const ROOM_PRESETS = {
  livingRoom: {
    name: 'Living room',
    blurb: 'A sunny corner room with a sofa, a desk, and plenty of plants.',
    width: 8, depth: 8,
    pet: 'ginger',   // the starter room comes with a cat
    windows: [{ wall: 'back', at: -1.5, width: 4.7 }, { wall: 'left', at: -1.9, width: 3.9 }],
    door: { wall: 'left', end: 'front' },
    residents: 2,   // two people live here
    lights: true,
    items: [
      { type: 'rug', gx: 2, gz: 3, rot: 0 },
      { type: 'sofa', gx: 2, gz: 1, rot: 0, key: 'sofa' },
      { type: 'pillow', on: 'sofa', slot: 0, rot: 0, color: 0xbf895c },
      { type: 'pillow', on: 'sofa', slot: 2, rot: 0 },
      { type: 'coffeeTable', gx: 3, gz: 4, rot: 0, key: 'coffeeTable' },
      { type: 'mug', on: 'coffeeTable', slot: 0, rot: 0 },
      { type: 'armchair', gx: 6, gz: 3, rot: 3, color: 0x81936a, select: true },
      { type: 'armchair', gx: 2, gz: 6, rot: 2 },
      { type: 'bookshelf', gx: 6, gz: 0, rot: 0 },
      { type: 'floorLamp', gx: 5, gz: 1, rot: 0 },
      { type: 'sideboard', gx: 0, gz: 4, rot: 1 },
      { type: 'desk', gx: 3, gz: 7, rot: 2, key: 'desk' },
      { type: 'frame', on: 'desk', slot: 0, rot: 0 },
      { type: 'chair', gx: 4, gz: 6, rot: 2 },
      { type: 'sideboard', gx: 6, gz: 7, rot: 0 },
      { type: 'rubberTree', gx: 0, gz: 0, rot: 0 },
      { type: 'palm', gx: 5, gz: 0, rot: 0 },
      { type: 'snakePlant', gx: 7, gz: 5, rot: 0 },
      { type: 'plant', gx: 6, gz: 6, rot: 0 },
      { type: 'cactus', gx: 1, gz: 7, rot: 0 },
      { type: 'worldMap', wall: 'back', col: 5, row: 3 },
      { type: 'botanicalPrint', wall: 'left', col: 5, row: 4 },
    ],
  },
  studio: {
    name: 'Studio',
    blurb: 'A compact work-and-rest space with a desk by the window.',
    width: 6, depth: 6,
    windows: [{ wall: 'left', at: 0, width: 3.2 }],
    door: { wall: 'left', end: 'front' },
    lights: false,
    items: [
      { type: 'rug', gx: 1, gz: 2, rot: 0 },
      { type: 'desk', gx: 0, gz: 0, rot: 0, key: 'desk' },
      { type: 'lantern', on: 'desk', slot: 1, rot: 0 },
      { type: 'chair', gx: 1, gz: 1, rot: 0, select: true },
      { type: 'bookshelf', gx: 4, gz: 0, rot: 0 },
      { type: 'sofa', gx: 2, gz: 5, rot: 2 },
      { type: 'sideTable', gx: 5, gz: 5, rot: 0, key: 'sideTable' },
      { type: 'mug', on: 'sideTable', slot: 0, rot: 0 },
      { type: 'monstera', gx: 3, gz: 0, rot: 0 },
      { type: 'basket', gx: 5, gz: 4, rot: 0 },
      { type: 'clock', wall: 'back', col: 2, row: 6 },
      { type: 'wallShelf', wall: 'back', col: 0, row: 5, key: 'shelf' },
      { type: 'succulent', on: 'shelf', slot: 0, rot: 0 },
      { type: 'bookStack', on: 'shelf', slot: 1, rot: 0 },
    ],
  },
  bedroom: {
    name: 'Bedroom',
    blurb: 'A restful room with a double bed, a wardrobe, and a reading chair.',
    width: 7, depth: 7,
    windows: [{ wall: 'left', at: 0, width: 3 }],
    door: { wall: 'left', end: 'back' },
    lights: false,
    items: [
      { type: 'bed', gx: 1, gz: 0, rot: 0, select: true },   // one cell in from the corner: the door is behind it
      { type: 'nightstand', gx: 3, gz: 0, rot: 0, key: 'nightstand' },
      { type: 'lantern', on: 'nightstand', slot: 0, rot: 0 },
      { type: 'wardrobe', gx: 5, gz: 0, rot: 0 },
      { type: 'rug', gx: 1, gz: 3, rot: 0 },
      { type: 'armchair', gx: 6, gz: 4, rot: 3, color: 0xc38e62 },
      { type: 'fern', gx: 6, gz: 6, rot: 0 },
      { type: 'sideboard', gx: 3, gz: 6, rot: 2, key: 'sideboard' },
      { type: 'frame', on: 'sideboard', slot: 0, rot: 0 },
      { type: 'basket', gx: 0, gz: 6, rot: 0 },
      { type: 'botanicalPrint', wall: 'back', col: 4, row: 4 },
      { type: 'mirror', wall: 'left', col: 6, row: 3 },
      { type: 'macrame', wall: 'back', col: 6, row: 4 },
    ],
  },
  balcony: {
    name: 'Balcony',
    blurb: 'An open-air corner with railings, planters, and a bench in the sun.',
    width: 6, depth: 4,
    walls: 'railing',
    windows: [],
    lights: false,
    items: [
      { type: 'rug', gx: 1, gz: 1, rot: 0 },
      { type: 'bench', gx: 0, gz: 0, rot: 0, select: true },
      { type: 'planter', gx: 2, gz: 0, rot: 0 },
      { type: 'planter', gx: 4, gz: 0, rot: 0 },
      { type: 'sideTable', gx: 5, gz: 3, rot: 0, key: 'sideTable' },
      { type: 'lantern', on: 'sideTable', slot: 0, rot: 0 },
      { type: 'pouf', gx: 4, gz: 3, rot: 0 },
      { type: 'palm', gx: 0, gz: 3, rot: 0 },
      { type: 'basket', gx: 1, gz: 3, rot: 0 },
    ],
  },
  readingNook: {
    name: 'Reading nook',
    blurb: 'A small, quiet corner for an armchair, a lamp, and your books.',
    width: 5, depth: 5,
    windows: [{ wall: 'back', at: 0.5, width: 2.6 }],
    door: { wall: 'left', end: 'front' },
    lights: true,
    items: [
      { type: 'rug', gx: 0, gz: 1, rot: 0 },
      { type: 'armchair', gx: 1, gz: 2, rot: 0, color: 0x81936a, select: true },
      { type: 'floorLamp', gx: 0, gz: 1, rot: 0 },
      { type: 'sideTable', gx: 2, gz: 2, rot: 0, key: 'sideTable' },
      { type: 'candle', on: 'sideTable', slot: 0, rot: 0 },
      { type: 'bookshelf', gx: 3, gz: 0, rot: 0 },
      { type: 'pouf', gx: 3, gz: 3, rot: 0 },
      { type: 'fern', gx: 2, gz: 4, rot: 0 },
      { type: 'snakePlant', gx: 4, gz: 4, rot: 0 },
      { type: 'botanicalPrint', wall: 'left', col: 2, row: 4 },
      { type: 'macrame', wall: 'left', col: 0, row: 3 },
    ],
  },
};

export const DEFAULT_PRESET = 'livingRoom';

/** Rows of the wall grid for a preset: none when the shell has railings instead of walls. */
export function presetWallRows(preset) {
  return preset.walls === 'railing' ? 0 : WALL_HEIGHT / 0.5;
}

export const DOOR_WIDTH = 0.9, DOOR_HEIGHT = 2.3;
/** The preset's door in world units along its wall, or null: { wall, at, width, height }. */
export function presetDoor(preset) {
  if (!preset.door || preset.walls === 'railing') return null;
  // Centred on the end cell. In a room shrunk until the door would overlap a window, try the wall's
  // other end, then the ends of the other wall; a room with no clear spot has no door.
  const clear = (wall, at) => preset.windows.every((w) => w.wall !== wall || at + DOOR_WIDTH / 2 + 0.1 <= w.at - w.width / 2 - 0.1 || at - DOOR_WIDTH / 2 - 0.1 >= w.at + w.width / 2 + 0.1);
  const ends = (wall, end) => { const half = (wall === 'back' ? preset.width : preset.depth) / 2; return end === 'back' ? [-half + 0.5, half - 0.5] : [half - 0.5, -half + 0.5]; };
  const other = preset.door.wall === 'back' ? 'left' : 'back';
  for (const [wall, end] of [[preset.door.wall, preset.door.end], [other, 'front']]) {
    const at = ends(wall, end).find((a) => clear(wall, a));
    if (at !== undefined) return { wall, at, width: DOOR_WIDTH, height: DOOR_HEIGHT };
  }
  return null;
}
/** Wall fixtures (blocked wall areas) for a preset: windows, the optional bulb string, and the door. */
export function presetFixtures(preset) {
  const fixtures = preset.windows.map((w) => ({ kind: 'window', wall: w.wall, from: w.at - w.width / 2 - 0.1, to: w.at + w.width / 2 + 0.1, bottom: 1.05, top: 3.4 }));
  if (preset.lights) fixtures.push({ kind: 'light', wall: 'back', from: preset.width / 2 - 1.1, to: preset.width / 2 - 0.2, bottom: 3.2, top: 3.65 });
  const door = presetDoor(preset);
  if (door) fixtures.push({ kind: 'door', wall: door.wall, from: door.at - door.width / 2, to: door.at + door.width / 2, bottom: 0, top: door.height });
  return fixtures;
}
