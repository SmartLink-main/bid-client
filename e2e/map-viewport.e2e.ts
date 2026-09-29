import { expect, test, type Response } from '@playwright/test'

type MapResult = {
  total: number
  items: Array<{
    auction_goods_id: number
    schedule_goods_id: number
    longitude: number
    latitude: number
  }>
  bounds: { west: number; south: number; east: number; north: number }
}

function isMapResponse(response: Response) {
  return new URL(response.url()).pathname === '/api/v1/geo/map'
    && response.request().method() === 'GET'
}

function expectItemsInsideViewport(result: MapResult) {
  for (const item of result.items) {
    expect(item.longitude).toBeGreaterThanOrEqual(result.bounds.west)
    expect(item.longitude).toBeLessThanOrEqual(result.bounds.east)
    expect(item.latitude).toBeGreaterThanOrEqual(result.bounds.south)
    expect(item.latitude).toBeLessThanOrEqual(result.bounds.north)
  }
}

test('지도 확대와 실제 API 페이지에서 화면 밖 투영 모서리 물건을 제외한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.route('https://tile.openstreetmap.org/**', (route) => (
    route.fulfill({ status: 204, body: '' })
  ))
  await page.route('**/api/v1/refresh', (route) => route.fulfill({
    status: 401,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'http://127.0.0.1:3102',
    },
    json: { detail: 'Anonymous local viewport test.' },
  }))
  await page.route('**/api/v1/geo/reverse-region?**', (route) => route.fulfill({
    status: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': 'http://127.0.0.1:3102',
    },
    json: { coordinate_system: 'WGS84', region: null },
  }))

  const initialResponsePromise = page.waitForResponse(isMapResponse)
  await page.goto('/map-search')
  const initialResponse = await initialResponsePromise
  expect(initialResponse.status()).toBe(200)
  expectItemsInsideViewport(await initialResponse.json())

  const selectedResponsePromise = page.waitForResponse((response) => (
    isMapResponse(response) &&
    new URL(response.url()).searchParams.get('west') !== new URL(initialResponse.url()).searchParams.get('west')
  ))
  await page.getByLabel('시·도', { exact: true }).selectOption('서울')
  const selectedResponse = await selectedResponsePromise
  expect(selectedResponse.status()).toBe(200)
  expectItemsInsideViewport(await selectedResponse.json())
  for (const name of ['sido', 'sigungu', 'dong', 'region']) {
    expect(new URL(selectedResponse.url()).searchParams.has(name)).toBe(false)
  }

  const zoomedResponsePromise = page.waitForResponse((response) => (
    isMapResponse(response) &&
    new URL(response.url()).searchParams.get('west') !== new URL(selectedResponse.url()).searchParams.get('west')
  ))
  await page.locator('.leaflet-control-zoom-in').click()
  const zoomedResponse = await zoomedResponsePromise
  expect(zoomedResponse.status()).toBe(200)
  expectItemsInsideViewport(await zoomedResponse.json())
  await expect(page.getByText('현재 지도 자동 검색 완료', { exact: true })).toBeVisible()

  // 서울역 합성 물건은 KATEC 외접 범위에는 들어오지만 WGS84 서쪽 경계 밖이다.
  // 삼성역 물건은 화면 내부이므로 정상 결과와 빈 마지막 페이지를 함께 확인한다.
  const endpoint = new URL('/api/v1/geo/map', initialResponse.url()).href
  const bounds = { west: 126.973, south: 37.3, east: 127.15, north: 37.555 }
  const completeResponse = await page.request.get(endpoint, {
    params: { ...bounds, limit: 100, offset: 0 },
  })
  expect(completeResponse.status()).toBe(200)
  const complete: MapResult = await completeResponse.json()
  expectItemsInsideViewport(complete)
  expect(complete.items.map((item) => item.auction_goods_id)).toContain(91003)
  expect(complete.items.map((item) => item.auction_goods_id)).not.toContain(91002)
  expect(complete.total).toBe(complete.items.length)

  for (const offset of [0, 1, complete.total]) {
    const response = await page.request.get(endpoint, {
      params: { ...bounds, limit: 1, offset },
    })
    expect(response.status()).toBe(200)
    const result: MapResult = await response.json()
    expect(result.total).toBe(complete.total)
    expect(result.items.map((item) => item.schedule_goods_id)).toEqual(
      complete.items.slice(offset, offset + 1).map((item) => item.schedule_goods_id),
    )
  }
  const invalidResponse = await page.request.get(endpoint, {
    params: { ...bounds, west: bounds.east, east: bounds.west },
  })
  expect(invalidResponse.status()).toBe(422)
})
