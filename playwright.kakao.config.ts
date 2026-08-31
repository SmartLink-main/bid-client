import { defineConfig, devices, type WebServerConfig } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { env, pid } from 'node:process'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const backendRoot = resolve(frontendRoot, '../bid_auction/bid_auction_auth')
const clientHost = '127.0.0.1'
const clientPort = '3103'
const apiHost = '127.0.0.1'
const apiPort = '8103'
const baseURL = `http://${clientHost}:${clientPort}`
const apiBaseURL = `http://${apiHost}:${apiPort}`
const viteCli = resolve(frontendRoot, 'node_modules/vite/bin/vite.js')
const runId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')

function requireSafeLoopbackOrigin(value: string, name: string) {
  const url = new URL(value)
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (
    !isLoopback || url.protocol !== 'http:' ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error(`${name} must be a loopback HTTP origin without a path.`)
  }
}

requireSafeLoopbackOrigin(baseURL, 'Kakao E2E frontend URL')
requireSafeLoopbackOrigin(apiBaseURL, 'Kakao E2E API URL')

const webServer: WebServerConfig[] = [
  {
    command: (
      `python -m uvicorn app.tests.e2e.auth.kakao_harness_app:app ` +
      `--host ${apiHost} --port ${apiPort}`
    ),
    cwd: backendRoot,
    env: {
      KAKAO_E2E_HARNESS: '1',
      KAKAO_E2E_HOST: apiHost,
      KAKAO_E2E_API_URL: apiBaseURL,
      KAKAO_E2E_CLIENT_URL: baseURL,
      KAKAO_E2E_DATABASE_URL: 'sqlite:///:memory:',
      KAKAO_E2E_REDIS_URL: env.KAKAO_E2E_REDIS_URL ?? 'redis://127.0.0.1:6379/14',
      KAKAO_E2E_AUTH_SECRET_KEY: (
        'kakao-e2e-only-auth-secret-key-never-use-in-production-0123456789abcdef'
      ),
      KAKAO_E2E_RUN_ID: runId,
    },
    url: `${apiBaseURL}/__e2e__/health`,
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
  testMatch: 'kakao-signup.e2e.ts',
  outputDir: 'test-results/playwright-kakao',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/kakao', open: 'never' }],
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
