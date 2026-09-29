import { performance } from 'node:perf_hooks'
import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test'

type SearchItem = {
  auction_goods_id: number
  auction_date: string | null
  building_name: string | null
  printed_address: string | null
}

type SearchResponse = { total: number; limit: number; offset: number; items: SearchItem[] }

const responseBudgetMs = 3_000
const firstPerformanceId = 2_000_000
const performanceGoodsCount = 20_000

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      await route.abort('blockedbyclient')
    } else if (url.pathname === '/api/v1/refresh') {
      await route.fulfill({ status: 401, json: { detail: 'Anonymous local test.' } })
    } else {
      await route.continue()
    }
  })
})

function waitForSearch(page: Page) {
  return page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/search' &&
    response.request().method() === 'GET'
  ))
}

async function openProvince(page: Page, province: string) {
  await page.goto('/region-search')
  await page.getByRole('button', { name: province, exact: true }).click()
}

async function selectCity(page: Page, city: string): Promise<Response> {
  const pending = waitForSearch(page)
  await page.getByRole('button', { name: city, exact: true }).click()
  return pending
}

function expectCurrentItems(payload: SearchResponse) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  expect(payload.items.every((item) => item.auction_date && item.auction_date >= today)).toBe(true)
}

async function measureCitySearch(page: Page, testInfo: TestInfo, phase: string) {
  const startedAt = performance.now()
  const response = await selectCity(page, '창원시')
  await response.finished()
  const responseMs = performance.now() - startedAt
  expect(response.status()).toBe(200)
  const payload = await response.json() as SearchResponse
  await expect(page.getByRole('article')).toHaveCount(50)
  const renderedMs = performance.now() - startedAt
  const timing = response.request().timing()
  await testInfo.attach(`region-search-${phase}.json`, {
    body: JSON.stringify({
      phase,
      syntheticGoods: performanceGoodsCount,
      total: payload.total,
      responseMs,
      renderedMs,
      requestMs: timing.responseEnd - timing.requestStart,
      budgetMs: responseBudgetMs,
    }, null, 2),
    contentType: 'application/json',
  })
  expect(responseMs, `${phase} city click to complete API response`).toBeLessThan(responseBudgetMs)
  expect(renderedMs, `${phase} city click to visible first page`).toBeLessThan(responseBudgetMs)
  expect(payload).toMatchObject({ total: 5_000, limit: 50, offset: 0 })
  expect(payload.items.every((item) => (
    item.auction_goods_id >= firstPerformanceId &&
    item.auction_goods_id < firstPerformanceId + performanceGoodsCount &&
    (item.auction_goods_id - firstPerformanceId) % 4 === 1 &&
    item.printed_address?.startsWith('경상남도 창원시 의창구 ')
  ))).toBe(true)
  expectCurrentItems(payload)
}

test('2만 건에서 상위 시 최초 검색과 재검색의 첫 화면이 각각 3초 안에 표시된다', async ({ page }, testInfo) => {
  await openProvince(page, '경남')
  await measureCitySearch(page, testInfo, 'cold')
  await page.goBack()
  await page.getByRole('button', { name: '경남', exact: true }).click()
  await measureCitySearch(page, testInfo, 'warm')
})

test('수원시 검색은 지난 일정을 제외하며 시도를 바꾸면 창원시 결과로 전환한다', async ({ page }) => {
  await openProvince(page, '경기')
  const suwon = await selectCity(page, '수원시')
  expect(suwon.status()).toBe(200)
  const suwonPayload = await suwon.json() as SearchResponse
  expect(suwonPayload.total).toBeGreaterThanOrEqual(5_000)
  expectCurrentItems(suwonPayload)
  expect(suwonPayload.items.every((item) => (
    item.auction_goods_id >= firstPerformanceId &&
    (item.auction_goods_id - firstPerformanceId) % 4 === 0
  ))).toBe(true)
  await expect(page.getByRole('article')).toHaveCount(50)

  await page.goBack()
  await page.getByRole('button', { name: '경남', exact: true }).click()
  await expect(page.getByRole('button', { name: '수원시', exact: true })).toHaveCount(0)
  const changwon = await selectCity(page, '창원시')
  expect(changwon.status()).toBe(200)
  const changwonPayload = await changwon.json() as SearchResponse
  expect(changwonPayload.total).toBe(5_000)
  expect(changwonPayload.items.every((item) => (
    item.printed_address?.startsWith('경상남도 창원시 의창구 ')
  ))).toBe(true)
  await expect(page.getByText('시/도: 경상남도', { exact: true })).toBeVisible()
  await expect(page.getByText('시/군/구: 창원시', { exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(50)
  await expect(page.getByRole('article').filter({ hasText: '수원시' })).toHaveCount(0)
})

test('성남시 상위 행 없이 수정구와 분당구의 현재 물건을 빠짐없이 표시한다', async ({ page }) => {
  await openProvince(page, '경기')
  const response = await selectCity(page, '성남시')
  expect(response.status()).toBe(200)
  const payload = await response.json() as SearchResponse
  expect(payload.total).toBe(2)
  expect(payload.items.map((item) => item.auction_goods_id).sort()).toEqual([120001, 120002])
  expectCurrentItems(payload)
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByText('상위시 검증 수정구 현재', { exact: true })).toBeVisible()
  await expect(page.getByText('상위시 검증 분당구 예정', { exact: true })).toBeVisible()
  await expect(page.getByText('상위시 검증 분당구 과거', { exact: true })).toHaveCount(0)
  await expect(page.getByText('상위시 검증 용인시 현재', { exact: true })).toHaveCount(0)
})

test('일치하는 지역 물건이 없으면 다른 지역 대신 빈 결과를 표시한다', async ({ page }) => {
  await openProvince(page, '강원')
  const response = await selectCity(page, '화천군')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ total: 0, items: [] })
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  await expect(page.getByText('시/군/구: 화천군', { exact: true })).toBeVisible()
})

test('지역 검색 실패를 표시하고 재시도하면 동일 지역의 실제 결과를 복구한다', async ({ page }) => {
  await page.route('**/api/v1/search?**', (route) => route.fulfill({
    status: 503,
    headers: {
      'Access-Control-Allow-Origin': new URL(page.url()).origin,
      'Access-Control-Allow-Credentials': 'true',
    },
    json: { detail: 'Unavailable' },
  }), { times: 1 })
  await openProvince(page, '제주')
  const failed = await selectCity(page, '제주시')
  expect(failed.status()).toBe(503)
  await expect(page.getByRole('alert')).toContainText('서버 오류가 발생했습니다.')
  await expect(page.getByRole('article')).toHaveCount(0)
  const pending = waitForSearch(page)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  const retried = await pending
  expect(retried.status()).toBe(200)
  const query = new URL(retried.url()).searchParams
  expect(query.get('sido')).toBe('제주특별자치도')
  expect(query.get('sigungu')).toBe('제주시')
  const payload = await retried.json() as SearchResponse
  expect(payload.items.map((item) => item.auction_goods_id).sort()).toEqual([110001, 110002, 110005, 110006])
  expectCurrentItems(payload)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(4)
})
