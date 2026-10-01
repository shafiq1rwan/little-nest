import * as THREE from 'three';
import { CATALOG, recolor } from './props.js';
import { createRoom } from './room.js';
import { createScene } from './scene/create-scene.js';
import { createThumbnails } from './scene/thumbnails.js';
import { tintModel as tint, disposeModel, measureModel } from './scene/geometry.js';
import { installIcons } from './ui/icons.js';
import { CELL, CAMERA, RENDER, MUSIC, SAVE_KEY, ROOMS_KEY, MUSIC_KEY, MAX_SAVED_ITEMS } from './config/game.js';
import { BACKDROP, SELECTION_OUTLINE, GHOST_OK, GHOST_BLOCKED, WALL_FINISHES, FLOOR_FINISHES, ITEM_COLORS } from './config/theme.js';
import { ROOM_PRESETS, DEFAULT_PRESET, WALL_HEIGHT, MIN_ROOM_SIZE, MAX_ROOM_SIZE, presetFixtures } from './data/presets.js';
import { createPlacement } from './game/placement.js';
import { createRoomState, newItemId } from './game/state.js';
import { createCommands } from './game/commands.js';
import { createInput } from './game/input.js';
import { serializeRoom } from './persistence/schema.js';
import { createGallery, DEFAULT_ROOM_NAME } from './persistence/gallery.js';
import { exportRoom, parseImport } from './persistence/transfer.js';
import { createResponsiveHUD } from './ui/responsive.js';
import { createGalleryDialog } from './ui/gallery.js';
import { createToast, buildCatalog, setCatalogActive, bindCatalogFilter, bindTabs, buildFinishSwatches, renderSelectionCard, setPressed } from './ui/hud.js';
import { createMusic } from './ui/music.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const canvas = $('scene');
const { renderer, scene, camera, controls, resetView, zoomBy, resize, setFrame } = createScene({ canvas, camera: CAMERA, render: RENDER, backdrop: BACKDROP });

// ---------- room shell ----------
// The shell (floor, walls, windows, grid) is rebuilt whenever the room preset changes. `placement`
// and `wallBlocked` are reconfigured in place so everything holding them keeps working.
const roomConfig = { preset: DEFAULT_PRESET, width: ROOM_PRESETS[DEFAULT_PRESET].width, depth: ROOM_PRESETS[DEFAULT_PRESET].depth };
const finishes = { wall: WALL_FINISHES[0].color, floor: FLOOR_FINISHES[0].color };
const WALL_ROWS = WALL_HEIGHT / 0.5;
const placement = createPlacement({ catalog: CATALOG, width: roomConfig.width, depth: roomConfig.depth, cell: CELL, wallRows: WALL_ROWS, wallRow: 0.5 });
const wallBlocked = new Set();
let shell = null;      // { root, floorMat, wallMat, walls, wallPanels, dispose }
let grid = null;
let gridVisible = false;
let wallsVisible = true;
function presetFor(room) {
  return { ...ROOM_PRESETS[room.preset], width: room.width, depth: room.depth };
}
/** Placement rules for another room size, used to validate saves and imports before they are applied. */
function placementFor(room) {
  return createPlacement({ catalog: CATALOG, width: room.width, depth: room.depth, cell: CELL, wallRows: WALL_ROWS, wallRow: 0.5 });
}
function wallBlockedFor(room) {
  return placementFor(room).blockedWallCells(presetFixtures(presetFor(room)));
}
function makeGrid(width, depth) {
  const pts = [];
  for (let x = 0; x <= width; x++) pts.push(x - width / 2, 0, -depth / 2, x - width / 2, 0, depth / 2);
  for (let z = 0; z <= depth; z++) pts.push(-width / 2, 0, z - depth / 2, width / 2, 0, z - depth / 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 }));
  lines.position.y = 0.055;
  return lines;
}
function buildShell(room) {
  const preset = presetFor(room);
  if (shell) shell.dispose();
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  shell = createRoom(scene, preset, WALL_HEIGHT, { wallColor: finishes.wall, floorColor: finishes.floor });
  shell.walls.visible = wallsVisible;
  placement.configure({ width: room.width, depth: room.depth });
  wallBlocked.clear();
  for (const c of placement.blockedWallCells(presetFixtures(preset))) wallBlocked.add(c);
  grid = makeGrid(room.width, room.depth);
  grid.visible = gridVisible;
  scene.add(grid);
  setFrame(Math.max(room.width, room.depth));
}
buildShell(roomConfig);

// ---------- placement state ----------
// Committed state lives in `state` as serializable records; meshes are looked up by record id.
const state = createRoomState({ placement, wallBlocked });
const commands = createCommands({ state, finishes, room: roomConfig });   // every room mutation goes through here so it can be undone
const meshes = new Map();             // record id -> THREE.Group
let selectedType = null;              // catalog key while placing
let ghost = null;                     // preview mesh while placing
let dragging = null;                  // record being moved
let dragTarget = null;                // { gx, gz } or { parent, slot } the drag would drop onto
let ghostTarget = null;               // { parent, slot } under the pointer while placing a surface item
let selected = null;                  // record shown in the selection card
let pendingSelection = false;         // selection card update deferred until the gesture ends
const selectionBox = new THREE.Box3Helper(new THREE.Box3(), SELECTION_OUTLINE);
selectionBox.visible = false;
scene.add(selectionBox);

const { footprint } = placement;
function isFree(type, gx, gz, rot, ignoreId = null) {
  return state.canPlace(type, gx, gz, rot, ignoreId);
}
function worldPos(type, gx, gz, rot) {
  const p = placement.worldPos(type, gx, gz, rot);
  return new THREE.Vector3(p.x, p.y, p.z);
}
function snap(hit, type, rot) {
  return placement.snap(hit, type, rot);
}
function meshOf(record) {
  return meshes.get(record.id);
}
/** Places a mesh from its record. Surface items are children of their supporter's group, so they follow it. */
function applyTransform(record) {
  const mesh = meshOf(record);
  if (record.parent) {
    const parentRecord = state.get(record.parent);
    const parentMesh = meshes.get(record.parent);
    if (mesh.parent !== parentMesh) parentMesh.add(mesh);
    const local = placement.slotLocal(parentRecord.type, record.slot);
    mesh.position.set(local.x, local.y, local.z);
  } else if (record.wall) {
    if (mesh.parent !== scene) scene.add(mesh);
    const w = placement.wallWorld(record.type, record.wall, record.col, record.row);
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = w.rotY;
    return;
  } else {
    if (mesh.parent !== scene) scene.add(mesh);
    mesh.position.copy(worldPos(record.type, record.gx, record.gz, record.rot));
  }
  mesh.rotation.y = (record.rot * Math.PI) / 2;
}
/** Nearest wall spot under the pointer for a wall item: { wall, col, row, free } or null. */
function wallUnder(ev, type, ignoreId = null) {
  // Furniture in front of the wall blocks the spot, so nothing can be hung where it cannot be seen.
  const others = [...meshes.entries()].filter(([id]) => id !== ignoreId).map(([, m]) => m);
  const hit = input.hitFirst(ev, [shell.wallPanels.back, shell.wallPanels.left, ...others]);
  const wall = hit?.object.userData.wall;
  if (!wall) return null;
  const { col, row } = placement.wallSnap(type, wall, hit.point);
  return { wall, col, row, free: state.canMount(type, wall, col, row, ignoreId) };
}
function placeWallGhost(target) {
  const w = placement.wallWorld(selectedType, target.wall, target.col, target.row);
  ghost.position.set(w.x, w.y, w.z);
  ghost.rotation.y = w.rotY;
}
/** Meshes of floor items that offer surface slots. */
function supporterMeshes() {
  return state.items.filter((r) => !r.parent && placement.surfaceOf(r.type)).map(meshOf);
}
/** World position of a slot on a supporter. */
function slotWorld(parentId, slot) {
  const parentRecord = state.get(parentId);
  const local = placement.slotLocal(parentRecord.type, slot);
  return meshes.get(parentId).localToWorld(new THREE.Vector3(local.x, local.y, local.z));
}
/** Nearest surface slot under the pointer: { parent, slot, free } or null. `ignoreId` is the item being moved. */
function surfaceUnder(ev, type, ignoreId = null) {
  const hit = input.hitAmong(ev, supporterMeshes(), (id) => id !== ignoreId && !state.get(id)?.parent);
  if (!hit) return null;
  const parentRecord = state.get(hit.id);
  const local = meshes.get(hit.id).worldToLocal(hit.point.clone());
  const slot = placement.nearestSlot(parentRecord.type, local);
  if (slot < 0) return null;
  return { parent: hit.id, slot, free: state.canPlaceOn(type, hit.id, slot, ignoreId) };
}
// The scene mirrors the command log: meshes are created, moved, recolored, and dropped from events,
// so undo and redo need no special handling here.
commands.subscribe((kind, p) => {
  if (kind === 'add') {
    const mesh = CATALOG[p.type].build();
    if (p.color !== null) recolor(mesh, p.color);
    mesh.userData.itemId = p.id;
    meshes.set(p.id, mesh);
    applyTransform(p);   // also attaches the mesh to the scene or to its supporter
    updateCount();
  } else if (kind === 'remove') {
    if (selected?.id === p.id) setSelected(null);
    const mesh = meshes.get(p.id);
    meshes.delete(p.id);
    mesh.removeFromParent();
    disposeModel(mesh);
    updateCount();
  } else if (kind === 'transform') {
    applyTransform(p);
    if (selected === p) updateSelection();
  } else if (kind === 'color') {
    recolor(meshOf(p), p.color);
    if (selected === p) updateSelection();
  } else if (kind === 'finish') {
    (p.key === 'wall' ? shell.wallMat : shell.floorMat).color.setHex(p.color);
    syncFinishSwatches();
  } else if (kind === 'room') {
    buildShell(p);
  } else if (kind === 'history') {
    $('undo-tool').disabled = !p.canUndo;
    $('redo-tool').disabled = !p.canRedo;
  }
});
function addItem(type, gx, gz, rot, color = null, id = null, parent = null, slot = null, wall = null, col = null, row = null) {
  return commands.add({ type, gx, gz, rot, color, id, parent, slot, wall, col, row });
}
function removeItem(record) {
  commands.remove(record.id);
}
function duplicateSelected() {
  if (!selected || dragging) { if (!selected) toast('Select something to copy it.'); return; }
  const copy = commands.duplicate(selected.id);
  if (!copy) { toast('There is no free spot nearby for a copy.'); return; }
  setSelected(copy);
}
function undoRedo(direction) {
  if (dragging) return;
  cancelPlacing();
  const done = direction === 'undo' ? commands.undo() : commands.redo();
  if (!done) toast(direction === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.');
}
function setSelected(item, showControls = true) {
  if (selected && meshOf(selected)) tint(meshOf(selected), null);
  selected = item ? state.get(item.id) : null;
  selectionBox.visible = !!selected;
  if (showControls) updateSelection();
}

// ---------- placing from catalog ----------
function startPlacing(type) {
  cancelPlacing();
  setSelected(null);
  selectedType = type;
  ghost = CATALOG[type].build();
  ghost.userData.rot = 0;
  tint(ghost, GHOST_OK);
  ghost.visible = false;
  scene.add(ghost);
  const where = placement.isSurfaceItem(type) ? ' on a table or shelf' : placement.isWallItem(type) ? ' on a wall' : '';
  $('mode-label').textContent = 'Place ' + CATALOG[type].label.toLowerCase() + where + ' · Esc to cancel';
  canvas.style.cursor = 'crosshair';
  updateSelection();
  if (hud.isCompact()) hud.setExpanded(false);
}
function cancelPlacing() {
  if (ghost) { scene.remove(ghost); disposeModel(ghost); }
  ghost = null;
  ghostTarget = null;
  selectedType = null;
  $('mode-label').textContent = 'Decorate mode';
  canvas.style.cursor = 'grab';
  updateSelection();
}
function rotateSelected() {
  if (dragging) return;
  if (ghost) { ghost.userData.rot = (ghost.userData.rot + 1) % 4; ghost.rotation.y = ghost.userData.rot * Math.PI / 2; return; }
  if (!selected) { toast('Select furniture to rotate it.'); return; }
  if (selected.wall) { toast('Wall decorations already face the room.'); return; }
  if (!commands.rotate(selected.id)) toast('There needs to be more space to rotate this item.');
}

// ---------- input ----------
function finishDrag(showControls = true, allReleased = input.activePointers() === 0) {
  if (dragging) {
    // One history entry per completed drag. A blocked drop leaves the record untouched; the mesh
    // snaps back to the committed position either way.
    if (dragTarget && dragging.parent) commands.place(dragging.id, dragTarget.parent, dragTarget.slot);
    else if (dragTarget && dragging.wall) commands.mount(dragging.id, dragTarget.wall, dragTarget.col, dragTarget.row);
    else if (dragTarget) commands.move(dragging.id, dragTarget.gx, dragTarget.gz);
    applyTransform(dragging);
    tint(meshOf(dragging), null);
    dragging = null;
    dragTarget = null;
    pendingSelection = true;
  }
  if (showControls && pendingSelection && allReleased) { pendingSelection = false; updateSelection(); }
}

const input = createInput({
  canvas,
  camera,
  pickables: () => [...meshes.values()],
  idOf: (o) => o.userData.itemId || null,
}, {
  move(hit, ev) {
    if (photoMode) return;
    if (ghost && placement.isWallItem(selectedType)) {
      ghostTarget = wallUnder(ev, selectedType);
      ghost.visible = !!ghostTarget;
      if (!ghostTarget) return;
      placeWallGhost(ghostTarget);
      tint(ghost, ghostTarget.free ? GHOST_OK : GHOST_BLOCKED);
    } else if (dragging && dragging.wall) {
      const target = wallUnder(ev, dragging.type, dragging.id);
      if (!target) return;
      const w = placement.wallWorld(dragging.type, target.wall, target.col, target.row);
      const mesh = meshOf(dragging);
      mesh.position.set(w.x, w.y, w.z);
      mesh.rotation.y = w.rotY;
      dragTarget = { wall: target.wall, col: target.col, row: target.row };
      tint(mesh, target.free ? null : GHOST_BLOCKED);
    } else if (ghost && placement.isSurfaceItem(selectedType)) {
      // Small items preview on the nearest free slot of the table or shelf under the pointer.
      ghostTarget = surfaceUnder(ev, selectedType);
      ghost.visible = !!ghostTarget;
      if (!ghostTarget) return;
      ghost.position.copy(slotWorld(ghostTarget.parent, ghostTarget.slot));
      ghost.rotation.y = ((state.get(ghostTarget.parent).rot + ghost.userData.rot) * Math.PI) / 2;
      tint(ghost, ghostTarget.free ? GHOST_OK : GHOST_BLOCKED);
    } else if (ghost) {
      if (!hit) return;
      const rot = ghost.userData.rot;
      const { gx, gz } = snap(hit, selectedType, rot);
      ghost.visible = true;
      ghost.position.copy(worldPos(selectedType, gx, gz, rot));
      ghost.rotation.y = (rot * Math.PI) / 2;
      tint(ghost, isFree(selectedType, gx, gz, rot) ? GHOST_OK : GHOST_BLOCKED);
    } else if (dragging && dragging.parent) {
      const target = surfaceUnder(ev, dragging.type, dragging.id);
      if (!target) return;
      const mesh = meshOf(dragging);
      mesh.position.copy(mesh.parent.worldToLocal(slotWorld(target.parent, target.slot)));
      dragTarget = { parent: target.parent, slot: target.slot };
      tint(mesh, target.free ? null : GHOST_BLOCKED);
    } else if (dragging) {
      if (!hit) return;
      const { gx, gz } = snap(hit, dragging.type, dragging.rot);
      meshOf(dragging).position.copy(worldPos(dragging.type, gx, gz, dragging.rot));
      dragTarget = { gx, gz };
      tint(meshOf(dragging), isFree(dragging.type, gx, gz, dragging.rot, dragging.id) ? null : GHOST_BLOCKED);
    }
  },
  down({ hit, pick, shiftKey }) {
    if (photoMode) return;
    if (ghost && placement.isWallItem(selectedType)) {
      if (!ghostTarget) { toast('Wall decorations go on the two walls. Point at one to place it.'); return; }
      if (!ghostTarget.free) { toast('That part of the wall is taken. Try a clear spot.'); return; }
      const placed = addItem(selectedType, null, null, 0, null, null, null, null, ghostTarget.wall, ghostTarget.col, ghostTarget.row);
      if (placed && !shiftKey) { cancelPlacing(); setSelected(placed); }
      return;
    }
    if (ghost && placement.isSurfaceItem(selectedType)) {
      if (!ghostTarget) { toast('Small items go on tables and shelves. Point at one to place it.'); return; }
      if (!ghostTarget.free) { toast('That spot is taken. Try another part of the surface.'); return; }
      const placed = addItem(selectedType, null, null, ghost.userData.rot, null, null, ghostTarget.parent, ghostTarget.slot);
      if (placed && !shiftKey) { cancelPlacing(); setSelected(placed); }
      return;
    }
    if (ghost) {
      if (!hit) return;
      const rot = ghost.userData.rot;
      const { gx, gz } = snap(hit, selectedType, rot);
      if (isFree(selectedType, gx, gz, rot)) {
        const placed = addItem(selectedType, gx, gz, rot);
        if (!shiftKey) { cancelPlacing(); setSelected(placed); }
      } else toast('That tile is occupied. Choose a free spot.');
      return;
    }
    const id = pick();
    const item = id ? state.get(id) : null;
    // Keep the canvas size stable until the gesture finishes: the selection card can resize the drawer.
    setSelected(item, false);
    pendingSelection = true;
    if (item) { dragging = item; dragTarget = null; }
  },
  up({ allReleased }) {
    finishDrag(true, allReleased);
  },
  secondTouch() {
    finishDrag(false);
    setSelected(null, false);
    pendingSelection = true;
  },
  key(action, ev) {
    if (photoMode) { if (action === 'cancel') exitPhotoMode(); return; }
    if (action === 'cancel') { cancelPlacing(); setSelected(null); }
    if (action === 'rotate') rotateSelected();
    if (action === 'remove' && selected && !dragging) { ev.preventDefault(); removeItem(selected); }
    if (action === 'undo' || action === 'redo') { ev.preventDefault(); undoRedo(action); }
    if (action === 'duplicate') { ev.preventDefault(); duplicateSelected(); }
  },
});

// ---------- HUD ----------
installIcons();
const thumbnails = createThumbnails(CATALOG);
const toast = createToast($('toast'));
const hud = createResponsiveHUD({
  panel: $('panel'),
  panelContent: $('panel-content'),
  selectionCard: $('selection-card'),
  viewport: $('viewport'),
  toggle: $('panel-toggle'),
  hasSelection: () => !!selected,
});

function updateCount() { $('item-count').textContent = state.items.length + ' items in room'; }
function updateSelection() {
  hud.markSelection();
  if (selected && hud.isCompact()) hud.setExpanded(true);
  $('rotate-tool').disabled = !selected && !ghost;
  setCatalogActive($('catalog'), selected?.type || selectedType);
  const def = selected && CATALOG[selected.type];
  let canRecolor = false;
  if (selected) meshOf(selected).traverse((o) => { if (o.userData.recolor) canRecolor = true; });
  renderSelectionCard({
    card: $('selection-card'),
    item: selected,
    def,
    thumbnail: selected && thumbnails[selected.type],
    sizeText: !selected ? '' : selected.parent ? 'Sits on tables and shelves' : selected.wall ? 'On the wall' : (({ w, d }) => w + ' × ' + d + ' tiles')(footprint(selected.type, selected.rot)),
    canRecolor,
    colors: ITEM_COLORS,
    activeColor: selected && (selected.color ?? def.defaultColor ?? ITEM_COLORS[0].color),
    onColor: (color) => commands.recolor(selected.id, color),
  });
}

buildCatalog({ container: $('catalog'), catalog: CATALOG, thumbnails, onChoose: (key) => (selectedType === key ? cancelPlacing() : startPlacing(key)) });
bindCatalogFilter({ container: $('catalog'), catalog: CATALOG, search: $('search'), categoryButtons: [...document.querySelectorAll('[data-category]')], emptyEl: $('empty-catalog') });
bindTabs({ buttons: [...document.querySelectorAll('[data-tab]')], onChange: () => cancelPlacing() });
const syncFinishSwatches = buildFinishSwatches([
  { el: $('wall-swatches'), finishes: WALL_FINISHES, current: () => finishes.wall, onPick: (c) => commands.setFinish('wall', c) },
  { el: $('floor-swatches'), finishes: FLOOR_FINISHES, current: () => finishes.floor, onPick: (c) => commands.setFinish('floor', c) },
]);

$('rotate-selected').onclick = rotateSelected;
$('rotate-tool').onclick = rotateSelected;
$('undo-tool').onclick = () => undoRedo('undo');
$('redo-tool').onclick = () => undoRedo('redo');
$('remove-selected').onclick = () => { if (selected) removeItem(selected); };
$('duplicate-selected').onclick = duplicateSelected;
$('deselect').onclick = () => setSelected(null);
$('move-tool').onclick = () => { cancelPlacing(); toast('Drag any furniture to move it.'); };
$('move-selected').onclick = () => { if (hud.isCompact()) hud.setExpanded(false); toast('Drag the selected furniture to a free tile.'); };
function showGrid(on) { gridVisible = on; grid.visible = on; setPressed($('grid-tool'), on); }
$('grid-tool').onclick = () => showGrid(!gridVisible);
$('walls-tool').onclick = () => { wallsVisible = !wallsVisible; shell.walls.visible = wallsVisible; $('walls-tool').setAttribute('aria-pressed', String(wallsVisible)); };
$('help-toggle').onclick = () => { $('help-panel').hidden = !$('help-panel').hidden; };

const music = createMusic({ src: MUSIC.src, volume: MUSIC.volume, storageKey: MUSIC_KEY, button: $('music-toggle'), installIcons, onToggle: (on) => toast(on ? 'Music on.' : 'Music off.') });

$('zoom-in').onclick = () => zoomBy(CAMERA.zoomStep);
$('zoom-out').onclick = () => zoomBy(1 / CAMERA.zoomStep);
$('reset-view').onclick = resetView;

// ---------- saved rooms ----------
function settle() { finishDrag(); cancelPlacing(); setSelected(null); }
function clearRoom() { settle(); commands.clear(); }

/** Saved-room data for a preset's starter layout, with fresh ids. Returns the data and the id to select. */
function presetRoomData(presetId) {
  const preset = ROOM_PRESETS[presetId];
  const byKey = new Map();
  const items = [];
  let selectId = null;
  for (const it of preset.items) {
    const id = newItemId();
    if (it.key) byKey.set(it.key, id);
    if (it.select) selectId = id;
    items.push({
      id, type: it.type, rot: it.wall ? 0 : it.rot ?? 0, color: it.color ?? null,
      gx: it.on || it.wall ? null : it.gx, gz: it.on || it.wall ? null : it.gz,
      parent: it.on ? byKey.get(it.on) : null, slot: it.on ? it.slot : null,
      wall: it.wall ?? null, col: it.wall ? it.col : null, row: it.wall ? it.row : null,
    });
  }
  return {
    data: { room: { preset: presetId, width: preset.width, depth: preset.depth }, wall: WALL_FINISHES[0].color, floor: FLOOR_FINISHES[0].color, items },
    selectId,
  };
}
/** Replaces the room with a preset's fresh layout as one undoable step. */
function startPreset(presetId) {
  settle();
  const { data, selectId } = presetRoomData(presetId);
  commands.replaceRoom(data);
  return { selectId };
}

const parseOptions = { catalog: CATALOG, placementFor, wallBlockedFor, presets: ROOM_PRESETS, maxItems: MAX_SAVED_ITEMS, newId: newItemId, sizeRange: [MIN_ROOM_SIZE, MAX_ROOM_SIZE] };
const gallery = createGallery({ key: ROOMS_KEY, legacyKey: SAVE_KEY, ...parseOptions });
let currentRoom = null;   // { id, name } of the gallery entry the open design belongs to
function setCurrentRoom(summary) {
  currentRoom = summary ? { id: summary.id, name: summary.name } : null;
  $('room-name').textContent = currentRoom ? currentRoom.name : 'Unsaved room';
}
function currentRoomData() {
  finishDrag();
  return serializeRoom({ room: roomConfig, wall: finishes.wall, floor: finishes.floor, items: state.items });
}
/** Saves into entry `id` (or a new entry when null). Returns the summary, or null when storage refused. */
function saveRoom(id, name) {
  const summary = gallery.save(id, name, currentRoomData());
  if (!summary) { toast('Your browser could not save this room.'); return null; }
  setCurrentRoom(summary);
  toast('"' + summary.name + '" saved.');
  return summary;
}
function loadRoom(id) {
  let entry;
  // Validate and migrate before touching the live room so a bad save never wipes the current design.
  try { entry = gallery.load(id); } catch { toast('This saved room could not be loaded. Your current room is safe.'); return; }
  settle();
  commands.replaceRoom(entry.room);   // one history entry, so a load can be undone
  setCurrentRoom(entry);
  toast('"' + entry.name + '" loaded.');
}
/** Offers a URL as a file download. */
function downloadUrl(filename, url, revoke = false) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(filename, text) {
  downloadUrl(filename, URL.createObjectURL(new Blob([text], { type: 'application/json' })), true);
}
function exportEntry(id) {
  let entry;
  try { entry = gallery.load(id); } catch { toast('This room could not be exported.'); return; }
  const { filename, text } = exportRoom({ name: entry.name, room: serializeRoom(entry.room) });
  downloadText(filename, text);
  toast('"' + entry.name + '" exported.');
}
async function importFile(file) {
  let parsed;
  try {
    const text = await file.text();
    parsed = parseImport(text, { ...parseOptions, fallbackName: file.name.replace(/\.littlenest\.json$|\.json$/i, '') });
  } catch { toast('That file is not a Little Nest room. Nothing was changed.'); return; }
  const summary = gallery.save(null, parsed.name, serializeRoom(parsed.room));
  toast(summary ? '"' + summary.name + '" imported. Load it from the list.' : 'Your browser could not store the imported room.');
}
const galleryDialog = createGalleryDialog({
  dialog: $('gallery'), list: $('gallery-list'), saveForm: $('gallery-save'), nameInput: $('gallery-name'),
  emptyEl: $('gallery-empty'), closeButton: $('gallery-close'), importButton: $('gallery-import'), importInput: $('gallery-import-file'),
  presetList: $('gallery-presets'), presets: ROOM_PRESETS,
  handlers: {
    onNewRoom: (presetId) => {
      const { selectId } = startPreset(presetId);
      setCurrentRoom(null);
      if (!hud.isCompact() && selectId) setSelected(state.get(selectId));
      toast('New ' + ROOM_PRESETS[presetId].name.toLowerCase() + ' ready. Undo brings the old room back.');
    },
    onExport: exportEntry,
    onImport: importFile,
    entries: () => gallery.list(),
    currentId: () => currentRoom?.id ?? null,
    onSaveAs: (name) => saveRoom(null, name),
    onLoad: loadRoom,
    onRename: (id, name) => { const s = gallery.rename(id, name); if (s && currentRoom?.id === id) setCurrentRoom(s); },
    onDuplicate: (id) => { const s = gallery.duplicate(id); toast(s ? '"' + s.name + '" created.' : 'Could not duplicate this room.'); },
    onDelete: (id) => { gallery.remove(id); if (currentRoom?.id === id) setCurrentRoom(null); toast('Room deleted.'); },
  },
});
// Save keeps the open room; the first save of a fresh design creates "Living room" without a prompt.
$('save').onclick = () => saveRoom(currentRoom?.id ?? null, currentRoom?.name ?? DEFAULT_ROOM_NAME);
$('load').onclick = () => galleryDialog.open();
$('clear').onclick = () => { clearRoom(); toast('Room cleared. A fresh start.'); };
gallery.migrateLegacy();

// ---------- photo mode ----------
// The HUD hides, furniture cannot be picked, and the camera stays free so the room can be framed.
let photoMode = false;
let photoRestore = null;   // HUD state to put back when leaving
function enterPhotoMode() {
  if (photoMode) return;
  settle();
  photoRestore = { grid: gridVisible, panelExpanded: hud.isExpanded() };
  photoMode = true;
  grid.visible = false;
  document.body.classList.add('photo');
  $('photo-bar').hidden = false;
  setPressed($('photo-tool'), true);
  $('photo-tool').setAttribute('aria-label', 'Leave photo mode');
  canvas.style.cursor = 'default';
}
function exitPhotoMode() {
  if (!photoMode) return;
  photoMode = false;
  document.body.classList.remove('photo');
  $('photo-bar').hidden = true;
  setPressed($('photo-tool'), false);
  $('photo-tool').setAttribute('aria-label', 'Photo mode');
  showGrid(photoRestore.grid);
  hud.setExpanded(photoRestore.panelExpanded);
  photoRestore = null;
  canvas.style.cursor = 'grab';
  updateSelection();
}
/** Renders the current view at up to twice the screen resolution and downloads it as a PNG. */
function savePhoto() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const scale = Math.max(1, Math.min(2, Math.floor(4096 / Math.max(w, h))));
  const prevRatio = renderer.getPixelRatio();
  let url = null;
  try {
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
  } catch {
    toast('The photo could not be captured.');
  } finally {
    // Always put the renderer back, whether or not the capture worked.
    renderer.setPixelRatio(prevRatio);
    renderer.setSize(w, h, false);
  }
  if (!url) return;
  const slug = (currentRoom?.name ?? 'little nest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'little-nest';
  downloadUrl(slug + '-photo.png', url);
  toast('Photo saved.');
}
$('photo-tool').onclick = () => (photoMode ? exitPhotoMode() : enterPhotoMode());
$('photo-exit').onclick = exitPhotoMode;
$('photo-save').onclick = savePhoto;

// ---------- starter room ----------
const { selectId: starterSelectId } = startPreset(DEFAULT_PRESET);
commands.clearHistory();   // the starter layout is the baseline, not something to undo
setSelected(hud.isCompact() || !starterSelectId ? null : state.get(starterSelectId));
canvas.style.cursor = 'grab';

// ---------- loop ----------
renderer.setAnimationLoop(() => {
  resize();
  controls.update();
  if (selected) { selectionBox.box.setFromObject(meshOf(selected)); selectionBox.updateMatrixWorld(true); }
  renderer.render(scene, camera);
});

// Expose scene state for development checks. Items and the selection are returned as
// record copies with their mesh attached, so checks can inspect both data and visuals.
const withMesh = (r) => (r ? { ...r, mesh: meshOf(r) } : null);
window.__sim = {
  state, placement, commands, finishes, gallery, roomConfig, presets: ROOM_PRESETS, occupancy: state.occupancy, bgm: music.audio, scene, camera, controls,
  get grid() { return grid; }, get walls() { return shell.walls; }, get wallMat() { return shell.wallMat; }, get floorMat() { return shell.floorMat; }, get wallPanels() { return shell.wallPanels; },
  get currentRoom() { return currentRoom; },
  get photoMode() { return photoMode; },
  pointerToFloor: input.floorHit, snap, isFree, worldPos, meshOf, addItem, setSelected, rotateSelected, slotWorld, surfaceUnder, supporterMeshes, hitAmong: input.hitAmong, wallBlocked, startPreset,
  measure: measureModel,
  measureType: (type) => { const m = CATALOG[type].build(); const size = measureModel(m); disposeModel(m); return size; },
  catalogTypes: Object.keys(CATALOG),
  catalogTags: (type) => CATALOG[type].tags || [],
  get musicOn() { return music.isOn(); },
  get items() { return state.items.map(withMesh); },
  get ghost() { return ghost; },
  get selectedType() { return selectedType; },
  get selected() { return withMesh(selected); },
};
