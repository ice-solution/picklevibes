import { defineConfig, devices } from '@playwright/test';

/**
 * PickCourt / PickleVibes E2E 設定
 * 修改 baseURL 以指向不同環境（本機 / UAT / staging）
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /**
   * 本機開發：自動啟動前後端（`npm run dev`）
   * - 若已手動啟動 dev，會沿用現有服務（reuseExistingServer）
   * - 若 port 已被佔用，可設 PLAYWRIGHT_SKIP_WEBSERVER=1 並先手動 npm run dev
   */
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 180_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }),
});
