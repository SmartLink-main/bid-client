import { expect, test } from '@playwright/test'

const apiURL = 'http://127.0.0.1:8197'

test.beforeEach(async ({ page }) => {
  // 면적 조회 검증에서 외부 지도·사진·분석 제공자에 접속하지 않는다.
  await page.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname
    return host === '127.0.0.1' || host === 'localhost' ? route.fallback() : route.abort()
  })
})

test('계산·저장된 본건/제시외 면적을 상세 API와 구분표에서 확인한다', async ({ page, request }, testInfo) => {
  const response = await request.get(`${apiURL}/api/v1/goods/1`)
  expect(response.status()).toBe(200)
  const detail = await response.json()
  expect(detail.sale_areas.basis).toBe('court_listed')
  expect(detail.sale_areas.main_building.pyeong).toBe(103.35)
  expect(detail.sale_areas.listed_total.pyeong).toBe(111.22)
  expect(detail.sale_areas.land.sqm).toBe(125.5)
  expect(detail.sale_areas.components.length).toBeGreaterThan(0)
  expect(detail.building.building_area_sqm).toBe(50)

  await page.goto('/goods/1')
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await expect(areas).toContainText('103.35평')
  await expect(areas).toContainText('111.22평')
  await areas.getByText('면적 구분별 보기', { exact: true }).click()
  const table = areas.getByRole('table', { name: '매각목록 면적 구분' })
  await expect(table.getByRole('row', { name: /^본건 건물/ })).toContainText('341.66㎡')
  await expect(table.getByRole('row', { name: /^제시외 건물/ })).toContainText('23.00㎡')
  await expect(table.getByRole('row', { name: /^제시외 시설/ })).toContainText('3.00㎡')
  await expect(table.getByRole('row', { name: /^건물·제시외 포함 합계/ })).toContainText('367.66㎡')
  await expect(page.getByRole('heading', { name: '건축물대장 정보' })).toBeVisible()
  await areas.screenshot({ path: testInfo.outputPath('sale-areas-breakdown.png') })
  await areas.getByText('면적 구분별 보기', { exact: true }).click()
  await expect(table).not.toBeVisible()
})

test('여러 토지만 매각하는 물건의 합계를 반환하고 건물을 0평으로 만들지 않는다', async ({ page, request }) => {
  const response = await request.get(`${apiURL}/api/v1/goods/2`)
  const { sale_areas: areas } = await response.json()
  expect(areas.land.sqm).toBe(446376)
  expect(areas.land.pyeong).toBe(135028.74)
  expect(areas.main_building).toMatchObject({ sqm: null, pyeong: null, status: 'not_applicable' })
  await page.goto('/goods/2')
  const section = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await expect(section).toContainText('135,028.74평')
  await section.getByText('면적 구분별 보기', { exact: true }).click()
  await expect(section.getByRole('row', { name: /^본건 건물/ })).toContainText('해당 없음')
})

test('미등기 대지권의 참고 면적은 확정값으로 반환하지 않는다', async ({ page, request }) => {
  const response = await request.get(`${apiURL}/api/v1/goods/3`)
  const { sale_areas: areas } = await response.json()
  expect(areas.land_rights).toMatchObject({ sqm: null, pyeong: null, status: 'unknown' })
  expect(areas.land.sqm).toBeNull()
  expect(areas.main_building.pyeong).toBe(13.77)
  await page.goto('/goods/3')
  const section = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await section.getByText('면적 구분별 보기', { exact: true }).click()
  const rights = section.getByRole('row', { name: /^대지권/ })
  await expect(rights).toContainText('미확인')
  await expect(rights).not.toContainText('0평')
  await expect(rights).not.toContainText('9.4582')
})

test('포함 여부가 불명확한 제시외가 있으면 건물 합계를 소계로 구분한다', async ({ page, request }) => {
  const response = await request.get(`${apiURL}/api/v1/goods/4`)
  const { sale_areas: areas } = await response.json()
  expect(areas.main_building.sqm).toBe(115.26)
  expect(areas.listed_total).toMatchObject({ sqm: null, pyeong: null, status: 'partial' })
  expect(areas.listed_total.known_sqm).toBe(115.26)
  await page.goto('/goods/4')
  const section = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await section.getByText('면적 구분별 보기', { exact: true }).click()
  const total = section.getByRole('row', { name: /^건물·제시외 포함 합계/ })
  await expect(total).toContainText('확인된 소계')
  await expect(total).toContainText('115.26㎡')
  await expect(total).toContainText('원문 확인 필요')
})

test('기수집 면적이 없거나 구버전 API이면 빈 상태를 안내한다', async ({ page, request }) => {
  const response = await request.get(`${apiURL}/api/v1/goods/5`)
  const detail = await response.json()
  expect(detail.sale_areas.available).toBe(false)
  expect(detail.sale_areas.land.pyeong).toBeNull()
  await page.goto('/goods/5')
  await expect(page.getByText('아직 수집된 매각목록 면적이 없습니다.')).toBeVisible()
  await page.route('**/api/v1/goods/5', async route => {
    const response = await route.fetch()
    const oldDetail = await response.json()
    delete oldDetail.sale_areas
    await route.fulfill({ response, json: oldDetail })
  })
  await page.reload()
  await expect(page.getByText('아직 수집된 매각목록 면적이 없습니다.')).toBeVisible()
})

test('없는 물건은 404와 재시도 안내를 표시한다', async ({ page, request }) => {
  expect((await request.get(`${apiURL}/api/v1/goods/99999`)).status()).toBe(404)
  await page.goto('/goods/99999')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '상세 다시 시도' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('region', { name: '매각목록 면적', exact: true })).toHaveCount(0)
})

test('모바일에서도 평수와 구분표를 가로 넘침 없이 읽는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/goods/1')
  const section = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await section.getByText('면적 구분별 보기', { exact: true }).click()
  await expect(section.getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('sale-areas-mobile.png') })
})
