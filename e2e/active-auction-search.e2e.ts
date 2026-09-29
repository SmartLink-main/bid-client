import { expect, test, type Page, type Response } from '@playwright/test'

type SearchResponse = {
  total: number
  items: Array<{ auction_goods_id: number; auction_date: string | null }>
}

const activeIds = [110001, 110002, 110005, 110006]
const halfPriceIds = [110001, 110002, 110006]

function goodsLink(page: Page, goodsId: number) {
  return page.getByRole('article').locator(`a[href="/goods/${goodsId}"]`)
}

function koreanAuctionDate(dayOffset = 0) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(Date.now() + dayOffset * 86_400_000))
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      await route.abort('blockedbyclient')
      return
    }
    if (url.pathname === '/api/v1/refresh') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'E2E anonymous session.' }),
      })
      return
    }
    await route.continue()
  })
})

function waitForSearch(page: Page, pathname = '/api/v1/search') {
  return page.waitForResponse((response) => (
    new URL(response.url()).pathname === pathname &&
    response.request().method() === 'GET'
  ))
}

async function expectActiveResults(
  page: Page,
  response: Response,
  ids: number[] = activeIds,
) {
  expect(response.status()).toBe(200)
  const payload = await response.json() as SearchResponse
  expect(payload.total).toBe(ids.length)
  expect(payload.items.map((item) => item.auction_goods_id).sort()).toEqual(ids)
  const today = koreanAuctionDate()
  expect(payload.items.find((item) => item.auction_goods_id === 110001)?.auction_date)
    .toBe(today)
  expect(payload.items.every((item) => item.auction_date && item.auction_date >= today))
    .toBe(true)
  await expect(page.getByRole('article')).toHaveCount(ids.length)
  await expect(goodsLink(page, 110001)).toBeVisible()
  await expect(goodsLink(page, 110002)).toBeVisible()
  await expect(goodsLink(page, 110006)).toBeVisible()
  await expect(goodsLink(page, 110003)).toHaveCount(0)
  await expect(goodsLink(page, 110004)).toHaveCount(0)
}

test('법원 검색은 오늘과 미래 일정만 표시하고 과거 일정 및 무일정 물건을 제외한다', async ({ page }) => {
  await page.goto('/court-search')
  const responsePromise = waitForSearch(page)
  await page.getByRole('button', { name: '제주', exact: true }).click()
  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' && url.searchParams.get('branch_name') === '제주'
  ))
  await expectActiveResults(page, await responsePromise)
})

test('지역 검색은 선택 지역의 현재 일정 물건만 표시한다', async ({ page }) => {
  await page.goto('/region-search')
  await page.getByRole('button', { name: '제주', exact: true }).click()
  const responsePromise = waitForSearch(page)
  await page.getByRole('button', { name: '제주시', exact: true }).click()
  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' && url.searchParams.get('sigungu') === '제주시'
  ))
  await expectActiveResults(page, await responsePromise)
})

test('상위 시 행 없이 하위 구만 등록돼도 시 전체의 현재 물건을 검색한다', async ({ page }) => {
  await page.goto('/region-search')
  await page.getByRole('button', { name: '경기', exact: true }).click()
  const pending = waitForSearch(page)
  await page.getByRole('button', { name: '성남시', exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  const payload = await response.json() as SearchResponse
  expect(payload.items.map((item) => item.auction_goods_id).sort()).toEqual([120001, 120002])
  expect(payload.total).toBe(2)
  expect(payload.items.every((item) => item.auction_date && item.auction_date >= koreanAuctionDate())).toBe(true)
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(goodsLink(page, 120001)).toBeVisible()
  await expect(goodsLink(page, 120002)).toBeVisible()
  await expect(goodsLink(page, 120003)).toHaveCount(0)
  await expect(goodsLink(page, 120004)).toHaveCount(0)
})

test('반값검색에서 현재 일정과 감정가 대비 50% 이하 조건을 함께 적용한다', async ({ page }) => {
  await page.goto('/court-search')
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  const initialResponsePromise = waitForSearch(page)
  await page.getByRole('link', { name: '반값검색', exact: true }).click()
  expect((await initialResponsePromise).status()).toBe(200)
  await expect(page).toHaveURL((url) => url.searchParams.get('half_price') === 'true')
  const responsePromise = waitForSearch(page)
  await page.getByLabel('경매 물건 검색어').fill('현재일정')
  await page.getByLabel('경매 물건 검색어').press('Enter')
  await expectActiveResults(page, await responsePromise, halfPriceIds)
  await expect(goodsLink(page, 110005)).toHaveCount(0)
})

test('일반 검색어에 일치해도 지난 일정이나 일정 없는 물건만 있으면 빈 결과를 표시한다', async ({ page }) => {
  const initialResponsePromise = waitForSearch(page)
  await page.goto('/search')
  expect((await initialResponsePromise).status()).toBe(200)
  for (const keyword of ['현재일정 지난', '현재일정 미등록']) {
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/search' &&
        response.request().method() === 'GET' &&
        url.searchParams.get('q') === keyword &&
        url.searchParams.get('limit') === '50'
    })
    await page.getByLabel('경매 물건 검색어').fill(keyword)
    await page.getByLabel('경매 물건 검색어').press('Enter')
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ total: 0, items: [] })
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  }
})

test('상세조건검색은 지난 일정도 조회하며 입력한 날짜 범위를 적용한다', async ({ page }) => {
  await page.goto('/advanced-search')
  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '제주지방법원' })
  const responsePromise = waitForSearch(page, '/api/v1/search/comprehensive')
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  const payload = await response.json() as SearchResponse
  expect(payload.total).toBe(6)
  expect(payload.items.map((item) => item.auction_goods_id).sort())
    .toEqual([110001, 110002, 110003, 110005, 110006, 110006])
  expect(payload.items.some((item) => item.auction_date === koreanAuctionDate(-1)))
    .toBe(true)
  await expect(page.getByRole('article')).toHaveCount(6)
  await expect(goodsLink(page, 110003)).toBeVisible()
  await expect(goodsLink(page, 110001)).toBeVisible()
  await expect(goodsLink(page, 110002)).toBeVisible()
  await expect(goodsLink(page, 110006)).toHaveCount(2)
  await expect(goodsLink(page, 110004)).toHaveCount(0)

  await page.goto('/advanced-search')
  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '제주지방법원' })
  await page.getByLabel('매각기일 시작일', { exact: true }).fill(koreanAuctionDate(-1))
  await page.getByLabel('매각기일 종료일', { exact: true }).fill(koreanAuctionDate(-1))
  const pastResponsePromise = waitForSearch(page, '/api/v1/search/comprehensive')
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()
  const pastResponse = await pastResponsePromise
  expect(pastResponse.status()).toBe(200)
  const pastPayload = await pastResponse.json() as SearchResponse
  expect(pastPayload.total).toBe(2)
  expect(pastPayload.items.map((item) => item.auction_goods_id).sort())
    .toEqual([110003, 110006])
  expect(pastPayload.items.every((item) => item.auction_date === koreanAuctionDate(-1)))
    .toBe(true)
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(goodsLink(page, 110003)).toBeVisible()
  await expect(goodsLink(page, 110006)).toBeVisible()
  await expect(goodsLink(page, 110001)).toHaveCount(0)
  await expect(goodsLink(page, 110002)).toHaveCount(0)
  await expect(goodsLink(page, 110004)).toHaveCount(0)
})
