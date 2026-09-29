import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const baseURL = 'http://127.0.0.1:3191'
const apiURL = 'http://127.0.0.1:8191'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'photo-cost.e2e.ts',
  outputDir: 'test-results/playwright-photo-cost',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/photo-cost', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  webServer: [
    {
      command: 'python -m uvicorn app.tests.e2e.media.harness_app:app --host 127.0.0.1 --port 8191',
      cwd: resolve(root, '../bid_auction/bid_auction_app'),
      env: { MEDIA_E2E_HARNESS: '1', MEDIA_E2E_CLIENT_URL: baseURL, PHOTO_COST_E2E: '1' },
      url: `${apiURL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" "${resolve(root, 'node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 3191`,
      cwd: root,
      env: { VITE_API_BASE_URL: apiURL, VITE_PHOTO_CDN_BASE_URL: apiURL },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
