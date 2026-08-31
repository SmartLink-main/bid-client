import { expect, test, type Page, type Request } from '@playwright/test'

async function makeAuthBootstrapUnavailable(page: Page) {
  await page.route('**/api/v1/refresh', (route) => route.abort('failed'))
}

function isBillingApiRequest(request: Request) {
  return new URL(request.url()).pathname.startsWith('/api/v1/billing')
}

test.describe('서비스 이용약관과 개인정보처리방침', () => {
  test.beforeEach(async ({ page }) => {
    await makeAuthBootstrapUnavailable(page)
  })

  test('비회원이 푸터에서 두 정책을 차례로 읽을 수 있다', async ({ page }) => {
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    const termsLink = footer.getByRole('link', { name: '이용약관', exact: true })
    const privacyLink = footer.getByRole('link', { name: '개인정보처리방침', exact: true })

    await expect(termsLink).toHaveAttribute('href', '/terms-of-service')
    await expect(privacyLink).toHaveAttribute('href', '/privacy-policy')

    await termsLink.click()
    await expect(page).toHaveURL('/terms-of-service')
    await expect(page.getByRole('heading', { name: '스마트링크 서비스 이용약관' })).toBeVisible()
    await expect(page.getByText('경매 참여 전 공식 문서를 다시 확인해 주세요.')).toBeVisible()
    await expect(page.getByText('2026-08-12', { exact: true })).toBeVisible()

    await page.getByRole('contentinfo').getByRole('link', {
      name: '개인정보처리방침',
      exact: true,
    }).click()
    await expect(page).toHaveURL('/privacy-policy')
    await expect(page.getByRole('heading', { name: '스마트링크 개인정보처리방침' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '회원가입 개인정보 수집·이용 동의 요약' })).toBeVisible()
    await expect(page.getByText('네이버클라우드 주식회사', { exact: true })).toBeVisible()
  })

  test('인증 서버가 응답하지 않아도 정책 직접 진입과 가입 화면 문서 열기가 동작한다', async ({ page, context }) => {
    await page.goto('/privacy-policy#collection-consent')
    await expect(page).toHaveURL('/privacy-policy#collection-consent')
    await expect(page.getByRole('heading', { name: '회원가입 개인정보 수집·이용 동의 요약' })).toBeVisible()
    await expect(page.getByText('필수항목 수집을 거부할 수 있으나', { exact: false })).toBeVisible()

    await page.goto('/signup')
    const signupForm = page.getByRole('main')
    const termsLink = signupForm.getByRole('link', { name: '이용약관', exact: true })
    const collectionLink = signupForm.getByRole('link', { name: '개인정보 수집·이용 안내', exact: true })
    await expect(termsLink).toHaveAttribute('href', '/terms-of-service')
    await expect(collectionLink).toHaveAttribute('href', '/privacy-policy#collection-consent')

    const termsPagePromise = context.waitForEvent('page')
    await termsLink.click()
    const termsPage = await termsPagePromise
    await termsPage.waitForLoadState('domcontentloaded')
    await expect(termsPage.getByRole('heading', { name: '스마트링크 서비스 이용약관' })).toBeVisible()
    await termsPage.close()

    const privacyPagePromise = context.waitForEvent('page')
    await collectionLink.click()
    const privacyPage = await privacyPagePromise
    await privacyPage.waitForLoadState('domcontentloaded')
    await expect(privacyPage.getByRole('heading', { name: '회원가입 개인정보 수집·이용 동의 요약' })).toBeVisible()
    await privacyPage.close()
  })

  test('결제 약관 경로와 결제 API는 계속 숨겨져 있다', async ({ page }) => {
    let billingApiRequests = 0
    page.on('request', (request) => {
      if (isBillingApiRequest(request)) billingApiRequests += 1
    })

    await page.goto('/terms')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: '어떤 경매 물건을 찾으시나요?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '스마트링크 서비스 이용약관' })).toHaveCount(0)
    expect(billingApiRequests).toBe(0)
  })
})
