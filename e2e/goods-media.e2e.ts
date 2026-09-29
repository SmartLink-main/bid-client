import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

for (const width of [390, 1280]) {
  test(`사진 목록을 가로로 스크롤한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 })
    await page.route('**/api/v1/goods/1', async route => {
      const response = await route.fetch()
      const detail = await response.json()
      const photo = detail.photos.items[0]
      detail.photos.items = Array.from({ length: 6 }, (_, index) => ({
        ...photo, photo_id: index + 10, photo_title: `가로 스크롤 사진 ${index + 1}`,
      }))
      await route.fulfill({ response, json: detail })
    })
    await page.goto('/goods/1')
    const gallery = page.getByRole('region', { name: '물건 사진 목록' })
    await gallery.scrollIntoViewIfNeeded()
    const first = page.getByRole('img', { name: '가로 스크롤 사진 1', exact: true })
    await expect.poll(() => first.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(240)
    expect(await gallery.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await gallery.hover()
    await page.mouse.wheel(650, 0)
    await expect.poll(() => gallery.evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
    await gallery.focus()
    const before = await gallery.evaluate(element => element.scrollLeft)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => gallery.evaluate(element => element.scrollLeft)).toBeLessThan(before)
    await expect(gallery.getByRole('img')).toHaveCount(3)
    await gallery.getByRole('button', { name: '사진 더 보기 (3장)' }).click()
    await expect(gallery.getByRole('img')).toHaveCount(6)
    await page.screenshot({ path: testInfo.outputPath('horizontal-photos.png') })
  })
}

test('같은 물건의 사진 표시와 명세서 PDF 보기·다운로드', async ({ page, request }, testInfo) => {
  await page.clock.install()
  await page.goto('/goods/1')
  const photo = page.getByRole('img', { name: '물건 1 합성 테스트 사진' })
  await expect(photo).toHaveCount(1)
  await page.clock.fastForward(16_000)
  await expect(photo).toHaveCount(1)
  await expect(page.getByRole('button', { name: '사진 다시 시도' })).toHaveCount(0)
  await photo.scrollIntoViewIfNeeded()
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(240)
  await page.getByRole('button', { name: 'PDF 보기', exact: true }).click()
  const preview = page.getByRole('img', { name: '매각물건명세서 1페이지' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('data-rendered', 'true')
  expect(await preview.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let dark = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 100 && pixels[i + 3] > 0) dark++
    return dark
  })).toBeGreaterThan(100)
  await expect(page.getByText('1 / 2 페이지', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
  await page.getByRole('button', { name: '다음 페이지' }).click()
  await expect(page.getByRole('img', { name: '매각물건명세서 2페이지' })).toHaveAttribute('data-rendered', 'true')
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  await page.getByRole('button', { name: '이전 페이지' }).click()
  await expect(preview).toHaveAttribute('data-rendered', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('photo-and-document.png'), fullPage: true })
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: '다운로드', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('sale-specification-1-1.pdf')
  const path = await download.path()
  const bytes = await readFile(path!)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(bytes.toString()).toContain('SALE SPECIFICATION - LOCAL TEST')
  await page.getByRole('button', { name: '미리보기 닫기' }).click()
  await expect(preview).toHaveCount(0)
  expect((await request.get('http://127.0.0.1:8191/api/v1/goods/1/documents/2')).status()).toBe(404)
  expect((await request.get('http://127.0.0.1:8191/api/v1/goods/1/photos/2')).status()).toBe(404)
})

test('사진과 명세서 저장소 오류 표시 후 사용자 재시도로 복구', async ({ page }) => {
  await page.goto('/goods/2')
  const photo = page.getByRole('img', { name: '물건 2 합성 테스트 사진' })
  await photo.scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: '사진 다시 시도' })).toBeVisible()
  await page.getByRole('button', { name: '사진 다시 시도' }).click()
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(240)
  await page.getByRole('button', { name: 'PDF 보기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('명세서를 불러오지 못했습니다')
  await expect(page.getByRole('img', { name: '매각물건명세서 1페이지' })).toHaveCount(0)
  await page.getByRole('button', { name: 'PDF 보기', exact: true }).click()
  await expect(page.getByRole('img', { name: '매각물건명세서 1페이지' })).toHaveAttribute('data-rendered', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('첨부파일 없는 물건은 빈 상태를 안내한다', async ({ page }) => {
  await page.goto('/goods/3')
  await expect(page.getByText('아직 수집된 물건 사진이 없습니다.')).toBeVisible()
  await expect(page.getByText('아직 수집된 매각물건명세서가 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDF 보기', exact: true })).toHaveCount(0)
})
