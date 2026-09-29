import { defineConfig } from '@playwright/test'
import searchConfig from './playwright.search.config'

const webServers = Array.isArray(searchConfig.webServer)
  ? searchConfig.webServer
  : searchConfig.webServer ? [searchConfig.webServer] : []

export default defineConfig({
  ...searchConfig,
  testMatch: 'region-search-performance.e2e.ts',
  outputDir: 'test-results/playwright-region-performance',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/region-performance', open: 'never' }],
  ],
  webServer: webServers.map((server) => ({
    ...server,
    env: {
      ...server.env,
      ...(server.env?.SEARCH_E2E_HARNESS === '1'
        ? { SEARCH_E2E_REGION_PERFORMANCE: '1' }
        : {}),
    },
  })),
})
