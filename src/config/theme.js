// Scene palette and the finishes players can choose. Keep values inside the warm Little Nest palette
// described in docs/STYLE_GUIDE.md.

export const BACKDROP = 0xdf9d80;         // peach ground and scene background
export const SELECTION_OUTLINE = 0x91ad79;
export const HOVER_OUTLINE = 0xf3e4d2;     // softer cream box under the mouse before a click
export const GHOST_OK = 0x88cc88;
export const GHOST_BLOCKED = 0xdd5555;

export const WALL_FINISHES = [
  { name: 'Warm walnut', color: 0x92725c },
  { name: 'Clay', color: 0xb77d66 },
  { name: 'Cream', color: 0xf3dfbd },
  { name: 'Sage', color: 0x9ba58c },
  { name: 'Slate', color: 0x8996a0 },
  { name: 'Blush', color: 0xe8bea5 },
];

export const FLOOR_FINISHES = [
  { name: 'Honey oak', color: 0xe3a372 },
  { name: 'Pale oak', color: 0xf6d9b0 },
  { name: 'Limestone', color: 0xd9c7b6 },
  { name: 'Dark walnut', color: 0x987052 },
  { name: 'Ash', color: 0xb7be9f },
];

// Floor patterns. Keys are stored in saved rooms (finishes.floorStyle): add new ones, never rename.
export const FLOOR_STYLES = [
  { key: 'parquet', name: 'Parquet' },
  { key: 'planks', name: 'Planks' },
  { key: 'tile', name: 'Tile' },
];
export const DEFAULT_FLOOR_STYLE = 'parquet';

// Colors offered for upholstery, rugs, and plant pots.
export const ITEM_COLORS = [
  { name: 'Linen', color: 0xf3e4d2 },
  { name: 'Sage', color: 0x81936a },
  { name: 'Caramel', color: 0xc38e62 },
  { name: 'Terracotta', color: 0xb96949 },
  { name: 'Walnut', color: 0x716252 },
];
