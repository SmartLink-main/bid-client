import { expect, test, type Page } from '@playwright/test'

type ScheduleItem = {
  schedule_id: string
  auction_date: string
  auction_time: string | null
  court_name: string
  branch_name: string
  division_number: number
}

type ScheduleResult = {
  status?: number
  body: unknown
}

const augustSchedules: ScheduleItem[] = [
  {
    schedule_id: 'schedule-aug-12-1',
    auction_date: '2026-08-12',
    auction_time: '10:00',
    court_name: '서울',
    branch_name: '서울중앙지방법원',
    division_number: 1,
  },
  {
    schedule_id: 'schedule-aug-12-2',
    auction_date: '2026-08-12',
    auction_time: '14:00',
    court_name: '서울',
    branch_name: '서울동부지방법원',
    division_number: 2,
  },
  {
    schedule_id: 'schedule-aug-31',
    auction_date: '2026-08-31',
    auction_time: null,
    court_name: '제주',
    branch_name: '제주지방법원',
    division_number: 3,
  },
]

async function prepareScheduleApis(
  page: Page,
  resolveSchedule: (url: URL) => ScheduleResult = () => ({
    body: { total: augustSchedules.length, items: augustSchedules },
  }),
) {
  const scheduleRequests: string[] = []

  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/api/v1/refresh') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'E2E anonymous session.' }),
      })
    }

    if (url.pathname === '/api/v1/schedule') {
      scheduleRequests.push(url.toString())
      const result = resolveSchedule(url)
      return route.fulfill({
        status: result.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(result.body),
      })
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'E2E route not found.' }),
    })
  })

  return scheduleRequests
}

test('월 범위로 일정을 조회하고 날짜별 공고와 상세 링크를 보여준다', async ({ page }) => {
  const requests = await prepareScheduleApis(page)

  await page.goto('/schedules?month=2026-08')

  await expect(page.getByRole('heading', { name: '2026년 8월', exact: true })).toBeVisible()
  await expect.poll(() => requests.length).toBe(1)

  const requestUrl = new URL(requests[0])
  expect(requestUrl.searchParams.get('start_date')).toBe('2026-08-01')
  expect(requestUrl.searchParams.get('end_date')).toBe('2026-08-31')

  const calendar = page.getByRole('table', { name: '2026년 8월 경매 공고 달력', exact: true })
  await expect(calendar).toBeVisible()

  const august12 = calendar.locator(
    'td[data-testid="schedule-calendar-day"][data-date="2026-08-12"]',
  )
  await expect(august12).toHaveCount(1)
  await expect(august12.getByRole('button', { name: '8월 12일, 공고 2개', exact: true })).toBeVisible()

  const firstDetail = august12.getByRole('link', {
    name: /서울중앙지방법원.*경매\s*1계/,
  })
  await expect(firstDetail).toHaveAttribute('href', '/schedules/schedule-aug-12-1')
  await expect(august12.getByRole('link', {
    name: /서울동부지방법원.*경매\s*2계/,
  })).toHaveAttribute('href', '/schedules/schedule-aug-12-2')

  const august31 = calendar.locator(
    'td[data-testid="schedule-calendar-day"][data-date="2026-08-31"]',
  )
  await expect(august31.getByRole('button', { name: '8월 31일, 공고 1개', exact: true })).toBeVisible()
})

test('관할법원과 법원·지원을 선택해 월별 공고를 필터링한다', async ({ page }) => {
  const requests = await prepareScheduleApis(page)

  await page.goto('/schedules?month=2026-08')

  const courtSelect = page.getByLabel('관할법원', { exact: true })
  const branchSelect = page.getByLabel('법원·지원', { exact: true })
  await expect(courtSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(branchSelect).toHaveJSProperty('tagName', 'SELECT')
  await expect(courtSelect.locator('option').first()).toHaveText('전체 관할법원')
  await expect(branchSelect).toBeDisabled()
  await expect(branchSelect.locator('option')).toHaveText(['관할법원을 먼저 선택해 주세요'])

  await courtSelect.selectOption({ label: '서울지방법원' })
  await expect(branchSelect).toBeEnabled()
  await expect(branchSelect.locator('option')).toHaveText([
    '전체 법원·지원',
    '서울중앙지방법원',
    '서울동부지방법원',
    '서울서부지방법원',
    '서울남부지방법원',
    '서울북부지방법원',
  ])
  await branchSelect.selectOption({ label: '서울중앙지방법원' })
  await page.getByRole('button', { name: '필터 적용', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/schedules'
      && url.searchParams.get('month') === '2026-08'
      && url.searchParams.get('court_name') === '서울'
      && url.searchParams.get('branch_name') === '서울중앙지방법원'
  ))
  await expect.poll(() => requests.length).toBe(2)

  const filteredRequest = new URL(requests.at(-1)!)
  expect(filteredRequest.searchParams.get('start_date')).toBe('2026-08-01')
  expect(filteredRequest.searchParams.get('end_date')).toBe('2026-08-31')
  expect(filteredRequest.searchParams.get('court_name')).toBe('서울')
  expect(filteredRequest.searchParams.get('branch_name')).toBe('서울중앙지방법원')
})

test('관할법원을 변경하면 이전 법원·지원 선택을 초기화한다', async ({ page }) => {
  const requests = await prepareScheduleApis(page)

  await page.goto('/schedules?month=2026-08')

  const courtSelect = page.getByLabel('관할법원', { exact: true })
  const branchSelect = page.getByLabel('법원·지원', { exact: true })
  await courtSelect.selectOption({ label: '서울지방법원' })
  await branchSelect.selectOption({ label: '서울중앙지방법원' })

  await courtSelect.selectOption({ label: '제주지방법원' })
  await expect(branchSelect).toHaveValue('')
  await expect(branchSelect).toBeEnabled()
  await expect(branchSelect.locator('option')).toHaveText(['전체 법원·지원', '제주지방법원'])
  await page.getByRole('button', { name: '필터 적용', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/schedules'
      && url.searchParams.get('month') === '2026-08'
      && url.searchParams.get('court_name') === '제주'
      && !url.searchParams.has('branch_name')
  ))
  await expect.poll(() => requests.length).toBe(2)

  const filteredRequest = new URL(requests.at(-1)!)
  expect(filteredRequest.searchParams.get('court_name')).toBe('제주')
  expect(filteredRequest.searchParams.has('branch_name')).toBe(false)
})

test('다음 달로 이동할 때 법원 필터를 유지하고 서버 오류를 안내한다', async ({ page }) => {
  const requests = await prepareScheduleApis(page, (url) => {
    if (url.searchParams.get('start_date') === '2026-09-01') {
      return {
        status: 503,
        body: { detail: 'E2E schedule service unavailable.' },
      }
    }

    return { body: { total: 0, items: [] } }
  })

  await page.goto(
    '/schedules?month=2026-08&court_name=%EC%84%9C%EC%9A%B8&branch_name=%EC%84%9C%EC%9A%B8%EC%A4%91%EC%95%99%EC%A7%80%EB%B0%A9%EB%B2%95%EC%9B%90',
  )
  await expect(page.getByRole('heading', { name: '2026년 8월', exact: true })).toBeVisible()
  await expect(page.getByLabel('관할법원', { exact: true })).toHaveValue('서울')
  await expect(page.getByLabel('법원·지원', { exact: true })).toHaveValue('서울중앙지방법원')

  await page.getByRole('button', { name: '다음 달', exact: true }).click()

  await expect(page).toHaveURL((url) => (
    url.pathname === '/schedules'
      && url.searchParams.get('month') === '2026-09'
      && url.searchParams.get('court_name') === '서울'
      && url.searchParams.get('branch_name') === '서울중앙지방법원'
  ))
  await expect(page.getByRole('heading', { name: '2026년 9월', exact: true })).toBeVisible()
  await expect.poll(() => requests.length).toBe(2)

  const septemberRequest = new URL(requests[1])
  expect(septemberRequest.searchParams.get('start_date')).toBe('2026-09-01')
  expect(septemberRequest.searchParams.get('end_date')).toBe('2026-09-30')
  expect(septemberRequest.searchParams.get('court_name')).toBe('서울')
  expect(septemberRequest.searchParams.get('branch_name')).toBe('서울중앙지방법원')
  await expect(page.getByText('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', { exact: true })).toBeVisible()
})

test('모바일에서 가로 넘침 없이 날짜를 선택해 공고 목록을 본다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepareScheduleApis(page)

  await page.goto('/schedules?month=2026-08')

  const calendar = page.getByRole('table', { name: '2026년 8월 경매 공고 달력', exact: true })
  await expect(calendar).toBeVisible()
  await calendar.getByRole('button', { name: '8월 12일, 공고 2개', exact: true }).click()
  await expect(page.getByRole('heading', { name: '8월 12일 공고', exact: true })).toBeVisible()

  const viewportWidths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewportWidths.scrollWidth).toBeLessThanOrEqual(viewportWidths.clientWidth)
})
