import { defineConfig } from '@playwright/test'
import detailConfig from './playwright.detail-comparison.config'

// 기존 메모리 DB·가짜 첨부파일 하네스만 사용한다. 운영 DB와 S3에는 접근하지 않는다.
export default defineConfig({
  ...detailConfig,
  testMatch: 'appraisal-layout.e2e.ts',
  outputDir: 'test-results/playwright-appraisal',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/appraisal', open: 'never' }]],
})
