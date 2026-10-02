// Undoable mutations over the room: furniture records in `state` plus the wall and floor finishes.
// Every command applies immediately, emits change events for the scene to mirror, and pushes an
// inverse onto the history. No Three.js and no DOM.
//
// Events (subscribe(fn) receives (kind, payload)):
//   add       record                the record now exists; build its mesh
//   remove    { id }                the record is gone; drop its mesh
//   transform record                gx/gz/rot (floor), parent/slot/rot (surface), or wall/col/row changed; move its mesh
//   color     record                color changed; recolor its mesh
//   lit       record                a lamp was switched; update its light
//   finish    { key, color }        a finish changed: wall (back), wallLeft, floor colors; floorStyle and lighting carry keys
//   room      { preset, width, depth }  the shell changed; rebuild walls, floor, and grid (items were cleared first)
//   history   { canUndo, canRedo }  undo/redo availability changed

export function createCommands({ state, finishes, room = { preset: null, width: 0, depth: 0 }, limit = 100 }) {
  const listeners = new Set();
  const undoStack = [];
  const redoStack = [];

  const emit = (kind, payload) => listeners.forEach((fn) => fn(kind, payload));
  const canUndo = () => undoStack.length > 0;
  const canRedo = () => redoStack.length > 0;
  const notify = () => emit('history', { canUndo: canUndo(), canRedo: canRedo() });
  const snapshotOf = ({ id, type, gx, gz, rot, color, parent, slot, wall, col, row, lit }) => ({ id, type, gx, gz, rot, color, parent, slot, wall, col, row, lit });

  // ----- primitive operations: mutate, emit, but never touch history -----
  function opAdd(data) {
    const record = state.add(data);
    if (record) emit('add', record);
    return record;
  }
  /** Removes an item and its children; returns snapshots ordered parents first, for restoring. */
  function opRemove(id) {
    const removed = state.remove(id);
    if (!removed) return null;
    for (const r of removed) emit('remove', { id: r.id });
    return removed.map(snapshotOf).reverse();
  }
  function opTransform(id, next) {
    const record = state.get(id);
    if (!record) return null;
    const prev = { gx: record.gx, gz: record.gz, rot: record.rot };
    if (!state.transform(id, next)) return null;
    emit('transform', record);
    return prev;
  }
  function opMount(id, wall, col, row) {
    const record = state.get(id);
    if (!record) return null;
    const prev = { wall: record.wall, col: record.col, row: record.row };
    if (!state.mount(id, wall, col, row)) return null;
    emit('transform', record);
    return prev;
  }
  function opPlace(id, parent, slot) {
    const record = state.get(id);
    if (!record) return null;
    const prev = { parent: record.parent, slot: record.slot };
    if (!state.place(id, parent, slot)) return null;
    emit('transform', record);
    return prev;
  }
  function opLit(id, on) {
    const record = state.get(id);
    if (!record || record.lit === null) return undefined;
    const prev = record.lit;
    state.setLit(id, on);
    emit('lit', record);
    return prev;
  }
  function opColor(id, color) {
    const record = state.get(id);
    if (!record) return undefined;
    const prev = record.color;
    state.setColor(id, color);
    emit('color', record);
    return prev;
  }
  function opFinish(key, color) {
    const prev = finishes[key];
    finishes[key] = color;
    emit('finish', { key, color });
    return prev;
  }
  /** Changes the room shell. The scene rebuilds on the event; the caller clears items first. */
  function opRoom(next) {
    const prev = { preset: room.preset, width: room.width, depth: room.depth };
    Object.assign(room, { preset: next.preset, width: next.width, depth: next.depth });
    emit('room', { ...room });
    return prev;
  }
  function opClear() {
    const snapshot = state.serialize();          // parents first
    for (const it of snapshot) if (state.get(it.id)) opRemove(it.id);
    return snapshot;
  }
  function opRestore(items) {
    for (const it of items) opAdd(it);           // parents come before children in every snapshot
  }

  function push(entry) {
    undoStack.push(entry);
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
    notify();
  }

  // ----- commands -----
  function add(data) {
    const record = opAdd(data);
    if (!record) return null;
    const snapshot = snapshotOf(record);
    push({ undo: () => opRemove(snapshot.id), redo: () => opAdd(snapshot) });
    return record;
  }
  /**
   * Copies an item, and whatever sits on it, into the nearest free spot of the same kind as one entry.
   * Returns the new record, or null when there is no room.
   */
  function duplicate(id) {
    const source = state.get(id);
    const spot = state.findFreeNear(id);
    if (!source || !spot) return null;
    const copy = opAdd({ type: source.type, rot: source.rot, color: source.color, ...spot });
    if (!copy) return null;
    const added = [snapshotOf(copy)];
    for (const child of state.childrenOf(id)) {
      const c = opAdd({ type: child.type, rot: child.rot, color: child.color, parent: copy.id, slot: child.slot });
      if (c) added.push(snapshotOf(c));
    }
    push({ undo: () => opRemove(copy.id), redo: () => opRestore(added) });
    return copy;
  }
  /** Removes an item and whatever sits on it as one entry. */
  function remove(id) {
    const snapshots = opRemove(id);
    if (!snapshots) return false;
    push({ undo: () => opRestore(snapshots), redo: () => opRemove(id) });
    return true;
  }
  function move(id, gx, gz) {
    const record = state.get(id);
    if (!record || record.parent || (record.gx === gx && record.gz === gz)) return false;
    const prev = opTransform(id, { gx, gz });
    if (!prev) return false;
    push({ undo: () => opTransform(id, prev), redo: () => opTransform(id, { gx, gz }) });
    return true;
  }
  /** Moves a surface item to a slot on a supporter. */
  function place(id, parent, slot) {
    const record = state.get(id);
    if (!record || !record.parent || (record.parent === parent && record.slot === slot)) return false;
    const prev = opPlace(id, parent, slot);
    if (!prev) return false;
    push({ undo: () => opPlace(id, prev.parent, prev.slot), redo: () => opPlace(id, parent, slot) });
    return true;
  }
  /** Moves a wall item to another spot on a wall. */
  function mount(id, wall, col, row) {
    const record = state.get(id);
    if (!record || !record.wall || (record.wall === wall && record.col === col && record.row === row)) return false;
    const prev = opMount(id, wall, col, row);
    if (!prev) return false;
    push({ undo: () => opMount(id, prev.wall, prev.col, prev.row), redo: () => opMount(id, wall, col, row) });
    return true;
  }
  function rotate(id) {
    const record = state.get(id);
    if (!record) return false;
    const rot = (record.rot + 1) % 4;
    const prev = opTransform(id, { rot });
    if (!prev) return false;
    push({ undo: () => opTransform(id, prev), redo: () => opTransform(id, { rot }) });
    return true;
  }
  function recolor(id, color) {
    const prev = opColor(id, color);
    if (prev === undefined || prev === color) return false;
    push({ undo: () => opColor(id, prev), redo: () => opColor(id, color) });
    return true;
  }
  /** Switches a lamp on or off as one entry. */
  function setLit(id, on) {
    const record = state.get(id);
    if (!record || record.lit === null || record.lit === !!on) return false;   // no event for a no-op
    const prev = opLit(id, on);
    if (prev === undefined) return false;
    push({ undo: () => opLit(id, prev), redo: () => opLit(id, on) });
    return true;
  }
  function setFinish(key, color) {
    if (!(key in finishes) || finishes[key] === color) return false;
    const prev = opFinish(key, color);
    push({ undo: () => opFinish(key, prev), redo: () => opFinish(key, color) });
    return true;
  }
  /** Changes several finishes as one history entry, e.g. both walls at once. Unknown or unchanged keys are skipped. */
  function setFinishes(changes) {
    const keys = Object.keys(changes).filter((k) => k in finishes && finishes[k] !== changes[k]);
    if (!keys.length) return false;
    const prev = Object.fromEntries(keys.map((k) => [k, opFinish(k, changes[k])]));
    push({ undo: () => keys.forEach((k) => opFinish(k, prev[k])), redo: () => keys.forEach((k) => opFinish(k, changes[k])) });
    return true;
  }
  /** Removes every item as a single history entry. */
  function clear() {
    if (!state.items.length) return false;
    const snapshot = opClear();
    push({ undo: () => opRestore(snapshot), redo: () => opClear() });
    return true;
  }
  /**
   * Replaces the shell (when `room` is given), items, and finishes as a single history entry,
   * for example from a loaded save or a fresh preset. The shell changes before items are restored.
   */
  function replaceRoom({ room: nextRoom = null, wall, wallLeft = wall, floor, floorStyle = 'parquet', lighting = finishes.lighting, pet = { present: false, color: finishes.petColor ?? 'ginger' }, items }) {
    const before = { room: { ...room }, wall: finishes.wall, wallLeft: finishes.wallLeft, floor: finishes.floor, floorStyle: finishes.floorStyle, lighting: finishes.lighting, petPresent: finishes.petPresent, petColor: finishes.petColor, items: state.serialize() };
    const ordered = [...items.filter((i) => !i.parent), ...items.filter((i) => i.parent)];
    const after = { room: nextRoom ? { ...nextRoom } : { ...room }, wall, wallLeft, floor, floorStyle, lighting, petPresent: !!pet.present, petColor: pet.color, items: ordered.map(snapshotOf) };
    const sameRoom = (a, b) => a.preset === b.preset && a.width === b.width && a.depth === b.depth;
    const apply = (r) => { opClear(); if (!sameRoom(r.room, room)) opRoom(r.room); opFinish('wall', r.wall); opFinish('floor', r.floor); for (const k of ['wallLeft', 'floorStyle', 'petColor', 'petPresent']) if (k in finishes && r[k] !== undefined) opFinish(k, r[k]); if ('lighting' in finishes && r.lighting !== undefined) opFinish('lighting', r.lighting); opRestore(r.items); };
    apply(after);
    push({ undo: () => apply(before), redo: () => apply(after) });
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return false;
    entry.undo();
    redoStack.push(entry);
    notify();
    return true;
  }
  function redo() {
    const entry = redoStack.pop();
    if (!entry) return false;
    entry.redo();
    undoStack.push(entry);
    notify();
    return true;
  }
  /** Forgets history without touching the room, e.g. after building the starter layout. */
  function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    notify();
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { add, duplicate, remove, move, place, mount, rotate, recolor, setLit, setFinish, setFinishes, clear, replaceRoom, undo, redo, canUndo, canRedo, clearHistory, subscribe };
}
