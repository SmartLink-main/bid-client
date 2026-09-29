import { defineConfig } from '@playwright/test'

import clientHarnessConfig from './playwright.subway.config'

export default defineConfig(clientHarnessConfig, {
  testMatch: ['map-search.e2e.ts', 'map-viewport-sync.e2e.ts', 'map-viewport.e2e.ts', 'map-region-camera.e2e.ts', 'map-clusters.e2e.ts'],
  outputDir: 'test-results/playwright-map-search',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/map-search', open: 'never' }],
  ],
})
