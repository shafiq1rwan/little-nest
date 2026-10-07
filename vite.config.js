import { defineConfig } from 'vite';

// A relative base makes the build work from any folder: GitHub Pages serves it under /little-nest/,
// itch.io from its own path, and Electron from file://. Runtime asset paths in src are relative too.
export default defineConfig({
  base: './',
});
