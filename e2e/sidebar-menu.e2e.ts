import { expect, test, type Page } from '@playwright/test'

async function visitHome(page: Page) {
  await page.route('**/api/v1/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'E2E anonymous session.' }),
  }))
  await page.goto('/')
}

async function openSidebar(page: Page) {
  await visitHome(page)
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
}

test('독립 최저가·최고가 검색 메뉴를 노출하지 않는다', async ({ page }) => {
  await openSidebar(page)

  await expect(page.getByText('경매 검색', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '최저가검색', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '최고가검색', exact: true })).toHaveCount(0)
})

test('상세조건검색에서 가격 범위를 계속 사용할 수 있다', async ({ page }) => {
  await openSidebar(page)

  await page.getByRole('link', { name: '상세조건검색', exact: true }).click()
  await expect(page).toHaveURL(/\/advanced-search$/)
  await expect(page.getByLabel('최소 최저가', { exact: true })).toBeVisible()
  await expect(page.getByLabel('최대 최저가', { exact: true })).toBeVisible()
})

test('AI 검색 메뉴를 제거하고 홈 키워드 검색은 유지한다', async ({ page }) => {
  await openSidebar(page)

  await expect(page.getByRole('link', { name: '문장으로 물건찾기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'AI 검색', exact: true })).toHaveCount(0)

  await page.route('**/api/v1/search**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ total: 0, limit: 50, offset: 0, items: [] }),
  }))
  await page.getByRole('button', { name: '전체 메뉴 닫기' }).click()
  await page.getByPlaceholder('예: 2023타경1234, 서울중앙지방법원, 강남구 아파트').fill('서울 아파트')
  await page.getByPlaceholder('예: 2023타경1234, 서울중앙지방법원, 강남구 아파트').press('Enter')

  await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === '서울 아파트')
  await expect(page.getByRole('heading', { name: '검색 결과', exact: true })).toBeVisible()
})

test('통합 고객지원 메뉴와 푸터에서 시스템 상태를 유지한다', async ({ page }) => {
  await openSidebar(page)

  const customerSupportItems = await page.getByText('고객지원', { exact: true }).evaluate((heading) => {
    const labels: string[] = []
    let item = heading.nextElementSibling
    while (item) {
      if (item instanceof HTMLAnchorElement) labels.push(item.textContent?.trim() ?? '')
      item = item.nextElementSibling
    }
    return labels
  })

  expect(customerSupportItems).toEqual(['1:1 문의', '이용안내', '시스템 상태'])
  const systemStatusLinks = page.getByRole('link', { name: '시스템 상태', exact: true })
  await expect(systemStatusLinks).toHaveCount(2)
  await expect(systemStatusLinks.first()).toHaveAttribute('href', '/system-status')
  await expect(page.getByRole('link', { name: '1:1 문의', exact: true })).toHaveAttribute('href', '/support')
})

test('NPL 메뉴와 이전 화면을 제거하고 특수물건검색을 유지한다', async ({ page }) => {
  await openSidebar(page)

  const searchMenuItems = await page.getByText('경매 검색', { exact: true }).evaluate((heading) => {
    const labels: string[] = []
    let item = heading.nextElementSibling
    while (item && item.tagName !== 'HR') {
      if (item instanceof HTMLAnchorElement) labels.push(item.textContent?.trim() ?? '')
      item = item.nextElementSibling
    }
    return labels
  })

  expect(searchMenuItems.at(-1)).toBe('특수물건검색')
  await expect(page.getByRole('link', { name: /NPL/i })).toHaveCount(0)
  await page.route('**/api/v1/search/special/types', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: ['유치권'] }),
  }))
  await page.getByRole('link', { name: '특수물건검색', exact: true }).click()
  await expect(page).toHaveURL(/\/special-search$/)
  await expect(page.getByRole('heading', { name: '특수물건 검색', exact: true })).toBeVisible()

  await page.goto('/npl-search')
  await expect(page).toHaveURL((url) => url.pathname === '/')
  await expect(page.getByRole('heading', { name: '어떤 경매 물건을 찾으시나요?' })).toBeVisible()
  await expect(page.getByText('NPL 후보 분석', { exact: true })).toHaveCount(0)
})

test('메뉴 아이콘 주변의 넓어진 여백에 커서를 올려도 사이드바가 열린다', async ({ page }) => {
  await visitHome(page)
  const opener = page.getByRole('button', { name: '전체 메뉴 열기' })
  const drawer = page.getByTestId('sidebar-drawer')
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect(opener).toHaveAttribute('aria-controls', 'sidebar-drawer')
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')

  const buttonBounds = await opener.boundingBox()
  const iconBounds = await opener.locator('svg').boundingBox()
  expect(buttonBounds).not.toBeNull()
  expect(iconBounds).not.toBeNull()
  expect(buttonBounds!.width - iconBounds!.width).toBeGreaterThanOrEqual(24)
  expect(buttonBounds!.height - iconBounds!.height).toBeGreaterThanOrEqual(24)
  await opener.hover({ position: { x: 2, y: buttonBounds!.height / 2 } })
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('dialog', { name: '전체 메뉴', exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  const searchLink = drawer.getByRole('link', { name: '상세조건검색', exact: true })
  await searchLink.hover()
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  await searchLink.click()

  await expect(page).toHaveURL(/\/advanced-search$/)
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

for (const width of [1280, 1920]) {
  test(`${width}px 화면에서 메뉴 안에서는 열린 상태를 유지하고 커서가 벗어나면 닫힌다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 })
    await visitHome(page)
    const opener = page.getByRole('button', { name: '전체 메뉴 열기' })
    const drawer = page.getByTestId('sidebar-drawer')
    const backdrop = page.getByTestId('sidebar-backdrop')

    await opener.hover()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect.poll(async () => {
      const bounds = await drawer.boundingBox()
      return bounds ? Math.round(bounds.x + bounds.width) : null
    }).toBe(width)

    const courtLink = drawer.getByRole('link', { name: '법원별검색', exact: true })
    const courtLinkBounds = await courtLink.boundingBox()
    expect(courtLinkBounds).not.toBeNull()
    await page.mouse.move(
      courtLinkBounds!.x + courtLinkBounds!.width / 2,
      courtLinkBounds!.y + courtLinkBounds!.height / 2,
      { steps: 12 },
    )
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await drawer.getByRole('link', { name: '지역별검색', exact: true }).hover()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await drawer.getByRole('link', { name: '상세조건검색', exact: true }).hover()
    await expect(opener).toHaveAttribute('aria-expanded', 'true')
    await expect(drawer).toHaveAttribute('aria-modal', 'true')
    await expect(backdrop).toBeVisible()
    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

    const drawerBounds = await drawer.boundingBox()
    expect(drawerBounds).not.toBeNull()
    await page.mouse.move(drawerBounds!.x - 30, 200, { steps: 8 })
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
    await expect(drawer).not.toHaveAttribute('aria-modal', 'true')
    await expect(opener).toHaveAttribute('aria-expanded', 'false')
    await expect(backdrop).toHaveCount(0)
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

    await opener.hover()
    await courtLink.hover()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect(opener).toHaveAttribute('aria-expanded', 'true')
    await expect(backdrop).toBeVisible()
  })
}

test('아이콘을 잠깐 지나가면 열리지 않고 닫은 메뉴를 다시 열 수 있다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-11T00:00:00Z') })
  await visitHome(page)
  await page.clock.pauseAt(new Date('2026-09-11T00:01:00Z'))
  const opener = page.getByRole('button', { name: '전체 메뉴 열기' })
  const drawer = page.getByTestId('sidebar-drawer')

  await opener.hover()
  await page.clock.runFor(50)
  await page.mouse.move(0, 0)
  await page.clock.runFor(500)
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await page.clock.resume()

  await opener.hover()
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  await page.getByRole('button', { name: '전체 메뉴 닫기' }).click()
  await page.clock.runFor(500)
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')

  await opener.hover()
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  await drawer.getByRole('link', { name: '법원별검색', exact: true }).hover()
  await page.mouse.move(10, 100)
  await page.clock.runFor(500)
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('키보드 Enter와 Space로도 사이드바를 열 수 있다', async ({ page }) => {
  await visitHome(page)
  const opener = page.getByRole('button', { name: '전체 메뉴 열기' })
  const drawer = page.getByTestId('sidebar-drawer')

  for (const key of ['Enter', 'Space']) {
    await opener.focus()
    await opener.press(key)
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect(opener).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: '전체 메뉴 닫기' }).press('Enter')
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  }
})

test.describe('모바일 터치 메뉴', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('터치를 떼거나 메뉴 안을 탭해도 열린 상태를 유지하고 배경과 닫기 버튼으로 닫힌다', async ({ page }) => {
    await visitHome(page)
    const opener = page.getByRole('button', { name: '전체 메뉴 열기' })
    const drawer = page.getByTestId('sidebar-drawer')
    await expect(opener).toHaveAttribute('aria-expanded', 'false')

    await opener.tap()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect(page.getByRole('dialog', { name: '전체 메뉴', exact: true })).toBeVisible()
    await drawer.getByText('경매 검색', { exact: true }).tap()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await drawer.getByRole('link', { name: '이용안내', exact: true }).tap()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await expect(opener).toHaveAttribute('aria-expanded', 'true')

    await page.getByTestId('sidebar-backdrop').tap({ position: { x: 10, y: 100 } })
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
    await expect(opener).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

    await opener.tap()
    await expect(drawer).toHaveAttribute('aria-hidden', 'false')
    await page.getByRole('button', { name: '전체 메뉴 닫기' }).tap()
    await expect(drawer).toHaveAttribute('aria-hidden', 'true')
    await expect(opener).toHaveAttribute('aria-expanded', 'false')
  })
})
