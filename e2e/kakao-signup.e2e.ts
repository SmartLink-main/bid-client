import { expect, test, type Page, type Request, type Response, type Route } from '@playwright/test'

const VERIFIED_PHONE = '01055550101'
const FALLBACK_PHONE = '01055550102'
const COLLISION_PHONE = '01055550103'
const SMS_LINK_PHONE = '01055550104'
const SAME_NAME_KAKAO_PHONE = '01055550107'
const SMS_CODE = '123456'
const COLLISION_LOGIN_ID = 'kakaocollision'
const COLLISION_PASSWORD = 'ExistingLink!2026'
const SMS_LINK_LOGIN_ID = 'kakaosmslink'
const SETTINGS_LINK_LOGIN_ID = 'kakaosettings'
const SETTINGS_LINK_PASSWORD = 'SettingsLink!2026'

type RequestCounts = {
  smsRequest: number
  smsVerify: number
  signupContext: number
  exchange: number
}

type SignupContext = {
  name: string | null
  phone_number: string | null
  phone_number_verified_by_kakao: boolean
  account_link_required: boolean
  terms_version: string
  privacy_version: string
}

function apiPath(value: Request | Response) {
  return new URL(value.url()).pathname
}

function observeAuthRequests(page: Page) {
  const counts: RequestCounts = {
    smsRequest: 0,
    smsVerify: 0,
    signupContext: 0,
    exchange: 0,
  }

  page.on('request', (request) => {
    if (request.method() !== 'POST') {
      return
    }
    switch (apiPath(request)) {
      case '/api/v1/signup/sms':
        counts.smsRequest += 1
        break
      case '/api/v1/signup/sms/verify':
        counts.smsVerify += 1
        break
      case '/api/v1/oauth/kakao/signup-context':
        counts.signupContext += 1
        break
      case '/api/v1/oauth/kakao/exchange':
        counts.exchange += 1
        break
    }
  })

  return counts
}

async function openKakaoSignup(page: Page, fakeAccountButton: string) {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible()
  await page.getByRole('button', { name: '카카오 로그인', exact: true }).click()

  await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
  const contextResponsePromise = page.waitForResponse((response) => (
    apiPath(response) === '/api/v1/oauth/kakao/signup-context' &&
    response.request().method() === 'POST'
  ))
  await page.getByRole('button', { name: fakeAccountButton, exact: true }).click()

  const contextResponse = await contextResponsePromise
  expect(contextResponse.status()).toBe(200)
  const context = await contextResponse.json() as SignupContext
  await expect(page.getByRole('heading', { name: /카카오 간편가입|기존 계정과 카카오 연결/ })).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/kakao\/callback$/)
  expect(new URL(page.url()).hash).toBe('')
  expect(page.url()).not.toContain('ticket=')
  return context
}

async function acceptRequiredPolicies(page: Page) {
  await page.getByLabel(/서비스 이용약관에 동의/).check()
  await page.getByLabel(/개인정보 수집·이용 안내.*동의/).check()
}

async function expectAccountPhone(page: Page, formattedPhone: string) {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  await expect(
    page.getByRole('region', { name: '회원 정보' }).getByText(formattedPhone, { exact: true }),
  ).toBeVisible()
}

test.describe('카카오 휴대폰 보완 가입 브라우저 E2E', () => {
  test('카카오가 제공한 이름과 전화번호를 요청에서 변조해도 거부한다', async ({ page }) => {
    const requests = observeAuthRequests(page)
    await openKakaoSignup(page, '카카오 검증 휴대폰 계정')

    let tamperAttempt = 0
    await page.route('**/api/v1/oauth/kakao/exchange', async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      tamperAttempt += 1
      await route.continue({
        postData: JSON.stringify(
          tamperAttempt === 1
            ? { ...payload, name: '변조된 이름' }
            : { ...payload, phone_number: FALLBACK_PHONE },
        ),
      })
    })

    await acceptRequiredPolicies(page)
    const submitButton = page.getByRole('button', { name: '카카오 간편가입 완료' })

    const nameTamperResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await submitButton.click()
    expect((await nameTamperResponsePromise).status()).toBe(400)
    await expect(submitButton).toBeEnabled()

    const phoneTamperResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await submitButton.click()
    expect((await phoneTamperResponsePromise).status()).toBe(400)

    expect(tamperAttempt).toBe(2)
    expect(requests).toEqual({
      smsRequest: 0,
      smsVerify: 0,
      signupContext: 1,
      exchange: 2,
    })
    await expect(page).toHaveURL(/\/auth\/kakao\/callback$/)
  })

  test('카카오 제공 정보는 수정할 수 없고 가입 뒤에는 SMS 없이 재로그인한다', async ({ page }) => {
    const requests = observeAuthRequests(page)
    const context = await openKakaoSignup(page, '카카오 검증 휴대폰 계정')

    expect(context).toMatchObject({
      name: '카카오 검증회원',
      phone_number: VERIFIED_PHONE,
      phone_number_verified_by_kakao: true,
    })
    const nameInput = page.getByLabel('이름', { exact: true })
    const phoneInput = page.getByLabel('휴대폰 번호', { exact: true })
    await expect(nameInput).toHaveValue('카카오 검증회원')
    await expect(nameInput).toHaveAttribute('readonly', '')
    await expect(nameInput).not.toBeEditable()
    await expect(phoneInput).toHaveValue(VERIFIED_PHONE)
    await expect(phoneInput).toHaveAttribute('readonly', '')
    await expect(phoneInput).not.toBeEditable()
    await expect(page.getByText('카카오 인증 완료', { exact: true })).toBeVisible()
    await expect(page.getByText(/별도 SMS 인증이 필요하지 않습니다/)).toBeVisible()
    await expect(page.getByRole('button', { name: '인증번호 받기' })).toHaveCount(0)

    await acceptRequiredPolicies(page)
    const exchangeResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '카카오 간편가입 완료' }).click()
    expect((await exchangeResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    expect(requests).toEqual({
      smsRequest: 0,
      smsVerify: 0,
      signupContext: 1,
      exchange: 1,
    })
    await expectAccountPhone(page, '010-5555-0101')

    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
    await page.getByRole('button', { name: '카카오 로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()

    const secondExchangeResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '카카오 검증 휴대폰 계정', exact: true }).click()
    expect((await secondExchangeResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    expect(requests).toEqual({
      smsRequest: 0,
      smsVerify: 0,
      signupContext: 1,
      exchange: 2,
    })
  })

  test('카카오 번호가 없으면 미인증 제출을 막고 SMS 확인 뒤 가입한다', async ({ page }) => {
    const requests = observeAuthRequests(page)
    const context = await openKakaoSignup(page, '휴대폰 없는 카카오 계정')

    expect(context).toMatchObject({
      name: '카카오 번호없음',
      phone_number: null,
      phone_number_verified_by_kakao: false,
    })
    const nameInput = page.getByLabel('이름', { exact: true })
    const phoneInput = page.getByLabel('휴대폰 번호', { exact: true })
    await expect(nameInput).toHaveValue('카카오 번호없음')
    await expect(nameInput).toHaveAttribute('readonly', '')
    await expect(nameInput).not.toBeEditable()
    await expect(phoneInput).toHaveValue('')
    await expect(phoneInput).not.toHaveAttribute('readonly', '')
    await expect(phoneInput).toBeEditable()
    await expect(page.getByText(/휴대폰 번호를 받지 못해 SMS 인증이 필요합니다/)).toBeVisible()
    await acceptRequiredPolicies(page)
    await page.getByRole('button', { name: '카카오 간편가입 완료' }).click()
    await expect(page.getByRole('alert')).toContainText(
      '휴대폰 번호는 010으로 시작하는 숫자 11자리로 입력해 주세요.',
    )
    expect(requests.exchange).toBe(0)

    await phoneInput.fill(FALLBACK_PHONE)
    const smsResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/signup/sms' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '인증번호 받기' }).click()
    expect((await smsResponsePromise).status()).toBe(200)

    await page.getByLabel('인증번호', { exact: true }).fill(SMS_CODE)
    const verifyResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/signup/sms/verify' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '인증번호 확인' }).click()
    expect((await verifyResponsePromise).status()).toBe(200)
    await expect(page.getByRole('button', { name: '확인 완료' })).toBeDisabled()

    const exchangeResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '카카오 간편가입 완료' }).click()
    expect((await exchangeResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    expect(requests).toEqual({
      smsRequest: 1,
      smsVerify: 1,
      signupContext: 1,
      exchange: 1,
    })
    await expectAccountPhone(page, '010-5555-0102')
  })

  test('이름만 같은 기존 회원은 연결 후보로 보지 않고 별도 계정을 만든다', async ({ page }) => {
    const context = await openKakaoSignup(page, '이름만 같은 카카오 계정')

    expect(context).toMatchObject({
      name: '동명이인 회원',
      phone_number: SAME_NAME_KAKAO_PHONE,
      phone_number_verified_by_kakao: true,
      account_link_required: false,
    })
    await expect(page.getByRole('heading', { name: '카카오 간편가입' })).toBeVisible()
    await expect(page.getByText(/이름은 계정 연결 기준으로 사용하지 않으며/)).toHaveCount(0)

    await acceptRequiredPolicies(page)
    const exchangeResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '카카오 간편가입 완료' }).click()
    expect((await exchangeResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    await expectAccountPhone(page, '010-5555-0107')
    await expect(
      page.getByRole('region', { name: '회원 정보' }).getByText('동명이인 회원', { exact: true }),
    ).toBeVisible()
  })

  test('같은 전화번호 계정은 잘못된 비밀번호로 연결하지 않고 재인증 후 기존 정보를 보존한다', async ({ page }) => {
    const requests = observeAuthRequests(page)
    const context = await openKakaoSignup(page, '기존 휴대폰 충돌 계정')

    expect(context).toMatchObject({
      name: '카카오 중복회원',
      phone_number: COLLISION_PHONE,
      phone_number_verified_by_kakao: true,
      account_link_required: true,
    })
    await expect(page.getByRole('heading', { name: '기존 계정과 카카오 연결' })).toBeVisible()
    await expect(page.getByText('자동으로 계정을 합치지 않았습니다.')).toBeVisible()
    await expect(page.getByText(/이름은 계정 연결 기준으로 사용하지 않으며/)).toBeVisible()
    const phoneInput = page.getByLabel('연결 대상 휴대폰 번호')
    await expect(phoneInput).toHaveValue(COLLISION_PHONE)
    await expect(phoneInput).toHaveAttribute('readonly', '')

    await page.getByLabel('기존 계정 아이디').fill(COLLISION_LOGIN_ID)
    await page.getByLabel('기존 계정 비밀번호').fill('WrongLink!2026')
    const rejectedLinkPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '본인 확인 후 카카오 연결' }).click()
    expect((await rejectedLinkPromise).status()).toBe(401)
    await expect(page.getByRole('alert')).toContainText(/인증|올바르지/)
    await expect(page).toHaveURL(/\/auth\/kakao\/callback$/)

    await page.getByLabel('기존 계정 비밀번호').fill(COLLISION_PASSWORD)
    const linkedResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '본인 확인 후 카카오 연결' }).click()
    expect((await linkedResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    await expectAccountPhone(page, '010-5555-0103')
    const accountInfo = page.getByRole('region', { name: '회원 정보' })
    await expect(accountInfo.getByText('기존 번호 회원', { exact: true })).toBeVisible()
    await expect(accountInfo.getByText(COLLISION_LOGIN_ID, { exact: true })).toBeVisible()
    await expect(page.getByText('카카오 로그인이 연결되어 있습니다.')).toBeVisible()
    expect(requests).toEqual({
      smsRequest: 0,
      smsVerify: 0,
      signupContext: 1,
      exchange: 0,
    })

    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    const loginLink = page.getByRole('link', { name: '로그인', exact: true })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL('/login')
    await page.getByRole('button', { name: '카카오 로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    const reloginResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '기존 휴대폰 충돌 계정', exact: true }).click()
    expect((await reloginResponsePromise).status()).toBe(200)
    await expect(page).toHaveURL('/')
    await expectAccountPhone(page, '010-5555-0103')
    await expect(
      page.getByRole('region', { name: '회원 정보' }).getByText('기존 번호 회원', { exact: true }),
    ).toBeVisible()
  })

  test('같은 전화번호 계정을 전용 SMS로 확인한 뒤 연결한다', async ({ page }) => {
    const context = await openKakaoSignup(page, 'SMS 연결 휴대폰 계정')

    expect(context).toMatchObject({
      phone_number: SMS_LINK_PHONE,
      phone_number_verified_by_kakao: true,
      account_link_required: true,
    })
    await page.getByRole('button', { name: '휴대폰 인증' }).click()
    await page.getByLabel('기존 계정 아이디').fill(SMS_LINK_LOGIN_ID)

    const smsResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link/sms' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '인증번호 받기' }).click()
    expect((await smsResponsePromise).status()).toBe(200)

    await page.getByLabel('인증번호', { exact: true }).fill('000000')
    const rejectedVerifyPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link/sms/verify' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '인증번호 확인' }).click()
    expect((await rejectedVerifyPromise).status()).toBe(400)
    await expect(page.getByRole('alert')).toContainText(/인증번호/)

    await page.getByLabel('인증번호', { exact: true }).fill(SMS_CODE)
    const verifyResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link/sms/verify' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '인증번호 확인' }).click()
    expect((await verifyResponsePromise).status()).toBe(200)
    await expect(page.getByRole('button', { name: '확인 완료', exact: true })).toBeDisabled()

    await page.getByLabel('기존 계정 아이디').fill(COLLISION_LOGIN_ID)
    const rejectedLinkPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '본인 확인 후 카카오 연결' }).click()
    expect((await rejectedLinkPromise).status()).toBe(401)
    await expect(page.getByRole('alert')).toContainText(/인증|다시 확인/)

    await page.getByLabel('기존 계정 아이디').fill(SMS_LINK_LOGIN_ID)
    const linkResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '본인 확인 후 카카오 연결' }).click()
    expect((await linkResponsePromise).status()).toBe(200)

    await expect(page).toHaveURL('/')
    await expectAccountPhone(page, '010-5555-0104')
    await expect(
      page.getByRole('region', { name: '회원 정보' }).getByText('기존 SMS 번호 회원', { exact: true }),
    ).toBeVisible()
  })

  test('로그인된 계정은 만료 콜백에서도 세션을 보존하고 카카오 연결·재인증 탈퇴를 완료한다', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('아이디', { exact: true }).fill(SETTINGS_LINK_LOGIN_ID)
    await page.getByLabel('비밀번호', { exact: true }).fill(SETTINGS_LINK_PASSWORD)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).toHaveURL('/')
    await page.goto('/account')

    const linkSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: '카카오 로그인 연결' }),
    })
    const currentPassword = linkSection.getByLabel('현재 비밀번호')
    await currentPassword.fill('WrongSettings!2026')
    const rejectedStartPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/link/start' &&
      response.request().method() === 'POST'
    ))
    await linkSection.getByRole('button', { name: '카카오 계정 연결' }).click()
    expect((await rejectedStartPromise).status()).toBe(401)
    await expect(page.getByRole('alert')).toContainText('현재 비밀번호가 올바르지 않습니다.')

    const expireOAuthState = async (route: Route) => {
      const url = new URL(route.request().url())
      url.searchParams.set('state', `${url.searchParams.get('state')}-expired`)
      await route.continue({ url: url.toString() })
    }
    await page.route('**/__e2e__/kakao/complete?**', expireOAuthState, { times: 1 })
    await currentPassword.fill(SETTINGS_LINK_PASSWORD)
    await linkSection.getByRole('button', { name: '카카오 계정 연결' }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    const restoredSessionPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/refresh' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '내 계정 연결용 카카오 계정', exact: true }).click()
    expect((await restoredSessionPromise).status()).toBe(200)
    await expect(page.getByRole('alert')).toContainText('카카오 인증을 완료하지 못했습니다.')
    const accountRecoveryLink = page.getByRole('link', { name: '내 계정으로 돌아가기' })
    await expect(accountRecoveryLink).toBeVisible()
    await accountRecoveryLink.click()
    await expect(page).toHaveURL('/account')
    await expect(linkSection.getByRole('button', { name: '카카오 계정 연결' })).toBeVisible()

    await currentPassword.fill(SETTINGS_LINK_PASSWORD)
    await linkSection.getByRole('button', { name: '카카오 계정 연결' }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    await page.getByRole('button', { name: '내 계정 연결용 카카오 계정', exact: true }).click()

    await expect(page).toHaveURL('/account')
    await expect(page.getByText('카카오 로그인이 연결되어 있습니다.')).toBeVisible()
    const accountInfo = page.getByRole('region', { name: '회원 정보' })
    await expect(accountInfo.getByText('기존 설정 회원', { exact: true })).toBeVisible()
    await expect(accountInfo.getByText(SETTINGS_LINK_LOGIN_ID, { exact: true })).toBeVisible()
    await expect(accountInfo.getByText('010-5555-0105', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    const loginLink = page.getByRole('link', { name: '로그인', exact: true })
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL('/login')
    await page.getByRole('button', { name: '카카오 로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    const reloginResponsePromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/oauth/kakao/exchange' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '내 계정 연결용 카카오 계정', exact: true }).click()
    expect((await reloginResponsePromise).status()).toBe(200)
    await expect(page).toHaveURL('/')
    await expectAccountPhone(page, '010-5555-0105')
    await expect(
      page.getByRole('region', { name: '회원 정보' }).getByText('기존 설정 회원', { exact: true }),
    ).toBeVisible()

    const deleteSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: '회원 탈퇴' }),
    })
    await expect(deleteSection.getByRole('button', { name: '카카오 재인증 후 탈퇴' })).toBeVisible()
    await expect(deleteSection.getByLabel('현재 비밀번호')).toHaveCount(0)

    page.once('dialog', (dialog) => void dialog.accept())
    await deleteSection.getByRole('button', { name: '카카오 재인증 후 탈퇴' }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    await page.getByRole('button', { name: '카카오 검증 휴대폰 계정', exact: true }).click()
    await expect(page.getByRole('heading', { name: '회원 탈퇴 확인' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('계정은 삭제되지 않았습니다.')
    const preservedAccountLink = page.getByRole('link', { name: '내 계정으로 돌아가기' })
    await expect(preservedAccountLink).toBeVisible()
    await preservedAccountLink.click()
    await expect(page).toHaveURL('/account')
    await expect(
      page.getByRole('region', { name: '회원 정보' }).getByText('기존 설정 회원', { exact: true }),
    ).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await deleteSection.getByRole('button', { name: '카카오 재인증 후 탈퇴' }).click()
    await expect(page.getByRole('heading', { name: '카카오 E2E 제공자' })).toBeVisible()
    await page.getByRole('button', { name: '내 계정 연결용 카카오 계정', exact: true }).click()
    await expect(page).toHaveURL('/')
    const deletedAccountLoginLink = page.getByRole('link', { name: '로그인', exact: true })
    await expect(deletedAccountLoginLink).toBeVisible()
    await deletedAccountLoginLink.click()
    await page.getByLabel('아이디', { exact: true }).fill(SETTINGS_LINK_LOGIN_ID)
    await page.getByLabel('비밀번호', { exact: true }).fill(SETTINGS_LINK_PASSWORD)
    const deletedAccountLoginPromise = page.waitForResponse((response) => (
      apiPath(response) === '/api/v1/login' &&
      response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    expect((await deletedAccountLoginPromise).status()).toBe(401)
  })
})
