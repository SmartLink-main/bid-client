import { expect, test, type Page } from '@playwright/test'

const member = { loginId: 'inquirymember', password: 'MemberPass!2026' }
const otherMember = { loginId: 'othermember', password: 'OtherPass!2026' }
const admin = { loginId: 'inquiryadmin', password: 'AdminPass!2026' }

type Deferred = {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolve!: () => void
  return {
    promise: new Promise<void>((done) => {
      resolve = done
    }),
    resolve,
  }
}

function inquiryFixture(index: number) {
  const sequence = String(index + 1).padStart(2, '0')
  return {
    id: `pagination-inquiry-${sequence}`,
    title: `과거 문의 ${sequence}`,
    content: `과거 문의 내용 ${sequence}`,
    answer: null,
    status: 'pending',
    created_at: `2026-08-27T00:${sequence}:00Z`,
    updated_at: `2026-08-27T00:${sequence}:00Z`,
    answered_at: null,
  }
}

async function login(page: Page, user: { loginId: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('아이디', { exact: true }).fill(user.loginId)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible()
}

test.describe('1:1 문의 실제 사용자 흐름', () => {
  test('회원 접수부터 관리자 답변과 회원 확인까지 실제 API로 처리한다', async ({ page }) => {
    const title = '매각기일 표시 확인 요청'
    const content = '상세 화면과 일정 화면의 날짜가 같은지 확인해 주세요.'
    const answer = '법원 공고와 대조했으며 현재 표시된 매각기일이 맞습니다.'

    await login(page, member)
    await page.goto('/support')
    await expect(page.getByRole('heading', { name: '1:1 문의' })).toBeVisible()
    await expect(page.getByText('문의 내역을 불러오는 중', { exact: true })).toHaveCount(0)
    await expect(page.getByText('아직 접수한 문의가 없습니다.', { exact: true })).toBeVisible()
    await page.getByLabel('제목').fill(title)
    await page.getByLabel('문의 내용').fill(content)
    await page.getByRole('button', { name: '문의 접수' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '문의가 접수되었습니다' }),
    ).toContainText('문의가 접수되었습니다')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText(content, { exact: true })).toBeVisible()
    await expect(page.getByText('답변 대기', { exact: true })).toBeVisible()
    await logout(page)

    await login(page, otherMember)
    await page.goto('/support')
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    await expect(page.getByText('아직 접수한 문의가 없습니다.')).toBeVisible()
    await logout(page)

    await login(page, admin)
    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
    await page.getByRole('link', { name: '문의 관리', exact: true }).click()
    await expect(page).toHaveURL('/admin/inquiries')
    await expect(page.getByRole('heading', { name: '문의 관리' })).toBeVisible()
    await expect(page.getByText(content, { exact: true })).toBeVisible()
    await page.getByLabel('관리자 답변').fill(answer)
    await page.getByRole('button', { name: '답변 등록' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '답변을 저장했습니다.' }),
    ).toHaveText('답변을 저장했습니다.')
    await expect(page.getByText('답변 완료', { exact: true })).toBeVisible()
    await logout(page)

    await login(page, member)
    await page.goto('/support')
    await expect(page.getByText(answer, { exact: true })).toBeVisible()
    await expect(page.getByText('답변 완료', { exact: true })).toBeVisible()
  })

  test('접수 전 시작된 목록 응답이 새 문의를 덮어쓰지 않는다', async ({ page }) => {
    await login(page, member)
    const title = '목록 경합 방지 확인 문의'
    const createdInquiry = {
      ...inquiryFixture(0),
      id: 'race-inquiry',
      title,
      content: '이전 목록 응답보다 새 문의가 우선되어야 합니다.',
    }
    const staleRequestStarted = createDeferred()
    const releaseStaleRequest = createDeferred()
    const staleRequestFinished = createDeferred()
    let listRequestCount = 0

    await page.route('**/api/v1/inquiries*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createdInquiry),
        })
        return
      }
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      listRequestCount += 1
      if (listRequestCount > 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            items: [createdInquiry],
          }),
        })
        return
      }

      staleRequestStarted.resolve()
      try {
        await releaseStaleRequest.promise
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ total: 0, limit: 50, offset: 0, items: [] }),
        }).catch(() => undefined)
      } finally {
        staleRequestFinished.resolve()
      }
    })

    await page.goto('/support')
    await staleRequestStarted.promise
    await page.getByLabel('제목').fill(title)
    await page.getByLabel('문의 내용').fill(createdInquiry.content)
    await page.getByRole('button', { name: '문의 접수' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '문의가 접수되었습니다' }),
    ).toContainText('문의가 접수되었습니다')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    releaseStaleRequest.resolve()
    await staleRequestFinished.promise
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    expect(listRequestCount).toBeGreaterThanOrEqual(2)
  })

  test('50개 이후의 과거 문의를 더 불러올 수 있다', async ({ page }) => {
    await login(page, member)
    const inquiries = Array.from({ length: 51 }, (_, index) => inquiryFixture(index))
    const requestedOffsets: number[] = []

    await page.route('**/api/v1/inquiries?*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      const requestUrl = new URL(route.request().url())
      const limit = Number(requestUrl.searchParams.get('limit'))
      const offset = Number(requestUrl.searchParams.get('offset'))
      requestedOffsets.push(offset)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: inquiries.length,
          limit,
          offset,
          items: inquiries.slice(offset, offset + limit),
        }),
      })
    })

    await page.goto('/support')
    await expect(page.locator('article')).toHaveCount(50)
    await page.getByRole('button', { name: '이전 문의 더 보기 (50/51)' }).click()
    await expect(page.locator('article')).toHaveCount(51)
    await expect(page.getByRole('heading', { name: '과거 문의 51' })).toBeVisible()
    await expect(page.getByRole('button', { name: /이전 문의 더 보기/ })).toHaveCount(0)
    expect(requestedOffsets).toEqual([0, 50])
  })

  test('일반 회원의 관리자 문의 URL 직접 접근을 실제 API가 거부한다', async ({ page }) => {
    await login(page, member)
    const responsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/v1/admin/inquiries' &&
      response.request().method() === 'GET'
    ))
    await page.goto('/admin/inquiries')
    expect((await responsePromise).status()).toBe(403)
    await expect(page.getByRole('heading', { name: '관리자 권한이 필요합니다' })).toBeVisible()
    await expect(page.getByLabel('관리자 답변')).toHaveCount(0)
  })

  test('비회원은 문의 화면 대신 로그인으로 이동하고 원래 경로를 보존한다', async ({ page }) => {
    await page.goto('/support')
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('1:1 문의는 로그인 후 이용할 수 있습니다.')).toBeVisible()
    await page.getByLabel('아이디', { exact: true }).fill(member.loginId)
    await page.getByLabel('비밀번호', { exact: true }).fill(member.password)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).toHaveURL('/support')
  })
})
