// Room presets: shell dimensions, window layout, and the starter layout for each.
// Coordinates are grid cells; rot is quarter turns. Small items sit on a supporter: give the
// supporter a `key` and the small item `on: key, slot`. Wall items use wall/col/row.
// Windows are centred `at` world units along their wall (0 is the wall's middle) with a width in units.
// `walls: 'railing'` swaps the two walls for low railings (open air): nothing can be wall-mounted there.
// `door: { wall, end }` puts a door on a wall, at its 'front' (left wall, +z) or 'back'/'right' end; residents come and go
// through it. Door cells refuse new wall decorations but never invalidate a saved room.
// `partitions` are interior cutaway walls on grid lines: { axis, line, from, to, gaps }. axis 'z' runs along z on
// the grid line x = line (between columns line - 1 and line) over rows from..to-1; axis 'x' runs along x on the grid
// line z = line over columns from..to-1. `gaps` lists the rows (or columns) left open as doorways. Furniture may
// not straddle a partition, and people and the cat walk around it. `zones` give a floor area its own finish:
// { from: [gx, gz], to: [gx, gz] (exclusive), floor: 'tile' }.
// Keys are stored in saved rooms: never rename them; add migrations before removing one.

export const WALL_HEIGHT = 4;
export const MIN_ROOM_SIZE = 4;
export const MAX_ROOM_SIZE = 12;

export const ROOM_PRESETS = {
  livingRoom: {
    name: 'Living room',
    blurb: 'A sunny open-plan room with a kitchen corner, a dining table, and a reading chair.',
    width: 8, depth: 8,
    pet: 'ginger',   // the starter room comes with a cat
    windows: [{ wall: 'back', at: -1.5, width: 4.7 }, { wall: 'left', at: -1.9, width: 3.9 }],
    door: { wall: 'left', end: 'front' },
    residents: 2,   // two people live here
    lights: true,
    // Modern home furniture (Kenney's Furniture Kit) with a few Little Nest plants and a print.
    items: [
      // Back wall: sofa corner under the window, then the kitchen run to the right.
      { type: 'kitPottedPlant', gx: 0, gz: 0, rot: 0 },
      { type: 'kitLoungeSofa', gx: 1, gz: 0, rot: 0, key: 'sofa', select: true },
      { type: 'kitPillow', on: 'sofa', slot: 0, rot: 0, color: 0x81936a },
      { type: 'kitSideTableDrawers', gx: 3, gz: 0, rot: 0, key: 'sofaSide' },
      { type: 'kitLampRoundTable', on: 'sofaSide', slot: 0, rot: 0 },
      { type: 'kitKitchenCabinetDrawer', gx: 4, gz: 0, rot: 0, key: 'counter' },
      { type: 'kitKitchenCoffeeMachine', on: 'counter', slot: 0, rot: 0 },
      { type: 'kitKitchenStove', gx: 5, gz: 0, rot: 0 },
      { type: 'kitKitchenSink', gx: 6, gz: 0, rot: 0 },
      { type: 'kitKitchenFridge', gx: 7, gz: 0, rot: 0 },
      { type: 'kitHoodModern', wall: 'back', col: 5, row: 3 },
      { type: 'kitKitchenCabinetUpper', wall: 'back', col: 6, row: 3 },
      { type: 'kitKitchenCabinetUpperLow', wall: 'back', col: 7, row: 4 },
      // Lounge: two chairs around the coffee table on a rug, a fern under the side window.
      { type: 'kitRugRectangle', gx: 0, gz: 1, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffee', gx: 1, gz: 2, rot: 0, key: 'coffee' },
      { type: 'kitBooks', on: 'coffee', slot: 0, rot: 0 },
      { type: 'kitPlantSmall2', on: 'coffee', slot: 1, rot: 0 },
      { type: 'kitLoungeChair', gx: 0, gz: 2, rot: 1, color: 0x81936a },
      { type: 'kitLoungeChair', gx: 3, gz: 2, rot: 3, color: 0xc38e62 },
      { type: 'fern', gx: 0, gz: 3, rot: 0 },
      // Left wall: a bookcase under the print, and a doormat inside the door.
      { type: 'kitBookcaseClosedWide', gx: 0, gz: 4, rot: 1, key: 'books' },
      { type: 'kitBooks', on: 'books', slot: 0, rot: 0 },
      { type: 'kitPlantSmall1', on: 'books', slot: 1, rot: 0 },
      { type: 'botanicalPrint', wall: 'left', col: 5, row: 4 },
      { type: 'kitRugDoormat', gx: 0, gz: 7, rot: 1 },
      // Dining table for four in front of the kitchen.
      { type: 'kitTable', gx: 5, gz: 3, rot: 0, key: 'dining' },
      { type: 'vase', on: 'dining', slot: 0, rot: 0 },
      { type: 'kitChairCushion', gx: 5, gz: 2, rot: 0 },
      { type: 'kitChairCushion', gx: 6, gz: 2, rot: 0 },
      { type: 'kitChairCushion', gx: 5, gz: 4, rot: 2 },
      { type: 'kitChairCushion', gx: 6, gz: 4, rot: 2 },
      { type: 'snakePlant', gx: 7, gz: 4, rot: 0 },
      // Front: a desk, and a reading corner with a floor lamp.
      { type: 'kitDesk', gx: 2, gz: 7, rot: 2, key: 'desk' },
      { type: 'kitLaptop', on: 'desk', slot: 0, rot: 0 },
      { type: 'kitLampSquareTable', on: 'desk', slot: 1, rot: 0 },
      { type: 'kitChairDesk', gx: 2, gz: 6, rot: 0 },
      { type: 'monstera', gx: 4, gz: 7, rot: 0 },
      { type: 'kitRugRound', gx: 5, gz: 6, rot: 0 },
      { type: 'kitLoungeChair', gx: 6, gz: 6, rot: 3 },
      { type: 'kitSideTable', gx: 6, gz: 7, rot: 0, key: 'reading' },
      { type: 'kitRadio', on: 'reading', slot: 0, rot: 0 },
      { type: 'kitLampRoundFloor', gx: 7, gz: 6, rot: 0 },
      { type: 'kitPottedPlant', gx: 7, gz: 7, rot: 0 },
    ],
    // The original hand-modelled layout. Not offered in the game; browser tests open it with ?starter=classic.
    classicItems: [
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
    blurb: 'A compact studio with a desk by the window, a kitchenette, and a sofa facing the TV.',
    width: 6, depth: 6,
    windows: [{ wall: 'left', at: 0, width: 3.2 }],
    door: { wall: 'left', end: 'front' },
    lights: false,
    items: [
      // Back wall: TV corner, then a kitchenette.
      { type: 'kitBookcaseOpen', gx: 0, gz: 0, rot: 1, key: 'shelf' },
      { type: 'kitBooks', on: 'shelf', slot: 0, rot: 1 },
      { type: 'clock', wall: 'back', col: 0, row: 5 },
      { type: 'kitCabinetTelevision', gx: 1, gz: 0, rot: 0, key: 'tv' },
      { type: 'kitSpeakerSmall', on: 'tv', slot: 0, rot: 0 },
      { type: 'kitPlantSmall1', on: 'tv', slot: 1, rot: 0 },
      { type: 'kitTelevisionModern', wall: 'back', col: 1, row: 2 },
      { type: 'kitKitchenCabinet', gx: 3, gz: 0, rot: 0, key: 'counter' },
      { type: 'kitKitchenCoffeeMachine', on: 'counter', slot: 0, rot: 0 },
      { type: 'kitKitchenStoveElectric', gx: 4, gz: 0, rot: 0 },
      { type: 'kitKitchenFridge', gx: 5, gz: 0, rot: 0 },
      { type: 'kitKitchenCabinetUpper', wall: 'back', col: 3, row: 3 },
      { type: 'kitHoodModern', wall: 'back', col: 4, row: 3 },
      // Desk under the side window.
      { type: 'kitDesk', gx: 0, gz: 2, rot: 1, key: 'desk' },
      { type: 'kitComputerScreen', on: 'desk', slot: 0, rot: 0 },
      { type: 'kitLampSquareTable', on: 'desk', slot: 1, rot: 0 },
      { type: 'kitChairDesk', gx: 1, gz: 2, rot: 3 },
      { type: 'kitPottedPlant', gx: 1, gz: 5, rot: 0 },
      // Lounge: the sofa faces the TV across a coffee table.
      { type: 'kitRugRectangle', gx: 2, gz: 3, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffee', gx: 2, gz: 3, rot: 0, key: 'coffee' },
      { type: 'mug', on: 'coffee', slot: 0, rot: 0 },
      { type: 'kitLoungeChair', gx: 4, gz: 3, rot: 3, color: 0x81936a },
      { type: 'kitLoungeSofa', gx: 2, gz: 5, rot: 2, key: 'sofa', select: true },
      { type: 'kitPillow', on: 'sofa', slot: 1, rot: 0, color: 0xbf895c },
      { type: 'kitSideTable', gx: 4, gz: 5, rot: 0, key: 'side' },
      { type: 'kitLampRoundTable', on: 'side', slot: 0, rot: 0 },
      { type: 'kitPottedPlant', gx: 5, gz: 5, rot: 0 },
      { type: 'kitRugDoormat', gx: 0, gz: 5, rot: 1 },
    ],
    // The original layout; only with ?starter=classic (browser tests).
    classicItems: [
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
    blurb: 'A restful room with a double bed, a vanity desk under the window, and a reading chair.',
    width: 7, depth: 7,
    windows: [{ wall: 'left', at: 0, width: 3 }],
    door: { wall: 'left', end: 'back' },
    lights: false,
    items: [
      // Back wall: the bed between two nightstands, a tall cabinet as a wardrobe.
      { type: 'kitCoatRackStanding', gx: 1, gz: 0, rot: 0 },
      { type: 'kitCabinetBedDrawerTable', gx: 2, gz: 0, rot: 0, key: 'standLeft' },
      { type: 'kitLampRoundTable', on: 'standLeft', slot: 0, rot: 0 },
      { type: 'kitBedDouble', gx: 3, gz: 0, rot: 0, select: true },
      { type: 'kitCabinetBedDrawerTable', gx: 5, gz: 0, rot: 0, key: 'standRight' },
      { type: 'kitLampRoundTable', on: 'standRight', slot: 0, rot: 0 },
      { type: 'kitBookcaseClosedDoors', gx: 6, gz: 0, rot: 0 },
      { type: 'botanicalPrint', wall: 'back', col: 3, row: 4 },
      { type: 'macrame', wall: 'back', col: 6, row: 4 },
      // Foot of the bed: a rug and two low cushioned benches.
      { type: 'kitRugRounded', gx: 2, gz: 2, rot: 0, color: 0x81936a },
      { type: 'kitBenchCushionLow', gx: 3, gz: 2, rot: 0 },
      { type: 'kitBenchCushionLow', gx: 4, gz: 2, rot: 0 },
      // Vanity desk under the window, a low shelf and mirror by the front.
      { type: 'kitDesk', gx: 0, gz: 3, rot: 1, key: 'vanity' },
      { type: 'kitPlantSmall3', on: 'vanity', slot: 0, rot: 0 },
      { type: 'kitLampSquareTable', on: 'vanity', slot: 1, rot: 0 },
      { type: 'kitChairCushion', gx: 1, gz: 3, rot: 3 },
      { type: 'kitBookcaseOpenLow', gx: 0, gz: 6, rot: 1, key: 'low' },
      { type: 'kitBooks', on: 'low', slot: 0, rot: 1 },
      { type: 'mirror', wall: 'left', col: 6, row: 3 },
      // Reading corner.
      { type: 'kitLoungeChair', gx: 5, gz: 5, rot: 3, color: 0xc38e62 },
      { type: 'kitSideTable', gx: 5, gz: 6, rot: 0, key: 'read' },
      { type: 'kitBooks', on: 'read', slot: 0, rot: 0 },
      { type: 'kitLampRoundFloor', gx: 6, gz: 5, rot: 0 },
      { type: 'kitPottedPlant', gx: 6, gz: 6, rot: 0 },
      { type: 'kitRugDoormat', gx: 0, gz: 0, rot: 1 },
    ],
    // The original layout; only with ?starter=classic (browser tests).
    classicItems: [
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
    blurb: 'An open-air corner with a low lounge sofa, planters, and a lantern for the evening.',
    width: 6, depth: 4,
    walls: 'railing',
    windows: [],
    lights: false,
    items: [
      { type: 'kitLoungeDesignSofa', gx: 0, gz: 0, rot: 0, key: 'sofa', select: true },
      { type: 'kitPillow', on: 'sofa', slot: 0, rot: 0, color: 0x81936a },
      { type: 'planter', gx: 2, gz: 0, rot: 0 },
      { type: 'planter', gx: 4, gz: 0, rot: 0 },
      { type: 'kitRugRounded', gx: 0, gz: 1, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffeeSquare', gx: 1, gz: 2, rot: 0, key: 'table' },
      { type: 'teapot', on: 'table', slot: 0, rot: 0 },
      { type: 'kitLoungeChair', gx: 2, gz: 2, rot: 3, color: 0x81936a },
      { type: 'kitLoungeSofaOttoman', gx: 4, gz: 3, rot: 0 },
      { type: 'kitSideTable', gx: 5, gz: 3, rot: 0, key: 'side' },
      { type: 'lantern', on: 'side', slot: 0, rot: 0 },
      { type: 'palm', gx: 0, gz: 3, rot: 0 },
      { type: 'kitPottedPlant', gx: 5, gz: 1, rot: 0 },
    ],
    // The original layout; only with ?starter=classic (browser tests).
    classicItems: [
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
  apartment: {
    name: 'Apartment',
    blurb: 'A roomy one-room home with a walled bathroom, a tiled kitchen with an island, a bed and a lounge.',
    width: 10, depth: 8,
    windows: [{ wall: 'back', at: 0.5, width: 2 }, { wall: 'left', at: -3, width: 1.4 }],
    door: { wall: 'left', end: 'front' },
    residents: 2,
    lights: true,
    // The bathroom: the back-left 4 x 3 corner behind room-height walls (drawn see-through toward the camera),
    // its door at the front right. The kitchen: the back-right 4 x 3 on tiles, marked off by an island.
    partitions: [{ axis: 'z', line: 4, from: 0, to: 3 }, { axis: 'x', line: 3, from: 0, to: 4, gaps: [3] }],
    zones: [{ from: [0, 0], to: [4, 3], floor: 'tile' }, { from: [6, 0], to: [10, 3], floor: 'tile' }],
    items: [
      // Bathroom: bathtub, basin with a mirror, the toilet in its own corner; a towel cabinet, a bath mat, a plant.
      { type: 'kitBathtub', gx: 0, gz: 0, rot: 0 },
      { type: 'kitBathroomSink', gx: 2, gz: 0, rot: 0 },
      { type: 'kitBathroomMirror', wall: 'back', col: 2, row: 3 },
      { type: 'kitToilet', gx: 3, gz: 0, rot: 0 },
      { type: 'kitBathroomCabinetDrawer', gx: 0, gz: 1, rot: 1, key: 'towels' },
      { type: 'kitPlantSmall3', on: 'towels', slot: 0, rot: 0 },
      { type: 'kitBathroomCabinet', wall: 'left', col: 2, row: 3 },
      { type: 'kitRugDoormat', gx: 1, gz: 1, rot: 0, color: 0x81936a },
      { type: 'kitPottedPlant', gx: 0, gz: 2, rot: 0 },
      // Kitchen: a counter run along the back wall, upper cabinets and a hood, an island with two stools.
      { type: 'kitKitchenCabinetDrawer', gx: 6, gz: 0, rot: 0, key: 'counter' },
      { type: 'kitKitchenCoffeeMachine', on: 'counter', slot: 0, rot: 0 },
      { type: 'kitKitchenSink', gx: 7, gz: 0, rot: 0 },
      { type: 'kitKitchenStove', gx: 8, gz: 0, rot: 0 },
      { type: 'kitKitchenFridge', gx: 9, gz: 0, rot: 0 },
      { type: 'kitKitchenCabinetUpper', wall: 'back', col: 7, row: 3 },
      { type: 'kitHoodModern', wall: 'back', col: 8, row: 3 },
      { type: 'kitKitchenCabinetUpperLow', wall: 'back', col: 9, row: 4 },
      { type: 'kitKitchenBar', gx: 7, gz: 2, rot: 2, key: 'barA' },
      { type: 'kitToaster', on: 'barA', slot: 0, rot: 2 },
      { type: 'kitKitchenBar', gx: 8, gz: 2, rot: 2, key: 'barB' },
      { type: 'kitPlantSmall1', on: 'barB', slot: 0, rot: 0 },
      { type: 'kitStoolBar', gx: 7, gz: 3, rot: 2 },
      { type: 'kitStoolBar', gx: 8, gz: 3, rot: 2 },
      // Lounge under the window.
      { type: 'kitLoungeSofa', gx: 4, gz: 0, rot: 0, key: 'sofa', select: true },
      { type: 'kitPillow', on: 'sofa', slot: 0, rot: 0, color: 0x81936a },
      { type: 'kitRugSquare', gx: 4, gz: 1, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffee', gx: 4, gz: 2, rot: 0, key: 'coffee' },
      { type: 'kitBooks', on: 'coffee', slot: 0, rot: 0 },
      { type: 'kitLampRoundFloor', gx: 6, gz: 3, rot: 0 },
      // Reading chair facing the room, with the radio.
      { type: 'kitLoungeChair', gx: 5, gz: 5, rot: 0, color: 0x81936a },
      { type: 'kitSideTable', gx: 6, gz: 5, rot: 0, key: 'side' },
      { type: 'kitRadio', on: 'side', slot: 0, rot: 0 },
      // Bed against the left wall with a nightstand each side; the front door is just beyond.
      { type: 'kitCabinetBedDrawerTable', gx: 0, gz: 3, rot: 1, key: 'standA' },
      { type: 'kitLampRoundTable', on: 'standA', slot: 0, rot: 0 },
      { type: 'kitBedDouble', gx: 0, gz: 4, rot: 1 },
      { type: 'kitCabinetBedDrawerTable', gx: 0, gz: 6, rot: 1, key: 'standB' },
      { type: 'kitLampRoundTable', on: 'standB', slot: 0, rot: 0 },
      { type: 'botanicalPrint', wall: 'left', col: 4, row: 4 },
      { type: 'kitRugDoormat', gx: 0, gz: 7, rot: 1 },
      // A desk at the front, and plants.
      { type: 'kitDesk', gx: 8, gz: 7, rot: 2, key: 'desk' },
      { type: 'kitLaptop', on: 'desk', slot: 0, rot: 0 },
      { type: 'kitChairDesk', gx: 8, gz: 6, rot: 0 },
      { type: 'monstera', gx: 9, gz: 5, rot: 0 },
      { type: 'snakePlant', gx: 3, gz: 7, rot: 0 },
    ],
  },
  house: {
    name: 'House',
    blurb: 'A whole home: a bedroom, a bathroom, a reading room, an entry hall, and an open living room and kitchen.',
    width: 12, depth: 12,
    pet: 'ginger',
    residents: 3,
    // Back wall: the bedroom window and the kitchen window over the sink. Left wall: the reading room's window.
    windows: [{ wall: 'back', at: -3.5, width: 2 }, { wall: 'back', at: 4, width: 1.6 }, { wall: 'left', at: 1, width: 2.4 }],
    door: { wall: 'left', end: 'front' },
    lights: true,
    // Rooms (cells): bedroom 0-4 x 0-4, bathroom 5-7 x 0-3, kitchen 8-11 x 0-3 (open), reading room 0-3 x 5-8,
    // entry hall 0-3 x 9-11 (open to the living room), living room 4-11 x 4-11. Each walled room has a doorway.
    partitions: [
      { axis: 'z', line: 5, from: 0, to: 5 },             // bedroom | bathroom and hall
      { axis: 'z', line: 8, from: 0, to: 4 },             // bathroom | kitchen
      { axis: 'x', line: 4, from: 5, to: 8, gaps: [6] },  // bathroom front, door at column 6
      { axis: 'x', line: 5, from: 0, to: 5, gaps: [4] },  // bedroom front, door at column 4
      { axis: 'z', line: 4, from: 5, to: 9, gaps: [7] },  // reading room | living room, door at row 7
      { axis: 'x', line: 9, from: 0, to: 4 },             // reading room | entry hall
    ],
    zones: [{ from: [5, 0], to: [8, 4], floor: 'tile' }, { from: [8, 0], to: [12, 3], floor: 'tile' }],
    items: [
      // Bedroom: the bed under the window between two nightstands, a dresser with a mirror, a wardrobe, a rug and a bench.
      { type: 'kitCabinetBedDrawerTable', gx: 0, gz: 0, rot: 0, key: 'standA' },
      { type: 'kitLampRoundTable', on: 'standA', slot: 0, rot: 0 },
      { type: 'kitBedDouble', gx: 1, gz: 0, rot: 0 },
      { type: 'kitCabinetBedDrawerTable', gx: 3, gz: 0, rot: 0, key: 'standB' },
      { type: 'kitLampRoundTable', on: 'standB', slot: 0, rot: 0 },
      { type: 'kitCabinetBedDrawer', gx: 4, gz: 0, rot: 0, key: 'dresser' },
      { type: 'kitPlantSmall2', on: 'dresser', slot: 0, rot: 0 },
      { type: 'mirror', wall: 'back', col: 4, row: 3 },
      { type: 'kitRugRounded', gx: 1, gz: 2, rot: 0, color: 0x81936a },
      { type: 'kitBenchCushionLow', gx: 1, gz: 2, rot: 0 },
      { type: 'kitBenchCushionLow', gx: 2, gz: 2, rot: 0 },
      { type: 'kitBookcaseClosedDoors', gx: 0, gz: 3, rot: 1 },
      { type: 'kitBookcaseClosedDoors', gx: 0, gz: 4, rot: 1 },
      { type: 'botanicalPrint', wall: 'left', col: 1, row: 4 },
      { type: 'kitPottedPlant', gx: 4, gz: 2, rot: 0 },
      // Bathroom: the bathtub along the back wall, the toilet beside it, a basin under a mirror, towels, a bath mat.
      { type: 'kitBathtub', gx: 5, gz: 0, rot: 0 },
      { type: 'kitBathroomSink', gx: 7, gz: 0, rot: 0 },
      { type: 'kitBathroomMirror', wall: 'back', col: 7, row: 3 },
      { type: 'kitToilet', gx: 5, gz: 1, rot: 1 },
      { type: 'kitBathroomCabinetDrawer', gx: 7, gz: 2, rot: 3, key: 'towels' },
      { type: 'kitPlantSmall3', on: 'towels', slot: 0, rot: 0 },
      { type: 'kitRugDoormat', gx: 6, gz: 1, rot: 0, color: 0x81936a },
      // Kitchen: stove, sink under the window, a counter with the coffee machine, the fridge; an island with stools.
      { type: 'kitKitchenStove', gx: 8, gz: 0, rot: 0 },
      { type: 'kitHoodModern', wall: 'back', col: 8, row: 3 },
      { type: 'kitKitchenSink', gx: 9, gz: 0, rot: 0 },
      { type: 'kitKitchenCabinetDrawer', gx: 10, gz: 0, rot: 0, key: 'counter' },
      { type: 'kitKitchenCoffeeMachine', on: 'counter', slot: 0, rot: 0 },
      { type: 'kitKitchenFridge', gx: 11, gz: 0, rot: 0 },
      { type: 'kitKitchenCabinetUpperLow', wall: 'back', col: 11, row: 4 },
      { type: 'kitKitchenBar', gx: 9, gz: 2, rot: 2, key: 'barA' },
      { type: 'kitToaster', on: 'barA', slot: 0, rot: 2 },
      { type: 'kitKitchenBar', gx: 10, gz: 2, rot: 2, key: 'barB' },
      { type: 'kitPlantSmall1', on: 'barB', slot: 0, rot: 0 },
      { type: 'kitStoolBar', gx: 9, gz: 3, rot: 2 },
      { type: 'kitStoolBar', gx: 10, gz: 3, rot: 2 },
      // Reading room: a recliner by the window, bookcases, a writing desk, a rug and lamps.
      { type: 'kitBookcaseOpen', gx: 1, gz: 5, rot: 0, key: 'shelfA' },
      { type: 'kitBooks', on: 'shelfA', slot: 0, rot: 0 },
      { type: 'kitBookcaseOpen', gx: 2, gz: 5, rot: 0, key: 'shelfB' },
      { type: 'kitPlantSmall3', on: 'shelfB', slot: 0, rot: 0 },
      { type: 'kitBookcaseClosedDoors', gx: 3, gz: 5, rot: 0 },
      { type: 'kitLampRoundFloor', gx: 0, gz: 5, rot: 0 },
      { type: 'kitLoungeChairRelax', gx: 0, gz: 6, rot: 1, color: 0x81936a },
      { type: 'kitSideTable', gx: 0, gz: 7, rot: 0, key: 'readSide' },
      { type: 'mug', on: 'readSide', slot: 0, rot: 0 },
      { type: 'kitRugRound', gx: 1, gz: 7, rot: 0, color: 0xc38e62 },
      { type: 'kitDesk', gx: 2, gz: 8, rot: 2, key: 'desk' },
      { type: 'kitLampSquareTable', on: 'desk', slot: 1, rot: 0 },
      { type: 'kitChairDesk', gx: 2, gz: 7, rot: 0 },
      { type: 'fern', gx: 0, gz: 8, rot: 0 },
      // Entry hall: the front door, a doormat, a coat rack, a shoe shelf and a mirror.
      { type: 'kitRugDoormat', gx: 0, gz: 11, rot: 1 },
      { type: 'kitCoatRackStanding', gx: 0, gz: 9, rot: 0 },
      { type: 'kitBookcaseOpenLow', gx: 2, gz: 9, rot: 0, key: 'shoes' },
      { type: 'kitPlantSmall2', on: 'shoes', slot: 0, rot: 0 },
      { type: 'mirror', wall: 'left', col: 9, row: 3 },
      // Living room: a sofa and two armchairs round a coffee table, a dining table for four, the radio, plants.
      { type: 'kitLoungeSofa', gx: 5, gz: 7, rot: 0, key: 'sofa', select: true },
      { type: 'kitPillow', on: 'sofa', slot: 0, rot: 0, color: 0x81936a },
      { type: 'kitLampRoundFloor', gx: 7, gz: 7, rot: 0 },
      { type: 'kitRugRectangle', gx: 4, gz: 8, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffee', gx: 5, gz: 9, rot: 0, key: 'coffee' },
      { type: 'kitBooks', on: 'coffee', slot: 0, rot: 0 },
      { type: 'kitLoungeChair', gx: 4, gz: 9, rot: 1, color: 0x81936a },
      { type: 'kitLoungeChair', gx: 7, gz: 9, rot: 3, color: 0xc38e62 },
      { type: 'kitSideTable', gx: 7, gz: 10, rot: 0, key: 'radio' },
      { type: 'kitRadio', on: 'radio', slot: 0, rot: 0 },
      { type: 'kitTable', gx: 9, gz: 6, rot: 0, key: 'dining' },
      { type: 'vase', on: 'dining', slot: 0, rot: 0 },
      { type: 'kitChairCushion', gx: 9, gz: 5, rot: 0 },
      { type: 'kitChairCushion', gx: 10, gz: 5, rot: 0 },
      { type: 'kitChairCushion', gx: 9, gz: 7, rot: 2 },
      { type: 'kitChairCushion', gx: 10, gz: 7, rot: 2 },
      { type: 'monstera', gx: 11, gz: 11, rot: 0 },
      { type: 'snakePlant', gx: 11, gz: 9, rot: 0 },
      { type: 'kitPottedPlant', gx: 4, gz: 11, rot: 0 },
    ],
  },
  readingNook: {
    name: 'Reading nook',
    blurb: 'A small, quiet corner with a recliner under the window, a lamp, and walls of books.',
    width: 5, depth: 5,
    windows: [{ wall: 'back', at: 0.5, width: 2.6 }],
    door: { wall: 'left', end: 'front' },
    lights: true,
    items: [
      // Books along the side wall.
      { type: 'kitBookcaseOpen', gx: 0, gz: 0, rot: 1, key: 'shelfA' },
      { type: 'kitBooks', on: 'shelfA', slot: 0, rot: 1 },
      { type: 'kitBookcaseOpen', gx: 0, gz: 1, rot: 1, key: 'shelfB' },
      { type: 'kitPlantSmall3', on: 'shelfB', slot: 0, rot: 0 },
      { type: 'kitBookcaseClosedDoors', gx: 0, gz: 2, rot: 1 },
      { type: 'botanicalPrint', wall: 'left', col: 2, row: 4 },
      // A recliner with its footrest under the window, a lamp and a side table beside it.
      { type: 'kitLampRoundFloor', gx: 1, gz: 0, rot: 0 },
      { type: 'kitLoungeChairRelax', gx: 2, gz: 0, rot: 0, color: 0x81936a, select: true },
      { type: 'kitSideTableDrawers', gx: 3, gz: 0, rot: 0, key: 'side' },
      { type: 'mug', on: 'side', slot: 0, rot: 0 },
      { type: 'kitPottedPlant', gx: 4, gz: 0, rot: 0 },
      // A second chair across a small table, on a round rug.
      { type: 'kitRugRound', gx: 2, gz: 2, rot: 0, color: 0xc38e62 },
      { type: 'kitTableCoffeeSquare', gx: 3, gz: 2, rot: 0, key: 'table' },
      { type: 'candle', on: 'table', slot: 0, rot: 0 },
      { type: 'kitLoungeChair', gx: 4, gz: 2, rot: 3, color: 0xc38e62 },
      { type: 'fern', gx: 4, gz: 4, rot: 0 },
      { type: 'kitRugDoormat', gx: 0, gz: 4, rot: 1 },
    ],
    // The original layout; only with ?starter=classic (browser tests).
    classicItems: [
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

/** A key for the edge between two neighbouring cells, the same whichever way round they are given. */
export function edgeKey(ax, az, bx, bz) {
  return ax < bx || (ax === bx && az < bz) ? ax + ',' + az + '|' + bx + ',' + bz : bx + ',' + bz + '|' + ax + ',' + az;
}
/** The cell edges a preset's partitions close (doorway gaps stay open unless `withDoorways`). */
export function presetPartitionEdges(preset, { withDoorways = false } = {}) {
  const out = new Set();
  for (const p of preset.partitions ?? []) {
    for (let i = p.from; i < p.to; i++) {
      if (!withDoorways && p.gaps?.includes(i)) continue;
      out.add(p.axis === 'z' ? edgeKey(p.line - 1, i, p.line, i) : edgeKey(i, p.line - 1, i, p.line));
    }
  }
  return out;
}
/**
 * The rooms a preset's partitions enclose, counting doorways as closed: { roomOf(gx, gz), cellsOf(id), open }.
 * Rooms are numbered from 0; `open` is the room that reaches the open front or right edge (the living area),
 * or null when every cell is walled in. Cells are 'gx,gz' keys, like placement's cellKey.
 */
export function presetRooms(preset) {
  const { width, depth } = preset;
  const walls = presetPartitionEdges(preset, { withDoorways: true });
  const ids = new Map(), cells = [];
  for (let gx = 0; gx < width; gx++) for (let gz = 0; gz < depth; gz++) {
    if (ids.has(gx + ',' + gz)) continue;
    const id = cells.length, list = [], queue = [[gx, gz]];
    ids.set(gx + ',' + gz, id);
    while (queue.length) {
      const [x, z] = queue.pop();
      list.push(x + ',' + z);
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth || ids.has(nx + ',' + nz) || walls.has(edgeKey(x, z, nx, nz))) continue;
        ids.set(nx + ',' + nz, id);
        queue.push([nx, nz]);
      }
    }
    cells.push(list);
  }
  const open = ids.get((width - 1) + ',' + (depth - 1)) ?? null;
  return { roomOf: (gx, gz) => ids.get(gx + ',' + gz) ?? null, cellsOf: (id) => cells[id] ?? [], open, count: cells.length };
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
