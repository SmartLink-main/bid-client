import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const baseURL = 'http://127.0.0.1:3197'
const apiURL = 'http://127.0.0.1:8197'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['sale-areas.e2e.ts', 'search-sale-areas.e2e.ts'],
  outputDir: 'test-results/playwright-sale-areas',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/sale-areas', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  webServer: [
    {
      command: 'python -m uvicorn app.tests.e2e.areas.harness_app:app --host 127.0.0.1 --port 8197',
      cwd: resolve(root, '../bid_auction/bid_auction_app'),
      env: { AREA_E2E_HARNESS: '1', AREA_E2E_CLIENT_URL: baseURL },
      url: `${apiURL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" "${resolve(root, 'node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 3197`,
      cwd: root,
      env: { VITE_API_BASE_URL: apiURL, VITE_PHOTO_CDN_BASE_URL: '' },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
