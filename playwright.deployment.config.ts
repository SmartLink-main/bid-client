import { defineConfig, devices } from '@playwright/test'
import { getDeploymentTarget } from './e2e/support/deployment-target'

const target = getDeploymentTarget()

export default defineConfig({
  testDir: './e2e/deployment',
  testMatch: '*.e2e.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: target.waitMilliseconds + 90_000,
  globalTimeout: target.waitMilliseconds + 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/deployment', open: 'never' }],
  ],
  outputDir: 'test-results/playwright-deployment',
  use: {
    baseURL: target.site.origin,
    storageState: { cookies: [], origins: [] },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'deployment-chromium', use: { ...devices['Desktop Chrome'] } }],
})
