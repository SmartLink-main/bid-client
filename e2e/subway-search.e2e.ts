import { expect, test, type Locator, type Page } from '@playwright/test'

const API_BASE_URL = 'http://127.0.0.1:8102'

type StationSearchResponse = {
  total: number
  items: Array<{
    station_id: string
    name: string
    city: string
    areas: string[]
    lines: string[]
  }>
}

type StationFacetResponse = {
  cities: Array<{
    city: string
    label: string
    total: number
    lines: Array<{ line: string; total: number }>
  }>
}

type SubwaySearchResponse = {
  total: number
  station: { station_id: string; name: string; radius_m: number }
  items: Array<{ auction_goods_id: number; distance_m: number }>
}

type CenteredStationCase = {
  name: string
  line: string
  area: string
  stationId: string
  auctionGoodsId: number
  buildingName: string
  radiusM: 300 | 500 | 1000
  radiusLabel: '300m' | '500m' | '1km'
  summaryRadius: string
}

type StationMapGeometry = {
  map: { width: number; height: number }
  circle: { x: number; y: number; width: number; height: number }
  stationCenter: { x: number; y: number }
}

const CENTERED_STATION_CASES: readonly CenteredStationCase[] = [
  {
    name: '구로디지털단지역', line: '2호선', area: '구로구',
    stationId: 'kr-subway-edd48d14bd67443e', auctionGoodsId: 91_001,
    buildingName: '구로디지털단지역 중심 테스트 물건',
    radiusM: 300, radiusLabel: '300m', summaryRadius: '300m',
  },
  {
    name: '서울역', line: '1호선', area: '중구',
    stationId: 'kr-subway-257f337502138605', auctionGoodsId: 91_002,
    buildingName: '서울역 중심 테스트 물건',
    radiusM: 500, radiusLabel: '500m', summaryRadius: '500m',
  },
  {
    name: '삼성역', line: '2호선', area: '강남구',
    stationId: 'kr-subway-56a18d55cf183d29', auctionGoodsId: 91_003,
    buildingName: '삼성역 중심 테스트 물건',
    radiusM: 1000, radiusLabel: '1km', summaryRadius: '1,000m',
  },
]

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

async function openSubwaySearch(page: Page) {
  const mapApiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/geo/map') {
      mapApiRequests.push(request.url())
    }
  })
  await prepareAnonymousSession(page)
  await page.route('https://tile.openstreetmap.org/**', (route) => (
    route.fulfill({ status: 204, body: '' })
  ))
  const facetsResponsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/geo/station-facets'
  ))
  await page.goto('/subway-search')
  await expect(page.getByRole('heading', { name: '역세권 경매물건 찾기' })).toBeVisible()
  await expect(page.getByText('선택한 역 중심 직선거리 기준 · 버튼 검색', {
    exact: true,
  })).toBeVisible()
  await expect(page.getByRole('link', { name: '지도 영역 검색', exact: true })).toHaveAttribute(
    'href',
    '/map-search',
  )
  await expect(page.getByText('좌표범위검색', { exact: true })).toHaveCount(0)
  await expect(page.getByText('OpenStreetMap · WGS84', { exact: true })).toHaveCount(0)
  await expect(page.getByPlaceholder('사건번호, 건물명, 주소')).toHaveCount(0)
  await expect(page.getByText('통합 검색어', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '역세권 반경 검색', exact: true })).toHaveAttribute(
    'href',
    '/subway-search',
  )

  const facetsResponse = await facetsResponsePromise
  expect(facetsResponse.status()).toBe(200)
  const facets = await facetsResponse.json() as StationFacetResponse
  expect(facets.cities).toContainEqual(expect.objectContaining({
    city: '서울',
    label: '수도권',
    lines: expect.arrayContaining([
      expect.objectContaining({ line: '1호선' }),
      expect.objectContaining({ line: '2호선' }),
      expect.objectContaining({ line: '4호선' }),
    ]),
  }))
  await expect(page.getByRole('tab', { name: '수도권 지역' })).toBeVisible()
  await expect(page.getByRole('group', { name: '소재지' })).toHaveCount(0)
  await expect(page.getByLabel('시·도')).toHaveCount(0)
  await expect(page.getByLabel('시·군·구')).toHaveCount(0)
  await expect(page.getByLabel('읍·면·동')).toHaveCount(0)
  await expect(page.getByPlaceholder('지역 (예: 강남구)')).toHaveCount(0)
  await expect(page.getByPlaceholder('용도 (아파트, 상가)')).toHaveCount(0)
  expect(mapApiRequests).toEqual([])
  return mapApiRequests
}

async function loadSeoulLine(page: Page, line: string, selectCity = true) {
  if (selectCity) await page.getByRole('tab', { name: '수도권 지역' }).click()

  const stationResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === '/api/v1/geo/stations' &&
      url.searchParams.get('city') === '서울' &&
      url.searchParams.get('line') === line &&
      url.searchParams.get('limit') === '500' &&
      !url.searchParams.has('q')
    )
  })
  await page.getByRole('button', { name: `${line} 노선`, exact: true }).click()
  const stationResponse = await stationResponsePromise
  expect(stationResponse.status()).toBe(200)
  const stations = await stationResponse.json() as StationSearchResponse
  expect(stations.items).toHaveLength(stations.total)
  return stations
}

async function loadRegionLine(
  page: Page,
  regionLabel: string,
  city: string,
  line: string,
) {
  await page.getByRole('tab', { name: `${regionLabel} 지역` }).click()
  const stationResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === '/api/v1/geo/stations' &&
      url.searchParams.get('city') === city &&
      url.searchParams.get('line') === line &&
      url.searchParams.get('limit') === '500'
    )
  })
  await page.getByRole('button', { name: `${line} 노선`, exact: true }).click()
  const response = await stationResponsePromise
  expect(response.status()).toBe(200)
  return await response.json() as StationSearchResponse
}

function stationChoice(page: Page, name: string, area: string) {
  const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return page.getByRole('radio', {
    name: new RegExp(`^${escapePattern(name)} 선택 - .*${escapePattern(area)}`),
  })
}

async function expectUnselectedResultButtons(page: Page, expectedCount: number) {
  const buttons = page.getByRole('button', { name: / 지도에서 선택$/ })
  await expect(buttons).toHaveCount(expectedCount)
  for (let index = 0; index < expectedCount; index += 1) {
    await expect(buttons.nth(index)).toHaveAttribute('aria-pressed', 'false')
  }
}

async function expectUniformWidths(locator: Locator) {
  const widths = await locator.evaluateAll((elements) => (
    elements.map((element) => element.getBoundingClientRect().width)
  ))
  expect(widths.length).toBeGreaterThan(1)
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
}

async function readStationMapGeometry(mapRegion: Locator): Promise<StationMapGeometry> {
  return await mapRegion.locator('.leaflet-container').evaluate((mapElement) => {
    const circleElement = mapElement.querySelector<SVGElement>('.station-radius-circle')
    const stationElement = mapElement.querySelector<HTMLElement>('.station-location-marker')
    if (!circleElement || !stationElement) {
      throw new Error('Station marker and radius circle must be rendered before measuring the map.')
    }

    const mapBox = mapElement.getBoundingClientRect()
    const circleBox = circleElement.getBoundingClientRect()
    const stationBox = stationElement.getBoundingClientRect()
    return {
      map: { width: mapBox.width, height: mapBox.height },
      circle: {
        x: circleBox.left - mapBox.left,
        y: circleBox.top - mapBox.top,
        width: circleBox.width,
        height: circleBox.height,
      },
      stationCenter: {
        x: stationBox.left + stationBox.width / 2 - mapBox.left,
        y: stationBox.top + stationBox.height / 2 - mapBox.top,
      },
    }
  })
}

function expectStationRadiusFillsMap(geometry: StationMapGeometry) {
  const circleCenter = {
    x: geometry.circle.x + geometry.circle.width / 2,
    y: geometry.circle.y + geometry.circle.height / 2,
  }
  const padding = {
    left: geometry.circle.x,
    top: geometry.circle.y,
    right: geometry.map.width - geometry.circle.x - geometry.circle.width,
    bottom: geometry.map.height - geometry.circle.y - geometry.circle.height,
  }
  const circleFraction = (
    Math.min(geometry.circle.width, geometry.circle.height) /
    Math.min(geometry.map.width, geometry.map.height)
  )

  expect(Math.abs(circleCenter.x - geometry.stationCenter.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(circleCenter.y - geometry.stationCenter.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(geometry.circle.width - geometry.circle.height)).toBeLessThanOrEqual(3)
  expect(padding.left).toBeGreaterThanOrEqual(36)
  expect(padding.top).toBeGreaterThanOrEqual(36)
  expect(padding.right).toBeGreaterThanOrEqual(36)
  expect(padding.bottom).toBeGreaterThanOrEqual(36)
  expect(Math.abs(padding.left - padding.right)).toBeLessThanOrEqual(3)
  expect(Math.abs(padding.top - padding.bottom)).toBeLessThanOrEqual(3)
  expect(circleFraction).toBeGreaterThanOrEqual(0.55)
}

function expectStationMapGeometryUnchanged(
  before: StationMapGeometry,
  after: StationMapGeometry,
) {
  const values = (geometry: StationMapGeometry) => [
    geometry.map.width,
    geometry.map.height,
    geometry.circle.x,
    geometry.circle.y,
    geometry.circle.width,
    geometry.circle.height,
    geometry.stationCenter.x,
    geometry.stationCenter.y,
  ]
  const beforeValues = values(before)
  const afterValues = values(after)
  expect(afterValues).toHaveLength(beforeValues.length)
  for (let index = 0; index < beforeValues.length; index += 1) {
    expect(Math.abs((afterValues[index] ?? 0) - (beforeValues[index] ?? 0))).toBeLessThanOrEqual(1)
  }
}

async function expectLockedStationRadiusPreview(page: Page, stationName: string) {
  await expect(page.getByText('확대·축소 및 이동 잠금', { exact: true })).toBeVisible()
  const mapRegion = page.getByRole('region', {
    name: `${stationName} 역세권 지도`,
    exact: true,
  })
  await expect(mapRegion).toHaveAttribute('data-map-mode', 'station-radius-preview')
  await expect(mapRegion.locator('.station-radius-circle')).toBeVisible()
  await expect(mapRegion.locator('.station-location-marker')).toBeVisible()
  await expect(mapRegion.locator('.leaflet-control-zoom')).toHaveCount(0)

  const map = mapRegion.locator('.leaflet-container')
  await expect(map).not.toHaveAttribute('tabindex', /.+/)
  const interactionClasses = await map.evaluate((element) => (
    ['leaflet-grab', 'leaflet-touch-drag', 'leaflet-touch-zoom', 'leaflet-drag-target']
      .filter((className) => element.classList.contains(className))
  ))
  expect(interactionClasses).toEqual([])

  await map.scrollIntoViewIfNeeded()
  const initialGeometry = await readStationMapGeometry(mapRegion)
  expectStationRadiusFillsMap(initialGeometry)

  await map.hover({ position: { x: 80, y: 80 } })
  await page.mouse.wheel(0, -720)
  const afterWheelGeometry = await readStationMapGeometry(mapRegion)
  expectStationMapGeometryUnchanged(initialGeometry, afterWheelGeometry)

  await map.scrollIntoViewIfNeeded()
  await map.dblclick({ position: { x: 80, y: 80 } })
  const afterDoubleClickGeometry = await readStationMapGeometry(mapRegion)
  expectStationMapGeometryUnchanged(initialGeometry, afterDoubleClickGeometry)

  await map.scrollIntoViewIfNeeded()
  const mapBox = await map.boundingBox()
  expect(mapBox).not.toBeNull()
  const dragStart = {
    x: (mapBox?.x ?? 0) + Math.min(100, (mapBox?.width ?? 0) * 0.25),
    y: (mapBox?.y ?? 0) + Math.min(100, (mapBox?.height ?? 0) * 0.25),
  }
  await page.mouse.move(dragStart.x, dragStart.y)
  await page.mouse.down()
  await page.mouse.move(dragStart.x + 90, dragStart.y + 70, { steps: 6 })
  await page.mouse.up()
  const afterDragGeometry = await readStationMapGeometry(mapRegion)
  expectStationMapGeometryUnchanged(initialGeometry, afterDragGeometry)
}

test.describe('특정 역 역세권 검색 브라우저 E2E', () => {
  test('지역·노선·역을 클릭해 강남역 기본 500m 물건을 거리순으로 표시한다', async ({ page }) => {
    const mapApiRequests = await openSubwaySearch(page)

    const pageHeadingBox = await page.getByRole('heading', { name: '역세권 경매물건 찾기' }).boundingBox()
    const pageIntroBox = await page.getByText(
      '역을 선택하고 지정한 직선거리 반경 안의 물건을 지도와 거리순 목록으로 비교하세요.',
      { exact: true },
    ).boundingBox()
    const searchFormBox = await page.locator('form').boundingBox()
    expect(pageHeadingBox).not.toBeNull()
    expect(pageIntroBox).not.toBeNull()
    expect(searchFormBox).not.toBeNull()
    const introLeftInset = (pageHeadingBox?.x ?? 0) - (searchFormBox?.x ?? 0)
    expect(introLeftInset).toBeGreaterThanOrEqual(24)
    expect(introLeftInset).toBeLessThanOrEqual(40)
    expect(Math.abs((pageHeadingBox?.x ?? 0) - (pageIntroBox?.x ?? 0))).toBeLessThanOrEqual(1)
    await expect(page.getByText('OpenStreetMap · WGS84', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
    const mapSearchMenuLink = page.getByRole('link', { name: '지도 영역 검색', exact: true })
    await mapSearchMenuLink.scrollIntoViewIfNeeded()
    await expect(mapSearchMenuLink).toBeVisible()
    await expect(page.getByRole('link', { name: '역세권 반경 검색', exact: true })).toBeVisible()
    await page.screenshot({
      path: 'test-results/playwright-subway-search/location-search-modes-restored-final.png',
    })
    await page.getByRole('button', { name: '전체 메뉴 닫기' }).click()
    await expectUniformWidths(page.getByRole('tab'))

    const capitalTab = page.getByRole('tab', { name: '수도권 지역' })
    await capitalTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: '부산 지역' })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(capitalTab).toHaveAttribute('aria-selected', 'true')
    await expectUniformWidths(page.getByLabel('노선 선택').getByRole('button'))

    const radiusGroup = page.getByRole('group', { name: '검색 반경' })
    await expect(radiusGroup.getByRole('button')).toHaveText(['300m', '500m', '1km'])
    await expect(radiusGroup.getByRole('button', { name: '300m', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(radiusGroup.getByRole('button', { name: '500m', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(radiusGroup.getByRole('button', { name: '1km', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(radiusGroup.getByRole('button', { name: /^(2km|3km|5km)$/ })).toHaveCount(0)

    const stations = await loadSeoulLine(page, '2호선')
    expect(stations.items).toContainEqual(expect.objectContaining({
      station_id: 'kr-subway-bcd4947b50475491',
      name: '강남역', city: '서울',
      areas: expect.arrayContaining(['강남구']),
      lines: expect.arrayContaining(['2호선']),
    }))
    const stationRadios = page.getByRole('radio')
    await expectUniformWidths(stationRadios)
    await stationRadios.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(stationRadios.nth(1)).toBeChecked()
    await stationChoice(page, '강남역', '강남구').click()
    await expect(page.getByRole('status', { name: '선택한 역' })).toContainText('강남역')

    const searchResponsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/v1/geo/subway'
    ))
    await page.getByRole('button', { name: '반경 안 물건 찾기' }).click()
    const searchResponse = await searchResponsePromise
    expect(searchResponse.status()).toBe(200)
    const requestUrl = new URL(searchResponse.url())
    expect(requestUrl.searchParams.get('station_id')).toBe('kr-subway-bcd4947b50475491')
    expect(requestUrl.searchParams.get('radius_m')).toBe('500')
    expect(requestUrl.searchParams.has('station_x')).toBe(false)
    expect(requestUrl.searchParams.has('station_y')).toBe(false)
    for (const key of ['west', 'south', 'east', 'north', 'sido', 'sigungu', 'dong']) {
      expect(requestUrl.searchParams.has(key), `unexpected map parameter ${key}`).toBe(false)
    }

    const result = await searchResponse.json() as SubwaySearchResponse
    expect(result.station).toMatchObject({
      station_id: 'kr-subway-bcd4947b50475491', name: '강남역', radius_m: 500,
    })
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(result.items[0].distance_m).toBeLessThanOrEqual(result.items[1].distance_m)

    await expect(page.getByText('강남역 · 500m', { exact: true })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(2)
    await expect(page.getByRole('article').getByText(/직선거리/)).toHaveCount(2)
    await expectUnselectedResultButtons(page, 2)
    await expect(page.getByLabel('강남역 역세권 지도')).toBeVisible()
    await expect(page.getByTitle('강남역 역 위치')).toBeVisible()
    await expect(page.locator('.station-location-marker')).toBeVisible()
    await expect(page.locator('.station-radius-circle')).toBeVisible()
    await expect(page.locator('.leaflet-control-attribution').getByRole('link', {
      name: 'OpenStreetMap',
    })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    await expect(page.locator('.leaflet-control-attribution').getByRole('link', {
      name: 'Leaflet',
    })).toHaveCount(0)
    await expectLockedStationRadiusPreview(page, '강남역')
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(mapApiRequests).toEqual([])
  })

  test('수도권·부산·대구·광주·대전에서 노선별 전체 역을 클릭 목록으로 표시한다', async ({ page }) => {
    await openSubwaySearch(page)

    for (const regionCase of [
      { label: '수도권', city: '서울', line: '1호선' },
      { label: '부산', city: '부산', line: '1호선' },
      { label: '대구', city: '대구', line: '1호선' },
      { label: '광주', city: '광주', line: '1호선' },
      { label: '대전', city: '대전', line: '1호선' },
    ]) {
      const stations = await loadRegionLine(
        page,
        regionCase.label,
        regionCase.city,
        regionCase.line,
      )
      expect(stations.total).toBeGreaterThan(0)
      expect(stations.items).toHaveLength(stations.total)
      await expect(page.getByRole('radio')).toHaveCount(stations.total)
    }
  })

  test('선택형 물건 용도와 한 줄 최저가 범위를 역세권 검색 요청에 적용한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSubwaySearch(page)

    const propertyTypeSelect = page.getByLabel('물건 용도')
    await expect(propertyTypeSelect).toHaveValue('')
    await expect(propertyTypeSelect.locator('option').first()).toHaveText('용도 전체')
    const propertyTypeGroups = await propertyTypeSelect.locator('optgroup').evaluateAll((groups) => (
      groups.map((group) => ({
        label: group.getAttribute('label'),
        options: Array.from(group.querySelectorAll('option'), (option) => option.textContent),
      }))
    ))
    expect(propertyTypeGroups).toEqual([
      { label: '주거용', options: ['아파트', '단독주택', '다가구주택', '연립주택', '다세대/빌라'] },
      { label: '상업용', options: ['상가', '오피스텔', '근린시설'] },
      { label: '토지', options: ['대지', '임야', '전답'] },
      { label: '차량 및 중장비', options: ['자동차', '중기'] },
      { label: '기타', options: ['기타'] },
    ])
    await propertyTypeSelect.selectOption({ label: '오피스텔' })
    await expect(propertyTypeSelect).toHaveValue('오피스텔')

    const priceGroup = page.getByRole('group', { name: '최저가 범위' })
    const minPriceInput = priceGroup.getByLabel('최저가 최소')
    const maxPriceInput = priceGroup.getByLabel('최저가 최대')
    const separator = priceGroup.getByText('~', { exact: true })
    await expect(separator).toBeVisible()
    const [minPriceBox, separatorBox, maxPriceBox] = await Promise.all([
      minPriceInput.boundingBox(),
      separator.boundingBox(),
      maxPriceInput.boundingBox(),
    ])
    expect(minPriceBox).not.toBeNull()
    expect(separatorBox).not.toBeNull()
    expect(maxPriceBox).not.toBeNull()
    const minPriceCenterY = (minPriceBox?.y ?? 0) + (minPriceBox?.height ?? 0) / 2
    const separatorCenterY = (separatorBox?.y ?? 0) + (separatorBox?.height ?? 0) / 2
    const maxPriceCenterY = (maxPriceBox?.y ?? 0) + (maxPriceBox?.height ?? 0) / 2
    expect(Math.abs(minPriceCenterY - separatorCenterY)).toBeLessThanOrEqual(1)
    expect(Math.abs(maxPriceCenterY - separatorCenterY)).toBeLessThanOrEqual(1)
    expect((minPriceBox?.x ?? 0) + (minPriceBox?.width ?? 0)).toBeLessThanOrEqual(
      (separatorBox?.x ?? 0) + 1,
    )
    expect(maxPriceBox?.x ?? 0).toBeGreaterThanOrEqual(
      (separatorBox?.x ?? 0) + (separatorBox?.width ?? 0) - 1,
    )
    const viewportMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.innerWidth)

    await minPriceInput.fill('0001234')
    await expect(minPriceInput).toHaveValue('1,234')
    await minPriceInput.fill('1,234,567')
    await expect(minPriceInput).toHaveValue('1,234,567')
    await minPriceInput.fill('9007199254740992')
    await expect(minPriceInput).toHaveValue('9,007,199,254,740,992')
    await minPriceInput.fill('')
    await expect(minPriceInput).toHaveValue('')
    await minPriceInput.fill('-100')
    await expect(minPriceInput).toHaveValue('')
    await minPriceInput.fill('1.5')
    await expect(minPriceInput).toHaveValue('')

    await minPriceInput.fill('400000000')
    await maxPriceInput.fill('430000000')
    await expect(minPriceInput).toHaveValue('400,000,000')
    await expect(maxPriceInput).toHaveValue('430,000,000')
    await loadSeoulLine(page, '2호선')
    const compactCityTabBox = await page.getByRole('tab', { name: '수도권 지역' }).boundingBox()
    const compactLineButtonBox = await page.getByRole('button', { name: '2호선 노선', exact: true }).boundingBox()
    const compactStationChooser = page.getByRole('radiogroup', { name: '역 선택' })
    const compactStationMetrics = await compactStationChooser.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
    const compactViewportMetrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    const compactStationBox = await stationChoice(page, '강남역', '강남구').boundingBox()
    expect(compactCityTabBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(56)
    expect(compactLineButtonBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(40)
    expect(compactStationBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(58)
    expect(compactStationMetrics.clientHeight).toBeLessThanOrEqual(256)
    expect(compactStationMetrics.scrollHeight).toBeGreaterThan(compactStationMetrics.clientHeight)
    expect(compactStationMetrics.overflowY).toBe('auto')
    expect(compactViewportMetrics.scrollWidth).toBeLessThanOrEqual(compactViewportMetrics.innerWidth)
    await compactStationChooser.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: 'test-results/playwright-subway-search/subway-compact-station-selector-final.png',
    })
    await stationChoice(page, '강남역', '강남구').click()
    const [compactStationChooserBox, compactSubmitButtonBox] = await Promise.all([
      compactStationChooser.boundingBox(),
      page.getByRole('button', { name: '반경 안 물건 찾기' }).boundingBox(),
    ])
    expect(
      (compactSubmitButtonBox?.y ?? Number.POSITIVE_INFINITY) -
      ((compactStationChooserBox?.y ?? 0) + (compactStationChooserBox?.height ?? 0)),
    ).toBeLessThanOrEqual(340)

    const searchResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === '/api/v1/geo/subway' &&
        url.searchParams.getAll('goods_usage').includes('오피스텔') &&
        url.searchParams.get('min_lowest_sale_price') === '400000000' &&
        url.searchParams.get('max_lowest_sale_price') === '430000000'
      )
    })
    await page.getByRole('button', { name: '반경 안 물건 찾기' }).click()
    const searchResponse = await searchResponsePromise
    expect(searchResponse.status()).toBe(200)
    const requestUrl = new URL(searchResponse.url())
    expect(requestUrl.searchParams.getAll('goods_usage')).toEqual([
      '오피스텔',
      '상가,오피스텔,근린시설',
    ])
    expect(requestUrl.searchParams.get('min_lowest_sale_price')).toBe('400000000')
    expect(requestUrl.searchParams.get('max_lowest_sale_price')).toBe('430000000')
    expect(requestUrl.searchParams.has('region')).toBe(false)
    expect(requestUrl.searchParams.has('q')).toBe(false)

    const result = await searchResponse.json() as SubwaySearchResponse
    expect(result.total).toBe(1)
    expect(result.items).toEqual([
      expect.objectContaining({ auction_goods_id: 2 }),
    ])
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('article').getByText('테스트타워 803호', { exact: true })).toBeVisible()
    await page.screenshot({
      path: 'test-results/playwright-subway-search/subway-price-commas-final.png',
    })
  })

  for (const stationCase of CENTERED_STATION_CASES) {
    test(`${stationCase.name}을 클릭 선택해 ${stationCase.radiusLabel} 중심 물건을 실제 검색한다`, async ({ page }) => {
      await openSubwaySearch(page)

      let stations: StationSearchResponse
      if (stationCase.name === '서울역') {
        const alternateStations = await loadSeoulLine(page, '4호선')
        expect(alternateStations.items).toContainEqual(expect.objectContaining({
          station_id: stationCase.stationId, name: '서울역',
          areas: expect.arrayContaining(['용산구', '중구']),
          lines: expect.arrayContaining(['1호선', '4호선', 'GTX-A', '공항철도']),
        }))
        await stationChoice(page, '서울역', '중구').click()
        const alternateSummary = page.getByRole('status', { name: '선택한 역' })
        await expect(alternateSummary).toContainText('서울역')
        await expect(alternateSummary).toContainText('중구')
        await expect(alternateSummary).toContainText('4호선')
        stations = await loadSeoulLine(page, stationCase.line, false)
      } else {
        stations = await loadSeoulLine(page, stationCase.line)
      }

      expect(stations.items).toContainEqual(expect.objectContaining({
        station_id: stationCase.stationId, name: stationCase.name, city: '서울',
        areas: expect.arrayContaining([stationCase.area]),
        lines: expect.arrayContaining([stationCase.line]),
      }))
      await stationChoice(page, stationCase.name, stationCase.area).click()
      const selectedStationSummary = page.getByRole('status', { name: '선택한 역' })
      await expect(selectedStationSummary).toContainText(stationCase.name)
      await expect(selectedStationSummary).toContainText(stationCase.area)
      await expect(selectedStationSummary).toContainText(stationCase.line)

      await page.getByRole('button', { name: stationCase.radiusLabel, exact: true }).click()
      const searchResponsePromise = page.waitForResponse((response) => (
        new URL(response.url()).pathname === '/api/v1/geo/subway'
      ))
      await page.getByRole('button', { name: '반경 안 물건 찾기' }).click()
      const searchResponse = await searchResponsePromise
      expect(searchResponse.status()).toBe(200)
      const requestUrl = new URL(searchResponse.url())
      expect(requestUrl.searchParams.get('station_id')).toBe(stationCase.stationId)
      expect(requestUrl.searchParams.get('radius_m')).toBe(String(stationCase.radiusM))
      expect(requestUrl.searchParams.has('station_x')).toBe(false)
      expect(requestUrl.searchParams.has('station_y')).toBe(false)
      for (const key of ['west', 'south', 'east', 'north', 'sido', 'sigungu', 'dong']) {
        expect(requestUrl.searchParams.has(key), `unexpected map parameter ${key}`).toBe(false)
      }

      const result = await searchResponse.json() as SubwaySearchResponse
      expect(result.station).toMatchObject({
        station_id: stationCase.stationId, name: stationCase.name,
        radius_m: stationCase.radiusM,
      })
      expect(result.total).toBe(1)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({ auction_goods_id: stationCase.auctionGoodsId })
      expect(result.items[0]?.distance_m).toBeLessThanOrEqual(stationCase.radiusM)

      await expect(page.getByText(`${stationCase.name} · ${stationCase.summaryRadius}`, { exact: true })).toBeVisible()
      await expect(page.getByRole('article')).toHaveCount(1)
      await expect(page.getByRole('article').getByText(stationCase.buildingName, { exact: true })).toBeVisible()
      await expectUnselectedResultButtons(page, 1)
      await expect(page.getByTitle(`${stationCase.name} 역 위치`)).toBeVisible()
      await expect(page.locator('.station-radius-circle')).toBeVisible()
      await expectLockedStationRadiusPreview(page, stationCase.name)
      await expect(page.getByRole('alert')).toHaveCount(0)
    })
  }

  test('역을 선택하지 않으면 반경 검색 요청을 보내지 않는다', async ({ page }) => {
    await openSubwaySearch(page)
    let subwayRequestCount = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/geo/subway') subwayRequestCount += 1
    })

    await loadSeoulLine(page, '2호선')
    await expect(page.getByRole('button', { name: '반경 안 물건 찾기' })).toBeDisabled()
    await page.getByLabel('최저가 최소').press('Enter')
    await expect(page.getByRole('button', { name: '반경 안 물건 찾기' })).toBeDisabled()
    expect(subwayRequestCount).toBe(0)
  })

  test('일반 지도 검색 주소를 역세권 검색과 분리해 연다', async ({ page }) => {
    await prepareAnonymousSession(page)
    await page.goto('/map-search')

    await expect(page).toHaveURL(/\/map-search$/)
    await expect(page.getByRole('heading', { name: '지도 영역 경매물건 찾기' })).toBeVisible()
    await expect(page.getByText('좌표범위검색', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '지도 영역 검색', exact: true })).toHaveAttribute(
      'href',
      '/map-search',
    )
  })

  test('서버는 존재하지 않는 station_id를 404로 거부한다', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/api/v1/geo/subway?station_id=missing-station&radius_m=500`,
    )
    expect(response.status()).toBe(404)
    expect(await response.json()).toEqual({ detail: 'Unknown station_id.' })
  })
})
