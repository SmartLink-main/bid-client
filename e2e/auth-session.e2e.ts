import { expect, test, type Page, type Route } from '@playwright/test'
import { logOutThroughUi, signUpThroughUi } from './support/auth'
import { getE2EUser } from './support/environment'

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

function corsHeaders(route: Route) {
  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': (
      route.request().headers().origin ?? 'http://127.0.0.1:3100'
    ),
  }
}

async function holdSessionRefresh(page: Page) {
  const started = createDeferred()
  const release = createDeferred()
  const finished = createDeferred()
  let postCount = 0

  await page.route('**/api/v1/refresh', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(route) })
      return
    }

    postCount += 1
    started.resolve()
    await release.promise
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: corsHeaders(route),
      body: JSON.stringify({ detail: 'Delayed E2E refresh is invalid.' }),
    }).catch(() => undefined)
    finished.resolve()
  })

  return {
    waitUntilStarted: () => started.promise,
    release: release.resolve,
    waitUntilFinished: () => finished.promise,
    postCount: () => postCount,
  }
}

test.describe('로그인 세션 초기화 브라우저 E2E', () => {
  test('느린 refresh 중에도 로그인 화면을 즉시 열고 새 로그인을 보존한다', async ({ page }) => {
    const user = getE2EUser(3)
    await signUpThroughUi(page, user)

    const delayedRefresh = await holdSessionRefresh(page)
    await logOutThroughUi(page)
    await delayedRefresh.waitUntilStarted()

    const navigationStartedAt = Date.now()
    await page.getByRole('link', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible({
      timeout: 2_000,
    })
    expect(Date.now() - navigationStartedAt).toBeLessThan(2_000)
    await expect(page.getByText('인증 정보를 확인하고 있습니다.')).toHaveCount(0)
    await expect(page.getByLabel('아이디', { exact: true })).toBeEditable()

    await page.getByLabel('아이디', { exact: true }).fill(user.loginId)
    await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
    const loginResponsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/v1/login' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    expect((await loginResponsePromise).ok()).toBe(true)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()

    delayedRefresh.release()
    await delayedRefresh.waitUntilFinished()
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
    expect(delayedRefresh.postCount()).toBe(1)
  })

  test('refresh 장애 중 로그인 실패도 폼에서 즉시 복구해 안내한다', async ({ page }) => {
    const delayedRefresh = await holdSessionRefresh(page)
    await page.goto('/')
    await delayedRefresh.waitUntilStarted()

    await page.getByRole('link', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible({
      timeout: 2_000,
    })
    await page.getByLabel('아이디', { exact: true }).fill('missinguser')
    await page.getByLabel('비밀번호', { exact: true }).fill('wrongpassword')
    await page.getByRole('button', { name: '로그인', exact: true }).click()

    await expect(page.getByRole('status')).toContainText(
      '아이디 또는 비밀번호가 올바르지 않습니다.',
    )
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeEnabled()
    expect(delayedRefresh.postCount()).toBe(1)

    delayedRefresh.release()
    await delayedRefresh.waitUntilFinished()
  })

  test('보호 화면은 refresh 확인 전 노출하지 않고 401 뒤 로그인으로 보낸다', async ({ page }) => {
    const delayedRefresh = await holdSessionRefresh(page)
    await page.goto('/account')
    await delayedRefresh.waitUntilStarted()

    await expect(page.getByRole('status')).toHaveText('인증 정보를 확인하고 있습니다.')
    await expect(page.getByRole('heading', { name: '회원정보' })).toHaveCount(0)

    delayedRefresh.release()
    await delayedRefresh.waitUntilFinished()
    await expect(page).toHaveURL('/login')
    await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  })
})
