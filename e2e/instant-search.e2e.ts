import { expect, test, type Page } from '@playwright/test'

const station = {
  station_id: 'test-gangnam', name: '강남역', city: '서울',
  areas: ['강남구'], lines: ['2호선'], latitude: 37.4979, longitude: 127.0276,
}
const emptyResults = { total: 0, limit: 50, offset: 0, items: [] }
const coverage = { matched_total: 0, page_candidates: 0, page_items: 0, excluded_unconvertible: 0 }

async function prepareApis(page: Page) {
  const requests: URL[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/v1/')) requests.push(url)
  })
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.fallback() : route.abort()
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    let body: unknown = emptyResults
    if (url.pathname === '/api/v1/refresh') {
      return route.fulfill({ status: 401, json: { detail: 'Anonymous local test.' } })
    }
    if (url.pathname === '/api/v1/search/special/types') body = { items: ['유치권', '법정지상권'] }
    if (url.pathname === '/api/v1/geo/station-facets') {
      body = { cities: [{ city: '서울', label: '수도권', total: 1, lines: [{ line: '2호선', total: 1 }] }] }
    }
    if (url.pathname === '/api/v1/geo/stations') body = { ...emptyResults, total: 1, items: [station] }
    if (url.pathname === '/api/v1/geo/subway') {
      body = { ...emptyResults, coverage, station: { ...station, radius_m: Number(url.searchParams.get('radius_m')) } }
    }
    if (url.pathname === '/api/v1/question/goods') {
      const question = route.request().postDataJSON().question
      body = { ...emptyResults, question, parsed: { terms: [question], max_price: null }, interpretation: { method: 'rules', fallback_used: false } }
    }
    return route.fulfill({ json: body })
  })
  return requests
}

function searchRequest(page: Page, path = '/api/v1/search') {
  return page.waitForRequest((request) => new URL(request.url()).pathname === path)
}

test('서울중앙을 한 번 클릭하면 검색 버튼 없이 정확한 법원을 검색한다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.goto('/court-search')
  await expect(page.getByRole('button', { name: /검색하기/ })).toHaveCount(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/search')).toHaveLength(0)
  const request = searchRequest(page)
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  const url = new URL((await request).url())
  expect(url.searchParams.get('court_name')).toBe('서울')
  expect(url.searchParams.get('branch_name')).toBe('서울중앙')
  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: '서울중앙', exact: true })).toBeVisible()
})

test('이름이 같은 서부 지원도 소속 법원을 구분해 검색한다', async ({ page }) => {
  await prepareApis(page)
  for (const court of ['부산', '대구']) {
    await page.goto('/court-search')
    const request = searchRequest(page)
    await page.getByTestId('court-section').filter({ has: page.getByRole('heading', { name: `${court}지방법원`, exact: true }) })
      .getByRole('button', { name: '서부', exact: true }).click()
    const url = new URL((await request).url())
    expect(url.searchParams.get('court_name')).toBe(court)
    expect(url.searchParams.get('branch_name')).toBe('서부')
  }
})

test('지역 선택은 시도를 바꾼 후 마지막 시군구를 클릭할 때 검색한다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.goto('/region-search')
  await page.getByRole('button', { name: '서울', exact: true }).click()
  await page.getByRole('button', { name: '부산', exact: true }).click()
  await expect(page).toHaveURL(/\/region-search$/)
  await expect(page.getByRole('button', { name: '강남구', exact: true })).toHaveCount(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/search')).toHaveLength(0)
  const request = searchRequest(page)
  await page.getByRole('button', { name: '해운대구', exact: true }).click()
  const url = new URL((await request).url())
  expect(url.searchParams.get('sido')).toBe('부산광역시')
  expect(url.searchParams.get('sigungu')).toBe('해운대구')
})

for (const option of ['아파트', '상업용', '전체보기']) {
  test(`용도 ${option}을 누르면 해당 종류 전체를 바로 검색한다`, async ({ page }) => {
    await prepareApis(page)
    await page.goto('/type-search')
    await expect(page.getByRole('button', { name: /검색하기/ })).toHaveCount(0)
    const request = searchRequest(page)
    await page.getByRole('button', { name: option, exact: true }).click()
    const usages = new URL((await request).url()).searchParams.getAll('goods_usage')
    if (option === '아파트') expect(usages).toEqual(['아파트'])
    else {
      expect(usages).toEqual(expect.arrayContaining(['상가', '오피스텔', '근린시설', '상가,오피스텔,근린시설']))
      if (option === '전체보기') expect(usages).toEqual(expect.arrayContaining(['아파트', '자동차']))
    }
    expect(new Set(usages).size).toBe(usages.length)
  })
}

test('모바일 터치로 특수 유형을 선택하면 즉시 특수검색 API로 조회한다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  try {
    await prepareApis(page)
    await page.goto('/special-search')
    await expect(page.getByRole('button', { name: /검색하기/ })).toHaveCount(0)
    const request = searchRequest(page, '/api/v1/search/special')
    await page.getByRole('button', { name: '유치권', exact: true }).tap()
    const url = new URL((await request).url())
    expect(url.searchParams.getAll('special_type')).toEqual(['유치권'])
    expect(url.searchParams.get('match_mode')).toBe('any')
    await expect(page).toHaveURL((current) => current.searchParams.get('search_type') === 'special')
  } finally {
    await context.close()
  }
})

test('특수 유형 목록을 가져오지 못하면 잘못된 검색으로 이동하지 않는다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.route('**/api/v1/search/special/types', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }))
  await page.goto('/special-search')
  await expect(page.getByRole('status')).toContainText('서버 오류')
  await expect(page.getByRole('button', { name: '유치권', exact: true })).toHaveCount(0)
  expect(requests.filter((url) => url.pathname === '/api/v1/search/special')).toHaveLength(0)
})

test('항목 클릭 후 검색 오류가 발생하면 결과 화면에서 재시도할 수 있다', async ({ page }) => {
  await prepareApis(page)
  await page.route('**/api/v1/search?**', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await page.goto('/court-search')
  await page.getByRole('button', { name: '서울중앙', exact: true }).click()
  await expect(page.getByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /다시/ }).click()
  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
})

test('메인 검색은 Enter와 추천 항목 클릭으로 실행한다', async ({ page }) => {
  await prepareApis(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '검색', exact: true })).toHaveCount(0)
  await page.getByLabel('경매 물건 검색어').fill('서울 아파트')
  await page.getByLabel('경매 물건 검색어').press('Enter')
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === '서울 아파트')
  await page.goto('/')
  await page.getByRole('button', { name: '# 신건', exact: true }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('status') === '신건')
})

test('질문 추천 항목은 클릭 즉시 검색하고 직접 입력은 Enter로 검색한다', async ({ page }) => {
  await prepareApis(page)
  await page.goto('/question-search')
  await expect(page.getByRole('button', { name: '물건 추천', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '서울 5억 이하 아파트', exact: true }).click()
  await expect(page.getByRole('heading', { name: '“서울 5억 이하 아파트 찾아줘”' })).toBeVisible()
  await page.getByLabel('찾고 싶은 경매 물건').fill('부산 상가')
  await page.getByLabel('찾고 싶은 경매 물건').press('Enter')
  await expect(page.getByRole('heading', { name: '“부산 상가”' })).toBeVisible()
})

test('예정물건은 선택 조건과 입력을 자동 적용하고 잘못된 범위는 전송하지 않는다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.goto('/scheduled-search')
  await expect(page.getByText('조건에 맞는 첫 매각기일 미지정 물건이 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '예정물건 검색', exact: true })).toHaveCount(0)
  const selected = searchRequest(page, '/api/v1/search/scheduled')
  await page.getByLabel('배당종기 상태').selectOption('passed')
  expect(new URL((await selected).url()).searchParams.get('demand_deadline_passed')).toBe('true')
  const entered = searchRequest(page, '/api/v1/search/scheduled')
  await page.getByPlaceholder('통합 검색어', { exact: true }).fill('서울')
  expect(new URL((await entered).url()).searchParams.get('q')).toBe('서울')
  const count = requests.filter((url) => url.pathname === '/api/v1/search/scheduled').length
  await page.getByPlaceholder('최소 사건연도').fill('2026')
  await page.getByPlaceholder('최대 사건연도').fill('2020')
  await expect(page.getByText('최소값은 최대값보다 클 수 없습니다.', { exact: true })).toBeVisible()
  expect(requests.filter((url) => url.pathname === '/api/v1/search/scheduled')).toHaveLength(count)
  const corrected = searchRequest(page, '/api/v1/search/scheduled')
  await page.getByPlaceholder('최대 사건연도').fill('2027')
  const url = new URL((await corrected).url())
  expect(url.searchParams.get('min_case_year')).toBe('2026')
  expect(url.searchParams.get('max_case_year')).toBe('2027')
  expect(url.searchParams.get('offset')).toBe('0')
})

test('한글 조합 중에는 자동 검색하지 않고 조합 완료 후 최신 값만 전송한다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.goto('/scheduled-search')
  await expect(page.getByText('조건에 맞는 첫 매각기일 미지정 물건이 없습니다.')).toBeVisible()
  const count = requests.length
  const input = page.getByPlaceholder('통합 검색어', { exact: true })
  await input.dispatchEvent('compositionstart')
  await input.fill('서')
  await page.waitForTimeout(500)
  expect(requests).toHaveLength(count)
  await input.fill('서울')
  const request = searchRequest(page, '/api/v1/search/scheduled')
  await input.dispatchEvent('compositionend')
  expect(new URL((await request).url()).searchParams.get('q')).toBe('서울')
})

async function chooseStation(page: Page) {
  await page.getByRole('tab', { name: '수도권 지역' }).click()
  await page.getByRole('button', { name: '2호선 노선', exact: true }).click()
  await page.getByRole('radio', { name: /강남역 선택/ }).check()
}

test('역 선택·반경·용도는 즉시 갱신하고 잘못된 가격은 조회하지 않는다', async ({ page }) => {
  const requests = await prepareApis(page)
  await page.goto('/subway-search')
  await expect(page.getByRole('button', { name: '반경 안 물건 찾기' })).toHaveCount(0)
  await page.getByRole('button', { name: '300m', exact: true }).click()
  expect(requests.filter((url) => url.pathname === '/api/v1/geo/subway')).toHaveLength(0)
  const initial = searchRequest(page, '/api/v1/geo/subway')
  await chooseStation(page)
  expect(new URL((await initial).url()).searchParams.get('radius_m')).toBe('300')
  const radius = searchRequest(page, '/api/v1/geo/subway')
  await page.getByRole('button', { name: '1km', exact: true }).click()
  expect(new URL((await radius).url()).searchParams.get('radius_m')).toBe('1000')
  const usage = searchRequest(page, '/api/v1/geo/subway')
  await page.getByLabel('물건 용도', { exact: true }).selectOption('아파트')
  expect(new URL((await usage).url()).searchParams.getAll('goods_usage')).toEqual(['아파트'])
  const count = requests.filter((url) => url.pathname === '/api/v1/geo/subway').length
  await page.getByLabel('최저가 최소').fill('900000000')
  await page.getByLabel('최저가 최대').fill('100000000')
  await expect(page.getByRole('alert')).toHaveText('최소 가격은 최대 가격보다 클 수 없습니다.')
  expect(requests.filter((url) => url.pathname === '/api/v1/geo/subway')).toHaveLength(count)
  const fixed = searchRequest(page, '/api/v1/geo/subway')
  await page.getByLabel('최저가 최소').fill('50000000')
  expect(new URL((await fixed).url()).searchParams.get('min_lowest_sale_price')).toBe('50000000')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('역세권 검색 실패 후 같은 역을 다시 클릭해 재시도한다', async ({ page }) => {
  await prepareApis(page)
  await page.route('**/api/v1/geo/subway?**', (route) => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }), { times: 1 })
  await page.goto('/subway-search')
  await chooseStation(page)
  await expect(page.getByRole('alert')).toContainText('서버 오류')
  const retry = searchRequest(page, '/api/v1/geo/subway')
  await page.getByRole('radio', { name: /강남역 선택/ }).click()
  expect(new URL((await retry).url()).searchParams.get('station_id')).toBe(station.station_id)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('선택한 역과 반경에 조건을 만족하는 물건이 없습니다.', { exact: true })).toBeVisible()
})

test('늦게 도착한 이전 반경의 응답이 최신 검색을 덮어쓰지 않는다', async ({ page }) => {
  await prepareApis(page)
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/v1/geo/subway?**', async (route) => {
    const radius = Number(new URL(route.request().url()).searchParams.get('radius_m'))
    if (radius === 500) await pending
    await route.fulfill({ json: { ...emptyResults, coverage, station: { ...station, radius_m: radius } } })
  })
  await page.goto('/subway-search')
  const initial = searchRequest(page, '/api/v1/geo/subway')
  await chooseStation(page)
  await initial
  await page.getByRole('button', { name: '1km', exact: true }).click()
  await expect(page.getByText('강남역 · 1,000m', { exact: true })).toBeVisible()
  release()
  await page.waitForTimeout(200)
  await expect(page.getByText('강남역 · 1,000m', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
