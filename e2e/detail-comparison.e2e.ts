import { expect, test, type Page } from '@playwright/test'

const apiURL = 'http://127.0.0.1:8198'

// 보이는 섹션 제목으로 범위를 좁혀 다른 카드의 같은 숫자와 혼동하지 않는다.
function section(page: Page, name: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) })
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${apiURL}/__detail_comparison/reset`)
  await page.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname
    return ['127.0.0.1', 'localhost'].includes(host) ? route.fallback() : route.abort()
  })
})

test('매각결정기일보다 실제 다음 매각기일과 그 최저가·보증금을 우선 표시한다', async ({ page, request }) => {
  const dates = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  const response = await request.get(`${apiURL}/api/v1/goods/1`)
  expect(response.status()).toBe(200)
  const detail = await response.json()
  expect(detail.summary).toMatchObject({
    sale_date: dates.future, sale_schedule_status: 'upcoming', sale_date_source: 'hearing',
    lowest_sale_price: 240_000_000, bid_deposit_amount: 24_000_000,
  })
  await page.goto('/goods/1')
  const dateCard = page.getByText('다음 매각기일', { exact: true }).locator('..')
  await expect(dateCard).toContainText(dates.future)
  await expect(dateCard).not.toContainText(dates.decision)
  await expect(page.getByText('최저매각가격', { exact: true }).locator('..')).toContainText('240,000,000원')
  await expect(page.getByText('입찰보증금', { exact: true }).locator('..')).toContainText('24,000,000원')
  const hearings = section(page, '매각기일 이력')
  await hearings.scrollIntoViewIfNeeded()
  await expect(hearings.getByRole('row').filter({ hasText: dates.decision })).toContainText('매각결정기일')
})

test('과거 매각기일만 있으면 당시 조건으로 구분하고 결정기일만 있으면 미확인이다', async ({ page, request }) => {
  const dates = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  const past = await (await request.get(`${apiURL}/api/v1/goods/3`)).json()
  expect(past.summary).toMatchObject({ sale_date: dates.past, sale_schedule_status: 'past', lowest_sale_price: 300_000_000 })
  await page.goto('/goods/3')
  await expect(page.getByText('최근 매각기일', { exact: true }).locator('..')).toContainText(dates.past)
  await expect(page.getByText('당시 최저매각가격', { exact: true }).locator('..')).toContainText('300,000,000원')
  await expect(page.getByText('당시 입찰보증금', { exact: true }).locator('..')).toContainText('30,000,000원')
  await expect(page.getByText('과거 매각기일의 조건입니다.', { exact: false })).toBeVisible()

  const unknown = await (await request.get(`${apiURL}/api/v1/goods/2`)).json()
  expect(unknown.summary).toMatchObject({
    sale_date: null, sale_schedule_status: 'unconfirmed', sale_date_source: null,
    lowest_sale_price: null, bid_deposit_amount: null,
  })
  await page.goto('/goods/2')
  await expect(page.getByText('다음 매각기일', { exact: true }).locator('..')).toContainText('미확인')
  await expect(page.getByText('다음 매각기일과 입찰 조건을 확인할 수 없습니다.')).toBeVisible()
  await expect(page.getByText('최저매각가격', { exact: true }).locator('..')).not.toContainText('500,000,000')
})

test('저장된 12개 목록의 개별 면적·지분·제시외 포함을 실제 표에서 읽는다', async ({ page, request }, testInfo) => {
  const detail = await (await request.get(`${apiURL}/api/v1/goods/1`)).json()
  expect(detail.sale_areas.components).toHaveLength(12)
  await page.goto('/goods/1')
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  const table = areas.getByRole('table', { name: '목록별 면적·지분', exact: true })
  await expect(table.getByRole('row')).toHaveCount(13)
  await expect(table.getByRole('columnheader', { name: '공부면적' })).toBeVisible()
  await expect(table).toContainText('58.41㎡')
  await expect(table).toContainText('125.5㎡')
  await expect(table).toContainText('지1층')
  await expect(table).toContainText('창고')
  await expect(table).toContainText('전체 (1/1)')
  await expect(table).toContainText('제시외 시설')
  await expect(table).toContainText('포함')
  await table.screenshot({ path: testInfo.outputPath('detail-components.png') })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  await expect(table).not.toBeVisible()
})

test('부분 지분·매각 제외·지분 미확인을 서로 다른 값으로 표시한다', async ({ page, request }) => {
  const detail = await (await request.get(`${apiURL}/api/v1/goods/3`)).json()
  expect(detail.sale_areas.components.find((row: { object_sequence: number }) => row.object_sequence === 1))
    .toMatchObject({ area_sqm: 100, share_numerator: 1, share_denominator: 4, sale_area_sqm: 25 })
  await page.goto('/goods/3')
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  const table = areas.getByRole('table', { name: '목록별 면적·지분', exact: true })
  const share = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '목록 1', exact: true }) })
  await expect(share).toContainText('1/4')
  await expect(share).toContainText('25㎡ (7.56평)')
  const excluded = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '목록 2', exact: true }) })
  await expect(excluded).toContainText('20㎡')
  await expect(excluded).toContainText('매각 제외')
  const unknown = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '목록 3', exact: true }) })
  await expect(unknown.getByRole('cell').nth(2)).toHaveText('미확인')
  await expect(unknown.getByRole('cell').nth(3)).toHaveText('미확인')
  await expect(unknown).not.toContainText('0평')
})

test('권리 미확인과 명시된 없음을 구분하고 임차인의 배당요구일을 보여준다', async ({ page }) => {
  await page.goto('/goods/1')
  const risks = section(page, '권리·특수조건 주의사항')
  await risks.scrollIntoViewIfNeeded()
  await expect(risks.getByRole('article').filter({ has: page.getByRole('heading', { name: '특별매각조건', exact: true }) })).toContainText('해당 사항 없음')
  await expect(risks.getByRole('article').filter({ has: page.getByRole('heading', { name: '소멸되지 않는 등기부권리', exact: true }) })).toContainText('미확인')
  await expect(risks).toContainText('보증금 잔액을 매수인이 인수할 수 있음')
  const tenants = section(page, '임차인 현황')
  await tenants.scrollIntoViewIfNeeded()
  await expect(tenants).toContainText('배당요구일')
  await expect(tenants).toContainText('2026-01-15')
  await expect(tenants).toContainText('수집된 점유·임대차 항목')
  await expect(tenants).not.toContainText('임차인 수')

  await page.goto('/goods/2')
  const emptyTenants = section(page, '임차인 현황')
  await emptyTenants.scrollIntoViewIfNeeded()
  await expect(emptyTenants).toContainText('임차인이 없다는 뜻은 아닙니다.')
  await expect(emptyTenants).not.toContainText('0명')
  await expect(section(page, '등기부 권리')).toContainText('권리가 없다는 뜻은 아닙니다.')
})

test('지도·로드뷰는 클릭할 때 연결하고 문서 자동 읽기나 사진 전체 선로딩을 하지 않는다', async ({ page, context, request }) => {
  const externalRequests: string[] = []
  const photoRequests: string[] = []
  page.on('request', req => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(req.url()).hostname)) externalRequests.push(req.url())
    if (/\/photos\//.test(req.url())) photoRequests.push(new URL(req.url()).pathname)
  })
  const detail = await (await request.get(`${apiURL}/api/v1/goods/1`)).json()
  expect(detail.location.latitude).toBeGreaterThan(33)
  expect(detail.location.longitude).toBeGreaterThan(124)
  expect(detail.documents.items).toHaveLength(1)
  expect(detail.photos.items).toHaveLength(12)
  await page.goto('/goods/1')
  const location = page.getByRole('region', { name: '위치 확인', exact: true })
  const map = location.getByRole('link', { name: '지도 보기', exact: true })
  const roadview = location.getByRole('link', { name: '로드뷰 보기', exact: true })
  await expect(map).toHaveAttribute('href', `https://map.kakao.com/link/map/${detail.location.latitude},${detail.location.longitude}`)
  await expect(roadview).toHaveAttribute('href', `https://map.kakao.com/link/roadview/${detail.location.latitude},${detail.location.longitude}`)
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  await location.scrollIntoViewIfNeeded()
  await page.waitForLoadState('networkidle')
  expect(externalRequests).toEqual([])
  const reads = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  expect(reads.document_reads).toBe(0)
  // 브라우저의 기존 지연 로딩은 화면 근처의 첫 3장만 허용한다.
  expect(reads.photo_reads).toBeLessThanOrEqual(3)
  const allowedPhotoPaths = detail.photos.items.slice(0, 3).map((photo: { content_url: string }) => new URL(photo.content_url, apiURL).pathname)
  expect(photoRequests.every(path => allowedPhotoPaths.includes(path))).toBe(true)
  await expect(page.getByRole('region', { name: '물건 사진 목록' }).getByRole('img')).toHaveCount(3)
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  await page.waitForLoadState('networkidle')
  const afterToggle = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  expect(afterToggle.document_reads).toBe(0)
  expect(afterToggle.photo_reads).toBe(reads.photo_reads)
  // 외부 지도는 가짜 페이지로 대체한 뒤 실제 새 창 클릭까지 검증한다.
  await context.route('https://map.kakao.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>격리 지도 링크 확인</h1>' }))
  const popupPromise = page.waitForEvent('popup')
  await map.click()
  const popup = await popupPromise
  await expect(popup.getByRole('heading', { name: '격리 지도 링크 확인' })).toBeVisible()
  await popup.close()
  await page.goto('/goods/2')
  const missing = page.getByRole('region', { name: '위치 확인', exact: true })
  await missing.scrollIntoViewIfNeeded()
  await expect(missing).toContainText('위치 좌표가 확인되지 않아')
  await expect(missing.getByRole('link')).toHaveCount(0)
})

test('모바일에서 목록표만 가로 스크롤되고 페이지 너비는 넘치지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/goods/1')
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  const scroller = areas.getByRole('region', { name: '목록별 면적·지분 표 가로 스크롤' })
  await expect(scroller).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await scroller.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await scroller.focus()
  await page.keyboard.press('End')
  await areas.screenshot({ path: testInfo.outputPath('detail-components-mobile.png') })
})

test('상세 로딩 실패 후 재시도로 저장 데이터 표시를 복구한다', async ({ page }) => {
  let failed = false
  await page.route('**/api/v1/goods/1', async route => {
    if (!failed) {
      failed = true
      return route.fulfill({ status: 503, json: { detail: '격리 테스트 일시 장애' } })
    }
    return route.fallback()
  })
  await page.goto('/goods/1')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '상세 다시 시도' }).click()
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  await areas.getByText('목록별 면적·지분', { exact: true }).click()
  await expect(areas.getByRole('table', { name: '목록별 면적·지분', exact: true }).getByRole('row')).toHaveCount(13)
})
