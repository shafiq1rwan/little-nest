// The residents' bodies: Kenney Mini Characters (CC0, www.kenney.nl), skinned glTF files with their
// own animation clips, in public/models/people/character-<look>.glb. The brain (src/game/residents.js)
// decides where each person is and what they do; this module plays the matching clip and crossfades
// between them. The looks in use load during the loading screen and others on demand (loadLook); a file
// that fails to load leaves that person out.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MODELS_VERSION } from '../config/game.js';
import { sharedMaterial } from './geometry.js';

const SCALE = 1.5;   // the characters are about 0.78 tall in the file; this makes them about 1.17
const CLIPS = { walk: 'walk', idle: 'idle', gaze: 'idle', sit: 'sit', interact: 'interact-right', close: 'interact-left', sleep: 'idle', pet: 'pick-up', away: 'idle' };
const LIE_LIFT = 0.2;    // lying on the back, the body's back is this far below the model's origin
const SIT_DROP = 0.02;   // the sit clip lowers the hips to just above the origin; this rests the thighs on the cushion
const NAME_HEIGHT = { sleep: 0.66, sit: 1.1, other: 1.38 };   // just above the head; mood bubbles float higher

const templates = new Map();   // look -> { scene, clips }
const loading = new Map();     // look -> Promise<boolean>

/** Loads one look. Resolves true when it is ready (now or later), false when the file failed. */
export function loadLook(look) {
  if (templates.has(look)) return Promise.resolve(true);
  if (!loading.has(look)) {
    loading.set(look, new GLTFLoader().loadAsync('models/people/character-' + look + '.glb?v=' + MODELS_VERSION).then((gltf) => {
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      templates.set(look, { scene: gltf.scene, clips: new Map(gltf.animations.map((c) => [c.name, c])) });
      return true;
    }).catch((error) => {
      console.warn('Little Nest: the ' + look + ' look did not load; that person stays away.', error);
      return false;
    }));
  }
  return loading.get(look);
}
export const hasLook = (look) => templates.has(look);
/** Loads the looks a room starts with. */
export async function preloadPeople(looks) {
  await Promise.all([...new Set(looks)].map(loadLook));
  return [...templates.keys()];
}

function nameTexture(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 32px Fredoka, "Source Sans 3", sans-serif';
  const w = Math.min(240, g.measureText(name).width + 34);
  g.fillStyle = 'rgba(255, 248, 234, 0.95)'; g.strokeStyle = '#6b4a35'; g.lineWidth = 4;
  g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 24); g.fill(); g.stroke();
  g.fillStyle = '#5a3e2c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 128, 33, 220);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A body wearing `look`, or null when that look has not loaded. Geometry and materials are shared with the template. */
export function createPerson(look, name = '') {
  const template = templates.get(look);
  if (!template) return null;
  const model = cloneSkinned(template.scene);
  model.scale.setScalar(SCALE);
  const root = new THREE.Group();
  root.name = 'resident';
  root.add(model);
  // A blanket tucked over a sleeper, from the feet (the root) up to the chest. Hidden while awake.
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.6), sharedMaterial(0xc5c9a4, 0.95));   // legs and body; the big head stays out
  blanket.position.set(0, LIE_LIFT + 0.2, -0.22); blanket.castShadow = blanket.receiveShadow = true; blanket.visible = false; blanket.name = 'blanket';
  root.add(blanket);
  // A name tag, shown while the pointer is over the person.
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  tag.name = 'name-tag'; tag.renderOrder = 11; tag.scale.set(1.4, 0.35, 1); tag.visible = false;
  root.add(tag);
  let shownName = null, nameWanted = false;
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map();
  let current = null;
  function play(clipName, fade) {
    if (current?.name === clipName) return;
    const clip = template.clips.get(clipName);
    if (!clip) return;
    if (!actions.has(clipName)) actions.set(clipName, mixer.clipAction(clip));
    const next = actions.get(clipName);
    next.reset().play();
    if (current && fade > 0) current.action.crossFadeTo(next, fade, false);
    else if (current) current.action.stop();
    current = { name: clipName, action: next };
  }
  const body = {
    root, look,
    get clip() { return current?.name ?? null; },
    get name() { return shownName; },
    setName(next) {
      if (next === shownName) return;
      shownName = next;
      tag.material.map?.dispose();
      tag.material.map = next ? nameTexture(next) : null;
      tag.material.needsUpdate = true;
      tag.visible = nameWanted && !!next;
    },
    /** Shows or hides the name tag (hover). */
    showName(on) { nameWanted = !!on; tag.visible = nameWanted && !!shownName; },
    get nameShown() { return tag.visible; },
    /** Shows a brain pose. `animate` false (reduced motion) snaps between clips and holds still. */
    setPose(pose, dt, animate = true) {
      root.visible = !pose.outside;
      root.position.set(pose.x, pose.y - (pose.action === 'sit' && pose.seat ? SIT_DROP : 0), pose.z);
      root.rotation.y = pose.heading;
      // In bed: on the back, head toward the headboard (the bed's -z), feet at the root.
      const lying = pose.action === 'sleep' && !!pose.seat;
      model.rotation.x = lying ? -Math.PI / 2 : 0;
      model.position.y = lying ? LIE_LIFT : 0;
      blanket.visible = lying;
      tag.position.set(0, NAME_HEIGHT[lying ? 'sleep' : pose.action === 'sit' ? 'sit' : 'other'], lying ? -0.85 : 0);
      play(CLIPS[pose.action] || 'idle', animate ? 0.25 : 0);
      mixer.update(animate ? dt : 0);
    },
    dispose() { mixer.stopAllAction(); blanket.geometry.dispose(); tag.material.map?.dispose(); tag.material.dispose(); root.removeFromParent(); },
  };
  body.setName(name);
  return body;
}
