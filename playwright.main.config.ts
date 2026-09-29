import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const clientHost = '127.0.0.1'
const clientPort = '3127'
const baseURL = `http://${clientHost}:${clientPort}`
const viteCli = resolve(frontendRoot, 'node_modules/vite/bin/vite.js')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'main-shortcuts.e2e.ts',
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/main', open: 'never' }],
  ],
  outputDir: 'test-results/playwright-main',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" "${viteCli}" --host ${clientHost} --port ${clientPort} --strictPort`,
    cwd: frontendRoot,
    env: { VITE_API_BASE_URL: baseURL },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
