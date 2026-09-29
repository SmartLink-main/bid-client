import { expect, test, type Page, type Route } from '@playwright/test'
import type { GeographicBounds, GeographicSearchItem } from '../src/lib/auction-extra'

type LocatedItem = GeographicSearchItem & {
  latitude: number
  longitude: number
  building_name: string
}

type PendingResponse = {
  release: () => void
  done: Promise<void>
}

type MapCall = PendingResponse & {
  url: URL
  bounds: GeographicBounds
  items: LocatedItem[]
}

type ReverseCall = PendingResponse & {
  longitude: number
  latitude: number
}

function mercatorY(latitude: number) {
  return Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))
}

function latitudeAt(bounds: GeographicBounds, fractionFromTop: number) {
  const north = mercatorY(bounds.north)
  const south = mercatorY(bounds.south)
  return (2 * Math.atan(Math.exp(north + (south - north) * fractionFromTop)) - Math.PI / 2) * 180 / Math.PI
}

function makeItems(bounds: GeographicBounds, requestNumber: number, duplicateGoods: boolean, count: number): LocatedItem[] {
  return Array.from({ length: count }, (_, index) => ({
    auction_goods_id: duplicateGoods ? 9001 : requestNumber * 100 + index,
    schedule_goods_id: requestNumber * 1000 + index,
    latitude: latitudeAt(bounds, 0.46 + (index % 2) * 0.16),
    longitude: bounds.west + (bounds.east - bounds.west) * (0.3 + (index % 2) * 0.4),
    building_name: `영역 ${requestNumber} ${index < 2 ? index === 0 ? '서쪽' : '동쪽' : `${index + 1}번째`} 물건`,
    printed_address: `테스트 소재지 ${requestNumber}-${index}`,
    court_name: '테스트법원',
    current_lowest_sale_price: 100_000_000 + index * 20_000_000,
  }))
}

function deferredJson(route: Route, body: unknown, status = 200) {
  let release = () => {}
  let finish = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const done = new Promise<void>((resolve) => { finish = resolve })
  return {
    release,
    done,
    respond: async () => {
      await gate
      try {
        await route.fulfill({
          status,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': route.request().headers().origin ?? 'http://127.0.0.1:3102',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
          body: status === 204 ? undefined : JSON.stringify(body),
        })
      } finally {
        finish()
      }
    },
  }
}

async function installMapHarness(page: Page, duplicateGoods = false, itemCount = 2, total = itemCount) {
  const mapCalls: MapCall[] = []
  const reverseCalls: ReverseCall[] = []
  const blockedExternalRequests: string[] = []
  const state = { holdNextMap: false, holdReverse: false, failReverse: false }

  // Every API and tile response is local test data; all other external traffic is blocked.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'tile.openstreetmap.org') {
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#e2e8f0" d="M0 0h256v256H0z"/><path stroke="#cbd5e1" fill="none" d="M0 128h256M128 0v256"/></svg>',
      })
      return
    }
    if (url.pathname.startsWith('/api/')) {
      if (route.request().method() === 'OPTIONS') {
        const response = deferredJson(route, null, 204)
        response.release()
        await response.respond()
        return
      }
      if (url.pathname === '/api/v1/geo/map') {
        const bounds = {
          west: Number(url.searchParams.get('west')),
          south: Number(url.searchParams.get('south')),
          east: Number(url.searchParams.get('east')),
          north: Number(url.searchParams.get('north')),
        }
        const items = makeItems(bounds, mapCalls.length + 1, duplicateGoods, itemCount)
        const response = deferredJson(route, {
          search_type: 'map',
          coordinate_system: 'WGS84',
          bounds,
          total,
          limit: 100,
          offset: Number(url.searchParams.get('offset') ?? 0),
          items,
          coverage: {
            matched_total: total,
            page_candidates: items.length,
            page_items: items.length,
            excluded_unconvertible: 0,
          },
          excluded_items: [],
        })
        mapCalls.push({ url, bounds, items, release: response.release, done: response.done })
        if (state.holdNextMap) state.holdNextMap = false
        else response.release()
        await response.respond()
        return
      }
      if (url.pathname === '/api/v1/geo/reverse-region') {
        const longitude = Number(url.searchParams.get('longitude'))
        const latitude = Number(url.searchParams.get('latitude'))
        const response = deferredJson(route, state.failReverse ? { detail: '테스트 역조회 실패' } : {
          coordinate_system: 'WGS84',
          center: { longitude, latitude },
          region: null,
        }, state.failReverse ? 503 : 200)
        reverseCalls.push({ longitude, latitude, release: response.release, done: response.done })
        if (!state.holdReverse) response.release()
        await response.respond()
        return
      }
      const response = deferredJson(route, { detail: 'Anonymous isolated test session' }, 401)
      response.release()
      await response.respond()
      return
    }
    if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      await route.continue()
      return
    }
    blockedExternalRequests.push(url.toString())
    await route.abort('blockedbyclient')
  })

  return {
    mapCalls,
    reverseCalls,
    blockedExternalRequests,
    state,
    releaseAll: async () => {
      state.holdNextMap = false
      state.holdReverse = false
      const pending = [...mapCalls, ...reverseCalls]
      pending.forEach((call) => call.release())
      await Promise.all(pending.map((call) => call.done))
    },
  }
}

async function nextMapCall(calls: MapCall[], previousCount: number) {
  await expect.poll(() => calls.length).toBeGreaterThan(previousCount)
  return calls[calls.length - 1]
}

async function dragMap(page: Page, deltaX: number, deltaY: number, duringDrag?: () => Promise<void>) {
  const map = page.locator('.leaflet-container')
  const box = await map.boundingBox()
  expect(box).not.toBeNull()
  const startX = box!.x + box!.width * 0.5
  const startY = box!.y + box!.height * 0.78
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  try {
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 })
    await duringDrag?.()
  } finally {
    await page.mouse.up()
  }
}

async function expectMapMatchesResponse(page: Page, call: MapCall) {
  for (const filter of ['sido', 'sigungu', 'dong', 'region']) {
    expect(call.url.searchParams.has(filter), `unexpected address filter ${filter}`).toBe(false)
  }
  await expect(page.locator('article h2')).toHaveText(call.items.map((item) => item.building_name))
  const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon')
  await expect(markers).toHaveCount(call.items.length)
  // Compare marker tips with the HTTP bounds using Web Mercator, without reading Leaflet internals.
  await expect.poll(async () => {
    const mapBox = await page.locator('.leaflet-container').boundingBox()
    if (!mapBox) return Number.POSITIVE_INFINITY
    const errors = await Promise.all(call.items.map(async (item, index) => {
      const markerBox = await markers.nth(index).boundingBox()
      if (!markerBox) return Number.POSITIVE_INFINITY
      const expectedX = mapBox.x + mapBox.width * (item.longitude - call.bounds.west) / (call.bounds.east - call.bounds.west)
      const expectedY = mapBox.y + mapBox.height * (mercatorY(call.bounds.north) - mercatorY(item.latitude)) / (mercatorY(call.bounds.north) - mercatorY(call.bounds.south))
      return Math.max(Math.abs(markerBox.x + 12 - expectedX), Math.abs(markerBox.y + 41 - expectedY))
    }))
    return Math.max(...errors)
  }).toBeLessThanOrEqual(2)
}

async function expectViewportFillsAvailableHeight(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    bodyHeight: document.body.scrollHeight,
    scrollY: window.scrollY,
  }))
  expect(dimensions.scrollY).toBe(0)
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
  expect(dimensions.bodyHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
  const mapBox = await page.locator('.leaflet-container').boundingBox()
  const mainBox = await page.getByRole('main').boundingBox()
  expect(mapBox).not.toBeNull()
  expect(mainBox).not.toBeNull()
  expect(mapBox!.height).toBeGreaterThan(200)
  expect(mapBox!.y).toBeGreaterThanOrEqual(0)
  expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
  expect(mapBox!.y - mainBox!.y).toBeGreaterThanOrEqual(0)
  expect(mapBox!.y - mainBox!.y).toBeLessThanOrEqual(16)
  if (page.viewportSize()!.width >= 768) {
    expect(mainBox!.height - mapBox!.height).toBeLessThanOrEqual(32)
  } else {
    expect(mapBox!.height).toBeGreaterThan(mainBox!.height * 0.55)
  }
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
  return mapBox!
}

test.describe('현재 지도와 검색 결과의 위치 동기화', () => {
  test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' })

  test('지도를 드래그하고 확대하면 요청 영역과 실제 마커 및 목록이 일치한다', async ({ page }, testInfo) => {
    const harness = await installMapHarness(page)
    try {
      await page.goto('/map-search')
      const initial = await nextMapCall(harness.mapCalls, 0)
      await expectMapMatchesResponse(page, initial)

      const beforeDrag = harness.mapCalls.length
      await dragMap(page, 155, 55)
      const dragged = await nextMapCall(harness.mapCalls, beforeDrag)
      expect(dragged.bounds.west).toBeLessThan(initial.bounds.west)
      expect(dragged.bounds.north).toBeGreaterThan(initial.bounds.north)
      await expectMapMatchesResponse(page, dragged)

      const beforeZoom = harness.mapCalls.length
      await page.locator('.leaflet-control-zoom-in').click()
      const zoomed = await nextMapCall(harness.mapCalls, beforeZoom)
      expect(zoomed.bounds.east - zoomed.bounds.west).toBeLessThan(dragged.bounds.east - dragged.bounds.west)
      await expectMapMatchesResponse(page, zoomed)
      for (const call of [dragged, zoomed]) {
        for (const filter of ['sido', 'sigungu', 'dong']) expect(call.url.searchParams.has(filter)).toBe(false)
      }
      const reverse = harness.reverseCalls[harness.reverseCalls.length - 1]
      const mapBox = await expectViewportFillsAvailableHeight(page)
      const centerLongitude = (zoomed.bounds.west + zoomed.bounds.east) / 2
      const centerLatitude = latitudeAt(zoomed.bounds, 0.5)
      const longitudePixels = mapBox.width / (zoomed.bounds.east - zoomed.bounds.west)
      const latitudePixels = mapBox.height / (mercatorY(zoomed.bounds.north) - mercatorY(zoomed.bounds.south))
      expect(Math.abs(reverse.longitude - centerLongitude) * longitudePixels).toBeLessThanOrEqual(2)
      expect(Math.abs(mercatorY(reverse.latitude) - mercatorY(centerLatitude)) * latitudePixels).toBeLessThanOrEqual(2)
      expect(harness.blockedExternalRequests).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('viewport-synced.png'), fullPage: true })
    } finally {
      await harness.releaseAll()
    }
  })

  test('이전 검색과 소재지 확인이 지연되어도 현재 화면을 검색하고 오래된 결과를 숨긴다', async ({ page }) => {
    const harness = await installMapHarness(page)
    try {
      await page.goto('/map-search')
      const initial = await nextMapCall(harness.mapCalls, 0)
      await expectMapMatchesResponse(page, initial)

      harness.state.holdNextMap = true
      harness.state.holdReverse = true
      harness.state.failReverse = true
      const beforeDrag = harness.mapCalls.length
      await dragMap(page, 140, 35, async () => {
        await expect(page.locator('article')).toHaveCount(0)
        await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon')).toHaveCount(0)
      })
      const delayed = await nextMapCall(harness.mapCalls, beforeDrag)
      await expect(page.getByRole('group', { name: '지도 소재지' })).toHaveAttribute('aria-busy', 'true')
      await expect(page.locator('article')).toHaveCount(0)
      await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon')).toHaveCount(0)

      const beforeSecondDrag = harness.mapCalls.length
      await dragMap(page, -180, -45)
      const current = await nextMapCall(harness.mapCalls, beforeSecondDrag)
      expect(current.bounds).not.toEqual(delayed.bounds)
      await expectMapMatchesResponse(page, current)
      await expect(page.getByRole('group', { name: '지도 소재지' })).toHaveAttribute('aria-busy', 'true')

      delayed.release()
      await delayed.done
      await harness.releaseAll()
      await expect(page.getByRole('group', { name: '지도 소재지' })).toHaveAttribute('aria-busy', 'false')
      await expect(page.getByRole('status')).toContainText('지도 범위만으로 검색합니다.')
      await expectMapMatchesResponse(page, current)
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(harness.blockedExternalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('같은 물건의 서로 다른 좌표 행을 선택하면 해당 행의 마커 팝업만 열린다', async ({ page }) => {
    const harness = await installMapHarness(page, true)
    try {
      await page.goto('/map-search')
      const initial = await nextMapCall(harness.mapCalls, 0)
      await expectMapMatchesResponse(page, initial)
      expect(initial.items[0].auction_goods_id).toBe(initial.items[1].auction_goods_id)

      const cards = page.locator('article')
      const popup = page.locator('.leaflet-popup-content')
      for (const index of [0, 1]) {
        await cards.nth(index).getByRole('button').click()
        await expect(popup).toHaveCount(1)
        await expect(popup).toContainText(initial.items[index].building_name)
        await expect(popup).not.toContainText(initial.items[1 - index].building_name)
        await expect(cards.nth(index)).toHaveClass(/border-indigo-500/)
        await expect(cards.nth(1 - index)).not.toHaveClass(/border-indigo-500/)
        await expectMapMatchesResponse(page, initial)
      }

      await page.locator('.leaflet-popup-close-button').click()
      await expect(popup).toHaveCount(0)
      await page.locator('.leaflet-marker-pane .leaflet-marker-icon').nth(0).click()
      await expect(popup).toHaveCount(1)
      await expect(popup).toContainText(initial.items[0].building_name)
      await expect(cards.nth(0)).toHaveClass(/border-indigo-500/)
      await expect(cards.nth(1)).not.toHaveClass(/border-indigo-500/)
      expect(harness.mapCalls).toHaveLength(1)
      expect(harness.blockedExternalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('소재지를 선택한 뒤 지도를 옮겨도 같은 소재지를 다시 선택하면 해당 영역으로 복귀한다', async ({ page }) => {
    const harness = await installMapHarness(page)
    try {
      await page.goto('/map-search')
      await expectMapMatchesResponse(page, await nextMapCall(harness.mapCalls, 0))
      const province = page.getByLabel('시·도', { exact: true })

      const beforeSelection = harness.mapCalls.length
      await province.selectOption({ label: '서울' })
      const seoul = await nextMapCall(harness.mapCalls, beforeSelection)
      expect(seoul.bounds.east - seoul.bounds.west).toBeLessThan(2)
      await expectMapMatchesResponse(page, seoul)

      const beforeDrag = harness.mapCalls.length
      await dragMap(page, 140, 35)
      const moved = await nextMapCall(harness.mapCalls, beforeDrag)
      await expectMapMatchesResponse(page, moved)
      await expect(province).toHaveValue('')
      expect(moved.bounds).not.toEqual(seoul.bounds)

      const beforeReturn = harness.mapCalls.length
      await province.selectOption({ label: '서울' })
      const returned = await nextMapCall(harness.mapCalls, beforeReturn)
      await expectMapMatchesResponse(page, returned)
      const mapBox = await page.locator('.leaflet-container').boundingBox()
      expect(mapBox).not.toBeNull()
      // Leaflet rounds the fitted center to pixels. Check all four viewport edges
      // within two rendered pixels to preserve both the original center and extent.
      const longitudePixels = mapBox!.width / (seoul.bounds.east - seoul.bounds.west)
      const latitudePixels = mapBox!.height / (mercatorY(seoul.bounds.north) - mercatorY(seoul.bounds.south))
      for (const bound of ['west', 'east'] as const) {
        expect(Math.abs(returned.bounds[bound] - seoul.bounds[bound]) * longitudePixels, `${bound} viewport edge`).toBeLessThanOrEqual(2)
      }
      for (const bound of ['south', 'north'] as const) {
        expect(Math.abs(mercatorY(returned.bounds[bound]) - mercatorY(seoul.bounds[bound])) * latitudePixels, `${bound} viewport edge`).toBeLessThanOrEqual(2)
      }
      await expect(page.getByRole('status')).toHaveText('서울 지역으로 지도 이동이 완료되었습니다.')
      expect(harness.blockedExternalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('전국 지도에서 조건 초기화를 반복해도 용도 조건을 지우고 검색을 재개한다', async ({ page }) => {
    const harness = await installMapHarness(page)
    try {
      await page.goto('/map-search')
      await expectMapMatchesResponse(page, await nextMapCall(harness.mapCalls, 0))

      const beforeInitialFilter = harness.mapCalls.length
      await page.getByLabel('물건종류').selectOption({ label: '아파트' })
      const initiallyFiltered = await nextMapCall(harness.mapCalls, beforeInitialFilter)
      expect(initiallyFiltered.url.searchParams.getAll('goods_usage')).toEqual(['아파트'])
      await expectMapMatchesResponse(page, initiallyFiltered)

      const beforeFirstReset = harness.mapCalls.length
      await page.getByRole('button', { name: '조건 초기화' }).click()
      const nationwide = await nextMapCall(harness.mapCalls, beforeFirstReset)
      await expectMapMatchesResponse(page, nationwide)

      const beforeFilter = harness.mapCalls.length
      await page.getByLabel('물건종류').selectOption({ label: '아파트' })
      const filtered = await nextMapCall(harness.mapCalls, beforeFilter)
      expect(filtered.url.searchParams.getAll('goods_usage')).toEqual(['아파트'])
      await expectMapMatchesResponse(page, filtered)

      const beforeSecondReset = harness.mapCalls.length
      await page.getByRole('button', { name: '조건 초기화' }).click()
      const resetAgain = await nextMapCall(harness.mapCalls, beforeSecondReset)
      expect(resetAgain.url.searchParams.has('goods_usage')).toBe(false)
      await expect(page.getByLabel('물건종류')).toHaveValue('')
      await expectMapMatchesResponse(page, resetAgain)
      await expect(page.getByRole('status')).toHaveText('전국 지도로 이동이 완료되었습니다.')
      await expect(page.getByText('현재 지도 자동 검색 완료', { exact: true })).toBeVisible()
      expect(harness.blockedExternalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('필터를 현재 영역에 모으고 데스크톱과 모바일에서 지도를 늘려 결과 목록만 스크롤한다', async ({ page }, testInfo) => {
    const harness = await installMapHarness(page, false, 20)
    try {
      await page.goto('/map-search')
      await expectMapMatchesResponse(page, await nextMapCall(harness.mapCalls, 0))
      const initialMapBox = await expectViewportFillsAvailableHeight(page)
      const resultList = page.locator('article').first().locator('..')
      await expect(resultList).toHaveCSS('overflow-y', 'auto')
      await expect(resultList).toHaveCSS('scrollbar-width', 'none')
      const listBox = await resultList.boundingBox()
      expect(listBox).not.toBeNull()
      await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + listBox!.height / 2)
      await page.mouse.wheel(0, 600)
      await expect.poll(() => resultList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(await page.locator('.leaflet-container').boundingBox()).toEqual(initialMapBox)

      const beforeResize = harness.mapCalls.length
      await page.setViewportSize({ width: 1440, height: 900 })
      const resized = await nextMapCall(harness.mapCalls, beforeResize)
      await expectMapMatchesResponse(page, resized)
      const resizedMapBox = await expectViewportFillsAvailableHeight(page)
      expect(initialMapBox.height - resizedMapBox.height).toBeCloseTo(200, 0)
      expect(resized.bounds).not.toEqual(harness.mapCalls[0].bounds)
      expect(harness.blockedExternalRequests).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('full-height-map-and-list.png') })

      const beforeMobileResize = harness.mapCalls.length
      await page.setViewportSize({ width: 390, height: 844 })
      await expectMapMatchesResponse(page, await nextMapCall(harness.mapCalls, beforeMobileResize))
      const mobileMapBox = await expectViewportFillsAvailableHeight(page)
      const mobileListBox = await resultList.boundingBox()
      expect(mobileListBox).not.toBeNull()
      expect(mobileListBox!.height).toBeGreaterThan(48)
      await page.mouse.move(mobileListBox!.x + mobileListBox!.width / 2, mobileListBox!.y + mobileListBox!.height / 2)
      await page.mouse.wheel(0, 600)
      await expect.poll(() => resultList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(await page.locator('.leaflet-container').boundingBox()).toEqual(mobileMapBox)
      await expect(page.getByRole('complementary', { name: '현재 화면의 물건 목록' }).getByLabel('최저가 최대')).toBeInViewport()
      expect(harness.blockedExternalRequests).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('mobile-map-and-sidebar-filters.png') })
    } finally {
      await harness.releaseAll()
    }
  })

  test('높이가 낮은 모바일에서도 필터와 결과 목록 및 다음 페이지를 사용할 수 있다', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const harness = await installMapHarness(page, false, 20, 120)
    try {
      await page.goto('/map-search')
      await expectMapMatchesResponse(page, await nextMapCall(harness.mapCalls, 0))
      const resultsPanel = page.getByRole('complementary', { name: '현재 화면의 물건 목록' })
      const previousPage = resultsPanel.getByRole('button', { name: '이전 페이지' })
      const nextPage = resultsPanel.getByRole('button', { name: '다음 페이지' })
      const resultList = resultsPanel.getByRole('region', { name: '검색 결과 목록' })

      for (const control of [
        resultsPanel.getByLabel('물건종류'),
        resultsPanel.getByLabel('최저가 최소'),
        resultsPanel.getByLabel('최저가 최대'),
        resultsPanel.getByRole('button', { name: '조건 초기화' }),
        previousPage,
        nextPage,
      ]) {
        await expect(control).toBeVisible()
        await expect(control).toBeInViewport({ ratio: 1 })
      }
      await expect(previousPage).toBeDisabled()
      await expect(nextPage).toBeEnabled()
      await expect(resultsPanel.getByText('1 / 2', { exact: true })).toBeVisible()

      const listBox = await resultList.boundingBox()
      const mapBox = await page.locator('.leaflet-container').boundingBox()
      expect(listBox).not.toBeNull()
      expect(mapBox).not.toBeNull()
      expect(listBox!.height).toBeGreaterThanOrEqual(80)
      expect(mapBox!.height).toBeGreaterThan(200)
      await page.mouse.move(listBox!.x + listBox!.width / 2, listBox!.y + listBox!.height / 2)
      await page.mouse.wheel(0, 500)
      await expect.poll(() => resultList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      const layout = await page.evaluate(() => ({
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        scrollY: window.scrollY,
      }))
      expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1)
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
      expect(layout.scrollY).toBe(0)

      const beforePageChange = harness.mapCalls.length
      await nextPage.click()
      const secondPage = await nextMapCall(harness.mapCalls, beforePageChange)
      expect(secondPage.url.searchParams.get('offset')).toBe('100')
      await expectMapMatchesResponse(page, secondPage)
      await expect(resultsPanel.getByText('2 / 2', { exact: true })).toBeVisible()
      await expect(previousPage).toBeEnabled()
      await expect(nextPage).toBeDisabled()
      await expect(nextPage).toBeInViewport({ ratio: 1 })
      expect((await resultList.boundingBox())!.height).toBeGreaterThanOrEqual(80)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(harness.blockedExternalRequests).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('short-mobile-map-filters-pagination.png') })
    } finally {
      await harness.releaseAll()
    }
  })
})
