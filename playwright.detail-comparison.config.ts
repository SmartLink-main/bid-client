import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 실데이터·CDN에 접근하지 않는 물건상세 비교 기능 전용 브라우저 환경.
const root = fileURLToPath(new URL('.', import.meta.url))
const baseURL = 'http://127.0.0.1:3198'
const apiURL = 'http://127.0.0.1:8198'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'detail-comparison.e2e.ts',
  outputDir: 'test-results/playwright-detail-comparison',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/detail-comparison', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  webServer: [
    {
      command: 'python -m uvicorn app.tests.e2e.detail_comparison.harness_app:app --host 127.0.0.1 --port 8198',
      cwd: resolve(root, '../bid_auction/bid_auction_app'),
      env: { DETAIL_COMPARISON_E2E_HARNESS: '1', DETAIL_COMPARISON_E2E_CLIENT_URL: baseURL },
      url: `${apiURL}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" "${resolve(root, 'node_modules/vite/bin/vite.js')}" --host 127.0.0.1 --port 3198`,
      cwd: root,
      env: { VITE_API_BASE_URL: apiURL, VITE_PHOTO_CDN_BASE_URL: '' },
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
