import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing of multiplayer functionality.
 * @see https://playwright.dev/docs/test-configuration
 *
 * Browser installation:
 *   npx playwright install chromium
 *
 * Or use system Chrome:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for multiplayer scenarios
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure proper test isolation
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000, // 60 seconds per test

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    // Use system Chrome if PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is set
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
