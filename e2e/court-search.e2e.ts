import { expect, test, type Locator, type Page } from '@playwright/test'

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

async function expectOptionSpacing(
  locator: Locator,
  expected: { gap: string; left: string; right: string },
) {
  const spacing = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      gap: style.columnGap,
      left: style.paddingLeft,
      right: style.paddingRight,
    }
  })
  expect(spacing).toEqual(expected)
}

const searchPages = [
  { path: '/court-search', heading: '법원별검색' },
  { path: '/region-search', heading: '지역별 검색' },
  { path: '/type-search', heading: '물건종류 검색' },
  { path: '/search?half_price=true', heading: '검색 결과' },
  { path: '/advanced-search', heading: '경매 종합 상세검색' },
  { path: '/schedules', heading: '경매 공고 일정' },
  { path: '/subway-search', heading: '역세권 경매물건 찾기' },
  { path: '/scheduled-search', heading: '첫 매각기일 미지정 물건' },
  { path: '/question-search', heading: '원하는 경매 물건을 문장으로 찾아보세요' },
  { path: '/special-search', heading: '특수물건 검색' },
  { path: '/npl-search', heading: 'NPL 후보 분석' },
] as const

async function readSearchPageFrame(page: Page, path: string) {
  await page.goto(path)

  return page.locator('main > div').first().evaluate((shell) => {
    const content = shell.firstElementChild
    if (!(content instanceof HTMLElement)) throw new Error('Search page content was not rendered.')

    const shellStyle = window.getComputedStyle(shell)
    const shellRect = shell.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()

    return {
      padding: {
        top: shellStyle.paddingTop,
        right: shellStyle.paddingRight,
        bottom: shellStyle.paddingBottom,
        left: shellStyle.paddingLeft,
      },
      content: {
        width: Math.round(contentRect.width),
        leftGutter: Math.round(contentRect.left - shellRect.left),
        rightGutter: Math.round(shellRect.right - contentRect.right),
      },
    }
  })
}

test('검색 페이지마다 의도한 바깥 여백과 콘텐츠 폭을 유지한다', async ({ page }) => {
  await prepareSearchPageApis(page)
  await page.setViewportSize({ width: 1280, height: 900 })

  for (const searchPage of searchPages) {
    await test.step(searchPage.path, async () => {
      const frame = await readSearchPageFrame(page, searchPage.path)
      await expect(page.getByRole('heading', { name: searchPage.heading, exact: true })).toBeVisible()

      if (searchPage.path === '/subway-search') {
        expect(frame.padding).toEqual({
          top: '24px',
          right: '0px',
          bottom: '24px',
          left: '0px',
        })
        expect(frame.content.width).toBe(1280)
        expect(Math.abs(frame.content.leftGutter - frame.content.rightGutter)).toBeLessThanOrEqual(1)
        return
      }

      if (searchPage.path === '/npl-search') {
        expect(frame.padding).toEqual({
          top: '24px',
          right: '16px',
          bottom: '24px',
          left: '16px',
        })
        expect(frame.content.width).toBe(1248)
        expect(Math.abs(frame.content.leftGutter - frame.content.rightGutter)).toBeLessThanOrEqual(1)
        return
      }

      expect(frame.padding).toEqual({
        top: '20px',
        right: '16px',
        bottom: '20px',
        left: '16px',
      })
      expect(frame.content.width).toBe(1024)
      expect(Math.abs(frame.content.leftGutter - frame.content.rightGutter)).toBeLessThanOrEqual(1)
    })
  }
})

test('시도 첫 줄은 좌우 여백을 맞추고 다음 줄은 왼쪽 정렬한다', async ({ page }) => {
  await prepareAnonymousPage(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/region-search')

  const provinceLayout = await page.getByTestId('region-province-options').evaluate((container) => {
    const containerRect = container.getBoundingClientRect()
    const rows = new Map<number, DOMRect[]>()

    container.querySelectorAll('button').forEach((button) => {
      const rect = button.getBoundingClientRect()
      const rowKey = Math.round(rect.top)
      rows.set(rowKey, [...(rows.get(rowKey) ?? []), rect])
    })

    const buttonWidths = [...container.querySelectorAll('button')]
      .map((button) => button.getBoundingClientRect().width)

    return {
      columnCount: window.getComputedStyle(container).gridTemplateColumns.split(' ').length,
      buttonWidthDifference: Math.max(...buttonWidths) - Math.min(...buttonWidths),
      rows: [...rows.values()].map((row) => {
        const sorted = row.sort((a, b) => a.left - b.left)
        return {
          count: sorted.length,
          left: sorted[0].left - containerRect.left,
          right: containerRect.right - sorted[sorted.length - 1].right,
        }
      }),
    }
  })

  expect(provinceLayout.columnCount).toBe(13)
  expect(provinceLayout.buttonWidthDifference).toBeLessThanOrEqual(1)
  expect(provinceLayout.rows).toHaveLength(2)
  expect(provinceLayout.rows.map((row) => row.count)).toEqual([13, 4])
  expect(Math.abs(provinceLayout.rows[0].left - provinceLayout.rows[0].right)).toBeLessThanOrEqual(1)
  expect(Math.abs(provinceLayout.rows[1].left - provinceLayout.rows[0].left)).toBeLessThanOrEqual(1)
  expect(provinceLayout.rows[1].right).toBeGreaterThan(provinceLayout.rows[1].left + 100)

  const districtJustify = await page.getByRole('button', { name: '경산시', exact: true })
    .evaluate((button) => window.getComputedStyle(button).justifyContent)
  expect(['normal', 'flex-start']).toContain(districtJustify)

  const districtOptions = page.getByTestId('region-district-options')
  const readDistrictLayout = () => districtOptions.evaluate((container) => {
    const containerRect = container.getBoundingClientRect()
    const style = window.getComputedStyle(container)
    const buttonRects = [...container.querySelectorAll('button')]
      .map((button) => button.getBoundingClientRect())
    const firstRowTop = Math.min(...buttonRects.map((rect) => rect.top))
    const firstRow = buttonRects
      .filter((rect) => Math.abs(rect.top - firstRowTop) <= 1)
      .sort((a, b) => a.left - b.left)

    return {
      padding: {
        top: style.paddingTop,
        right: style.paddingRight,
        bottom: style.paddingBottom,
        left: style.paddingLeft,
      },
      firstRowGutter: {
        left: firstRow[0].left - containerRect.left,
        right: containerRect.right - firstRow[firstRow.length - 1].right,
      },
      hasHorizontalOverflow: container.scrollWidth > container.clientWidth,
    }
  })

  const desktopDistrictLayout = await readDistrictLayout()
  expect(desktopDistrictLayout.padding).toEqual({
    top: '32px',
    right: '32px',
    bottom: '32px',
    left: '32px',
  })
  expect(Math.abs(desktopDistrictLayout.firstRowGutter.left - 32)).toBeLessThanOrEqual(1)
  expect(Math.abs(desktopDistrictLayout.firstRowGutter.right - 32)).toBeLessThanOrEqual(1)
  expect(desktopDistrictLayout.hasHorizontalOverflow).toBe(false)
  await expectOptionSpacing(
    page.getByRole('button', { name: '경산시', exact: true }),
    { gap: '12px', left: '8px', right: '0px' },
  )

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileDistrictLayout = await readDistrictLayout()
  expect(mobileDistrictLayout.padding).toEqual({
    top: '24px',
    right: '24px',
    bottom: '24px',
    left: '24px',
  })
  expect(Math.abs(mobileDistrictLayout.firstRowGutter.left - 24)).toBeLessThanOrEqual(1)
  expect(Math.abs(mobileDistrictLayout.firstRowGutter.right - 24)).toBeLessThanOrEqual(1)
  expect(mobileDistrictLayout.hasHorizontalOverflow).toBe(false)
  await expectOptionSpacing(
    page.getByRole('button', { name: '경산시', exact: true }),
    { gap: '12px', left: '8px', right: '0px' },
  )
})

test('검색 선택 항목의 체크표시 앞 여백을 넉넉하게 유지한다', async ({ page }) => {
  await prepareAnonymousPage(page)

  await test.step('물건종류 검색', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/type-search')
    await expectOptionSpacing(
      page.getByRole('button', { name: '전체보기', exact: true }),
      { gap: '8px', left: '8px', right: '8px' },
    )
    const categoryButton = page.getByRole('button', { name: '주거용', exact: true })
    await expectOptionSpacing(categoryButton, { gap: '8px', left: '28px', right: '12px' })
    await expectOptionSpacing(
      page.getByRole('button', { name: '아파트', exact: true }),
      { gap: '8px', left: '16px', right: '0px' },
    )
  })

  await test.step('특수물건 검색', async () => {
    await page.route('**/api/v1/search/special/types', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: ['유치권'] }),
    }))
    await page.goto('/special-search')
    await expectOptionSpacing(
      page.getByRole('button', { name: '유치권', exact: true }),
      { gap: '8px', left: '20px', right: '4px' },
    )
  })

  await test.step('종합검색', async () => {
    await page.goto('/advanced-search')
    await expectOptionSpacing(
      page.getByLabel('아파트', { exact: true }).locator('..'),
      { gap: '8px', left: '8px', right: '0px' },
    )
    await expectOptionSpacing(
      page.getByLabel('감정가 대비 최저가 50% 이하', { exact: true }).locator('..'),
      { gap: '8px', left: '20px', right: '4px' },
    )
  })
})

test('법원 행과 여러 줄 버튼의 세로 간격을 촘촘하게 유지한다', async ({ page }) => {
  await prepareAnonymousPage(page)
  await page.goto('/court-search')

  const courtSections = page.getByTestId('court-section')
  await expect(courtSections).toHaveCount(14)

  const spacing = await courtSections.first().evaluate((section) => {
    const sectionStyle = window.getComputedStyle(section)
    const options = section.querySelector<HTMLElement>('[data-testid="court-options"]')
    if (!options) throw new Error('Court options were not rendered.')
    const optionsStyle = window.getComputedStyle(options)
    return {
      paddingTop: sectionStyle.paddingTop,
      paddingBottom: sectionStyle.paddingBottom,
      rowGap: optionsStyle.rowGap,
    }
  })

  expect(spacing).toEqual({
    paddingTop: '16px',
    paddingBottom: '16px',
    rowGap: '8px',
  })
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
  await page.getByRole('button', { name: '물건 검색하기', exact: true }).click()

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

  const keywordInput = page.getByLabel('통합 검색어', { exact: true })
  await expect(keywordInput).toBeVisible()
  expect(await keywordInput.getAttribute('placeholder')).toBeNull()
  await expect(page.getByLabel('지역 통합검색 (선택 입력)', { exact: true })).toHaveCount(0)
  await expect(page.getByPlaceholder('주소 또는 건물명', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('사건번호', { exact: true })).toBeVisible()
  await expect(page.getByLabel('사건 일련번호', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('사건 연도 (1900 이상)', { exact: true })).toHaveCount(0)

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
  await page.getByLabel('사건번호', { exact: true }).fill('12345')
  await page.getByLabel('시/도', { exact: true }).selectOption({ label: '서울' })
  await page.getByLabel('시/군/구', { exact: true }).selectOption({ label: '강남구' })
  await page.getByLabel('읍/면/동', { exact: true }).selectOption({ label: '역삼동' })
  await page.getByLabel('경매종류', { exact: true }).selectOption({ label: '강제경매' })
  await page.getByLabel('이해관계인 구분', { exact: true }).selectOption({ label: '채권자' })
  await page.getByLabel('아파트', { exact: true }).check()
  await page.getByLabel('오피스텔', { exact: true }).check()

  const requestPromise = page.waitForRequest((request) => (
    new URL(request.url()).pathname === '/api/v1/search/comprehensive'
  ))
  await page.getByRole('button', { name: '종합검색 결과 보기', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/search' &&
    url.searchParams.get('search_type') === 'comprehensive' &&
    url.searchParams.get('court_code') === 'B000210' &&
    !url.searchParams.has('court_name') &&
    !url.searchParams.has('branch_name') &&
    url.searchParams.get('division_name') === '경매1계' &&
    url.searchParams.get('start_date') === '2026-09-01' &&
    url.searchParams.get('end_date') === '2026-09-30' &&
    url.searchParams.get('case_serial') === '12345' &&
    !url.searchParams.has('case_year') &&
    url.searchParams.get('sido') === '서울특별시' &&
    url.searchParams.get('sigungu') === '강남구' &&
    url.searchParams.get('dong') === '역삼동' &&
    !url.searchParams.has('region') &&
    url.searchParams.get('auction_kind') === '강제경매' &&
    url.searchParams.get('interested_party_role') === '채권자' &&
    [...url.searchParams.getAll('goods_usage')].sort().join('|') === [
      '상가,오피스텔,근린시설',
      '아파트',
      '오피스텔',
    ].sort().join('|')
  ))

  const requestUrl = new URL((await requestPromise).url())
  expect(requestUrl.searchParams.get('court_code')).toBe('B000210')
  expect(requestUrl.searchParams.get('division_name')).toBe('경매1계')
  expect(requestUrl.searchParams.get('start_date')).toBe('2026-09-01')
  expect(requestUrl.searchParams.get('end_date')).toBe('2026-09-30')
  expect(requestUrl.searchParams.get('case_serial')).toBe('12345')
  expect(requestUrl.searchParams.has('case_year')).toBe(false)
  expect(requestUrl.searchParams.get('sido')).toBe('서울특별시')
  expect(requestUrl.searchParams.get('sigungu')).toBe('강남구')
  expect(requestUrl.searchParams.get('dong')).toBe('역삼동')
  expect(requestUrl.searchParams.has('region')).toBe(false)
  expect(requestUrl.searchParams.get('auction_kind')).toBe('강제경매')
  expect(requestUrl.searchParams.get('interested_party_role')).toBe('채권자')
  expect(requestUrl.searchParams.getAll('goods_usage').sort()).toEqual([
    '상가,오피스텔,근린시설',
    '아파트',
    '오피스텔',
  ].sort())
  await expect(page.getByText('법원: 서울중앙지방법원', { exact: true })).toBeVisible()
  await expect(page.getByText('읍/면/동: 역삼동', { exact: true })).toBeVisible()
  await expect(page.getByText('경매종류: 강제경매', { exact: true })).toBeVisible()
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
