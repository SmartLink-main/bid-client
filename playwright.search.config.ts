import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { env, pid } from 'node:process'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const backendRoot = resolve(frontendRoot, '../bid_auction/bid_auction_app')
const clientHost = '127.0.0.1'
const clientPort = '3101'
const apiHost = '127.0.0.1'
const apiPort = '8101'
const baseURL = `http://${clientHost}:${clientPort}`
const apiBaseURL = `http://${apiHost}:${apiPort}`
const viteCli = resolve(frontendRoot, 'node_modules/vite/bin/vite.js')
const searchE2eRunId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')
const sqlitePath = resolve(
  frontendRoot,
  'test-results',
  'search-e2e',
  searchE2eRunId,
  'question-search.sqlite3',
)

function requireSafeLoopbackOrigin(value: string, name: string) {
  const url = new URL(value)
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (
    !isLoopback || !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error(`${name} must be a loopback HTTP(S) origin without a path.`)
  }
}

requireSafeLoopbackOrigin(baseURL, 'search baseURL')
requireSafeLoopbackOrigin(apiBaseURL, 'search apiBaseURL')

const webServer: NonNullable<PlaywrightTestConfig['webServer']> = [
  {
    command: (
      `python -m uvicorn app.tests.e2e.search.harness_app:app ` +
      `--host ${apiHost} --port ${apiPort}`
    ),
    cwd: backendRoot,
    env: {
      SEARCH_E2E_HARNESS: '1',
      SEARCH_E2E_HOST: apiHost,
      SEARCH_E2E_CLIENT_URL: baseURL,
      SEARCH_E2E_SQLITE_PATH: sqlitePath,
      SEARCH_E2E_AUTH_SECRET_KEY: (
        'search-e2e-only-auth-secret-key-never-use-in-production-0123456789abcdef'
      ),
      SEARCH_E2E_REDIS_URL: env.SEARCH_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/15',
    },
    url: `${apiBaseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  {
    command: `"${process.execPath}" "${viteCli}" --host ${clientHost} --port ${clientPort}`,
    cwd: frontendRoot,
    env: {
      VITE_API_BASE_URL: apiBaseURL,
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'question-search.e2e.ts',
  outputDir: 'test-results/playwright-search',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/search', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: {
    timeout: 10_000,
  },
  webServer,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
