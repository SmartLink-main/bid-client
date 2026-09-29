import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname
    return host === '127.0.0.1' || host === 'localhost' ? route.fallback() : route.abort()
  })
})

test('검색 카드와 상세의 평수가 일치하고 면적 필터도 매각면적을 사용한다', async ({ page, request }, testInfo) => {
  const result = await request.get('http://127.0.0.1:8197/api/v1/search?case_year=2024&case_serial=118123&min_building_area_pyeong=100')
  expect(result.ok()).toBeTruthy()
  const body = await result.json()
  expect(body.items).toHaveLength(1)
  expect(body.items[0].building_area_pyeong).toBe(103.35)
  expect(body.items[0].land_area_pyeong).toBe(37.96)
  await page.goto('/search?case_year=2024&case_serial=118123&min_building_area_pyeong=100')
  const card = page.getByRole('article').filter({ hasText: '2024타경118123' })
  await expect(card.getByRole('group', { name: '토지 및 건물 면적' })).toContainText('103.35평')
  await expect(card.getByRole('group', { name: '토지 및 건물 면적' })).toContainText('37.96평')
  await card.screenshot({ path: testInfo.outputPath('search-sale-areas.png') })
  await card.getByRole('link', { name: '상세보기' }).click()
  await expect(page).toHaveURL(/\/goods\/1$/)
  await expect(page.getByRole('region', { name: '매각목록 면적', exact: true })).toContainText('103.35평')
})

test('미수집 물건은 대장값으로 대체하지 않고 목록과 상세에서 미확인을 표시한다', async ({ page, request }) => {
  const result = await request.get('http://127.0.0.1:8197/api/v1/search?case_year=2026&case_serial=999999')
  const body = await result.json()
  expect(body.items).toHaveLength(1)
  expect(body.items[0].building_area_pyeong).toBeNull()
  expect(body.items[0].land_area_pyeong).toBeNull()
  await page.goto('/search?case_year=2026&case_serial=999999')
  const card = page.getByRole('article').filter({ hasText: '2026타경999999' })
  const areas = card.getByRole('group', { name: '토지 및 건물 면적' })
  await expect(areas).not.toContainText('0평')
  await expect(areas).toBeVisible()
  await card.getByRole('link', { name: '상세보기' }).click()
  await expect(page.getByText('아직 수집된 매각목록 면적이 없습니다.')).toBeVisible()
  const filtered = await request.get('http://127.0.0.1:8197/api/v1/search?case_year=2026&case_serial=999999&min_building_area_pyeong=0')
  expect((await filtered.json()).items).toHaveLength(0)
})
