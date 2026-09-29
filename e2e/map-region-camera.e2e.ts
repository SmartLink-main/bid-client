import { expect, test, type Page } from '@playwright/test'
import type { GeographicBounds, GeographicSearchItem } from '../src/lib/auction-extra'
import { getRegionViewport } from '../src/lib/region-viewports'

type LocatedItem = GeographicSearchItem & { latitude: number; longitude: number; building_name: string }
type MapCall = { url: URL; bounds: GeographicBounds; items: LocatedItem[] }
type ReverseCall = { longitude: number; latitude: number; sigungu: string; dong: string }

const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))
const inverseMercatorY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI
const neighboringItems: LocatedItem[] = [
  { auction_goods_id: 93001, schedule_goods_id: 94001, longitude: 129.224, latitude: 35.842, building_name: '경주 중심 테스트 매물', printed_address: '경상북도 경주시 인왕동 테스트', current_lowest_sale_price: 100_000_000 },
  { auction_goods_id: 93002, schedule_goods_id: 94002, longitude: 129.365, latitude: 36.033, building_name: '화면 안 포항 테스트 매물', printed_address: '경상북도 포항시 북구 죽도동 테스트', current_lowest_sale_price: 120_000_000 },
  { auction_goods_id: 93003, schedule_goods_id: 94003, longitude: 127.027, latitude: 37.499, building_name: '화면 밖 서울 테스트 매물', printed_address: '서울특별시 강남구 테스트', current_lowest_sale_price: 200_000_000 },
]

async function installCameraHarness(page: Page) {
  const mapCalls: MapCall[] = []
  const reverseCalls: ReverseCall[] = []
  const externalRequests: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const headers = {
      'Access-Control-Allow-Origin': route.request().headers().origin ?? 'http://127.0.0.1:3102',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
    if (url.hostname === 'tile.openstreetmap.org') {
      await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#e2e8f0" d="M0 0h256v256H0z"/><path stroke="#94a3b8" fill="none" d="M0 0h256v256H0zM0 128h256M128 0v256"/><text x="6" y="20" font-size="14">${url.pathname}</text></svg>` })
      return
    }
    if (url.pathname.startsWith('/api/')) {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      if (url.pathname === '/api/v1/geo/map') {
        const bounds = Object.fromEntries(['west', 'south', 'east', 'north'].map((key) => [key, Number(url.searchParams.get(key))])) as GeographicBounds
        const items = neighboringItems.filter((item) => item.longitude >= bounds.west && item.longitude <= bounds.east && item.latitude >= bounds.south && item.latitude <= bounds.north)
        mapCalls.push({ url, bounds, items })
        await route.fulfill({ headers, json: {
          search_type: 'map', coordinate_system: 'WGS84', bounds, total: items.length,
          limit: 100, offset: 0, items, excluded_items: [],
          coverage: { matched_total: items.length, page_candidates: items.length, page_items: items.length, excluded_unconvertible: 0 },
        } })
        return
      }
      if (url.pathname === '/api/v1/geo/reverse-region') {
        const longitude = Number(url.searchParams.get('longitude'))
        const latitude = Number(url.searchParams.get('latitude'))
        const northern = latitude >= 35.98
        const sigungu = northern ? '포항시 북구' : '경주시'
        const dong = northern ? '죽도동' : '보문동'
        reverseCalls.push({ longitude, latitude, sigungu, dong })
        await route.fulfill({ headers, json: {
          coordinate_system: 'WGS84', center: { longitude, latitude },
          region: { province: '경상북도', sigungu, dong, legal_dong_code: northern ? '4711311600' : '4713012300' },
        } })
        return
      }
      await route.fulfill({ status: 401, headers, json: { detail: 'Anonymous isolated camera test' } })
      return
    }
    if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      await route.continue()
      return
    }
    externalRequests.push(url.href)
    await route.abort('blockedbyclient')
  })
  return { mapCalls, reverseCalls, externalRequests }
}

async function nextCall(calls: MapCall[], previousCount: number) {
  await expect.poll(() => calls.length).toBeGreaterThan(previousCount)
  return calls[calls.length - 1]
}

async function tileProjectionError(page: Page, bounds: GeographicBounds) {
  // Decode the XYZ image URLs and compare their DOM positions with the HTTP
  // camera extent. This checks the actual base tiles without Leaflet internals.
  return page.locator('.leaflet-container').evaluate((map, expectedBounds) => {
    const mapBox = map.getBoundingClientRect()
    const mercator = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360))
    const longitudeScale = mapBox.width / (expectedBounds.east - expectedBounds.west)
    const latitudeScale = mapBox.height / (mercator(expectedBounds.north) - mercator(expectedBounds.south))
    const tiles = Array.from(map.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')).flatMap((tile) => {
      const xyz = new URL(tile.src).pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/)
      const box = tile.getBoundingClientRect()
      if (!xyz || box.right <= mapBox.left || box.left >= mapBox.right || box.bottom <= mapBox.top || box.top >= mapBox.bottom) return []
      const [z, x, y] = xyz.slice(1).map(Number)
      const count = 2 ** z
      const tileLongitude = x / count * 360 - 180
      const tileMercator = Math.PI * (1 - 2 * y / count)
      const expectedX = mapBox.x + (tileLongitude - expectedBounds.west) * longitudeScale
      const expectedY = mapBox.y + (mercator(expectedBounds.north) - tileMercator) * latitudeScale
      const expectedWidth = 360 / count * longitudeScale
      const expectedHeight = 2 * Math.PI / count * latitudeScale
      return [{ url: tile.src, error: Math.max(Math.abs(box.x - expectedX), Math.abs(box.y - expectedY), Math.abs(box.width - expectedWidth), Math.abs(box.height - expectedHeight)) }]
    })
    return { visibleTiles: tiles.length, maximumError: tiles.length ? Math.max(...tiles.map((tile) => tile.error)) : Infinity, mapBox: { x: mapBox.x, y: mapBox.y, width: mapBox.width, height: mapBox.height } }
  }, bounds)
}

async function expectTilesMatchCamera(page: Page, call: MapCall) {
  await expect.poll(async () => (await tileProjectionError(page, call.bounds)).visibleTiles).toBeGreaterThan(0)
  await expect.poll(async () => (await tileProjectionError(page, call.bounds)).maximumError).toBeLessThanOrEqual(2)
}

async function expectVisibleItemsMatchCamera(page: Page, call: MapCall) {
  await expect(page.locator('article h2')).toHaveText(call.items.map((item) => item.building_name))
  const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon')
  await expect(markers).toHaveCount(call.items.length)
  for (const [index, item] of call.items.entries()) {
    await expect.poll(async () => {
      const mapBox = await page.locator('.leaflet-container').boundingBox()
      const marker = await markers.nth(index).boundingBox()
      if (!mapBox || !marker) return Infinity
      const x = mapBox.x + mapBox.width * (item.longitude - call.bounds.west) / (call.bounds.east - call.bounds.west)
      const y = mapBox.y + mapBox.height * (mercatorY(call.bounds.north) - mercatorY(item.latitude)) / (mercatorY(call.bounds.north) - mercatorY(call.bounds.south))
      return Math.max(Math.abs(marker.x + 12 - x), Math.abs(marker.y + 41 - y))
    }).toBeLessThanOrEqual(2)
  }
}

async function selectGyeongju(page: Page, mapCalls: MapCall[]) {
  await page.goto('/map-search')
  await nextCall(mapCalls, 0)
  let previousCount = mapCalls.length
  await page.getByLabel('시·도', { exact: true }).selectOption('경북')
  await nextCall(mapCalls, previousCount)
  previousCount = mapCalls.length
  await page.getByLabel('시·군·구', { exact: true }).selectOption('경주시')
  const call = await nextCall(mapCalls, previousCount)
  await expect(page.getByRole('status')).toHaveText('경북 경주시 지역으로 지도 이동이 완료되었습니다.')
  return call
}

test.describe('경주시 선택 카메라와 바탕 타일 좌표', () => {
  test.use({ viewport: { width: 1536, height: 1000 }, deviceScaleFactor: 1.25, serviceWorkers: 'block' })

  test('경북에서 경주시를 선택하면 전체 경주 영역과 타일이 검색 카메라에 일치한다', async ({ page }, testInfo) => {
    const harness = await installCameraHarness(page)
    const call = await selectGyeongju(page, harness.mapCalls)
    const expected = getRegionViewport('경북', '경주시')
    for (const key of ['sido', 'sigungu', 'dong']) expect(call.url.searchParams.has(key)).toBe(false)
    expect(call.items.map((item) => item.auction_goods_id)).toEqual([93001, 93002])
    await expectVisibleItemsMatchCamera(page, call)
    await expect(page.getByText('화면 밖 서울 테스트 매물', { exact: true })).toHaveCount(0)
    expect(call.bounds.west).toBeLessThanOrEqual(expected.west)
    expect(call.bounds.east).toBeGreaterThanOrEqual(expected.east)
    expect(call.bounds.south).toBeLessThanOrEqual(expected.south)
    expect(call.bounds.north).toBeGreaterThanOrEqual(expected.north)
    const mapBox = await page.locator('.leaflet-container').boundingBox()
    expect(mapBox).not.toBeNull()
    const expectedLongitude = (expected.west + expected.east) / 2
    const expectedLatitude = inverseMercatorY((mercatorY(expected.south) + mercatorY(expected.north)) / 2)
    const actualLongitude = (call.bounds.west + call.bounds.east) / 2
    const actualLatitude = inverseMercatorY((mercatorY(call.bounds.south) + mercatorY(call.bounds.north)) / 2)
    expect(Math.abs(actualLongitude - expectedLongitude) * mapBox!.width / (call.bounds.east - call.bounds.west)).toBeLessThanOrEqual(2)
    expect(Math.abs(mercatorY(actualLatitude) - mercatorY(expectedLatitude)) * mapBox!.height / (mercatorY(call.bounds.north) - mercatorY(call.bounds.south))).toBeLessThanOrEqual(2)
    await expectTilesMatchCamera(page, call)
    const scroll = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewportHeight: window.innerHeight, width: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }))
    expect(scroll.height).toBeLessThanOrEqual(scroll.viewportHeight)
    expect(scroll.width).toBeLessThanOrEqual(scroll.viewportWidth)
    expect(harness.externalRequests).toEqual([])
    await testInfo.attach('camera-diagnostics', { body: JSON.stringify({ bounds: call.bounds, expected, actualLongitude, actualLatitude, projection: await tileProjectionError(page, call.bounds) }, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath('gyeongju-selected.png'), fullPage: true })
  })

  test('경주 선택 뒤 확대와 포항 방향 드래그는 역조회 표시만 갱신하고 현재 화면을 검색한다', async ({ page }, testInfo) => {
    const harness = await installCameraHarness(page)
    const selected = await selectGyeongju(page, harness.mapCalls)
    let previousCount = harness.mapCalls.length
    await page.locator('.leaflet-control-zoom-in').click()
    const zoomed = await nextCall(harness.mapCalls, previousCount)
    await expect(page.getByLabel('읍·면·동', { exact: true })).toHaveValue('보문동')
    expect(zoomed.bounds.east - zoomed.bounds.west).toBeLessThan(selected.bounds.east - selected.bounds.west)
    await expectTilesMatchCamera(page, zoomed)
    await expectVisibleItemsMatchCamera(page, zoomed)
    const box = await page.locator('.leaflet-container').boundingBox()
    expect(box).not.toBeNull()
    previousCount = harness.mapCalls.length
    const centerLongitude = (zoomed.bounds.west + zoomed.bounds.east) / 2
    const centerY = (mercatorY(zoomed.bounds.south) + mercatorY(zoomed.bounds.north)) / 2
    const deltaX = (centerLongitude - 129.365) * box!.width / (zoomed.bounds.east - zoomed.bounds.west)
    const deltaY = (mercatorY(36.04) - centerY) * box!.height / (mercatorY(zoomed.bounds.north) - mercatorY(zoomed.bounds.south))
    const startX = box!.x + box!.width * 0.5
    const startY = box!.y + box!.height * 0.15
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 20 })
    await page.mouse.up()
    const dragged = await nextCall(harness.mapCalls, previousCount)
    await expect(page.getByLabel('시·군·구', { exact: true })).toHaveValue('포항시 북구')
    await expect(page.getByLabel('읍·면·동', { exact: true })).toHaveValue('죽도동')
    await expect(page.getByRole('status')).toHaveText('경북 포항시 북구 죽도동 소재지가 지도 중심에 맞춰 자동으로 변경되었습니다.')
    const reverse = harness.reverseCalls[harness.reverseCalls.length - 1]
    const draggedBox = await page.locator('.leaflet-container').boundingBox()
    expect(draggedBox).not.toBeNull()
    expect(Math.abs(reverse.longitude - (dragged.bounds.west + dragged.bounds.east) / 2) * draggedBox!.width / (dragged.bounds.east - dragged.bounds.west)).toBeLessThanOrEqual(2)
    expect(Math.abs(mercatorY(reverse.latitude) - (mercatorY(dragged.bounds.south) + mercatorY(dragged.bounds.north)) / 2) * draggedBox!.height / (mercatorY(dragged.bounds.north) - mercatorY(dragged.bounds.south))).toBeLessThanOrEqual(2)
    for (const call of [zoomed, dragged]) {
      for (const key of ['sido', 'sigungu', 'dong']) expect(call.url.searchParams.has(key)).toBe(false)
    }
    await expectTilesMatchCamera(page, dragged)
    await expectVisibleItemsMatchCamera(page, dragged)
    expect(dragged.items.map((item) => item.auction_goods_id)).toContain(93002)
    expect(harness.externalRequests).toEqual([])
    await testInfo.attach('camera-diagnostics', { body: JSON.stringify({ selected: selected.bounds, zoomed: zoomed.bounds, dragged: dragged.bounds, reverse, projection: await tileProjectionError(page, dragged.bounds) }, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath('pohang-direction-drag.png'), fullPage: true })
  })
})
