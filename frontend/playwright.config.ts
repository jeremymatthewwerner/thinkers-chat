import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* Use 4 workers in CI for parallel test execution across multiple test files */
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  /* Increase timeout for tests using real Claude API calls */
  timeout: process.env.CI ? 180000 : 90000, // 3 min in CI, 90s locally
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
