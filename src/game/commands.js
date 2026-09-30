// Undoable mutations over the room: furniture records in `state` plus the wall and floor finishes.
// Every command applies immediately, emits change events for the scene to mirror, and pushes an
// inverse onto the history. No Three.js and no DOM.
//
// Events (subscribe(fn) receives (kind, payload)):
//   add       record                the record now exists; build its mesh
//   remove    { id }                the record is gone; drop its mesh
//   transform record                gx/gz/rot changed; move its mesh
//   color     record                color changed; recolor its mesh
//   finish    { key, color }        wall or floor color changed
//   history   { canUndo, canRedo }  undo/redo availability changed

export function createCommands({ state, finishes, limit = 100 }) {
  const listeners = new Set();
  const undoStack = [];
  const redoStack = [];

  const emit = (kind, payload) => listeners.forEach((fn) => fn(kind, payload));
  const canUndo = () => undoStack.length > 0;
  const canRedo = () => redoStack.length > 0;
  const notify = () => emit('history', { canUndo: canUndo(), canRedo: canRedo() });
  const snapshotOf = ({ id, type, gx, gz, rot, color }) => ({ id, type, gx, gz, rot, color });

  // ----- primitive operations: mutate, emit, but never touch history -----
  function opAdd(data) {
    const record = state.add(data);
    if (record) emit('add', record);
    return record;
  }
  function opRemove(id) {
    const record = state.get(id);
    if (!record) return null;
    const snapshot = snapshotOf(record);
    state.remove(id);
    emit('remove', { id });
    return snapshot;
  }
  function opTransform(id, next) {
    const record = state.get(id);
    if (!record) return null;
    const prev = { gx: record.gx, gz: record.gz, rot: record.rot };
    if (!state.transform(id, next)) return null;
    emit('transform', record);
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
  function opClear() {
    const snapshot = state.serialize();
    for (const it of snapshot) opRemove(it.id);
    return snapshot;
  }
  function opRestore(items) {
    for (const it of items) opAdd(it);
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
  function remove(id) {
    const snapshot = opRemove(id);
    if (!snapshot) return false;
    push({ undo: () => opAdd(snapshot), redo: () => opRemove(snapshot.id) });
    return true;
  }
  function move(id, gx, gz) {
    const record = state.get(id);
    if (!record || (record.gx === gx && record.gz === gz)) return false;
    const prev = opTransform(id, { gx, gz });
    if (!prev) return false;
    push({ undo: () => opTransform(id, prev), redo: () => opTransform(id, { gx, gz }) });
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
  function setFinish(key, color) {
    if (!(key in finishes) || finishes[key] === color) return false;
    const prev = opFinish(key, color);
    push({ undo: () => opFinish(key, prev), redo: () => opFinish(key, color) });
    return true;
  }
  /** Removes every item as a single history entry. */
  function clear() {
    if (!state.items.length) return false;
    const snapshot = opClear();
    push({ undo: () => opRestore(snapshot), redo: () => opClear() });
    return true;
  }
  /** Replaces items and finishes (for example from a loaded save) as a single history entry. */
  function replaceRoom({ wall, floor, items }) {
    const before = { wall: finishes.wall, floor: finishes.floor, items: state.serialize() };
    const after = { wall, floor, items: items.map(snapshotOf) };
    const apply = (room) => { opClear(); opFinish('wall', room.wall); opFinish('floor', room.floor); opRestore(room.items); };
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

  return { add, remove, move, rotate, recolor, setFinish, clear, replaceRoom, undo, redo, canUndo, canRedo, clearHistory, subscribe };
}
