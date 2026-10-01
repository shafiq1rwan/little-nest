// Looping background music with a remembered on/off choice.
// Browsers block autoplay, so playback waits for the first pointer or key gesture.

import { readString, writeString } from '../persistence/storage.js';

export function createMusic({ src, volume, storageKey, button, installIcons, onToggle }) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = volume;
  audio.preload = 'auto';
  let on = readString(storageKey) !== 'off';
  let unlocked = false;

  function syncButton() {
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
    button.title = on ? 'Music on' : 'Music off';
    button.querySelector('[data-icon]').dataset.icon = on ? 'music' : 'music-off';
    installIcons(button);
  }
  function apply() {
    if (on && unlocked) audio.play().catch(() => {});
    else audio.pause();
  }
  function unlock() { unlocked = true; apply(); }
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  function setOn(next) {
    on = !!next;
    writeString(storageKey, on ? 'on' : 'off');
    syncButton();
    apply();
    onToggle?.(on);
  }
  button.onclick = () => setOn(!on);
  syncButton();

  return { audio, isOn: () => on, setOn };
}
