import { defineConfig, devices, type WebServerConfig } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { env, pid } from 'node:process'
import { fileURLToPath } from 'node:url'

const testRoot = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = resolve(testRoot, '../bid-client')
const backendRoot = resolve(testRoot, '../bid_auction/bid_auction_app')
const clientHost = '127.0.0.1'
const clientPort = '3103'
const apiHost = '127.0.0.1'
const apiPort = '8103'
const useExternalServers = env.FRONTEND_PERF_EXTERNAL_SERVERS === '1'
const baseURL = useExternalServers
  ? env.FRONTEND_PERF_BASE_URL ?? `http://${clientHost}:${clientPort}`
  : `http://${clientHost}:${clientPort}`
const apiBaseURL = useExternalServers
  ? env.FRONTEND_PERF_API_BASE_URL ?? `http://${apiHost}:${apiPort}`
  : `http://${apiHost}:${apiPort}`
const viteCli = resolve(testRoot, 'node_modules/vite/bin/vite.js')
const viteConfig = resolve(testRoot, 'vite.config.ts')
const performanceRunId = `${pid}-${randomUUID()}`.replace(/[^a-z0-9_-]/gi, '')
const sqlitePath = resolve(
  testRoot,
  'test-results',
  'frontend-performance',
  performanceRunId,
  'question-search.sqlite3',
)

function requireSafeLoopbackOrigin(value: string, name: string) {
  const url = new URL(value)
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (
    !isLoopback ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be a loopback HTTP(S) origin without a path.`)
  }
}

requireSafeLoopbackOrigin(baseURL, 'FRONTEND_PERF_BASE_URL')
requireSafeLoopbackOrigin(apiBaseURL, 'FRONTEND_PERF_API_BASE_URL')

const webServer: WebServerConfig[] | undefined = useExternalServers
  ? undefined
  : [
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
            'performance-e2e-only-secret-key-never-use-in-production-0123456789abcdef'
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
  testMatch: 'frontend-performance.e2e.ts',
  outputDir: 'test-results/playwright-performance',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/performance', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  expect: {
    timeout: 15_000,
  },
  webServer,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
