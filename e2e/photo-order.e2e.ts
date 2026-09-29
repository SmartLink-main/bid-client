import { expect, test, type Page } from '@playwright/test'
import type { GoodsDetailResponse } from '../src/lib/goods'

const api = 'http://127.0.0.1:8191'
const client = 'http://127.0.0.1:3191'
const codes = ['000241', '000244', '000243', '000242', '000246', null, '000249', '000245', '000245', '000241', '000244', null]

// 합성 사진의 분류만 바꾸며 모든 미디어는 기존 메모리 CDN에서 읽는다.
async function installPhotoScenario(page: Page, divisions: Array<string | null>) {
  await page.route(`${api}/api/v1/goods/1`, async route => {
    const response = await route.fetch()
    const detail: GoodsDetailResponse = await response.json()
    detail.photos.items = detail.photos.items.slice(0, divisions.length).map((photo, index) => ({
      ...photo,
      photo_division_code: divisions[index],
      photo_title: `원문 사진 ${index + 1}`,
    }))
    await route.fulfill({ response, json: detail })
  })
  await page.route(`${api}/api/v1/search?*`, route => route.fulfill({ json: {
    total: 1,
    limit: 20,
    offset: 0,
    items: [{
      auction_goods_id: 1,
      schedule_id: 'local-photo-order',
      case_id: 'local-photo-order',
      branch_name: '로컬 검증 법원',
      goods_usage_name: '아파트',
      printed_address: '대표사진 검증용 합성 물건',
    }],
  } }))
}

// 검색 대표사진을 실제로 읽은 뒤 상세 링크를 클릭하여 첫 사진과 대조한다.
async function openDetailFromSearch(page: Page) {
  await page.goto('/search?q=대표사진')
  const card = page.getByRole('article').filter({ hasText: '대표사진 검증용 합성 물건' })
  const image = card.getByRole('img', { name: '물건 대표 사진' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(240)
  const source = await image.getAttribute('src')
  await card.getByRole('link', { name: '상세보기' }).click()
  await expect(page).toHaveURL(/\/goods\/1$/)
  const gallery = page.getByRole('region', { name: '물건 사진 목록' })
  await gallery.scrollIntoViewIfNeeded()
  await expect(gallery.getByRole('img').first()).toHaveAttribute('src', source!)
  return gallery
}

test.beforeEach(async ({ page, request }) => {
  // 실제 CDN·API로의 실수 요청을 차단한다.
  await page.route(/^https?:\/\//, route => {
    const origin = new URL(route.request().url()).origin
    return [api, client].includes(origin) ? route.fallback() : route.abort()
  })
  await request.post(`${api}/__photo_cost/reset`)
})

test('검색과 상세는 첫 관련사진을 공유하고 대표를 제외한 원문 순서는 더보기 후에도 유지한다', async ({ page, request }, testInfo) => {
  await installPhotoScenario(page, codes)
  const mediaRequests: string[] = []
  page.on('request', request => {
    if (/\/g\/|\/photos\//.test(request.url())) mediaRequests.push(request.url())
  })
  const gallery = await openDetailFromSearch(page)
  await expect(gallery.getByRole('img')).toHaveCount(3)
  await expect(gallery.getByRole('img').first()).toHaveAttribute('alt', '원문 사진 8')
  expect(await gallery.getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('alt'))))
    .toEqual(['원문 사진 8', '원문 사진 1', '원문 사진 2'])
  for (const image of await gallery.getByRole('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(240)
  }
  const firstBatch = await (await request.get(`${api}/__photo_cost/stats`)).json()
  expect(firstBatch.origin_reads).toBe(3)
  expect(mediaRequests.every(url => url.startsWith(`${api}/g/`) && !url.includes('?'))).toBe(true)
  for (const remaining of [9, 6, 3]) {
    await gallery.getByRole('button', { name: `사진 더 보기 (${remaining}장)` }).click()
  }
  await expect(gallery.getByRole('img')).toHaveCount(12)
  expect(await gallery.getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('alt'))))
    .toEqual([8, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12].map(number => `원문 사진 ${number}`))
  await expect(gallery.getByRole('button', { name: /사진 더 보기/ })).toHaveCount(0)
  await gallery.getByRole('img').first().scrollIntoViewIfNeeded()
  await gallery.screenshot({ path: testInfo.outputPath('representative-photo-order.png') })
})

for (const scenario of [
  { label: '전경도', divisions: ['000244', '000243', '000241', '000241'], expected: 3 },
  { label: '위치도', divisions: ['000243', '000242', '000244', '000244'], expected: 3 },
  { label: '첫 유효사진', divisions: [null, '000243', '000242'], expected: 1 },
]) {
  test(`관련사진이 없으면 ${scenario.label}를 목록과 상세에서 동일하게 선택한다`, async ({ page }) => {
    await installPhotoScenario(page, scenario.divisions)
    const gallery = await openDetailFromSearch(page)
    await expect(gallery.getByRole('img').first()).toHaveAttribute('alt', `원문 사진 ${scenario.expected}`)
  })
}

test('대표사진 CDN 오류는 다른 사진으로 자동 대체하지 않고 같은 URL 재시도로 복구한다', async ({ page }) => {
  await installPhotoScenario(page, codes)
  const initial = await (await page.request.get(`${api}/api/v1/goods/1`)).json() as GoodsDetailResponse
  const representativeURL = `${api}${initial.photos.items[7].cdn_path}`
  let attempts = 0
  const proxyRequests: string[] = []
  page.on('request', request => { if (/\/photos\//.test(request.url())) proxyRequests.push(request.url()) })
  await page.route(representativeURL, route => {
    attempts += 1
    return attempts === 1 ? route.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' } }) : route.fallback()
  })
  await page.goto('/goods/1')
  const gallery = page.getByRole('region', { name: '물건 사진 목록' })
  await gallery.scrollIntoViewIfNeeded()
  const firstCard = gallery.getByRole('article').first()
  await expect(firstCard.getByRole('button', { name: '사진 다시 시도' })).toBeVisible()
  expect(attempts).toBe(1)
  await firstCard.getByRole('button', { name: '사진 다시 시도' }).click()
  const first = firstCard.getByRole('img')
  await expect(first).toHaveAttribute('alt', '원문 사진 8')
  await expect(first).toHaveAttribute('src', representativeURL)
  await expect.poll(() => first.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(240)
  expect(attempts).toBe(2)
  expect(proxyRequests).toEqual([])
})

test('사진이 없으면 검색과 상세 모두 빈 상태를 보여주고 미디어를 요청하지 않는다', async ({ page }) => {
  await installPhotoScenario(page, [])
  const mediaRequests: string[] = []
  page.on('request', request => { if (/\/g\/|\/photos\//.test(request.url())) mediaRequests.push(request.url()) })
  await page.goto('/search?q=대표사진')
  const card = page.getByRole('article').filter({ hasText: '대표사진 검증용 합성 물건' })
  await expect(card.getByText('사진 없음', { exact: true })).toBeVisible()
  await expect(card.getByRole('img')).toHaveCount(0)
  await card.getByRole('link', { name: '상세보기' }).click()
  await expect(page.getByText('아직 수집된 물건 사진이 없습니다.')).toBeVisible()
  await expect(page.getByRole('region', { name: '물건 사진 목록' })).toHaveCount(0)
  expect(mediaRequests).toEqual([])
})
