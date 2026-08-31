import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const clientHost = '127.0.0.1'
const clientPort = env.LEGAL_E2E_PORT ?? '3112'
const baseURL = `http://${clientHost}:${clientPort}`
const viteCli = resolve(frontendRoot, 'node_modules/vite/bin/vite.js')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'legal-policies.e2e.ts',
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/legal-policies', open: 'never' }],
  ],
  outputDir: 'test-results/playwright-legal-policies',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" "${viteCli}" --host ${clientHost} --port ${clientPort}`,
    cwd: frontendRoot,
    env: {
      VITE_API_BASE_URL: baseURL,
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
