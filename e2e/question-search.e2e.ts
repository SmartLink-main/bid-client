import { expect, test, type Page } from '@playwright/test'

type QuestionGoodsItem = {
  auction_goods_id: number
  address: string | null
  goods_usage_name: string | null
  building_name: string | null
  lowest_sale_price: number | null
  score: number
  match_reasons: string[]
}

type QuestionGoodsResponse = {
  question: string
  parsed: {
    terms: string[]
    max_price: number | null
  }
  interpretation: {
    method: 'ai' | 'rules'
    fallback_used: boolean
  }
  total: number
  limit: number
  items: QuestionGoodsItem[]
}

type ErrorResponse = {
  detail: string
}

type ValidationErrorResponse = {
  detail: Array<{
    loc: Array<string | number>
    msg: string
    type: string
  }>
}

type AuctionSearchResponse = {
  total: number
  items: Array<{
    auction_goods_id: number
    printed_address: string | null
    road_address: string | null
    lot_number_address: string | null
    building_name: string | null
  }>
}

const DEFAULT_QUESTION_RESULT_LIMIT = 10

function goodsLink(page: Page, goodsId: number) {
  return page.getByRole('article').locator(`a[href="/goods/${goodsId}"]`)
}

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

async function openQuestionSearch(page: Page) {
  await prepareAnonymousSession(page)

  await page.goto('/question-search')
  await expect(
    page.getByRole('heading', { name: '원하는 경매 물건을 문장으로 찾아보세요' }),
  ).toBeVisible()
  await expect(page.getByLabel('결과 수')).toHaveCount(0)
}

async function submitQuestion(
  page: Page,
  question: string,
): Promise<QuestionGoodsResponse> {
  await page.getByLabel('찾고 싶은 경매 물건').fill(question)
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/question/goods' &&
    response.request().method() === 'POST'
  ))
  await page.getByLabel('찾고 싶은 경매 물건').press('Enter')
  const response = await responsePromise

  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({ question })
  const payload = await response.json() as QuestionGoodsResponse
  expect(payload.limit).toBe(DEFAULT_QUESTION_RESULT_LIMIT)
  await expect(page.getByRole('heading', { name: `“${payload.question}”` })).toBeVisible()
  return payload
}

async function submitQuestionExpectingError(
  page: Page,
  question: string,
  expectedStatus: number,
): Promise<ErrorResponse> {
  await page.getByLabel('찾고 싶은 경매 물건').fill(question)
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/question/goods' &&
    response.request().method() === 'POST'
  ))
  await page.getByLabel('찾고 싶은 경매 물건').press('Enter')
  const response = await responsePromise

  expect(response.status()).toBe(expectedStatus)
  expect(response.request().postDataJSON()).toEqual({ question })
  return await response.json() as ErrorResponse
}

async function submitQuestionExpectingValidationError(
  page: Page,
  question: string,
): Promise<ValidationErrorResponse> {
  await page.getByLabel('찾고 싶은 경매 물건').fill(question)
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/v1/question/goods' &&
    response.request().method() === 'POST'
  ))
  await page.getByLabel('찾고 싶은 경매 물건').press('Enter')
  const response = await responsePromise

  expect(response.status()).toBe(422)
  expect(response.request().postDataJSON()).toEqual({ question })
  return await response.json() as ValidationErrorResponse
}

async function openKeywordSearch(page: Page) {
  await prepareAnonymousSession(page)
  await page.goto('/search')
  await expect(page.getByRole('heading', { name: '검색 결과' })).toBeVisible()
}

async function submitKeywordSearch(
  page: Page,
  query: string,
): Promise<AuctionSearchResponse> {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === '/api/v1/search' &&
      url.searchParams.get('q') === query &&
      response.request().method() === 'GET'
    )
  })
  await page.getByLabel('경매 물건 검색어').fill(query)
  await page.getByLabel('경매 물건 검색어').press('Enter')
  const response = await responsePromise
  expect(response.status()).toBe(200)
  return await response.json() as AuctionSearchResponse
}

test.describe('자연어 물건 검색 브라우저 E2E', () => {
  test('일반 문장과 조사가 붙은 문장이 같은 물건을 추천한다', async ({ page }) => {
    await openQuestionSearch(page)

    const bare = await submitQuestion(page, '강남구 아파트')
    expect(bare.interpretation).toEqual({ method: 'ai', fallback_used: false })
    expect(bare.items).toHaveLength(1)
    expect(bare.items[0]).toMatchObject({
      address: '서울특별시 강남구 테스트로 101',
      goods_usage_name: '아파트',
      building_name: '테스트래미안 101동 1201호',
    })

    const particle = await submitQuestion(page, '강남구에서는 아파트들만을 찾아줘')
    expect(particle.interpretation).toEqual({ method: 'ai', fallback_used: false })
    expect(particle.parsed.terms).toEqual(['강남구', '아파트'])
    expect(particle.items.map((item) => item.auction_goods_id)).toEqual(
      bare.items.map((item) => item.auction_goods_id),
    )

    await expect(page.getByRole('status', { name: 'AI 분석' })).toBeVisible()
    await expect(page.getByText('#강남구', { exact: true })).toBeVisible()
    await expect(page.getByText('#아파트', { exact: true })).toBeVisible()
    await expect(page.getByRole('article')).toContainText(
      '서울특별시 강남구 테스트로 101',
    )
  })

  test('한글 예산을 금액 상한으로 적용한다', async ({ page }) => {
    await openQuestionSearch(page)

    const result = await submitQuestion(
      page,
      '강남구에서 오억원 안쪽 아파트 찾아줘',
    )
    expect(result.parsed).toEqual({
      terms: ['강남구', '아파트'],
      max_price: 500_000_000,
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].lowest_sale_price).toBeLessThanOrEqual(500_000_000)
    await expect(
      page.getByText('예산 상한 500,000,000원', { exact: true }),
    ).toBeVisible()
  })

  test('시도와 시군구를 한 행정계층으로 검색한다', async ({ page }) => {
    await openQuestionSearch(page)

    const result = await submitQuestion(
      page,
      '서울특별시 강남구에서 아파트 찾아줘',
    )
    expect(result.parsed.terms).toEqual(['서울특별시 강남구', '아파트'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0].address).toBe('서울특별시 강남구 테스트로 101')
    await expect(page.getByText('#서울특별시 강남구', { exact: true })).toBeVisible()
  })

  test('사건번호는 접두 사건을 제외하고 정확히 검색한다', async ({ page }) => {
    await openQuestionSearch(page)

    const result = await submitQuestion(page, '사건번호 2099타경1')
    expect(result.interpretation).toEqual({ method: 'rules', fallback_used: false })
    expect(result.items.map((item) => item.auction_goods_id)).toEqual([92_001])
    const resultCard = page.getByRole('article')
    await expect(resultCard).toHaveCount(1)
    await expect(resultCard).toContainText('사건번호 정확 일치')
    await expect(
      resultCard.getByRole('link', { name: '물건 상세 보기' }),
    ).toHaveAttribute('href', '/goods/92001')
  })

  test('제어문자가 포함된 입력은 422 검증 오류로 안내한다', async ({ page }) => {
    await openQuestionSearch(page)

    const error = await submitQuestionExpectingValidationError(
      page,
      '2099타경1\u200B1',
    )
    expect(error.detail[0].loc).toEqual(['body', 'question'])
    expect(error.detail[0].msg).toContain(
      'question must not contain control characters',
    )
    await expect(page.getByRole('alert')).toHaveText(
      '입력한 정보를 다시 확인해 주세요.',
    )
    await expect(page.getByRole('article')).toHaveCount(0)
  })

  test('AI 제공자 시간 초과는 503으로 안내한다', async ({ page }) => {
    await openQuestionSearch(page)

    const error = await submitQuestionExpectingError(
      page,
      '강남구 아파트 추천',
      503,
    )
    expect(error).toEqual({
      detail: 'AI 검색을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    })
    await expect(page.getByRole('alert')).toHaveText(error.detail)
    await expect(page.getByRole('article')).toHaveCount(0)
  })

  test('개인 식별자가 포함된 질문은 422로 차단한다', async ({ page }) => {
    await openQuestionSearch(page)

    const error = await submitQuestionExpectingError(
      page,
      '010/1234/5678 강남구 아파트 찾아줘',
      422,
    )
    expect(error).toEqual({
      detail: '개인 식별자가 포함된 질문은 AI 검색에 사용할 수 없습니다.',
    })
    await expect(page.getByRole('alert')).toHaveText(error.detail)
    await expect(page.getByRole('article')).toHaveCount(0)
  })

  test('지원하지 않는 하한가 조건은 부분 검색 없이 거절한다', async ({ page }) => {
    await openQuestionSearch(page)

    const error = await submitQuestionExpectingError(
      page,
      '최소 5억원인 아파트 찾아줘',
      422,
    )
    expect(error).toEqual({
      detail: '아직 정확히 지원하지 않는 검색 조건이 포함되어 있습니다.',
    })
    await expect(page.getByRole('alert')).toHaveText(error.detail)
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByText('분석한 질문')).toHaveCount(0)
  })
})

test.describe('일반 물건 검색 브라우저 E2E', () => {
  test('이전 NPL 검색 주소는 일반 검색으로 처리하고 제거된 API는 404를 반환한다', async ({ page, request }) => {
    await prepareAnonymousSession(page)
    const nplRequests: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.includes('/npl')) {
        nplRequests.push(request.url())
      }
    })
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v1/search' && url.searchParams.get('q') === '해운대구'
    })

    await page.goto('/search?search_type=npl&q=해운대구')
    const response = await responsePromise
    expect(response.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '검색 결과', exact: true })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(page.getByText(/NPL 후보/)).toHaveCount(0)
    expect(nplRequests).toEqual([])

    const nextResults = await submitKeywordSearch(page, '대구')
    expect(nextResults.total).toBeGreaterThan(0)
    expect(nplRequests).toEqual([])

    for (const path of ['/api/v1/npl/candidates', '/api/v1/search/npl']) {
      const removedResponse = await request.get(new URL(path, response.url()).href)
      expect(removedResponse.status()).toBe(404)
    }
  })

  test('기본 지역명과 조사가 붙은 지역명이 같은 결과를 반환한다', async ({ page }) => {
    await openKeywordSearch(page)

    const bare = await submitKeywordSearch(page, '해운대구')
    expect(bare.items.map((item) => item.auction_goods_id)).toEqual([
      95_012,
      95_021,
      9,
    ])

    const particle = await submitKeywordSearch(page, '해운대구에서는')
    expect(particle.items.map((item) => item.auction_goods_id)).toEqual(
      bare.items.map((item) => item.auction_goods_id),
    )
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(page.getByText('부산광역시 해운대구 바다로 12')).toBeVisible()
    await expect(page.getByText('부산광역시 수영구 모의로 12')).toHaveCount(0)
  })

  test('조사와 충돌하는 일반명사는 원문을 우선한다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '정신과는')
    expect(result.items.map((item) => item.auction_goods_id)).toEqual([90_008])
    await expect(goodsLink(page, 90008)).toBeVisible()
    await expect(goodsLink(page, 90009)).toHaveCount(0)
  })

  test('사건번호는 접두 번호와 분리해 정확히 검색한다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '2099타경1')
    expect(result.items.map((item) => item.auction_goods_id)).toEqual([92_001])
    await expect(goodsLink(page, 92001)).toBeVisible()
    await expect(goodsLink(page, 92010)).toHaveCount(0)
  })

  test('공백 없이 붙인 시도와 시군구를 실제 행정계층으로 검색한다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '부산광역시해운대구')
    expect(result.items.map((item) => item.auction_goods_id)).toEqual([
      95_012,
      95_021,
      9,
    ])
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(page.getByText('부산광역시 해운대구 모의로 55')).toBeVisible()
    await expect(page.getByText('부산광역시 수영구 모의로 12')).toHaveCount(0)
  })

  test('읍면동까지 붙인 주소를 공백 저장 형태와 동일하게 검색한다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '대구광역시달서구상인동')
    const resultIds = result.items.map((item) => item.auction_goods_id)
    expect(resultIds).toHaveLength(2)
    expect(resultIds).toEqual(expect.arrayContaining([97_001, 97_002]))
    await expect(goodsLink(page, 97001)).toBeVisible()
    await expect(goodsLink(page, 97002)).toBeVisible()
    await expect(goodsLink(page, 97003)).toHaveCount(0)
  })

  test('대구 검색은 해운대구를 부분 문자열로 오탐하지 않는다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '대구')
    const resultIds = result.items.map((item) => item.auction_goods_id)
    expect(resultIds).toEqual(expect.arrayContaining([97_001, 97_002]))
    for (const haeundaeGoodsId of [9, 95_012, 95_020, 95_021]) {
      expect(resultIds).not.toContain(haeundaeGoodsId)
    }
    await expect(goodsLink(page, 97001)).toBeVisible()
    await expect(goodsLink(page, 97002)).toBeVisible()
    await expect(page.getByText('부산광역시 해운대구 모의로 55')).toHaveCount(0)
  })

  test('NBSP가 포함된 주소도 행정구역 경계로 인식한다', async ({ page }) => {
    await openKeywordSearch(page)

    const result = await submitKeywordSearch(page, '전북 NBSP')
    expect(result.items).toContainEqual(expect.objectContaining({
      auction_goods_id: 90_001,
      printed_address: '전북특별자치도\u00a0전주시 완산구 경계로 1',
    }))
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(page.getByRole('article')).toContainText(
      '전북특별자치도 전주시 완산구 경계로 1',
    )
    await expect(goodsLink(page, 90001)).toBeVisible()
  })
})
