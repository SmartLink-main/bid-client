import { expect, test, type Page } from '@playwright/test'
import type { AuctionGoodsSearchItem } from '../src/lib/auction'

// 전체 데이터에 필터·페이지를 적용하는 가짜 API로 집계 범위와 실제 클릭을 검증한다.
async function prepareUsageResults(page: Page, usages: Array<string | null> = ['아파트', '상가', '상가,오피스텔,근린시설', null]) {
  const requests: URL[] = []
  const items: AuctionGoodsSearchItem[] = usages.map((usage, index) => ({
    auction_goods_id: 9100 + index, schedule_id: `usage-filter-${index}`,
    case_number: `2099타경${index + 1}`,
    disposal_goods_sequence: index + 1, court_name: '서울중앙지방법원', branch_name: '서울중앙',
    goods_usage_name: usage, goods_status_name: '매각공고', building_name: index === 3 ? null : `용도 확인 물건 ${index + 1}`,
    printed_address: '서울특별시 강남구 테헤란로 1', auction_date: '2099-01-01', auction_time: '10:30:00',
    auction_place: index % 2 === 0 ? '제1경매법정' : null,
    appraisal_amount: 300_000_000, first_announcement_lowest_sale_price: 240_000_000,
  }))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.fallback() : route.abort()
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    if (url.pathname === '/api/v1/refresh') return route.fulfill({ status: 401, json: { detail: 'Anonymous local test.' } })
    if (url.pathname === '/api/v1/search/special/types') return route.fulfill({ json: { items: ['유치권'] } })
    const goodsMatch = url.pathname.match(/^\/api\/v1\/goods\/(\d+)$/)
    if (goodsMatch) {
      const goods = items.find((item) => item.auction_goods_id === Number(goodsMatch[1]))
      if (goods) return route.fulfill({ json: { case_display_number: goods.case_number, photos: { items: [] } } })
    }
    if (['/api/v1/search', '/api/v1/search/special', '/api/v1/search/comprehensive'].includes(url.pathname)) {
      const selected = url.searchParams.getAll('goods_usage')
      const filtered = selected.length ? items.filter((item) => selected.includes(item.goods_usage_name ?? '')) : items
      const limit = Number(url.searchParams.get('limit') ?? 50)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      return route.fulfill({ json: { total: filtered.length, limit, offset, items: filtered.slice(offset, offset + limit) } })
    }
    return route.fulfill({ status: 404, json: { detail: 'Unexpected request.' } })
  })
  return { requests, items }
}

const filters = (page: Page) => page.getByRole('region', { name: '용도별 검색 필터' })

for (const mode of [
  { title: '법원', page: '/court-search', button: '서울중앙', api: '/api/v1/search' },
  { title: '특수물건', page: '/special-search', button: '유치권', api: '/api/v1/search/special' },
  { title: '상세조건', page: '/advanced-search', button: '종합검색 결과 보기', api: '/api/v1/search/comprehensive' },
]) {
  test(`용도별 건수 선택: ${mode.title} 조건을 유지하며 선택과 전체 복원을 한다`, async ({ page }) => {
    const { requests, items } = await prepareUsageResults(page)
    for (const item of items) {
      item.court_name = '서울'
      item.branch_name = '서울중앙지방법원'
      item.division_name = '경매21계'
    }
    await page.goto(mode.page)
    await page.getByRole('button', { name: mode.button, exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(page.getByRole('article').getByText('서울', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('article').getByText('/', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('article').getByText('서울중앙지방법원', { exact: true })).toHaveCount(4)
    await expect(page.getByRole('article').getByText('경매21계', { exact: true })).toHaveCount(4)
    await expect(page.getByRole('article').getByText(/^용도 확인 물건/)).toHaveCount(0)
    await expect(page.getByRole('article').getByText(/^물건\s*\d+$/)).toHaveCount(0)
    await expect(page.getByRole('article').getByText('매각공고', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('article').first().getByText('아파트', { exact: true })).toBeVisible()
    await expect(page.getByRole('article').first().getByText('1월 1일', { exact: true })).toBeVisible()
    await expect(page.getByRole('article').getByText(/2099-01-01|10:30/)).toHaveCount(0)
    await expect(page.getByRole('article').getByText(/제1경매법정|매각장소 미정/)).toHaveCount(0)
    const previous = new URL(page.url()).searchParams
    const facet = filters(page)
    await expect(facet.getByRole('button', { name: '전체 4건', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(facet.getByText('용도 미등록 1건', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: '용도', exact: true })).toHaveCount(0)
    // 네 건을 모두 받은 초기 응답은 추가 집계 요청 없이 재사용한다.
    expect(requests.filter((url) => url.pathname === mode.api)).toHaveLength(1)
    await facet.getByRole('button', { name: '아파트 1건', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: '2099타경1', exact: true })).toBeVisible()
    await expect(page.getByRole('article').getByRole('button', { name: /관심/ })).toHaveCount(0)
    await expect(page.getByRole('article').first().getByText('서울특별시 강남구 테헤란로 1', { exact: true })).toBeVisible()
    expect(requests.some((url) => url.pathname.startsWith('/api/v1/favorites'))).toBe(false)
    await expect(page.getByRole('article').getByText('사진 없음', { exact: true })).toBeVisible()
    await expect(facet.getByRole('button', { name: '아파트 1건', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(facet.getByRole('button', { name: '상가 1건', exact: true })).toBeVisible()
    const current = new URL(page.url()).searchParams
    expect(current.getAll('goods_usage')).toEqual(['아파트'])
    for (const key of previous.keys()) expect(current.getAll(key)).toEqual(previous.getAll(key))
    await facet.getByRole('button', { name: '전체 4건', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(4)
    expect(new URL(page.url()).searchParams.has('goods_usage')).toBe(false)
  })
}

test('누락된 면적은 빈 표시로, 실제 0은 0평으로 구분한다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, ['아파트', '대지'])
  items[0].land_area_pyeong = null
  items[0].building_area_pyeong = undefined
  items[1].land_area_pyeong = 1000.5
  items[1].building_area_pyeong = 0
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const panels = page.getByRole('article').getByRole('group', { name: '토지 및 건물 면적' })
  await expect(panels.nth(0)).toContainText('토지-')
  await expect(panels.nth(0)).toContainText('건물-')
  await expect(panels.nth(1)).toContainText('토지1,000.5평')
  await expect(panels.nth(1)).toContainText('건물0평')
  await filters(page).getByRole('button', { name: '대지 1건', exact: true }).click()
  await expect(panels).toHaveCount(1)
  await expect(panels).toContainText('토지1,000.5평')
})

test('담당 법원이 누락돼도 본원명이나 구분선을 표시하지 않는다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, ['아파트'])
  items[0].court_name = '서울'
  items[0].branch_name = null
  items[0].division_name = '경매21계'
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const card = page.getByRole('article')
  await expect(card).toHaveCount(1)
  await expect(card.getByText('서울', { exact: true })).toHaveCount(0)
  await expect(card.getByText('/', { exact: true })).toHaveCount(0)
  await expect(card.getByText('경매21계', { exact: true })).toBeVisible()
  await expect(card.getByRole('heading', { name: '2099타경1' })).toBeVisible()
})

test('현재 페이지 밖의 모든 건수를 집계하고 페이지·용도 변경 시 재사용한다', async ({ page }) => {
  const { requests } = await prepareUsageResults(page, Array.from({ length: 225 }, (_, index) => index < 120 ? '아파트' : '공장'))
  await page.goto('/search?sido=서울특별시&sigungu=강남구&sort_by=lowest_desc&start_date=2099-01-01&limit=50')
  const facet = filters(page)
  await expect(facet.getByRole('button', { name: '아파트 120건', exact: true })).toBeVisible()
  await expect(facet.getByRole('button', { name: '공장 105건', exact: true })).toBeVisible()
  const countRequests = () => requests.filter((url) => url.searchParams.get('limit') === '100')
  expect(countRequests().map((url) => Number(url.searchParams.get('offset'))).sort((a, b) => a - b)).toEqual([0, 100, 200])
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('offset') === '50')
  await expect(page.getByRole('heading', { name: '2099타경51', exact: true })).toBeVisible()
  await facet.getByRole('button', { name: '공장 105건', exact: true }).click()
  await expect(page.getByRole('heading', { name: '2099타경121', exact: true })).toBeVisible()
  await expect(page).toHaveURL((url) => (
    url.searchParams.get('offset') === '0' && url.searchParams.get('sido') === '서울특별시' &&
    url.searchParams.get('sigungu') === '강남구' && url.searchParams.get('start_date') === '2099-01-01' &&
    url.searchParams.get('sort_by') === 'lowest_desc'
  ))
  await page.goBack()
  await expect(facet.getByRole('button', { name: '전체 225건', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: '2099타경51', exact: true })).toBeVisible()
  await page.goForward()
  await expect(facet.getByRole('button', { name: '공장 105건', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: '2099타경121', exact: true })).toBeVisible()
  expect(countRequests()).toHaveLength(3)
})

test('다양한 용도는 건수순 선택 목록으로 표시되고 모바일에서도 키보드로 선택한다', async ({ page }, testInfo) => {
  const usages = [...Array<string>(12).fill('다세대(빌라)'), ...Array<string>(8).fill('아파트'), ...Array<string>(6).fill('오피스텔'),
    '차량', '전', '근린상가', '임야', '주택', '답', '아파트형공장', '공장', '대지', '도시형생활주택', '근린시설', '잡종지', '숙박시설', '창고', '상가,오피스텔,근린시설']
  await prepareUsageResults(page, usages)
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const facet = filters(page)
  await expect(facet.getByRole('button').nth(1)).toHaveAccessibleName('다세대(빌라) 12건')
  await expect(facet.getByRole('button').nth(2)).toHaveAccessibleName('아파트 8건')
  await facet.getByRole('button', { name: '공장 1건', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('usage-counts-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const compound = facet.getByRole('button', { name: '상가,오피스텔,근린시설 1건', exact: true })
  await compound.focus()
  await compound.press('Enter')
  await expect(compound).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('article').getByText('상가,오피스텔,근린시설', { exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.getAll('goods_usage')).toEqual(['상가,오피스텔,근린시설'])
  const layout = await facet.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
  await page.screenshot({ path: testInfo.outputPath('usage-counts-mobile.png'), fullPage: true })
})

test('복수 용도 URL은 유지하고 건수는 용도 선택 전 전체 결과를 기준으로 한다', async ({ page }) => {
  const { requests } = await prepareUsageResults(page)
  await page.goto('/search?search_type=comprehensive&goods_usage=아파트&goods_usage=자동차&court_code=B000210')
  const facet = filters(page)
  await expect(facet.getByRole('button', { name: '전체 4건', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
  expect(new URL(page.url()).searchParams.getAll('goods_usage')).toEqual(['아파트', '자동차'])
  expect(requests.find((url) => url.searchParams.get('limit') === '100')?.searchParams.has('goods_usage')).toBe(false)
  await facet.getByRole('button', { name: '전체 4건', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(4)
  expect(new URL(page.url()).searchParams.get('court_code')).toBe('B000210')
})

test('집계 중간 페이지 실패 시 부분 건수를 숨기고 결과 목록을 유지한 채 재시도한다', async ({ page }) => {
  const { requests } = await prepareUsageResults(page, Array<string>(101).fill('아파트'))
  await page.route('**/api/v1/search?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    if (params.get('limit') === '100' && params.get('offset') === '100') {
      return route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
    }
    return route.fallback()
  })
  await page.goto('/search?court_name=서울')
  const facet = filters(page)
  await expect(facet.getByRole('alert')).toBeVisible()
  await expect(facet.getByRole('button', { name: /아파트/ })).toHaveCount(0)
  await expect(page.getByRole('article')).toHaveCount(50)
  await page.unroute('**/api/v1/search?**')
  await facet.getByRole('button', { name: '건수 다시 불러오기', exact: true }).click()
  await expect(facet.getByRole('button', { name: '아파트 101건', exact: true })).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/search' && url.searchParams.get('limit') === '50')).toHaveLength(1)
})

test('조건이 바뀐 뒤 도착한 이전 건수로 새 용도 목록을 덮어쓰지 않는다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, Array<string>(51).fill('아파트'))
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/v1/search?**', async (route) => {
    const params = new URL(route.request().url()).searchParams
    if (params.get('q') === '이전' && params.get('limit') === '100') {
      await pending
      return route.fulfill({ json: { total: 51, items } })
    }
    if (params.get('q') === '새조건') {
      return route.fulfill({ json: { total: 1, items: [{ ...items[0], goods_usage_name: '창고' }] } })
    }
    return route.fallback()
  })
  const oldRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get('limit') === '100')
  await page.goto('/search?q=이전')
  await oldRequest
  await page.getByLabel('경매 물건 검색어').fill('새조건')
  await page.getByLabel('경매 물건 검색어').press('Enter')
  await expect(filters(page).getByRole('button', { name: '창고 1건', exact: true })).toBeVisible()
  release()
  await expect(filters(page).getByRole('button', { name: '아파트 51건', exact: true })).toHaveCount(0)
  await expect(filters(page).getByRole('button', { name: '창고 1건', exact: true })).toBeVisible()
})

test('용도 조회 실패 후 같은 선택으로 재시도하고 실제 빈 결과는 전체 0건으로 표시한다', async ({ page }) => {
  await prepareUsageResults(page)
  await page.goto('/search')
  const facet = filters(page)
  await expect(facet.getByRole('button', { name: '아파트 1건', exact: true })).toBeVisible()
  await page.route('**/api/v1/search?**', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await facet.getByRole('button', { name: '아파트 1건', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('서버 오류')
  await expect(facet.getByRole('button', { name: '아파트 1건', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.route('**/api/v1/search?**', (route) => route.fulfill({ json: { total: 0, items: [] } }))
  await page.getByLabel('경매 물건 검색어').fill('없는 조건')
  await page.getByLabel('경매 물건 검색어').press('Enter')
  await expect(facet.getByRole('button', { name: '전체 0건', exact: true })).toBeVisible()
  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
})

test('누락된 사건번호는 상세정보로 보완하고 용도 변경 후에도 재사용한다', async ({ page }, testInfo) => {
  const { items } = await prepareUsageResults(page, ['기타'])
  items[0].case_number = null
  let detailRequests = 0
  await page.route('**/api/v1/goods/9100', (route) => {
    detailRequests += 1
    return route.fulfill({ json: { case_display_number: '2025타경103472' } })
  })
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const card = page.getByRole('article')
  await expect(card.getByRole('heading', { name: '2025타경103472', exact: true })).toBeVisible()
  await expect(card.getByText('서울특별시 강남구 테헤란로 1', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: /관심/ })).toHaveCount(0)
  await filters(page).getByRole('button', { name: '기타 1건', exact: true }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('goods_usage') === '기타')
  await expect(card.getByRole('heading', { name: '2025타경103472', exact: true })).toBeVisible()
  await filters(page).getByRole('button', { name: '전체 1건', exact: true }).click()
  await expect(page).toHaveURL((url) => !url.searchParams.has('goods_usage'))
  await expect(card.getByRole('heading', { name: '2025타경103472', exact: true })).toBeVisible()
  expect(detailRequests).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('case-number-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(card.getByRole('heading', { name: '2025타경103472', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('case-number-mobile.png'), fullPage: true })
})

test('사건번호 조회 실패는 카드에서 재시도하고 번호가 없으면 임의로 만들지 않는다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, ['아파트'])
  items[0].case_number = null
  await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ json: { case_display_number: '2024타경99' } }))
  await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await page.goto('/search')
  const card = page.getByRole('article')
  await expect(card.getByRole('heading', { name: '사건번호 확인 불가', exact: true })).toBeVisible()
  await expect(card.getByText('서울특별시 강남구 테헤란로 1', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: '사건번호 다시 불러오기', exact: true }).click()
  await expect(card.getByRole('heading', { name: '2024타경99', exact: true })).toBeVisible()
  await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ json: { case_display_number: '' } }))
  await page.goto('/search?q=번호없음')
  await expect(card.getByRole('heading', { name: '사건번호 정보 없음', exact: true })).toBeVisible()
})

test('화면 밖 물건의 사건번호는 미리 전부 조회하지 않고 스크롤할 때 조회한다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, Array<string>(50).fill('아파트'))
  items.forEach((item) => { item.case_number = null })
  const detailIds: number[] = []
  await page.route('**/api/v1/goods/*', (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1))
    detailIds.push(id)
    return route.fulfill({ json: { case_display_number: `2088타경${id - 9099}` } })
  })
  await page.goto('/search')
  await expect(page.getByRole('heading', { name: '2088타경1', exact: true })).toBeVisible()
  expect(detailIds).not.toContain(9149)
  expect(detailIds.length).toBeLessThan(50)
  await page.getByRole('article').last().scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: '2088타경50', exact: true })).toBeVisible()
  expect(detailIds).toContain(9149)
})

test('로그인한 사용자에게도 검색 결과의 관심 저장 버튼과 상태 조회가 없다', async ({ page }) => {
  const { requests } = await prepareUsageResults(page, ['아파트'])
  await page.route('**/api/v1/refresh', (route) => route.fulfill({ json: {
    access_token: 'local-test-token', expires_in: 3600, refresh_expires_in: 86400,
    user: { id: 'local-test-user', login_id: 'tester', access_group: 'general' },
  } }))
  await page.goto('/search')
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '2099타경1', exact: true })).toBeVisible()
  await expect(page.getByRole('article').getByRole('button', { name: /관심/ })).toHaveCount(0)
  expect(requests.some((url) => url.pathname.startsWith('/api/v1/favorites'))).toBe(false)
})

const representativePhoto = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#c9e5f5"/><path d="M0 178L80 115 165 179 240 100 320 175V240H0Z" fill="#8bae88"/><rect x="95" y="85" width="125" height="115" fill="#fff8e9"/><path d="M80 90L157 35 234 90Z" fill="#657992"/><path d="M117 108H141V135H117ZM170 108H194V135H170Z" fill="#97bed5"/><path d="M145 153H172V200H145Z" fill="#9f8970"/></svg>'

for (const width of [1280, 390]) {
  test(`용도를 사진 바로 오른쪽에 표시하고 긴 용도와 미등록 항목도 유지한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const usages = ['아파트', '상가,오피스텔,근린시설', null]
    await prepareUsageResults(page, usages)
    await page.route('**/api/v1/goods/*', (route) => {
      const id = new URL(route.request().url()).pathname.split('/').at(-1)
      return route.fulfill({ json: { photos: { items: [{ content_url: `/api/v1/goods/${id}/photos/1` }] } } })
    })
    await page.route('**/api/v1/goods/*/photos/*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto }))
    await page.goto('/court-search')
    await page.getByRole('button', { name: '서울중앙', exact: true }).click()
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(3)
    for (const [index, usage] of usages.entries()) {
      const card = cards.nth(index)
      await card.scrollIntoViewIfNeeded()
      const panel = card.getByRole('group', { name: '물건 용도', exact: true })
      const value = panel.getByText(usage ?? '용도 미등록', { exact: true })
      await expect(panel).toHaveCount(1)
      await expect(panel).toHaveCSS('border-top-width', '0px')
      await expect(panel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(value).toBeVisible()
      await expect(value).toHaveCSS('text-align', 'center')
      expect(await value.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18)
      expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
      const photo = card.getByRole('img', { name: '물건 대표 사진', exact: true })
      await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320)
      const photoBox = (await photo.locator('..').boundingBox())!
      const panelBox = (await panel.boundingBox())!
      const titleBox = (await card.getByRole('heading').boundingBox())!
      const priceBox = (await card.getByText('감정가', { exact: true }).boundingBox())!
      expect(panelBox.x).toBeGreaterThanOrEqual(photoBox.x + photoBox.width)
      expect(Math.abs(panelBox.y - photoBox.y)).toBeLessThan(1)
      if (width >= 1024) {
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(titleBox.x)
        expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(priceBox.x)
      } else {
        expect(titleBox.y).toBeGreaterThanOrEqual(panelBox.y + panelBox.height)
        expect(priceBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await cards.first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`usage-photo-right-${width}.png`), fullPage: true })
  })
}

test('매각기일은 월·일만 표시하고 날짜가 없거나 잘못되어도 시간을 표시하지 않는다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, ['아파트', '상가', '기타'])
  items[0].auction_date = '2026-09-14'
  items[1].auction_date = null
  items[2].auction_date = 'invalid'
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const cards = page.getByRole('article')
  await expect(cards.first().getByText('9월 14일', { exact: true })).toBeVisible()
  await expect(cards.getByText(/2026-09-14|10:30|invalid/)).toHaveCount(0)
  for (const index of [1, 2]) {
    const card = cards.nth(index)
    await card.scrollIntoViewIfNeeded()
    await expect(card.getByRole('heading', { name: `2099타경${index + 1}`, exact: true })).toBeVisible()
    await expect(card.locator('span').filter({ has: page.locator('svg.lucide-calendar-days') })).toHaveText('-')
    await expect(card.getByRole('group', { name: '매각일자', exact: true }).getByText('기일 미정', { exact: true })).toBeVisible()
  }
})

for (const width of [1280, 390]) {
  test(`매각일자를 사건정보 오른쪽에 두고 남은 일수를 아래에 표시하며 카드 높이를 줄인다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.clock.setFixedTime(new Date('2026-09-14T01:00:00Z'))
    const { items } = await prepareUsageResults(page, ['아파트'])
    Object.assign(items[0], {
      court_name: '대구', branch_name: '대구서부지원', division_name: '경매2계',
      case_number: '2025타경2361', printed_address: '경상북도 성주군 초전면 대장리 262-6',
      auction_date: '2026-09-17',
      land_area_pyeong: 123.456, building_area_pyeong: 32.1,
    })
    await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ json: {
      photos: { items: [{ content_url: '/api/v1/goods/9100/photos/1', photo_division_code: '000245' }] },
    } }))
    await page.route('**/api/v1/goods/9100/photos/1', (route) => route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto }))
    await page.goto('/court-search')
    await page.getByRole('button', { name: '서울중앙', exact: true }).click()
    const card = page.getByRole('article')
    const heading = card.getByRole('heading', { name: '2025타경2361', exact: true })
    const datePanel = card.getByRole('group', { name: '매각일자', exact: true })
    const areaPanel = card.getByRole('group', { name: '토지 및 건물 면적' })
    await expect(areaPanel).toContainText('토지123.46평')
    await expect(areaPanel).toContainText('건물32.1평')
    const date = datePanel.getByText('9월 17일', { exact: true })
    const countdown = datePanel.getByText('입찰 3일 전', { exact: true })
    await expect(date).toBeVisible()
    await expect(countdown).toBeVisible()
    await expect(card.getByText('경상북도 성주군 초전면 대장리 262-6', { exact: true })).toBeVisible()
    await expect.poll(() => card.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320)
    const titleBox = (await heading.boundingBox())!
    const areaBox = (await areaPanel.boundingBox())!
    if (width >= 1024) {
      expect(areaBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width)
      expect(areaBox.y).toBeLessThan(titleBox.y + titleBox.height)
    }
    const panelBox = (await datePanel.boundingBox())!
    if (width >= 1024) {
      const infoBox = (await heading.locator('..').locator('..').boundingBox())!
      expect(panelBox.x - (infoBox.x + infoBox.width)).toBeGreaterThanOrEqual(32)
    }
    const dateBox = (await date.boundingBox())!
    const countdownBox = (await countdown.boundingBox())!
    expect(panelBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width)
    expect(countdownBox.y).toBeGreaterThanOrEqual(dateBox.y + dateBox.height)
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(width >= 1024 ? 150 : 320)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`compact-sale-date-${width}.png`), fullPage: true })
  })
}

test.describe('한국 자정 기준 입찰 일수', () => {
  test.use({ timezoneId: 'America/Los_Angeles' })
  test('한국 자정이 지나면 새로고침 없이 남은 일수를 갱신하고 지난 기일은 경과로 표시한다', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-14T14:59:30Z') })
    const { items } = await prepareUsageResults(page, ['아파트', '상가'])
    items[0].auction_date = '2026-09-15'
    items[1].auction_date = '2026-09-13'
    await page.goto('/court-search')
    await page.getByRole('button', { name: '서울중앙', exact: true }).click()
    const panels = page.getByRole('article').getByRole('group', { name: '매각일자', exact: true })
    await expect(panels.nth(0).getByText('입찰 1일 전', { exact: true })).toBeVisible()
    await expect(panels.nth(1).getByText('입찰 1일 경과', { exact: true })).toBeVisible()
    await page.clock.fastForward(60_000)
    await expect(panels.nth(0).getByText('입찰 당일', { exact: true })).toBeVisible()
    await expect(panels.nth(1).getByText('입찰 2일 경과', { exact: true })).toBeVisible()
  })
})

for (const width of [1280, 390]) {
  test(`대표 사진 한 장과 용도를 나란히 표시하고 용도 변경 후 재사용한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const { items } = await prepareUsageResults(page, ['아파트'])
    items[0].case_number = null
    let detailRequests = 0
    const photoRequests: string[] = []
    await page.route('**/api/v1/goods/9100', (route) => {
      detailRequests += 1
      return route.fulfill({ json: { case_display_number: '2025타경103472', photos: { items: [
        { content_url: '/api/v1/goods/9100/photos/1', photo_division_code: '000244' },
        { content_url: '/api/v1/goods/9100/photos/2', photo_division_code: '000241' },
        { content_url: '/api/v1/goods/9100/photos/3', photo_division_code: '000245' },
        { content_url: '/api/v1/goods/9100/photos/4', photo_division_code: '000245' },
      ] } } })
    })
    await page.route('**/api/v1/goods/9100/photos/*', (route) => {
      photoRequests.push(new URL(route.request().url()).pathname)
      return route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto })
    })
    await page.goto('/court-search')
    await page.getByRole('button', { name: '서울중앙', exact: true }).click()
    const card = page.getByRole('article')
    const photo = card.getByRole('img', { name: '물건 대표 사진', exact: true })
    const heading = card.getByRole('heading', { name: '2025타경103472', exact: true })
    await expect(photo).toHaveCount(1)
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320)
    await expect(heading).toBeVisible()
    const imageBox = await photo.boundingBox()
    const titleBox = await heading.boundingBox()
    if (width >= 1024) expect(imageBox!.x + imageBox!.width).toBeLessThanOrEqual(titleBox!.x)
    else expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(titleBox!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(photoRequests).toEqual(['/api/v1/goods/9100/photos/3'])
    await filters(page).getByRole('button', { name: '아파트 1건', exact: true }).click()
    await expect(page).toHaveURL((url) => url.searchParams.get('goods_usage') === '아파트')
    await expect(photo).toBeVisible()
    await expect(heading).toBeVisible()
    expect(detailRequests).toBe(1)
    await page.screenshot({ path: testInfo.outputPath(`representative-photo-${width}.png`), fullPage: true })
  })
}

test('대표 사진이 없거나 이미지 응답이 실패해도 카드 내용을 유지하고 재시도로 복구한다', async ({ page }) => {
  await prepareUsageResults(page, ['아파트', '기타'])
  await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ json: {
    case_display_number: '2099타경1', photos: { items: [{ content_url: '/api/v1/goods/9100/photos/1' }] },
  } }))
  let photoRequests = 0
  await page.route('**/api/v1/goods/9100/photos/1*', (route) => {
    photoRequests += 1
    return photoRequests === 1
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto })
  })
  await page.goto('/search')
  const first = page.getByRole('article').first()
  await expect(first.getByText('사진 확인 불가', { exact: true })).toBeVisible()
  await expect(first.getByRole('heading', { name: '2099타경1', exact: true })).toBeVisible()
  await expect(first.getByRole('link', { name: '상세보기', exact: true })).toHaveAttribute('href', '/goods/9100')
  await first.getByRole('button', { name: '사진 다시 불러오기', exact: true }).click()
  await expect.poll(() => first.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320)
  const second = page.getByRole('article').nth(1)
  await second.scrollIntoViewIfNeeded()
  await expect(second.getByText('사진 없음', { exact: true })).toBeVisible()
  await expect(second.getByRole('img')).toHaveCount(0)
})

test('대표 사진은 관련사진이 없으면 전경도, 전경도도 없으면 위치도, 세 유형이 없으면 다른 사진을 표시한다', async ({ page }) => {
  await prepareUsageResults(page, ['아파트', '아파트', '아파트'])
  const codesByGoods: Record<string, string[]> = {
    '9100': ['000244', '000241'],
    '9101': ['000242', '000244'],
    '9102': ['000242'],
  }
  await page.route('**/api/v1/goods/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!
    return route.fulfill({ json: { case_display_number: '2025타경1', photos: { items: codesByGoods[id].map((code, index) => ({
      photo_division_code: code, content_url: `/api/v1/goods/${id}/photos/${index + 1}`,
    })) } } })
  })
  await page.route('**/api/v1/goods/*/photos/*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto }))
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  for (const [index, expected] of ['9100/photos/2', '9101/photos/2', '9102/photos/1'].entries()) {
    const card = page.getByRole('article').nth(index)
    await card.scrollIntoViewIfNeeded()
    const photo = card.getByRole('img', { name: '물건 대표 사진', exact: true })
    await expect(photo).toHaveAttribute('src', new RegExp(`/goods/${expected}$`))
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(320)
  }
})

test('사진 정보 조회 실패는 재시도하고 같은 사건의 다른 물건 사진을 섞지 않는다', async ({ page }) => {
  const { items } = await prepareUsageResults(page, ['아파트', '기타'])
  items.forEach((item) => { item.case_id = 'same-case'; item.case_number = '2025타경1' })
  await page.route('**/api/v1/goods/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    return route.fulfill({ json: { case_display_number: '2025타경1', photos: { items: [{ content_url: `/api/v1/goods/${id}/photos/1` }] } } })
  })
  await page.route('**/api/v1/goods/9100', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await page.route('**/api/v1/goods/*/photos/*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: representativePhoto }))
  await page.goto('/search')
  const first = page.getByRole('article').first()
  await expect(first.getByText('사진 확인 불가', { exact: true })).toBeVisible()
  await first.getByRole('button', { name: '사진 다시 불러오기', exact: true }).click()
  await expect(first.getByRole('img')).toHaveAttribute('src', /\/goods\/9100\/photos\/1$/)
  const second = page.getByRole('article').nth(1)
  await second.scrollIntoViewIfNeeded()
  await expect(second.getByRole('img')).toHaveAttribute('src', /\/goods\/9101\/photos\/1$/)
})
