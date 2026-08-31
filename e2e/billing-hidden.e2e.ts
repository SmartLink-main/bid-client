import { expect, test, type Request } from '@playwright/test'
import { signUpThroughUi } from './support/auth'
import { getE2EUser } from './support/environment'

const HIDDEN_BILLING_PATHS = [
  '/pricing',
  '/terms',
  '/refund-policy',
  '/checkout/archived-price',
  '/payments/success?paymentKey=archived&orderId=archived&amount=1',
  '/payments/fail?code=PAY_PROCESS_CANCELED&message=archived',
  '/account/billing',
]

function isBillingApiRequest(request: Request) {
  return new URL(request.url()).pathname.startsWith('/api/v1/billing')
}

test.describe('결제 UI 비노출 브라우저 E2E', () => {
  test('기존 결제 URL을 홈으로 보내고 결제 API를 호출하지 않는다', async ({ page }) => {
    let billingApiRequests = 0
    page.on('request', (request) => {
      if (isBillingApiRequest(request)) billingApiRequests += 1
    })

    for (const path of HIDDEN_BILLING_PATHS) {
      await page.goto(path)
      await expect(page).toHaveURL('/')
      await expect(page.getByRole('heading', { name: '어떤 경매 물건을 찾으시나요?' })).toBeVisible()
    }

    expect(billingApiRequests).toBe(0)
  })

  test('로그인 후에도 메뉴와 계정 화면에 결제 진입점을 노출하지 않는다', async ({ page }) => {
    let billingApiRequests = 0
    page.on('request', (request) => {
      if (isBillingApiRequest(request)) billingApiRequests += 1
    })

    await signUpThroughUi(page, getE2EUser(4))

    await expect(page.getByRole('link', { name: '이용권', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '유료서비스 약관', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '환불 안내', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
    await expect(page.getByRole('link', { name: '요금제 보기', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '결제 관리', exact: true })).toHaveCount(0)

    await page.goto('/account')
    await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '결제 관리', exact: true })).toHaveCount(0)
    expect(billingApiRequests).toBe(0)
  })
})
