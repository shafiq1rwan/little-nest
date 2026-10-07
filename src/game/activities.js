// What the residents are doing to the room: which appliances are on and which mood bubble a person
// shows when they settle. Pure logic in world units, no Three.js and no DOM, so tests/unit can drive it.
// The scene (src/scene/activities.js) lights screens, steams stoves and draws the bubbles.
//
// people:     [{ x, z, heading, action, seat, spot }]   brain poses (src/game/residents.js)
// appliances: [{ id, kind, x, z, facing }]               kind 'tv' | 'screen' | 'stove'; facing is the
//                                                       yaw of the side that faces the user (atan2(dx, dz))

export const APPLIANCE_KINDS = { kitTelevisionModern: 'tv', kitTelevisionVintage: 'tv', kitLaptop: 'screen', kitComputerScreen: 'screen', kitKitchenStove: 'stove', kitKitchenStoveElectric: 'stove' };
export const BUBBLES = ['heart', 'note', 'cup', 'sleep'];

const TV_RANGE = 6, SCREEN_RANGE = 1.5;

/** Ids of the appliances in use: a TV someone sits facing, a screen at someone's seat, a stove someone cooks at. */
export function activeAppliances(people, appliances) {
  const on = new Set();
  for (const a of appliances) {
    const fx = Math.sin(a.facing), fz = Math.cos(a.facing);
    for (const p of people) {
      if (a.kind === 'stove') { if (p.action === 'interact' && p.spot === 'spot:' + a.id) on.add(a.id); continue; }
      if (p.action !== 'sit' || !p.seat) continue;
      const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1e-6) continue;
      const toward = (dx * fx + dz * fz) / d;                                         // the appliance faces the person
      const looking = -(dx * Math.sin(p.heading) + dz * Math.cos(p.heading)) / d;    // the person faces the appliance
      if (a.kind === 'tv' && d <= TV_RANGE && toward > 0.5 && looking > 0.5) on.add(a.id);
      if (a.kind === 'screen' && d <= SCREEN_RANGE && toward > 0.3) on.add(a.id);
    }
  }
  return on;
}

/**
 * The bubble a person shows on settling into `action`, or null. `place` is what they settled at:
 * 'stove', 'kitchen' (any other counter), 'tv', 'screen', or null. Evenings make sitters sleepy; a cat
 * close by always earns a heart; a radio playing nearby often gets a hum.
 */
export function bubbleFor({ action, place = null, evening = false, catNear = false, radioNear = false }, rng = Math.random) {
  if (catNear && (action === 'sit' || action === 'idle' || action === 'gaze' || action === 'pet')) return 'heart';
  if (radioNear && action !== 'walk' && action !== 'sleep' && action !== 'close' && rng() < 0.6) return 'note';
  if (action === 'interact') return place === 'stove' ? 'note' : place === 'bath' ? null : rng() < 0.7 ? 'cup' : null;
  if (action === 'sit') {
    if (place === 'tv' || place === 'screen') return rng() < 0.3 ? 'note' : null;
    if (evening) return rng() < 0.6 ? 'sleep' : null;
    return rng() < 0.4 ? 'heart' : null;
  }
  if (action === 'gaze') return rng() < 0.3 ? 'heart' : null;
  if (action === 'sleep') return 'sleep';
  if (action === 'pet') return 'heart';
  return null;
}
