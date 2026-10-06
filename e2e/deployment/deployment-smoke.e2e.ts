import { expect, test } from '@playwright/test'
import { getDeploymentTarget, installReadOnlyGuard, waitForDeployment } from '../support/deployment-target'

test('새 revision의 앱·API 연결과 메뉴·정책 직접 진입이 동작한다', async ({ context, request }, testInfo) => {
  const target = getDeploymentTarget()
  const revision = await waitForDeployment(request, target)
  await testInfo.attach('deployment-revision', { body: JSON.stringify(revision), contentType: 'application/json' })

  const guard = await installReadOnlyGuard(context, target)
  const page = await context.newPage()
  try {
    const home = await page.goto(target.site.origin, { waitUntil: 'domcontentloaded' })
    expect(home?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '어떤 경매 물건을 찾으시나요?', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '전체 메뉴 열기', exact: true })).toBeVisible()
    await expect.poll(() => [...guard.bootstrapOrigins]).toEqual([target.api.origin])

    // Use the API origin observed from the built client's bootstrap, rather than a mock response.
    const builtApiOrigin = [...guard.bootstrapOrigins][0]
    const anonymous = await page.evaluate(async (apiOrigin) => {
      const response = await fetch(new URL('/api/v1/me', apiOrigin), {
        method: 'GET', credentials: 'include', cache: 'no-store', redirect: 'error',
      })
      await response.text() // Reading succeeds only when the browser's actual CORS policy allows it.
      return { status: response.status, type: response.type }
    }, builtApiOrigin)
    expect(anonymous.status).toBe(401)
    expect(anonymous.type).toBe(target.site.origin === target.api.origin ? 'basic' : 'cors')

    await page.getByRole('button', { name: '전체 메뉴 열기', exact: true }).click()
    await page.getByRole('dialog', { name: '전체 메뉴', exact: true })
      .getByRole('link', { name: '법원별검색', exact: true }).click()
    await expect(page).toHaveURL(new URL('/court-search', target.site).href)
    await expect(page.getByRole('heading', { name: '법원별검색', exact: true })).toBeVisible()
    await page.getByRole('contentinfo').getByRole('link', { name: '이용약관', exact: true }).click()
    await expect(page.getByRole('heading', { name: '스마트링크 서비스 이용약관', exact: true })).toBeVisible()
    await page.getByRole('contentinfo').getByRole('link', { name: '개인정보처리방침', exact: true }).click()
    await expect(page.getByRole('heading', { name: '스마트링크 개인정보처리방침', exact: true })).toBeVisible()

    const deepLink = await page.goto(new URL('/privacy-policy', target.site).href, { waitUntil: 'domcontentloaded' })
    expect(deepLink?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '스마트링크 개인정보처리방침', exact: true })).toBeVisible()
    expect(guard.unexpectedMutations).toEqual([])
    expect(guard.blockedRedirects).toEqual([])
    expect(guard.scriptFailures).toEqual([])
    expect(guard.exceptions).toEqual([])
  } catch (error) {
    await testInfo.attach('deployment-diagnostics', {
      body: JSON.stringify({ ...guard, bootstrapOrigins: [...guard.bootstrapOrigins] }),
      contentType: 'application/json',
    })
    await testInfo.attach('deployment-page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    throw error
  }
})
