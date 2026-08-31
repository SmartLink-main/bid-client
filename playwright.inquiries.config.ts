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
const clientPort = '3103'
const apiHost = '127.0.0.1'
const apiPort = '8103'
const baseURL = `http://${clientHost}:${clientPort}`
const apiBaseURL = `http://${apiHost}:${apiPort}`
const viteCli = resolve(frontendRoot, 'node_modules/vite/bin/vite.js')
const runId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')
const sqlitePath = resolve(
  frontendRoot,
  'test-results',
  'inquiries-e2e',
  runId,
  'inquiries.sqlite3',
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

requireSafeLoopbackOrigin(baseURL, 'inquiry baseURL')
requireSafeLoopbackOrigin(apiBaseURL, 'inquiry apiBaseURL')

const webServer: NonNullable<PlaywrightTestConfig['webServer']> = [
  {
    command: (
      `python -m uvicorn app.tests.e2e.inquiries.harness_app:app ` +
      `--host ${apiHost} --port ${apiPort}`
    ),
    cwd: backendRoot,
    env: {
      INQUIRY_E2E_HARNESS: '1',
      INQUIRY_E2E_HOST: apiHost,
      INQUIRY_E2E_CLIENT_URL: baseURL,
      INQUIRY_E2E_SQLITE_PATH: sqlitePath,
      INQUIRY_E2E_AUTH_SECRET_KEY: (
        `inquiry-e2e-only-secret-never-use-in-production-${runId}-` +
        '0123456789abcdef0123456789abcdef'
      ),
      INQUIRY_E2E_REDIS_URL: env.INQUIRY_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/14',
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
  testMatch: 'inquiries.e2e.ts',
  outputDir: 'test-results/playwright-inquiries',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/inquiries', open: 'never' }],
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

