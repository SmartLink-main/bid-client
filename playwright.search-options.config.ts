import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const backendRoot = resolve(frontendRoot, '../bid_auction/bid_auction_billing')
const apiHost = '127.0.0.1'
const apiPort = '8112'
const apiBaseURL = `http://${apiHost}:${apiPort}`

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

requireSafeLoopbackOrigin(apiBaseURL, 'search options apiBaseURL')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'backend-search-options.e2e.ts',
  outputDir: 'test-results/playwright-search-options',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: 'playwright-report/search-options', open: 'never' },
    ],
  ],
  use: {
    baseURL: apiBaseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: (
      `python -m uvicorn app.tests.e2e.search_options.harness_app:app ` +
      `--host ${apiHost} --port ${apiPort}`
    ),
    cwd: backendRoot,
    env: {
      SEARCH_OPTIONS_E2E_HARNESS: '1',
      SEARCH_OPTIONS_E2E_HOST: apiHost,
    },
    url: `${apiBaseURL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
