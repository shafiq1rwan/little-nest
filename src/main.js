import * as THREE from 'three';
import { CATALOG, recolor } from './props.js';
import { createRoom } from './room.js';
import { createScene } from './scene/create-scene.js';
import { createThumbnails } from './scene/thumbnails.js';
import { tintModel as tint, disposeModel, measureModel } from './scene/geometry.js';
import { installIcons } from './ui/icons.js';
import { ROOM, CELL, WALL_H, CAMERA, RENDER, MUSIC, SAVE_KEY, ROOMS_KEY, MUSIC_KEY, MAX_SAVED_ITEMS } from './config/game.js';
import { BACKDROP, SELECTION_OUTLINE, GHOST_OK, GHOST_BLOCKED, WALL_FINISHES, FLOOR_FINISHES, ITEM_COLORS } from './config/theme.js';
import { STARTER_ROOM } from './data/starter-room.js';
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
const { renderer, scene, camera, controls, resetView, zoomBy, resize } = createScene({ canvas, camera: CAMERA, render: RENDER, backdrop: BACKDROP });

// ---------- room ----------
const { floorMat, wallMat, walls, wallPanels, fixtures } = createRoom(scene, ROOM, WALL_H);

const grid = new THREE.GridHelper(ROOM, ROOM, 0xffffff, 0xffffff);
grid.material.opacity = 0.12;
grid.material.transparent = true;
grid.position.y = 0.055;
grid.visible = false;
scene.add(grid);

// ---------- placement state ----------
// Committed state lives in `state` as serializable records; meshes are looked up by record id.
const placement = createPlacement({ catalog: CATALOG, room: ROOM, cell: CELL, wallRows: WALL_H / 0.5, wallRow: 0.5 });
const wallBlocked = placement.blockedWallCells(fixtures);   // windows and lights keep decorations off those wall cells
const state = createRoomState({ placement, wallBlocked });
const finishes = { wall: wallMat.color.getHex(), floor: floorMat.color.getHex() };
const commands = createCommands({ state, finishes });   // every room mutation goes through here so it can be undone
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
  const hit = input.hitFirst(ev, [wallPanels.back, wallPanels.left, ...others]);
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
    (p.key === 'wall' ? wallMat : floorMat).color.setHex(p.color);
    syncFinishSwatches();
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
$('deselect').onclick = () => setSelected(null);
$('move-tool').onclick = () => { cancelPlacing(); toast('Drag any furniture to move it.'); };
$('move-selected').onclick = () => { if (hud.isCompact()) hud.setExpanded(false); toast('Drag the selected furniture to a free tile.'); };
$('grid-tool').onclick = () => { grid.visible = !grid.visible; setPressed($('grid-tool'), grid.visible); };
$('walls-tool').onclick = () => { walls.visible = !walls.visible; $('walls-tool').setAttribute('aria-pressed', String(walls.visible)); };
$('help-toggle').onclick = () => { $('help-panel').hidden = !$('help-panel').hidden; };

const music = createMusic({ src: MUSIC.src, volume: MUSIC.volume, storageKey: MUSIC_KEY, button: $('music-toggle'), installIcons, onToggle: (on) => toast(on ? 'Music on.' : 'Music off.') });

$('zoom-in').onclick = () => zoomBy(CAMERA.zoomStep);
$('zoom-out').onclick = () => zoomBy(1 / CAMERA.zoomStep);
$('reset-view').onclick = resetView;

// ---------- saved rooms ----------
function settle() { finishDrag(); cancelPlacing(); setSelected(null); }
function clearRoom() { settle(); commands.clear(); }

const gallery = createGallery({ key: ROOMS_KEY, legacyKey: SAVE_KEY, catalog: CATALOG, placement, maxItems: MAX_SAVED_ITEMS, newId: newItemId, wallBlocked });
let currentRoom = null;   // { id, name } of the gallery entry the open design belongs to
function setCurrentRoom(summary) {
  currentRoom = summary ? { id: summary.id, name: summary.name } : null;
  $('room-name').textContent = currentRoom ? currentRoom.name : 'Unsaved room';
}
function currentRoomData() {
  finishDrag();
  return serializeRoom({ wall: finishes.wall, floor: finishes.floor, items: state.items });
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
    parsed = parseImport(text, { catalog: CATALOG, placement, maxItems: MAX_SAVED_ITEMS, newId: newItemId, wallBlocked, fallbackName: file.name.replace(/\.littlenest\.json$|\.json$/i, '') });
  } catch { toast('That file is not a Little Nest room. Nothing was changed.'); return; }
  const summary = gallery.save(null, parsed.name, serializeRoom(parsed.room));
  toast(summary ? '"' + summary.name + '" imported. Load it from the list.' : 'Your browser could not store the imported room.');
}
const galleryDialog = createGalleryDialog({
  dialog: $('gallery'), list: $('gallery-list'), saveForm: $('gallery-save'), nameInput: $('gallery-name'),
  emptyEl: $('gallery-empty'), closeButton: $('gallery-close'), importButton: $('gallery-import'), importInput: $('gallery-import-file'),
  handlers: {
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
  photoRestore = { grid: grid.visible, panelExpanded: hud.isExpanded() };
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
  grid.visible = photoRestore.grid;
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
let starterSelection = null;
const starterByKey = new Map();
for (const it of STARTER_ROOM) {
  const item = it.on
    ? addItem(it.type, null, null, it.rot, it.color ?? null, null, starterByKey.get(it.on)?.id, it.slot)
    : it.wall
      ? addItem(it.type, null, null, 0, it.color ?? null, null, null, null, it.wall, it.col, it.row)
      : addItem(it.type, it.gx, it.gz, it.rot, it.color ?? null);
  if (it.key && item) starterByKey.set(it.key, item);
  if (it.select) starterSelection = item;
}
commands.clearHistory();   // the starter layout is the baseline, not something to undo
setSelected(hud.isCompact() ? null : starterSelection);
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
  state, placement, commands, finishes, gallery, occupancy: state.occupancy, bgm: music.audio, scene, camera, controls, grid, walls, wallMat, floorMat,
  get currentRoom() { return currentRoom; },
  get photoMode() { return photoMode; },
  pointerToFloor: input.floorHit, snap, isFree, worldPos, meshOf, addItem, setSelected, rotateSelected, slotWorld, surfaceUnder, supporterMeshes, hitAmong: input.hitAmong, wallPanels, wallBlocked,
  measure: measureModel,
  get musicOn() { return music.isOn(); },
  get items() { return state.items.map(withMesh); },
  get ghost() { return ghost; },
  get selectedType() { return selectedType; },
  get selected() { return withMesh(selected); },
};
