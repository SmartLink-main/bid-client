import { defineConfig } from '@playwright/test'
import photoCostConfig from './playwright.photo-cost.config'

// 실제 저장소 대신 메모리 사진·CDN을 사용하는 대표사진 브라우저 검증 설정.
export default defineConfig({
  ...photoCostConfig,
  testMatch: 'photo-order.e2e.ts',
  outputDir: 'test-results/playwright-photo-order',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/photo-order', open: 'never' }]],
})
