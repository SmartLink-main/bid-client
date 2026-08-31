import { expect, test, type Page } from '@playwright/test'

async function openSidebar(page: Page) {
  await page.route('**/api/v1/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'E2E anonymous session.' }),
  }))
  await page.goto('/')
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
  await page.getByRole('button', { name: '검색', exact: true }).click()

  await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === '서울 아파트')
  await expect(page.getByRole('heading', { name: '검색 결과', exact: true })).toBeVisible()
})

test('시스템 상태를 사이드바에서 제거하고 푸터 링크는 유지한다', async ({ page }) => {
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

  expect(customerSupportItems).toEqual(['고객센터', '이용안내'])
  const systemStatusLinks = page.getByRole('link', { name: '시스템 상태', exact: true })
  await expect(systemStatusLinks).toHaveCount(1)
  await expect(systemStatusLinks).toHaveAttribute('href', '/system-status')
})

test('특수물건검색과 NPL 후보분석을 검색 메뉴 맨 아래에 배치한다', async ({ page }) => {
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

  expect(searchMenuItems.slice(-2)).toEqual(['특수물건검색', 'NPL 후보분석'])
  await expect(page.getByRole('link', { name: '특수물건검색', exact: true })).toHaveAttribute('href', '/special-search')
  await expect(page.getByRole('link', { name: 'NPL 후보분석', exact: true })).toHaveAttribute('href', '/npl-search')
})
