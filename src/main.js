import * as THREE from 'three';
import { CATALOG, recolor, poseCurtain } from './props.js';
import { createRoom } from './room.js';
import { createScene } from './scene/create-scene.js';
import { createThumbnails } from './scene/thumbnails.js';
import { preloadModels, preloadArt, loadedModelKeys } from './scene/models.js';
import { tintModel as tint, disposeModel, measureModel, compactModel } from './scene/geometry.js';
import { installIcons } from './ui/icons.js';
import { CELL, CAMERA, RENDER, MOTION, MUSIC, SAVE_KEY, ROOMS_KEY, MUSIC_KEY, SFX_KEY, SFX_VOLUME_KEY, AMBIENT_KEY, OUTLINES_KEY, MAX_SAVED_ITEMS } from './config/game.js';
import { BACKDROP, SELECTION_OUTLINE, HOVER_OUTLINE, GHOST_OK, GHOST_BLOCKED, WALL_FINISHES, FLOOR_FINISHES, FLOOR_STYLES, DEFAULT_FLOOR_STYLE, ITEM_COLORS, PET_COLORS, DEFAULT_PET_COLOR } from './config/theme.js';
import { ROOM_PRESETS, DEFAULT_PRESET, WALL_HEIGHT, MIN_ROOM_SIZE, MAX_ROOM_SIZE, presetFixtures, presetWallRows, presetDoor, presetPartitionEdges, presetRooms } from './data/presets.js';
import { COLLECTIONS, DEFAULT_COLLECTION } from './data/collections.js';
import { LIGHTING, DEFAULT_LIGHTING } from './data/lighting.js';
import { createPlacement } from './game/placement.js';
import { createRoomState, newItemId } from './game/state.js';
import { createCommands } from './game/commands.js';
import { createInput } from './game/input.js';
import { serializeRoom } from './persistence/schema.js';
import { createGallery, DEFAULT_ROOM_NAME } from './persistence/gallery.js';
import { exportRoom, parseImport } from './persistence/transfer.js';
import { createResponsiveHUD } from './ui/responsive.js';
import { createGalleryDialog } from './ui/gallery.js';
import { createToast, buildCatalog, setCatalogActive, bindCatalogFilter, bindTabs, buildFinishSwatches, buildLightingOptions, renderSelectionCard, setPressed } from './ui/hud.js';
import { createMusic } from './ui/music.js';
import { createSfx } from './ui/sfx.js';
import { createMotion } from './scene/motion.js';
import { createCat, disposeCat } from './scene/cat.js';
import { createOutlines } from './scene/outline.js';
import { createResidentsBrain, MAX_RESIDENTS } from './game/residents.js';
import { preloadPeople, createPerson, loadLook, hasLook } from './scene/people.js';
import { RESIDENT_LOOKS, DEFAULT_PEOPLE, GUEST_LOOKS, MAX_NAME_LENGTH } from './data/people.js';
import { activeAppliances, bubbleFor, APPLIANCE_KINDS } from './game/activities.js';
import { createActivityView } from './scene/activities.js';
import { createPetBrain } from './game/pet.js';
import { cellKey } from './game/placement.js';
import { readString, writeString } from './persistence/storage.js';

export async function initializeGame({ onProgress = async () => {}, onOpenRoom = () => {}, onNotice = () => {} } = {}) {
const $ = (id) => document.getElementById(id);
let editing = false;
await onProgress(25, 'Building your little nest…');
await Promise.all([preloadModels(CATALOG), preloadArt(['worldMap', 'botanicalPrint', 'frame']), preloadPeople([...DEFAULT_PEOPLE.map((p) => p.look), GUEST_LOOKS[0]])]);   // models and print images must be ready before the first build()

// ---------- renderer / scene ----------
const canvas = $('scene');
const { renderer, scene, camera, controls, hemisphere, sun, resetView, zoomBy, orbitBy, resize, setFrame, viewFromTop, stepView, isTop } = createScene({ canvas, camera: CAMERA, render: RENDER, backdrop: BACKDROP });

// ---------- room shell ----------
// The shell (floor, walls, windows, grid) is rebuilt whenever the room preset changes. `placement`
// and `wallBlocked` are reconfigured in place so everything holding them keeps working.
const roomConfig = { preset: DEFAULT_PRESET, width: ROOM_PRESETS[DEFAULT_PRESET].width, depth: ROOM_PRESETS[DEFAULT_PRESET].depth };
const finishes = { wall: WALL_FINISHES[0].color, wallLeft: WALL_FINISHES[0].color, floor: FLOOR_FINISHES[0].color, floorStyle: DEFAULT_FLOOR_STYLE, lighting: DEFAULT_LIGHTING, petPresent: false, petColor: DEFAULT_PET_COLOR, residents: 0, people: DEFAULT_PEOPLE.map((p) => ({ ...p })) };
let wallTarget = 'both';   // which wall the Walls tab swatches paint
const WALL_ROWS = WALL_HEIGHT / 0.5;
const placement = createPlacement({ catalog: CATALOG, width: roomConfig.width, depth: roomConfig.depth, cell: CELL, wallRows: WALL_ROWS, wallRow: 0.5 });
const wallBlocked = new Set();
const wallWindows = new Set();
const wallDoors = new Set();
// Rooms walled off inside the shell (src/data/presets.js presetRooms). Clicking a room's floor, or the wall in front of
// it, turns its walls see-through; clicking the open living area or outside turns them solid again. While placing or
// moving furniture, the room under the pointer is see-through too.
let houseRooms = { roomOf: () => null, cellsOf: () => [], open: null, count: 0 };
let focusRoom = null, previewRoom = null;
function roomAt(point) {
  if (!point) return null;
  const gx = Math.floor(point.x + roomConfig.width / 2), gz = Math.floor(point.z + roomConfig.depth / 2);
  const id = houseRooms.roomOf(gx, gz);
  return id === houseRooms.open ? null : id;
}
/**
 * The walls round the focused (and previewed) room go see-through, and so does any wall piece standing between
 * the camera and that room: in front of one of its cells along the view, within the reach of a wall's shadow on
 * the floor (its height over the tangent of the camera's elevation), and no more than a cell to either side.
 */
function syncGhostRooms() {
  const cells = new Set();
  for (const id of [focusRoom, previewRoom]) if (id !== null) for (const c of houseRooms.cellsOf(id)) cells.add(c);
  if (!cells.size) { shell.setGhost(() => false); invalidate(); return; }
  const v = camera.position.clone().sub(controls.target);
  const flat = Math.hypot(v.x, v.z) || 1, vx = v.x / flat, vz = v.z / flat;
  const reach = 2.7 / Math.max(.2, v.y / flat) + .3;   // how far behind a wall it hides the floor
  const centres = [...cells].map((k) => { const [gx, gz] = k.split(',').map(Number); return { x: gx - roomConfig.width / 2 + .5, z: gz - roomConfig.depth / 2 + .5 }; });
  shell.setGhost((g) => cells.has(g.a) || cells.has(g.b) || centres.some((p) => {
    const dx = g.cx - p.x, dz = g.cz - p.z, ahead = dx * vx + dz * vz, side = Math.abs(dx * vz - dz * vx);
    return ahead > .2 && ahead < reach && side < 1;
  }));
  invalidate();
}
function setFocusRoom(id) { if (id !== focusRoom) { focusRoom = id; syncGhostRooms(); } }
function setPreviewRoom(id) { if (id !== previewRoom) { previewRoom = id; syncGhostRooms(); } }     // wall cells covered by the door: no new decorations there   // the subset of blocked cells that are windows, where curtains hang
let shell = null;      // { root, floorMat, wallMat, walls, wallPanels, dispose }
let grid = null;
let gridVisible = false;
let wallsVisible = true;
// Full orbit: an outer wall the camera has swung round behind drops to a knee-high stub (room.js setCutaway), and
// the decorations hung on it are hidden and cannot be picked until the camera comes back round.
let cutWalls = { back: false, left: false };
function syncCutaway() {
  const v = camera.position.clone().sub(controls.target);
  const next = { back: v.z < 0, left: v.x < 0 };
  if (next.back !== cutWalls.back || next.left !== cutWalls.left) { cutWalls = next; shell.setCutaway(next); }
  for (const r of state.items) {
    const m = r.wall ? meshes.get(r.id) : null;
    if (m) { m.visible = !cutWalls[r.wall]; m.userData.cut = cutWalls[r.wall]; }
  }
}
const motion = createMotion();
let lampsReady = false;   // state is created after the first shell build; lamps are applied as they are added
let dirty = true;         // true when the next animation frame must render
function invalidate() { dirty = true; }
controls.addEventListener('change', () => { invalidate(); if (focusRoom !== null || previewRoom !== null) syncGhostRooms(); });   // orbit, zoom, pinch, programmatic moves; see-through walls follow the view
function presetFor(room) {
  return { ...ROOM_PRESETS[room.preset], width: room.width, depth: room.depth };
}
/** Placement rules for another room size, used to validate saves and imports before they are applied. */
function placementFor(room) {
  return createPlacement({ catalog: CATALOG, width: room.width, depth: room.depth, cell: CELL, wallRows: presetWallRows(presetFor(room)), wallRow: 0.5, edges: presetPartitionEdges(presetFor(room)) });
}
function wallBlockedFor(room) {
  return placementFor(room).blockedWallCells(presetFixtures(presetFor(room)).filter((f) => f.kind !== 'door'));   // doors never invalidate a save
}
function wallWindowsFor(room) {
  return placementFor(room).windowWallCells(presetFixtures(presetFor(room)));
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
  shell = createRoom(scene, { ...preset, doorway: presetDoor(preset) }, WALL_HEIGHT, { wallColor: finishes.wall, wallLeftColor: finishes.wallLeft, floorColor: finishes.floor, floorStyle: finishes.floorStyle });
  shell.walls.visible = wallsVisible;
  cutWalls = { back: false, left: false };   // a new shell starts uncut; the next frame cuts it for the view
  motion.setBulbs(shell.bulbs);
  placement.configure({ width: room.width, depth: room.depth, wallRows: presetWallRows(preset), edges: presetPartitionEdges(preset) });
  wallBlocked.clear();
  const fixtures = presetFixtures(preset);
  for (const c of placement.blockedWallCells(fixtures.filter((f) => f.kind !== 'door'))) wallBlocked.add(c);
  wallDoors.clear();
  for (const c of placement.blockedWallCells(fixtures.filter((f) => f.kind === 'door'))) wallDoors.add(c);
  wallWindows.clear();
  for (const c of placement.windowWallCells(presetFixtures(preset))) wallWindows.add(c);
  houseRooms = presetRooms(preset);
  focusRoom = previewRoom = null;
  grid = makeGrid(room.width, room.depth);
  grid.visible = gridVisible;
  scene.add(grid);
  setFrame(Math.max(room.width, room.depth));
  shell.setGhost(() => false);
  applyLighting(finishes.lighting);
}

// ---------- lighting moods and lamps ----------
/** Applies a mood to the sky, sun, backdrop, exposure, window glow, and every lamp. */
function applyLighting(key) {
  invalidate();
  const mood = LIGHTING[key] || LIGHTING[DEFAULT_LIGHTING];
  hemisphere.color.setHex(mood.hemisphere.sky);
  hemisphere.groundColor.setHex(mood.hemisphere.ground);
  hemisphere.intensity = mood.hemisphere.intensity;
  sun.color.setHex(mood.sun.color);
  sun.intensity = mood.sun.intensity * curtainFactor();
  sun.position.set(...mood.sun.position);
  scene.background.setHex(mood.backdrop);
  $('app').style.setProperty('--scene-backdrop', '#' + mood.backdrop.toString(16).padStart(6, '0'));   // the page behind the Decorate card matches the sky
  motion.setTwinkle(key === 'evening');
  renderer.toneMappingExposure = mood.exposure;
  if (shell) {
    shell.groundMat.color.setHex(mood.backdrop);
    shell.viewMat.emissive.setHex(mood.window.emissive);
    shell.viewMat.emissiveIntensity = mood.window.intensity;
  }
  if (lampsReady) for (const record of state.items) applyLamp(record);
}
/** Sets a lamp's point lights and glowing parts from its lit flag and the mood's lamp strength. */
/** Curtains are the toggles that hang over a window; radios are toggles too but never touch the light. */
const isCurtain = (type) => !!(CATALOG[type].toggle && CATALOG[type].overWindow);
const isRadio = (type) => type === 'kitRadio';
/** Closed curtains dim the sun: 12% each, never below half. */
function curtainFactor() {
  if (!lampsReady) return 1;
  const closed = state.items.filter((r) => isCurtain(r.type) && r.lit === false).length;
  return Math.max(.5, 1 - .12 * closed);
}
// Curtain panels tween between poses; the loop keeps rendering while any tween is live.
const tweens = new Map();   // record id -> { group, from, to, start, duration }
const CURTAIN_TWEEN_MS = 450;
function applyCurtain(record, animate) {
  if (!isCurtain(record.type)) return;
  const group = meshOf(record);
  if (!group) return;
  const to = record.lit ? 1 : 0;
  if (!animate) { group.userData.open = to; poseCurtain(group, to); tweens.delete(record.id); return; }
  tweens.set(record.id, { group, from: group.userData.open ?? 1 - to, to, start: performance.now(), duration: CURTAIN_TWEEN_MS });
}
function stepTweens(now) {
  for (const [id, t] of tweens) {
    const k = Math.min(1, (now - t.start) / t.duration);
    const eased = 1 - (1 - k) ** 3;
    const open = t.from + (t.to - t.from) * eased;
    t.group.userData.open = open;
    poseCurtain(t.group, open, Math.sin(k * Math.PI) * .05 * (t.to - t.from));
    if (k >= 1) tweens.delete(id);
  }
}
/** Which idle motion an item gets: floor plants sway, candles and lanterns flicker, other lamps breathe. */
function motionKind(type) {
  const def = CATALOG[type];
  if (def.lamp) return def.layer === 'surface' ? 'flame' : 'lamp';
  if ((type === 'plant' || def.tags?.includes('plant')) && placement.occupies(type)) return 'plant';
  return null;
}
// Ambient motion: on by default, remembered, and off whenever the system asks for reduced motion.
let ambientOn = readString(AMBIENT_KEY) !== 'off';
function syncAmbient() { motion.setEnabled(ambientOn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches); invalidate(); }
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', syncAmbient);
const ambient = { isOn: () => ambientOn, setOn(on) { ambientOn = !!on; writeString(AMBIENT_KEY, ambientOn ? 'on' : 'off'); syncAmbient(); } };
// Ink outlines along silhouettes and creases (src/scene/outline.js): on by default, remembered.
const outlines = createOutlines(renderer, scene, camera);
outlines.setEnabled(readString(OUTLINES_KEY) !== 'off');
const outlineSetting = { isOn: () => outlines.enabled, setOn(on) { outlines.setEnabled(on); writeString(OUTLINES_KEY, on ? 'on' : 'off'); invalidate(); } };
// ---------- the cat ----------
// The brain (src/game/pet.js) reads the room through this view; the model (src/scene/cat.js) shows it.
const petWorld = {
  dims: () => ({ width: roomConfig.width, depth: roomConfig.depth, cell: CELL }),
  isFree: (gx, gz) => !state.occupancy.has(cellKey(gx, gz)),
  passable: (ax, az, bx, bz) => placement.passable(ax, az, bx, bz),
  seats() {
    const out = [];
    for (const r of state.items) {
      const surface = placement.surfaceOf(r.type);
      if (r.parent || surface?.kind !== 'seat' || !meshes.has(r.id)) continue;
      const used = state.slotsUsed.get(r.id);
      const people = residents.claimedSeats();
      surface.slots.forEach((_, slot) => { if (!used?.has(slot) && !people.has(r.id + ':' + slot)) { const p = slotWorld(r.id, slot); out.push({ key: r.id + ':' + slot, x: p.x, y: p.y, z: p.z }); } });
    }
    return out;
  },
  favourites() {
    const rug = [], sun = [];
    for (const r of state.items) {
      if (r.type !== 'rug' || r.gx === null) continue;
      const { w, d } = placement.footprint(r.type, r.rot);
      for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) rug.push({ gx: r.gx + x, gz: r.gz + z });
    }
    const half = { back: roomConfig.width / 2, left: roomConfig.depth / 2 };
    for (const f of presetFixtures(presetFor(roomConfig)).filter((f) => f.kind === 'window')) {
      const n = f.wall === 'back' ? roomConfig.width : roomConfig.depth;
      for (let i = 0; i < n; i++) {
        const mid = -half[f.wall] + i + 0.5;
        if (mid > f.from && mid < f.to) for (const depth of [0, 1]) sun.push(f.wall === 'back' ? { gx: i, gz: depth } : { gx: depth, gz: i });
      }
    }
    return { rug, sun };
  },
};
const brain = createPetBrain(petWorld);
// ---------- the residents ----------
// Up to three people (src/game/residents.js decides, src/scene/people.js shows) sit on seats, stand
// at kitchen counters and windows, and come and go through the door. They are not catalog items and
// cannot be picked; how many live here is the `residents` finish.
const rotY = (r) => (r.rot * Math.PI) / 2;
/** Seat height for seating with no seat slots (dining chairs, stools, the office chair). */
function chairHeight(type) { const def = CATALOG[type]; return def.tags?.includes('kitchen') ? 0.72 : type === 'chair' || type === 'kitChairDesk' ? 0.5 : 0.46; }
const residentsWorld = {
  dims: petWorld.dims,
  isFree: petWorld.isFree,
  passable: petWorld.passable,
  seats() {
    const out = [];
    for (const r of state.items) {
      const def = CATALOG[r.type];
      if (r.parent || r.gx === null || def.category !== 'seating' || /bed/i.test(r.type) || !meshes.has(r.id)) continue;
      const surface = placement.surfaceOf(r.type);
      if (surface?.kind === 'seat') {
        const used = state.slotsUsed.get(r.id);
        surface.slots.forEach((slot, i) => { if (!used?.has(i) && !(slot.y < surface.y)) { const p = slotWorld(r.id, i); out.push({ key: r.id + ':' + i, x: p.x, y: p.y, z: p.z, heading: rotY(r) }); } });
      } else if (!surface && placement.occupies(r.type)) {
        const p = worldPos(r.type, r.gx, r.gz, r.rot);
        out.push({ key: r.id + ':0', x: p.x, y: chairHeight(r.type), z: p.z, heading: rotY(r) });
      }
    }
    return out;
  },
  spots() {
    const out = [];
    for (const r of state.items) {
      const def = CATALOG[r.type];
      const basin = r.type === 'kitBathroomSink' || r.type === 'kitBathroomSinkSquare';   // washing up in the bathroom
      if (r.parent || r.gx === null || !(def.tags?.includes('kitchen') || basin) || !placement.occupies(r.type) || r.type === 'kitTrashcan') continue;
      const h = rotY(r), { w, d } = placement.footprint(r.type, r.rot);
      const fx = Math.round(Math.sin(h)), fz = Math.round(Math.cos(h));
      const gx = fx > 0 ? r.gx + w : fx < 0 ? r.gx - 1 : r.gx, gz = fz > 0 ? r.gz + d : fz < 0 ? r.gz - 1 : r.gz;
      out.push({ key: 'spot:' + r.id, kind: 'kitchen', gx, gz, heading: h + Math.PI });
    }
    const half = { back: roomConfig.width / 2, left: roomConfig.depth / 2 };
    for (const f of presetFixtures(presetFor(roomConfig)).filter((f) => f.kind === 'window')) {
      const n = f.wall === 'back' ? roomConfig.width : roomConfig.depth;
      for (let i = 0; i < n; i++) {
        const mid = -half[f.wall] + i + 0.5;
        if (mid > f.from + 0.4 && mid < f.to - 0.4) out.push(f.wall === 'back' ? { key: 'window:' + i + ',0', kind: 'window', gx: i, gz: 0, heading: Math.PI } : { key: 'window:0,' + i, kind: 'window', gx: 0, gz: i, heading: -Math.PI / 2 });
      }
    }
    return out;
  },
  /** Where to lie in each bed: hips over the head-end slots, head toward the headboard. */
  beds() {
    const out = [];
    for (const r of state.items) {
      if (r.parent || r.gx === null || !/bed/i.test(r.type) || !meshes.has(r.id)) continue;
      const surface = placement.surfaceOf(r.type);
      if (surface?.kind !== 'seat') continue;
      const head = Math.min(...surface.slots.map((s) => s.z));
      surface.slots.forEach((slot, i) => {
        if (slot.z !== head) return;
        const p = meshes.get(r.id).localToWorld(new THREE.Vector3(slot.x, slot.y ?? surface.y, slot.z + 0.85));
        out.push({ key: r.id + ':' + i, x: p.x, y: p.y, z: p.z, heading: rotY(r) });
      });
    }
    return out;
  },
  evening: () => finishes.lighting === 'evening',
  cat: () => (pet && brain.cell() && (brain.action === 'sit' || brain.action === 'curl') ? { x: brain.pose().x, z: brain.pose().z } : null),
  door() {
    const d = presetDoor(presetFor(roomConfig));
    if (!d) return null;
    const hw = roomConfig.width / 2, hd = roomConfig.depth / 2;
    return d.wall === 'left'
      ? { gx: 0, gz: Math.floor(d.at + hd), x: -hw + 0.05, z: d.at, outX: -hw - 0.6, outZ: d.at }
      : { gx: Math.floor(d.at + hw), gz: 0, x: d.at, z: -hd + 0.05, outX: d.at, outZ: -hd - 0.6 };
  },
};
const residents = createResidentsBrain(residentsWorld);
residents.setAvoid(() => (pet ? brain.onSeat : null));
const people = [];       // bodies, one per resident that loaded
// What residents do to the room: screens light up, stoves glow and steam, bubbles pop up (src/game/activities.js).
const activityView = createActivityView(scene);
const lastAction = new WeakMap();   // body root -> last action, to notice when someone settles
const lastBubble = new WeakMap();   // body root -> when their last bubble showed (sleepers doze off again every few seconds)
let guestBody = null;               // the visitor's body while a guest is over
let nextGuestAt = performance.now() + 150000 + Math.random() * 150000;   // the next unprompted visit
const worldDir = new THREE.Vector3(), worldAt = new THREE.Vector3();
function appliancesInRoom() {
  const out = [];
  for (const r of state.items) {
    const kind = APPLIANCE_KINDS[r.type];
    const mesh = kind && meshes.get(r.id);
    if (!mesh) continue;
    mesh.getWorldPosition(worldAt); mesh.getWorldDirection(worldDir);
    out.push({ id: r.id, type: r.type, kind, mesh, x: worldAt.x, z: worldAt.z, facing: Math.atan2(worldDir.x, worldDir.z) });
  }
  return out;
}
let radioRender = 0;
/** Music notes drift from radios that are on while the music plays. Returns true about 20 times a second while they do. */
function stepRadios(now) {
  const playing = music.isOn();
  const radios = [];
  for (const r of state.items) if (isRadio(r.type) && meshes.has(r.id)) radios.push({ id: r.id, mesh: meshes.get(r.id), playing: playing && r.lit === true });
  const busy = activityView.updateRadios(radios, now / 1000, motion.isEnabled());
  if (!busy || now - radioRender < 50) return false;
  radioRender = now;
  return true;
}
/** Lights appliances in use and pops bubbles for people who just settled. Returns true while anything animates. */
function stepActivities(pairs, dt, now, animate) {
  const appliances = appliancesInRoom();
  const active = activeAppliances(pairs.map(([pose]) => pose), appliances);
  let busy = activityView.update(appliances, active, dt, now / 1000, animate);
  const heights = new Map();
  pairs.forEach(([pose, body]) => {
    if (!body) return;
    heights.set(body.root, pose.action === 'sleep' ? 0.95 : pose.action === 'sit' ? 1.35 : 1.62);
    const before = lastAction.get(body.root);
    lastAction.set(body.root, pose.settling || pose.outside ? 'walk' : pose.action);
    if (pose.action === 'sleep' && pose.seat && now - (lastBubble.get(body.root) ?? 0) > 8000 && !activityView.bubbleOf(body.root)) {
      activityView.showBubble(body.root, 'sleep'); lastBubble.set(body.root, now); busy = true;
    }
    if (before !== 'walk' || pose.settling || !['sit', 'interact', 'gaze', 'idle', 'sleep', 'pet'].includes(pose.action)) return;
    const spotItem = pose.spot?.startsWith('spot:') ? state.get(pose.spot.slice(5)) : null;
    const place = spotItem ? (APPLIANCE_KINDS[spotItem.type] === 'stove' ? 'stove' : CATALOG[spotItem.type].tags?.includes('bathroom') ? 'bath' : 'kitchen')
      : pose.action === 'sit' ? activeAppliances([pose], appliances.filter((a) => a.kind !== 'stove')).size ? 'tv' : null : null;
    const cat = pet ? brain.pose() : null;
    const radioNear = music.isOn() && state.items.some((r) => { if (!isRadio(r.type) || !r.lit || !meshes.has(r.id)) return false; meshes.get(r.id).getWorldPosition(worldAt); return Math.hypot(worldAt.x - pose.x, worldAt.z - pose.z) < 2.5; });
    const icon = bubbleFor({ action: pose.action, place, evening: finishes.lighting === 'evening', catNear: !!cat && Math.hypot(cat.x - pose.x, cat.z - pose.z) < 1.6, radioNear });
    if (icon) { activityView.showBubble(body.root, icon); lastBubble.set(body.root, now); busy = true; }
  });
  if (activityView.stepBubbles(dt, heights, animate)) busy = true;
  return busy;
}
/** Shows the name tag of the person under a mouse pointer, and hides the rest. */
function hoverPerson(ev) {
  const bodies = [...people, guestBody].filter((b) => b && b.root.visible);
  const hit = ev && ev.pointerType === 'mouse' && !ghost && !dragging && bodies.length ? input.hitFirst(ev, bodies.map((b) => b.root)) : null;
  let over = null;
  if (hit) for (let o = hit.object; o && !over; o = o.parent) over = bodies.find((b) => b.root === o) ?? null;
  for (const b of bodies) if (b.nameShown !== (b === over)) { b.showName(b === over); invalidate(); }
}
/** A visitor rings the bell and comes in. False (and nothing happens) when nobody can visit right now. */
function ringDoorbell() {
  if (!residents.ringDoorbell()) return false;
  sfx.play('doorbell');
  invalidate();
  return true;
}
let residentsClock = 0, residentsRestRender = 0, residentsByDoor = false;
/** Matches the bodies to the `residents` finish. New arrivals walk in when the player invited them. */
function syncResidents() {
  if (!lampsReady) return;
  const before = residents.count, viaDoor = residentsByDoor;
  residentsByDoor = false;
  residents.setCalm(!motion.isEnabled());
  residents.setCount(finishes.residents, { viaDoor });
  // One body per resident, wearing their look; a look that has not loaded yet loads, then this runs again.
  while (people.length > residents.count) people.pop()?.dispose();
  for (let i = 0; i < residents.count; i++) {
    const { name, look } = finishes.people[i];
    if (people[i] && people[i].look !== look) { people[i].dispose(); people[i] = undefined; }
    if (!people[i]) {
      if (!hasLook(look)) { loadLook(look).then((ok) => { if (ok && finishes.people[i]?.look === look) syncResidents(); }); continue; }
      people[i] = createPerson(look, name);
      scene.add(people[i].root);
    }
    people[i].setName(name);
  }
  if (residents.count > before && !viaDoor) placeResidentsSoon();
  residentsClock = 0;
  showResidents(1 / 60);
  invalidate();
}
let residentsPlaceQueued = false;
/** Re-seats everyone once the room has finished loading (items are restored after the finishes). */
function placeResidentsSoon() {
  if (residentsPlaceQueued) return;
  residentsPlaceQueued = true;
  queueMicrotask(() => { residentsPlaceQueued = false; residents.reset(); showResidents(1 / 60); invalidate(); });
}
function showResidents(dt) {
  const animate = motion.isEnabled();
  residents.poses().forEach((pose, i) => people[i]?.setPose(pose, dt, animate));
}
/** Advances the residents and the door. Returns true when a frame should be drawn. */
function stepResidents(now) {
  const door = shell.door;
  if (!residents.count && !residents.hasGuest && !guestBody && !(door && door.open > 0) && !activityView.anyLit()) return false;
  const dt = residentsClock ? Math.min(0.1, (now - residentsClock) / 1000) : 1 / 60;
  residentsClock = now;
  residents.setCalm(!motion.isEnabled());
  const poses = residents.update(dt);
  const animate = motion.isEnabled();
  let moving = false;
  poses.forEach((pose, i) => { people[i]?.setPose(pose, dt, animate); if (pose.action === 'walk' || residents.person(i).transit) moving = true; });
  const pairs = poses.map((pose, i) => [pose, people[i]]);
  // A guest has their own body, made when they ring and dropped when they have gone.
  const guest = residents.guestPose();
  if (guest && !guestBody) {
    const worn = new Set(finishes.people.slice(0, residents.count).map((p) => p.look));
    const look = GUEST_LOOKS.find((l) => !worn.has(l)) ?? GUEST_LOOKS[0];
    if (hasLook(look)) { guestBody = createPerson(look, 'Guest'); scene.add(guestBody.root); } else loadLook(look);
  }
  if (!guest && guestBody) { guestBody.dispose(); guestBody = null; moving = true; }
  if (guest && guestBody) { guestBody.setPose(guest, dt, animate); pairs.push([guest, guestBody]); if (guest.action === 'walk' || guest.settling) moving = true; }
  if (now > nextGuestAt) { nextGuestAt = now + 150000 + Math.random() * 150000; if (residents.count && animate) ringDoorbell(); }
  if (door) {
    const want = residents.doorWanted();
    if (door.open !== want) { door.setOpen(animate ? Math.max(0, Math.min(1, door.open + Math.sign(want - door.open) * dt * 2.4)) : want); moving = true; }
  }
  if (stepActivities(pairs, dt, now, animate)) moving = true;
  if (moving) return true;
  if (animate && poses.length && now - residentsRestRender > 66) { residentsRestRender = now; return true; }
  return false;
}
let pet = null;          // { root, setPose, color } while a cat is visiting
let petClock = 0, petRestRender = 0;
function syncPet() {
  if (!lampsReady) return;
  const recolour = pet && finishes.petPresent && pet.color !== finishes.petColor;
  if (pet && (!finishes.petPresent || recolour)) { disposeCat(pet); pet = null; }
  if (finishes.petPresent && !pet) {
    pet = { ...createCat(finishes.petColor), color: finishes.petColor };
    scene.add(pet.root);
    if (!recolour) placePetSoon();   // a new visitor: find a spot once the room has finished loading
    pet.setPose(brain.pose(), 1, 0);
    petClock = 0;
  }
  invalidate();
}
let petPlaceQueued = false;
function placePetSoon() {
  if (petPlaceQueued) return;
  petPlaceQueued = true;
  queueMicrotask(() => { petPlaceQueued = false; if (pet) { brain.reset(); pet.setPose(brain.pose(), 1, 0); invalidate(); } });
}
/** Advances the cat. Returns true when a frame should be drawn: always while it moves, about 15 fps while it rests. */
function stepPet(now) {
  if (!pet) return false;
  const dt = petClock ? Math.min(0.1, (now - petClock) / 1000) : 1 / 60;
  petClock = now;
  brain.setCalm(!motion.isEnabled());
  const pose = brain.update(dt);
  pet.setPose(pose, dt, now / 1000);
  if (pose.action === 'walk' || pose.action === 'hop') return true;
  if (motion.isEnabled() && now - petRestRender > 66) { petRestRender = now; return true; }
  return false;
}
let relightQueued = false;
function relightSoon() {
  if (relightQueued) return;
  relightQueued = true;
  queueMicrotask(() => { relightQueued = false; applyLighting(finishes.lighting); });
}
function applyLamp(record) {
  if (record.lit === null || record.lit === undefined) return;
  const mood = LIGHTING[finishes.lighting] || LIGHTING[DEFAULT_LIGHTING];
  const mesh = meshOf(record);
  if (!mesh) return;
  mesh.traverse((o) => {
    if (o.isPointLight) {
      if (o.userData.baseIntensity === undefined) o.userData.baseIntensity = o.intensity;
      o.intensity = record.lit ? o.userData.baseIntensity * mood.lamps : 0;
      o.userData.lampValue = { intensity: o.intensity };
    } else if (o.isMesh && o.material?.emissive && o.userData.ownedMaterial === o.material) {
      if (o.userData.baseEmissive === undefined) o.userData.baseEmissive = o.material.emissiveIntensity;
      o.material.emissiveIntensity = record.lit ? o.userData.baseEmissive * Math.max(1, mood.lamps) : 0.05;
      o.userData.lampValue = { emissiveIntensity: o.material.emissiveIntensity };
    }
  });
}
buildShell(roomConfig);

// ---------- placement state ----------
// Committed state lives in `state` as serializable records; meshes are looked up by record id.
const state = createRoomState({ placement, wallBlocked, wallWindows, wallDoors });
lampsReady = true;
syncAmbient();
syncPet();
syncResidents();
const commands = createCommands({ state, finishes, room: roomConfig });   // every room mutation goes through here so it can be undone
const meshes = new Map();             // record id -> THREE.Group
let selectedType = null;              // catalog key while placing
let keepPlacing = false;              // the mode pill's Keep placing switch: stay in placing mode after a drop
let ghost = null;                     // preview mesh while placing
let dragging = null;                  // record being moved
let dragTarget = null;                // { gx, gz } or { parent, slot } the drag would drop onto
let ghostTarget = null;               // { parent, slot } under the pointer while placing a surface item
let selected = null;                  // record shown in the selection card
let pendingSelection = false;         // selection card update deferred until the gesture ends
const selectionBox = new THREE.Box3Helper(new THREE.Box3(), SELECTION_OUTLINE);
selectionBox.visible = false;
scene.add(selectionBox);
// The item under a mouse pointer gets a softer outline before it is clicked. Touch has no hover.
const hoverBox = new THREE.Box3Helper(new THREE.Box3(), HOVER_OUTLINE);
hoverBox.material.transparent = true; hoverBox.material.opacity = 0.75;
hoverBox.visible = false;
scene.add(hoverBox);
let hoverId = null;
function setHover(id) {
  if (id === hoverId) return;
  hoverId = id;
  invalidate();
}
// A soft rounded shadow under floor ghosts shows where the item will land.
const ghostShadow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(60,36,20,0.42)'); grad.addColorStop(0.7, 'rgba(60,36,20,0.22)'); grad.addColorStop(1, 'rgba(60,36,20,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1; mesh.visible = false;
  scene.add(mesh);
  return mesh;
})();
function placeGhostShadow(type, gx, gz, rot) {
  const { w, d } = placement.footprint(type, rot);
  const p = worldPos(type, gx, gz, rot);
  ghostShadow.position.set(p.x, 0.012, p.z);
  ghostShadow.scale.set(w * CELL * 1.08, d * CELL * 1.08, 1);
  ghostShadow.visible = true;
}
// Settle bounce: a short squash when an item lands, applied on top of the model's own scale.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const bounces = new Map();   // record id -> { mesh, base: Vector3, start }
function bounce(record) {
  if (record) sfx.play('place');
  if (!record || reducedMotion.matches) return;
  const mesh = meshOf(record);
  if (!mesh) return;
  const base = bounces.get(record.id)?.base ?? mesh.scale.clone();
  bounces.set(record.id, { mesh, base, start: performance.now() });
  invalidate();
}
function stepBounces(now) {
  for (const [id, b] of bounces) {
    const k = Math.min(1, (now - b.start) / MOTION.settleMs);
    const e = Math.sin(k * Math.PI) * (1 - k * 0.5) * MOTION.settleSquash;
    b.mesh.scale.set(b.base.x * (1 + e / 2), b.base.y * (1 - e), b.base.z * (1 + e / 2));
    if (k >= 1) { b.mesh.scale.copy(b.base); bounces.delete(id); }
  }
}

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
  const others = [...meshes.entries()].filter(([id, m]) => id !== ignoreId && !m.userData.cut).map(([, m]) => m);
  const panels = ['back', 'left'].filter((w) => !cutWalls[w]).map((w) => shell.wallPanels[w]);   // a cut wall takes nothing
  const hit = input.hitFirst(ev, [...panels, ...others]);
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
function supporterMeshes(type = null) {
  return state.items.filter((r) => !r.parent && placement.surfaceOf(r.type) && (!type || placement.acceptsOn(type, r.type))).map(meshOf);
}
const surfaceWhere = (type) => (placement.surfaceKindOf(type) === 'seat' ? 'sofas, chairs and beds' : 'tables and shelves');
/** World position of a slot on a supporter. */
function slotWorld(parentId, slot) {
  const parentRecord = state.get(parentId);
  const local = placement.slotLocal(parentRecord.type, slot);
  return meshes.get(parentId).localToWorld(new THREE.Vector3(local.x, local.y, local.z));
}
/** Nearest surface slot under the pointer: { parent, slot, free } or null. `ignoreId` is the item being moved. */
function surfaceUnder(ev, type, ignoreId = null) {
  const hit = input.hitAmong(ev, supporterMeshes(type), (id) => id !== ignoreId && !state.get(id)?.parent);
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
  invalidate();
  if (kind === 'add') {
    const mesh = compactModel(CATALOG[p.type].build());
    if (CATALOG[p.type].outline === 'soft') mesh.traverse((o) => { o.userData.softOutline = true; });   // silhouette only (src/scene/outline.js)
    if (p.color !== null) recolor(mesh, p.color);
    mesh.userData.itemId = p.id;
    meshes.set(p.id, mesh);
    applyTransform(p);   // also attaches the mesh to the scene or to its supporter
    applyLamp(p);
    applyCurtain(p, false);
    if (isCurtain(p.type)) applyLighting(finishes.lighting);
    motion.track(p.id, mesh, motionKind(p.type), { isLit: () => state.get(p.id)?.lit === true });
    updateCount();
  } else if (kind === 'remove') {
    motion.forget(p.id);
    tweens.delete(p.id);
    bounces.delete(p.id);
    if (hoverId === p.id) hoverId = null;
    if (meshes.get(p.id)?.userData.open !== undefined) relightSoon();   // a curtain left: the sun may brighten
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
  } else if (kind === 'lit') {
    applyLamp(p);
    if (isCurtain(p.type)) { applyCurtain(p, true); applyLighting(finishes.lighting); }
    if (selected === p) updateSelection();
  } else if (kind === 'finish') {
    if (p.key === 'lighting') { applyLighting(p.color); syncLightingOptions(); }
    else if (p.key === 'floorStyle') { shell.setFloorStyle(p.color); syncFloorStyles(); }
    else if (p.key === 'petPresent' || p.key === 'petColor') { syncPet(); syncPetControls(); }
    else if (p.key === 'residents' || p.key === 'people') { syncResidents(); syncResidentControls(); }
    else { ({ wall: shell.wallMat, wallLeft: shell.wallLeftMat, floor: shell.floorMat })[p.key].color.setHex(p.color); syncFinishSwatches(); }
  } else if (kind === 'room') {
    buildShell(p);
    if (pet) placePetSoon();
    if (residents.count) placeResidentsSoon();
  } else if (kind === 'history') {
    $('undo-tool').disabled = !p.canUndo;
    $('redo-tool').disabled = !p.canRedo;
  }
});
function addItem(type, gx, gz, rot, color = null, id = null, parent = null, slot = null, wall = null, col = null, row = null) {
  return commands.add({ type, gx, gz, rot, color, id, parent, slot, wall, col, row });
}
function removeItem(record) {
  if (commands.remove(record.id) !== false) sfx.play('remove');
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
  invalidate();
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
  ghost = compactModel(CATALOG[type].build());
  ghost.userData.rot = 0;
  tint(ghost, GHOST_OK);
  ghost.visible = false;
  scene.add(ghost);
  const where = placement.isSurfaceItem(type) ? (placement.surfaceKindOf(type) === 'seat' ? ' on a seat' : ' on a table or shelf') : placement.isWallItem(type) ? ' on a wall' : '';
  $('mode-label').textContent = 'Place ' + CATALOG[type].label.toLowerCase() + where;
  $('keep-placing').hidden = $('cancel-placing').hidden = false;
  document.querySelector('.mode-pill').classList.add('placing');
  canvas.style.cursor = 'crosshair';
  updateSelection();
  if (hud.isCompact()) hud.setExpanded(false);
}
function cancelPlacing() {
  if (ghost) { scene.remove(ghost); disposeModel(ghost); }
  ghost = null;
  ghostTarget = null;
  ghostShadow.visible = false;
  selectedType = null;
  $('mode-label').textContent = 'Decorate mode';
  $('keep-placing').hidden = $('cancel-placing').hidden = true;
  document.querySelector('.mode-pill').classList.remove('placing');
  canvas.style.cursor = 'grab';
  updateSelection();
}
function rotateSelected() {
  if (dragging) return;
  if (ghost) { ghost.userData.rot = (ghost.userData.rot + 1) % 4; ghost.rotation.y = ghost.userData.rot * Math.PI / 2; sfx.play('rotate'); return; }
  if (!selected) { toast('Select furniture to rotate it.'); return; }
  if (selected.wall) { toast('Wall decorations already face the room.'); return; }
  if (commands.rotate(selected.id)) sfx.play('rotate');
  else { sfx.play('blocked'); toast('There needs to be more space to rotate this item.'); }
}

// ---------- input ----------
function finishDrag(showControls = true, allReleased = input.activePointers() === 0) {
  if (dragging) {
    // One history entry per completed drag. A blocked drop leaves the record untouched; the mesh
    // snaps back to the committed position either way.
    let landed = false;
    if (dragTarget && dragging.parent) landed = !!commands.place(dragging.id, dragTarget.parent, dragTarget.slot);
    else if (dragTarget && dragging.wall) landed = !!commands.mount(dragging.id, dragTarget.wall, dragTarget.col, dragTarget.row);
    else if (dragTarget) landed = !!commands.move(dragging.id, dragTarget.gx, dragTarget.gz);
    applyTransform(dragging);
    if (landed) bounce(dragging);
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
  pickables: () => [...meshes.values()].filter((m) => !m.userData.cut),
  idOf: (o) => o.userData.itemId || null,
}, {
  move(hit, ev) {
    invalidate();
    hoverPerson(ev);
    if (!editing || photoMode) return;
    setHover(!ghost && !dragging && ev.pointerType === 'mouse' ? input.pickAt(ev) : null);
    if (pet) brain.lookAt(ev.pointerType === 'mouse' ? hit : null);
    setPreviewRoom(ghost || dragging ? roomAt(hit) : null);   // see into the room you are placing or moving into
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
      if (placement.occupies(selectedType)) placeGhostShadow(selectedType, gx, gz, rot);
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
    invalidate();
    if (!editing || photoMode) return;
    if (ghost && placement.isWallItem(selectedType)) {
      if (!ghostTarget) { toast('Wall decorations go on the two walls. Point at one to place it.'); return; }
      if (!ghostTarget.free) { sfx.play('blocked'); toast('That part of the wall is taken. Try a clear spot.'); return; }
      const placed = addItem(selectedType, null, null, 0, null, null, null, null, ghostTarget.wall, ghostTarget.col, ghostTarget.row);
      bounce(placed);
      if (placed && !shiftKey && !keepPlacing) { cancelPlacing(); setSelected(placed); }
      return;
    }
    if (ghost && placement.isSurfaceItem(selectedType)) {
      if (!ghostTarget) { toast((placement.surfaceKindOf(selectedType) === 'seat' ? 'Soft things go on ' : 'Small items go on ') + surfaceWhere(selectedType) + '. Point at one to place it.'); return; }
      if (!ghostTarget.free) { sfx.play('blocked'); toast('That spot is taken. Try another part of the surface.'); return; }
      const placed = addItem(selectedType, null, null, ghost.userData.rot, null, null, ghostTarget.parent, ghostTarget.slot);
      bounce(placed);
      if (placed && !shiftKey && !keepPlacing) { cancelPlacing(); setSelected(placed); }
      return;
    }
    if (ghost) {
      if (!hit) return;
      const rot = ghost.userData.rot;
      const { gx, gz } = snap(hit, selectedType, rot);
      if (isFree(selectedType, gx, gz, rot)) {
        const placed = addItem(selectedType, gx, gz, rot);
        bounce(placed);
        if (!shiftKey && !keepPlacing) { cancelPlacing(); setSelected(placed); }
      } else { sfx.play('blocked'); toast('That tile is occupied. Choose a free spot.'); }
      return;
    }
    const id = pick();
    const item = id ? state.get(id) : null;
    // The clicked room (or the room of the clicked furniture) goes see-through; open floor turns walls solid again.
    setFocusRoom(item && item.gx !== null ? roomAt(worldPos(item.type, item.gx, item.gz, item.rot)) : item ? focusRoom : roomAt(hit));
    // Keep the canvas size stable until the gesture finishes: the selection card can resize the drawer.
    setSelected(item, false);
    pendingSelection = true;
    if (item) { dragging = item; dragTarget = null; sfx.play('pickup'); }
  },
  up({ allReleased }) {
    if (!editing) return;
    invalidate();
    finishDrag(true, allReleased);
    setPreviewRoom(null);
  },
  secondTouch() {
    if (!editing) return;
    finishDrag(false);
    setSelected(null, false);
    pendingSelection = true;
  },
  key(action, ev) {
    if (!editing || document.querySelector('dialog[open]')) return;
    invalidate();
    if (photoMode) { if (action === 'cancel') exitPhotoMode(); return; }
    if (action === 'cancel') { cancelPlacing(); setSelected(null); }
    if (action === 'rotate') rotateSelected();
    if (action === 'remove' && selected && !dragging) { ev.preventDefault(); removeItem(selected); }
    if (action === 'undo' || action === 'redo') { ev.preventDefault(); undoRedo(action); }
    if (action === 'duplicate') { ev.preventDefault(); duplicateSelected(); }
  },
});

// ---------- HUD ----------
const perf = { startedAt: performance.now(), thumbnailsMs: 0, readyMs: 0 };
await onProgress(50, 'Unpacking your furniture…');
installIcons();
const thumbnailsStart = performance.now();
const { thumbnails, cached: thumbnailsCached } = createThumbnails(CATALOG);
perf.thumbnailsMs = performance.now() - thumbnailsStart;
perf.thumbnailsCached = thumbnailsCached;
await onProgress(80, 'Adding the finishing touches…');
const gameToast = createToast($('toast'));
const toast = (message) => { gameToast(message); onNotice(message); };
const hud = createResponsiveHUD({
  panel: $('panel'),
  panelContent: $('panel-content'),
  selectionCard: $('selection-card'),
  viewport: $('viewport'),
  dock: document.querySelector('.dock'),
  toggle: $('panel-toggle'),
  close: $('panel-close'),
  decorate: $('dock-decorate'),
  collapseSelection: $('selection-collapse'),
  hasSelection: () => !!selected,
});

function updateCount() { $('item-count').textContent = state.items.length + ' items in room'; }
function updateSelection() {
  hud.markSelection();
  if (selected && hud.isCompact()) hud.setExpanded(true);
  setCatalogActive($('catalog'), selected?.type || selectedType);
  const def = selected && CATALOG[selected.type];
  let canRecolor = false;
  if (selected) meshOf(selected).traverse((o) => { if (o.userData.recolor) canRecolor = true; });
  renderSelectionCard({
    card: $('selection-card'),
    item: selected,
    def,
    thumbnail: selected && thumbnails[selected.type],
    sizeText: !selected ? '' : selected.parent ? 'Sits on ' + surfaceWhere(selected.type) : selected.wall ? 'On the wall' : (({ w, d }) => w + ' × ' + d + ' tiles')(footprint(selected.type, selected.rot)),
    canRecolor,
    colors: ITEM_COLORS,
    activeColor: selected && (selected.color ?? def.defaultColor ?? ITEM_COLORS[0].color),
    onColor: (color) => { if (commands.recolor(selected.id, color)) sfx.play('recolor'); },
    onLight: (on) => {
      const record = selected;
      if (!commands.setLit(record.id, on)) return;
      sfx.play(isCurtain(record.type) ? 'curtain' : 'lamp');
      // A radio is the room's music source: on starts the music, the last one off stops it.
      if (isRadio(record.type) && (on || !state.items.some((r) => isRadio(r.type) && r.lit))) music.setOn(on);
    },
  });
}

buildCatalog({ container: $('catalog'), catalog: CATALOG, thumbnails, onChoose: (key) => (selectedType === key ? cancelPlacing() : startPlacing(key)), collectionLabel: (def) => (def.collection === DEFAULT_COLLECTION ? null : COLLECTIONS[def.collection]?.name) });
bindCatalogFilter({ container: $('catalog'), catalog: CATALOG, search: $('search'), categoryButtons: [...document.querySelectorAll('[data-category]')], emptyEl: $('empty-catalog'), collectionSelect: $('collection'), collections: COLLECTIONS });
bindTabs({ buttons: [...document.querySelectorAll('[data-tab]')], onChange: () => cancelPlacing() });
const syncFinishSwatches = buildFinishSwatches([
  { el: $('wall-swatches'), finishes: WALL_FINISHES,
    current: () => (wallTarget === 'left' ? finishes.wallLeft : wallTarget === 'back' || finishes.wall === finishes.wallLeft ? finishes.wall : -1),
    onPick: (c) => commands.setFinishes(wallTarget === 'both' ? { wall: c, wallLeft: c } : { [wallTarget === 'left' ? 'wallLeft' : 'wall']: c }) },
  { el: $('floor-swatches'), finishes: FLOOR_FINISHES, current: () => finishes.floor, onPick: (c) => commands.setFinish('floor', c) },
]);
// Walls tab: which wall the swatches paint. Floor tab: the pattern buttons.
$('wall-target').querySelectorAll('button').forEach((b) => {
  b.onclick = () => {
    wallTarget = b.dataset.target;
    $('wall-target').querySelectorAll('button').forEach((o) => { const on = o === b; o.classList.toggle('active', on); o.setAttribute('aria-pressed', String(on)); });
    syncFinishSwatches();
  };
});
for (const { key, name } of FLOOR_STYLES) {
  const b = document.createElement('button');
  b.dataset.style = key; b.textContent = name;
  b.onclick = () => commands.setFinish('floorStyle', key);
  $('floor-styles').append(b);
}
function syncFloorStyles() {
  $('floor-styles').querySelectorAll('button').forEach((b) => { const on = b.dataset.style === finishes.floorStyle; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
}
syncFloorStyles();
// Light tab: invite the cat and pick its fur. Both are undoable finishes.
for (const { key, name, fur } of PET_COLORS) {
  const b = document.createElement('button');
  b.className = 'swatch'; b.dataset.pet = key; b.title = name; b.setAttribute('aria-label', name + ' cat');
  b.style.backgroundColor = '#' + fur.toString(16).padStart(6, '0');
  b.onclick = () => commands.setFinishes({ petColor: key, petPresent: true });
  $('pet-colors').append(b);
}
$('pet-toggle').onclick = () => commands.setFinish('petPresent', !finishes.petPresent);
function syncPetControls() {
  $('pet-toggle').setAttribute('aria-pressed', String(finishes.petPresent));
  $('pet-toggle').textContent = finishes.petPresent ? 'Cat is visiting' : 'Invite a cat';
  $('pet-toggle').classList.toggle('active', finishes.petPresent);
  $('pet-colors').querySelectorAll('button').forEach((b) => { const on = finishes.petPresent && b.dataset.pet === finishes.petColor; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
}
syncPetControls();
// Light tab: how many people live here (none to three). Undoable; new arrivals come in through the door.
for (let n = 0; n <= MAX_RESIDENTS; n++) {
  const b = document.createElement('button');
  b.dataset.residents = String(n); b.textContent = n ? String(n) : 'None';
  b.setAttribute('aria-label', n ? n + (n === 1 ? ' person' : ' people') : 'Nobody home');
  b.onclick = () => { residentsByDoor = n > finishes.residents; if (!commands.setFinish('residents', n)) residentsByDoor = false; };
  $('resident-count').append(b);
}
$('doorbell').onclick = () => {
  if (!presetDoor(presetFor(roomConfig))) toast('This room has no door for visitors.');
  else if (residents.hasGuest) toast('A guest is already visiting.');
  else if (!motion.isEnabled()) toast('Visitors come by while ambient motion is on.');
  else if (ringDoorbell()) toast('Ding-dong! Someone is at the door.');
};
/** Changes one resident's name or look as one undoable step. */
function setPerson(i, change) {
  const next = finishes.people.map((p, j) => (j === i ? { ...p, ...change } : { ...p }));
  return commands.setFinish('people', next);
}
function syncResidentControls() {
  $('resident-count').querySelectorAll('button').forEach((b) => { const on = Number(b.dataset.residents) === finishes.residents; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  // A row per resident: their picture, a name to edit, and buttons to try the other looks.
  const rows = $('resident-people');
  if (rows.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // never rebuild under the caret
  rows.replaceChildren();
  for (let i = 0; i < finishes.residents; i++) {
    const { name, look } = finishes.people[i];
    const row = document.createElement('div'); row.className = 'resident-row'; row.dataset.person = String(i);
    const img = document.createElement('img'); img.src = 'models/people/previews/' + look + '.png'; img.alt = ''; img.width = img.height = 40;
    const input = document.createElement('input');
    input.value = name; input.maxLength = MAX_NAME_LENGTH; input.setAttribute('aria-label', 'Name of person ' + (i + 1)); input.spellcheck = false;
    input.onchange = () => { const v = input.value.trim(); if (v) setPerson(i, { name: v }); else input.value = finishes.people[i].name; };
    input.onkeydown = (ev) => { if (ev.key === 'Enter') input.blur(); ev.stopPropagation(); };
    const step = (dir) => { const k = RESIDENT_LOOKS.indexOf(finishes.people[i].look); setPerson(i, { look: RESIDENT_LOOKS[(k + dir + RESIDENT_LOOKS.length) % RESIDENT_LOOKS.length] }); };
    const prev = document.createElement('button'); prev.textContent = '‹'; prev.setAttribute('aria-label', 'Previous look for ' + name); prev.onclick = () => step(-1);
    const next = document.createElement('button'); next.textContent = '›'; next.setAttribute('aria-label', 'Next look for ' + name); next.onclick = () => step(1);
    row.append(img, input, prev, next);
    rows.append(row);
  }
}
syncResidentControls();
const syncLightingOptions = buildLightingOptions({
  container: $('lighting-options'), moods: LIGHTING, icons: { morning: 'sun', sunset: 'sunset', evening: 'moon' },
  current: () => finishes.lighting, onPick: (key) => commands.setFinish('lighting', key),
});
installIcons($('lighting-options'));

$('rotate-selected').onclick = rotateSelected;
$('undo-tool').onclick = () => undoRedo('undo');
$('redo-tool').onclick = () => undoRedo('redo');
$('remove-selected').onclick = () => { if (selected) removeItem(selected); };
$('duplicate-selected').onclick = duplicateSelected;
$('deselect').onclick = () => setSelected(null);
$('move-selected').onclick = () => { if (hud.isCompact()) hud.setExpanded(false); toast('Drag the selected furniture to a free tile.'); };
function showGrid(on) { gridVisible = on; grid.visible = on; setPressed($('grid-tool'), on); invalidate(); }
$('grid-tool').onclick = () => showGrid(!gridVisible);
$('walls-tool').onclick = () => { wallsVisible = !wallsVisible; shell.walls.visible = wallsVisible; invalidate(); $('walls-tool').setAttribute('aria-pressed', String(wallsVisible)); };
$('help-toggle').onclick = () => { $('help-panel').hidden = !$('help-panel').hidden; };
// Popovers: the More menu under the action bar and the View tools above the dock. A menu closes after
// a choice; the View tools stay open for repeated zooming and orbiting. Escape or a click elsewhere closes both.
function bindPopover(toggle, popover, { closeOnChoice }) {
  const setOpen = (open) => { popover.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(popover.hidden));
  if (closeOnChoice) popover.addEventListener('click', (ev) => { if (ev.target.closest('button')) setOpen(false); });
  document.addEventListener('pointerdown', (ev) => { if (!popover.hidden && !popover.contains(ev.target) && !toggle.contains(ev.target)) setOpen(false); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !popover.hidden) { setOpen(false); toggle.focus({ preventScroll: true }); } });
  return setOpen;
}
bindPopover($('more-toggle'), $('more-menu'), { closeOnChoice: true });
const setViewOpen = bindPopover($('view-toggle'), $('view-menu'), { closeOnChoice: false });
// Hide HUD is a viewing state: it cancels a pending placement and clears the selection (the room itself is
// unchanged), leaves only the room and a Show HUD button, and Escape or Show HUD brings the controls back.
function setHudHidden(hidden) {
  if (hidden) { cancelPlacing(); setSelected(null); }
  document.body.classList.toggle('hud-hidden', hidden);
  $('show-hud').hidden = !hidden;
  if (hidden) { setViewOpen(false); $('show-hud').focus({ preventScroll: true }); }
  else $('more-toggle').focus({ preventScroll: true });
  invalidate();
}
$('hud-hide-menu').onclick = () => setHudHidden(true);
$('show-hud').onclick = () => setHudHidden(false);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && document.body.classList.contains('hud-hidden')) setHudHidden(false); });
// The filter button shows or hides the collection and category filters.
$('filter-toggle').onclick = () => {
  const show = $('catalog-filters').hidden;
  $('catalog-filters').hidden = !show;
  $('filter-toggle').setAttribute('aria-pressed', String(show));
};

const sfx = createSfx({ storageKey: SFX_KEY, volumeKey: SFX_VOLUME_KEY });
// A quiet tap for HUD buttons; buttons whose action has its own sound opt out with data-sfx="none".
document.addEventListener('click', (ev) => {
  const b = ev.target.closest?.('button');
  if (b && !b.disabled && b.dataset.sfx !== 'none' && !b.closest('#catalog') && !b.closest('.swatches')) sfx.play('tap');
}, true);
const music = createMusic({ src: MUSIC.src, volume: MUSIC.volume, storageKey: MUSIC_KEY, button: $('music-toggle'), installIcons, onToggle: (on) => toast(on ? 'Music on.' : 'Music off.') });

canvas.addEventListener('pointerleave', () => { setHover(null); hoverPerson(null); if (pet) brain.lookAt(null); });
// A tap in the room can slide the sheet up under the finger; the browser's follow-up click must not land
// on whatever the sheet brought there (the dock's Decorate button, a swatch), so ignore it briefly.
let lastRoomTap = { at: 0, x: 0, y: 0 };
canvas.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'mouse') lastRoomTap = { at: performance.now(), x: ev.clientX, y: ev.clientY }; });
$('panel').addEventListener('click', (ev) => {
  const ghostClick = performance.now() - lastRoomTap.at < 600 && Math.hypot(ev.clientX - lastRoomTap.x, ev.clientY - lastRoomTap.y) < 12;
  if (ghostClick) { ev.stopPropagation(); ev.preventDefault(); }
}, true);
$('keep-placing').onclick = () => { keepPlacing = !keepPlacing; $('keep-placing').setAttribute('aria-pressed', String(keepPlacing)); $('keep-placing').classList.toggle('active', keepPlacing); };
$('cancel-placing').onclick = () => { cancelPlacing(); $('scene').focus({ preventScroll: true }); };
$('orbit-left').onclick = () => { if (orbitBy(CAMERA.orbitStep)) invalidate(); };
$('orbit-right').onclick = () => { if (orbitBy(-CAMERA.orbitStep)) invalidate(); };
$('zoom-in').onclick = () => { zoomBy(CAMERA.zoomStep); invalidate(); };
// Top view: straight down, or back to the angle you had. The button shows whether you are looking down.
$('top-view').onclick = () => { viewFromTop(!isTop(), !reducedMotion.matches); invalidate(); };
function syncTopView() { const on = isTop(); if ($('top-view').getAttribute('aria-pressed') !== String(on)) { $('top-view').setAttribute('aria-pressed', String(on)); $('top-view').setAttribute('aria-label', on ? 'Back to the room view' : 'Top view'); } }
controls.addEventListener('change', syncTopView);
syncTopView();
$('zoom-out').onclick = () => { zoomBy(1 / CAMERA.zoomStep); invalidate(); };
$('reset-view').onclick = () => { resetView(); invalidate(); };

// ---------- saved rooms ----------
function settle() { finishDrag(); cancelPlacing(); setSelected(null); }
function clearRoom() { settle(); commands.clear(); }

/** Saved-room data for a preset's starter layout, with fresh ids. Returns the data and the id to select. */
// `?starter=classic` opens the living room with its original layout (the browser tests are written against it).
const STARTER = new URLSearchParams(location.search).get('starter');
function presetRoomData(presetId) {
  const preset = ROOM_PRESETS[presetId];
  const byKey = new Map();
  const items = [];
  let selectId = null;
  for (const it of (STARTER === 'classic' && preset.classicItems) || preset.items) {
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
    data: { room: { preset: presetId, width: preset.width, depth: preset.depth }, wall: WALL_FINISHES[0].color, wallLeft: WALL_FINISHES[0].color, floor: FLOOR_FINISHES[0].color, floorStyle: DEFAULT_FLOOR_STYLE, lighting: DEFAULT_LIGHTING, pet: { present: !!preset.pet, color: preset.pet || DEFAULT_PET_COLOR }, residents: preset.residents ?? 0, people: DEFAULT_PEOPLE.map((p) => ({ ...p })), items },
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

const parseOptions = { catalog: CATALOG, placementFor, wallBlockedFor, wallWindowsFor, presets: ROOM_PRESETS, lightings: LIGHTING, maxItems: MAX_SAVED_ITEMS, newId: newItemId, sizeRange: [MIN_ROOM_SIZE, MAX_ROOM_SIZE] };
const gallery = createGallery({ key: ROOMS_KEY, legacyKey: SAVE_KEY, ...parseOptions });
let currentRoom = null;   // { id, name } of the gallery entry the open design belongs to
function setCurrentRoom(summary) {
  currentRoom = summary ? { id: summary.id, name: summary.name } : null;
  $('room-name').textContent = currentRoom ? currentRoom.name : 'Unsaved room';
}
function currentRoomData() {
  finishDrag();
  return serializeRoom({ room: roomConfig, wall: finishes.wall, wallLeft: finishes.wallLeft, floor: finishes.floor, floorStyle: finishes.floorStyle, lighting: finishes.lighting, pet: { present: finishes.petPresent, color: finishes.petColor }, residents: finishes.residents, people: finishes.people, items: state.items });
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
  return true;
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
      onOpenRoom();
    },
    onExport: exportEntry,
    onImport: importFile,
    entries: () => gallery.list(),
    currentId: () => currentRoom?.id ?? null,
    onSaveAs: (name) => saveRoom(null, name),
    onLoad: (id) => { if (loadRoom(id)) onOpenRoom(); },
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
  invalidate();
  settle();
  photoRestore = { grid: gridVisible, panelExpanded: hud.isExpanded() };
  photoMode = true;
  hud.setPhoto(true);
  grid.visible = false;
  document.body.classList.add('photo');
  $('photo-bar').hidden = false;
  setPressed($('photo-tool'), true);
  $('photo-tool').setAttribute('aria-label', 'Leave photo mode');
  canvas.style.cursor = 'default';
}
function exitPhotoMode() {
  if (!photoMode) return;
  invalidate();
  photoMode = false;
  document.body.classList.remove('photo');
  $('photo-bar').hidden = true;
  setPressed($('photo-tool'), false);
  $('photo-tool').setAttribute('aria-label', 'Photo mode');
  showGrid(photoRestore.grid);
  hud.setPhoto(false);
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
    outlines.render();
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
perf.readyMs = performance.now() - perf.startedAt;
// Render on demand: a frame is drawn only when something changed (state, camera, selection, HUD size).
// The loop itself keeps running so damping and resizes are still noticed.
perf.renders = 0;
renderer.setAnimationLoop(() => {
  if (resize()) dirty = true;
  if (controls.update()) dirty = true;
  if (stepView(performance.now())) dirty = true;
  if (tweens.size) { stepTweens(performance.now()); dirty = true; }
  if (bounces.size) { stepBounces(performance.now()); dirty = true; }
  if (motion.step(performance.now())) dirty = true;
  if (stepPet(performance.now())) dirty = true;
  if (stepResidents(performance.now())) dirty = true;
  if (stepRadios(performance.now())) dirty = true;
  if (!dirty) return;
  dirty = false;
  syncCutaway();
  if (selected) { selectionBox.box.setFromObject(meshOf(selected)); selectionBox.updateMatrixWorld(true); }
  const hoverMesh = hoverId && hoverId !== selected?.id && editing && !photoMode ? meshes.get(hoverId) : null;
  hoverBox.visible = !!hoverMesh;
  if (hoverMesh) { hoverBox.box.setFromObject(hoverMesh); hoverBox.updateMatrixWorld(true); }
  outlines.render();
  perf.renders++;
});

// Expose scene state for development checks. Items and the selection are returned as
// record copies with their mesh attached, so checks can inspect both data and visuals.
const withMesh = (r) => (r ? { ...r, mesh: meshOf(r) } : null);
window.__sim = {
  state, placement, commands, finishes, gallery, roomConfig, presets: ROOM_PRESETS, lighting: LIGHTING, hemisphere, sun, renderer, perf, occupancy: state.occupancy, bgm: music.audio, scene, camera, controls,
  get grid() { return grid; }, get walls() { return shell.walls; }, get wallMat() { return shell.wallMat; }, get wallLeftMat() { return shell.wallLeftMat; }, get floorMat() { return shell.floorMat; }, get wallPanels() { return shell.wallPanels; },
  get currentRoom() { return currentRoom; },
  get photoMode() { return photoMode; },
  pointerToFloor: input.floorHit, snap, isFree, worldPos, meshOf, addItem, setSelected, rotateSelected, slotWorld, surfaceUnder, supporterMeshes, hitAmong: input.hitAmong, wallBlocked, startPreset,
  measure: measureModel,
  measureType: (type) => { const m = compactModel(CATALOG[type].build()); const size = measureModel(m); disposeModel(m); return size; },
  catalogTypes: Object.keys(CATALOG),
  modelKeys: loadedModelKeys(),
  catalogTags: (type) => CATALOG[type].tags || [],
  catalogCollection: (type) => CATALOG[type].collection,
  collections: COLLECTIONS,
  get musicOn() { return music.isOn(); },
  sfx, motion, ambient, outlines,
  activities: activityView,
  ringDoorbell,
  get cutaway() { return { ...cutWalls }; },
  get rooms() { return { focus: focusRoom, preview: previewRoom, ghosted: shell.ghostedPieces(), roomAt: (x, z) => roomAt({ x, z }), ...houseRooms }; },
  setFocusRoom,
  hoverPerson,
  get residents() { return { names: people.map((b) => b?.name ?? null), looks: people.map((b) => b?.look ?? null), guest: residents.guestPose(), guestBody: guestBody?.root ?? null, count: residents.count, poses: residents.poses(), cells: people.map((_, i) => residents.cellOf(i)), clips: people.map((b) => b?.clip ?? null), bodies: people.map((b) => b?.root ?? null), brain: residents, world: residentsWorld }; },
  get pet() { return pet ? { action: brain.action, cell: brain.cell(), onSeat: brain.onSeat, pose: brain.pose(), root: pet.root, view: pet, brain } : null; },
  get items() { return state.items.map(withMesh); },
  get ghost() { return ghost; },
  get selectedType() { return selectedType; },
  get keepPlacing() { return keepPlacing; },
  get tweening() { return tweens.size > 0; },
  get bouncing() { return bounces.size > 0; },
  get hoverId() { return hoverId; }, get hoverVisible() { return hoverBox.visible; }, get ghostShadowVisible() { return ghostShadow.visible; },
  wallWindows, wallDoors, get door() { return shell.door; },
  startPlacing, orbitBy,
  get selected() { return withMesh(selected); },
};
await onProgress(100, 'Your little nest is ready.');
return {
  music,
  sfx,
  ambient,
  outlines: outlineSetting,
  openRooms: () => galleryDialog.open({ allowSave: false }),
  refresh: () => { resize(true); invalidate(); },
  setEditing(enabled) {
    if (!enabled) {
      if (photoMode) exitPhotoMode();
      finishDrag();
      cancelPlacing();
      $('help-panel').hidden = true;
    }
    editing = enabled;
    controls.enabled = enabled;
    selectionBox.visible = enabled && !!selected;
    grid.visible = enabled && gridVisible;
    resize(true);
    invalidate();
  },
};
}
