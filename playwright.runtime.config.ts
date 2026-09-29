import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const baseURL = 'http://127.0.0.1:3204'
const apiURL = 'http://127.0.0.1:8204'
const python = env.RUNTIME_E2E_PYTHON ?? 'python'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'backend-runtime.e2e.ts',
  outputDir: 'test-results/playwright-runtime',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/runtime', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn app.tests.e2e.runtime.harness_app:app --host 127.0.0.1 --port 8204`,
      cwd: resolve(root, '../bid_auction/bid_auction_app'),
      env: { RUNTIME_E2E_HARNESS: '1', RUNTIME_E2E_CLIENT_URL: baseURL },
      url: `${apiURL}/__runtime/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" "${resolve(root, 'node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 3204`,
      cwd: root,
      env: { VITE_API_BASE_URL: apiURL, VITE_PHOTO_CDN_BASE_URL: '' },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
