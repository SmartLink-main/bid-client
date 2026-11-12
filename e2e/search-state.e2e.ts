import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'
import type { AuctionGoodsSearchItem } from '../src/lib/auction'

// 기존 sidebar 검색 검사처럼 작은 전체 결과에 조건과 페이지를 적용한다.
const goods: AuctionGoodsSearchItem[] = Array.from({ length: 4 }, (_, index) => ({
  auction_goods_id: 9101 + index, schedule_id: `search-state-${index}`,
  case_number: `2099타경${index + 1}`, disposal_goods_sequence: 1,
  court_name: '서울중앙지방법원', branch_name: '서울중앙',
  goods_usage_name: index % 2 === 0 ? '아파트' : '오피스텔', goods_status_name: '매각공고',
  building_name: `도곡동 검색 물건 ${index + 1}`,
  printed_address: '서울특별시 강남구 도곡동 1',
  auction_date: '2099-01-01', auction_time: '10:30:00',
  appraisal_amount: 300_000_000, first_announcement_lowest_sale_price: 240_000_000,
}))

function searchResponse(url: URL) {
  const query = url.searchParams.get('q') ?? ''
  const region = url.searchParams.get('region') ?? ''
  const usages = url.searchParams.getAll('goods_usage')
  const filtered = goods.filter((item) => (
    (!query || item.case_number === query || item.printed_address?.includes(query)) &&
    (!region || item.printed_address?.includes(region)) &&
    (!usages.length || usages.includes(item.goods_usage_name ?? ''))
  ))
  if (url.searchParams.get('sort_by') === 'case_new') filtered.reverse()
  const limit = Number(url.searchParams.get('limit') ?? 50)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return { total: filtered.length, limit, offset, items: filtered.slice(offset, offset + limit) }
}

async function prepareApi(
  context: BrowserContext,
  respondToSearch?: (route: Route, url: URL) => Promise<void>,
) {
  const pageErrors: string[] = []
  const observeErrors = (page: Page) => page.on('pageerror', error => pageErrors.push(error.message))
  context.pages().forEach(observeErrors)
  context.on('page', observeErrors)
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname
    return ['127.0.0.1', 'localhost', '[::1]'].includes(host) ? route.fallback() : route.abort()
  })
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/refresh') {
      return route.fulfill({ status: 401, json: { detail: 'Anonymous local test.' } })
    }
    if (url.pathname === '/api/v1/search') {
      // 용도 집계의 별도 요청에는 검색 상태 오류를 주입하지 않는다.
      if (respondToSearch && url.searchParams.get('limit') !== '100') {
        return respondToSearch(route, url)
      }
      return route.fulfill({ json: searchResponse(url) })
    }
    if (/^\/api\/v1\/goods\/\d+\/comments$/.test(url.pathname)) {
      return route.fulfill({ json: { total: 0, limit: 20, offset: 0, items: [] } })
    }
    const match = url.pathname.match(/^\/api\/v1\/goods\/(\d+)$/)
    const item = match && goods.find(good => good.auction_goods_id === Number(match[1]))
    if (item) {
      // 기존 검색 카드의 최소 상세 응답에 탐색 화면에 필요한 요약만 더한다.
      return route.fulfill({ json: {
        auction_goods_id: item.auction_goods_id, case_display_number: item.case_number,
        summary: { title: item.building_name, address: item.printed_address },
        photos: { items: [] }, unsupported_sections: [],
      } })
    }
    return route.fulfill({ status: 404, json: { detail: 'Unexpected local request.' } })
  })
  return pageErrors
}

function responseGate() {
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  return { wait, release }
}

function primarySearch(page: Page, query: string) {
  return page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/search' && url.searchParams.get('q') === query &&
      url.searchParams.get('limit') !== '100'
  })
}

test('검색 로딩·오류를 0건과 구분하고 재검색 중 이전 무결과를 숨긴다', async ({ page, context }, testInfo) => {
  const query = '2099타경1'
  const initial = responseGate()
  const repeated = responseGate()
  let attempts = 0
  const pageErrors = await prepareApi(context, async (route, url) => {
    if (url.searchParams.get('q') === query) {
      attempts += 1
      if (attempts === 1) {
        await initial.wait
        return route.fulfill({ status: 500, json: { detail: '격리 검증용 일시 검색 오류' } })
      }
      if (attempts === 3) await repeated.wait
    }
    await route.fulfill({ json: searchResponse(url) })
  })
  await page.addInitScript(nonemptyQuery => {
    const state = window as Window & { loadingZeroViolations: string[] }
    state.loadingZeroViolations = []
    let scheduled = false
    const inspect = () => {
      scheduled = false
      if (location.pathname !== '/search') return
      const loading = [...document.querySelectorAll('[role="status"]')]
        .some(node => node.textContent?.includes('검색 결과를 불러오는 중'))
      const query = new URLSearchParams(location.search).get('q')
      const text = document.body?.innerText ?? ''
      const empty = text.includes('현재 조건에서 0개의 물건이 검색되었습니다.') ||
        text.includes('조건에 맞는 물건이 없습니다.')
      if (empty && (loading || query === nonemptyQuery)) {
        state.loadingZeroViolations.push(location.href)
      }
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(inspect)
    }
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true, characterData: true })
    // URL만 먼저 바뀌고 React가 아직 이전 0건 화면을 그리는 첫 프레임도 검사한다.
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method]
      history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args)
        schedule()
        return result
      }
    }
    addEventListener('DOMContentLoaded', schedule)
    addEventListener('popstate', schedule)
  }, query)
  const zero = page.getByText('현재 조건에서 0개의 물건이 검색되었습니다.', { exact: true })
  const empty = page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })
  const loading = page.getByRole('status').filter({ hasText: '검색 결과를 불러오는 중' })
  const failed = primarySearch(page, query)
  try {
    await page.goto('/search?q=' + encodeURIComponent(query))
    await expect(loading).toBeVisible()
    await expect(zero).toHaveCount(0)
    await expect(empty).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('search-loading-without-zero.png') })
  } finally {
    initial.release()
  }
  expect((await failed).status()).toBe(500)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText('검색 결과를 불러오지 못했습니다.', { exact: true })).toBeVisible()
  await expect(zero).toHaveCount(0)
  await expect(empty).toHaveCount(0)

  const retried = primarySearch(page, query)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  expect((await retried).status()).toBe(200)
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article')).toContainText(query)
  await expect(page.getByRole('alert')).toHaveCount(0)

  const input = page.getByLabel('경매 물건 검색어', { exact: true })
  const emptyQuery = '상태검증무결과전용표식'
  const noResults = primarySearch(page, emptyQuery)
  await input.fill(emptyQuery)
  await input.press('Enter')
  const emptyResponse = await noResults
  expect(emptyResponse.status()).toBe(200)
  expect(await emptyResponse.json()).toMatchObject({ total: 0, items: [] })
  await expect(zero).toBeVisible()
  await expect(empty).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)

  const recovered = primarySearch(page, query)
  try {
    await input.fill(query)
    await input.press('Enter')
    await expect(loading).toBeVisible()
    await expect(zero).toHaveCount(0)
    await expect(empty).toHaveCount(0)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
  } finally {
    repeated.release()
  }
  expect((await recovered).status()).toBe(200)
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByText('현재 조건에서 1개의 물건이 검색되었습니다.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { loadingZeroViolations: string[] }).loadingZeroViolations)).toEqual([])
  expect(pageErrors).toEqual([])
})

test('상세 새로고침과 새 탭 뒤 검색 조건·정렬·두 번째 페이지를 복구한다', async ({ page, context }, testInfo) => {
  const pageErrors = await prepareApi(context)
  const params = new URLSearchParams([
    ['q', '도곡동'], ['region', '서울특별시 강남구'],
    ['goods_usage', '아파트'], ['goods_usage', '오피스텔'],
    ['sort_by', 'case_new'], ['limit', '2'], ['offset', '0'],
  ])
  const shownIds = (target: Page) => target.getByRole('article')
    .getByRole('link', { name: '상세보기', exact: true }).evaluateAll(links => (
      links.map(link => Number(new URL(link.getAttribute('href')!, location.origin).pathname.split('/').at(-1)))
    ))
  await page.goto('/search?' + params.toString())
  await expect(page.getByText('1 / 2 페이지', { exact: true })).toBeVisible()
  expect(await shownIds(page)).toEqual([9104, 9103])
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect(page.getByText('2 / 2 페이지', { exact: true })).toBeVisible()
  expect(await shownIds(page)).toEqual([9102, 9101])
  const originalUrl = page.url()
  const returnTo = new URL(originalUrl).pathname + new URL(originalUrl).search
  const assertRestored = async (target: Page) => {
    await expect(target).toHaveURL(originalUrl)
    await expect(target.getByLabel('경매 물건 검색어', { exact: true })).toHaveValue('도곡동')
    await expect(target.getByLabel('검색 결과 정렬 기준', { exact: true })).toHaveValue('case_new')
    await expect(target.getByText('지역: 서울특별시 강남구', { exact: true })).toBeVisible()
    await expect(target.getByText('종류: 아파트', { exact: true })).toBeVisible()
    await expect(target.getByText('종류: 오피스텔', { exact: true })).toBeVisible()
    expect(new URL(target.url()).searchParams.getAll('goods_usage')).toEqual(['아파트', '오피스텔'])
    expect(new URL(target.url()).searchParams.get('limit')).toBe('2')
    expect(new URL(target.url()).searchParams.get('offset')).toBe('2')
    await expect(target.getByText('2 / 2 페이지', { exact: true })).toBeVisible()
    await expect(target.getByRole('article')).toHaveCount(2)
    expect(await shownIds(target)).toEqual([9102, 9101])
  }

  await page.getByRole('article').first().getByRole('link', { name: '상세보기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '사건 기본정보', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '사건 기본정보', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '검색 결과로', exact: true })).toHaveAttribute('href', returnTo)
  await page.getByRole('link', { name: '검색 결과로', exact: true }).click()
  await assertRestored(page)
  await page.screenshot({ path: testInfo.outputPath('search-restored-after-detail-reload.png') })

  const opened = context.waitForEvent('page')
  await page.getByRole('article').first().getByRole('link', { name: '상세보기', exact: true }).click({ button: 'middle' })
  const detailTab = await opened
  await expect(detailTab.getByRole('heading', { name: '사건 기본정보', exact: true })).toBeVisible()
  await expect(detailTab.getByRole('link', { name: '검색 결과로', exact: true })).toHaveAttribute('href', returnTo)
  await detailTab.getByRole('link', { name: '검색 결과로', exact: true }).click()
  await assertRestored(detailTab)
  await detailTab.close()

  await page.goto('/goods/9102')
  await expect(page.getByRole('heading', { name: '사건 기본정보', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '검색 결과로', exact: true })).toHaveAttribute('href', '/search')
  await page.getByRole('link', { name: '검색 결과로', exact: true }).click()
  await expect(page).toHaveURL(new URL('/search', originalUrl).href)
  await expect(page.getByRole('heading', { name: '검색 결과', exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})
