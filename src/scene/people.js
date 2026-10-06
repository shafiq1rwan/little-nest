// The residents' bodies: Kenney Mini Characters (CC0, www.kenney.nl), skinned glTF files with their
// own animation clips, in public/models/people. The brain (src/game/residents.js) decides where each
// person is and what they do; this module plays the matching clip and crossfades between them.
// Templates load during the loading screen; a file that fails to load leaves that person out.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MODELS_VERSION } from '../config/game.js';

/** Who lives here, in arrival order. Resident i always looks like PEOPLE[i]. */
export const PEOPLE = ['character-female-b', 'character-male-a', 'character-female-e'];
const SCALE = 1.5;   // the characters are about 0.78 tall in the file; this makes them about 1.17
const CLIPS = { walk: 'walk', idle: 'idle', gaze: 'idle', sit: 'sit', interact: 'interact-right', away: 'idle' };
const SIT_DROP = 0.02;   // the sit clip lowers the hips to just above the origin; this rests the thighs on the cushion

const templates = new Map();   // file name -> { scene, clips }

export async function preloadPeople() {
  const loader = new GLTFLoader();
  await Promise.all(PEOPLE.map(async (name) => {
    try {
      const gltf = await loader.loadAsync('models/people/' + name + '.glb?v=' + MODELS_VERSION);
      gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      templates.set(name, { scene: gltf.scene, clips: new Map(gltf.animations.map((c) => [c.name, c])) });
    } catch (error) {
      console.warn('Little Nest: resident ' + name + ' did not load and will stay away.', error);
    }
  }));
  return [...templates.keys()];
}

/** A resident's body, or null when its file did not load. Geometry and materials are shared with the template. */
export function createPerson(index) {
  const template = templates.get(PEOPLE[index]);
  if (!template) return null;
  const model = cloneSkinned(template.scene);
  model.scale.setScalar(SCALE);
  const root = new THREE.Group();
  root.name = 'resident-' + index;
  root.add(model);
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
  return {
    root, index,
    get clip() { return current?.name ?? null; },
    /** Shows a brain pose. `animate` false (reduced motion) snaps between clips and holds still. */
    setPose(pose, dt, animate = true) {
      root.visible = !pose.outside;
      root.position.set(pose.x, pose.y - (pose.action === 'sit' && pose.seat ? SIT_DROP : 0), pose.z);
      root.rotation.y = pose.heading;
      play(CLIPS[pose.action] || 'idle', animate ? 0.25 : 0);
      mixer.update(animate ? dt : 0);
    },
    dispose() { mixer.stopAllAction(); root.removeFromParent(); },
  };
}
