import { defineConfig, devices } from '@playwright/test';

const isCI = process.env.CI === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @keyra/api dev',
    url: 'http://localhost:8788',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
    env: {
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CLOUDFLARE_API_TOKEN: 'test-token',
    },
  },
});
