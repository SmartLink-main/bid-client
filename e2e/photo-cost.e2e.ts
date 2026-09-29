import { expect, test } from '@playwright/test'

const api = 'http://127.0.0.1:8191'
test.beforeEach(async ({ request, page }) => {
  await request.post(`${api}/__photo_cost/reset`)
  await page.route(/^https?:\/\//, route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort())
})

test('12장의 사진 중 처음 3장만 요청하고 다른 사용자도 CDN 캐시를 공유한다', async ({ page, browser, request }, testInfo) => {
  const proxyRequests: string[] = []
  page.on('request', req => { if (/\/photos\//.test(req.url())) proxyRequests.push(req.url()) })
  await page.goto('/goods/1')
  const gallery = page.getByRole('region', { name: '물건 사진 목록' })
  await gallery.scrollIntoViewIfNeeded()
  await expect(gallery.getByRole('img')).toHaveCount(3)
  for (const img of await gallery.getByRole('img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((x: HTMLImageElement) => x.naturalWidth)).toBe(240)
    await expect(img).toHaveAttribute('src', /\/g\/[a-f0-9]{24}\.png$/)
  }
  const before = await (await request.get(`${api}/__photo_cost/stats`)).json()
  expect(before.origin_reads).toBe(3)
  expect(proxyRequests).toEqual([])
  const other = await browser.newContext()
  const second = await other.newPage()
  await second.goto('http://127.0.0.1:3191/goods/1')
  const images = second.getByRole('region', { name: '물건 사진 목록' }).getByRole('img')
  await expect(images).toHaveCount(3)
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((x: HTMLImageElement) => x.naturalWidth)).toBe(240)
  }
  const shared = await (await request.get(`${api}/__photo_cost/stats`)).json()
  expect(shared.origin_reads).toBe(3)
  expect(shared.cdn_requests).toBeGreaterThanOrEqual(6)
  await other.close()
  await gallery.getByRole('button', { name: '사진 더 보기 (9장)' }).click()
  await expect(gallery.getByRole('img')).toHaveCount(6)
  await expect(gallery.getByRole('button', { name: '사진 더 보기 (6장)' })).toBeVisible()
  await gallery.screenshot({ path: testInfo.outputPath('photo-cdn-gallery.png') })
})

test('CDN 오류는 자동 원본 재요청 없이 표시하고 같은 URL로 수동 재시도한다', async ({ page, request }) => {
  await request.post(`${api}/__photo_cost/reset?fail_next=true`)
  const urls: string[] = []
  page.on('request', req => { if (/\/g\//.test(req.url()) || /\/photos\//.test(req.url())) urls.push(req.url()) })
  await page.goto('/goods/1')
  const gallery = page.getByRole('region', { name: '물건 사진 목록' })
  await gallery.scrollIntoViewIfNeeded()
  const retry = gallery.getByRole('button', { name: '사진 다시 시도' })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(retry).toHaveCount(0)
  for (const img of await gallery.getByRole('img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((x: HTMLImageElement) => x.naturalWidth)).toBe(240)
  }
  expect(urls.some(url => url.includes('/photos/'))).toBe(false)
  expect(urls.every(url => !url.includes('?'))).toBe(true)
  expect(new Set(urls).size).toBe(3)
})
