import { test, expect } from '@playwright/test';
import { createPlacement } from '../../src/game/placement.js';
import { exportRoom, parseImport, exportFilename, EXPORT_APP, EXPORT_FORMAT, MAX_IMPORT_BYTES } from '../../src/persistence/transfer.js';
import { SaveError } from '../../src/persistence/schema.js';

const catalog = { sofa: { w: 3, d: 1 }, plant: { w: 1, d: 1 } };
const placement = createPlacement({ catalog, room: 8 });
let n = 0;
const opts = { catalog, placement, maxItems: 10, newId: () => 'n' + n++ };
const room = { version: 3, wall: 1, floor: 2, items: [{ id: 'a', type: 'sofa', gx: 0, gz: 0, rot: 0, color: null }, { id: 'b', type: 'plant', gx: 5, gz: 5, rot: 2, color: 0xb96949 }] };

test('filenames are slugged from the room name', () => {
  expect(exportFilename('Sunny corner')).toBe('sunny-corner.littlenest.json');
  expect(exportFilename('  ¡Hola! 2 ')).toBe('hola-2.littlenest.json');
  expect(exportFilename('???')).toBe('room.littlenest.json');
});

test('export produces an envelope that imports back unchanged', () => {
  const { filename, text } = exportRoom({ name: 'Sunny corner', room, now: () => '2026-09-30T00:00:00Z' });
  expect(filename).toBe('sunny-corner.littlenest.json');
  const parsed = JSON.parse(text);
  expect(parsed).toMatchObject({ app: EXPORT_APP, format: EXPORT_FORMAT, exportedAt: '2026-09-30T00:00:00Z', name: 'Sunny corner' });
  const imported = parseImport(text, opts);
  expect(imported.name).toBe('Sunny corner');
  expect(imported.room).toEqual({ room: { preset: 'livingRoom', width: 8, depth: 8 }, wall: 1, floor: 2, items: room.items.map((i) => ({ ...i, parent: null, slot: null, wall: null, col: null, row: null })) });
});

test('a bare room and a legacy version 2 room import with a fallback name', () => {
  const bare = parseImport(JSON.stringify(room), { ...opts, fallbackName: 'From file' });
  expect(bare.name).toBe('From file');
  expect(bare.room.items).toHaveLength(2);
  const legacy = parseImport(JSON.stringify({ version: 2, wall: 1, floor: 2, items: [{ type: 'plant', gx: 0, gz: 0, rot: 0 }] }), opts);
  expect(legacy.room.items[0].id).toMatch(/^n/);
});

test('bad files are rejected with SaveError and a reason', () => {
  const cases = [
    [42, 'Not a file'],
    ['x'.repeat(MAX_IMPORT_BYTES + 1), 'File too large'],
    ['{not json', 'Not JSON'],
    ['null', 'Not a room file'],
    ['[]', 'Not a room file'],
    ['{"hello":1}', 'Not a room file'],
    [JSON.stringify({ app: 'other', format: 1, room }), 'Not a Little Nest file'],
    [JSON.stringify({ app: EXPORT_APP, format: 2, room }), 'Unsupported file format'],
    [JSON.stringify({ app: EXPORT_APP, format: 1 }), 'Missing room'],
    [JSON.stringify({ app: EXPORT_APP, format: 1, name: 'x', room: { ...room, items: [{ id: 'a', type: 'sofa', gx: 7, gz: 0, rot: 0 }] } }), 'Out of bounds'],
  ];
  for (const [text, message] of cases) {
    expect(() => parseImport(text, opts), message).toThrow(SaveError);
    expect(() => parseImport(text, opts)).toThrow(message);
  }
});

test('imported names are cleaned', () => {
  const text = JSON.stringify({ app: EXPORT_APP, format: 1, name: '   ', room });
  expect(parseImport(text, opts).name).toBe('Imported room');
  const long = JSON.stringify({ app: EXPORT_APP, format: 1, name: 'z'.repeat(80), room });
  expect(parseImport(long, opts).name).toHaveLength(40);
});
