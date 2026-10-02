import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { createRoomState } from '../../src/game/state.js';
import { createCommands } from '../../src/game/commands.js';
import { parseRoom, serializeRoom, migrateRoom, SaveError, CURRENT_VERSION, FLOOR_STYLE_KEYS } from '../../src/persistence/schema.js';
import { FLOOR_STYLES } from '../../src/config/theme.js';

const catalog = { chair: { w: 1, d: 1 } };
const placement = createPlacement({ catalog, room: 8 });
const opts = { catalog, placement, newId: () => 'x' };

test('version 8 adds a left wall color and a floor style, and older saves migrate to the defaults', () => {
  expect(CURRENT_VERSION).toBeGreaterThanOrEqual(8);
  expect(FLOOR_STYLES.map((s) => s.key)).toEqual(FLOOR_STYLE_KEYS);   // theme and schema agree on stored keys

  const v7 = { version: 7, room: { preset: 'livingRoom', width: 8, depth: 8 }, wall: 0x92725c, floor: 0xe3a372, lighting: 'morning', items: [] };
  expect(migrateRoom(v7)).toMatchObject({ version: CURRENT_VERSION, wallLeft: 0x92725c, floorStyle: 'parquet' });
  expect(parseRoom(v7, opts)).toMatchObject({ wall: 0x92725c, wallLeft: 0x92725c, floorStyle: 'parquet' });

  const saved = serializeRoom({ wall: 1, wallLeft: 2, floor: 3, floorStyle: 'tile', items: [] });
  expect(saved).toMatchObject({ version: CURRENT_VERSION, wall: 1, wallLeft: 2, floor: 3, floorStyle: 'tile' });
  expect(parseRoom(saved, opts)).toMatchObject({ wall: 1, wallLeft: 2, floorStyle: 'tile' });
  expect(serializeRoom({ wall: 5, floor: 3, items: [] })).toMatchObject({ wallLeft: 5, floorStyle: 'parquet' });   // defaults when omitted

  expect(() => parseRoom({ ...saved, floorStyle: 'lava' }, opts)).toThrow(SaveError);
  expect(() => parseRoom({ ...saved, wallLeft: 'red' }, opts)).toThrow(SaveError);
});

test('setFinishes changes both walls as one undo step, and replaceRoom restores every finish', () => {
  const state = createRoomState({ placement });
  const finishes = { wall: 1, wallLeft: 1, floor: 3, floorStyle: 'parquet', lighting: 'morning' };
  const commands = createCommands({ state, finishes });
  const events = [];
  commands.subscribe((kind, p) => { if (kind === 'finish') events.push(p.key + '=' + p.color); });

  expect(commands.setFinishes({ wall: 9, wallLeft: 9 })).toBe(true);
  expect(finishes).toMatchObject({ wall: 9, wallLeft: 9 });
  commands.undo();
  expect(finishes).toMatchObject({ wall: 1, wallLeft: 1 });   // one step undid both
  expect(commands.setFinishes({ wall: 1, ceiling: 4 })).toBe(false);   // unchanged and unknown keys are skipped

  commands.setFinish('wallLeft', 7);
  commands.setFinish('floorStyle', 'tile');
  expect(finishes).toMatchObject({ wall: 1, wallLeft: 7, floorStyle: 'tile' });

  commands.replaceRoom({ wall: 2, floor: 4, items: [] });   // a room without the new keys gets the defaults
  expect(finishes).toMatchObject({ wall: 2, wallLeft: 2, floor: 4, floorStyle: 'parquet' });
  commands.undo();
  expect(finishes).toMatchObject({ wall: 1, wallLeft: 7, floor: 3, floorStyle: 'tile' });
  expect(events).toContain('floorStyle=tile');
});
