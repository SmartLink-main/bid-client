import { expect, test, type Page } from '@playwright/test'

const advancedRanges = [
  { label: '감정가', key: 'appraisal_amount', inputMode: 'numeric', minimum: '80000000', maximum: '200000000' },
  { label: '최저가', key: 'lowest_sale_price', inputMode: 'numeric', minimum: '50000000', maximum: '100000000' },
  { label: '유찰수', key: 'failed_count', inputMode: 'numeric', minimum: '0', maximum: '3' },
  { label: '건물면적(평)', key: 'building_area_pyeong', inputMode: 'decimal', minimum: '10.5', maximum: '40.75' },
  { label: '토지면적(평)', key: 'land_area_pyeong', inputMode: 'decimal', minimum: '5.25', maximum: '100.5' },
]

async function prepareAnonymousPage(page: Page) {
  await page.route('**/api/v1/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'E2E anonymous session.' }),
  }))
}

async function prepareSearchPageApis(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/v1/refresh') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'E2E anonymous session.' }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 0,
        limit: 50,
        offset: 0,
        items: [],
        coordinate_system: 'WGS84',
        coverage: {
          matched_total: 0,
          page_candidates: 0,
          page_items: 0,
          excluded_unconvertible: 0,
        },
        excluded_items: [],
      }),
    })
  })
}

async function prepareCourtDivisionOptions(page: Page) {
  await page.route('**/api/v1/search/options/courts/*/divisions', (route) => {
    const courtCode = new URL(route.request().url()).pathname.split('/').at(-2)
    const itemsByCourt: Record<string, Array<{ division_number: number; division_name: string | null }>> = {
      B000210: [
        { division_number: 1, division_name: '경매1계' },
        { division_number: 11, division_name: '경매11계' },
      ],
      B000530: [
        { division_number: 3, division_name: '경매3계' },
      ],
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ court_code: courtCode, items: itemsByCourt[courtCode || ''] || [] }),
    })
  })
}

test('모바일에서 지역을 선택하고 가로 넘침 없이 검색한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/region-search')

  await expect(page.getByRole('heading', { name: '지역별 검색', exact: true })).toBeVisible()
  const provinceButton = page.getByRole('button', { name: '서울', exact: true })
  await expect(provinceButton).toBeVisible()
  await provinceButton.click()
  const districtButton = page.getByRole('button', { name: '강남구', exact: true })
  await expect(districtButton).toBeVisible()

  const layout = await page.getByTestId('region-district-options').evaluate((container) => ({
    districtWidth: container.clientWidth,
    districtScrollWidth: container.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(layout.districtScrollWidth).toBeLessThanOrEqual(layout.districtWidth)
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)

  await districtButton.click()
  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' &&
    url.searchParams.get('sido') === '서울특별시' &&
    url.searchParams.get('sigungu') === '강남구'
  ))
})

test('목록 아래쪽 법원을 선택해 검색할 수 있다', async ({ page }) => {
  await prepareAnonymousPage(page)
  await page.route('**/api/v1/search**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 0, limit: 50, offset: 0, items: [] }),
  }))
  await page.goto('/court-search')

  const jejuButton = page.getByRole('button', { name: '제주', exact: true })
  await jejuButton.scrollIntoViewIfNeeded()
  await jejuButton.click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' &&
    url.searchParams.get('court_name') === '제주' &&
    url.searchParams.get('branch_name') === '제주'
  ))
})

test('종합검색에서 관할법원에 맞는 경매계만 선택하고 법원 변경 시 초기화한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await prepareCourtDivisionOptions(page)
  await page.goto('/advanced-search')

  const courtSelect = page.getByLabel('관할법원', { exact: true })
  const divisionSelect = page.getByLabel('경매계', { exact: true })
  await expect(courtSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(divisionSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(divisionSelect).toBeDisabled()

  await courtSelect.selectOption({ label: '서울중앙지방법원' })
  await expect(divisionSelect).toBeEnabled()
  await expect(divisionSelect.locator('option')).toHaveText([
    '전체 경매계',
    '경매1계',
    '경매11계',
  ])
  await divisionSelect.selectOption({ label: '경매1계' })

  await courtSelect.selectOption({ label: '제주지방법원' })
  await expect(divisionSelect).toHaveValue('')
  await expect(divisionSelect).toBeEnabled()
  await expect(divisionSelect.locator('option')).toHaveText(['전체 경매계', '경매3계'])
})

test('종합검색 지역 필터를 시도부터 읍면동까지 선택하고 상위 지역 변경 시 초기화한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await page.goto('/advanced-search')

  await expect(page.getByLabel('통합 검색어', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('지역 통합검색 (선택 입력)', { exact: true })).toHaveCount(0)
  await expect(page.getByPlaceholder('주소 또는 건물명', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '사건번호', exact: true })).toBeVisible()
  await expect(page.getByLabel('사건 일련번호', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('사건 연도 (1900 이상)', { exact: true })).toHaveCount(0)
  const caseNumberGroup = page.getByRole('group', { name: '사건번호', exact: true })
  const caseYearSelect = caseNumberGroup.getByLabel('사건 연도', { exact: true })
  await expect(caseYearSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(caseYearSelect).toHaveValue('')
  const currentYear = new Date().getFullYear()
  await expect(caseYearSelect.locator('option')).toHaveText([
    '전체',
    ...Array.from({ length: currentYear - 2010 + 1 }, (_, index) => String(currentYear - index)),
  ])
  await expect(caseNumberGroup.getByText('타경', { exact: true })).toBeVisible()
  await expect(caseNumberGroup.getByRole('textbox', { name: '사건번호', exact: true })).toHaveAttribute('inputmode', 'numeric')

  const auctionDateRange = page.getByRole('group', { name: '매각기일', exact: true })
  await expect(auctionDateRange).toBeVisible()
  await expect(auctionDateRange.locator('input[type="date"]')).toHaveCount(2)
  await expect(auctionDateRange.getByText('~', { exact: true })).toBeVisible()
  await expect(page.getByLabel('조회 시작일', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('조회 종료일', { exact: true })).toHaveCount(0)

  const provinceSelect = page.getByLabel('시/도', { exact: true })
  const sigunguSelect = page.getByLabel('시/군/구', { exact: true })
  const dongSelect = page.getByLabel('읍/면/동', { exact: true })

  await expect(dongSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(sigunguSelect).toBeDisabled()
  await expect(dongSelect).toBeDisabled()
  await expect(dongSelect.locator('option')).toHaveText(['시/도를 먼저 선택해 주세요'])

  await provinceSelect.selectOption({ label: '서울' })
  await expect(sigunguSelect).toBeEnabled()
  await expect(dongSelect).toBeDisabled()
  await expect(dongSelect.locator('option')).toHaveText(['시/군/구를 먼저 선택해 주세요'])

  await sigunguSelect.selectOption({ label: '강남구' })
  await expect(dongSelect).toBeEnabled()
  await expect(dongSelect.locator('option').first()).toHaveText('전체 읍/면/동')
  await expect(dongSelect.locator('option[value="역삼동"]')).toHaveCount(1)
  await dongSelect.selectOption({ label: '역삼동' })

  await sigunguSelect.selectOption({ label: '강동구' })
  await expect(dongSelect).toHaveValue('')
  await expect(dongSelect.locator('option[value="역삼동"]')).toHaveCount(0)
  await expect(dongSelect.locator('option[value="천호동"]')).toHaveCount(1)
  await dongSelect.selectOption({ label: '천호동' })

  await provinceSelect.selectOption({ label: '경북' })
  await expect(sigunguSelect).toHaveValue('')
  await expect(dongSelect).toHaveValue('')
  await expect(dongSelect).toBeDisabled()
  await expect(dongSelect.locator('option')).toHaveText(['시/군/구를 먼저 선택해 주세요'])
})

test('매각기일 시작일이 종료일보다 늦으면 검색을 막는다', async ({ page }) => {
  await prepareSearchPageApis(page)
  const comprehensiveRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/search/comprehensive') comprehensiveRequests.push(url.toString())
  })
  await page.goto('/advanced-search')

  await page.getByLabel('매각기일 시작일', { exact: true }).fill('2026-09-30')
  await page.getByLabel('매각기일 종료일', { exact: true }).fill('2026-09-01')
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()

  await expect(page.getByText('매각기일 시작일은 종료일보다 늦을 수 없습니다.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL((url) => url.pathname === '/advanced-search')
  expect(comprehensiveRequests).toHaveLength(0)
})

test('종합검색의 고정 선택값을 검색 URL과 API 요청에 전달한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await prepareCourtDivisionOptions(page)
  await page.goto('/advanced-search')

  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '서울중앙지방법원' })
  await expect(page.getByLabel('경매계', { exact: true })).toBeEnabled()
  await page.getByLabel('경매계', { exact: true }).selectOption({ label: '경매1계' })
  await page.getByLabel('매각기일 시작일', { exact: true }).fill('2026-09-01')
  await page.getByLabel('매각기일 종료일', { exact: true }).fill('2026-09-30')
  await page.getByLabel('사건 연도', { exact: true }).selectOption('2025')
  await page.getByRole('textbox', { name: '사건번호', exact: true }).fill('52202')
  await page.getByLabel('시/도', { exact: true }).selectOption({ label: '서울' })
  await page.getByLabel('시/군/구', { exact: true }).selectOption({ label: '강남구' })
  await page.getByLabel('읍/면/동', { exact: true }).selectOption({ label: '역삼동' })
  await page.getByLabel('건물명', { exact: true }).fill('테헤란빌딩')
  await page.getByLabel('경매종류', { exact: true }).selectOption({ label: '강제경매' })
  await page.getByLabel('이해관계인 구분', { exact: true }).selectOption({ label: '채권자' })
  await page.getByLabel('이해관계인 이름', { exact: true }).fill('홍길동')
  const statusSelect = page.getByLabel('현재상태', { exact: true })
  await expect(statusSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(statusSelect).toHaveValue('')
  await expect(statusSelect.locator('option[value="신건"]')).toHaveText('신건')
  await statusSelect.selectOption({ label: '유찰' })
  await page.getByLabel('아파트', { exact: true }).check()
  await page.getByLabel('오피스텔', { exact: true }).check()

  const requestPromise = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/api/v1/search/comprehensive'
  ))
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' &&
    url.searchParams.get('search_type') === 'comprehensive' &&
    !url.searchParams.has('q') &&
    url.searchParams.get('court_code') === 'B000210' &&
    !url.searchParams.has('court_name') &&
    !url.searchParams.has('branch_name') &&
    url.searchParams.get('division_name') === '경매1계' &&
    url.searchParams.get('start_date') === '2026-09-01' &&
    url.searchParams.get('end_date') === '2026-09-30' &&
    url.searchParams.get('case_serial') === '52202' &&
    url.searchParams.get('case_year') === '2025' &&
    url.searchParams.get('sido') === '서울특별시' &&
    url.searchParams.get('sigungu') === '강남구' &&
    url.searchParams.get('dong') === '역삼동' &&
    url.searchParams.get('building_name') === '테헤란빌딩' &&
    !url.searchParams.has('region') &&
    url.searchParams.get('auction_kind') === '강제경매' &&
    url.searchParams.get('interested_party_role') === '채권자' &&
    url.searchParams.get('interested_party_name') === '홍길동' &&
    url.searchParams.get('status') === '유찰' &&
    [...url.searchParams.getAll('goods_usage')].sort().join('|') === [
      '상가,오피스텔,근린시설',
      '아파트',
      '오피스텔',
    ].sort().join('|')
  ))

  const requestUrl = new URL((await requestPromise).url())
  expect(requestUrl.searchParams.has('q')).toBe(false)
  expect(requestUrl.searchParams.get('court_code')).toBe('B000210')
  expect(requestUrl.searchParams.get('division_name')).toBe('경매1계')
  expect(requestUrl.searchParams.get('start_date')).toBe('2026-09-01')
  expect(requestUrl.searchParams.get('end_date')).toBe('2026-09-30')
  expect(requestUrl.searchParams.get('case_serial')).toBe('52202')
  expect(requestUrl.searchParams.get('case_year')).toBe('2025')
  expect(requestUrl.searchParams.get('sido')).toBe('서울특별시')
  expect(requestUrl.searchParams.get('sigungu')).toBe('강남구')
  expect(requestUrl.searchParams.get('dong')).toBe('역삼동')
  expect(requestUrl.searchParams.get('building_name')).toBe('테헤란빌딩')
  expect(requestUrl.searchParams.has('region')).toBe(false)
  expect(requestUrl.searchParams.get('auction_kind')).toBe('강제경매')
  expect(requestUrl.searchParams.get('interested_party_role')).toBe('채권자')
  expect(requestUrl.searchParams.get('interested_party_name')).toBe('홍길동')
  expect(requestUrl.searchParams.get('status')).toBe('유찰')
  expect(requestUrl.searchParams.getAll('goods_usage').sort()).toEqual([
    '상가,오피스텔,근린시설',
    '아파트',
    '오피스텔',
  ].sort())
  await expect(page.getByText('법원: 서울중앙지방법원', { exact: true })).toBeVisible()
  await expect(page.getByText('읍/면/동: 역삼동', { exact: true })).toBeVisible()
  await expect(page.getByText('경매종류: 강제경매', { exact: true })).toBeVisible()
})

test('사건 연도를 전체로 되돌리거나 사건번호를 비우면 입력한 조건만 검색한다', async ({ page }) => {
  await prepareSearchPageApis(page)

  for (const filters of [
    { year: '', serial: '52202', description: '전체 연도와 번호만 입력' },
    { year: '2010', serial: '', description: '가장 오래된 2010년만 선택하고 번호 비움' },
    { year: '', serial: '', description: '전체 연도와 빈 번호' },
  ]) {
    await test.step(filters.description, async () => {
      await page.goto('/advanced-search')
      const yearSelect = page.getByLabel('사건 연도', { exact: true })
      const serialInput = page.getByRole('textbox', { name: '사건번호', exact: true })
      await yearSelect.selectOption('2025')
      await serialInput.fill('52202')
      await yearSelect.selectOption(filters.year)
      await serialInput.fill(filters.serial)

      const requestPromise = page.waitForRequest((request) => (
        new URL(request.url()).pathname === '/api/v1/search/comprehensive'
      ))
      await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()
      const requestUrl = new URL((await requestPromise).url())
      await expect(page).toHaveURL((url) => url.pathname === '/search')

      for (const url of [requestUrl, new URL(page.url())]) {
        expect(url.searchParams.get('case_year')).toBe(filters.year || null)
        expect(url.searchParams.get('case_serial')).toBe(filters.serial || null)
      }
      await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
    })
  }
})

test('사건번호에 음수나 문자를 입력하면 검색 요청을 보내지 않는다', async ({ page }) => {
  await prepareSearchPageApis(page)
  const comprehensiveRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/search/comprehensive') comprehensiveRequests.push(url.toString())
  })
  await page.goto('/advanced-search')
  await page.getByLabel('사건 연도', { exact: true }).selectOption('2025')

  for (const serial of ['-1', 'abc']) {
    await page.getByRole('textbox', { name: '사건번호', exact: true }).fill(serial)
    await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()
    await expect(page.getByText('사건번호·금액·유찰수는 0 이상의 정수로 입력해 주세요.', { exact: true })).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/advanced-search')
    expect(comprehensiveRequests).toHaveLength(0)
  }
})

test('현재상태를 전체 상태로 되돌리면 검색 URL과 API 요청에서 상태 조건을 제거한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await page.goto('/advanced-search')

  const statusSelect = page.getByLabel('현재상태', { exact: true })
  await expect(statusSelect).toHaveJSProperty('tagName', 'SELECT')
  await statusSelect.selectOption({ label: '유찰' })
  await expect(statusSelect).toHaveValue('유찰')
  await statusSelect.selectOption({ label: '전체 상태' })
  await expect(statusSelect).toHaveValue('')

  const requestPromise = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/api/v1/search/comprehensive'
  ))
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' &&
    url.searchParams.get('search_type') === 'comprehensive' &&
    !url.searchParams.has('status')
  ))
  const requestUrl = new URL((await requestPromise).url())
  expect(requestUrl.searchParams.has('status')).toBe(false)
  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
})

test('경매계 목록 조회 실패를 안내하고 잘못된 경매계 선택을 막는다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await page.route('**/api/v1/search/options/courts/*/divisions', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'E2E division options failure.' }),
  }))
  await page.goto('/advanced-search')

  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '서울중앙지방법원' })
  await expect(page.getByLabel('경매계', { exact: true })).toBeDisabled()
  await expect(page.getByText('경매계 목록을 불러오지 못했습니다. 관할법원을 다시 선택해 주세요.', { exact: true })).toBeVisible()
})

test('물결표 범위의 역전값과 잘못된 정수·면적 입력은 검색 요청을 보내지 않는다', async ({ page }) => {
  await prepareSearchPageApis(page)
  const comprehensiveRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/search/comprehensive') comprehensiveRequests.push(url.toString())
  })
  await page.goto('/advanced-search')

  const submit = page.getByRole('button', { name: '종합검색 결과 보기', exact: true })
  for (const range of advancedRanges.filter(({ key }) => key !== 'lowest_sale_price')) {
    await test.step(`${range.label} 최소값이 최대값보다 크면 차단`, async () => {
      const minimum = page.getByLabel(`최소 ${range.label}`, { exact: true })
      const maximum = page.getByLabel(`최대 ${range.label}`, { exact: true })
      await minimum.fill(range.maximum)
      await maximum.fill(range.minimum)
      await submit.click()
      await expect(page.getByText('각 범위의 최소값은 최대값보다 클 수 없습니다.', { exact: true })).toBeVisible()
      await expect(page).toHaveURL((url) => url.pathname === '/advanced-search')
      expect(comprehensiveRequests).toHaveLength(0)
      await minimum.fill('')
      await maximum.fill('')
    })
  }

  for (const invalid of [
    { label: '최소 감정가', value: '-1', message: '사건번호·금액·유찰수는 0 이상의 정수로 입력해 주세요.' },
    { label: '최대 유찰수', value: '1.5', message: '사건번호·금액·유찰수는 0 이상의 정수로 입력해 주세요.' },
    { label: '최소 건물면적(평)', value: 'abc', message: '면적은 0 이상의 숫자로 입력해 주세요.' },
    { label: '최대 토지면적(평)', value: '-0.5', message: '면적은 0 이상의 숫자로 입력해 주세요.' },
  ]) {
    await test.step(`${invalid.label}의 잘못된 입력 차단`, async () => {
      const input = page.getByLabel(invalid.label, { exact: true })
      await input.fill(invalid.value)
      await submit.click()
      await expect(page.getByText(invalid.message, { exact: true })).toBeVisible()
      await expect(page).toHaveURL((url) => url.pathname === '/advanced-search')
      expect(comprehensiveRequests).toHaveLength(0)
      await input.fill('')
    })
  }
})

for (const bound of ['minimum', 'maximum'] as const) {
  test(`물결표 범위에서 ${bound === 'minimum' ? '최소값' : '최대값'}만 입력해 검색한다`, async ({ page }) => {
    await prepareSearchPageApis(page)
    await page.goto('/advanced-search')

    for (const range of advancedRanges) {
      await page.getByLabel(`${bound === 'minimum' ? '최소' : '최대'} ${range.label}`, { exact: true }).fill(range[bound])
    }
    const requestPromise = page.waitForRequest((request) => (
      new URL(request.url()).pathname === '/api/v1/search/comprehensive'
    ))
    await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()
    const requestUrl = new URL((await requestPromise).url())
    await expect(page).toHaveURL((url) => url.pathname === '/search')
    const resultUrl = new URL(page.url())

    for (const url of [requestUrl, resultUrl]) {
      for (const range of advancedRanges) {
        expect(url.searchParams.get(`${bound === 'minimum' ? 'min' : 'max'}_${range.key}`)).toBe(range[bound])
        expect(url.searchParams.has(`${bound === 'minimum' ? 'max' : 'min'}_${range.key}`)).toBe(false)
      }
      expect(url.searchParams.get('sort_by')).toBe('auction_date_asc')
      expect(url.searchParams.has('half_price')).toBe(false)
    }
    await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  })
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 780 },
]) {
  test(`${viewport.width}px 종합검색의 기존 압축 배치를 유지하며 조건을 수정하고 검색한다`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.fallback() : route.abort()
    })
    await prepareSearchPageApis(page)
    await prepareCourtDivisionOptions(page)
    const comprehensiveRequests: URL[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/v1/search/comprehensive') comprehensiveRequests.push(url)
    })
    await page.goto('/advanced-search')
    await expect(page.getByRole('heading', { name: '경매 종합 상세검색', exact: true })).toBeVisible()

    const submit = page.getByRole('button', { name: '종합검색 결과 보기', exact: true })
    const form = page.getByTestId('advanced-search-form')
    await expect(form).toHaveJSProperty('tagName', 'FORM')
    await expect(form.getByLabel('통합 검색어', { exact: true })).toHaveCount(0)
    await expect(form.locator('section')).toHaveCount(0)
    for (const heading of ['기본 및 일정', '지역·사건·물건', '가격·유찰·면적 범위']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toHaveCount(0)
    }
    const removedRows = form.getByTestId('advanced-filter-row')
    await expect(removedRows).toHaveCount(0)
    const controlSizes = await form.locator('input:not([type="checkbox"]), select').evaluateAll((controls) => (
      controls.map((control) => ({
        label: control instanceof HTMLInputElement || control instanceof HTMLSelectElement
          ? control.labels?.[0]?.textContent?.trim() ?? control.id
          : control.tagName,
        height: control.getBoundingClientRect().height,
      }))
    ))
    expect(controlSizes.length).toBeGreaterThan(20)
    for (const control of controlSizes) {
      expect(control.height, `${control.label} 입력칸 높이`).toBeGreaterThanOrEqual(28)
      expect(control.height, `${control.label} 입력칸 높이`).toBeLessThanOrEqual(36)
    }

    for (const range of advancedRanges) {
      const group = form.getByRole('group', { name: range.label, exact: true })
      await expect(group).toBeVisible()
      await expect(group.locator('input')).toHaveCount(2)
      await expect(group.getByText('~', { exact: true })).toBeVisible()
      for (const bound of ['최소', '최대']) {
        await expect(group.getByLabel(`${bound} ${range.label}`, { exact: true })).toHaveAttribute('inputmode', range.inputMode)
      }
    }
    await expect(form.getByLabel('감정가 대비 최저가 50% 이하', { exact: true })).toHaveCount(0)
    await expect(form.getByLabel('정렬', { exact: true })).toHaveCount(0)

    await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '서울중앙지방법원' })
    await expect(page.getByLabel('경매계', { exact: true })).toBeEnabled()
    await page.getByLabel('경매계', { exact: true }).selectOption({ label: '경매11계' })
    await page.getByLabel('매각기일 시작일', { exact: true }).fill('2026-09-01')
    await page.getByLabel('매각기일 종료일', { exact: true }).fill('2026-09-30')
    await page.getByLabel('사건 연도', { exact: true }).selectOption('2025')
    await page.getByRole('textbox', { name: '사건번호', exact: true }).fill('52202')
    await page.getByLabel('현재상태', { exact: true }).selectOption({ label: '유찰' })
    await page.getByLabel('아파트', { exact: true }).check()
    await page.getByLabel('오피스텔', { exact: true }).check()
    await expect(page.getByLabel('아파트', { exact: true })).toBeChecked()
    await expect(page.getByLabel('오피스텔', { exact: true })).toBeChecked()
    for (const range of advancedRanges) {
      await page.getByLabel(`최소 ${range.label}`, { exact: true }).fill(range.minimum)
      await page.getByLabel(`최대 ${range.label}`, { exact: true }).fill(range.maximum)
    }

    const layout = await form.evaluate((element) => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      formWidth: element.clientWidth,
      formScrollWidth: element.scrollWidth,
    }))
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.formScrollWidth).toBeLessThanOrEqual(layout.formWidth)
    const caseNumberGroup = page.getByTestId('advanced-case-number')
    const caseControls = await Promise.all([
      caseNumberGroup.getByLabel('사건 연도', { exact: true }),
      caseNumberGroup.getByText('타경', { exact: true }),
      caseNumberGroup.getByRole('textbox', { name: '사건번호', exact: true }),
    ].map((locator) => locator.evaluate((element) => {
      const { left, right, top, height } = element.getBoundingClientRect()
      return { left, right, centerY: top + height / 2 }
    })))
    for (const [index, control] of caseControls.entries()) {
      expect(Math.abs(control.centerY - caseControls[0].centerY), '사건 연도·타경·번호가 같은 행에 배치').toBeLessThanOrEqual(2)
      if (index > 0) {
        expect(control.left, '사건 연도 → 타경 → 번호 순서로 겹침 없이 배치').toBeGreaterThanOrEqual(caseControls[index - 1].right)
      }
    }
    const caseTypeLeftGap = caseControls[1].left - caseControls[0].right
    const caseTypeRightGap = caseControls[2].left - caseControls[1].right
    expect(Math.abs(caseTypeLeftGap - caseTypeRightGap), '타경 앞뒤 여백 동일').toBeLessThanOrEqual(1)
    await caseNumberGroup.screenshot({ path: testInfo.outputPath('advanced-search-case-number.png') })

    const compactRows = [
      {
        id: 'advanced-basic-filters',
        labels: ['사건 연도', '사건번호', '건물명', '시/도', '시/군/구', '읍/면/동'],
      },
      {
        id: 'advanced-property-filters',
        labels: ['관할법원', '경매계', '경매종류', '현재상태', '매각기일 시작일', '매각기일 종료일'],
      },
      {
        id: 'advanced-range-filters',
        labels: ['이해관계인 구분', '이해관계인 이름', '최소 건물면적(평)', '최대 건물면적(평)', '최소 토지면적(평)', '최대 토지면적(평)'],
      },
      {
        id: 'advanced-area-filters',
        labels: ['최소 유찰수', '최대 유찰수', '최소 감정가', '최대 감정가', '최소 최저가', '최대 최저가'],
      },
    ]
    for (const row of compactRows) {
      const container = form.getByTestId(row.id)
      for (const label of row.labels) {
        await expect(container.getByLabel(label, { exact: true }).and(page.locator('input, select'))).toBeVisible()
      }
      const bounds = await container.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
      expect(bounds.scrollWidth, `${row.id} 가로 넘침 없음`).toBeLessThanOrEqual(bounds.width)
      if (viewport.width >= 1024) {
        expect(row.labels).toHaveLength(6)
        await expect(container.locator('input, select')).toHaveCount(6)
        const controls = await Promise.all(row.labels.map(async (label) => ({
          label,
          ...await container.getByLabel(label, { exact: true }).and(page.locator('input, select')).evaluate((control) => {
            const { top, left, right, width } = control.getBoundingClientRect()
            return { top, left, right, width }
          }),
        })))
        for (const [index, control] of controls.entries()) {
          expect(control.width, `${control.label} 입력칸 너비`).toBeGreaterThan(0)
          expect(Math.abs(control.top - controls[0].top), `${control.label} 기존 한 줄 배치 유지`).toBeLessThanOrEqual(2)
          if (index > 0) expect(control.left).toBeGreaterThanOrEqual(controls[index - 1].right)
        }
      }
    }
    if (viewport.width >= 1024) {
      const singleFieldLabels = ['시/도', '시/군/구', '읍/면/동', '관할법원', '경매계', '경매종류', '건물명', '이해관계인 구분', '이해관계인 이름', '현재상태']
      const singleWidths = await Promise.all(singleFieldLabels.map((label) => (
        form.getByLabel(label, { exact: true }).evaluate((element) => element.getBoundingClientRect().width)
      )))
      for (const width of singleWidths) {
        expect(Math.abs(width - singleWidths[0]), '일반 입력칸 너비 통일').toBeLessThanOrEqual(1)
      }
      const caseYearCellWidth = await caseNumberGroup.getByText('타경', { exact: true }).locator('..').evaluate((element) => element.getBoundingClientRect().width)
      const caseSerialWidth = await caseNumberGroup.getByRole('textbox', { name: '사건번호', exact: true }).evaluate((element) => element.getBoundingClientRect().width)
      expect(Math.abs(caseYearCellWidth - singleWidths[0]), '연도와 타경을 합쳐 기본 한 칸 너비').toBeLessThanOrEqual(1)
      expect(Math.abs(caseSerialWidth - singleWidths[0]), '사건번호 입력은 기본 한 칸 너비').toBeLessThanOrEqual(1)
      const gap = await form.getByTestId('advanced-basic-filters').evaluate((element) => parseFloat(getComputedStyle(element).columnGap))
      for (const name of ['사건번호', '매각기일']) {
        const width = await form.getByRole('group', { name, exact: true }).evaluate((element) => element.getBoundingClientRect().width)
        expect(Math.abs(width - (singleWidths[0] * 2 + gap)), `${name}는 기본 두 칸 너비`).toBeLessThanOrEqual(1)
      }
      const rangeWidths = await Promise.all(advancedRanges.map(({ label }) => (
        form.getByRole('group', { name: label, exact: true }).evaluate((element) => element.getBoundingClientRect().width)
      )))
      for (const width of rangeWidths) {
        expect(Math.abs(width - rangeWidths[0]), '가격·유찰·면적 범위 너비 통일').toBeLessThanOrEqual(1)
        expect(Math.abs(width - (singleWidths[0] * 2 + gap)), '범위 입력은 기본 두 칸 너비').toBeLessThanOrEqual(1)
      }
    }
    const orderedContainers = await Promise.all([
      'advanced-basic-filters', 'advanced-property-filters', 'advanced-range-filters', 'advanced-area-filters', 'advanced-usage-options',
    ].map((id) => form.getByTestId(id).evaluate((element) => {
      const { top, bottom } = element.getBoundingClientRect()
      return { top, bottom }
    })))
    for (let index = 1; index < orderedContainers.length; index++) {
      expect(orderedContainers[index].top, '지역·사건번호 → 매각기일 → 가격·면적 → 물건종류 순서 유지').toBeGreaterThanOrEqual(orderedContainers[index - 1].bottom)
    }
    const usage = form.getByTestId('advanced-usage-options')
    for (const title of ['주거용', '상업용', '토지', '차량 및 중장비', '기타']) {
      await expect(usage.locator('p').filter({ hasText: title })).toBeVisible()
    }
    for (const [label, inputLabel] of [
      ['매각기일', '매각기일 시작일'], ['관할법원', '관할법원'], ['경매계', '경매계'],
      ['시/도', '시/도'], ['시/군/구', '시/군/구'], ['읍/면/동', '읍/면/동'],
      ['사건번호', '사건 연도'], ['경매종류', '경매종류'], ['건물명', '건물명'],
      ['이해관계인 구분', '이해관계인 구분'], ['이해관계인 이름', '이해관계인 이름'], ['현재상태', '현재상태'],
      ...advancedRanges.map(({ label }) => [label, `최소 ${label}`]),
    ]) {
      const labelBottom = await form.getByText(label, { exact: true }).and(page.locator('span, legend, label'))
        .evaluate((element) => element.getBoundingClientRect().bottom)
      const inputTop = await form.getByLabel(inputLabel, { exact: true }).and(page.locator('input, select'))
        .evaluate((element) => element.getBoundingClientRect().top)
      expect(labelBottom, `${label} 항목명을 입력칸 위에 유지`).toBeLessThanOrEqual(inputTop)
    }
    const buttonWidth = await submit.evaluate((element) => element.getBoundingClientRect().width)
    expect(buttonWidth).toBeGreaterThanOrEqual(layout.formWidth - 2)
    await form.screenshot({ path: testInfo.outputPath('advanced-search-compact-preserved.png') })

    await page.getByLabel('최대 최저가', { exact: true }).fill('10000000')
    await submit.click()
    await expect(page.getByText('각 범위의 최소값은 최대값보다 클 수 없습니다.', { exact: true })).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/advanced-search')
    expect(comprehensiveRequests).toHaveLength(0)

    await page.getByLabel('최대 최저가', { exact: true }).fill('100000000')
    const requestPromise = page.waitForRequest((request) => (
      new URL(request.url()).pathname === '/api/v1/search/comprehensive'
    ))
    await submit.click()
    const requestUrl = new URL((await requestPromise).url())
    for (const range of advancedRanges) {
      expect(requestUrl.searchParams.get(`min_${range.key}`)).toBe(range.minimum)
      expect(requestUrl.searchParams.get(`max_${range.key}`)).toBe(range.maximum)
    }
    expect(requestUrl.searchParams.get('sort_by')).toBe('auction_date_asc')
    expect(requestUrl.searchParams.has('q')).toBe(false)
    expect(requestUrl.searchParams.has('half_price')).toBe(false)
    expect(requestUrl.searchParams.get('division_name')).toBe('경매11계')
    expect(requestUrl.searchParams.get('case_year')).toBe('2025')
    expect(requestUrl.searchParams.get('case_serial')).toBe('52202')
    expect(requestUrl.searchParams.get('status')).toBe('유찰')
    expect(requestUrl.searchParams.getAll('goods_usage')).toEqual(expect.arrayContaining(['아파트', '오피스텔']))
    await expect(page).toHaveURL((url) => (
      url.pathname === '/search' &&
      url.searchParams.get('search_type') === 'comprehensive' &&
      url.searchParams.get('case_year') === '2025' &&
      url.searchParams.get('case_serial') === '52202' &&
      url.searchParams.get('status') === '유찰' &&
      url.searchParams.get('sort_by') === 'auction_date_asc' &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('half_price') &&
      advancedRanges.every((range) => (
        url.searchParams.get(`min_${range.key}`) === range.minimum &&
        url.searchParams.get(`max_${range.key}`) === range.maximum
      ))
    ))
    await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  })
}
