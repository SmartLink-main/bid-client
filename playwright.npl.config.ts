import { defineConfig } from '@playwright/test'

import clientHarnessConfig from './playwright.subway.config'

export default defineConfig(clientHarnessConfig, {
  testMatch: 'npl-search.e2e.ts',
  outputDir: 'test-results/playwright-npl-search',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/npl-search', open: 'never' }],
  ],
})
