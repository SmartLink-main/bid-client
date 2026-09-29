import { expect, test, type Page } from '@playwright/test'
import type { AppraisalItem, GoodsDetailResponse } from '../src/lib/goods'

const apiURL = 'http://127.0.0.1:8198'
const clientURL = 'http://127.0.0.1:3198'
const warning = '제시외 옥탑 부분은 위반건축물로 기재되어 매각 조건 확인이 필요합니다.'
const groupedItems: AppraisalItem[] = [
  { display_order: 50, table_division_name: '토지감정요항표', item_name: '위치 및 주위환경', content: '첫 번째 토지는 주택지에 위치합니다.\n주위는 주택과 근린생활시설이 혼재합니다.' },
  { display_order: 10, table_division_name: '토지감정요항표', item_name: '교통상황', content: '인근에 버스정류장이 있으며 차량 접근이 가능합니다.' },
  { display_order: 30, table_division_name: '건물감정평가요항표', item_name: '건물의 구조', content: '철근콘크리트조 지상 4층 건물입니다.' },
  { display_order: 20, table_division_name: '건물감정평가요항표', item_name: '이용상태', content: '주택으로 이용 중입니다.' },
  { display_order: 40, table_division_name: '토지감정요항표', item_name: '위치 및 주위환경', content: '두 번째 토지는 앞선 토지와 다른 위치에 있습니다.' },
  { display_order: null, table_division_name: null, item_name: null, content: null },
]

function appraisalSection(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: '감정평가', exact: true }) })
}

function narrative(page: Page) {
  return page.getByRole('region', { name: '감정평가 설명', exact: true })
}

async function fixture(page: Page, items: AppraisalItem[], options: { missingAppraisal?: boolean; missingRisks?: boolean; emptyItems?: boolean } = {}) {
  await page.route(/\/api\/v1\/goods\/\d+$/, async route => {
    // route.fetch 대상은 위의 격리 로컬 하네스뿐이다.
    expect(new URL(route.request().url()).origin).toBe(apiURL)
    const response = await route.fetch()
    const detail = await response.json() as GoodsDetailResponse
    const appraisal = {
      ...detail.appraisal,
      goods_specific_remark: warning,
      items: options.emptyItems ? null : items,
    }
    await route.fulfill({
      response,
      json: { ...detail, appraisal: options.missingAppraisal ? null : appraisal, ...(options.missingRisks ? { risk_notices: null } : {}) },
    })
  })
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${apiURL}/__detail_comparison/reset`)
  await page.route(/^https?:\/\//, route => {
    const origin = new URL(route.request().url()).origin
    return [apiURL, clientURL].includes(origin) ? route.fallback() : route.abort()
  })
})

test('감정평가를 하나로 모으고 원문 순서·반복 제목을 보존한다', async ({ page }, testInfo) => {
  await fixture(page, groupedItems)
  await page.goto('/goods/1')
  const section = appraisalSection(page)
  const text = narrative(page)
  await text.scrollIntoViewIfNeeded()
  await expect(text.getByRole('heading', { level: 4 })).toHaveText(['위치 및 주위환경', '교통상황', '건물의 구조'])
  await expect(text.getByRole('heading', { level: 3 })).toHaveText(['토지감정요항표', '건물감정평가요항표'])
  await expect(text.locator('article, table, td')).toHaveCount(0)
  await expect(section.getByText('감정 항목 수', { exact: true })).toHaveCount(0)
  await expect(section.getByText(warning, { exact: true })).toHaveCount(0)
  const areas = page.getByRole('region', { name: '매각목록 면적', exact: true })
  const areasBox = await areas.boundingBox()
  const appraisalBox = await section.boundingBox()
  expect(areasBox!.y + areasBox!.height).toBeLessThan(appraisalBox!.y)
  await section.screenshot({ path: testInfo.outputPath('appraisal-desktop-collapsed.png') })

  await section.getByRole('button', { name: '감정평가 전체 내용 보기', exact: true }).click()
  await expect(text.getByRole('heading', { level: 3 })).toHaveText(['토지감정요항표', '건물감정평가요항표', '토지감정요항표', '기타 감정평가'])
  await expect(text.getByRole('heading', { level: 4 })).toHaveText(['위치 및 주위환경', '교통상황', '건물의 구조', '이용상태', '위치 및 주위환경', '항목명 미확인'])
  for (const item of groupedItems.filter(item => item.content)) {
    await expect(text.getByText(item.content!, { exact: true })).toBeVisible()
  }
  await expect(text.getByText('내용 미확인', { exact: true })).toBeVisible()
  await section.screenshot({ path: testInfo.outputPath('appraisal-desktop-expanded.png') })
})

test('키보드로 펼치고 접어도 API·사진·문서 요청을 추가하지 않는다', async ({ page, request }) => {
  const requests: string[] = []
  const externalRequests: string[] = []
  page.on('request', req => {
    const url = new URL(req.url())
    if (url.pathname.startsWith('/api/')) requests.push(req.url())
    if (/^https?:$/.test(url.protocol) && ![apiURL, clientURL].includes(url.origin)) externalRequests.push(req.url())
  })
  await fixture(page, groupedItems)
  await page.goto('/goods/1')
  const section = appraisalSection(page)
  const toggle = section.getByRole('button', { name: '감정평가 전체 내용 보기', exact: true })
  await toggle.scrollIntoViewIfNeeded()
  await page.waitForLoadState('networkidle')
  const beforeRequests = requests.slice()
  const beforeReads = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  const controls = await toggle.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  await expect(page.locator(`[id="${controls}"]`)).toBeVisible()
  await toggle.focus()
  await page.keyboard.press('Enter')
  const collapse = section.getByRole('button', { name: '감정평가 접기', exact: true })
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
  await expect(narrative(page).getByRole('heading', { level: 4 })).toHaveCount(6)
  await collapse.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(narrative(page).getByRole('heading', { level: 4 })).toHaveCount(3)
  await page.waitForLoadState('networkidle')
  expect(requests).toEqual(beforeRequests)
  expect(externalRequests).toEqual([])
  const afterReads = await (await request.get(`${apiURL}/__detail_comparison/stats`)).json()
  expect(afterReads.photo_reads).toBe(beforeReads.photo_reads)
  expect(afterReads.document_reads).toBe(0)
})

test('모바일에서도 통합 설명이 가로로 넘치지 않고 전체 내용을 펼칠 수 있다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fixture(page, groupedItems)
  await page.goto('/goods/1')
  const section = appraisalSection(page)
  await section.scrollIntoViewIfNeeded()
  await expect(narrative(page).getByRole('heading', { level: 4 })).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('appraisal-mobile-collapsed.png') })
  await section.getByRole('button', { name: '감정평가 전체 내용 보기', exact: true }).click()
  await expect(narrative(page).getByText('두 번째 토지는 앞선 토지와 다른 위치에 있습니다.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await section.screenshot({ path: testInfo.outputPath('appraisal-mobile-expanded.png') })
})

test('항목이 하나여도 긴 원문은 일부만 보여주고 펼치면 끝까지 읽을 수 있다', async ({ page }) => {
  const content = '긴 설명 앞부분입니다.\n' + '건물의 구조와 이용 상태를 원문에 따라 확인합니다. '.repeat(25) + '\n긴 설명의 마지막 문장입니다.'
  await fixture(page, [{ display_order: 1, table_division_name: '건물감정평가요항표', item_name: '이용상태', content }])
  await page.goto('/goods/1')
  const section = appraisalSection(page)
  const text = narrative(page)
  await text.scrollIntoViewIfNeeded()
  await expect(text).toContainText('긴 설명 앞부분입니다.')
  await expect(text).not.toContainText('긴 설명의 마지막 문장입니다.')
  await expect(text.getByRole('heading', { level: 4 })).toHaveCount(1)
  await section.getByRole('button', { name: '감정평가 전체 내용 보기', exact: true }).click()
  await expect(text.getByText(content, { exact: true })).toBeVisible()
  await section.getByRole('button', { name: '감정평가 접기', exact: true }).click()
  await expect(text).not.toContainText('긴 설명의 마지막 문장입니다.')
})

test('짧은 항목은 전부 보여주고 누락된 제목·내용을 없음으로 단정하지 않는다', async ({ page }) => {
  await fixture(page, [
    { display_order: 1, table_division_name: null, item_name: null, content: null },
    { display_order: 2, table_division_name: '   ', item_name: ' ', content: '\n ' },
    { display_order: 3, table_division_name: '토지감정요항표', item_name: '임대관계', content: '없음' },
  ])
  await page.goto('/goods/1')
  const section = appraisalSection(page)
  const text = narrative(page)
  await text.scrollIntoViewIfNeeded()
  await expect(text.getByRole('heading', { name: '기타 감정평가', level: 3 })).toHaveCount(1)
  await expect(text.getByRole('heading', { name: '항목명 미확인', level: 4 })).toHaveCount(2)
  await expect(text.getByText('내용 미확인', { exact: true })).toHaveCount(2)
  await expect(text.getByText('없음', { exact: true })).toHaveCount(1)
  await expect(section.getByRole('button', { name: /감정평가 (전체 내용 보기|접기)/ })).toHaveCount(0)
})

test('감정평가 항목이 비어 있거나 응답에서 누락되어도 화면이 정상 표시된다', async ({ page }) => {
  await fixture(page, [])
  await page.goto('/goods/1')
  await expect(appraisalSection(page)).toContainText('감정평가')
  await expect(appraisalSection(page).getByRole('button', { name: /감정평가 (전체 내용 보기|접기)/ })).toHaveCount(0)
  await expect(appraisalSection(page).getByRole('heading', { level: 4 })).toHaveCount(0)

  await fixture(page, [], { emptyItems: true })
  await page.goto('/goods/2')
  await expect(appraisalSection(page)).toContainText('감정평가')
  await expect(appraisalSection(page).getByRole('heading', { level: 4 })).toHaveCount(0)

  await fixture(page, [], { missingAppraisal: true })
  await page.goto('/goods/3')
  await expect(appraisalSection(page)).toContainText('감정평가')
  await expect(appraisalSection(page).getByRole('heading', { level: 4 })).toHaveCount(0)
})

test('권리 응답이 없어도 감정평가의 매각 주의사항은 한 번 표시한다', async ({ page }) => {
  await fixture(page, groupedItems, { missingRisks: true })
  await page.goto('/goods/1')
  const risks = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: '권리·특수조건 주의사항', exact: true }) })
  await risks.scrollIntoViewIfNeeded()
  await expect(risks.getByText(warning, { exact: true })).toBeVisible()
  await expect(page.getByText(warning, { exact: true })).toHaveCount(1)
})

test('다른 물건으로 이동하면 설명이 다시 접히고 실패 후 재시도로 복구한다', async ({ page }) => {
  await fixture(page, groupedItems)
  await page.goto('/goods/1')
  await appraisalSection(page).getByRole('button', { name: '감정평가 전체 내용 보기', exact: true }).click()
  await expect(narrative(page).getByRole('heading', { level: 4 })).toHaveCount(6)

  let failed = false
  await page.route(`${apiURL}/api/v1/goods/2`, async route => {
    if (!failed) {
      failed = true
      return route.fulfill({ status: 503, json: { detail: '격리 테스트 감정평가 일시 장애' } })
    }
    return route.fallback()
  })
  await page.goto('/goods/2')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '상세 다시 시도', exact: true }).click()
  await expect(appraisalSection(page).getByRole('button', { name: '감정평가 전체 내용 보기', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(narrative(page).getByRole('heading', { level: 4 })).toHaveCount(3)
})
