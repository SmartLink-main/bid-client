import { expect, test, type Page } from '@playwright/test'

async function prepareAnonymousSession(page: Page) {
  await page.route('**/api/v1/refresh', async (route) => {
    const requestOrigin = route.request().headers().origin ?? 'http://127.0.0.1:3101'
    const corsHeaders = {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': requestOrigin,
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ detail: 'E2E session is intentionally anonymous.' }),
    })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))

  expect(widths.documentWidth, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewportWidth,
  )
  expect(widths.bodyWidth, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewportWidth,
  )
}

async function openNplSearch(page: Page) {
  await prepareAnonymousSession(page)
  await page.goto('/npl-search')
  await expect(page.getByRole('heading', { name: 'NPL 후보 분석' })).toBeVisible()
  await expect(page.getByText('조건을 입력하고 NPL 후보 분석을 시작하세요.')).toBeVisible()
}

test.describe('NPL 후보 분석 반응형 브라우저 E2E', () => {
  test.use({ viewport: { width: 762, height: 900 } })

  test('좁은 화면에서 후보를 검색해도 가로 스크롤 없이 결과 카드를 표시한다', async ({
    page,
  }) => {
    await openNplSearch(page)
    await expectNoHorizontalOverflow(page)

    await page.getByPlaceholder('사건번호, 주소, 건물명').fill('모의센텀')
    await page.getByLabel('최소 채권액').fill('100000000')

    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === '/api/v1/npl/candidates' &&
        response.request().method() === 'GET'
      )
    })
    await page.getByRole('button', { name: '후보 분석하기' }).click()
    const response = await responsePromise

    expect(response.status()).toBe(200)
    const requestUrl = new URL(response.url())
    expect(requestUrl.searchParams.get('q')).toBe('모의센텀')
    expect(requestUrl.searchParams.get('min_claim_amount')).toBe('100000000')
    expect(requestUrl.searchParams.get('limit')).toBe('30')
    expect(requestUrl.searchParams.get('offset')).toBe('0')

    await expect(page.getByText('분석 후보 총 1건')).toBeVisible()
    const resultCard = page.getByRole('article')
    await expect(resultCard).toHaveCount(1)
    await expect(resultCard).toContainText('모의센텀 301동 1502호')
    await expect(resultCard).toContainText('480,000,000원')
    await expect(resultCard).toContainText('307,200,000원')
    await expectNoHorizontalOverflow(page)
  })

  test('더 좁은 화면에서 잘못된 금액 범위를 안내하고 레이아웃을 유지한다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openNplSearch(page)

    let candidateRequestCount = 0
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/npl/candidates') {
        candidateRequestCount += 1
      }
    })

    await page.getByLabel('최소 채권액').fill('200000000')
    await page.getByLabel('최대 채권액').fill('100000000')
    await page.getByRole('button', { name: '후보 분석하기' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      '최소값은 같은 항목의 최대값보다 클 수 없습니다.',
    )
    expect(candidateRequestCount).toBe(0)
    await expect(page.getByRole('article')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })
})
