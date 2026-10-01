// Paint the lightweight loading UI before downloading and preparing the 3D game.
import { createScreens } from './ui/screens.js';

const screens = createScreens();
void start();

async function start() {
  try {
    await screens.progress(10, 'Getting your room ready…');
    const { initializeGame } = await import('./main.js');
    const game = await initializeGame({ onProgress: screens.progress, onOpenRoom: screens.enterGame, onNotice: screens.notice });
    screens.ready(game);
  } catch (error) {
    screens.fail(error);
  }
}
