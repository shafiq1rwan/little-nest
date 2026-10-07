// Room, camera, and storage defaults. Pure data: no Three.js or DOM here.

export const ROOM = 8;            // grid cells per side
export const CELL = 1;            // world units per cell
export const WALL_H = 4;
export const MODELS_VERSION = 11;  // bump when a file in public/models changes, to refresh browser caches and thumbnails

export const CAMERA = {
  position: [13, 12, 13],
  target: [0, 1.4, 0],
  minPolarAngle: 0.04,   // tilt all the way to an almost straight-down view (the Top view button goes here)
  maxPolarAngle: 1.2,
  topPolarAngle: 0.04,
  tiltMs: 450,           // how long the Top view button takes to swing the camera
  minAzimuthAngle: -Infinity,   // turn all the way round; the outer wall in front drops to a stub (room.js setCutaway)
  maxAzimuthAngle: Infinity,
  minZoom: 0.65,
  maxZoom: 2.2,
  zoomStep: 1.15,
  orbitStep: Math.PI / 12,   // 15 degrees per orbit button press
};

// Small motion touches; all are skipped when the system asks for reduced motion.
export const MOTION = {
  settleMs: 260,    // squash-and-settle after an item is placed or dropped
  settleSquash: 0.08,
};

export const RENDER = {
  exposure: 1.25,
  maxPixelRatio: 2,
};

export const MUSIC = {
  src: '/audio/lofidreams-bgm.mp3',
  volume: 0.35,
};

// Storage keys keep the original project name on purpose so existing saves stay readable.
export const SAVE_KEY = 'home-deco-sim:room';        // pre-gallery single save; imported once, never deleted
export const ROOMS_KEY = 'home-deco-sim:rooms';      // named room gallery
export const MUSIC_KEY = 'home-deco-sim:music';
export const SFX_KEY = 'home-deco-sim:sfx';             // sound effects on/off
export const SFX_VOLUME_KEY = 'home-deco-sim:sfx-volume';   // 0..1
export const AMBIENT_KEY = 'home-deco-sim:ambient';      // idle motion on/off
export const OUTLINES_KEY = 'home-deco-sim:outlines';    // ink outlines on/off
export const MAX_SAVED_ITEMS = 200;
