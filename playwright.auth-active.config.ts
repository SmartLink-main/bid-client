import { defineConfig, devices, type WebServerConfig } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { env, pid } from 'node:process'
import { fileURLToPath } from 'node:url'

const testRoot = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(testRoot, '../bid-client')
const backendRoot = resolve(testRoot, '../bid_auction/bid_auction_billing')
const clientHost = '127.0.0.1'
const clientPort = '3102'
const apiHost = '127.0.0.1'
const apiPort = '8102'
const baseURL = `http://${clientHost}:${clientPort}`
const apiBaseURL = `http://${apiHost}:${apiPort}`
const viteCli = resolve(testRoot, 'node_modules/vite/bin/vite.js')
const viteConfig = resolve(testRoot, 'vite.config.ts')
const authE2eRunId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')

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

requireSafeLoopbackOrigin(baseURL, 'auth frontend baseURL')
requireSafeLoopbackOrigin(apiBaseURL, 'auth API baseURL')

const webServer: WebServerConfig[] = [
  {
    command: (
      `python -m uvicorn app.tests.e2e.billing.harness_app:app ` +
      `--host ${apiHost} --port ${apiPort}`
    ),
    cwd: backendRoot,
    env: {
      BILLING_E2E_HARNESS: '1',
      BILLING_E2E_RUN_ID: authE2eRunId,
      BILLING_E2E_HOST: apiHost,
      BILLING_E2E_DATABASE_URL: 'sqlite:///:memory:',
      BILLING_E2E_REDIS_URL: env.BILLING_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/15',
      BILLING_E2E_CLIENT_URL: baseURL,
      BILLING_E2E_AUTH_SECRET_KEY: (
        'auth-e2e-only-secret-key-never-use-in-production-0123456789abcdef'
      ),
      BILLING_E2E_TOSS_CLIENT_KEY: 'test_ck_auth_playwright_fake_provider',
      BILLING_E2E_TOSS_SECRET_KEY: 'test_sk_auth_playwright_fake_provider',
    },
    url: `${apiBaseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  {
    command: (
      `"${process.execPath}" "${viteCli}" "${frontendRoot}" ` +
      `--config "${viteConfig}" --host ${clientHost} --port ${clientPort}`
    ),
    cwd: testRoot,
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
  testMatch: 'auth-session.e2e.ts',
  outputDir: 'test-results/playwright-auth-active',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/auth-active', open: 'never' }],
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
