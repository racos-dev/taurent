import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright Test configuration for taurent desktop mocked renderer integration.
 *
 * Runs against Vite dev/preview server started with VITE_AUTOMATION=1, using
 * mocked desktop bridge and tauri transport so the React app runs in Chromium
 * without a real Tauri backend.
 *
 * Usage:
 *   pnpm renderer:e2e          — headless, CI-friendly
 *   pnpm renderer:e2e:ui       — interactive UI mode
 *   pnpm desktop:renderer:e2e  — root alias
 */

const port = Number(process.env.PLAYWRIGHT_PORT ?? 43173);
const baseURL = `http://127.0.0.1:${port}`;
const configDir = path.dirname(fileURLToPath(import.meta.url));

// Output under repo conventions (artifacts/ already in .gitignore)
const testOutputDir = path.resolve(configDir, '../../test-results/desktop');
const reportDir = path.resolve(configDir, '../../artifacts/desktop/playwright-report');

export default defineConfig({
  testDir: './e2e',
  outputDir: testOutputDir,

  fullyParallel: false,        // desktop renderer is not parallel-safe for now
  forbidOnly: !!process.env.CI,

  // Retry failures once so traces are captured by trace: 'on-first-retry'.
  retries: 1,

  reporter: [
    ['html', { outputFolder: reportDir, open: 'never' }],
    ['json', { outputFile: path.resolve(configDir, '../../artifacts/desktop/playwright-report/results.json') }],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',          // capture trace on first retry (cheaper than on-all-retries)
    screenshot: { mode: 'only-on-failure' },
    video: { mode: 'on-first-retry', size: { width: 1280, height: 800 } },
    launchOptions: {
      args: [
        '--disable-gpu',
        '--no-sandbox',
      ],
    },
  },

  projects: [
    // ── Chromium full project (all tests) ─────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-gpu',
            '--no-sandbox',
          ],
        },
      },
    },
  ],

  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_AUTOMATION: '1',
    },
    timeout: 60_000,
  },

  timeout: 30_000,
});
