// Pointer, keyboard, and touch lifecycle for the room canvas.
// Turns raw browser events into a few semantic callbacks and owns the raycasting.
//
//   move(hit, ev)             single pointer moving; hit is the floor point or null; ev allows hitAmong()
//   down({ hit, pick, shiftKey, ev })  primary press with one pointer; pick() lazily returns the item id under it
//   up({ allReleased })       a pointer lifted or cancelled; allReleased when no touch pointers remain
//   secondTouch()             a second finger landed; camera gestures take over
//   key(action, ev)           'cancel' | 'rotate' | 'remove' | 'undo' | 'redo', never while typing in a field
//
// One finger decorates; two fingers are left to OrbitControls.

import * as THREE from 'three';

export function createInput({ canvas, camera, pickables, idOf }, handlers) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const touchPointers = new Set();

  function aim(ev) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function floorHit(ev) {
    aim(ev);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(floorPlane, hit) ? hit : null;
  }
  function pick(ev) {
    aim(ev);
    const hits = raycaster.intersectObjects(pickables(), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    let id = null;
    while (o && !(id = idOf(o))) o = o.parent;
    return id;
  }
  /** Nearest hit among `objects` whose item id passes `accept`: { id, point } or null. */
  function hitAmong(ev, objects, accept = () => true) {
    aim(ev);
    const hits = raycaster.intersectObjects(objects, true);
    for (const h of hits) {
      let o = h.object;
      let id = null;
      while (o && !(id = idOf(o))) o = o.parent;
      if (id && accept(id)) return { id, point: h.point };
    }
    return null;
  }
  function isTyping(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  }

  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch' && touchPointers.size > 1) return;
    const hit = floorHit(ev);
    handlers.move(hit, ev);
  });

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if (ev.pointerType === 'touch') {
      touchPointers.add(ev.pointerId);
      if (touchPointers.size > 1) { handlers.secondTouch(); return; }
    }
    canvas.setPointerCapture(ev.pointerId);
    handlers.down({ hit: floorHit(ev), pick: () => pick(ev), shiftKey: ev.shiftKey, ev });
  });

  function release(ev) {
    if (ev?.pointerId !== undefined) touchPointers.delete(ev.pointerId);
    handlers.up({ allReleased: touchPointers.size === 0 });
  }
  window.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const KEYS = { Escape: 'cancel', r: 'rotate', R: 'rotate', Delete: 'remove', Backspace: 'remove' };
  window.addEventListener('keydown', (ev) => {
    if (isTyping(ev.target)) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    let action = null;
    if (mod && key === 'z') action = ev.shiftKey ? 'redo' : 'undo';
    else if (mod && key === 'y') action = 'redo';
    else if (!mod && !ev.altKey) action = KEYS[ev.key];   // plain shortcuts must not swallow Ctrl+R and friends
    if (action) handlers.key(action, ev);
  });

  return { floorHit, hitAmong, activePointers: () => touchPointers.size };
}
