import * as THREE from 'three';
import { CATALOG, recolor } from './props.js';
import { createRoom } from './room.js';
import { createScene } from './scene/create-scene.js';
import { createThumbnails } from './scene/thumbnails.js';
import { tintModel as tint, disposeModel, measureModel } from './scene/geometry.js';
import { installIcons } from './ui/icons.js';
import { ROOM, CELL, WALL_H, CAMERA, RENDER, MUSIC, SAVE_KEY, MUSIC_KEY, MAX_SAVED_ITEMS } from './config/game.js';
import { BACKDROP, SELECTION_OUTLINE, GHOST_OK, GHOST_BLOCKED, WALL_FINISHES, FLOOR_FINISHES, ITEM_COLORS } from './config/theme.js';
import { STARTER_ROOM } from './data/starter-room.js';
import { createPlacement } from './game/placement.js';
import { createRoomState, newItemId } from './game/state.js';
import { createCommands } from './game/commands.js';
import { createInput } from './game/input.js';
import { serializeRoom, parseRoom } from './persistence/schema.js';
import { readJSON, readString, writeJSON } from './persistence/storage.js';
import { createResponsiveHUD } from './ui/responsive.js';
import { createToast, buildCatalog, setCatalogActive, bindCatalogFilter, bindTabs, buildFinishSwatches, renderSelectionCard, setPressed } from './ui/hud.js';
import { createMusic } from './ui/music.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const canvas = $('scene');
const { renderer, scene, camera, controls, resetView, zoomBy, resize } = createScene({ canvas, camera: CAMERA, render: RENDER, backdrop: BACKDROP });

// ---------- room ----------
const { floorMat, wallMat, walls } = createRoom(scene, ROOM, WALL_H);

const grid = new THREE.GridHelper(ROOM, ROOM, 0xffffff, 0xffffff);
grid.material.opacity = 0.12;
grid.material.transparent = true;
grid.position.y = 0.055;
grid.visible = false;
scene.add(grid);

// ---------- placement state ----------
// Committed state lives in `state` as serializable records; meshes are looked up by record id.
const placement = createPlacement({ catalog: CATALOG, room: ROOM, cell: CELL });
const state = createRoomState({ placement });
const finishes = { wall: wallMat.color.getHex(), floor: floorMat.color.getHex() };
const commands = createCommands({ state, finishes });   // every room mutation goes through here so it can be undone
const meshes = new Map();             // record id -> THREE.Group
let selectedType = null;              // catalog key while placing
let ghost = null;                     // preview mesh while placing
let dragging = null;                  // record being moved
let dragTarget = null;                // { gx, gz } the drag would drop onto
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
function applyTransform(record) {
  const mesh = meshOf(record);
  mesh.position.copy(worldPos(record.type, record.gx, record.gz, record.rot));
  mesh.rotation.y = (record.rot * Math.PI) / 2;
}
// The scene mirrors the command log: meshes are created, moved, recolored, and dropped from events,
// so undo and redo need no special handling here.
commands.subscribe((kind, p) => {
  if (kind === 'add') {
    const mesh = CATALOG[p.type].build();
    if (p.color !== null) recolor(mesh, p.color);
    mesh.userData.itemId = p.id;
    meshes.set(p.id, mesh);
    applyTransform(p);
    scene.add(mesh);
    updateCount();
  } else if (kind === 'remove') {
    if (selected?.id === p.id) setSelected(null);
    const mesh = meshes.get(p.id);
    meshes.delete(p.id);
    scene.remove(mesh);
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
function addItem(type, gx, gz, rot, color = null, id = null) {
  return commands.add({ type, gx, gz, rot, color, id });
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
  $('mode-label').textContent = 'Place ' + CATALOG[type].label.toLowerCase() + ' · Esc to cancel';
  canvas.style.cursor = 'crosshair';
  updateSelection();
  if (hud.isCompact()) hud.setExpanded(false);
}
function cancelPlacing() {
  if (ghost) { scene.remove(ghost); disposeModel(ghost); }
  ghost = null;
  selectedType = null;
  $('mode-label').textContent = 'Decorate mode';
  canvas.style.cursor = 'grab';
  updateSelection();
}
function rotateSelected() {
  if (dragging) return;
  if (ghost) { ghost.userData.rot = (ghost.userData.rot + 1) % 4; ghost.rotation.y = ghost.userData.rot * Math.PI / 2; return; }
  if (!selected) { toast('Select furniture to rotate it.'); return; }
  if (!commands.rotate(selected.id)) toast('There needs to be more space to rotate this item.');
}

// ---------- input ----------
function finishDrag(showControls = true, allReleased = input.activePointers() === 0) {
  if (dragging) {
    // One history entry per completed drag. A blocked drop leaves the record untouched; the mesh
    // snaps back to the committed position either way.
    if (dragTarget) commands.move(dragging.id, dragTarget.gx, dragTarget.gz);
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
  move(hit) {
    if (ghost) {
      const rot = ghost.userData.rot;
      const { gx, gz } = snap(hit, selectedType, rot);
      ghost.visible = true;
      ghost.position.copy(worldPos(selectedType, gx, gz, rot));
      ghost.rotation.y = (rot * Math.PI) / 2;
      tint(ghost, isFree(selectedType, gx, gz, rot) ? GHOST_OK : GHOST_BLOCKED);
    } else if (dragging) {
      const { gx, gz } = snap(hit, dragging.type, dragging.rot);
      meshOf(dragging).position.copy(worldPos(dragging.type, gx, gz, dragging.rot));
      dragTarget = { gx, gz };
      tint(meshOf(dragging), isFree(dragging.type, gx, gz, dragging.rot, dragging.id) ? null : GHOST_BLOCKED);
    }
  },
  down({ hit, pick, shiftKey }) {
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
    size: selected && footprint(selected.type, selected.rot),
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

// ---------- save / load ----------
function settle() { finishDrag(); cancelPlacing(); setSelected(null); }
function clearRoom() { settle(); commands.clear(); }
$('save').onclick = () => {
  finishDrag();
  const data = serializeRoom({ wall: finishes.wall, floor: finishes.floor, items: state.items });
  toast(writeJSON(SAVE_KEY, data) ? 'Room saved. Make yourself at home.' : 'Your browser could not save this room.');
};
$('load').onclick = () => {
  if (readString(SAVE_KEY) === null) { toast('No saved room yet. Save your design first.'); return; }
  let room;
  // Validate and migrate before touching the live room so a bad save never wipes the current design.
  try { room = parseRoom(readJSON(SAVE_KEY), { catalog: CATALOG, placement, maxItems: MAX_SAVED_ITEMS, newId: newItemId }); }
  catch { toast('This saved room could not be loaded. Your current room is safe.'); return; }
  settle();
  commands.replaceRoom(room);   // one history entry, so a load can be undone
  toast('Saved room loaded.');
};
$('clear').onclick = () => { clearRoom(); toast('Room cleared. A fresh start.'); };

// ---------- starter room ----------
let starterSelection = null;
for (const it of STARTER_ROOM) {
  const item = addItem(it.type, it.gx, it.gz, it.rot, it.color ?? null);
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
  state, placement, commands, finishes, occupancy: state.occupancy, bgm: music.audio, scene, camera, controls, grid, walls, wallMat, floorMat,
  pointerToFloor: input.floorHit, snap, isFree, worldPos, meshOf, addItem, setSelected, rotateSelected,
  measure: measureModel,
  get musicOn() { return music.isOn(); },
  get items() { return state.items.map(withMesh); },
  get ghost() { return ghost; },
  get selectedType() { return selectedType; },
  get selected() { return withMesh(selected); },
};
