import { defineConfig } from '@playwright/test'
import geoHarnessConfig from './playwright.subway.config'

export default defineConfig(geoHarnessConfig, {
  testMatch: ['map-region-camera.e2e.ts'],
  outputDir: '../artifacts/map-region-camera-diagnostic-20260911',
  reporter: [['list']],
})
