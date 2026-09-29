import { expect, test } from '@playwright/test'

const apiURL = 'http://127.0.0.1:8204'
const scheduleId = '00000000-0000-4000-8000-000000000001'
const missingScheduleId = '00000000-0000-4000-8000-000000000099'

test.beforeEach(async ({ context }) => {
  // API 응답을 가로채지 않고 실제 FastAPI로 보낸다. 외부 요청만 차단한다.
  await context.route(/^https?:\/\//, route => {
    const host = new URL(route.request().url()).hostname
    return ['127.0.0.1', 'localhost', '[::1]'].includes(host)
      ? route.fallback()
      : route.abort()
  })
})

test('실제 일정 API로 법원을 선택하고 공고 JSON·HTML과 물건 상세를 연다', async ({ page, request }) => {
  await page.goto('/schedules?month=2026-08')
  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '서울지방법원' })
  await page.getByLabel('법원·지원', { exact: true }).selectOption({ label: '서울중앙지방법원' })

  const calendar = page.getByRole('table', { name: '2026년 8월 경매 공고 달력', exact: true })
  await calendar.getByRole('link', { name: /서울중앙지방법원.*경매\s*1계/ }).click()
  await expect(page).toHaveURL(`/schedules/${scheduleId}`)
  await expect(page.getByRole('heading', { name: '2026-08-12 상세공고', exact: true })).toBeVisible()
  await expect(page.getByText('매각 장소를 격리 검증 법정으로 정정', { exact: true })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('link', { name: '원문형 HTML 공고' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(`${apiURL}/api/v1/auction-detail/${scheduleId}/page`)
  await expect(popup.getByRole('heading', { name: '서울 경매 1계', exact: true })).toBeVisible()
  await expect(popup.getByText('사건명: 런타임 검증 경매 사건', { exact: true })).toBeVisible()
  await popup.close()

  await page.getByRole('link', { name: '물건 상세', exact: true }).click()
  await expect(page).toHaveURL('/goods/1')
  await expect(page.getByRole('heading', { name: '2026타경1001 런타임 검증 물건', exact: true })).toBeVisible()
  await expect(page.getByText('최저매각가격', { exact: true }).locator('..')).toContainText('240,000,000원')
  // 구형 홈페이지 API는 현재 UI에서 호출하지 않으므로 HTTP 클라이언트로 검증한다.
  const legacy = await request.get(`${apiURL}/api/v1/goods/1/homepage`)
  expect(legacy.status()).toBe(200)
  expect(await legacy.json()).toMatchObject({ auction_goods_id: 1, sections: [] })
})

test('없는 물건은 실제 404를 표시하고 재시도해도 거짓 성공으로 바뀌지 않는다', async ({ page, request }) => {
  const initialResponse = page.waitForResponse(`${apiURL}/api/v1/goods/99`)
  await page.goto('/goods/99')
  expect((await initialResponse).status()).toBe(404)
  await expect(page.getByRole('alert')).toContainText('요청한 정보를 찾을 수 없습니다.')
  const retryResponse = page.waitForResponse(`${apiURL}/api/v1/goods/99`)
  await page.getByRole('button', { name: '상세 다시 시도', exact: true }).click()
  expect((await retryResponse).status()).toBe(404)
  await expect(page.getByRole('alert')).toContainText('요청한 정보를 찾을 수 없습니다.')
  expect((await request.get(`${apiURL}/api/v1/goods/99/homepage`)).status()).toBe(404)
})

test('없는 공고는 JSON·HTML 모두 404이고 달력에서 다른 법원의 빈 결과를 처리한다', async ({ page, request }) => {
  const missingResponse = page.waitForResponse(`${apiURL}/api/v1/auction-detail/${missingScheduleId}`)
  await page.goto(`/schedules/${missingScheduleId}`)
  expect((await missingResponse).status()).toBe(404)
  await expect(page.getByText('요청한 정보를 찾을 수 없습니다.', { exact: true })).toBeVisible()
  expect((await request.get(`${apiURL}/api/v1/auction-detail/${missingScheduleId}/page`)).status()).toBe(404)

  await page.goto('/schedules?month=2026-08')
  const filteredResponse = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/v1/schedule' && url.searchParams.get('court_name') === '제주'
  })
  await page.getByLabel('관할법원', { exact: true }).selectOption({ label: '제주지방법원' })
  const filtered = await filteredResponse
  expect(filtered.status()).toBe(200)
  expect(await filtered.json()).toEqual({ total: 0, items: [] })
  const calendar = page.getByRole('table', { name: '2026년 8월 경매 공고 달력', exact: true })
  await expect(calendar.getByRole('link')).toHaveCount(0)
})
