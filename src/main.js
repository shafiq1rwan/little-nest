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
/** Commits a record and builds its mesh. Returns the record, or null when the tile is not free. */
function addItem(type, gx, gz, rot, color = null, id = null) {
  const record = state.add({ type, gx, gz, rot, color, id });
  if (!record) return null;
  const mesh = CATALOG[type].build();
  if (color !== null) recolor(mesh, color);
  mesh.userData.itemId = record.id;
  meshes.set(record.id, mesh);
  applyTransform(record);
  scene.add(mesh);
  updateCount();
  return record;
}
function removeItem(record) {
  if (selected === record) setSelected(null);
  const mesh = meshOf(record);
  state.remove(record.id);
  meshes.delete(record.id);
  scene.remove(mesh);
  disposeModel(mesh);
  updateCount();
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
  if (state.rotate(selected.id)) applyTransform(selected);
  else toast('There needs to be more space to rotate this item.');
  updateSelection();
}

// ---------- input ----------
function finishDrag(showControls = true, allReleased = input.activePointers() === 0) {
  if (dragging) {
    // A blocked drop leaves the record untouched; the mesh snaps back to the committed position either way.
    if (dragTarget) state.move(dragging.id, dragTarget.gx, dragTarget.gz);
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
    onColor: (color) => { recolor(meshOf(selected), color); state.setColor(selected.id, color); updateSelection(); },
  });
}

buildCatalog({ container: $('catalog'), catalog: CATALOG, thumbnails, onChoose: (key) => (selectedType === key ? cancelPlacing() : startPlacing(key)) });
bindCatalogFilter({ container: $('catalog'), catalog: CATALOG, search: $('search'), categoryButtons: [...document.querySelectorAll('[data-category]')], emptyEl: $('empty-catalog') });
bindTabs({ buttons: [...document.querySelectorAll('[data-tab]')], onChange: () => cancelPlacing() });
const syncFinishSwatches = buildFinishSwatches([
  { el: $('wall-swatches'), finishes: WALL_FINISHES, material: wallMat },
  { el: $('floor-swatches'), finishes: FLOOR_FINISHES, material: floorMat },
]);

$('rotate-selected').onclick = rotateSelected;
$('rotate-tool').onclick = rotateSelected;
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
function clearRoom() { finishDrag(); cancelPlacing(); setSelected(null); while (state.items.length) removeItem(state.items[0]); }
$('save').onclick = () => {
  finishDrag();
  const data = serializeRoom({ wall: wallMat.color.getHex(), floor: floorMat.color.getHex(), items: state.items });
  toast(writeJSON(SAVE_KEY, data) ? 'Room saved. Make yourself at home.' : 'Your browser could not save this room.');
};
$('load').onclick = () => {
  if (readString(SAVE_KEY) === null) { toast('No saved room yet. Save your design first.'); return; }
  let room;
  // Validate and migrate before touching the live room so a bad save never wipes the current design.
  try { room = parseRoom(readJSON(SAVE_KEY), { catalog: CATALOG, placement, maxItems: MAX_SAVED_ITEMS, newId: newItemId }); }
  catch { toast('This saved room could not be loaded. Your current room is safe.'); return; }
  clearRoom();
  wallMat.color.setHex(room.wall);
  floorMat.color.setHex(room.floor);
  for (const it of room.items) addItem(it.type, it.gx, it.gz, it.rot, it.color, it.id);
  syncFinishSwatches();
  toast('Saved room loaded.');
};
$('clear').onclick = () => { clearRoom(); toast('Room cleared. A fresh start.'); };

// ---------- starter room ----------
let starterSelection = null;
for (const it of STARTER_ROOM) {
  const item = addItem(it.type, it.gx, it.gz, it.rot, it.color ?? null);
  if (it.select) starterSelection = item;
}
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
  state, placement, occupancy: state.occupancy, bgm: music.audio, scene, camera, controls, grid, walls, wallMat, floorMat,
  pointerToFloor: input.floorHit, snap, isFree, worldPos, meshOf, addItem, setSelected, rotateSelected,
  measure: measureModel,
  get musicOn() { return music.isOn(); },
  get items() { return state.items.map(withMesh); },
  get ghost() { return ghost; },
  get selectedType() { return selectedType; },
  get selected() { return withMesh(selected); },
};
