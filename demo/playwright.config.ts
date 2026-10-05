import { defineConfig, devices } from '@playwright/test';

const hosted = process.env.EIQ_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  outputDir: '../.local/browser-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: '../.local/browser-report', open: 'never' }]],
  use: {
    baseURL: hosted || 'http://127.0.0.1:4173/enterprise-iq/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
    { name: 'firefox-smoke', grep: /@smoke/, use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: hosted ? undefined : {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/enterprise-iq/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
