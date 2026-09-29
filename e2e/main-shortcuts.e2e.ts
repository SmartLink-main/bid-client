import { expect, test, type Page } from '@playwright/test'

const shortcuts = [
  { label: '법원 검색', href: '/court-search', heading: '법원별검색' },
  { label: '경매 일정', href: '/schedules', heading: '경매 공고 일정' },
  { label: '반값 검색', href: '/search?half_price=true', heading: '검색 결과' },
  { label: '상세 검색', href: '/advanced-search', heading: '경매 종합 상세검색' },
]

async function prepareLocalApis(page: Page, failFirstSearch = false) {
  const searchRequests: URL[] = []
  let shouldFailSearch = failFirstSearch

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname)
      ? route.fallback()
      : route.abort()
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/v1/refresh') {
      return route.fulfill({ status: 401, json: { detail: 'Anonymous local test.' } })
    }
    if (url.pathname === '/api/v1/search') {
      searchRequests.push(url)
      if (shouldFailSearch) {
        shouldFailSearch = false
        return route.fulfill({ status: 503, json: { detail: 'Local search unavailable.' } })
      }
      return route.fulfill({ json: { total: 0, limit: 50, offset: 0, items: [] } })
    }
    if (url.pathname === '/api/v1/schedule') {
      return route.fulfill({ json: { total: 0, items: [] } })
    }
    return route.fulfill({ status: 404, json: { detail: 'Unconfigured local test API.' } })
  })

  return searchRequests
}

test('메인 바로가기 네 개를 화면 크기에 맞게 표시하고 각 화면으로 이동한다', async ({ page, isMobile }, testInfo) => {
  const searchRequests = await prepareLocalApis(page)
  await page.goto('/')

  const navigation = page.getByRole('navigation', { name: '주요 서비스 바로가기', exact: true })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('link')).toHaveText(shortcuts.map(({ label }) => label))
  for (const shortcut of shortcuts) {
    const link = navigation.getByRole('link', { name: shortcut.label, exact: true })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', shortcut.href)
  }

  const layout = await navigation.evaluate((element) => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    links: Array.from(element.querySelectorAll('a')).map((link) => {
      const { top, left, right, height } = link.getBoundingClientRect()
      return { top, left, right, height }
    }),
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
  for (const link of layout.links) {
    expect(link.left).toBeGreaterThanOrEqual(0)
    expect(link.right).toBeLessThanOrEqual(layout.clientWidth)
    expect(link.height).toBeGreaterThanOrEqual(44)
  }
  expect(Math.abs(layout.links[0].top - layout.links[1].top)).toBeLessThanOrEqual(1)
  expect(Math.abs(layout.links[2].top - layout.links[3].top)).toBeLessThanOrEqual(1)
  if (isMobile) {
    expect(layout.links[2].top).toBeGreaterThan(layout.links[0].top)
  } else {
    expect(Math.abs(layout.links[0].top - layout.links[3].top)).toBeLessThanOrEqual(1)
  }
  const screenshotPath = testInfo.outputPath(`main-shortcuts-${isMobile ? 'mobile' : 'desktop'}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach('메인 바로가기', { path: screenshotPath, contentType: 'image/png' })

  for (const shortcut of shortcuts) {
    await test.step(`${shortcut.label} 바로가기`, async () => {
      const link = navigation.getByRole('link', { name: shortcut.label, exact: true })
      if (isMobile) await link.tap()
      else await link.click()

      await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === shortcut.href)
      await expect(page.getByRole('heading', { name: shortcut.heading, exact: true })).toBeVisible()
      if (shortcut.label === '반값 검색') {
        await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
        expect(searchRequests).toHaveLength(1)
        expect(searchRequests[0].searchParams.get('half_price')).toBe('true')
      }
      await page.goBack()
      await expect(page).toHaveURL((url) => url.pathname === '/')
      await expect(navigation).toBeVisible()
    })
  }
})

test('바로가기 세 구분선이 실제로 1.5px 두께로 그려지고 확대해도 동일하다', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, '데스크톱의 세 세로 구분선을 비교한다')
  await prepareLocalApis(page)
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const navigation = page.getByRole('navigation', { name: '주요 서비스 바로가기', exact: true })

  for (const zoom of [1, 1.25, 1.5]) {
    await page.evaluate((value) => { document.documentElement.style.zoom = String(value) }, zoom)
    await navigation.scrollIntoViewIfNeeded()
    const lines = await navigation.locator('svg[data-divider-axis="vertical"] > line').evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, height } = element.getBoundingClientRect()
        return { x, y: Math.floor(y + height / 2), color: getComputedStyle(element).stroke }
      }),
    )
    expect(lines).toHaveLength(3)
    const screenshot = await page.screenshot()
    await testInfo.attach(`dividers-${zoom * 100}%`, { body: screenshot, contentType: 'image/png' })
    // Sum pixel coverage, including antialiasing, to catch both unequal and rounded-down strokes.
    const strokes = await page.evaluate(async ({ image, positions }) => {
      const bitmap = new Image()
      bitmap.src = image
      await bitmap.decode()
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      return positions.map(({ x, y, color }) => {
        const pixel = (offset: number) => Array.from(context.getImageData(Math.floor(x) + offset, y, 1, 1).data)
        const background = pixel(-4)
        const samples = Array.from({ length: 8 }, (_, index) => pixel(index - 3))
        const reference = document.createElement('canvas').getContext('2d')!
        reference.fillStyle = `rgb(${background.slice(0, 3).join(' ')})`
        reference.fillRect(0, 0, 1, 1)
        reference.fillStyle = color
        reference.fillRect(0, 0, 1, 1)
        const fullStroke = reference.getImageData(0, 0, 1, 1).data
        const contrast = background.slice(0, 3).reduce((sum, channel, index) => sum + channel - fullStroke[index], 0)
        return samples.reduce((coverage, sample) => coverage + background.slice(0, 3)
          .reduce((sum, channel, index) => sum + channel - sample[index], 0) / contrast, 0)
      })
    }, { image: `data:image/png;base64,${screenshot.toString('base64')}`, positions: lines })
    for (const thickness of strokes) {
      expect(Math.abs(thickness - 1.5 * zoom), `실제 두께 ${thickness}, 확대 ${zoom}`).toBeLessThan(0.12)
    }
    expect(Math.max(...strokes) - Math.min(...strokes), `세 선의 두께 차이, 확대 ${zoom}`).toBeLessThan(0.12)
  }
})

test('반값 바로가기의 검색 오류를 안내하고 같은 조건으로 재시도한다', async ({ page, isMobile }) => {
  const searchRequests = await prepareLocalApis(page, true)
  await page.goto('/')
  const shortcut = page.getByRole('navigation', { name: '주요 서비스 바로가기', exact: true })
    .getByRole('link', { name: '반값 검색', exact: true })
  if (isMobile) await shortcut.tap()
  else await shortcut.click()

  await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('half_price') === 'true')
  await expect(page.getByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', { exact: true })).toBeVisible()
  expect(searchRequests).toHaveLength(1)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()

  await expect(page.getByText('조건에 맞는 물건이 없습니다.', { exact: true })).toBeVisible()
  expect(searchRequests).toHaveLength(2)
  for (const request of searchRequests) {
    expect(request.searchParams.get('half_price')).toBe('true')
  }
  expect(searchRequests[1].search).toBe(searchRequests[0].search)
})
