import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test'
import { createHash, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { env, pid } from 'node:process'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const backendRoot = resolve(frontendRoot, '../bid_auction/bid_auction_app')
const apiHost = '127.0.0.1'
const worktreePortOffset = Number.parseInt(
  createHash('sha256').update(backendRoot).digest('hex').slice(0, 8),
  16,
) % 10_000
const apiPort = env.SQLADMIN_E2E_PORT ?? String(20_000 + worktreePortOffset)
const baseURL = `http://${apiHost}:${apiPort}`
const runId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')
const sqlitePath = resolve(
  frontendRoot,
  'test-results',
  'sqladmin-e2e',
  runId,
  'sqladmin.sqlite3',
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

requireSafeLoopbackOrigin(baseURL, 'SQLAdmin baseURL')

const webServer: NonNullable<PlaywrightTestConfig['webServer']> = {
  command: (
    `python -m uvicorn app.tests.e2e.admin.harness_app:app ` +
    `--host ${apiHost} --port ${apiPort}`
  ),
  cwd: backendRoot,
  env: {
    SQLADMIN_E2E_HARNESS: '1',
    SQLADMIN_E2E_HOST: apiHost,
    SQLADMIN_E2E_BASE_URL: baseURL,
    SQLADMIN_E2E_SQLITE_PATH: sqlitePath,
    SQLADMIN_E2E_AUTH_SECRET_KEY: (
      `sqladmin-e2e-only-secret-never-use-in-production-${runId}-` +
      '0123456789abcdef0123456789abcdef'
    ),
    SQLADMIN_E2E_REDIS_URL: env.SQLADMIN_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/12',
  },
  url: `${baseURL}/admin/login`,
  reuseExistingServer: false,
  timeout: 120_000,
  stdout: 'pipe',
  stderr: 'pipe',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'sqladmin.e2e.ts',
  outputDir: 'test-results/playwright-sqladmin',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/sqladmin', open: 'never' }],
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
