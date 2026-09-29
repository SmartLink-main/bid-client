import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const admin = { loginId: 'sqladminadmin', password: 'AdminPass!2026' }
const member = { loginId: 'sqladminmember', password: 'MemberPass!2026' }

async function apiLogin(request: APIRequestContext, user: typeof admin) {
  const response = await request.post('/api/v1/login', {
    data: { login_id: user.loginId, password: user.password },
  })
  expect(response.status()).toBe(200)
  const { access_token: accessToken } = await response.json()
  return { Authorization: `Bearer ${accessToken}` }
}

async function submitLogin(
  page: Page,
  user: { loginId: string; password: string },
) {
  await page.locator('input[name="username"]').fill(user.loginId)
  await page.locator('input[name="password"]').fill(user.password)
  const responsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/admin/login' &&
    response.request().method() === 'POST'
  ))
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  return responsePromise
}

test.describe('SQLAdmin 실제 브라우저 인증 흐름', () => {
  test('일반 회원의 관리자 로그인을 거부한다', async ({ page }) => {
    await page.goto('/admin/')
    await expect(page).toHaveURL('/admin/login')
    await expect(
      page.getByRole('heading', { name: 'Login to bid-auction-api admin' }),
    ).toBeVisible()

    const response = await submitLogin(page, member)

    expect(response.status()).toBe(400)
    await expect(page).toHaveURL('/admin/login')
    await expect(page.locator('.invalid-feedback').first()).toHaveText(
      'Invalid credentials.',
    )
  })

  test('관리자가 로그인하고 회원 목록을 연다', async ({ page }) => {
    await page.goto('/admin/login')

    const response = await submitLogin(page, admin)

    expect(response.status()).toBe(302)
    await expect(page).toHaveURL('/admin/')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'bid-auction-api admin',
        exact: true,
      }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'App User', exact: true }).click()
    await expect(page).toHaveURL('/admin/app-user/list')
    await expect(
      page.getByRole('heading', { name: 'App User', exact: true }),
    ).toBeVisible()
    const tableBody = page.locator('table tbody')
    await expect(tableBody.getByText('SQLAdmin 관리자', { exact: true })).toBeVisible()
    await expect(tableBody.getByText('SQLAdmin 일반 회원', { exact: true })).toBeVisible()
  })
})

test.describe('같은 격리 DB의 알림 HTTP 흐름', () => {
  test('scanner가 생성한 UUID7 알림을 조회하고 읽음 처리한다', async ({ request }) => {
    const headers = await apiLogin(request, admin)
    const inbox = await request.get('/api/v1/notifications', { headers })
    expect(inbox.status()).toBe(200)
    const { items, total, unread_count: unreadCount } = await inbox.json()
    expect(total).toBe(1)
    expect(unreadCount).toBe(1)
    expect(items).toHaveLength(1)
    const notification = items[0]
    expect(notification.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(notification).toMatchObject({ kind: 'auction_reminder', is_read: false, auction_goods_id: 1 })

    const read = await request.put(`/api/v1/notifications/${notification.id}/read`, { headers })
    expect(read.status()).toBe(200)
    expect(await read.json()).toMatchObject({ id: notification.id, is_read: true })
    const count = await request.get('/api/v1/notifications/unread-count', { headers })
    expect(count.status()).toBe(200)
    expect(await count.json()).toEqual({ unread_count: 0 })
  })

  test('무인증 조회와 다른 회원 알림의 읽음 변경을 거부한다', async ({ request }) => {
    expect((await request.get('/api/v1/notifications')).status()).toBe(401)
    const ownerHeaders = await apiLogin(request, admin)
    const ownerInbox = await request.get('/api/v1/notifications', { headers: ownerHeaders })
    expect(ownerInbox.status()).toBe(200)
    const { items } = await ownerInbox.json()
    expect(items).toHaveLength(1)

    const otherHeaders = await apiLogin(request, member)
    const otherInbox = await request.get('/api/v1/notifications', { headers: otherHeaders })
    expect(otherInbox.status()).toBe(200)
    expect(await otherInbox.json()).toMatchObject({ total: 0, items: [] })
    const rejected = await request.put(`/api/v1/notifications/${items[0].id}/read`, { headers: otherHeaders })
    expect(rejected.status()).toBe(404)
  })
})
