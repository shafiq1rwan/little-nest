// Main menu, startup feedback, and settings. The room remains owned by main.js.
import { installIcons } from './icons.js';

const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// One of these shows under the loading bar; they double as a gentle tutorial.
export const LOADING_TIPS = [
  'Drag furniture to move it.',
  'Press R to rotate what you are holding.',
  'Small things like mugs and candles go on tables and shelves.',
  'Pictures and shelves snap to the walls.',
  'Try the Light tab for sunset and evening moods.',
  'Lamps have their own switch on their card.',
  'Ctrl+Z undoes anything, even loading a room.',
  'Photo mode hides the controls and saves a picture.',
  'Rooms keeps every design; export one to share it.',
];

export function createScreens() {
  const $ = id => document.getElementById(id);
  const app = $('app');
  const menu = $('main-menu');
  const loading = $('loading-screen');
  const settings = $('settings');
  let game = null;
  let hasPlayed = false;
  $('loading-tip').textContent = 'Tip: ' + LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];

  // Native modal dialogs must not inherit the menu's inert game subtree.
  document.body.append($('gallery'));
  installIcons();

  function screen(name) {
    document.body.dataset.screen = name;
    menu.hidden = name !== 'menu';
    app.inert = name !== 'game';
    app.setAttribute('aria-hidden', String(name !== 'game'));
    if (name === 'loading') { loading.hidden = false; loading.classList.remove('is-leaving'); return; }
    if (!loading.hidden && !loading.classList.contains('is-leaving')) {
      // Fade the loading screen out over the first frame of the menu instead of cutting.
      loading.classList.add('is-leaving');
      loading.addEventListener('transitionend', () => { loading.hidden = true; }, { once: true });
      setTimeout(() => { loading.hidden = true; }, 500);   // in case transitions are disabled
    }
  }
  function enterGame() {
    if (!game) return;
    hasPlayed = true;
    screen('game');
    game.setEditing(true);
    $('scene').focus({ preventScroll: true });
  }
  function showMenu() {
    if (!game) return;
    game.setEditing(false);
    screen('menu');
    game.refresh();
    $('menu-start-label').textContent = hasPlayed ? 'Resume decorating' : 'Start decorating';
    $('menu-notice').textContent = '';
    $('menu-start').focus({ preventScroll: true });
  }
  function syncSfx() {
    const on = game.sfx.isOn();
    $('settings-sfx').setAttribute('aria-pressed', String(on));
    $('settings-sfx').textContent = on ? 'On' : 'Off';
    $('settings-sfx-volume').value = String(Math.round(game.sfx.volume() * 100));
    $('settings-sfx-volume').disabled = !on;
  }
  function syncMusic() {
    const on = game.music.isOn();
    $('settings-music').setAttribute('aria-pressed', String(on));
    $('settings-music').textContent = on ? 'On' : 'Off';
  }

  $('menu-start').onclick = enterGame;
  $('main-menu-toggle').onclick = showMenu;
  $('menu-rooms').onclick = () => game.openRooms();
  $('menu-settings').onclick = () => { syncMusic(); syncSfx(); settings.showModal(); };
  $('settings-sfx').onclick = () => { game.sfx.setOn(!game.sfx.isOn()); syncSfx(); game.sfx.play('tap'); };
  $('settings-sfx-volume').oninput = (ev) => { game.sfx.setVolume(Number(ev.target.value) / 100); };
  $('settings-sfx-volume').onchange = () => game.sfx.play('place');   // a sample at the new level
  $('settings-music').onclick = () => { game.music.setOn(!game.music.isOn()); syncMusic(); };
  $('settings-close').onclick = $('settings-done').onclick = () => settings.close();
  settings.addEventListener('click', ev => { if (ev.target === settings) settings.close(); });
  const credits = $('credits');
  $('menu-credits').onclick = () => credits.showModal();
  $('credits-close').onclick = $('credits-done').onclick = () => credits.close();
  credits.addEventListener('click', ev => { if (ev.target === credits) credits.close(); });
  $('loading-retry').onclick = () => location.reload();

  return {
    enterGame,
    ready(api) { game = api; showMenu(); },
    notice(message) { $('menu-notice').textContent = message; },
    async progress(value, message) {
      $('loading-progress').value = value;
      $('loading-status').textContent = message;
      await paint();
    },
    fail(error) {
      console.error('Little Nest could not start:', error);
      screen('loading');
      $('loading-status').textContent = 'Your room could not open. Please try again.';
      $('loading-progress').hidden = true;
      $('loading-retry').hidden = false;
      $('loading-retry').focus();
    },
  };
}
