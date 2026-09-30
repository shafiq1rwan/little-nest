import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CATALOG, recolor } from './props.js';
import { createRoom } from './room.js';
import { installIcons, createThumbnails } from './ui.js';

// ---------- constants ----------
const ROOM = 8;             // grid cells per side
const CELL = 1;             // world units per cell
const WALL_H = 4;
const WALL_COLORS = [0x92725c, 0xb77d66, 0xf3dfbd, 0x9ba58c, 0x8996a0, 0xe8bea5];
const FLOOR_COLORS = [0xe3a372, 0xf6d9b0, 0xd9c7b6, 0x987052, 0xb7be9f];
// Preserve the original key so existing room saves remain available after renaming.
const SAVE_KEY = 'home-deco-sim:room';

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdf9d80);

const camera = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
camera.position.set(13, 12, 13);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.4, 0);
controls.enableDamping = true;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
// One finger decorates; two fingers control the camera.
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.2;
controls.minAzimuthAngle = 0.3;
controls.maxAzimuthAngle = Math.PI / 2 - 0.3;
controls.minZoom = .65;
controls.maxZoom = 2.2;

// ---------- lighting ----------
scene.add(new THREE.HemisphereLight(0xfff3df, 0xaa7652, 2));
const sun = new THREE.DirectionalLight(0xffe2b3, 3.2);
sun.position.set(-3, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -9;
sun.shadow.camera.right = sun.shadow.camera.top = 9;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = .025;
sun.shadow.radius = 4;
scene.add(sun);

// ---------- room ----------
const half = (ROOM * CELL) / 2;
const { floorMat, wallMat, walls } = createRoom(scene, ROOM, WALL_H);

const grid = new THREE.GridHelper(ROOM, ROOM, 0xffffff, 0xffffff);
grid.material.opacity = 0.12;
grid.material.transparent = true;
grid.position.y = 0.055;
grid.visible = false;
scene.add(grid);

// ---------- placement state ----------
const items = [];                     // { type, mesh, gx, gz, rot }
let selectedType = null;              // catalog key while placing
let ghost = null;                     // preview mesh while placing
let dragging = null;                  // item being moved
let selected = null;                  // last clicked item (for R / Delete)
const occupancy = new Set();          // "gx,gz" of occupied cells (floor-layer items do not occupy)
const touchPointers = new Set();
let pendingSelection = false;
const selectionBox = new THREE.Box3Helper(new THREE.Box3(), 0x91ad79);
selectionBox.visible = false;
scene.add(selectionBox);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function footprint(type, rot) {
  const def = CATALOG[type];
  return rot % 2 === 0 ? { w: def.w, d: def.d } : { w: def.d, d: def.w };
}
function cellsOf(type, gx, gz, rot) {
  const { w, d } = footprint(type, rot);
  const out = [];
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) out.push(gx + x + ',' + (gz + z));
  return { cells: out, w, d };
}
function inBounds(gx, gz, w, d) {
  return gx >= 0 && gz >= 0 && gx + w <= ROOM && gz + d <= ROOM;
}
function isFree(type, gx, gz, rot) {
  const { cells, w, d } = cellsOf(type, gx, gz, rot);
  if (!inBounds(gx, gz, w, d)) return false;
  if (CATALOG[type].layer === 'floor') return true;
  return cells.every((c) => !occupancy.has(c));
}
function worldPos(type, gx, gz, rot) {
  const { w, d } = footprint(type, rot);
  return new THREE.Vector3(-half + (gx + w / 2) * CELL, 0, -half + (gz + d / 2) * CELL);
}
function applyTransform(item) {
  item.mesh.position.copy(worldPos(item.type, item.gx, item.gz, item.rot));
  item.mesh.rotation.y = (item.rot * Math.PI) / 2;
}
function occupy(item, on) {
  if (CATALOG[item.type].layer === 'floor') return;
  for (const c of cellsOf(item.type, item.gx, item.gz, item.rot).cells) {
    if (on) occupancy.add(c); else occupancy.delete(c);
  }
}
function setPointer(ev) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function pointerToFloor(ev) {
  setPointer(ev);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(floorPlane, hit) ? hit : null;
}
function snap(hit, type, rot) {
  const { w, d } = footprint(type, rot);
  return {
    gx: Math.round((hit.x + half) / CELL - w / 2),
    gz: Math.round((hit.z + half) / CELL - d / 2),
  };
}
function tint(group, color) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.base) o.userData.base = o.material;
    if (color) {
      if (!o.userData.tintMaterial) o.userData.tintMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: .55 });
      o.userData.tintMaterial.color.setHex(color);
      o.material = o.userData.tintMaterial;
    } else o.material = o.userData.base;
  });
}

function addItem(type, gx, gz, rot, color = null) {
  const mesh = CATALOG[type].build();
  if (color !== null) recolor(mesh, color);
  const item = { type, mesh, gx, gz, rot, color };
  mesh.userData.item = item;
  applyTransform(item);
  scene.add(mesh);
  items.push(item);
  occupy(item, true);
  updateCount();
  return item;
}
function removeItem(item) {
  occupy(item, false);
  scene.remove(item.mesh);
  items.splice(items.indexOf(item), 1);
  if (selected === item) setSelected(null);
  disposeModel(item.mesh);
  updateCount();
}
function setSelected(item, showControls = true) {
  if (selected) tint(selected.mesh, null);
  selected = item;
  selectionBox.visible = !!item;
  if (showControls) updateSelection();
}
function pickItem(ev) {
  setPointer(ev);
  const hits = raycaster.intersectObjects(items.map((i) => i.mesh), true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.item) o = o.parent;
  return o ? o.userData.item : null;
}

// ---------- placing from catalog ----------
function startPlacing(type) {
  cancelPlacing();
  setSelected(null);
  selectedType = type;
  ghost = CATALOG[type].build();
  ghost.userData.rot = 0;
  tint(ghost, 0x88cc88);
  ghost.visible = false;
  scene.add(ghost);
  document.querySelectorAll('#catalog button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('mode-label').textContent = 'Place ' + CATALOG[type].label.toLowerCase() + ' · Esc to cancel';
  canvas.style.cursor = 'crosshair';
  updateSelection();
  if (compactHUD.matches) setPanelExpanded(false);
}
function cancelPlacing() {
  if (ghost) { scene.remove(ghost); disposeModel(ghost); }
  ghost = null;
  selectedType = null;
  document.querySelectorAll('#catalog button').forEach((b) => b.classList.remove('active'));
  document.getElementById('mode-label').textContent = 'Decorate mode';
  canvas.style.cursor = 'grab';
  updateSelection();
}

// ---------- pointer events ----------
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch' && touchPointers.size > 1) return;
  const hit = pointerToFloor(ev);
  if (!hit) return;
  if (ghost) {
    const rot = ghost.userData.rot;
    const { gx, gz } = snap(hit, selectedType, rot);
    ghost.visible = true;
    ghost.position.copy(worldPos(selectedType, gx, gz, rot));
    ghost.rotation.y = (rot * Math.PI) / 2;
    tint(ghost, isFree(selectedType, gx, gz, rot) ? 0x88cc88 : 0xdd5555);
  } else if (dragging) {
    const { gx, gz } = snap(hit, dragging.type, dragging.rot);
    dragging.mesh.position.copy(worldPos(dragging.type, gx, gz, dragging.rot));
    dragging.pending = { gx, gz };
    tint(dragging.mesh, isFree(dragging.type, gx, gz, dragging.rot) ? null : 0xdd5555);
  }
});

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  if (ev.pointerType === 'touch') {
    touchPointers.add(ev.pointerId);
    if (touchPointers.size > 1) { finishDrag(null, false); setSelected(null, false); pendingSelection = true; return; }
  }
  canvas.setPointerCapture(ev.pointerId);
  if (ghost) {
    const hit = pointerToFloor(ev);
    if (!hit) return;
    const rot = ghost.userData.rot;
    const { gx, gz } = snap(hit, selectedType, rot);
    if (isFree(selectedType, gx, gz, rot)) {
      const placed = addItem(selectedType, gx, gz, rot);
      if (!ev.shiftKey) { cancelPlacing(); setSelected(placed); }
    } else toast('That tile is occupied. Choose a free spot.');
    return;
  }
  const item = pickItem(ev);
  // Keep the canvas size stable until the drag finishes.
  setSelected(item, false);
  pendingSelection = true;
  if (item) {
    dragging = item;
    occupy(item, false);           // free own cells so the item can be dropped back where it was
    dragging.pending = { gx: item.gx, gz: item.gz };
  }
});

function finishDrag(ev, showControls = true) {
  if (ev?.pointerId !== undefined) touchPointers.delete(ev.pointerId);
  if (!dragging) {
    if (showControls && pendingSelection && touchPointers.size === 0) { pendingSelection = false; updateSelection(); }
    return;
  }
  const { gx, gz } = dragging.pending;
  if (isFree(dragging.type, gx, gz, dragging.rot)) {
    dragging.gx = gx;
    dragging.gz = gz;
  }
  applyTransform(dragging);
  occupy(dragging, true);
  tint(dragging.mesh, null);
  dragging = null;
  if (showControls && touchPointers.size === 0) { pendingSelection = false; updateSelection(); }
}
window.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);

window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
  if (ev.key === 'Escape') { cancelPlacing(); setSelected(null); }
  if (ev.key.toLowerCase() === 'r') {
    rotateSelected();
  }
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected && !dragging) { ev.preventDefault(); removeItem(selected); }
});


// ---------- HUD ----------
installIcons();
const thumbnails = createThumbnails();
const compactHUD = window.matchMedia('(max-width: 900px), (max-height: 600px)');
const panel = document.getElementById('panel');
const panelContent = document.getElementById('panel-content');
const selectionCard = document.getElementById('selection-card');
let panelExpanded = !(window.innerHeight < 650 && window.innerWidth < window.innerHeight);
function setPanelExpanded(expanded) {
  panelExpanded = expanded;
  panel.classList.toggle('collapsed', compactHUD.matches && !expanded);
  const toggle = document.getElementById('panel-toggle');
  toggle.setAttribute('aria-expanded', String(!compactHUD.matches || expanded));
  toggle.setAttribute('aria-label', expanded ? 'Hide decorating panel' : 'Browse decorations');
  toggle.querySelector('.toggle-label').textContent = expanded ? 'Hide' : 'Browse';
}
function arrangeCompactHUD() {
  if (compactHUD.matches) panelContent.prepend(selectionCard);
  else document.getElementById('viewport').append(selectionCard);
  panel.dataset.hasSelection = String(!!selected);
  setPanelExpanded(panelExpanded);
}
document.getElementById('panel-toggle').onclick = () => setPanelExpanded(!panelExpanded);
compactHUD.addEventListener('change', arrangeCompactHUD);
arrangeCompactHUD();
const itemColors = [0xf3e4d2, 0x81936a, 0xc38e62, 0xb96949, 0x716252];
const colorNames = ['Linen', 'Sage', 'Caramel', 'Terracotta', 'Walnut'];
let toastTimer;
function toast(message) {
  const el = document.getElementById('toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
}
function disposeModel(model) {
  model.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    if (o.userData.tintMaterial) o.userData.tintMaterial.dispose();
    if (o.userData.ownedMaterial) o.userData.ownedMaterial.dispose();
  });
}
function updateCount() { document.getElementById('item-count').textContent = items.length + ' items in room'; }
function updateSelection() {
  const card = document.getElementById('selection-card'); card.hidden = !selected;
  panel.dataset.hasSelection = String(!!selected);
  if (selected && compactHUD.matches) setPanelExpanded(true);
  document.getElementById('rotate-tool').disabled = !selected && !ghost;
  document.querySelectorAll('#catalog button').forEach(b => b.classList.toggle('active', b.dataset.type === (selected?.type || selectedType)));
  if (!selected) return;
  const def = CATALOG[selected.type];
  document.getElementById('selection-image').src = thumbnails[selected.type];
  document.getElementById('selection-name').textContent = def.label;
  const {w,d} = footprint(selected.type, selected.rot);
  document.getElementById('selection-size').textContent = w + ' × ' + d + ' tiles';
  const colors = document.getElementById('item-swatches'); colors.replaceChildren();
  const canRecolor = (() => { let yes = false; selected.mesh.traverse(o => { if (o.userData.recolor) yes = true; }); return yes; })();
  colors.hidden = !canRecolor;
  if (canRecolor) itemColors.forEach((color,i) => {
    const b = document.createElement('button'); b.className = 'swatch' + ((selected.color ?? itemColors[0]) === color ? ' active' : '');
    b.classList.toggle('active', (selected.color ?? def.defaultColor ?? itemColors[0]) === color);
    b.style.backgroundColor = '#' + color.toString(16).padStart(6,'0'); b.setAttribute('aria-label', colorNames[i]); b.title = colorNames[i];
    b.setAttribute('aria-pressed', String((selected.color ?? def.defaultColor ?? itemColors[0]) === color));
    b.onclick = () => { recolor(selected.mesh,color); selected.color=color; updateSelection(); };
    colors.append(b);
  });
}
function rotateSelected() {
  if (dragging) return;
  if (ghost) { ghost.userData.rot = (ghost.userData.rot + 1) % 4; ghost.rotation.y = ghost.userData.rot * Math.PI / 2; return; }
  if (!selected) { toast('Select furniture to rotate it.'); return; }
  const next = (selected.rot + 1) % 4; occupy(selected,false);
  if (isFree(selected.type,selected.gx,selected.gz,next)) { selected.rot = next; applyTransform(selected); }
  else toast('There needs to be more space to rotate this item.');
  occupy(selected,true); updateSelection();
}
const catalogEl = document.getElementById('catalog');
for (const [key,def] of Object.entries(CATALOG)) {
  const b = document.createElement('button'); b.className = 'catalog-card'; b.dataset.type=key;
  b.innerHTML = '<img alt="" src="' + thumbnails[key] + '"/><strong>' + def.label + '</strong><small>' + def.w + ' × ' + def.d + ' tiles</small>';
  b.setAttribute('aria-label','Place ' + def.label);
  b.onclick=()=>selectedType === key ? cancelPlacing() : startPlacing(key); catalogEl.append(b);
}
let category='all';
function filterCatalog() {
  const query = document.getElementById('search').value.trim().toLowerCase(); let count=0;
  document.querySelectorAll('.catalog-card').forEach(b => {
    const def=CATALOG[b.dataset.type]; b.hidden=!(category==='all'||def.category===category)||![def.label,...(def.tags||[])].join(' ').toLowerCase().includes(query);
    if(!b.hidden)count++;
  });
  document.getElementById('empty-catalog').hidden=!!count;
}
document.getElementById('search').oninput=filterCatalog;
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{
  category=b.dataset.category; document.querySelectorAll('[data-category]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));}); filterCatalog();
});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  cancelPlacing();
  document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b));document.getElementById(x.dataset.tab+'-pane').hidden=x!==b;});
});
function swatches(el,colors,material,names) {
  colors.forEach((color,i)=>{
    const b=document.createElement('button'); b.className='swatch'; b.dataset.color=color;
    b.style.backgroundColor='#'+color.toString(16).padStart(6,'0'); b.title=names[i]; b.setAttribute('aria-label',names[i]);
    b.onclick=()=>{material.color.setHex(color);syncFinishSwatches();}; el.append(b);
  });
}
function syncFinishSwatches() {
  for (const [id,material] of [['wall-swatches',wallMat],['floor-swatches',floorMat]]) {
    document.querySelectorAll('#'+id+' button').forEach(b=>{const active=Number(b.dataset.color)===material.color.getHex();b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  }
}
swatches(document.getElementById('wall-swatches'),WALL_COLORS,wallMat,['Warm walnut','Clay','Cream','Sage','Slate','Blush']);
swatches(document.getElementById('floor-swatches'),FLOOR_COLORS,floorMat,['Honey oak','Pale oak','Limestone','Dark walnut','Ash']);
syncFinishSwatches();
document.getElementById('rotate-selected').onclick=rotateSelected;
document.getElementById('rotate-tool').onclick=rotateSelected;
document.getElementById('remove-selected').onclick=()=>{if(selected)removeItem(selected);};
document.getElementById('deselect').onclick=()=>setSelected(null);
document.getElementById('move-tool').onclick=()=>{cancelPlacing();toast('Drag any furniture to move it.');};
document.getElementById('move-selected').onclick=()=>{
  if (compactHUD.matches) setPanelExpanded(false);
  toast('Drag the selected furniture to a free tile.');
};
document.getElementById('grid-tool').onclick=()=>{
  grid.visible=!grid.visible; const b=document.getElementById('grid-tool');b.classList.toggle('active',grid.visible);b.setAttribute('aria-pressed',String(grid.visible));
};
document.getElementById('walls-tool').onclick=()=>{
  walls.visible=!walls.visible;document.getElementById('walls-tool').setAttribute('aria-pressed',String(walls.visible));
};
document.getElementById('help-toggle').onclick=()=>{const el=document.getElementById('help-panel');el.hidden=!el.hidden;};

// ---------- background music ----------
// Browsers block autoplay, so playback begins on the first user gesture. The mute choice is remembered.
const MUSIC_KEY='home-deco-sim:music';
const bgm=new Audio('/audio/lofidreams-bgm.mp3'); bgm.loop=true; bgm.volume=.35; bgm.preload='auto';
let musicOn=true; try { musicOn=localStorage.getItem(MUSIC_KEY)!=='off'; } catch {}
let musicUnlocked=false;
function syncMusicButton() {
  const b=document.getElementById('music-toggle');
  b.setAttribute('aria-pressed',String(musicOn)); b.setAttribute('aria-label',musicOn?'Turn music off':'Turn music on'); b.title=musicOn?'Music on':'Music off';
  b.querySelector('[data-icon]').dataset.icon=musicOn?'music':'music-off'; installIcons(b);
}
function playMusic() { if(musicOn&&musicUnlocked) bgm.play().catch(()=>{}); else bgm.pause(); }
function unlockMusic() { musicUnlocked=true; playMusic(); }
window.addEventListener('pointerdown',unlockMusic,{once:true});
window.addEventListener('keydown',unlockMusic,{once:true});
document.getElementById('music-toggle').onclick=()=>{
  musicOn=!musicOn; try { localStorage.setItem(MUSIC_KEY,musicOn?'on':'off'); } catch {}
  syncMusicButton(); playMusic(); toast(musicOn?'Music on.':'Music off.');
};
syncMusicButton();
function zoomBy(factor) { camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix(); }
document.getElementById('zoom-in').onclick=()=>zoomBy(1.15);
document.getElementById('zoom-out').onclick=()=>zoomBy(1/1.15);
document.getElementById('reset-view').onclick=()=>{camera.position.set(13,12,13);controls.target.set(0,1.4,0);camera.zoom=1;camera.updateProjectionMatrix();controls.update();};
function clearRoom() { finishDrag();cancelPlacing();setSelected(null);while(items.length)removeItem(items[0]); }
document.getElementById('save').onclick=()=>{
  finishDrag();
  const data={version:2,wall:wallMat.color.getHex(),floor:floorMat.color.getHex(),items:items.map(({type,gx,gz,rot,color})=>({type,gx,gz,rot,color}))};
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(data));toast('Room saved. Make yourself at home.'); }
  catch { toast('Your browser could not save this room.'); }
};
document.getElementById('load').onclick=()=>{
  try {
    const raw=localStorage.getItem(SAVE_KEY);if(!raw){toast('No saved room yet. Save your design first.');return;}
    const data=JSON.parse(raw);
    if(!data||!Array.isArray(data.items)||data.items.length>200||!Number.isInteger(data.wall)||!Number.isInteger(data.floor))throw new Error('Invalid save');
    const restored=[], occupied=new Set();
    for(const it of data.items) {
      if(!it||!Object.hasOwn(CATALOG,it.type)||![it.gx,it.gz,it.rot].every(Number.isInteger)||it.rot<0||it.rot>3)throw new Error('Invalid furniture');
      const {cells,w,d}=cellsOf(it.type,it.gx,it.gz,it.rot);
      if(!inBounds(it.gx,it.gz,w,d))throw new Error('Out of bounds');
      if(CATALOG[it.type].layer!=='floor'){if(cells.some(c=>occupied.has(c)))throw new Error('Overlapping furniture');cells.forEach(c=>occupied.add(c));}
      if(it.color!=null&&(!Number.isInteger(it.color)||it.color<0||it.color>0xffffff))throw new Error('Invalid color');
      restored.push(it);
    }
    clearRoom();wallMat.color.setHex(data.wall);floorMat.color.setHex(data.floor);
    for(const it of restored)addItem(it.type,it.gx,it.gz,it.rot,it.color??null);
    syncFinishSwatches();toast('Saved room loaded.');
  } catch { toast('This saved room could not be loaded. Your current room is safe.'); }
};
document.getElementById('clear').onclick=()=>{clearRoom();toast('Room cleared. A fresh start.');};

// A furnished living room inspired by the visual concept, with space to decorate.
addItem('rug',2,3,0);
addItem('sofa',2,1,0);
addItem('coffeeTable',3,4,0);
const starterChair=addItem('armchair',6,3,3,0x81936a);
addItem('armchair',2,6,2);
addItem('bookshelf',6,0,0);
addItem('floorLamp',5,1,0);
addItem('sideboard',0,4,1);
addItem('desk',3,7,2);
addItem('chair',4,6,2);
addItem('sideboard',6,7,0);
addItem('rubberTree',0,0,0);
addItem('palm',5,0,0);
addItem('snakePlant',7,5,0);
addItem('plant',6,6,0);
addItem('cactus',1,7,0);
setSelected(compactHUD.matches ? null : starterChair);
canvas.style.cursor='grab';

// ---------- loop ----------
let lastWidth=0,lastHeight=0;
function resize() {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h||(w===lastWidth&&h===lastHeight))return;
  lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);
  const aspect=w/h, span=Math.max(10.6,13.6/aspect);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
}
renderer.setAnimationLoop(()=>{
  resize();controls.update();
  if(selected){selectionBox.box.setFromObject(selected.mesh);selectionBox.updateMatrixWorld(true);}
  renderer.render(scene,camera);
});

// Expose scene state for development checks.
window.__sim={items,occupancy,bgm,get musicOn(){return musicOn;},pointerToFloor,snap,isFree,scene,camera,controls,grid,walls,wallMat,floorMat,addItem,setSelected,rotateSelected,worldPos,
  get ghost(){return ghost;},get selectedType(){return selectedType;},get selected(){return selected;}};
