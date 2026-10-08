// Copies the Kenney Nature Kit pieces the garden uses (CC0, www.kenney.nl) from the downloaded pack in
// art-source/packs/kenney-nature-kit (ignored) into public/models/garden. The game recolours them by
// material name at load time (src/scene/garden.js PALETTE), so the files are copied untouched.
// Run: node tools/copy-nature.mjs
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const GARDEN_MODELS = [
  'tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_tall', 'tree_simple',
  'plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall',
  'flower_purpleA', 'flower_redA', 'flower_yellowA', 'flower_yellowB',
  'grass', 'grass_large', 'grass_leafs',
  'rock_smallA', 'rock_smallB', 'mushroom_red', 'mushroom_tanGroup', 'stump_round',
  'path_stone', 'fence_simple',
];
const from = 'art-source/packs/kenney-nature-kit/Models/GLTF format';
const to = 'public/models/garden';
if (!existsSync(from)) { console.error('Download the Kenney Nature Kit into ' + from + ' first.'); process.exit(1); }
mkdirSync(to, { recursive: true });
for (const key of GARDEN_MODELS) copyFileSync(join(from, key + '.glb'), join(to, key + '.glb'));
copyFileSync('art-source/packs/kenney-nature-kit/License.txt', join(to, 'LICENSE-kenney-nature-kit.txt'));
console.log('Copied ' + GARDEN_MODELS.length + ' models to ' + to);
