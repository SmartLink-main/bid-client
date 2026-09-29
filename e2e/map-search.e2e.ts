import { expect, test, type Page } from '@playwright/test'

const SUBWAY_API_PATHS = new Set([
  '/api/v1/geo/station-facets',
  '/api/v1/geo/stations',
  '/api/v1/geo/subway',
])

type ReverseRegionCall = {
  longitude: number
  latitude: number
}

async function stubReverseRegion(page: Page) {
  const calls: ReverseRegionCall[] = []
  const pendingReleases: Array<() => void> = []
  const pendingRequestWaiters: Array<() => void> = []
  await page.route('**/api/v1/geo/reverse-region?**', async (route) => {
    const url = new URL(route.request().url())
    const longitude = Number(url.searchParams.get('longitude'))
    const latitude = Number(url.searchParams.get('latitude'))
    calls.push({ longitude, latitude })
    await new Promise<void>((resolve) => {
      pendingReleases.push(resolve)
      pendingRequestWaiters.shift()?.()
    })
    const requestOrigin = route.request().headers().origin ?? 'http://127.0.0.1:3102'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': requestOrigin,
      },
      body: JSON.stringify({
        coordinate_system: 'WGS84',
        center: { longitude, latitude },
        region: {
          legal_dong_code: '4711311700',
          province: '경상북도',
          sigungu: '포항시 북구',
          dong: '용흥동',
        },
      }),
    })
  })
  return {
    calls,
    releaseNext: async () => {
      if (pendingReleases.length === 0) {
        await new Promise<void>((resolve) => pendingRequestWaiters.push(resolve))
      }
      const release = pendingReleases.shift()
      if (!release) throw new Error('No reverse-region request is waiting to be released.')
      release()
    },
  }
}

async function prepareAnonymousSession(page: Page) {
  await page.route('**/api/v1/refresh', async (route) => {
    const requestOrigin = route.request().headers().origin ?? 'http://127.0.0.1:3102'
    const corsHeaders = {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': requestOrigin,
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ detail: 'E2E session is intentionally anonymous.' }),
    })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    bodyHeight: document.body.scrollHeight,
    scrollY: window.scrollY,
  }))

  expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.viewportWidth,
  )
  expect(layout.bodyWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.viewportWidth,
  )
  expect(layout.documentHeight, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewportHeight + 1)
  expect(layout.bodyHeight, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewportHeight + 1)
  expect(layout.scrollY).toBe(0)

  const locationFilters = page.getByRole('group', { name: '지도 소재지' })
  await expect(locationFilters.getByRole('combobox')).toHaveCount(3)
  await expect(page.getByLabel('물건종류')).toHaveCount(1)

  const resultsPanel = page.getByRole('complementary', { name: '현재 화면의 물건 목록' })
  for (const control of [
    resultsPanel.getByLabel('물건종류'),
    resultsPanel.getByLabel('최저가 최소'),
    resultsPanel.getByLabel('최저가 최대'),
    resultsPanel.getByRole('button', { name: '조건 초기화' }),
  ]) {
    await expect(control).toBeVisible()
    await expect(control).toBeInViewport()
  }

  const [mainBox, mapBox] = await Promise.all([
    page.getByRole('main').boundingBox(),
    page.locator('.leaflet-container').boundingBox(),
  ])
  expect(mainBox).not.toBeNull()
  expect(mapBox).not.toBeNull()
  expect(mapBox!.y - mainBox!.y).toBeGreaterThanOrEqual(0)
  expect(mapBox!.y - mainBox!.y).toBeLessThanOrEqual(16)
  expect(mapBox!.height).toBeGreaterThan(mainBox!.height * 0.55)

  const selectBoxes = await page.locator('select').evaluateAll((elements) => (
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    })
  ))
  expect(selectBoxes).toHaveLength(4)
  for (const box of selectBoxes) {
    expect(box.width, JSON.stringify(box)).toBeGreaterThan(0)
    expect(box.left, JSON.stringify(box)).toBeGreaterThanOrEqual(0)
    expect(box.right, JSON.stringify(box)).toBeLessThanOrEqual(
      layout.viewportWidth,
    )
  }
}

async function expectLocationOverlayInsideMap(page: Page) {
  const locationFilters = page.getByRole('group', { name: '지도 소재지' })
  const mapRegion = page.getByRole('region', { name: '경매물건 지도' })
  await expect(locationFilters).toBeVisible()
  await expect(mapRegion).toBeVisible()

  const [locationBox, mapBox, zoomBox] = await Promise.all([
    locationFilters.boundingBox(),
    mapRegion.boundingBox(),
    page.locator('.leaflet-control-zoom').boundingBox(),
  ])
  expect(locationBox).not.toBeNull()
  expect(mapBox).not.toBeNull()
  expect(mapBox!.y).toBeGreaterThanOrEqual(0)
  expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  expect(locationBox!.x).toBeGreaterThanOrEqual(mapBox!.x)
  expect(locationBox!.y).toBeGreaterThanOrEqual(mapBox!.y)
  expect(locationBox!.x + locationBox!.width).toBeLessThanOrEqual(mapBox!.x + mapBox!.width)
  expect(locationBox!.y + locationBox!.height).toBeLessThanOrEqual(mapBox!.y + mapBox!.height)
  if (zoomBox) {
    expect(locationBox!.x).toBeGreaterThanOrEqual(zoomBox.x + zoomBox.width)
  }
}

async function openMapSearch(page: Page) {
  const subwayApiRequests: string[] = []
  let osmTileRequests = 0
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (SUBWAY_API_PATHS.has(pathname)) subwayApiRequests.push(pathname)
  })
  await prepareAnonymousSession(page)
  await page.route('https://tile.openstreetmap.org/**', (route) => {
    osmTileRequests += 1
    return route.fulfill({ status: 204, body: '' })
  })
  const initialResponsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/geo/map' &&
    response.request().method() === 'GET'
  ))
  await page.goto('/map-search')
  await expect(page.getByRole('heading', { name: '지도 영역 경매물건 찾기' })).toHaveClass(/sr-only/)
  await expect.poll(() => osmTileRequests).toBeGreaterThan(0)
  await expect(page.locator('.leaflet-control-attribution').getByRole('link', {
    name: 'OpenStreetMap',
  })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
  await expect(page.locator('.leaflet-control-attribution').getByRole('link', {
    name: 'Leaflet',
  })).toHaveCount(0)
  await expect(page.getByRole('link', {
    name: '지도 및 행정구역 데이터 출처와 이용조건 보기',
  })).toHaveAttribute('href', '/data-licenses')
  const initialResponse = await initialResponsePromise
  expect(initialResponse.status()).toBe(200)
  expect(new URL(initialResponse.url()).searchParams.has('q')).toBe(false)
  for (const name of ['sido', 'sigungu', 'dong', 'region']) {
    expect(new URL(initialResponse.url()).searchParams.has(name)).toBe(false)
  }
  await expect(page.getByRole('group', { name: '검색 반경' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '수도권 지역' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '반경 안 물건 찾기' })).toHaveCount(0)
  expect(subwayApiRequests).toEqual([])
  await expect(page.getByRole('button', {
    name: /^(이 지도에서 검색|현재 영역 다시 검색|이 지도에서 다시 검색)$/,
  })).toHaveCount(0)
  await expect(page.locator('button[type="submit"]')).toHaveCount(0)
  await expect(page.getByLabel('통합 검색어')).toHaveCount(0)
  await expect(page.getByPlaceholder('사건번호, 건물명, 주소')).toHaveCount(0)
  await expectLocationOverlayInsideMap(page)
  await expectNoHorizontalOverflow(page)
  return subwayApiRequests
}

test.describe('지도 영역 검색 선택형 필터 브라우저 E2E', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('지도와 행정구역 데이터의 출처 및 배포 라이선스를 확인할 수 있다', async ({ page }) => {
    await prepareAnonymousSession(page)
    await page.goto('/data-licenses')

    await expect(page.getByRole('heading', {
      name: '지도·데이터 출처 및 라이선스',
    })).toBeVisible()
    await expect(page.getByRole('heading', {
      name: '베이스 지도 · OpenStreetMap',
    })).toBeVisible()
    await expect(page.getByRole('heading', {
      name: '행정구역 확대 데이터',
    })).toBeVisible()
    await expect(page.getByRole('heading', {
      name: '지도 라이브러리 고지',
    })).toBeVisible()
    await expect(page.getByText(
      'OpenStreetMap Overpass API + 국토교통부 VWorld',
      { exact: true },
    )).toBeVisible()
    await expect(page.getByText('공공누리 제1유형 (출처표시)', {
      exact: true,
    })).toBeVisible()
    await expect(page.getByRole('link', {
      name: /OpenStreetMap 저작권·ODbL 안내/,
    })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    await expect(page.getByRole('link', {
      name: /국토교통부 행정구역도 공식 데이터/,
    })).toHaveAttribute('href', 'https://www.data.go.kr/data/15059008/openapi.do')

    await page.screenshot({
      path: 'test-results/playwright-map-search/map-data-license-notice-final.png',
      fullPage: true,
    })

    await page.getByText('Leaflet · BSD 2-Clause License', { exact: true }).click()
    await expect(page.locator('pre').first()).toContainText(
      'Copyright (c) 2010-2023, Volodymyr Agafonkin',
    )
    await page.getByText(
      'React Leaflet · Hippocratic License 2.1 / MIT',
      { exact: true },
    ).click()
    await expect(page.locator('pre').nth(1)).toContainText(
      'Hippocratic License Version Number: 2.1.',
    )

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
      layout.viewportWidth,
    )
    expect(layout.bodyWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
      layout.viewportWidth,
    )
  })

  test('전체 메뉴가 지도 위에서 배경 스크롤을 잠그고 커서가 벗어나면 닫힌다', async ({ page }) => {
    await openMapSearch(page)

    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()

    const drawer = page.getByTestId('sidebar-drawer')
    const backdrop = page.getByTestId('sidebar-backdrop')
    const locationFilters = page.getByRole('group', { name: '지도 소재지' })
    await expect(drawer).toBeVisible()
    await expect(backdrop).toBeVisible()
    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await expect.poll(async () => {
      const box = await drawer.boundingBox()
      return box ? Math.round(box.x + box.width) : null
    }).toBe(page.viewportSize()!.width)

    const [drawerBox, locationBox] = await Promise.all([
      drawer.boundingBox(),
      locationFilters.boundingBox(),
    ])
    expect(drawerBox).not.toBeNull()
    expect(locationBox).not.toBeNull()
    const overlap = {
      left: Math.max(drawerBox!.x, locationBox!.x),
      top: Math.max(drawerBox!.y, locationBox!.y),
      right: Math.min(
        drawerBox!.x + drawerBox!.width,
        locationBox!.x + locationBox!.width,
      ),
      bottom: Math.min(
        drawerBox!.y + drawerBox!.height,
        locationBox!.y + locationBox!.height,
      ),
    }
    expect(overlap.right).toBeGreaterThan(overlap.left)
    expect(overlap.bottom).toBeGreaterThan(overlap.top)

    const overlapPoint = {
      x: (overlap.left + overlap.right) / 2,
      y: (overlap.top + overlap.bottom) / 2,
    }
    const drawerOwnsTopElement = await page.evaluate(({ x, y }) => {
      const menu = document.querySelector('[data-testid="sidebar-drawer"]')
      const topElement = document.elementFromPoint(x, y)
      return Boolean(menu && topElement && menu.contains(topElement))
    }, overlapPoint)
    expect(drawerOwnsTopElement).toBe(true)

    await page.mouse.move(overlapPoint.x, overlapPoint.y)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(100)
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await page.screenshot({
      path: 'test-results/playwright-map-search/sidebar-map-layering-final.png',
    })

    await page.mouse.move(20, Math.min(page.viewportSize()!.height - 20, 500))
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
    await expect(backdrop).toHaveCount(0)
    await expect(page.getByRole('button', { name: '전체 메뉴 열기' })).toHaveAttribute('aria-expanded', 'false')
    await expectNoHorizontalOverflow(page)
  })

  test('지도 이동과 조건 변경 후 검색 버튼 없이 현재 영역을 자동 검색한다', async ({ page }) => {
    const reverseRegionStub = await stubReverseRegion(page)
    const reverseRegionCalls = reverseRegionStub.calls
    const subwayApiRequests = await openMapSearch(page)

    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
    await expect(page.getByRole('link', { name: '지도 영역 검색', exact: true })).toHaveAttribute(
      'href',
      '/map-search',
    )
    await expect(page.getByRole('link', { name: '역세권 반경 검색', exact: true })).toHaveAttribute(
      'href',
      '/subway-search',
    )
    await page.getByRole('button', { name: '전체 메뉴 닫기' }).click()
    await page.mouse.move(20, Math.min(page.viewportSize()!.height - 20, 500))
    await expect(page.getByTestId('sidebar-drawer')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)

    const provinceSelect = page.getByLabel('시·도')
    const sigunguSelect = page.getByLabel('시·군·구')
    const dongSelect = page.getByLabel('읍·면·동')
    const propertyTypeSelect = page.getByLabel('물건종류')

    await expect(provinceSelect).toHaveValue('')
    await expect(sigunguSelect).toBeDisabled()
    await expect(dongSelect).toBeDisabled()
    expect(reverseRegionCalls).toEqual([])
    await provinceSelect.selectOption({ label: '서울' })
    await expect(sigunguSelect).toBeEnabled()
    await expect(dongSelect).toBeDisabled()
    await sigunguSelect.selectOption({ label: '강남구' })
    await expect(page.getByRole('status')).toHaveText(
      '서울 강남구 지역으로 지도 이동이 완료되었습니다.',
    )
    await expect(sigunguSelect).toHaveValue('강남구')
    await expect(dongSelect).toBeEnabled()
    await dongSelect.selectOption({ label: '역삼동' })
    await expect(page.getByRole('status')).toHaveText(
      '서울 강남구 역삼동 지역으로 지도 이동이 완료되었습니다.',
    )

    await provinceSelect.selectOption({ label: '경북' })
    await expect(page.getByRole('status')).toHaveText(
      '경북 지역으로 지도 이동이 완료되었습니다.',
    )
    await expect(sigunguSelect).toHaveValue('')
    await expect(dongSelect).toBeDisabled()
    await expect(dongSelect).toHaveValue('')
    await expect(sigunguSelect.locator('option', { hasText: '강남구' })).toHaveCount(0)
    await sigunguSelect.selectOption({ label: '포항시 북구' })
    await expect(page.getByRole('status')).toHaveText(
      '경북 포항시 북구 지역으로 지도 이동이 완료되었습니다.',
    )
    await expect(dongSelect).toBeEnabled()
    await expect(dongSelect.locator('option')).toHaveCount(32)
    await dongSelect.selectOption({ label: '기계면' })
    await expect(page.getByRole('status')).toHaveText(
      '경북 포항시 북구 기계면 지역으로 지도 이동이 완료되었습니다.',
    )
    await dongSelect.selectOption({ label: '죽도동' })
    await expect(page.getByRole('status')).toHaveText(
      '경북 포항시 북구 죽도동 지역으로 지도 이동이 완료되었습니다.',
    )
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === '/api/v1/geo/map' &&
        response.request().method() === 'GET' &&
        url.searchParams.getAll('goods_usage').includes('상가')
      )
    })
    await propertyTypeSelect.selectOption({ label: '상가' })
    await expectNoHorizontalOverflow(page)
    const response = await responsePromise

    expect(response.status()).toBe(200)
    const requestUrl = new URL(response.url())
    for (const name of ['sido', 'sigungu', 'dong']) {
      expect(requestUrl.searchParams.has(name)).toBe(false)
    }
    expect(requestUrl.searchParams.has('q')).toBe(false)
    expect(requestUrl.searchParams.getAll('goods_usage')).toEqual([
      '상가',
      '상가,오피스텔,근린시설',
    ])
    expect(requestUrl.searchParams.has('region')).toBe(false)
    expect(requestUrl.searchParams.get('limit')).toBe('100')
    expect(requestUrl.searchParams.get('offset')).toBe('0')

    for (const key of ['west', 'south', 'east', 'north']) {
      expect(requestUrl.searchParams.has(key), `missing ${key} map bound`).toBe(true)
    }
    for (const key of ['station_id', 'radius_m', 'station_x', 'station_y']) {
      expect(requestUrl.searchParams.has(key), `unexpected subway parameter ${key}`).toBe(false)
    }
    const west = Number(requestUrl.searchParams.get('west'))
    const south = Number(requestUrl.searchParams.get('south'))
    const east = Number(requestUrl.searchParams.get('east'))
    const north = Number(requestUrl.searchParams.get('north'))
    for (const coordinate of [west, south, east, north]) {
      expect(Number.isFinite(coordinate)).toBe(true)
    }
    const jukdoBounds = {
      west: 129.34745737990448,
      south: 36.01415184529435,
      east: 129.371880598206,
      north: 36.03681901167773,
    }
    expect((west + east) / 2).toBeGreaterThan(129.34)
    expect((west + east) / 2).toBeLessThan(129.38)
    expect((south + north) / 2).toBeGreaterThan(36.01)
    expect((south + north) / 2).toBeLessThan(36.04)
    expect(west).toBeLessThanOrEqual(jukdoBounds.west)
    expect(south).toBeLessThanOrEqual(jukdoBounds.south)
    expect(east).toBeGreaterThanOrEqual(jukdoBounds.east)
    expect(north).toBeGreaterThanOrEqual(jukdoBounds.north)
    const viewportArea = (east - west) * (north - south)
    const jukdoArea = (
      (jukdoBounds.east - jukdoBounds.west) *
      (jukdoBounds.north - jukdoBounds.south)
    )
    const fittedMapBox = await page.locator('.leaflet-container').boundingBox()
    expect(fittedMapBox).not.toBeNull()
    // The actual viewport follows the available screen shape. A tall mobile map
    // necessarily shows more surrounding land than the selected dong rectangle.
    const projectedDongWidth = (jukdoBounds.east - jukdoBounds.west) * Math.cos((south + north) * Math.PI / 360)
    const dongAspectRatio = projectedDongWidth / (jukdoBounds.north - jukdoBounds.south)
    const mapAspectRatio = fittedMapBox!.width / fittedMapBox!.height
    const aspectExpansion = Math.max(mapAspectRatio / dongAspectRatio, dongAspectRatio / mapAspectRatio)
    expect(viewportArea / jukdoArea).toBeLessThan(aspectExpansion * 1.5)
    expect(west).toBeLessThan(east)
    expect(south).toBeLessThan(north)

    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', {
      name: /^(이 지도에서 검색|현재 영역 다시 검색|이 지도에서 다시 검색)$/,
    })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    expect(reverseRegionCalls).toEqual([])
    const mapRequestsAfterUserMove: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/v1/geo/map') {
        mapRequestsAfterUserMove.push(url.toString())
      }
    })
    const draggedResponsePromise = page.waitForResponse((draggedResponse) => {
      const url = new URL(draggedResponse.url())
      const bounds = ['west', 'south', 'east', 'north'].map((key) => (
        url.searchParams.has(key) ? Number(url.searchParams.get(key)) : Number.NaN
      ))
      return (
        url.pathname === '/api/v1/geo/map' &&
        draggedResponse.request().method() === 'GET' &&
        !url.searchParams.has('sido') &&
        !url.searchParams.has('sigungu') &&
        !url.searchParams.has('dong') &&
        url.searchParams.getAll('goods_usage').includes('상가') &&
        bounds.every(Number.isFinite) &&
        bounds[0] !== west
      )
    })
    const map = page.locator('.leaflet-container')
    const mapBox = await map.boundingBox()
    expect(mapBox).not.toBeNull()
    const startX = mapBox!.x + mapBox!.width / 2
    const startY = mapBox!.y + mapBox!.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 70, startY + 30, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByText('지도 중심 소재지 확인 중', { exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: '지도 소재지' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    await expect(provinceSelect).toHaveValue('경북')
    await expect(sigunguSelect).toHaveValue('포항시 북구')
    await expect(dongSelect).toHaveValue('죽도동')
    await reverseRegionStub.releaseNext()
    await expect(page.getByRole('status')).toHaveText(
      '경북 포항시 북구 용흥동 소재지가 지도 중심에 맞춰 자동으로 변경되었습니다.',
    )
    await expect(page.getByRole('group', { name: '지도 소재지' })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await expect(provinceSelect).toHaveValue('경북')
    await expect(sigunguSelect).toHaveValue('포항시 북구')
    await expect(dongSelect).toHaveValue('용흥동')
    const draggedResponse = await draggedResponsePromise
    expect(draggedResponse.status()).toBe(200)
    const draggedRequestUrl = new URL(draggedResponse.url())
    expect(draggedRequestUrl.searchParams.has('q')).toBe(false)
    expect(draggedRequestUrl.searchParams.has('sido')).toBe(false)
    expect(draggedRequestUrl.searchParams.has('sigungu')).toBe(false)
    expect(draggedRequestUrl.searchParams.has('dong')).toBe(false)
    const draggedBounds = ['west', 'south', 'east', 'north'].map((key) => (
      Number(draggedRequestUrl.searchParams.get(key))
    ))
    expect(draggedBounds.every(Number.isFinite)).toBe(true)
    expect(draggedBounds).not.toEqual([west, south, east, north])
    expect(reverseRegionCalls).toHaveLength(1)
    expect(Object.values(reverseRegionCalls[0]).every(Number.isFinite)).toBe(true)
    expect(mapRequestsAfterUserMove.every((requestUrl) => (
      !new URL(requestUrl).searchParams.has('dong')
    ))).toBe(true)

    const zoomedResponsePromise = page.waitForResponse((zoomedResponse) => {
      const url = new URL(zoomedResponse.url())
      return (
        url.pathname === '/api/v1/geo/map' &&
        zoomedResponse.request().method() === 'GET' &&
        !url.searchParams.has('sido') &&
        !url.searchParams.has('sigungu') &&
        !url.searchParams.has('dong') &&
        Number(url.searchParams.get('west')) !== draggedBounds[0]
      )
    })
    await page.locator('.leaflet-control-zoom-in').click()
    await reverseRegionStub.releaseNext()
    const zoomedResponse = await zoomedResponsePromise
    await expect(provinceSelect).toHaveValue('경북')
    await expect(sigunguSelect).toHaveValue('포항시 북구')
    await expect(dongSelect).toHaveValue('용흥동')
    expect(reverseRegionCalls).toHaveLength(2)
    await page.screenshot({
      path: 'test-results/playwright-map-search/map-license-compliance-final.png',
      fullPage: true,
    })

    const resetResponsePromise = page.waitForResponse((resetResponse) => {
      const url = new URL(resetResponse.url())
      return url.pathname === '/api/v1/geo/map' &&
        !url.searchParams.has('goods_usage') &&
        url.searchParams.get('west') !== new URL(zoomedResponse.url()).searchParams.get('west')
    })
    await page.getByRole('button', { name: '조건 초기화' }).click()
    await expect(page.getByRole('status')).toHaveText(
      '전국 지도로 이동이 완료되었습니다.',
    )
    await expect(provinceSelect).toHaveValue('')
    await expect(sigunguSelect).toBeDisabled()
    await expect(dongSelect).toBeDisabled()
    await expect(dongSelect).toHaveValue('')
    await expect(propertyTypeSelect).toHaveValue('')
    expect((await resetResponsePromise).status()).toBe(200)
    expect(subwayApiRequests).toEqual([])
  })

  test('지도 검색 서비스 연결이 끊겨도 자동으로 다시 연결한다', async ({ page }) => {
    await openMapSearch(page)

    const recoveryMinPrice = '123456789'
    let matchingAttempts = 0
    await page.route('**/api/v1/geo/map?**', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('min_lowest_sale_price') !== recoveryMinPrice) {
        await route.continue()
        return
      }

      matchingAttempts += 1
      if (matchingAttempts === 1) {
        await route.abort('connectionrefused')
        return
      }
      await route.continue()
    })

    const failedRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return (
        url.pathname === '/api/v1/geo/map' &&
        url.searchParams.get('min_lowest_sale_price') === recoveryMinPrice
      )
    })
    const recoveredResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === '/api/v1/geo/map' &&
        url.searchParams.get('min_lowest_sale_price') === recoveryMinPrice &&
        response.status() === 200
      )
    })

    const minimumPriceInput = page.getByLabel('최저가 최소')
    await minimumPriceInput.fill(recoveryMinPrice)
    await expect(minimumPriceInput).toHaveValue('123,456,789')
    await failedRequestPromise
    await expect(page.getByRole('alert')).toHaveText(
      '지도 검색 서비스에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.',
    )
    await expect(page.getByText('지도 검색 서비스에 다시 연결 중', {
      exact: true,
    })).toBeVisible()
    await expect(page.getByText(
      '지도 검색 서비스 연결을 복구하는 동안 잠시 기다려 주세요.',
      { exact: true },
    )).toBeVisible()
    await expect(page.getByText('연결 확인 중', { exact: true })).toBeVisible()
    await expect(page.getByText('현재 지도와 조건에 맞는 물건이 없습니다.', {
      exact: true,
    })).toHaveCount(0)

    const recoveredResponse = await recoveredResponsePromise
    expect(recoveredResponse.status()).toBe(200)
    expect(new URL(recoveredResponse.url()).searchParams.has('q')).toBe(false)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText('현재 지도 자동 검색 완료', {
      exact: true,
    })).toBeVisible()
    expect(matchingAttempts).toBe(2)
  })

  test('잘못된 가격 범위에서는 자동 검색을 차단하고 수정 후 재개한다', async ({ page }) => {
    await openMapSearch(page)

    const resultsPanel = page.getByRole('complementary', { name: '현재 화면의 물건 목록' })
    const propertyResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/geo/map' && url.searchParams.get('goods_usage') === '아파트'
    })
    await resultsPanel.getByLabel('물건종류').selectOption({ label: '아파트' })
    const propertyResponse = await propertyResponsePromise
    expect(propertyResponse.status()).toBe(200)
    const propertyRequestUrl = new URL(propertyResponse.url())

    const priceGroup = resultsPanel.getByRole('group', { name: '최저가 범위' })
    const minimumPriceInput = priceGroup.getByLabel('최저가 최소')
    const maximumPriceInput = priceGroup.getByLabel('최저가 최대')
    const priceSeparator = priceGroup.getByText('~', { exact: true })
    const [priceGroupBox, minimumBox, separatorBox, maximumBox] = await Promise.all([
      priceGroup.boundingBox(),
      minimumPriceInput.boundingBox(),
      priceSeparator.boundingBox(),
      maximumPriceInput.boundingBox(),
    ])
    expect(priceGroupBox).not.toBeNull()
    expect(minimumBox).not.toBeNull()
    expect(separatorBox).not.toBeNull()
    expect(maximumBox).not.toBeNull()
    expect(Math.abs(minimumBox!.y - maximumBox!.y)).toBeLessThanOrEqual(1)
    expect(minimumBox!.x + minimumBox!.width).toBeLessThanOrEqual(separatorBox!.x + 1)
    expect(separatorBox!.x + separatorBox!.width).toBeLessThanOrEqual(maximumBox!.x + 1)

    let sawInvalidRequest = false
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (
        url.pathname === '/api/v1/geo/map' &&
        url.searchParams.get('min_lowest_sale_price') === '200000000' &&
        url.searchParams.get('max_lowest_sale_price') === '100000000'
      ) {
        sawInvalidRequest = true
      }
    })
    await minimumPriceInput.fill('200000000')
    await maximumPriceInput.fill('100000000')
    await expect(minimumPriceInput).toHaveValue('200,000,000')
    await expect(maximumPriceInput).toHaveValue('100,000,000')

    await expect(page.getByRole('alert')).toHaveText(
      '최소 가격은 최대 가격보다 클 수 없습니다.',
    )
    await page.waitForTimeout(750)
    expect(sawInvalidRequest).toBe(false)

    const recoveredResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === '/api/v1/geo/map' &&
        url.searchParams.get('min_lowest_sale_price') === '200000000' &&
        url.searchParams.get('max_lowest_sale_price') === '300000000'
      )
    })
    await maximumPriceInput.fill('300000000')
    await expect(maximumPriceInput).toHaveValue('300,000,000')
    const recoveredResponse = await recoveredResponsePromise
    expect(recoveredResponse.status()).toBe(200)
    const recoveredRequestUrl = new URL(recoveredResponse.url())
    expect(recoveredRequestUrl.searchParams.has('q')).toBe(false)
    expect(recoveredRequestUrl.searchParams.getAll('goods_usage')).toEqual(['아파트'])
    for (const edge of ['west', 'south', 'east', 'north']) {
      expect(recoveredRequestUrl.searchParams.get(edge)).toBe(propertyRequestUrl.searchParams.get(edge))
    }
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })
})
