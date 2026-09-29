import { defineConfig } from '@playwright/test'

import geoHarnessConfig from './playwright.subway.config'

export default defineConfig(geoHarnessConfig, {
  testMatch: [
    'map-search.e2e.ts',
    'map-clusters.e2e.ts',
    'map-viewport.e2e.ts',
    'map-viewport-sync.e2e.ts',
    'map-region-camera.e2e.ts',
    'subway-search.e2e.ts',
  ],
  outputDir: 'test-results/playwright-geo-search',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/geo-search', open: 'never' }],
  ],
})
