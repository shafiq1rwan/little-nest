// Short sound effects (CC0, Kenney audio packs; see public/audio/sfx/SOURCES.md).
// Web Audio so sounds can overlap and start instantly. Nothing loads or plays before the first
// pointer or key gesture, because browsers block audio until then. On/off and volume are remembered.

import { readString, writeString } from '../persistence/storage.js';

// name -> { files, gain }. Several files are picked at random so repeats do not sound mechanical.
export const SFX = {
  place: { files: ['place-0', 'place-1', 'place-2', 'place-3', 'place-4'], gain: 0.42 },
  pickup: { files: ['pickup'], gain: 0.55 },
  rotate: { files: ['rotate'], gain: 0.45 },
  lamp: { files: ['lamp'], gain: 0.9 },
  curtain: { files: ['curtain'], gain: 0.6 },
  recolor: { files: ['recolor'], gain: 0.5 },
  remove: { files: ['remove'], gain: 0.55 },
  blocked: { files: ['blocked'], gain: 0.35 },
  tap: { files: ['tap'], gain: 0.4 },
  doorbell: { files: ['doorbell'], gain: 0.55, notes: [[0, 1.26], [0.36, 1]] },   // ding-dong: one chime, a major third apart
};

export function createSfx({ base = 'audio/sfx/', storageKey, volumeKey, defaultVolume = 0.7 }) {
  let on = readString(storageKey) !== 'off';
  let volume = Number(readString(volumeKey) ?? defaultVolume);
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) volume = defaultVolume;
  let context = null, master = null;
  const buffers = new Map();   // file -> AudioBuffer
  const log = [];              // names played, newest last (inspected by tests)

  async function load(file) {
    try {
      const data = await (await fetch(base + file + '.ogg')).arrayBuffer();
      buffers.set(file, await context.decodeAudioData(data));
    } catch (error) {
      console.warn('Little Nest: sound ' + file + ' did not load.', error);
    }
  }
  function unlock() {
    if (context) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    context = new Ctx();
    master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
    for (const { files } of Object.values(SFX)) for (const f of files) load(f);
  }
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  function play(name) {
    const sfx = SFX[name];
    if (!sfx || !on) return false;
    log.push(name);
    if (log.length > 50) log.shift();
    if (!context) return false;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const buffer = buffers.get(sfx.files[Math.floor(Math.random() * sfx.files.length)]);
    if (!buffer) return false;
    const gain = context.createGain();
    gain.gain.value = sfx.gain;
    gain.connect(master);
    // Most sounds are one sample with a little pitch variation; `notes` plays it as a short tune of [delay, rate].
    for (const [delay, rate] of sfx.notes ?? [[0, 0.96 + Math.random() * 0.08]]) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(gain);
      source.start(context.currentTime + delay);
    }
    return true;
  }
  function setOn(next) {
    on = !!next;
    writeString(storageKey, on ? 'on' : 'off');
  }
  function setVolume(next) {
    volume = Math.min(1, Math.max(0, Number(next) || 0));
    writeString(volumeKey, String(volume));
    if (master) master.gain.value = volume;
  }
  return { play, setOn, isOn: () => on, setVolume, volume: () => volume, log, loaded: () => buffers.size };
}
