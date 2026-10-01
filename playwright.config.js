import { defineConfig } from '@playwright/test';

// Portable checks. `unit` runs pure modules in Node; `browser` drives the game in Playwright's own
// Chromium (install once with `npm run test:install`). Set LITTLE_NEST_BROWSER=msedge or chrome to
// use a system browser instead.
const channel = process.env.LITTLE_NEST_BROWSER;
const port = 5173;

export default defineConfig({
  outputDir: 'tests/output',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'unit', testDir: 'tests/unit' },
    // Opt-in benchmark: PERF=1 npx playwright test --project perf (or npm run bench). Not part of npm test.
    {
      name: 'perf',
      testDir: 'tests/perf',
      testMatch: process.env.PERF ? /.*.spec.js/ : /$^/,
      use: { baseURL: 'http://localhost:' + port, ...(channel ? { channel } : {}), launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
    {
      name: 'browser',
      testDir: 'tests/browser',
      use: {
        baseURL: 'http://localhost:' + port,
        ...(channel ? { channel } : {}),
        // Software WebGL keeps the checks runnable on machines without a GPU.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
        screenshot: 'only-on-failure',
      },
    },
  ],
  webServer: {
    command: 'npx vite --port ' + port + ' --strictPort',
    url: 'http://localhost:' + port,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
