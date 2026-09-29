import { expect, test, type Page, type Response, type Route } from '@playwright/test'
import type { GeographicBounds, GeographicSearchItem } from '../src/lib/auction-extra'

type Cluster = {
  key: string
  province: string | null
  sigungu: string | null
  count: number
  longitude: number
  latitude: number
  bounds: GeographicBounds
}
type MapBody = {
  bounds: GeographicBounds
  total: number
  items: GeographicSearchItem[]
  clusters?: Cluster[]
}
type MapCall = {
  url: URL
  body: MapBody
  status: number
  release: () => void
  done: Promise<void>
}

const groupedPins = (page: Page) => page.locator('.leaflet-marker-pane .map-region-cluster')
const propertyPins = (page: Page) => page.locator('.leaflet-marker-pane .auction-property-marker')
const clusterLabel = (cluster: Cluster) => {
  const region = [cluster.province, cluster.sigungu].filter(Boolean).join(' ') || '지역 미상'
  return `${region} ${cluster.count.toLocaleString('ko-KR')}건, 확대`
}

function mapBody(url: URL, revision: number): MapBody {
  const bounds = Object.fromEntries(['west', 'south', 'east', 'north'].map((edge) => [edge, Number(url.searchParams.get(edge))])) as GeographicBounds
  const provinces = [
    { name: '서울특별시', districts: ['중구', '강남구'] },
    { name: '부산광역시', districts: ['중구', '해운대구'] },
    { name: '경상북도', districts: ['경주시', '포항시 북구'] },
    { name: '경상남도', districts: ['진주시', '창원시 의창구'] },
  ]
  const districtClusters: Cluster[] = provinces.flatMap((province, provinceIndex) => province.districts.map((sigungu, districtIndex) => {
    const index = provinceIndex * 2 + districtIndex
    const longitude = bounds.west + (bounds.east - bounds.west) * (0.2 + provinceIndex * 0.2)
    const latitude = bounds.south + (bounds.north - bounds.south) * (districtIndex === 0 ? 0.35 : 0.6)
    // The second district deliberately has one coordinate; its click must
    // still enlarge the map. Two districts then merge into each province pin.
    const radius = index === 0 ? 0.001 : 0
    return {
      key: `${province.name}|${sigungu}`, province: province.name, sigungu, count: 120 + index * 10 + revision,
      longitude, latitude,
      bounds: { west: longitude - radius, south: latitude - radius, east: longitude + radius, north: latitude + radius },
    }
  }))
  const provinceClusters: Cluster[] = provinces.map((province) => {
    const districts = districtClusters.filter((cluster) => cluster.province === province.name)
    return {
      key: `sido|${province.name}`, province: province.name, sigungu: null,
      count: districts.reduce((sum, cluster) => sum + cluster.count, 0),
      longitude: (districts[0].longitude + districts[1].longitude) / 2,
      latitude: (districts[0].latitude + districts[1].latitude) / 2,
      bounds: {
        west: Math.min(...districts.map((cluster) => cluster.bounds.west)),
        south: Math.min(...districts.map((cluster) => cluster.bounds.south)),
        east: Math.max(...districts.map((cluster) => cluster.bounds.east)),
        north: Math.max(...districts.map((cluster) => cluster.bounds.north)),
      },
    }
  })
  const items = districtClusters.map((cluster, index) => ({
    auction_goods_id: 96001 + index,
    schedule_goods_id: 97001 + index,
    longitude: cluster.longitude,
    latitude: cluster.latitude,
    building_name: `현재 영역 ${revision} 물건 ${index + 1}`,
    printed_address: `${cluster.province} ${cluster.sigungu} 테스트 주소`,
    current_lowest_sale_price: 200_000_000,
  }))
  const grouping = url.searchParams.get('cluster_by')
  return {
    bounds, total: districtClusters.reduce((sum, cluster) => sum + cluster.count, 0), items,
    ...(grouping ? { clusters: grouping === 'sido' ? provinceClusters : districtClusters } : {}),
  }
}

async function installHarness(page: Page, useRealMapApi = false) {
  const calls: MapCall[] = []
  const externalRequests: string[] = []
  const state = { holdNext: false, failNext: false }
  await page.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url())
    const headers = {
      'Access-Control-Allow-Origin': route.request().headers().origin ?? 'http://127.0.0.1:3102',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    }
    if (url.hostname === 'tile.openstreetmap.org') {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#e2e8f0" d="M0 0h256v256H0z"/><path stroke="#cbd5e1" d="M0 128h256M128 0v256"/></svg>' })
      return
    }
    if (url.pathname.startsWith('/api/')) {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      if (url.pathname === '/api/v1/geo/map') {
        if (useRealMapApi) {
          // The shared config always creates its own loopback SQLite harness.
          expect(['127.0.0.1', 'localhost']).toContain(url.hostname)
          expect(url.port).toBe('8102')
          await route.continue()
          return
        }
        const body = mapBody(url, calls.length + 1)
        const status = state.failNext ? 422 : 200
        state.failNext = false
        let release = () => {}
        let finish = () => {}
        const gate = new Promise<void>((resolve) => { release = resolve })
        const done = new Promise<void>((resolve) => { finish = resolve })
        calls.push({ url, body, status, release, done })
        if (state.holdNext) state.holdNext = false
        else release()
        await gate
        try {
          await route.fulfill({ status, headers, json: status === 200 ? {
            ...body, search_type: 'map', coordinate_system: 'WGS84',
            limit: 100, offset: Number(url.searchParams.get('offset') ?? 0),
            coverage: { matched_total: body.total, page_candidates: body.items.length, page_items: body.items.length, excluded_unconvertible: 0 },
            excluded_items: [],
          } : { detail: '지역 묶음 테스트 검색 실패' } })
        } finally {
          finish()
        }
        return
      }
      if (url.pathname === '/api/v1/geo/reverse-region') {
        await route.fulfill({ headers, json: { coordinate_system: 'WGS84', region: null } })
        return
      }
      await route.fulfill({ status: 401, headers, json: { detail: 'Anonymous isolated cluster test' } })
      return
    }
    if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      await route.continue()
      return
    }
    externalRequests.push(url.href)
    await route.abort('blockedbyclient')
  })
  return {
    calls, state, externalRequests,
    releaseAll: async () => {
      calls.forEach((call) => call.release())
      await Promise.all(calls.map((call) => call.done))
    },
  }
}

async function nextCall(calls: MapCall[], previous: number) {
  await expect.poll(() => calls.length).toBeGreaterThan(previous)
  return calls[calls.length - 1]
}

async function expectGroups(page: Page, call: MapCall, expectedMode: 'sido' | 'sigungu' = 'sido') {
  expect(call.url.searchParams.get('cluster_by')).toBe(expectedMode)
  const expectedCount = expectedMode === 'sido' ? 4 : 8
  expect(call.body.clusters).toHaveLength(expectedCount)
  expect(call.body.clusters!.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(call.body.total)
  await expect(groupedPins(page)).toHaveCount(expectedCount)
  await expect(propertyPins(page)).toHaveCount(0)
  await expect(page.getByText(`${expectedMode === 'sido' ? '시·도' : '시·군·구'} 묶음 ${expectedCount}개`, { exact: true })).toBeVisible()
  for (const cluster of call.body.clusters!) {
    await expect(page.getByRole('button', { name: clusterLabel(cluster), exact: true })).toBeVisible()
  }
  await expect(page.locator('article h2')).toHaveText(call.body.items.map((item) => item.building_name!))
}

async function zoomUntil(page: Page, calls: MapCall[], mode: 'sido' | 'sigungu' | null, direction: 'in' | 'out') {
  let current = calls[calls.length - 1]
  for (let step = 0; step < 8 && current.url.searchParams.get('cluster_by') !== mode; step += 1) {
    const previous = calls.length
    await page.locator(`.leaflet-control-zoom-${direction}`).click()
    current = await nextCall(calls, previous)
  }
  expect(current.url.searchParams.get('cluster_by')).toBe(mode)
  return current
}

async function dragMap(page: Page, deltaX: number, deltaY: number, duringDrag?: () => Promise<void>) {
  const box = await page.locator('.leaflet-container').boundingBox()
  expect(box).not.toBeNull()
  const start = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.78 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  try {
    await page.mouse.move(start.x + deltaX, start.y + deltaY, { steps: 12 })
    await duringDrag?.()
  } finally {
    await page.mouse.up()
  }
}

test.describe('지도 화면 크기에 따른 시도·시군구 묶음 핀', () => {
  test.use({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })

  test('전체 물건을 남북도별로 나누고 확대·축소하면 시도·시군구·개별 핀을 차례로 전환한다', async ({ page }, testInfo) => {
    const harness = await installHarness(page)
    try {
      await page.goto('/map-search')
      let current = await nextCall(harness.calls, 0)
      await expectGroups(page, current)
      expect(current.body.total).toBeGreaterThan(100)
      expect(current.body.bounds.north - current.body.bounds.south).toBeGreaterThanOrEqual(1.5)
      expect(current.body.clusters!.every((cluster) => cluster.sigungu === null)).toBe(true)
      for (const province of ['경상북도', '경상남도']) {
        const cluster = current.body.clusters!.find((candidate) => candidate.province === province)!
        await expect(page.getByRole('button', { name: clusterLabel(cluster), exact: true })).toBeVisible()
      }
      await expect(page.getByText(`${current.body.total.toLocaleString('ko-KR')}개`, { exact: true })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('zoomed-out-region-groups.png'), fullPage: true })

      current = await zoomUntil(page, harness.calls, 'sigungu', 'in')
      await expectGroups(page, current, 'sigungu')
      expect(current.body.bounds.north - current.body.bounds.south).toBeLessThan(1.5)
      const sameDistrictNames = current.body.clusters!.filter((cluster) => cluster.sigungu === '중구')
      expect(sameDistrictNames).toHaveLength(2)
      expect(sameDistrictNames[0].key).not.toBe(sameDistrictNames[1].key)
      await page.screenshot({ path: testInfo.outputPath('regional-district-groups.png'), fullPage: true })
      await zoomUntil(page, harness.calls, null, 'in')
      await expect(groupedPins(page)).toHaveCount(0)
      await expect(propertyPins(page)).toHaveCount(8)

      await expectGroups(page, await zoomUntil(page, harness.calls, 'sigungu', 'out'), 'sigungu')
      await expectGroups(page, await zoomUntil(page, harness.calls, 'sido', 'out'))
      expect(harness.externalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  for (const groupIndex of [0, 1]) {
    test(`${groupIndex === 0 ? '영역' : '한 좌표'} 시군구 핀을 누르면 가격·물건 종류를 유지한 채 확대한다`, async ({ page }) => {
      const harness = await installHarness(page)
      try {
        await page.goto('/map-search')
        await expectGroups(page, await nextCall(harness.calls, 0))
        await expectGroups(page, await zoomUntil(page, harness.calls, 'sigungu', 'in'), 'sigungu')
        let previous = harness.calls.length
        await page.getByLabel('물건종류').selectOption({ label: '아파트' })
        await nextCall(harness.calls, previous)
        previous = harness.calls.length
        await page.getByLabel('최저가 최소').fill('100000000')
        await nextCall(harness.calls, previous)
        previous = harness.calls.length
        await page.getByLabel('최저가 최대').fill('300000000')
        const filtered = await nextCall(harness.calls, previous)
        await expectGroups(page, filtered, 'sigungu')

        previous = harness.calls.length
        const cluster = filtered.body.clusters![groupIndex]
        await page.getByRole('button', { name: clusterLabel(cluster), exact: true }).click()
        const zoomed = await nextCall(harness.calls, previous)
        expect(zoomed.body.bounds.east - zoomed.body.bounds.west).toBeLessThan(filtered.body.bounds.east - filtered.body.bounds.west)
        expect(zoomed.url.searchParams.has('cluster_by')).toBe(false)
        expect(zoomed.url.searchParams.getAll('goods_usage')).toEqual(['아파트'])
        expect(zoomed.url.searchParams.get('min_lowest_sale_price')).toBe('100000000')
        expect(zoomed.url.searchParams.get('max_lowest_sale_price')).toBe('300000000')
        for (const name of ['sido', 'sigungu', 'dong', 'region']) expect(zoomed.url.searchParams.has(name)).toBe(false)
        expect(cluster.longitude).toBeGreaterThanOrEqual(zoomed.body.bounds.west)
        expect(cluster.longitude).toBeLessThanOrEqual(zoomed.body.bounds.east)
        expect(cluster.latitude).toBeGreaterThanOrEqual(zoomed.body.bounds.south)
        expect(cluster.latitude).toBeLessThanOrEqual(zoomed.body.bounds.north)
        await expect(groupedPins(page)).toHaveCount(0)
        await expect(propertyPins(page)).toHaveCount(8)
        expect(harness.externalRequests).toEqual([])
      } finally {
        await harness.releaseAll()
      }
    })
  }

  test('시도 핀을 누르면 그 물건 범위로 확대하고 가격·물건 종류를 유지한다', async ({ page }) => {
    const harness = await installHarness(page)
    try {
      await page.goto('/map-search')
      await expectGroups(page, await nextCall(harness.calls, 0))
      let previous = harness.calls.length
      await page.getByLabel('물건종류').selectOption({ label: '아파트' })
      await nextCall(harness.calls, previous)
      previous = harness.calls.length
      await page.getByLabel('최저가 최소').fill('100000000')
      await nextCall(harness.calls, previous)
      previous = harness.calls.length
      await page.getByLabel('최저가 최대').fill('300000000')
      const filtered = await nextCall(harness.calls, previous)
      await expectGroups(page, filtered)
      const province = filtered.body.clusters!.find((cluster) => cluster.province === '경상남도')!
      previous = harness.calls.length
      await page.getByRole('button', { name: clusterLabel(province), exact: true }).click()
      const zoomed = await nextCall(harness.calls, previous)
      expect(zoomed.body.bounds.north - zoomed.body.bounds.south).toBeLessThan(filtered.body.bounds.north - filtered.body.bounds.south)
      expect(zoomed.body.bounds.west).toBeLessThanOrEqual(province.bounds.west)
      expect(zoomed.body.bounds.south).toBeLessThanOrEqual(province.bounds.south)
      expect(zoomed.body.bounds.east).toBeGreaterThanOrEqual(province.bounds.east)
      expect(zoomed.body.bounds.north).toBeGreaterThanOrEqual(province.bounds.north)
      expect(zoomed.url.searchParams.getAll('goods_usage')).toEqual(['아파트'])
      expect(zoomed.url.searchParams.get('min_lowest_sale_price')).toBe('100000000')
      expect(zoomed.url.searchParams.get('max_lowest_sale_price')).toBe('300000000')
      for (const name of ['sido', 'sigungu', 'dong', 'region']) expect(zoomed.url.searchParams.has(name)).toBe(false)
      await expectGroups(page, zoomed, 'sigungu')
      expect(harness.externalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('줌이 같아도 화면 높이가 바뀌어 세로 범위가 줄거나 늘면 시도·시군구 묶음을 전환한다', async ({ page }) => {
    const harness = await installHarness(page)
    try {
      await page.goto('/map-search')
      await expectGroups(page, await nextCall(harness.calls, 0))
      let previous = harness.calls.length
      await page.locator('.leaflet-control-zoom-in').click()
      const tall = await nextCall(harness.calls, previous)
      await expectGroups(page, tall)
      expect(tall.body.bounds.north - tall.body.bounds.south).toBeGreaterThanOrEqual(1.5)

      previous = harness.calls.length
      await page.setViewportSize({ width: 1440, height: 600 })
      const short = await nextCall(harness.calls, previous)
      await expectGroups(page, short, 'sigungu')
      expect(short.body.bounds.north - short.body.bounds.south).toBeLessThan(1.5)
      // Horizontal extent remains identical: only the visible north/south
      // span changed, without altering zoom or choosing another region.
      expect(short.body.bounds.east - short.body.bounds.west).toBeCloseTo(tall.body.bounds.east - tall.body.bounds.west, 8)

      previous = harness.calls.length
      await page.setViewportSize({ width: 1440, height: 1000 })
      const tallAgain = await nextCall(harness.calls, previous)
      await expectGroups(page, tallAgain)
      expect(tallAgain.body.bounds.north - tallAgain.body.bounds.south).toBeGreaterThanOrEqual(1.5)
      expect(tallAgain.body.bounds.east - tallAgain.body.bounds.west).toBeCloseTo(short.body.bounds.east - short.body.bounds.west, 8)
      expect(harness.externalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('지도 이동 중 오래된 묶음을 숨기고 지연·실패 응답 뒤에도 현재 영역만 표시한다', async ({ page }) => {
    const harness = await installHarness(page)
    try {
      await page.goto('/map-search')
      await expectGroups(page, await nextCall(harness.calls, 0))
      harness.state.holdNext = true
      let previous = harness.calls.length
      await dragMap(page, 120, 30, async () => {
        await expect(groupedPins(page)).toHaveCount(0)
        await expect(propertyPins(page)).toHaveCount(0)
      })
      const delayed = await nextCall(harness.calls, previous)
      await expect(groupedPins(page)).toHaveCount(0)
      previous = harness.calls.length
      await dragMap(page, -170, -40)
      const current = await nextCall(harness.calls, previous)
      await expectGroups(page, current)
      delayed.release()
      await delayed.done
      await expectGroups(page, current)
      for (const cluster of delayed.body.clusters!) {
        await expect(page.getByRole('button', { name: clusterLabel(cluster), exact: true })).toHaveCount(0)
      }

      harness.state.failNext = true
      previous = harness.calls.length
      await page.getByLabel('최저가 최소').fill('123456789')
      expect((await nextCall(harness.calls, previous)).status).toBe(422)
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(groupedPins(page)).toHaveCount(0)
      await expect(propertyPins(page)).toHaveCount(0)
      previous = harness.calls.length
      await page.getByLabel('최저가 최소').fill('123456790')
      await expectGroups(page, await nextCall(harness.calls, previous))
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(harness.externalRequests).toEqual([])
    } finally {
      await harness.releaseAll()
    }
  })

  test('격리 DB의 실제 API가 목록 페이지와 독립된 집계를 반환하고 묶음 클릭으로 개별 물건에 진입한다', async ({ page }) => {
    const harness = await installHarness(page, true)
    const isMapResponse = (response: Response) => new URL(response.url()).pathname === '/api/v1/geo/map' && response.request().method() === 'GET'
    const initialPromise = page.waitForResponse(isMapResponse)
    await page.goto('/map-search')
    const initial = await initialPromise
    expect(initial.status()).toBe(200)
    expect(new URL(initial.url()).searchParams.get('cluster_by')).toBe('sido')
    const result: MapBody = await initial.json()
    expect(result.total).toBeGreaterThan(0)
    expect(result.clusters!.every((cluster) => cluster.sigungu === null)).toBe(true)
    expect(new Set(result.clusters!.map((cluster) => cluster.province)).size).toBe(result.clusters!.length)
    expect(result.clusters!.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(result.total)
    await expect(groupedPins(page)).toHaveCount(result.clusters!.length)
    await expect(propertyPins(page)).toHaveCount(0)
    const districtEndpoint = new URL(initial.url())
    districtEndpoint.searchParams.set('cluster_by', 'sigungu')
    const districtResponse = await page.request.get(districtEndpoint.href)
    expect(districtResponse.status()).toBe(200)
    const districts: MapBody = await districtResponse.json()
    expect(districts.total).toBe(result.total)
    expect(result.clusters!.length).toBeLessThan(districts.clusters!.length)
    for (const province of result.clusters!) {
      const districtTotal = districts.clusters!
        .filter((district) => district.province === province.province)
        .reduce((sum, district) => sum + district.count, 0)
      expect(province.count).toBe(districtTotal)
    }
    const endpoint = new URL(initial.url())
    endpoint.searchParams.set('limit', '1')
    endpoint.searchParams.set('offset', String(result.total))
    const emptyPage = await page.request.get(endpoint.href)
    expect(emptyPage.status()).toBe(200)
    const pageBody: MapBody = await emptyPage.json()
    expect(pageBody.items).toEqual([])
    expect(pageBody.total).toBe(result.total)
    expect(pageBody.clusters).toEqual(result.clusters)

    // The three station fixtures have real coordinates but intentionally no
    // region relation, so they belong to the explicit unknown-region group.
    const stationFixtures = result.clusters!.find((cluster) => cluster.province === null && cluster.sigungu === null)!
    expect(stationFixtures).toBeTruthy()
    expect(stationFixtures.count).toBe(3)
    const zoomedPromise = page.waitForResponse((response) => isMapResponse(response) && !new URL(response.url()).searchParams.has('cluster_by'))
    // Nearby Seoul districts overlap at the national scale. Keyboard activation
    // also verifies that every region remains reachable independently.
    await page.getByRole('button', { name: clusterLabel(stationFixtures), exact: true }).focus()
    await page.keyboard.press('Enter')
    const zoomed = await zoomedPromise
    expect(zoomed.status()).toBe(200)
    const detail: MapBody = await zoomed.json()
    expect(detail.items.map((item) => item.auction_goods_id)).toContain(91002)
    await expect(groupedPins(page)).toHaveCount(0)
    await expect(propertyPins(page)).toHaveCount(detail.items.length)
    await expect(page.getByRole('heading', { name: '서울역 중심 테스트 물건' })).toBeVisible()
    expect(harness.externalRequests).toEqual([])
  })

  test('전국 지도를 두 단계 더 축소해도 지원 좌표 안의 실제 API 조회와 묶음 핀이 유지된다', async ({ page }) => {
    const harness = await installHarness(page, true)
    const isMapResponse = (response: Response) => new URL(response.url()).pathname === '/api/v1/geo/map' && response.request().method() === 'GET'
    const initialPromise = page.waitForResponse(isMapResponse)
    await page.goto('/map-search')
    let response = await initialPromise
    expect(response.status()).toBe(200)
    for (let step = 0; step < 2; step += 1) {
      const previousUrl = response.url()
      const nextResponse = page.waitForResponse((candidate) => isMapResponse(candidate) && candidate.url() !== previousUrl)
      await page.locator('.leaflet-control-zoom-out').click()
      response = await nextResponse
      expect(response.status()).toBe(200)
      const url = new URL(response.url())
      expect(url.searchParams.get('cluster_by')).toBe('sido')
      const result: MapBody = await response.json()
      expect(result.bounds.west).toBeGreaterThanOrEqual(120)
      expect(result.bounds.east).toBeLessThanOrEqual(140)
      expect(result.bounds.south).toBeGreaterThanOrEqual(30)
      expect(result.bounds.north).toBeLessThanOrEqual(45)
      expect(result.total).toBeGreaterThan(0)
      expect(result.clusters!.reduce((sum, cluster) => sum + cluster.count, 0)).toBe(result.total)
      await expect(groupedPins(page)).toHaveCount(result.clusters!.length)
      await expect(propertyPins(page)).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)
    }
    expect(harness.externalRequests).toEqual([])
  })
})
